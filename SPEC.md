# Transport Layer De-Sloppification Specification

## Status

Draft v1.3 — replaces namespace-object/IIFE transport-helper pattern with trailing-underscore private helper
function pattern; corrects GAS callable-surface description; adds explicit transport-vs-domain
validation ownership rules; revised after Planner Reviewer and user decision pass.

## Purpose

This specification defines the intended refactoring of the `src/backend/z_Api` transport layer and the
`src/frontend/src/services/authService.ts` frontend service wrapper to resolve confirmed slop identified in
`SLOP_REVIEW.md`.

The refactor will:

- Eliminate three trivial pass-through wrapper files (`auth.js`, `abclassPartials.js`, `referenceData.js`)
  that unnecessarily expose top-level GAS callable globals, making `apiHandler` the sole callable entry
  point for those specific methods.
- Collapse the triplicate transport method registry into a single authoritative source.
- Convert `googleClassrooms.js`, `abclassMutations.js`, `assignmentDefinitionPartials.js`, and
  `apiConfig.js` from files with callable GAS top-level globals into files whose handler functions
  use the trailing-underscore private naming convention (`handlerName_`), preventing direct invocation via
  `google.script.run` per the official Apps Script specification.
- Reduce duplicated domain-invariant validation between `abclassMutations.js` and `ABClassController`,
  leaving only genuine transport-boundary validation at the API layer.
- Bring `authService.ts` into compliance with the frontend service validation policy.
- Achieve a measurable net reduction in lines of code across all touched files.

**Architectural target**: `apiHandler` is the sole frontend-callable GAS entry point for all active
z*Api methods. Both trivial handlers (inlined as closures) and non-trivial handlers (implemented as
private helper functions whose trailing `*`suffix shields them from`google.script.run`per the
official Apps Script specification) are wired exclusively through`ALLOWLISTED_METHOD_HANDLERS`. See
agreed product decisions 9–12 for the trailing-underscore private transport-helper pattern and
validation-ownership rules.

This refactor is **not** intended to:

- Change the public transport contract (`ok`, `requestId`, `data`/`error` envelope shape) in any way.
- Alter the admission control, rate limiting, request tracking, or error mapping behaviour of `ApiDispatcher`.
- Add new API endpoints, features, or frontend UX.
- Touch the frontend services that already own proper Zod validation (`referenceDataService.ts`,
  `classPartialsService.ts`, `backendConfigurationService.ts`, etc.).
- Touch `apiService.ts`, which the slop review confirmed is doing real transport work and is not slop.
- Remove validation from the transport layer where the controller does not already own an equivalent check.

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

7. **`tests/helpers/apiHandlerTestUtils.js` and all dependent suites are updated in two passes.**
   _Pass A (Section 3 — trivial handler inlining)_: `setupApiHandlerTestContext` is updated to install
   controller constructor mocks (`globalThis.ScriptAppManager`, `globalThis.ABClassController`,
   `globalThis.ReferenceDataController`) for the ten inlined methods. The existing `handler` option is
   retained; after inlining it becomes the default implementation used by the mocked
   `ScriptAppManager().isAuthorised()` path. The existing `additionalHandlers` option is **temporarily**
   retained to stub the non-inlined globals (`getGoogleClassrooms`, `upsertABClass`, `updateABClass`,
   `deleteABClass`, `getAssignmentDefinitionPartials`, `deleteAssignmentDefinition`) — these globals still
   exist as top-level functions at this stage. `getBackendConfig` and `setBackendConfig` are not in
   `additionalHandlers` at any stage; they are wired through module-level variables in `z_apiHandler.js`
   via the guarded Node require block and require no change in the test helper during Pass A.
   `buildApiHandlerTestHandlers()` in `apiHandler.test.js` is narrowed to supply only those non-inlined
   method globals; it must not stub the deleted globals.
   All suites that stub `globalThis.getAuthorisationStatus` must be updated to use the `ScriptAppManager`
   constructor mock pattern.

   _Pass B (Section 4 — non-trivial transport helper restructure)_: once the non-trivial handler files are
   renamed to trailing-underscore private helpers, `additionalHandlers` and
   `buildApiHandlerTestHandlers()` are replaced by helper-function stubs: the test helper sets up
   `globalThis.getGoogleClassrooms_`, `globalThis.upsertABClass_`, `globalThis.updateABClass_`,
   `globalThis.deleteABClass_`, `globalThis.getAssignmentDefinitionPartials_`, and
   `globalThis.deleteAssignmentDefinition_` as `vi.fn()` stubs, consistent with how controller
   constructor mocks are handled. All handles are merged onto the context object so individual tests
   can override per-method behaviour without calling separate install helpers.

   Between Section 3 and Section 4, the `additionalHandlers` mechanism is a transitional stop-gap. It must
   not be carried beyond Section 4.

8. **`docs/developer/backend/api-layer.md` is updated.**
   The "Dispatch and allowlist pattern" section currently instructs implementers to add new methods to
   `API_METHODS`, `API_ALLOWLIST`, and `ALLOWLISTED_METHOD_HANDLERS`. After the refactor, the instruction
   simplifies to: add one entry to `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`. In addition, the
   endpoint-specific sections that name `auth.js`, `abclassPartials.js`, and `referenceData.js` as source
   files must be updated to reflect that these handlers now live inline inside `z_apiHandler.js`.

9. **Trailing-underscore private transport-helper pattern for non-trivial z_Api files.**
   `googleClassrooms.js`, `abclassMutations.js`, `assignmentDefinitionPartials.js`, and `apiConfig.js`
   carry genuine boundary logic (external-API shape validation, transform, masking, aggregation) and are
   retained as separate files. Their handler functions must not be directly callable via
   `google.script.run`. The official Apps Script specification excludes functions whose names end
   with an underscore from the callable surface; this is therefore the preferred and sufficient pattern
   — no IIFE or namespace-object wrapper is required.

   Handler functions in the four files are renamed with a trailing underscore:

   | File                              | Renamed handler functions                                         |
   | --------------------------------- | ----------------------------------------------------------------- |
   | `googleClassrooms.js`             | `getGoogleClassrooms_`                                            |
   | `apiConfig.js`                    | `getBackendConfig_`, `setBackendConfig_`                          |
   | `assignmentDefinitionPartials.js` | `getAssignmentDefinitionPartials_`, `deleteAssignmentDefinition_` |
   | `abclassMutations.js`             | `upsertABClass_`, `updateABClass_`, `deleteABClass_`              |

   Internal helper functions within those files that are not transport-entry functions (e.g. the
   validation helpers in `abclassMutations.js` and `assignmentDefinitionPartials.js`) also use the
   trailing underscore for consistency and to prevent accidental GAS-global exposure:
   `validateParametersObject_`, `throwValidationError_`, etc.

   `ALLOWLISTED_METHOD_HANDLERS` calls each renamed handler via a thin closure:

   ```js
   getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
   ```

   The guarded `module.exports` block at the end of each file exports the trailing-underscore handler
   functions so that Node unit tests can access them:

   ```js
   if (typeof module !== 'undefined' && module.exports) {
     module.exports = { getGoogleClassrooms_ };
   }
   ```

   `apiConfig.js` retains special wiring in `z_apiHandler.js`: the guarded Node require block imports
   `getBackendConfig_` and `setBackendConfig_` by name so that the
   `ALLOWLISTED_METHOD_HANDLERS` closures resolve correctly in the Node test environment. In GAS
   runtime, `getBackendConfig_` and `setBackendConfig_` are available as private globals and the
   closures call them directly.

10. **Validation-ownership boundary for abclassMutations.**
    `ABClassController` already owns the following domain-invariant checks (confirmed in the source):
    - `_validateClassId` — non-empty string check (throws `TypeError`)
    - `_validateCourseLength` — positive integer check (throws `TypeError`)
    - `_validateDeleteClassId` — non-empty string + path-character safety for delete operations
    - `Validate.requireParams` — required-field completeness (called in `upsertABClass`,
      `updateABClass`, `deleteABClass`)

    The transport layer (`abclassMutations.js`) currently duplicates these checks. After the refactor,
    the transport helper retains only:
    - **Object/type check on `parameters`** (`validateParametersObject`): retained — not in controller.
    - **Unsafe path-character check on `classId`** (`.includes('..')`, `.includes('/')`,
      `.includes('\\')`): retained at transport boundary for all three mutations as a
      defence-in-depth security gate. Note that the controller's `_validateDeleteClassId` only
      covers delete and only checks `..` and `/`; the transport retains `\\` and covers all
      mutations. **This check must be guarded so that `.includes()` is only called when
      `typeof classId === 'string'`**: missing or non-string `classId` values must fall
      through to the controller rather than crashing with an `INTERNAL_ERROR` in the
      transport helper.
    - **Forbidden-fields check for `updateABClass`**: retained — prevents over-patching at transport
      boundary; not in controller.
    - **`active` field type check for `updateABClass`** (`boolean or null`): retained — not validated
      in controller.

    The following checks are removed from the transport layer because `ABClassController` already owns
    them:
    - `validateClassId` (non-empty string) — removed; controller owns `_validateClassId`.
    - `validateCourseLength` (positive integer) — removed; controller owns `_validateCourseLength`.
    - `requireParameters` wrapper — removed; controller already calls `Validate.requireParams`.

    When the transport layer removes these checks, domain-level errors from the controller
    (`TypeError`) may propagate rather than the current `ApiValidationError` wrappers. This change in
    error type is explicitly acceptable; `ApiDispatcher._mapErrorToFailureEnvelope` handles
    non-`ApiValidationError` errors. Tests must be updated to reflect this where relevant.

11. **Validation-ownership boundary for other non-trivial files.**
    - `googleClassrooms.js`: External Classroom API response shape validation (object type checks on
      rows, presence of `id` and `name` fields) is transport-boundary validation for untrusted
      external data. It is not duplicated lower down and is retained in the transport helper.
    - `assignmentDefinitionPartials.js`: Row-shape validation, ISO timestamp validation, safe
      delete-key validation, and the `tasks: null` contract enforcement are transport-contract
      validations that protect the frontend from corrupt storage data. They are not duplicated lower
      down and are retained in the transport helper.
    - `apiConfig.js`: Masking, payload shaping, and partial-update aggregation are transformation
      logic, not domain validation. The `params is object` check in `setBackendConfig` is a genuine
      transport-boundary guard and is retained. `ConfigurationManager` already validates setter
      inputs via `setProperty`/spec validation, so type/range validation of individual config fields
      is not owned at the transport layer; no changes are needed to that ownership.

12. **Docs-first architecture signpost before implementation.**
    Before any code changes, `docs/developer/backend/api-layer.md` and `src/backend/AGENTS.md` are
    updated to describe:
    - The target architecture: `apiHandler` is the sole callable GAS entry point for all active z_Api
      methods.
    - The trivial-inline pattern (for simple handlers with no private helpers).
    - The non-callable transport-helper pattern (for non-trivial handlers).
      Planned entries for new patterns are marked `Not implemented` in the canonical docs until the
      relevant code sections are complete.

## Measurable LOC-reduction target

The refactor must achieve a **net reduction of ≥ 200 lines** across all files touched, measured against the
baselines in the action plan. With the baseline table tightened to exact current `wc -l` counts for
every existing affected file (and `0` for planned new files), the expected reduction is ≈ 850 lines based
on the file-level analysis recorded there, accounting for the expanded scope.

## Existing system constraints

### GAS runtime model

- Backend files are concatenated and evaluated as a single GAS V8 script. Any `function` declaration
  at top level whose name does **not** end with an underscore is callable via `google.script.run`;
  the official Apps Script specification excludes trailing-underscore functions from the callable
  surface.
- Trailing-underscore top-level functions are therefore the preferred pattern for non-callable
  transport helpers in `z_Api` files; they do not require IIFE or namespace-object wrappers.
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

6. **Refactor `src/backend/z_Api/googleClassrooms.js`** — rename the top-level `function getGoogleClassrooms`
   to `function getGoogleClassrooms_`. The trailing underscore prevents GAS from exposing it to
   `google.script.run`. Update the `module.exports` guarded block to export `{ getGoogleClassrooms_ }`. Update
   `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` to reference
   `(parameters) => getGoogleClassrooms_(parameters)`.

7. **Refactor `src/backend/z_Api/assignmentDefinitionPartials.js`** — rename all handler functions and
   private helpers to use a trailing underscore: `getAssignmentDefinitionPartials_`,
   `deleteAssignmentDefinition_`, `throwValidationError_`, `validateDefinitionKey_`, etc. The
   trailing underscore prevents GAS from exposing any of these to `google.script.run`. Update the
   `module.exports` guarded block to export `{ getAssignmentDefinitionPartials_, deleteAssignmentDefinition_ }`. Update
   `ALLOWLISTED_METHOD_HANDLERS` to reference closures that call the renamed handler functions.

8. **Refactor `src/backend/z_Api/apiConfig.js`** — rename `getBackendConfig` to `getBackendConfig_` and
   `setBackendConfig` to `setBackendConfig_`. Any existing module-scope helper (e.g. `maskApiKey`)
   that is not a handler entry point should also be renamed to `maskApiKey_` for consistency. Update
   the `module.exports` guarded block to export `{ getBackendConfig_, setBackendConfig_ }`. Remove the
   old `getBackendConfigHandler` / `setBackendConfigHandler` indirection in `z_apiHandler.js` so both
   GAS and Node code paths call `getBackendConfig_` / `setBackendConfig_` directly from
   `ALLOWLISTED_METHOD_HANDLERS`. The guarded Node require block imports the renamed helpers by name;
   no non-underscore `getBackendConfig` / `setBackendConfig` reference remains in any GAS-executed path.
   In the Node test path, the guarded require block assigns the imported functions onto
   `global.getBackendConfig_` / `global.setBackendConfig_`; do not introduce module-level
   `let`/`const` shadow bindings with those same names in `z_apiHandler.js`, because that would collide
   with the GAS top-level function declarations after concatenation.

9. **Refactor `src/backend/z_Api/abclassMutations.js`** — rename all handler and helper functions to
   use a trailing underscore: `upsertABClass_`, `updateABClass_`, `deleteABClass_`,
   `getAbClassController_`, `validateParametersObject_`, `validateMutationClassId_`,
   `validateUpsertABClassParameters_`, `validateUpdateABClassParameters_`,
   `validateDeleteABClassParameters_`. Remove the following functions (they duplicate domain-invariant
   validation already owned by `ABClassController`):
   - `validateClassId` (non-empty string check — `ABClassController._validateClassId` owns this)
   - `validateCourseLength` (positive integer check — `ABClassController._validateCourseLength` owns
     this)
   - `requireParameters` wrapper (required-field completeness — `ABClassController` already calls
     `Validate.requireParams`)
     The following validation stays, renamed to private trailing-underscore helpers:
   - `validateParametersObject_` (plain object check — transport boundary, not in controller)
   - Unsafe path-character check on `classId` (`..`, `/`, `\\` — transport security, not fully
     covered by controller for all three mutations)
   - Forbidden-fields check in `updateABClass_` (transport boundary)
   - `active` boolean/null type check in `updateABClass_` (not in controller)
     Update the `module.exports` guarded block to export
     `{ upsertABClass_, updateABClass_, deleteABClass_ }`. Update `ALLOWLISTED_METHOD_HANDLERS`
     to reference closures that call `upsertABClass_`, `updateABClass_`, `deleteABClass_`.
     `validateMutationClassId_` is retained as the shared guarded path-character safety helper once the
     duplicate domain checks are removed.

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
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js` is updated to load handlers via
  the private trailing-underscore exports `getAssignmentDefinitionPartials_` and `deleteAssignmentDefinition_`
  rather than any namespace object or top-level function name.
- `tests/backend-api/abclassMutations.unit.test.js` is updated to load handlers via the
  private trailing-underscore exports `upsertABClass_`, `updateABClass_`, `deleteABClass_` and to remove test
  cases for validation that has been removed from the transport layer (duplicate domain-invariant
  checks: `validateClassId`, `validateCourseLength`, `requireParameters`).
- `tests/api/abclassMutations.test.js` is updated across three sections: VM coexistence tests removed
  in Section 3; direct function accesses updated to `upsertABClass_`, `updateABClass_`, `deleteABClass_`
  from the module in Section 4; `requireParameters` test block, `courseLength` test block, and the
  `'missing classId'`/`'empty classId'` cases in the `deleteABClass` `it.each` block are all removed
  in Section 5.
- `tests/api/apiHandler.test.js` is updated to stub the private trailing-underscore transport helpers
  (`globalThis.getGoogleClassrooms_`, `globalThis.upsertABClass_`, `globalThis.updateABClass_`,
  `globalThis.deleteABClass_`, `globalThis.getAssignmentDefinitionPartials_`,
  `globalThis.deleteAssignmentDefinition_`) for the non-trivial handlers, replacing the existing
  non-underscore global function stubs.
- `tests/api/googleClassrooms.test.js` is updated so all direct handler accesses use
  `getGoogleClassrooms_` from the module export; the export-shape assertion checks for
  `getGoogleClassrooms_` as a function rather than a namespace object.
- `tests/api/assignmentDefinitionDeleteApi.test.js` is updated so all direct handler accesses use
  `deleteAssignmentDefinition_` from the module export.
- `tests/api/backendConfigApi.test.js` requires no changes; it routes through the dispatcher.

## Documentation and rollout notes

- `docs/developer/backend/api-layer.md` — before code changes (docs-first section): describe the
  target architecture (apiHandler as sole entry, trivial-inline and trailing-underscore private transport-helper
  patterns); mark new patterns `Not implemented`. During final rollout: remove the `Not implemented`
  markers; update endpoint sections for all affected files; update the step list for adding new
  endpoints to a single step.
- `src/backend/AGENTS.md` — before code changes: update `§ 0.1` to describe both patterns, codify
  validation ownership rules, and mark the trailing-underscore private helper pattern `Not implemented`. After
  code changes: reconcile to `Implemented`.
- `src/frontend/AGENTS.md` — § 4.1 currently instructs implementers to "keep method names aligned with
  backend `API_METHODS` in `src/backend/z_Api/apiConstants.js`". After deleting `API_METHODS`, update
  this instruction to reference `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` as the authoritative
  method-name registry instead.
- Perform a repo-wide search for any remaining `API_METHODS` or `API_ALLOWLIST` references in production
  and documentation files; remove or update each occurrence found.
- No migration or reset steps are required; this is a pure code-structure change with no data or
  persistence impact.

## Planning handoff notes

- Section 1 of the action plan is a docs pass only; no production code changes are permitted in that
  section. This ensures agents executing later sections cannot revert to the old multi-entry-point pattern.
- Section 2 (registry consolidation) must land before Section 3 (trivial wrapper elimination), because
  simplifying the dispatch path is a prerequisite for closure inlining.
- `tests/helpers/apiHandlerTestUtils.js` must be updated in Section 3 before or alongside the
  `apiHandler.test.js` updates (Pass A), and again in Section 4 (Pass B) when `additionalHandlers` is
  replaced by trailing-underscore private function stubs.
- Section 4 (non-trivial transport helpers) depends on Section 3 being complete — the non-trivial
  globals must still exist as top-level callable functions during Section 3 to maintain a green test
  suite throughout.
- Section 5 (abclassMutations validation deduplication) depends on Section 4; it must not be started
  before the trailing-underscore renaming for `abclassMutations.js` is in place.
- The `authService.ts` change (Section 6) is independent and may be done in any order relative to
  Sections 2–5.

## V1 scope

### Include in v1

- Docs-first architecture signpost pass.
- Registry consolidation: delete `API_METHODS` and `API_ALLOWLIST`; simplify dispatch.
- Wrapper file deletion: `auth.js`, `abclassPartials.js`, `referenceData.js`.
- Inlined handler closures in `ALLOWLISTED_METHOD_HANDLERS` for trivial methods.
- Non-callable transport-helper restructure for `googleClassrooms.js`,
  `assignmentDefinitionPartials.js`, `apiConfig.js`, `abclassMutations.js` using trailing-underscore private
  helper function pattern.
- abclassMutations validation deduplication.
- Test cleanup and dispatcher contract tests.
- `authService.ts` Zod validation.
- `docs/developer/backend/api-layer.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md`
  documentation updates.

### Defer from v1

- Any changes to the frontend services already passing Zod validation.
- Performance optimisation of the controller instantiation pattern (one controller per request).
