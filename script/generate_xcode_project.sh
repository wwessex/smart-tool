#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_PATH="$ROOT_DIR/macos/project.yml"
PROJECT_FILE="$ROOT_DIR/macos/SMARTToolMac.xcodeproj/project.pbxproj"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required to generate the SMART Tool Xcode project." >&2
  exit 1
fi

cd "$ROOT_DIR/macos"
xcodegen generate --spec "$SPEC_PATH"

# XcodeGen running under newer Xcode releases can emit a future project format
# that Xcode 15.4 on GitHub Actions cannot open. Normalize back to the Xcode 15
# object version so the checked-in project stays CI-compatible.
/usr/bin/perl -0pi -e 's/objectVersion = 77;/objectVersion = 60;/g; s/preferredProjectObjectVersion = 77;/preferredProjectObjectVersion = 60;/g' "$PROJECT_FILE"

echo "Generated $ROOT_DIR/macos/SMARTToolMac.xcodeproj"
