#!/usr/bin/env python3
"""Download required Transformers.js models into public/models for self-hosting.

Usage:
  python scripts/fetch-models.py

This is also run automatically in GitHub Actions (build-static.yml).
"""
from huggingface_hub import snapshot_download
import os

MODELS = [
  "HuggingFaceTB/SmolLM2-360M-Instruct",
  "Xenova/nllb-200-distilled-600M",
]

os.makedirs("public/models", exist_ok=True)

for mid in MODELS:
  org, repo = mid.split("/", 1)
  dest = os.path.join("public", "models", org, repo)
  print(f"Downloading {mid} -> {dest}")
  snapshot_download(
    repo_id=mid,
    local_dir=dest,
    local_dir_use_symlinks=False,
    resume_download=True,
  )

print("Done.")
