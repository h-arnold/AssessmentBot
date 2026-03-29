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

## Work packages

### 2.1 Service and schema contract rewrite

Acceptance:
- Frontend schemas accept keyed cohorts, keyed year groups, and key-based class partials with resolved labels.
- Service methods keep transport at the `callApi(...)` boundary.
- Existing tests are rewritten to stop asserting old name-based contracts.

Tests:
- `src/frontend/src/services/referenceData.zod.spec.ts`
- `src/frontend/src/services/referenceDataService.spec.ts`
- `src/frontend/src/services/classPartialsService.spec.ts`

### 2.2 `googleClassrooms` integration

Acceptance:
- Add `googleClassrooms.zod.ts` and `googleClassroomsService.ts`.
- Add `queryKeys.googleClassrooms()`.
- Add `getGoogleClassroomsQueryOptions()`.
- Keep this dataset as Classes-tab entry prefetch rather than startup warm-up.

Tests:
- `src/frontend/src/services/googleClassrooms.zod.spec.ts`
- `src/frontend/src/services/googleClassroomsService.spec.ts`
- `src/frontend/src/query/sharedQueries.query.spec.tsx`

### 2.3 Startup warm-up ownership

Acceptance:
- `AppAuthGate` or adjacent shared state owns startup warm-up for `classPartials`, `cohorts`, and `yearGroups`.
- Warm-up is blocking, not fail-open.
- Downstream consumers can distinguish loading, ready, and failed warm-up states.

Tests:
- `src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `src/frontend/src/query/sharedQueries.query.spec.tsx`

### 2.4 Shared invalidation and refresh-failure rules

Acceptance:
- Cohort mutations invalidate `cohorts`.
- Year-group mutations invalidate `yearGroups`.
- Class mutations refresh `classPartials`.
- Required re-fetch failure is represented explicitly rather than silently leaving stale data visible.

Tests:
- `src/frontend/src/query/sharedQueries.query.spec.tsx`
- `src/frontend/src/features/classes/queryInvalidation.spec.ts`

### 2.5 Browser harness groundwork

Acceptance:
- Add a reusable Classes CRUD scenario harness on top of `googleScriptRunHarness`.
- Cover ready state, startup-warm-up failure, Google Classroom entry failure, empty state, and representative partial success.

Tests:
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`

## Sequencing notes

- Do not start Classes-tab UI work until the keyed service contracts are in place.
- Land warm-up and refresh-failure semantics before rendering blocking tab states.
- Keep harness work early enough that visible-flow design stays testable.

## Section checks

- `npm run frontend:test -- src/frontend/src/services/referenceData.zod.spec.ts src/frontend/src/services/referenceDataService.spec.ts src/frontend/src/services/classPartialsService.spec.ts src/frontend/src/query/sharedQueries.query.spec.tsx src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
