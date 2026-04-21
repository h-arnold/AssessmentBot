# Classes Modal Family Compliance Refactor Specification

## Status

- Draft v1.0
- Replaces the previous root planning document for this request with a frontend-only modal-refactor specification

## Purpose

This document defines the intended behaviour for a small frontend refactor in the classes feature modal code.

The refactor will be used to:

- align the classes modal implementation with the current frontend modal-family policy
- remove justified shell duplication within the classes bulk form modal family
- keep shared helper decisions explicit so later implementation does not drift into speculative modal abstraction

This feature is **not** intended to:

- change modal entry points, visible workflow order, or backend/service contracts
- introduce a new app-wide modal abstraction
- rework the classes reference-data modal family beyond confirming that the existing feature-local helpers remain sufficient
- replace one-off destructive confirmation modals with a shared wrapper

## Agreed product decisions

1. Scope is limited to the frontend classes modal family and the canonical planning documents that guide helper decisions.
2. A dedicated layout specification is **not required** for this request because the visible modal hierarchy, workflow entry points, and user-facing structure remain unchanged. The work is an internal refactor of existing modal shells.
3. The only currently justified shared scaffold is a **feature-local classes bulk form modal scaffold** for the existing bulk form family:
   - `src/frontend/src/features/classes/BulkCreateModal.tsx`
   - `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
   - `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
4. The scaffold is planned to live at `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`. It must remain feature-local and must not become a cross-feature helper, a generic app modal wrapper, or a new shared UI primitive.
5. The scaffold may own only the repeated shell contract already shared by the family:
   - Ant Design `Modal` plus Ant Design `Form`
   - local form-submission lifecycle
   - reset-on-cancel behaviour
   - modal OK delegating to `form.submit()`
   - inline submission error rendering inside the modal body
   - `confirmLoading` and conflicting-action disabling semantics
   - `destroyOnHidden` and other shell-level modal props already common to the family
6. Field-specific behaviour stays local to each modal, including:
   - modal titles and field labels
   - Zod-backed validation and per-field validation copy
   - allowed-option membership checks
   - initial form values
   - payload mapping passed to `onConfirm`
   - workflow-specific fallback error copy
7. `BulkSetSelectModal` remains a reusable member of the classes bulk form family only. This refactor does not promote it into a generic select modal for the wider app.
8. No additional shared scaffold is warranted for the classes reference-data modal family. The existing feature-local helpers already cover the shared workflow contract:
   - `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
   - `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
   - `src/frontend/src/features/classes/InlineDialog.tsx`
9. No shared scaffold is warranted for the one-off destructive confirmation modals:
   - `src/frontend/src/features/classes/BulkDeleteModal.tsx`
   - `src/frontend/src/pages/AssignmentsPage.tsx` (`AssignmentsDeleteModal`)
10. Existing user-facing busy and error semantics must remain unchanged:
    - bulk form submission failures stay inline within the modal body
    - primary submit actions continue to use modal-loading semantics
    - conflicting cancellation or duplicate-submit actions stay disabled while submitting
    - reference-data modal refresh and blocking-load handling stays fail-closed and local to that modal family
11. The scaffold must preserve the current Ant Design `Modal` close-route defaults used by the existing bulk form modals. No explicit `keyboard`, `maskClosable`, or `closable` override is in scope for this refactor.
12. During submission, the refactor must preserve only the currently implemented disabling behaviour:
    - the modal cancel button remains disabled via `cancelButtonProps`
    - form controls remain disabled where the current modal already disables them
    - mask click, Escape, and close-icon routes remain on their current Ant Design defaults unless a separate product decision later changes that contract

## Existing system constraints

Documented constraints that materially shape the refactor.

### Backend or API constraints already in place

- None. This is a frontend-only refactor and must not change service contracts or backend method usage.

### Current data-shape constraints

- `BulkSetSelectModal` accepts a `string` key through `onConfirm(value: string)`.
- `BulkSetCourseLengthModal` accepts a numeric course length through `onConfirm(courseLength: number)`.
- `BulkCreateModal` accepts `BulkCreateOptions` through `onConfirm(options: BulkCreateOptions)`.
- Select options within the bulk form family currently use `{ label: string; value: string }`.
- Existing Zod validators in `bulkEditValidation.zod` remain the authoritative frontend validation contracts for the bulk-edit flows already using them.

### Frontend or consumer architecture constraints

- `ClassesManagementPanel.tsx` owns the open-state entry points for the classes modals and must remain the composition root for launching them.
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx` is the intended feature-local helper ownership path for the shared shell contract.
- The frontend modal-family policy requires reuse decisions to be justified by lifecycle and workflow fit rather than by shared use of Ant Design `Modal` alone.
- The shared-helper policy prefers feature-local helpers unless real cross-feature reuse exists.
- Modal loading, busy, and error states must continue to follow `docs/developer/frontend/frontend-loading-and-width-standards.md` and `docs/developer/frontend/frontend-modal-patterns.md`.

## Domain and contract recommendations

These recommendations should guide implementation unless a later explicit decision supersedes them.

### Why this approach is preferable

- It removes obvious repeated shell logic across three active callers without creating a prop-tunnel abstraction.
- It matches the current modal-family registry, which already identifies the bulk form modals as a coherent local family and the other modal families as intentionally distinct.
- It preserves testability by keeping domain validation, field markup, and workflow-specific copy close to each modal instead of hiding them behind a generic wrapper.

### Recommended behavioural shape

The shared scaffold should expose a narrow shell contract equivalent to:

```ts
{
  modal: {
    open: boolean;
    title: string;
    confirmLoading?: boolean;
    onCancel: () => void;
    destroyOnHidden: true;
  };
  form: {
    submitFromModalOk: true;
    resetOnCancel: true;
    inlineSubmissionError: string | null;
    initialValues?: Record<string, unknown>;
  };
  body: {
    formItemsRemainLocal: true;
    validationRemainsLocal: true;
  };
}
```

This is a behavioural contract, not a required prop-type declaration. The implementation may use one component, a small helper pair, or another feature-local shape as long as it preserves the same boundaries.
The planned ownership path for that shape is `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`.

### Naming recommendation

Prefer:

- `bulk form modal scaffold`
- `classes bulk form modal shell`

Avoid:

- `BaseModal`
- `GenericFormModal`
- `CrudModal`

These avoided names imply wider reuse than the accepted scope allows.

### Validation recommendation

#### Frontend

- Keep per-field validation local to each modal.
- Keep current Zod-backed schema usage where it already exists.
- Do not move option-membership validation or workflow-specific validation copy into the shared scaffold.

#### Backend

- No backend validation or transport changes are in scope.

### Display-resolution recommendation

- Existing titles, button labels, placeholder copy, and fallback error messages should remain unchanged unless the current refactor requires a tiny wording correction to preserve the pre-existing behaviour.
- The scaffold should standardise shell placement of the inline submission `Alert`, not the text content itself.
- The scaffold must preserve the current close-route behaviour of the three bulk form modals by leaving Ant Design `Modal` close defaults unchanged.

## Feature architecture

### Placement

- The accepted entry points remain the existing classes feature modals launched from `ClassesManagementPanel.tsx`.
- The accepted shared-helper ownership path for the new scaffold is `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`.
- No new shared modal entry point may be added outside the classes feature as part of this refactor.

### Proposed high-level tree

```text
ClassesManagementPanel
├── BulkCreateModal
│   └── BulkFormModalScaffold
├── BulkSetSelectModal
│   └── BulkFormModalScaffold
├── BulkSetCourseLengthModal
│   └── BulkFormModalScaffold
├── BulkDeleteModal
├── ManageCohortsModal
│   └── Existing manageReferenceData* helpers
└── ManageYearGroupsModal
    └── Existing manageReferenceData* helpers
```

### Out of scope for this surface

- redesigning `ClassesManagementPanel` or moving modal ownership out of it
- adding nested modal layers or new workflow steps
- extracting the reference-data helpers to a wider frontend shared location
- introducing a shared destructive-confirmation helper

## Data loading and orchestration

### Required datasets or dependencies

- `cohortOptions` and `yearGroupOptions` continue to be passed into the bulk form family exactly as they are today
- existing local form state and submission state inside each bulk modal remain the owned mutation boundary

### Prefetch or initialisation policy

#### Startup

- No new prefetch or startup logic is introduced by this refactor.

#### Feature entry

- Modal data readiness continues to be owned by the existing classes page and modal props.
- The scaffold must not add new query calls, cache ownership, or initialisation behaviour.

#### Manual refresh

- No manual refresh control is introduced.

### Query or transport additions

- None.

## Core view model or behavioural model

### Suggested shape

```ts
{
  submissionError: string | null;
  confirmLoading?: boolean;
  handleCancel: () => void;
  handleOk: () => void;
  handleFinish: (values: unknown) => Promise<void>;
}
```

### Derivation or merge rules

#### Idle

- no inline submission error is visible
- cancel remains available
- OK triggers form submission

#### Submitting

- the modal primary action shows busy state
- only the current cancel-button and form-control disabling behaviour is preserved during submit
- field inputs that would cause conflicting writes remain disabled
- Ant Design `Modal` close routes keep their current defaults

#### Submission failure

- the modal stays open
- the inline submission error alert is shown above the form body
- form values remain available so the user can correct and resubmit

#### Cancel or close

- local form state resets
- local submission error state clears
- ownership returns to the parent modal-open state in `ClassesManagementPanel`

### Sort order or priority rules

1. blocking or invalid load states already defined by the owning modal family
2. active submission busy state
3. inline submission error state
4. normal ready state

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Modal`
- Ant Design `Form`
- inline Ant Design `Alert` for submission errors

### Fields, columns, or visible sections

1. bulk form modal title region
2. inline submission error region when present
3. local form fields owned by the concrete modal

### Sorting, filtering, or navigation rules

- None added or changed by this refactor.

### Rendering rules

#### Classes bulk form modals

- continue rendering as one modal with one form
- continue submitting through the modal primary action
- keep validation messages and field content local to each concrete modal
- continue leaving close icon, mask click, and Escape handling on the current Ant Design defaults

#### Classes reference-data modals

- keep the current outer modal plus inline dialog workflow
- continue using the existing feature-local helper files

#### Destructive confirmation modals

- keep workflow-specific footer copy and action labelling local
- do not adopt the bulk form scaffold

## Workflow specification

## Bulk form modal open, cancel, and resubmit

### Eligible inputs or preconditions

- the parent surface has already decided to open one of the three bulk form modals
- the concrete modal has the data it already requires today

### Inputs, fields, or confirmation copy

- each modal keeps its current field set, copy, and validation rules

### Behaviour

- opening the modal presents the existing title and fields
- pressing the modal OK action submits the local form
- cancelling resets local form values and any inline submission error before delegating close
- a failed submission keeps the modal open and shows the inline error above the form
- the refactor must not add new close-route restrictions during submit beyond the existing cancel-button and form-control disabling

## Classes reference-data workflows

### Eligible inputs or preconditions

- `ManageCohortsModal` and `ManageYearGroupsModal` continue to own their current inner create, edit, and delete workflows

### Behaviour

- the current helper split across `manageReferenceDataDialogs.tsx`, `manageReferenceDataHelpers.ts`, and `InlineDialog.tsx` remains the accepted shared shape
- no further abstraction is required unless a later feature introduces genuinely new same-family duplication

## One-off destructive confirmations

### Eligible inputs or preconditions

- one destructive action is being confirmed within one workflow

### Behaviour

- `BulkDeleteModal` and `AssignmentsDeleteModal` remain local to their owning workflows
- copy, footer actions, and busy-state semantics remain workflow-specific
- this refactor must not introduce a generic destructive-confirmation wrapper

## Non-goals and deliberate deferrals

- no redesign of visible modal copy or layout
- no attempt to unify the bulk form family with the reference-data family
- no attempt to unify destructive confirmations across classes and assignments
- no changes to tests outside the touched modal family except where existing suites need minimal updates to reflect refactored internal structure without changing behaviour

## Open questions

- None at present. The user request and current codebase provide enough evidence to proceed with a planning-only refactor specification.

## Assumptions

1. The refactor should preserve the current `BulkCreateModal` initial course-length value of `1` because changing that behaviour would exceed the requested scope.
2. Existing public modal component names and parent call sites should remain stable unless a tiny internal rename is required inside the classes feature to support the new scaffold.
