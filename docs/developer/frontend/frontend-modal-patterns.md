# Frontend Modal Patterns

This is the canonical policy for modal implementation, reuse, and extraction decisions in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`

## 1. Purpose and scope

Use this document when deciding whether to:

- keep a modal implementation local to one file
- reuse an existing modal family
- extend a feature-local modal pattern
- extract a new modal helper

It applies to production frontend source under `src/frontend/src/**`.

## 2. Modal decision tree

Before creating or refactoring a modal, follow this order:

1. Identify the owned surface and modal type.
2. Check the modal family registry in Section 3.
3. Reuse an existing family when the behaviour and lifecycle match.
4. Extend an existing feature-local helper when the new case fits that helper's responsibility.
5. Keep the modal local when the flow is genuinely one-off.
6. Extract a new helper only when repeated behaviour exists now, or a second in-scope caller is already accepted.

Do not create a new abstraction only because a modal file feels long.

## 3. Modal family registry

Check these existing patterns before introducing a new modal style.

### 3.1 One-off destructive confirmation modals

- Classes bulk delete: `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- Assignment definition delete: `src/frontend/src/pages/AssignmentsPage.tsx`

Use this family when:

- the modal confirms one destructive action
- the copy is specific to one workflow
- the footer actions are simple and local

Default decision:

- keep local unless two or more destructive confirmation modals need the same busy-state, footer, and copy structure
- accepted boundary for the classes modal-family compliance refactor: keep `src/frontend/src/features/classes/BulkDeleteModal.tsx` and `AssignmentsDeleteModal` in `src/frontend/src/pages/AssignmentsPage.tsx` local to their workflows
- shared destructive-confirmation helper status for that refactor: implemented as a local-only outcome

### 3.2 Classes bulk form modals

- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`

Shared traits:

- Ant Design `Modal` plus Ant Design `Form`
- local form instance via `Form.useForm(...)`
- reset on cancel
- modal OK delegates to `form.submit()`
- inline submission error alert above the form body
- `confirmLoading` drives the primary action busy state
- conflicting controls are disabled while the mutation is pending

Use this family when:

- the modal owns a short-running form submission
- validation is local to the form
- failure is shown inline without leaving the modal

Default decision:

- reuse the family shape
- extract helper behaviour only when repeated shell logic clearly outweighs the helper surface
- accepted boundary for the classes modal-family compliance refactor: a narrow feature-local `src/frontend/src/features/classes/BulkFormModalScaffold.tsx` may be introduced for this family only
- scaffold status for that refactor: `Implemented`; the scaffold now ships as the feature-local shared shell for the three bulk form modals

### 3.3 Classes reference-data workflow modals

- `src/frontend/src/features/classes/ManageCohortsModal.tsx`
- `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`
- Shared helpers:
  - `src/frontend/src/features/classes/InlineDialog.tsx`
  - `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
  - `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`

Shared traits:

- outer Ant Design modal containing inner inline dialogs
- feature-local create/edit/delete workflow
- fail-closed blocking-load handling
- explicit busy-state synchronisation and refresh semantics
- delete-blocked handling for in-use records

Use this family when:

- the modal owns a small CRUD workflow rather than a single submit
- the modal body remains visible while inner dialog sections open and close
- testability benefits from inline dialog sections rather than nested Ant Design modal portals

Default decision:

- extend the existing feature-local helpers for similar reference-data workflows
- do not replace this family with a generic app-wide CRUD modal abstraction
- accepted boundary for the classes modal-family compliance refactor: reuse `InlineDialog.tsx`, `manageReferenceDataDialogs.tsx`, and `manageReferenceDataHelpers.ts` as-is
- helper-change status for that refactor: `Implemented`; the existing feature-local helper family remains the accepted reuse boundary

## 4. Keep-local rules

Keep a modal implementation local to one file when any of these are true:

- there is only one active caller and no accepted near-term sibling case
- the copy, footer, or action semantics are unique to one workflow
- extraction would introduce a large prop surface with mostly pass-through values
- the modal's state machine is easier to understand in place than through indirection
- the test burden for the abstraction would exceed the value of removing the duplication

Local duplication is preferred over speculative abstraction.

## 5. Reuse and extension rules

Reuse or extend an existing modal family when:

- the owned surface and loading semantics match
- the mutation pattern matches
- the validation and error-presentation style match
- the accessibility semantics match
- the helper remains coherent after extension

Do not reuse a family only because it also uses Ant Design `Modal`.

Shared component choice alone is not a sufficient reuse signal.

## 6. Extraction rules

Create or extend modal helpers only when they own a clear contract, such as:

- reset-on-cancel behaviour
- submit-on-OK wiring for a form modal
- standard inline submission error rendering
- delete confirmation footer behaviour
- feature-local blocking-load or busy-state semantics

Avoid helpers that only centralise arbitrary prop forwarding.

Prefer small composable helpers over one generic modal wrapper with many configuration flags.

## 7. Loading, busy, and error rules for modals

- Follow `docs/developer/frontend/frontend-loading-and-width-standards.md` for modal loading ownership.
- Short-running modal mutations should continue to use the modal confirm-loading pattern by default.
- Disable conflicting actions when retrying, double-submitting, or cancelling mid-write would be confusing or unsafe.
- Keep blocking and submission errors visible inside the owned modal surface unless a stronger documented UX case exists.
- Expose accessible busy or status semantics whenever modal content is refreshing or blocked.

## 8. Accessibility and testability rules

- Modal abstractions must preserve clear accessible names and action labels.
- Do not hide essential behaviour behind abstractions that make tests depend on implementation details.
- Prefer feature-local inline dialog sections when nested portal modals would make tests brittle and the UX still remains correct.
- If a helper changes modal structure, verify that role, name, busy, and disabled semantics remain testable.

## 9. Relationship to shared-helper policy

This document is modal-specific.

Use `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` for the broader helper extraction policy.

When the two documents overlap:

- this document decides whether a modal should stay local, reuse a family, or extract a modal-specific helper
- the shared-helper document decides where a justified helper belongs and whether it should remain feature-local or become cross-feature

## 10. Review checklist

For frontend changes that add or refactor modals, verify:

1. the existing family registry was checked first
2. the modal was kept local unless reuse or extraction was clearly justified
3. loading and busy semantics stay scoped to the owned modal surface
4. error treatment remains explicit and testable
5. any new helper owns a narrow contract rather than a prop tunnel
