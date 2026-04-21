# Classes Modal Family Compliance Refactor — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. No companion layout spec exists for this work because the refactor does not change visible layout or workflow structure.
3. Treat `SPEC.md` and the canonical frontend helper/modal docs as the source of truth for scope, helper boundaries, and non-goals.
4. Use this action plan to sequence delivery and testing only; do not move unresolved helper-boundary decisions into implementation.

## Scope and assumptions

### Scope

- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- real modal component specs:
  - `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
  - `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`
  - `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- any directly related classes modal tests needed to preserve current public behaviour
- canonical helper-planning reconciliation in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Out of scope

- `src/frontend/src/features/classes/ManageCohortsModal.tsx`
- `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`
- `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
- `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- `src/frontend/src/features/classes/InlineDialog.tsx`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- backend, transport, and service-layer changes
- user-visible workflow or copy changes beyond preserving existing behaviour

### Assumptions

1. `BulkCreateModal` must preserve its current `initialValues={{ courseLength: 1 }}` behaviour.
2. Public modal exports and parent call sites in `ClassesManagementPanel.tsx` should remain stable.
3. Existing modal-family policy documents already capture the accepted no-change decisions for the reference-data and destructive-confirmation families, so implementation should not reopen those boundaries.

---

## Global constraints and quality gates

### Engineering constraints

- Keep the refactor feature-local to `src/frontend/src/features/classes/**`.
- Do not introduce an app-wide or cross-feature modal helper.
- Keep field-specific validation, option-membership checks, payload mapping, initial values, and fallback error copy local to each concrete modal.
- Preserve existing busy, disabled, reset-on-cancel, and inline error semantics.
- Preserve the current Ant Design `Modal` close-route defaults for the bulk form family. Do not introduce `keyboard`, `maskClosable`, or `closable` overrides as part of this refactor.
- During submit, preserve only the current cancel-button and form-control disabling behaviour. Do not broaden submit-time close blocking to mask click, Escape, or close-icon routes.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write or adjust failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy the implementation while keeping tests green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, or `De-Sloppification`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section introduces or extends helper reuse:

1. keep the helper decision explicit in that section
2. record whether the helper is `reuse`, `extend`, `new`, or `keep local`
3. ensure the planned helper entries already recorded in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` remain aligned until implementation reconciles them
4. during the documentation pass, update `Not implemented` entries to the delivered outcome or to `Deferred` if the helper is deliberately not shipped

### Validation commands hierarchy

- Frontend lint: `npm run frontend:lint`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Full touched-classes feature tests: `npm run frontend:test -- src/frontend/src/features/classes`

---

## Section 1 — Docs-first modal signpost pass

### Objective

- Update the canonical frontend modal/helper docs before production changes begin so the accepted modal-family boundaries are explicit and planned helper entries are marked as unimplemented.

### Constraints

- This section is documentation-only. No production or test code changes are permitted.
- Keep the doc updates limited to the modal-family and helper-planning sources of truth already in scope.
- Every newly planned helper or boundary decision introduced by this refactor must be recorded as `Not implemented` until implementation and documentation reconciliation are complete.

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/docs.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
- `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- `src/frontend/src/features/classes/InlineDialog.tsx`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/code-reviewer.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
- `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- `src/frontend/src/features/classes/InlineDialog.tsx`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: classes bulk form modal scaffold
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
   - Call-site rationale: `BulkCreateModal`, `BulkSetSelectModal`, and `BulkSetCourseLengthModal` form the only currently justified three-caller shell family.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`
2. Helper: classes reference-data modal helper family
   - Decision: `reuse`
   - Owning module/path: `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`, `src/frontend/src/features/classes/InlineDialog.tsx`
   - Call-site rationale: this refactor keeps the existing reference-data helper family as the accepted reuse boundary.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`
3. Helper: one-off destructive confirmation modals
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/classes/BulkDeleteModal.tsx`, `src/frontend/src/pages/AssignmentsPage.tsx`
   - Call-site rationale: both confirmation flows remain workflow-specific one-offs whose copy and footer behaviour do not justify a shared abstraction.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` contains the planned helper entries for this refactor with status `Not implemented`.
- `docs/developer/frontend/frontend-modal-patterns.md` reflects the accepted family boundaries for this refactor without implying the new scaffold is already shipped.
- The documentation clearly records that the reference-data family is reused as-is and the destructive confirmation modals stay local.
- No production or test source files are changed in this section.

### Required test cases (Red first)

No new tests are written in this section because it is documentation-only.

### Section checks

- Manual review confirms all planned helper entries are present and marked `Not implemented`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** docs-only update to frontend modal patterns signposts; shared-helpers planned entries already `Not implemented`.
- **Deviations from plan:** approved deviation from strict TDD loop because this section is documentation-only with no test cases.
- **Follow-up implications for later sections:** Section 2 should keep shared-helper entries as `Not implemented` until final docs reconciliation.

---

## Section 2 — Introduce the feature-local bulk form modal scaffold

### Objective

- Add the narrow shared scaffold justified by the bulk form modal family and migrate the simpler existing callers onto it first.
- Use `BulkSetSelectModal` and `BulkSetCourseLengthModal` as the first adopters because they already share the clearest shell contract.

### Constraints

- Keep the scaffold at `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`.
- The scaffold may own only shared shell behaviour:
  - reset-on-cancel
  - modal OK submitting the form
  - inline submission error placement
  - `confirmLoading` and disabled conflicting actions
  - `destroyOnHidden` and any already-shared shell props
- Preserve the current Ant Design `Modal` close defaults by leaving `keyboard`, `maskClosable`, and `closable` on their existing implicit behaviour.
- Preserve only the existing cancel-button and form-control disabling during submit.
- Do not move domain validation, field markup, or fallback copy into the scaffold.
- Red/green coverage for this section must target the real modal contract, not only panel-level flows that stub the modal body.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/Testing.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/bulkSetCohort.spec.tsx`
- `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/implementation.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/code-reviewer.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCohort.spec.tsx`
- `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: classes bulk form modal scaffold
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
   - Call-site rationale: `BulkSetSelectModal`, `BulkSetCourseLengthModal`, and `BulkCreateModal` already repeat the same modal/form shell lifecycle, so a feature-local scaffold is now justified.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`
2. Helper: destructive confirmation modal wrapper
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/classes/BulkDeleteModal.tsx`, `src/frontend/src/pages/AssignmentsPage.tsx`
   - Call-site rationale: the current work does not justify merging one-off destructive confirmations.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `BulkSetSelectModal` and `BulkSetCourseLengthModal` both delegate shared shell behaviour through the new feature-local scaffold.
- Their visible titles, labels, placeholder copy, validation copy, and `onConfirm` value shapes remain unchanged.
- Cancelling still resets form state and clears inline submission errors before closing.
- Submitting through the modal primary action still works through form submission rather than bypassing validation.
- Submission failures still render an inline error alert above the form body and keep form values available for retry.
- Close icon, mask click, and Escape handling remain on the same Ant Design defaults as the current implementation.
- Submit-time disabling remains limited to the current cancel-button and form-control behaviour.

### Required test cases (Red first)

Frontend tests:

1. Add `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx` to render the real `BulkSetSelectModal` and prove:
   - modal OK still submits through the form
   - invalid or missing selection still shows the current validation messages
   - submission failures still render the inline error alert
   - cancel still resets local state
   - `confirmLoading` disables the cancel button and form control without changing the default Ant Design close routes
2. Add `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx` to render the real `BulkSetCourseLengthModal` and prove the same shell contract for the numeric flow.
3. Keep `src/frontend/src/features/classes/bulkSetCohort.spec.tsx` and `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx` as flow-level coverage only; do not rely on them as the primary red/green proof of the modal contract.
4. Keep `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx` as flow-level coverage only; do not rely on it as the primary red/green proof of the modal contract.
5. Keep `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx` and `src/frontend/src/features/classes/mutationSummary.spec.tsx` as secondary regression coverage only because they currently stub the modals.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx src/frontend/src/features/classes/bulkSetCohort.spec.tsx src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries are present and still marked `Not implemented` until implementation and docs reconciliation are complete.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the final scaffold contract is narrow but non-obvious enough that future modal additions could misuse it. Otherwise `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** to be filled during implementation.

---

## Section 3 — Migrate `BulkCreateModal` without broadening the scaffold contract

### Objective

- Extend the same scaffold to cover `BulkCreateModal` while keeping its extra form fields and payload mapping local.

### Constraints

- Preserve the current three-field bulk-create form structure.
- Preserve the current `courseLength` initial value of `1`.
- Keep allowed-cohort and allowed-year-group membership checks local to `BulkCreateModal`.
- Keep the fallback error copy specific to the create workflow.
- Do not widen the scaffold into a generic multi-workflow modal API just to absorb one extra caller.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/Testing.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/implementation.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/code-reviewer.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: classes bulk form modal scaffold
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
   - Call-site rationale: `BulkCreateModal` should consume the same shell contract while preserving its local field and payload rules.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`
2. Helper: reference-data modal helpers
   - Decision: `reuse`
   - Owning module/path: `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`, `src/frontend/src/features/classes/InlineDialog.tsx`
   - Call-site rationale: this section must not reopen the already-justified helper split for the reference-data family.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `BulkCreateModal` adopts the shared scaffold without changing its external props or its `onConfirm(BulkCreateOptions)` payload shape.
- The create modal still renders cohort, year-group, and course-length fields with their existing local validation rules.
- The create modal still submits through the modal primary action and shows inline submission failures inside the modal body.
- The scaffold contract remains narrow enough that it does not require unrelated reference-data or destructive-confirmation modals to adopt it.

### Required test cases (Red first)

Frontend tests:

1. `src/frontend/src/features/classes/BulkCreateModal.spec.tsx` is the required red/green modal-contract proof for `BulkCreateModal`. It must render the real modal and prove:
   - initial course length remains `1`
   - modal OK still submits through the form
   - field validation and allowed-option checks remain local and unchanged
   - submission failures still render the inline error alert
   - cancel still resets local state
   - `confirmLoading` disables the cancel button and form controls without changing the default Ant Design close routes
2. `src/frontend/src/features/classes/bulkCreate.spec.tsx` remains separate flow-level regression coverage only; it must not be used as the sole proof of the modal shell contract.
3. If `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx` or `src/frontend/src/features/classes/mutationSummary.spec.tsx` need small adjustments because the integration wiring changed, add failing regression assertions before making those adjustments and keep using the real modal spec as the primary contract coverage.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/BulkCreateModal.spec.tsx src/frontend/src/features/classes/bulkCreate.spec.tsx`
- any directly touched `ClassesManagementPanel` classes specs if the modal public contract changes in a test-visible way
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries remain aligned with the current implementation state.

### Optional `@remarks` JSDoc follow-through

- Use `@remarks` only if the final scaffold has a specific contract boundary that future callers are likely to overextend. Otherwise `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** to be filled during implementation.

---

## Regression and contract hardening

### Objective

- Verify that the refactor preserved the current public behaviour of the bulk form modal family and did not leak into the other modal families.

### Constraints

- Prefer the smallest relevant test set first, then broaden only if touched files or reviewer findings justify it.
- Reference-data and destructive-confirmation modals should be treated as regression boundaries, not new refactor targets.
- This phase may be delegated only if the mandatory-read lists below are used. Otherwise keep regression execution local.

### Acceptance criteria

- Touched bulk form modal specs pass.
- Any touched parent-panel tests pass.
- Existing reference-data helper tests remain green if their files were touched for incidental reasons.
- Frontend lint passes for the final diff.
- No unintended changes were made to `BulkDeleteModal`, `AssignmentsDeleteModal`, or the `manageReferenceData*` helper family unless explicitly documented as implementation fallout.

### Required test cases/checks

1. Run the touched bulk modal specs.
2. Run any touched classes panel specs.
3. If any reference-data helper file was edited, run:
   - `src/frontend/src/features/classes/manageReferenceDataDialogs.spec.tsx`
   - the touched `manageCohorts` or `manageYearGroups` specs
4. Run `npm run frontend:lint`.
5. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/Testing.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`
- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCohort.spec.tsx`
- `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/code-reviewer.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- touched source files
- touched specs

### Section checks

- All commands listed above complete successfully.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.

---

## Documentation and rollout notes

### Objective

- Reconcile planning-only helper entries and ensure the delivered refactor still matches the accepted modal-family boundaries.

### Constraints

- Update only documents that describe the touched helper and modal-family boundaries.
- Do not expand the docs into a broader modal-abstraction proposal.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` reflects the delivered outcome:
  - `Implemented` if the scaffold ships as planned
  - `Deferred` if the refactor deliberately keeps duplication local after implementation evidence
- Every Section 9.8 planned-only entry in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` is reconciled explicitly after implementation:
  - the scaffold entry is updated from `Not implemented` to `Implemented` if `src/frontend/src/features/classes/BulkFormModalScaffold.tsx` ships, or to `Deferred` if the scaffold is intentionally not delivered
  - the reference-data helper-family entry is updated from `Not implemented` to `Implemented` with a no-code-change rationale confirming that the existing helper family remains the accepted reuse boundary for this refactor
  - the one-off destructive confirmation entry is updated from `Not implemented` to `Implemented` with a no-code-change rationale confirming that both modals remain local by design for this refactor
- `docs/developer/frontend/frontend-modal-patterns.md` is updated during documentation reconciliation so the classes bulk form modal family description matches the delivered scaffold decision and the reference-data and destructive-confirmation families remain aligned with the final outcome
- Any doc wording continues to state that reference-data helpers stay feature-local and destructive confirmations stay local.
- Any deviations from the current `SPEC.md` are documented or the spec is updated before implementation is considered complete.

### Required checks

1. Reconcile every planned Section 9.8 helper entry in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, including the scaffold, reference-data helper family, and one-off destructive confirmation entries.
2. Update `docs/developer/frontend/frontend-modal-patterns.md` so the classes bulk form modal family description matches the delivered scaffold decision and keeps the other two modal families aligned with the final implementation outcome.
3. Confirm no layout spec was required because the visible structure did not change.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs and review handoffs.
5. Confirm whether any non-obvious scaffold-boundary reasoning should be retained in `@remarks` documentation.

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/docs.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
- `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- `src/frontend/src/features/classes/InlineDialog.tsx`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

If the scaffold and modal component specs ship in the implementation outcome, Docs must also read:

- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `.github/agents/code-reviewer.agent.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`
- `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- `src/frontend/src/features/classes/InlineDialog.tsx`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `src/frontend/src/features/classes/mutationSummary.spec.tsx`

If the scaffold and modal component specs ship in the implementation outcome, Code Reviewer must also read:

- `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- `src/frontend/src/features/classes/BulkCreateModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetSelectModal.spec.tsx`
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.spec.tsx`

### Optional `@remarks` JSDoc review

- `None` unless implementation reveals a non-obvious guardrail that future modal work is likely to violate.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.

---

## Suggested implementation order

1. Section 1 — Docs-first modal signpost pass.
2. Section 2 — Introduce the feature-local bulk form modal scaffold.
3. Section 3 — Migrate `BulkCreateModal` without broadening the contract.
4. Regression and contract hardening.
5. Documentation and rollout notes.

## Implementation tracker

### Section 1 — Docs-first modal signpost pass

- **Active phase:** Docs implementation in progress (approved deviation: documentation-only section, red/green test phases not applicable)
- [x] red tests added — **Status:** N/A (documentation-only section)
- [x] red review clean — **Status:** N/A (documentation-only section)
- [x] green implementation complete — **Status:** Complete
- [x] green review clean — **Status:** Complete
- [x] checks passed — **Status:** Complete (manual review + mandatory-read gate)
- [x] action plan updated — **Status:** Complete
- [ ] commit created — **Status:** In progress (pending)
- [ ] push completed — **Status:** In progress (pending)
- **Review findings:** None
- **Review resolutions:** Not applicable
- **Deviations:** approved deviation: documentation-only section, red/green test phases not applicable
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Section 2 — Introduce the feature-local bulk form modal scaffold

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Section 3 — Migrate BulkCreateModal without broadening the scaffold contract

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Regression and contract hardening

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Documentation and rollout notes

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Mandatory De-Sloppification pass

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started

### Final documentation pass

- [ ] red tests added — **Status:** Not started
- [ ] red review clean — **Status:** Not started
- [ ] green implementation complete — **Status:** Not started
- [ ] green review clean — **Status:** Not started
- [ ] checks passed — **Status:** Not started
- [ ] action plan updated — **Status:** Not started
- [ ] commit created — **Status:** Not started
- [ ] push completed — **Status:** Not started
- **Review findings:** Not started
- **Review resolutions:** Not started
- **Deviations:** None recorded
- **Commit evidence:** Not started
- **Push evidence:** Not started
