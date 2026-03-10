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

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin and delegate behaviour to a controller.
- Fail fast on invalid inputs, duplicate conflicts, missing records, and persistence failures.
- Avoid defensive guards that hide internal wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
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

- **Implementation notes:** Create minimal model files in `src/backend/Models` and follow existing serialisation conventions.
- **Deviations from plan:** Record any repo-specific naming or export adjustments required by the test harness.
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

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- <backend controller target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Use the existing `DbManager` collection access pattern and keep collection writes explicit.
- **Deviations from plan:** Record any JsonDbApp behaviour that requires slight filter or replace/upsert adjustments.
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

### Acceptance criteria

- The backend exposes:
  - `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`
  - `getYearGroups`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`
- Each method is allowlisted and dispatchable through `apiHandler`.
- Handler functions delegate to controller methods with the expected payload shape.
- Successful API responses return plain data compatible with frontend callers.
- Invalid payloads or controller failures are surfaced through the existing API failure path.

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

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- <backend api target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Prefer one API module per resource or one small shared reference-data API module if that keeps the surface clear.
- **Deviations from plan:** Record any dispatcher branching adjustments needed to match existing test patterns.
- **Follow-up implications for later sections:** Frontend service method names must match these exact API constants.

---

## Section 4 — Frontend Zod schemas and service callers

### Objective

- Add frontend validation schemas and typed service callers for all cohort and yearGroup CRUD operations.

### Constraints

- Define Zod schemas first.
- Derive all exported TypeScript types from schemas using `z.infer<typeof ...>`.
- Keep transport access inside service modules using `callApi`.
- Validate request payloads in the service layer before transport.
- Do not add UI state management or direct `google.script.run` calls.

### Acceptance criteria

- Frontend has Zod schemas for cohort, yearGroup, and CRUD payloads.
- Exported types are derived with `z.infer<typeof ...>` rather than handwritten interfaces.
- Service methods exist for all list/create/update/delete operations for both resources.
- Each service calls `callApi` with the correct backend method name and payload.
- Invalid payloads fail locally during schema parsing.
- Valid responses are typed consistently for future frontend consumers.

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
18. Each service returns the resolved backend data unchanged on success.
19. Each service propagates `callApi` rejections unchanged.
20. A static type-level review confirms exported types are defined via `z.infer<typeof ...>`.

### Section checks

- `npm run frontend:test -- <frontend service target>`
- `npm run frontend:test -- <frontend schema target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Place the Zod schemas adjacent to the service module, following the frontend instruction file.
- **Deviations from plan:** Record any naming adjustments needed to stay aligned with existing service patterns.
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
7. If implementation touches any shared config or builder code unexpectedly, run the relevant builder checks and document why.
8. Manually review method-name parity between frontend services and backend `API_METHODS`.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Summarise final verification coverage and any fixes made during regression.
- **Deviations from plan:** Note any unrelated failing tests or lint issues discovered.

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

- Record any documentation updates or confirm that no additional canonical docs were required beyond this action plan.

---

## Suggested implementation order

1. Section 1: backend models
2. Section 2: backend controller and persistence
3. Section 3: backend API surface
4. Section 4: frontend Zod schemas and service callers
5. Section 5: regression and contract hardening
6. Documentation and rollout notes
