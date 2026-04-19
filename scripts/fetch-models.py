#!/usr/bin/env python3
"""Download required local model artifacts into public/models.

This script provisions both:
1) Smart planner LLM assets.
2) Lengua Materna translation assets for every model in MODEL_REGISTRY.

Usage:
  python scripts/fetch-models.py
"""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from huggingface_hub import snapshot_download

from translation_sources import (
  DEFAULT_MODELS_DIR,
  get_models,
  load_source_manifest,
  write_local_bundle_manifest,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_MODELS_DIR = DEFAULT_MODELS_DIR

# LLM model for Amor inteligente (browser-native-llm)
PLANNER_MODELS = {
  "HuggingFaceTB/SmolLM2-360M-Instruct": "smart-planner-150m-q4",
}

HF_CACHE = os.environ.get("HF_HUB_CACHE", str(REPO_ROOT / ".hf-cache"))


def download_planner_model(repo_id: str, dest: Path) -> None:
  dest.mkdir(parents=True, exist_ok=True)
  snapshot_download(
    repo_id=repo_id,
    local_dir=str(dest),
    cache_dir=HF_CACHE,
    resume_download=True,
  )


def download_translation_models(output_dir: Path) -> None:
  manifest = load_source_manifest()
  models = get_models(manifest)
  required_files = manifest["requiredFiles"]
  model_ids = sorted(models.keys())

  for model_id in model_ids:
    model = models[model_id]
    destination = output_dir / model_id
    print(f"Provisioning translation model bundle {model['browserRepoId']} -> {destination}")
    snapshot_download(
      repo_id=model["browserRepoId"],
      local_dir=str(destination),
      cache_dir=HF_CACHE,
      allow_patterns=required_files,
      resume_download=True,
    )

  manifest_path = write_local_bundle_manifest(manifest, model_ids, output_dir)
  print(f"Wrote translation manifest: {manifest_path}")


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Download local planner and translation model artifacts into public/models."
  )
  parser.add_argument(
    "--planner-only",
    action="store_true",
    help="Download only planner model assets.",
  )
  parser.add_argument(
    "--translations-only",
    action="store_true",
    help="Download only translation model assets.",
  )
  args = parser.parse_args()
  if args.planner_only and args.translations_only:
    parser.error("--planner-only and --translations-only are mutually exclusive")
  return args


def main() -> None:
  args = parse_args()
  PUBLIC_MODELS_DIR.mkdir(parents=True, exist_ok=True)

  if not args.translations_only:
    for repo_id, local_name in PLANNER_MODELS.items():
      destination = PUBLIC_MODELS_DIR / local_name
      print(f"Downloading planner model {repo_id} -> {destination}")
      download_planner_model(repo_id, destination)

  if not args.planner_only:
    download_translation_models(PUBLIC_MODELS_DIR)

  if os.path.isdir(HF_CACHE):
    try:
      shutil.rmtree(HF_CACHE)
      print(f"Cleaned cache: {HF_CACHE}")
    except Exception as exc:  # noqa: BLE001 - best-effort cleanup
      print(f"Warning: could not clean cache {HF_CACHE}: {exc}")

  print("Done.")


if __name__ == "__main__":
  main()
