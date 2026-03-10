# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Add backend reference-data models for `Cohort` and `YearGroup`.
- Add backend persistence/controller support for storing, listing, creating, updating, and deleting those records.
- Add backend API handlers and dispatcher registration so the frontend can call those operations through `apiHandler`.
- Add frontend Zod schemas for request and response validation.
- Derive frontend TypeScript types from the Zod schemas using `z.infer<typeof ...>`.
- Add frontend service callers for all cohort and yearGroup CRUD operations.
- Add or update targeted automated tests covering model, controller, API, schema, and service behaviour.

### Out of scope

- Any frontend UI, hooks, pages, or forms for managing cohorts or year groups.
- Any migration of existing `ABClass.cohort` or numeric `yearGroup` fields to the new reference-data collections.
- Any builder changes unless required solely to keep tests or linting green.
- Any speculative generic registry framework beyond the minimum shared controller logic needed for these two resources.

### Assumptions

1. `YearGroup` is a new string-based reference model and remains separate from existing numeric `yearGroup` usage in class and assignment data.
2. Duplicate detection for both resources is based on `name.trim().toLowerCase()`.
3. Submitted display casing is preserved in storage and transport, even though duplicate detection uses a normalised key.
4. `Cohort.active` defaults to `true` only when omitted during creation or deserialisation.
5. CRUD is required at the API and frontend service layers now, but no UI management flow is included in this delivery.

---

## Recovered implementation status

- Current active section: Section 5 — Regression and contract hardening.
- Current phase: Complete.
- Verified implemented work:
  - Section 1 backend model files exist at `src/backend/Models/Cohort.js` and `src/backend/Models/YearGroup.js`.
  - Targeted backend model tests exist at `tests/models/cohortYearGroup.test.js` and cover the planned model scenarios.
  - Section 2 controller and persistence work is implemented in `src/backend/y_controllers/ReferenceDataController.js` with targeted coverage in `tests/controllers/referenceDataController.test.js`.
  - Section 3 API registration and thin handlers are implemented in `src/backend/Api/apiConstants.js`, `src/backend/Api/apiHandler.js`, and `src/backend/Api/referenceData.js` with targeted coverage in `tests/api/apiHandler.test.js` and `tests/backend-api/referenceData.unit.test.js`.
  - Section 4 frontend schemas and service callers are implemented in `src/frontend/src/services/referenceData.zod.ts` and `src/frontend/src/services/referenceDataService.ts` with targeted coverage in `src/frontend/src/services/referenceData.zod.spec.ts` and `src/frontend/src/services/referenceDataService.spec.ts`.
- Verified pending work:
  - Section 5 regression validation and final documentation sync remain outstanding.
- Repository note:
  - The current re-audit found no material mismatch between this plan and the branch contents.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin and delegate behaviour to a controller.
- Fail fast on invalid inputs, duplicate conflicts, missing records, and persistence failures.
- Avoid defensive guards that hide internal wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- For new backend public methods, call `Validate.requireParams(...)` at the start unless the method is an existing API transport boundary that intentionally returns structured failure envelopes.
- Keep new backend runtime files GAS-compatible and preserve guarded Node test exports with `if (typeof module !== 'undefined') { module.exports = ...; }`.
- On the frontend, define Zod schemas first and derive all related TypeScript types with `z.infer<typeof ...>`.
- Keep backend runtime code Google Apps Script compatible.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Backend models

### Objective

- Add `Cohort` and `YearGroup` backend models with idiomatic getters, setters, serialisation helpers, and field validation.

### Constraints

- Validation must live in setters so constructors and deserialisers share the same rules.
- `Cohort` must expose `getActive()` and `setActive(active)`.
- `YearGroup` only requires `name`.
- Models should validate field shape, not repository-level uniqueness.

### Acceptance criteria

- `Cohort` and `YearGroup` exist in the backend model layer.
- `name` is always stored as a trimmed non-empty string.
- Invalid names throw immediately.
- `Cohort.active` is always a boolean and defaults to `true`.
- Invalid `active` values throw immediately.
- `toJSON()` returns plain transport-safe objects.
- `fromJSON()` recreates valid instances and applies the same validation.

### Required test cases (Red first)

Backend model tests:

1. `YearGroup` constructs successfully with a valid name and `getName()` returns the stored trimmed value.
2. `YearGroup.setName()` trims surrounding whitespace before storing the value.
3. `YearGroup` throws when name is empty, whitespace-only, null, undefined, or non-string.
4. `YearGroup.toJSON()` returns `{ name }`.
5. `YearGroup.fromJSON()` returns a valid instance and preserves the name value.
6. `Cohort` constructs successfully with a valid name and explicit `active` value.
7. `Cohort` defaults `active` to `true` when omitted.
8. `Cohort.setName()` trims surrounding whitespace before storing the value.
9. `Cohort.setActive()` accepts `true` and `false`.
10. `Cohort` throws when name is empty, whitespace-only, null, undefined, or non-string.
11. `Cohort` throws when `active` is non-boolean.
12. `Cohort.toJSON()` returns `{ name, active }`.
13. `Cohort.fromJSON()` returns a valid instance and applies the default `active: true` when omitted.

Backend controller tests:

1. None in this section.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- <backend model target>`

### Implementation notes / deviations / follow-up

- **Status:** Complete based on repository inspection.
- **Implementation notes:** Minimal model files were added in `src/backend/Models` and follow the existing serialisation pattern with guarded Node exports. A re-audit on 2026-03-10 confirmed that the model implementation and tests still match this section.
- **Deviations from plan:** No material deviation identified from the current files. The combined model test coverage lives in `tests/models/cohortYearGroup.test.js` rather than separate per-model files.
- **Follow-up implications for later sections:** Later controller and API work should consume model `toJSON()` output rather than re-shaping model fields manually.

---

## Section 2 — Backend controller and persistence

### Objective

- Add backend persistence and CRUD operations for cohort and yearGroup reference data using JsonDbApp collections.

### Constraints

- Keep shared logic in one small controller rather than duplicating CRUD flows for each resource.
- Use dedicated collections: `cohorts` and `year_groups`.
- Enforce duplicate detection using normalised names.
- Preserve submitted display casing in stored records.
- Return plain objects only; do not leak storage metadata.
- Throw on duplicate create, conflicting rename, invalid model payload, or delete/update of missing records.
- Update payloads must use the shape `{ originalName, record }`, where `record` is the full replacement resource payload (`{ name, active }` for cohort and `{ name }` for year group).
- `originalName` lookup is by exact stored name after trimming the supplied input; duplicate detection for the replacement `record.name` still uses the normalised key.
- Renaming to the same normalised name as the target record is allowed, including casing-only changes, provided no other stored record uses that normalised key.

### Acceptance criteria

- Controller can list all cohorts and year groups from their respective collections.
- Controller can create a new cohort or year group when the normalised name is unique.
- Controller rejects create when another record already exists with the same normalised name.
- Controller can update a record by original name, including rename operations.
- Controller rejects update when the target record does not exist.
- Controller rejects update when the renamed value collides with another record’s normalised name.
- Controller can delete a record by name.
- Controller rejects delete when the record does not exist.
- List operations return records sorted by `name` ascending.
- Create, update, and list operations return transport-safe plain objects with storage-only fields such as `_id` stripped.

### Required test cases (Red first)

Backend model tests:

1. None in this section beyond using real model instances in controller tests where appropriate.

Backend controller tests:

1. Listing an empty `cohorts` collection returns an empty array.
2. Listing an empty `year_groups` collection returns an empty array.
3. Creating a cohort persists `{ name, active }` to the `cohorts` collection.
4. Creating a year group persists `{ name }` to the `year_groups` collection.
5. Creating a cohort with omitted `active` persists `active: true`.
6. Creating a duplicate cohort name differing only by case is rejected.
7. Creating a duplicate cohort name differing only by leading/trailing whitespace is rejected.
8. Creating a duplicate year group name differing only by case is rejected.
9. Listing cohorts returns records sorted by `name`.
10. Listing year groups returns records sorted by `name`.
11. Updating an existing cohort can change only `active`.
12. Updating an existing cohort can rename the cohort when the new normalised name is unique.
13. Updating an existing year group can rename the record when the new normalised name is unique.
14. Updating a missing cohort is rejected.
15. Updating a missing year group is rejected.
16. Renaming a cohort to another existing cohort name is rejected.
17. Renaming a year group to another existing year group name is rejected.
18. Deleting an existing cohort removes it from storage.
19. Deleting an existing year group removes it from storage.
20. Deleting a missing cohort is rejected.
21. Deleting a missing year group is rejected.
22. Controller list responses do not include storage-only fields such as `_id`.
23. Controller create responses do not include storage-only fields such as `_id`.
24. Controller update responses do not include storage-only fields such as `_id`.
25. Updating a cohort using the same normalised name with different display casing succeeds when no conflicting record exists.
26. Updating a year group using the same normalised name with different display casing succeeds when no conflicting record exists.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- <backend controller target>`

### Implementation notes / deviations / follow-up

- **Status:** Complete.
- **Implementation notes:** `src/backend/y_controllers/ReferenceDataController.js` now provides shared CRUD flows for cohorts and year groups using the `cohorts` and `year_groups` collections, exact-name targeting for updates and deletes, duplicate checks on normalised names, transport-safe `_id` stripping, and GAS-compatible name sorting. The reviewed Red-phase suite remains in `tests/controllers/referenceDataController.test.js` and now passes with 30 targeted controller tests.
- **Deviations from plan:** The reviewer required two Red-phase adjustments before Green: removing lookup-strategy coupling from CRUD tests and adding explicit invalid-payload rejection coverage. During Green review, a GAS-runtime incompatibility caused by `toSorted` was identified and fixed before section completion.
- **Follow-up implications for later sections:** API handlers should depend on controller methods directly and not replicate duplicate checking or sorting logic.

---

## Section 3 — Backend API surface

### Objective

- Expose cohort and yearGroup CRUD operations to the frontend via the existing allowlisted API transport.

### Constraints

- Register every new method in `API_METHODS`, `API_ALLOWLIST`, and `ApiDispatcher._invokeAllowlistedMethod(...)`.
- Keep API files thin and delegate business logic to the controller.
- Return plain response data only; leave envelope shaping to `apiHandler`.
- Preserve existing admission/completion tracking behaviour.
- Match the existing API test pattern: dispatcher tests stub GAS-global handler functions, while direct API module tests verify each thin handler resolves the controller and delegates correctly.

### Acceptance criteria

- The backend exposes:
  - `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`
  - `getYearGroups`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`
- Each method is allowlisted and dispatchable through `apiHandler`.
- Handler functions delegate to controller methods with the expected payload shape.
- Successful API responses return plain data compatible with frontend callers.
- Invalid payloads or controller failures are surfaced through the existing API failure path.
- API tests cover both dispatcher routing and direct module delegation so Node and GAS-style resolution paths remain intact.

### Required test cases (Red first)

Backend model tests:

1. None in this section.

Backend controller tests:

1. None in this section.

API layer tests:

1. `API_METHODS` contains all eight new method names.
2. `API_ALLOWLIST` contains all eight new method names.
3. Dispatcher routes `getCohorts` to the correct handler.
4. Dispatcher routes `createCohort` to the correct handler.
5. Dispatcher routes `updateCohort` to the correct handler.
6. Dispatcher routes `deleteCohort` to the correct handler.
7. Dispatcher routes `getYearGroups` to the correct handler.
8. Dispatcher routes `createYearGroup` to the correct handler.
9. Dispatcher routes `updateYearGroup` to the correct handler.
10. Dispatcher routes `deleteYearGroup` to the correct handler.
11. Each API handler instantiates or resolves the controller and delegates with the expected params.
12. Successful handler execution returns plain response data rather than a transport envelope.
13. Controller-thrown errors propagate back to `apiHandler` so the envelope becomes a failure response.
14. Direct API module tests verify each handler resolves the controller using the same Node/GAS-compatible pattern as existing API modules.
15. Shared API test helpers are updated if required so new global handler methods can be installed and restored consistently during dispatcher tests.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- <backend api target>`

### Implementation notes / deviations / follow-up

- **Status:** Complete.
- **Implementation notes:** `src/backend/Api/apiConstants.js`, `src/backend/Api/apiHandler.js`, and `src/backend/Api/referenceData.js` now expose the eight reference-data methods through the allowlisted transport, preserve the existing `apiHandler` admission/completion flow, and delegate thinly to `ReferenceDataController`. The targeted API suites in `tests/api/apiHandler.test.js` and `tests/backend-api/referenceData.unit.test.js` pass against the implemented routes and handlers.
- **Deviations from plan:** The reviewer required the delete-path tests to stop asserting an undeclared acknowledgement payload, and stale ESLint suppression comments were removed from the direct API test file before Green started. No production-side deviation remained after review.
- **Follow-up implications for later sections:** Frontend service method names must match these exact API constants. `ApiDispatcher._invokeAllowlistedMethod(...)` should remain thin for now, but the growing sequential branch list is a future refactor candidate once more allowlisted methods accumulate.

---

## Section 4 — Frontend Zod schemas and service callers

### Objective

- Add frontend validation schemas and typed service callers for all cohort and yearGroup CRUD operations.

### Constraints

- Define Zod schemas first.
- Derive all exported TypeScript types from schemas using `z.infer<typeof ...>`.
- Keep transport access inside service modules using `callApi`.
- Validate request payloads in the service layer before transport.
- Parse backend response payloads in the feature service layer with resource-specific Zod schemas after `callApi` resolves, while leaving envelope parsing and retry behaviour inside `callApi`.
- Do not add UI state management or direct `google.script.run` calls.

### Acceptance criteria

- Frontend has Zod schemas for cohort, yearGroup, and CRUD payloads.
- Exported types are derived with `z.infer<typeof ...>` rather than handwritten interfaces.
- Service methods exist for all list/create/update/delete operations for both resources.
- Each service calls `callApi` with the correct backend method name and payload.
- Invalid payloads fail locally during schema parsing.
- Valid responses are parsed and typed consistently for future frontend consumers.

### Required test cases (Red first)

Backend model tests:

1. None in this section.

Backend controller tests:

1. None in this section.

API layer tests:

1. None in this section.

Frontend tests:

1. Cohort schema accepts `{ name: 'Year 7', active: true }`.
2. Cohort schema rejects empty or whitespace-only names.
3. Cohort schema rejects non-boolean `active`.
4. YearGroup schema accepts `{ name: 'Year 10' }`.
5. YearGroup schema rejects empty or whitespace-only names.
6. Create cohort input schema accepts omitted `active`.
7. Update cohort input schema requires `originalName` and a valid cohort record payload.
8. Delete cohort input schema rejects empty names.
9. Equivalent create, update, and delete schemas for yearGroup reject malformed names.
10. `getCohorts()` calls `callApi` with `getCohorts`.
11. `createCohort()` calls `callApi` with `createCohort` and the parsed payload.
12. `updateCohort()` calls `callApi` with `updateCohort` and the parsed payload.
13. `deleteCohort()` calls `callApi` with `deleteCohort` and the parsed payload.
14. `getYearGroups()` calls `callApi` with `getYearGroups`.
15. `createYearGroup()` calls `callApi` with `createYearGroup` and the parsed payload.
16. `updateYearGroup()` calls `callApi` with `updateYearGroup` and the parsed payload.
17. `deleteYearGroup()` calls `callApi` with `deleteYearGroup` and the parsed payload.
18. `getCohorts()` parses the resolved backend payload with the cohort list response schema before returning it.
19. `createCohort()`, `updateCohort()`, and `deleteCohort()` parse the resolved backend payload with the appropriate response schema before returning it.
20. `getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, and `deleteYearGroup()` parse the resolved backend payload with the appropriate response schema before returning it.
21. Each service returns the parsed backend data unchanged on success.
22. Each service propagates `callApi` rejections unchanged.
23. Each service rejects malformed success payloads when response parsing fails.
24. A TypeScript compile check passes with exported types defined via `z.infer<typeof ...>`.

### Section checks

- `npm run frontend:test -- <frontend service target>`
- `npm run frontend:test -- <frontend schema target>`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

- **Status:** Complete.
- **Implementation notes:** `src/frontend/src/services/referenceData.zod.ts` now defines the reviewed runtime schemas and inferred types, and `src/frontend/src/services/referenceDataService.ts` validates create/update/delete inputs locally before transport and parses successful backend payloads before returning them. The targeted frontend suites in `src/frontend/src/services/referenceData.zod.spec.ts` and `src/frontend/src/services/referenceDataService.spec.ts` pass.
- **Deviations from plan:** Red-phase review tightened the cohort update input contract to require full replacement payloads, fixed service-test mock leakage, and aligned delete response parsing with the implemented no-payload backend delete behaviour. Green implementation remained minimal and required no further deviation after review.
- **Follow-up implications for later sections:** Later UI work should import these schemas and inferred types rather than redefining validation.

---

## Section 5 — Regression and contract hardening

### Objective

- Verify that the new model, persistence, API, and frontend service contracts work together without regressing existing behaviour.

### Constraints

- Prefer focused test runs first, then broader lint validation.
- Do not widen scope into unrelated refactors.
- If any existing tests fail for unrelated reasons, record them explicitly instead of masking them.

### Acceptance criteria

- All new targeted backend tests pass.
- All new targeted frontend tests pass.
- Backend lint passes for touched backend files.
- Frontend lint passes for touched frontend files.
- No existing API transport behaviour is broken by the new allowlisted methods.

### Required test cases/checks

1. Run touched backend model suites covering both new models.
2. Run touched backend controller suites covering both resources.
3. Run touched backend API/dispatcher suites covering all new method registrations and routes.
4. Run touched frontend schema and service suites.
5. Run `npm run lint`.
6. Run `npm run frontend:lint`.
7. Run `npm exec tsc -- -b src/frontend/tsconfig.json`.
8. If implementation touches any shared config or builder code unexpectedly, run the relevant builder checks and document why.
9. Manually review method-name parity between frontend services and backend `API_METHODS`.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Status:** Complete.
- **Implementation notes:** Section-level regression validation is green. Backend model, controller, and API suites pass; frontend schema and service suites pass; `npm run lint`, `npm run frontend:lint`, and `npm exec tsc -- -b src/frontend/tsconfig.json` all pass. Manual parity review confirmed that frontend service method names match the backend `API_METHODS` entries exactly.
- **Deviations from plan:** Validation revealed one backend lint warning in `src/backend/Models/Cohort.js`; it was resolved in scope by replacing a constructor magic number with a named constant. An unrelated unstaged change remains present in `.github/agents/implementation.agent.md` and was not modified as part of this feature work.

---

## Documentation and rollout notes

### Objective

- Keep planning and implementation notes aligned with the delivered feature and any caveats.

### Constraints

- Only update documents relevant to the touched areas.
- Keep AGENTS files as routing signposts; do not duplicate canonical policy unnecessarily.

### Acceptance criteria

- This `ACTION_PLAN.md` accurately describes the agreed implementation and validation approach.
- Any implementation-time deviations from the plan are recorded in the relevant section notes.
- Any new backend API method names or frontend contract caveats are documented if a canonical doc is touched.

### Required checks

1. Verify this plan reflects the final collection names, API method names, and duplicate rules.
2. Verify the frontend contract notes explicitly require Zod schemas plus `z.infer<typeof ...>`.
3. Confirm every section contains comprehensive required test cases before implementation starts.
4. If implementation introduces any documentable caveat, add it to the relevant canonical doc and note it here.

### Implementation notes / deviations / follow-up

- Recovery and progress updates in this action plan now reflect the completed implementation across backend, API, frontend schema, and frontend service layers.
- Canonical backend API documentation was updated in `docs/developer/backend/api-layer.md` to record the new cohort/year-group CRUD endpoints, payload conventions, frontend wrapper location, and no-payload delete responses.

---

## Suggested implementation order

1. Section 1: backend models
2. Section 2: backend controller and persistence
3. Section 3: backend API surface
4. Section 4: frontend Zod schemas and service callers
5. Section 5: regression and contract hardening
6. Documentation and rollout notes
