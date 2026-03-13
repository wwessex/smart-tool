# Refactoring Plan — SMART Action Tool

> Generated: 2026-03-13 | Branch: `claude/refactoring-plans-G1hc4`

## Executive Summary

The SMART Action Tool codebase is functional but has accumulated significant complexity, primarily concentrated in a single ~3,000-line component. This plan identifies **6 refactoring streams** ordered by impact and risk, with each stream broken into discrete, testable steps.

---

## Codebase Health Snapshot

| Metric | Value | Status |
|--------|-------|--------|
| Largest file | `SmartActionTool.tsx` — **2,976 lines** | Critical |
| `useState` calls in one component | **28** | Critical |
| Total `src/` lines | ~22,200 | OK |
| Test coverage areas | hooks, lib, portability | Moderate |
| Component test coverage | **None** (16 `it.todo` stubs, 0 real tests) | Needs attention |
| Number of smart components | 18 files | OK |
| Workspace packages | 3 (puente-engine, browser-native-llm, browser-translation) | Well-structured |
| SMART validator implementations | **3 separate** (inconsistent scoring) | Needs dedup |
| Barrier taxonomy definitions | **4 separate** (fragmented) | Needs dedup |
| `useSmartStorage` domains | **5 in 1 hook** (647 LOC) | Should split |

---

## Stream 1: Break Up SmartActionTool.tsx (Critical — Highest Impact)

**Problem:** `SmartActionTool.tsx` is a 2,976-line God Component with 28 `useState` calls, inline JSX for settings/history/output/form panels, and mixed concerns (form logic, AI drafting, translation, GDPR, Safari memory management).

**Goal:** Split into ~8-12 focused components, each under 300 lines.

### Step 1.1 — Extract Form State into a Custom Hook
- [ ] Create `src/hooks/useSmartForm.ts`
- [ ] Move all `NowForm` / `FutureForm` state, validation, and derived values
- [ ] Move `mode` state and mode-switching logic
- [ ] Move form field change handlers and field class helpers
- [ ] Export a single `useSmartForm()` return object
- **Risk:** Low — pure state extraction, no UI changes
- **Test:** Add unit tests for form validation and state transitions

### Step 1.2 — Extract AI Drafting Logic into a Custom Hook
- [ ] Create `src/hooks/useAIDrafting.ts`
- [ ] Move `aiDrafting`, `pendingAIDraftRef`, `showLLMPicker`, plan picker state
- [ ] Move `handleAIDraft()`, `buildLLMContext()`, `handleWizardAIDraft()`
- [ ] Move Safari auto-unload timer logic
- [ ] Move feedback state (`feedbackRating`, `showFeedbackUI`, `resetFeedbackState`)
- **Risk:** Medium — touches LLM hook and async flows
- **Test:** Unit tests for draft trigger conditions and Safari unload scheduling

### Step 1.3 — Extract Output & Translation Logic
- [ ] Create `src/hooks/useActionOutput.ts`
- [ ] Move `output`, `outputSource`, `translatedOutput`, `translatedForOutputRef`
- [ ] Move `handleCopy()`, `handleSaveToHistory()`, output building logic
- [ ] Move SMART check computation (`checkSmart` call and `smartResult` memo)
- **Risk:** Low — mostly derived state
- **Test:** Test output building for now/future modes

### Step 1.4 — Extract Settings Panel Component
- [ ] Create `src/components/smart/SettingsPanel.tsx`
- [ ] Move the entire Settings dialog JSX (~600 lines, roughly lines 1250-1950)
- [ ] Includes: barriers/timescales editor, AI model picker, theme selector, data management, privacy settings, retention settings
- [ ] Props: `storage`, `llm`, `translation` hooks + open/close state
- **Risk:** Low — purely presentational extraction
- **Test:** Snapshot or interaction tests for key settings flows

### Step 1.5 — Extract History Panel Component
- [ ] Create `src/components/smart/HistoryPanel.tsx`
- [ ] Move history list JSX, search, tabs (history/insights), history item rendering
- [ ] Move `historySearch`, `historyTab`, `filteredHistory` state
- [ ] Currently ~400 lines of inline JSX
- **Risk:** Low — read-only presentation
- **Test:** Test search filtering, empty state

### Step 1.6 — Extract Form Panel Components
- [ ] Create `src/components/smart/NowFormPanel.tsx` — the "Record Now" form
- [ ] Create `src/components/smart/FutureFormPanel.tsx` — the "Plan Future" form
- [ ] Move respective form field JSX, suggestion dropdowns, validation display
- [ ] Use the extracted `useSmartForm` hook
- **Risk:** Low — presentational
- **Test:** Render tests with validation states

### Step 1.7 — Extract Output Display Component
- [ ] Create `src/components/smart/OutputPanel.tsx`
- [ ] Move output textarea, SMART checklist display, copy/save buttons
- [ ] Move translation display and translate button
- [ ] Move feedback UI section
- **Risk:** Low
- **Test:** Test copy, translation display toggle

### Step 1.8 — Extract LLM Picker Dialog
- [ ] Create `src/components/smart/LLMPickerDialog.tsx`
- [ ] Move the model selection dialog JSX (~200 lines)
- [ ] Currently embedded inside the main component's return
- **Risk:** Low
- **Test:** Basic render test

### Post-Stream 1 Target
After all steps, `SmartActionTool.tsx` should be **~200-300 lines** — a thin orchestrator that:
1. Calls the custom hooks
2. Composes the extracted panel components
3. Manages top-level layout and routing between panels

---

## Stream 2: Consolidate State Management (Medium Impact)

**Problem:** 28 `useState` calls with no reducer or context pattern. Related state is scattered (e.g., feedback has 3 separate states, form has 2 objects + several booleans).

### Step 2.1 — Group Related State with useReducer
- [ ] Convert form state to `useReducer` in `useSmartForm`
- [ ] Convert UI panel state (settings/history/shortcuts open flags) to a `useReducer`
- [ ] Convert AI drafting state to `useReducer` in `useAIDrafting`
- **Benefit:** Eliminates impossible state combinations, makes transitions explicit

### Step 2.2 — Create a SmartToolContext (Optional)
- [ ] If prop-drilling becomes excessive after Stream 1, introduce a context
- [ ] Context should wrap `useSmartForm` + `useActionOutput` + `useAIDrafting`
- [ ] Only do this if 3+ components need the same data
- **Risk:** Over-engineering if components are well-composed — evaluate after Stream 1

---

## Stream 3: Improve Test Coverage (Medium Impact)

**Problem:** Tests exist for hooks and lib utilities, but zero component-level tests. The main component is untestable in its current form.

### Step 3.1 — Add Component Tests (Post-Stream 1)
- [ ] Add tests for each extracted component (SettingsPanel, HistoryPanel, etc.)
- [ ] Use Testing Library's render + user-event for interaction tests
- [ ] Priority: SettingsPanel (data management), OutputPanel (copy/save), NowFormPanel (validation)

### Step 3.2 — Add Integration Test for Main Flow
- [ ] Test: fill form → generate output → check SMART score → save to history
- [ ] Mock `useBrowserNativeLLM` for AI draft flow test
- [ ] Test: import/export round-trip

### Step 3.3 — Improve Hook Test Coverage
- [ ] `useBrowserNativeLLM` — test Safari unload scheduling (after extraction)
- [ ] `useTranslation` — test pivot translation flow
- [ ] `useLocalSync` — test sync conflict resolution

---

## Stream 4: Code Quality & Cleanup (Low-Medium Impact)

### Step 4.1 — Remove Dead Code and Consolidate Imports
- [ ] `SmartActionTool.tsx` has scattered imports (line 45 after the InsightsSkeleton, line 78 after the safeRemoveItem function) — consolidate all imports at the top
- [ ] Audit for unused imports after component extraction
- [ ] Remove commented-out code (e.g., line 24: `// AIImproveDialog removed`)

### Step 4.2 — Extract Animation Constants
- [ ] Create `src/lib/animation-variants.ts`
- [ ] Move `fadeInUp`, `staggerContainer`, `slideInLeft`, `slideInRight`, `springTransition`, `softSpring`
- [ ] Share across components that need consistent animations

### Step 4.3 — Type Safety Improvements
- [ ] Create dedicated type file `src/types/smart-tool.ts` for shared interfaces
- [ ] Move `NowForm`, `FutureForm`, `Mode` types out of the component file
- [ ] Add stricter typing for the storage hook's return object

### Step 4.4 — Reduce Bundle Size
- [ ] Audit lucide-react imports (line 85 imports **30 icons** in one line)
- [ ] Ensure tree-shaking works (Vite should handle this, but verify)
- [ ] Consider lazy-loading the Settings panel (it's heavy with all the AI model logic)

---

## Stream 5: Architecture Improvements (Lower Priority)

### Step 5.1 — Extract Domain Logic from Components
- [ ] `handleSaveToHistory` contains business logic for constructing history items — move to a service/utility
- [ ] `buildNowOutput` / `buildFutureOutput` are called with form data + formatting — ensure these stay in `smart-utils.ts` (already done, verify)

### Step 5.2 — Error Boundary Granularity
- [ ] Add error boundaries around each major panel (Settings, History, Output, AI Draft)
- [ ] Currently `DelightfulError` exists but may only wrap top-level

### Step 5.3 — Performance Optimization
- [ ] Profile re-renders — with 28 `useState` calls, any state change re-renders the entire 3K-line component
- [ ] After extraction, verify each sub-component only re-renders when its props change
- [ ] Add `React.memo()` to heavy child components (HistoryPanel, SettingsPanel)
- [ ] Consider `useDeferredValue` for history search filtering

---

## Stream 6: Deduplicate Cross-Package Logic (Medium Impact)

**Problem:** SMART criteria validation and barrier taxonomy are defined independently in multiple places, leading to inconsistent scoring and fragile maintenance.

### Step 6.1 — Unify SMART Criteria Patterns

Three separate implementations exist today:

| Location | What it defines | Used by |
|----------|----------------|---------|
| `src/lib/smart-checker.ts` | `SPECIFIC_PATTERNS`, `MEASURABLE_PATTERNS`, etc. | Frontend SMART score display |
| `browser-native-llm/validators/smart-validator.ts` | Own `SPECIFIC_VERBS`, `checkSpecific()`, `checkMeasurable()` | Post-generation validation |
| `browser-native-llm/relevance/barrier-relevance.ts` | `evaluateBarrierRelevance()` | Relevance scoring |

**Impact:** An action rated 4/5 by the frontend checker might score 3/5 in the LLM validator because patterns differ.

- [ ] Create `src/lib/smart-patterns.ts` as the canonical pattern source
- [ ] Export all pattern arrays: `SPECIFIC_PATTERNS`, `MEASURABLE_PATTERNS`, `ACHIEVABLE_PATTERNS`, `RELEVANT_PATTERNS`, `TIMEBOUND_PATTERNS`, `WEAK_PATTERNS`, `STRONG_VERB_PATTERN`
- [ ] Update `smart-checker.ts` to import from `smart-patterns.ts`
- [ ] Update `browser-native-llm/validators/smart-validator.ts` to import from `smart-patterns.ts` (or from the main package)
- **Risk:** Medium — cross-package change, needs careful testing
- **Test:** Verify both checkers produce identical scores for the same input

### Step 6.2 — Consolidate Barrier Taxonomy

Four separate barrier definitions exist today:

| Location | What it defines |
|----------|----------------|
| `src/lib/smart-data.ts` → `DEFAULT_BARRIERS` | Barrier names (strings) |
| `src/lib/smart-data.ts` → `BARRIER_CATEGORIES` | Name → category mapping |
| `src/lib/smart-data.ts` → `BARRIER_KEYWORDS` | Category → keyword arrays |
| `browser-native-llm/barrier-catalog.ts` → `BARRIER_CATALOG` | Rich entries (id, label, aliases, category, tags, prompt_hints) |

- [ ] Designate `BARRIER_CATALOG` in browser-native-llm as the single source of truth
- [ ] Derive `DEFAULT_BARRIERS`, `BARRIER_CATEGORIES`, and `BARRIER_KEYWORDS` from the catalog
- [ ] Or: move the canonical catalog into `src/lib/` and have browser-native-llm import it
- [ ] Remove redundant definitions
- **Risk:** Medium — touches both frontend and LLM package
- **Test:** Verify barrier classification and keyword matching still works identically

### Step 6.3 — Split useSmartStorage (647 LOC, 5 Domains)

`useSmartStorage.ts` manages 13 localStorage keys across 5 unrelated domains:

| Domain | Responsibility |
|--------|---------------|
| History | CRUD, retention, cleanup, export |
| Templates | Save/load action templates |
| Settings | 7+ boolean/string preferences |
| Feedback | AI quality ratings, analytics |
| Data portability | Import/export (GDPR) |

- [ ] Create `src/hooks/useHistory.ts` — history CRUD + retention + cleanup
- [ ] Create `src/hooks/useTemplates.ts` — template CRUD
- [ ] Create `src/hooks/useSettings.ts` — preferences read/write
- [ ] Create `src/hooks/useFeedback.ts` — feedback storage + ratings
- [ ] Keep `useSmartStorage.ts` as a facade that composes the four hooks (for backward compatibility during transition)
- **Risk:** Low-Medium — existing tests cover the current hook well
- **Test:** Migrate existing `useSmartStorage.test.ts` tests to the split hooks

---

## Recommended Execution Order

```
Phase 1 (Foundation):     Stream 1, Steps 1.1–1.3 (extract hooks)
Phase 2 (UI Extraction):  Stream 1, Steps 1.4–1.8 (extract components)
Phase 3 (Stabilize):      Stream 3, Steps 3.1–3.2 (add tests)
Phase 4 (Dedup):          Stream 6 (unify patterns, barrier taxonomy, split storage hook)
Phase 5 (Polish):         Stream 4 (cleanup) + Stream 2 (state consolidation)
Phase 6 (Optional):       Stream 5 (architecture improvements)
```

Each phase should be a separate PR. Each step within a phase can be a separate commit.

---

## Risk Assessment

| Stream | Risk | Mitigation |
|--------|------|------------|
| Stream 1 (Component split) | Medium — regressions in UI behavior | Extract one piece at a time, manual test each step |
| Stream 2 (State consolidation) | Low-Medium — logic changes | Do after Stream 1 when pieces are isolated |
| Stream 3 (Tests) | Low — additive only | N/A |
| Stream 4 (Cleanup) | Low — cosmetic | Lint + build verification |
| Stream 5 (Architecture) | Low — incremental | Optional, skip if not needed |
| Stream 6 (Deduplication) | Medium — cross-package | Verify scoring consistency with tests |

---

## Definition of Done

- [ ] `SmartActionTool.tsx` is under 400 lines
- [ ] No file in `src/components/smart/` exceeds 500 lines
- [ ] All extracted hooks have unit tests
- [ ] All extracted components have at least basic render tests
- [ ] `bun run build` succeeds with no new warnings
- [ ] `bun run test` passes
- [ ] `bun run lint` passes
- [ ] No visual regressions (manual check of all panels)
