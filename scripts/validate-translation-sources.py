#!/usr/bin/env python3
"""Validate the checked-in translation source manifest.

Checks:
- manifest structure and pair/model consistency
- required file checksum slots exist
- optional remote reachability of upstream and browser-ready repos
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request

from translation_sources import get_models, get_pairs, get_required_files, load_source_manifest


def check_repo(repo_id: str) -> int:
  url = f"https://huggingface.co/api/models/{repo_id}"
  request = urllib.request.Request(url, method="GET")
  try:
    with urllib.request.urlopen(request, timeout=20) as response:
      return response.status
  except urllib.error.HTTPError as exc:
    return exc.code


def main() -> int:
  parser = argparse.ArgumentParser(
    description="Validate the checked-in translation source manifest."
  )
  parser.add_argument(
    "--check-remote",
    action="store_true",
    help="Verify upstream and browser-ready repos are reachable via the Hugging Face API.",
  )
  args = parser.parse_args()

  manifest = load_source_manifest()
  required_files = set(get_required_files(manifest))
  pairs = get_pairs(manifest)
  models = get_models(manifest)

  errors: list[str] = []

  if not manifest.get("version"):
    errors.append("Manifest version is missing.")
  if not manifest.get("localRoot"):
    errors.append("Manifest localRoot is missing.")
  if not required_files:
    errors.append("Manifest requiredFiles is empty.")

  for pair_id, pair in sorted(pairs.items()):
    model_id = pair.get("modelId")
    if not model_id:
      errors.append(f"Pair {pair_id} is missing modelId.")
      continue
    if model_id not in models:
      errors.append(f"Pair {pair_id} references unknown model {model_id}.")

  for model_id, model in sorted(models.items()):
    checksums = set(model.get("checksums", {}).keys())
    missing_checksum_slots = sorted(required_files - checksums)
    if missing_checksum_slots:
      errors.append(
        f"Model {model_id} is missing checksum slots for: {', '.join(missing_checksum_slots)}"
      )

    if model.get("modelId") != model_id:
      errors.append(f"Model entry key {model_id} does not match modelId field.")

    supported_pairs = set(model.get("supportedPairs", []))
    declared_pairs = {pair_id for pair_id, pair in pairs.items() if pair["modelId"] == model_id}
    if supported_pairs != declared_pairs:
      errors.append(
        f"Model {model_id} supportedPairs do not match pair mappings. "
        f"expected={sorted(declared_pairs)} actual={sorted(supported_pairs)}"
      )

    if args.check_remote:
      upstream_status = check_repo(model["upstreamRepoId"])
      browser_status = check_repo(model["browserRepoId"])
      if upstream_status != 200:
        errors.append(f"Upstream repo {model['upstreamRepoId']} returned HTTP {upstream_status}.")
      if browser_status != 200:
        errors.append(f"Browser repo {model['browserRepoId']} returned HTTP {browser_status}.")

  if errors:
    print("Translation source manifest validation failed:", file=sys.stderr)
    for error in errors:
      print(f" - {error}", file=sys.stderr)
    return 1

  print(
    f"Validated translation source manifest version {manifest['version']} "
    f"for {len(pairs)} pairs across {len(models)} bundled model artifacts."
  )
  if args.check_remote:
    print("Remote reachability checks passed.")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
