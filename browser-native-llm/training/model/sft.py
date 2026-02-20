"""
Supervised Fine-Tuning (SFT) script for the SMART Planner model (Stage 2).

Fine-tunes the pretrained model on synthetic instruction-following
examples to produce structured SMARTAction[] JSON outputs.

Usage:
    python sft.py --config ../config/sft_config.yaml
"""

import argparse
import json
import math
import time
from pathlib import Path

import torch
from torch.utils.data import Dataset, DataLoader
import yaml

from architecture import SmartPlannerModel, ModelConfig


class SFTDataset(Dataset):
    """Dataset for supervised fine-tuning on instruction examples."""

    def __init__(
        self,
        data_path: str,
        max_seq_length: int = 1024,
        mask_input: bool = True,
    ):
        self.examples = []
        self.max_seq_length = max_seq_length
        self.mask_input = mask_input

        if Path(data_path).exists():
            with open(data_path) as f:
                for line in f:
                    record = json.loads(line)
                    self.examples.append(record)

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> dict:
        example = self.examples[idx]

        # Format: system + user → assistant
        # In production, this uses proper tokenisation
        full_text = (
            f"{example.get('system', '')}\n\n"
            f"{example.get('user', '')}\n\n"
            f"{example.get('assistant', '')}"
        )

        # Placeholder tokenisation (char-level for architecture validation)
        tokens = [ord(c) % 32000 for c in full_text[:self.max_seq_length]]
        tokens = tokens + [0] * (self.max_seq_length - len(tokens))

        input_ids = torch.tensor(tokens, dtype=torch.long)
        labels = input_ids.clone()

        if self.mask_input:
            # Mask loss on the input portion (only train on assistant output)
            assistant_text = example.get("assistant", "")
            input_length = len(full_text) - len(assistant_text)
            mask_length = min(input_length, self.max_seq_length)
            labels[:mask_length] = -100

        return {"input_ids": input_ids, "labels": labels}


def train(config_path: str):
    """Run supervised fine-tuning."""
    with open(config_path) as f:
        full_config = yaml.safe_load(f)

    train_cfg = full_config["training"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.bfloat16 if train_cfg["precision"] == "bf16" else torch.float16

    # Load pretrained checkpoint
    model_config = ModelConfig()
    model = SmartPlannerModel(model_config).to(device)

    checkpoint_path = train_cfg["checkpoint"].get("load_from")
    if checkpoint_path and Path(checkpoint_path).exists():
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)
        model.load_state_dict(ckpt.get("model_state_dict", ckpt), strict=False)
        print(f"Loaded pretrained weights from {checkpoint_path}")
    else:
        print("Starting SFT from random weights (no pretrained checkpoint found)")

    print(f"Model parameters: {model.count_parameters():,}")

    # Optimiser
    opt_cfg = train_cfg["optimizer"]
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=opt_cfg["lr"],
        betas=tuple(opt_cfg["betas"]),
        weight_decay=opt_cfg["weight_decay"],
        eps=opt_cfg["eps"],
    )

    # Dataset
    loss_cfg = train_cfg.get("loss", {})
    dataset = SFTDataset(
        data_path="./data/sft_dataset.jsonl",
        max_seq_length=model_config.max_seq_length,
        mask_input=loss_cfg.get("mask_input", True),
    )

    if len(dataset) == 0:
        print("Warning: No training data found. Using dummy data for validation.")
        # Create dummy data for architecture validation
        dataset.examples = [
            {"system": "test", "user": "test input", "assistant": "test output"}
        ] * 100

    batch_cfg = train_cfg["batch"]
    dataloader = DataLoader(
        dataset,
        batch_size=batch_cfg["micro_batch_size"],
        shuffle=True,
        num_workers=2,
        pin_memory=True,
    )

    # Training loop
    total_steps = train_cfg["schedule"]["total_steps"]
    grad_accum = batch_cfg["gradient_accumulation_steps"]
    checkpoint_cfg = train_cfg["checkpoint"]

    checkpoint_dir = Path(checkpoint_cfg["output_dir"])
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    model.train()
    step = 0
    epoch = 0
    accum_loss = 0.0
    start_time = time.time()

    print(f"Starting SFT for {total_steps} steps on {len(dataset)} examples")

    while step < total_steps:
        epoch += 1
        for batch in dataloader:
            if step >= total_steps:
                break

            input_ids = batch["input_ids"].to(device)
            labels = batch["labels"].to(device)

            with torch.amp.autocast("cuda", dtype=dtype):
                output = model(input_ids, labels=labels)
                loss = output["loss"] / grad_accum

            loss.backward()
            accum_loss += loss.item()

            if (step + 1) % grad_accum == 0:
                torch.nn.utils.clip_grad_norm_(
                    model.parameters(),
                    train_cfg["gradient_clipping"],
                )

                # Learning rate schedule
                warmup = train_cfg["schedule"]["warmup_steps"]
                min_lr = train_cfg["schedule"]["min_lr"]
                max_lr = opt_cfg["lr"]

                if step < warmup:
                    lr = max_lr * step / warmup
                else:
                    progress = (step - warmup) / (total_steps - warmup)
                    lr = min_lr + 0.5 * (max_lr - min_lr) * (1 + math.cos(math.pi * progress))

                for param_group in optimizer.param_groups:
                    param_group["lr"] = lr

                optimizer.step()
                optimizer.zero_grad()

            step += 1

            if step % 100 == 0:
                elapsed = time.time() - start_time
                print(
                    f"Step {step}/{total_steps} | "
                    f"Epoch {epoch} | "
                    f"Loss: {accum_loss:.4f} | "
                    f"Time: {elapsed:.0f}s"
                )
                accum_loss = 0.0

            if step % checkpoint_cfg["save_every_steps"] == 0:
                ckpt_path = checkpoint_dir / f"step_{step}.pt"
                torch.save({
                    "step": step,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "config": full_config,
                }, ckpt_path)
                print(f"Saved checkpoint: {ckpt_path}")

    # Save final
    final_path = checkpoint_dir / "final.pt"
    torch.save({
        "step": step,
        "model_state_dict": model.state_dict(),
        "config": full_config,
    }, final_path)

    latest_path = checkpoint_dir / "latest"
    if latest_path.exists():
        latest_path.unlink()
    latest_path.symlink_to(final_path.name)

    print(f"SFT complete. Final checkpoint: {final_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SFT for SMART Planner model")
    parser.add_argument("--config", default="../config/sft_config.yaml")
    args = parser.parse_args()

    train(args.config)
