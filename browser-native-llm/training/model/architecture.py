"""
Model architecture definition for the SMART Planner transformer.

Implements a decoder-only transformer with:
- RoPE positional embeddings
- RMSNorm normalisation
- SwiGLU feed-forward activation
- Grouped-Query Attention (GQA)

These are modern efficiency defaults matching the research specification
for a ~150M parameter model optimised for browser deployment.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from dataclasses import dataclass
from typing import Optional


@dataclass
class ModelConfig:
    """Model architecture hyperparameters."""
    d_model: int = 768
    n_layers: int = 12
    n_heads: int = 12
    n_kv_heads: int = 4
    d_ff: int = 2048
    vocab_size: int = 32000
    max_seq_length: int = 1024
    norm_eps: float = 1e-5
    rope_theta: float = 10000.0
    dropout: float = 0.0

    @property
    def head_dim(self) -> int:
        return self.d_model // self.n_heads

    @property
    def kv_repeat(self) -> int:
        return self.n_heads // self.n_kv_heads


# --- Building blocks ---


class RMSNorm(nn.Module):
    """Root Mean Square Layer Normalisation."""

    def __init__(self, dim: int, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        norm = x.float().pow(2).mean(-1, keepdim=True).add(self.eps).rsqrt()
        return (x.float() * norm).type_as(x) * self.weight


def precompute_rope_freqs(dim: int, max_len: int, theta: float = 10000.0) -> torch.Tensor:
    """Precompute RoPE frequency tensor for complex exponentials."""
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2).float() / dim))
    t = torch.arange(max_len, dtype=torch.float32)
    freqs = torch.outer(t, freqs)
    return torch.polar(torch.ones_like(freqs), freqs)  # complex64


def apply_rope(
    xq: torch.Tensor,
    xk: torch.Tensor,
    freqs: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Apply RoPE to query and key tensors."""
    # Reshape to complex
    xq_complex = torch.view_as_complex(xq.float().reshape(*xq.shape[:-1], -1, 2))
    xk_complex = torch.view_as_complex(xk.float().reshape(*xk.shape[:-1], -1, 2))

    # Apply rotation
    freqs = freqs[:xq.shape[-2], :]
    freqs = freqs.unsqueeze(0).unsqueeze(0)  # (1, 1, seq_len, head_dim/2)

    xq_out = torch.view_as_real(xq_complex * freqs).flatten(-2)
    xk_out = torch.view_as_real(xk_complex * freqs).flatten(-2)

    return xq_out.type_as(xq), xk_out.type_as(xk)


def repeat_kv(x: torch.Tensor, n_rep: int) -> torch.Tensor:
    """Repeat KV heads to match query head count (for GQA)."""
    if n_rep == 1:
        return x
    bs, n_kv_heads, seq_len, head_dim = x.shape
    x = x[:, :, None, :, :].expand(bs, n_kv_heads, n_rep, seq_len, head_dim)
    return x.reshape(bs, n_kv_heads * n_rep, seq_len, head_dim)


class GroupedQueryAttention(nn.Module):
    """Multi-head attention with Grouped-Query Attention (GQA)."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.n_heads = config.n_heads
        self.n_kv_heads = config.n_kv_heads
        self.head_dim = config.head_dim
        self.kv_repeat = config.kv_repeat

        self.wq = nn.Linear(config.d_model, config.n_heads * config.head_dim, bias=False)
        self.wk = nn.Linear(config.d_model, config.n_kv_heads * config.head_dim, bias=False)
        self.wv = nn.Linear(config.d_model, config.n_kv_heads * config.head_dim, bias=False)
        self.wo = nn.Linear(config.n_heads * config.head_dim, config.d_model, bias=False)

        self.dropout = nn.Dropout(config.dropout)

    def forward(
        self,
        x: torch.Tensor,
        freqs: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        bs, seq_len, _ = x.shape

        # Project to Q, K, V
        q = self.wq(x).view(bs, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.wk(x).view(bs, seq_len, self.n_kv_heads, self.head_dim).transpose(1, 2)
        v = self.wv(x).view(bs, seq_len, self.n_kv_heads, self.head_dim).transpose(1, 2)

        # Apply RoPE
        q, k = apply_rope(q, k, freqs)

        # Repeat KV for GQA
        k = repeat_kv(k, self.kv_repeat)
        v = repeat_kv(v, self.kv_repeat)

        # Scaled dot-product attention
        attn = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        if mask is not None:
            attn = attn + mask
        attn = F.softmax(attn, dim=-1)
        attn = self.dropout(attn)

        output = torch.matmul(attn, v)
        output = output.transpose(1, 2).contiguous().view(bs, seq_len, -1)
        return self.wo(output)


class SwiGLUFFN(nn.Module):
    """SwiGLU feed-forward network."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.w1 = nn.Linear(config.d_model, config.d_ff, bias=False)
        self.w2 = nn.Linear(config.d_ff, config.d_model, bias=False)
        self.w3 = nn.Linear(config.d_model, config.d_ff, bias=False)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.w2(F.silu(self.w1(x)) * self.w3(x)))


class TransformerBlock(nn.Module):
    """Single transformer block with pre-norm architecture."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.attention = GroupedQueryAttention(config)
        self.ffn = SwiGLUFFN(config)
        self.attention_norm = RMSNorm(config.d_model, config.norm_eps)
        self.ffn_norm = RMSNorm(config.d_model, config.norm_eps)

    def forward(
        self,
        x: torch.Tensor,
        freqs: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        # Pre-norm residual connections
        x = x + self.attention(self.attention_norm(x), freqs, mask)
        x = x + self.ffn(self.ffn_norm(x))
        return x


class SmartPlannerModel(nn.Module):
    """
    SMART Planner: decoder-only transformer for generating
    structured SMART job-seeking actions.
    """

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config

        self.token_embedding = nn.Embedding(config.vocab_size, config.d_model)
        self.layers = nn.ModuleList([
            TransformerBlock(config) for _ in range(config.n_layers)
        ])
        self.norm = RMSNorm(config.d_model, config.norm_eps)
        self.output = nn.Linear(config.d_model, config.vocab_size, bias=False)

        # Tie input/output embeddings (reduces params)
        self.output.weight = self.token_embedding.weight

        # Precompute RoPE frequencies
        self.register_buffer(
            "rope_freqs",
            precompute_rope_freqs(config.head_dim, config.max_seq_length, config.rope_theta),
            persistent=False,
        )

        # Causal mask
        mask = torch.full((config.max_seq_length, config.max_seq_length), float("-inf"))
        mask = torch.triu(mask, diagonal=1)
        self.register_buffer("causal_mask", mask, persistent=False)

        # Initialise weights
        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(
        self,
        input_ids: torch.Tensor,
        labels: Optional[torch.Tensor] = None,
    ) -> dict[str, torch.Tensor]:
        bs, seq_len = input_ids.shape
        assert seq_len <= self.config.max_seq_length, (
            f"Sequence length {seq_len} exceeds max {self.config.max_seq_length}"
        )

        x = self.token_embedding(input_ids)
        mask = self.causal_mask[:seq_len, :seq_len]

        for layer in self.layers:
            x = layer(x, self.rope_freqs, mask)

        x = self.norm(x)
        logits = self.output(x)

        result = {"logits": logits}

        if labels is not None:
            # Shift logits and labels for next-token prediction
            shift_logits = logits[:, :-1, :].contiguous()
            shift_labels = labels[:, 1:].contiguous()
            loss = F.cross_entropy(
                shift_logits.view(-1, self.config.vocab_size),
                shift_labels.view(-1),
                ignore_index=-100,
            )
            result["loss"] = loss

        return result

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())

    @classmethod
    def from_config_file(cls, path: str) -> "SmartPlannerModel":
        """Load model from a YAML config file."""
        import yaml

        with open(path) as f:
            raw = yaml.safe_load(f)

        model_cfg = raw.get("model", raw)
        config = ModelConfig(
            d_model=model_cfg["d_model"],
            n_layers=model_cfg["n_layers"],
            n_heads=model_cfg["n_heads"],
            n_kv_heads=model_cfg.get("n_kv_heads", model_cfg["n_heads"]),
            d_ff=model_cfg["d_ff"],
            vocab_size=model_cfg["vocab_size"],
            max_seq_length=model_cfg["max_seq_length"],
            norm_eps=model_cfg.get("norm_eps", 1e-5),
            rope_theta=model_cfg.get("rope_theta", 10000.0),
            dropout=model_cfg.get("dropout", 0.0),
        )

        return cls(config)


if __name__ == "__main__":
    # Quick sanity check
    config = ModelConfig()
    model = SmartPlannerModel(config)
    print(f"Model: {config.d_model}d, {config.n_layers}L, {config.n_heads}H")
    print(f"Parameters: {model.count_parameters():,}")

    # Test forward pass
    dummy_input = torch.randint(0, config.vocab_size, (2, 64))
    output = model(dummy_input)
    print(f"Logits shape: {output['logits'].shape}")

    # With labels
    output = model(dummy_input, labels=dummy_input)
    print(f"Loss: {output['loss'].item():.4f}")
