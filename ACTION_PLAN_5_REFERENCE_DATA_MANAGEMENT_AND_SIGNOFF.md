# Workstream 5: Reference-Data Management and Sign-off

## Scope

- Cohort management modal
- Year-group management modal
- Delete-blocked UX
- Regression and contract hardening
- Documentation and rollout notes

## Touched code

- `src/backend/z_Api/apiHandler.js`
- `tests/api/apiHandler.test.js`
- `src/frontend/src/services/referenceDataService.ts`
- Existing `src/frontend/src/features/classes/**` (extend with reference-data management modals and supporting helpers)
- `src/frontend/e2e-tests/classes-crud.shared.ts` and focused Classes CRUD Playwright specs
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

## Exploration findings to account for

- `ReferenceDataController` already blocks in-use deletes with `reason = 'IN_USE'`; however, the API envelope currently maps these runtime errors to `INTERNAL_ERROR`. Workstream 5 must add an API-level machine-readable contract for delete-blocked states that the frontend can depend on.
- React Query and frontend testing docs are currently aligned with query-key, startup warm-up, and shared-harness behaviour; keep them aligned as implementation lands.
- Shared Classes CRUD harness primitives already exist; extend them instead of introducing a parallel harness.
- There is no dedicated `tests/api/referenceData*.test.js` suite; transport coverage currently lives in `tests/backend-api/referenceData.unit.test.js`.
- Keep the Classes query invalidation surface limited to the live `runMutationWithRequiredClassPartialsRefresh()` helper; do not reintroduce `invalidateCohortsAfterMutation` or `invalidateYearGroupsAfterMutation` wrappers.

## Work packages

### 5.1 Cohort management modal

Acceptance:

- Launches from the Classes tab as a secondary management workflow.
- Supports list, create, edit, delete, and active-state changes.
- Delete-blocked state is explicit and remains open with inline explanation.
- Successful mutations invalidate and refresh `cohorts`.

Tests:

- `src/frontend/src/features/classes/manageCohorts.spec.tsx`
- `src/frontend/src/features/classes/manageCohortDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts`

> **🟢 GREEN PHASE COMPLETE** — implementation merged and verified passing; commit and push are next.

| Step                          | Status  |
| ----------------------------- | ------- |
| Red tests added               | ✅ done |
| Red review clean              | ✅ done |
| Green implementation complete | ✅ done |
| Green review clean            | ✅ done |
| Checks passed                 | ✅ done |
| Action plan updated           | ✅ done |
| Commit created                | ✅ done |
| Push completed                | ✅ done |

**Delivery evidence — 5.1**

- **Branch:** `ws5-doc-update`
- **Code commit SHA:** `f21a87ed240e041334eaab9d95ce687f4802968d`
- **Code commit message:** `feat(ws5): implement cohort management modal`
- **Push:** succeeded to `origin/ws5-doc-update`
- **Notes:** commit also included the 5.1 test suite and action-plan updates

**Implementation notes — 5.1**

- Baseline repo validation was clean before section work began (lint, type-check, and test suites all passing).
- Current identified gaps: no cohort management modal component, no unit tests (`manageCohorts.spec.tsx`, `manageCohortDelete.spec.tsx`), no E2E spec (`classes-crud-manage-cohorts.spec.ts`), and the API envelope does not yet expose a machine-readable contract for delete-blocked cohort states (controller-level `reason: 'IN_USE'` currently collapses to `INTERNAL_ERROR` at the API layer).
- **Red-phase test files added:** `manageCohorts.spec.tsx` (unit — modal rendering, create, edit, toggle-active flows), `manageCohortDelete.spec.tsx` (unit — delete-blocked and delete-confirmed flows), and `e2e-tests/classes-crud-manage-cohorts.spec.ts` (E2E — full CRUD journey via toolbar launcher).
- **Shared helper extended:** `classes-crud.shared.ts` was extended with `createCohort`, `updateCohort`, and `deleteCohort` helper utilities used by the E2E spec.
- **Red-review findings resolved:** duplicate-text assertion bug (scoped queries to modal container); payload assertions strengthened to verify exact request body rather than call count alone; selector ambiguity resolved by using accessible-role queries; `z.void()` mock corrected to return `undefined` instead of `null` (Zod `void` parses to `undefined`); invalidation assertions made await-safe with `waitFor` wrappers.
- **Intended failing evidence:** all new tests fail because `ManageCohortsModal` and its toolbar launcher button do not yet exist — this is the expected red-phase outcome confirming tests are genuinely exercising unimplemented behaviour.

**Green-phase notes — 5.1**

- **Production files added/changed:**
  - `src/frontend/src/features/classes/ManageCohortsModal.tsx` — new modal component implementing list, create, edit, toggle-active, and delete-blocked/delete-confirmed flows for cohorts.
  - `src/frontend/src/features/classes/ClassesToolbar.tsx` — extended with a "Manage Cohorts" launcher button that opens `ManageCohortsModal`.
  - `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — updated to mount `ManageCohortsModal` and pass required state/handlers through.

- **Green-review findings resolved:**
  - **Toggle-active error surface:** a toggle-active mutation failure was previously swallowed silently; updated `ManageCohortsModal` to surface the error as an inline alert within the modal rather than losing it.
  - **Toolbar spec coverage:** `ClassesToolbar.spec.tsx` was extended to cover the "Manage Cohorts" launcher button render and click interaction, filling a gap identified during green review.
  - **Impossible edit submit guard:** an explicit early-return guard was added to `handleFormFinish` inside `ManageCohortsModal` to handle the logically impossible state where the form is submitted in edit mode but no cohort is currently selected, preventing a silent no-op mutation with a stale or undefined payload.

- **Checks that passed:**
  - Targeted frontend unit tests (`manageCohorts.spec.tsx`, `manageCohortDelete.spec.tsx`, `ClassesToolbar.spec.tsx`) — all green.
  - E2E suite (`classes-crud-manage-cohorts.spec.ts`) — all scenarios passing.
  - `npm run frontend:lint` — clean (no errors; any pre-existing warnings are warning-only and do not block).
  - `npm exec tsc -- -b src/frontend/tsconfig.json` — no type errors.
  - `npm run lint` (root) — clean (warning-only output acceptable; no errors).

- **Section 5.1 is complete.** Commit creation and push to remote are the remaining steps.

### 5.2 Year-group management modal

Acceptance:

- Launches from the Classes tab as a secondary management workflow.
- Supports list, create, edit, and delete.
- Delete-blocked state is explicit and remains open with inline explanation.
- Successful mutations invalidate and refresh `yearGroups`.

Tests:

- `src/frontend/src/features/classes/manageYearGroups.spec.tsx`
- `src/frontend/src/features/classes/manageYearGroupDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts`

> **✅ GREEN PHASE COMPLETE — ready for commit/push**

| Step                          | Status  |
| ----------------------------- | ------- |
| Red tests added               | ✅ done |
| Red review clean              | ✅ done |
| Green implementation complete | ✅ done |
| Green review clean            | ✅ done |
| Checks passed                 | ✅ done |
| Action plan updated           | ✅ done |
| Commit created                | ✅ done |
| Push completed                | ✅ done |

**Implementation notes — 5.2**

- This section parallels the 5.1 cohort-management workflow but targets year groups instead of cohorts: the modal will launch from the Classes tab toolbar, support list, create, edit, and delete flows, surface delete-blocked states inline, and invalidate/refresh the `yearGroups` query on successful mutations.
- Red-phase test files added:
  - `src/frontend/src/features/classes/manageYearGroups.spec.tsx` — unit tests for the `ManageYearGroupsModal` component (list, create, edit flows).
  - `src/frontend/src/features/classes/manageYearGroupDelete.spec.tsx` — unit tests for delete and delete-blocked flows within the modal.
  - `e2e-tests/classes-crud-manage-year-groups.spec.ts` — E2E spec covering the full manage-year-groups workflow from the Classes tab toolbar.
- `classes-crud.shared.ts` was extended with shared E2E helpers for `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`, keeping E2E setup DRY across the new spec and any future year-group tests.
- Review finding resolved: in the delete-failure (non-blocked) path, the destructive confirm button is now explicitly kept **enabled**, making a retriable generic failure visually distinct from a blocked delete where the button is disabled with an inline explanation. This distinction is now part of the red-phase test assertions.

**Green-phase notes — 5.2**

- Production files added/changed:
  - `src/frontend/src/features/classes/ManageYearGroupsModal.tsx` — new component implementing the full year-group management modal (list, create, edit, delete, delete-blocked flows) with `yearGroups` query invalidation on successful mutations.
  - `src/frontend/src/features/classes/ClassesToolbar.tsx` — updated to wire the "Manage year groups" toolbar button to launch `ManageYearGroupsModal`.
  - `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — updated to host and render the `ManageYearGroupsModal` alongside the existing cohort-management modal.
- Reviewer outcome: implementation is clean and stays within the simpler year-group contract (`{ key, name }` — no active-state flow). No legacy or active-state fields were introduced; the component mirrors the cohort modal pattern only where appropriate and deliberately omits the active-toggle behaviour that cohorts carry.
- Checks that passed:
  - `npm run frontend:test -- manageYearGroups manageYearGroupDelete` — targeted unit tests all green.
  - `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts` — E2E journey passes end-to-end.
  - `npm run frontend:lint` — clean (no errors; any pre-existing warnings are warning-only and do not block).
  - `npm exec tsc -- -b src/frontend/tsconfig.json` — type-check passes with no errors.
  - `npm run lint` (root) — clean (warning-only acceptable, no errors).
- Section 5.2 is complete. Commit creation and push are the only remaining steps.

**Delivery evidence — 5.2**

- **Branch:** `ws5-doc-update`
- **Code commit SHA:** `9ba0b3ab2ec4f6579a688493276963fc0ddceff7`
- **Code commit message:** `feat(ws5): implement year-group management modal`
- **Push:** succeeded to `origin/ws5-doc-update`
- **Notes:** commit also included the 5.2 test suite and action-plan updates

### 5.3 Regression and contract hardening

Acceptance:

- Delete-blocked cohort/year-group API failures expose a machine-readable contract suitable for frontend blocked-state rendering (rather than collapsing to generic internal errors).
- Touched backend model/controller/API suites pass.
- Touched frontend service/hook/component suites pass.
- Required Playwright journeys pass.
- Lint and type-check pass.

Checks:

- `npm test -- tests/models/<target> tests/controllers/<target> tests/api/<target> tests/backend-api/<target>`
- `npm run frontend:test -- src/features/classes/<target> src/services/<target> src/query/<target>`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-*.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm run frontend:test:coverage`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

> **🟢 GREEN PHASE COMPLETE — checks passed, ready for commit/push**

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ✅ done    |
| Red review clean              | ✅ done    |
| Green implementation complete | ✅ done    |
| Green review clean            | ✅ done    |
| Checks passed                 | ✅ done    |
| Action plan updated           | ✅ done    |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

**Implementation notes — 5.3**

- This section hardens the machine-readable delete-blocked contract and related regressions across backend and frontend. The goal is to ensure that any `IN_USE` deletion failure is surfaced as a first-class, typed API error rather than collapsing silently into a generic response.
- Current identified gap: `ReferenceDataController` already throws with `reason = 'IN_USE'` at the controller level, but `apiHandler` still maps these runtime failures to `INTERNAL_ERROR` in the API envelope. The red-phase work will add tests that assert the machine-readable contract end-to-end, and the green phase will fix `apiHandler` to propagate the typed `IN_USE` reason correctly.
- Touched checks will include backend API tests (targeting `tests/api/apiHandler.test.js` and `tests/backend-api/referenceData.unit.test.js`) plus the frontend service, query, and component suites (targeting `src/services/referenceDataService`, related query hooks, and the cohort/year-group management modal components).

**Red-phase record — 5.3**

- Test files updated in the red phase: `tests/api/apiHandler.test.js` (backend) and `src/frontend/src/services/referenceDataService.spec.ts` (frontend).
- Backend tests now pin the contract: an error thrown with `reason = 'IN_USE'` must produce `error.code = 'IN_USE'` in the API envelope; a plain `Error` (no `reason`) must still produce `INTERNAL_ERROR`.
- Frontend service tests confirm that delete-cohort and delete-year-group transport failures carrying `ApiTransportError.code = 'IN_USE'` are propagated to the caller unchanged (not swallowed or remapped).
- Intended failing evidence at end of red phase: exactly two backend `apiHandler` tests fail because the transport mapping that converts `reason = 'IN_USE'` into `error.code = 'IN_USE'` is not yet implemented; all other existing tests remain green.

**Green-phase record — 5.3**

- **Production file changed:** `src/backend/z_Api/apiHandler.js`
- **What changed:** `IN_USE` was added to the API error-code mapping in `apiHandler`. `error.reason === 'IN_USE'` now maps directly to the machine-readable transport code `IN_USE` in the API error envelope. Generic plain `Error` objects (no `reason` field, or an unrecognised `reason`) still fall back to `INTERNAL_ERROR`, preserving existing behaviour for all other error paths.
- **Checks that passed:**
  - Targeted backend tests: `tests/api/apiHandler.test.js` and `tests/backend-api/referenceData.unit.test.js` — all pass, including the two previously-failing `IN_USE` contract assertions.
  - Targeted frontend service / delete tests: `src/frontend/src/services/referenceDataService.spec.ts` — all pass.
  - Both manage-delete Playwright journeys: `e2e-tests/classes-crud-cohorts.spec.ts` and `e2e-tests/classes-crud-year-groups.spec.ts` — all pass.
  - `npm run lint` — clean.
  - `npm run frontend:lint` — clean.
  - `npm run frontend:test:coverage` — coverage thresholds met.
  - `npm exec tsc -- -b src/frontend/tsconfig.json` — no type errors.
- **Reviewer note:** the new `IN_USE` mapping still depends on the calling controller supplying a non-empty `message` alongside `reason`. This invariant is already enforced by `ReferenceDataController`; it is an accepted minimal-scope assumption rather than a follow-up code change.
- **Section completion status:** green implementation and review are complete; all checks pass. Commit and push are the only remaining steps.

### 5.4 Documentation and rollout notes

Acceptance:

- Docs reflect the final key-based `ABClass`, cohort, and year-group contracts.
- React Query and warm-up docs reflect real startup and invalidation behaviour.
- Rollout notes preserve the destructive-reset assumption.
- Follow-up notes preserve the deferred assessment-workflow refactor for numeric `yearGroup`.
- Make it explicit that this deferred numeric `yearGroup` follow-up must be handled via downstream mapping/projection only; frontend/backend transport contracts must remain key-based (`yearGroupKey`) with no legacy fallback fields reintroduced.
- Reference-data docs and notes should use key-based payloads: cohorts are `{ key, name, active, startYear, startMonth }` and year groups are `{ key, name }`, rather than the retired name-based contract.

Documents to update:

- `SPEC.md` if the final contract shifts
- `CLASSES_TAB_LAYOUT_AND_MODALS.md` if implementation changes visible behaviour
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-testing.md`
- Any backend API/data-shape documentation touched by the final contract

## Sequencing notes

- Keep delete-blocked UX aligned with backend-authoritative rules.
- Update canonical docs after implementation details settle, not before.

## Section checks

- `npm run frontend:test -- src/features/classes/manageCohorts.spec.tsx src/features/classes/manageCohortDelete.spec.tsx src/features/classes/manageYearGroups.spec.tsx src/features/classes/manageYearGroupDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts e2e-tests/classes-crud-manage-year-groups.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
