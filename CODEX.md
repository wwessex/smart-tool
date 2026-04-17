# CODEX.md - smart-tool assistant guide

## Project Overview

`smart-tool` is a Vite + React + TypeScript single-page app for employment advisors and coaches. Its main job is to help users create SMART actions for job seekers, optionally improve those actions with local AI, translate the finished output, and keep everything privacy-conscious and portable.

This repository is not just a UI shell. The root app depends on in-repo workspace packages for browser AI and translation:

- `browser-native-llm/` - local SMART planning engine
- `browser-translation/` - Lengua Materna translation engine
- `puente-engine/` - runtime/inference support

## Current Architecture

- App shell: `src/App.tsx`
  - sets up theme, toasts, PWA prompt, cookie consent, router, lazy loading, and error boundaries
- Main screen: `src/pages/Index.tsx`
  - renders `SmartActionTool`
- Primary UI orchestrator: `src/components/smart/SmartActionTool.tsx`
  - wires form state, storage, AI drafting, translation output, local sync, templates, history, and dialogs
- Static-host deployment model:
  - `HashRouter`
  - Vite `base: './'`
  - relative asset resolution for subfolder hosting
- Data model:
  - local-first storage in `localStorage` and IndexedDB
  - optional authenticated Supabase Edge Function for custom knowledge base CRUD

## Tech Stack

| Area | Current choice |
| --- | --- |
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Package manager | Bun preferred, npm works |
| Styling | Tailwind CSS + shadcn/ui + Radix |
| Animation | Framer Motion |
| State/data | React hooks + TanStack Query |
| Testing | Vitest + Testing Library |
| Backend integration | Supabase browser client + Edge Functions |
| Local AI | `@smart-tool/browser-native-llm` |
| Translation | `@smart-tool/lengua-materna` |

## Repository Map

```text
smart-tool/
├── src/
│   ├── components/
│   │   ├── smart/                 # Main SMART tool UI
│   │   └── ui/                    # shadcn/ui primitives
│   ├── hooks/                     # App state, storage, AI, translation, sync, PWA
│   ├── lib/                       # SMART logic, portability, prompt-pack, helpers
│   ├── integrations/supabase/     # Browser Supabase client
│   ├── pages/                     # Index, Privacy, Terms, AdminPromptPack, NotFound
│   ├── test/                      # Component, hook, and lib tests
│   ├── types/                     # Shared domain types
│   ├── App.tsx
│   └── main.tsx
├── public/                        # Manifest, icons, service worker, prompt pack, retrieval pack
├── supabase/                      # Config, migration, custom-knowledge-base function
├── scripts/                       # Model download/validation utilities
├── docs/                          # Backend notes and planning docs
├── browser-native-llm/            # Workspace package
├── browser-translation/           # Workspace package
└── puente-engine/                 # Workspace package
```

## Routes

Current routes in `src/App.tsx`:

- `#/` - main SMART tool
- `#/privacy` - privacy policy
- `#/terms` - terms page
- `#/admin-playbook` - admin prompt-pack editor
- `#/*` - not found

## Development Commands

Use Bun unless you have a reason not to.

```bash
# install
bun install

# dev server (port 8080)
bun run dev

# production build
bun run build

# preview built output
bun run preview

# lint
bun run lint

# tests
bun run test
bun run test:watch

# ad hoc typecheck (no dedicated script yet)
bun run tsc --noEmit

# local model tooling
bun run fetch-models
bun run validate:translation-models
LOCAL_ONLY_MODELS=1 bun run validate:translation-models:offline
```

If you use npm instead:

```bash
npm install
npm run dev
npm run build
npm run test
npm run lint
npx tsc --noEmit
```

## Key Files And Responsibilities

### App shell and routing

- `src/main.tsx`
  - installs global error handlers and mounts the React app
- `src/App.tsx`
  - owns router, lazy page loading, page-level fallback UI, query client, theme, PWA prompt, and cookie consent

### Main SMART flow

- `src/components/smart/SmartActionTool.tsx`
  - central orchestration component
- `src/hooks/useSmartForm.ts`
  - form state and validation for `now` and `future` modes
- `src/hooks/useActionOutput.ts`
  - generates final output, copy/download, translation handoff
- `src/hooks/useAIDrafting.ts`
  - local AI/template drafting flow, plan picker, feedback capture
- `src/hooks/useBrowserNativeLLM.ts`
  - wrapper around the browser AI engine
- `src/hooks/useTranslation.ts`
  - wrapper around Lengua Materna translation

### Storage and portability

- `src/hooks/useSmartStorage.ts`
  - facade over history, templates, settings, and feedback hooks
- `src/hooks/useHistory.ts`
- `src/hooks/useTemplates.ts`
- `src/hooks/useSettings.ts`
- `src/hooks/useFeedback.ts`
- `src/lib/smart-portability.ts`
  - import parsing and schema validation for export/import files

### Domain logic

- `src/lib/smart-checker.ts`
  - SMART scoring/criteria checks
- `src/lib/smart-utils.ts`
  - suggestion building, formatting, AI/template helpers
- `src/lib/smart-data.ts`
  - default barriers, timescales, guidance, and barrier classification
- `src/lib/relevance-checker.ts`
  - ranking/filtering support for candidate actions
- `src/lib/smart-retrieval.ts`
  - exemplar retrieval helpers

### Prompt-pack and backend integration

- `src/lib/prompt-pack.ts`
  - built-in defaults, remote fetch, IndexedDB cache, admin helpers
- `src/pages/AdminPromptPack.tsx`
  - hidden admin UI for editing and exporting prompt-pack JSON
- `src/lib/custom-knowledge-base.ts`
  - client wrapper around the Supabase Edge Function
- `supabase/functions/custom-knowledge-base/index.ts`
  - authenticated CRUD/search endpoint for user-specific knowledge entries

## Environment Variables

These are the environment variables that matter right now:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PROMPT_PACK_URL` (optional)
- `VITE_ALLOW_REMOTE_TRANSLATION_MODELS` (optional)
- `VITE_HF_TOKEN` (optional)
- `VITE_REMOTE_MODEL_BASE_PATH` (optional)

Do not document or introduce `VITE_BASE_PATH`; the app currently relies on Vite `base: './'`, not a custom env var.

## Storage And Persistence Notes

- General app data uses `smartTool.*` keys in `localStorage`
- Prompt-pack caching uses IndexedDB database `smart-tool`, store `kv`
- Folder sync stores a directory handle in IndexedDB database `smart-tool-sync`
- Exported user data currently uses version `2` and is a top-level payload
- Import parsing still accepts older shapes, including the legacy `data` wrapper

## PWA And Deployment Notes

- Service worker registration is deferred in `src/hooks/usePWA.ts`
- The app can be installed as a PWA and shows update/install prompts
- A service worker can be bypassed for debugging with `?no-sw` or `localStorage.setItem('disable-sw', 'true')`
- `public/DEPLOYMENT.md` contains cache-clearing and static-host upload notes

## Current Backend/CI Reality

- Supabase is present, but the concrete backend code in this repo is the `custom-knowledge-base` Edge Function and related migration/docs
- CI is centered on `.github/workflows/build-static.yml`
  - installs with Bun
  - lints
  - runs tests
  - verifies `public/prompt-pack.json`
  - downloads priority translation models in CI
  - builds a static `dist/` artifact

## Testing Notes

Tests live under `src/test/` and currently cover:

- components
- hooks
- prompt-pack behavior
- portability/import-export behavior
- translation behavior
- local AI wrapper behavior
- SMART scoring/retrieval utilities
- custom knowledge base API client

When changing storage, prompt-pack loading, translation, portability, or custom knowledge base behavior, add or update targeted tests in the matching `src/test/` area.

## Editing Guidance For Agents

- Prefer updating the focused hook/lib instead of adding more logic into `SmartActionTool.tsx`
- Keep static-host compatibility intact:
  - preserve `HashRouter`
  - preserve relative-friendly asset/model URL handling
- Treat `src/components/ui/` as shadcn-owned primitives; avoid unnecessary hand edits there
- Keep AI and translation imports lazy when possible because Safari startup stability matters
- If you add persisted fields, update:
  - the relevant storage hook
  - export/import handling in `src/lib/smart-portability.ts`
  - any affected tests
- If you change prompt-pack shape, update:
  - `src/lib/prompt-pack.ts`
  - `public/prompt-pack.json`
  - admin page assumptions
  - tests and CI expectations
