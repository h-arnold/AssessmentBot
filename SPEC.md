# Classes Settings Queued Bulk Actions Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for moving all bulk actions on the Classes settings page onto the existing `callApiQueued` transport queue and surfacing their progress through a new Ant Design progress modal.

The feature will be used to:

- eliminate the race condition that occurs when multiple parallel `upsertABClass`, `updateABClass`, or `deleteABClass` calls contend to update `ABClassPartials` at the same time
- give users visible, accessible feedback during long-running bulk operations
- let users cancel any queued-but-not-yet-submitted items without waiting for the whole batch to finish

This feature is **not** intended to:

- add backend-side queueing, locking, or atomicity guarantees
- change the existing ABClass mutation API contracts (`upsertABClass`, `updateABClass`, `deleteABClass`)
- replace the existing `callApi` transport or affect non-class callers
- queue non-bulk class actions such as single-row inline edits in other surfaces

## Agreed product decisions

1. All seven bulk actions on the Classes settings page share a single `callApiQueued` job name, so only one class bulk mutation runs at a time across the panel.
2. The seven covered actions are: Create ABClass, Set active, Set inactive, Set cohort, Set year group, Set course length, and Delete ABClass.
3. Each bulk action enqueues one `callApiQueued` request per affected row. Requests execute strictly one-at-a-time in FIFO order.
4. A new progress modal opens automatically when a queued bulk action starts. It closes automatically when the queue drains. While the queue is active, the user may dismiss the modal (which hides it but does not stop processing).
5. The progress modal contains a Cancel button. Clicking Cancel clears all pending (not-yet-dispatched) queue entries for the shared job name and rejects them as cancelled. The currently active request continues to completion because `google.script.run` does not support transport-level abort.
6. While any class bulk queue request is active, all ABClass CRUD triggers in the Classes settings toolbar and the table-row selection checkboxes are disabled. The existing `setSubmitting` flags driven by `runBulkMutationOrchestration` already keep the workflow boundary active for the full duration of `runQueuedBulkAction`; the hook's `isQueueActive` flag is fed into the same boundary so the UI stays consistent even if an individual action's `setSubmitting` were to be cleared early.
7. The progress line inside the modal reads `{verb} class {className}` where the verbs are:
   - Create: `Creating`
   - Delete: `Deleting`
   - Set active: `Activating`
   - Set inactive: `Deactivating`
   - Set cohort: `Setting cohort for`
   - Set year group: `Setting year group for`
   - Set course length: `Setting course length for`
8. The bottom-right corner of the modal shows the count `{completed} / {total}` where `completed` is the number of requests that have settled (resolved or rejected) and `total` is the number of requests originally enqueued for the current bulk action.
9. The existing mutation outcome alerts, refresh behaviour, and selection handling in `ClassesManagementPanel` are preserved. Failures and refresh failures continue to be surfaced through the existing alert banner.
10. The existing `callApiQueued` helper in `src/frontend/src/services/apiService.ts` is extended with a small additive cancellation function. No other shared helper is created unless justified by the two-caller rule.
11. The input/confirmation modal (Create, Delete, Set cohort, Set year group, Set course length) closes as soon as the queue is enqueued. The progress modal is the only visible modal while the queue is active.
12. Cancelled rows are surfaced through a distinct outcome message so users do not mistake a user-initiated cancellation for a backend error.
13. After the queue drains, the progress modal's dismissed state resets so the next bulk action re-opens it automatically.

## Existing system constraints

### Backend or API constraints already in place

- The active class mutation handlers are `upsertABClass`, `updateABClass`, and `deleteABClass`, registered in `src/backend/z_Api/z_apiHandler.js`.
- `updateABClass` and `upsertABClass` update the full class document and then `_upsertClassPartial`. Parallel callers can read the same document, apply different patches, and overwrite the partial registry.
- `deleteABClass` removes the full record and the partial. Parallel deletes are less likely to race each other but still benefit from serialisation for the partial-registry write.
- Backend responses remain the existing success/error envelopes handled by `callApi`.

### Current data-shape constraints

- `callApiQueued` signature is `callApiQueued<TResponse>(method: string, parameters: unknown, jobName: string): Promise<TResponse>`.
- `getQueueState(jobName)` returns `{ pending: number; active: boolean }`. It is a snapshot, not a reactive subscription.
- The existing bulk flows (`bulkCreateFlow.ts`, `bulkMetadataUpdateFlow.ts`, `bulkActiveStateFlow.ts`) and the inline delete handler in `ClassesManagementPanel.tsx` use `runBatchMutation`, which dispatches in parallel.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls must route through `callApi` / `callApiQueued` in `apiService.ts`.
- Feature state and side effects belong in feature hooks; `ClassesManagementPanel` must stay declarative.
- The existing `runBulkMutationOrchestration` wrapper performs the required class-partials refresh and query invalidation after a bulk mutation.
- The toolbar already exposes a `mutationInFlight` boundary that disables conflicting bulk actions.

## Domain and contract recommendations

### Why this approach is preferable

- Reuses the already-implemented `callApiQueued` FIFO queue instead of inventing a new concurrency model.
- Keeps the race-condition fix local to the frontend call sites without requiring backend locking changes.
- Surfaces progress without altering the existing success/failure/refresh outcome model.
- Cancellation is limited to pending items, matching the reality that the active GAS request cannot be aborted.

### Recommended data shapes

#### Cancelled queue rejection

```ts
{
  reason: 'CANCELLED';
}
```

Pending requests removed by cancellation reject with an object whose `reason` is `'CANCELLED'`. The resulting `RowMutationResult` entries have `status: 'rejected'` and `error.reason === 'CANCELLED'`. The existing outcome-resolution helpers in `ClassesManagementPanel.tsx` are extended to detect this marker and emit cancellation-specific copy, while continuing to treat backend failures with the existing action-specific failure messages.

#### Verb-to-backend-method mapping for progress display

The following table maps each progress verb to the backend method used by the queued batch engine. This mapping is explicit so the verb shown in the progress modal always matches the actual transport call.

| User-facing verb            | Backend method  | Bulk action       |
| --------------------------- | --------------- | ----------------- |
| `Creating`                  | `upsertABClass` | Create ABClass    |
| `Deleting`                  | `deleteABClass` | Delete ABClass    |
| `Activating`                | `updateABClass` | Set active        |
| `Deactivating`              | `updateABClass` | Set inactive      |
| `Setting cohort for`        | `updateABClass` | Set cohort        |
| `Setting year group for`    | `updateABClass` | Set year group    |
| `Setting course length for` | `updateABClass` | Set course length |

#### Queued batch item spec

```ts
{
  row: ClassesManagementRow;
  method: 'upsertABClass' | 'updateABClass' | 'deleteABClass';
  parameters: unknown;
  verb: string;
  className: string;
}
```

#### Batch progress snapshot

```ts
{
  currentItem: {
    verb: string;
    className: string;
  } | null;
  completed: number;
  pendingCount: number;
  total: number;
  isInProgress: boolean;
}
```

#### `runQueuedBatchMutation` contract

```ts
export function runQueuedBatchMutation<TData>(
  items: QueuedBatchItem[],
  options: {
    jobName: string;
    onProgress?: (snapshot: BatchProgressSnapshot) => void;
  }
): Promise<RowMutationResult<ClassesManagementRow, TData>[]>;
```

The engine enqueues each item through `callApiQueued` using the supplied `jobName`. It calls `onProgress` synchronously after each item starts and after each item settles. The returned Promise resolves to the aggregated row results when every item has settled.

### Naming recommendation

Prefer:

- `classesBulkMutation` as the shared `jobName` value
- `cancelApiQueued` for the new cancellation function
- `ClassesBulkProgressModal` for the progress modal component
- `runQueuedBatchMutation` for the new batch engine

Avoid:

- `useApiQueued` — the existing helper is `callApiQueued`
- per-action `jobName` values — the user explicitly chose a single shared queue

### Validation recommendation

#### Frontend

- `cancelApiQueued` validates `jobName` as a non-empty string and throws synchronously if invalid.
- Cancellation is a no-op (returns `0`) for an unknown or idle job name.
- Queued batch items must carry a valid backend method name and a non-empty `className` for progress display.

#### Backend

- No backend changes are required.

## Feature architecture

### Placement

- `src/frontend/src/services/apiService.ts` — adds `cancelApiQueued` alongside existing `callApiQueued` exports.
- `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts` — new feature-local batch engine that enqueues items sequentially and tracks per-item progress.
- `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx` — new feature-local progress modal component.
- `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts` — new feature hook that owns queue progress state, modal visibility, cancellation, and the workflow-active boundary.
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — receives derived state and callbacks from the hook and wires the modal and existing bulk action descriptors together.
- `src/frontend/src/features/classes/table/ClassesToolbar.tsx` — already consumes `mutationInFlight`; the boundary is extended via the hook.
- Existing bulk flow modules (`bulkCreateFlow.ts`, `bulkMetadataUpdateFlow.ts`, `bulkSetCohortFlow.ts`, `bulkSetYearGroupFlow.ts`, `bulkSetCourseLengthFlow.ts`) and the inline active-state/delete handlers in `ClassesManagementPanel.tsx` — updated to call `runQueuedBatchMutation` and accept an `onProgress` callback from the hook.

### `useClassesBulkMutationQueue` hook interface

```ts
export type UseClassesBulkMutationQueueResult = Readonly<{
  isQueueActive: boolean;
  progress: BatchProgressSnapshot;
  isProgressModalOpen: boolean;
  onDismissProgressModal: () => void;
  onCancelQueue: () => void;
  runQueuedBulkAction: (options: {
    mutate: (
      onProgress: (snapshot: BatchProgressSnapshot) => void
    ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    onComplete: (results: RowMutationResult<ClassesManagementRow, unknown>[]) => Promise<void>;
  }) => Promise<void>;
}>;

export function useClassesBulkMutationQueue(): UseClassesBulkMutationQueueResult;
```

`isQueueActive` is true while any queued request is unsettled and is fed into the existing workflow mutation boundary. `runQueuedBulkAction` opens the progress modal, calls `mutate` with a progress callback, and calls `onComplete` with the settled results so the panel can run the existing outcome-resolution and refresh orchestration. The hook lives at the feature root alongside `useClassesManagement.ts`.

### Proposed high-level tree

```text
ClassesManagementPanel
├── useClassesBulkMutationQueue hook (owns queue state and modal state)
├── existing bulk modals (BulkCreateModal, BulkDeleteModal, BulkSetSelectModal, BulkSetCourseLengthModal) (close on enqueue)
├── ClassesToolbar (disabled when queue active)
├── ClassesTable (selection frozen when queue active)
├── ClassesAlertStack (existing outcome alerts)
└── ClassesBulkProgressModal (auto-opens during queued bulk actions)
    ├── Progress bar
    ├── Current item text ({verb} class {className})
    └── Count + Cancel button
```

Component placement:

- `ClassesBulkProgressModal.tsx` lives at `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx` (feature-local under `bulk/`).

### Out of scope for this surface

- Inline single-row class edits elsewhere in the app.
- Queueing for non-class settings actions (e.g. reference-data management).
- Backend atomicity improvements.

## Data loading and orchestration

### Required datasets or dependencies

- The existing `ClassesManagementRow` view model provides `classId`, `className`, and `status`.
- `callApiQueued` and the new `cancelApiQueued` from `apiService.ts`.
- Existing class-partials query invalidation via `runBulkMutationOrchestration`.

### Prefetch or initialisation policy

No change to startup prefetching. The queue is empty until a bulk action is triggered.

### Query or transport additions

- New exported function `cancelApiQueued(jobName: string): number` in `apiService.ts`.
- New feature-local engine `runQueuedBatchMutation` that uses `callApiQueued` with the shared `classesBulkMutation` job name.

## Core view model or behavioural model

### Queue-driven progress derivation

The batch engine creates one Promise per row by calling `callApiQueued`. It tracks progress by waiting for each Promise in submission order:

1. `currentItem` is the first unsettled item in the submitted order.
2. `completed` increments every time any Promise settles.
3. `pendingCount` is the number of items that have been enqueued but not yet settled, excluding the current item (i.e. `total - completed - (currentItem ? 1 : 0)`).
4. `total` is fixed at enqueue time.
5. `isInProgress` is true while any item is still unsettled.

Because `callApiQueued` is FIFO, the first unsettled Promise is also the one currently dispatched by the queue.

### Cancellation semantics

- `cancelApiQueued('classesBulkMutation')` removes every pending `QueueEntry` from the internal queue map entry.
- Each removed entry's Promise rejects with `{ reason: 'CANCELLED' }`.
- The currently active in-flight request (if any) continues unaffected and is **not** counted as cancelled.
- If the queue is not active and has no pending items, cancellation is a no-op and returns `0`.
- The function returns the number of **pending** items cancelled (excludes the active in-flight request).

## Main user-facing surface specification

### Recommended components or primitives

- `Modal` from Ant Design for the progress shell.
- `Progress` (line type) from Ant Design for the visual progress bar.
- `Flex` / `Space` / `Typography` from Ant Design for layout and text.

### Fields, columns, or visible sections

1. **Title**: action-agnostic, e.g. "Bulk class update in progress".
2. **Current item text**: `{verb} class {className}`.
3. **Progress bar**: shows `completed / total` as a percentage.
4. **Count**: `{completed} / {total}` aligned to the bottom-right.
5. **Cancel button** (footer): cancels remaining queued items. This is separate from closing the modal.
6. **Close affordance** (Modal header X and mask click): dismisses the modal without cancelling queued items.

### Modal state-machine transitions

1. `isProgressModalOpen` becomes `true` when `runQueuedBulkAction` starts.
2. `isProgressModalOpen` becomes `false` when the queue drains.
3. User dismissal sets an internal `dismissed` flag to `true` and `isProgressModalOpen` to `false`; processing continues.
4. `dismissed` resets to `false` when the queue drains.
5. A new bulk action clears `dismissed` and sets `isProgressModalOpen` to `true`.
6. The modal is not re-opened automatically while it is dismissed and the queue is still active.

### Rendering rules

#### Queue active

- The triggering input/confirmation modal closes immediately after enqueue.
- Progress modal is open (unless the user has dismissed it).
- Current item text shows the active row.
- Progress bar animates and shows partial fill.
- Count updates as each row settles.
- Cancel button is enabled when `pendingCount > 0`; it is disabled when `pendingCount === 0`.
- Table row selection checkboxes are disabled.
- All bulk-action toolbar buttons are disabled.

#### Queue drained

- Progress modal closes automatically.
- Dismissal state resets so the next bulk action re-opens the progress modal.
- Existing alert banner in `ClassesManagementPanel` surfaces success, partial failure, refresh failure, or cancellation summary.
- Selection is updated to retain only failed or cancelled rows, matching existing behaviour.

#### Dismissed while active

- Modal is hidden.
- Processing continues.
- Toolbar remains disabled and table selection remains frozen until the queue drains.
- Outcome alerts still appear when the queue drains.

#### Cancelled

- Pending items are removed and rejected.
- Active item continues.
- Modal remains open until the remaining active item settles and the queue drains.
- Cancelled rows are treated as rejected in the outcome resolution and are surfaced with a distinct cancellation message.

## Workflow specification

### Shared workflow rules

1. The panel handler closes the triggering input/confirmation modal state synchronously before invoking `runBulkMutationOrchestration`.
2. `runBulkMutationOrchestration` continues to own `setSubmitting`, feedback clearing, the required class-partials refresh, and query invalidation.
3. `runBulkMutationOrchestration` awaits `runQueuedBulkAction`, which calls the relevant flow module (now updated to call `runQueuedBatchMutation`) with the hook's progress callback.
4. Form modals must reset their form state after a queued bulk action is enqueued, either by invoking the modal's existing cancel/reset path or by resetting the form instance explicitly.
5. Because metadata modals close on enqueue, all-failure feedback for metadata actions is surfaced through the panel-level alert banner instead of inline inside the modal. `buildMetadataBulkMutationResolution` is updated so that a full metadata failure now returns `shouldCloseModal: true`, `errorMessage: null`, and a panel-level `alert` (matching the top-level action pattern), with failed rows retained in the selection. `handleBulkMetadataMutationResult` no longer throws an inline error message.

### Create ABClass

#### Eligible inputs or preconditions

- User has selected one or more rows with `status === 'notCreated'`.
- Cohort, year group, and course length values are supplied from `BulkCreateModal`.

#### Behaviour

1. User confirms in `BulkCreateModal`.
2. `BulkCreateModal` closes and the queued batch engine is called with one `upsertABClass` request per selected not-created row.
3. Progress modal opens and shows "Creating class {className}" for each row.
4. On drain, the existing orchestration refreshes class partials and shows outcome alerts.

### Delete ABClass

#### Eligible inputs or preconditions

- User has selected one or more rows.

#### Behaviour

1. User confirms in `BulkDeleteModal`.
2. `BulkDeleteModal` closes and the panel calls the queued batch engine with one `deleteABClass` request per selected row.
3. Progress modal shows "Deleting class {className}" for each row.
4. On drain, the existing orchestration refreshes and shows outcome alerts.

### Set active / Set inactive

#### Eligible inputs or preconditions

- Set active: all selected rows have `status === 'inactive'`.
- Set inactive: all selected rows have `status === 'active'`.

#### Behaviour

1. User clicks the toolbar button.
2. Panel calls the queued batch engine with one `updateABClass` request per eligible row, setting `active: true` or `active: false`.
3. Progress modal shows "Activating class {className}" or "Deactivating class {className}".
4. On drain, existing orchestration runs.

### Set cohort / year group / course length

#### Eligible inputs or preconditions

- User has selected one or more existing rows (`status === 'active' || 'inactive'`).
- A single value is supplied from the relevant metadata modal.

#### Behaviour

1. User confirms in `BulkSetSelectModal` or `BulkSetCourseLengthModal`.
2. The metadata modal closes and the panel calls the queued batch engine with one `updateABClass` request per eligible row.
3. Progress modal shows "Setting cohort for class {className}", "Setting year group for class {className}", or "Setting course length for class {className}".
4. On drain, existing orchestration runs.

## Error, loading, and empty-state rules

### Blocking failure

- If the active request throws a transport error (e.g. `google.script.run` unavailable), the queue continues with the next item after rejecting that Promise.
- Blocking failures of the underlying queries (Google Classrooms, class partials) continue to use the existing `ClassesAlertStack` and panel-level error states.

### Partial-load or partial-success failure

- Individual row failures are captured as `RejectedRowResult` entries.
- The existing `buildTopLevelBulkMutationResolution` and `buildMetadataBulkMutationResolution` functions are extended to detect `error.reason === 'CANCELLED'` and emit cancellation-specific copy.
- Cancelled rows are treated as rejected, retained in the selection, and surfaced with a distinct cancellation message (e.g. "{count} class(es) were cancelled before processing.") separate from backend-failure copy.

### Empty states

- Not applicable: bulk actions require at least one selected row, and the toolbar already disables ineligible actions.

## Accessibility and usability notes

- The progress modal must publish an accessible status. Use `aria-live="polite"` on the current-item text and count so screen readers announce progress updates.
- The modal body content (excluding the live region) should be marked `aria-busy="true"` while the queue is active.
- Toolbar buttons and table-row selection checkboxes remain disabled while the queue is active. The progress modal itself communicates the busy reason; the toolbar does not need a separate tooltip because the modal is the primary status surface.
- When the modal closes automatically on drain, focus moves to the first enabled button in the Classes toolbar region, or to the toolbar region container if no button is enabled.
- The Cancel button must clearly indicate it cancels _remaining_ items, not the active one. The button label must be "Cancel remaining".

## Backend changes required to support agreed behaviour

None. This is a frontend-only change that serialises calls through the existing API.

## Planning handoff notes

- The action plan must sequence the `cancelApiQueued` contract addition in `apiService.ts` before the batch engine and UI work.
- The new batch engine returns `RowMutationResult<ClassesManagementRow, unknown>[]`. The existing outcome-resolution helpers are extended to recognise cancelled rows (`error.reason === 'CANCELLED'`) and emit cancellation-specific copy, while preserving their current behaviour for backend failures.
- The modal must be kept local to the classes feature; it is not a reusable app-wide progress modal.
- E2E tests must cover the progress modal appearance, count updates, cancellation, and the disabled toolbar state. The shared E2E harness already supports per-response `releaseSignal` deferred responses; this mechanism can be reused to pause and resume individual queued calls for count-update and cancellation assertions.
- The following call sites are updated to call `runQueuedBatchMutation` instead of `runBatchMutation`, and accept an `onProgress` callback that they forward to the engine:
  - `bulkCreateFlow.ts`
  - `bulkMetadataUpdateFlow.ts` (consumed by `bulkSetCohortFlow.ts`, `bulkSetYearGroupFlow.ts`, and `bulkSetCourseLengthFlow.ts`)
  - the inline set-active and set-inactive handlers in `ClassesManagementPanel.tsx`
  - the inline delete handler in `ClassesManagementPanel.tsx`
    The panel descriptors continue to use the updated flow modules without duplicating mutation logic. `runBatchMutation` and its existing tests are retained for now; a future de-sloppification pass can decide whether to remove them once the queued engine is fully validated.

### Shared-helper planning entries

Record the shared helper entry in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14 before implementation starts:

1. Helper: `cancelApiQueued`
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/services/apiService.ts`
   - Call-site rationale: small additive function that clears pending entries for a job name; consumed only by the classes bulk queue in v1.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14
   - Planned doc status: `Not implemented`

Feature-local helpers (record in the action plan only; no shared-doc update required):

2. Helper: `runQueuedBatchMutation`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
   - Call-site rationale: feature-local batch engine that enqueues class mutations, tracks progress, and supports cancellation for the seven classes bulk actions.

3. Helper: `ClassesBulkProgressModal`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/bulk/ClassesBulkProgressModal.tsx`
   - Call-site rationale: one-off feature-local progress modal; no second caller exists or is planned.

4. Helper: `useClassesBulkMutationQueue`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classes/useClassesBulkMutationQueue.ts`
   - Call-site rationale: feature hook that owns queue progress state, modal visibility, and cancellation side effects so `ClassesManagementPanel` stays declarative.

## Testing expectations

- **Frontend unit tests (Vitest)**:
  - `cancelApiQueued` validation and behaviour in `apiService.spec.ts`: throws on empty `jobName`; returns `0` for unknown/idle job; cancels pending items and rejects them with `{ reason: 'CANCELLED' }`; leaves the active item running; returns the count of cancelled items.
  - New `runQueuedBatchMutation` engine: sequential enqueue through `callApiQueued`, progress callback firing with correct snapshots, cancellation of pending items, correct `RowMutationResult` aggregation including cancelled rows.
  - `ClassesBulkProgressModal` rendering: current item text, progress bar percent, count display, Cancel button disabled when `pendingCount === 0`, close affordance dismisses without cancelling.
  - `ClassesManagementPanel` integration: modal opens on bulk action, input modals close on enqueue, toolbar is disabled and table selection is frozen while queue active, existing outcome alerts still render, cancellation message appears when rows are cancelled.
  - Outcome-resolution extension: cancelled rows produce cancellation-specific copy while backend failures retain existing action-specific copy.
- **Frontend E2E tests (Playwright)**:
  - Bulk create shows progress modal and count updates.
  - Bulk delete shows progress modal and disables toolbar buttons.
  - Cancel button clears pending items and surfaces partial-failure alert.
  - Modal dismisses without stopping the active queue; toolbar remains disabled; alert banner appears on drain.
  - At least one metadata bulk action (e.g., Set cohort) shows correct progress verb and count updates.
- **Backend tests**: none required.

## Documentation and rollout notes

- Add the planned helper entries above to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14 before implementation starts, with status `Not implemented`.
- During the documentation pass, reconcile planned entries against actual implementation and update status/details accordingly.
- No migration or reset required.

## V1 scope recommendation

### Include in v1

- Single shared `classesBulkMutation` queue for all seven bulk actions.
- `cancelApiQueued` additive export in `apiService.ts`.
- Feature-local `runQueuedBatchMutation` engine.
- Feature-local `ClassesBulkProgressModal` component.
- Integration into `ClassesManagementPanel` and extension of the workflow mutation boundary.
- Update existing bulk flow modules to use `runQueuedBatchMutation`.
- Distinct cancellation outcome message.
- Unit and E2E test coverage.

### Defer from v1

- Reusable app-wide progress modal abstraction.
- Per-action job names or priority queueing.
- Cancelling the active in-flight request.
- Backend locking or atomicity improvements.
