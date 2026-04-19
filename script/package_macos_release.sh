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
OUTPUT_DMG="$OUTPUT_DIR/SMART-Tool-macOS-arm64.dmg"
PACKAGE_VERSION="${SMART_TOOL_VERSION:-$(node -p "require('./package.json').version")}"
BUILD_NUMBER="${SMART_TOOL_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"
NODE_BINARY_PATH="$(command -v node)"
NPM_BINARY_PATH="$(command -v npm)"

APP_BUNDLE=""
SIGNING_MODE="unsigned"

normalize_project_format() {
  if [[ ! -f "$PROJECT_FILE" ]]; then
    return
  fi

  /usr/bin/perl -0pi -e 's/objectVersion = 77;/objectVersion = 60;/g; s/preferredProjectObjectVersion = 77;/preferredProjectObjectVersion = 60;/g' "$PROJECT_FILE"
}

detect_signing_mode() {
  local required_vars=(
    APPLE_CERTIFICATE_P12_BASE64
    APPLE_CERTIFICATE_PASSWORD
    APPLE_DEVELOPER_ID_APPLICATION
    APPLE_TEAM_ID
    APPLE_NOTARY_APPLE_ID
    APPLE_NOTARY_PASSWORD
  )
  local present_count=0

  for variable_name in "${required_vars[@]}"; do
    if [[ -n "${!variable_name:-}" ]]; then
      ((present_count += 1))
    fi
  done

  if [[ "$present_count" -eq "${#required_vars[@]}" ]]; then
    SIGNING_MODE="signed"
    return
  fi

  if [[ "$present_count" -gt 0 ]]; then
    echo "warning: partial macOS signing configuration detected; falling back to unsigned release packaging." >&2
  fi
}

build_signed_archive() {
  APP_BUNDLE="$ARCHIVE_PATH/Products/Applications/$APP_NAME.app"
  /bin/rm -rf "$ARCHIVE_PATH"

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
}

build_unsigned_app() {
  APP_BUNDLE="$DERIVED_DATA_PATH/Build/Products/Release/$APP_NAME.app"

  NODE_BINARY="$NODE_BINARY_PATH" \
  NPM_BINARY="$NPM_BINARY_PATH" \
  xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme SMARTToolMac \
    -configuration Release \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY="" \
    MARKETING_VERSION="$PACKAGE_VERSION" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    build

  codesign --force --deep --sign - "$APP_BUNDLE"
}

verify_app_bundle() {
  if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "error: expected app bundle at $APP_BUNDLE" >&2
    exit 1
  fi

  if [[ "$SIGNING_MODE" == "signed" ]]; then
    codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
    spctl --assess --type execute --verbose=4 "$APP_BUNDLE"
  else
    codesign --verify --verbose=4 "$APP_BUNDLE"
  fi
}

package_dmg() {
  hdiutil create -volname "$APP_NAME" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$OUTPUT_DMG"

  if [[ "$SIGNING_MODE" == "signed" ]]; then
    codesign --force --sign "$APPLE_DEVELOPER_ID_APPLICATION" "$OUTPUT_DMG"
    xcrun notarytool submit "$OUTPUT_DMG" \
      --apple-id "$APPLE_NOTARY_APPLE_ID" \
      --password "$APPLE_NOTARY_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait
    xcrun stapler staple "$OUTPUT_DMG"
    spctl --assess --type open --verbose=4 "$OUTPUT_DMG"
  else
    codesign --force --sign - "$OUTPUT_DMG"
    codesign --verify --verbose=2 "$OUTPUT_DMG"
  fi
}

cd "$ROOT_DIR"

if [[ ! -d "$PROJECT_PATH" || "$SPEC_PATH" -nt "$PROJECT_FILE" ]]; then
  ./script/generate_xcode_project.sh
fi

normalize_project_format
detect_signing_mode

/bin/mkdir -p "$OUTPUT_DIR"
/bin/rm -f "$OUTPUT_DMG"

if [[ "$SIGNING_MODE" == "signed" ]]; then
  echo "Packaging signed and notarized macOS release."
  build_signed_archive
else
  echo "Packaging unsigned macOS release with ad-hoc signing."
  build_unsigned_app
fi

verify_app_bundle
package_dmg

if [[ "$SIGNING_MODE" == "signed" ]]; then
  echo "Packaged notarized macOS release at $OUTPUT_DMG"
else
  echo "Packaged ad-hoc signed macOS release at $OUTPUT_DMG"
fi
