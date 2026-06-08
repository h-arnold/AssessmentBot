# Backend Assessment-Start Flow Specification

## Status

- Draft v1.1 (post-review revision)

## Purpose

This document defines the intended behaviour for the backend flow that starts an assessment run from the frontend wizard. It replaces the legacy `saveStartAndShowProgress` global with a proper `apiHandler`-routed method, separates definition creation from run initiation, and replaces silent re-parsing of stale definitions with a structured error.

The feature will be used to:

- start an assessment run from the frontend wizard after an `AssignmentDefinition` has already been created
- validate that the stored definition is still fresh before creating a time-based trigger
- serve as the API contract between the frontend wizard and the backend assessment pipeline

This feature is **not** intended to:

- change how `AssignmentDefinition` instances are created or persisted (that flow is already working and stays as-is)
- alter the assessment pipeline stages (`populateTasks`, `fetchSubmittedDocuments`, `processAllSubmissions`, `assessResponses`, etc.)
- calculate or surface averages, readiness data, or any display-oriented metrics to the user
- change the frontend wizard UI itself (that is a separate workstream)

## Agreed product decisions

1. The new backend API method is `startAssessmentRun`. It accepts `{ definitionKey, assignmentId, courseId }`. No document IDs or title needed — the definition already exists in the registry.
2. When the stored definition's reference or template document has been modified since the definition was created (`definitionNeedsRefresh` returns true), the controller throws a structured `DefinitionStaleError` instead of silently re-parsing.
3. `saveStartAndShowProgress` is removed from both `AssignmentController` and `AssignmentProcessor/globals.js`. The legacy HTML UI that calls it is deprecated and will be removed separately.
4. `createDefinitionFromWizardInputs` stays as-is (already working) and gets wired into the `apiHandler` allowlist as a separate method.
5. Trigger context (`assignmentId`, `definitionKey`, `triggerId`, `courseId`) is stored in `UserProperties` instead of `DocumentProperties`.
6. The `courseId` parameter is accepted from the frontend (the class context is known) and validated by loading the corresponding `ABClass` in the controller.
7. The stale-definition check happens at the API boundary (before trigger creation) and also at trigger-execution time in `runAssignmentPipeline` — both throw `DefinitionStaleError`. The trigger-side throw is logged as a user-facing error via `ProgressTracker` and will not silently re-parse.
8. `ABClassController.loadClass` is changed to throw when no stored class exists, instead of auto-initialising a new empty class. `upsertABClass` (used by the Settings page for class creation) is unaffected — it already handles the create-vs-update decision explicitly via `initialise`. This aligns `loadClass` with `updateABClass`'s existing fail-fast pattern.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` / `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js` is the sole transport entry point for all new backend methods.
- `AssignmentController` already has `createDefinitionFromWizardInputs`, `ensureDefinitionFromInputs`, `startProcessing`, `processSelectedAssignment`, `createAssignmentInstance`, and `runAssignmentPipeline`.
- `AssignmentDefinitionController.upsertDefinition` is the canonical definition creation/update method and is not changing.
- `Assignment.create()` is the factory for `Assignment` instances and is not changing.
- `Utils.definitionNeedsRefresh` already exists and is the canonical freshness check.

### Current data-shape constraints

- `AssignmentDefinition` shape includes: `definitionKey`, `primaryTitle`, `primaryTopic`, `primaryTopicKey`, `yearGroupKey`, `yearGroupLabel`, `documentType`, `referenceDocumentId`, `templateDocumentId`, `referenceLastModified`, `templateLastModified`, `assignmentWeighting`, `tasks`, `alternateTitles`, `alternateTopics`, `createdAt`, `updatedAt`.
- `Assignment` stores `assignmentDefinition` as an embedded `AssignmentDefinition` instance.
- Time-based triggers use `TriggerController` and store context in `PropertiesService`.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls go through `callApi` → `apiHandler` → allowlisted method handlers.
- The frontend wizard (`AssessTaskModal`) currently only selects a Google Classroom assignment; it will be extended in a future workstream to include the full definition-creation steps.

## Domain and contract recommendations

### Why this approach is preferable

- Separates definition creation (idempotent, can be retried) from run initiation (creates a trigger, has side effects).
- The structured `DefinitionStaleError` lets the frontend catch and prompt the user to re-create the definition rather than failing silently or with a generic message.
- Removing `saveStartAndShowProgress` eliminates a legacy global that bypasses the `apiHandler` transport boundary.
- `UserProperties` is the correct scope for trigger context because it is user-scoped rather than document-scoped.

### Recommended data shapes

#### `startAssessmentRun` request

```ts
{
  definitionKey: string; // stable key of the existing AssignmentDefinition
  assignmentId: string; // Google Classroom coursework ID
  courseId: string; // Google Classroom course ID (matches an ABClass)
}
```

#### `startAssessmentRun` success response

The handler returns `null` (no payload). The `apiHandler` transport layer wraps this in the standard envelope `{ ok: true, requestId, data: null }`. Handler closures must return plain data, never envelope shapes.

#### `DefinitionStaleError`

```ts
{
  name: 'DefinitionStaleError';
  message: string; // human-readable message
  definitionKey: string; // which definition is stale
  referenceStale: boolean; // whether the reference document changed
  templateStale: boolean; // whether the template document changed
  referenceLastModified: string | null; // ISO timestamp from Drive (current)
  templateLastModified: string | null; // ISO timestamp from Drive (current)
}
```

This error type follows the existing pattern used by `ApiValidationError`, `ApiRateLimitError`, etc. in `src/backend/Utils/ErrorTypes/`.

**Transport-boundary handling**: `_mapErrorToFailureEnvelope` in `z_apiHandler.js` is updated to recognise `DefinitionStaleError` and map it to a dedicated `DEFINITION_STALE` error code (added to `API_ERROR_CODE_MAP`). The `_failure` method is extended with an optional fifth `details` parameter so that the error envelope can carry structured context: `{ ok: false, requestId, error: { code, message, retriable, details: { definitionKey, referenceStale, templateStale, referenceLastModified, templateLastModified } } }`. The `details` key is omitted when not provided (backward-compatible with existing callers). The error is marked as non-retriable.

### Naming recommendation

Prefer:

- `startAssessmentRun`
- `DefinitionStaleError`
- `definitionKey`
- `referenceStale` / `templateStale`

Avoid:

- `saveStartAndShowProgress` (removed)
- `needsRefresh` (ambiguous; use "stale" consistently)

### Validation recommendation

#### Backend

- `definitionKey`: required, non-empty string; must resolve to an existing full definition.
- `assignmentId`: required, non-empty string.
- `courseId`: required, non-empty string; must resolve to an existing `ABClass`.
- Transport validation in the API-layer helper; domain invariants in the controller.

## Feature architecture

### Placement

- New utility class: `GASPropertiesUtils` in `src/backend/Utils/00_GASPropertiesUtils.js` — single entry point for `ScriptProperties` and `UserProperties` operations
- New controller method: `AssignmentController.startAssessmentRun`
- New API-layer handler: `startAssessmentRun_` in `z_Api/assignmentAssessment.js`
- New API-layer handler: `createDefinitionFromWizardInputs_` in `z_Api/assignmentDefinitionPartials.js` (co-located with `upsertAssignmentDefinition_`)
- New error type: `src/backend/Utils/ErrorTypes/DefinitionStaleError.js`
- Modified: `AssignmentController.runAssignmentPipeline` (throw instead of re-parse)
- Modified: `AssignmentController` — `applyDocumentProperties` and `clearDocumentProperties` removed; `startProcessing` and `processSelectedAssignment` use `GASPropertiesUtils`; `saveStartAndShowProgress` removed
- Modified: `Utils.js` — `clearDocumentProperties()` removed (no callers, and GAS standalone scripts do not use `DocumentProperties` for application state)
- Modified: `ConfigurationManager` — `documentProperties` field and initialisation removed; uses only `ScriptProperties` via `GASPropertiesUtils.getScriptProperties()`
- Modified: `ABClassController.loadClass` (throw instead of auto-initialise)
- Modified: `AssignmentProcessor/globals.js` (remove `saveStartAndShowProgress`; update `startProcessing` signature to accept `courseId`)
- Modified: `z_Api/z_apiHandler.js` (`ALLOWLISTED_METHOD_HANDLERS`, `API_ERROR_CODE_MAP`, `_mapErrorToFailureEnvelope`, Node test block)

### Proposed high-level tree

```text
GASPropertiesUtils                                                     [NEW: single entry point for PropertiesService]
├── getScriptProperties() → PropertiesService.getScriptProperties()
├── getUserProperties()  → PropertiesService.getUserProperties()
├── applyProperties(properties, propertyMap)                          [static]
└── clearProperties(properties, keys)                                 [static]

z_Api/z_apiHandler.js
├── ALLOWLISTED_METHOD_HANDLERS
│   ├── startAssessmentRun → startAssessmentRun_(params)
│   └── createDefinitionFromWizardInputs → createDefinitionFromWizardInputs_(params)
├── API_ERROR_CODE_MAP
│   └── DEFINITION_STALE (new)
└── _mapErrorToFailureEnvelope
    └── DefinitionStaleError → { code: 'DEFINITION_STALE', details: { definitionKey, referenceStale, templateStale } }

AssignmentController
├── startAssessmentRun({ definitionKey, assignmentId, courseId })   [NEW]
│   ├── validate inputs
│   ├── fetch definition → throw if not found
│   ├── per-document freshness check → throw DefinitionStaleError if stale
│   ├── resolve ABClass via loadClass → throw if not found
│   └── startProcessing(assignmentId, definitionKey, courseId)     [MODIFIED: uses GASPropertiesUtils]
├── createDefinitionFromWizardInputs(...)                           [UNCHANGED]
├── ensureDefinitionFromInputs(...)                                 [UNCHANGED]
├── startProcessing(...)                                            [MODIFIED: uses GASPropertiesUtils.getUserProperties(); globals wrapper updated to pass courseId]
├── processSelectedAssignment()                                     [MODIFIED: uses GASPropertiesUtils.getUserProperties()]
├── runAssignmentPipeline(...)                                      [MODIFIED: throw DefinitionStaleError]
├── applyDocumentProperties / clearDocumentProperties               [REMOVED]
└── saveStartAndShowProgress(...)                                   [REMOVED]

ConfigurationManager
└── documentProperties field + initialisation                        [REMOVED: uses GASPropertiesUtils.getScriptProperties() only]

ABClassController
└── loadClass(...)                                                  [MODIFIED: throw when class not found]
```

### Out of scope for this surface

- The frontend wizard UI implementation (hooking up `AssessTaskModal` and definition-creation steps).
- Any changes to `AssignmentDefinitionController` or `AssignmentDefinition` model.
- Any changes to the assessment pipeline stages beyond the freshness check.
- Calculation of averages, readiness data, or any display-facing metrics.

## Data loading and orchestration

### Required datasets or dependencies

- `AssignmentDefinition` (full) via `AssignmentDefinitionController.getDefinitionByKey`
- `ABClass` via `ABClassController.loadClass`
- `DriveManager.getFileModifiedTime` for freshness check

### Query or transport additions

- New `apiHandler` method: `startAssessmentRun`
- New `apiHandler` method: `createDefinitionFromWizardInputs` (existing logic, new transport entry)

## Core behavioural model

### `startAssessmentRun` flow

1. **Validate inputs**: `definitionKey`, `assignmentId`, `courseId` all required non-empty strings.
2. **Resolve definition**: Fetch full definition via `definitionController.getDefinitionByKey(definitionKey, { form: 'full' })`. Throw if not found.
3. **Check freshness**:
   - Get current `referenceModified` and `templateModified` timestamps from `DriveManager.getFileModifiedTime`.
   - Compute `referenceStale` via `Utils.isNewer(referenceModified, definition.referenceLastModified)`.
   - Compute `templateStale` via `Utils.isNewer(templateModified, definition.templateLastModified)`.
   - If either is true, throw `DefinitionStaleError` with `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified: referenceModified`, and `templateLastModified: templateModified`.
   - Note: individual `isNewer` calls are used instead of `definitionNeedsRefresh` so that each document's staleness can be reported independently to the frontend.
4. **Resolve ABClass**: Instantiate `ABClassController` and call `loadClass(courseId)`. Throws if no stored class exists (see agreed decision 8).
5. **Start processing**: Call `startProcessing(assignmentId, definitionKey, courseId)` which creates the time-based trigger and stores context in `UserProperties`.
6. **Return**: Success (no payload needed aside from the standard envelope).

### `runAssignmentPipeline` change

Current behaviour:

```javascript
const referenceModified = DriveManager.getFileModifiedTime(definition.referenceDocumentId);
const templateModified = DriveManager.getFileModifiedTime(definition.templateDocumentId);
const needsRefresh = Utils.definitionNeedsRefresh(definition, referenceModified, templateModified);
if (needsRefresh) {
  // re-parse tasks, update timestamps, save definition
} else {
  // skip
}
```

New behaviour:

```javascript
const referenceModified = DriveManager.getFileModifiedTime(definition.referenceDocumentId);
const templateModified = DriveManager.getFileModifiedTime(definition.templateDocumentId);
const referenceStale = Utils.isNewer(referenceModified, definition.referenceLastModified);
const templateStale = Utils.isNewer(templateModified, definition.templateLastModified);
if (referenceStale || templateStale) {
  throw new DefinitionStaleError(
    'Assignment definition is stale: reference or template document has changed.',
    {
      definitionKey: definition.definitionKey,
      referenceStale,
      templateStale,
      referenceLastModified: referenceModified,
      templateLastModified: templateModified,
    }
  );
}
```

The error is caught by `processSelectedAssignment`'s existing try/catch and surfaced via `ProgressTracker.logAndThrowError`.

## Error, loading, and empty-state rules

### Blocking failure

- **Definition not found**: The controller throws a standard `Error` with message indicating the `definitionKey` was not found. Mapped to `INTERNAL_ERROR` by the transport boundary.
- **Definition stale**: The controller throws `DefinitionStaleError`. Mapped to `DEFINITION_STALE` by the transport boundary with `definitionKey`, `referenceStale`, and `templateStale` in the `details` block. Non-retriable.
- **ABClass not found**: `loadClass` throws when no stored class exists for the given `courseId`. Mapped to `INTERNAL_ERROR`.

## Backend changes required to support agreed behaviour

1. **New controller method `startAssessmentRun`**
   - Added to `AssignmentController`.
   - Accepts `{ definitionKey, assignmentId, courseId }`.
   - Performs per-document freshness check before trigger creation.
   - Delegates to `startProcessing` for trigger creation.
   - Returns `null` (apiHandler wraps in standard success envelope).

2. **New error type `DefinitionStaleError`**
   - Added to `src/backend/Utils/ErrorTypes/DefinitionStaleError.js`.
   - Properties: `name = 'DefinitionStaleError'`, `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`.
   - Follows existing `ApiValidationError` pattern.

3. **Transport-boundary recognition of `DefinitionStaleError`**
   - `DEFINITION_STALE` added to `API_ERROR_CODE_MAP` in `z_apiHandler.js`.
   - `_mapErrorToFailureEnvelope` updated with a case for `DefinitionStaleError` that maps to `DEFINITION_STALE` and includes `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified` in a `details` block. Note: this requires extending the `_failure` envelope shape to accept an optional `details` payload — the current `{ code, message, retriable }` shape has no `details` field.
   - Node test block in `z_apiHandler.js` updated to `require` the new error type.
   - Error is non-retriable.

4. **New utility class `GASPropertiesUtils`**
   - Added to `src/backend/Utils/00_GASPropertiesUtils.js`.
   - Static methods: `getScriptProperties()`, `getUserProperties()`, `applyProperties(properties, propertyMap)`, `clearProperties(properties, keys)`.
   - Serves as the single entry point for all `PropertiesService` access.
   - Follows the `ArrayUtils` pattern: static-only utility class, guarded `module.exports`, `00_` prefix for GAS concatenation load order (must load before `ConfigurationManager` and `AssignmentController`).

5. **Modified `ConfigurationManager`**
   - `documentProperties` field and lazy initialisation removed.
   - `ensureInitialized()` no longer calls `PropertiesService.getDocumentProperties()`; uses `GASPropertiesUtils.getScriptProperties()` instead.
   - `maybeDeserializeProperties()` checks only `scriptProperties` key count (was checking both `scriptProperties` and `documentProperties`).
   - JSDoc updated to remove `@property {Object} documentProperties`.

6. **Modified `startProcessing`**
   - Uses `GASPropertiesUtils.getUserProperties()` instead of `PropertiesService.getDocumentProperties()`.
   - Uses `GASPropertiesUtils.applyProperties()` instead of `this.applyDocumentProperties()`.
   - `applyDocumentProperties` method removed from `AssignmentController`.
   - Globals `startProcessing(assignmentId, definitionKey)` signature updated to accept `courseId` as a third parameter: `startProcessing(assignmentId, definitionKey, courseId)`.

7. **Modified `processSelectedAssignment`**
   - Uses `GASPropertiesUtils.getUserProperties()` for reads and cleanup.
   - Uses `GASPropertiesUtils.clearProperties()` instead of `this.clearDocumentProperties()`.
   - `clearDocumentProperties` method removed from `AssignmentController`.
   - Lock serialisation remains `LockService.getDocumentLock()`.

8. **Removed `Utils.clearDocumentProperties()`**
   - Removed from `Utils.js`. No production callers. GAS standalone scripts do not use `DocumentProperties` for application state.

9. **Modified `runAssignmentPipeline`**
   - Throws `DefinitionStaleError` (with per-document staleness booleans) instead of re-parsing when freshness check fails.

10. **Modified `ABClassController.loadClass`**
    - Changed to throw when no stored collection or document exists for the given `classId`, instead of auto-initialising a new empty class.
    - `upsertABClass` is unaffected (it handles creation explicitly via `initialise`).
    - Existing callers (`processSelectedAssignment`, `ensureDefinitionFromInputs`) already expect the class to exist; no caller changes needed.

11. **Removed `saveStartAndShowProgress`**
    - Removed from `AssignmentController`.
    - Removed from `AssignmentProcessor/globals.js`.
    - Other globals functions (`triggerProcessSelectedAssignment`, `startProcessing`, `createDefinitionFromWizardInputs`, `removeTrigger`, `testWorkflow`) remain in place.

12. **New API-layer handler `startAssessmentRun_`**
    - Defined in a new `z_Api/assignmentAssessment.js` file.
    - Registered in `ALLOWLISTED_METHOD_HANDLERS` as `startAssessmentRun`.

13. **`createDefinitionFromWizardInputs` wired to `apiHandler`**
    - Trailing-underscore handler `createDefinitionFromWizardInputs_` added to `z_Api/assignmentDefinitionPartials.js` (alongside existing `upsertAssignmentDefinition_` and related handlers). Rationale: it delegates to the same `AssignmentController` and returns `AssignmentDefinition` payloads; co-locating with the definition-partials family keeps definition-related transport handlers discoverable together.
    - Registered in `ALLOWLISTED_METHOD_HANDLERS` as `createDefinitionFromWizardInputs`.
    - The globals wrapper function remains in `AssignmentProcessor/globals.js` for now and delegates to the controller as before.

## Planning handoff notes

- The action plan must sequence the `GASPropertiesUtils` utility class and `ConfigurationManager` update before the `startProcessing` property-scope change, as both are dependencies.
- The new error type, `loadClass` change, and `startProcessing` property-scope change must be in place before `startAssessmentRun`.
- The `z_apiHandler.js` Node test block must be updated when new `z_Api` files or error types are added.
- The `createDefinitionFromWizardInputs` apiHandler wiring is independent and can be done in any order.
- `saveStartAndShowProgress` removal should happen after the new method is verified.
- The trigger-side `runAssignmentPipeline` change is independent of the API method.
- `Utils.clearDocumentProperties()` removal is independent of other changes (no callers).

## Testing expectations

- Backend unit tests for `GASPropertiesUtils` (all four static methods, with mocked `PropertiesService`).
- Backend unit tests for `ConfigurationManager` `ensureInitialized` and `maybeDeserializeProperties` regression.
- Backend unit tests for `AssignmentController.startAssessmentRun` (happy path, definition not found, definition stale, ABClass not found).
- Backend unit tests for `DefinitionStaleError` construction and properties (including timestamps).
- Backend unit tests for `startProcessing` with `UserProperties` (via `GASPropertiesUtils`).
- Backend unit tests for `runAssignmentPipeline` stale-definition throw (per-document staleness, timestamps).
- Backend unit tests for `ABClassController.loadClass` throw-on-missing behaviour.
- Update existing `globals.test.js` to reflect removal of `saveStartAndShowProgress` and updated `startProcessing` signature.
- API-layer tests for the new `startAssessmentRun_` handler.
- API-layer tests for `createDefinitionFromWizardInputs_` handler.
- Transport-boundary tests for `DefinitionStaleError` mapping.

## Documentation and rollout notes

- Update `docs/developer/AssessmentFlow.md` to reflect the new flow (remove `saveStartAndShowProgress`, document `startAssessmentRun`).
- Update `docs/developer/backend/AssessmentFlow.md` similarly.
- `saveStartAndShowProgress` removal is a breaking change for the legacy HTML UI; that UI is deprecated and no compatibility shim is required.

## V1 scope recommendation

### Include in v1

- `GASPropertiesUtils` utility class (single entry point for `ScriptProperties`/`UserProperties`).
- `ConfigurationManager` migration from `DocumentProperties` to `ScriptProperties`-only.
- Removal of `Utils.clearDocumentProperties()`.
- `startAssessmentRun` controller method with per-document freshness check.
- `DefinitionStaleError` error type with transport-boundary recognition.
- `ABClassController.loadClass` throw-on-missing change.
- `UserProperties` migration for trigger context (including `courseId` parameter fix).
- `applyDocumentProperties` / `clearDocumentProperties` removal from `AssignmentController`.
- `runAssignmentPipeline` throw-on-stale change.
- `createDefinitionFromWizardInputs` apiHandler wiring.
- Removal of `saveStartAndShowProgress`.

### Defer from v1

- Frontend wizard UI changes to consume `startAssessmentRun`.
- Frontend "re-create definition" prompt triggered by `DefinitionStaleError`.
- Any changes to the assessment pipeline stages.
- Averages, readiness data, or display metrics.

## Open questions

None remaining. Previously open questions are now settled:

1. `DefinitionStaleError` includes `referenceLastModified` and `templateLastModified` ISO timestamps (current Drive values) for diagnostics.
2. Frontend service for `startAssessmentRun` is deferred to the frontend wizard workstream.
