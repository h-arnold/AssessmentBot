# Frontend Page Dataset-State Deduplication Specification

## Status

- Draft v1.1
- Revised after Planner Reviewer pass — C1, C2, C3 resolved; I1–I5 resolved; N1–N3 addressed

## Purpose

This document defines the intended behaviour for extracting duplicated data-fetching, dataset-state derivation, and invalidation logic from the frontend pages into shared helpers.

The refactoring will be used to:

- eliminate duplicated dataset-state boilerplate across `ClassesPage`, `AssignmentsPage`, and any future warmup-backed page
- centralise the blocking/loading surface-state decision tree into one shared contract
- provide a single shared helper for the "invalidate-without-background-refetch then explicit-refetch" pattern
- correct four ad-hoc query-key array literals that violate the shared `queryKeys` factory contract

This refactoring is **not** intended to:

- change any user-visible behaviour, loading state, or error state
- introduce new query keys, prefetch datasets, or warmup datasets
- alter the startup warmup state contract or its provider
- add new test coverage beyond regression hardening of the extracted contracts
- restructure page-specific render functions into shared components

## Agreed product decisions

1. Extract a shared `usePageDataset` hook into `src/frontend/src/hooks/` that accepts a startup-warmup dataset key and returns a typed query result plus a derived dataset-state object. The hook sets `refetchOnMount: false` and `enabled: isDatasetReady || isDatasetFailed` internally, matching current page behaviour.
2. Extract shared pure-function surface-state helpers (`computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable`) so pages can compose their own surface-state decisions from a consistent contract. Do not extract a one-size-fits-all `computePageSurfaceState` — the two current pages have structurally different surface-state shapes (2 booleans vs 3 booleans).
3. Provide a shared `computePageSurfaceBusy` helper for the common "any dataset query is fetching or any mutation is pending" busy signal. Pages that need additional busy triggers (e.g. `AssignmentsPage` including `shouldRenderTableLoadingState`) layer those on top.
4. Extract a `refetchAfterStaleInvalidate` helper that wraps the invalidate-then-explicit-refetch pattern used by manual retry flows. This helper has two independent call sites within `AssignmentsPage` (`handleRetryAssignmentsData` and `handleConfirmDelete`), satisfying the extraction rule.
5. Fix all four ad-hoc query-key array literals to use the canonical `queryKeys.*` factory helpers.
6. Place the new `usePageDataset` hook and surface-state helpers in the existing `src/frontend/src/hooks/` directory (alongside `useDebounce.ts`).
7. Export `getStartupWarmupQueryOptions(datasetKey)` from `sharedQueries.ts` so `usePageDataset` can resolve query options without duplicating the internal mapping.
8. No new prefetch behaviour, no new startup warmup datasets, no new query keys are introduced.

## Existing system constraints

### Backend or API constraints already in place

- All frontend-to-backend calls route through `callApi` in `src/frontend/src/services/apiService.ts` (per `src/frontend/AGENTS.md §4.1`).
- Backend method names align with `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
- No new backend methods are required.

### Current data-shape constraints

- `StartupWarmupDatasetKey` is the canonical union of warmup-backed dataset keys (`classPartials`, `assignmentDefinitionPartials`, `assignmentTopics`, `cohorts`, `yearGroups`).
- `StartupWarmupContextValue` exposes `isDatasetReady(key)`, `isDatasetFailed(key)`, and `snapshot.datasets[key]` with `{ status, isTrustworthy }`.
- Shared query options are defined in `src/frontend/src/query/sharedQueries.ts` via `getXQueryOptions()` factory functions.
- Query keys are defined in `src/frontend/src/query/queryKeys.ts` and must be used instead of ad-hoc array literals (per `frontend-react-query-and-prefetch.md §2`).

### Frontend or consumer architecture constraints

- The `useStartupWarmupState` hook is the single source of truth for warmup dataset trustworthiness.
- Pages must not call `google.script.run` or backend globals directly (per `src/frontend/AGENTS.md §4.1`).
- React Query v5.90.21 provides cache and stale-while-revalidate semantics. Explicit `fetchQuery` after invalidation is an anti-pattern for normal mutation flows (per `frontend-react-query-and-prefetch.md §7`); the invalidate-then-explicit-refetch pattern is only needed for manual retry where the target query may be disabled.
- The frontend uses ESM React + Vite with TypeScript. Export functions as functions, not arrow-function constants.
- The `src/frontend/src/hooks/` directory already exists (contains `useDebounce.ts` and `useDebounce.spec.ts`).

## Domain and contract recommendations

### Why this approach is preferable

- **Maintainability**: centralising the dataset-state derivation and blocking logic means future warmup-backed pages do not reimplement the same decision tree.
- **Correctness**: the subtle "enable query when dataset is ready OR failed" rule is a known source of bugs; having it in one place makes it auditable. The hook's JSDoc must preserve the rationale currently in `AssignmentsPage.tsx`'s inline comment explaining why `enabled: isReady || isFailed` is necessary for retry to work with React Query v5.
- **Future extensibility**: adding a new warmup-backed dataset to a page should be a matter of calling `usePageDataset` once, not copying 15+ lines of boilerplate.

### Recommended data shapes

#### PageDatasetState (derived per-dataset state)

```ts
type PageDatasetState = Readonly<{
  hasQueryData: boolean;
  isQueryError: boolean;
  isDatasetFailed: boolean;
  isDatasetReady: boolean;
  isDatasetTrustworthy: boolean;
  hasTrustworthyDataset: boolean;
}>;
```

Note: `hasTrustworthyDataset` is derived as `isDatasetReady && isDatasetTrustworthy`. While this is technically equivalent to `isDatasetReady` alone (since `startupWarmupState.isDatasetReady` already checks `isTrustworthy` internally), the explicit AND is kept for self-documenting clarity — the derivation is stated in terms of the public contract rather than relying on the internal implementation.

#### PageDatasetResult (hook return type for one dataset — generic over data type)

```ts
type PageDatasetResult<TData> = Readonly<{
  query: UseQueryResult<TData>;
  datasetState: PageDatasetState;
}>;
```

The generic `TData` preserves type safety for `query.data` access so pages can build view models without type casts.

### Naming recommendation

Prefer:

- `usePageDataset` for the hook (describes what it provides: a dataset for page consumption)
- `computePageDatasetState` for the pure derivation of `PageDatasetState` from query + warmup inputs
- `computePageSurfaceBlocking` for the per-dataset blocking decision (renamed from the original `shouldBlockSingleDataset` in `ClassesPage.tsx`, which was `shouldRenderAssignmentsBlockingState` in `AssignmentsPage.tsx`)
- `computeDatasetRenderable` for the per-dataset renderability decision (extracted from inline logic in both pages)
- `computePageSurfaceBusy` for the common fetching-or-mutating busy signal
- `refetchAfterStaleInvalidate` for the invalidate-then-explicit-refetch helper

Avoid:

- `useWarmupDataset` (implies it owns warmup, when it consumes warmup state)
- `useDatasetQuery` (too generic; suggests it creates query definitions)
- Generic wrapper names with no contract clarity

### Validation recommendation

Not applicable — this is a behavioural-preservation refactoring. Existing Zod schemas in service layer remain unchanged.

### Display-resolution recommendation

Not applicable — no display-resolution logic changes.

## Feature architecture

### Placement

- New hook and pure helpers: `src/frontend/src/hooks/usePageDataset.ts` (in existing `hooks/` directory alongside `useDebounce.ts`)
- `refetchAfterStaleInvalidate` helper: `src/frontend/src/query/queryInvalidationHelpers.ts`. This is a cross-feature helper; by contrast, the existing `queryInvalidation.ts` in `features/classes/` remains feature-scoped for class-partials refresh orchestration.
- `getStartupWarmupQueryOptions` export: added to `src/frontend/src/query/sharedQueries.ts`
- Ad-hoc query-key fixes: inline in `ClassesManagementPanel.tsx` and `useAssignmentDefinitionWizard.ts`

### Proposed high-level tree

```text
src/frontend/src/
├── hooks/                                # existing directory (contains useDebounce.ts)
│   └── usePageDataset.ts                 # new: usePageDataset hook + pure helpers
├── query/
│   ├── sharedQueries.ts                  # amended: export getStartupWarmupQueryOptions
│   ├── queryInvalidationHelpers.ts       # new: refetchAfterStaleInvalidate
│   └── queryKeys.ts                      # unchanged
├── pages/
│   ├── ClassesPage.tsx                   # refactored to consume usePageDataset
│   ├── AssignmentsPage.tsx               # refactored to consume usePageDataset + refetchAfterStaleInvalidate
│   ├── useAssignmentDefinitionWizard.ts  # fix ad-hoc keys
│   └── ...
└── features/
    └── classes/
        └── ClassesManagementPanel.tsx     # fix ad-hoc keys
```

### Out of scope for this surface

- Extracting page-specific render functions (`renderClassesContent`, `renderAssignmentsDefinitionsCard`) into shared components
- Refactoring `SettingsPage` or `DashboardPage` (they do not exhibit these duplication patterns)
- Changing startup warmup state or adding new datasets
- Altering mutation flow orchestration in `bulkMutationOrchestration.ts` beyond consuming the new `refetchAfterStaleInvalidate` helper
- Creating a generic `useMutationWithRefresh` — mutations remain feature-scoped
- Extracting a shared top-level `computePageSurfaceState` — pages compose their own surface-state from pure helpers because `ClassesPage` uses a 2-boolean surface state while `AssignmentsPage` uses a 3-boolean surface state

## Data loading and orchestration

### Required datasets or dependencies

No new datasets. The refactoring reuses existing contracts:

- `StartupWarmupContextValue` from `useStartupWarmupState`
- `getClassPartialsQueryOptions`, `getYearGroupsQueryOptions`, `getAssignmentDefinitionPartialsQueryOptions` from `sharedQueries.ts`
- `getStartupWarmupQueryOptions(datasetKey)` — new public export from `sharedQueries.ts` that resolves a `StartupWarmupDatasetKey` to its query options without duplicating the internal `startupWarmupQueryDefinitions` mapping
- `queryKeys` factory from `queryKeys.ts`

### Prefetch or initialisation policy

#### Startup

Unchanged. Existing `warmStartupQueries` in `sharedQueries.ts` remains the single startup warmup boundary.

#### Feature entry

Unchanged. Pages continue to load data on entry via `usePageDataset` (which internally calls `useQuery`).

#### Manual refresh

Unchanged where it exists. The `refetchAfterStaleInvalidate` helper standardises the implementation but does not add or remove manual-refresh controls.

### Query or transport additions

- `getStartupWarmupQueryOptions(datasetKey: StartupWarmupDatasetKey)`: required new export from `sharedQueries.ts`. Resolves a dataset key to its `queryOptions` object using the existing `startupWarmupQueryDefinitions` internal array.
- `refetchAfterStaleInvalidate(queryClient, queryKey)`: new shared helper in `src/frontend/src/query/queryInvalidationHelpers.ts`.

## Core view model or behavioural model

### Suggested shape

The `usePageDataset` hook accepts a `StartupWarmupDatasetKey` and returns `PageDatasetResult<TData>`:

```ts
function usePageDataset<TData>(datasetKey: StartupWarmupDatasetKey): PageDatasetResult<TData>;
```

Internally `usePageDataset`:

1. Calls `useStartupWarmupState()` to get warmup state and the dataset snapshot.
2. Calls `getStartupWarmupQueryOptions(datasetKey)` to get the shared query options.
3. Calls `useQuery` with those options plus `enabled: isDatasetReady || isDatasetFailed` and `refetchOnMount: false`.
4. Derives `PageDatasetState` via `computePageDatasetState`.

The hook's JSDoc must preserve the rationale for the `enabled` condition: **"The query is enabled when the dataset is ready OR has failed. Enabling on failure is required so `refetchQueries()` can retry after a warmup failure — disabled queries cannot be refetched in React Query v5. The blocking state still protects the UI while the dataset is untrustworthy."**

### Derivation or merge rules

#### `computePageDatasetState` rule

From `UseQueryResult<TData>`, `StartupWarmupContextValue`, and `StartupWarmupDatasetKey`:

1. `hasQueryData` = `query.data !== undefined`
2. `isQueryError` = `query.isError`
3. `isDatasetFailed` = `startupWarmupState.isDatasetFailed(datasetKey)`
4. `isDatasetReady` = `startupWarmupState.isDatasetReady(datasetKey)`
5. `isDatasetTrustworthy` = `startupWarmupState.snapshot.datasets[datasetKey].isTrustworthy`
6. `hasTrustworthyDataset` = `isDatasetReady` AND `isDatasetTrustworthy`

#### `computePageSurfaceBlocking` rule (single dataset)

A dataset should block when:

- `isDatasetFailed` AND (`!hasQueryData` OR `isQueryError`) → block
- `!isDatasetTrustworthy` AND `isDatasetReady` → block
- `isDatasetReady` AND `isQueryError` → block
- otherwise → do not block

#### `computeDatasetRenderable` rule

A dataset is renderable when:

- `hasTrustworthyDataset` is true, OR
- `isDatasetFailed` AND `hasQueryData` AND `!isQueryError` (recovered after warmup failure)

#### Page-level surface-state composition

Pages compose their own surface-state from the pure helpers. This is not a shared helper because the two pages have structurally different surface-state shapes:

- `ClassesPage`: uses `{ shouldRenderBlockingState, shouldRenderLoadingState }` (2 booleans). Derives blocking from `computePageSurfaceBlocking` on both datasets; derives loading from `computeDatasetRenderable` on both datasets.
- `AssignmentsPage`: uses `{ shouldRenderActionLoadingState, shouldRenderBlockingState, shouldRenderTableLoadingState }` (3 booleans). Derives blocking from `computePageSurfaceBlocking` on one dataset; derives action loading and table loading from `computeDatasetRenderable` with an additional `isQueryPending && !hasQueryData` guard for the table case.

#### `computePageSurfaceBusy` rule (shared for the common case)

```ts
function computePageSurfaceBusy(
  fetchFlags: readonly boolean[],
  mutationFlags: readonly boolean[]
): boolean;
```

The page surface is busy when any of its dataset queries is fetching OR any relevant mutation is pending. Returns `true` if any flag in either array is truthy.

Pages that need additional busy triggers (e.g. `AssignmentsPage` including `shouldRenderTableLoadingState` in its `aria-busy` computation) layer those on top. The existing `aria-busy` behaviour must be preserved — `AssignmentsPage` retains a page-local wrapper for this. (The inner skeleton components additionally provide their own `aria-live="polite"` announcements, so the page is robust even if the outer `aria-busy` were ever absent.)

### Sort order or priority rules

Not applicable — no sort-order changes.

## Main user-facing surface specification

No user-visible changes. All existing loading skeletons, blocking `Alert` components, empty states, and busy-state affordances must render identically.

## Workflow specification

No workflow changes. The refactoring preserves:

- Warmup failure → query enabled anyway → user can retry
- Retry: invalidate + explicit refetch pattern for disabled-ready queries
- Blocking state when data is untrustworthy or errored
- Loading skeleton on initial entry with no usable data
- Busy-state `aria-live` region during background refresh

## Error, loading, and empty-state rules

No changes. Existing rules are preserved exactly:

### Blocking failure

- `Alert type="error"` with appropriate message when data cannot be trusted or loaded

### Partial-load or partial-success failure

- Not applicable to this refactoring; existing mutation failure handling unchanged

### Empty states

- Unchanged per page

## Accessibility and usability notes

No changes. Existing `aria-label`, `aria-busy`, `aria-live`, and `role` attributes must be preserved.

`AssignmentsPage`'s `aria-busy` computation currently includes `shouldRenderTableLoadingState` as a trigger. The refactored `computePageSurfaceBusy` helper only accounts for query fetching and mutation pending. The `AssignmentsPage` will retain a page-local wrapper that adds `shouldRenderTableLoadingState` on top, preserving the existing `aria-busy` behaviour.

## Backend changes required to support agreed behaviour

None. This is a frontend-only refactoring.

## Planning handoff notes

- The `usePageDataset` hook must be implemented and tested in isolation before pages are refactored to consume it.
- `getStartupWarmupQueryOptions` must be exported from `sharedQueries.ts` before `usePageDataset` can be implemented.
- Page refactoring must be verified with existing test suites (`ClassesPage.spec.tsx`, `AssignmentsPage.spec.tsx`) to confirm behavioural preservation.
- The four ad-hoc query-key fixes are atomically small and can be bundled together.
- `refetchAfterStaleInvalidate` must be extracted and tested before replacing the two call sites in `AssignmentsPage.tsx`.
- Test helpers that mock `isDatasetReady`/`isDatasetFailed` (e.g. `createIsDatasetReadyFunction` in `ClassesPage.spec.tsx`) may need updating if the hook changes the mocking surface — but the observable behaviour must not change.
- The `usePageDataset` hook's JSDoc must include the rationale for `enabled: isReady || isFailed`, preserving the knowledge currently in `AssignmentsPage.tsx`'s inline comment.

## Testing expectations

- Unit tests for `computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable` as pure functions with explicit input/output tables covering all decision branches.
- Unit tests for `computePageSurfaceBusy` with combinations of fetching and mutation-pending states.
- Unit tests for `usePageDataset` hook rendering with mocked `useStartupWarmupState` and a React Query `QueryClientProvider`, covering: warmup ready, warmup failed with no data, warmup failed with data recovered, warmup untrustworthy.
- Unit tests for `getStartupWarmupQueryOptions` ensuring all five dataset keys resolve and unknown keys throw.
- Unit tests for `refetchAfterStaleInvalidate` verifying the call sequence: `invalidateQueries({ refetchType: 'none' })` first, then `refetchQueries({ queryKey })`.
- Existing page-level tests must pass without modification to assertions (test double setup may need updating but assertions must hold).
- Lint must pass for all changed files: `npm run lint:frontend`.

## Documentation and rollout notes

- Add a Section 9.12 entry to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` recording the new helpers as `Implemented`.
- Update the canonical helper map in Section 3 of that document to include the `hooks/usePageDataset.ts` module and `query/queryInvalidationHelpers.ts`.
- No rollout dependencies — this is a pure refactoring.

## V1 scope recommendation

### Include in v1

- `getStartupWarmupQueryOptions` export from `sharedQueries.ts`
- `usePageDataset` hook with `PageDatasetState` and `PageDatasetResult<TData>` types
- `computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, `computePageSurfaceBusy` pure helper functions
- `refetchAfterStaleInvalidate` helper in `src/frontend/src/query/queryInvalidationHelpers.ts`
- Refactored `ClassesPage.tsx` to consume the new hook and pure helpers
- Refactored `AssignmentsPage.tsx` to consume the new hook, pure helpers, and `refetchAfterStaleInvalidate`
- Four ad-hoc query-key literal fixes
- Updated `frontend-shared-helpers-and-abstraction-standards.md`

### Defer from v1

- Extracting page-specific render functions into shared components
- Extracting a shared `computePageSurfaceState` (pages compose it from pure helpers due to differing surface-state shapes)
- Refactoring `useAssignmentDefinitionWizard` beyond the ad-hoc key fix
- Any change to `bulkMutationOrchestration.ts` beyond consuming `refetchAfterStaleInvalidate`

## Open questions

None. All five patterns have agreed scope and placement decisions from the clarification loop. All three Critical and five Improvement findings from the Planner Reviewer pass have been resolved in this revision.
