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
import json
import os
import re
import shutil
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from huggingface_hub import snapshot_download

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_MODELS_DIR = REPO_ROOT / "public" / "models"
TRANSLATION_REGISTRY_PATH = REPO_ROOT / "browser-translation" / "src" / "models" / "registry.ts"

# LLM model for Amor inteligente (browser-native-llm)
PLANNER_MODELS = {
  "HuggingFaceTB/SmolLM2-360M-Instruct": "smart-planner-150m-q4",
}

TRANSLATION_MODEL_HOST = "https://huggingface.co/Xenova"
TRANSLATION_REQUIRED_FILES = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
]

HF_CACHE = os.environ.get("HF_HUB_CACHE", str(REPO_ROOT / ".hf-cache"))


def parse_translation_model_ids(registry_path: Path) -> list[str]:
  source = registry_path.read_text(encoding="utf-8")
  model_ids = re.findall(r'modelId:\s*"([^"]+)"', source)
  return sorted(set(model_ids))


def download_planner_model(repo_id: str, dest: Path) -> None:
  dest.mkdir(parents=True, exist_ok=True)
  snapshot_download(
    repo_id=repo_id,
    local_dir=str(dest),
    cache_dir=HF_CACHE,
    resume_download=True,
  )


def download_translation_file(model_id: str, relative_path: str, destination_root: Path) -> None:
  remote_url = f"{TRANSLATION_MODEL_HOST}/{model_id}/resolve/main/{relative_path}"
  destination_path = destination_root / relative_path
  destination_path.parent.mkdir(parents=True, exist_ok=True)

  try:
    with urlopen(remote_url) as response:
      destination_path.write_bytes(response.read())
  except (HTTPError, URLError) as exc:
    raise RuntimeError(f"Failed to download {remote_url}: {exc}") from exc


def write_translation_manifest(model_ids: Iterable[str], destination: Path) -> None:
  payload = {
    "source": "browser-translation/src/models/registry.ts",
    "requiredFiles": TRANSLATION_REQUIRED_FILES,
    "models": sorted(model_ids),
  }
  destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


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
    translation_model_ids = parse_translation_model_ids(TRANSLATION_REGISTRY_PATH)
    for model_id in translation_model_ids:
      model_root = PUBLIC_MODELS_DIR / model_id
      print(f"Provisioning translation model assets for {model_id}")
      for relative_file in TRANSLATION_REQUIRED_FILES:
        download_translation_file(model_id, relative_file, model_root)

    manifest_path = PUBLIC_MODELS_DIR / "translation-models.manifest.json"
    write_translation_manifest(translation_model_ids, manifest_path)
    print(f"Wrote translation manifest: {manifest_path}")

  if os.path.isdir(HF_CACHE):
    try:
      shutil.rmtree(HF_CACHE)
      print(f"Cleaned cache: {HF_CACHE}")
    except Exception as exc:  # noqa: BLE001 - best-effort cleanup
      print(f"Warning: could not clean cache {HF_CACHE}: {exc}")

  print("Done.")


if __name__ == "__main__":
  main()
