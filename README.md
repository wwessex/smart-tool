# smart-tool

`smart-tool` is a privacy-first React/TypeScript app for writing SMART job-support actions. It is aimed at employment advisors and coaches who need fast, structured action plans that stay specific, measurable, achievable, relevant, and time-bound.

The current app combines:

- a barrier-led SMART action workflow
- local AI drafting through the in-repo browser AI package
- on-device translation through the in-repo browser translation package
- history, templates, GDPR export/delete, and local folder sync
- a prompt-pack workflow for centrally curating AI guidance
- static-host friendly deployment with PWA support

## Main Features

- Two authoring modes:
  - `now`: barrier-to-action workflow
  - `future`: task/outcome workflow
- SMART scoring and guidance via `src/lib/smart-checker.ts`
- Local AI drafting via `@smart-tool/browser-native-llm`
- Browser translation via `@smart-tool/lengua-materna`
- History, templates, recent names, and settings stored locally on-device
- GDPR-style data export/import and delete-all flows
- Optional desktop folder sync using the File System Access API
- Hidden admin route for maintaining `prompt-pack.json`
- PWA install/update prompts and offline-friendly deployment assets
  - on macOS Safari, install uses `File > Add to Dock` / `Share > Add to Dock`

## Monorepo Layout

The root app depends on three local workspace packages:

- `browser-native-llm/` - browser-side SMART planning engine
- `browser-translation/` - Lengua Materna translation engine
- `puente-engine/` - lower-level inference/runtime support

Key app folders:

- `src/components/smart/` - main SMART tool UI
- `src/hooks/` - app state, storage, AI, translation, sync, and PWA hooks
- `src/lib/` - SMART logic, prompt-pack loading, portability, analytics, and helpers
- `src/pages/` - app routes (`/`, `/privacy`, `/terms`, `/admin-playbook`)
- `public/` - icons, manifest, service worker, retrieval pack, prompt pack
- `supabase/` - Supabase config, migration, and the `custom-knowledge-base` Edge Function
- `.github/workflows/` - CI and deployment workflows

## Getting Started

### Prerequisites

- Bun is preferred because CI uses Bun
- npm also works for the root app scripts
- Python 3 is required for model download scripts

### Install

```bash
bun install
```

If you prefer npm:

```bash
npm install
```

### Run the app

```bash
bun run dev
```

The Vite dev server runs on port `8080`.

### Build

```bash
bun run build
```

### Install SMART Tool Desktop Apps

Use the latest GitHub release page if you want the plug-and-play Desktop
Accelerator experience:

- GitHub Releases: `https://github.com/wwessex/smart-tool/releases/latest`
- macOS: download `SMART-Tool-macOS-arm64.dmg` on Apple Silicon
- Windows: download the installer that matches your architecture (`x64` or `arm64`)

The desktop apps embed Desktop Accelerator directly. On first launch they
download the local GGUF model into app data and reuse it on later launches.
Normal browser users should use these installers instead of building from this
repository.

### Build The Desktop Apps Locally

The repo uses two desktop shells:

- Electron for Windows packaging and native folder sync
- a native SwiftUI macOS shell under `macos/`

Run the Electron shell locally in desktop mode:

```bash
npm run desktop:dev
```

Create an unpacked desktop bundle:

```bash
npm run desktop:build
```

Build Windows installers and portable binaries on Windows:

```bash
npm run desktop:dist
# or
npm run desktop:dist:win
```

Notes:

- the packaged desktop app loads the existing Vite build from `dist/`
- Electron and Electron Builder are fetched on demand by the desktop scripts via `npx`
- the Windows packaging scripts stage a pinned `llama.cpp` runtime into `desktop-helper/runtime/staged/` before packaging
- Desktop Accelerator is embedded in the Electron shell through the preload bridge and shared accelerator host
- folder sync uses the native folder picker and writes directly to the chosen Windows folder, including OneDrive-backed folders
- on Windows, `npm run desktop:build` produces an unpacked executable at `release/win-unpacked/SMART Tool.exe`
- on Windows, `npm run desktop:dist:win` produces x64 and ARM64 installer/portable artifacts under `release/`
- `script/build_and_run.ps1` is the project-local Windows entrypoint for kill/build/run and verify flows
- `.github/workflows/windows-desktop.yml` builds the Windows desktop artifacts on `windows-latest`, which is the supported verification path from non-Windows hosts
- `.github/workflows/release-desktop.yml` is the signed tag-driven release workflow for public installers

### Native macOS shell

The repo also includes a native SwiftUI macOS app under `macos/`. It keeps
the existing web app as the main app surface, adds a narrow AppKit bridge for
folder selection, and wraps the runtime in `OSLog` telemetry and a small set of
desktop commands.

Run the native shell on macOS:

```bash
./script/build_and_run.sh
```

Useful variants:

```bash
./script/build_and_run.sh --verify
./script/build_and_run.sh --logs
./script/build_and_run.sh --telemetry
```

Notes:

- `script/build_and_run.sh` first builds the Vite app, then builds the Swift
  macOS app target via `xcodebuild`
- the script uses a derived-data location under
  `~/Library/Developer/Xcode/DerivedData/SMARTToolMac-Codex` by default so the
  signed app bundle is built outside iCloud-synced `Documents` folders
- the native Xcode target runs a build-phase script that rebuilds the Vite app
  when needed, stages the pinned `llama.cpp` runtime, and copies both the web
  bundle and accelerator resources into the app
- the native shell serves the bundled web build over a local loopback server,
  then loads it in `WKWebView` so the app avoids `file://` restrictions
- the native shell injects a desktop bridge into `WKWebView` so the React app
  can use native folder sync and the embedded Desktop Accelerator runtime
- folder selection is intentionally kept behind a small `NSOpenPanel` service
  so SwiftUI remains the source of truth for desktop state
- telemetry uses unified logging categories for windowing, sidebar, commands,
  sync, web loading, and Desktop Accelerator state

### Xcode

Generate the project if needed:

```bash
./script/generate_xcode_project.sh
```

Then open:

```text
macos/SMARTToolMac.xcodeproj
```

The `SMARTToolMac` app target is Xcode-first:

- building in Xcode also prepares the web bundle and copies it into app resources
- the app sources live under `macos/Sources/SMARTToolMac`
- the project definition is stored in `macos/project.yml` and regenerated with
  `xcodegen`
- Xcode's default DerivedData location is the preferred build location; if you
  override it into a synced folder such as `Documents`, macOS file-provider
  metadata can break codesign for the built `.app`

### Test and lint

```bash
bun run test
bun run lint
bun run tsc --noEmit
```

npm equivalents:

```bash
npm run test
npm run lint
npx tsc --noEmit
```

## Environment Variables

The app currently uses these environment variables:

- `VITE_SUPABASE_URL`
  - Supabase project URL for the authenticated client and Edge Functions
- `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Supabase publishable key used by the browser client
- `VITE_PROMPT_PACK_URL` (optional)
  - Overrides the default `prompt-pack.json` location
- `VITE_ALLOW_REMOTE_TRANSLATION_MODELS` (optional)
  - Enables remote fallback for translation models
- `VITE_HF_TOKEN` (optional)
  - Bearer token for remote translation model requests
- `VITE_REMOTE_MODEL_BASE_PATH` (optional)
  - Overrides the remote translation model host/base path

### Advanced Manual Desktop Setup

Desktop builds now embed Desktop Accelerator directly. Browser and PWA builds
can still talk to a loopback helper for development or compatibility testing,
but that is an advanced path rather than the recommended install experience.

- `SMART_TOOL_HELPER_MODEL_URL`
  - Optional override for the bundled model manifest URL. Must point to a GGUF model file that `llama-server` can load.
- `SMART_TOOL_HELPER_MODEL_SHA256` (optional)
  - Overrides the bundled model manifest checksum.
- `SMART_TOOL_HELPER_MODEL_SIZE_BYTES` (optional)
  - Overrides the bundled model manifest file size.
- `SMART_TOOL_LLAMA_SERVER_BIN` (optional)
  - Overrides the `llama-server` executable path.
- `SMART_TOOL_HELPER_MODEL_DIR` (optional)
  - Overrides where the helper caches downloaded GGUF models.
- `SMART_TOOL_ALLOWED_ORIGINS` (optional)
  - Extra comma-separated web origins allowed to call the helper.

By default the helper accepts requests from:

- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `https://wwessex.github.io`
- `https://smartactiontool.app`
- `https://www.smartactiontool.app`

Start the helper manually:

```bash
npm run helper:start
```

The shared model manifest lives at `desktop-helper/desktop-accelerator.manifest.json`.
The pinned runtime manifest for packaged `llama-server` bundles lives at
`desktop-helper/runtime/runtime-manifest.json`. The staging script that prepares
those packaged runtimes is `scripts/stage-desktop-accelerator-runtime.mjs`.

Desktop builds download the GGUF model on first use into app data, then reuse
the cached copy on later launches. The manual helper remains useful for local
development, unsupported desktop platforms, and compatibility testing.

If the embedded runtime or browser helper is unavailable, the app falls back to
Browser AI or Smart Templates.

## Local Model Provisioning

For fully local/offline deployments, download model artifacts into `public/models/`.

Install the Python dependency first:

```bash
pip install huggingface_hub
```

Then provision model files:

```bash
bun run fetch-models
```

This script downloads:

- planner assets into `public/models/smart-planner-150m-q4/`
- translation assets for every model listed in `browser-translation/src/models/registry.ts`

Validate the translation model layout with:

```bash
bun run validate:translation-models
LOCAL_ONLY_MODELS=1 bun run validate:translation-models:offline
```

## Development Notes

- The app uses `HashRouter` and Vite `base: './'` so the built site can be uploaded to subfolders and simple static hosts.
- The prompt-pack system loads from `public/prompt-pack.json` by default, caches a copy in IndexedDB, and can be managed in the hidden admin route at `#/admin-playbook`.
- The service worker and install/update prompts are enabled in the main app shell. Deployment notes live in `public/DEPLOYMENT.md`.
- User data is designed to stay local by default. Supabase is currently used for the custom knowledge base backend and authenticated function access.

## Testing Coverage

Tests live under `src/test/` and cover:

- UI components
- storage/import-export behavior
- prompt-pack loading
- translation hook behavior
- browser AI integration
- SMART logic and retrieval helpers
- custom knowledge base API wrapper

## Deployment

Build a static bundle:

```bash
bun run build
```

Then upload the contents of `dist/` to your static host. See `public/DEPLOYMENT.md` for cache-handling and service-worker troubleshooting notes.
