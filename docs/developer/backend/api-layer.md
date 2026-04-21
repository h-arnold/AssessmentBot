# Backend API Layer (`src/backend/z_Api`)

## Purpose

`src/backend/z_Api` contains the Google Apps Script global transport handlers invoked by the React frontend through `apiHandler`.

This is now the canonical backend transport path for frontend-callable methods. Legacy backend `globals.js` transport files should be treated as migration leftovers or deprecated references only.

This layer is deliberately REST-ish in structure:

- group functions by domain/resource
- keep endpoint-style naming coherent within each file
- use each `.js` file as an API surface for a specific capability area

## Design Rules

1. Keep API functions as thin as possible.
2. Delegate business logic to the appropriate controller class by default.
3. Only keep logic in API functions when delegation would create unnecessary verbosity with no architectural benefit.
4. Validate transport inputs and fail fast; do not hide backend wiring errors. See "Validation ownership rules" below for which layer owns which checks.
5. Keep allowlisted method names stable once used by frontend callers.

## Non-callable transport helpers (trailing-underscore private pattern)

`apiHandler` is the sole frontend-callable GAS entry point for all active `z_Api` methods.
Closures registered in `ALLOWLISTED_METHOD_HANDLERS` are not individually reachable via
`google.script.run` and need no special wrapper to prevent that.

For **trivial handlers** (a single controller delegation with no private helpers), inline the call
as an anonymous closure directly in `ALLOWLISTED_METHOD_HANDLERS`:

```js
getABClassPartials: () => new ABClassController().getAllClassPartials(),
```

For **non-trivial handlers** (requiring validation helpers, multi-step logic, or data transformation),
define trailing-underscore helper functions in the relevant `z_Api` file and call them from a thin
closure in `ALLOWLISTED_METHOD_HANDLERS`:

```js
// In googleClassrooms.js — GAS will NOT expose getGoogleClassrooms_ to google.script.run
function getGoogleClassrooms_(parameters) { … }
```

```js
// In z_apiHandler.js ALLOWLISTED_METHOD_HANDLERS
getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
```

The official Apps Script specification excludes functions whose names end with an underscore from
the callable surface exposed to `google.script.run`. This makes the trailing underscore the preferred,
sufficient pattern for non-callable transport helpers — no IIFE or namespace-object wrapper is
required.

Internal helper functions within a `z_Api` file that are not themselves transport-entry functions
(e.g. `validateParametersObject_`, `throwValidationError_`) also use the trailing underscore for
consistency and to prevent accidental GAS-global exposure.

The guarded `module.exports` block at the end of each file exports the trailing-underscore handler
functions so that Node unit tests can access them:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getGoogleClassrooms_ };
}
```

This pattern is currently used by `getGoogleClassrooms_`, `getAssignmentDefinitionPartials_`,
`deleteAssignmentDefinition_`, `getBackendConfig_`, `setBackendConfig_`, `upsertABClass_`,
`updateABClass_`, and `deleteABClass_`.

## Validation ownership rules

Transport-boundary validation (shape of the incoming request, type of envelope fields, path-safety
of untrusted string identifiers, foreign-API response shape) belongs in the API layer — specifically
in the trailing-underscore helper functions of the relevant `z_Api` file.

Domain invariants (business rules about what constitutes a valid entity, required field completeness,
value range constraints) belong in the called controller, class, or manager.

Rules:

1. **Transport validation lives in API-layer trailing-underscore helpers.** Checks that guard the transport
   surface — such as `params` being a plain object, path-character safety on string identifiers, or
   shape validation of an external API response — are the responsibility of the `z_Api` helper.
2. **Domain invariants live in the controller.** Non-empty string checks, integer range checks,
   required-field completeness, and other business rules are owned by the controller that receives
   the call. Do not reimplement them in the transport layer.
3. **Do not duplicate the same rule in both layers** unless it is an explicit security
   defence-in-depth guard — in which case mark it as such in a code comment so it is not removed
   during future de-sloppification passes.
4. **All new functionality must follow this rule** from the point of introduction.
5. **Old functionality should be opportunistically refactored** toward this rule when the code is
   already being touched. Keep the scope of opportunistic refactoring local and low-risk; do not
   expand a focused change into a broad validation audit.

## Relationship to `globals.js`

Legacy backend `globals.js` files are reference-only during migration and are not the authority for new or migrated frontend transport methods.

- `src/backend/AssignmentProcessor/globals.js`
- `src/backend/y_controllers/globals.js`

Configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`; that legacy transport file has been removed. Backend configuration reads and writes now go through `src/backend/z_Api/z_apiHandler.js`, with callable method names owned by `ALLOWLISTED_METHOD_HANDLERS` in that file and the implementation living in `src/backend/z_Api/apiConfig.js`.

Migration rule:

- when an equivalent function is implemented in `src/backend/z_Api`, remove the legacy `globals.js` variant.
- do not add new functionality to legacy `globals.js` files.

## Testing Guidance

- Test API-layer functions as boundary wrappers: parameter handling, controller delegation, and error propagation.
- Keep heavy business-logic tests at controller/service level.
- Do not call live GAS services in unit tests.

## API handler transport (`apiHandler`)

`src/backend/z_Api/z_apiHandler.js` is the canonical transport entrypoint used by frontend `callApi` requests.

### Request contract

`apiHandler` accepts a request object with:

- `method` (string, required): allowlisted method name intended for `ALLOWLISTED_METHOD_HANDLERS`
- `params` (optional): method-specific payload

If the payload is invalid, `apiHandler` returns an `INVALID_REQUEST` envelope and does not throw.

### Response envelope

All responses are envelopes:

- Success: `{ ok: true, requestId, data }`
- Error: `{ ok: false, requestId, error: { code, message, retriable } }`

This envelope shape is stable and should be treated as the transport contract between frontend and backend.

### Dispatch and allowlist pattern

`ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` is the single authoritative registry for all
frontend-callable methods. A method is reachable from the frontend if and only if it has an entry
in this object.

To add a new frontend-callable API method:

1. Add one entry to `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`, either by
   inlining a trivial controller delegation as an anonymous closure or by delegating to a
   trailing-underscore private helper in the relevant `z_Api` file.

Keep business logic in controllers or services; keep the handler closure thin.

### Admission control and tracking

`apiHandler` applies per-user admission control before invoking allowlisted handlers:

- acquires `LockService.getUserLock()` with bounded timeout
- prunes stale `started` records
- enforces `ACTIVE_LIMIT`
- records started/success/error lifecycle entries in `UserProperties`

Tracking data is compacted to maintain bounded storage (`MAX_TRACKED_REQUESTS`) and is metadata-only.

### Error mapping

Known backend error types are mapped to transport error codes:

- `ApiRateLimitError` -> `RATE_LIMITED`
- `ApiValidationError` -> `INVALID_REQUEST`
- `ApiDisabledError` -> `UNKNOWN_METHOD`
- errors thrown with `reason === 'IN_USE'` -> `IN_USE` (used by `ReferenceDataController` when a cohort or year group cannot be deleted because it is still assigned to one or more `ABClass` records)

Unmapped or malformed errors return `INTERNAL_ERROR` with a generic message.

### Failure diagnostics and transport privacy

When an allowlisted handler throws, `apiHandler` preserves developer diagnostics in Google Apps Script execution logs while keeping the frontend transport envelope stable:

- emits one boundary `ABLogger.error(...)` entry with `requestId`, allowlisted `method`, and the original thrown value
- writes that boundary log before completion tracking updates the request store
- keeps downstream `ABLogger` activity from the failing handler visible; the transport boundary does not suppress those logs
- still returns the same frontend-safe envelope shape, including generic `INTERNAL_ERROR` responses for unmapped failures

This separation is intentional: execution logs remain the place for developer investigation, while the frontend transport contract avoids exposing stack traces or raw exception payloads to callers.

Request-store persistence stays compact. Failed entries record a stringified failure summary for lifecycle tracking, not the full thrown payload.

### Frontend usage pattern

Frontend code should call `callApi` from `src/frontend/src/services/apiService.ts`, not `google.script.run` directly.
Feature services should expose typed helpers per method and return parsed `data` from `callApi`.
Use the allowlisted method names exactly as implemented in `ALLOWLISTED_METHOD_HANDLERS`, for example `callApi('getGoogleClassrooms')`.

### Current migrated endpoints

- `getBackendConfig` and `setBackendConfig` — canonical backend configuration transport methods.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `getBackendConfig_()` and `setBackendConfig_()` in `src/backend/z_Api/apiConfig.js`.
  Frontend wrapper: `src/frontend/src/services/backendConfigurationService.ts`, with request and response validation in `src/frontend/src/services/backendConfiguration.zod.ts`.
  Legacy note: configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`.
  Ownership note: first-time default seeding now belongs to `ConfigurationManager.ensureDefaultConfiguration()`. `getBackendConfig()` remains a thin transport read that delegates bootstrap to the manager before shaping the public payload.

- `getBackendConfig` read data returns the public configuration payload with the following stable fields: `backendAssessorBatchSize`, masked `apiKey`, `hasApiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
  Masking contract: `apiKey` is never returned as the raw stored secret. It is returned as `''`, `'****'`, or `'****'` plus the visible four-character suffix.
  Bootstrap contract: when the persisted configuration store is completely empty, `ConfigurationManager` seeds the defaultable backend settings on first read before the payload is returned. `apiKey`, `backendUrl`, and `jsonDbRootFolderId` remain unseeded when absent.
  Response normalisation: `jsonDbRootFolderId` is returned as `''` when the stored value is blank or unset. `hasApiKey` reflects whether a raw key was present before masking.

- `setBackendConfig` accepts a partial write payload. Only supplied fields are written.
  Writable patch fields: `backendAssessorBatchSize`, `apiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
  Validation contract: `params` must be an object; malformed payloads are reported by the transport as `INVALID_REQUEST`.
  Save-result contract: `{ success: true } | { success: false, error: string }`.

- Dedicated transport tests for backend configuration live in `tests/api/backendConfigApi.test.js`.
  Keep broader dispatcher coverage in `tests/api/apiHandler.test.js`.

- `getAuthorisationStatus` — returns current script authorisation status.
  Source: inline closure in `src/backend/z_Api/z_apiHandler.js` delegating to `new ScriptAppManager().isAuthorised()`.
  Do not call `google.script.run.getAuthorisationStatus` from frontend feature or service modules.

- `getABClassPartials` — returns all class partial documents from the `abclass_partials` registry.
  Source: inline closure in `src/backend/z_Api/z_apiHandler.js` delegating to `new ABClassController().getAllClassPartials()`.
  Frontend wrapper: `src/frontend/src/services/classPartialsService.ts` (`getABClassPartials()`).
  Handler behaviour: instantiates `ABClassController` inside the inline closure at call time.
  The controller normalises stored records before returning them, so transport consumers receive only the documented class-partial fields and not storage metadata such as `_id`.
  The frontend service models `classOwner` and `teachers` as explicit `TeacherSummary` objects (`userId`, `email`, `teacherName`).
  See `docs/developer/backend/DATA_SHAPES.md` for the class partial shape and persistence strategy.

- `getAssignmentDefinitionPartials` — returns assignment-definition registry rows for the Assignments page without loading task artifacts.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `getAssignmentDefinitionPartials_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.getAllPartialDefinitions()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Response data: `Array<{ primaryTitle, primaryTopic, yearGroup, alternateTitles, alternateTopics, documentType, referenceDocumentId, templateDocumentId, assignmentWeighting, definitionKey, tasks: null, createdAt: string | null, updatedAt: string | null }>` inside the standard success envelope.
  Registry contract: rows come from the lightweight `assignment_definitions` collection and intentionally keep `tasks` fixed to `null`; reference and template document IDs are retained, but `referenceLastModified` and `templateLastModified` are not part of the partial transport shape.
  Validation: the helper rejects malformed rows with `ApiValidationError` when required fields are missing, `definitionKey` is blank or untrimmed, `createdAt`/`updatedAt` are not `string | null`, non-null timestamps are not strict ISO datetime strings with timezone information, or `tasks` is not `null`.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinitionPartialsService.ts` (`getAssignmentDefinitionPartials()`), with payload validation in `src/frontend/src/services/assignmentDefinitionPartials.zod.ts`.

- `deleteAssignmentDefinition` — deletes one assignment definition from both the registry and its dedicated full-definition collection.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `deleteAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.deleteDefinitionByKey()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Required request field: `definitionKey`.
  Validation: `definitionKey` must be a non-empty, already-trimmed string and must not contain `/`, `\`, `..`, or ASCII control characters. Invalid payloads are reported as `INVALID_REQUEST` by the transport.
  Delete behaviour: removes the partial row from `assignment_definitions` and drops the corresponding `assdef_full_<definitionKey>` collection when present. Missing full collections are treated as already deleted, so repeated safe-key deletes remain idempotent.
  Response data: no data payload (`void`) on success.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinitionPartialsService.ts` (`deleteAssignmentDefinition()`).

- `getGoogleClassrooms` — returns active Classroom picker rows for ABClass creation flows.
  Source: `src/backend/z_Api/googleClassrooms.js`, via the `getGoogleClassrooms_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
  Handler behaviour: calls `ClassroomApiClient.fetchAllActiveClassrooms()`, which pages through active Classroom courses, then maps each row to `{ classId, className }`.
  Response data: `Array<{ classId: string, className: string }>`.
  Contract boundary: the payload intentionally omits `teachers`, `students`, `classOwner`, and `enrollmentCode`.
  Validation: malformed Classroom rows raise `ApiValidationError`, so the transport envelope returns `INVALID_REQUEST`.
  Failure nuance: upstream Classroom fetch failures currently log inside `ClassroomApiClient.fetchAllActiveClassrooms()` and return `[]`, so not every upstream Classroom failure becomes a transport error envelope today.

- `upsertABClass` — creates a new ABClass or refreshes an existing one using Classroom data plus user-supplied metadata.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `upsertABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.upsertABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request fields: `classId`, `cohortKey`, `yearGroupKey`, `courseLength`.
  Validation: transport enforces `params` as an object and rejects unsafe `classId` path characters (`..`, `/`, `\`) when `classId` is supplied as a string; controller validation owns required-field completeness, non-empty `classId`, and `courseLength` integer/range checks.
  Write-path behaviour: hydrates `className`, `classOwner`, `teachers`, and `students` from Google Classroom. When the class already exists, the controller refreshes the roster and preserves existing `assignments`.
  Response data: the partial class summary returned by `ABClass.toPartialJSON()`, not the full class document. `students` and `assignments` are not returned.

- `updateABClass` — applies a lightweight patch to editable ABClass fields.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `updateABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.updateABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request field: `classId`.
  Optional patch fields: `cohortKey`, `yearGroupKey`, `courseLength`, `active`.
  Forbidden request fields: `classOwner`, `teachers`, `students`, `assignments`.
  Validation: transport enforces `params` as an object, rejects unsafe `classId` path characters when `classId` is a string, blocks forbidden fields, and requires `active` to be boolean or `null` when supplied; controller validation owns non-empty `classId` and `courseLength` integer/range checks.
  Existing-class behaviour: updates only the supplied patch fields, persists the partial registry row, and does not mutate the excluded fields.
  Missing-class behaviour: throws `RangeError`; `updateABClass` is not an upsert path.
  Response data: the same partial class summary shape used by `upsertABClass()`.

- `deleteABClass` — deletes the stored class record and its class-partial registry row.
  Source: `src/backend/z_Api/abclassMutations.js`, via the `deleteABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.deleteABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request field: `classId`.
  Validation: transport enforces `params` as an object and rejects unsafe `classId` path characters when `classId` is a string; controller validation owns missing, non-string, and non-empty `classId` checks.
  Controller behaviour: deletes the full-class collection with `dropCollection(classId)` and removes the matching `abclass_partials` row with `deleteOne({ classId })`.
  Response data: `{ classId, fullClassDeleted, partialDeleted }`.
  Idempotency: repeated deletes succeed and the boolean flags report what was deleted in that call only.

- Cohort reference data — exposes `getCohorts`, `createCohort`, `updateCohort`, and `deleteCohort`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `cohorts` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`).
  List, create, and update responses return plain `{ key, name, active, startYear, startMonth }` objects with storage metadata such as `_id` stripped at the controller boundary. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.

- Year-group reference data — exposes `getYearGroups`, `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `year_groups` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`).
  List, create, and update responses return plain `{ key, name }` objects with storage metadata removed. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.
