# `getAssignment` API Endpoint Specification

## Status

- Implemented v1.0
  Implemented 2026-06-15. See ACTION_PLAN.md for delivery history.

## Purpose

This document defines the intended behaviour for a new backend API endpoint that returns a single
fully-hydrated Assignment object by course and assignment identifiers.

The endpoint will be used to:

- fetch complete assignment data (tasks, student submissions, artifacts, assessments, feedback)
  for frontend visualisation pages
- enable parallel fetching of multiple assignments from the frontend by calling this endpoint once
  per assignment

This endpoint is **not** intended to:

- return a collection of assignments in a single call — the frontend will make parallel calls
- trigger, modify, or delete assignments — this is read-only
- return partial/lightweight assignment summaries — use the existing ABClass partials for that
- replace or alter the existing `startAssessmentRun` or `getGoogleClassroomAssignments` endpoints

## Agreed product decisions

1. **Method name**: `getAssignment` (singular). Takes `{ courseId, assignmentId }` and returns one
   full Assignment.
2. **Internal delegation**: Uses `ABClassController.rehydrateAssignment(abClass, assignmentId)` to
   load the full assignment from its dedicated collection (`assign_full_<courseId>_<assignmentId>`).
3. **Response shape**: Returns the complete `Assignment.toJSON()` shape with all nested data
   (tasks, submissions, artifacts, assessments, feedback). All `Date` objects are
   converted to ISO 8601 strings before transport.
4. **Not-found behaviour**: Returns `null` when no persisted assignment exists for the given
   course/assignment pair, consistent with the `null` return of the existing
   `getAssignmentDefinition_` handler on definition-not-found. Note that `getAssignment_` has
   an additional failure mode that `getAssignmentDefinition_` does not: if the ABClass itself
   cannot be loaded via `loadClass(courseId)`, the resulting error propagates as
   `INTERNAL_ERROR` (not as `null`), because the class must exist for the endpoint to be
   meaningful.
5. **Parallel frontend fetching**: The frontend will call this endpoint once per assignment in
   parallel rather than relying on a backend-collection endpoint.
6. **Typed not-found error**: The not-found case is signalled by a dedicated
   `AssignmentNotFoundError` thrown from `ABClassController._loadFullAssignmentDocument` (in place
   of the current generic `Error`). The API handler catches this typed error and returns `null`.
   This replaces the previous substring-on-error-message approach: the typed error is robust to
   future changes in the controller's error message and is structurally testable via `instanceof`.
   The new error type is an internal transport signal (not mapped to a user-visible error code in
   `_mapErrorToFailureEnvelope`) — it is caught and null-converted at the API boundary.
7. **`progressTracker` strip at the API boundary**: The handler defensively deletes the
   `progressTracker` field from the serialised response (and any other transient, non-`toJSON`
   field) before returning. `Assignment.toJSON()` already omits `progressTracker` per its JSDoc;
   the explicit strip at the boundary is defence-in-depth against a future change to
   `Assignment.toJSON()` that might inadvertently re-introduce `progressTracker` into the
   serialised output. The new `AssignmentNotFoundError` follows the existing pattern
   (`src/backend/Utils/ErrorTypes/DefinitionStaleError.js`): extends `Error`, sets `this.name`,
   accepts domain-specific options in the constructor, and includes a guarded `module.exports`
   block for Node test compatibility. The new error class does **not** accept a `cause`
   parameter — `DefinitionStaleError` does not, and the only throw site
   (`_loadFullAssignmentDocument`) has no wrapped error to pass.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` in `z_Api/z_apiHandler.js` is the sole transport entry point. The new method must
  be registered in `ALLOWLISTED_METHOD_HANDLERS`.
- All functions callable via `google.script.run` must use the trailing-underscore pattern to prevent
  GAS global exposure.
- `Date` objects are prohibited in `google.script.run` return values. All must be converted to ISO
  8601 strings at the transport boundary via `DateUtils.normaliseDateFields`.
- Transport-boundary validation belongs in the API-layer trailing-underscore helper; domain
  invariants belong in the controller.
- `ABClassController.rehydrateAssignment` requires a loaded ABClass instance. The API handler
  must load the ABClass for the given `courseId` before delegating.

### Current data-shape constraints

- Full assignments are persisted in dedicated collections named `assign_full_<courseId>_<assignmentId>`.
- The `Assignment.toJSON()` method produces the canonical serialisation shape. It already converts
  `dueDate` and `lastUpdated` to ISO strings, and submission-level dates (`createdAt`, `updatedAt`)
  are stored as strings.
- `ABClassController._loadFullAssignmentDocument` throws a dedicated `AssignmentNotFoundError`
  (defined in `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`) when the full assignment
  document is not found in its dedicated collection. The error message retains the existing
  diagnostic format (`No document found in collection ${collectionName} for courseId=${courseId},
assignmentId=${assignmentId}.`) and the error carries structured metadata as instance
  properties `this.courseId`, `this.assignmentId`, and `this.collectionName` for downstream
  diagnostics. Other errors from `rehydrateAssignment` (e.g. corrupt document from
  `_validateAssignmentDocument`, partial-definition rejection from `_ensureFullDefinition`,
  assignment-not-in-class from `_replaceAssignmentInClass`) are unaffected and must still
  propagate as internal errors — the handler's catch is scoped to
  `instanceof AssignmentNotFoundError` only.

### Frontend or consumer architecture constraints

- The frontend service will later call this endpoint via `callApi` in `apiService.ts`.
- The frontend will need a Zod schema for the response shape. This is deferred to the frontend
  work that uses this endpoint — it is out of scope for this backend-only change.
- There is no existing Zod schema for a full Assignment response; one will be created when the
  frontend pages are built.

## Domain and contract recommendations

### Why this approach is preferable

- **Reuse over duplication**: Delegates to the existing `rehydrateAssignment` method rather than
  duplicating collection-access logic.
- **Consistency**: Matches the `getAssignmentDefinition_` handler / `getAssignmentDefinition`
  allowlist entry pattern (single-entity read, returns `null` on not-found, uses
  `DateUtils.normaliseDateFields` at the boundary).
- **Simplicity**: A single-assignment endpoint is simpler to implement, test, and reason about
  than a collection endpoint that must handle partial failures across multiple assignment loads.
- **Parallelism**: The frontend can fetch multiple assignments concurrently via parallel
  `google.script.run` calls, avoiding synchronous backend iteration.

### Recommended data shapes

#### Request (`getAssignment`)

```ts
{
  courseId: string; // non-empty, already-trimmed, no path/control characters
  assignmentId: string; // non-empty, already-trimmed, no path/control characters
}
```

#### Response (success — full Assignment)

Returns the output of `Assignment.toJSON()` — see `src/backend/AssignmentProcessor/Assignment.js`
for the canonical serialisation shape. The key structure is:

```ts
{
  courseId: string;
  assignmentId: string;
  assignmentName: string;
  dueDate: string | null; // ISO 8601 or null
  lastUpdated: string | null; // ISO 8601 or null
  documentType: 'SLIDES' | 'SHEETS' | null;
  referenceDocumentId: string | null;
  templateDocumentId: string | null;
  tasks: Record<string, TaskDefinition> | null;
  submissions: Array<StudentSubmission>; // full artifacts, assessments, feedback
  assignmentDefinition: object; // full AssignmentDefinition.toJSON() shape
}
```

#### Response (not found)

```ts
null;
```

### Naming recommendation

Prefer:

- `getAssignment` — consistent with `getAssignmentDefinition` (singular reads)
- `courseId` + `assignmentId` — matches existing field names in ABClassController persistence

Avoid:

- `getFullAssignment` — all API responses should be "full" unless explicitly named "partials"

### Validation recommendation

#### Backend

- Validate `parameters` is a plain non-array object (transport shape).
- Validate `courseId` and `assignmentId` are present, non-empty, already-trimmed strings using
  `Validate.requireParams` and `Validate.validateNonEmptyString` — inline pattern consistent with
  the existing `startAssessmentRun_` handler in the same file.
- Reject path-traversal characters (`/`, `\`, `..`) using direct `includes()` checks, and reject
  control characters using the shared `hasControlCharacters_()` helper (available as a global from
  `assignmentDefinitionValidation.js` in the GAS concatenated runtime) — pattern matching
  `getGoogleClassroomAssignments_` in `googleClassroomAssignments.js`.
- Domain validation (class existence, assignment existence) is delegated to the controller.

## Feature architecture

### Placement

- **Backend handler**: New trailing-underscore function `getAssignment_` in
  `src/backend/z_Api/assignmentAssessment.js` (co-located with the existing `startAssessmentRun_`).
- **Allowlist entry**: New entry in `ALLOWLISTED_METHOD_HANDLERS` in
  `src/backend/z_Api/z_apiHandler.js`.
- **Controller delegation**: `ABClassController.loadClass(courseId)` → `ABClassController.rehydrateAssignment(abClass, assignmentId)`.
- **No new controller methods or persistence methods are required.**

### Proposed high-level call tree

```text
apiHandler(request)
└── ALLOWLISTED_METHOD_HANDLERS.getAssignment
    └── getAssignment_(parameters)                     // in assignmentAssessment.js
        ├── Validate parameters shape and fields
        ├── new ABClassController().loadClass(courseId)
        ├── abClassController.rehydrateAssignment(abClass, assignmentId)
        │   └── _loadFullAssignmentDocument → _validateAssignmentDocument → Assignment.fromJSON
        ├── assignment.toJSON()                        // serialises with string dates
        ├── DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated'])
        └── return response (or null if not found)
```

### Out of scope for this surface

- Frontend service module, Zod schema, or hook for consuming this endpoint
- Any mutation, creation, or deletion of assignments
- A collection/bulk endpoint returning multiple assignments in one call
- Any UI or page changes

## Data loading and orchestration

### Required datasets or dependencies

- `ABClass` — loaded via `ABClassController.loadClass(courseId)` to satisfy `rehydrateAssignment`'s
  requirement
- `Assignment` — rehydrated from the dedicated `assign_full_<courseId>_<assignmentId>` collection

### Query or transport additions

- `getAssignment` method name registered in `ALLOWLISTED_METHOD_HANDLERS`
- `getAssignment_` trailing-underscore handler in `z_Api/assignmentAssessment.js`
- No new query keys, stores, or collections

## Error, loading, and empty-state rules

### Blocking failure

- Invalid parameters (non-object, missing fields, non-string courseId/assignmentId, unsafe
  characters) → `ApiValidationError` with code `INVALID_REQUEST`.
- ABClass not found for `courseId` → error from `loadClass` propagates as `INTERNAL_ERROR`.
  This is distinct from assignment-not-found (which returns `null`): the class itself must exist
  for the endpoint to be meaningful.
- Corrupt assignment document (missing required fields) → error from `rehydrateAssignment`
  propagates as `INTERNAL_ERROR` (distinct from not-found).

### Not-found state

- No full assignment document exists for the given course/assignment pair → return `null`.
  The API handler catches the `AssignmentNotFoundError` (thrown by
  `_loadFullAssignmentDocument`) using an `instanceof` check and returns `null`. All other
  errors from `rehydrateAssignment` (validation failures, corrupt documents,
  partial-definition rejection, assignment-not-in-class) still propagate as internal errors.
- `loadClass` errors (class not found) also propagate as internal errors — distinct from
  assignment-not-found, because the class itself must exist for the endpoint to be meaningful.

## Backend changes required to support agreed behaviour

1. **New typed error class** (`src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`)
   - Follow the existing pattern from `DefinitionStaleError.js`: extends `Error`, sets
     `this.name = 'AssignmentNotFoundError'`, accepts `{ courseId, assignmentId, collectionName }`
     in the constructor and assigns them to `this.courseId`, `this.assignmentId`,
     `this.collectionName` respectively. Includes a guarded `module.exports` block for Node
     test compatibility. **No `cause` parameter** — the only throw site has no wrapped error
     to pass, and `DefinitionStaleError` does not accept `cause` either.
   - Internal transport signal — not mapped to a user-visible error code in
     `_mapErrorToFailureEnvelope`. Same category as `AbortRequestError` and `PersistError`.

2. **Controller change** (`src/backend/y_controllers/ABClassController.js`,
   `_loadFullAssignmentDocument`)
   - Throw `AssignmentNotFoundError` (in place of the current generic `Error`) when the document
     is not found in the dedicated collection. Preserve the existing diagnostic message format
     and pass the structured metadata `{ courseId, assignmentId, collectionName }`.
   - All other error paths in `_loadFullAssignmentDocument` and downstream in `rehydrateAssignment`
     are unchanged.
   - Add `AssignmentNotFoundError` to the file's `/* global */` comment so the symbol is
     available in the GAS concatenated runtime.

3. **New API handler function** (`getAssignment_` in `src/backend/z_Api/assignmentAssessment.js`)
   - Update the top-of-file `/* global */` comment to include
     `ApiValidationError, Validate, ABClassController, DateUtils, ABLogger,
AssignmentNotFoundError, hasControlCharacters_`.
     (`Assignment` is intentionally **not** included — the handler never constructs one directly;
     it only calls `.toJSON()` on the instance returned by `rehydrateAssignment`. `hasControlCharacters_`
     is included because the handler uses it for unsafe-character validation, matching the
     pattern in `googleClassroomAssignments.js` which already uses this global.)
   - Insert `getAssignment_` immediately after `startAssessmentRun_` and before the
     `if (typeof module !== 'undefined' && module.exports)` block.
   - Validate parameters shape and required string fields (inline pattern matching `startAssessmentRun_`).
   - Reject unsafe characters in identifiers (inline pattern matching `getGoogleClassroomAssignments_`).
   - Log at `info` level before loading ABClass and after successful rehydration, with
     `{ courseId, assignmentId }` context.
   - Load ABClass via `new ABClassController().loadClass(courseId)` and delegate to
     `abClassController.rehydrateAssignment(abClass, assignmentId)`. The same `abClass` instance
     returned by `loadClass` is passed to `rehydrateAssignment` (identity, not structural
     equality) — the controller mutates it via `_replaceAssignmentInClass`.
   - Serialise via `assignment.toJSON()`.
   - Defensively strip transient, non-`toJSON` fields at the boundary (currently `progressTracker`).
     Use a deletion step such as `delete response.progressTracker` immediately after `toJSON()`
     and before `normaliseDateFields()`. Document the rationale in `@remarks` and add a
     regression test that proves a payload containing `progressTracker` is normalised away.
   - Apply `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated'])` at the transport
     boundary. This is **shallow defence-in-depth for root-level fields only**; nested date
     conversion (e.g. `createdAt`/`updatedAt` on `submissions`, `assignmentDefinition`) relies
     on the corresponding `toJSON()` implementations being correct. A regression test in
     `tests/api/assignmentReadApi.test.js` proves the root-level call is wired (mock
     `toJSON()` returns live `Date` objects in `dueDate`/`lastUpdated`).
   - Catch `AssignmentNotFoundError` via `instanceof` check; log at `warn` level (this is an
     expected outcome from the API's perspective — the API returns `null` gracefully, but the
     not-found case is still notable for diagnostics) and return `null`.
   - Catch all other errors; log at `error` level with `{ courseId, assignmentId, err }` and
     re-throw.
   - Export via the guarded `module.exports` block alongside `startAssessmentRun_`:
     `{ startAssessmentRun_, getAssignment_ }`.

4. **Allowlist registration** (`src/backend/z_Api/z_apiHandler.js`)
   - Add `getAssignment: (parameters) => getAssignment_(parameters)` to `ALLOWLISTED_METHOD_HANDLERS`,
     placed between the existing assignment-definition entries and `getGoogleClassroomAssignments`
     for logical grouping.
   - Add the corresponding Node-test compatibility `globalThis.getAssignment_ = ...` line in the
     `if (typeof module !== 'undefined' && module.exports)` block (alongside
     `globalThis.startAssessmentRun_`).

5. **No further changes to** models, persistence, or validation files are required.

## Planning handoff notes

- The handler must be added to the existing `assignmentAssessment.js` file (currently 32 lines
  with only `startAssessmentRun_`), not a new file. This follows the rule from
  `src/backend/AGENTS.md` §11: keep single-file domains flat in `z_Api/` and do not create
  domain folders for them.
- The new `AssignmentNotFoundError` must live at
  `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`, following the pattern from
  `DefinitionStaleError.js`. It is an internal transport signal — not added to
  `_mapErrorToFailureEnvelope` because the handler catches it and returns `null` before the
  envelope is built.
- The not-found catch in the handler is an `instanceof AssignmentNotFoundError` check, scoped
  to the typed error only. Other errors from `rehydrateAssignment` (corrupt documents,
  partial-definition rejection, assignment-not-in-class) must still propagate.
- The `progressTracker` strip is a deliberate, focused defence-in-depth step. Other transient
  fields on `Assignment` (`_hydrationLevel`, etc.) are intentionally out of scope for v1.
- Date normalisation is defence-in-depth: `Assignment.toJSON()` already converts known Date fields
  to ISO strings, but `DateUtils.normaliseDateFields` must still be applied per the canonical
  pattern for root-level fields (`dueDate`, `lastUpdated`).
- `module.exports` must export `getAssignment_` alongside the existing `startAssessmentRun_`.
- The `/* global */` comment at the top of the file must be updated to include
  `ApiValidationError, Validate, ABClassController, DateUtils, ABLogger, AssignmentNotFoundError`.
  Do **not** include `Assignment` (the handler does not construct one directly).
- The controller change in `_loadFullAssignmentDocument` is intentionally minimal: only the
  `throw` is changed from `new Error(...)` to `new AssignmentNotFoundError(...)`. The existing
  diagnostic message and the surrounding `try { ... } catch` block in `rehydrateAssignment`
  are unchanged.

## Testing expectations

- Backend API handler tests (`tests/api/assignmentReadApi.test.js`)
  - Module exports `getAssignment_`
  - `getAssignment_` throws `ApiValidationError` for non-plain-object parameters
  - `getAssignment_` throws `ApiValidationError` for missing `courseId` and missing `assignmentId`
  - `getAssignment_` throws `ApiValidationError` for unsafe characters in `courseId` and
    `assignmentId` (path traversal and control characters via `hasControlCharacters_`)
  - On valid input, `getAssignment_` returns the `toJSON()` output with `dueDate` and
    `lastUpdated` normalised to ISO strings
  - Defence-in-depth regression test: when the mock's `toJSON()` returns live `Date` objects
    in `dueDate` and `lastUpdated`, the handler still returns ISO strings (proves
    `normaliseDateFields` is wired at the boundary)
  - Defence-in-depth regression test: when the mock's `toJSON()` returns a payload containing
    `progressTracker`, the handler strips it from the response (proves the boundary strip is
    wired)
  - On valid input, `loadClass` is called with the correct `courseId` and the same
    `abClass` instance returned by `loadClass` is passed to `rehydrateAssignment` (identity,
    not structural equality)
  - When `rehydrateAssignment` throws an `AssignmentNotFoundError`, the handler returns `null`
    and logs at `warn` level
  - When `rehydrateAssignment` throws a non-`AssignmentNotFoundError` error (e.g. corrupt
    document), the handler re-throws and logs at `error` level
  - When `loadClass` throws, the handler re-throws (class-not-found must not be caught as
    assignment-not-found)
- Backend controller integration: verify `_loadFullAssignmentDocument` throws
  `AssignmentNotFoundError` (not generic `Error`) on the not-found path
- Logging: success path logs at `info` (load + rehydrate), not-found logs at `warn`, other
  failures log at `error` — verified via `ABLogger` spies per
  `docs/developer/backend/backend-testing.md`

## Documentation and rollout notes

- Update `docs/developer/DATA_SHAPES.md` if Assignment response shape is documented there
- Update `docs/developer/backend/backend-logging-and-error-handling.md` to add the new
  `AssignmentNotFoundError` to the list of recognised backend error types (under the
  "internal error types not mapped at the transport boundary" category, alongside
  `AbortRequestError` and `PersistError`). Mark the entry as `Implemented` once the file
  exists; the action plan records a `Not implemented` planned-only entry before that.
- Frontend Zod schema and service module are deferred to the frontend page work

## V1 scope recommendation

### Include in v1

- New `AssignmentNotFoundError` typed error class
- Controller change in `_loadFullAssignmentDocument` to throw the typed error
- `getAssignment_` handler with parameter validation
- Not-found → `null` handling via `instanceof` check
- Date normalisation via `DateUtils.normaliseDateFields`
- `progressTracker` strip at the API boundary
- Allowlist registration in `z_apiHandler.js`

### Defer from v1

- Frontend Zod schema for the full Assignment response shape
- Frontend service function wrapping `callApi('getAssignment', ...)`
- Any UI or page work consuming this endpoint
- Differentiating `loadClass` failure paths from other `INTERNAL_ERROR` cases (auth/permissions
  vs data integrity)
- Differentiating the controller's logging severity between `AssignmentNotFoundError` and
  other `rehydrateAssignment` failures (out of scope per user direction; the existing controller
  catch block continues to log at `error` level for all errors and the handler logs at `warn`
  for not-found, which provides sufficient signal)
- Stripping other transient fields on `Assignment` (e.g. `_hydrationLevel`) at the boundary

## Resolved decisions

1. **Not-found detection**: typed `AssignmentNotFoundError` (instanceof check), not
   substring match. Rationale: robust to message changes; structurally testable.
2. **`loadClass` failure handling**: out of scope to differentiate from other `INTERNAL_ERROR`
   paths for v1. All `loadClass` errors propagate as `INTERNAL_ERROR`.
3. **`progressTracker` boundary strip**: included in v1 as defence-in-depth.
4. **`_replaceAssignmentInClass` failure logging**: no separate logging path. The existing
   controller catch block already logs at `error` level for all `rehydrateAssignment` failures;
   the handler's "getAssignment failed" log at `error` is the second tier. This rare
   data-integrity case is not a hot path, so the existing error log is sufficient.
5. **Per-request info log volume**: accepted as part of the design. The combined controller
   and handler info-level logs per successful `getAssignment` call are within acceptable
   operational log volume; if they become a problem in production, the `ABLogger` log level
   can be raised for that namespace.
