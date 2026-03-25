# CLAUDE.md - AI Assistant Guide for smart-tool

## Project Overview

**SMART Action Tool** is a React/TypeScript web application that helps employment advisors create SMART (Specific, Measurable, Achievable, Relevant, Time-bound) action plans for job seekers. The app features real-time SMART criteria analysis, AI-powered draft suggestions (local, on-device), translation support, PWA offline capability, and GDPR-compliant data handling.

### Key Domain Concepts
- **SMART Actions**: Goal-setting framework where each action must be Specific, Measurable, Achievable, Relevant, and Time-bound
- **Barriers**: Employment obstacles participants face (e.g., transport, childcare, CV gaps, confidence)
- **Timescales**: Review periods for action plans
- **Participants**: Job seekers working with advisors
- **Prompt Packs**: Curated prompt templates and few-shot examples for AI drafting

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 with TypeScript |
| Build Tool | Vite 5.x |
| Package Manager | Bun (preferred) or npm |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS 3 with CSS variables |
| Animations | Framer Motion |
| State Management | React hooks + TanStack Query |
| Backend | Supabase (authentication) |
| Local AI | @smart-tool/browser-native-llm (Amor inteligente via Puente Engine) |
| Translation | @smart-tool/lengua-materna (Lengua Materna via Puente Engine) |
| Inference Runtime | ONNX Runtime Web |
| Testing | Vitest + Testing Library |
| Linting | ESLint (flat config) with TypeScript support |
| Auth (Azure) | @azure/msal-browser |
| Charts | Recharts |

## Directory Structure

```
smart-tool/
├── src/
│   ├── components/
│   │   ├── smart/              # Domain-specific components (25 files)
│   │   │   ├── SmartActionTool.tsx   # Main application component (~1250 LOC)
│   │   │   ├── ActionWizard.tsx      # Multi-step action creation wizard
│   │   │   ├── ActionFeedback.tsx    # User feedback UI
│   │   │   ├── ComboboxInput.tsx     # Autocomplete combobox input
│   │   │   ├── CookieConsent.tsx     # GDPR cookie consent banner
│   │   │   ├── DebugPanel.tsx        # Developer debug tools
│   │   │   ├── DelightfulError.tsx   # Friendly error display
│   │   │   ├── EmptyState.tsx        # Empty state placeholder
│   │   │   ├── FloatingToolbar.tsx   # Floating action bar
│   │   │   ├── Footer.tsx            # App footer
│   │   │   ├── HistoryInsights.tsx   # History analytics/charts
│   │   │   ├── HistoryPanel.tsx      # Action history panel
│   │   │   ├── LanguageSelector.tsx  # Translation language picker
│   │   │   ├── LLMPickerDialog.tsx   # LLM model selection dialog
│   │   │   ├── OnboardingTutorial.tsx# First-run onboarding flow
│   │   │   ├── OutputPanel.tsx       # Draft output display
│   │   │   ├── PanelErrorBoundary.tsx# Panel-level error boundary
│   │   │   ├── PlanPickerDialog.tsx  # Plan selection dialog
│   │   │   ├── SettingsPanel.tsx     # User settings UI
│   │   │   ├── ShortcutsHelp.tsx     # Keyboard shortcuts reference
│   │   │   ├── SmartChecklist.tsx    # SMART criteria checklist
│   │   │   ├── SmartScoreDetails.tsx # Detailed score breakdown
│   │   │   ├── TemplateLibrary.tsx   # Reusable action templates
│   │   │   ├── WarningBox.tsx        # Warning/info displays
│   │   │   └── WebGPUCheck.tsx       # WebGPU capability detection
│   │   ├── ui/                 # shadcn/ui components (54 files — DO NOT edit, use shadcn CLI)
│   │   ├── NavLink.tsx         # Navigation link component
│   │   └── PWAPrompt.tsx       # PWA install prompt
│   ├── hooks/                  # Custom React hooks (22 files)
│   │   ├── useBrowserNativeLLM.ts  # Local LLM via Amor inteligente / Puente Engine
│   │   ├── useSmartStorage.ts      # localStorage CRUD for all app data
│   │   ├── useTranslation.ts       # Translation via Lengua Materna / Puente Engine
│   │   ├── useAIDrafting.ts        # AI draft generation orchestration
│   │   ├── useAIConsent.ts         # AI consent flow management
│   │   ├── useActionAnalytics.ts   # Action usage analytics
│   │   ├── useActionOutput.ts      # Output formatting and display
│   │   ├── useDebounce.ts          # Input debouncing
│   │   ├── useFeedback.ts          # User feedback collection
│   │   ├── useHistory.ts           # Action history management
│   │   ├── useKeyboardShortcuts.ts # Keyboard shortcut bindings
│   │   ├── useLocalSync.ts         # Local data synchronisation
│   │   ├── useOnboarding.ts        # Onboarding state management
│   │   ├── usePWA.ts               # PWA install/update lifecycle
│   │   ├── usePromptPack.ts        # Prompt pack loading and selection
│   │   ├── useSettings.ts          # User settings state
│   │   ├── useSmartForm.ts         # Form state management
│   │   ├── useTemplates.ts         # Template library CRUD
│   │   ├── useWebGPUSupport.ts     # WebGPU feature detection
│   │   ├── use-mobile.tsx          # Mobile viewport detection
│   │   ├── use-toast.ts            # Toast notification state
│   │   └── storage-utils.ts        # Shared localStorage helpers
│   ├── lib/                    # Utility functions and domain logic (17 files)
│   │   ├── smart-checker.ts        # SMART criteria analysis engine
│   │   ├── smart-data.ts           # Default barriers and timescales
│   │   ├── smart-prompts.ts        # AI prompt templates
│   │   ├── smart-utils.ts          # Domain helper functions
│   │   ├── smart-patterns.ts       # Pattern matching utilities
│   │   ├── smart-highlighter.ts    # Text highlighting for SMART criteria
│   │   ├── smart-retrieval.ts      # RAG/retrieval system
│   │   ├── smart-portability.ts    # GDPR export/import logic
│   │   ├── smart-tool-shortcuts.ts # Keyboard shortcut definitions
│   │   ├── prompt-pack.ts          # Prompt pack management
│   │   ├── custom-knowledge-base.ts# Custom knowledge base support
│   │   ├── relevance-checker.ts    # Barrier-to-action relevance analysis
│   │   ├── draft-analytics.ts      # Draft quality analytics
│   │   ├── error-handling.ts       # Global error handling
│   │   ├── gdpr-consent.ts         # GDPR consent management
│   │   ├── animation-variants.ts   # Framer Motion animation presets
│   │   └── utils.ts                # cn() helper for Tailwind
│   ├── integrations/
│   │   └── supabase/           # Supabase client configuration
│   │       ├── client.ts
│   │       └── types.ts
│   ├── pages/                  # Page components
│   │   ├── Index.tsx               # Main page (lazy loaded)
│   │   ├── Privacy.tsx             # Privacy policy
│   │   ├── Terms.tsx               # Terms of service
│   │   ├── AdminPromptPack.tsx     # Admin panel for prompt packs
│   │   └── NotFound.tsx            # 404 page
│   ├── types/
│   │   └── smart-tool.ts          # Shared TypeScript interfaces
│   ├── test/                   # Test files (20 files)
│   │   ├── setup.ts               # Vitest environment setup + mocks
│   │   ├── components/            # Component tests (6 files)
│   │   ├── hooks/                 # Hook tests (4 files)
│   │   └── lib/                   # Library tests (8 files)
│   └── main.tsx                # Application entry point
├── puente-engine/              # Puente Engine — custom ONNX inference engine (workspace: @smart-tool/puente-engine)
├── browser-native-llm/         # Amor inteligente — browser-native LLM engine (workspace: @smart-tool/browser-native-llm)
├── browser-translation/        # Lengua Materna — translation engine (workspace: @smart-tool/lengua-materna)
├── public/                     # Static assets, PWA files, manifest
│   ├── prompt-pack.json           # Prompt templates and few-shot examples
│   ├── retrieval-packs/           # RAG knowledge base packs
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker
│   └── offline.html               # Offline fallback page
├── scripts/                    # Build and utility scripts
│   ├── fetch-models.py            # Download LLM models
│   ├── fetch-translation-models.py# Download OPUS-MT translation models
│   ├── validate-local-translation-models.py # Validate translation models
│   └── shard-model.py             # Model sharding utility
├── docs/                       # Additional documentation
├── supabase/                   # Supabase configuration
├── .github/workflows/          # CI/CD pipelines
└── [config files]              # vite.config.ts, tailwind.config.cjs, tsconfig.json, etc.
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

# Preview production build
bun run preview

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Lint code
bun run lint

# Fetch AI models for local hosting (requires Python)
bun run fetch-models

# Validate translation models
bun run validate:translation-models

# Validate translation models (offline only)
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

Workspace packages are also aliased in tsconfig:
```typescript
import { ... } from "@smart-tool/browser-native-llm";
import { ... } from "@smart-tool/lengua-materna";
import { ... } from "@smart-tool/puente-engine";
```

### Component Organization
- **UI Components** (`src/components/ui/`): shadcn/ui components — regenerate with CLI, don't edit manually
- **Smart Components** (`src/components/smart/`): Domain-specific components for the SMART tool
- **Pages** (`src/pages/`): Top-level route components

### Naming Conventions
- Components: PascalCase (`SmartActionTool.tsx`)
- Hooks: camelCase with `use` prefix (`useSmartStorage.ts`)
- Utilities: kebab-case (`smart-checker.ts`)
- Tests: `*.test.ts` or `*.test.tsx` (mirror source structure under `src/test/`)

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
Prefixed with `VITE_` for client-side access (see `.env.example`):
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
VITE_BASE_PATH=./  # Relative paths for portable builds
VITE_HF_TOKEN=...  # HuggingFace token (optional, for model downloads)
```

## Key Files Reference

### Core Domain Logic
| File | Purpose |
|------|---------|
| `src/lib/smart-checker.ts` | SMART criteria analysis — pattern matching, scoring, suggestions |
| `src/lib/smart-prompts.ts` | AI prompt templates for drafting actions |
| `src/lib/smart-data.ts` | Default barriers and timescales data |
| `src/lib/smart-utils.ts` | Domain helper functions |
| `src/lib/smart-patterns.ts` | Pattern matching utilities for SMART criteria |
| `src/lib/smart-highlighter.ts` | Text highlighting for SMART criteria matches |
| `src/lib/smart-retrieval.ts` | RAG/retrieval system for context-aware drafting |
| `src/lib/smart-portability.ts` | GDPR-compliant export/import logic |
| `src/lib/prompt-pack.ts` | Prompt pack management and validation |
| `src/lib/relevance-checker.ts` | Barrier-to-action relevance analysis |
| `src/lib/custom-knowledge-base.ts` | Custom knowledge base support |
| `src/lib/draft-analytics.ts` | Draft quality analytics and scoring |

### State Management Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useSmartStorage.ts` | localStorage CRUD for history, templates, settings |
| `src/hooks/useBrowserNativeLLM.ts` | Local LLM via Amor inteligente / Puente Engine |
| `src/hooks/useTranslation.ts` | Translation via Lengua Materna / Puente Engine |
| `src/hooks/useAIDrafting.ts` | AI draft generation orchestration |
| `src/hooks/useAIConsent.ts` | AI consent flow state |
| `src/hooks/useHistory.ts` | Action history management |
| `src/hooks/useTemplates.ts` | Template library CRUD |
| `src/hooks/useSettings.ts` | User settings state |
| `src/hooks/useSmartForm.ts` | Form state management |
| `src/hooks/usePromptPack.ts` | Prompt pack loading and selection |
| `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcut bindings |
| `src/hooks/usePWA.ts` | PWA install/update lifecycle |

### Main UI
| File | Purpose |
|------|---------|
| `src/components/smart/SmartActionTool.tsx` | Main application component (~1250 lines) |
| `src/App.tsx` | Router setup, providers, error boundaries |
| `src/main.tsx` | Entry point with global error handlers |
| `src/types/smart-tool.ts` | Shared TypeScript interfaces |

## Testing

Tests use Vitest with jsdom environment. Test setup is in `src/test/setup.ts` which mocks localStorage, crypto.randomUUID, ResizeObserver, scrollIntoView, and matchMedia.

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Verbose output
bun run test -- --reporter=verbose
```

Test file organisation mirrors source structure:
```
src/test/
├── setup.ts                              # Environment mocks
├── components/
│   ├── SmartActionTool.test.tsx
│   ├── SmartChecklist.test.tsx
│   ├── HistoryPanel.test.tsx
│   ├── OutputPanel.test.tsx
│   ├── ComboboxInput.test.tsx
│   └── ActionWizard.test.tsx
├── hooks/
│   ├── useSmartStorage.test.ts
│   ├── useTranslation.test.ts
│   ├── useKeyboardShortcuts.test.ts
│   └── useBrowserNativeLLM.test.ts
└── lib/
    ├── smart-checker.test.ts
    ├── smart-utils.test.ts
    ├── smart-retrieval.test.ts
    ├── prompt-pack.test.ts
    ├── custom-knowledge-base.test.ts
    ├── relevance-checker.test.ts
    └── barrier-relevance-consistency.test.ts
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
1. **Lint job**: ESLint + TypeScript type check (`tsc --noEmit`)
2. **Test job**: Vitest unit tests
3. **Build job**: Vite production build with:
   - Translation model fetching (with HuggingFace Hub caching)
   - Tailwind glass opacity CI guard
   - Prompt pack validation
   - Build artifact upload and verification

Additional workflows:
- `static.yml` — Static site deployment
- `apply-zip.yml` — Apply zip patches
- `merge-cursor-to-main.yml` — Merge from cursor branch
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

### AI Integration
All AI runs locally in the browser via proprietary engines:
- **Amor inteligente** (`useBrowserNativeLLM`): Browser-native LLM for SMART action planning via Puente Engine
- **Lengua Materna** (`useTranslation`): Browser-native translation via OPUS-MT models and Puente Engine

The AI drafting pipeline is orchestrated by `useAIDrafting`, which coordinates the LLM, prompt packs, and retrieval systems.

### Prompt Packs
Prompt packs (`src/lib/prompt-pack.ts`) provide curated templates and few-shot examples for AI drafting. The default pack lives at `public/prompt-pack.json`. An admin interface at `/admin` (`AdminPromptPack.tsx`) manages prompt packs.

### Translation (Lengua Materna Engine)
Translation uses the `@smart-tool/lengua-materna` workspace package (`browser-translation/`), which runs per-language-pair OPUS-MT models locally via the Puente Engine. Key features:
- **15 target languages** (Welsh, Polish, Urdu, Bengali, Arabic, Punjabi, Pashto, Somali, Tigrinya, German, French, Spanish, Italian, Portuguese, Hindi)
- **Per-pair models** (~105-130 MB each, CC-BY-4.0 licensed) instead of one large multilingual model
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

### PWA Support
The app is a Progressive Web App with:
- Service worker (`public/sw.js`) for offline caching
- Offline fallback page (`public/offline.html`)
- Install prompt component (`src/components/PWAPrompt.tsx`)
- PWA lifecycle hook (`src/hooks/usePWA.ts`)

### Keyboard Shortcuts
Shortcut definitions live in `src/lib/smart-tool-shortcuts.ts`, bound via `src/hooks/useKeyboardShortcuts.ts`, with a help dialog in `src/components/smart/ShortcutsHelp.tsx`.

### Workspace Packages
The monorepo has three workspace packages:

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@smart-tool/puente-engine` | `puente-engine/` | Custom ONNX inference engine (tensors, tokenizer, generation pipelines) |
| `@smart-tool/browser-native-llm` | `browser-native-llm/` | Amor inteligente — browser-native LLM (model loading, planning, validation, workers) |
| `@smart-tool/lengua-materna` | `browser-translation/` | Lengua Materna — OPUS-MT translation (engine, models, caching, dictionaries) |

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
Edit patterns in `src/lib/smart-checker.ts`:
- `SPECIFIC_PATTERNS`
- `MEASURABLE_PATTERNS`
- `ACHIEVABLE_PATTERNS`
- `RELEVANT_PATTERNS`
- `TIMEBOUND_PATTERNS`
- `BARRIER_KEYWORDS` (for barrier-to-action alignment)

### Adding new barriers or timescales
Edit `src/lib/smart-data.ts` to modify `DEFAULT_BARRIERS` or `DEFAULT_TIMESCALES`.

### Adding a new keyboard shortcut
1. Define the shortcut in `src/lib/smart-tool-shortcuts.ts`
2. Bind it in `src/hooks/useKeyboardShortcuts.ts`

## Troubleshooting

### Build issues
- Ensure Node.js 18+ is installed
- Clear `node_modules` and reinstall: `rm -rf node_modules && bun install`
- Check for TypeScript errors: `bun run tsc --noEmit`

### Local AI not loading
- Check browser console for WebGPU/WASM errors
- Verify `public/models/` directory exists (for self-hosted models)
- Try a different browser (Chrome/Edge have best support)

### Tests failing
- Ensure test setup is correct in `src/test/setup.ts`
- Run with verbose output: `bun run test -- --reporter=verbose`

### Cross-Origin Isolation
The dev server sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers for SharedArrayBuffer support (required by ONNX Runtime with multi-threading). The build generates a `_headers` file for Netlify/Cloudflare Pages.

## Security Considerations

- No sensitive data in localStorage (local-only, no PII sync)
- Supabase keys are publishable (anon key, RLS-protected)
- AI consent required before cloud features
- GDPR-compliant data handling (export, delete, retention)
- Cookie consent management via `CookieConsent.tsx` and `gdpr-consent.ts`
