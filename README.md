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

### Run As A Desktop App

The repo now includes an Electron shell for Windows desktop packaging.

Run it locally in desktop mode:

```bash
npm run desktop:dev
```

Create an unpacked desktop bundle:

```bash
npm run desktop:build
```

Build Windows installers and portable binaries on Windows:

```bash
npm run dist:win
```

Notes:

- the packaged desktop app loads the existing Vite build from `dist/`
- Electron and Electron Builder are fetched on demand by the desktop scripts via `npx`
- Desktop Accelerator calls use an Electron preload bridge, so the packaged app does not need a separate loopback helper server
- folder sync uses the native folder picker and writes directly to the chosen Windows folder, including OneDrive-backed folders

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
