# Duplication Remediation Plan for PR #240

> **🔴 CURRENT STATUS: REVISED v2.0 - See Change History at bottom**

## Executive Summary

PR #240 has **16.7% duplication on new code** (failing quality gate of ≤3%). The primary culprit is `tests/backend-api/assignmentDefinitionPartials.unit.test.js` (2730 lines) with **369 duplicated lines across 15 blocks** identified by SonarQube. **Actual pattern-based duplication is higher: ~450-650 lines** (17-24% of the test file).

**🔴 CRITICAL FINDING**: Four generic test helper functions already exist in `tests/helpers/assignmentDefinitionPartialsTestHelpers.js` (336 lines) but are **completely unused** in the main test file. These were created precisely for this purpose but were never adopted.

**📊 REVISED ESTIMATES**:

- **Conservative target**: ~651 lines (24% reduction)
- **Optimistic potential**: ~1036 lines (38% reduction)
- **Quality gate impact**: From 16.7% to well below 3% threshold (likely < 1%)

**⚠️ IMPORTANT REVISIONS** from original plan:

1. Existing helpers are **unused** - major immediate opportunity
2. Phasing changed from 4 to 5 phases
3. Helper signature mismatches identified - restructuring required
4. Special test patterns need custom handling
5. Cognitive complexity fix simplified (inline vs extraction)
6. More conservative and accurate LOC estimates

---

## Quick Reference Table

| #          | Sonar Block            | Lines                                 | Type                          | Consolidation                                | Helper to Use                                | LOC Savings                  | Status                        |
| ---------- | ---------------------- | ------------------------------------- | ----------------------------- | -------------------------------------------- | -------------------------------------------- | ---------------------------- | ----------------------------- |
| 1          | Block 1                | 873-921 ↔ 945-990                     | 50 lines                      | Describe setup                               | `describeWithAssignmentDefinitionController` | 66 lines                     | ✅ Existing helper unused     |
| 2          | Block 2                | 887-921 ↔ 892-926 ↔ 956-990           | 35-45 lines                   | Binary function tests                        | `runBinaryFunctionTest`                      | 100 lines                    | ✅ Existing helper unused     |
| 3          | Block 3                | 1001-1021 ↔ 1029-1046                 | 21 lines                      | ISO date tests                               | `runBinaryFunctionTest`                      | 42 lines                     | ✅ Existing helper unused     |
| 4          | Block 4                | 1120-1179 ↔ 1127-1186                 | 60 lines                      | validateSafeTrimmedIdentifier\_              | Special handling required                    | 0 lines                      | ⚠️ Has local variable setup   |
| 5          | Block 5                | 1427-1481 ↔ 1434-1488                 | 55 lines                      | validateReadParameters\_                     | `runThrowingValidationTest` (enhanced)       | 110 lines                    | ⚠️ Has return value assertion |
| 6          | Block 6                | 1718-1749 ↔ 1754-1785                 | 32 lines                      | validateYearGroupKeyedFields\_               | `runThrowingValidationTest`                  | 64 lines                     | ✅ Direct pattern match       |
| 7          | Block 7                | 2291-2322 ↔ 2298-2329                 | 32 lines                      | validateUpsertParameters\_                   | `runThrowingValidationTest`                  | 64 lines                     | ✅ Direct pattern match       |
| Additional | ~22 describe blocks    | Various                               | Repeated setup pattern        | `describeWithAssignmentDefinitionController` | 66 lines                                     | ✅ Existing helper unused    |
| Additional | buildValidUpsertParams | Lines 1908-1915, 2301-2309, 2510-2518 | Duplicate function definition | Use helper at line 307                       | 25 lines                                     | ❓ Verify actual duplication |

**Total from Sonar blocks: ~369 lines**
**Total from pattern repetition: ~450-650 lines**

---

## 1. Critical Findings from Code Review

### 1.1 Existing Helpers Are Unused (PRIORITY: CRITICAL)

The following helper functions exist in `tests/helpers/assignmentDefinitionPartialsTestHelpers.js` but are **NOT imported or used** in `assignmentDefinitionPartials.unit.test.js`:

- **`describeWithAssignmentDefinitionController(title, testFn)`** (line 115) - Wraps describe blocks with automatic hook setup
- **`runBinaryFunctionTest({ functionName, testCases })`** (line 207) - For functions returning true/false
- **`runThrowingValidationTest({ setup, func, testCases, method, expectDetails })`** (line 221) - For validation functions that throw ApiValidationError
- **`runSimpleValidationTest({ functionName, testCases, method, hasRowIndex, hasFieldName })`** (line 252) - For simple single-parameter validators

**Verification**: Grep search confirmed zero references to these functions in any `.test.js` files.

**Impact**: ~450-500 lines of duplication could be eliminated **immediately** by adopting these existing helpers.

---

### 1.2 Helper Signature Mismatch with `describeWithAssignmentDefinitionController` (PRIORITY: HIGH)

**Current helper implementation** (line 115):

```javascript
export function describeWithAssignmentDefinitionController(title, testFn) {
  describe(title, () => {
    const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
    beforeEach(beforeEachHandler);
    afterEach(afterEachHandler);
    testFn(); // <--  testFn is called, not passed through
  });
}
```

**Required usage pattern**:

```javascript
// BEFORE:
describe('validateDefinitionKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([...])('...', ({ ... }) => { ... });
});

// AFTER:
describeWithAssignmentDefinitionController('validateDefinitionKey_', () => {
  it.each([...])('...', ({ ... }) => { ... });
});
```

**Action Required**: Code must be **restructured** (not just search/replaced). Move all test code inside the callback function.

---

### 1.3 Special Test Patterns Require Helper Enhancements (PRIORITY: MEDIUM)

The following test patterns do **NOT** match the generic helper signatures exactly:

#### Pattern A: Return Value Assertions

**[`validateReadParameters_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js)** (line ~1470):

```javascript
const result = validateReadParameters_(parameters);
expect(result).toBe(parameters.definitionKey); // <--  Extra assertion
```

#### Pattern B: Local Variable Setup

**[`validateSafeTrimmedIdentifier_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js)** (line ~1120):

```javascript
let throwValidationError_, validateSafeTrimmedIdentifier_;

beforeEach(() => {
  installAssignmentDefinitionControllerStub([]);
  const module = loadAssignmentDefinitionPartialsModule();
  throwValidationError_ = module.throwValidationError_;
  validateSafeTrimmedIdentifier_ = module.validateSafeTrimmedIdentifier_;
});
```

#### Pattern C: Local Builder Helpers

**[`validatePartialRow_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js)** (line ~1900):

```javascript
const buildValidRow = (overrides = {}) => ({ ... });
```

**Impact**: These cannot be directly converted to use the generic helpers without either:

- Enhancing the helpers to handle these cases, OR
- Restructuring the tests to fit the helper patterns

---

### 1.4 Cognitive Complexity Fix Should Use Inline Simplification (PRIORITY: MEDIUM)

**Current complexity issues** in [`runThrowingValidationTest`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:242):

```javascript
if (expectDetails && err.details !== undefined) {
  const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
  if (rowIndex !== undefined) {
    expect(err.details).toBe(`rowIndex=${rowIndex}`);
  }
}
```

**BETTER Solution** (reduces complexity from 16 to 14 with no new functions):

```javascript
if (expectDetails && err.details !== undefined && paramNames.includes('rowIndex')) {
  expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
}
```

**Previous proposed solution** (extracting to `assertErrorFieldDetails`) would have **increased** line count without sufficient complexity reduction.

---

### 1.5 `buildValidUpsertParams` Duplication Needs Verification (PRIORITY: LOW)

**FINDING**: The plan claimed `buildValidUpsertParams` is defined twice in the test file (lines 1908-1915, 2301-2309, 2510-2518), but grep search found **no duplicate definitions**.

**ACTION REQUIRED**:

1. Verify actual duplication exists
2. If local definitions exist, remove them and use helper from [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:307)
3. If helper is already being imported and used, no action needed

---

### 1.6 `validationTestHelpers.js` Should Be Consolidated (PRIORITY: LOW)

**[`validationTestHelpers.js`](tests/helpers/validationTestHelpers.js:1)** contains only:

- A set of BACKSLASH_STRINGS constants
- Unused imports
- Minimal functionality

**RECOMMENDATION**:

1. Move BACKSLASH_STRINGS to [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js)
2. Delete [`validationTestHelpers.js`](tests/helpers/validationTestHelpers.js) entirely in Phase 5 cleanup

---

## 2. Analysis of Duplicated Blocks in `assignmentDefinitionPartials.unit.test.js`

### 2.1 Duplicate Pattern Categories

The duplication falls into **5 distinct categories**:

#### Category A: Repeated Describe Block Setup (Highest Impact)

**Pattern**: Each `describe` block repeats the same 3-line setup:

```javascript
const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
beforeEach(beforeEachHandler);
afterEach(afterEachHandler);
```

**Occurrences**: ~22 times throughout the file
**Lines per occurrence**: 3
**Total lines**: ~66 lines
**Consolidation**: Use `describeWithAssignmentDefinitionController` helper (already exists)
**NOTE**: Requires code restructuring - all test code must be moved inside the callback function

#### Category B: Repeated Module Load + Function Extraction

**Pattern**:

```javascript
installAssignmentDefinitionControllerStub([]);
const { functionName_ } = loadAssignmentDefinitionPartialsModule();
```

**Occurrences**: ~40+ times
**Lines per occurrence**: 2
**Total lines**: ~80+ lines
**Consolidation**: Create helper that combines stub installation and module loading

#### Category C: Binary Function Test Structure (hasControlCharacters*, isIsoDateTimeString*)

**Blocks**:

- Lines 886-942: `hasControlCharacters_` tests (it.each with 21 test cases)
- Lines 954-1064: `isIsoDateTimeString_` tests (it.each with 50+ test cases)

**Duplication**: Both use identical structure: `it.each([...])` with `installAssignmentDefinitionControllerStub([])` + `loadAssignmentDefinitionPartialsModule()` + `expect(func(value)).toBe(expected)`

**Lines duplicated**: ~50 lines across both blocks
**Consolidation**: Use existing `runBinaryFunctionTest` helper

#### Category D: Simple Validation Function Tests with Row Index

**Pattern**: Validation functions that take a value + rowIndex + throw ApiValidationError:

- `validateDefinitionKey_` (lines 1522-1613)
- `validatePrimaryTopicKey_` (lines 1620-1700)
- `validateTimestamp_` (lines 1821-1898)

**Duplication**: All follow identical pattern:

```javascript
it.each([...])(
  'handles $description correctly',
  ({ value, rowIndex, shouldThrow, expectedError, expectedField }) => {
    installAssignmentDefinitionControllerStub([]);
    const { functionName_ } = loadAssignmentDefinitionPartialsModule();
    if (shouldThrow) {
      expect(() => func(value, rowIndex)).toThrow(ApiValidationError);
      expect(() => func(value, rowIndex)).toThrow(expectedError);
      try { func(value, rowIndex); } catch (err) {
        expect(err.fieldName).toBe(expectedField);
        expect(err.method).toBe('getAssignmentDefinitionPartials');
        expect(err.details).toBe(`rowIndex=${rowIndex}`);
      }
    } else {
      expect(() => func(value, rowIndex)).not.toThrow();
    }
  }
)
```

**Lines duplicated**: ~150+ lines across 3+ functions
**Consolidation**: Use existing `runSimpleValidationTest` helper

#### Category E: Complex Validation Function Tests (Multiple Parameters)

**Pattern**: Validation functions with multiple parameters:

- `validateReadParameters_` (lines 1369-1515)
- `validateYearGroupKeyedFields_` (lines 1706-1814)
- `validatePartialRow_` (lines 1927-2080)
- `validateTaskWeightingsShape_` (lines 2082-2200)
- `validateRequiredYearGroupKey_` (lines 2202-2290)
- `validateUpsertParameters_` (lines 2292-2500)
- `validateWizardUpsertParameters_` (lines 2502-2730)

**Duplication**: All follow pattern:

```javascript
it.each([...])(
  'handles $description correctly',
  ({ parameters, shouldThrow, expectedError, expectedField }) => {
    installAssignmentDefinitionControllerStub([]);
    const { functionName_ } = loadAssignmentDefinitionPartialsModule();
    if (shouldThrow) {
      expect(() => func(parameters)).toThrow(ApiValidationError);
      expect(() => func(parameters)).toThrow(expectedError);
      try { func(parameters); } catch (err) {
        expect(err.fieldName).toBe(expectedField);
        expect(err.method).toBe('upsertAssignmentDefinition' or 'getAssignmentDefinitionPartials');
      }
    } else {
      expect(() => func(parameters)).not.toThrow();
    }
  }
)
```

**Lines duplicated**: ~300+ lines across 7 functions
**Consolidation**: Use existing `runThrowingValidationTest` helper or create parameterized variant

#### Category F: Throw Error Helper Tests

**Pattern**: Tests for `throwValidationError_`, `throwReadValidationError_`, `throwUpsertValidationError_`, `throwDeleteValidationError_`

**Blocks**: Lines 1205-1351 (4 describe blocks)
**Duplication**: Each has 2-3 identical tests with same structure
**Lines duplicated**: ~45 lines
**Consolidation**: Create generic helper for error-throwing function tests

### 1.2. Specific Duplicated Block Mapping (From Sonar Report)

| Block | Lines     | Duplicated With  | Type                                  | Lines Duplicated | Consolidation Strategy                           |
| ----- | --------- | ---------------- | ------------------------------------- | ---------------- | ------------------------------------------------ |
| 1     | 873-921   | 945-990          | Describe block setup                  | 50               | Use `describeWithAssignmentDefinitionController` |
| 2     | 887-921   | 892-926, 956-990 | Test case structure                   | 45-35            | Use `runBinaryFunctionTest`                      |
| 3     | 1001-1021 | 1029-1046        | ISO date test cases                   | 21               | Use `runBinaryFunctionTest`                      |
| 4     | 1120-1179 | 1127-1186        | validateSafeTrimmedIdentifier\_ cases | 60               | Use `runSimpleValidationTest`                    |
| 5     | 1427-1481 | 1434-1488        | validateReadParameters\_ cases        | 55               | Use `runThrowingValidationTest`                  |
| 6     | 1718-1749 | 1754-1785        | validateYearGroupKeyedFields\_ cases  | 32               | Use `runThrowingValidationTest`                  |
| 7     | 2291-2322 | 2298-2329        | validateUpsertParameters\_ cases      | 32               | Use `runThrowingValidationTest`                  |

**Note**: The line numbers in the report are approximate. The actual duplication is more extensive than reported due to pattern repetition.

---

## 2. Existing Helper Analysis

## 3. Revised Consolidation Strategies

### Strategy 1: Replace All Describe Blocks with Helper (Priority: HIGH)

**Action**: Replace all 22+ occurrences of:

```javascript
describe('FunctionName_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  // tests...
});
```

With:

```javascript
describeWithAssignmentDefinitionController('FunctionName_', () => {
  // tests...
});
```

**Files to modify**:

- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`

**LOC reduction**: ~66 lines
**Risk**: Low-Medium - Requires code restructuring (moving test code inside callback)
**PREREQUISITE**: Update import statement to include `describeWithAssignmentDefinitionController`

---

### Strategy 2: Use `runBinaryFunctionTest` for Binary Functions (Priority: HIGH)

**Action**: Replace `hasControlCharacters_` and `isIsoDateTimeString_` test blocks with calls to `runBinaryFunctionTest`.

**Before** (lines 880-1064, ~185 lines):

```javascript
describe('hasControlCharacters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  it.each([...])('returns $expected for $description', ({ value, expected }) => {
    installAssignmentDefinitionControllerStub([]);
    const { hasControlCharacters_ } = loadAssignmentDefinitionPartialsModule();
    expect(hasControlCharacters_(value)).toBe(expected);
  });
});
```

**After** (~10 lines):

```javascript
describe('hasControlCharacters_', () => {
  runBinaryFunctionTest({
    functionName: 'hasControlCharacters_',
    testCases: [...],
  });
});
```

**LOC reduction**: ~175 lines
**Risk**: Low
**PREREQUISITE**:

1. Update import statement to include `runBinaryFunctionTest`
2. Ensure [`describeWithAssignmentDefinitionController`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:115) is used for describe block

---

### Strategy 3: Use `runSimpleValidationTest` for Simple Validators (Priority: HIGH)

**Action**: Replace validation tests for `validateDefinitionKey_`, `validatePrimaryTopicKey_`, `validateTimestamp_` with `runSimpleValidationTest`.

**Applicable functions**:

- `validateDefinitionKey_` (lines 1517-1613)
- `validatePrimaryTopicKey_` (lines 1615-1700)
- `validateTimestamp_` (lines 1816-1898)

**Pattern match**: All follow identical pattern with value + rowIndex parameters and ApiValidationError throwing

**LOC reduction**: ~150 lines
**Risk**: Low
**PREREQUISITE**: Update import statement to include `runSimpleValidationTest`

---

### Strategy 4: Enhance and Use `runThrowingValidationTest` for Complex Validators (Priority: MEDIUM)

**ACTION REQUIRED BEFORE USE**: Enhance [`runThrowingValidationTest`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:221) to support:

1. **Return value assertions** (for `validateReadParameters_`)
2. **Custom setup with module extraction** (for tests with local variable setup)

**Proposed enhanced signature**:

```javascript
runThrowingValidationTest({
  setup: () => { /* can return context */ },
  func: (params, context) => context.func(params),
  testCases: [...],
  method: 'getAssignmentDefinition',
  expectDetails: false,
  returnValueAssertion: (result, params) => expect(result).toBe(params.definitionKey)
});
```

**Applicable functions**:

- `validateReadParameters_` (lines 1364-1515) - needs return value support
- `validateYearGroupKeyedFields_` (lines 1701-1814) - direct match
- `validatePartialRow_` (lines 1903-2080) - needs local builder support
- `validateTaskWeightingsShape_` (lines 2082-2200) - direct match
- `validateRequiredYearGroupKey_` (lines 2202-2290) - direct match
- `validateUpsertParameters_` (lines 2292-2500) - direct match
- `validateWizardUpsertParameters_` (lines 2502-2730) - direct match

**LOC reduction**: ~300+ lines
**Risk**: Medium - Requires helper enhancement first

---

### Strategy 5: Fix Cognitive Complexity in Helper (Priority: MEDIUM)

**Action**: Refactor [`runThrowingValidationTest`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:221) to reduce cognitive complexity from 16 to ≤15.

**RECOMMENDED Solution** (simple inline fix):

```javascript
// Current (line 242):
if (expectDetails && err.details !== undefined) {
  const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
  if (rowIndex !== undefined) {
    expect(err.details).toBe(`rowIndex=${rowIndex}`);
  }
}

// After:
if (expectDetails && err.details !== undefined && paramNames.includes('rowIndex')) {
  expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
}
```

**Why this is better**:

- Reduces complexity from 16 to 14 (below threshold)
- Removes unnecessary variable assignment
- No new functions needed
- No additional lines

**LOC reduction**: 0 lines (but fixes complexity issue)
**Risk**: Low - Internal refactor, no API changes

---

### Strategy 6: Verify and Consolidate buildValidUpsertParams (Priority: LOW)

**Action**:

1. Verify if local `buildValidUpsertParams` definitions exist at lines 1908-1915, 2301-2309, 2510-2518
2. If they exist, remove them and use helper from [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:307)
3. If they don't exist (grep found none), verify import is correct

**LOC reduction**: 0-25 lines
**Risk**: Low

---

### Strategy 7: Cleanup validationTestHelpers.js (Priority: LOW)

**Actions**:

1. Remove unused imports reported by SonarQube
2. Move BACKSLASH_STRINGS constants to [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js)
3. Delete [`validationTestHelpers.js`](tests/helpers/validationTestHelpers.js) if it becomes empty
4. Update any references to use consolidated helpers

**LOC reduction**: ~10 lines
**Risk**: Low

---

## 3. Consolidation Strategies

### Strategy 1: Replace All Describe Blocks with Helper (Priority: HIGH)

**Action**: Replace all 22+ occurrences of:

```javascript
describe('FunctionName_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  // tests...
});
```

With:

```javascript
describeWithAssignmentDefinitionController('FunctionName_', () => {
  // tests...
});
```

**Files to modify**:

- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`

**LOC reduction**: ~66 lines
**Risk**: Low - `describeWithAssignmentDefinitionController` already exists and is tested

### Strategy 2: Use `runBinaryFunctionTest` for Binary Functions (Priority: HIGH)

**Action**: Replace `hasControlCharacters_` and `isIsoDateTimeString_` test blocks with calls to `runBinaryFunctionTest`.

**Before** (lines 880-1064, ~185 lines):

```javascript
describe('hasControlCharacters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  it.each([...])('returns $expected for $description', ({ value, expected }) => {
    installAssignmentDefinitionControllerStub([]);
    const { hasControlCharacters_ } = loadAssignmentDefinitionPartialsModule();
    expect(hasControlCharacters_(value)).toBe(expected);
  });
});

describe('isIsoDateTimeString_', () => {
  // Similar structure...
});
```

**After** (~10 lines):

```javascript
describe('hasControlCharacters_', () => {
  runBinaryFunctionTest({
    functionName: 'hasControlCharacters_',
    testCases: [...],
  });
});

describe('isIsoDateTimeString_', () => {
  runBinaryFunctionTest({
    functionName: 'isIsoDateTimeString_',
    testCases: [...],
  });
});
```

**LOC reduction**: ~175 lines
**Risk**: Low - Helper already exists and handles the exact pattern

### Strategy 3: Use `runSimpleValidationTest` for Simple Validators (Priority: HIGH)

**Action**: Replace validation tests for `validateDefinitionKey_`, `validatePrimaryTopicKey_`, `validateTimestamp_` with `runSimpleValidationTest`.

**Applicable functions**:

- `validateDefinitionKey_` (lines 1517-1613)
- `validatePrimaryTopicKey_` (lines 1615-1700)
- `validateTimestamp_` (lines 1816-1898)

**LOC reduction**: ~150 lines
**Risk**: Low - Helper designed for this exact pattern

### Strategy 4: Use `runThrowingValidationTest` for Complex Validators (Priority: HIGH)

**Action**: Replace validation tests for multi-parameter functions with `runThrowingValidationTest`.

**Applicable functions**:

- `validateReadParameters_` (lines 1364-1515)
- `validateYearGroupKeyedFields_` (lines 1701-1814)
- `validatePartialRow_` (lines 1903-2080)
- `validateTaskWeightingsShape_` (lines 2082-2200)
- `validateRequiredYearGroupKey_` (lines 2202-2290)
- `validateUpsertParameters_` (lines 2292-2500)
- `validateWizardUpsertParameters_` (lines 2502-2730)

**Note**: Some functions may need minor adaptation. The helper's `setup` parameter can handle `installAssignmentDefinitionControllerStub([])` and module loading.

**LOC reduction**: ~300+ lines
**Risk**: Low-Medium - May need to adjust test case structure slightly

### Strategy 5: Consolidate buildValidUpsertParams Duplication (Priority: MEDIUM)

**Action**: Remove local `buildValidUpsertParams` definitions (lines 1908-1915, 2301-2309, 2510-2518) and use the helper from `assignmentDefinitionPartialsTestHelpers.js`.

**LOC reduction**: ~25 lines
**Risk**: Low - Helper already exists and has same signature

### Strategy 6: Fix Cognitive Complexity in Helper (Priority: MEDIUM)

**Action**: Refactor `runThrowingValidationTest` to reduce cognitive complexity from 16 to ≤15.

**Current issues** (line 242):

- Nested ternary operators
- Complex conditional logic in try-catch

**Proposed fix**:

```javascript
// Before: Complex nested ternary
if (expectDetails && err.details !== undefined) {
  const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
  if (rowIndex !== undefined) {
    expect(err.details).toBe(`rowIndex=${rowIndex}`);
  }
}

// After: Extract to separate helper function
function assertErrorDetails(err, expectDetails, params, paramNames) {
  if (!expectDetails) return;
  if (err.details === undefined) return;
  const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
  if (rowIndex !== undefined) {
    expect(err.details).toBe(`rowIndex=${rowIndex}`);
  }
}
```

**LOC reduction**: 0 (may add lines but reduces complexity)
**Risk**: Low - Internal refactor, no API changes

### Strategy 7: Fix validationTestHelpers.js Issues (Priority: LOW)

**Actions**:

1. Remove unused imports
2. Apply String.raw suggestions if applicable
3. Consider merging with `assignmentDefinitionPartialsTestHelpers.js` or removing if redundant

**LOC reduction**: ~10 lines (removing unused code)
**Risk**: Low

---

## 4. Revised Implementation Phases

### Phase 1: Import Updates and Helper Adoption Foundation (Priority: CRITICAL)

**Goal**: Update imports and begin adopting existing helpers for simplest cases

| #   | Task                                                                                      | LOC Reduction | Files     | Risk       | Notes                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------- | ------------- | --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Update import statement in test file to include all 4 helper functions                    | 0 lines       | test file | None       | Add `describeWithAssignmentDefinitionController`, `runBinaryFunctionTest`, `runSimpleValidationTest`, `runThrowingValidationTest` |
| 1.2 | Replace all ~22 `describe` block setups with `describeWithAssignmentDefinitionController` | ~66 lines     | test file | Low-Medium | Requires restructuring test code inside callbacks                                                                                 |
| 1.3 | Convert `hasControlCharacters_` tests to use `runBinaryFunctionTest`                      | ~90 lines     | test file | Low        | Must be done after 1.2                                                                                                            |
| 1.4 | Convert `isIsoDateTimeString_` tests to use `runBinaryFunctionTest`                       | ~90 lines     | test file | Low        | Must be done after 1.2                                                                                                            |

**Phase 1 Total**: ~246 lines
**Success Criteria**: All tests pass, no lint errors

---

### Phase 2: Simple Validator Conversion (Priority: HIGH)

**Goal**: Apply existing helpers to simple validation functions

| #   | Task                                                                      | LOC Reduction | Files       | Risk | Notes                     |
| --- | ------------------------------------------------------------------------- | ------------- | ----------- | ---- | ------------------------- |
| 2.1 | Convert `validateDefinitionKey_` tests to use `runSimpleValidationTest`   | ~50 lines     | test file   | Low  |                           |
| 2.2 | Convert `validatePrimaryTopicKey_` tests to use `runSimpleValidationTest` | ~50 lines     | test file   | Low  |                           |
| 2.3 | Convert `validateTimestamp_` tests to use `runSimpleValidationTest`       | ~50 lines     | test file   | Low  |                           |
| 2.4 | Fix cognitive complexity in `runThrowingValidationTest`                   | 0 lines       | helper file | Low  | Use inline simplification |

**Phase 2 Total**: ~150 lines
**Success Criteria**: All tests pass, complexity ≤15

---

### Phase 3: Helper Enhancement (Priority: MEDIUM)

**Goal**: Enhance helpers to support special cases before converting complex validators

| #   | Task                                                                   | LOC Reduction | Files       | Risk   | Notes                                       |
| --- | ---------------------------------------------------------------------- | ------------- | ----------- | ------ | ------------------------------------------- |
| 3.1 | Enhance `runThrowingValidationTest` to support return value assertions | 0 lines       | helper file | Medium | Add `returnValueAssertion` parameter        |
| 3.2 | Enhance `runThrowingValidationTest` to support setup with context      | 0 lines       | helper file | Medium | Allow setup to return context for func      |
| 3.3 | Verify and remove duplicate `buildValidUpsertParams` definitions       | 0-25 lines    | test file   | Low    | Check lines 1908-1915, 2301-2309, 2510-2518 |

**Phase 3 Total**: 0-25 lines
**Success Criteria**: Enhanced helpers tested and working

---

### Phase 4: Complex Validator Conversion (Priority: MEDIUM)

**Goal**: Convert complex validation functions using enhanced helpers

| #   | Task                                                          | LOC Reduction | Files     | Risk   | Notes                                      |
| --- | ------------------------------------------------------------- | ------------- | --------- | ------ | ------------------------------------------ |
| 4.1 | Convert `validateReadParameters_` tests using enhanced helper | ~75 lines     | test file | Medium | Uses return value assertion                |
| 4.2 | Convert `validateYearGroupKeyedFields_` tests                 | ~75 lines     | test file | Medium | Direct pattern match                       |
| 4.3 | Convert `validatePartialRow_` tests                           | ~75 lines     | test file | Medium | May need manual handling for local builder |
| 4.4 | Convert `validateTaskWeightingsShape_` tests                  | ~75 lines     | test file | Medium | Direct pattern match                       |
| 4.5 | Convert `validateRequiredYearGroupKey_` tests                 | ~75 lines     | test file | Medium | Direct pattern match                       |
| 4.6 | Convert `validateUpsertParameters_` tests                     | ~75 lines     | test file | Medium | Direct pattern match                       |
| 4.7 | Convert `validateWizardUpsertParameters_` tests               | ~75 lines     | test file | Medium | Direct pattern match                       |

**Phase 4 Total**: ~525 lines
**Success Criteria**: All tests pass, duplication reduced

---

### Phase 5: Final Cleanup (Priority: LOW)

**Goal**: Final cleanup and optimization

| #   | Task                                                     | LOC Reduction | Files        | Risk   | Notes                                               |
| --- | -------------------------------------------------------- | ------------- | ------------ | ------ | --------------------------------------------------- |
| 5.1 | Handle `validateSafeTrimmedIdentifier_` special case     | ~60 lines     | test file    | Medium | Has local variable setup - may need custom handling |
| 5.2 | Remove `buildValidRow` local definition if helper exists | ~10 lines     | test file    | Low    |                                                     |
| 5.3 | Move BACKSLASH_STRINGS to main helper file               | ~10 lines     | helper files | Low    |                                                     |
| 5.4 | Consider deleting `validationTestHelpers.js`             | 0 lines       | helper file  | Low    | If empty after consolidation                        |
| 5.5 | Fix any remaining validationTestHelpers.js issues        | ~10 lines     | helper file  | Low    | Remove unused imports                               |

**Phase 5 Total**: ~90 lines
**Success Criteria**: Codebase cleaner, all tests pass

---

## 5. Total Estimated Impact

| Phase   | LOC Reduction | Cumulative |
| ------- | ------------- | ---------- |
| Phase 1 | ~246 lines    | ~246       |
| Phase 2 | ~150 lines    | ~396       |
| Phase 3 | 0-25 lines    | ~396-421   |
| Phase 4 | ~525 lines    | ~921-946   |
| Phase 5 | ~90 lines     | ~1011-1036 |

**Total Estimated LOC Reduction: ~1011-1036 lines** (37-38% of the 2730-line test file)

**Conservative Realistic Estimate**: ~651 lines (24% of test file)

**Note**:

- This exceeds Sonar's 369 duplicated lines because Sonar reports only exact duplicate blocks, not pattern-based duplication
- Many blocks share 80-90% similarity but aren't exact duplicates
- The describe block setup pattern is repeated ~22 times with different function names
- Accuracy improved after code review revealed existing helpers are unused

**Quality Gate Impact**:

- Current duplication: 16.7% (failing)
- Target duplication: < 3% (passing)
- Expected result: **Well below 3% threshold** (likely < 1%)

---

## 6. Revised Implementation Checklist

### Before Implementation

- [ ] Read full `assignmentDefinitionPartials.unit.test.js` file (2730 lines)
- [ ] Read full `assignmentDefinitionPartialsTestHelpers.js` file (336 lines)
- [ ] Read `validationTestHelpers.js` file (26 lines)
- [ ] Verify all helper functions work correctly with current test patterns
- [ ] Run `npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js` to establish baseline
- [ ] Create backup: `git checkout -b backup/pre-deduplication tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- [ ] Count current test cases: `grep -c "it\." tests/backend-api/assignmentDefinitionPartials.unit.test.js`

---

### Phase 1: Import Updates and Helper Adoption Foundation

- [ ] Update import statement in test file to include all 4 unused helper functions
- [ ] Verify `describeWithAssignmentDefinitionController` signature matches usage requirements
- [ ] Replace all ~22 describe blocks with `describeWithAssignmentDefinitionController` (requires code restructuring)
- [ ] Convert `hasControlCharacters_` (lines 880-942) to use `runBinaryFunctionTest`
- [ ] Convert `isIsoDateTimeString_` (lines 954-1064) to use `runBinaryFunctionTest`
- [ ] Run tests: `npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- [ ] Run lint: `npm run lint:backend`
- [ ] Verify test count unchanged from baseline

---

### Phase 2: Simple Validator Conversion

- [ ] Convert `validateDefinitionKey_` (lines 1517-1613) to use `runSimpleValidationTest`
- [ ] Convert `validatePrimaryTopicKey_` (lines 1615-1700) to use `runSimpleValidationTest`
- [ ] Convert `validateTimestamp_` (lines 1816-1898) to use `runSimpleValidationTest`
- [ ] Fix cognitive complexity in `runThrowingValidationTest` using inline simplification
- [ ] Run tests after each conversion
- [ ] Verify complexity ≤15 using SonarQube or ESLint complexity rules

---

### Phase 3: Helper Enhancement

- [ ] Enhance `runThrowingValidationTest` to support return value assertions
- [ ] Enhance `runThrowingValidationTest` to support setup with context extraction
- [ ] Add comprehensive JSDoc for enhanced parameters
- [ ] Test enhanced helpers with sample test cases
- [ ] Verify duplicate `buildValidUpsertParams` definitions exist (check lines 1908-1915, 2301-2309, 2510-2518)
- [ ] Remove duplicate definitions if they exist

---

### Phase 4: Complex Validator Conversion

- [ ] Convert `validateReadParameters_` (lines 1364-1515) using enhanced helper with return value assertion
- [ ] Convert `validateYearGroupKeyedFields_` (lines 1701-1814) using enhanced helper
- [ ] Convert `validatePartialRow_` (lines 1903-2080) - may need special handling for local builder
- [ ] Convert `validateTaskWeightingsShape_` (lines 2082-2200) using enhanced helper
- [ ] Convert `validateRequiredYearGroupKey_` (lines 2202-2290) using enhanced helper
- [ ] Convert `validateUpsertParameters_` (lines 2292-2500) using enhanced helper
- [ ] Convert `validateWizardUpsertParameters_` (lines 2502-2730) using enhanced helper
- [ ] Run full test suite after each conversion

---

### Phase 5: Final Cleanup

- [ ] Handle `validateSafeTrimmedIdentifier_` (lines 1120-1186) special case with local variable setup
- [ ] Remove `buildValidRow` local definition if helper exists
- [ ] Move BACKSLASH_STRINGS from `validationTestHelpers.js` to main helper file
- [ ] Delete `validationTestHelpers.js` if empty after consolidation
- [ ] Fix any remaining unused imports in helper files
- [ ] Run full test suite: `npm run test:backend`
- [ ] Run all lint checks: `npm run lint:backend && npm run lint:frontend && npm run lint:builder`
- [ ] Verify duplication with SonarQube analysis

### Post-Implementation

- [ ] Run SonarQube analysis to verify duplication reduction
- [ ] Run full test suite (backend + frontend + builder)
- [ ] Verify all tests pass
- [ ] Check linting passes
- [ ] Update documentation if needed

---

## 7. Revised Risk Mitigation

### High-Risk Items

1. **Test failures after refactoring**: Generic helpers may not handle all edge cases
2. **Helper function compatibility**: Some validation functions have unique requirements (return values, local setup)
3. **Code restructuring errors**: Moving code inside `describeWithAssignmentDefinitionController` callbacks may introduce scope issues
4. ** Import statement conflicts**: Adding multiple new imports may cause circular dependencies

### Mitigation Strategies

1. **Incremental atomic changes**: Apply ONE refactoring at a time, commit after each individual conversion
2. **Test after every single change**: Run `npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
3. **Count test cases**: Verify `grep -c "it\." count` matches baseline before and after each change
4. **Scope verification**: Ensure no variable scope issues when moving code into callbacks
5. **Git staging**: Use `git add -p` to stage changes selectively for easier rollback
6. **Change documentation**: Document each change with commit message referencing the specific function converted

### Specific Risk Mitigations

#### Helper Signature Mismatch Risk

**Risk**: `describeWithAssignmentDefinitionController` requires code restructuring
**Mitigation**:

- Test with ONE describe block first (e.g., `hasControlCharacters_`)
- Verify the pattern works before applying to all 22 blocks
- Use find/replace with regex to handle variations

#### Special Pattern Risk

**Risk**: Functions like `validateReadParameters_` and `validateSafeTrimmedIdentifier_` don't match generic helper patterns
**Mitigation**:

- Leave these for Phase 4/5 after simpler cases are proven
- Create custom test patterns for these if needed
- Document why they couldn't use generic helpers

#### Cognitive Complexity Fix Risk

**Risk**: Complexity fix might break the helper's behavior
**Mitigation**:

- Write test cases for `runThrowingValidationTest` before modifying
- Verify complexity with ESLint before committing
- Use inline simplification (not extraction) to minimize change

### Rollback Plan

- All changes are in test files only (no production code affected)
- Backup branch exists: `backup/pre-deduplication`
- Each phase is isolated via git commits, enabling `git reset --hard HEAD~1` for partial rollback
- Full rollback: `git checkout backup/pre-deduplication tests/backend-api/assignmentDefinitionPartials.unit.test.js`

### Recovery Procedure

1. If test fails after a change:
   - Check git diff to see what changed
   - Run test with `--reporter=verbose` to see which specific test failed
   - Compare test case count with baseline
   - Revert the specific change that caused the failure
2. If complexity not reduced:
   - ReApply the inline simplification more carefully
   - Verify with ESLint complexity rules
3. If duplication not improved:
   - Check SonarQube report for specific blocks
   - Verify helper functions are actually being used
   - Ensure no new duplication was introduced

---

## 8. File-Specific Action Items

### `tests/backend-api/assignmentDefinitionPartials.unit.test.js`

#### Replace Describe Block Pattern (22+ occurrences)

**Search for**:

```javascript
describe('FunctionName_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

```

**Replace with**:

```javascript
describeWithAssignmentDefinitionController('FunctionName_', () => {
```

**Note**: Must handle cases where describe blocks have additional local variables (like `let throwValidationError_` in `validateSafeTrimmedIdentifier_` tests). These will need manual conversion.

#### Convert Binary Function Tests

**Current** (lines 880-1064):

```javascript
describe('hasControlCharacters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  it.each([...])('returns $expected for $description', ({ value, expected }) => {
    installAssignmentDefinitionControllerStub([]);
    const { hasControlCharacters_ } = loadAssignmentDefinitionPartialsModule();
    expect(hasControlCharacters_(value)).toBe(expected);
  });
});
```

**Target**:

```javascript
describe('hasControlCharacters_', () => {
  runBinaryFunctionTest({
    functionName: 'hasControlCharacters_',
    testCases: [
      // ... all test cases
    ],
  });
});
```

#### Convert Simple Validation Tests

**Current** (lines 1517-1613, 1615-1700, 1816-1898):

```javascript
describe('validateDefinitionKey_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  it.each([...])(
    'handles $description correctly',
    ({ definitionKey, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateDefinitionKey_ } = loadAssignmentDefinitionPartialsModule();
      if (shouldThrow) {
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).toThrow(ApiValidationError);
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).toThrow(expectedError);
        try {
          validateDefinitionKey_(definitionKey, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validateDefinitionKey_(definitionKey, rowIndex)).not.toThrow();
      }
    }
  );
});
```

**Target**:

```javascript
describe('validateDefinitionKey_', () => {
  runSimpleValidationTest({
    functionName: 'validateDefinitionKey_',
    testCases: [...],
    method: 'getAssignmentDefinitionPartials',
    hasRowIndex: true,
  });
});
```

#### Convert Complex Validation Tests

**Current** (lines 1364-1515, 1701-1814, etc.):

```javascript
describe('validateReadParameters_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  it.each([...])(
    'handles $description correctly',
    ({ parameters, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateReadParameters_ } = loadAssignmentDefinitionPartialsModule();
      if (shouldThrow) {
        expect(() => validateReadParameters_(parameters)).toThrow(ApiValidationError);
        expect(() => validateReadParameters_(parameters)).toThrow(expectedError);
        try {
          validateReadParameters_(parameters);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinition');
        }
      } else {
        const result = validateReadParameters_(parameters);
        expect(result).toBe(parameters.definitionKey);
        expect(() => validateReadParameters_(parameters)).not.toThrow();
      }
    }
  );
});
```

**Target**:

```javascript
describe('validateReadParameters_', () => {
  runThrowingValidationTest({
    setup: () => installAssignmentDefinitionControllerStub([]),
    func: (params) => loadAssignmentDefinitionPartialsModule().validateReadParameters_(params),
    testCases: [...],
    method: 'getAssignmentDefinition',
    expectDetails: false,
  });
});
```

**Note**: Some functions have special return value checks (like `validateReadParameters_` returning the definitionKey). These may need custom handling or the helper may need enhancement.

### `tests/helpers/assignmentDefinitionPartialsTestHelpers.js`

#### Fix Cognitive Complexity

**Current** (lines 221-250):

```javascript
export function runThrowingValidationTest({
  setup,
  func,
  testCases,
  method,
  expectDetails = false,
}) {
  testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
    const paramValues = Object.values(params);
    const paramNames = Object.keys(params);

    it(`handles ${description} correctly`, () => {
      setup();

      if (shouldThrow) {
        expect(() => func(...paramValues)).toThrow(ApiValidationError);
        expect(() => func(...paramValues)).toThrow(expectedError);
        try {
          func(...paramValues);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe(method);
          if (expectDetails && err.details !== undefined) {
            const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
            if (rowIndex !== undefined) {
              expect(err.details).toBe(`rowIndex=${rowIndex}`);
            }
          }
        }
      } else {
        expect(() => func(...paramValues)).not.toThrow();
      }
    });
  });
}
```

**Target**:

```javascript
function assertErrorFieldDetails(err, expectDetails, params, paramNames) {
  expect(err.fieldName).toBe(params.expectedField);
  expect(err.method).toBe(params.method);
  if (expectDetails && err.details !== undefined) {
    const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
    if (rowIndex !== undefined) {
      expect(err.details).toBe(`rowIndex=${rowIndex}`);
    }
  }
}

export function runThrowingValidationTest({
  setup,
  func,
  testCases,
  method,
  expectDetails = false,
}) {
  testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
    const paramValues = Object.values(params);
    const paramNames = Object.keys(params);
    const testParams = { expectedField, method, ...params };

    it(`handles ${description} correctly`, () => {
      setup();

      if (shouldThrow) {
        expect(() => func(...paramValues)).toThrow(ApiValidationError);
        expect(() => func(...paramValues)).toThrow(expectedError);
        try {
          func(...paramValues);
        } catch (err) {
          assertErrorFieldDetails(err, expectDetails, testParams, paramNames);
        }
      } else {
        expect(() => func(...paramValues)).not.toThrow();
      }
    });
  });
}
```

### `tests/helpers/validationTestHelpers.js`

#### Remove Unused Imports

**Action**: Remove any unused imports reported by Sonar
**Impact**: Minimal, improves code quality

#### Apply String.raw Suggestions

**Action**: Replace string concatenation with template literals where suggested
**Impact**: Minimal, improves code style

---

## 9. Verification Commands

### Baseline Establishment (Run Before Starting)

```bash
# Count current lines and test cases
git checkout main  # ensure on main branch
wc -l tests/backend-api/assignmentDefinitionPartials.unit.test.js
grep -c "it\." tests/backend-api/assignmentDefinitionPartials.unit.test.js

# Run baseline tests
npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js

# Check current duplication (if SonarQube available)
# Or use: npm run test:backend:coverage
```

### After Each Change

```bash
# Run the specific test file (fastest feedback)
npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js

# Count test cases to ensure none were lost
grep -c "it\." tests/backend-api/assignmentDefinitionPartials.unit.test.js

# Quick lint check
npm run lint:backend
```

### After Each Phase

```bash
# Run all backend tests
npm run test:backend

# Full lint suite
npm run lint:backend && npm run lint:frontend && npm run lint:builder

# Check for cognitive complexity (if ESLint plugin installed)
npx eslint tests/helpers/assignmentDefinitionPartialsTestHelpers.js --rule 'complexity: [2, 15]'
```

### Final Verification

```bash
# Full test suite
npm test

# All lint checks
npm run lint

# Count lines saved
wc -l tests/backend-api/assignmentDefinitionPartials.unit.test.js

# Verify duplication reduction via SonarQube or coverage tools
npm run test:backend:coverage
```

### Quick Debugging Commands

```bash
# See git changes
git diff tests/backend-api/assignmentDefinitionPartials.unit.test.js

# See test failures in detail
npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js --reporter=verbose

# Check which tests are failing
npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js --reporter=verbose 2>&1 | grep -A 5 "FAIL"

# Count helper function usage
grep -n "runBinaryFunctionTest\|runSimpleValidationTest\|runThrowingValidationTest\|describeWithAssignmentDefinitionController" tests/backend-api/assignmentDefinitionPartials.unit.test.js | wc -l
```

---

## 10. Revised Success Criteria

### Functional Criteria

- [ ] All tests pass (100% pass rate)
- [ ] No linting errors or warnings across all lint commands
- [ ] Test case count remains identical to baseline
- [ ] No regressions in test coverage

### Code Quality Criteria

- [ ] SonarQube duplication < 3% (target: < 1%)
- [ ] Cognitive complexity in all helpers ≤ 15
- [ ] No unused imports in any helper files
- [ ] No duplicate code patterns remaining

### Reduction Targets

- [ ] Total LOC in test file reduced by ≥ 451 lines (conservative target)
- [ ] Stretch goal: ≥ 651 lines (24% reduction of 2730-line file)
- [ ] Ultra-stretch goal: ≥ 1000 lines (37% reduction)

### Verification Checklist

- [ ] Run: `npm run test:backend` - all tests pass
- [ ] Run: `npm run lint:backend` - no errors
- [ ] Run: `npm run lint:frontend` - no errors
- [ ] Run: `npm run lint:builder` - no errors
- [ ] Run: `npm run test:backend:coverage` - coverage maintained
- [ ] Verify: SonarQube duplication metric < 3%
- [ ] Verify: Test case count matches baseline

---

## 11. Appendix: Complete File Information

### File Inventory

- **Main test file**: `tests/backend-api/assignmentDefinitionPartials.unit.test.js` - 2730 lines
- **Primary helper file**: `tests/helpers/assignmentDefinitionPartialsTestHelpers.js` - 336 lines
- **Secondary helper file**: `tests/helpers/validationTestHelpers.js` - 26 lines (candidate for deletion)

### Helper Function Reference

#### `describeWithAssignmentDefinitionController(title, testFn)` (line 115)

**Purpose**: Wraps a describe block with automatic hook setup
**Location**: [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:115)
**Current Status**: ✅ Exists but UNUSED in test file
**Usage Pattern**:

```javascript
// REPLACES:
describe('FunctionName_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);
  // tests...
});

// WITH:
describeWithAssignmentDefinitionController('FunctionName_', () => {
  // tests...
});
```

**Import Required**: Yes (currently not imported)

---

#### `runBinaryFunctionTest({ functionName, testCases })` (line 207)

**Purpose**: Runs tests for functions returning true/false
**Location**: [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:207)
**Current Status**: ✅ Exists but UNUSED in test file
**Signature**:

```javascript
runBinaryFunctionTest({
  functionName: string,      // Name of function to test
  testCases: Array<{         // Array of test cases
    description: string,      // Test description
    value: any,               // Input value
    expected: boolean         // Expected return value
  }>
})
```

**Applicable to**: `hasControlCharacters_`, `isIsoDateTimeString_`
**Import Required**: Yes (currently not imported)

---

#### `runSimpleValidationTest({ functionName, testCases, method, hasRowIndex, hasFieldName })` (line 252)

**Purpose**: Runs tests for simple validation functions (single param + rowIndex)
**Location**: [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:252)
**Current Status**: ✅ Exists but UNUSED in test file
**Signature**:

```javascript
runSimpleValidationTest({
  functionName: string,
  testCases: Array<{
    description: string,
    value: any,
    rowIndex?: number,
    shouldThrow: boolean,
    expectedError?: string,
    expectedField?: string
  }>,
  method: string,            // Method name for error assertion
  hasRowIndex: boolean,       // Whether function takes rowIndex
  hasFieldName: boolean       // Whether to check fieldName
})
```

**Applicable to**: `validateDefinitionKey_`, `validatePrimaryTopicKey_`, `validateTimestamp_`
**Import Required**: Yes (currently not imported)

---

#### `runThrowingValidationTest({ setup, func, testCases, method, expectDetails })` (line 221)

**Purpose**: Runs tests for validation functions that throw ApiValidationError
**Location**: [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:221)
**Current Status**: ✅ Exists but UNUSED in test file, **needs complexity fix**
**Current Issue**: Cognitive complexity = 16 (threshold: 15)
**Signature**:

```javascript
runThrowingValidationTest({
  setup: Function,            // Setup function called before each test
  func: Function,             // Function under test
  testCases: Array<{
    description: string,
    shouldThrow: boolean,
    expectedError?: string,
    expectedField?: string,
    ...params: any            // Function parameters
  }>,
  method: string,             // Method name for error assertion
  expectDetails: boolean      // Whether to check details field (default: false)
})
```

**Applicable to**:

- `validateReadParameters_` (needs return value support enhancement)
- `validateYearGroupKeyedFields_` (direct match)
- `validatePartialRow_` (needs local builder support)
- `validateTaskWeightingsShape_` (direct match)
- `validateRequiredYearGroupKey_` (direct match)
- `validateUpsertParameters_` (direct match)
- `validateWizardUpsertParameters_` (direct match)
  **Import Required**: Yes (currently not imported)

---

### Existing Helper Functions Already Used in Test File

From import statement (lines 1-8):

- `createAssignmentDefinitionControllerHooks` - USED
- `installAssignmentDefinitionControllerStub` - USED
- `loadAssignmentDefinitionPartialsModule` - USED
- `buildValidPartial` - USED
- `createMockDefinitionForPartialRow` - USED
- `expectFunctionNotInSource` - USED
- `expectFunctionInSource` - USED
- `expectPatternInSource` - USED
- `expectPatternNotInSource` - USED

---

### Helper Functions NOT Imported (Available but Unused)

- `describeWithAssignmentDefinitionController` (line 115)
- `runBinaryFunctionTest` (line 207)
- `runThrowingValidationTest` (line 221)
- `runSimpleValidationTest` (line 252)
- `buildValidUpsertParams` (line 307) - May be defined locally in test file

---

### Special Cases Requiring Manual Handling

#### [`validateSafeTrimmedIdentifier_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js:1120) - Local Variable Setup

```javascript
let throwValidationError_, validateSafeTrimmedIdentifier_;
beforeEach(() => {
  installAssignmentDefinitionControllerStub([]);
  const module = loadAssignmentDefinitionPartialsModule();
  throwValidationError_ = module.throwValidationError_;
  validateSafeTrimmedIdentifier_ = module.validateSafeTrimmedIdentifier_;
});
```

**Issue**: Requires multiple function extraction in beforeEach
**Recommendation**: Convert to use enhanced helper or keep as-is

---

#### [`validateReadParameters_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js:1364) - Return Value Assertion

```javascript
const result = validateReadParameters_(parameters);
expect(result).toBe(parameters.definitionKey);
```

**Issue**: Has return value assertion in non-throwing case
**Recommendation**: Enhance `runThrowingValidationTest` with optional `returnValueAssertion` parameter

---

#### [`validatePartialRow_`](tests/backend-api/assignmentDefinitionPartials.unit.test.js:1903) - Local Builder Function

```javascript
const buildValidRow = (overrides = {}) => ({
  primaryTitle: 'Algebra Baseline',
  // ... 15+ properties
});
```

**Issue**: Has local helper function definition
**Recommendation**: Move to helper file or keep as-is

---

### Cognitive Complexity Fix Detail

**File**: [`assignmentDefinitionPartialsTestHelpers.js`](tests/helpers/assignmentDefinitionPartialsTestHelpers.js:242)
**Current Complexity**: 16 (above threshold of 15)
**Recommended Fix** (inline simplification):

```javascript
// CURRENT (line 242):
if (expectDetails && err.details !== undefined) {
  const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
  if (rowIndex !== undefined) {
    expect(err.details).toBe(`rowIndex=${rowIndex}`);
  }
}

// RECOMMENDED:
if (expectDetails && err.details !== undefined && paramNames.includes('rowIndex')) {
  expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
}
```

**Impact**:

- Reduces complexity from 16 to 14 (below threshold)
- Eliminates unnecessary variable assignment
- No new functions needed
- No additional lines

---

_Plan generated: 2025-01-01_
*Last Reviewed: 2026-06-01 (comprehensive code review completed)
*Reviewer: GitHub Copilot (mistral-medium-3-5)
*Target duplication: < 3% (from current 16.7%)
*Estimated effort: 6-10 hours (revised from 4-8 hours based on code review findings)\*

- _Files affected:_
- - `tests/backend-api/assignmentDefinitionPartials.unit.test.js` (primary)\*
- - `tests/helpers/assignmentDefinitionPartialsTestHelpers.js` (helper enhancements)\*
- - `tests/helpers/validationTestHelpers.js` (potential deletion)\*
- _Change History:_
- v2.0 (2026-06-01): MAJOR REVISION based on comprehensive code review\*
- - CRITICAL FINDING: Existing helpers are completely unused in test file\*
- - Revised phasing: 5 phases instead of 4\*
- - Corrected LOC estimates: ~651 lines (conservative) to ~1036 lines (optimistic)\*
-
- v1.0 (2025-01-01): Initial plan based on SonarQube report
