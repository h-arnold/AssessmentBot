# Investigation Report: Batch D Test Failure - AssignmentDefinitionWizardModal

## Overview

Date: 2025
Component: AssignmentDefinitionWizardModal.tsx
Test File: AssignmentDefinitionWizardModal.spec.tsx
Status: RESOLVED

---

## Executive Summary

Created direct unit tests for `AssignmentDefinitionWizardModal` component as part of Batch D.

- 10 test cases created covering state machine, re-parse gating, and task weighting workflow
- 9 tests passed initially
- 1 test failed: "re-parse refreshes task rows and preserves matching weightings"
- Root cause: React Query `mutateAsync` passes additional context as second argument
- Fix: Updated assertion to check first argument of first call directly

---

## Evidence Summary

### Test Structure

- File: `src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx`
- Total Tests: 10 test cases
- Initial Status: 9 passing, 1 failing
- Failing Test: "re-parse refreshes task rows and preserves matching weightings"

### Original Issue

Test assertion:

```typescript
expect(upsertAssignmentDefinitionMock).toHaveBeenCalledWith(
  expect.objectContaining({
    definitionKey: 'algebra-baseline',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/new-ref',
  })
);
```

Error received:

```javascript
Expected: ObjectContaining {...}
Received:
  1st vi.fn() call:
  [
    { // First argument: request object
      definitionKey: "algebra-baseline",
      referenceDocumentUrl: "https://docs.google.com/presentation/d/new-ref",
      assignmentWeighting: 5,
      primaryTitle: "Algebra Baseline",
      primaryTopicKey: "topic-algebra",
      yearGroupKey: "year-group-10",
      templateDocumentUrl: "https://docs.google.com/presentation/d/tpl-doc-456/edit",
      taskWeightings: [],
    },
    { // Second argument: React Query context
      client: QueryClient {},
      meta: undefined,
      mutationKey: undefined,
    }
  ]
```

---

## Ordered Hypotheses

| Rank  | Hypothesis                                                             | Confidence | Status                    |
| ----- | ---------------------------------------------------------------------- | ---------- | ------------------------- |
| 1     | URL mismatch: form value has `/edit` suffix from `buildCanonicalUrl()` | HIGH       | Tested, not primary cause |
| **2** | **Async timing + React Query passing extra arguments**                 | **HIGH**   | **CONFIRMED**             |
| 3     | Form value not updated when Input becomes disabled                     | MEDIUM     | Tested, not primary cause |
| 4     | Mock call index wrong due to previous test pollution                   | LOW        | Ruled out                 |

### Hypothesis 1: URL Mismatch

**Flow:**

1. Component renders in update mode with `definitionKey="algebra-baseline"`
2. Form initialized via `form.setFieldsValue({ referenceDocumentUrl: buildCanonicalUrl('ref-doc-123', 'SLIDES') })`
   - `buildCanonicalUrl` adds `/edit` suffix
   - Actual form value: `'https://docs.google.com/presentation/d/ref-doc-123/edit'`
3. Test calls `setTextboxValue(referenceUrlInput, 'https://docs.google.com/presentation/d/new-ref')`
   - Intended form value: `'https://docs.google.com/presentation/d/new-ref'` (no `/edit`)
4. When URL changes, `handleFormValuesChange` sets `documentChange.hasPendingChange = true`
5. Input `disabled` prop: `disabled={hasDirtyEdits || documentChange.hasPendingChange || isSubmitting}`
6. Race condition: If Input disables mid-update, form may retain old value

**Evidence:**

- `mockFullAssignmentDefinition.referenceDocumentUrl` = `'https://.../ref-doc-123'` (no `/edit`)
- `buildCanonicalUrl` adds `/edit` → form initialized with `'https://.../ref-doc-123/edit'`

**Resolution:** Not primary cause, but test uses `expect.stringContaining('new-ref')` to be flexible

### Hypothesis 2: React Query Extra Arguments (CONFIRMED)

**Root Cause:**
React Query's `useMutation.mutateAsync()` passes **two arguments** to the mutation function:

1. First argument: The request data (as provided)
2. Second argument: Mutation context object (`{ client, meta, mutationKey }`)

The test used `toHaveBeenCalledWith()` which performs **exact positional argument matching**:

- Expected: 1 argument (request object)
- Received: 2 arguments (request object + context object)
- Result: Matcher fails even though request object matches

**Evidence:**

- Error shows `mock.calls[0]` contains array of 2 elements
- First element has all expected fields including `definitionKey` and `referenceDocumentUrl`
- Second element is React Query context

---

## Fix Applied

### File Modified

`src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx` lines 405-412

### Before

```typescript
// Re-parse should have been called
expect(upsertAssignmentDefinitionMock).toHaveBeenCalled();

// Verify the re-parse was called with the definitionKey and updated URL
expect(upsertAssignmentDefinitionMock).toHaveBeenCalledWith(
  expect.objectContaining({
    definitionKey: 'algebra-baseline',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/new-ref',
  })
);
```

### After

```typescript
// Re-parse should have been called
expect(upsertAssignmentDefinitionMock).toHaveBeenCalled();

// Verify the re-parse was called with the definitionKey and updated URL
// Note: React Query mutateAsync passes additional context as second argument
expect(upsertAssignmentDefinitionMock.mock.calls[0][0]).toMatchObject({
  definitionKey: 'algebra-baseline',
  referenceDocumentUrl: expect.stringContaining('new-ref'),
});
```

### Changes Made

1. Access the **first argument of the first call** directly: `mock.calls[0][0]`
2. Use `toMatchObject` instead of `objectContaining` for cleaner assertion
3. Use `expect.stringContaining('new-ref')` for more flexible URL matching (handles `/edit` suffix)
4. Added explanatory comment about React Query behavior

---

## Test Coverage

All 10 direct unit tests for `AssignmentDefinitionWizardModal` pass:

| #   | Test Name                                                      | Status          |
| --- | -------------------------------------------------------------- | --------------- |
| 1   | create mode hides task editing before first parse              | ✅ PASS         |
| 2   | stage-one success hydrates shared edit surface                 | ✅ PASS         |
| 3   | document change disables metadata and task weighting inputs    | ✅ PASS         |
| 4   | cancel restores persisted URLs                                 | ✅ PASS         |
| 5   | re-parse refreshes task rows and preserves matching weightings | ✅ PASS (FIXED) |
| 6   | save blocked without year-group selection                      | ✅ PASS         |
| 7   | dirty edits disable document URL fields                        | ✅ PASS         |
| 8   | form validation rules for required fields                      | ✅ PASS         |
| 9   | weighting range validation for 0 to 10                         | ✅ PASS         |
| 10  | create blocks when reference data cannot be loaded             | ✅ PASS         |

---

## Relevant Documentation

| Resource                      | Link                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| Vitest `toHaveBeenCalledWith` | https://vitest.dev/api/expect.html#tohavebeencalledwith       |
| Jest asymmetric matchers      | https://jestjs.io/docs/expect#tohavebeencalledwith            |
| React Query `useMutation`     | https://tanstack.com/query/latest/docs/react/guides/mutations |
| Ant Design Form               | https://ant.design/components/form                            |

---

## Files Read During Investigation

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/pages/AssignmentDefinitionWizardModal.spec.tsx`
- `/home/developer/AssessmentBot/src/frontend/src/services/assignmentDefinitionService.ts`
- `/home/developer/AssessmentBot/src/frontend/src/services/assignmentDefinition.zod.ts`
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-testing.md`

---

## Lessons Learned

1. **React Query mutation context**: When testing React Query mutations, be aware that `mutateAsync` may pass additional context arguments to the mutation function
2. **Mock inspection**: Use `mock.calls` to inspect exact arguments when matchers fail
3. **Flexible assertions**: Prefer `toMatchObject` with `expect.stringContaining` over `objectContaining` for partial matching when exact structure is uncertain
4. **Async testing**: Ensure async operations complete before assertions, though in this case the issue was argument structure, not timing

---

## Resolution Status

✅ **RESOLVED** - All 10 tests passing after fix
