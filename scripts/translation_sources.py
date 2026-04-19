#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANIFEST_PATH = (
  REPO_ROOT / "browser-translation" / "src" / "models" / "translation-sources.json"
)
DEFAULT_MODELS_DIR = REPO_ROOT / "public" / "models"


def load_source_manifest() -> dict:
  with SOURCE_MANIFEST_PATH.open("r", encoding="utf-8") as handle:
    return json.load(handle)


def get_required_files(manifest: dict) -> list[str]:
  return list(manifest["requiredFiles"])


def get_pairs(manifest: dict) -> dict[str, dict]:
  return dict(manifest["pairs"])


def get_models(manifest: dict) -> dict[str, dict]:
  return dict(manifest["models"])


def get_pair_ids_for_languages(manifest: dict, languages: set[str]) -> list[str]:
  selected: list[str] = []
  for pair in manifest["pairs"]:
    source_lang, target_lang = pair.split("-", 1)
    if source_lang in languages or target_lang in languages:
      selected.append(pair)
  return sorted(selected)


def get_model_ids_for_pairs(manifest: dict, pair_ids: list[str]) -> list[str]:
  seen: set[str] = set()
  ordered: list[str] = []
  for pair_id in pair_ids:
    model_id = manifest["pairs"][pair_id]["modelId"]
    if model_id not in seen:
      seen.add(model_id)
      ordered.append(model_id)
  return ordered


def compute_sha256(path: Path) -> str:
  digest = hashlib.sha256()
  with path.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest()


def build_local_bundle_manifest(
  manifest: dict,
  model_ids: list[str],
  models_dir: Path,
) -> dict:
  model_payload: dict[str, dict] = {}
  for model_id in model_ids:
    source = manifest["models"][model_id]
    checksums = {}
    for relative in manifest["requiredFiles"]:
      target = models_dir / model_id / relative
      checksums[relative] = compute_sha256(target) if target.is_file() else None

    model_payload[model_id] = {
      "modelId": model_id,
      "localPath": source["localPath"],
      "supportedPairs": source["supportedPairs"],
      "upstreamRepoId": source["upstreamRepoId"],
      "browserRepoId": source["browserRepoId"],
      "conversionStatus": source["conversionStatus"],
      "checksums": checksums,
      "lastVerifiedAccess": source["lastVerifiedAccess"],
    }

  selected_pairs = {
    pair_id: pair
    for pair_id, pair in manifest["pairs"].items()
    if pair["modelId"] in model_ids
  }

  return {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceManifestVersion": manifest["version"],
    "localRoot": str(models_dir),
    "requiredFiles": manifest["requiredFiles"],
    "pairs": selected_pairs,
    "models": model_payload,
  }


def write_local_bundle_manifest(
  manifest: dict,
  model_ids: list[str],
  models_dir: Path,
) -> Path:
  payload = build_local_bundle_manifest(manifest, model_ids, models_dir)
  destination = models_dir / "translation-models.manifest.json"
  destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
  return destination
