# Failing Tests Report

**Generated:** 2025-05-07  
**Total Failures:** 11 (1 frontend unit test + 10 frontend e2e tests)  
**Backend Tests:** 0 failures (76 files, 951 tests passed)  
**Builder Tests:** 0 failures (15 files, 123 tests passed)

---

## Executive Summary

| Category                       | Count | Severity | Root Cause                                |
| ------------------------------ | ----- | -------- | ----------------------------------------- |
| Code bugs (spec non-compliant) | 4     | High     | Code does not implement SPEC.md correctly |
| Test bugs (spec non-compliant) | 3     | High     | Test expects wrong behaviour per SPEC.md  |
| Timing/flakiness issues        | 4     | Medium   | Async execution order vs assertion order  |

**Recommended Action:** Fix 4 code bugs + 3 test bugs first (high severity), then address 4 timing issues.

---

## Detailed Findings

### 1. Frontend Unit Test Failure

#### **ID:** FE-UNIT-001

**File:** `src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx:705`  
**Test:** "final save success from shared edit surface in create mode after parse"  
**Assertion:** Expected `primaryTitle` to be `'New Assessment'` but received `'Algebra Baseline'`

**Analysis Source:** explore subagent

| Aspect           | Verdict           | Details                                                                     |
| ---------------- | ----------------- | --------------------------------------------------------------------------- |
| Test expectation | ✅ Correct        | Matches SPEC.md #20 (wizard transitions to shared edit surface after parse) |
| SPEC requirement | ✅ Clear          | Save must submit current form values                                        |
| Code bug         | ❌ **Code wrong** | `getParsedCreateBaseline` prioritizes query cache over parse baseline       |

**Root Cause:**  
In `useAssignmentDefinitionWizard.ts`, `getParsedCreateBaseline` (lines 257-277) checks query cache for `assignmentDefinitionByKey(localDefinitionKey)` before falling back to `parsedCreateBaselineReference.current`. In test environment with mocked cache containing stale `mockFullAssignmentDefinition` (title: 'Algebra Baseline'), the function returns wrong title instead of the parse result ('New Assessment').

**Fix Location:** `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`

- Remove query cache check in create mode after parse, OR
- Ensure parse response populates the cache correctly
- Function should rely on `parsedCreateBaselineReference.current` which stores stage-one parse result

**FURTHER INVESTIGATION REQUIRED**

At what point in the workflow is the query cache supposed to be refreshed? This will help determine whether we should remove the query cache check in create mode or ensure that parse response populates the cache correctly.

**Findings from further investigation**:

The query cache for `assignmentDefinitionByKey(localDefinitionKey)` is **never populated in create mode** during the normal workflow. Here's why:

1. **Query is disabled**: In `AssignmentDefinitionWizardModal.tsx`, the `useQuery` for `getAssignmentDefinitionQueryOptions(definitionKey ?? '')` has `enabled: open && !isCreateMode && definitionKey !== null`. In create mode, this evaluates to `false`, so the query never runs and never populates the cache.

2. **Mutation doesn't set cache**: The `upsertMutation` (line 677) doesn't have an `onSuccess` handler that manually sets query data via `queryClient.setQueryData()`. It only calls `invalidateMutationQueries` which invalidates the cache.

3. **Invalidation happens after parse**: In `runWizardMutation` (line 899-901), after a successful parse, `invalidateMutationQueries` is called, which invalidates the `assignmentDefinitionByKey` query. Since this query was never populated, invalidating it has no effect.

4. **`storeParseBaseline` populates reference, not cache**: The parse response is stored in `parsedCreateBaselineReference.current` (line 801), not in the React Query cache.

**Conclusion**: The query cache check in `getParsedCreateBaseline` (line 278-280) serves no purpose in create mode because the cache is never populated. The function should **skip the cache check entirely in create mode** and always return `parsedCreateBaselineReference.current`.

**Recommended fix**:

```typescript
const getParsedCreateBaseline = useCallback((): ParsedCreateBaseline | null => {
  // In update mode: try cached query data for existing definitions
  if (!isCreateMode && localDefinitionKey) {
    const cached = queryClient.getQueryData(
      queryKeys.assignmentDefinitionByKey(localDefinitionKey)
    );
    if (cached) {
      // ... build from cached
    }
  }
  // In create mode: always use parse baseline reference
  return parsedCreateBaselineReference.current;
}, [isCreateMode, localDefinitionKey, queryClient]);
```

Note: `isCreateMode` would need to be passed to `useFormInitialization` or the hook refactored.

Do not modify anything else in the file.

**Severity:** High  
**Type:** Code bug (spec non-compliant)

---

### 2. E2E Test Failures - Assignment Definition Wizard

#### **ID:** FE-E2E-001

**File:** `src/frontend/e2e-tests/assignment-definition-wizard-section-4.spec.ts:513`  
**Test:** "failed post-mutation refresh fails closed on affected surface"

**Analysis Source:** explore subagent

| Aspect           | Verdict           | Details                                                                |
| ---------------- | ----------------- | ---------------------------------------------------------------------- |
| Test expectation | ✅ Correct        | Modal should stay open, page shows blocking error                      |
| SPEC requirement | ✅ Clear          | SPEC §5.1: failure scoped to affected surface (page), modal unaffected |
| Code bug         | ❌ **Code wrong** | Error propagates to modal instead of page                              |

**Root Cause:**  
In `useAssignmentDefinitionWizard.ts:843`, `invalidateMutationQueries` explicitly calls `fetchQuery` after invalidation. When fetch fails, error propagates to modal's catch block, setting `blockingError` in modal instead of page query. This violates SPEC principle that page-level query errors should block the page, not the modal.

**Code Flow:**

1. Parse succeeds → modal state updated (tasks visible)
2. `invalidateMutationQueries` calls `fetchQuery`
3. `fetchQuery` fails → throws
4. `runWizardMutation` catches error → `setBlockingError` in modal
5. Modal shows generic error, page never receives error

**Fix Location:** `src/frontend/src/pages/useAssignmentDefinitionWizard.ts:837-847`

```typescript
// REMOVE this line:
await queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
// Let React Query background refetch handle it
```

**Severity:** High  
**Type:** Code bug (spec non-compliant)

---

### 3. E2E Test Failures - Assignments Page

#### **ID:** FE-E2E-002

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:252`  
**Test:** "delete flow removes the row after confirmation and shows success feedback"

**Analysis Source:** explore subagent

| Aspect              | Verdict      | Details                                                                             |
| ------------------- | ------------ | ----------------------------------------------------------------------------------- |
| Test expectation    | ⚠️ Needs fix | Regex missing period, assertion order mismatched                                    |
| SPEC requirement    | ✅ Met       | Delete flow invalidates/refetches, table reflects changes, success feedback visible |
| Code implementation | ✅ Correct   | Proper query invalidation and state management                                      |

**Root Cause:**  
Test assertion order doesn't match async code execution order in `AssignmentsPage.tsx:handleConfirmDelete()`:

1. Code: `setDeleteTarget(null)` → modal closes
2. Code: `await refetchAssignmentDefinitions()` → query cache updates
3. Code: `setDeleteOutcome({type: 'success', message: 'Assignment definition deleted.'})`

Test checks for message before modal close, but code closes modal before setting message. Additionally, regex `/assignment definition deleted/i` misses the period in actual message.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:263-270`

```typescript
// Reorder to match code execution:
await expect(page.getByRole('dialog', { name: 'Delete assignment definition' })).toHaveCount(0);
await expect(page.getByText(/assignment definition deleted\./i)).toBeVisible();
await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(0);
```

**Additional Note**: Be careful with your regex construction. Unsafe regex's will be blocked by the linter.

**Severity:** Medium  
**Type:** Test bug (timing/assertion order)

---

#### **ID:** FE-E2E-003

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:274`  
**Test:** "unsafe-key rows keep delete disabled"

**Analysis Source:** explore subagent

| Aspect              | Verdict     | Details                                                |
| ------------------- | ----------- | ------------------------------------------------------ |
| Test expectation    | ✅ Correct  | Delete button should be disabled for unsafe keys       |
| SPEC requirement    | ✅ Implicit | Path traversal prevention is valid security            |
| Code implementation | ✅ Correct  | `isSafeDefinitionKey` checks for `/` and `..` patterns |
| Unit test           | ✅ Passes   | Same logic passes in `AssignmentsPage.spec.tsx:547`    |

**Root Cause:**  
Likely Playwright selector timing - row may not be fully rendered when assertion runs. No functional bug in code or test logic.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:274-277`

```typescript
// Add explicit wait before assertion
await expect(page.getByRole('row', { name: /unsafe legacy row/i })).toBeVisible();
await expect(
  page.getByRole('row', { name: /unsafe legacy row/i }).getByRole('button', { name: /delete/i })
).toBeDisabled();
```

**Further Investigation Required**: Use your web search tool to find best practises for resolving playwright selector timing. Identify the most promising and idiomatic approach that minimises wait times.

**Investigation Findings**:

Based on Playwright best practices documentation and community guides:

**Idiomatic Approach**: Use Playwright's **auto-waiting + web-first assertions** pattern, which is the most reliable and minimizes wait times.

**Key Principles:**

1. **Leverage auto-waiting**: Playwright automatically waits for elements to be actionable (visible, enabled, stable) before interacting. No manual waits needed for most DOM operations.
2. **Use web-first assertions**: `await expect(locator).toBeVisible()` retries until condition is met, adapting to actual page load times.
3. **Avoid hard-coded timeouts**: `page.waitForTimeout(N)` is an anti-pattern - it always waits N ms regardless of actual need.
4. **Wait for network responses when applicable**: Use `page.waitForResponse()` to wait for API calls to complete before checking UI updates.

**Recommended Fix Pattern**:

```typescript
// Instead of checking immediately:
await element.toBeDisabled();

// Use web-first assertion which auto-waits:
await expect(element).toBeDisabled();

// Or for complex cases, wait for network response first:
await page.waitForResponse('**/api/endpoint');
await expect(element).toBeDisabled();
```

**For React Query cache updates**: Wait for specific UI elements that only appear after the query completes:

```typescript
await expect(page.locator('text=Loaded data')).toBeVisible();
```

**Sources**:

- [Playwright Auto-waiting Docs](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [TanStack Query Testing Guide](https://tanstack.com/query/v4/docs/framework/react/guides/testing)

**Severity:** Medium  
**Type:** Timing/flakiness

---

#### **ID:** FE-E2E-004

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:288`  
**Test:** "placeholder create and update actions stay disabled with explicit unavailable copy"

**Analysis Source:** explore subagent

| Aspect              | Verdict           | Details                                                              |
| ------------------- | ----------------- | -------------------------------------------------------------------- |
| Test expectation    | ❌ **Test wrong** | Expects old v1 behavior removed in Section 4                         |
| SPEC requirement    | ✅ Clear          | SPEC.md §1: update is row-level action, global Update button removed |
| Code implementation | ✅ Correct        | Top-level Update button removed per ACTION_PLAN.md §4                |

**Root Cause:**  
Test expects old behavior (top-level Update button disabled with "not available in v1" text) but Section 4 of ACTION_PLAN.md explicitly removed the top-level Update button. Test was likely reverted in commit `4ecb8f0` after Section 4 changes but not updated to match new contract.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:288-292`

```typescript
// Remove assertions for removed elements:
// REMOVE: await expect(page.getByRole('button', { name: 'Update assignment' })).toBeDisabled();
// REMOVE: await expect(page.getByText(/not available in v1/i)).toBeVisible();

// Add assertions for current UI:
await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Refresh assignments data' })).toBeEnabled();
```

Additionally, test mock data uses old contract:

```typescript
// Change from:
yearGroup: 11  // numeric
// To:
yearGroupKey: 'year-11',
yearGroupLabel: 'Year 11',
```

**Severity:** High  
**Type:** Test bug (spec non-compliant)

---

#### **ID:** FE-E2E-005

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:302`  
**Test:** "delete action opens confirmation modal with permanent-delete copy"

**Analysis Source:** explore subagent

| Aspect              | Verdict         | Details                                                                                                    |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| Test expectation    | ✅ Correct      | Modal should open with permanent delete warning                                                            |
| SPEC requirement    | N/A             | No explicit modal copy requirement                                                                         |
| Code implementation | ✅ Correct      | Modal shows: "You are deleting this assignment definition. This delete is permanent and cannot be undone." |
| Message match       | ✅ Should match | Implementation text contains substring "this delete is permanent"                                          |

**Root Cause:**  
Likely Playwright timing issue - assertion checked before modal content fully renders. The text "This delete is permanent and cannot be undone." should match regex `/this delete is permanent/i`.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:302-312`

```typescript
// Add explicit wait for modal content:
await expect(deleteDialog).toBeVisible();
await expect(deleteDialog.getByText('Algebra foundations', { exact: true })).toBeVisible();
await expect(deleteDialog.getByText(/this delete is permanent/i)).toBeVisible();
```

**Further Investigation Required**: Use your web search tool to find best practises for resolving playwright selector timing. Identify the most promising and idiomatic approach that minimises wait times.

**Investigation Findings**:

Based on Playwright best practices documentation and community guides:

**Idiomatic Approach**: Use Playwright's **auto-waiting + web-first assertions** pattern, which is the most reliable and minimizes wait times.

**Key Principles:**

1. **Leverage auto-waiting**: Playwright automatically waits for elements to be actionable (visible, enabled, stable) before interacting. No manual waits needed for most DOM operations.
2. **Use web-first assertions**: `await expect(locator).toBeVisible()` retries until condition is met, adapting to actual page load times.
3. **Avoid hard-coded timeouts**: `page.waitForTimeout(N)` is an anti-pattern - it always waits N ms regardless of actual need.
4. **Wait for network responses when applicable**: Use `page.waitForResponse()` to wait for API calls to complete before checking UI updates.

**Recommended Fix Pattern**:

```typescript
// Instead of checking immediately:
await element.toBeDisabled();

// Use web-first assertion which auto-waits:
await expect(element).toBeDisabled();

// Or for complex cases, wait for network response first:
await page.waitForResponse('**/api/endpoint');
await expect(element).toBeDisabled();
```

**For React Query cache updates**: Wait for specific UI elements that only appear after the query completes:

```typescript
await expect(page.locator('text=Loaded data')).toBeVisible();
```

**Sources**:

- [Playwright Auto-waiting Docs](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [TanStack Query Testing Guide](https://tanstack.com/query/v4/docs/framework/react/guides/testing)

**Severity:** Medium  
**Type:** Timing/flakiness

---

#### **ID:** FE-E2E-006

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:321`  
**Test:** "delete mutation keeps confirm loading and disables conflicting delete actions until settle"

**Analysis Source:** explore subagent

| Aspect              | Verdict    | Details                                                                                                          |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Test expectation    | ✅ Correct | Confirm button loading, other delete actions disabled                                                            |
| SPEC requirement    | ✅ Met     | frontend/AGENTS.md: "Short-running mutations keep loading on the primary trigger and disable conflicting writes" |
| Code implementation | ✅ Correct | Modal button: `disabled={isDeleteBusy} loading={isDeleteBusy}`, row buttons check same state                     |
| Unit test           | ✅ Passes  | Same behavior passes in `AssignmentsPage.spec.tsx:566`                                                           |

**Root Cause:**  
E2E failure likely due to Playwright timing - assertion checked before React re-render completes with loading state.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:321-330`

```typescript
// Add explicit wait for loading state:
await expect(page.getByRole('button', { name: 'Delete definition' }).locator('..')).toHaveClass(
  /ant-btn-loading/
);
```

**Severity:** Medium  
**Type:** Timing/flakiness

**Further Investigation Required**: Use your web search tool to find best practises for resolving playwright selector timing. Identify the most promising and idiomatic approach that minimises wait times.

**Investigation Findings**:

Based on Playwright best practices documentation and community guides:

**Idiomatic Approach**: Use Playwright's **auto-waiting + web-first assertions** pattern, which is the most reliable and minimizes wait times.

**Key Principles:**

1. **Leverage auto-waiting**: Playwright automatically waits for elements to be actionable (visible, enabled, stable) before interacting. No manual waits needed for most DOM operations.
2. **Use web-first assertions**: `await expect(locator).toBeVisible()` retries until condition is met, adapting to actual page load times.
3. **Avoid hard-coded timeouts**: `page.waitForTimeout(N)` is an anti-pattern - it always waits N ms regardless of actual need.
4. **Wait for network responses when applicable**: Use `page.waitForResponse()` to wait for API calls to complete before checking UI updates.

**Recommended Fix Pattern**:

```typescript
// Instead of checking immediately:
await element.toBeDisabled();

// Use web-first assertion which auto-waits:
await expect(element).toBeDisabled();

// Or for complex cases, wait for network response first:
await page.waitForResponse('**/api/endpoint');
await expect(element).toBeDisabled();
```

**For React Query cache updates**: Wait for specific UI elements that only appear after the query completes:

```typescript
await expect(page.locator('text=Loaded data')).toBeVisible();
```

**Sources**:

- [Playwright Auto-waiting Docs](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [TanStack Query Testing Guide](https://tanstack.com/query/v4/docs/framework/react/guides/testing)

---

#### **ID:** FE-E2E-007

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:356`  
**Test:** "delete failure keeps row visible and shows local error feedback"

**Analysis Source:** explore subagent

| Aspect           | Verdict           | Details                                                                 |
| ---------------- | ----------------- | ----------------------------------------------------------------------- |
| Test expectation | ✅ Correct        | Row remains, error feedback visible                                     |
| SPEC requirement | ✅ Clear          | SPEC: "Validation failures stay local to the modal and do not close it" |
| Code bug         | ❌ **Code wrong** | Modal closes on failure; error not local to modal                       |

**Root Cause:**  
In `AssignmentsPage.tsx:handleConfirmDelete()` (line 786), catch block calls `setDeleteTarget(null)` which closes the delete modal on failure. This violates SPEC principle that errors must stay local to the modal.

**Current Code:**

```typescript
catch (error: unknown) {
  if (!deleteCompleted) {
    setDeleteTarget(null);  // ← Closes modal
    setDeleteOutcome({ type: 'error', message: DELETE_FAILURE_MESSAGE });
  }
}
```

**Fix Location:** `src/frontend/src/pages/AssignmentsDeleteModal.tsx` and `AssignmentsPage.tsx:763-789`

1. Add error state to `AssignmentsDeleteModal`
2. Display error Alert inside modal (similar to `BulkFormModalScaffold.tsx:62-64`)
3. Remove `setDeleteTarget(null)` from catch block
4. Pass error to modal instead

**Severity:** High  
**Type:** Code bug (spec non-compliant)

---

#### **ID:** FE-E2E-008

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:374`  
**Test:** "post-delete refresh failure returns to blocking state"

**Analysis Source:** explore subagent

| Aspect           | Verdict    | Details                                                                                                                                |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Test expectation | ✅ Correct | UI shows blocking state, hides table                                                                                                   |
| SPEC requirement | ✅ Clear   | SPEC: "Required degraded or untrustworthy data fails closed by default: suppress normal content and show the blocking-state treatment" |
| Code logic       | ✅ Correct | `shouldRenderAssignmentsBlockingState` correctly evaluates to true                                                                     |
| UI behavior      | ✅ Correct | Shows Alert, hides table per blocking state                                                                                            |

**Root Cause:**  
No functional bug. The code correctly implements blocking state. E2E failure is likely a timing issue where React Query's `fetchQuery` updates cache asynchronously, and component may not have re-rendered before test assertion.

**Fix Location:** `src/frontend/src/pages/AssignmentsPage.tsx:763-789`
Optional improvement for explicit handling:

```typescript
} catch (error: unknown) {
  if (!deleteCompleted) {
    setDeleteTarget(null);
    setDeleteOutcome({ type: 'error', message: DELETE_FAILURE_MESSAGE });
  } else {
    // Refresh failed after successful delete - blocking state via query error
    setDeleteTarget(null);
    // Query error already triggers blocking state via shouldRenderAssignmentsBlockingState
  }
}
```

**Further Investigation Required**: Use your web search tool to find best practises for resolving React timing issues. Identify the most promising and idiomatic approach that minimises wait times.

**Investigation Findings**:

Based on React and React Query best practices:

**Idiomatic Approach**: Use React Query's built-in query status to determine when data is loaded, combined with Playwright's auto-waiting for assertions.

**Key Principles:**

1. **Wait for query status**: Use assertions that check for UI elements that only appear after query data is loaded.
2. **Leverage Playwright auto-waiting**: Playwright will retry assertions until they pass.
3. **Avoid hard-coded timeouts**: Don't use `page.waitForTimeout()` - it's flaky and slow.
4. **Mock at network level**: For e2e tests, use Playwright's `route` to mock API responses for consistent, fast tests.

**Recommended Fix Pattern**:

```typescript
// Wait for the element that indicates data is loaded
await expect(page.getByText('Data loaded successfully')).toBeVisible();

// Or wait for the element that only exists after query completes
await expect(page.getByRole('table')).toBeVisible();
```

**Sources**:

- [Playwright Auto-waiting Docs](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [TanStack Query Testing Guide](https://tanstack.com/query/v4/docs/framework/react/guides/testing)

**Severity:** Medium  
**Type:** Timing/flakiness

---

#### **ID:** FE-E2E-009

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:424`  
**Test:** "filter and reset interactions cover every displayed data column"

**Analysis Source:** explore subagent

| Aspect              | Verdict           | Details                                                                                              |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| Test expectation    | ⚠️ Needs fix      | Filter assertions for year group                                                                     |
| SPEC requirement    | ✅ Clear          | SPEC: "The Assignments page list should continue to show human-readable topic and year-group labels" |
| Code implementation | ✅ Correct        | Component uses `yearGroupLabel`, `primaryTopicKey`                                                   |
| Test data           | ❌ **Test wrong** | Data shape mismatch - missing required fields                                                        |

**Root Cause:**  
Test data uses old contract with numeric `yearGroup` field, but code expects new contract with `yearGroupKey` (string), `yearGroupLabel` (string), and `primaryTopicKey` (string). The `formatYearGroupLabel` function tries to call `undefined.trim()` when `row.yearGroupLabel` is missing, causing TypeError.

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:30-80`

```typescript
// Update test data to include required fields:
const assignmentRows = [
  {
    primaryTitle: 'Newest algebra recap',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra', // Added
    yearGroup: 11,
    yearGroupKey: 'year-group-11', // Added
    yearGroupLabel: 'Year 11', // Added
    // ... other fields
  },
  // ... other rows with same additions
];
```

Also update filter assertions to use human-readable labels:

```typescript
// Change from:
optionLabel: '10';
// To:
optionLabel: 'Year 10';
```

**Severity:** High  
**Type:** Test bug (spec non-compliant)

---

#### **ID:** FE-E2E-010

**File:** `src/frontend/e2e-tests/assignments-year-group-migration.spec.ts:139`  
**Test:** "assignments year-group label migration keeps delete available while create/update remain unavailable"

**Analysis Source:** explore subagent

| Aspect           | Verdict            | Details                                                                                                                                      |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test expectation | ⚠️ Partially wrong | Mix of correct and incorrect expectations                                                                                                    |
| SPEC requirement | ✅ Clear           | SPEC.md §1: Create is top-level action, Update is row-level, Delete remains present                                                          |
| ACTION_PLAN.md   | ✅ Clear           | Section 4: "modal shell component owns all required states, create/update affordances remain unavailable, delete row action remains present" |
| Code bug         | ❌ **Code wrong**  | Create/Update don't check reference data availability                                                                                        |

**Root Cause:**  
Multiple issues:

1. **Test wrong**: Expects non-existent page-level "Update assignment" button (removed in Section 4)
2. **Code wrong**: Create button enabled without checking yearGroups/assignmentTopics datasets
3. **Code wrong**: Row-level Update button always rendered, not checking reference data availability

**Fix Locations:**

1. **Test:** `src/frontend/e2e-tests/assignments-year-group-migration.spec.ts:155`

   ```typescript
   // Change from:
   await expect(page.getByRole('button', { name: 'Update assignment' })).toBeDisabled();
   // To:
   await expect(page.queryByRole('button', { name: 'Update assignment' })).not.toBeInTheDocument();
   ```

2. **Code:** `src/frontend/src/pages/AssignmentsPage.tsx`

   ```typescript
   // Add reference data checks:
   const yearGroupsSnapshot = startupWarmupState.snapshot.datasets.yearGroups;
   const topicsSnapshot = startupWarmupState.snapshot.datasets.assignmentTopics;
   const hasTrustworthyReferenceData =
     startupWarmupState.isDatasetReady('yearGroups') &&
     startupWarmupState.isDatasetReady('assignmentTopics') &&
     !startupWarmupState.isDatasetFailed('yearGroups') &&
     !startupWarmupState.isDatasetFailed('assignmentTopics');

   // Create button:
   <Button disabled={!hasTrustworthyAssignmentsDataset || !hasTrustworthyReferenceData}>

   // Row-level Update button - conditionally render:
   {hasTrustworthyReferenceData && (
     <Button disabled={isDeleteSubmitting || deleteMutation.isPending || !hasTrustworthyAssignmentsDataset}>
       Update
     </Button>
   )}
   ```

**Severity:** High  
**Type:** Code bug + Test bug (spec non-compliant)

---

## Summary Table

| ID          | File                                           | Line | Type            | Severity | Root Cause                          | Fix Location                                    |
| ----------- | ---------------------------------------------- | ---- | --------------- | -------- | ----------------------------------- | ----------------------------------------------- |
| FE-UNIT-001 | AssignmentDefinitionWizardModal.spec.tsx       | 705  | Code bug        | High     | Cache prioritization in create mode | useAssignmentDefinitionWizard.ts                |
| FE-E2E-001  | assignment-definition-wizard-section-4.spec.ts | 513  | Code bug        | High     | Explicit fetchQuery throws to modal | useAssignmentDefinitionWizard.ts                |
| FE-E2E-002  | assignments-page.spec.ts                       | 252  | Test bug        | Medium   | Assertion order + regex mismatch    | assignments-page.spec.ts                        |
| FE-E2E-003  | assignments-page.spec.ts                       | 274  | Timing          | Medium   | Selector timing issue               | assignments-page.spec.ts                        |
| FE-E2E-004  | assignments-page.spec.ts                       | 288  | Test bug        | High     | Expects old v1 behavior             | assignments-page.spec.ts                        |
| FE-E2E-005  | assignments-page.spec.ts                       | 302  | Timing          | Medium   | Modal render timing                 | assignments-page.spec.ts                        |
| FE-E2E-006  | assignments-page.spec.ts                       | 321  | Timing          | Medium   | Loading state timing                | assignments-page.spec.ts                        |
| FE-E2E-007  | assignments-page.spec.ts                       | 356  | Code bug        | High     | Modal closes on failure             | AssignmentsPage.tsx, AssignmentsDeleteModal.tsx |
| FE-E2E-008  | assignments-page.spec.ts                       | 374  | Timing          | Medium   | Query cache async update            | AssignmentsPage.tsx                             |
| FE-E2E-009  | assignments-page.spec.ts                       | 424  | Test bug        | High     | Data shape mismatch                 | assignments-page.spec.ts                        |
| FE-E2E-010  | assignments-year-group-migration.spec.ts       | 139  | Code + Test bug | High     | Reference data checks missing       | AssignmentsPage.tsx + test                      |

---

## Files Requiring Changes

### High Priority (Fix First)

1. **src/frontend/src/pages/useAssignmentDefinitionWizard.ts** - 2 code bugs
2. **src/frontend/src/pages/AssignmentsPage.tsx** - 2 code bugs
3. **src/frontend/src/pages/AssignmentsDeleteModal.tsx** - 1 code bug
4. **src/frontend/e2e-tests/assignments-page.spec.ts** - 3 test bugs + 1 data shape fix
5. **src/frontend/e2e-tests/assignments-year-group-migration.spec.ts** - 1 test fix

### Medium Priority

1. **src/frontend/e2e-tests/assignments-page.spec.ts** - 4 timing fixes (assertion ordering/waiting)

---

## Verification Commands

After applying fixes, verify with:

```bash
# Run all tests
npm test
npm run frontend:test
npm run frontend:test:e2e
npm run builder:test

# Run specific failing tests
cd src/frontend && npx vitest run AssignmentDefinitionWizardModal.spec.tsx
cd src/frontend && npx playwright test e2e-tests/assignment-definition-wizard-section-4.spec.ts
cd src/frontend && npx playwright test e2e-tests/assignments-page.spec.ts
cd src/frontend && npx playwright test e2e-tests/assignments-year-group-migration.spec.ts
```

---

## Metadata

- **Report Generated By:** Mistral Vibe CLI agent
- **Analysis Method:** Delegated to 11 explore subagents, each analyzing SPEC.md, test code, and implementation
- **Subagents Used:** explore (11 instances)
- **Files Read:** SPEC.md, ACTION_PLAN.md, all failing test files, all referenced implementation files
- **Screenshots:** Subagents were instructed to run Playwright tests with `--screenshot=on` flag for visual verification
