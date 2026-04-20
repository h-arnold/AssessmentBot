# Transport Layer De-Sloppification Specification

## Status

Draft v1.1 — addresses findings from `SLOP_REVIEW.md`; revised after Planner Reviewer pass.

## Purpose

This specification defines the intended refactoring of the `src/backend/z_Api` transport layer and the
`src/frontend/src/services/authService.ts` frontend service wrapper to resolve confirmed slop identified in
`SLOP_REVIEW.md`.

The refactor will:

- Eliminate three trivial pass-through wrapper files (`auth.js`, `abclassPartials.js`, `referenceData.js`)
  that unnecessarily expose top-level GAS callable globals, making `apiHandler` the sole callable entry
  point for those specific methods.
- Collapse the triplicate transport method registry into a single authoritative source.
- Bring `authService.ts` into compliance with the frontend service validation policy.
- Achieve a measurable net reduction in lines of code across all touched files.

**Boundary scope clarification**: this refactor makes `apiHandler` the sole callable path for the three
trivial methods inlined in this pass. The files `googleClassrooms.js`, `abclassMutations.js`,
`assignmentDefinitionPartials.js`, and `apiConfig.js` carry real boundary logic (input validation, error
mapping, or non-trivial transformation) and remain as top-level GAS globals in this pass. Making
`apiHandler` the sole entry for all existing transport methods is a valid future goal but is explicitly
deferred from this refactor.

This refactor is **not** intended to:

- Change the public transport contract (`ok`, `requestId`, `data`/`error` envelope shape) in any way.
- Alter the admission control, rate limiting, request tracking, or error mapping behaviour of `ApiDispatcher`.
- Touch `googleClassrooms.js`, `abclassMutations.js`, `assignmentDefinitionPartials.js`, or `apiConfig.js`.
- Add new API endpoints, features, or frontend UX.
- Touch the frontend services that already own proper Zod validation (`referenceDataService.ts`,
  `classPartialsService.ts`, `backendConfigurationService.ts`, etc.).
- Touch `apiService.ts`, which the slop review confirmed is doing real transport work and is not slop.

## Agreed product decisions

1. **`ALLOWLISTED_METHOD_HANDLERS` is the single authoritative transport registry.**
   Every front-end-callable method must appear as an entry in this object inside `z_apiHandler.js`.
   `API_METHODS` and `API_ALLOWLIST` in `apiConstants.js` are redundant and are deleted.

2. **`handle()` dispatches directly through `ALLOWLISTED_METHOD_HANDLERS`.**
   The two-step lookup (`apiAllowlist` → `_invokeAllowlistedMethod` → `ALLOWLISTED_METHOD_HANDLERS`) is
   collapsed to a single lookup: `const handler = ALLOWLISTED_METHOD_HANDLERS[methodName]`. The
   `UNKNOWN_METHOD` guard is re-anchored to this lookup — if the key is absent (falsy lookup result),
   `handle()` returns the existing `UNKNOWN_METHOD` failure envelope unchanged. `_invokeAllowlistedMethod`
   is removed. The `apiAllowlist` module-level variable and its initialisation in both the Node and GAS
   branches are removed.

3. **`auth.js`, `abclassPartials.js`, and `referenceData.js` are deleted.**
   The controller calls they wrap are inlined as single-expression closures directly inside
   `ALLOWLISTED_METHOD_HANDLERS`:

   ```js
   getAuthorisationStatus: () => new ScriptAppManager().isAuthorised(),
   getABClassPartials:     () => new ABClassController().getAllClassPartials(),
   getCohorts:             () => new ReferenceDataController().listCohorts(),
   createCohort:           (parameters) => new ReferenceDataController().createCohort(parameters.record),
   updateCohort:           (parameters) => new ReferenceDataController().updateCohort(parameters),
   deleteCohort:           (parameters) => new ReferenceDataController().deleteCohort(parameters.key),
   getYearGroups:          () => new ReferenceDataController().listYearGroups(),
   createYearGroup:        (parameters) => new ReferenceDataController().createYearGroup(parameters.record),
   updateYearGroup:        (parameters) => new ReferenceDataController().updateYearGroup(parameters),
   deleteYearGroup:        (parameters) => new ReferenceDataController().deleteYearGroup(parameters.key),
   ```

   Because these closures are anonymous entries inside a `const` object, they are not exposed as top-level
   GAS callable globals. Only `apiHandler` (the outer GAS function) remains callable by
   `google.script.run`.

4. **`getReferenceDataController()` in `referenceData.js` is not reproduced.**
   The per-call instantiation pattern (`new ReferenceDataController()` per closure invocation) is already
   the effective runtime behaviour of the old file and is preserved unchanged.

5. **`authService.ts` adds `z.boolean()` Zod validation via a dedicated adjacent schema file.**
   The service currently delegates to `callApi` without validating the backend response type. This violates
   the frontend service policy requiring wrappers to own request/response validation. A `z.boolean().parse()`
   call is added around the `callApi` return before it is returned to callers.
   `src/frontend/AGENTS.md` § 8 requires validation schemas to live in a dedicated adjacent schema file
   (e.g. `*.zod.ts`). A new file `src/frontend/src/services/authService.zod.ts` is therefore created to
   hold the `AuthorisationStatusSchema = z.boolean()` schema and its inferred type.
   The service wrapper is kept as a separate file; inlining into `sharedQueries.ts` is not pursued because
   the frontend AGENTS mandate that service modules own transport boundaries and `callApi` must not be
   called from non-service query helpers.

6. **Thin backend wrapper tests are deleted; dispatcher-level contract tests replace them.**
   The following test files are deleted because their source files are deleted or their assertions test
   only the indirection that is being removed:
   - `tests/backend-api/abclassPartials.unit.test.js` — asserts only that the wrapper delegates.
   - `tests/backend-api/referenceData.unit.test.js` — asserts only that the wrappers delegate.
   - `tests/api/auth.test.js` — contains three tests: the two controller-delegation tests
     (`creates ScriptAppManager and returns true when authorised` and `creates ScriptAppManager and
returns false when not authorised`) must first be migrated as new tests in `apiHandler.test.js`
     asserting that the dispatcher's `getAuthorisationStatus` closure calls the mocked `ScriptAppManager`
     constructor and returns the expected boolean. The third test (`works when module exports are
unavailable in the runtime context`) tests vm-context loading of the deleted file and is dropped
     with the file; it must not be migrated.
   - `tests/api/abclassPartials.test.js` — tests `API_METHODS`, `API_ALLOWLIST`, and the
     `globalThis.getABClassPartials` global, all of which are removed. Its routing and error-envelope
     coverage (dispatch to `getABClassPartials`, success envelope, error maps to failure envelope) must
     be added as new tests in `apiHandler.test.js` using the `ABClassController` constructor mock
     pattern before this file is deleted.
     New and updated tests in `tests/api/apiHandler.test.js` verify dispatcher behaviour and parameter
     extraction contracts at the correct boundary.

7. **`tests/helpers/apiHandlerTestUtils.js` and all dependent suites are updated.**
   `setupApiHandlerTestContext` currently installs mock handler globals (`globalThis.getAuthorisationStatus`,
   `globalThis.getCohorts`, etc.). After inlining, those globals no longer exist in production code. The
   helper is updated to install controller constructor mocks (`globalThis.ScriptAppManager`,
   `globalThis.ABClassController`, `globalThis.ReferenceDataController`) for the affected methods.
   The existing `handler` option is retained; after inlining it becomes the default implementation used
   by the mocked `ScriptAppManager().isAuthorised()` path — the installed `ScriptAppManager` constructor
   mock's `isAuthorised()` method delegates to `handler()`, defaulting to `() => true`.
   The existing `additionalHandlers` option is retained for non-inlined globals only (those in files that
   are **not** deleted: `googleClassrooms`, `abclassMutations`, `assignmentDefinitionPartials`, `apiConfig`).
   `buildApiHandlerTestHandlers()` in `apiHandler.test.js` must be narrowed to supply only those
   non-inlined method globals; it must not try to stub the deleted globals.
   All suites that call `callAuthorisationStatus` or directly stub `globalThis.getAuthorisationStatus`
   must be updated to use the `ScriptAppManager` constructor mock pattern: `apiHandler.test.js`,
   `apiHandlerLocking.test.js`, `apiHandlerTiming.test.js`, and `staleAdmission.test.js`.

8. **`docs/developer/backend/api-layer.md` is updated.**
   The "Dispatch and allowlist pattern" section currently instructs implementers to add new methods to
   `API_METHODS`, `API_ALLOWLIST`, and `ALLOWLISTED_METHOD_HANDLERS`. After the refactor, the instruction
   simplifies to: add one entry to `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`. In addition, the
   endpoint-specific sections that name `auth.js`, `abclassPartials.js`, and `referenceData.js` as source
   files must be updated to reflect that these handlers now live inline inside `z_apiHandler.js`.

## Measurable LOC-reduction target

The refactor must achieve a **net reduction of ≥ 200 lines** across all files touched, measured against the
baselines in the action plan. With the baseline table tightened to exact current `wc -l` counts for
every existing affected file (and `0` for the planned new file), the expected reduction is ≈ 568 lines
based on the file-level analysis recorded there.

## Existing system constraints

### GAS runtime model

- Backend files are concatenated and evaluated as a single GAS V8 script. Any `function` declaration at
  top level is callable via `google.script.run`.
- Only closures inside objects or class methods are shielded from direct external invocation.
- The Node/test boundary is maintained via the guarded `if (typeof module !== 'undefined' && module.exports)`
  export block at the end of each file. No production Node compatibility code may be added.

### Transport envelope stability

- The `{ ok, requestId, data }` / `{ ok, requestId, error }` envelope shape is the stable frontend–backend
  contract and must not change.
- Admission control, rate limiting, and request tracking behaviour in `_runAdmissionPhase` and
  `_runCompletionPhase` must not change.
- The error-mapping logic in `_mapErrorToFailureEnvelope` must not change.

### Load-order and file-naming constraints

- `z_*` and `y_*` directory conventions must be preserved.
- Deleting files does not require any load-order renaming since the deleted files define only GAS globals
  that are being eliminated.

### Test harness constraints

- The test harness installs GAS-like globals in `tests/setupGlobals.js`. `ScriptAppManager` is already
  registered there. `ABClassController` and `ReferenceDataController` are **not** currently registered
  in `setupGlobals.js`; they must be installed and restored per-test by the updated
  `tests/helpers/apiHandlerTestUtils.js` helper (`installControllerMocks` / `restoreControllerMocks`).
  No new entries in `setupGlobals.js` are required for `ABClassController` or `ReferenceDataController`.

## Domain and contract recommendations

### Parameter extraction contract for inlined reference-data closures

The parameter shapes used by the inlined closures must exactly match the shapes the controllers expect.
These are unchanged from the existing `referenceData.js` and must be preserved:

- `createCohort` / `createYearGroup`: extract `parameters.record` and pass to the controller create method.
- `updateCohort` / `updateYearGroup`: pass the full `parameters` object (contains `key` and `record`).
- `deleteCohort` / `deleteYearGroup`: extract `parameters.key` and pass to the controller delete method.
- `getCohorts` / `getYearGroups`: no parameters; controller list method called with no arguments.

### Zod validation for `authService.ts`

A dedicated schema file `src/frontend/src/services/authService.zod.ts` is created, consistent with
`src/frontend/AGENTS.md` § 8:

```ts
import { z } from 'zod';
export const AuthorisationStatusSchema = z.boolean();
export type AuthorisationStatus = z.infer<typeof AuthorisationStatusSchema>;
```

`authService.ts` imports `AuthorisationStatusSchema` from this file and returns:
`AuthorisationStatusSchema.parse(await callApi<boolean>(GET_AUTHORISATION_STATUS_METHOD))`.

This is consistent with the pattern used by `classPartialsService.ts`, `referenceDataService.ts`, and
other compliant frontend services.

## Feature architecture

### Backend placement

- `src/backend/z_Api/z_apiHandler.js` — sole entry surface; gains inlined handler closures.
- `src/backend/z_Api/apiConstants.js` — retains all non-slop constants: `ACTIVE_REQUEST_STALE_MINUTES`
  (the internal helper used to derive `STALE_REQUEST_AGE_MS`), `ACTIVE_LIMIT`, `MAX_TRACKED_REQUESTS`,
  `STALE_REQUEST_AGE_MS`, `USER_REQUEST_STORE_KEY`, `LOCK_TIMEOUT_MS`, `LOCK_WAIT_WARN_THRESHOLD_MS`.
  `API_METHODS` and `API_ALLOWLIST` are removed; all other constants remain unchanged.

### Frontend placement

- `src/frontend/src/services/authService.ts` — gains Zod validation call; imports schema from adjacent file.
- `src/frontend/src/services/authService.zod.ts` — new file containing `AuthorisationStatusSchema` and its
  inferred type, consistent with `src/frontend/AGENTS.md` § 8.
- `src/frontend/src/services/authService.spec.ts` — gains Zod validation tests.

### Out of scope for this surface

- Adding new API methods.
- Touching `googleClassrooms.js`, `abclassMutations.js`, `assignmentDefinitionPartials.js`, `apiConfig.js`.
- Touching any frontend services other than `authService.ts`.
- Modifying `apiService.ts`.

## Backend changes required

1. **`src/backend/z_Api/apiConstants.js`** — remove `API_METHODS` and `API_ALLOWLIST` blocks; remove them
   from `module.exports`. Retain all other constants unchanged, including `ACTIVE_REQUEST_STALE_MINUTES`
   (the internal helper used to derive `STALE_REQUEST_AGE_MS`). Do not remove any constant not listed
   for deletion.

2. **`src/backend/z_Api/z_apiHandler.js`**:
   - Remove `let apiAllowlist;` module-level variable.
   - Remove the `API_ALLOWLIST: apiAllowlist` entry from the Node require block and the
     `apiAllowlist = API_ALLOWLIST;` line from the GAS branch.
   - Inline the ten handler closures for `getAuthorisationStatus`, `getABClassPartials`, and the eight
     reference-data methods into `ALLOWLISTED_METHOD_HANDLERS`, replacing their current delegations to
     top-level GAS globals.
   - Simplify `handle()` to look up `methodName` directly in `ALLOWLISTED_METHOD_HANDLERS`:
     `const handler = ALLOWLISTED_METHOD_HANDLERS[methodName]`. The existing `UNKNOWN_METHOD` guard is
     re-anchored to this lookup — if `handler` is falsy (key absent), return the existing `UNKNOWN_METHOD`
     failure envelope unchanged. Remove the `apiAllowlist` lookup step.
   - Remove `_invokeAllowlistedMethod` entirely.

3. **Delete `src/backend/z_Api/auth.js`**.

4. **Delete `src/backend/z_Api/abclassPartials.js`**.

5. **Delete `src/backend/z_Api/referenceData.js`**.

## Frontend changes required

1. **Create `src/frontend/src/services/authService.zod.ts`** — define `AuthorisationStatusSchema = z.boolean()`
   and export `AuthorisationStatus = z.infer<typeof AuthorisationStatusSchema>`.

2. **Update `src/frontend/src/services/authService.ts`** — import `AuthorisationStatusSchema` from the new
   zod file; wrap the `callApi` return in `AuthorisationStatusSchema.parse(...)`.

## Testing expectations

- `tests/api/apiHandler.test.js` must retain full coverage of the dispatcher lifecycle
  (admission, completion, error mapping, rate limiting, request ID generation, success/failure envelopes).
- Tests that currently mock `globalThis.getAuthorisationStatus`, `globalThis.getABClassPartials`, and the
  eight reference-data globals must be updated to mock the corresponding controller constructors.
- The basic success-envelope test in `apiHandler.test.js` (currently `data: { authorised: true }`) must
  be updated to `data: true` once the auth dispatch returns the raw boolean from
  `ScriptAppManager.isAuthorised()` rather than the legacy `{ authorised: true }` object.
- New contract tests must verify the parameter extraction shapes for `createCohort`, `updateCohort`,
  `deleteCohort`, `createYearGroup`, `updateYearGroup`, `deleteYearGroup`.
- The `API_METHODS` and `API_ALLOWLIST` presence tests in `apiHandler.test.js` are removed; new tests
  verify that `ALLOWLISTED_METHOD_HANDLERS` is the single authoritative registry.
- The following test files are deleted:
  - `tests/backend-api/abclassPartials.unit.test.js`
  - `tests/backend-api/referenceData.unit.test.js`
  - `tests/api/auth.test.js`
  - `tests/api/abclassPartials.test.js`
- `tests/api/apiHandlerLocking.test.js`, `tests/api/apiHandlerTiming.test.js`, and
  `tests/api/staleAdmission.test.js` must be updated alongside the helper so that stubs target
  controller constructors rather than `globalThis.getAuthorisationStatus`.
- `src/frontend/src/services/authService.spec.ts` gains tests asserting that a non-boolean backend
  response throws a Zod parse error.
- All existing `apiHandler.test.js` non-registry tests (lifecycle, error mapping, VM context, rate
  limiting, request tracking) must pass unchanged or with only stub-update changes.

## Documentation and rollout notes

- `docs/developer/backend/api-layer.md` — update the "Dispatch and allowlist pattern" section to describe
  the single-registry approach; remove references to `API_METHODS` and `API_ALLOWLIST`; update the step
  list for adding new endpoints to a single step. Update the endpoint-specific sections for
  `getAuthorisationStatus`, `getABClassPartials`, and the cohort/year-group reference-data methods to
  reflect that the handler logic now lives inline inside `z_apiHandler.js` rather than in separate files.
- `src/backend/AGENTS.md` — the `0.1 Required apiHandler migration pattern` references adding to
  `API_METHODS` and `API_ALLOWLIST`. Update to reference only `ALLOWLISTED_METHOD_HANDLERS`.
- `src/frontend/AGENTS.md` — § 4.1 currently instructs implementers to "keep method names aligned with
  backend `API_METHODS` in `src/backend/z_Api/apiConstants.js`". After deleting `API_METHODS`, update
  this instruction to reference `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` as the authoritative
  method-name registry instead.
- Perform a repo-wide search for any remaining `API_METHODS` or `API_ALLOWLIST` references in production
  and documentation files; remove or update each occurrence found.
- No migration or reset steps are required; this is a pure code-structure change with no data or
  persistence impact.

## Planning handoff notes

- The action plan must sequence Section 1 (registry consolidation in `apiConstants.js` and `z_apiHandler.js`
  dispatch simplification) before Section 2 (wrapper file deletion and handler inlining), because the
  simplification of the dispatch path is a prerequisite for the closure inlining.
- `tests/helpers/apiHandlerTestUtils.js` must be updated in Section 2 before or alongside the
  `apiHandler.test.js` updates, because the helper's `setupApiHandlerTestContext` function controls which
  globals are installed for tests.
- The `authService.ts` change (Section 3) is independent and may be done in any order relative to Sections
  1 and 2.

## V1 scope

### Include in v1

- Registry consolidation: delete `API_METHODS` and `API_ALLOWLIST`; simplify dispatch.
- Wrapper file deletion: `auth.js`, `abclassPartials.js`, `referenceData.js`.
- Inlined handler closures in `ALLOWLISTED_METHOD_HANDLERS`.
- Test cleanup and dispatcher contract tests.
- `authService.ts` Zod validation.
- `docs/developer/backend/api-layer.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md`
  documentation updates.

### Defer from v1

- Refactoring `googleClassrooms.js`, `abclassMutations.js`, or `assignmentDefinitionPartials.js` — these
  carry genuine boundary logic and are out of scope for this slop-reduction pass.
- Any changes to the frontend services already passing Zod validation.
- Performance optimisation of the controller instantiation pattern (one controller per request).
