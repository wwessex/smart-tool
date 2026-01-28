# CLAUDE.md - AI Assistant Guide for smart-tool

## Project Overview

**SMART Action Tool** is a React/TypeScript web application that helps employment advisors create SMART (Specific, Measurable, Achievable, Relevant, Time-bound) action plans for job seekers. The app features real-time SMART criteria analysis, AI-powered draft suggestions (both local and cloud-based), translation support, and GDPR-compliant data handling.

### Key Domain Concepts
- **SMART Actions**: Goal-setting framework where each action must be Specific, Measurable, Achievable, Relevant, and Time-bound
- **Barriers**: Employment obstacles participants face (e.g., transport, childcare, CV gaps, confidence)
- **Timescales**: Review periods for action plans
- **Participants**: Job seekers working with advisors

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 with TypeScript |
| Build Tool | Vite 5.x |
| Package Manager | Bun (preferred) or npm |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS with CSS variables |
| State Management | React hooks + TanStack Query |
| Backend | Supabase (Edge Functions for AI) |
| Local AI | @huggingface/transformers (WebGPU/WASM) |
| Testing | Vitest + Testing Library |
| Linting | ESLint with TypeScript support |

## Directory Structure

```
smart-tool/
├── src/
│   ├── components/
│   │   ├── smart/          # Domain-specific components (SmartActionTool, LLMChat, etc.)
│   │   └── ui/             # shadcn/ui components (DO NOT edit directly - use shadcn CLI)
│   ├── hooks/              # Custom React hooks
│   │   ├── useCloudAI.ts       # Cloud AI via Supabase
│   │   ├── useTransformersLLM.ts # Local browser-based AI
│   │   ├── useSmartStorage.ts  # localStorage management
│   │   └── useTranslation.ts   # Translation support
│   ├── lib/                # Utility functions and domain logic
│   │   ├── smart-checker.ts    # SMART criteria analysis engine
│   │   ├── smart-data.ts       # Default barriers/timescales
│   │   ├── smart-prompts.ts    # AI prompt templates
│   │   └── utils.ts            # cn() helper for Tailwind
│   ├── integrations/
│   │   └── supabase/       # Supabase client configuration
│   ├── pages/              # Page components (Index, Privacy, Terms, Admin)
│   ├── test/               # Test files and setup
│   └── main.tsx            # Application entry point
├── supabase/
│   └── functions/          # Supabase Edge Functions
│       ├── smart-chat/     # Cloud AI chat endpoint
│       └── smart-translate/ # Translation endpoint
├── public/                 # Static assets, PWA files, manifest
├── scripts/                # Build scripts (fetch-models.py)
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
- Utilities: camelCase (`smart-checker.ts`)
- Tests: `*.test.ts` or `*.test.tsx`

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
| `src/lib/smart-checker.ts` | SMART criteria analysis - pattern matching, scoring, suggestions |
| `src/lib/smart-prompts.ts` | AI prompt templates for drafting actions |
| `src/lib/smart-data.ts` | Default barriers and timescales data |

### State Management
| File | Purpose |
|------|---------|
| `src/hooks/useSmartStorage.ts` | localStorage CRUD for history, templates, settings |
| `src/hooks/useCloudAI.ts` | Streaming chat via Supabase Edge Functions |
| `src/hooks/useTransformersLLM.ts` | Local LLM with WebGPU/WASM fallback |

### Main UI
| File | Purpose |
|------|---------|
| `src/components/smart/SmartActionTool.tsx` | Main application component (~1000 lines) |
| `src/components/smart/LLMChat.tsx` | AI chat interface |
| `src/App.tsx` | Router setup, providers, error boundaries |

## Testing

Tests use Vitest with jsdom environment:
```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch
```

Test files location: `src/test/`

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
3. **Build job**: Vite production build with model download

Build artifacts are uploaded for deployment.

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
Two modes of AI operation:
1. **Cloud AI** (`useCloudAI`): Streams responses via Supabase Edge Function
2. **Local AI** (`useTransformersLLM`): Browser-based LLM using WebGPU or WASM fallback

### Data Portability (GDPR)
- `exportAllData()`: Returns all user data as JSON (version 2 format)
- `importData()`: Imports data from export file (handles v1 and v2 formats)
- `deleteAllData()`: Clears all localStorage data

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

## Security Considerations

- No sensitive data in localStorage (local-only, no PII sync)
- Supabase keys are publishable (anon key, RLS-protected)
- AI consent required before cloud features
- GDPR-compliant data handling (export, delete, retention)
