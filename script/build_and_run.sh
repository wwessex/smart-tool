#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="SMART Tool"
PROCESS_NAME="SMARTToolMac"
BUNDLE_ID="uk.smarttool.macos"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/macos/SMARTToolMac.xcodeproj"
SPEC_PATH="$ROOT_DIR/macos/project.yml"
PROJECT_FILE="$PROJECT_PATH/project.pbxproj"
DERIVED_DATA_PATH="${SMART_TOOL_DERIVED_DATA_PATH:-$HOME/Library/Developer/Xcode/DerivedData/SMARTToolMac-Codex}"
BUILD_ROOT="$DERIVED_DATA_PATH/Build/Products/Debug"
APP_BUNDLE="$BUILD_ROOT/$APP_NAME.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$PROCESS_NAME"
PACKAGE_VERSION="${SMART_TOOL_VERSION:-$(node -p "require('./package.json').version")}"
BUILD_NUMBER="${SMART_TOOL_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"

cd "$ROOT_DIR"

pkill -x "$PROCESS_NAME" >/dev/null 2>&1 || true

normalize_project_format() {
  if [[ ! -f "$PROJECT_FILE" ]]; then
    return
  fi

  /usr/bin/perl -0pi -e 's/objectVersion = 77;/objectVersion = 60;/g; s/preferredProjectObjectVersion = 77;/preferredProjectObjectVersion = 60;/g' "$PROJECT_FILE"
}

if [[ ! -d "$PROJECT_PATH" || "$SPEC_PATH" -nt "$PROJECT_PATH/project.pbxproj" ]]; then
  ./script/generate_xcode_project.sh
fi

normalize_project_format

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme SMARTToolMac \
  -configuration Debug \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  MARKETING_VERSION="$PACKAGE_VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  build

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

verify_built_app() {
  if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "Expected app bundle at $APP_BUNDLE" >&2
    exit 1
  fi

  if [[ ! -x "$APP_BINARY" ]]; then
    echo "Expected app binary at $APP_BINARY" >&2
    exit 1
  fi
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$PROCESS_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    verify_built_app
    if [[ -z "${CI:-}" ]]; then
      open_app
      for _ in 1 2 3 4 5; do
        sleep 1
        if pgrep -x "$PROCESS_NAME" >/dev/null; then
          break
        fi
      done
    fi
    echo "Verified macOS app bundle at $APP_BUNDLE"
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
