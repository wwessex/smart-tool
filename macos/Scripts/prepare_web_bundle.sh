#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export COPYFILE_DISABLE=1

NPM_BIN="${NPM_BINARY:-}"
if [[ -z "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm || true)"
fi

NODE_BIN="${NODE_BINARY:-}"
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node || true)"
fi

if [[ -z "$NPM_BIN" || ! -x "$NPM_BIN" ]]; then
  echo "error: npm is required to build the SMART Tool web bundle for Xcode." >&2
  exit 1
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "error: node is required to stage the Desktop Accelerator runtime for Xcode." >&2
  exit 1
fi

export PATH="$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):${PATH}"

REPO_ROOT="$(cd "${SRCROOT}/.." && pwd)"
STAMP_DIR="${DERIVED_FILE_DIR:-${TARGET_TEMP_DIR:-/tmp}}"
STAMP_FILE="${STAMP_DIR}/smart-tool-web-build.stamp"
APP_BUNDLE="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"
WEB_DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/WebApp"
ACCELERATOR_DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/DesktopAccelerator"
ACCELERATOR_STAGE_DIR="$REPO_ROOT/desktop-helper/runtime/staged"

mkdir -p "$STAMP_DIR"

needs_build=0
if [[ ! -f "$REPO_ROOT/dist/index.html" || ! -f "$STAMP_FILE" ]]; then
  needs_build=1
else
  if find \
    "$REPO_ROOT/src" \
    "$REPO_ROOT/public" \
    "$REPO_ROOT/browser-native-llm" \
    "$REPO_ROOT/browser-translation" \
    "$REPO_ROOT/puente-engine" \
    "$REPO_ROOT/package.json" \
    "$REPO_ROOT/package-lock.json" \
    "$REPO_ROOT/index.html" \
    "$REPO_ROOT/vite.config.ts" \
    "$REPO_ROOT/tsconfig.json" \
    "$REPO_ROOT/tsconfig.app.json" \
    "$REPO_ROOT/tsconfig.node.json" \
    "$REPO_ROOT/tailwind.config.cjs" \
    -type f -newer "$STAMP_FILE" -print -quit | grep -q .; then
    needs_build=1
  fi
fi

if [[ "$needs_build" -eq 1 ]]; then
  echo "Building SMART Tool web bundle for Xcode..."
  cd "$REPO_ROOT"
  "$NPM_BIN" run build
  touch "$STAMP_FILE"
else
  echo "Reusing existing SMART Tool web bundle."
fi

echo "Staging Desktop Accelerator runtime for macOS..."
cd "$REPO_ROOT"
"$NODE_BIN" scripts/stage-desktop-accelerator-runtime.mjs --clean --targets darwin-arm64

rm -rf "$WEB_DEST"
mkdir -p "$WEB_DEST"
/usr/bin/rsync -a --delete --exclude '.DS_Store' --exclude '._*' "$REPO_ROOT/dist/" "$WEB_DEST/"
/bin/rm -rf "$ACCELERATOR_DEST"
/bin/mkdir -p "$ACCELERATOR_DEST"
/usr/bin/rsync -a --delete --exclude '.DS_Store' --exclude '._*' "$ACCELERATOR_STAGE_DIR/" "$ACCELERATOR_DEST/"
/usr/bin/find "$WEB_DEST" -name '.DS_Store' -delete
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$WEB_DEST" >/dev/null 2>&1 || true
  xattr -cr "$ACCELERATOR_DEST" >/dev/null 2>&1 || true
  xattr -cr "$APP_BUNDLE" >/dev/null 2>&1 || true
fi
echo "Bundled web app copied to $WEB_DEST"
