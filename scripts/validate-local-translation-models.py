#!/usr/bin/env python3
"""Validate local translation model files for offline/local-only deployments.

Checks every MODEL_REGISTRY modelId has required files under public/models/<modelId>/.
Exit code is non-zero when required files are missing.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = REPO_ROOT / "browser-translation" / "src" / "models" / "registry.ts"
DEFAULT_MODELS_DIR = REPO_ROOT / "public" / "models"

REQUIRED_FILES = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
]


def parse_model_ids() -> list[str]:
  source = REGISTRY_PATH.read_text(encoding="utf-8")
  return sorted(set(re.findall(r'modelId:\s*"([^"]+)"', source)))


def validate_models(models_dir: Path, model_ids: list[str]) -> list[str]:
  missing: list[str] = []
  for model_id in model_ids:
    model_root = models_dir / model_id
    for relative in REQUIRED_FILES:
      target = model_root / relative
      if not target.is_file():
        missing.append(str(target.relative_to(REPO_ROOT)))
  return missing


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--models-dir", default=str(DEFAULT_MODELS_DIR))
  parser.add_argument(
    "--offline-only",
    action="store_true",
    help="Only enforce checks when local-only mode is enabled by environment.",
  )
  args = parser.parse_args()

  offline_mode = os.environ.get("LOCAL_ONLY_MODELS", "").lower() in {"1", "true", "yes"}
  if args.offline_only and not offline_mode:
    print("Skipping local model validation (LOCAL_ONLY_MODELS is not enabled).")
    return 0

  models_dir = Path(args.models_dir)
  model_ids = parse_model_ids()
  missing = validate_models(models_dir, model_ids)

  if missing:
    print("Missing local translation model files:")
    for path in missing:
      print(f" - {path}")
    return 1

  print(f"Validated {len(model_ids)} translation models in {models_dir}.")
  return 0


if __name__ == "__main__":
  sys.exit(main())
