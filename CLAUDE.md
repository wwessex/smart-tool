# CLAUDE.md - AI Assistant Guide for smart-tool

## Project Overview

**SMART Action Tool** is a React/TypeScript web application that helps employment advisors create SMART (Specific, Measurable, Achievable, Relevant, Time-bound) action plans for job seekers. The app features real-time SMART criteria analysis, AI-powered draft suggestions (local, on-device), translation support (15 languages), and GDPR-compliant data handling.

### Key Domain Concepts
- **SMART Actions**: Goal-setting framework where each action must be Specific, Measurable, Achievable, Relevant, and Time-bound
- **Barriers**: Employment obstacles participants face (e.g., transport, childcare, CV gaps, confidence)
- **Timescales**: Review periods for action plans
- **Participants**: Job seekers working with advisors
- **Prompt Pack**: Central JSON-based configuration (`public/prompt-pack.json`) containing system prompts, barrier guidance, and few-shot examples for AI drafting
- **Retrieval Packs**: Exemplar action libraries (`public/retrieval-packs/`) used for few-shot retrieval during AI drafting

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 with TypeScript |
| Build Tool | Vite 5.x |
| Package Manager | Bun (preferred) or npm |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS with CSS variables |
| Animations | Framer Motion |
| State Management | React hooks + TanStack Query |
| Backend | Supabase (auth + edge functions) |
| Local AI | @smart-tool/browser-native-llm (Amor inteligente via Puente Engine) |
| Translation | @smart-tool/lengua-materna (Lengua Materna via Puente Engine) |
| Testing | Vitest + Testing Library |
| Linting | ESLint 9 with TypeScript support |

## Directory Structure

```
smart-tool/
├── src/
│   ├── components/
│   │   ├── smart/          # 24 domain-specific components
│   │   └── ui/             # 60+ shadcn/ui components (DO NOT edit - use shadcn CLI)
│   ├── hooks/              # 22 custom React hooks
│   ├── lib/                # 17 utility modules and domain logic
│   ├── types/              # Centralized domain types (smart-tool.ts)
│   ├── integrations/
│   │   └── supabase/       # Supabase client + generated types
│   ├── pages/              # Page components (Index, Privacy, Terms, NotFound, AdminPromptPack)
│   ├── test/               # 20 test files organized by category
│   │   ├── components/     # 6 component tests
│   │   ├── hooks/          # 4 hook tests
│   │   └── lib/            # 7 library tests
│   └── main.tsx            # Application entry point
├── puente-engine/          # Puente Engine — custom ONNX inference engine (workspace: @smart-tool/puente-engine)
├── browser-native-llm/     # Amor inteligente — browser-native LLM engine (workspace: @smart-tool/browser-native-llm)
├── browser-translation/    # Lengua Materna — translation engine (workspace: @smart-tool/lengua-materna)
├── supabase/
│   ├── functions/          # Edge functions (custom-knowledge-base)
│   └── migrations/         # Database migrations
├── docs/                   # Architecture & planning documents
├── public/                 # Static assets, PWA files, prompt-pack.json, retrieval-packs/
├── scripts/                # Build scripts (Python + shell)
└── [config files]          # vite.config.ts, tailwind.config.cjs, etc.
```

## Development Commands

```bash
# Install dependencies (prefer Bun)
bun install
# OR
npm install

# Start development server (port 8080)
bun run dev

# Production build
bun run build

# Development build (with sourcemaps, no console stripping)
bun run build:dev

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Lint code
bun run lint

# Fetch AI models for local hosting (requires Python)
bun run fetch-models

# Validate translation model setup
bun run validate:translation-models
bun run validate:translation-models:offline
```

## Code Conventions

### Path Aliases
Use `@/` alias for imports from `src/`:
```typescript
import { Button } from "@/components/ui/button";
import { useSmartStorage } from "@/hooks/useSmartStorage";
import { checkSmart } from "@/lib/smart-checker";
```

### Component Organization
- **UI Components** (`src/components/ui/`): shadcn/ui components - regenerate with CLI, don't edit manually
- **Smart Components** (`src/components/smart/`): Domain-specific components for the SMART tool
- **Pages** (`src/pages/`): Top-level route components

### Naming Conventions
- Components: PascalCase (`SmartActionTool.tsx`)
- Hooks: camelCase with `use` prefix (`useSmartStorage.ts`)
- Utilities: kebab-case (`smart-checker.ts`)
- Tests: `*.test.ts` or `*.test.tsx` in `src/test/` (mirroring source structure)
- Types: centralized in `src/types/smart-tool.ts`

### localStorage Keys
All localStorage keys are prefixed with `smartTool.`:
```typescript
const STORAGE = {
  barriers: "smartTool.barriers",
  history: "smartTool.history",
  // ... etc
};
```

### Environment Variables
Prefixed with `VITE_` for client-side access:
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
VITE_BASE_PATH=./  # Relative paths for portable builds
```

## Key Files Reference

### Core Domain Logic
| File | Purpose |
|------|---------|
| `src/lib/smart-checker.ts` | SMART criteria analysis — pattern matching, scoring, suggestions |
| `src/lib/smart-patterns.ts` | Pattern definitions for all SMART criteria detection |
| `src/lib/smart-utils.ts` | Comprehensive utility functions for SMART analysis |
| `src/lib/smart-prompts.ts` | AI prompt templates for drafting actions |
| `src/lib/smart-data.ts` | Barrier catalog and timescales data |
| `src/lib/prompt-pack.ts` | Prompt pack loading, caching, and validation |
| `src/lib/smart-retrieval.ts` | Exemplar retrieval system for few-shot AI prompting |
| `src/lib/relevance-checker.ts` | Barrier-to-action relevance scoring |
| `src/lib/smart-highlighter.ts` | Rich text highlighting for SMART criteria in output |
| `src/lib/draft-analytics.ts` | Analytics tracking for AI drafts |
| `src/lib/custom-knowledge-base.ts` | Custom knowledge base integration |

### Hooks (22 total)

#### Core State & AI
| File | Purpose |
|------|---------|
| `src/hooks/useSmartStorage.ts` | localStorage CRUD for history, templates, settings, feedback |
| `src/hooks/useAIDrafting.ts` | AI draft orchestration with LLM picker and feedback |
| `src/hooks/useBrowserNativeLLM.ts` | Local LLM integration via Amor inteligente / Puente Engine |
| `src/hooks/useTranslation.ts` | Translation via Lengua Materna / Puente Engine |
| `src/hooks/usePromptPack.ts` | Central prompt pack loading |
| `src/hooks/useLocalSync.ts` | Data sync with localStorage/IndexedDB |

#### UI & Feature Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useSmartForm.ts` | Form state extraction |
| `src/hooks/useActionOutput.ts` | Output panel state management |
| `src/hooks/useSettings.ts` | Settings panel state |
| `src/hooks/useHistory.ts` | Action history retrieval |
| `src/hooks/useTemplates.ts` | Template library management |
| `src/hooks/useFeedback.ts` | Feedback UI state |
| `src/hooks/useActionAnalytics.ts` | Draft analytics tracking |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcuts (Cmd+E, Cmd+Shift+D, etc.) |
| `src/hooks/usePWA.ts` | PWA installation prompts |
| `src/hooks/useWebGPUSupport.ts` | Browser WebGPU capability detection |
| `src/hooks/useAIConsent.ts` | AI consent tracking |
| `src/hooks/useOnboarding.ts` | Onboarding tutorial state |
| `src/hooks/useDebounce.ts` | Debounce utility |

### Main UI Components
| File | Purpose |
|------|---------|
| `src/components/smart/SmartActionTool.tsx` | Main application component (~1250 lines) |
| `src/components/smart/ActionWizard.tsx` | Guided action creation wizard |
| `src/components/smart/SmartChecklist.tsx` | Real-time SMART criteria checklist |
| `src/components/smart/OutputPanel.tsx` | AI draft output display |
| `src/components/smart/HistoryPanel.tsx` | Action history browser |
| `src/components/smart/SettingsPanel.tsx` | User settings interface |
| `src/components/smart/FloatingToolbar.tsx` | Floating action toolbar |
| `src/components/smart/LLMPickerDialog.tsx` | AI model selection dialog |
| `src/components/smart/PlanPickerDialog.tsx` | Plan selection dialog |
| `src/components/smart/LanguageSelector.tsx` | Translation language picker |
| `src/components/smart/TemplateLibrary.tsx` | Reusable action templates |
| `src/components/smart/HistoryInsights.tsx` | Analytics insights from history |
| `src/components/smart/OnboardingTutorial.tsx` | First-use tutorial |
| `src/components/smart/ActionFeedback.tsx` | Draft quality feedback |
| `src/App.tsx` | Router setup, providers, error boundaries |

### Supporting Files
| File | Purpose |
|------|---------|
| `src/lib/smart-portability.ts` | GDPR data export/import |
| `src/lib/gdpr-consent.ts` | GDPR consent management |
| `src/lib/error-handling.ts` | Error boundary utilities |
| `src/lib/animation-variants.ts` | Framer Motion animation presets |
| `src/lib/smart-tool-shortcuts.ts` | Keyboard shortcut definitions |
| `src/lib/utils.ts` | `cn()` helper for Tailwind class merging |
| `src/types/smart-tool.ts` | Canonical domain types (forms, storage, settings, output) |

## Testing

Tests use Vitest with jsdom environment. All tests are in `src/test/` organized by category:

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Verbose output
bun run test -- --reporter=verbose
```

### Test Structure
```
src/test/
├── setup.ts                              # Test setup (jsdom, mocks)
├── components/                           # Component tests (6 files)
│   ├── SmartActionTool.test.tsx
│   ├── HistoryPanel.test.tsx
│   ├── OutputPanel.test.tsx
│   ├── SmartChecklist.test.tsx
│   ├── ActionWizard.test.tsx
│   └── ComboboxInput.test.tsx
├── hooks/                                # Hook tests (4 files)
│   ├── useSmartStorage.test.ts
│   ├── useTranslation.test.ts
│   ├── useBrowserNativeLLM.test.ts
│   └── useKeyboardShortcuts.test.ts
├── lib/                                  # Library tests (7 files)
│   ├── smart-checker.test.ts
│   ├── smart-utils.test.ts
│   ├── smart-retrieval.test.ts
│   ├── prompt-pack.test.ts
│   ├── relevance-checker.test.ts
│   ├── custom-knowledge-base.test.ts
│   └── barrier-relevance-consistency.test.ts
├── smartPortability.test.ts              # GDPR data portability tests
└── example.test.ts                       # Example/template test
```

Key test patterns:
```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("feature", () => {
  it("does something", () => {
    // Test implementation
  });
});
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/build-static.yml`):
1. **Lint job**: ESLint + TypeScript check
2. **Test job**: Vitest tests
3. **Build job**: Vite production build with:
   - `prompt-pack.json` validation
   - Python 3.12 setup for model scripts
   - Translation model caching (priority models)
   - Supabase secrets injection
   - Build artifact upload for deployment

Additional workflows:
- `apply-zip.yml` — Apply ZIP-based patches
- `merge-cursor-to-main.yml` — Merge automation
- `static.yml` — Static site deployment
- `delete-all-branches.yml` — Branch cleanup

## Important Patterns

### SMART Criteria Checking
The `checkSmart()` function in `src/lib/smart-checker.ts` analyzes text for SMART criteria:
```typescript
const result = checkSmart(actionText, {
  forename: "John",
  barrier: "CV",
  timescale: "2 weeks"
});
// Returns: { specific, measurable, achievable, relevant, timeBound, overallScore, warnings }
```

Pattern definitions are in `src/lib/smart-patterns.ts`:
- `SPECIFIC_PATTERNS`
- `MEASURABLE_PATTERNS`
- `ACHIEVABLE_PATTERNS`
- `RELEVANT_PATTERNS`
- `TIMEBOUND_PATTERNS`
- `BARRIER_KEYWORDS` (for barrier-to-action alignment)

### AI Integration
All AI runs locally in the browser via proprietary engines:
- **Amor inteligente** (`useBrowserNativeLLM`): Browser-native LLM for SMART action planning via Puente Engine
- **Lengua Materna** (`useTranslation`): Browser-native translation via OPUS-MT models and Puente Engine

The AI drafting pipeline (`useAIDrafting`) orchestrates:
1. Prompt assembly from prompt pack + retrieval pack exemplars
2. LLM inference via browser-native engine
3. Output validation and SMART scoring
4. Feedback collection and analytics

### Prompt Pack System
The prompt pack (`public/prompt-pack.json`) is the central configuration for AI behavior:
- System prompts and barrier-specific guidance
- Few-shot examples for each barrier type
- Loaded and cached by `src/lib/prompt-pack.ts`
- Managed via admin UI at `src/pages/AdminPromptPack.tsx`

### Retrieval Packs
Action exemplar libraries (`public/retrieval-packs/job-search-actions.json`) provide few-shot examples:
- Retrieved by `src/lib/smart-retrieval.ts` based on barrier similarity
- Used to improve AI draft quality through relevant examples

### Translation (Lengua Materna Engine)
Translation uses the `@smart-tool/lengua-materna` workspace package (`browser-translation/`), which runs per-language-pair OPUS-MT models locally via the Puente Engine. Key features:
- **15 target languages** (Welsh, Polish, Urdu, Bengali, Arabic, Punjabi, Pashto, Somali, Tigrinya, German, French, Spanish, Italian, Portuguese, Hindi)
- **Per-pair models** (~105-130 MB each, CC-BY-4.0 licensed) instead of one large multilingual model
- **17 built-in dictionaries** for employment domain terminology (`browser-translation/src/dictionaries/`)
- **LRU pipeline management** — max 3 models loaded simultaneously
- **Pivot translation** through English for pairs without a direct model
- **Segment caching** and placeholder preservation
- **Independent from drafting LLM** — translation works even without the local AI module
- Integration hook: `src/hooks/useTranslation.ts` (wraps the engine with React state)

### Data Portability (GDPR)
- `exportAllData()`: Returns all user data as JSON (version 2 format)
- `importData()`: Imports data from export file (handles v1 and v2 formats)
- `deleteAllData()`: Clears all localStorage data
- Consent management: `src/lib/gdpr-consent.ts`

### Keyboard Shortcuts
Defined in `src/lib/smart-tool-shortcuts.ts`, implemented in `src/hooks/useKeyboardShortcuts.ts`:
- `Cmd/Ctrl+E` — Generate AI draft
- `Cmd/Ctrl+Shift+D` — Toggle settings
- Additional shortcuts for navigation and actions

## Workspace Packages

### Puente Engine (`puente-engine/`)
Custom ONNX inference engine shared by both AI modules:
- **Core**: Session management, tensor operations, type definitions
- **Generation**: Causal (autoregressive) and seq2seq generators, KV cache, sampling (temperature, top-k, top-p)
- **Model**: ONNX model loading, LRU caching, config parsing
- **Pipelines**: Text generation and translation pipelines
- **Runtime**: Device selection (WebGPU/WASM), backend management
- **Tokenizer**: BPE tokenization, decoding, normalization

### Browser Native LLM (`browser-native-llm/`)
Amor inteligente — local LLM for SMART action planning:
- **Planner**: SMART action planning logic, prompt assembly, profile normalization
- **Retrieval**: Action exemplar library, barrier catalog, retriever
- **Delivery**: Model caching, chunked loading, Service Worker integration
- **Validators**: JSON repair, schema validation, SMART criteria validation
- **Runtime**: Web Worker implementation, backend selection

### Browser Translation (`browser-translation/`)
Lengua Materna — translation engine:
- **Engine**: Translation orchestration, pipeline management (LRU), text chunking, rule-based fallback
- **Models**: Registry (30 language pairs), pivot translation logic
- **Cache**: Model caching (LRU), translation result caching
- **Dictionaries**: 17 language-pair dictionary files for employment domain terms
- **Runtime**: Web Worker, worker client, backend selection
- **Utils**: RTL language handling

## Supabase Backend

### Edge Functions
| Function | Auth | Purpose |
|----------|------|---------|
| `smart-chat` | No JWT | Chat/AI endpoint |
| `smart-translate` | No JWT | Translation endpoint |
| `custom-knowledge-base` | JWT required | Custom KB CRUD |

### Migrations
- `202602230001_custom_knowledge_base.sql` — Custom knowledge base schema

Configuration: `supabase/config.toml`

## Browser Compatibility

| Browser | Local AI Support |
|---------|-----------------|
| Chrome/Edge (Windows/Linux) | WebGPU (fast) |
| Chrome/Edge (macOS) | WebGPU or WASM |
| Safari (macOS) | WASM |
| Safari (iOS) | WASM (experimental, disabled by default) |
| Firefox | WASM (single-threaded) |
| Android | Not supported |

## Common Tasks

### Adding a new shadcn/ui component
```bash
npx shadcn@latest add [component-name]
```

### Adding a new route
1. Create page in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`:
```typescript
<Route path="/new-page" element={<NewPage />} />
```

### Modifying SMART detection patterns
Edit patterns in `src/lib/smart-patterns.ts` (pattern definitions) and `src/lib/smart-checker.ts` (scoring logic).

### Adding new barriers or timescales
Edit `src/lib/smart-data.ts` to modify the `BARRIER_CATALOG` or `DEFAULT_TIMESCALES`.

### Adding a new hook
1. Create in `src/hooks/useNewHook.ts`
2. Add tests in `src/test/hooks/useNewHook.test.ts`
3. Import with `@/hooks/useNewHook`

### Updating prompt pack
Edit `public/prompt-pack.json` directly or use the admin UI at `/admin/prompt-pack`.

## Troubleshooting

### Build issues
- Ensure Node.js 18+ is installed
- Clear `node_modules` and reinstall: `rm -rf node_modules && bun install`
- Check for TypeScript errors: `bun run tsc --noEmit`

### Local AI not loading
- Check browser console for WebGPU/WASM errors
- Verify `public/models/` directory exists (for self-hosted models)
- Try a different browser (Chrome/Edge have best support)
- Check `useWebGPUSupport` hook output for capability details

### Tests failing
- Ensure test setup is correct in `src/test/setup.ts`
- Run with verbose output: `bun run test -- --reporter=verbose`
- Check that mocks match current API shapes

### Translation models
- Validate setup: `bun run validate:translation-models`
- Offline validation: `bun run validate:translation-models:offline`

## Security Considerations

- No sensitive data in localStorage (local-only, no PII sync)
- Supabase keys are publishable (anon key, RLS-protected)
- AI consent required before cloud features
- GDPR-compliant data handling (export, delete, retention) via `src/lib/gdpr-consent.ts`
- Custom KB endpoint requires JWT authentication
