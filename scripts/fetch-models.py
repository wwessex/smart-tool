#!/usr/bin/env python3
"""Download required ONNX models into public/models for self-hosting (disk-safe).

This script downloads ONLY the files required for the Puente Engine to run the
models locally in the browser. It avoids pulling huge fp32/fp16 ONNX weights
(which exceed GitHub runner disk space).

Usage:
  python scripts/fetch-models.py
"""

from huggingface_hub import snapshot_download
import os
import shutil

# Model repos to download — stored locally under public/models/<model-name>
MODELS = {
  # LLM model for Amor inteligente (browser-native-llm)
  "HuggingFaceTB/SmolLM2-360M-Instruct": "SmolLM2-360M-Instruct",
  # Translation models for Lengua Materna are fetched separately
  # via browser-translation/scripts/convert-model.py
}

# Put HF cache somewhere we can delete after (CI can set HF_HUB_CACHE=/tmp/hf-cache)
HF_CACHE = os.environ.get("HF_HUB_CACHE", os.path.join(os.getcwd(), ".hf-cache"))

def download_model(repo_id: str, dest: str):
  os.makedirs(dest, exist_ok=True)

  # For the local drafting model, keep default (repo is already small enough).
  snapshot_download(
    repo_id=repo_id,
    local_dir=dest,
    cache_dir=HF_CACHE,
    resume_download=True,
  )

def main():
  os.makedirs("public/models", exist_ok=True)

  for repo_id, local_name in MODELS.items():
    dest = os.path.join("public", "models", local_name)
    print(f"Downloading {repo_id} -> {dest}")
    download_model(repo_id, dest)

  # Optional: remove HF cache to free disk (especially important in CI)
  if os.path.isdir(HF_CACHE):
    try:
      shutil.rmtree(HF_CACHE)
      print(f"Cleaned cache: {HF_CACHE}")
    except Exception as e:
      print(f"Warning: could not clean cache {HF_CACHE}: {e}")

  print("Done.")

if __name__ == "__main__":
  main()
