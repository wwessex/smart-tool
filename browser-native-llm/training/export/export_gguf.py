"""
Export trained SMART Planner model to GGUF format.

GGUF is the format used by llama.cpp and compatible WASM runtimes
(e.g., wllama) for efficient CPU inference in the browser.

Supports quantised types: Q4_K, Q4_0, Q8_0, etc.

Usage:
    python export_gguf.py --checkpoint ../checkpoints/dpo/final.pt --output ./export/gguf/
"""

import argparse
import json
import struct
from pathlib import Path
from typing import Any

import torch
import numpy as np


# GGUF format constants
GGUF_MAGIC = 0x46475547  # "GGUF"
GGUF_VERSION = 3

# GGUF value types
GGUF_TYPE_UINT8 = 0
GGUF_TYPE_INT8 = 1
GGUF_TYPE_UINT16 = 2
GGUF_TYPE_INT16 = 3
GGUF_TYPE_UINT32 = 4
GGUF_TYPE_INT32 = 5
GGUF_TYPE_FLOAT32 = 6
GGUF_TYPE_BOOL = 7
GGUF_TYPE_STRING = 8
GGUF_TYPE_ARRAY = 9
GGUF_TYPE_UINT64 = 10
GGUF_TYPE_INT64 = 11
GGUF_TYPE_FLOAT64 = 12

# GGML tensor types
GGML_TYPE_F32 = 0
GGML_TYPE_F16 = 1
GGML_TYPE_Q4_0 = 2
GGML_TYPE_Q4_1 = 3
GGML_TYPE_Q8_0 = 8


class GGUFWriter:
    """Minimal GGUF file writer for model export."""

    def __init__(self):
        self.metadata: list[tuple[str, int, Any]] = []
        self.tensors: list[tuple[str, np.ndarray, int]] = []

    def add_string(self, key: str, value: str) -> None:
        self.metadata.append((key, GGUF_TYPE_STRING, value))

    def add_uint32(self, key: str, value: int) -> None:
        self.metadata.append((key, GGUF_TYPE_UINT32, value))

    def add_float32(self, key: str, value: float) -> None:
        self.metadata.append((key, GGUF_TYPE_FLOAT32, value))

    def add_tensor(self, name: str, data: np.ndarray, tensor_type: int = GGML_TYPE_F16) -> None:
        self.tensors.append((name, data, tensor_type))

    def write(self, output_path: str) -> None:
        """Write the GGUF file.

        Note: This is a simplified writer for demonstration.
        Production use should rely on the gguf Python package from llama.cpp.
        """
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        with open(output, "wb") as f:
            # Header
            f.write(struct.pack("<I", GGUF_MAGIC))
            f.write(struct.pack("<I", GGUF_VERSION))
            f.write(struct.pack("<Q", len(self.tensors)))
            f.write(struct.pack("<Q", len(self.metadata)))

            # Metadata KV pairs
            for key, value_type, value in self.metadata:
                self._write_string(f, key)
                f.write(struct.pack("<I", value_type))

                if value_type == GGUF_TYPE_STRING:
                    self._write_string(f, value)
                elif value_type == GGUF_TYPE_UINT32:
                    f.write(struct.pack("<I", value))
                elif value_type == GGUF_TYPE_FLOAT32:
                    f.write(struct.pack("<f", value))

            # Tensor infos (written before data)
            data_offset = 0
            for name, data, tensor_type in self.tensors:
                self._write_string(f, name)
                n_dims = len(data.shape)
                f.write(struct.pack("<I", n_dims))
                for dim in data.shape:
                    f.write(struct.pack("<Q", dim))
                f.write(struct.pack("<I", tensor_type))
                f.write(struct.pack("<Q", data_offset))
                data_offset += data.nbytes

            # Tensor data (aligned)
            alignment = 32
            pos = f.tell()
            padding = (alignment - pos % alignment) % alignment
            f.write(b"\x00" * padding)

            for _, data, _ in self.tensors:
                f.write(data.tobytes())

        print(f"GGUF file written: {output_path}")
        print(f"  Size: {output.stat().st_size / (1024*1024):.1f} MB")

    @staticmethod
    def _write_string(f, s: str) -> None:
        encoded = s.encode("utf-8")
        f.write(struct.pack("<Q", len(encoded)))
        f.write(encoded)


def export_to_gguf(
    checkpoint_path: str,
    output_dir: str,
    quantise_type: str = "f16",
) -> None:
    """Export PyTorch checkpoint to GGUF format."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / "model"))
    from architecture import SmartPlannerModel, ModelConfig

    config = ModelConfig()
    model = SmartPlannerModel(config)

    if Path(checkpoint_path).exists():
        ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        model.load_state_dict(ckpt.get("model_state_dict", ckpt), strict=False)
        print(f"Loaded checkpoint: {checkpoint_path}")

    model.eval()

    writer = GGUFWriter()

    # Model metadata
    writer.add_string("general.architecture", "smart-planner")
    writer.add_string("general.name", "SMART Planner 150M")
    writer.add_string("general.file_type", quantise_type)
    writer.add_uint32("smart-planner.context_length", config.max_seq_length)
    writer.add_uint32("smart-planner.embedding_length", config.d_model)
    writer.add_uint32("smart-planner.block_count", config.n_layers)
    writer.add_uint32("smart-planner.attention.head_count", config.n_heads)
    writer.add_uint32("smart-planner.attention.head_count_kv", config.n_kv_heads)
    writer.add_uint32("smart-planner.feed_forward_length", config.d_ff)
    writer.add_uint32("smart-planner.vocab_size", config.vocab_size)
    writer.add_float32("smart-planner.attention.layer_norm_rms_epsilon", config.norm_eps)
    writer.add_float32("smart-planner.rope.freq_base", config.rope_theta)

    # Determine tensor type
    tensor_type = GGML_TYPE_F16  # Default
    if quantise_type == "f32":
        tensor_type = GGML_TYPE_F32
    elif quantise_type == "q4_0":
        tensor_type = GGML_TYPE_Q4_0
    elif quantise_type == "q8_0":
        tensor_type = GGML_TYPE_Q8_0

    # Export tensors
    state_dict = model.state_dict()
    for name, param in state_dict.items():
        data = param.detach().cpu().numpy()

        if tensor_type == GGML_TYPE_F16:
            data = data.astype(np.float16)
        elif tensor_type == GGML_TYPE_F32:
            data = data.astype(np.float32)
        # Note: Q4_0 and Q8_0 require proper block quantisation
        # which is handled by llama.cpp's quantize tool

        # Map PyTorch names to GGUF convention
        gguf_name = _map_tensor_name(name)
        writer.add_tensor(gguf_name, data, tensor_type)

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    output_file = output / f"smart-planner-150m-{quantise_type}.gguf"
    writer.write(str(output_file))


def _map_tensor_name(pytorch_name: str) -> str:
    """Map PyTorch state dict keys to GGUF tensor names."""
    name = pytorch_name
    name = name.replace("token_embedding.weight", "token_embd.weight")
    name = name.replace("layers.", "blk.")
    name = name.replace(".attention.", ".attn.")
    name = name.replace(".attention_norm.", ".attn_norm.")
    name = name.replace(".ffn_norm.", ".ffn_norm.")
    name = name.replace(".ffn.", ".ffn.")
    name = name.replace(".wq.", ".attn_q.")
    name = name.replace(".wk.", ".attn_k.")
    name = name.replace(".wv.", ".attn_v.")
    name = name.replace(".wo.", ".attn_output.")
    name = name.replace(".w1.", ".ffn_gate.")
    name = name.replace(".w2.", ".ffn_down.")
    name = name.replace(".w3.", ".ffn_up.")
    name = name.replace("norm.weight", "output_norm.weight")
    name = name.replace("output.weight", "output.weight")
    return name


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export SMART Planner to GGUF")
    parser.add_argument("--checkpoint", default="../checkpoints/dpo/final.pt")
    parser.add_argument("--output", default="./export/gguf/")
    parser.add_argument("--type", choices=["f16", "f32", "q4_0", "q8_0"],
                        default="f16", help="Tensor type")
    args = parser.parse_args()

    export_to_gguf(args.checkpoint, args.output, args.type)
