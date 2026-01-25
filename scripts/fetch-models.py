#!/usr/bin/env python3
"""Download required Transformers.js models into public/models for self-hosting (disk-safe).

This script downloads ONLY the files required for Transformers.js to run the models locally.
It avoids pulling huge fp32/fp16 ONNX weights (which exceed GitHub runner disk space).

Usage:
  python scripts/fetch-models.py
"""

from huggingface_hub import snapshot_download
import os
import shutil

MODELS = [
  "HuggingFaceTB/SmolLM2-360M-Instruct",
  "Xenova/nllb-200-distilled-600M",
]

# Put HF cache somewhere we can delete after (CI can set HF_HUB_CACHE=/tmp/hf-cache)
HF_CACHE = os.environ.get("HF_HUB_CACHE", os.path.join(os.getcwd(), ".hf-cache"))

def download_model(repo_id: str, dest: str):
  os.makedirs(dest, exist_ok=True)

  allow_patterns = None

  # NLLB repo contains multiple HUGE ONNX variants; we only want quantized weights + tokenizer/config.
  if repo_id == "Xenova/nllb-200-distilled-600M":
    allow_patterns = [
      "config.json",
      "generation_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "special_tokens_map.json",
      "preprocessor_config.json",
      "sentencepiece.*",
      "*.model",
      "*.json",
      "onnx/*quantized*.onnx",
      "onnx/*quant*.onnx",
      "onnx/*.json",
    ]

  # For the local drafting model, keep default (repo is already small enough).
  snapshot_download(
    repo_id=repo_id,
    local_dir=dest,
    allow_patterns=allow_patterns,
    cache_dir=HF_CACHE,
    resume_download=True,
  )

def main():
  os.makedirs("public/models", exist_ok=True)

  for mid in MODELS:
    org, repo = mid.split("/", 1)
    dest = os.path.join("public", "models", org, repo)
    print(f"Downloading {mid} -> {dest}")
    download_model(mid, dest)

  # Optional: remove HF cache to free disk (especially important in CI)
  if os.path.isdir(HF_CACHE):
    try:
      shutil.rmtree(HF_CACHE)
      print(f"Cleaned HF cache: {HF_CACHE}")
    except Exception as e:
      print(f"Warning: could not clean HF cache {HF_CACHE}: {e}")

  print("Done.")

if __name__ == "__main__":
  main()
