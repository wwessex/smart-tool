# Test Coverage Analysis

## Executive Summary

The Smart Tool codebase has **minimal test coverage** with only 2 test files covering approximately 2% of the 101 source files. While the testing infrastructure (Vitest, Testing Library, CI/CD integration) is well-configured, there are significant gaps that should be addressed to ensure code quality and maintainability.

| Category | Source Files | Test Coverage | Risk Level |
|----------|--------------|---------------|------------|
| Components | 67 | 0% | High |
| Hooks | 13 | ~8% (1 partially tested) | High |
| Library/Utils | 11 | ~9% (1 tested) | High |
| Pages | 5 | 0% | Medium |
| Integrations | 2 | 0% | Medium |

---

## Current Test Coverage

### What's Tested

1. **`smart-portability.ts`** - Data import/export functionality
   - Parsing v1 and v2 export formats
   - Round-trip data integrity
   - Backward compatibility

2. **`useSmartStorage` hook** - Partial integration test
   - Import/export data flow

### What's Missing

The following critical areas have **zero test coverage**:

---

## Priority 1: High-Impact Pure Functions (Easy Wins)

These modules contain complex business logic with no external dependencies, making them ideal candidates for unit testing.

### 1. `smart-checker.ts` (435 lines) - **Critical**

This is the core SMART criteria validation engine. Testing this module would provide high value.

**Functions to test:**
- `checkSmart()` - Main validation function with 5 criteria checks
- `hasWeakLanguage()` - Weak language detection
- `checkBarrierAlignment()` - Barrier-to-action keyword matching
- `getSmartLabel()` / `getSmartColor()` - Score-based labeling
- `getImprovementPriority()` - Prioritized improvement suggestions
- Cache functions (`clearSmartCache`, `getSmartCacheStats`)

**Test cases needed:**
```typescript
describe('checkSmart', () => {
  it('scores 5/5 for fully SMART action')
  it('detects missing specific criteria (who, what, where)')
  it('detects weak language and adds warnings')
  it('validates barrier alignment with keywords')
  it('handles edge cases (empty text, null meta)')
  it('caches results correctly')
})
```

**Estimated effort:** 2-3 hours for comprehensive coverage

### 2. `smart-utils.ts` (439 lines) - **Critical**

Contains date formatting, text processing, and action generation logic.

**Functions to test:**
- `todayISO()` - Date formatting
- `formatDDMMMYY()` - Date display formatting
- `parseTimescaleToTargetISO()` - Timescale parsing (weeks, months)
- `pickLibraryKey()` - Barrier keyword matching with fuzzy logic
- `resolvePlaceholders()` - Template variable substitution
- `buildNowOutput()` / `buildFutureOutput()` - SMART text generation
- `formatTaskOutcome()` - Outcome text formatting
- `aiDraftNow()` / `aiDraftFuture()` - AI draft generation

**Test cases needed:**
```typescript
describe('parseTimescaleToTargetISO', () => {
  it('parses "2 weeks" correctly')
  it('parses "3 months" correctly')
  it('handles month boundary overflow')
  it('returns base date for empty timescale')
})

describe('pickLibraryKey', () => {
  it('finds exact barrier matches')
  it('finds partial matches')
  it('finds semantic matches')
  it('handles fuzzy variations')
})

describe('buildNowOutput', () => {
  it('builds correct SMART action text')
  it('removes redundant phrases like "John will John will"')
  it('formats dates correctly')
})
```

**Estimated effort:** 2-3 hours

---

## Priority 2: Core Custom Hooks

### 3. `useSmartStorage.ts` (522 lines) - **Partially Tested**

The most complex hook, handling all localStorage operations.

**Additional test cases needed:**
```typescript
describe('useSmartStorage', () => {
  describe('history management', () => {
    it('adds items to history with max 100 limit')
    it('deletes items from history')
    it('clears all history')
  })

  describe('retention cleanup', () => {
    it('deletes items older than retention days')
    it('respects retentionEnabled flag')
    it('runs cleanup once per day')
  })

  describe('template management', () => {
    it('adds templates with max 50 limit')
    it('updates templates')
    it('deletes templates')
  })

  describe('GDPR operations', () => {
    it('exports all data in correct format')
    it('deletes all data completely')
  })

  describe('settings', () => {
    it('validates minScoreThreshold range (1-5)')
    it('validates retentionDays range (7-365)')
    it('handles localStorage quota errors')
  })
})
```

**Estimated effort:** 2-3 hours

### 4. `useTransformersLLM.ts` (854 lines) - **High Complexity**

Browser-based LLM integration with WebGPU/WASM fallback.

**Functions to test:**
- `detectBrowser()` - Browser detection
- `detectDevice()` - Mobile/desktop detection
- `getBrowserOptimizations()` - Browser-specific config
- `checkIsMobile()` - Mobile device check

**Test cases needed:**
```typescript
describe('detectBrowser', () => {
  it('detects Chrome')
  it('detects Safari')
  it('detects Firefox')
  it('detects Edge')
})

describe('getBrowserOptimizations', () => {
  it('prefers WebGPU on Chrome Windows')
  it('uses WASM on Safari')
  it('reduces threads on Firefox')
})

describe('useTransformersLLM', () => {
  it('blocks Android devices')
  it('blocks iOS by default')
  it('allows iOS with experimental flag')
  it('handles model loading errors gracefully')
})
```

**Estimated effort:** 3-4 hours (needs mocking)

### 5. `useTranslation.ts` - **Medium Priority**

**Test cases:**
- Translation state management
- Language selection
- Local translation fallback

### 6. `useKeyboardShortcuts.ts` - **Medium Priority**

**Test cases:**
- Shortcut registration/unregistration
- Key combination detection
- Event handling

---

## Priority 3: React Components

### Component Testing Strategy

Given the large number of components (67), prioritize testing:

1. **Business logic components** (`src/components/smart/`)
2. **Components with complex state** (forms, wizards)
3. **Components with user interactions** (buttons, inputs)

### 7. `SmartActionTool.tsx` - **Core Component**

The main application component. Test:
- Form submissions
- Mode switching (now/future)
- Score calculation integration
- Clipboard operations

### 8. `SmartChecklist.tsx` - **User-Facing**

SMART criteria display. Test:
- Renders all 5 criteria
- Shows correct met/unmet states
- Displays suggestions

### 9. `ActionWizard.tsx` - **Complex Form**

Multi-step form wizard. Test:
- Step navigation
- Form validation
- Data persistence between steps

### 10. `ComboboxInput.tsx` - **Reusable**

Autocomplete input. Test:
- Filtering options
- Selection handling
- Keyboard navigation

### 11. `AIImproveDialog.tsx` - **AI Integration**

AI improvement dialog. Test:
- Dialog open/close
- Loading states
- Error handling

---

## Priority 4: Integration Tests

### 12. End-to-End Workflows

Using Testing Library's render approach:

```typescript
describe('Create SMART action workflow', () => {
  it('allows user to create a valid SMART action')
  it('shows validation errors for incomplete actions')
  it('saves action to history')
  it('copies action to clipboard')
})

describe('Import/Export workflow', () => {
  it('exports data in correct format')
  it('imports v1 format data')
  it('imports v2 format data')
  it('handles invalid import files')
})
```

---

## Recommended Test File Structure

```
src/
├── test/
│   ├── setup.ts                    # Existing
│   ├── example.test.ts             # Existing (can remove)
│   ├── smartPortability.test.ts    # Existing
│   │
│   ├── lib/
│   │   ├── smart-checker.test.ts   # NEW - Priority 1
│   │   ├── smart-utils.test.ts     # NEW - Priority 1
│   │   └── localTranslator.test.ts # NEW - Priority 3
│   │
│   ├── hooks/
│   │   ├── useSmartStorage.test.ts # EXPAND - Priority 2
│   │   ├── useTransformersLLM.test.ts # NEW - Priority 2
│   │   ├── useTranslation.test.ts  # NEW - Priority 2
│   │   └── useKeyboardShortcuts.test.ts # NEW - Priority 3
│   │
│   └── components/
│       ├── SmartActionTool.test.tsx # NEW - Priority 3
│       ├── SmartChecklist.test.tsx  # NEW - Priority 3
│       └── ComboboxInput.test.tsx   # NEW - Priority 3
```

---

## Implementation Roadmap

### Phase 1: Foundation (1-2 days)
- [ ] Add tests for `smart-checker.ts` (highest value)
- [ ] Add tests for `smart-utils.ts` date/text functions
- [ ] Expand `useSmartStorage.ts` tests

### Phase 2: Hooks (2-3 days)
- [ ] Add browser/device detection tests
- [ ] Add `useTransformersLLM` state tests (with mocks)
- [ ] Add `useTranslation` tests
- [ ] Add `useKeyboardShortcuts` tests

### Phase 3: Components (3-5 days)
- [ ] Add `SmartChecklist` render tests
- [ ] Add `ComboboxInput` interaction tests
- [ ] Add `ActionWizard` form tests
- [ ] Add `SmartActionTool` integration tests

### Phase 4: E2E (2-3 days)
- [ ] Consider adding Playwright for full E2E tests
- [ ] Add workflow integration tests

---

## Quick Wins

If time is limited, focus on these **high-value, low-effort** tests:

1. **`smart-checker.ts`** - Core validation logic, pure functions, no mocking needed
2. **`smart-utils.ts` date functions** - Critical for timescale calculations
3. **`useSmartStorage` retention cleanup** - Data integrity concern
4. **`pickLibraryKey()` barrier matching** - Complex fuzzy logic

---

## Testing Tools Already Configured

- **Vitest** - Test runner
- **@testing-library/react** - Component testing
- **@testing-library/jest-dom** - DOM matchers
- **jsdom** - Browser environment
- **CI/CD** - Tests run on every PR via GitHub Actions

---

## Metrics to Track

Current state:
- Test files: 2
- Source files: 101
- Coverage: ~2%

Target state (Phase 1 complete):
- Test files: 5+
- Coverage: ~15-20% (by critical path)

Long-term goal:
- Test files: 15+
- Coverage: 40-60% (focused on business logic)
