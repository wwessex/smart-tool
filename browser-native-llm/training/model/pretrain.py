"""
Pretraining script for the SMART Planner model (Stage 1).

Trains the base model on general English + planning-format data
to build language understanding and structured output capability.

Usage:
    python pretrain.py --config ../config/pretrain_config.yaml
"""

import argparse
import math
import time
from pathlib import Path

import torch
import torch.distributed as dist
from torch.utils.data import DataLoader, IterableDataset
import yaml

from architecture import SmartPlannerModel, ModelConfig


class PretrainDataset(IterableDataset):
    """Streaming dataset for pretraining.

    Reads tokenised text from memory-mapped files. In production,
    this would use a proper streaming dataset (e.g., from HuggingFace
    datasets or a custom data pipeline).
    """

    def __init__(
        self,
        data_dir: str,
        seq_length: int = 1024,
        vocab_size: int = 32000,
    ):
        self.data_dir = Path(data_dir)
        self.seq_length = seq_length
        self.vocab_size = vocab_size

    def __iter__(self):
        # Placeholder: in production, stream from tokenised shards
        # For now, yield random data for architecture validation
        while True:
            tokens = torch.randint(0, self.vocab_size, (self.seq_length,))
            yield {"input_ids": tokens, "labels": tokens}


def get_lr(step: int, config: dict) -> float:
    """Cosine learning rate schedule with warmup."""
    warmup = config["schedule"]["warmup_steps"]
    total = config["schedule"]["total_steps"]
    min_lr = config["schedule"]["min_lr"]
    max_lr = config["optimizer"]["lr"]

    if step < warmup:
        return max_lr * step / warmup

    progress = (step - warmup) / (total - warmup)
    return min_lr + 0.5 * (max_lr - min_lr) * (1 + math.cos(math.pi * progress))


def train(config_path: str):
    """Run pretraining."""
    with open(config_path) as f:
        full_config = yaml.safe_load(f)

    train_cfg = full_config["training"]

    # Device setup
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.bfloat16 if train_cfg["precision"] == "bf16" else torch.float16

    print(f"Device: {device}, Precision: {dtype}")

    # Model
    model_config = ModelConfig()  # Uses defaults (150M balanced)
    model = SmartPlannerModel(model_config).to(device)
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
    dataset = PretrainDataset(
        data_dir="./data/pretrain",
        seq_length=model_config.max_seq_length,
        vocab_size=model_config.vocab_size,
    )

    batch_cfg = train_cfg["batch"]
    dataloader = DataLoader(
        dataset,
        batch_size=batch_cfg["micro_batch_size"],
        num_workers=2,
        pin_memory=True,
    )

    # Training loop
    total_steps = train_cfg["schedule"]["total_steps"]
    grad_accum = batch_cfg["gradient_accumulation_steps"]
    checkpoint_cfg = train_cfg["checkpoint"]
    log_cfg = train_cfg["logging"]

    checkpoint_dir = Path(checkpoint_cfg["output_dir"])
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    model.train()
    data_iter = iter(dataloader)
    step = 0
    accum_loss = 0.0
    start_time = time.time()

    print(f"Starting pretraining for {total_steps} steps")
    print(f"  Micro batch: {batch_cfg['micro_batch_size']}")
    print(f"  Gradient accumulation: {grad_accum}")
    print(f"  Effective batch tokens: {batch_cfg.get('effective_batch_tokens', 'N/A')}")

    while step < total_steps:
        optimizer.zero_grad()

        for micro_step in range(grad_accum):
            try:
                batch = next(data_iter)
            except StopIteration:
                data_iter = iter(dataloader)
                batch = next(data_iter)

            input_ids = batch["input_ids"].to(device)
            labels = batch["labels"].to(device)

            with torch.amp.autocast("cuda", dtype=dtype):
                output = model(input_ids, labels=labels)
                loss = output["loss"] / grad_accum

            loss.backward()
            accum_loss += loss.item()

        # Gradient clipping
        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            train_cfg["gradient_clipping"],
        )

        # Learning rate update
        lr = get_lr(step, train_cfg)
        for param_group in optimizer.param_groups:
            param_group["lr"] = lr

        optimizer.step()
        step += 1

        # Logging
        if step % log_cfg["log_every_steps"] == 0:
            elapsed = time.time() - start_time
            tokens_per_sec = (
                step * batch_cfg["micro_batch_size"] * grad_accum
                * model_config.max_seq_length / elapsed
            )
            print(
                f"Step {step}/{total_steps} | "
                f"Loss: {accum_loss:.4f} | "
                f"LR: {lr:.2e} | "
                f"Tokens/s: {tokens_per_sec:.0f}"
            )
            accum_loss = 0.0

        # Checkpointing
        if step % checkpoint_cfg["save_every_steps"] == 0:
            ckpt_path = checkpoint_dir / f"step_{step}.pt"
            torch.save({
                "step": step,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": full_config,
            }, ckpt_path)
            print(f"Saved checkpoint: {ckpt_path}")

            # Keep only last N checkpoints
            keep_n = checkpoint_cfg["keep_last_n"]
            ckpts = sorted(checkpoint_dir.glob("step_*.pt"))
            for old_ckpt in ckpts[:-keep_n]:
                old_ckpt.unlink()

    # Save final checkpoint
    final_path = checkpoint_dir / "final.pt"
    torch.save({
        "step": step,
        "model_state_dict": model.state_dict(),
        "config": full_config,
    }, final_path)

    # Create 'latest' symlink
    latest_path = checkpoint_dir / "latest"
    if latest_path.exists():
        latest_path.unlink()
    latest_path.symlink_to(final_path.name)

    print(f"Pretraining complete. Final checkpoint: {final_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pretrain SMART Planner model")
    parser.add_argument("--config", default="../config/pretrain_config.yaml")
    args = parser.parse_args()

    train(args.config)
