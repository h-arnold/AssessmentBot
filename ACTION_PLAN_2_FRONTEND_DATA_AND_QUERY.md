# Workstream 2: Frontend Data and Query Foundations

## Scope

- Frontend Zod/service contract updates
- `googleClassrooms` frontend transport integration
- Shared query keys and query options
- App-level warm-up ownership
- Shared invalidation and re-fetch rules
- Classes browser harness groundwork

## Touched code

- `src/frontend/src/services/referenceData.zod.ts`
- `src/frontend/src/services/referenceDataService.ts`
- `src/frontend/src/services/classPartials.zod.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/apiService.ts`
- `src/frontend/src/query/queryKeys.ts`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- `src/frontend/src/test/googleScriptRunHarness.ts`

## Exploration findings to account for

- Warm-up currently covers only `classPartials` and fails open.
- Reference-data and class-partial schemas still encode the old transport contracts.
- There is no frontend `googleClassrooms` service/query surface yet.
- There is no shared “mutation succeeded, refresh failed” orchestration model.
- The current harness does not yet enforce submitted-row ordering or richer scenario composition.

## Implementation guardrails (fresh-agent handoff)

- Treat `docs/developer/frontend/frontend-react-query-and-prefetch.md` as canonical for query ownership, startup warm-up, and prefetch policy.
- Keep all backend transport calls behind `callApi(...)`; no direct `google.script.run` usage in services/features.
- Extend existing orchestration (`AppAuthGate` + `sharedQueries`) rather than creating parallel orchestration modules.
- Keep warm-up non-blocking for shell render/navigation, but always expose warm-up state (`loading`, `ready`, `failed`) to consumers.
- Use the shared `googleScriptRunHarness` helper for frontend API mocking; do not add ad-hoc harnesses.
- Do not preserve name-based compatibility paths in frontend schemas/services once keyed contracts are landed.

## Work packages

### 2.1 Service and schema contract rewrite

Acceptance:

- Frontend schemas accept keyed cohorts, keyed year groups, and key-based class partials with resolved labels.
- Service methods keep transport at the `callApi(...)` boundary.
- Existing tests are rewritten to stop asserting old name-based contracts.

Implementation detail:

1. `referenceData.zod.ts`
   - Update cohort schema to include `key` plus agreed metadata.
   - Update year-group schema to include `key`.
   - Update update/delete input schemas to key-addressed payloads (`key`, not `originalName`/`name`).
2. `referenceDataService.ts`
   - Keep method names stable, but send keyed payloads and parse keyed responses.
3. `classPartials.zod.ts`
   - Replace `cohort`/`yearGroup` with `cohortKey`/`yearGroupKey`.
   - Add resolved labels (`cohortLabel`, `yearGroupLabel`) in transport schema.
4. `classPartialsService.ts`
   - Keep thin service boundary, parse with updated class-partials schema.
5. Tests
   - Replace old name-based/numeric assertions with key-based contract assertions only.

Tests:

- `src/frontend/src/services/referenceData.zod.spec.ts`
- `src/frontend/src/services/referenceDataService.spec.ts`
- `src/frontend/src/services/classPartialsService.spec.ts`

### 2.2 `googleClassrooms` integration

Acceptance:

- Add `googleClassrooms.zod.ts` and `googleClassroomsService.ts`.
- Add `queryKeys.googleClassrooms()`.
- Add `getGoogleClassroomsQueryOptions()`.
- Trigger this dataset prefetch when the Classes tab is entered.
- Keep this dataset prefetch non-blocking and outside startup warm-up.

Implementation detail:

1. Add `googleClassrooms.zod.ts`
   - Define runtime schema for classroom list payload returned by backend.
   - Export inferred types from schema only.
2. Add `googleClassroomsService.ts`
   - Implement `getGoogleClassrooms()` via `callApi(...)` and schema parsing.
3. Add query primitives
   - `queryKeys.googleClassrooms()`
   - `getGoogleClassroomsQueryOptions()`
4. Prefetch trigger location
   - Trigger `queryClient.prefetchQuery(getGoogleClassroomsQueryOptions())` when the Classes tab is entered.
   - Keep this prefetch fire-and-forget (non-blocking), with no startup gating dependency.
5. Error handling
   - Prefetch failures are logged for diagnostics and surfaced only where the Classes experience consumes the dataset.

Tests:

- `src/frontend/src/services/googleClassrooms.zod.spec.ts`
- `src/frontend/src/services/googleClassroomsService.spec.ts`
- `src/frontend/src/query/sharedQueries.query.spec.tsx`

### 2.3 Startup warm-up ownership

Acceptance:

- Extend the existing startup orchestration layer (`AppAuthGate` + `sharedQueries`) rather than introducing a second orchestration surface.
- Keep warm-up implemented through shared React Query query-option helpers and query-client calls.
- Warm `classPartials`, `cohorts`, and `yearGroups` in parallel via React Query.
- Keep warm-up non-blocking while exposing explicit warm-up states (`loading`, `ready`, `failed`) for downstream consumers.
- Do not fail open silently: failures must be represented in warm-up state and logs.

Implementation detail:

1. `sharedQueries.ts`
   - Add/maintain warm-up helpers that fetch `classPartials`, `cohorts`, and `yearGroups` via `fetchQuery(...)`.
   - Keep a single warm-up entrypoint that resolves only when all three warm-up calls settle successfully.
2. `AppAuthGate.tsx`
   - Continue to own startup warm-up orchestration after auth resolves to authorised.
   - Keep render path non-blocking.
   - Publish warm-up state (`loading`, `ready`, `failed`) through adjacent shared state/context so consumers can branch deterministically.
3. State semantics
   - `loading`: at least one startup warm-up dataset is in progress.
   - `ready`: all required startup datasets succeeded at least once.
   - `failed`: any required startup dataset failed in the current warm-up cycle.
4. Logging
   - Log warm-up failures once per failed cycle with request correlation metadata where available.

Tests:

- `src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `src/frontend/src/query/sharedQueries.query.spec.tsx`

### 2.4 Shared invalidation and refresh-failure rules

Acceptance:

- Cohort mutations invalidate `cohorts`.
- Year-group mutations invalidate `yearGroups`.
- Class mutations that require fresh partials must perform a real `refetch` of `classPartials` (not invalidate-only).
- Use a composite mutation outcome contract for required-refresh paths:
  - `mutationStatus: 'success'`
  - `refreshStatus: 'success' | 'failed'`
  - optional refresh error metadata (`code`, `requestId`, `retriable`) on refresh failure.
- Required re-fetch failure must be represented explicitly rather than silently leaving stale data visible.

Implementation detail:

1. Query behaviour rules
   - Cohort mutations: invalidate `cohorts`, then refetch when the active surface requires immediate consistency.
   - Year-group mutations: invalidate `yearGroups`, then refetch when the active surface requires immediate consistency.
   - Class mutations affecting list state: perform required `refetch` of `classPartials`.
2. Composite outcome return contract
   - Return mutation result and refresh result together for required-refresh flows.
   - Refresh failure payload includes safe diagnostics (error code, requestId, retriable).
3. UI behaviour
   - If mutation succeeded but required refresh failed, show explicit user guidance and retry affordance instead of silent stale-data continuation.

Tests:

- `src/frontend/src/query/sharedQueries.query.spec.tsx`
- `src/frontend/src/features/classes/queryInvalidation.spec.ts`

Completion status: Complete

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [x] commit created
- [x] push completed

Implementation notes:

- Completed on `copilot/implement-part-2-of-action-plan` in commit `e7542d219c2b8dfbc0702672fb36233ec98efcfd` (`feat: add classes query invalidation helpers`).
- Delivered shared query invalidation helpers for cohorts and year groups, plus a composite required-refresh outcome for class-partials refetch paths with transport-safe refresh failure metadata.
- Deviation from plan: this package landed the helper/orchestration layer and tests only; the explicit user guidance and retry affordance for refresh-failure outcomes still depends on later Classes UI work consuming the helper contract.
- Follow-up implication: later Classes mutation flows should call these helpers rather than duplicating invalidation logic, and should surface `refreshStatus: 'failed'` outcomes explicitly in the UI.

### 2.5 Browser harness groundwork

Acceptance:

- Add a reusable Classes CRUD scenario harness on top of `googleScriptRunHarness`.
- Cover ready state, startup-warm-up failure, Google Classroom entry failure, empty state, and representative partial success.
- Use a deterministic scenario queue so mocked backend interactions are asserted in submission order.
- Add shared scenario assertion helpers for each phase (warm-up loading/ready/failed, dataset failure, partial success).
- Keep harness fixtures centralised (no ad-hoc per-test mocks), using the shared `googleScriptRunHarness` pattern.

Implementation detail:

1. Add `e2e-tests/classes-crud.harness.spec.ts`.
2. Build a deterministic scenario queue abstraction over `googleScriptRunHarness`:
   - scenario step ordering is asserted
   - unexpected calls fail fast
3. Provide central fixtures for:
   - startup warm-up success
   - startup warm-up failure
   - googleClassrooms prefetch failure
   - empty classes state
   - representative partial-success mutation + refresh-failure outcome
4. Add reusable assertion helpers for scenario phases to keep specs concise and stable.

Tests:

- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`

Completion status: Complete

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [x] commit created
- [x] push completed

Implementation notes:

- Completed on `copilot/implement-part-2-of-action-plan` in commit `00f500f020adb63f1a5fa02222ef5cd2b0eba7f2` (`feat: implement Classes CRUD E2E harness and tests (work package 2.5)`).
- Added a reusable Playwright Classes harness on top of `googleScriptRunHarness`, with deterministic per-method response queues, fail-fast handling for unexpected backend calls, shared fixtures, and seven passing E2E scenarios.
- Deviation from plan: because the Classes tab is still a placeholder, the harness currently proves startup, navigation, prefetch, empty-state, and failure-sequencing behaviour rather than real CRUD UI interactions or phase-specific visual assertions.
- Follow-up implication: later Classes-tab sections can extend this harness to cover actual CRUD journeys and refresh-failure UI states without replacing the central scenario queue.

## Sequencing notes

- Do not start Classes-tab UI work until the keyed service contracts are in place.
- Land warm-up and refresh-failure semantics before implementing Classes-tab-dependent state gates.
- Keep harness work early enough that visible-flow design stays testable.

## Section checks

- `npm run frontend:test -- src/services/referenceData.zod.spec.ts src/services/referenceDataService.spec.ts src/services/classPartialsService.spec.ts src/query/sharedQueries.query.spec.tsx src/features/auth/AppAuthGate.auth.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
