#!/usr/bin/env bash
set -euo pipefail

APP_NAME="SMART Tool"
PROJECT_NAME="SMARTToolMac"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/macos/SMARTToolMac.xcodeproj"
SPEC_PATH="$ROOT_DIR/macos/project.yml"
PROJECT_FILE="$PROJECT_PATH/project.pbxproj"
DERIVED_DATA_PATH="${SMART_TOOL_DERIVED_DATA_PATH:-$HOME/Library/Developer/Xcode/DerivedData/SMARTToolMac-Release}"
ARCHIVE_PATH="${SMART_TOOL_ARCHIVE_PATH:-$ROOT_DIR/release/$PROJECT_NAME.xcarchive}"
OUTPUT_DIR="${SMART_TOOL_RELEASE_DIR:-$ROOT_DIR/release}"
APP_BUNDLE="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
OUTPUT_DMG="$OUTPUT_DIR/SMART-Tool-macOS-arm64.dmg"
PACKAGE_VERSION="${SMART_TOOL_VERSION:-$(node -p "require('./package.json').version")}"
BUILD_NUMBER="${SMART_TOOL_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"
NODE_BINARY_PATH="$(command -v node)"
NPM_BINARY_PATH="$(command -v npm)"

required_env_vars=(
  APPLE_DEVELOPER_ID_APPLICATION
  APPLE_TEAM_ID
  APPLE_NOTARY_APPLE_ID
  APPLE_NOTARY_PASSWORD
)

for variable_name in "${required_env_vars[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "error: missing required environment variable: $variable_name" >&2
    exit 1
  fi
done

normalize_project_format() {
  if [[ ! -f "$PROJECT_FILE" ]]; then
    return
  fi

  /usr/bin/perl -0pi -e 's/objectVersion = 77;/objectVersion = 60;/g; s/preferredProjectObjectVersion = 77;/preferredProjectObjectVersion = 60;/g' "$PROJECT_FILE"
}

cd "$ROOT_DIR"

if [[ ! -d "$PROJECT_PATH" || "$SPEC_PATH" -nt "$PROJECT_FILE" ]]; then
  ./script/generate_xcode_project.sh
fi

normalize_project_format

/bin/rm -rf "$ARCHIVE_PATH"
/bin/mkdir -p "$OUTPUT_DIR"
/bin/rm -f "$OUTPUT_DMG"

NODE_BINARY="$NODE_BINARY_PATH" \
NPM_BINARY="$NPM_BINARY_PATH" \
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme SMARTToolMac \
  -configuration Release \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="$APPLE_DEVELOPER_ID_APPLICATION" \
  MARKETING_VERSION="$PACKAGE_VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  archive

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "error: expected archived app bundle at $APP_BUNDLE" >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
spctl --assess --type execute --verbose=4 "$APP_BUNDLE"

hdiutil create -volname "$APP_NAME" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$OUTPUT_DMG"
codesign --force --sign "$APPLE_DEVELOPER_ID_APPLICATION" "$OUTPUT_DMG"
xcrun notarytool submit "$OUTPUT_DMG" \
  --apple-id "$APPLE_NOTARY_APPLE_ID" \
  --password "$APPLE_NOTARY_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "$OUTPUT_DMG"
spctl --assess --type open --verbose=4 "$OUTPUT_DMG"

echo "Packaged notarized macOS release at $OUTPUT_DMG"
