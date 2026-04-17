# CLAUDE.md

## Project Overview

**SMART Action Tool** — React/TypeScript web app helping employment advisors create SMART (Specific, Measurable, Achievable, Relevant, Time-bound) action plans for job seekers. Features real-time SMART criteria analysis, browser-native AI drafting, translation (15 languages), PWA offline support, and GDPR-compliant data handling.

### Domain Concepts

- **SMART Actions**: Each action must satisfy all five SMART criteria
- **Barriers**: Employment obstacles (transport, childcare, CV gaps, confidence, etc.)
- **Timescales**: Review periods for action plans
- **Participants**: Job seekers working with advisors
- **Prompt Packs**: Curated templates + few-shot examples for AI drafting (`public/prompt-pack.json`)
- **Retrieval Packs**: Language-specific example packs for retrieval-augmented generation (`public/retrieval-packs/`)

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18.3 + TypeScript 5.8 |
| Build | Vite 5, Bun (preferred) or npm |
| UI | shadcn/ui + Radix UI (21 primitives) + Tailwind CSS 3 |
| Animations | Framer Motion 12 |
| State | React hooks + TanStack Query 5 |
| Routing | React Router 6 (HashRouter) |
| Validation | Zod 3 |
| Local AI | `@smart-tool/browser-native-llm` (Amor inteligente) via Puente Engine |
| Translation | `@smart-tool/lengua-materna` (Lengua Materna) via Puente Engine |
| Inference | ONNX Runtime Web 1.21 |
| Testing | Vitest 3 + Testing Library |
| Linting | ESLint 9 (flat config) |
| Auth | Supabase 2, @azure/msal-browser 5 |

## Commands

```bash
bun install                        # Install dependencies
bun run dev                        # Dev server on port 8080
bun run build                      # Production build
bun run build:dev                  # Dev build (sourcemaps, keeps console)
bun run test                       # Run tests (vitest run)
bun run test:watch                 # Tests in watch mode
bun run lint                       # ESLint
bun run tsc --noEmit               # Type check (not a script — run directly)
bun run fetch-models               # Download OPUS-MT translation models
bun run validate:translation-models # Validate downloaded models
```

## Directory Structure

```
src/
├── components/
│   ├── smart/           # Domain components (25 files, ~7200 LOC)
│   └── ui/              # shadcn/ui — DO NOT edit manually, use: npx shadcn@latest add [name]
├── hooks/               # Custom hooks (22 files, ~4000 LOC)
├── lib/                 # Domain logic (17 files, ~4200 LOC)
├── pages/               # Route components (Index, Privacy, Terms, AdminPromptPack, NotFound)
├── integrations/        # Supabase client integration
├── types/smart-tool.ts  # Shared TypeScript interfaces
├── assets/              # Static images and assets
└── test/                # Tests mirror source structure (components/, hooks/, lib/)

puente-engine/           # @smart-tool/puente-engine — ONNX inference engine
browser-native-llm/      # @smart-tool/browser-native-llm — browser LLM engine
browser-translation/     # @smart-tool/lengua-materna — OPUS-MT translation engine
public/                  # Static assets, PWA files, prompt-pack.json, retrieval-packs/
```

## Code Conventions

### Imports

Use `@/` alias for all `src/` imports:
```typescript
import { Button } from "@/components/ui/button";
import { useSmartStorage } from "@/hooks/useSmartStorage";
import { checkSmart } from "@/lib/smart-checker";
```

Workspace packages:
```typescript
import { ... } from "@smart-tool/browser-native-llm";
import { ... } from "@smart-tool/lengua-materna";
import { ... } from "@smart-tool/puente-engine";
```

### Naming

- Components: `PascalCase.tsx` (e.g., `SmartActionTool.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useSmartStorage.ts`)
- Utilities: `kebab-case.ts` (e.g., `smart-checker.ts`)
- Tests: `*.test.ts(x)` under `src/test/`, mirroring source structure

### localStorage

All keys prefixed with `smartTool.` — see `STORAGE` constant in `useSmartStorage.ts`.

### Environment Variables

Prefixed with `VITE_` (see `.env.example`):
```
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
VITE_BASE_PATH=./
VITE_HF_TOKEN  (optional, for model downloads)
```

### TypeScript Configuration

- App code (`tsconfig.app.json`): Target ES2020, `strict: false`, Vitest globals enabled
- Node config (`tsconfig.node.json`): Target ES2022, `strict: true`, for vite.config.ts
- Path aliases configured in both tsconfig and vite.config.ts

## Key Files

### Domain Logic (`src/lib/`)

| File | What it does |
|------|-------------|
| `smart-checker.ts` | SMART criteria analysis — patterns, scoring, suggestions. Entry: `checkSmart()` |
| `smart-patterns.ts` | Pattern matching for SMART criteria detection |
| `smart-data.ts` | `DEFAULT_BARRIERS`, `DEFAULT_TIMESCALES`, and constants (~1100 LOC) |
| `smart-prompts.ts` | AI prompt templates for LLM drafting |
| `smart-utils.ts` | Shared utility functions (~515 LOC) |
| `smart-retrieval.ts` | Retrieval-augmented generation for AI drafting (~340 LOC) |
| `smart-highlighter.ts` | SMART criteria text highlighting |
| `smart-portability.ts` | GDPR export/import (`exportAllData`, `importData`, `deleteAllData`) |
| `smart-tool-shortcuts.ts` | Keyboard shortcut definitions |
| `prompt-pack.ts` | Prompt pack loading and validation (~510 LOC) |
| `relevance-checker.ts` | Action relevance checking against barriers |
| `custom-knowledge-base.ts` | Custom knowledge base for retrieval |
| `draft-analytics.ts` | AI drafting analytics tracking |
| `error-handling.ts` | Error handling utilities (~224 LOC) |
| `gdpr-consent.ts` | GDPR consent tracking |
| `animation-variants.ts` | Framer Motion animation definitions |
| `utils.ts` | shadcn/ui utility — `cn()` function (clsx + tailwind-merge) |

### Hooks (`src/hooks/`)

| File | What it does |
|------|-------------|
| `useAIDrafting.ts` | Orchestrates LLM + prompt packs + retrieval (~484 LOC) |
| `useBrowserNativeLLM.ts` | Local LLM integration via Puente Engine (~651 LOC) |
| `useTranslation.ts` | Translation via Lengua Materna (~330 LOC) |
| `useSmartStorage.ts` | localStorage CRUD for all app data (~294 LOC) |
| `useLocalSync.ts` | Local data sync with Supabase (~455 LOC) |
| `useActionOutput.ts` | Output formatting and export (~232 LOC) |
| `useActionAnalytics.ts` | Action analytics tracking (~184 LOC) |
| `useHistory.ts` | Action history management |
| `useSmartForm.ts` | Form state and validation |
| `useSettings.ts` | Settings management |
| `useKeyboardShortcuts.ts` | Keyboard shortcut binding (~144 LOC) |
| `usePWA.ts` | PWA install prompt and lifecycle |
| `useDebounce.ts` | Debounce hook |
| `useFeedback.ts` | Feedback collection |
| `useOnboarding.ts` | Onboarding state |
| `usePromptPack.ts` | Prompt pack selection |
| `useTemplates.ts` | Action template CRUD with localStorage persistence (~100 LOC) |
| `useWebGPUSupport.ts` | WebGPU capability detection |
| `useAIConsent.ts` | AI consent tracking |
| `use-toast.ts` | Sonner toast notifications |
| `use-mobile.tsx` | Mobile detection hook |
| `storage-utils.ts` | Storage helper utilities |

### Components (`src/components/smart/`)

| File | What it does |
|------|-------------|
| `SmartActionTool.tsx` | Main application component (~1264 LOC) |
| `SettingsPanel.tsx` | Settings UI (~754 LOC) |
| `SmartChecklist.tsx` | SMART criteria checklist display (~430 LOC) |
| `ActionWizard.tsx` | Multi-step action creation form (~413 LOC) |
| `OnboardingTutorial.tsx` | First-run onboarding flow (~413 LOC) |
| `TemplateLibrary.tsx` | Action template library (~313 LOC) |
| `HistoryInsights.tsx` | History analytics and insights (~265 LOC) |
| `ComboboxInput.tsx` | Searchable combobox dropdown with popover UI (~250 LOC) |
| `DebugPanel.tsx` | LLM pipeline trace display (prompt, output, scores, timing) (~250 LOC) |
| `HistoryPanel.tsx` | Action history display (~212 LOC) |
| `OutputPanel.tsx` | Output formatting and export |
| `SmartScoreDetails.tsx` | SMART score breakdown (~200 LOC) |
| `DelightfulError.tsx` | User-friendly error component with variants (network, ai, generic) (~200 LOC) |
| `CookieConsent.tsx` | GDPR cookie consent dialog and settings (~150 LOC) |
| `LLMPickerDialog.tsx` | LLM model selection dialog |
| `WarningBox.tsx` | Warning UI component |
| `FloatingToolbar.tsx` | Floating toolbar UI |
| `ActionFeedback.tsx` | Feedback collection UI |
| `WebGPUCheck.tsx` | WebGPU capability check |
| `EmptyState.tsx` | Empty state UI |
| `Footer.tsx` | Footer component |
| `PlanPickerDialog.tsx` | Plan selection dialog |
| `LanguageSelector.tsx` | Language selection UI |
| `ShortcutsHelp.tsx` | Keyboard shortcuts help |
| `PanelErrorBoundary.tsx` | Error boundary wrapper |

### Other Key Files

| File | What it does |
|------|-------------|
| `src/App.tsx` | HashRouter, QueryClient, ThemeProvider, TooltipProvider, LazyErrorBoundary (~266 LOC) |
| `src/types/smart-tool.ts` | Shared interfaces: `Mode`, `NowForm`, `TaskBasedForm`, `HistoryItem`, `ActionTemplate`, `SmartToolSettings`, `AIDraftMode`, `OutputSource`, etc. |
| `src/integrations/supabase/` | Supabase client configuration |

## Testing

- **Framework**: Vitest + jsdom + Testing Library
- **Config**: `vitest.config.ts` — jsdom environment, globals enabled, setup file
- **Setup**: `src/test/setup.ts` mocks localStorage, crypto.randomUUID, ResizeObserver, scrollIntoView, matchMedia
- **Pattern**:
```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
```
- Tests live in `src/test/{components,hooks,lib}/` mirroring `src/`

### Test Coverage

- **Component tests** (8): ActionFeedback, ActionWizard, ComboboxInput, HistoryPanel, OutputPanel, SmartActionTool, SmartChecklist, TemplateLibrary
- **Hook tests** (11): storage-utils, useActionAnalytics, useBrowserNativeLLM, useDebounce, useFeedback, useHistory, useKeyboardShortcuts, useSettings, useSmartForm, useSmartStorage, useTranslation
- **Lib tests** (14): barrier-relevance-consistency, custom-knowledge-base, draft-analytics, error-handling, gdpr-consent, prompt-pack, relevance-checker, smart-checker, smart-data, smart-highlighter, smart-patterns, smart-prompts, smart-retrieval, smart-utils
- **Other**: smartPortability.test.ts, smart-portability-extended.test.ts (GDPR export/import)

## CI Pipeline

### `.github/workflows/build-static.yml` — Main CI (push/PR to `main`)

1. **Lint**: `bun run lint` + `bun run tsc --noEmit` (includes Tailwind glass opacity CI guard)
2. **Test**: `bun run test`
3. **Build**: Verify prompt-pack.json + fetch OPUS-MT models + Vite production build + verify output

### Other Workflows

- `static.yml` — GitHub Pages deployment (push to `main`)
- `apply-zip.yml` — Apply zip file changes
- `merge-cursor-to-main.yml` — Merge cursor branch to main
- `delete-all-branches.yml` — Branch cleanup

## Workspace Packages

### `puente-engine/` — @smart-tool/puente-engine

Custom ONNX inference engine for browser-native LLM and translation. Internal structure:
- `src/generation/` — causal & seq2seq generators, sampler, KV cache, stopping criteria, logits processor
- `src/model/` — model loader, cache, config
- `src/runtime/` — device & backend selection (WebGPU/WASM)
- `src/pipelines/` — text-generation, translation pipelines
- `src/tokenizer/` — BPE tokenizer, decoder, normalizer, pre-tokenizer
- `src/core/` — tensor, session management

### `browser-native-llm/` — @smart-tool/browser-native-llm

Offline-first, privacy-preserving LLM for SMART action drafting. Internal structure:
- `src/model/` — tokenizer, inference, config
- `src/runtime/` — worker, backend selector
- `src/delivery/` — cache manager, chunk loader, service worker
- `src/planner/` — SMART planner, profile normalizer, prompt assembler
- `src/retrieval/` — action library, retriever, barrier catalog
- `src/validators/` — SMART validator, schema, repair
- Exports: `./` (main), `./worker` (web worker), `./sw` (service worker)

### `browser-translation/` — @smart-tool/lengua-materna

Offline-first in-browser translation using OPUS-MT models. Internal structure:
- `src/runtime/` — worker, worker client, backend selector
- `src/cache/` — model cache, translation cache
- `src/engine/` — text chunker, translator, pipeline manager, rule translator
- `src/dictionaries/` — language-specific dictionaries (en-pa, en-ps, en-ur, en-pt, en-pl, en-es, en-ti, en-ar, etc.)
- Exports: `./` (main), `./worker` (web worker)

## Do's and Don'ts

### Do

- Use `@/` import aliases everywhere
- Add new UI components via `npx shadcn@latest add [name]`
- Add new routes in `src/App.tsx`
- Add SMART detection patterns in `src/lib/smart-checker.ts` (exports like `SPECIFIC_PATTERNS`, `MEASURABLE_PATTERNS`, etc.)
- Add barriers/timescales in `src/lib/smart-data.ts`
- Add keyboard shortcuts in `src/lib/smart-tool-shortcuts.ts` + bind in `src/hooks/useKeyboardShortcuts.ts`
- Write tests for new lib/ and hooks/ code
- Keep all localStorage keys under the `smartTool.` prefix
- Run `bun run lint && bun run tsc --noEmit && bun run test` before pushing

### Don't

- Don't manually edit files in `src/components/ui/` — they're shadcn/ui managed
- Don't store PII or sensitive data in localStorage
- Don't import workspace packages by path — use the `@smart-tool/*` aliases
- Don't skip the GDPR consent flow for AI or cloud features
- Don't use `npm` if `bun` is available
- Don't add `console.log` to production code (stripped by esbuild in prod builds)

## Architecture Notes

### All AI runs locally in the browser

- **Amor inteligente** (`useBrowserNativeLLM`): Browser-native LLM via Puente Engine for SMART drafting
- **Lengua Materna** (`useTranslation`): Per-language-pair OPUS-MT models via Puente Engine. LRU manages max 3 models in memory. Pivot translation through English when no direct model exists.
- AI drafting pipeline: `useAIDrafting` coordinates LLM, prompt packs, and retrieval

### Cross-Origin Isolation

Dev server and production builds set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` for SharedArrayBuffer support (required by ONNX Runtime multi-threading).

### PWA

Service worker at `public/sw.js`, offline fallback at `public/offline.html`, install prompt via `PWAPrompt.tsx` + `usePWA.ts`.

### Browser Support for Local AI

| Browser | Support |
|---------|---------|
| Chrome/Edge | WebGPU (fast) |
| Safari | WASM only |
| Firefox | WASM (single-threaded) |
| Android | Not supported |

### Build Configuration

- Base path: `./` (relative, for portable static builds)
- Dev server: port 8080, IPv6 host, HMR overlay disabled
- Build splits: vendor-llm and vendor chunks for optimal caching
- Worker format: ES modules
- OptimizeDeps: React/Router/Framer/Query included; ML/translation packages excluded
