# Classes CRUD Delivery Plan

This plan has been split into five workstream documents so the delivery order, touched code, and failure modes are easier to reason about.

Use this file as the index only.

## Source documents

- Product contract: `SPEC.md`
- UI/layout contract: `CLASSES_TAB_LAYOUT_AND_MODALS.md`
- This plan index: `ACTION_PLAN.md`

## Workstream index

1. [`ACTION_PLAN_1_BACKEND_CONTRACTS.md`](ACTION_PLAN_1_BACKEND_CONTRACTS.md)
   - Stable-key reference-data contract
   - `ABClass` key migration
   - Partial-shape refresh
   - Backend validation hardening

2. [`ACTION_PLAN_2_FRONTEND_DATA_AND_QUERY.md`](ACTION_PLAN_2_FRONTEND_DATA_AND_QUERY.md)
   - Frontend Zod/service contract changes
   - `googleClassrooms` transport integration
   - Shared query keys and query options
   - Startup warm-up ownership
   - Shared invalidation and re-fetch rules
   - Browser harness groundwork

3. [`ACTION_PLAN_3_CLASSES_TAB_SHELL_AND_TABLE.md`](ACTION_PLAN_3_CLASSES_TAB_SHELL_AND_TABLE.md)
   - Settings-page feature bootstrap
   - Classes shell and readiness plumbing
   - Merged row view-model
   - Summary, toolbar, table (including column sorting/filtering), and load-state rendering

4. [`ACTION_PLAN_4_BULK_CLASS_WORKFLOWS.md`](ACTION_PLAN_4_BULK_CLASS_WORKFLOWS.md)
   - Shared batch mutation engine
   - Bulk create, delete, active/inactive
   - Bulk cohort, year group, and course-length updates
   - Mutation summary and refresh-failure UX

5. [`ACTION_PLAN_5_REFERENCE_DATA_MANAGEMENT_AND_SIGNOFF.md`](ACTION_PLAN_5_REFERENCE_DATA_MANAGEMENT_AND_SIGNOFF.md)
   - Cohort management modal
   - Year-group management modal
   - Regression and contract hardening
   - Documentation and rollout notes

## Final de-sloppification outcome

- Final branch-wide cleanup removed the last stale reference-data contract notes and misleading inline comments so the pushed branch no longer documents the retired name-based payloads or removed adapter-era wording.
- Workstream 1 backend cleanup also standardised active `ABClass` construction usage, removed the misleading `abclassMutations.js` validator naming, and dropped duplicate or stale backend test and documentation leftovers.

## Cross-cutting rules

- TDD-first for every work package.
- Keep `SettingsPage.tsx` as a composition layer only.
- Keep API handlers thin; push behaviour into controllers, hooks, helpers, or services.
- Route all frontend transport through `callApi(...)`.
- Use Zod for all new or changed frontend contracts.
- Treat the key-based contract as blank-slate only for this delivery.
- Preserve the rollout note that downstream assessment flows still depend on numeric `ABClass.yearGroup`.
- For frontend-visible behaviour changes, pair Vitest with Playwright coverage and extend the shared Classes CRUD harness instead of creating parallel harnesses.

## Exploration summary (historical planning context)

The split above matches the largest codebase seams and the highest-risk gaps found during the original planning sweep. Several of the risks below have since been resolved in delivered work and later cleanup; use the workstream documents above for the current implementation state.

### Backend contract risks

- During the original planning sweep, `src/backend/z_Api/referenceData.js` was still dereferencing request payloads before validating shape.
- During the original planning sweep, `src/backend/z_Api/abclassPartials.js` resolved `ABClassController` at module load, which was fragile under bundle/load-order changes.
- During the original planning sweep, `src/backend/z_Api/abclassMutations.js` sanitised `classId` on delete but not consistently on create/update paths.
- The original controller/model test baseline still encoded old name-based and create-on-missing behaviour.

### Frontend data/query risks

- At planning time, `src/frontend/src/features/auth/AppAuthGate.tsx` only warmed `classPartials` and failed open.
- At planning time, `src/frontend/src/services/referenceData.zod.ts` and `src/frontend/src/services/classPartials.zod.ts` still encoded the old transport shapes.
- The initial delivery gap included the absence of a frontend `googleClassrooms` service or query definition.
- The original plan also tracked the lack of a shared refresh-failure contract for “mutation succeeded, refresh failed”.

### Feature-shell risks

- At planning time, `src/frontend/src/pages/SettingsPage.tsx` still rendered a blank placeholder card for the Classes tab.
- At planning time, `src/frontend/src/features/classes/` existed for Workstream 2 query-invalidation foundations, but still lacked the Classes shell/table components.
- The original page-test baseline covered tabs, not data-driven tab content or blocking readiness states.

### Bulk-workflow risks

- Workstream 1 hardened backend validation for missing-class `active` updates; the planned Workstream 4 follow-on needed to preserve this behaviour while adding bulk flows.
- The original bulk-workflow plan noted that a shared batch mutation engine had not been introduced yet.
- The shared Classes harness already existed, but the Workstream 4 plan still called for explicit bulk-journey assertions for submitted-row ordering and partial-failure aggregation.

### Reference-data modal and sign-off risks

- The original sign-off plan noted that delete-blocked UX did not yet have a backend-authoritative contract.
- The planning sweep also recorded that `docs/developer/frontend/frontend-react-query-and-prefetch.md` had fallen out of sync with the warm-up/query-key implementation of that time.
- The original test-gap note was that there was no dedicated `tests/api/referenceData*.test.js` suite, with transport coverage instead living in `tests/backend-api/referenceData.unit.test.js`.

## Recommended implementation order

1. Workstream 1: backend contracts
2. Workstream 2: frontend data/query foundations
3. Workstream 3: feature shell and table
4. Workstream 4: bulk class workflows
5. Workstream 5: reference-data management, regression, and docs

## Validation command hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint: `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests: `npm run frontend:test:e2e -- <target>`
- Frontend coverage: `npm run frontend:test:coverage`
- Frontend type-check: `npm exec tsc -- -b src/frontend/tsconfig.json`
