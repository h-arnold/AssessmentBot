# Failing Tests Report

**Generated:** 2025-05-07 (Updated with Extra Scrutiny Findings)  
**Total Failures:** 11 (1 frontend unit test + 10 frontend e2e tests)  
**Backend Tests:** 0 failures (76 files, 951 tests passed)  
**Builder Tests:** 0 failures (15 files, 123 tests passed)

---

## Executive Summary - Updated with Extra Scrutiny

> **Note:** After initial fixes were applied, 11 NEW failures emerged. This section documents the findings from extra scrutiny analysis where each of the 11 current failures was re-analyzed by explore subagents against SPEC.md, ACTION_PLAN.md, and layout specs.

| Category                            | Count | Severity | Root Cause                                      |
| ----------------------------------- | ----- | -------- | ----------------------------------------------- |
| **Test bugs (spec non-compliant)**  | 5     | High     | Test assertions don't match SPEC behavior       |
| **Code bugs (spec non-compliant)**  | 4     | High     | Code doesn't implement SPEC correctly           |
| **Test bugs (data shape mismatch)** | 1     | High     | Test data uses old contract (numeric yearGroup) |
| **Code bugs (state management)**    | 1     | High     | Dual state sources causing race conditions      |

**Recommended Action:** Fix all 11 issues - 5 are test-only fixes, 6 require code changes.

---

## Extra Scrutiny Findings

> **Methodology:** Each failing test was delegated to an explore subagent with explicit instructions to read SPEC.md, ACTION_PLAN.md, relevant layout specs, the failing test file, and the implementation code. Each subagent determined whether the issue is with code, test, or both, based on whether behavior matches SPEC requirements.

### Classification Key

- ✅ **Test Correct / Code Wrong:** Test expectation matches SPEC, implementation is wrong
- ❌ **Test Wrong / Code Correct:** Test expects wrong behavior, implementation is correct
- ⚠️ **Both Wrong:** Both test and code need changes

---

## Detailed Findings from Extra Scrutiny

### 1. Frontend Unit Test Failure

#### **ID:** FE-UNIT-001-replica

**File:** `src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx:1114`  
**Test:** "create mode post-parse re-parse success preserves and resets task-row state"  
**Test Case:** 15 (newly added to replicate original FE-UNIT-001 flow)  
**Assertion:** `expect(within(taskTable).getByText('Task 1')).toBeInTheDocument()` fails

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect              | Verdict           | Details                                                                           |
| ------------------- | ----------------- | --------------------------------------------------------------------------------- |
| Test expectation    | ❌ **Test wrong** | Looks for 'Task 1' but mock provides 'Original Task 1'                            |
| SPEC requirement    | ✅ Clear          | SPEC.md: render persisted task titles from parsed task set                        |
| Code implementation | ✅ Correct        | No transformation; backend taskTitle values pass through unchanged                |
| Layout spec         | ✅ Clear          | ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md: Update mode renders persisted task titles |

**Root Cause:**  
Test assertion mismatch. The mock parse response in the test provides task titles as `'Original Task 1'` and `'Original Task 2'`, but the test asserts looking for `'Task 1'` and `'Task 2'`. Code correctly renders the mock values unchanged.

**Code Path:**  
`useAssignmentDefinitionWizard.ts:106-110` → `handleParseResponse` → `buildTaskRowsFromResponse` → `AssignmentDefinitionWizardModalShell.tsx:322` → Table `dataIndex='taskTitle'`. No title transformation occurs.

**Governing SPEC Sections:**

- **SPEC.md:** "After the first successful parse, the wizard uses the persisted parsed definition as the source of truth for the shared edit surface, including document URLs, metadata, and **task rows**."
- **ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md:** "Update mode should render **persisted task titles from the parsed task set** and keep those titles aligned with any successful re-parse result."

**Fix Location:** `src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx:1113-1114`

```typescript
// BEFORE (incorrect):
expect(within(taskTable).getByText('Task 1')).toBeInTheDocument();
expect(within(taskTable).getByText('Task 2')).toBeInTheDocument();

// AFTER (correct):
expect(within(taskTable).getByText('Original Task 1')).toBeInTheDocument();
expect(within(taskTable).getByText('Original Task 2')).toBeInTheDocument();
```

**Severity:** High  
**Type:** Test bug (assertion mismatch)

---

### 2. E2E Test Failures - Assignment Definition Wizard

#### **ID:** FE-E2E-001

**File:** `src/frontend/e2e-tests/assignment-definition-wizard-section-4.spec.ts:513`  
**Test:** "failed post-mutation refresh fails closed on affected surface"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect              | Verdict           | Details                                                                |
| ------------------- | ----------------- | ---------------------------------------------------------------------- |
| Test expectation    | ✅ Correct        | Modal stays open, page shows blocking error                            |
| SPEC requirement    | ✅ Clear          | SPEC §5.1: failure scoped to affected surface (page), modal unaffected |
| Code implementation | ❌ **Code wrong** | Error propagates to modal instead of page                              |

**Root Cause:**  
In `useAssignmentDefinitionWizard.ts:843`, `invalidateMutationQueries` explicitly calls `fetchQuery` after invalidation. When fetch fails, error propagates to modal's catch block, setting `blockingError` in modal instead of page query. This violates SPEC principle that page-level query errors should block the page, not the modal.

**Code Flow:**

1. Parse succeeds → modal state updated (tasks visible)
2. `invalidateMutationQueries` calls `fetchQuery`
3. `fetchQuery` fails → throws
4. `runWizardMutation` catches error → `setBlockingError` in modal
5. Modal shows generic error, page never receives error

**Governing SPEC Sections:**

- **SPEC.md §20:** "After stage-one create succeeds, the wizard transitions to the same main edit surface used by update mode..."
- **SPEC.md Failure handling:** "Parse or persistence failures stay local to the modal... external refreshes must not silently rebase unsaved stage-two local edits; dirty local state should either remain authoritative until resolved or the affected surface should fail closed"
- **ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md:** "external refreshes must not silently rebase unsaved edits; affected surface fails closed instead of overwriting those edits in place"

**Fix Location:** `src/frontend/src/pages/useAssignmentDefinitionWizard.ts:837-847`

```typescript
const invalidateMutationQueries = useCallback(
  async (explicitKey: string | null) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
    const effectiveKey = explicitKey ?? localDefinitionKey;
    if (effectiveKey) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignmentDefinitionByKey(effectiveKey),
      });
    }
    try {
      await queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
    } catch {
      // Refresh failure is a page-level concern; page handles blocking state via its own query error state
    }
  },
  [queryClient, localDefinitionKey]
);
```

**Severity:** High  
**Type:** Code bug (spec non-compliant)

---

### 3. E2E Test Failures - Assignments Page

#### **ID:** FE-E2E-002

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:252`  
**Test:** "delete flow removes the row after confirmation and shows success feedback"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect              | Verdict           | Details                                                                             |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| Test expectation    | ✅ Correct        | Delete flow invalidates/refetches, table reflects changes, success feedback visible |
| SPEC requirement    | ✅ Met            | SPEC §1: Assignments page owns delete workflow, refresh behavior                    |
| Code implementation | ❌ **Code wrong** | `hasTrustworthyAssignmentsDataset` check incorrectly blocks query                   |

**Root Cause:**  
The `hasTrustworthyReferenceData` check was incorrectly applied. The real issue is that `hasTrustworthyAssignmentsDataset` is being used to gate the assignments query, but `assignmentDefinitionPartials` is part of startup warmup. If `isAssignmentsDatasetReady` is true, the dataset has loaded successfully and is trustworthy by definition. The additional `hasTrustworthyAssignmentsDataset` check is redundant and causes race condition.

**Key Finding:**
`startupWarmupState.snapshot.datasets.assignmentDefinitionPartials.isTrustworthy` is false → `hasTrustworthyAssignmentsDataset = false` → `assignmentsQuery` disabled → `assignmentsQuery.data = undefined` → `visibleRows = []` → Test fails: row not found.

**Why isTrustworthy false?**

- Mock returns data for `getAssignmentDefinitionPartials` during warmup
- BUT: `AppAuthGate` derives trustworthiness from `dataset.status === 'ready' && dataset.isTrustworthy`
- `dataset.isTrustworthy` derived from `queryState.status !== 'error' && !== 'pending'`
- If warmup query for `assignmentDefinitionPartials` is still pending when `AssignmentsPage` mounts, `isTrustworthy = false`

**Governing SPEC Sections:**

- **SPEC.md §1:** Agreed product decisions #1, #11 (Assignments page owns delete workflow; greenfield data set)
- **SPEC.md §7:** Data loading and orchestration (startup warmup, prefetch policy)

**Fix Location:** `src/frontend/src/pages/AssignmentsPage.tsx:584`

```typescript
// BEFORE:
const assignmentsQuery = useQuery({
  ...getAssignmentDefinitionPartialsQueryOptions(),
  enabled: hasTrustworthyAssignmentsDataset,
  refetchOnMount: false,
});

// AFTER:
const assignmentsQuery = useQuery({
  ...getAssignmentDefinitionPartialsQueryOptions(),
  enabled: isAssignmentsDatasetReady,
  refetchOnMount: false,
});
```

**Rationale:** `assignmentDefinitionPartials` dataset is part of startup warmup. If `isAssignmentsDatasetReady` is true, the dataset has loaded successfully and is trustworthy by definition. The additional `hasTrustworthyAssignmentsDataset` check is redundant and causes race condition.

**Severity:** High  
**Type:** Code bug (state management)

---

#### **ID:** FE-E2E-003

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:274`  
**Test:** "unsafe-key rows keep delete disabled"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                                   | Verdict    | Details                                                                                                           |
| ---------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Test expectation                         | ✅ Correct | Delete button should be disabled for unsafe keys                                                                  |
| SPEC requirement                         | ✅ Clear   | SPEC: path traversal prevention is valid security                                                                 |
| Code implementation                      | ✅ Correct | `isSafeDefinitionKey` checks for `/` and `..` patterns via Zod schema                                             |
| hasTrustworthyReferenceData interference | ✅ None    | hasTrustworthyReferenceData only in useAssignmentDefinitionWizard.ts; delete button uses isSafeDefinitionKey only |

**Root Cause:**  
Playwright selector timing - row may not be fully rendered when assertion runs. No functional bug in code or test logic.

**Code Path:**

- `AssignmentsPage.tsx:675`: `disabled={isDeleteSubmitting || deleteMutation.isPending || !isSafeDefinitionKey(row.definitionKey)}`
- `isSafeDefinitionKey` (AssignmentsPage.tsx:126): `DeleteAssignmentDefinitionRequestSchema.safeParse({ definitionKey }).success`
- `SafeDeleteDefinitionKeySchema` (assignmentDefinitionPartials.zod.ts:170-174): Refines for no path traversal/control characters
- Flow: `'unsafe/legacy-key'` → matches `/[\\/]/` → refine fails → `safeParse.success = false` → `!false = true` → `disabled = true`

**Governing SPEC Sections:**

- **SPEC.md §1:** Agreed product decisions #18: definitionKey is stable opaque identifier
- **Backend constraints:** API-layer transport validation continues to validate incoming shape and identifier safety

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:274-283`

```typescript
// Add explicit wait before assertion
await expect(page.getByRole('row', { name: /unsafe legacy row/i })).toBeVisible();
await expect(
  page.getByRole('row', { name: /unsafe legacy row/i }).getByRole('button', { name: /delete/i })
).toBeDisabled();
```

**Severity:** Medium  
**Type:** Timing/flakiness

---

#### **ID:** FE-E2E-004

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:288`  
**Test:** "placeholder create and update actions stay disabled with explicit unavailable copy"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect              | Verdict                | Details                                                                                                                      |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Test expectation    | ❌ **Test wrong**      | Expects old v1 behavior removed in Section 4                                                                                 |
| SPEC requirement    | ✅ Clear               | SPEC.md §1: update is row-level action, global Update button removed; Create button disabled when reference data unavailable |
| Code implementation | ⚠️ **Partially wrong** | Missing reference data check for Create button; row-level Update button doesn't check reference data                         |

**Root Cause:**

1. **Test wrong:** Expects non-existent page-level "Update assignment" button (removed in Section 4) and "not available in v1" text
2. **Code incomplete:** Missing reference data check for Create button disable condition

**Implementation reality:**

- row Update button: rendered but disabled (`!hasTrustworthyAssignmentsDataset`)
- Create assignment: disabled (`!hasTrustworthyAssignmentsDataset`)
- top-level Update assignment: removed per SPEC (doesn't exist)
- Delete: enabled (`isSafeDefinitionKey` passes)

**Governing SPEC Sections:**

- **SPEC.md:** "Opening create mode uses the startup-owned reference-data sets; the modal should fail closed locally if those datasets are unavailable or untrustworthy."
- **ACTION_PLAN.md Section 4:** "page action area keeps Refresh + Create only; obsolete top-level Update button is removed"

**Fix Locations:**

1. **Test:** `src/frontend/e2e-tests/assignments-page.spec.ts:288-292`

```typescript
// BEFORE:
await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Update assignment' })).toBeDisabled();
await expect(page.getByText(/not available in v1/i)).toBeVisible();

// AFTER:
await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Refresh assignments data' })).toBeEnabled();
```

2. **Code:** `src/frontend/src/pages/AssignmentsPage.tsx`

```typescript
// Add reference data check:
const hasTrustworthyReferenceData =
  startupWarmupState.isDatasetReady('assignmentTopics') &&
  startupWarmupState.isDatasetReady('yearGroups');

// Create button (line 447):
disabled={!hasTrustworthyAssignmentsDataset || !hasTrustworthyReferenceData}

// hasTrustworthyData prop (line 816):
hasTrustworthyData={hasTrustworthyAssignmentsDataset && hasTrustworthyReferenceData}

// Row-level Update button (line 625):
disabled={isDeleteSubmitting || deleteMutation.isPending || !hasTrustworthyAssignmentsDataset || !hasTrustworthyReferenceData}
```

**Severity:** High  
**Type:** Code bug + Test bug (spec non-compliant)

---

#### **ID:** FE-E2E-005

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:302`  
**Test:** "delete action opens confirmation modal with permanent-delete copy"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect              | Verdict                | Details                                                                         |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Test expectation    | ✅ Correct             | Modal shows: title, assignment name, /this delete is permanent/i                |
| SPEC requirement    | ✅ Clear               | SPEC.md §20: "Validation failures stay local to the modal and do not close it"  |
| Code implementation | ⚠️ **Partially wrong** | Delete button doesn't check hasTrustworthyAssignmentsDataset like Update button |

**Root Cause:**  
Delete button does not check `hasTrustworthyAssignmentsDataset`, unlike Update button. This creates inconsistent behavior and allows delete actions on untrustworthy data.

**Current Implementation:**

- Delete button disabled: `isDeleteSubmitting || deleteMutation.isPending || !isSafeDefinitionKey(row.definitionKey)`
- Update button disabled: `isDeleteSubmitting || deleteMutation.isPending || !hasTrustworthyAssignmentsDataset`

**Governing SPEC Sections:**

- **SPEC.md line 497:** "Validation failures stay local to the modal and do not close it."
- **frontend-loading-and-width-standards.md:** Fails closed on untrustworthy data
- **frontend/AGENTS.md §5.1:** Required degraded/untrustworthy data fails closed

**Fix Location:** `src/frontend/src/pages/AssignmentsPage.tsx:670`

```typescript
// BEFORE:
disabled={isDeleteSubmitting || deleteMutation.isPending || !isSafeDefinitionKey(row.definitionKey)}

// AFTER:
disabled={isDeleteSubmitting || deleteMutation.isPending || !hasTrustworthyAssignmentsDataset || !isSafeDefinitionKey(row.definitionKey)}
```

**Test correctness:** Test expects modal to open with correct copy. Modal copy is correct per SPEC. Test does not explicitly verify `hasTrustworthyAssignmentsDataset` check, but code should enforce it for consistency with Update button and SPEC principles.

**Severity:** High  
**Type:** Code bug (inconsistent state management)

---

#### **ID:** FE-E2E-006

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:321`  
**Test:** "delete mutation keeps confirm loading and disables conflicting delete actions until settle"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                                   | Verdict               | Details                                                                                                          |
| ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Test expectation                         | ✅ Correct            | Modal button loading, other delete actions disabled                                                              |
| SPEC requirement                         | ✅ Met                | frontend/AGENTS.md: "Short-running mutations keep loading on the primary trigger and disable conflicting writes" |
| Code implementation                      | ⚠️ **Race condition** | Dual state sources (`isDeleteSubmitting` + `isDeleteMutationPending`)                                            |
| hasTrustworthyReferenceData interference | ✅ None               | Delete button uses `isSafeDefinitionKey`, not trustworthy data                                                   |

**Root Cause:**  
Race condition in state synchronization between local state (`isDeleteSubmitting`) and React Query state (`deleteMutation.isPending`). The `AssignmentsDeleteModal` uses BOTH props but only needs one. `deleteMutation.isPending` alone is sufficient because React Query sets it synchronously.

**Code Flow:**

1. `handleConfirmDelete` calls `setIsDeleteSubmitting(true)` (async state update)
2. Immediately calls `deleteMutation.mutateAsync()` which sets `isPending=true` synchronously
3. Modal computes `isDeleteBusy = isDeleteSubmitting || isDeleteMutationPending`
4. During race condition, stale closure captures old values

**Governing SPEC Sections:**

- **frontend/AGENTS.md:** "Short-running mutations keep loading on the primary trigger and disable conflicting writes on the same owned surface until the mutation settles; modal confirm-loading remains the standard modal pattern."

**Fix Location:** `src/frontend/src/pages/AssignmentsPage.tsx`

**Complete fix - Remove redundant `isDeleteSubmitting` state:**

1. Remove state: `const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);`
2. Update modal props: Use only `isDeleteMutationPending`
3. Update `handleConfirmDelete`: Remove `setIsDeleteSubmitting` calls
4. Update modal component: Use single `isDeletePending` prop
5. Update row buttons: Use `deleteMutation.isPending` only
6. Update `isAssignmentsSurfaceBusyState`: Use `isDeletePending` from mutation

**Severity:** High  
**Type:** Code bug (state management race condition)

---

#### **ID:** FE-E2E-007

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:356`  
**Test:** "delete failure keeps row visible and shows local error feedback"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                                   | Verdict           | Details                                                                     |
| ---------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Test expectation                         | ✅ Correct        | Row remains, error feedback visible                                         |
| SPEC requirement                         | ✅ Clear          | SPEC §20: "Validation failures stay local to the modal and do not close it" |
| Code implementation                      | ❌ **Code wrong** | Modal closes on failure; error not local to modal                           |
| hasTrustworthyReferenceData interference | ✅ None           | Check only disables delete button initiation, not error handling            |

**Root Cause:**  
In `AssignmentsPage.tsx:handleConfirmDelete()` catch block, `setDeleteTarget(null)` closes the delete modal on failure. This violates SPEC principle that errors must stay local to the modal.

**Current Code (WRONG):**

```typescript
catch (error: unknown) {
  if (!deleteCompleted) {
    setDeleteTarget(null);  // ← Closes modal - VIOLATION
    setDeleteOutcome({ type: 'error', message: DELETE_FAILURE_MESSAGE });
  }
}
```

**Governing SPEC Sections:**

- **SPEC.md §20:** "Validation failures stay local to the modal and do not close it."
- **frontend-modal-patterns.md:195:** Modal error handling pattern per SPEC.md §20

**Fix Location:** `src/frontend/src/pages/AssignmentsDeleteModal.tsx` and `AssignmentsPage.tsx:763-789`

**Complete fix:**

1. Add error prop to `AssignmentsDeleteModal`
2. Render Alert inside modal body when error exists
3. Remove `setDeleteTarget(null)` from catch block
4. Pass `deleteError` state to modal, set it on failure

```typescript
// 1. Add state in AssignmentsPage
const [deleteError, setDeleteError] = useState<string | null>(null);

// 2. Fix handleConfirmDelete
catch (error: unknown) {
  if (!deleteCompleted) {
    setDeleteError(DELETE_FAILURE_MESSAGE);  // Set error, DON'T close modal
  }
}

// 3. Update modal invocation
<AssignmentsDeleteModal
  deleteTarget={deleteTarget}
  isDeleteMutationPending={deleteMutation.isPending}
  onCancel={handleDeleteModalClose}
  onConfirm={() => { void handleConfirmDelete(); }}
  error={deleteError}  // NEW
/>

// 4. Update AssignmentsDeleteModal component
function AssignmentsDeleteModal(
  properties: Readonly<{
    deleteTarget: AssignmentDefinitionPartial | null;
    isDeleteMutationPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    error: string | null;  // NEW
  }>
) {
  return (
    <Modal ...>
      <Space orientation="vertical" size="small">
        {properties.error && (
          <Alert
            message={properties.error}
            showIcon
            type="error"
            style={{ marginBottom: 16 }}
          />
        )}
        <Text>You are deleting this assignment definition.</Text>
        {properties.deleteTarget === null ? null : <Text strong>{properties.deleteTarget.primaryTitle}</Text>}
        <Text>This delete is permanent and cannot be undone.</Text>
      </Space>
    </Modal>
  );
}
```

**Severity:** High  
**Type:** Code bug (spec non-compliant)

---

#### **ID:** FE-E2E-008

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:374`  
**Test:** "post-delete refresh failure returns to blocking state"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                                   | Verdict           | Details                                                                 |
| ---------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Test expectation                         | ✅ Correct        | UI shows blocking state, hides table                                    |
| SPEC requirement                         | ✅ Clear          | SPEC: "Required degraded or untrustworthy data fails closed by default" |
| Code logic                               | ✅ Correct        | `shouldRenderAssignmentsBlockingState` correctly evaluates to true      |
| Root cause                               | ❌ **Code wrong** | `fetchQuery` doesn't propagate errors to `useQuery.isError`             |
| hasTrustworthyReferenceData interference | ✅ None           | Check is in `useAssignmentDefinitionWizard.ts`, not AssignmentsPage     |

**Root Cause:**  
`refetchAssignmentDefinitions` uses `fetchQuery` which updates cache but does NOT trigger `useQuery` state updates (`isError` remains false). The third condition in `shouldRenderAssignmentsBlockingState` requires `isAssignmentsQueryError: true`, which never occurs because the query instance doesn't re-render with error state.

**Current Code:**

```typescript
const refetchAssignmentDefinitions = useCallback(async () => {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.assignmentDefinitionPartials(),
    refetchType: 'none',
  });
  return queryClient.fetchQuery(getAssignmentDefinitionPartialsQueryOptions()); // ← Does not update useQuery.isError
}, [queryClient]);
```

**Governing SPEC Sections:**

- **frontend/AGENTS.md §5.1:** "Required degraded or untrustworthy data fails closed by default"
- **SPEC.md:** "Successful create, update, delete... must invalidate or refetch assignment-definition query data"

**Fix Location:** `src/frontend/src/pages/AssignmentsPage.tsx:630-636`

```typescript
// Replace refetchAssignmentDefinitions with:
const refetchAssignmentDefinitions = useCallback(async () => {
  await queryClient.refetchQueries({
    queryKey: queryKeys.assignmentDefinitionPartials(),
  });
}, [queryClient]);
```

**Severity:** High  
**Type:** Code bug (query state propagation)

---

#### **ID:** FE-E2E-009

**File:** `src/frontend/e2e-tests/assignments-page.spec.ts:424`  
**Test:** "filter and reset interactions cover every displayed data column"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                                   | Verdict           | Details                                                                                                                                                               |
| ---------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test expectation                         | ✅ Correct        | Filters use exact-match on displayed column values; all 5 columns filterable                                                                                          |
| SPEC requirement                         | ✅ Clear          | SPEC: "The Assignments page list should continue to show human-readable topic and year-group labels"                                                                  |
| Code implementation                      | ✅ Correct        | Component uses `yearGroupLabel`, `primaryTopicKey`                                                                                                                    |
| Test data                                | ❌ **Test wrong** | Data shape mismatch - missing required fields                                                                                                                         |
| hasTrustworthyReferenceData interference | ✅ None           | hasTrustworthyReferenceData is in wizard modal only; Assignments page uses hasTrustworthyAssignmentsDataset which blocks the entire table when query validation fails |

**Root Cause:**  
Test data in `assignments-page.spec.ts` uses **old schema shape** that fails Zod validation:

- Uses `yearGroup: number` (11, 10, null) instead of required `yearGroupKey: string`, `yearGroupLabel: string`
- Missing required `primaryTopicKey: string`

This causes `AssignmentDefinitionPartialsResponseSchema.parse()` to throw in `getAssignmentDefinitionPartialsService.ts`, making the query error. With `hasTrustworthyAssignmentsDataset && isAssignmentsQueryError` true, `shouldRenderAssignmentsBlockingState` returns true, blocking the table entirely.

**Governing SPEC Sections:**

- **SPEC.md:** "backend partial-definition transport exposes yearGroupKey and yearGroupLabel"
- **ACTION_PLAN.md:** Migration from numeric `yearGroup` to `yearGroupKey`/`yearGroupLabel` pair

**Fix Location:** `src/frontend/e2e-tests/assignments-page.spec.ts:31-77`

```typescript
// Update ALL test data rows to include required fields:
const assignmentRows = [
  {
    primaryTitle: 'Newest algebra recap',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra', // ADDED
    yearGroupKey: 'year-group-11', // ADDED
    yearGroupLabel: 'Year 11', // ADDED
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 20,
    definitionKey: 'newest-safe',
    tasks: null,
    createdAt: '2025-02-01T08:00:00.000Z',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
  // ... update all other rows similarly
] as const;
```

**Note:** This fix also resolves the "Further Investigation Required" placeholder for FE-E2E-009.

**Severity:** High  
**Type:** Test bug (data shape mismatch)

---

#### **ID:** FE-E2E-010

**File:** `src/frontend/e2e-tests/assignments-year-group-migration.spec.ts:139`  
**Test:** "assignments year-group label migration keeps delete available while create/update remain unavailable"

**Analysis Source:** explore subagent (extra scrutiny)

| Aspect                               | Verdict                | Details                                                                                         |
| ------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Test expectation                     | ⚠️ **Partially wrong** | Mix of correct and incorrect expectations                                                       |
| SPEC requirement                     | ✅ Clear               | SPEC.md §1: Create is top-level action, Update is row-level, Delete remains present             |
| ACTION_PLAN.md                       | ✅ Clear               | Section 4: "create/update affordances remain unavailable, delete row action remains present"    |
| Code implementation                  | ❌ **Code wrong**      | Create/Update don't check reference data availability                                           |
| yearGroupKey/yearGroupLabel contract | ✅ Correct             | Test data provides both fields; code renders yearGroupLabel via formatYearGroupLabel()          |
| hasTrustworthyReferenceData location | ✅ Correct             | Defined in useAssignmentDefinitionWizard.ts:114; checks assignmentTopics && yearGroups datasets |

**Root Cause:**

1. **Test wrong:** Expects non-existent page-level "Update assignment" button (removed in Section 4)
2. **Test data:** Correctly uses new contract with `yearGroupKey` and `yearGroupLabel`
3. **Code wrong:** `hasTrustworthyReferenceData` check missing from AssignmentsPage; only exists in wizard modal

**Implementation reality:**

- row Update button: rendered but disabled (!hasTrustworthyAssignmentsDataset)
- Create assignment: disabled (!hasTrustworthyAssignmentsDataset)
- top-level Update assignment: removed per SPEC (doesn't exist)
- Delete: enabled (isSafeDefinitionKey passes)

**Governing SPEC Sections:**

- **ACTION_PLAN.md Section 3:** "Keep create and update affordances unavailable... delete row action remains present"
- **ACTION_PLAN.md Section 4:** "page action area keeps Refresh + Create only; obsolete top-level Update button is removed"
- **SPEC.md:** "Partial rows and full-definition responses expose yearGroupKey and yearGroupLabel as the active frontend contract"

**Fix Locations:**

1. **Test:** `src/frontend/e2e-tests/assignments-year-group-migration.spec.ts:155`

```typescript
// BEFORE:
await expect(row.getByRole('button', { name: /update/i })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Update assignment' })).toBeDisabled();

// AFTER:
await expect(row.getByRole('button', { name: /update/i })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
await expect(page.getByRole('button', { name: 'Update assignment' })).toHaveCount(0);
```

2. **Code:** `src/frontend/src/pages/AssignmentsPage.tsx`

Add reference data check for Create button:

```typescript
const hasTrustworthyReferenceData =
  startupWarmupState.isDatasetReady('assignmentTopics') &&
  startupWarmupState.isDatasetReady('yearGroups');

// Create button:
disabled={!hasTrustworthyAssignmentsDataset || !hasTrustworthyReferenceData}
```

**Severity:** High  
**Type:** Code bug + Test bug (spec non-compliant)

---

## Summary Table - Extra Scrutiny

| ID                  | File                                           | Line | Type            | Severity | Root Cause                                            | Fix Location                                       | Code/Test/Both |
| ------------------- | ---------------------------------------------- | ---- | --------------- | -------- | ----------------------------------------------------- | -------------------------------------------------- | -------------- |
| FE-UNIT-001-replica | AssignmentDefinitionWizardModal.spec.tsx       | 1114 | Test bug        | High     | Assertion mismatch with mock data                     | AssignmentDefinitionWizardModal.spec.tsx:1113-1114 | Test           |
| FE-E2E-001          | assignment-definition-wizard-section-4.spec.ts | 513  | Code bug        | High     | Explicit fetchQuery throws to modal                   | useAssignmentDefinitionWizard.ts:837-847           | Code           |
| FE-E2E-002          | assignments-page.spec.ts                       | 252  | Code bug        | High     | Redundant hasTrustworthyAssignmentsDataset check      | AssignmentsPage.tsx:584                            | Code           |
| FE-E2E-003          | assignments-page.spec.ts                       | 274  | Timing          | Medium   | Selector timing issue                                 | assignments-page.spec.ts:274-283                   | Test           |
| FE-E2E-004          | assignments-page.spec.ts                       | 288  | Code + Test bug | High     | Missing reference data check + old v1 assertions      | AssignmentsPage.tsx + test                         | Both           |
| FE-E2E-005          | assignments-page.spec.ts                       | 302  | Code bug        | High     | Delete button missing dataset check                   | AssignmentsPage.tsx:670                            | Code           |
| FE-E2E-006          | assignments-page.spec.ts                       | 321  | Code bug        | High     | Dual state sources race condition                     | AssignmentsPage.tsx                                | Code           |
| FE-E2E-007          | assignments-page.spec.ts                       | 356  | Code bug        | High     | Modal closes on failure                               | AssignmentsPage.tsx + AssignmentsDeleteModal.tsx   | Code           |
| FE-E2E-008          | assignments-page.spec.ts                       | 374  | Code bug        | High     | fetchQuery doesn't propagate errors                   | AssignmentsPage.tsx:630-636                        | Code           |
| FE-E2E-009          | assignments-page.spec.ts                       | 424  | Test bug        | High     | Data shape uses old contract                          | assignments-page.spec.ts:31-77                     | Test           |
| FE-E2E-010          | assignments-year-group-migration.spec.ts       | 139  | Code + Test bug | High     | Missing reference data check + wrong button assertion | AssignmentsPage.tsx + test                         | Both           |

---

## Files Requiring Changes

### Code Files (6 files)

1. **`src/frontend/src/pages/useAssignmentDefinitionWizard.ts`**
   - FE-E2E-001: Wrap fetchQuery in try-catch (lines 837-847)

2. **`src/frontend/src/pages/AssignmentsPage.tsx`**
   - FE-E2E-002: Remove redundant hasTrustworthyAssignmentsDataset check (line 584)
   - FE-E2E-004: Add hasTrustworthyReferenceData check for Create button (line 447)
   - FE-E2E-005: Add hasTrustworthyAssignmentsDataset check to Delete button (line 670)
   - FE-E2E-006: Remove isDeleteSubmitting state, use deleteMutation.isPending only
   - FE-E2E-008: Replace fetchQuery with refetchQueries (lines 630-636)

3. **`src/frontend/src/pages/AssignmentsDeleteModal.tsx`**
   - FE-E2E-007: Add error prop, render Alert inside modal for failure state

### Test Files (3 files)

1. **`src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx`**
   - FE-UNIT-001-replica: Fix assertion to match mock data (lines 1113-1114)

2. **`src/frontend/e2e-tests/assignments-page.spec.ts`**
   - FE-E2E-003: Add explicit wait for row visibility (lines 274-283)
   - FE-E2E-004: Remove v1 assertions, add reference data check assertion (lines 288-292)
   - FE-E2E-009: Update test data to new contract with yearGroupKey/yearGroupLabel (lines 31-77)

3. **`src/frontend/e2e-tests/assignments-year-group-migration.spec.ts`**
   - FE-E2E-010: Fix button assertion to match Section 4 changes (line 155)

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

## Historical Context

> The findings below document the ORIGINAL 11 failures before fixes were applied. These are preserved for historical reference.

### Original Executive Summary

| Category                       | Count | Severity | Root Cause                                |
| ------------------------------ | ----- | -------- | ----------------------------------------- |
| Code bugs (spec non-compliant) | 4     | High     | Code does not implement SPEC.md correctly |
| Test bugs (spec non-compliant) | 3     | High     | Test expects wrong behaviour per SPEC.md  |
| Timing/flakiness issues        | 4     | Medium   | Async execution order vs assertion order  |

---

### Original Detailed Findings
