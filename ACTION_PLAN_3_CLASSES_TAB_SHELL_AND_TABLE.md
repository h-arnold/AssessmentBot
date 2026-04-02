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
- New `src/frontend/src/features/classes/**`

## Exploration findings to account for

- The Classes tab is still a blank `Card`.
- There is no `features/classes` area yet.
- The current Settings-page tests only cover tabs, not feature-state rendering.
- `AppAuthGate` startup orchestration and warm-up state are now owned in Workstream 2 and must be consumed, not reimplemented.

## Work packages

### 3.1 Feature bootstrap

Acceptance:

- Replace the placeholder Classes tab with a dedicated feature entry component.
- Keep `SettingsPage.tsx` as composition only.
- Create a shell hook or equivalent boundary for data-driven tab state.

Tests:

- `src/frontend/src/pages/SettingsPage.spec.tsx`
- `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx`
- `src/frontend/src/features/classes/useClassesManagementShell.spec.ts`

### 3.2 Merged row view-model

Acceptance:

- Build the merged row model from `googleClassrooms`, `classPartials`, and resolved labels.
- Support `active`, `inactive`, `notCreated`, and `orphaned` states.
- Default sort order is active, inactive, not created, orphaned.

Tests:

- `src/frontend/src/features/classes/classesManagementViewModel.spec.ts`

### 3.3 Summary, toolbar, and table rendering

Acceptance:

- Render the agreed summary card, toolbar card, and table card.
- Preserve `classId` as row key only.
- `notCreated` rows render unavailable values as `—`.
- Orphaned rows are deletion-only and visibly explained.
- Selection basics are implemented here, but mutation flows stay in Workstream 4.

Tests:

- `src/frontend/src/features/classes/ClassesTable.spec.tsx`
- `src/frontend/src/features/classes/ClassesToolbar.spec.tsx`
- `src/frontend/src/features/classes/selectionState.spec.ts`

### 3.4 Load, error, and empty states

Acceptance:

- Startup warm-up remains non-blocking for app shell/navigation, but is blocking for Classes feature readiness states.
- Google Classroom entry failure is blocking.
- No-active-classrooms renders `Empty`, not an error.
- First-run no-`ABClass` state still renders `notCreated` rows.

Tests:

- `src/frontend/src/features/classes/ClassesAlertStack.spec.tsx`
- `src/frontend/src/features/classes/ClassesSummaryCard.spec.tsx`
- `src/frontend/src/features/classes/ClassesEmptyStates.spec.tsx`

### 3.5 Browser journeys

Tests:

- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table.spec.ts`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-load-states.spec.ts`

## Sequencing notes

- Keep this workstream split internally as bootstrap first, then pure view-model, then rendering.
- Do not let the table section absorb mutation orchestration or modal state.
- Consume the existing Workstream 2 warm-up/readiness state contract from `AppAuthGate` + `sharedQueries`; do not introduce a second readiness orchestration path.

## Section checks

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/features/classes/ClassesManagementPanel.spec.tsx src/features/classes/useClassesManagementShell.spec.ts src/features/classes/classesManagementViewModel.spec.ts src/features/classes/ClassesTable.spec.tsx src/features/classes/ClassesToolbar.spec.tsx src/features/classes/selectionState.spec.ts src/features/classes/ClassesAlertStack.spec.tsx src/features/classes/ClassesSummaryCard.spec.tsx src/features/classes/ClassesEmptyStates.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-table.spec.ts e2e-tests/classes-crud-load-states.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
