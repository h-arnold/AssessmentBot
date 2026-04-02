# Workstream 3: Classes Tab Shell and Table

## Scope

- Classes feature bootstrap under `SettingsPage`
- Shell hook and readiness plumbing
- Merged row view-model
- Summary card, toolbar, and table
- Blocking, partial-load, and empty-state rendering

## Touched code

- `src/frontend/src/pages/SettingsPage.tsx`
- `src/frontend/src/pages/SettingsPage.spec.tsx`
- `src/frontend/src/pages/TabbedPageSection.tsx`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- Existing and new `src/frontend/src/features/classes/**`

## Exploration findings to account for

- The Classes tab is still a blank `Card`.
- `features/classes` now exists for query-invalidation foundations from Workstream 2, but there is still no Classes-tab shell/table implementation.
- The current Settings-page tests only cover tabs, not feature-state rendering.
- `AppAuthGate` startup orchestration and warm-up state are now owned in Workstream 2 and must be consumed, not reimplemented.

## Work packages

### 3.1 Feature bootstrap

Acceptance:

- Replace the placeholder Classes tab with a dedicated feature entry component.
- Keep `SettingsPage.tsx` as composition only.
- Create a shell hook boundary for data-driven tab state under spec-aligned naming (`ClassesManagementPage` + `useClassesManagement`).
- Replace existing placeholder-only page/spec assertions (`Classes panel` empty region) with feature-state assertions owned by the new Classes feature entry.

Tests:

- `src/frontend/src/pages/SettingsPage.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPage.spec.tsx`
- `src/frontend/src/features/classes/useClassesManagement.spec.ts`

### 3.2 Merged row view-model

Acceptance:

- Build the merged row model from `googleClassrooms`, `classPartials`, and resolved labels.
- Support `active`, `inactive`, `notCreated`, and `orphaned` states.
- Default sort order is active, inactive, not created, orphaned.
- Within each status group, apply a deterministic secondary sort by `className` ascending (case-insensitive).

Tests:

- `src/frontend/src/features/classes/classesManagementViewModel.spec.ts`

### 3.3 Summary, toolbar, and table rendering

Acceptance:

- Render the agreed summary card, toolbar card, and table card.
- Preserve `classId` as row key only.
- `notCreated` rows render unavailable values as `—`.
- Orphaned rows are deletion-only and visibly explained.
- Selection basics are implemented here, but mutation flows stay in Workstream 4.
- Selection lifecycle contract:
  - use controlled `selectedRowKeys` state in feature shell logic
  - reset selection on Classes-tab re-entry
  - clear removed row keys after destructive changes/refresh
  - do not preserve invisible row keys across tab re-entry.
- Add column sorting and filtering controls for the main table, with default view-model ordering preserved as status order plus `className` ascending tie-break.
- Column sorting and filtering should cover user-facing data columns (status, class name, cohort, course length, year group, active) with deterministic behaviour.

Tests:

- `src/frontend/src/features/classes/ClassesTable.spec.tsx`
- `src/frontend/src/features/classes/ClassesTableColumns.spec.tsx`
- `src/frontend/src/features/classes/ClassesToolbar.spec.tsx`
- `src/frontend/src/features/classes/selectionState.spec.ts`

### 3.4 Load, error, and empty states

Acceptance:

- Startup warm-up remains non-blocking for app shell/navigation, but is blocking for Classes feature readiness states.
- Explicitly consume Workstream 2 warm-up state from `AppAuthGate` + `sharedQueries`, where startup readiness is defined over `classPartials`, `cohorts`, and `yearGroups`.
- A `failed` startup warm-up state for any required startup dataset is blocking for Classes-tab interaction.
- Google Classroom entry failure is blocking.
- No-active-classrooms renders `Empty`, not an error.
- First-run no-`ABClass` state still renders `notCreated` rows.
- Partial-load warning semantics must remain explicit:
  - show warning `Alert` when one dataset fails during a non-blocking refresh path
  - keep usable table data visible unless the failed refresh is required to trust current table state
  - when the failed refresh follows a successful mutation, show success-plus-refresh-needed guidance and suppress stale table data.

Tests:

- `src/frontend/src/features/classes/ClassesAlertStack.spec.tsx`
- `src/frontend/src/features/classes/ClassesSummaryCard.spec.tsx`
- `src/frontend/src/features/classes/ClassesEmptyStates.spec.tsx`

### 3.5 Browser journeys

Acceptance:

- Extend the existing Workstream 2 Playwright harness (`e2e-tests/classes-crud.harness.spec.ts`) and shared scenario helpers; do not introduce a second Classes CRUD harness.
- Migrate existing placeholder-only harness assertions to explicit feature-state assertions (alert stack, summary, toolbar, table, and load states).
- Cover the following visible interaction groups with Playwright:
  1. tab entry and default ready state
  2. startup-prefetch failure, Google Classroom fetch failure, and no-active-classrooms empty state
  3. toolbar states for no selection, mixed selection, and eligible selection
  4. table rendering for active, inactive, `notCreated`, and orphaned rows
  5. table column sorting and filtering interactions, including reset behaviour.
- For every visible interaction introduced or changed in this workstream, add/extend matching Playwright coverage alongside Vitest coverage.

Tests:

- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-load-states.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table-controls.spec.ts`

## Sequencing notes

- Keep this workstream split internally as bootstrap first, then pure view-model, then rendering.
- Do not let the table section absorb mutation orchestration or modal state.
- Consume the existing Workstream 2 warm-up/readiness state contract from `AppAuthGate` + `sharedQueries`; do not introduce a second readiness orchestration path.
- Migrate tests in the same slice as feature changes: avoid leaving placeholder assertions active once feature-state rendering is introduced.

## Pre-implementation decisions to lock (with recommended defaults)

1. **Feature-state mapping ownership**
   - Decision: where the canonical Classes tab state mapping lives.
   - Recommendation: keep this in `useClassesManagement` and expose an explicit discriminated render-state contract.
2. **Partial-load warning trigger scope**
   - Decision: which failing refresh paths show warning vs blocking.
   - Recommendation: warning for non-blocking refresh failures; blocking when required freshness cannot be trusted.
3. **Blocking/error state contract shape**
   - Decision: booleans vs explicit union state.
   - Recommendation: use explicit union render states for deterministic UI/test branching.
4. **Table sorter/filter control mode**
   - Decision: controlled vs uncontrolled sorter/filter state.
   - Recommendation: controlled sorter/filter state so reset-to-default behaviour is deterministic.
5. **Sorter/filter reset contract**
   - Decision: what “clear all” returns to.
   - Recommendation: always reset to status-priority order with `className` ascending tie-break.
6. **Selection lifecycle on tab re-entry and destructive changes**
   - Decision: whether to reset selection on tab re-entry and delete/remove flows.
   - Recommendation: reset on tab re-entry and after destructive row removal; do not preserve invisible rows.
7. **Harness strategy for new browser journeys**
   - Decision: whether to add a second Classes harness.
   - Recommendation: extend `classes-crud.harness.spec.ts` fixtures/helpers only; do not fork harness infrastructure.
8. **Test migration sequencing**
   - Decision: when to replace placeholder assertions.
   - Recommendation: replace placeholder assertions in the same PR slice that introduces feature-state rendering.
9. **Visible interaction coverage boundary**
   - Decision: what interactions require Playwright.
   - Recommendation: treat all user-visible table interactions (including sort/filter/reset) as Playwright-required.

## Section checks

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/features/classes/ClassesManagementPage.spec.tsx src/features/classes/useClassesManagement.spec.ts src/features/classes/classesManagementViewModel.spec.ts src/features/classes/ClassesTable.spec.tsx src/features/classes/ClassesTableColumns.spec.tsx src/features/classes/ClassesToolbar.spec.tsx src/features/classes/selectionState.spec.ts src/features/classes/ClassesAlertStack.spec.tsx src/features/classes/ClassesSummaryCard.spec.tsx src/features/classes/ClassesEmptyStates.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts e2e-tests/classes-crud-table.spec.ts e2e-tests/classes-crud-load-states.spec.ts e2e-tests/classes-crud-table-controls.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
