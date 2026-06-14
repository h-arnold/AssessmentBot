# Code Review Findings — Branch `opencode/jolly-eagle` vs `feat/ReactFrontend`

**Review date:** 2026-06-14
**Reviewer:** Code Reviewer Agent

---

## Summary

**Verdict: Needs Improvement** — All automated checks pass (lint, compile, unit tests, E2E tests). The implementation is well-structured with documented state machines, comprehensive tests, and proper separation of concerns. One Improvement item should be addressed before merge (silent return in `handleWizardCreateSuccess` leaving UI in ambiguous state), and one Improvement regarding the 500-line file limit on `AssessTaskModal.tsx`.

---

## Automated Checks

| Check                                                        | Result                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `npm run lint:frontend`                                      | Passed (0 errors, 0 warnings)                                                   |
| `npm run lint:backend`                                       | Passed (0 errors, 15 pre-existing `max-lines` warnings — none in changed files) |
| `npm run lint:builder`                                       | Passed (0 errors, 0 warnings)                                                   |
| `npm exec tsc -- -b src/frontend/tsconfig.json`              | Passed (0 errors)                                                               |
| `npm run test:frontend:coverage`                             | All Vitest tests passed                                                         |
| `npm run test:frontend:e2e` (Playwright — Assess Task modal) | 15/15 passed                                                                    |

---

## Files Changed (excluding planning artefacts)

| File                                                                                  | Module   | Change Summary                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`               | Frontend | Added no-match resolution state machine (`choice`/`creating` states), wizard integration with `flushSync`, and auto-assessment flow      |
| `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts`         | Frontend | Added `initialValues` and `onCreateSuccess` props; `applyFormInitialValues` helper; wizard supports external callers with pre-population |
| `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`      | Frontend | Minimal change — destructures `initialValues` and `onCreateSuccess` from properties                                                      |
| `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`          | Frontend | Added 16 new Vitest tests for no-match resolution + wizard integration                                                                   |
| `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts`    | Frontend | Added 3 new tests for `initialValues`, `onCreateSuccess` callback, and error handling                                                    |
| `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.spec.tsx` | Frontend | Added tests for `initialValues` pre-population                                                                                           |
| `src/frontend/src/test/assignmentDefinition/wizardModalTestHelpers.tsx`               | Frontend | Extended `RenderWizardModalOptions` and `renderWizardModal` to accept `initialValues` and `onCreateSuccess`                              |
| `src/frontend/e2e-tests/classes-page-assess-task.spec.ts`                             | Frontend | 15 new Playwright E2E tests covering all Assess Task modal states including choice prompt and wizard flow                                |
| `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`                   | Frontend | Extended E2E helpers for assess task scenarios                                                                                           |
| `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`                               | Frontend | Added `getAssignmentTopics` scenario support                                                                                             |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`        | Docs     | Added Section 9.14 entry for topic existence check `keep local` decision                                                                 |

---

## Critical Issues

**None.** No bugs, security issues, or failed automated checks were found.

---

## Improvement Items

### 1. Silent return in `handleWizardCreateSuccess` leaves UI in unrecoverable loading state

**File:** `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`, line 304

```typescript
const selectedAssignment = assignments.find((a) => a.assignmentId === selectedAssignmentId);
if (!selectedAssignment) return; // ← silently returns; assessmentState stays 'loading'
```

When `selectedAssignment` is not found (defensive guard — unlikely in practice but possible with stale closures), the function returns silently. The UI remains in `assessmentState='loading'` with `noMatchResolution='creating'`, `hasCreateSucceeded=true`. The user sees a disabled "Start Assessment" button with a loading spinner and a "Cancel" button.

While Cancel does provide an escape hatch (calling `onClose` to dismiss the modal), the silent return violates the **Fail Fast** principle. If this guard triggers, there is no diagnostic output or error state feedback.

**Recommendation:** Set the error state before returning:

```typescript
if (!selectedAssignment) {
  setNoMatchResolution('idle');
  setAssessmentAsError('error', 'Selected assignment not found. Please try again.');
  return;
}
```

This ensures the user sees an error Alert with clear messaging rather than a stuck loading state.

### 2. `AssessTaskModal.tsx` exceeds 500-line file limit (506 lines)

**File:** `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`

The file grew from approximately 295 lines to 506 lines, exceeding the 500-line maximum specified in the review checklist:

> "Files are no longer than 500 lines. If they are, consider if they can be split into smaller modules or if some logic can be moved to helper functions."

The new no-match resolution logic (choice prompt, wizard integration, auto-assessment flow, footer logic) added approximately 210 lines. The file is only 6 lines over the limit, so a small extraction (e.g., moving the `noMatchResolution` state machine into a custom hook like `useNoMatchResolution`, or extracting the footer content logic into a separate helper) would bring it under 500 lines while improving testability.

**Recommendation:** Extract the no-match resolution state machine and/or the footer rendering logic into a separate module. This would also make the orthogonality of the two state machines (`assessmentState` and `noMatchResolution`) more explicit.

---

## Nitpicks

### 1. Trailing comma on single-line object literal

**File:** `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`, line 90

```typescript
const values: { title?: string; topic?: string; yearGroup?: string } = {
  title: selectedAssignment.title,
};
```

The trailing comma on a single-line object literal is unusual but syntactically valid and not flagged by ESLint. For readability, consider removing the trailing comma or expanding the object to multi-line format.

### 2. Inline `stripFunctions` helper in test file

**File:** `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`, lines 50-58

The `stripFunctions` utility is defined inline in the test file and used only within the `vi.mock` factory. Per the shared helpers policy, this is a single-caller helper that could stay local (Section 4.1). No action required — noted for awareness.

---

## Cross-module Consistency

| Rule                                                  | Status                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| No `console.*` calls in production code               | ✅ Passed                                                                                     |
| No empty `catch` blocks                               | ✅ Passed                                                                                     |
| British English in comments and user-facing text      | ✅ Passed                                                                                     |
| No speculative features or scope creep                | ✅ Passed                                                                                     |
| No default values introduced without instruction      | ✅ Passed                                                                                     |
| No imports from `src/backend/` in frontend            | ✅ Passed                                                                                     |
| `@ant-design/v5-patch-for-react-19` not added         | ✅ Passed                                                                                     |
| `App.tsx` remains thin composition root (not touched) | ✅ Passed                                                                                     |
| Backend boundary via `callApi` / service modules      | ✅ Passed                                                                                     |
| No `console.*` in E2E test file                       | ✅ Passed (single match in pre-existing `classes-crud.harness.spec.ts`, not in changed files) |

---

## Test Quality Assessment

- **38 Vitest tests** in `AssessTaskModal.spec.tsx` (up from 22) cover all states: idle, loading, success, error, choice prompt, creating, wizard integration, and edge cases (topic not in cache, topicId null, reopen resets, etc.)
- **3 Vitest tests** in `useAssignmentDefinitionWizard.spec.ts` cover `initialValues`, `onCreateSuccess` success path, and `onCreateSuccess` not called on failure
- **15 Playwright E2E tests** cover full user journeys: modal open/close, selection, error states, choice prompt, wizard integration, auto-assessment flow, and cancel flows
- Test assertions verify behaviour rather than implementation details, as required by the testing standard
- Coverage thresholds appear met (exact numbers unavailable due to coverage runner file collision, but all tests pass)

---

## Files Read During Review

### Mandatory Documentation

- `AGENTS.md` (root)
- `src/frontend/AGENTS.md`
- `src/backend/AGENTS.md`
- `scripts/builder/AGENTS.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Changed Source Files

- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts`
- `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts`
- `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.spec.tsx`
- `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`
- `src/frontend/src/test/assignmentDefinition/wizardModalTestHelpers.tsx`
- `src/frontend/e2e-tests/classes-page-assess-task.spec.ts`
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
