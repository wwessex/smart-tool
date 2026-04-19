#!/usr/bin/env python3
"""Download browser-ready translation model bundles defined in the source manifest.

The checked-in manifest in browser-translation/src/models/translation-sources.json
is the source of truth for:
- directional pair -> runtime artifact mapping
- upstream/bundled browser repo provenance
- required files

This script downloads the selected model artifacts into public/models/ and writes
public/models/translation-models.manifest.json with computed SHA256 checksums.
"""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from huggingface_hub import snapshot_download

from translation_sources import (
  DEFAULT_MODELS_DIR,
  get_model_ids_for_pairs,
  get_models,
  get_pair_ids_for_languages,
  load_source_manifest,
  write_local_bundle_manifest,
)

PRIORITY_LANGS = {
  "pl",
  "ar",
  "ur",
  "cy",
  "bn",
  "so",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "hi",
  "pa",
  "ps",
  "ti",
}

HF_CACHE = os.environ.get("HF_HUB_CACHE", str(Path.cwd() / ".hf-cache"))


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Download translation model bundles defined in the checked-in source manifest."
  )
  parser.add_argument(
    "--priority",
    action="store_true",
    help="Download the current 15 supported target languages (both directions).",
  )
  parser.add_argument(
    "--langs",
    type=str,
    help="Comma-separated language codes to download (both directions).",
  )
  parser.add_argument(
    "--output",
    type=str,
    default=str(DEFAULT_MODELS_DIR),
    help="Output directory for models (default: public/models).",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Show which model bundles would be downloaded without downloading.",
  )
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  manifest = load_source_manifest()
  models = get_models(manifest)

  if args.langs:
    languages = {value.strip() for value in args.langs.split(",") if value.strip()}
  elif args.priority:
    languages = PRIORITY_LANGS
  else:
    languages = {
      lang
      for pair_id in manifest["pairs"]
      for lang in pair_id.split("-")
      if lang != "en"
    }

  pair_ids = get_pair_ids_for_languages(manifest, languages)
  model_ids = get_model_ids_for_pairs(manifest, pair_ids)

  if not model_ids:
    print("No translation model bundles matched the selection criteria.")
    return

  print(f"Bundles to download: {len(model_ids)}")
  for model_id in model_ids:
    model = models[model_id]
    pairs = ", ".join(model["supportedPairs"])
    print(f"  {model['browserRepoId']} -> {model_id} ({pairs})")

  if args.dry_run:
    print("\nDry run — no files downloaded.")
    return

  output_dir = Path(args.output)
  output_dir.mkdir(parents=True, exist_ok=True)
  required_files = manifest["requiredFiles"]

  downloaded = 0
  failed: list[str] = []
  for index, model_id in enumerate(model_ids, start=1):
    model = models[model_id]
    repo_id = model["browserRepoId"]
    destination = output_dir / model_id
    print(f"\n[{index}/{len(model_ids)}] Downloading {repo_id} -> {destination}")
    try:
      snapshot_download(
        repo_id=repo_id,
        local_dir=str(destination),
        cache_dir=HF_CACHE,
        allow_patterns=required_files,
        resume_download=True,
      )
      downloaded += 1
    except Exception as exc:  # noqa: BLE001 - surfacing repo-specific failures is the goal
      print(f"  ERROR: {exc}")
      failed.append(model_id)

  if downloaded:
    manifest_path = write_local_bundle_manifest(manifest, model_ids, output_dir)
    print(f"\nWrote bundle manifest: {manifest_path}")

  if os.path.isdir(HF_CACHE):
    try:
      shutil.rmtree(HF_CACHE)
      print(f"Cleaned cache: {HF_CACHE}")
    except Exception as exc:  # noqa: BLE001 - best-effort cleanup
      print(f"Warning: could not clean cache {HF_CACHE}: {exc}")

  print(f"\nDone. Downloaded {downloaded}/{len(model_ids)} model bundles.")
  if failed:
    print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
  main()
