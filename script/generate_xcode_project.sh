#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_PATH="$ROOT_DIR/macos/project.yml"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required to generate the SMART Tool Xcode project." >&2
  exit 1
fi

cd "$ROOT_DIR/macos"
xcodegen generate --spec "$SPEC_PATH"
echo "Generated $ROOT_DIR/macos/SMARTToolMac.xcodeproj"
