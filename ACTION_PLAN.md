# Transport Layer De-Sloppification — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` — source of truth for all design decisions, contracts, and scope boundaries.
2. Read `SLOP_REVIEW.md` — the original findings that motivate this refactor.
3. Read `AGENTS.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md`.
4. Use this action plan to sequence delivery and testing only; do not restate or redefine material already
   settled in `SPEC.md`.

---

## Scope and assumptions

### Scope

- `src/backend/z_Api/apiConstants.js` — delete `API_METHODS` and `API_ALLOWLIST`.
- `src/backend/z_Api/z_apiHandler.js` — simplify dispatch; inline ten handler closures; remove
  `_invokeAllowlistedMethod`.
- `src/backend/z_Api/auth.js` — delete.
- `src/backend/z_Api/abclassPartials.js` — delete.
- `src/backend/z_Api/referenceData.js` — delete.
- `src/frontend/src/services/authService.ts` — add `z.boolean()` Zod validation.
- `src/frontend/src/services/authService.zod.ts` — new file with `AuthorisationStatusSchema`.
- `src/frontend/src/services/authService.spec.ts` — add Zod validation tests.
- `tests/api/apiHandler.test.js` — update registry tests; update handler stubs; add parameter extraction
  contract tests; remove `_invokeAllowlistedMethod` direct test; update VM context tests.
- `tests/api/apiHandlerLocking.test.js` — update stubs from handler globals to controller constructor mocks.
- `tests/api/apiHandlerTiming.test.js` — update stubs from handler globals to controller constructor mocks.
- `tests/api/staleAdmission.test.js` — update stubs; update all three `globalThis.getAuthorisationStatus`
  assertions (positive assertion at line ≈ 45, negative assertion at line ≈ 69, and positive assertion at
  line ≈ 181) to check `context.scriptAppManagerInstance.isAuthorised` instead.
- `tests/helpers/apiHandlerTestUtils.js` — update `setupApiHandlerTestContext` to mock controller
  constructors for inlined methods; retain `handler` option (redefines as the default `isAuthorised()`
  implementation); retain `additionalHandlers` for non-inlined globals only; add
  `installControllerMocks` / `restoreControllerMocks` helpers that return mock handles including
  `scriptAppManagerCtor` and `scriptAppManagerInstance`.
- `tests/backend-api/abclassPartials.unit.test.js` — delete.
- `tests/backend-api/referenceData.unit.test.js` — delete.
- `tests/api/auth.test.js` — delete (three tests: two controller-delegation tests migrated to
  `apiHandler.test.js`; vm-context file test dropped with the deleted file).
- `tests/api/abclassPartials.test.js` — delete (tests `API_METHODS`, `API_ALLOWLIST`, and
  `globalThis.getABClassPartials`, all removed); routing and error-envelope coverage migrated to
  `apiHandler.test.js` using `ABClassController` constructor mock before deletion.
- `docs/developer/backend/api-layer.md` — update dispatch instructions and endpoint source notes.
- `src/backend/AGENTS.md` — update migration pattern signpost.
- `src/frontend/AGENTS.md` — update § 4.1 method-name alignment guidance to reference
  `ALLOWLISTED_METHOD_HANDLERS` instead of the deleted `API_METHODS`.

### Out of scope

- `googleClassrooms.js`, `abclassMutations.js`, `assignmentDefinitionPartials.js`, `apiConfig.js`.
- `apiService.ts` and all frontend services other than `authService.ts`.
- Any new API endpoint, feature, or behavioural change.
- Any data migration or persistence change.
- Making `apiHandler` the sole callable path for the methods still in separate files — that is explicitly
  deferred.

### Assumptions

1. `ScriptAppManager` is already available as a global in the test harness (`tests/setupGlobals.js`).
   `ABClassController` and `ReferenceDataController` are **not** registered in `setupGlobals.js`; they
   will be installed and restored per-test by `installControllerMocks` / `restoreControllerMocks` in
   `tests/helpers/apiHandlerTestUtils.js`. No changes to `setupGlobals.js` are required for these two
   constructors.
2. The transport envelope shape and admission-control behaviour are unchanged throughout.
3. All test runs use the commands defined in the validation command hierarchy below.

---

## LOC baseline

These are the current measured line counts for every file this plan intends to touch. The measurable
pass-gate for the whole refactor is a **net reduction of ≥ 200 lines** across all files in this table at
the point the documentation and rollout section is complete.

| File                                             | Baseline LOC | Expected LOC after | Expected Δ | Reason                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------ | ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/z_Api/auth.js`                      | 13           | 0 (deleted)        | −13        | Inlined into apiHandler; top-level global removed                                                                                                                                                                               |
| `src/backend/z_Api/abclassPartials.js`           | 16           | 0 (deleted)        | −16        | Inlined into apiHandler; top-level global removed                                                                                                                                                                               |
| `src/backend/z_Api/referenceData.js`             | 107          | 0 (deleted)        | −107       | Inlined into apiHandler; top-level globals removed                                                                                                                                                                              |
| `src/backend/z_Api/apiConstants.js`              | 69           | ≈ 29               | ≈ −40      | Delete `API_METHODS` (18+2 lines) + `API_ALLOWLIST` (18+2 lines) blocks and their exports                                                                                                                                       |
| `src/backend/z_Api/z_apiHandler.js`              | 432          | ≈ 415              | ≈ −17      | Remove `apiAllowlist` var and init (3 lines), remove `_invokeAllowlistedMethod` (15 lines), simplify dispatch call (1 line); handler closures stay as single-expression entries                                                 |
| `src/frontend/src/services/authService.ts`       | 12           | ≈ 14               | +2         | Add import of `AuthorisationStatusSchema` and wrap `callApi` return                                                                                                                                                             |
| `src/frontend/src/services/authService.zod.ts`   | 0 (new)      | ≈ 5                | +5         | New schema file: 3 content lines + schema + type export                                                                                                                                                                         |
| `src/frontend/src/services/authService.spec.ts`  | 23           | ≈ 33               | +10        | Add two Zod rejection tests                                                                                                                                                                                                     |
| `tests/backend-api/abclassPartials.unit.test.js` | 53           | 0 (deleted)        | −53        | Wrapper no longer exists; tests were asserting indirection only                                                                                                                                                                 |
| `tests/backend-api/referenceData.unit.test.js`   | 114          | 0 (deleted)        | −114       | Wrapper no longer exists; tests were asserting indirection only                                                                                                                                                                 |
| `tests/api/auth.test.js`                         | 67           | 0 (deleted)        | −67        | Tests the now-deleted `auth.js`; two controller-delegation tests migrated to `apiHandler.test.js`; vm-context file test dropped with the deleted file                                                                           |
| `tests/api/abclassPartials.test.js`              | 119          | 0 (deleted)        | −119       | Tests `API_METHODS`, `API_ALLOWLIST`, and `globalThis.getABClassPartials`, all removed; routing/envelope coverage migrated to `apiHandler.test.js`                                                                              |
| `tests/api/apiHandler.test.js`                   | 1,491        | ≈ 1,430            | ≈ −61      | Remove `API_METHODS`/`API_ALLOWLIST` tests (≈70 lines); remove `_invokeAllowlistedMethod` test (8 lines); add parameter-extraction contract tests and `ScriptAppManager`/controller coverage (≈16 lines net after stub updates) |
| `tests/api/apiHandlerLocking.test.js`            | 194          | ≈ 194              | ≈ 0        | Stub type changes from handler globals to constructor mocks; line count roughly stable                                                                                                                                          |
| `tests/api/apiHandlerTiming.test.js`             | 216          | ≈ 216              | ≈ 0        | Stub type changes; line count roughly stable                                                                                                                                                                                    |
| `tests/api/staleAdmission.test.js`               | 183          | ≈ 183              | ≈ 0        | Update `getAuthorisationStatus` assertion to check constructor; line count roughly stable                                                                                                                                       |
| `tests/helpers/apiHandlerTestUtils.js`           | 220          | ≈ 255              | ≈ +35      | Add `installControllerMocks`/`restoreControllerMocks`; update `setupApiHandlerTestContext`                                                                                                                                      |
| `docs/developer/backend/api-layer.md`            | 205          | ≈ 192              | ≈ −13      | Update dispatch section + endpoint source notes for three deleted files                                                                                                                                                         |
| `src/backend/AGENTS.md`                          | 162          | ≈ 161              | ≈ −1       | Update migration pattern signpost                                                                                                                                                                                               |
| **Total (affected files)**                       | **3,696**    | **≈ 3,128**        | **≈ −568** | Well above the ≥ 200 line pass-gate                                                                                                                                                                                             |

> Every existing-file baseline LOC figure in this table is an exact current `wc -l` measurement; new-file
> rows use a baseline of `0` by definition. Expected post-change LOC and Δ figures remain estimates where
> marked with `≈`.

---

## Global constraints and quality gates

### Engineering constraints

- Transport envelope shape must be identical before and after; no functional change is permitted.
- Fail fast on invalid inputs; do not add defensive guards that mask wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- The guarded `if (typeof module !== 'undefined' && module.exports)` export block is the only permitted
  Node-testing shim in backend production files.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase:

1. List required documentation file paths under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit file paths.
3. Verify every mandatory file is listed before accepting the handoff.
4. If any mandatory file is missing, return the work to the same sub-agent and block progression.

### Validation command hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Backend tests (apiHandler suite): `npm test -- tests/api/apiHandler.test.js`
- Backend tests (all api/ suites): `npm test -- tests/api/`
- Backend tests (backend-api suite): `npm test -- tests/backend-api/`
- Frontend unit tests (authService): `npm run frontend:test -- src/frontend/src/services/authService.spec.ts`
- Full backend test run: `npm test`
- Full frontend test run: `npm run frontend:test`

---

## Section 1 — Registry consolidation

### Objective

Remove `API_METHODS` and `API_ALLOWLIST` from `apiConstants.js`. Simplify the dispatch path in
`z_apiHandler.js` so that `handle()` looks up `methodName` directly in `ALLOWLISTED_METHOD_HANDLERS`
and calls the result, eliminating the two-step lookup and `_invokeAllowlistedMethod`.

This section does **not** yet change handler closures or delete wrapper files. It proves the simplified
dispatch path is correct before the closures change.

### Constraints

- The transport envelope shape is unchanged.
- All existing dispatcher tests that are not about `API_METHODS`, `API_ALLOWLIST`, or
  `_invokeAllowlistedMethod` must remain green.
- Handler globals (`globalThis.getAuthorisationStatus`, `globalThis.getCohorts`, etc.) are still in place
  at this stage; the test harness does not change in this section.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `tests/api/apiHandler.test.js`

### Shared helper plan

No new shared helpers are expected in this section.

### Acceptance criteria

- `API_METHODS` is not present in `apiConstants.js` or its `module.exports`.
- `API_ALLOWLIST` is not present in `apiConstants.js` or its `module.exports`.
- `ALLOWLISTED_METHOD_HANDLERS` object in `z_apiHandler.js` is unchanged.
- `handle()` performs a single lookup: `const handler = ALLOWLISTED_METHOD_HANDLERS[methodName]`.
- `_invokeAllowlistedMethod` no longer exists in `z_apiHandler.js`.
- The `apiAllowlist` module-level variable and both its initialisation lines (Node require block and GAS
  branch) are removed.
- All existing dispatcher lifecycle tests pass (admission, completion, rate limiting, error mapping,
  request ID, success/failure envelopes).
- Tests that previously asserted `API_METHODS` or `API_ALLOWLIST` presence are removed or replaced with
  tests that assert the relevant methods are keys in `ALLOWLISTED_METHOD_HANDLERS`.
- The direct `_invokeAllowlistedMethod` test (line ≈ 1179 in the baseline file) is removed.
- The VM context test that passes `API_ALLOWLIST` as a vm global is updated to work without it.

### Required test cases (Red first)

API layer tests (update/replace in `tests/api/apiHandler.test.js`):

1. **Remove**: test asserting `API_METHODS.getAuthorisationStatus === 'getAuthorisationStatus'`.
2. **Remove**: all tests asserting that `API_METHODS` contains specific method groups
   (`REFERENCE_DATA_API_METHOD_NAMES`, `ABCLASS_TRANSPORT_API_METHOD_ENTRIES`,
   `BACKEND_CONFIG_API_METHOD_ENTRIES`, `ASSIGNMENT_DEFINITION_API_METHOD_ENTRIES`).
3. **Remove**: all tests asserting `API_ALLOWLIST` contains specific method groups (same groups).
4. **Replace** with: a single test that `ALLOWLISTED_METHOD_HANDLERS` (loaded via `loadApiHandlerModule`)
   contains all 18 expected method names as own keys.
5. **Remove**: test `'throws when an unrecognised handler name is passed to _invokeAllowlistedMethod'`.
6. **Update**: VM context test `'operates correctly via BaseSingleton in a GAS-like VM context'` — remove
   `API_ALLOWLIST` from its `makeVmGlobals` override; `getAuthorisationStatus` remains a top-level vm
   global at this stage because the closure still delegates to it; the vm context now relies only on
   `ALLOWLISTED_METHOD_HANDLERS` for routing.
7. **Update**: VM context test `'uses global API_ALLOWLIST in vm context and returns INTERNAL_ERROR...'`
   — this test is no longer meaningful after registry consolidation; replace with a test verifying that a
   method present in `ALLOWLISTED_METHOD_HANDLERS` but whose handler throws returns `INTERNAL_ERROR`. In
   the replacement test, `makeVmGlobals` must provide a top-level `getAuthorisationStatus` global that
   throws rather than a `ScriptAppManager` mock; `API_ALLOWLIST` must not be provided. (Note: providing a
   top-level `getAuthorisationStatus` global is still correct at this stage because Section 1 does not
   inline the closure — the handler still delegates to the global; the restriction on top-level vm globals
   is enforced in Section 2 after inlining.) The constraint that `getAuthorisationStatus` must not appear
   as a top-level vm global is enforced in Section 2 after inlining.

### Section checks

- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm run lint` — no backend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note to `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` confirming it is the single
  authoritative registry and that all frontend-callable methods must be added here only.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record actual changes when done.
- **Deviations from plan:** note any departures.
- **Follow-up implications for Section 2:** record effects.

---

## Section 2 — Wrapper file elimination and handler inlining

### Objective

Delete `auth.js`, `abclassPartials.js`, and `referenceData.js`. Inline their controller calls as
single-expression closures in `ALLOWLISTED_METHOD_HANDLERS`. Update `apiHandlerTestUtils.js` to mock
controller constructors instead of global handler functions for the affected methods. Delete the
now-obsolete wrapper unit tests. Update `apiHandler.test.js` to use controller mocks and add parameter
extraction contract tests.

### Constraints

- Parameter extraction shapes must exactly match the contracts documented in `SPEC.md` § "Parameter
  extraction contract for inlined reference-data closures".
- Each controller is instantiated fresh per call (same behaviour as the old wrapper files).
- No top-level GAS `function` declarations for `getAuthorisationStatus`, `getABClassPartials`,
  `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`, `getYearGroups`, `createYearGroup`,
  `updateYearGroup`, `deleteYearGroup` may exist anywhere after this section.
- `getAuthorisationStatus` must not appear as a top-level vm global in any vm sandbox test after this
  section; any vm context test that dispatches `getAuthorisationStatus` must do so through the inlined
  closure using a `ScriptAppManager` mock.
- All tests that were not about these now-deleted wrapper files must remain green.
- `apiHandlerTestUtils.js` is a test helper; it follows the backend test conventions (`docs/developer/backend/backend-testing.md`).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `tests/backend-api/abclassPartials.unit.test.js`
- `tests/backend-api/referenceData.unit.test.js`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/auth.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/referenceData.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/auth.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/referenceData.js`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

### Shared helper plan

Helper decision entries:

1. Helper: `setupApiHandlerTestContext` controller mock pattern
   - Decision: `extend`
   - Owning module/path: `tests/helpers/apiHandlerTestUtils.js`
   - Call-site rationale: the existing helper installs handler function globals; after inlining, tests for
     affected methods require controller constructor globals instead. Adding an `installControllerMocks`
     sub-helper alongside the existing `installApiMethodHandlers` keeps the extension localised.
   - Relevant canonical doc target: `docs/developer/backend/backend-testing.md` (if it documents test
     helper patterns) — check before adding.
   - Planned doc status: Not implemented

### Acceptance criteria

- `src/backend/z_Api/auth.js` does not exist.
- `src/backend/z_Api/abclassPartials.js` does not exist.
- `src/backend/z_Api/referenceData.js` does not exist.
- `tests/backend-api/abclassPartials.unit.test.js` does not exist.
- `tests/backend-api/referenceData.unit.test.js` does not exist.
- `tests/api/auth.test.js` does not exist.
- `tests/api/abclassPartials.test.js` does not exist.
- `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` contains inline closures for all ten affected methods
  using the exact controller call patterns from `SPEC.md`.
- The dispatcher routes `getAuthorisationStatus` to `new ScriptAppManager().isAuthorised()`.
- The dispatcher routes `getABClassPartials` to `new ABClassController().getAllClassPartials()`.
- The dispatcher routes `getCohorts` to `new ReferenceDataController().listCohorts()` (no args).
- `createCohort` extracts `parameters.record` and passes it to `ReferenceDataController.createCohort`.
- `updateCohort` passes the full `parameters` object to `ReferenceDataController.updateCohort`.
- `deleteCohort` extracts `parameters.key` and passes it to `ReferenceDataController.deleteCohort`.
- Same extraction patterns hold for the four year-group methods.
- `apiHandler.test.js` tests for `getAuthorisationStatus`, `getABClassPartials`, and all reference-data
  methods use controller constructor mocks, not `globalThis[methodName]` mocks.
- `apiHandlerLocking.test.js`, `apiHandlerTiming.test.js`, and `staleAdmission.test.js` all pass with the
  updated constructor-mock context (no `globalThis.getAuthorisationStatus` stubs remain).
- `staleAdmission.test.js` all three `globalThis.getAuthorisationStatus` assertions (positive at line ≈ 45,
  negative at line ≈ 69, and positive at line ≈ 181) are migrated to check
  `context.scriptAppManagerInstance.isAuthorised` using the handle returned by `installControllerMocks`.
- Error propagation tests for reference-data handlers (e.g. controller throwing) are present in
  `apiHandler.test.js`.

### Required test cases (Red first)

Test file deletions:

1. **Delete** `tests/backend-api/abclassPartials.unit.test.js`.
2. **Delete** `tests/backend-api/referenceData.unit.test.js`.
3. **Delete** `tests/api/auth.test.js` — this file contains three tests:
   - The two controller-delegation tests (`creates ScriptAppManager and returns true when authorised`
     and `creates ScriptAppManager and returns false when not authorised`) must be migrated as new tests
     in `tests/api/apiHandler.test.js` asserting that the dispatcher's `getAuthorisationStatus` closure
     calls the mocked `ScriptAppManager` constructor and returns the expected boolean.
   - The third test (`works when module exports are unavailable in the runtime context`) tests vm-context
     loading of the deleted `auth.js` file and is dropped with the file; it must not be migrated.
4. **Delete** `tests/api/abclassPartials.test.js` — verify that routing and error-envelope coverage
   for `getABClassPartials` (dispatch to `ABClassController` mock, success envelope, error maps to
   failure envelope) has been added to `tests/api/apiHandler.test.js` before deleting. If this coverage
   does not already exist in `apiHandler.test.js`, add it first. The task is to add new routing/envelope
   coverage in `apiHandler.test.js`; do not attempt to update the existing stubs in the deleted file.

API layer tests (update/add in `tests/api/apiHandler.test.js`):

1. **Update**: routing tests for `getAuthorisationStatus` — mock `globalThis.ScriptAppManager` constructor
   to return `{ isAuthorised: vi.fn(() => true) }`; assert constructor called and result returned.
2. **Update**: routing tests for `getABClassPartials` — mock `globalThis.ABClassController` constructor
   to return `{ getAllClassPartials: vi.fn(() => [...]) }`; assert constructor called and result returned.
3. **Update**: routing tests for all eight reference-data methods — mock `globalThis.ReferenceDataController`
   constructor to return an object with all eight controller methods as vi.fn() stubs; assert constructor
   called once per dispatch and correct method called with correct args. Note that two transport names do
   not map directly to controller method names: the transport method `getCohorts` calls
   `ReferenceDataController.listCohorts`, and `getYearGroups` calls `ReferenceDataController.listYearGroups`;
   all other reference-data transport names map directly to the identically-named controller method.
4. **New — parameter extraction contract tests**:
   - `createCohort` with `params = { record: { name: 'X' } }` — assert controller's `createCohort` is
     called with `{ name: 'X' }` (not the full `parameters` object).
   - `deleteCohort` with `params = { key: 'coh-001' }` — assert controller's `deleteCohort` is called
     with `'coh-001'` (string, not the wrapper object).
   - `updateCohort` with `params = { key: 'coh-001', record: { ... } }` — assert controller's
     `updateCohort` is called with the full `params` object.
   - Same three shapes for year-group variants.
5. **Update**: error-mapping tests that iterate over `INVALID_REQUEST_FAILURE_CASES` and currently mock
   `globalThis[handlerName].mockImplementation(...)` — update only the reference-data cases to throw from
   the controller stub. Specifically, when `handlerName` corresponds to a `ReferenceDataController` method
   (e.g. `createCohort`), the override becomes
   `context.referenceDataControllerInstance.createCohort.mockImplementation(() => { throw ... })` (and
   likewise for the other reference-data methods in the loop). The `upsertABClass` and `updateABClass`
   cases in the same loop are **not** inlined in this refactor — those handler globals remain on `globalThis`
   and their `mockImplementation` overrides stay as global stubs; do not migrate them to controller mocks.
6. **Update**: `IN_USE` error tests for `deleteCohort` / `deleteYearGroup` — update stubs to throw from
   `context.referenceDataControllerInstance[handlerName]`, not a global function.
7. **Update**: the basic success-envelope test (line ≈ 480, `data: { authorised: true }`) — once the auth
   dispatch closure returns the boolean from `ScriptAppManager.isAuthorised()`, update the expectation to
   `data: true`.
8. **Audit — `getAuthorisationStatus`**: before the section is considered complete, run a grep/search for
   `getAuthorisationStatus` in `tests/api/apiHandler.test.js`. Every hit that is a direct
   `globalThis.getAuthorisationStatus` assignment, stub override, or `mockImplementation` call must be
   migrated to the `ScriptAppManager` constructor mock pattern before this section is complete. The review
   found many such occurrences spread across the suite; every instance must be updated.
9. **Audit — inlined reference-data and class-partials globals**: run a second grep/search for the direct
   global stubs that correspond to the other inlined methods:
   ```
   grep -n 'updateYearGroup\|deleteCohort\|getABClassPartials\|globalThis\.getCohorts\|globalThis\.createCohort\|globalThis\.updateCohort\|globalThis\.getYearGroups\|globalThis\.createYearGroup\|globalThis\.deleteYearGroup' tests/api/apiHandler.test.js
   ```
   Every hit that is a direct `globalThis` assignment, stub override, or `mockImplementation` call for any
   of these names must be migrated to the appropriate controller mock (`referenceDataControllerInstance` or
   `abClassControllerInstance`) before this section is considered complete. Stubs for
   `updateYearGroup`, `deleteCohort`, and `getABClassPartials` are particularly easy to miss because they
   may appear outside the main failure-cases loop.

VM-context migration (`tests/api/apiHandler.test.js`):

1. **Update** `makeVmGlobals`: ensure `getAuthorisationStatus` is not provided as a top-level vm global
   after inlining; the `getAuthorisationStatus` closure in `ALLOWLISTED_METHOD_HANDLERS` dispatches via
   `new ScriptAppManager().isAuthorised()` — `ScriptAppManager` must be present in the sandbox instead.
2. **Add** `ScriptAppManager` to the base `makeVmGlobals` object (or via an override) so that any vm
   context test that dispatches `getAuthorisationStatus` works through the inlined closure.
3. **Update** the INTERNAL_ERROR replacement vm test (introduced in Section 1): if it dispatches
   `getAuthorisationStatus`, provide a `ScriptAppManager` mock whose `isAuthorised` throws rather than
   a top-level `getAuthorisationStatus` global.

Test helper updates (`tests/helpers/apiHandlerTestUtils.js`):

1. Add `installControllerMocks(vi, { scriptAppManagerBehaviour, abClassControllerBehaviour, referenceDataControllerBehaviour })` helper that installs constructor stubs for the three controllers and returns both the originals and all mock handles:
   ```
   {
     originals,
     scriptAppManagerCtor,
     scriptAppManagerInstance,
     abClassControllerCtor,
     abClassControllerInstance,
     referenceDataControllerCtor,
     referenceDataControllerInstance,
   }
   ```
   `scriptAppManagerInstance` is the mock object returned by `new ScriptAppManager()`, enabling callers to override `isAuthorised.mockImplementation(...)` per test. `abClassControllerInstance` is the mock object returned by `new ABClassController()`, enabling callers to override `getAllClassPartials.mockImplementation(...)`. `referenceDataControllerInstance` is the mock object returned by `new ReferenceDataController()`, enabling callers to override any of its eight method stubs per test.
2. Add `restoreControllerMocks(originals)` counterpart.
3. Update `setupApiHandlerTestContext`: retain the existing `handler` option, redefining it as the default
   implementation used by the mocked `ScriptAppManager().isAuthorised()` path — the installed
   `ScriptAppManager` constructor mock's `isAuthorised()` method delegates to `handler()`, defaulting to
   `() => true`. Retain `additionalHandlers` for non-inlined globals only (`googleClassrooms`,
   `abclassMutations`, `assignmentDefinitionPartials`). Note: `getBackendConfig` and `setBackendConfig`
   are **not** installed via `additionalHandlers` or as `globalThis` function globals; they are wired
   through module-level variables (`getBackendConfigHandler` / `setBackendConfigHandler`) in
   `z_apiHandler.js` via the guarded Node require block and require no change in the test helper.
   Remove `buildReferenceDataHandlers()` from `buildApiHandlerTestHandlers()` in `apiHandler.test.js`
   — reference-data methods are now dispatched through `ReferenceDataController` constructor mocks and
   must not be stubbed as global handler functions. Keep only the remaining non-inlined handler globals
   there (`buildAbClassTransportHandlers()` and `buildAssignmentDefinitionHandlers()`).
   Additionally, any direct `globalThis.getABClassPartials` stub in `apiHandler.test.js` must be migrated
   to an `ABClassController` constructor mock via `installControllerMocks`; this is part of the Section 2
   handler-inlining work and must be complete before the section is considered done.
   Replace the `globalThis.getAuthorisationStatus` installation in `installApiMethodHandlers` with an
   `installControllerMocks` call covering the inlined methods.
   All handles returned by `installControllerMocks` (i.e. `scriptAppManagerCtor`,
   `scriptAppManagerInstance`, `abClassControllerCtor`, `abClassControllerInstance`,
   `referenceDataControllerCtor`, `referenceDataControllerInstance`) must be **merged onto the context
   object** returned by `setupApiHandlerTestContext`, so that individual tests can access them as
   `context.scriptAppManagerInstance`, `context.abClassControllerInstance`, and
   `context.referenceDataControllerInstance` without separately calling `installControllerMocks`.
4. Update `teardownApiHandlerTestContext` to call `restoreControllerMocks`.

Dependent suite updates:

1. **`tests/api/apiHandlerLocking.test.js`** — **audit the entire file** for every direct
   `globalThis.getAuthorisationStatus` stub, assignment, or assertion — not just the instance near
   line 39. Run `grep -n 'getAuthorisationStatus' tests/api/apiHandlerLocking.test.js` before
   starting migration and treat every hit as in scope. Remove all such stubs; the default
   `ScriptAppManager` constructor mock installed by `setupApiHandlerTestContext` handles the auth path.
   Where a test requires specific auth behaviour (e.g. for call-order tracking), override
   `context.scriptAppManagerInstance.isAuthorised.mockImplementation(...)` using the handle returned by
   `installControllerMocks`. Update all call-order assertions that reference `getAuthorisationStatus`
   to reference the `ScriptAppManager` instance method instead.
2. **`tests/api/apiHandlerTiming.test.js`** — the suite contains two error-path tests that override
   `globalThis.getAuthorisationStatus` with a throwing stub (lines ≈ 151–153 and ≈ 170–172). These must
   be migrated to override `context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => { throw thrownError; })` using the handle returned by `installControllerMocks`. Verify that
   `callAuthorisationStatus(dispatcher)` continues to work through the updated default context for all
   non-error-path timing tests.
3. **`tests/api/staleAdmission.test.js`** — update all three assertions to use
   `context.scriptAppManagerInstance.isAuthorised` (the instance method spy on the mock object returned
   by `new ScriptAppManager()`, available via the handle returned by `installControllerMocks`):
   - Positive assertion (line ≈ 45): change `expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1)`
     to `expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1)`.
   - Negative assertion (line ≈ 69): change `expect(globalThis.getAuthorisationStatus).not.toHaveBeenCalled()`
     to `expect(context.scriptAppManagerInstance.isAuthorised).not.toHaveBeenCalled()`.
   - Positive assertion (line ≈ 181): change `expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1)`
     to `expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1)`.

### Section checks

- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm test -- tests/api/apiHandlerLocking.test.js` — all tests green.
- `npm test -- tests/api/apiHandlerTiming.test.js` — all tests green.
- `npm test -- tests/api/staleAdmission.test.js` — all tests green.
- `npm test -- tests/backend-api/` — no test files exist for deleted wrappers; suite passes (empty or
  with other test files unchanged).
- `npm run lint` — no backend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entry in `docs/developer/backend/backend-testing.md` (if applicable) has status
  `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `ALLOWLISTED_METHOD_HANDLERS` noting that closures are intentionally non-global so
  that only `apiHandler` is callable via `google.script.run`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record actual changes when done.
- **Deviations from plan:** note any departures.
- **Follow-up implications for Section 3:** record effects.

---

## Section 3 — `authService.ts` Zod validation

### Objective

Add `z.boolean()` Zod response validation to `authService.ts` so the service owns the transport contract
as required by `src/frontend/AGENTS.md` § 4.1 and § 8. Create the adjacent schema file per the § 8 policy.

### Constraints

- `src/frontend/AGENTS.md` § 8 requires validation schemas in a dedicated adjacent schema file (`*.zod.ts`);
  inline schemas in the service file are not permitted.
- Create `src/frontend/src/services/authService.zod.ts` to hold `AuthorisationStatusSchema`.
- The service function signature and return type (`Promise<boolean>`) are unchanged.
- The `callApi` call is unchanged; only the return value is wrapped in `AuthorisationStatusSchema.parse(…)`.
- `apiService.ts` must not be changed.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/classPartials.zod.ts`
- `src/frontend/src/services/referenceDataService.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/classPartials.zod.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`

### Shared helper plan

No new shared helpers are expected in this section.

### Acceptance criteria

- `src/frontend/src/services/authService.zod.ts` exists and exports `AuthorisationStatusSchema` (a
  `z.boolean()` schema) and `AuthorisationStatus` (the inferred type).
- `authService.ts` imports `AuthorisationStatusSchema` from `./authService.zod`.
- `getAuthorisationStatus()` returns
  `AuthorisationStatusSchema.parse(await callApi<boolean>(GET_AUTHORISATION_STATUS_METHOD))`.
- `authService.spec.ts` includes tests asserting that a non-boolean backend response causes a Zod parse
  error to be thrown (see required test cases below).
- The existing test asserting that `callApi` is called with `'getAuthorisationStatus'` and the boolean
  result is returned continues to pass.
- No changes to `apiService.ts`, `sharedQueries.ts`, or any consumer of `getAuthorisationStatus`.
- `src/frontend/AGENTS.md` § 8 policy is met (schema in adjacent file, type inferred from schema).

### Required test cases (Red first)

Frontend service tests (`src/frontend/src/services/authService.spec.ts`):

1. **Red**: `callApiMock.mockResolvedValueOnce('yes')` → `getAuthorisationStatus()` rejects (Zod
   parse failure for non-boolean).
2. **Red**: `callApiMock.mockResolvedValueOnce(null)` → `getAuthorisationStatus()` rejects (Zod
   parse failure for null).
3. Confirm existing green test `callApi called with 'getAuthorisationStatus' and returns true` still passes.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/authService.spec.ts` — all tests green.
- `npm run frontend:lint` — no frontend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None needed; the change is small and self-evident from the schema constant.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record actual changes when done.
- **Deviations from plan:** note any departures.
- **Follow-up implications for regression section:** record effects.

---

## Regression and contract hardening

### Objective

Verify that the entire affected surface passes all lint and test checks after all three sections are
complete, and confirm the LOC-reduction target is met.

### Constraints

- Prefer focused test runs before the broad run.
- Do not introduce any new test skips or disabled lint rules.

### Delegation mandatory reads

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

### Acceptance criteria

- `npm run lint` passes with no errors.
- `npm run frontend:lint` passes with no errors.
- `npm test` passes with no failures or skips.
- `npm run frontend:test` passes with no failures or skips.
- Files deleted: `auth.js`, `abclassPartials.js`, `referenceData.js`,
  `tests/backend-api/abclassPartials.unit.test.js`, `tests/backend-api/referenceData.unit.test.js`,
  `tests/api/auth.test.js`, `tests/api/abclassPartials.test.js`.
- No `API_METHODS` or `API_ALLOWLIST` symbols remain in any production or test file.
- No `_invokeAllowlistedMethod` reference remains in any production or test file.
- No `globalThis.getAuthorisationStatus` mock or stub remains in any test file.
- `apiService.ts` is byte-for-byte unchanged from the baseline.
- Net LOC reduction across all files in the baseline table is **≥ 200 lines**.

### Required test cases / checks

1. `npm test -- tests/api/apiHandler.test.js` — green.
2. `npm test -- tests/api/apiHandlerLocking.test.js` — green.
3. `npm test -- tests/api/apiHandlerTiming.test.js` — green.
4. `npm test -- tests/api/staleAdmission.test.js` — green.
5. `npm test -- tests/backend-api/` — passes (no deleted-file references remain).
6. `npm run frontend:test -- src/frontend/src/services/authService.spec.ts` — green.
7. `npm run lint` — green.
8. `npm run frontend:lint` — green.
9. `npm test` (full backend) — green.
10. `npm run frontend:test` (full frontend) — green.
11. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise regression findings when done.
- **Deviations from plan:** note any additional work discovered.

---

## Documentation and rollout notes

### Objective

Update `docs/developer/backend/api-layer.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md` to
reflect the single-registry architecture. Verify LOC counts against the baseline table.

### Constraints

- Only modify documentation relevant to the touched areas.
- Do not add speculative documentation about future endpoints or patterns.

### Delegation mandatory reads

Docs mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/api-layer.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`

### Acceptance criteria

- `docs/developer/backend/api-layer.md` "Dispatch and allowlist pattern" section describes the
  single-registry approach: one entry in `ALLOWLISTED_METHOD_HANDLERS`, no `API_METHODS` or `API_ALLOWLIST`.
- All references to `API_METHODS` and `API_ALLOWLIST` are removed from `api-layer.md`.
- The endpoint-specific sections for `getAuthorisationStatus`, `getABClassPartials`, and all
  reference-data methods in `api-layer.md` are updated so that the `Source:` field references
  `z_apiHandler.js` (or "inline in `z_apiHandler.js`") rather than the deleted files.
- `src/backend/AGENTS.md` § 0.1 no longer references `API_ALLOWLIST` in the migration pattern.
- `src/frontend/AGENTS.md` § 4.1 method-name alignment instruction references `ALLOWLISTED_METHOD_HANDLERS`
  in `z_apiHandler.js` rather than the deleted `API_METHODS`.
- The step list for adding a new transport method in `api-layer.md` reads as a single step (add to
  `ALLOWLISTED_METHOD_HANDLERS`) rather than three steps.
- A repo-wide search confirms no remaining `API_METHODS` or `API_ALLOWLIST` references in any production
  or documentation file.
- `wc -l` on all surviving and new files in the LOC baseline table, with deleted rows counted as final LOC `0`, confirms net reduction ≥ 200 lines.

### Required checks

1. Read `docs/developer/backend/api-layer.md` and confirm no `API_METHODS`/`API_ALLOWLIST` references
   remain. Note that `api-layer.md` currently contains at least three non-dispatch references that must also
   be updated:
   - **Configuration transport sentence** (line ≈ 30): `"…with allowlisted method names registered in
src/backend/z_Api/apiConstants.js and implemented in src/backend/z_Api/apiConfig.js."` — this
     sentence is inaccurate after the refactor because `API_METHODS` and `API_ALLOWLIST` are removed from
     `apiConstants.js`; update it to state that the method name is registered in
     `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`.
   - **Request contract bullet** (line ≈ 51): `"method (string, required): allowlisted method name from
API_METHODS"` — update to reference `ALLOWLISTED_METHOD_HANDLERS`.
   - **Frontend usage pattern sentence** (line ≈ 113): `"Use the allowlisted method names exactly as
  implemented in API_METHODS"` — update to reference `ALLOWLISTED_METHOD_HANDLERS`.
     Run a full-text search across the file to catch any additional occurrences beyond these three.
2. Read `src/backend/AGENTS.md` and confirm `0.1` section is updated.
3. Read `src/frontend/AGENTS.md` and confirm § 4.1 no longer references `API_METHODS`.
4. Run `wc -l` on all surviving and new baseline-table files, treat deleted rows as final LOC `0`, and compare the final total against the baseline table.
5. Verify mandatory-read evidence (`Files read`) is complete for delegated docs handoffs.
6. Reconcile the planned helper entry for `installControllerMocks` in
   `docs/developer/backend/backend-testing.md` (if it was recorded as `Not implemented`): update status
   to reflect actual implementation.

### Optional `@remarks` JSDoc review

- Confirm `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` now carries the `@remarks` note planned in
  Sections 1 and 2 about it being the sole callable registry.
- Confirm no other `@remarks` are needed for changed areas.

### Implementation notes / deviations / follow-up

- Record final LOC counts here once verified.

---

## Suggested implementation order

1. Section 1 — Registry consolidation (`apiConstants.js` + `z_apiHandler.js` dispatch simplification).
2. Section 2 — Wrapper file elimination and handler inlining (depends on Section 1's simplified dispatch).
3. Section 3 — `authService.ts` Zod validation (independent; may be done in parallel with 1 or 2).
4. Regression and contract hardening.
5. Documentation and rollout notes.
