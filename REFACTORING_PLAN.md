# Web App Refactoring Plan

## Overview

This document outlines a safe, incremental refactoring plan for the SMART Action Support Tool. The plan is designed to improve code maintainability, performance, and developer experience **without breaking existing functionality**.

**Key Principle:** Every refactoring step is isolated and testable. Each change should pass all existing tests before moving to the next step.

---

## Current State Analysis

### Codebase Metrics
- **Main component:** `SmartActionTool.tsx` (2,030 lines) - significantly over-sized
- **Tests:** 5 passing tests (2 test files)
- **Build status:** Successful with chunk size warnings
- **Lint status:** 0 errors, 14 warnings (mostly fast-refresh related)
- **Dependencies:** Modern stack (React 18, Vite, TypeScript, shadcn/ui)

### Key Pain Points
1. **Monolithic component** - `SmartActionTool.tsx` handles too many concerns
2. **Duplicated utilities** - `safeRemoveItem` defined in multiple files
3. **Mixed exports** - Components mixed with hooks/utils causing HMR warnings
4. **Bundle size** - Large vendor chunks (LLM: 5.4MB, charts: 400KB)
5. **State complexity** - 25+ useState calls in a single component

---

## Refactoring Phases

### Phase 1: Foundation (Low Risk)

#### 1.1 Extract Shared Utilities
**Goal:** Eliminate code duplication and create a single source of truth.

**Files affected:**
- Create: `src/lib/storage-utils.ts`
- Modify: `src/hooks/useSmartStorage.ts`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Changes:**
```typescript
// src/lib/storage-utils.ts
export function safeSetItem(key: string, value: string): boolean { ... }
export function safeRemoveItem(key: string): boolean { ... }
export function safeGetItem(key: string): string | null { ... }
```

**Testing:** All existing tests should pass unchanged.

---

#### 1.2 Extract Type Definitions
**Goal:** Centralize shared types for better maintainability.

**Files affected:**
- Create: `src/types/smart-tool.ts`
- Modify: `src/hooks/useSmartStorage.ts`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Changes:**
```typescript
// src/types/smart-tool.ts
export type Mode = 'now' | 'future';

export interface NowForm {
  date: string;
  forename: string;
  barrier: string;
  action: string;
  responsible: string;
  help: string;
  timescale: string;
}

export interface FutureForm {
  date: string;
  forename: string;
  task: string;
  outcome: string;
  timescale: string;
}
```

**Testing:** TypeScript compilation and all tests pass.

---

### Phase 2: Component Decomposition (Medium Risk)

#### 2.1 Extract Header Component
**Goal:** Isolate header logic and state.

**Files affected:**
- Create: `src/components/smart/SmartHeader.tsx`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Extract approximately 160 lines** including:
- Theme toggle
- Guidance dialog
- Settings dialog  
- Shortcuts button
- Collapse/expand logic

---

#### 2.2 Extract Form Panels
**Goal:** Separate "Barrier to Action" and "Task-Based" forms.

**Files affected:**
- Create: `src/components/smart/NowForm.tsx`
- Create: `src/components/smart/FutureForm.tsx`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Each form component:**
- Receives form state and callbacks as props
- Handles its own validation display
- Renders advisor assist section

---

#### 2.3 Extract Output Panel
**Goal:** Isolate output display, translation, and SMART check rendering.

**Files affected:**
- Create: `src/components/smart/OutputPanel.tsx`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Includes:**
- Output textarea
- Copy/download buttons
- Translation UI
- SMART checklist integration

---

#### 2.4 Extract History Panel
**Goal:** Separate history/insights tab functionality.

**Files affected:**
- Create: `src/components/smart/HistoryPanel.tsx`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Includes:**
- History list
- Search functionality
- Export/import buttons
- Insights tab integration

---

### Phase 3: State Management (Medium Risk)

#### 3.1 Create Custom Hook for Form State
**Goal:** Consolidate form state management.

**Files affected:**
- Create: `src/hooks/useSmartForm.ts`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Hook signature:**
```typescript
export function useSmartForm(storage: ReturnType<typeof useSmartStorage>) {
  return {
    mode, setMode,
    nowForm, setNowForm, updateNowField,
    futureForm, setFutureForm, updateFutureField,
    output, setOutput,
    outputSource, setOutputSource,
    validateNow, validateFuture,
    generateOutput, handleClear,
    // ... other form-related methods
  };
}
```

---

#### 3.2 Create Custom Hook for Output Actions
**Goal:** Consolidate output-related actions.

**Files affected:**
- Create: `src/hooks/useOutputActions.ts`
- Modify: `src/components/smart/SmartActionTool.tsx`

**Hook signature:**
```typescript
export function useOutputActions(options: {
  output: string;
  translatedOutput: string | null;
  mode: Mode;
  nowForm: NowForm;
  futureForm: FutureForm;
  storage: ReturnType<typeof useSmartStorage>;
}) {
  return {
    handleCopy,
    handleDownload,
    handleSave,
    handleTranslate,
    copied, setCopied,
  };
}
```

---

### Phase 4: Performance Optimization (Low-Medium Risk)

#### 4.1 Optimize Component Memoization
**Goal:** Reduce unnecessary re-renders.

**Changes:**
- Wrap extracted components in `React.memo` where appropriate
- Use `useMemo` for expensive computations
- Use `useCallback` consistently for callbacks passed as props

---

#### 4.2 Improve Code Splitting
**Goal:** Reduce initial bundle size.

**Current large chunks:**
- `vendor-llm`: 5.4MB (already lazy loaded)
- `vendor-charts`: 400KB (already lazy loaded for insights)
- `Index`: 216KB

**Potential improvements:**
- Lazy load `AIImproveDialog`
- Lazy load `ActionWizard`
- Lazy load settings-related dialogs

---

#### 4.3 Fix ESLint Warnings
**Goal:** Eliminate fast-refresh warnings for better DX.

**Pattern to fix:**
```typescript
// Before (warning)
export function CookieConsent() { ... }
export const CONSENT_TYPES = { ... };

// After (no warning)
// constants.ts
export const CONSENT_TYPES = { ... };

// CookieConsent.tsx
import { CONSENT_TYPES } from './constants';
export function CookieConsent() { ... }
```

---

### Phase 5: Testing Enhancement (Low Risk)

#### 5.1 Add Component Tests
**Goal:** Increase confidence for future refactoring.

**New test files:**
- `src/test/smart-checker.test.ts` - Test SMART scoring logic
- `src/test/smart-utils.test.ts` - Test utility functions
- `src/components/smart/__tests__/SmartChecklist.test.tsx` - Component tests

---

#### 5.2 Add Integration Tests
**Goal:** Test complete user flows.

**Test scenarios:**
- Create "Barrier to Action" action
- Create "Task-Based" action
- Save to history
- Export/import data
- AI draft functionality

---

## Implementation Order

### Sprint 1: Foundation (Lowest Risk)
1. ✅ Analyze codebase (DONE)
2. Extract shared utilities (`storage-utils.ts`)
3. Extract type definitions (`types/smart-tool.ts`)
4. Add unit tests for utilities and checker

### Sprint 2: Component Extraction
5. Extract `SmartHeader.tsx`
6. Extract `NowForm.tsx` and `FutureForm.tsx`
7. Extract `OutputPanel.tsx`
8. Extract `HistoryPanel.tsx`

### Sprint 3: State Management
9. Create `useSmartForm.ts` hook
10. Create `useOutputActions.ts` hook
11. Refactor main component to use new hooks

### Sprint 4: Polish
12. Fix ESLint warnings (extract constants)
13. Add lazy loading for more components
14. Optimize memoization
15. Final testing and cleanup

---

## Rollback Strategy

Each phase produces working code that passes all tests. If issues arise:

1. **Git-based rollback:** Each phase is a separate commit
2. **Feature flag option:** Can keep old implementation behind a flag during transition
3. **Incremental deployment:** Deploy after each sprint, monitor for issues

---

## Success Criteria

- [ ] All existing tests pass after each phase
- [ ] No new ESLint errors introduced
- [ ] Build succeeds with no new warnings
- [ ] `SmartActionTool.tsx` reduced to < 500 lines
- [ ] Bundle size for main chunk reduced by 20%+
- [ ] New component test coverage > 60%

---

## Files Created/Modified Summary

### New Files
```
src/lib/storage-utils.ts
src/types/smart-tool.ts
src/hooks/useSmartForm.ts
src/hooks/useOutputActions.ts
src/components/smart/SmartHeader.tsx
src/components/smart/NowForm.tsx
src/components/smart/FutureForm.tsx
src/components/smart/OutputPanel.tsx
src/components/smart/HistoryPanel.tsx
src/test/smart-checker.test.ts
src/test/smart-utils.test.ts
```

### Modified Files
```
src/components/smart/SmartActionTool.tsx (major reduction)
src/hooks/useSmartStorage.ts (import shared utils)
src/components/smart/CookieConsent.tsx (extract constants)
src/components/smart/OnboardingTutorial.tsx (extract constants)
```

---

## Next Steps

To begin implementation, run:
```bash
# Start with Phase 1.1
git checkout -b refactor/phase-1-utilities
```

Then proceed with the first extraction as documented above.
