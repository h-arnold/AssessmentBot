# Backend API Layer (`src/backend/Api`)

## Purpose

`src/backend/Api` is the destination for Google Apps Script global functions invoked by the React frontend via `google.script.run`.

This is an active migration area. During migration, some entry points still exist in legacy backend `globals.js` files.

This layer is deliberately REST-ish in structure:

- group functions by domain/resource
- keep endpoint-style naming coherent within each file
- use each `.js` file as an API surface for a specific capability area

## Design Rules

1. Keep API functions as thin as possible.
2. Delegate business logic to the appropriate controller class by default.
3. Only keep logic in API functions when delegation would create unnecessary verbosity with no architectural benefit.
4. Validate direct inputs and fail fast; do not hide backend wiring errors.
5. Keep function names stable once used by frontend callers (`google.script.run.<name>`).

## Relationship to `globals.js`

Legacy backend `globals.js` files are currently retained for reference only during migration.

- `src/backend/AssignmentProcessor/globals.js`
- `src/backend/ConfigurationManager/globals.js`
- `src/backend/y_controllers/globals.js`

Migration rule:

- when an equivalent function is implemented in `src/backend/Api`, remove the legacy `globals.js` variant.
- do not add new functionality to legacy `globals.js` files.

## Testing Guidance

- Test API-layer functions as boundary wrappers: parameter handling, controller delegation, and error propagation.
- Keep heavy business-logic tests at controller/service level.
- Do not call live GAS services in unit tests.

## API handler transport (`apiHandler`)

`src/backend/Api/apiHandler.js` is the canonical transport entrypoint used by frontend `callApi` requests.

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

1. Add the method to `API_METHODS` in `src/backend/Api/apiConstants.js`.
2. Add the method to `API_ALLOWLIST` in `src/backend/Api/apiConstants.js`.
3. Add dispatch handling in `ApiDispatcher._invokeAllowlistedMethod(...)` in `src/backend/Api/apiHandler.js`.
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

### Current migrated endpoints

- `getAuthorisationStatus` — returns current script authorisation status. Source: `src/backend/Api/auth.js`.
  Do not call `google.script.run.getAuthorisationStatus` from frontend feature or service modules.

- `getABClassPartials` — returns all class partial documents from the `abclass_partials` registry.
  Source: `src/backend/Api/abclassPartials.js`. Delegates to `ABClassController.getAllClassPartials()`.
  Frontend wrapper: `src/frontend/src/services/classPartialsService.ts` (`getABClassPartials()`).
  The controller normalises stored records before returning them, so transport consumers receive only the documented class-partial fields and not storage metadata such as `_id`.
  The frontend service models `classOwner` and `teachers` as explicit `TeacherSummary` objects (`userId`, `email`, `teacherName`).
  See `docs/developer/backend/DATA_SHAPES.md` for the class partial shape and persistence strategy.

- Cohort reference data — exposes `getCohorts`, `createCohort`, `updateCohort`, and `deleteCohort`.
  Source: `src/backend/Api/referenceData.js`. Delegates to `ReferenceDataController` CRUD helpers backed by the `cohorts` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`).
  List, create, and update responses return plain `{ name, active }` objects with storage metadata such as `_id` stripped at the controller boundary. Updates use `{ originalName, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete succeeds with no `data` payload.

- Year-group reference data — exposes `getYearGroups`, `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`.
  Source: `src/backend/Api/referenceData.js`. Delegates to `ReferenceDataController` CRUD helpers backed by the `year_groups` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceDataService.ts` (`getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`).
  List, create, and update responses return plain `{ name }` objects with storage metadata removed. Updates use `{ originalName, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete succeeds with no `data` payload.
