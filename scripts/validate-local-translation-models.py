#!/usr/bin/env python3
"""Validate local translation model files for offline/local-only deployments.

Checks every MODEL_REGISTRY modelId has required files under public/models/<modelId>/.
Exit code is non-zero when required files are missing.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from translation_sources import (
  DEFAULT_MODELS_DIR,
  get_models,
  get_pairs,
  get_required_files,
  load_source_manifest,
)


def validate_models(models_dir: Path, model_ids: list[str], required_files: list[str]) -> list[str]:
  missing: list[str] = []
  for model_id in model_ids:
    model_root = models_dir / model_id
    for relative in required_files:
      target = model_root / relative
      if not target.is_file():
        missing.append(str(target))
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
  manifest = load_source_manifest()
  model_ids = sorted(get_models(manifest).keys())
  required_files = get_required_files(manifest)
  missing = validate_models(models_dir, model_ids, required_files)

  if missing:
    print("Missing local translation model files:")
    for path in missing:
      print(f" - {path}")
    return 1

  print(
    f"Validated {len(model_ids)} translation model bundles covering "
    f"{len(get_pairs(manifest))} language pairs in {models_dir}."
  )
  return 0


if __name__ == "__main__":
  sys.exit(main())
