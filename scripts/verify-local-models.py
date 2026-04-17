#!/usr/bin/env python3
"""Verify required local planner model files exist.

Intended for CI and deployment workflows that must fail loudly when the
planner model is missing from the build input or output artifact.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PLANNER_REQUIRED_FILES = [
  "smart-planner-150m-q4/config.json",
  "smart-planner-150m-q4/tokenizer.json",
  "smart-planner-150m-q4/onnx/model_q4.onnx",
]


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Verify required local planner model files exist under a models root."
  )
  parser.add_argument(
    "--root",
    default="public/models",
    help="Directory containing self-hosted model assets (default: public/models).",
  )
  parser.add_argument(
    "--label",
    default="planner model assets",
    help="Human-readable label used in output.",
  )
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  root = Path(args.root)

  missing = [relative for relative in PLANNER_REQUIRED_FILES if not (root / relative).is_file()]
  if missing:
    print(f"Missing {args.label} under {root}:", file=sys.stderr)
    for relative in missing:
      print(f"  - {relative}", file=sys.stderr)
    return 1

  print(f"Verified {args.label} under {root}")
  for relative in PLANNER_REQUIRED_FILES:
    print(f"  - {relative}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
