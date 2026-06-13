# Classes Settings Queued Bulk Actions Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`.
3. Read `src/frontend/AGENTS.md` and `src/backend/AGENTS.md` for component rules.
4. Treat the spec and layout documents as the source of truth for product behaviour, contracts, and layout rules.

## Scope and assumptions

### Scope

(Section 0 — Panel decomposition)

- `src/frontend/src/features/classes/bulk/bulkMutationResolution.ts` — extract resolution helpers and types from the panel.
- `src/frontend/src/features/classes/components/ClassesManagementPanelOutcomeAlert.tsx` — extract alert sub-component.
- `src/frontend/src/features/classes/components/ClassesManagementPanelLoadingState.tsx` — extract loading skeleton.
- `src/frontend/src/features/classes/components/classesManagementWorkflowBoundary.ts` — extract workflow-boundary helpers.
- `src/frontend/src/features/classes/bulk/bulkMutationResolution.spec.ts` — unit tests for extracted resolution logic.
- `src/frontend/src/features/classes/components/classesManagementWorkflowBoundary.spec.ts` — unit tests for boundary helpers.
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — refactored to import from extracted modules (~520 lines remaining).

(Sections 1–7 — Queued bulk actions feature)

- `src/frontend/src/services/apiService.ts` — add `cancelApiQueued`.
- `src/frontend/src/services/apiService.spec.ts` — add cancellation tests.
- `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts` — new queued batch engine.
- `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.spec.ts` — engine tests.
- `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx` — new progress modal component.
- `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.spec.tsx` — modal tests.
- `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts` — new feature hook.
- `src/frontend/src/features/classes/useClassesBulkMutationQueue.spec.ts` — hook tests.
- `src/frontend/src/features/classes/bulk/bulkCreateFlow.ts`, `bulkMetadataUpdateFlow.ts` — update to use queued engine.
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — wire hook, modal, and updated flows.
- `src/frontend/src/features/classes/bulk/bulkMutationResolution.ts` — extend for cancellation markers (Section 6).
- Existing `ClassesManagementPanel.spec.tsx` and related bulk-flow tests — update assertions.
- `src/frontend/e2e-tests/` — add progress-modal coverage.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — update §9.14 with planned helper entries.

### Out of scope

- Backend changes.
- Reusable app-wide progress modal abstraction.
- Per-action job names or priority queueing.
- Cancelling the active in-flight request.
- Removing the legacy `runBatchMutation` engine (retained for now).

### Assumptions

1. `callApiQueued` already exists and is implemented as defined in the existing `SPEC.md` / `apiService.ts`.
2. The shared E2E runtime mock's `releaseSignal` mechanism can be reused to pause/resume individual queued calls.
3. The existing `RowMutationResult` contract remains stable; cancelled rows are represented as `status: 'rejected'` with `error.reason === 'CANCELLED'`.
4. Feature-local helpers are not added to the shared helper doc unless they cross the two-caller threshold.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services, engines, hooks, and components.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Do not modify `callApi` or existing queue internals beyond the additive `cancelApiQueued` function.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents:

- `Testing Specialist`: must read `docs/developer/frontend/frontend-testing.md`, `SPEC.md`, `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`, and the relevant source/test files for that section.
- `Implementation`: must read `src/frontend/AGENTS.md`, `SPEC.md`, `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`, and the relevant source files for that section.
- `Code Reviewer`: must read `src/frontend/AGENTS.md`, `SPEC.md`, `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`, and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- `Playwright`: must read `docs/developer/frontend/frontend-playwright-e2e.md`, `SPEC.md`, `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`, and the relevant E2E harness files.
- `Docs`: must read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `SPEC.md`, and `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`.

### Shared-helper planning gate (mandatory when helper changes are expected)

Before implementation starts in Section 1:

1. Add the `cancelApiQueued` entry to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14 with status `Not implemented`.
2. Record feature-local helpers (`runQueuedBatchMutation`, `ClassesBulkProgressModal`, `useClassesBulkMutationQueue`) in Section 2's shared-helper planning block.
3. During the documentation pass, reconcile planned entries against actual implementation and update status/details accordingly.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend E2E tests: `npm run test:frontend:e2e -- <target>` (paths are relative to `src/frontend`)

---

## Section 0 — Pre-requisite decomposition of `ClassesManagementPanel.tsx`

### Objective

Decompose the 967-line `ClassesManagementPanel.tsx` into dedicated modules before adding any new logic. The panel stays as the orchestrator component (following the frontend service domain-folder grouping convention — `src/frontend/AGENTS.md` §12 — and the feature directory layout — `src/frontend/AGENTS.md` §2.3 — keeping sub-components in `components/` and business logic in feature-scoped module directories, with the original component file at the same path exporting the same public API). All four extractions are pure moves: zero behavioural change.

### LOC assessment (planner.agent.md §11)

**Current:**

- `ClassesManagementPanel.tsx` — 967 lines

**Extraction targets:**

| New module                                          | Approx. LOC | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bulk/bulkMutationResolution.ts`                    | ~350        | `getRejectedRowResults`, `hasAnyFulfilledRowResult`, `getBulkOutcomeTitle`, `createBulkFailureMessage`, `createBulkMetadataFailureMessage`, five `createBulk*FailureMessage` functions, `buildTopLevelBulkMutationResolution`, `buildMetadataBulkMutationResolution`, all supporting types (`BulkActionOutcomeAlert`, `BulkFailureMessageCopy`, `TopLevelBulkMutationCopy`, `TopLevelBulkActionDescriptor`, `TopLevelBulkMutationResolution`, `MetadataBulkMutationResolution`) |
| `components/ClassesManagementPanelOutcomeAlert.tsx` | ~20         | `ClassesManagementPanelOutcomeAlert` sub-component                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/ClassesManagementPanelLoadingState.tsx` | ~20         | `ClassesManagementPanelLoadingState` sub-component                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/classesManagementWorkflowBoundary.ts`   | ~55         | `ClassesWorkflowMutationBoundaryState`, `isClassesWorkflowMutationBoundaryActive`, `shouldSuppressClassesTableData`, `getClassesWorkflowBusyState`                                                                                                                                                                                                                                                                                                                              |

**After split:**

- `ClassesManagementPanel.tsx` — ~520 lines (60 lines for imports/state/derived, 210 for handlers/orchestration, 130 for JSX, ~120 for descriptors/export)
- Projected after queued-bulk-actions integration (Sections 4–5): ~600 lines

The panel at ~520–600 lines is the acceptable orchestrator — all domain logic and sub-components are extracted.

### Constraints

- Pure extraction: no behavioural change, no refactoring beyond decomposition.
- All public exports (`classesManagementPanelRegionLabel`, `ClassesManagementPanel`) stay in `ClassesManagementPanel.tsx`.
- No new abstractions beyond the extraction targets listed above.
- Update all cross-file imports in `src/frontend/src/` to reflect new paths for any symbols that become re-exported from the panel (none should — extracted types are internal, not imported externally).
- Existing test files that use dynamic `import('./ClassesManagementPanel')` do not change their import path.

### Acceptance criteria

- `ClassesManagementPanel.tsx` no longer contains inline definitions of any resolution helper, copy builder, sub-component, or workflow-boundary helper listed in the extraction targets.
- `ClassesManagementPanel.tsx` imports from the four new modules and delegates to them.
- `ClassesManagementPanel.tsx` still exports `classesManagementPanelRegionLabel` and `ClassesManagementPanel`.
- `bulkMutationResolution.ts` exports all resolution helpers with the same signatures.
- `classesManagementWorkflowBoundary.ts` exports `isClassesWorkflowMutationBoundaryActive`, `shouldSuppressClassesTableData`, `getClassesWorkflowBusyState`, and the `ClassesWorkflowMutationBoundaryState` type.
- All existing `ClassesManagementPanel.spec.tsx` and `ClassesManagementPanel.bulkMetadataFailure.spec.tsx` tests pass without modification.
- Lint is clean.

### Required test cases (Red first)

Frontend tests in new `bulkMutationResolution.spec.ts`:

1. `getRejectedRowResults` returns only rejected results from a mixed array.
2. `hasAnyFulfilledRowResult` returns true when at least one fulfilled result exists.
3. `getBulkOutcomeTitle` returns the full-failure title when failed count equals total.
4. `getBulkOutcomeTitle` returns the partial-failure title when failed count is less than total.
5. `createBulkFailureMessage` returns correct copy for all-failure, single-failure, partial-failure, and partial-refresh-failure cases.
6. `createBulkMetadataFailureMessage` delegates to `createBulkFailureMessage` with metadata-specific copy.
7. `buildTopLevelBulkMutationResolution` returns alert with correct type, title, and description for: full failure, partial failure, no failure, and refresh-failure cases.
8. `buildTopLevelBulkMutationResolution` preserves `selectedRowKeys` from rejected rows.
9. `buildMetadataBulkMutationResolution` returns all-failure outcome with `errorMessage` set and `shouldCloseModal: false`.
10. `buildMetadataBulkMutationResolution` returns partial-failure outcome with `alert` set and `shouldCloseModal: true`.

Frontend tests in new `classesManagementWorkflowBoundary.spec.ts`:

1. `isClassesWorkflowMutationBoundaryActive` returns false when all submitting flags are false.
2. `isClassesWorkflowMutationBoundaryActive` returns true when any submitting flag is true.
3. `shouldSuppressClassesTableData` returns true when `suppressStaleTableData` is true.
4. `shouldSuppressClassesTableData` returns true when `refreshRequiredMessage` is non-null.
5. `getClassesWorkflowBusyState` returns `'true'` when `isRefreshing` is true.

Existing integration tests (no new tests needed — the extraction is verified by existing test suite):

- `npm run test:frontend -- src/features/classes/ClassesManagementPanel.spec.tsx` — green.
- `npm run test:frontend -- src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx` — green.

### Section steps

These steps are sequential but should be executed as one TDD cycle (Red → Green → Refactor):

1. **Red**: Write the unit tests listed above for the four new modules. All pass zero tests initially.
2. **Green — Extract A**: Create `bulk/bulkMutationResolution.ts` with the extracted copy builders and resolution functions. Import from `./queryInvalidation`, `../classesManagementViewModel`, and `./batchMutationEngine` as needed.
3. **Green — Extract B**: Create `components/ClassesManagementPanelOutcomeAlert.tsx` (single sub-component).
4. **Green — Extract C**: Create `components/ClassesManagementPanelLoadingState.tsx` (single sub-component).
5. **Green — Extract D**: Create `components/classesManagementWorkflowBoundary.ts` (boundary helpers).
6. **Green — Update orchestrator**: In `ClassesManagementPanel.tsx`, replace the extracted inline definitions with imports from the new modules. Remove ~440 lines, add ~10 import lines.
7. **Refactor**: Run the full suite to confirm zero regressions.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md` (especially §2.2 on hooks/services and §2.3 on feature layout)
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` (the file being split)
- `SPEC.md`

### Section checks

1. `npm run test:frontend -- src/features/classes/bulk/bulkMutationResolution.spec.ts`
2. `npm run test:frontend -- src/features/classes/components/classesManagementWorkflowBoundary.spec.ts`
3. `npm run test:frontend -- src/features/classes/ClassesManagementPanel.spec.tsx`
4. `npm run test:frontend -- src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
5. `npm run lint:frontend`
6. Verify `ClassesManagementPanel.tsx` no longer contains inline copies of the extracted functions (grep for `function createBulk` should find zero hits in the panel file).
7. Verify all public exports are preserved at the same module path.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Sections 5 and 6 modify `buildTopLevelBulkMutationResolution` and `buildMetadataBulkMutationResolution` to detect cancellation markers and emit cancellation-specific copy and metadata all-failure alert migration. After this section, those functions live in `bulk/bulkMutationResolution.ts`.

---

## Section 1 — `cancelApiQueued` enabling contract

### Objective

Add the `cancelApiQueued` function to `apiService.ts` and validate it with unit tests. This is the enabling contract for the rest of the feature.

### Constraints

- Keep the change additive: do not alter `callApi`, `callApiQueued`, or the existing queue processing loop.
- `cancelApiQueued` must validate `jobName` as a non-empty string and throw synchronously on violation.
- For an unknown or idle job name, return `0`.
- For an active queue with pending items, remove all pending entries, reject each with `{ reason: 'CANCELLED' }`, and return the count removed.
- The active in-flight request, if any, must continue unaffected.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

Helper decision entries:

1. Helper: `cancelApiQueued`
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/services/apiService.ts`
   - Call-site rationale: small additive function consumed by the classes bulk queue in v1.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `cancelApiQueued` is exported from `apiService.ts`.
- Empty `jobName` throws synchronously.
- Unknown/idle job returns `0`.
- Pending entries are removed and rejected with `{ reason: 'CANCELLED' }`.
- Active in-flight request continues.
- The number of cancelled pending items is returned.

### Required test cases (Red first)

Frontend tests in `apiService.spec.ts`:

1. `cancelApiQueued('')` throws.
2. `cancelApiQueued('unknown-idle-job')` returns `0`.
3. Cancelling a queue with pending items rejects each pending promise with `{ reason: 'CANCELLED' }` and returns the correct count.
4. Cancelling while a request is active leaves the active request running and only removes pending items.
5. After cancellation, `getQueueState(jobName)` reflects the removed pending items.

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- Shared-helper entry added to `frontend-shared-helpers-and-abstraction-standards.md` §9.14 with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- `cancelApiQueued`: note that it only removes pending entries and cannot abort the active in-flight request.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 2 builds the engine that consumes `cancelApiQueued`.

---

## Section 2 — `runQueuedBatchMutation` engine

### Objective

Implement the feature-local batch engine that enqueues items through `callApiQueued`, tracks per-item progress, supports cancellation, and returns aggregated `RowMutationResult` entries.

### Constraints

- Live in `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`.
- Accept an array of `QueuedBatchItem` specs and an options object with `jobName` and optional `onProgress` callback.
- Use the shared `classesBulkMutation` job name.
- Return `Promise<RowMutationResult<ClassesManagementRow, TData>[]>`.
- Call `onProgress` after each item starts and after each item settles.
- Cancellation is achieved by calling `cancelApiQueued(jobName)` from the consumer (the hook); the engine simply awaits the resulting rejected promises like any other failure.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/bulk/batchMutationEngine.spec.ts`
- `src/frontend/src/services/apiService.spec.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

### Shared helper plan

Helper decision entries:

1. Helper: `runQueuedBatchMutation`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
   - Call-site rationale: feature-local batch engine for the seven classes bulk actions.
   - Relevant canonical doc target: feature-local; no shared doc update required.
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Engine enqueues each item through `callApiQueued` with the supplied method/parameters.
- Progress callback receives correct snapshots (current item, completed, pendingCount, total, isInProgress).
- Engine returns one `RowMutationResult` per input row.
- Backend failures are captured as `status: 'rejected'` with the backend error.
- Cancelled rows are captured as `status: 'rejected'` with `error.reason === 'CANCELLED'`.
- Empty input array resolves to an empty array immediately.

### Required test cases (Red first)

Frontend tests in `runQueuedBatchMutation.spec.ts`:

1. Empty items array resolves to empty results.
2. Single item resolves to fulfilled result.
3. Multiple items are processed sequentially (second dispatch only after first settles).
4. Progress callback fires with correct snapshots at start and after each settle.
5. Backend failure is captured as a rejected row result and the engine continues.
6. Cancellation via `cancelApiQueued` rejects pending items with `{ reason: 'CANCELLED' }` and the engine aggregates them correctly. (Use the deferred-release mock pattern from `apiService.spec.ts` to hold the active request pending while asserting cancellation.)
7. Results preserve submitted-row order.

### Section checks

- `npm run test:frontend -- src/features/classes/bulk/runQueuedBatchMutation.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `runQueuedBatchMutation`: note that progress snapshots are derived from the submitted-row promise order, which matches `callApiQueued` FIFO order for the same job name.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 3 renders the progress snapshots; Section 4 owns the hook that drives the engine.

---

## Section 3 — `ClassesBulkProgressModal` component

### Objective

Implement the progress modal presentational component according to the layout spec.

### Constraints

- Live in `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx`.
- Use Ant Design `Modal`, `Progress`, `Flex`, `Typography.Text`, and `Button`.
- Custom footer with only a Cancel button; default OK button removed.
- Header X / mask click / Escape call the dismiss handler; footer Cancel calls the cancel handler.
- Progress bar uses `status="active"`; no terminal status.
- Count is right-aligned; current item text is left-aligned.
- Accessible status region with `aria-live="polite"`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `SPEC.md`

### Shared helper plan

Helper decision entries:

1. Helper: `ClassesBulkProgressModal`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx`
   - Call-site rationale: one-off feature-local progress modal.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md` §3 registry (feature-local)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Modal renders title "Bulk class update in progress".
- Current item text displays `{verb} class {className}`.
- Progress bar percent equals `(completed / total) * 100`.
- Count displays `{completed} / {total}` in the bottom-right.
- Cancel button is disabled when `pendingCount === 0`.
- Footer Cancel is distinct from header/mask dismissal.
- Modal body content outside the live region is marked `aria-busy="true"` while `isInProgress`.

### Required test cases (Red first)

Frontend tests in `ClassesBulkProgressModal.spec.tsx`:

1. Renders current item text, progress bar, and count for a sample progress snapshot.
2. Cancel button is disabled when `pendingCount` is zero.
3. Cancel button is enabled when `pendingCount` is greater than zero.
4. Clicking the footer Cancel button calls the cancel callback.
5. Clicking the header X / mask calls the dismiss callback, not the cancel callback.
6. Modal body content outside the live region has `aria-busy="true"` while `isInProgress` is true.
7. On close, focus moves to the toolbar region (best-effort assertion).

### Section checks

- `npm run test:frontend -- src/features/classes/bulk/ClassesBulkProgressModal.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 4 wires the modal into the feature hook.

---

## Section 4 — `useClassesBulkMutationQueue` hook

### Objective

Implement the feature hook that owns queue progress state, modal visibility, cancellation, and the workflow-active boundary.

### Constraints

- Live in `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts`.
- Return `isQueueActive`, `progress`, `isProgressModalOpen`, `onDismissProgressModal`, `onCancelQueue`, and `runQueuedBulkAction`.
- `runQueuedBulkAction` takes a `mutate` function and an `onComplete` callback. It opens the modal, calls `mutate` with a progress callback, and calls `onComplete` with the settled results.
- `mutate` is provided by the panel and is typically a flow module (e.g. `bulkCreate`) updated to call `runQueuedBatchMutation` with the supplied `onProgress`.
- `onDismissProgressModal` hides the modal but does not cancel the queue.
- `onCancelQueue` calls `cancelApiQueued('classesBulkMutation')`.
- Reset the dismissed flag when the queue drains so the next bulk action re-opens the modal.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/useClassesManagement.spec.ts`
- `SPEC.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`
- `src/frontend/src/services/apiService.ts`

### Shared helper plan

Helper decision entries:

1. Helper: `useClassesBulkMutationQueue`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts`
   - Call-site rationale: feature hook that keeps `ClassesManagementPanel` declarative.
   - Relevant canonical doc target: feature-local hook; no shared doc update required.
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Hook returns the documented interface.
- `runQueuedBulkAction` opens the modal and updates progress snapshots.
- Modal closes automatically when the queue drains.
- Dismissal hides the modal but does not stop processing.
- `isQueueActive` is true for the full duration of the queued action.
- `onComplete` receives the aggregated row results.

### Required test cases (Red first)

Frontend tests in `useClassesBulkMutationQueue.spec.ts`:

1. Initial state: modal closed, queue inactive, zeroed progress.
2. Running an action with a `mutate` function opens the modal and publishes progress updates.
3. On drain, modal closes and `isQueueActive` becomes false.
4. Dismissing the modal hides it but keeps `isQueueActive` true until drain.
5. After drain, a new action re-opens the modal.
6. `onCancelQueue` calls `cancelApiQueued('classesBulkMutation')`.
7. The `mutate` function receives a progress callback that updates the hook's `progress` state.

### Section checks

- `npm run test:frontend -- src/features/classes/useClassesBulkMutationQueue.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `useClassesBulkMutationQueue`: note that `isQueueActive` is derived from the engine's `isInProgress` flag and is fed into the panel's existing workflow mutation boundary.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 5 wires the hook into the panel.

---

## Section 5 — Bulk flow updates and panel integration

### Objective

Update the existing bulk flow modules to use `runQueuedBatchMutation`, wire the hook into `ClassesManagementPanel`, close input modals on enqueue, and feed `isQueueActive` into the workflow mutation boundary.

### Constraints

- Update `bulkCreateFlow.ts` and `bulkMetadataUpdateFlow.ts` to call `runQueuedBatchMutation` and accept an `onProgress` callback that is forwarded to the engine.
- Keep `bulkSetCohortFlow.ts`, `bulkSetYearGroupFlow.ts`, and `bulkSetCourseLengthFlow.ts` as thin wrappers that delegate to the updated `bulkMetadataUpdate`, forwarding `onProgress`.
- Update the inline set-active, set-inactive, and delete handlers in `ClassesManagementPanel.tsx` to call `runQueuedBatchMutation` directly and accept `onProgress`.
- Update the panel descriptors so each action's `mutateRows` accepts `onProgress` and passes it to the flow module or inline handler.
- `runQueuedBulkAction` is called with a `mutate` function that invokes the relevant flow module / inline handler with the hook's progress callback, and an `onComplete` that runs the existing outcome-resolution and refresh orchestration.
- Close input modals (`createModalOpen`, `deleteModalOpen`, `setCohortModalOpen`, `setYearGroupModalOpen`, `setCourseLengthModalOpen`) synchronously before invoking `runBulkMutationOrchestration`.
- Reset form state for form modals after enqueue.
- Feed `queueActive` from the hook into the existing workflow mutation boundary by OR-ing it with the existing `setSubmitting` flags in `isClassesWorkflowMutationBoundaryActive` and `selectionFrozen`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkSetCohort.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkSetYearGroup.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkSetCourseLength.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkActiveState.spec.tsx`
- `src/frontend/src/features/classes/bulk/bulkDelete.spec.tsx`
- `SPEC.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
- `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts`
- `src/frontend/src/features/classes/bulk/bulkCreateFlow.ts`
- `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- `src/frontend/src/features/classes/bulk/bulkSetCohortFlow.ts`
- `src/frontend/src/features/classes/bulk/bulkSetYearGroupFlow.ts`
- `src/frontend/src/features/classes/bulk/bulkSetCourseLengthFlow.ts`

### Shared helper plan

No new helper decisions in this section. Reuse/extend decisions from Sections 1–4 are exercised here.

### Acceptance criteria

- All seven bulk actions call `runQueuedBatchMutation` with the hook's `onProgress` callback.
- Input modals close on enqueue.
- Progress modal opens on enqueue and closes on drain.
- Toolbar buttons and table selection are disabled for the full queue lifetime (`queueActive` OR-ed with existing submitting flags).
- Existing outcome alerts still render.
- Form modals reset after enqueue.

### Required test cases (Red first)

Frontend tests:

1. `ClassesManagementPanel.spec.tsx`: a queued bulk action opens the progress modal and disables the toolbar.
2. `ClassesManagementPanel.spec.tsx`: input modals close when the queued action starts.
3. `bulkCreate.spec.tsx`: create flow calls `runQueuedBatchMutation` with the correct items and returns its results; mock `runQueuedBatchMutation` to verify inputs and outputs.
4. `bulkSetCohort.spec.tsx`, `bulkSetYearGroup.spec.tsx`, `bulkSetCourseLength.spec.tsx`: metadata flows call `bulkMetadataUpdate` with `onProgress`, and `bulkMetadataUpdate` forwards it to `runQueuedBatchMutation`.
5. `bulkActiveState.spec.tsx`: active/inactive handlers call `runQueuedBatchMutation` with the correct items.
6. `bulkDelete.spec.tsx`: delete handler calls `runQueuedBatchMutation` with the correct items.

### Section checks

- `npm run test:frontend -- src/features/classes/ClassesManagementPanel.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkCreate.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkSetCohort.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkSetYearGroup.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkSetCourseLength.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkActiveState.spec.tsx`
- `npm run test:frontend -- src/features/classes/bulk/bulkDelete.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `ClassesManagementPanel`: note that input modals close synchronously before `runBulkMutationOrchestration` to avoid two modals stacking.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 6 adds cancellation-specific outcome messaging.

---

## Section 6 — Cancellation outcome messaging

### Objective

Extend the existing outcome-resolution helpers to detect cancelled rows and emit a distinct cancellation message, while preserving existing backend-failure copy.

### Constraints

- Detect cancelled rows via `result.status === 'rejected' && result.error?.reason === 'CANCELLED'`.
- Keep existing `buildTopLevelBulkMutationResolution` and `buildMetadataBulkMutationResolution` behaviour for non-cancelled failures.
- Surface cancellation copy separately from backend-failure copy when any cancelled rows exist.
- Because metadata modals close on enqueue, update `buildMetadataBulkMutationResolution` so all-failure metadata outcomes produce a panel-level alert (matching top-level actions) instead of an inline `errorMessage`.
- Ensure `runQueuedBatchMutation` preserves the raw `{ reason: 'CANCELLED' }` rejection from `cancelApiQueued` in the `error` field of rejected results (cross-reference Sections 1 and 2).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
- `SPEC.md`

### Shared helper plan

No new helper decisions.

### Acceptance criteria

- Cancelled rows are retained in selection.
- A distinct cancellation message appears in the alert banner when any rows are cancelled.
- Backend failures continue to use existing action-specific failure copy.
- Metadata full failure now surfaces as a panel-level alert, not an inline modal error.

### Required test cases (Red first)

Frontend tests:

1. `ClassesManagementPanel.spec.tsx`: cancelling some rows shows a cancellation message and retains cancelled rows in selection.
2. `ClassesManagementPanel.spec.tsx`: backend failures still show existing failure copy.
3. `ClassesManagementPanel.bulkMetadataFailure.spec.tsx`: all-failure metadata outcome shows a panel-level alert and closes the modal.

### Section checks

- `npm run test:frontend -- src/features/classes/ClassesManagementPanel.spec.tsx`
- `npm run test:frontend -- src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `buildTopLevelBulkMutationResolution` / `buildMetadataBulkMutationResolution`: note the cancellation marker and the new metadata all-failure alert behaviour.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 7 verifies the cancellation and failure UX end-to-end.

---

## Section 7 — E2E test coverage

### Objective

Add Playwright E2E tests for the progress modal appearance, count updates, cancellation, and disabled toolbar state.

### Constraints

- Reuse the shared runtime mock in `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` and the classes CRUD helpers in `src/frontend/e2e-tests/classes-crud.shared.ts`.
- Use the existing `releaseSignal` mechanism to pause and resume individual queued calls.
- Cover bulk create and bulk delete at minimum; add coverage for one metadata action if the harness supports it without significant extra work.

### Delegation mandatory reads

Playwright mandatory docs:

- `docs/developer/frontend/frontend-playwright-e2e.md`
- `src/frontend/e2e-tests/classes-crud.shared.ts`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- `SPEC.md`
- `CLASSES_BULK_PROGRESS_MODAL_LAYOUT.md`

### Shared helper plan

No new helper decisions.

### Acceptance criteria

- E2E tests verify the progress modal opens during a bulk action.
- Count updates are observable as queued calls complete.
- The Cancel button removes pending items and surfaces a cancellation message.
- Dismissing the modal does not stop the active queue.
- Toolbar buttons are disabled while the queue is active.

### Required test cases (Red first)

E2E tests in a new or existing classes CRUD spec:

1. Bulk create shows the progress modal with correct initial count.
2. Progress count updates as queued create calls complete.
3. Cancelling a multi-row create removes pending rows and shows a cancellation message.
4. Dismissing the progress modal allows the queue to continue; toolbar remains disabled.
5. Bulk delete disables toolbar buttons while the queue is active.

### Section checks

- `npm run test:frontend:e2e -- e2e-tests/classes-crud-bulk-progress.spec.ts` (or equivalent target; paths are relative to `src/frontend`)
- E2E tests pass locally and in CI.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** to be filled during implementation.
- **Follow-up implications for later sections:** Section 8 runs broader regression checks.

---

## Regression and contract hardening

### Objective

Run the full touched frontend test suites and lint checks to verify no regressions in existing `callApi`, bulk action, or panel behaviour.

### Constraints

- Prefer focused test runs before broader validation.
- Do not run unrelated suites unless a broader regression surface is suspected.

### Acceptance criteria

- All new unit tests pass.
- All updated existing tests pass.
- Frontend lint is clean.
- No test-only exports or debug accessors remain in production code.

### Required test cases/checks

1. `npm run test:frontend -- src/services/apiService.spec.ts`
2. `npm run test:frontend -- src/features/classes/bulk/runQueuedBatchMutation.spec.ts`
3. `npm run test:frontend -- src/features/classes/bulk/ClassesBulkProgressModal.spec.tsx`
4. `npm run test:frontend -- src/features/classes/useClassesBulkMutationQueue.spec.ts`
5. `npm run test:frontend -- src/features/classes/ClassesManagementPanel.spec.tsx`
6. `npm run test:frontend -- src/features/classes/bulk/bulkCreate.spec.tsx`
7. `npm run test:frontend -- src/features/classes/bulk/bulkSetCohort.spec.tsx`
8. `npm run test:frontend -- src/features/classes/bulk/bulkSetYearGroup.spec.tsx`
9. `npm run test:frontend -- src/features/classes/bulk/bulkSetCourseLength.spec.tsx`
10. `npm run test:frontend -- src/features/classes/bulk/bulkActiveState.spec.tsx`
11. `npm run test:frontend -- src/features/classes/bulk/bulkDelete.spec.tsx`
12. `npm run test:frontend -- src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
13. `npm run test:frontend:e2e -- e2e-tests/classes-crud-bulk-progress.spec.ts` (or equivalent target; paths are relative to `src/frontend`)
14. `npm run lint:frontend`
15. Verify no `__` prefixed production exports.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during regression.
- **Deviations from plan:** to be filled during regression.

---

## Documentation and rollout notes

### Objective

Update docs to match the implemented feature and reconcile planned helper entries.

### Constraints

- Only modify documents relevant to the touched areas.
- Do not add speculative docs.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14 reflects the delivered `cancelApiQueued` extension with status `Implemented`.
- Feature-local helper entries are removed from the shared doc or left out if they never crossed the two-caller threshold.
- Any deviations or caveats are documented in the implementation notes.

### Required checks

1. Verify `frontend-shared-helpers-and-abstraction-standards.md` accurately references `cancelApiQueued`, its owning path, and call-site rationale.
2. Confirm no stale `Not implemented` entries remain for delivered helpers.
3. Verify mandatory-read evidence (`Files read`) is complete for delegated docs handoffs.
4. Reconcile planned shared-helper entries against actual implementation.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions (modal stacking, cancellation-only-pending, metadata all-failure alert migration) discovered during implementation should be preserved in `@remarks` documentation.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during documentation pass.
- **Deviations from plan:** to be filled during documentation pass.

---

## Suggested implementation order

1. **Section 0** — Pre-requisite decomposition of `ClassesManagementPanel.tsx` (extract resolution helpers, sub-components, workflow-boundary helpers into dedicated modules)
2. **Section 1** — `cancelApiQueued` enabling contract
3. **Section 2** — `runQueuedBatchMutation` engine
4. **Section 3** — `ClassesBulkProgressModal` component
5. **Section 4** — `useClassesBulkMutationQueue` hook
6. **Section 5** — Bulk flow updates and panel integration
7. **Section 6** — Cancellation outcome messaging (edits `bulk/bulkMutationResolution.ts` after Section 0 established it)
8. **Section 7** — E2E test coverage
9. **Regression and contract hardening**
10. **Documentation and rollout notes**
