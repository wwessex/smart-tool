"""
Direct Preference Optimisation (DPO) script for Stage 3.

Trains on pairwise preference data to improve output quality,
safety, and conciseness. Uses the SFT model as both the policy
and the reference model (frozen copy).

Usage:
    python dpo.py --config ../config/dpo_config.yaml
"""

import argparse
import json
import math
import time
from pathlib import Path
from copy import deepcopy

import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import yaml

from architecture import SmartPlannerModel, ModelConfig


class DPODataset(Dataset):
    """Dataset for DPO preference pairs."""

    def __init__(
        self,
        data_paths: list[str],
        max_seq_length: int = 1024,
    ):
        self.pairs = []
        self.max_seq_length = max_seq_length

        for path in data_paths:
            if Path(path).exists():
                with open(path) as f:
                    for line in f:
                        record = json.loads(line)
                        self.pairs.append(record)

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> dict:
        pair = self.pairs[idx]

        prompt = pair.get("prompt", "")
        chosen = pair.get("chosen", "")
        rejected = pair.get("rejected", "")

        # Tokenise (placeholder - uses char-level for validation)
        chosen_text = f"{prompt}\n{chosen}"
        rejected_text = f"{prompt}\n{rejected}"

        chosen_ids = self._tokenize(chosen_text)
        rejected_ids = self._tokenize(rejected_text)
        prompt_ids = self._tokenize(prompt)

        return {
            "chosen_ids": chosen_ids,
            "rejected_ids": rejected_ids,
            "prompt_length": min(len(prompt), self.max_seq_length),
        }

    def _tokenize(self, text: str) -> torch.Tensor:
        tokens = [ord(c) % 32000 for c in text[:self.max_seq_length]]
        tokens = tokens + [0] * (self.max_seq_length - len(tokens))
        return torch.tensor(tokens, dtype=torch.long)


def dpo_loss(
    policy_chosen_logps: torch.Tensor,
    policy_rejected_logps: torch.Tensor,
    ref_chosen_logps: torch.Tensor,
    ref_rejected_logps: torch.Tensor,
    beta: float = 0.1,
    label_smoothing: float = 0.0,
) -> torch.Tensor:
    """Compute DPO loss (sigmoid formulation).

    Loss = -log(sigmoid(beta * (
        (log_pi(chosen) - log_ref(chosen)) -
        (log_pi(rejected) - log_ref(rejected))
    )))
    """
    chosen_rewards = beta * (policy_chosen_logps - ref_chosen_logps)
    rejected_rewards = beta * (policy_rejected_logps - ref_rejected_logps)

    logits = chosen_rewards - rejected_rewards

    if label_smoothing > 0:
        losses = (
            -F.logsigmoid(logits) * (1 - label_smoothing)
            - F.logsigmoid(-logits) * label_smoothing
        )
    else:
        losses = -F.logsigmoid(logits)

    return losses.mean()


def get_log_probs(
    model: SmartPlannerModel,
    input_ids: torch.Tensor,
    prompt_length: int,
) -> torch.Tensor:
    """Get per-token log probabilities for the response portion."""
    with torch.no_grad() if not model.training else torch.enable_grad():
        output = model(input_ids)
        logits = output["logits"]

    # Only compute log probs for the response (after prompt)
    response_logits = logits[:, prompt_length - 1:-1, :]
    response_labels = input_ids[:, prompt_length:]

    log_probs = F.log_softmax(response_logits, dim=-1)
    per_token_logps = torch.gather(
        log_probs, dim=-1, index=response_labels.unsqueeze(-1)
    ).squeeze(-1)

    # Mask padding
    mask = (response_labels != 0).float()
    return (per_token_logps * mask).sum(dim=-1)


def train(config_path: str):
    """Run DPO training."""
    with open(config_path) as f:
        full_config = yaml.safe_load(f)

    train_cfg = full_config["training"]
    dpo_cfg = train_cfg["dpo"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.bfloat16 if train_cfg["precision"] == "bf16" else torch.float16

    # Load SFT model as policy
    model_config = ModelConfig()
    policy_model = SmartPlannerModel(model_config).to(device)

    checkpoint_path = train_cfg["checkpoint"].get("load_from")
    if checkpoint_path and Path(checkpoint_path).exists():
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)
        policy_model.load_state_dict(ckpt.get("model_state_dict", ckpt), strict=False)
        print(f"Loaded SFT weights from {checkpoint_path}")

    # Create frozen reference model
    ref_model = deepcopy(policy_model)
    ref_model.eval()
    for param in ref_model.parameters():
        param.requires_grad = False

    print(f"Policy model parameters: {policy_model.count_parameters():,}")

    # Optimiser
    opt_cfg = train_cfg["optimizer"]
    optimizer = torch.optim.AdamW(
        policy_model.parameters(),
        lr=opt_cfg["lr"],
        betas=tuple(opt_cfg["betas"]),
        weight_decay=opt_cfg["weight_decay"],
        eps=opt_cfg["eps"],
    )

    # Dataset
    data_cfg = train_cfg["data"]
    data_paths = [
        f"./data/preferences/{source['name']}.jsonl"
        for source in data_cfg["sources"]
    ]
    dataset = DPODataset(data_paths, max_seq_length=model_config.max_seq_length)

    if len(dataset) == 0:
        print("Warning: No preference data found. Using dummy data.")
        dataset.pairs = [
            {"prompt": "test", "chosen": "good", "rejected": "bad"}
        ] * 100

    batch_cfg = train_cfg["batch"]
    dataloader = DataLoader(
        dataset,
        batch_size=batch_cfg["micro_batch_size"],
        shuffle=True,
        num_workers=2,
    )

    # Training loop
    total_steps = train_cfg["schedule"]["total_steps"]
    grad_accum = batch_cfg["gradient_accumulation_steps"]
    checkpoint_cfg = train_cfg["checkpoint"]

    checkpoint_dir = Path(checkpoint_cfg["output_dir"])
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    policy_model.train()
    step = 0
    epoch = 0
    accum_loss = 0.0
    start_time = time.time()

    print(f"Starting DPO for {total_steps} steps on {len(dataset)} pairs")
    print(f"  Beta: {dpo_cfg['beta']}")

    while step < total_steps:
        epoch += 1
        for batch in dataloader:
            if step >= total_steps:
                break

            chosen_ids = batch["chosen_ids"].to(device)
            rejected_ids = batch["rejected_ids"].to(device)
            prompt_length = batch["prompt_length"][0].item()

            with torch.amp.autocast("cuda", dtype=dtype):
                # Policy log probs
                policy_chosen_logps = get_log_probs(
                    policy_model, chosen_ids, prompt_length
                )
                policy_rejected_logps = get_log_probs(
                    policy_model, rejected_ids, prompt_length
                )

                # Reference log probs (no grad)
                with torch.no_grad():
                    ref_chosen_logps = get_log_probs(
                        ref_model, chosen_ids, prompt_length
                    )
                    ref_rejected_logps = get_log_probs(
                        ref_model, rejected_ids, prompt_length
                    )

                loss = dpo_loss(
                    policy_chosen_logps,
                    policy_rejected_logps,
                    ref_chosen_logps,
                    ref_rejected_logps,
                    beta=dpo_cfg["beta"],
                    label_smoothing=dpo_cfg.get("label_smoothing", 0.0),
                ) / grad_accum

            loss.backward()
            accum_loss += loss.item()

            if (step + 1) % grad_accum == 0:
                torch.nn.utils.clip_grad_norm_(
                    policy_model.parameters(),
                    train_cfg["gradient_clipping"],
                )
                optimizer.step()
                optimizer.zero_grad()

            step += 1

            if step % 50 == 0:
                elapsed = time.time() - start_time
                # Compute preference accuracy
                with torch.no_grad():
                    reward_diff = (
                        (policy_chosen_logps - ref_chosen_logps)
                        - (policy_rejected_logps - ref_rejected_logps)
                    )
                    pref_acc = (reward_diff > 0).float().mean().item()

                print(
                    f"Step {step}/{total_steps} | "
                    f"Loss: {accum_loss:.4f} | "
                    f"Pref Acc: {pref_acc:.2%} | "
                    f"Time: {elapsed:.0f}s"
                )
                accum_loss = 0.0

            if step % checkpoint_cfg["save_every_steps"] == 0:
                ckpt_path = checkpoint_dir / f"step_{step}.pt"
                torch.save({
                    "step": step,
                    "model_state_dict": policy_model.state_dict(),
                    "config": full_config,
                }, ckpt_path)

    # Save final
    final_path = checkpoint_dir / "final.pt"
    torch.save({
        "step": step,
        "model_state_dict": policy_model.state_dict(),
        "config": full_config,
    }, final_path)

    latest_path = checkpoint_dir / "latest"
    if latest_path.exists():
        latest_path.unlink()
    latest_path.symlink_to(final_path.name)

    print(f"DPO complete. Final checkpoint: {final_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DPO for SMART Planner model")
    parser.add_argument("--config", default="../config/dpo_config.yaml")
    args = parser.parse_args()

    train(args.config)
