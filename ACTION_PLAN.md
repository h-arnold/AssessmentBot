# Feature Delivery Plan: Frontend Page Dataset-State Deduplication

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md`.
2. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
3. Read `docs/developer/frontend/frontend-react-query-and-prefetch.md`.
4. Read `src/frontend/AGENTS.md`.
5. Treat `SPEC.md` as the source of truth for product behaviour, contracts, and scope boundaries.

No frontend layout spec is required — this is a behavioural-preservation refactoring with no user-visible changes.

## Scope and assumptions

### Scope

- Create and export `getStartupWarmupQueryOptions` from `src/frontend/src/query/sharedQueries.ts`.
- Create `usePageDataset` hook + pure dataset-state helper functions in `src/frontend/src/hooks/usePageDataset.ts`.
- Create `refetchAfterStaleInvalidate` helper in `src/frontend/src/query/queryInvalidationHelpers.ts`.
- Refactor `ClassesPage.tsx` to consume the new hook and pure helpers.
- Refactor `AssignmentsPage.tsx` to consume the new hook, pure helpers, and `refetchAfterStaleInvalidate`.
- Fix four ad-hoc query-key array literals in `ClassesManagementPanel.tsx` and `useAssignmentDefinitionWizard.ts`.
- Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with new helper entries.

### Out of scope

- Extracting page-specific render functions into shared components.
- Extracting a shared `computePageSurfaceState` (pages compose their own due to differing surface-state shapes).
- Refactoring `useAssignmentDefinitionWizard` beyond the four ad-hoc key fixes.
- Changing `bulkMutationOrchestration.ts` beyond consuming `refetchAfterStaleInvalidate` (if applicable — current call sites are in `AssignmentsPage.tsx` only).
- Altering startup warmup state provider, warmup datasets, or query keys.
- Adding new test coverage beyond unit tests for the extracted contracts and regression hardening.

### Assumptions

1. The existing `startupWarmupQueryDefinitions` array in `sharedQueries.ts` is the single internal source of truth for dataset-key-to-query-options resolution.
2. `useStartupWarmupState` is available via the existing context provider in all page-render paths and can be called inside the new hook.
3. Existing page-level test suites (`ClassesPage.spec.tsx`, `AssignmentsPage.spec.tsx`) primarily mock `useStartupWarmupState` at the module level and those test doubles will still work after the hook is introduced (the hook calls `useStartupWarmupState` internally, so the module-level mock is still the control point).
4. The four ad-hoc query-key literals are all in non-test production code and can be replaced with `queryKeys.*` factory calls without changing any other logic.
5. No existing tests assert on the exact line-level structure of the ad-hoc query keys or internal function names being extracted.

---

## Global constraints and quality gates

### Engineering constraints

- Export functions as functions, not arrow-function constants (per `src/frontend/AGENTS.md §1`).
- All frontend-to-backend calls must route through `callApi` (per `src/frontend/AGENTS.md §4.1`). No new backend calls are introduced, so this is a ratification-only constraint.
- Use British English in comments and documentation.
- Keep changes minimal, localised, and consistent with existing repository conventions.
- Names must match the spec: `usePageDataset`, `computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, `computePageSurfaceBusy`, `refetchAfterStaleInvalidate`, `getStartupWarmupQueryOptions`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase, list required documentation file paths before delegation, require the sub-agent handoff to include `Files read` with explicit file paths, verify every mandatory file is listed before accepting the handoff, and if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase.

### Shared-helper planning gate (mandatory for this feature)

When a section introduces helper reuse, helper extension, or new shared helpers:

1. Record helper decisions in that section before implementation.
2. Include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale.
3. Add planned helper entries to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`.
4. During the documentation pass (Section 9), reconcile planned entries against actual implementation and update status/details accordingly.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm --prefix src/frontend test -- <target>`

---

## LOC baseline (pre-refactoring)

Baseline taken from the seven production files touched by this refactoring (command: `scc <files> --no-cocomo`).

```
Files counted:
  src/frontend/src/pages/ClassesPage.tsx
  src/frontend/src/pages/AssignmentsPage.tsx
  src/frontend/src/features/classes/ClassesManagementPanel.tsx
  src/frontend/src/pages/useAssignmentDefinitionWizard.ts
  src/frontend/src/query/sharedQueries.ts
  src/frontend/src/query/queryKeys.ts
  src/frontend/src/features/auth/startupWarmupState.ts

Total: 4,007 lines, 2,824 code, 854 comments, 329 blanks
```

### LOC reduction hard gate

At the end of Section 8 (Regression and contract hardening), the combined LOC of all touched production files (the seven baseline files plus the two new files: `usePageDataset.ts` and `queryInvalidationHelpers.ts`) must be lower than the baseline 4,007 lines. If LOC has not reduced, the refactoring is incomplete and must be corrected before progressing to Section 9.

---

## Section 1 — Export `getStartupWarmupQueryOptions` from `sharedQueries.ts`

### Objective

Create and export a `getStartupWarmupQueryOptions` function from `sharedQueries.ts` that resolves a `StartupWarmupDatasetKey` to its query-options object using the existing internal `startupWarmupQueryDefinitions` array. This provides `usePageDataset` with a single source of truth for dataset-key-to-query-options resolution without duplicating the internal mapping.

### Constraints

- The export must reuse the existing internal `startupWarmupQueryDefinitions` array; do not introduce a second mapping.
- The function signature is `function getStartupWarmupQueryOptions(datasetKey: StartupWarmupDatasetKey): ReturnType<typeof queryOptions>` (the return type is the query-options object for the corresponding dataset).
- Must throw for unknown dataset keys, matching the existing `getStartupWarmupQueryKey` error pattern.
- Must work for all five current dataset keys: `classPartials`, `assignmentDefinitionPartials`, `assignmentTopics`, `cohorts`, `yearGroups`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `getStartupWarmupQueryOptions`
   - Decision: `new` (public export of currently-private resolver)
   - Owning module/path: `src/frontend/src/query/sharedQueries.ts`
   - Call-site rationale: `usePageDataset` needs to resolve query options from a dataset key; the mapping already exists internally in `startupWarmupQueryDefinitions`
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.1
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `getStartupWarmupQueryOptions` is exported from `sharedQueries.ts`.
- Calling it with any of the five valid dataset keys returns the corresponding query-options object.
- Calling it with an unknown key throws an `Error` with a message matching the pattern `'Unknown startup warm-up dataset key: <key>.'`.
- Existing `sharedQueries.ts` tests pass unchanged.
- `npm run lint:frontend` passes for `sharedQueries.ts`.

### Required test cases (Red first)

Unit tests for `getStartupWarmupQueryOptions` (co-locate in `sharedQueries.spec.ts` or a new adjacent spec file):

1. Each of the five dataset keys resolves to a non-null query-options object with the expected `queryKey`.
2. An unknown dataset key throws.
3. The returned query-options object has both `queryKey` and `queryFn` defined.

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/query/sharedQueries` passes.
- `npm run lint:frontend` passes for `sharedQueries.ts`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Completed. `getStartupWarmupQueryOptions(datasetKey)` exported from `sharedQueries.ts` (lines ~196-207). Function reuses internal `startupWarmupQueryDefinitions` array and mirrors the existing `getStartupWarmupQueryKey` pattern. Throws for unknown dataset keys with message matching `'Unknown startup warm-up dataset key: <key>.'`. Unit tests: 7 tests in `sharedQueries.startupWarmupQueryOptions.spec.ts` — all green (plus 10 existing tests unchanged). Zero regressions in regression checker. Commits: `01de510` (feat), `255fcc2` (test).
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Section 3 (`usePageDataset`) depends on this export.

---

## Section 2 — Pure dataset-state helper functions

### Objective

Create pure helper functions `computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, and `computePageSurfaceBusy` in `src/frontend/src/hooks/usePageDataset.ts`. These functions encode the shared dataset-state decision tree without any React or query dependencies, making them independently testable.

### Constraints

- All functions must be pure: no hooks, no side effects, no module-level state.
- Export functions as functions, not arrow-function constants.
- `computePageDatasetState(datasetKey, queryResult, startupWarmupState) → PageDatasetState`
- `computePageSurfaceBlocking(datasetState) → boolean`
- `computeDatasetRenderable(datasetState) → boolean`
- `computePageSurfaceBusy(fetchFlags, mutationFlags) → boolean`
- `PageDatasetState` type must match the spec exactly (six boolean fields).
- `computePageSurfaceBlocking` must implement the spec's four-condition decision tree exactly.
- `computeDatasetRenderable` must implement the spec's two-condition rule exactly.
- `computePageSurfaceBusy` must return `true` when any fetch flag or any mutation flag is truthy.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md` (especially §Core view model or behavioural model)
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (especially §Core view model or behavioural model and §Recommended data shapes)
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `computePageDatasetState`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Used by `usePageDataset` hook (Section 3) and could be used directly by pages for additional derivation; two current call-sites exist implicitly (ClassesPage and AssignmentsPage via the hook)
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

2. Helper: `computePageSurfaceBlocking`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Used by both ClassesPage and AssignmentsPage for per-dataset blocking decisions; replaces `shouldBlockSingleDataset` in ClassesPage and `shouldRenderAssignmentsBlockingState` in AssignmentsPage
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

3. Helper: `computeDatasetRenderable`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Used by both ClassesPage and AssignmentsPage for per-dataset renderability decisions; replaces `isDatasetRenderable` in ClassesPage and inline logic in AssignmentsPage
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

4. Helper: `computePageSurfaceBusy`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Used by both ClassesPage and AssignmentsPage for the common fetching-or-mutating busy signal; replaces `computeClassesSurfaceBusy` in ClassesPage; AssignmentsPage layers additional triggers on top
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

5. Helper: `PageDatasetState` type and `PageDatasetResult<TData>` type
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Shared contracts consumed by the hook and callable by pages; two active call sites
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `computePageDatasetState` returns correct `PageDatasetState` for all combinations of query data presence, query error, dataset readiness, dataset failure, and dataset trustworthiness.
- `computePageSurfaceBlocking` returns `true` exactly when: (a) dataset failed AND (no data OR query error), (b) dataset ready AND not trustworthy, or (c) dataset ready AND trustworthy AND query error.
- `computePageSurfaceBlocking` returns `false` in all other cases.
- `computeDatasetRenderable` returns `true` when: (a) has trustworthy dataset, or (b) dataset failed AND has query data AND no query error.
- `computeDatasetRenderable` returns `false` in all other cases.
- `computePageSurfaceBusy([true, false], [false])` returns `true`.
- `computePageSurfaceBusy([false], [false])` returns `false`.
- All functions are exported as functions, not arrow-function constants.
- `npm run lint:frontend` passes for the new file.

### Required test cases (Red first)

New unit tests in `src/frontend/src/hooks/usePageDataset.spec.ts`:

1. `computePageDatasetState`: 8+ test cases covering each boolean field independently:
   - All ready/trustworthy with query data → correct flags
   - Dataset failed, no query data, no query error → correct flags
   - Dataset failed, has query data, no query error → correct flags (recovered state)
   - Dataset failed, has query data, query error → correct flags
   - Dataset ready, untrustworthy → correct flags
   - Dataset ready, trustworthy, query error → correct flags

2. `computePageSurfaceBlocking`: 6+ test cases covering each branch:
   - Failed + no data → block
   - Failed + data + no error → do not block
   - Failed + data + error → block
   - Ready + untrustworthy → block
   - Ready + trustworthy + error → block
   - Ready + trustworthy + no error → do not block

3. `computeDatasetRenderable`: 5+ test cases:
   - Trustworthy dataset → renderable
   - Failed + data + no error → renderable (recovered)
   - Failed + no data → not renderable
   - Failed + data + error → not renderable
   - Ready + untrustworthy → not renderable

4. `computePageSurfaceBusy`: 4+ test cases:
   - One fetch flag true → busy
   - One mutation flag true → busy
   - Both arrays all false → not busy
   - Empty arrays → not busy

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/hooks/usePageDataset` passes.
- `npm run lint:frontend` passes for `usePageDataset.ts`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entries added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12 with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- `computePageSurfaceBlocking` JSDoc should document the three-condition decision tree so future maintainers understand why a dataset blocks without tracing call sites.
- `computeDatasetRenderable` JSDoc should call out the "recovered after warmup failure" semantics explicitly.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Completed. Created `src/frontend/src/hooks/usePageDataset.ts` with four pure helper functions and `PageDatasetState` type (148 lines). All 25 unit tests pass. SPEC.md blocking rule updated with recovered-path carve-out (`!isDatasetTrustworthy AND NOT (isDatasetFailed AND hasQueryData AND !isQueryError) → block`). Functions exported as function declarations, British English JSDoc.
- **Deviations from plan:** SPEC.md `computePageSurfaceBlocking` rule refined — rule 2 (`isDatasetReady && !isDatasetTrustworthy → block`) was unreachable (warmup state's `isDatasetReady` already checks `isTrustworthy`). Updated to `!isDatasetTrustworthy → block` with recovered-path carve-out to correctly handle untrustworthy-not-ready state while preserving recovered-after-failure rendering.
- **Follow-up implications for later sections:** Section 3 (`usePageDataset`) directly imports and uses these helpers.

---

## Section 3 — `usePageDataset` hook

### Objective

Create the `usePageDataset` hook that consumes `useStartupWarmupState`, calls `getStartupWarmupQueryOptions`, invokes `useQuery`, and derives `PageDatasetState` via `computePageDatasetState`. This hook replaces the duplicated inline boilerplate in `ClassesPage` and `AssignmentsPage`.

### Constraints

- Hook signature: `function usePageDataset<TData>(datasetKey: StartupWarmupDatasetKey): PageDatasetResult<TData>`.
- Internally calls `useStartupWarmupState()` to get warmup state and snapshot.
- Calls `getStartupWarmupQueryOptions(datasetKey)` for query options.
- Calls `useQuery` with `enabled: isDatasetReady || isDatasetFailed` and `refetchOnMount: false`.
- Derives `PageDatasetState` via `computePageDatasetState`.
- Returns `{ query, datasetState }`.
- JSDoc must preserve the rationale for `enabled: isReady || isFailed` (as specified in SPEC.md §Feature architecture → Placement).
- Generic `TData` must be preserved so pages get typed `query.data`. Callers must provide an explicit type parameter, e.g. `usePageDataset<ClassPartial[]>('classPartials')`. The hook does not attempt to infer `TData` from the dataset key.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/auth/startupWarmupState.ts`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/features/auth/startupWarmupState.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `usePageDataset`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: Two active call sites (ClassesPage, AssignmentsPage); any future warmup-backed page will use it
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `usePageDataset('classPartials')` returns a `PageDatasetResult<ClassPartial[]>` with functional `query` and correct `datasetState`.
- When the warmup state reports the dataset as ready, `useQuery` is called with `enabled: true`.
- When the warmup state reports the dataset as failed, `useQuery` is called with `enabled: true`.
- When the warmup state reports the dataset as loading, `useQuery` is called with `enabled: false`.
- `refetchOnMount` is `false`.
- `datasetState.hasTrustworthyDataset` is derived as `isDatasetReady && isDatasetTrustworthy`.
- The hook's JSDoc includes the retry rationale comment.
- `npm run lint:frontend` passes for `usePageDataset.ts`.

### Required test cases (Red first)

New unit tests in `src/frontend/src/hooks/usePageDataset.spec.ts` (extending the file from Section 2):

1. Hook renders with mocked `useStartupWarmupState` and `QueryClientProvider`:
   - Warmup ready → `useQuery` enabled, `datasetState.isDatasetReady` true.
   - Warmup failed → `useQuery` enabled, `datasetState.isDatasetFailed` true.
   - Warmup loading → `useQuery` disabled.
   - Dataset trustworthy → `hasTrustworthyDataset` true.
   - Dataset untrustworthy → `hasTrustworthyDataset` false.

2. `refetchOnMount` is `false` — this constraint is verified implicitly by the existing page-level regression tests (`ClassesPage.spec.tsx` and `AssignmentsPage.spec.tsx`), which test mount behaviour for both pages. A dedicated unit test for this single option is not required because: (a) the option is a trivial literal pass-through to `useQuery`, (b) the option's effect is only observable on remount with a populated cache, requiring complex test setup (`queryClient.setQueryData` before remount), and (c) the page-level tests already cover the mount behaviour in context.

3. Type safety: verify that `query.data` has the expected type when the hook is called with a known dataset key (this can be a compile-time check only or a simple runtime verification that the hook returns data-typed results).

4. Unknown dataset key: verify the hook throws (from `getStartupWarmupQueryOptions`).

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/hooks/usePageDataset` passes.
- `npm run lint:frontend` passes for `usePageDataset.ts`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- The rationale for `enabled: isReady || isFailed` must appear in the hook's JSDoc, preserving the knowledge currently embedded in `AssignmentsPage.tsx`'s inline comment.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Completed. Added `usePageDataset<TData>` hook and `PageDatasetResult<TData>` type to `usePageDataset.ts`. Hook calls `useStartupWarmupState()`, `getStartupWarmupQueryOptions(datasetKey)`, and `useQuery` with `enabled: isDatasetReady || isDatasetFailed` and `refetchOnMount: false`. JSDoc includes retry rationale. 6 hook tests pass alongside 25 Section 2 tests (31 total). Required `as UseQueryOptions<TData>` cast to bridge concrete query options to generic `useQuery`.
- **Deviations from plan:** Needed `as UseQueryOptions<TData>` cast on `useQuery` options spread because `getStartupWarmupQueryOptions()` returns concrete (non-generic) types. Test doubles now populate all 5 `StartupWarmupDatasetKey` keys to satisfy `Record<StartupWarmupDatasetKey, ...>` type.
- **Follow-up implications for later sections:** Sections 6 and 7 depend on this hook.

---

## Section 4 — `refetchAfterStaleInvalidate` helper

### Objective

Create a shared `refetchAfterStaleInvalidate` helper in `src/frontend/src/query/queryInvalidationHelpers.ts` that wraps the invalidate-then-explicit-refetch pattern used by manual retry flows in `AssignmentsPage`. This standardises the implementation for the two existing call sites (`handleRetryAssignmentsData` and `handleConfirmDelete`).

### Constraints

- Function signature: `async function refetchAfterStaleInvalidate(queryClient: QueryClient, queryKey: QueryKey): Promise<void>`.
- Must call `queryClient.invalidateQueries({ queryKey, refetchType: 'none' })` first, then `queryClient.refetchQueries({ queryKey })`.
- Must not call `fetchQuery` (anti-pattern per `frontend-react-query-and-prefetch.md §7`).
- Export as function, not arrow-function constant.
- Place in new file `src/frontend/src/query/queryInvalidationHelpers.ts`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md` (especially §7)
- `src/frontend/src/query/queryKeys.ts`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `refetchAfterStaleInvalidate`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/query/queryInvalidationHelpers.ts`
   - Call-site rationale: Two independent call sites in `AssignmentsPage.tsx` (`handleRetryAssignmentsData` and `handleConfirmDelete`)
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `refetchAfterStaleInvalidate` calls `invalidateQueries` with `refetchType: 'none'` before `refetchQueries`.
- The function correctly handles the async chain without swallowing errors.
- JSDoc explains why this pattern exists (for disabled-ready queries where normal invalidation background refetch doesn't work) and warns that it is not the general invalidation pattern.
- `npm run lint:frontend` passes for `queryInvalidationHelpers.ts`.

### Required test cases (Red first)

New unit tests in `src/frontend/src/query/queryInvalidationHelpers.spec.ts`:

1. Verifies call sequence: `invalidateQueries` called with `{ queryKey, refetchType: 'none' }` before `refetchQueries` is called with `{ queryKey }`.
2. Verifies both calls receive the same `queryKey`.
3. Verifies error propagation: if `invalidateQueries` rejects, the error propagates and `refetchQueries` is not called.
4. Verifies error propagation: if `refetchQueries` rejects, the error propagates.

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/query/queryInvalidationHelpers` passes.
- `npm run lint:frontend` passes for `queryInvalidationHelpers.ts`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entry added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.12 with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- The JSDoc must explain that this pattern is for the specific case where a query may be disabled (warmup failure) and normal invalidation-based background refetch would not trigger because the query has no active observer; it is not the recommended pattern for normal mutation flows.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** Section 7 depends on this helper.

---

## Section 5 — Fix ad-hoc query-key array literals

### Objective

Replace four ad-hoc query-key array literals with canonical `queryKeys.*` factory calls in `ClassesManagementPanel.tsx` (2 occurrences) and `useAssignmentDefinitionWizard.ts` (2 occurrences).

### Constraints

- Each replacement must use the appropriate `queryKeys.*` factory: `queryKeys.cohorts()`, `queryKeys.yearGroups()`, `queryKeys.assignmentTopics()`.
- The `queryKeys` import must be added if not already present.
- No other logic changes are permitted.
- The line numbers (556, 565, 1213, 1222) are stable because Sections 1–4 do not modify `ClassesManagementPanel.tsx` or `useAssignmentDefinitionWizard.ts`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/query/queryKeys.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

None — this section only replaces ad-hoc literals with existing `queryKeys` factory calls. No new helpers are introduced.

**Test-file ad-hoc literals note**: `useAssignmentDefinitionWizard.spec.ts` contains the same literal values `['assignmentTopics']` (line 45) and `['yearGroups']` (line 48) in its mock setup. These are intentionally left unchanged because they are mock return values that currently match the `queryKeys.*` factory output. If the query-key format ever changes, the test mocks should be updated to use `queryKeys.*` factories at that time to keep test and production key sources aligned.

### Acceptance criteria

- `ClassesManagementPanel.tsx` line 556: `['cohorts']` replaced with `queryKeys.cohorts()`.
- `ClassesManagementPanel.tsx` line 565: `['yearGroups']` replaced with `queryKeys.yearGroups()`.
- `useAssignmentDefinitionWizard.ts` line 1213: `['assignmentTopics']` replaced with `queryKeys.assignmentTopics()`.
- `useAssignmentDefinitionWizard.ts` line 1222: `['yearGroups']` replaced with `queryKeys.yearGroups()`.
- All existing tests for the two files pass unchanged.
- `npm run lint:frontend` passes for both files.

### Required test cases (Red first)

No new tests — this is a mechanical refactoring. Existing tests for the two modules serve as regression guards:

1. `npm --prefix src/frontend test -- src/frontend/src/features/classes/ClassesManagementPanel` passes.
2. `npm --prefix src/frontend test -- src/frontend/src/pages/useAssignmentDefinitionWizard` passes.

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/features/classes/ClassesManagementPanel` passes.
- `npm --prefix src/frontend test -- src/frontend/src/pages/useAssignmentDefinitionWizard` passes.
- `npm run lint:frontend` passes for both files.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** None — these fixes are independent of the page refactoring sections.

---

## Section 6 — Refactor `ClassesPage.tsx`

### Objective

Replace the inline dataset-state boilerplate in `ClassesPage.tsx` with calls to `usePageDataset`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, and `computePageSurfaceBusy`. The page must retain its own 2-boolean surface-state composition (`getClassesSurfaceState`), its model-building, and its render functions — but those internal functions must use the shared helpers instead of local equivalents.

### Constraints

- All observable behaviour must be preserved: loading skeleton, blocking `Alert`, empty state, busy `aria-busy`, `aria-live` refresh announcement, collapse panels, card rendering.
- The page's `getClassesSurfaceState` function must be updated to use `computePageSurfaceBlocking` and `computeDatasetRenderable` instead of `shouldBlockSingleDataset`, `shouldRenderClassesBlockingState`, `hasRecoveredDataset`, and `isDatasetRenderable`.
- `computeClassesSurfaceBusy` must be replaced with a call to `computePageSurfaceBusy`.
- The inline `classPartialsDatasetState` and `yearGroupsDatasetState` objects (approx. 25 lines each) must be removed in favour of the hook's `datasetState`.
- The inline `useQuery` calls with `enabled` and `refetchOnMount` must be replaced with `usePageDataset`.
- The `isClassesSurfaceBusy` local variable must be derived from `computePageSurfaceBusy`.
- All test assertions in `ClassesPage.spec.tsx` must pass unchanged (test doubles for `useStartupWarmupState` remain the control point; they still work because `usePageDataset` calls `useStartupWarmupState` internally).
- `npm run lint:frontend` passes for `ClassesPage.tsx`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/hooks/usePageDataset.ts` (the new hook being consumed)
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `getClassesSurfaceState` (page-local)
   - Decision: `keep local` (page composes its own 2-boolean surface state from shared helpers; the two pages have structurally different surface-state shapes)
   - Owning module/path: `src/frontend/src/pages/ClassesPage.tsx`
   - Call-site rationale: Page-specific surface-state composition; not shared because AssignmentsPage uses a 3-boolean shape
   - Relevant canonical doc target: N/A (page-local)
   - Planned doc status: N/A

2. Helper: `getFinalClassesPageStates` (page-local)
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages/ClassesPage.tsx`
   - Call-site rationale: Page-specific final-state resolution combining surface state, model validity, and emptiness
   - Relevant canonical doc target: N/A (page-local)
   - Planned doc status: N/A

All consumed shared helpers (`usePageDataset`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, `computePageSurfaceBusy`) are already recorded in Sections 2–3.

**`computePageSurfaceBusy` empty mutation array in ClassesPage**: ClassesPage passes `[classPartialsQuery.isFetching, yearGroupsQuery.isFetching]` for fetch flags and `[]` (empty array) for mutation flags because it has no page-level mutations. The empty array is intentional — the helper requires both parameters and returns `true` when any flag in either array is truthy.

### Acceptance criteria

- `ClassesPage` renders identically to pre-refactoring behaviour for all states: ready with data, ready with empty data, loading/warmup-in-progress, blocking failure, warmup-failed-then-recovered.
- The `aria-busy` attribute toggles correctly during query fetching.
- The `aria-live` refresh announcement renders during background refresh.
- The blocking `Alert` renders when data cannot be trusted.
- The `Skeleton` renders during initial loading.
- `Empty` renders when there are no year groups or classes.
- `ClassesPage.spec.tsx` passes with zero assertion changes (test double setup may need updating but assertions must hold).
- All removed local functions (`shouldBlockSingleDataset`, `shouldRenderClassesBlockingState`, `hasRecoveredDataset`, `isDatasetRenderable`, `computeClassesSurfaceBusy`) are fully deleted.

### Required test cases (Red first)

No new tests — the existing `ClassesPage.spec.tsx` (17+ test cases) serves as the regression suite. Run it before and during refactoring to confirm behavioural preservation.

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/pages/ClassesPage` passes with zero assertion changes.
- `npm run lint:frontend` passes for `ClassesPage.tsx`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Verify all five removed local functions no longer exist in `ClassesPage.tsx`.

### Optional `@remarks` JSDoc follow-through

None — the page's internal `getClassesSurfaceState` should retain existing JSDoc.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 7 — Refactor `AssignmentsPage.tsx`

### Objective

Replace the inline dataset-state boilerplate in `AssignmentsPage.tsx` with calls to `usePageDataset`, the pure helpers, and `refetchAfterStaleInvalidate`. The page must retain its own 3-boolean surface-state composition (`getAssignmentsSurfaceState`), its filter state management, its mutation flows, and its render functions — but internal functions must use shared helpers where applicable.

### Constraints

- All observable behaviour must be preserved: loading skeletons, blocking `Alert`, action-loading state, table-loading state, busy `aria-busy`, delete-confirmation flow, retry flow, wizard modal flow.
- `shouldRenderAssignmentsBlockingState` must be replaced with `computePageSurfaceBlocking`.
- The `hasRecoveredAssignmentsDataset` logic in `getAssignmentsSurfaceState` must be replaced with `computeDatasetRenderable` (which internally derives recovered state).
- `isAssignmentsSurfaceBusyState` must be updated to use `computePageSurfaceBusy` for the fetching/mutation checks, with `shouldRenderTableLoadingState` layered on top as a page-local wrapper for `aria-busy`.
- The inline dataset-state derivation (approx. 20 lines of `isAssignmentsDatasetReady`, `isAssignmentsDatasetFailed`, etc.) must be removed in favour of `usePageDataset().datasetState`.
- The inline `useQuery` setup must be replaced with `usePageDataset('assignmentDefinitionPartials')`.
- `refetchAssignmentDefinitions` must be replaced with `refetchAfterStaleInvalidate(queryClient, queryKeys.assignmentDefinitionPartials())` at both call sites.
- All test assertions in `AssignmentsPage.spec.tsx` must pass unchanged (test doubles for `useStartupWarmupState` remain the control point).
- `npm run lint:frontend` passes for `AssignmentsPage.tsx`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/hooks/usePageDataset.ts`
- `src/frontend/src/query/queryInvalidationHelpers.ts`
- `src/frontend/src/query/queryKeys.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `getAssignmentsSurfaceState` (page-local)
   - Decision: `keep local` (page composes its own 3-boolean surface state; structurally different from ClassesPage)
   - Owning module/path: `src/frontend/src/pages/AssignmentsPage.tsx`
   - Call-site rationale: Page-specific 3-boolean surface-state shape not shared with ClassesPage
   - Relevant canonical doc target: N/A (page-local)
   - Planned doc status: N/A

2. Helper: `isAssignmentsSurfaceBusyState` (page-local)
   - Decision: `keep local` (wraps `computePageSurfaceBusy` with page-specific `shouldRenderTableLoadingState` trigger for `aria-busy`)
   - Owning module/path: `src/frontend/src/pages/AssignmentsPage.tsx`
   - Call-site rationale: Page-specific `aria-busy` composition; the spec explicitly requires preserving this as a page-local wrapper
   - Relevant canonical doc target: N/A (page-local)
   - Planned doc status: N/A

All consumed shared helpers are already recorded in Sections 2–4.

### Acceptance criteria

- `AssignmentsPage` renders identically to pre-refactoring behaviour for all states: ready with data, ready with no data, loading, blocking failure, action-loading, table-loading, warmup-failed-then-recovered, delete-success, delete-failure.
- The `aria-busy` attribute toggles correctly during query fetching, delete mutation, and table loading state.
- Retry (`handleRetryAssignmentsData`) calls `refetchAfterStaleInvalidate` and refreshes the table.
- Delete-confirm flow (`handleConfirmDelete`) calls `refetchAfterStaleInvalidate` after successful mutation and refreshes the table.
- `AssignmentsPage.spec.tsx` passes with zero assertion changes.
- All removed inline boilerplate is fully deleted.

### Required test cases (Red first)

No new tests — the existing `AssignmentsPage.spec.tsx` serves as the regression suite.

### Section checks

- `npm --prefix src/frontend test -- src/frontend/src/pages/AssignmentsPage` passes with zero assertion changes.
- `npm run lint:frontend` passes for `AssignmentsPage.tsx`.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None — the existing JSDoc for `handleRetryAssignmentsData` and `handleConfirmDelete` should be simplified to reference `refetchAfterStaleInvalidate` instead of duplicating its rationale.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

### Intermediate LOC checkpoint (after Section 7, before Section 8)

Before proceeding to the full regression pass, run a lightweight LOC check to catch incomplete boilerplate removal early:

```bash
scc \
  src/frontend/src/pages/ClassesPage.tsx \
  src/frontend/src/pages/AssignmentsPage.tsx \
  src/frontend/src/features/classes/ClassesManagementPanel.tsx \
  src/frontend/src/pages/useAssignmentDefinitionWizard.ts \
  src/frontend/src/query/sharedQueries.ts \
  src/frontend/src/query/queryKeys.ts \
  src/frontend/src/features/auth/startupWarmupState.ts \
  src/frontend/src/hooks/usePageDataset.ts \
  src/frontend/src/query/queryInvalidationHelpers.ts \
  --no-cocomo
```

If total lines exceed 4,007 at this checkpoint, inspect `ClassesPage.tsx` and `AssignmentsPage.tsx` for incomplete boilerplate removal or excessive new JSDoc before continuing to Section 8.

---

## Section 8 — Regression and contract hardening

### Objective

Verify that all touched production files and their test suites pass, lint is clean, and the LOC reduction hard gate is met.

### Constraints

- All existing tests for changed files must pass with zero assertion changes.
- New unit tests from Sections 1–4 must pass.
- LOC for the nine files (seven baseline + two new) must be lower than the baseline of 4,007 lines.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs (if regression fixes are needed):

- `SPEC.md`
- `src/frontend/AGENTS.md`
- All touched production files

### Acceptance criteria

- `npm --prefix src/frontend test -- src/frontend/src/query/sharedQueries` passes.
- `npm --prefix src/frontend test -- src/frontend/src/hooks/usePageDataset` passes.
- `npm --prefix src/frontend test -- src/frontend/src/query/queryInvalidationHelpers` passes.
- `npm --prefix src/frontend test -- src/frontend/src/pages/ClassesPage` passes.
- `npm --prefix src/frontend test -- src/frontend/src/pages/AssignmentsPage` passes.
- `npm --prefix src/frontend test -- src/frontend/src/features/classes/ClassesManagementPanel` passes.
- `npm --prefix src/frontend test -- src/frontend/src/pages/useAssignmentDefinitionWizard` passes.
- `npm run lint:frontend` passes for all changed files.
- LOC count of the nine production files is less than 4,007 lines.

### Required test cases/checks

1. Full frontend test run for all touched modules (command list above).
2. Frontend lint for all changed files.
3. LOC comparison using `scc` against the baseline.

### Section checks

- All test commands listed above return green.
- `npm run lint:frontend` passes.
- LOC hard gate verified: run `scc` on the nine files and confirm total lines < 4,007.
- Mandatory-read evidence gate passed for all delegated regression handoffs.

### LOC verification command

```bash
scc \
  src/frontend/src/pages/ClassesPage.tsx \
  src/frontend/src/pages/AssignmentsPage.tsx \
  src/frontend/src/features/classes/ClassesManagementPanel.tsx \
  src/frontend/src/pages/useAssignmentDefinitionWizard.ts \
  src/frontend/src/query/sharedQueries.ts \
  src/frontend/src/query/queryKeys.ts \
  src/frontend/src/features/auth/startupWarmupState.ts \
  src/frontend/src/hooks/usePageDataset.ts \
  src/frontend/src/query/queryInvalidationHelpers.ts \
  --no-cocomo
```

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 9 — Documentation and rollout notes

### Objective

Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` to record the new helpers and reconcile planned entries against actual implementation.

### Constraints

- Add a new Section 9.12 "Dataset-state deduplication helpers" with entries for each created helper (status `Implemented`).
- Update Section 3 (Canonical helper map) to include `hooks/usePageDataset.ts` and `query/queryInvalidationHelpers.ts`.
- Update Section 3.1 to list `getStartupWarmupQueryOptions` as a new public export from `sharedQueries.ts`.
- No other documentation changes are required (no backend changes, no API changes, no user-visible changes).

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- All new production files created in Sections 2–4

### Acceptance criteria

- Section 9.12 exists with entries for: `usePageDataset`, `computePageDatasetState`, `computePageSurfaceBlocking`, `computeDatasetRenderable`, `computePageSurfaceBusy`, `refetchAfterStaleInvalidate`, `getStartupWarmupQueryOptions`, `PageDatasetState` type, `PageDatasetResult<TData>` type. All statuses are `Implemented`.
- Section 3 canonical helper map lists the two new modules.
- Section 3.1 documents `getStartupWarmupQueryOptions` as a new public export.
- Planned helper entries from Sections 1–4 are reconciled: all `Not implemented` entries are updated to `Implemented`.

### Required checks

1. Verify Section 9.12 exists and has correct helper entries.
2. Verify Section 3 lists the new modules.
3. Verify Section 3.1 mentions `getStartupWarmupQueryOptions`.
4. Confirm no `Not implemented` entries for this feature remain (all are now `Implemented`).

### Optional `@remarks` JSDoc review

- Verify that `usePageDataset.ts` contains the retry-rationale JSDoc for the `enabled` condition.
- Verify that `refetchAfterStaleInvalidate` JSDoc explains the disabled-query use case and warns against using it as the general invalidation pattern.
- Verify that `computePageSurfaceBlocking` JSDoc documents the three-condition decision tree.
- Verify that `computeDatasetRenderable` JSDoc calls out the "recovered after warmup failure" semantics.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:** None — this is the final section.

---

## Suggested implementation order

1. Section 1 — `getStartupWarmupQueryOptions` export (enables Section 3)
2. Section 2 — Pure helpers + unit tests (enables Section 3)
3. Section 3 — `usePageDataset` hook + unit tests (enables Sections 6 and 7)
4. Section 4 — `refetchAfterStaleInvalidate` + unit tests (enables Section 7)
5. Section 5 — Fix ad-hoc query-key literals (independent; can run in parallel with Sections 1–4)
6. Section 6 — Refactor `ClassesPage.tsx` (depends on Sections 1–3)
7. Section 7 — Refactor `AssignmentsPage.tsx` (depends on Sections 1–4)
8. Section 8 — Regression and contract hardening (depends on Sections 1–7)
9. Section 9 — Documentation (depends on Section 8 passing LOC gate)

Section 5 can run in parallel with Sections 1–4. All other sections are sequential as listed.
