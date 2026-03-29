# Workstream 5: Reference-Data Management and Sign-off

## Scope

- Cohort management modal
- Year-group management modal
- Delete-blocked UX
- Regression and contract hardening
- Documentation and rollout notes

## Touched code

- `src/backend/y_controllers/ReferenceDataController.js`
- `src/frontend/src/services/referenceDataService.ts`
- New `src/frontend/src/features/classes/**`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

## Exploration findings to account for

- Delete-blocked modal UX currently has no backend-authoritative contract.
- The current docs do not match the real warm-up/query-key state.
- Browser harness coverage exists at the transport layer, but not yet as a reusable Classes CRUD fixture set.
- There is no dedicated `tests/api/referenceData*.test.js` suite; transport coverage currently lives in `tests/backend-api/referenceData.unit.test.js`.

## Work packages

### 5.1 Cohort management modal

Acceptance:
- Supports list, create, edit, delete, and active-state changes.
- Delete-blocked state is explicit and remains open with inline explanation.
- Successful mutations invalidate and refresh `cohorts`.

Tests:
- `src/frontend/src/features/classes/manageCohorts.spec.tsx`
- `src/frontend/src/features/classes/manageCohortDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts`

### 5.2 Year-group management modal

Acceptance:
- Supports list, create, edit, and delete.
- Delete-blocked state is explicit and remains open with inline explanation.
- Successful mutations invalidate and refresh `yearGroups`.

Tests:
- `src/frontend/src/features/classes/manageYearGroups.spec.tsx`
- `src/frontend/src/features/classes/manageYearGroupDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts`

### 5.3 Regression and contract hardening

Acceptance:
- Touched backend model/controller/API suites pass.
- Touched frontend service/hook/component suites pass.
- Required Playwright journeys pass.
- Lint and type-check pass.

Checks:
- `npm test -- tests/models/<target> tests/controllers/<target> tests/api/<target> tests/backend-api/<target>`
- `npm run frontend:test -- src/frontend/src/features/classes/<target> src/frontend/src/services/<target> src/frontend/src/query/<target>`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-*.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm run frontend:test:coverage`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### 5.4 Documentation and rollout notes

Acceptance:
- Docs reflect the final key-based `ABClass`, cohort, and year-group contracts.
- React Query and warm-up docs reflect real startup and invalidation behaviour.
- Rollout notes preserve the destructive-reset assumption.
- Follow-up notes preserve the deferred assessment-workflow refactor for numeric `yearGroup`.

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

- `npm run frontend:test -- src/frontend/src/features/classes/manageCohorts.spec.tsx src/frontend/src/features/classes/manageCohortDelete.spec.tsx src/frontend/src/features/classes/manageYearGroups.spec.tsx src/frontend/src/features/classes/manageYearGroupDelete.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts e2e-tests/classes-crud-manage-year-groups.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
