# CLAUDE.md

## Project Overview

**SMART Action Tool** — React/TypeScript web app helping employment advisors create SMART (Specific, Measurable, Achievable, Relevant, Time-bound) action plans for job seekers. Features real-time SMART criteria analysis, browser-native AI drafting, translation (15 languages), PWA offline support, and GDPR-compliant data handling.

### Domain Concepts

- **SMART Actions**: Each action must satisfy all five SMART criteria
- **Barriers**: Employment obstacles (transport, childcare, CV gaps, confidence, etc.)
- **Timescales**: Review periods for action plans
- **Participants**: Job seekers working with advisors
- **Prompt Packs**: Curated templates + few-shot examples for AI drafting (`public/prompt-pack.json`)

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite 5, Bun (preferred) or npm |
| UI | shadcn/ui + Radix UI + Tailwind CSS 3 |
| Animations | Framer Motion |
| State | React hooks + TanStack Query |
| Local AI | `@smart-tool/browser-native-llm` (Amor inteligente) via Puente Engine |
| Translation | `@smart-tool/lengua-materna` (Lengua Materna) via Puente Engine |
| Inference | ONNX Runtime Web |
| Testing | Vitest + Testing Library |
| Linting | ESLint (flat config) |
| Auth | Supabase, @azure/msal-browser |

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Dev server on port 8080
bun run build            # Production build
bun run build:dev        # Dev build (sourcemaps, keeps console)
bun run test             # Run tests (vitest run)
bun run test:watch       # Tests in watch mode
bun run lint             # ESLint
bun run tsc --noEmit     # Type check (not a script — run directly)
```

## Directory Structure

```
src/
├── components/
│   ├── smart/           # Domain components (SmartActionTool.tsx is the main ~1250 LOC component)
│   └── ui/              # shadcn/ui — DO NOT edit manually, use: npx shadcn@latest add [name]
├── hooks/               # Custom hooks (useSmartStorage, useBrowserNativeLLM, useTranslation, etc.)
├── lib/                 # Domain logic (smart-checker, smart-prompts, smart-data, etc.)
├── pages/               # Route components (Index, Privacy, Terms, AdminPromptPack, NotFound)
├── types/smart-tool.ts  # Shared TypeScript interfaces
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

## Key Files

| File | What it does |
|------|-------------|
| `src/lib/smart-checker.ts` | SMART criteria analysis — patterns, scoring, suggestions. Entry: `checkSmart()` |
| `src/lib/smart-data.ts` | `DEFAULT_BARRIERS` and `DEFAULT_TIMESCALES` |
| `src/lib/smart-prompts.ts` | AI prompt templates |
| `src/lib/smart-patterns.ts` | Pattern matching for SMART criteria detection |
| `src/lib/smart-portability.ts` | GDPR export/import (`exportAllData`, `importData`, `deleteAllData`) |
| `src/lib/prompt-pack.ts` | Prompt pack loading and validation |
| `src/hooks/useAIDrafting.ts` | Orchestrates LLM + prompt packs + retrieval |
| `src/hooks/useBrowserNativeLLM.ts` | Local LLM integration |
| `src/hooks/useTranslation.ts` | Translation integration |
| `src/hooks/useSmartStorage.ts` | localStorage CRUD for all app data |
| `src/components/smart/SmartActionTool.tsx` | Main application component |
| `src/App.tsx` | Router, providers, error boundaries |
| `src/types/smart-tool.ts` | Shared TypeScript interfaces |

## Testing

- **Framework**: Vitest + jsdom + Testing Library
- **Setup**: `src/test/setup.ts` mocks localStorage, crypto.randomUUID, ResizeObserver, scrollIntoView, matchMedia
- **Pattern**:
```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
```
- Tests live in `src/test/{components,hooks,lib}/` mirroring `src/`

## CI Pipeline

`.github/workflows/build-static.yml` runs on push/PR to `main`:
1. **Lint**: `bun run lint` + `bun run tsc --noEmit` (includes Tailwind glass opacity CI guard)
2. **Test**: `bun run test`
3. **Build**: Vite production build + translation model fetch + prompt pack validation

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
