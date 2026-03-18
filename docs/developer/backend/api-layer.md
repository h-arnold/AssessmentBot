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
4. Validate direct inputs and fail fast; do not hide backend wiring errors.
5. Keep allowlisted method names stable once used by frontend callers.

## Relationship to `globals.js`

Legacy backend `globals.js` files are reference-only during migration and are not the authority for new or migrated frontend transport methods.

- `src/backend/AssignmentProcessor/globals.js`
- `src/backend/y_controllers/globals.js`

Configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`; that legacy transport file has been removed. Backend configuration reads and writes now go through `src/backend/z_Api/apiHandler.js`, with allowlisted method names registered in `src/backend/z_Api/apiConstants.js` and implemented in `src/backend/z_Api/apiConfig.js`.

Migration rule:

- when an equivalent function is implemented in `src/backend/z_Api`, remove the legacy `globals.js` variant.
- do not add new functionality to legacy `globals.js` files.

## Testing Guidance

- Test API-layer functions as boundary wrappers: parameter handling, controller delegation, and error propagation.
- Keep heavy business-logic tests at controller/service level.
- Do not call live GAS services in unit tests.

## API handler transport (`apiHandler`)

`src/backend/z_Api/apiHandler.js` is the canonical transport entrypoint used by frontend `callApi` requests.

### Request contract

`apiHandler` accepts a request object with:

- `method` (string, required): allowlisted method name from `API_METHODS`
- `params` (optional): method-specific payload

If the payload is invalid, `apiHandler` returns an `INVALID_REQUEST` envelope and does not throw.

### Response envelope

All responses are envelopes:

- Success: `{ ok: true, requestId, data }`
- Error: `{ ok: false, requestId, error: { code, message, retriable } }`

This envelope shape is stable and should be treated as the transport contract between frontend and backend.

### Dispatch and allowlist pattern

To add a new frontend-callable API method:

1. Add the method to `API_METHODS` in `src/backend/z_Api/apiConstants.js`.
2. Add the method to `API_ALLOWLIST` in `src/backend/z_Api/apiConstants.js`.
3. Add dispatch handling in `ApiDispatcher._invokeAllowlistedMethod(...)` in `src/backend/z_Api/apiHandler.js`.
4. Keep business logic in controllers/services; keep the dispatcher branch thin.

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

Unmapped or malformed errors return `INTERNAL_ERROR` with a generic message.

### Frontend usage pattern

Frontend code should call `callApi` from `src/frontend/src/services/apiService.ts`, not `google.script.run` directly.
Feature services should expose typed helpers per method and return parsed `data` from `callApi`.
Use the allowlisted method names exactly as implemented in `API_METHODS`, for example `callApi('getGoogleClassrooms')`.

### Current migrated endpoints

- `getBackendConfig` and `setBackendConfig` — canonical backend configuration transport methods.
  Source: `src/backend/z_Api/apiConfig.js`. Registered in `src/backend/z_Api/apiConstants.js` and dispatched through `src/backend/z_Api/apiHandler.js`.
  Frontend wrapper: `src/frontend/src/services/backendConfigurationService.ts`, with request and response validation in `src/frontend/src/services/backendConfiguration.zod.ts`.
  Legacy note: configuration transport no longer uses `src/backend/ConfigurationManager/99_globals.js`.

- `getBackendConfig` read data returns the public configuration payload with the following stable fields: `backendAssessorBatchSize`, masked `apiKey`, `hasApiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
  Masking contract: `apiKey` is never returned as the raw stored secret. It is returned as `''`, `'****'`, or `'****'` plus the visible four-character suffix.
  Read-failure contract: when one or more configuration reads fail, the response still returns the payload with fallback values and adds optional `loadError` text. `hasApiKey` reflects whether a raw key was present before masking.

- `setBackendConfig` accepts a partial write payload. Only supplied fields are written.
  Writable patch fields: `backendAssessorBatchSize`, `apiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
  Validation contract: `params` must be an object; malformed payloads are reported by the transport as `INVALID_REQUEST`.
  Save-result contract: `{ success: true } | { success: false, error: string }`.

- Dedicated transport tests for backend configuration live in `tests/api/backendConfigApi.test.js`.
  Keep broader dispatcher coverage in `tests/api/apiHandler.test.js`.

- `getAuthorisationStatus` — returns current script authorisation status. Source: `src/backend/z_Api/auth.js`.
  Do not call `google.script.run.getAuthorisationStatus` from frontend feature or service modules.

- `getABClassPartials` — returns all class partial documents from the `abclass_partials` registry.
  Source: `src/backend/z_Api/abclassPartials.js`. Delegates to `ABClassController.getAllClassPartials()`.
  Frontend wrapper: `src/frontend/src/services/classPartialsService.ts` (`getABClassPartials()`).
  The controller normalises stored records before returning them, so transport consumers receive only the documented class-partial fields and not storage metadata such as `_id`.
  The frontend service models `classOwner` and `teachers` as explicit `TeacherSummary` objects (`userId`, `email`, `teacherName`).
  See `docs/developer/backend/DATA_SHAPES.md` for the class partial shape and persistence strategy.

- `getGoogleClassrooms` — returns active Classroom picker rows for ABClass creation flows.
  Source: `src/backend/z_Api/googleClassrooms.js`. Dispatched through the `apiHandler` allowlist in `src/backend/z_Api/apiHandler.js`.
  Handler behaviour: calls `ClassroomApiClient.fetchAllActiveClassrooms()`, which pages through active Classroom courses, then maps each row to `{ classId, className }`.
  Response data: `Array<{ classId: string, className: string }>`.
  Contract boundary: the payload intentionally omits `teachers`, `students`, `classOwner`, and `enrollmentCode`.
  Validation: malformed Classroom rows raise `ApiValidationError`, so the transport envelope returns `INVALID_REQUEST`.
  Failure nuance: upstream Classroom fetch failures currently log inside `ClassroomApiClient.fetchAllActiveClassrooms()` and return `[]`, so not every upstream Classroom failure becomes a transport error envelope today.

- `upsertABClass` — creates a new ABClass or refreshes an existing one using Classroom data plus user-supplied metadata.
  Source: `src/backend/z_Api/abclassMutations.js`. Delegates to `ABClassController.upsertABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request fields: `classId`, `cohort`, `yearGroup`, `courseLength`.
  Validation: `courseLength` must be an integer greater than or equal to `1`.
  Write-path behaviour: hydrates `className`, `classOwner`, `teachers`, and `students` from Google Classroom. When the class already exists, the controller refreshes the roster and preserves existing `assignments`.
  Response data: the partial class summary returned by `ABClass.toPartialJSON()`, not the full class document. `students` and `assignments` are not returned.

- `updateABClass` — applies a lightweight patch to editable ABClass fields.
  Source: `src/backend/z_Api/abclassMutations.js`. Delegates to `ABClassController.updateABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request field: `classId`.
  Optional patch fields: `cohort`, `yearGroup`, `courseLength`, `active`.
  Forbidden request fields: `classOwner`, `teachers`, `students`, `assignments`.
  Existing-class behaviour: updates only the supplied patch fields, persists the partial registry row, and does not mutate the excluded fields.
  Missing-class behaviour: initialises a new class using upsert-on-update semantics. Unspecified fields keep the `ABClass` model defaults (`courseLength: 1`, `yearGroup: null`, `active: null`).
  Response data: the same partial class summary shape used by `upsertABClass()`.

- `deleteABClass` — deletes the stored class record and its class-partial registry row.
  Source: `src/backend/z_Api/abclassMutations.js`. Delegates to `ABClassController.deleteABClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request field: `classId`.
  Controller behaviour: deletes the full-class collection with `dropCollection(classId)` and removes the matching `abclass_partials` row with `deleteOne({ classId })`.
  Response data: `{ classId, fullClassDeleted, partialDeleted }`.
  Idempotency: repeated deletes succeed and the boolean flags report what was deleted in that call only.

- Cohort reference data — exposes `getCohorts`, `createCohort`, `updateCohort`, and `deleteCohort`.
  Source: `src/backend/z_Api/referenceData.js`. Delegates to `ReferenceDataController` CRUD helpers backed by the `cohorts` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`).
  List, create, and update responses return plain `{ name, active }` objects with storage metadata such as `_id` stripped at the controller boundary. Updates use `{ originalName, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete succeeds with no `data` payload.

- Year-group reference data — exposes `getYearGroups`, `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`.
  Source: `src/backend/z_Api/referenceData.js`. Delegates to `ReferenceDataController` CRUD helpers backed by the `year_groups` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`).
  List, create, and update responses return plain `{ name }` objects with storage metadata removed. Updates use `{ originalName, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete succeeds with no `data` payload.
