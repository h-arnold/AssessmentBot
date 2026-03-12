# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Deliver backend API support for ABClass management needed by upcoming frontend work.
- Add a Google Classroom listing endpoint so frontend can retrieve classes available to the signed-in user.
- Add ABClass write endpoints to create/update (upsert) and delete class records.
- Keep implementation in active backend API/controller areas only (`src/backend/z_Api`, `src/backend/y_controllers`, supporting docs/tests).

### Out of scope

- Frontend UI implementation and user flows.
- Broad refactors of existing ABClass or transport infrastructure unrelated to the requested endpoints.
- Any changes in deprecated areas (`src/AdminSheet`, `src/AssessmentRecordTemplate`).

### Assumptions

1. Frontend will call `apiHandler` transport methods rather than direct `google.script.run.<method>` calls.
2. ABClass persistence should continue to use existing `ABClassController.saveClass()` write-through behaviour for full and partial records.
3. Deletion should remove both canonical class storage and partial registry entries for the same `classId`.
4. Endpoint naming will follow existing transport conventions and remain stable once consumed by frontend.
5. `courseLength` will be provided directly by the frontend user as an integer number of years when calling `upsertABClass`.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API handlers thin and delegate to controller/client logic.
- Fail fast on invalid request payloads and persistence failures.
- Reuse existing validators and error patterns.
- Keep changes minimal, localised, and consistent with GAS runtime constraints.
- Use British English in code comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint (if touched): `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests (if touched): `npm run frontend:test -- <target>`

---

## Section 1 — API contract and transport wiring

### Delivery status

- Current phase: Complete
- Section status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Objective

- Define and expose new API methods in `apiHandler` transport allowlist/dispatch.
- Lock down method names, request parameter contracts, and dispatch ownership before implementing endpoint behaviour.

### Constraints

- Keep dispatch branches thin and explicit.
- Do not add business logic to `apiHandler`.
- Preserve current request/response envelope behaviour in `apiHandler`.
- Keep method names stable once introduced to avoid frontend integration churn.

### Methods introduced in this section (contract only)

1. `getGoogleClassrooms(params)`
   - **Purpose:** transport entrypoint for classroom listing.
   - **Expected params (Section 1 placeholder contract):**
     - `params`: optional object (reserved for future filtering; unused in Section 1).
2. `upsertABClass(params)`
   - **Purpose:** transport entrypoint for create/update class persistence.
   - **Expected params (contract-level shape, behaviour implemented later):**
     - `params.classId` (string, required)
     - `params.cohort` (string|number|null, optional)
     - `params.yearGroup` (number|null, optional)
     - `params.courseLength` (number, optional)
3. `updateABClass(params)`
   - **Purpose:** transport entrypoint for lightweight ABClass field updates.
   - **Expected params (contract-level shape, behaviour implemented later):**
     - `params.classId` (string, required)
     - `params.cohort` (string|number|null, optional)
     - `params.yearGroup` (number|null, optional)
     - `params.courseLength` (number, optional; integer years, minimum 1)
     - `params.active` (boolean|null, optional)
4. `deleteABClass(params)`
   - **Purpose:** transport entrypoint for class deletion.
   - **Expected params (contract-level shape, behaviour implemented later):**
     - `params.classId` (string, required)

### Files touched in this section

- `src/backend/z_Api/apiConstants.js`
  - Add constants to `API_METHODS` and `API_ALLOWLIST` for all methods listed above.
- `src/backend/z_Api/apiHandler.js`
  - Add dispatch branches in `ApiDispatcher._invokeAllowlistedMethod(...)` for each method.
- `src/backend/z_Api/googleClassrooms.js` (new)
  - Add thin exported handler function signature only.
- `src/backend/z_Api/abclassMutations.js` (new)
  - Add thin exported handler signatures for upsert, update, and delete only.

### Acceptance criteria

- New method constants added to API method registry and allowlist.
- Dispatcher resolves each new method to a dedicated handler function.
- Unknown method behaviour remains unchanged.
- Request validation envelope handling remains unchanged (`INVALID_REQUEST` for malformed transport payloads).
- No controller logic, Classroom API calls, or persistence writes are added in this section.

### Required test cases (Red first)

Backend API layer tests:

1. `API_METHODS` includes `getGoogleClassrooms`, `upsertABClass`, `updateABClass`, and `deleteABClass` with exact string values.
2. `API_ALLOWLIST` includes entries for all four new methods and maps each to itself.
3. `apiHandler` dispatches `getGoogleClassrooms` to `getGoogleClassrooms(params)`.
4. `apiHandler` dispatches `upsertABClass` to `upsertABClass(params)`.
5. `apiHandler` dispatches `updateABClass` to `updateABClass(params)`.
6. `apiHandler` dispatches `deleteABClass` to `deleteABClass(params)`.
7. Dispatch for existing methods (for example `getABClassPartials`) remains functional and unchanged.
8. Unknown method names still return `UNKNOWN_METHOD` without invoking any handler.
9. Malformed request payloads (missing method, empty method, non-object request) still return `INVALID_REQUEST`.
10. When a new handler throws `ApiValidationError`, response code is still `INVALID_REQUEST`.
11. When a new handler throws an unmapped error, response code is still `INTERNAL_ERROR`.
12. `requestId` is still generated for both success and failure envelopes.
13. Success envelope shape remains `{ ok: true, requestId, data }` for new methods.
14. Failure envelope shape remains `{ ok: false, requestId, error: { code, message, retriable } }` for new methods.

Backend module export tests:

15. `src/backend/z_Api/googleClassrooms.js` exports `getGoogleClassrooms` in Node test runtime.
16. `src/backend/z_Api/abclassMutations.js` exports `upsertABClass`, `updateABClass`, and `deleteABClass` in Node test runtime.

Non-functional safety tests:

17. No additional `apiHandler` admission-control behaviour changes (lock timing/rate-limit paths remain green).
18. No new API methods are callable unless allowlisted.

### Section checks

- `npm test -- tests/backend/z_Api/apiConstants.test.js`
- `npm test -- tests/backend/z_Api/apiHandler.test.js`
- `npm test -- tests/backend/z_Api/googleClassrooms.test.js`
- `npm test -- tests/backend/z_Api/abclassMutations.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Confirm final method names before frontend wiring begins.
  - Keep handler bodies intentionally thin in this section; business behaviour belongs to Sections 2-4.
  - Contract-only handlers fail explicitly until later sections implement runtime behaviour, avoiding false-success transport responses.
- **Deviations from plan:**
  - Repo test conventions use tests/api/_ rather than the placeholder tests/backend/z_Api/_ paths listed above.
  - Red-phase verification used the repo's Vitest commands directly because the editor test runner did not resolve these backend files in this workspace.
- **Review findings resolved:**
  - Removed an overly specific placeholder params fixture for getGoogleClassrooms so Section 1 does not imply filtering behaviour.
  - Added a durable synthetic non-allowlisted-handler test instead of asserting an intermediate pre-allowlist state for a real Section 1 method.
  - Replaced silent placeholder success with explicit not-implemented failures and added direct throw assertions for the new contract-only handlers.
- **Verification evidence:**
  - `npm test -- tests/api/apiHandler.test.js tests/api/googleClassrooms.test.js tests/api/abclassMutations.test.js` passed.
  - `npm run lint` passed.
- **Commit evidence:**
  - Branch: `feat/ReactFrontend`
  - Commit: `b4ef53f1002a8ac5e263308937c636125da81ba6`
  - Message: `feat(api): complete Section 1 transport contract wiring`
  - Push: successful (`5591e88..b4ef53f  feat/ReactFrontend -> feat/ReactFrontend`)
- **Follow-up implications for later sections:**
  - Section 2 depends on `getGoogleClassrooms` contract stability.
  - Sections 3-4 depend on `upsertABClass`/`updateABClass`/`deleteABClass` parameter contracts agreed here.

---

## Section 2 — Google Classroom listing endpoint

### Delivery status

- Current phase: Complete
- Section status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Objective

- Provide a frontend-callable endpoint returning only the classroom fields needed for class selection during ABClass creation.

### Constraints

- Reuse `ClassroomApiClient` and existing paging behaviour.
- Return a stable transport-safe summary shape containing only `classId` and `className`.
- Do not load or return roster data (`teachers`, `students`) in this endpoint.
- Do not require `cohort`, `yearGroup`, or `courseLength` in this endpoint; those are supplied by the user later via frontend forms.
- Keep naming aligned with existing ABClass conventions (`classId`, `className`), even if Google returns `id` and `name`.

### Output contract for this section

- `getGoogleClassrooms(params)` success payload:
  - `Array<{ classId: string, className: string }>`
- `params` remains optional and unused in this section.

### Data boundary decisions (agreed)

- **Provided by Section 2 endpoint:**
  - `classId` (mapped from Classroom course id)
  - `className` (mapped from Classroom course name)
- **Provided by frontend/user at upsert time:**
  - `cohort`
  - `yearGroup`
  - `courseLength` (integer years)
- **Populated during `upsertABClass` (Section 3) using backend calls:**
  - `teachers`
  - `students`
  - `classOwner`
  - any additional class metadata derived during ABClass initialisation/sync

### Acceptance criteria

- Endpoint returns array of classroom summaries for picker use with exact keys `classId` and `className`.
- Endpoint never returns `teachers`, `students`, `classOwner`, or `enrollmentCode`.
- Errors propagate through existing API envelope mapping.
- No legacy `globals.js` expansion.

### Required test cases (Red first)

Backend API/client tests:

1. Handler delegates to classroom client method.
2. Handler maps Classroom client records (`id`, `name`) to `{ classId, className }`.
3. Handler ignores non-contract fields from the Classroom client response (for example `enrollmentCode`).
4. Successful response shape matches documented contract and key names exactly.
5. Empty classroom list returns `[]` (not `null` or omitted data).
6. If classroom client returns malformed records (for example missing `id` or `name`), handler fails fast with validation mapping.
7. Client/handler failure path propagates as API failure envelope.
8. `apiHandler` success envelope remains unchanged for this method.

### Section checks

- `npm test -- tests/backend/z_Api/googleClassrooms.test.js`
- `npm test -- tests/backend/z_Api/apiHandler.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - This section intentionally supports only class picker population.
  - Rich class data hydration is deferred to Section 3 (`upsertABClass`) to avoid unnecessary API calls during selection.
- **Deviations from plan:**
  - Repo test conventions use `tests/api/googleClassrooms.test.js` and targeted assertions in `tests/api/apiHandler.test.js` rather than the placeholder test paths listed above.
  - Red-phase verification used the repo test command directly because the editor test runner did not resolve these backend Vitest files in this workspace.
- **Review findings resolved:**
  - Reworked the red-phase test harness to use `globalThis.ClassroomApiClient`, aligning with the backend GAS runtime model rather than implying CommonJS production wiring.
  - Strengthened failure-envelope assertions so `requestId` remains covered for `getGoogleClassrooms` failure paths.
  - Added malformed-record coverage for non-object Classroom rows and hardened the handler so those records fail as `ApiValidationError` instead of surfacing as `INTERNAL_ERROR`.
- **Verification evidence:**
  - `npm test -- tests/api/googleClassrooms.test.js tests/api/apiHandler.test.js` passed.
  - `npm run lint` passed.
- **Commit evidence:**
  - Branch: `feat/ReactFrontend`
  - Commit: `10f0c4fa007f10f6ada919359cff4fdb64260ab9`
  - Message: `feat(api): complete Section 2 Google Classroom listing endpoint`
  - Push: successful (`b4ef53f..10f0c4f  feat/ReactFrontend -> feat/ReactFrontend`)
- **Follow-up implications for later sections:**
  - Section 3 input validation should treat `cohort`, `yearGroup`, and `courseLength` as user-supplied values, not values fetched in Section 2.
  - Section 3 should validate `courseLength` as an integer-year value at the transport boundary.

---

## Section 3 — ABClass upsert and update endpoints

### Delivery status

- Current phase: Complete
- Section status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Objective

- Add endpoint support to create/update persisted ABClass records using selected classroom details plus frontend-provided metadata.
- Plan both a full `upsertABClass` flow and a targeted `updateABClass` flow for lightweight field updates.

### Constraints

- Treat Google Classroom as the source of truth for `classOwner`, `teachers`, and `students`.
- Explicitly exclude assignment mutation from these endpoints; assignments are updated by assignment-run flows.
- Use `upsertABClass` for create or refresh operations that require classroom-derived data.
- Use `updateABClass` for partial updates to supplied fields without loading/rebuilding the full class document.
- Validate `courseLength` as integer-only with minimum value `1`.
- Preserve write-through consistency between full class records and `abclass_partials`.

### Contracts introduced in this section

1. `upsertABClass(params)`
   - Required params: `classId` (string), `cohort`, `yearGroup`, `courseLength`
   - Behaviour: upsert-on-update (create when missing, update when existing).
   - Data ownership:
     - User supplied: `cohort`, `yearGroup`, `courseLength`
     - Google-derived: `classOwner`, `teachers`, `students`
2. `updateABClass(params)`
   - Required params: `classId` (string)
   - Optional patch params: `cohort`, `yearGroup`, `courseLength`, `active`
   - Behaviour: upsert-on-update semantics; if class does not yet exist, create it before applying patch.
   - Explicit exclusions: `classOwner`, `teachers`, `students`, and `assignments` are not patchable through this endpoint.

### Acceptance criteria

- `upsertABClass` accepts payload (`classId`, `cohort`, `yearGroup`, `courseLength`) with explicit validation and error mapping.
- `upsertABClass` hydrates `classOwner`, `teachers`, and `students` from Google Classroom data on write paths.
- `updateABClass` applies only supplied patch fields via partial persistence semantics and does not mutate excluded fields.
- Both endpoints enforce `courseLength` integer and minimum `1` validation.
- Both endpoints follow upsert-on-update behaviour when the target class does not yet exist.
- Assignment data is untouched by both endpoints and documented as out-of-scope for this section.
- Responses return a useful post-write summary payload for frontend state updates.

### Required test cases (Red first)

Backend controller/API tests:

1. `upsertABClass` valid request delegates to controller and persists successfully.
2. `upsertABClass` creates new class when classId does not exist.
3. `upsertABClass` updates existing class when classId exists.
4. `upsertABClass` hydrates `classOwner`, `teachers`, and `students` from Classroom sources.
5. `updateABClass` updates only supplied patch fields (`cohort`, `yearGroup`, `courseLength`, `active`).
6. `updateABClass` does not alter `teachers`, `students`, `classOwner`, or `assignments`.
7. `updateABClass` follows upsert-on-update behaviour when class is missing.
8. Missing required params fail with validation error mapping.
9. Non-integer or `< 1` `courseLength` fails with validation error mapping.
10. Error mapping remains consistent with API handler envelopes for both endpoints.

### Section checks

- `npm test -- tests/backend/z_Api/abclassMutations.test.js`
- `npm test -- tests/controllers/abclass-upsert-update.test.js`
- `npm test -- tests/models/abclassManager.initialise.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Keep endpoint handlers thin and push orchestration to controller methods.
  - Prefer JsonDbApp `updateOne(..., { $set: ... })` for `updateABClass` partial patch paths.
- **Deviations from plan:**
  - Repo test conventions use `tests/api/abclassMutations.test.js` and `tests/controllers/abclass-upsert-update.test.js` rather than the placeholder test paths listed above.
  - Red-phase verification used the repo test command directly because the editor test runner did not resolve these backend Vitest files in this workspace.
- **Review findings resolved:**
  - Tightened the controller red harness to enforce the existing per-class collection storage contract rather than allowing an overly permissive shared collection seam.
  - Added explicit forbidden-field transport coverage for `updateABClass` and endpoint-specific `apiHandler` envelope coverage for `updateABClass` validation failures.
- **Implementation notes discovered:**
  - `updateABClass` create-on-missing paths now retain the ABClass model's canonical defaults for unsupplied fields rather than inventing `yearGroup`, `courseLength`, or `active` values.
  - Existing-class `updateABClass` responses return the persisted partial summary and therefore preserve the stored roster/class owner state, matching the endpoint's non-patchable field contract.
- **Verification evidence:**
  - `npm test -- tests/api/abclassMutations.test.js tests/controllers/abclass-upsert-update.test.js tests/models/abclassManager.initialise.test.js tests/api/apiHandler.test.js` passed.
  - `npm run lint` passed.
- **Commit evidence:**
  - Branch: `feat/ReactFrontend`
  - Commit: `fb6118cff29dfcf80297d92db025fcd6b953dd52`
  - Message: `feat(api): complete Section 3 ABClass upsert and update endpoints`
  - Push: successful (`10f0c4f..fb6118c  feat/ReactFrontend -> feat/ReactFrontend`)
- **Follow-up implications for later sections:**
  - Section 4 delete flow must remain compatible with both upsert and partial-update persistence paths.

---

## Section 4 — ABClass delete endpoint

### Delivery status

- Current phase: Commit and push
- Section status: In progress
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [ ] commit created
  - [ ] push completed

### Objective

- Add endpoint to delete an ABClass record by `classId`.
- Define delete semantics using JsonDbApp collection-level and document-level delete APIs.

### Constraints

- Keep deletion semantics explicit and documented.
- Ensure registry consistency between full class data and class partials.
- Use JsonDbApp `dropCollection(name)` for full class collection deletion.
- Use JsonDbApp `deleteOne(filter)` for `abclass_partials` registry removal.
- Keep endpoint handler thin; orchestration should live in `ABClassController`.

### JsonDbApp methods and usage points

1. `dropCollection(name)`
   - **Why:** each ABClass full record is stored in its own collection (`collectionName === classId`), so class deletion should remove the whole collection.
   - **Where used:** in `ABClassController` delete orchestration method (new), via `this.dbManager.getDb().dropCollection(classId)` or equivalent DbManager wrapper.
2. `deleteOne(filter)`
   - **Why:** `abclass_partials` is a shared registry collection with one document per class; only the matching partial should be removed.
   - **Where used:** in `ABClassController` delete orchestration method (new), via `partialsCollection.deleteOne({ classId })` followed by `save()`.

### Contracts introduced in this section

1. `deleteABClass(params)`
   - Required params: `classId` (string)
   - Behaviour:
     - Validate `classId` transport input.
     - Delete full class collection using JsonDbApp `dropCollection(classId)`.
     - Delete matching `abclass_partials` document using `deleteOne({ classId })`.
     - Return delete result summary for frontend state reconciliation.
   - Response contract:
     - `{ classId: string, fullClassDeleted: boolean, partialDeleted: boolean }`
   - Idempotency:
     - Repeated delete for same `classId` returns success with flags indicating what was deleted in this call.

### Acceptance criteria

- Endpoint deletes target full class collection via `dropCollection(classId)`.
- Endpoint deletes related partial record via `deleteOne({ classId })` in `abclass_partials`.
- Endpoint is idempotent and returns deterministic boolean result flags.
- Invalid `classId` fails with validation error mapping.
- API response contract is documented and consistent with `apiHandler` success envelope.

### Required test cases (Red first)

Backend controller/API tests:

1. `deleteABClass` valid request delegates to controller delete orchestration.
2. Controller delete orchestration calls `dropCollection(classId)` for the full class collection.
3. Controller delete orchestration calls `deleteOne({ classId })` on `abclass_partials` and persists collection.
4. Successful delete returns `{ classId, fullClassDeleted: true, partialDeleted: true }` when both exist.
5. Idempotent repeat delete returns success with boolean flags reflecting no-op deletions.
6. When full collection exists but partial is missing, response remains successful with mixed flags.
7. When partial exists but full collection is already absent, response remains successful with mixed flags.
8. Invalid `classId` (missing/empty/unsafe format) fails with validation error mapping.
9. Controller or JsonDbApp failures propagate through existing API error mapping.
10. `apiHandler` envelope remains stable for delete success/failure responses.

### Section checks

- `npm test -- tests/backend/z_Api/abclassMutations.test.js`
- `npm test -- tests/controllers/abclass-delete.test.js`
- `npm test -- tests/backend/z_Api/apiHandler.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Add a focused delete method on `ABClassController` (for example `deleteClassById`) to keep API handlers thin.
  - Consider adding a small `DbManager.dropCollection(name)` wrapper if direct `getDb().dropCollection(...)` access is undesirable.
- **Deviations from plan:**
  - The controller method was implemented as `deleteABClass(params)` to match the transport naming and keep the Section 4 test contract direct.
  - Repo test conventions use `tests/controllers/abclass-delete.test.js` and extended `tests/api/abclassMutations.test.js` rather than only the placeholder paths listed above.
- **Review findings resolved:**
  - Relaxed the delete red harness so it asserts the delete contract and idempotent flags rather than a brittle internal seam or fixed missing-collection message.
  - Added controller invalid-input coverage and direct delete-handler loud-failure coverage before implementing the runtime path.
- **Verification evidence:**
  - `npm test -- tests/api/abclassMutations.test.js tests/controllers/abclass-delete.test.js tests/api/apiHandler.test.js` passed.
  - `npm run lint` passed.
- **Follow-up implications for later sections:**
  - Section 5 docs must explicitly describe idempotent delete flags and JsonDbApp method usage (`dropCollection` + `deleteOne`).

---

## Section 5 — Documentation and contract updates

### Delivery status

- Current phase: Complete
- Section status: Complete
- Checklist:
  - [x] docs updated
  - [x] docs review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Objective

- Align backend developer docs with newly exposed classroom and ABClass mutation endpoints.
- Publish stable transport contracts so frontend integration work can proceed without ambiguity.

### Constraints

- Update only relevant backend docs.
- Keep contracts explicit and example-driven where helpful.
- Keep documentation aligned with implemented method names exactly (`getGoogleClassrooms`, `upsertABClass`, `updateABClass`, `deleteABClass`).
- Use British English and avoid documenting speculative behaviour not implemented in code.

### Documentation targets in this section

1. `docs/developer/backend/api-layer.md`
   - Add new endpoint entries and handler source locations.
   - Document transport usage expectations through `apiHandler`/`callApi`.
   - Capture request and response summaries for each new method.
2. `docs/developer/backend/DATA_SHAPES.md`
   - Add/extend classroom picker shape: `Array<{ classId, className }>`.
   - Add ABClass mutation payload shapes for `upsertABClass`, `updateABClass`, and `deleteABClass`.
   - Document delete result shape: `{ classId, fullClassDeleted, partialDeleted }` and idempotent semantics.
3. `ACTION_PLAN.md`
   - Keep section notes/acceptance criteria in sync with any implementation deviations discovered during delivery.

### Acceptance criteria

- `api-layer.md` lists all new methods and handler locations.
- `api-layer.md` captures per-method contract summaries (inputs, outputs, and error-envelope behaviour expectations).
- `DATA_SHAPES.md` includes classroom summary and ABClass mutation request/response payload contracts.
- `DATA_SHAPES.md` explicitly documents source-of-truth boundaries:
  - user-managed fields (`cohort`, `yearGroup`, `courseLength`, `active`)
  - Google-derived fields (`classOwner`, `teachers`, `students`)
  - assignment mutation out-of-scope note for upsert/update endpoints.
- Delete semantics (`dropCollection` + `deleteOne`) and idempotent response flags are documented.
- Docs do not claim test outcomes unless those commands were actually executed in the implementation PR.

### Required checks

1. Verify docs match implemented method names, payloads, and return flags exactly.
2. Verify examples and shapes match API handler contracts and controller behaviour.
3. Verify frontend integration notes reference transport usage via `callApi`.
4. Verify no stale references remain to deprecated/non-existent endpoints or old method names.

### Section checks

- `rg -n "getGoogleClassrooms|upsertABClass|updateABClass|deleteABClass" docs/developer/backend/api-layer.md docs/developer/backend/DATA_SHAPES.md`
- `rg -n "fullClassDeleted|partialDeleted|classId|className" docs/developer/backend/DATA_SHAPES.md`
- Manual doc review against implementation diff.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Keep documentation updates in the same PR as the corresponding runtime changes where possible.
  - Ensure contract examples are minimal and reflect production payloads only.
- **Deviations from plan:**
  - The shipped `getGoogleClassrooms` runtime only converts malformed returned rows into `INVALID_REQUEST`; upstream Classroom fetch failures currently log inside `ClassroomApiClient.fetchAllActiveClassrooms()` and return `[]`, so the docs now call out that nuance explicitly.
- **Follow-up implications for later sections:**
  - Regression checks must validate docs and code remain in lock-step after final refactors.
- **Verification evidence:**
  - Documentation review passed after aligning API-layer and data-shape docs to the implemented `src/backend/z_Api` transport surface.
  - `rg -n "getGoogleClassrooms|upsertABClass|updateABClass|deleteABClass" docs/developer/backend/api-layer.md docs/developer/backend/DATA_SHAPES.md` confirmed all four methods are documented.
  - `rg -n "fullClassDeleted|partialDeleted|classId|className" docs/developer/backend/DATA_SHAPES.md` confirmed the delete-flag and class summary terms are present.
- **Commit evidence:**
  - Branch: `feat/ReactFrontend`
  - Commit: `6479d40e1873a9c3017d0f063ad9cf99acd6a2a7`
  - Message: `docs: complete Section 5 backend contract updates`
  - Push: successful (`feat/ReactFrontend -> feat/ReactFrontend`)

---

## Section 6 — Regression and contract hardening

### Delivery status

- Current phase: Complete
- Section status: Complete
- Checklist:
  - [x] focused backend suites run
  - [x] lint passed
  - [x] docs checks passed
  - [x] review complete
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Objective

- Confirm endpoint wiring, controller behaviour, transport envelopes, and documented contracts remain stable after full implementation.

### Constraints

- Prefer focused suites first, then broader lint/test passes.
- Keep runtime coverage backend-first; run frontend/builder checks only when those areas are touched.
- Do not broaden regression scope beyond the new classroom/ABClass API surface unless failures indicate coupling.

### Acceptance criteria

- Targeted backend tests for new API constants/dispatch/handlers pass.
- Targeted backend controller/model tests for upsert/update/delete behaviour pass.
- Transport layer tests for request/response envelopes and error mapping pass.
- Backend lint passes.
- Documentation checks for new contract terms pass.
- Reported test/lint outcomes in PR notes match actual command outputs.

### Required test cases/checks

1. Run API constants/dispatch/handler suites:
   - `tests/backend/z_Api/apiConstants.test.js`
   - `tests/backend/z_Api/apiHandler.test.js`
   - `tests/backend/z_Api/googleClassrooms.test.js`
   - `tests/backend/z_Api/abclassMutations.test.js`
2. Run ABClass controller/model suites relevant to new behaviours:
   - `tests/controllers/abclass-upsert-update.test.js`
   - `tests/controllers/abclass-delete.test.js`
   - `tests/models/abclassManager.initialise.test.js`
3. Run backend lint.
4. Run documentation grep checks for contract terms (Section 5 checks).
5. Run frontend lint/tests only if frontend files are touched.
6. Run builder lint only if builder files are touched.

### Section checks

- `npm test -- tests/backend/z_Api/apiConstants.test.js`
- `npm test -- tests/backend/z_Api/apiHandler.test.js`
- `npm test -- tests/backend/z_Api/googleClassrooms.test.js`
- `npm test -- tests/backend/z_Api/abclassMutations.test.js`
- `npm test -- tests/controllers/abclass-upsert-update.test.js`
- `npm test -- tests/controllers/abclass-delete.test.js`
- `npm test -- tests/models/abclassManager.initialise.test.js`
- `npm run lint`
- `rg -n "getGoogleClassrooms|upsertABClass|updateABClass|deleteABClass|fullClassDeleted|partialDeleted" docs/developer/backend/api-layer.md docs/developer/backend/DATA_SHAPES.md`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Record exact failing tests and root causes before applying fixes.
  - Re-run only affected focused suites after each fix, then finish with full section checks.
- **Deviations from plan:**
  - The placeholder `tests/api/apiConstants.test.js` path does not exist in this repo; `tests/api/apiHandler.test.js` was used because it contains the `apiConstants` allowlist assertions for the real project layout.
- **Verification evidence:**
  - `npm test -- tests/api/apiHandler.test.js` passed and covered both the allowlist/constants assertions and the transport-envelope checks.
  - `npm test -- tests/api/googleClassrooms.test.js` passed.
  - `npm test -- tests/api/abclassMutations.test.js` passed.
  - `npm test -- tests/controllers/abclass-upsert-update.test.js` passed.
  - `npm test -- tests/controllers/abclass-delete.test.js` passed.
  - `npm test -- tests/models/abclassManager.initialise.test.js` passed.
  - `npm run lint` passed.
  - Documentation term checks passed for `getGoogleClassrooms`, `upsertABClass`, `updateABClass`, `deleteABClass`, `fullClassDeleted`, and `partialDeleted` in the backend docs.
- **Final review status:**
  - Final reviewer pass returned no findings across the completed runtime and documentation scope.
- **Post-regression docs sync:**
  - Final documentation sync required only source-level JSDoc updates in `src/backend/z_Api/abclassMutations.js` and `src/backend/y_controllers/ABClassController.js`; no additional markdown doc changes were needed after Section 5.

---

## Suggested implementation order

1. Section 1 — API contract and transport wiring
2. Section 2 — Google Classroom listing endpoint
3. Section 3 — ABClass upsert and update endpoints
4. Section 4 — ABClass delete endpoint
5. Section 5 — Documentation and contract updates
6. Section 6 — Regression and contract hardening
