# Backend API Layer (`src/backend/z_Api`)

## Purpose

`src/backend/z_Api` contains the Google Apps Script global transport handlers invoked by the React frontend through `apiHandler`.

This is now the canonical backend transport path for frontend-callable methods. Legacy backend `globals.js` transport files should be treated as migration leftovers or deprecated references only.

This layer is deliberately REST-ish in structure:

- group functions by domain/resource
- keep endpoint-style naming coherent within each file
- use each `.js` file as an API surface for a specific capability area

## Shared Helper Status

- ABClass parameters-object validator
  - Status: `Implemented`
  - Location: `validateParametersObject_()` in `src/backend/z_Api/abclass/abclassValidation.js`
  - Behaviour: shared primitive for the `abclass/` domain folder; validates that the parameters argument is a plain object (not an array). Referenced via `/* global validateParametersObject_ */` from `abclassMutations.js` and `abclassRead.js`.
- Assignment-definition upsert request validator
  - Status: `Implemented`
  - Location: `validateUpsertParameters_()` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Behaviour: owns request-shape validation, optional update-key safety, and structural `taskWeightings` array validation for `upsertAssignmentDefinition` without duplicating controller business rules.
- Assignment-definition read request validator
  - Status: `Implemented`
  - Location: `validateReadParameters_()` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Behaviour: owns safe-key validation for full-definition reads by `definitionKey`.
- Assignment-definition full-definition response mapper
  - Status: `Removed`
  - Location: `toCanonicalTransportDefinition_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Note: Replaced by direct use of `controller.toCanonicalFullDefinitionResponse(definition)`.
- Assignment-definition partial row serializer
  - Status: `Removed`
  - Location: `toPlainPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Note: Replaced by `toTransportPartialRow_` helper.
- Assignment-definition upsert payload builder
  - Status: `Removed`
  - Location: `buildControllerUpsertPayload_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Note: URL-to-ID translation inlined into `upsertAssignmentDefinition_` without `assignmentWeighting` defaulting logic.
- Assignment-definition upsert context builder
  - Status: `Removed`
  - Location: `_buildUpsertContext` in `src/backend/y_controllers/AssignmentDefinitionController.js`
  - Note: Logic moved into `upsertDefinition` method body.
- Assignment-definition creation method
  - Status: `Removed`
  - Location: `ensureDefinition` in `src/backend/y_controllers/AssignmentDefinitionController.js`
  - Note: Removed per architectural decision; `upsertDefinition` is the sole creation/update method.
- AssignmentDefinition yearGroup field
  - Status: `Removed`
  - Location: `yearGroup` parameter and property in `src/backend/Models/AssignmentDefinition.js`
  - Note: Deprecated in favour of `yearGroupKey` only.
- Assignment-definition transport partial row helper
  - Status: `Implemented`
  - Location: `toTransportPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
  - Note: New transport-boundary helper that accepts model instance, calls `definition.toPartialJSON()`, defensively strips `yearGroup`, and normalises Date fields.

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
`deleteAssignmentDefinition_`, `upsertAssignmentDefinition_`, `getBackendConfig_`, `setBackendConfig_`,
`upsertABClass_`, `updateABClass_`, `deleteABClass_`, `getABClass_`, and `startAssessmentRun_`.

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

### Assignment-definition upsert validation split (`upsertAssignmentDefinition`)

Status: `Implemented`

`upsertAssignmentDefinition` now uses a transport validator in `src/backend/z_Api/assignmentDefinitionPartials.js` that owns only transport-boundary checks, while `AssignmentDefinitionController.upsertDefinition()` owns the domain contract.

Transport helper ownership:

- require `params` to be a plain object
- require transport-presence of `primaryTitle`, `primaryTopicKey`, `referenceDocumentId`, and `templateDocumentId`
- accept `definitionKey` as absent/`null` for create and as an already-trimmed safe string for update
- validate the structural shape of `taskWeightings` when supplied (`Array` entries with transport-safe `taskId` and required `taskWeighting` fields)
- reject malformed container types, unsafe identifier strings, and control-character payloads before controller delegation

Controller ownership:

- reject blank `primaryTitle`, unknown `primaryTopicKey`, invalid `yearGroupKey`, identical source documents, unknown update targets, duplicate business-identity tuples, and invalid task-weighting references
- require `documentType` on create, reuse the stored `documentType` on update when omitted, generate a stable opaque `definitionKey` on create, and preserve the stored key on update
- resolve `primaryTopic` from authoritative assignment-topic reference data rather than treating copied topic strings as the source of truth
- parse or refresh tasks, apply assignment/task weighting values, and manage rollback when registry persistence fails after the full-store write

The transport layer does not derive or rotate `definitionKey` from metadata.

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
- Error: `{ ok: false, requestId, error: { code, message, retriable, details? } }`

The `details` field is optional and only present when the error carries structured metadata (for example, `DefinitionStaleError` includes `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`). When `details` is absent, it is omitted from the envelope entirely — callers should treat it as `undefined`.

**`data` coercion contract:** The `_success()` method in `z_apiHandler.js` wraps handler return data with `data: data ?? null`. This means `undefined` values (including implicit returns from void handlers) become `null` in the success envelope. The frontend transport layer (`apiService.ts`) always receives `data: null` for void backend methods, never a missing `data` key.

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
- `DefinitionStaleError` -> `DEFINITION_STALE` (non-retriable; includes `details` block with `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`)
- errors thrown with `reason === 'IN_USE'` -> `IN_USE` (used by `ReferenceDataController` when a cohort, year group, or assignment topic cannot be deleted because it is still referenced by persisted records)

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

### ⚠️ Critical: prohibited types in `google.script.run` return values

`google.script.run` prohibits `Date`, `Function`, and DOM elements in both **parameters and
return values** — including inside nested objects and arrays. If any value in the response graph
is a live `Date` object (not an ISO string), GAS falls back to `Object.toString()` serialisation,
producing non-JSON output (Java `HashMap.toString()` format with `=` separators instead of `:`)
that breaks `JSON.parse()` and causes the frontend to receive `null`.

Reference: https://developers.google.com/apps-script/guides/html/reference/run
(myFunction section: prohibited types in parameters; return value note confirms same restrictions.)

**Backend rules:**

1. Convert live `Date` objects to ISO 8601 strings at the API boundary using
   `DateUtils.normaliseDateFields(response, ['field1', 'field2'])` — apply the call after the
   controller returns and before the response reaches `apiHandler` / `ALLOWLISTED_METHOD_HANDLERS`.
   `DateUtils` lives at `src/backend/Utils/DateUtils.js`.
2. Never return `Function` instances or DOM element references.
3. Ensure all array/object fields are plain JS arrays/objects, not Java-backed types that GAS
   cannot serialise (e.g. `[Ljava.lang.Object;@...` references from Drive API wrappers).
4. Test return values by inspecting `typeof` and `.constructor.name` at the transport boundary
   when diagnosing unexpected `null` responses.

### Current migrated endpoints

- `getBackendConfig` and `setBackendConfig` — canonical backend configuration transport methods.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `getBackendConfig_()` and `setBackendConfig_()` in `src/backend/z_Api/apiConfig.js`.
  Frontend wrapper: `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts`, with request and response validation in `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`.
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
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/classPartialsService.ts` (`getABClassPartials()`).
  Handler behaviour: instantiates `ABClassController` inside the inline closure at call time.
  The controller normalises stored records before returning them, so transport consumers receive only the documented class-partial fields and not storage metadata such as `_id`.
  The frontend service models `classOwner` and `teachers` as explicit `TeacherSummary` objects (`userId`, `email`, `teacherName`).
  See `docs/developer/backend/DATA_SHAPES.md` for the class partial shape and persistence strategy.

- `getABClass` — reads a stored class document and returns a transport-ready plain object with partial assignments (no Classroom API calls, no storage mutation).
  Source: `src/backend/z_Api/abclass/abclassRead.js`, via the `getABClass_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.readClass()` in `src/backend/y_controllers/ABClassController.js`.
  Required request field: `classId`.
  Validation: the helper validates `parameters` is a plain object via the shared `validateParametersObject_` primitive. `classId` must be a non-empty, already-trimmed string without path characters (`/`, `\`, `..`) or ASCII control characters (code points 0–31 and 127). Invalid payloads are reported as `INVALID_REQUEST` by the transport.
  Handler behaviour: calls `new ABClassController().readClass(classId)`. Returns the controller's shaped response (produced by the private `_toReadView` method) on success. Catches `ClassNotFoundError` explicitly and returns `null`. Re-throws all other errors.
  Response shape is produced by `ABClassController._toReadView()` — see `docs/developer/backend/DATA_SHAPES.md` for the full shape.
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` (`getABClass()`), with response validation in `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`.
  Query factory: `getABClassQueryOptions(classId)` in `src/frontend/src/query/sharedQueries.ts` (not included in startup warmup — per-class query).

- `getAssignmentDefinitionPartials` — returns assignment-definition registry rows for the Assignments page without loading task artifacts.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `getAssignmentDefinitionPartials_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.getAllPartialDefinitions()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Response data: `Array<{ primaryTitle, primaryTopic, primaryTopicKey, yearGroupKey, yearGroupLabel, alternateTitles, alternateTopics, documentType, referenceDocumentId, templateDocumentId, assignmentWeighting, definitionKey, tasks: null, createdAt: string | null, updatedAt: string | null }>` inside the standard success envelope.
  Registry contract: rows come from the lightweight `assignment_definitions` collection and intentionally keep `tasks` fixed to `null`; `primaryTopicKey` is authoritative, `primaryTopic` is the resolved label, and `referenceLastModified` / `templateLastModified` are not part of the partial transport shape.
  Validation: the helper rejects malformed rows with `ApiValidationError` when required fields are missing, `definitionKey` or `primaryTopicKey` are blank or untrimmed, `createdAt` / `updatedAt` are not `string | null`, non-null timestamps are not strict ISO datetime strings with timezone information, or `tasks` is not `null`.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` (`getAssignmentDefinitionPartials()`), with payload validation in `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`.

- `getGoogleClassroomAssignments` — fetches Google Classroom coursework/assignments for a given class and normalises to transport format.
  Source: `src/backend/z_Api/googleClassroomAssignments.js`, via the `getGoogleClassroomAssignments_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ClassroomApiClient.fetchCourseWork()` in `src/backend/GoogleClassroom/ClassroomApiClient.js`.
  Required request field: `classId`.
  Validation: `classId` must be a non-empty, already-trimmed string without path characters (`/`, `\`, `..`) or ASCII control characters (code points 0–31 and 127). Invalid payloads are reported as `INVALID_REQUEST` by the transport. Malformed Classroom API response rows are reported as `ApiValidationError`.
  Handler behaviour: calls `ClassroomApiClient.fetchCourseWork(classId)`, maps each course-work item to `{ assignmentId, title }`.
  Frontend wrapper: `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts` (`getGoogleClassroomAssignments()`), with response validation in `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.spec.ts`.

- `deleteAssignmentDefinition` — deletes one assignment definition from both the registry and its dedicated full-definition collection.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `deleteAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.deleteDefinitionByKey()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Required request field: `definitionKey`.
  Validation: `definitionKey` must be a non-empty, already-trimmed string and must not contain `/`, `\`, `..`, or ASCII control characters. Invalid payloads are reported as `INVALID_REQUEST` by the transport.
  Delete behaviour: removes the partial row from `assignment_definitions` and drops the corresponding `assdef_full_<definitionKey>` collection when present. Missing full collections are treated as already deleted, so repeated safe-key deletes remain idempotent.
  Response data: no data payload (`void`) on success.
  Frontend wrapper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` (`deleteAssignmentDefinition()`).

- `upsertAssignmentDefinition` — creates or updates a full assignment definition and synchronised registry partial.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `upsertAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.upsertDefinition()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Transport-required request fields: `primaryTitle`, `primaryTopicKey`, `referenceDocumentId`, and `templateDocumentId`.
  Optional request fields: `definitionKey`, `yearGroupKey`, `alternateTitles`, `alternateTopics`, `documentType`, `assignmentWeighting`, and `taskWeightings`.
  Validation split: the transport helper enforces request shape, safe-key rules for `definitionKey` and `taskWeightings[].taskId`, and structural `taskWeightings` shape; the controller owns topic membership, duplicate-tuple rejection, numeric weighting rules, document-type rules, task-ID matching, and persistence semantics.
  Frontend validation split: the frontend Zod `UpsertAssignmentDefinitionRequestSchema` enforces a `superRefine` mutual-exclusion rule between the URL-shape (`referenceDocumentUrl` + `templateDocumentUrl`) and the ID-shape (`referenceDocumentId` + `templateDocumentId` + `documentType`). Payloads with neither shape, only partial URL fields, or only partial ID fields are rejected before the payload reaches the backend. The wizard's existing URL-shape payload continues to pass without modification; the link-to-existing-definition flow uses the ID-shape payload.
  Create behaviour: when `definitionKey` is absent or `null`, the controller requires `yearGroupKey` and `documentType` (or derives it from URLs when URL-based transport is used), parses tasks from the source documents, resolves `primaryTopic` from `assignment_topics`, generates a stable opaque `definitionKey`, and writes both the full store (`assdef_full_<definitionKey>`) and the registry partial (`assignment_definitions`). This is the stage-one create persistence path.
  Update behaviour: when `definitionKey` is present, the controller preserves the stored key, reuses the stored `documentType` when omitted, reparses only when source document IDs changed or refresh is required, and reapplies stored or supplied task weightings before persistence. Re-parse transport behaviour applies when document URLs change: existing task weightings are preserved for matching task IDs, and new tasks default to `1`.
  Final-save persistence behaviour: metadata and weighting edits are persisted through the same `upsertAssignmentDefinition` transport, with duplicate detection enforced on tuple-changing saves using the normalised `(primaryTitle, primaryTopicKey, yearGroupKey)` business identity.
  Response data: the canonical full-definition response shape, including resolved `primaryTopic`, stable `definitionKey`, full `tasks` array, `yearGroupKey`, `yearGroupLabel`, `referenceDocumentId`, `templateDocumentId`, `documentType`, `assignmentWeighting`, `createdAt`, and `updatedAt`. This same response shape is returned for stage-one create, final save, and document-change re-parse so the frontend can keep one editable entity model.

- `getAssignmentDefinition` — reads one full assignment definition by key.
  Source: `src/backend/z_Api/assignmentDefinitionPartials.js`, via the `getAssignmentDefinition_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentDefinitionController.getDefinitionByKey()` in `src/backend/y_controllers/AssignmentDefinitionController.js`.
  Required request field: `definitionKey` (non-empty, already-trimmed string with path-character safety enforced at transport boundary).
  Validation: transport enforces `params` object shape, `definitionKey` presence, and safe-key contract using `validateReadParameters_()`; controller performs lookup and returns the stored full definition.
  Response data: the canonical full-definition response shape, identical to `upsertAssignmentDefinition` response, including resolved `primaryTopic`, `primaryTopicKey`, `yearGroupKey`, `yearGroupLabel`, full `tasks` array, and all metadata. This ensures `upsertAssignmentDefinition` and `getAssignmentDefinition` share the same canonical editable entity contract.

- `startAssessmentRun` — starts an assessment run for an existing assignment definition.
  Source: `src/backend/z_Api/assignmentAssessment.js`, via the `startAssessmentRun_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `AssignmentController.startAssessmentRun()` in `src/backend/y_controllers/AssignmentController.js`.
  Required request fields: `definitionKey`, `assignmentId`, `courseId` (all non-empty strings).
  Validation: transport enforces `params` object shape, required field presence, and non-empty string checks using `Validate.requireParams` and `Validate.validateNonEmptyString`; controller owns per-document freshness checks via `Utils.isNewer`, definition lookup, and ABClass resolution.
  Controller behaviour: fetches the full definition by key, checks that neither the reference nor template document has been modified since the definition was created (throwing `DefinitionStaleError` if stale), resolves the ABClass via `loadClass(courseId)` (which throws if the class does not exist), and delegates to `startProcessing()` to create the time-based trigger with context stored in `UserProperties` via `GASPropertiesUtils`.
  Response data: `null` on success (no data payload; wrapped in standard success envelope).
  Error codes: `DEFINITION_STALE` (non-retriable, with `details` block), `INVALID_REQUEST` (transport validation failure), `INTERNAL_ERROR` (definition not found, ABClass not found, or other domain errors).

- `getAssignment` — reads a single fully-hydrated assignment by course and assignment id.
  Source: `src/backend/z_Api/assignmentAssessment.js`, via the `getAssignment_()` helper called from `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`. Delegates to `ABClassController.loadClass()` and `ABClassController.rehydrateAssignment()` in `src/backend/y_controllers/ABClassController.js`.
  Required request fields: `courseId` and `assignmentId` (both non-empty, already-trimmed strings with no path/control characters).
  Validation: transport enforces `params` object shape, `courseId` and `assignmentId` presence, non-empty trimmed string, and path-character/control-character safety (using `hasControlCharacters_` global from `assignmentDefinitionValidation.js`); controller owns class existence and assignment existence checks.
  Handler behaviour: loads the ABClass via `new ABClassController().loadClass(courseId)`, delegates to `abClassController.rehydrateAssignment(abClass, assignmentId)` (passing the same `abClass` instance — identity, not structural equality — because the controller mutates it via `_replaceAssignmentInClass`), serialises via `assignment.toJSON()`, defensively strips `progressTracker` at the boundary, and applies `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated'])`. On `AssignmentNotFoundError` thrown by `_loadFullAssignmentDocument`, returns `null` (caught via `instanceof` check); all other errors from `rehydrateAssignment` propagate.
  Logging: `info` before loading ABClass (`"getAssignment: loading full assignment"` with `{ courseId, assignmentId }`), `info` after successful rehydration (`"getAssignment: rehydrated assignment"`), `warn` for not-found (`"getAssignment: assignment not found"` — `warn`, not `error`, because the API returns `null` gracefully), `error` for other failures (`"getAssignment failed"` with `{ courseId, assignmentId, err }`).
  Response data: the complete `Assignment.toJSON()` shape — `courseId`, `assignmentId`, `assignmentName`, `dueDate` (ISO string or `null`), `lastUpdated` (ISO string or `null`), `documentType`, `referenceDocumentId`, `templateDocumentId`, `tasks`, `submissions` (full artifacts, assessments, feedback), and `assignmentDefinition`. Or `null` when no persisted assignment document exists.
  Error codes: `INVALID_REQUEST` (transport validation failure: non-object params, missing fields, unsafe characters). `INTERNAL_ERROR` (class not found via `loadClass` — `ClassNotFoundError` with structured `courseId` metadata — corrupt assignment document, partial-definition rejection, assignment-not-in-class, or any other `rehydrateAssignment` failure). No new error code is introduced for not-found — the handler returns `null` for that case (catching the `AssignmentNotFoundError` typed error before it can reach the dispatcher's error envelope).

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
  Frontend wrapper: `src/frontend/src/services/referenceData/referenceDataService.ts` (`getCohorts()`, `createCohort()`, `updateCohort()`, `deleteCohort()`).
  List, create, and update responses return plain `{ key, name, active, startYear, startMonth }` objects with storage metadata such as `_id` stripped at the controller boundary. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.

- Year-group reference data — exposes `getYearGroups`, `createYearGroup`, `updateYearGroup`, and `deleteYearGroup`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `year_groups` JsonDbApp collection.
  Frontend wrapper: `src/frontend/src/services/referenceData/referenceDataService.ts` (`getYearGroups()`, `createYearGroup()`, `updateYearGroup()`, `deleteYearGroup()`).
  List, create, and update responses return plain `{ key, name }` objects with storage metadata removed. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload.

- Assignment-topic reference data — exposes `getAssignmentTopics`, `createAssignmentTopic`, `updateAssignmentTopic`, and `deleteAssignmentTopic`.
  Source: inline closures in `src/backend/z_Api/z_apiHandler.js` delegating to `ReferenceDataController` CRUD helpers backed by the `assignment_topics` JsonDbApp collection.
  List, create, and update responses return plain `{ key, name }` objects with storage metadata removed. Updates use `{ key, record }`, and duplicate detection is based on `record.name.trim().toLowerCase()` while preserving submitted display casing.
  Delete requests are key-based and succeed with no `data` payload when unused.
  Delete-blocked contract: when one or more assignment definitions still reference the topic via `assignment_definitions.primaryTopicKey`, `ReferenceDataController` throws a plain error with `reason === 'IN_USE'`, and `apiHandler` maps that to the standard `{ ok: false, error: { code: 'IN_USE', ... } }` envelope.
