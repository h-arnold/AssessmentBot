# De-Sloppification Review: `chore/StandardiseFrontendPatterns` vs `feat/ReactFrontend`

**Review Date**: 2026-04-17  
**Branch**: `chore/StandardiseFrontendPatterns`  
**Validation Status**: All linting and tests passing (392/392 tests, 0 lint errors)  
**Overall Assessment**: **Needs Improvement** — The branch correctly implements the SPEC's loading-state, skeleton, mutation-boundary, width-token, and fail-closed standards. The core logic is sound. No dead code blocks, stale imports, or misleading abstractions at the feature level. Slop is localised to a cluster of single-use helper extractions and one confirmed duplication across modal files.

---

## Critical Findings

### [CRITICAL #1] Duplicated load-error logic in `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx`

**Priority**: Must fix before merge  
**Impact**: Maintenance burden; any future fix to load-error precedence or failure messaging must be applied twice

#### Evidence

**File**: `src/frontend/src/features/classes/ManageCohortsModal.tsx`, lines 102–119

```typescript
function getCohortsLoadError(
  cohortsQuery: Readonly<{
    data: Cohort[] | undefined;
    isError: boolean;
  }>,
  blockingLoadError: BlockingLoadErrorState | null,
  dataUpdatedAt: number
): string | null {
  const blockingLoadErrorMessage = getBlockingLoadErrorMessage(blockingLoadError, dataUpdatedAt);
  if (blockingLoadErrorMessage !== null) {
    return blockingLoadErrorMessage;
  }

  if (cohortsQuery.isError && cohortsQuery.data === undefined) {
    return cohortsLoadFailureCopy;
  }

  return null;
}
```

**File**: `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`, lines 100–120

```typescript
function getYearGroupsLoadError(
  yearGroupsQuery: Readonly<{
    data: YearGroup[] | undefined;
    isError: boolean;
  }>,
  blockingLoadError: BlockingLoadErrorState | null,
  dataUpdatedAt: number
): string | null {
  const blockingLoadErrorMessage = getBlockingLoadErrorMessage(blockingLoadError, dataUpdatedAt);
  if (blockingLoadErrorMessage !== null) {
    return blockingLoadErrorMessage;
  }

  if (yearGroupsQuery.isError && yearGroupsQuery.data === undefined) {
    return yearGroupsLoadFailureCopy;
  }

  return null;
}
```

Both functions:

1. Check the blocking load error message first
2. Return it if present
3. Check `isError && data === undefined`
4. Return entity-specific failure copy if true
5. Return null otherwise

The only differences are:

- Entity type annotation (`Cohort[]` vs `YearGroup[]`)
- The variable name (`cohortsQuery` vs `yearGroupsQuery`)
- The failure copy (`cohortsLoadFailureCopy` vs `yearGroupsLoadFailureCopy`)

#### Why this is slop

The `manageReferenceDataHelpers.ts` file already exists to hold **shared logic** for these two modal files (see module docstring at line 1–6). This is confirmed duplication that belongs in the shared helper module. Any future fix (e.g., changing error-precedence logic, adding new error categories) must be applied to both files, creating a maintenance and testing burden.

#### Recommended fix

1. **Extract a generic helper to `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`**:

Add this function after the existing `refetchRequiredReferenceDataQuery` function (after line 151):

```typescript
/**
 * Returns the current blocking load error for a reference-data query.
 *
 * @param {Readonly<{ data: unknown; isError: boolean; }>} query Query state.
 * @param {BlockingLoadErrorState | null} blockingLoadError Current blocking load-error state.
 * @param {number} dataUpdatedAt Timestamp of the currently cached dataset.
 * @param {string} failureCopy User-facing failure message when query fails and has no data.
 * @returns {string | null} Blocking error message, query failure message, or null.
 */
export function getReferenceDataLoadError(
  query: Readonly<{
    data: unknown;
    isError: boolean;
  }>,
  blockingLoadError: BlockingLoadErrorState | null,
  dataUpdatedAt: number,
  failureCopy: string
): string | null {
  const blockingLoadErrorMessage = getBlockingLoadErrorMessage(blockingLoadError, dataUpdatedAt);
  if (blockingLoadErrorMessage !== null) {
    return blockingLoadErrorMessage;
  }

  if (query.isError && query.data === undefined) {
    return failureCopy;
  }

  return null;
}
```

2. **Replace the cohorts modal function** (`ManageCohortsModal.tsx`, lines 102–119):

Delete the entire `getCohortsLoadError` function and replace the call site at line 499–503:

**From**:

```typescript
const loadError = getCohortsLoadError(cohortsQuery, blockingLoadError, cohortsQuery.dataUpdatedAt);
```

**To**:

```typescript
const loadError = getReferenceDataLoadError(
  cohortsQuery,
  blockingLoadError,
  cohortsQuery.dataUpdatedAt,
  cohortsLoadFailureCopy
);
```

3. **Replace the year-groups modal function** (`ManageYearGroupsModal.tsx`, lines 100–120):

Delete the entire `getYearGroupsLoadError` function and replace the call site at line 419–423:

**From**:

```typescript
const loadError = getYearGroupsLoadError(
  yearGroupsQuery,
  blockingLoadError,
  yearGroupsQuery.dataUpdatedAt
);
```

**To**:

```typescript
const loadError = getReferenceDataLoadError(
  yearGroupsQuery,
  blockingLoadError,
  yearGroupsQuery.dataUpdatedAt,
  yearGroupsLoadFailureCopy
);
```

4. **Update imports in both modal files**:

In both `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx`, update the import from `manageReferenceDataHelpers` to include the new function:

**From**:

```typescript
import {
  clearPersistedBlockingLoadError,
  getBlockingLoadErrorMessage,
  getDeleteErrorMessage,
  getPersistedBlockingLoadError,
  getReferenceDataBlockingLoadErrorQueryKey,
  isInUseError,
  refetchRequiredReferenceDataQuery,
  setPersistedBlockingLoadError,
  syncReferenceDataModalBusyState,
  type BlockingLoadErrorState,
} from './manageReferenceDataHelpers';
```

**To**:

```typescript
import {
  clearPersistedBlockingLoadError,
  getBlockingLoadErrorMessage,
  getDeleteErrorMessage,
  getPersistedBlockingLoadError,
  getReferenceDataBlockingLoadErrorQueryKey,
  getReferenceDataLoadError,
  isInUseError,
  refetchRequiredReferenceDataQuery,
  setPersistedBlockingLoadError,
  syncReferenceDataModalBusyState,
  type BlockingLoadErrorState,
} from './manageReferenceDataHelpers';
```

#### Validation after fix

After making these changes, run:

```bash
npm run frontend:lint
npm run frontend:test
```

Both should pass with the same results (0 lint errors, 392 tests passing). The test files for both modals should continue to pass because the logic is identical — only the location has changed.

---

## Improvement Findings

### [IMPROVEMENT #2] Single-use helper cluster in `useBackendSettings.ts`

**Priority**: Should fix before merge or in a follow-up cleanup  
**Impact**: Code clarity; these three helpers add a rename pass and type declarations for relatively simple operations

#### Evidence

Three functions in `src/frontend/src/features/settings/backend/useBackendSettings.ts` are each called exactly once:

**Function 1: `isBackendSettingsRefreshing` (lines 116–118)**

```typescript
type BackendSettingsRefreshQueryState = Readonly<{
  isFetching: boolean;
  isPending: boolean;
}>;

function isBackendSettingsRefreshing(queryState: BackendSettingsRefreshQueryState): boolean {
  return queryState.isFetching && !queryState.isPending;
}
```

**Call site** (line 317):

```typescript
const isRefreshing = isBackendSettingsRefreshing(backendConfigQuery);
```

**Function 2: `shouldSkipBackendSettingsSave` (lines 189–199)**

```typescript
function shouldSkipBackendSettingsSave(
  dependencies: Readonly<{
    backendSettingsFormValues: BackendSettingsForm | null;
    isSaveBlocked: boolean;
    isSaving: boolean;
  }>
): boolean {
  return (
    dependencies.isSaving ||
    dependencies.isSaveBlocked ||
    dependencies.backendSettingsFormValues === null
  );
}
```

**Call site** (line 257):

```typescript
if (shouldSkipBackendSettingsSave({ backendSettingsFormValues, isSaveBlocked, isSaving })) {
  return;
}
```

**Function 3: `applyPersistBackendSettingsOutcome` (lines 208–232)**

```typescript
function applyPersistBackendSettingsOutcome(
  outcome: PersistBackendSettingsOutcome,
  dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    message: ReturnType<typeof App.useApp>['message'];
    queryClient: ReturnType<typeof useQueryClient>;
    setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>;
    setSaveError: Dispatch<SetStateAction<string | null>>;
  }>
): void {
  if (outcome.status === 'save-error') {
    dependencies.setSaveError(outcome.saveError);
    return;
  }

  if (outcome.status === 'refresh-failure') {
    dependencies.setBlockingLoadErrorState({
      dataUpdatedAt:
        dependencies.queryClient.getQueryState(dependencies.backendConfigQueryOptions.queryKey)
          ?.dataUpdatedAt ?? 0,
      message: outcome.loadError,
    });
    return;
  }

  dependencies.message.success('Backend settings saved.');
}
```

**Call site** (line 274–281):

```typescript
applyPersistBackendSettingsOutcome(outcome, {
  backendConfigQueryOptions,
  message,
  queryClient,
  setBlockingLoadErrorState,
  setSaveError,
});
```

#### Why this is slop

Each helper is called exactly once. In the original code before this branch:

- The refresh check was the inline expression `query.isFetching && !query.isPending`
- The save guard was an inline `if` statement
- The outcome application was a direct if-tree inside `persistBackendSettings`

These refactorings introduced:

1. Additional type declarations (`BackendSettingsRefreshQueryState`, `PersistBackendSettingsOutcome`)
2. A wrapper function + Dependencies object for a 3-clause guard
3. An extracted outcome dispatcher that requires passing 5 state setters as a dependencies object

The code is functionally correct, but it trades direct readability for a false sense of modularity. The helper names are descriptive, but since they are called exactly once, inlining them would **reduce** indirection without losing clarity.

#### Recommended fix

**Option A** (Recommended): Inline all three helpers back into their call sites.

1. **Remove `isBackendSettingsRefreshing`** from line 116–118
2. **Remove the `BackendSettingsRefreshQueryState` type** from line 105–108
3. **Replace line 317** from:

   ```typescript
   const isRefreshing = isBackendSettingsRefreshing(backendConfigQuery);
   ```

   To:

   ```typescript
   const isRefreshing = backendConfigQuery.isFetching && !backendConfigQuery.isPending;
   ```

4. **Remove `shouldSkipBackendSettingsSave`** from line 189–199
5. **Replace line 257** from:

   ```typescript
   if (shouldSkipBackendSettingsSave({ backendSettingsFormValues, isSaveBlocked, isSaving })) {
     return;
   }
   ```

   To:

   ```typescript
   if (isSaving || isSaveBlocked || backendSettingsFormValues === null) {
     return;
   }
   ```

6. **Remove `applyPersistBackendSettingsOutcome`** from line 208–232
7. **Remove the `PersistBackendSettingsOutcome` type** from line 14–23 (the union type)
8. **Replace lines 274–281** in the `persistBackendSettings` function from:
   ```typescript
   applyPersistBackendSettingsOutcome(outcome, {
     backendConfigQueryOptions,
     message,
     queryClient,
     setBlockingLoadErrorState,
     setSaveError,
   });
   ```
   To an inline if-tree:
   ```typescript
   if (outcome.status === 'save-error') {
     setSaveError(outcome.saveError);
   } else if (outcome.status === 'refresh-failure') {
     setBlockingLoadErrorState({
       dataUpdatedAt:
         queryClient.getQueryState(backendConfigQueryOptions.queryKey)?.dataUpdatedAt ?? 0,
       message: outcome.loadError,
     });
   } else {
     message.success('Backend settings saved.');
   }
   ```

**Option B** (Keep as is): Accept the added abstraction layer. These helpers do make the code more testable and the function signatures are well-documented. If they will be called from other modules in the future, the investment in the abstraction is justified.

**Recommended approach**: Option A. The indirection cost is higher than the testability benefit here, since the helpers are not reused and the inlined code is still clear.

#### Validation after fix

After inlining:

```bash
npm run frontend:lint
npm run frontend:test
```

The tests should still pass (392/392) because the logic remains identical.

---

### [IMPROVEMENT #3] Single-use helper in `BackendSettingsPanel.tsx`

**Priority**: Low; can be addressed in same cleanup pass as #2 or deferred  
**Impact**: Minor code clarity

#### Evidence

**File**: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`, lines 231–244

```typescript
type BackendSettingsSaveButtonState = Readonly<{
  disabled: boolean;
  loading: boolean;
}>;

function getBackendSettingsSaveButtonState(
  state: Readonly<{
    isRefreshing: boolean;
    isSaveBlocked: boolean;
    isSaving: boolean;
  }>
): BackendSettingsSaveButtonState {
  return {
    disabled: state.isSaveBlocked || state.isSaving || state.isRefreshing,
    loading: state.isSaving && !state.isRefreshing,
  };
}
```

**Call site** (line 275):

```typescript
const saveButtonState = getBackendSettingsSaveButtonState({
  isRefreshing,
  isSaveBlocked,
  isSaving,
});
```

**Usage** (lines 647–648):

```typescript
<Button
  loading={saveButtonState.loading}
  disabled={saveButtonState.disabled}
  type="primary"
>
```

#### Why this is slop

The helper is called exactly once and wraps two boolean expressions. The type `BackendSettingsSaveButtonState` is used only here. Inlining the two conditions directly on the `Button` props is equally clear and reduces the abstraction layer.

#### Recommended fix

1. **Remove the type definition** (lines 231–235)
2. **Remove the function** (lines 237–244)
3. **Remove the `saveButtonState` constant** (line 275)
4. **Replace lines 647–648** from:
   ```typescript
   <Button
     loading={saveButtonState.loading}
     disabled={saveButtonState.disabled}
     type="primary"
   >
   ```
   To:
   ```typescript
   <Button
     loading={isSaving && !isRefreshing}
     disabled={isSaveBlocked || isSaving || isRefreshing}
     type="primary"
   >
   ```

#### Validation after fix

```bash
npm run frontend:lint
npm run frontend:test
```

Tests should pass (392/392). The logic is identical.

---

### [IMPROVEMENT #4] Redundant `.settings-page-content--classes` CSS modifier

**Priority**: Low; decide direction before final merge  
**Impact**: Code clarity; prevents future confusion about tab-specific styling

#### Evidence

**File**: `src/frontend/src/index.css`, lines 89–96

```css
.settings-page-content {
  width: min(var(--app-page-width-wide-data), calc(100% - 1rem));
}

.settings-page-content--classes {
  width: min(var(--app-page-width-wide-data), calc(100% - 1rem));
}
```

Both selectors declare **identical width rules**. The modifier class adds no visual differentiation.

**Usage in `SettingsPage.tsx`** (lines 89–90):

```typescript
const settingsPageContentClassName =
  activeTabKey === 'classes'
    ? 'settings-page-content settings-page-content--classes'
    : 'settings-page-content';
```

The classes tab applies both `settings-page-content` and `settings-page-content--classes`. The modifier provides no override because it declares the same width.

**Test expectation** (`SettingsPage.spec.tsx`, line 143):

```typescript
expect(settingsPageContent).toHaveClass('settings-page-content--classes');
```

#### Why this is slop

The modifier class is misleading. A reader might assume it provides a distinct width (as its name suggests), when in fact it provides no differentiation. The class costs nothing to keep, but it creates a maintenance trap:

- A future developer reading the CSS might think the classes tab has a different width
- A future feature request for "wider classes tab" might result in duplicated work, not realizing the modifier already exists
- Tests expect the modifier class, but don't verify it has any effect

#### Recommended fix — Option A (Remove the modifier)

**Simpler, clearer**: Delete the modifier CSS rule and inline the base class in `SettingsPage.tsx`.

1. **Delete lines 93–96 from `src/frontend/src/index.css`**:

   ```css
   /* DELETE THESE LINES */
   .settings-page-content--classes {
     width: min(var(--app-page-width-wide-data), calc(100% - 1rem));
   }
   ```

2. **Simplify `SettingsPage.tsx` lines 89–90** from:

   ```typescript
   const settingsPageContentClassName =
     activeTabKey === 'classes'
       ? 'settings-page-content settings-page-content--classes'
       : 'settings-page-content';
   ```

   To:

   ```typescript
   const settingsPageContentClassName = 'settings-page-content';
   ```

   Or even inline it at the call site (line 97):

   ```typescript
   contentClassName = 'settings-page-content';
   ```

3. **Update `SettingsPage.spec.tsx` line 143** from:

   ```typescript
   expect(settingsPageContent).toHaveClass('settings-page-content--classes');
   ```

   To:

   ```typescript
   expect(settingsPageContent).toHaveClass('settings-page-content');
   ```

4. **Update `SettingsPage.spec.tsx` line 166** from:
   ```typescript
   const classesPageRuleBlock = getCssRuleBlock('.settings-page-content--classes');
   ```
   To:
   ```typescript
   const classesPageRuleBlock = getCssRuleBlock('.settings-page-content');
   ```

#### Recommended fix — Option B (Keep as an override point)

**If the modifier is meant as a future override point**, add a clarifying comment:

```css
.settings-page-content--classes {
  /* Modifier reserved as an explicit override point for classes-tab-specific width.
     Currently inherits the same width as the base class. */
  width: min(var(--app-page-width-wide-data), calc(100% - 1rem));
}
```

**Recommended approach**: Option A. Unused modifiers create confusion. If a future feature requires a distinct classes-tab width, the modifier can be added then with an explicit justification.

#### Validation after fix

```bash
npm run frontend:lint
npm run frontend:test
```

Tests should pass (392/392). Both options preserve the visual result.

---

## Nitpick Findings

### [NITPICK #5] Redundant parentheses in modal `isRefreshing` derivation

**Files**:

- `src/frontend/src/features/classes/ManageCohortsModal.tsx`, line 478
- `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`, line 399

**Evidence**:

```typescript
const isRefreshing = !isInitialLoading && cohortsQuery.isFetching;
```

The parentheses around `cohortsQuery` are unnecessary and suggest an editing artefact.

**Fix**: Remove the parentheses:

```typescript
const isRefreshing = !isInitialLoading && cohortsQuery.isFetching;
```

---

### [NITPICK #6] Over-named constant in `appStylesRaw.ts`

**File**: `src/frontend/src/test/appStylesRaw.ts`, lines 5 and 24

```typescript
const notFoundIndex = -1;
// ...
if (ruleBlockEnd === notFoundIndex) {
```

The constant `notFoundIndex = -1` is used once as a sentinel for `.indexOf()`. The literal `-1` is idiomatic and universally recognized. The named alias adds no semantic clarity.

**Fix**: Remove the constant and use the literal directly:

```typescript
// DELETE: const notFoundIndex = -1;

// Line 24, FROM:
if (ruleBlockEnd === notFoundIndex) {

// TO:
if (ruleBlockEnd === -1) {
```

---

### [NITPICK #7] Double blank line in `useBackendSettings.ts`

**File**: `src/frontend/src/features/settings/backend/useBackendSettings.ts`, between lines 119 and 120

There is an extra blank line between the `isBackendSettingsRefreshing` function and the JSDoc comment for `refetchRequiredBackendConfig`. Reduce to a single blank line.

---

## Summary of Cleanup Work

### Must Fix (Blocking)

- **Critical #1**: Extract `getReferenceDataLoadError` to `manageReferenceDataHelpers.ts` and dedup both modal files
  - **Files to edit**:
    - `src/frontend/src/features/classes/manageReferenceDataHelpers.ts` (add 1 function)
    - `src/frontend/src/features/classes/ManageCohortsModal.tsx` (remove 1 function, update 1 call, update imports)
    - `src/frontend/src/features/classes/ManageYearGroupsModal.tsx` (remove 1 function, update 1 call, update imports)
  - **Estimated impact**: 2 functions removed, 1 shared function added, 0 logic changes

### Should Fix (Before Merge)

- **Improvement #2**: Inline single-use helpers in `useBackendSettings.ts`
  - **Files to edit**: `src/frontend/src/features/settings/backend/useBackendSettings.ts`
  - **Changes**: Remove 3 functions + 1 type, inline ~8 lines of code, reduce cognitive load
- **Improvement #3**: Inline single-use helper in `BackendSettingsPanel.tsx`
  - **Files to edit**: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
  - **Changes**: Remove 1 type + 1 function, inline 2 Boolean expressions

- **Improvement #4**: Remove or clarify CSS modifier `.settings-page-content--classes`
  - **Files to edit**: `src/frontend/src/index.css`, `src/frontend/src/pages/SettingsPage.tsx`, `src/frontend/src/pages/SettingsPage.spec.tsx`
  - **Changes**: Delete 4 lines of CSS + 2 test assertions (Option A) or add 1 comment (Option B)

### Can Defer (Cosmetic)

- **Nitpick #5**: Remove redundant parentheses (2 occurrences)
- **Nitpick #6**: Remove named `-1` constant (1 occurrence)
- **Nitpick #7**: Reduce double blank line to single (1 occurrence)

---

## Validation Checklist

After applying fixes, run in sequence:

```bash
# Lint check
npm run frontend:lint

# Unit tests (should be 392 passing)
npm run frontend:test

# TypeScript check
npm exec tsc -- -b src/frontend/tsconfig.json
```

All three commands must exit with code 0 and report no new errors.

---

## Risk Assessment

**Risk of Critical #1 (Dedup helpers)**: **Very Low**  
The extracted helper is a pure logic refactor with identical unit test coverage. Both modals already have passing tests for the same logic.

**Risk of Improvement #2 (Inline useBackendSettings helpers)**: **Very Low**  
Inlining removes layers but preserves all logic. All 392 tests will exercise the inlined code paths.

**Risk of Improvement #3 (Inline BackendSettingsPanel helper)**: **Very Low**  
Two boolean expressions on `Button` props are more readable than a wrapper function.

**Risk of Improvement #4 (CSS modifier)**: **Low**  
Visual output is identical either way. Tests will verify CSS class application.

---

## Files Modified in This Review

None — this document is a planning artifact for cleanup work. The actual fixes should be applied by an agent delegated the cleanup task.
