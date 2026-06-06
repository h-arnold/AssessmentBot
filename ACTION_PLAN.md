# Backend Assessment-Start Flow — Delivery Plan (TDD-First)

## Read-First Context

Before executing this plan:

1. Read `SPEC.md` (v1.1) — source of truth for product behaviour, contracts, and scope boundaries.
2. Read `src/backend/AGENTS.md` — backend conventions, apiHandler pattern, load-order rules.
3. No frontend layout spec exists (backend-only workstream; frontend wizard UI is deferred).

## Scope and assumptions

### Scope

- New `DefinitionStaleError` error type with transport-boundary recognition.
- `ABClassController.loadClass` changed to throw when no stored class exists.
- `UserProperties` migration for trigger context storage (was `DocumentProperties`).
- `runAssignmentPipeline` changed to throw on stale definition instead of re-parsing.
- `saveStartAndShowProgress` removed from controller and globals.
- New `startAssessmentRun` controller method and API handler.
- `createDefinitionFromWizardInputs` wired to `apiHandler`.
- `z_apiHandler.js` transport changes (`API_ERROR_CODE_MAP`, `_mapErrorToFailureEnvelope`, `ALLOWLISTED_METHOD_HANDLERS`, Node test block).

### Out of scope

- Frontend wizard UI changes.
- Frontend service for `startAssessmentRun`.
- Changes to `AssignmentDefinitionController` or `AssignmentDefinition` model.
- Changes to assessment pipeline stages beyond the freshness check.
- Averages, readiness data, or display metrics.

### Assumptions

1. The legacy HTML UI that calls `saveStartAndShowProgress` is deprecated and no compatibility shim is needed.
2. `courseId` is always provided to `startAssessmentRun` by the frontend (the class context is known from the wizard).
3. Existing `DocumentProperties` from prior runs do not need automated migration (triggers are short-lived).
4. `LockService.getDocumentLock()` remains correct for `processSelectedAssignment` regardless of property scope change.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API-layer handlers thin; delegate to controller methods.
- Follow `z_apiHandler.js` patterns: trailing-underscore handlers, trivial inline closures where appropriate.
- Validate at transport boundary (API layer); domain invariants in the controller.
- Use `ABLogger` for all new logging; no `console.*` in new code.
- Use British English in comments and documentation.
- Preserve GAS concatenation load order; do not rename numbered files unless explicitly changing load order.
- Node test boundary: only the guarded `module.exports` block at end of file.

### TDD workflow (mandatory per section)

For each section:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate

When a section is delegated to sub-agents, verify `Files read` evidence includes all mandatory docs listed for that phase.

### Shared-helper planning gate

When a section is likely to introduce helper reuse, extension, or new shared helpers, record helper decisions before implementation and add planned entries to canonical docs with status `Not implemented`.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Backend tests: `npm test -- <target>`

---

## Section 1 — `DefinitionStaleError` error type

### Objective

Create the new `DefinitionStaleError` error type following the existing `ApiValidationError` pattern.

### Constraints

- File: `src/backend/Utils/ErrorTypes/DefinitionStaleError.js`.
- Must follow `ApiValidationError` pattern: `name` property, `Error.captureStackTrace`, guarded `module.exports`.
- GAS concatenation: `Utils/ErrorTypes/` (no numeric prefix) loads before `y_controllers/` and `z_Api/` directories. No additional prefix or load-order change is needed — `DefinitionStaleError` will be available as a global when referenced by `AssignmentController` and `z_apiHandler`.
- Add to `tests/setupGlobals.js` for Node tests via `require`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Utils/ErrorTypes/ApiValidationError.js` (pattern reference)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `DefinitionStaleError`
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/ErrorTypes/DefinitionStaleError.js`
   - Call-site rationale: thrown by `startAssessmentRun` and `runAssignmentPipeline`; recognised by `_mapErrorToFailureEnvelope`
   - Relevant canonical doc target: `docs/developer/backend/backend-logging-and-error-handling.md` (error type inventory)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `DefinitionStaleError` is a class extending `Error`.
- `name` is `'DefinitionStaleError'`.
- Constructor accepts `message` and an options object with `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`.
- All five properties are stored on the instance.
- Follows `Error.captureStackTrace` pattern.
- Guarded `module.exports` block present.

### Required test cases (Red first)

Backend unit tests:

1. `DefinitionStaleError` instance has correct `name`.
2. Constructor stores `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified` as instance properties.
3. `instanceof Error` is true.
4. `err.stack` is a non-empty string.

### Section checks

- `npm test -- tests/api/apiDefinitionStaleError.test.js` (new file, placed in `tests/api/` alongside existing `apiErrorTypes.test.js`)
- `npm run lint:backend`
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Document that this error is thrown both at the API boundary (caught by `_mapErrorToFailureEnvelope`) and at trigger-execution time (caught by `processSelectedAssignment`'s try/catch).

### Implementation notes / deviations / follow-up

- `Error.captureStackTrace` was deliberately omitted from `DefinitionStaleError` because the `unicorn/no-useless-error-capture-stack-trace` lint rule flags it as redundant in V8 (where `super(message)` already captures the stack). This is the first error type in the codebase to pass this lint rule cleanly — all five existing error types (`ApiValidationError`, `ApiRateLimitError`, `ApiDisabledError`, `AbortRequestError`, `PersistError`) have the same lint violation. The stack trace test (`has a non-empty stack trace`) still passes without it.

---

## Section 1a — `GASPropertiesUtils` and `ConfigurationManager` update

### Objective

Create a `GASPropertiesUtils` utility class as the single entry point for all `PropertiesService` operations, and update `ConfigurationManager` to use only `ScriptProperties`.

### Constraints

- New file: `src/backend/Utils/00_GASPropertiesUtils.js`. `00_` prefix ensures GAS concatenation loads it before `ConfigurationManager` (`98_` prefix) and `AssignmentController`.
- Static-only utility class following `ArrayUtils` pattern: no instantiation, guarded `module.exports`.
- Static methods: `getScriptProperties()`, `getUserProperties()`, `applyProperties(properties, propertyMap)`, `clearProperties(properties, keys)`.
- `ConfigurationManager`: remove `this.documentProperties` field and its lazy initialisation in `ensureInitialized()`; use `GASPropertiesUtils.getScriptProperties()` instead.
- `ConfigurationManager.maybeDeserializeProperties()`: check only `scriptProperties` key count (was checking both).
- `ConfigurationManager` JSDoc: remove `@property {Object} documentProperties`.
- Add `GASPropertiesUtils` to `tests/setupGlobals.js` for Node tests.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Utils/00_ArrayUtils.js` (pattern reference for static utility class)
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` (full file)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `GASPropertiesUtils`
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/00_GASPropertiesUtils.js`
   - Call-site rationale: single entry point for all `PropertiesService` access; replaces direct calls in `AssignmentController`, `ConfigurationManager`, and future callers
   - Relevant canonical doc target: `docs/developer/backend/` (new or existing utility-class documentation)
   - Planned doc status: `Not implemented`

### Acceptance criteria

**GASPropertiesUtils:**

- `getScriptProperties()` returns `PropertiesService.getScriptProperties()`.
- `getUserProperties()` returns `PropertiesService.getUserProperties()`.
- `applyProperties(properties, propertyMap)` sets each key-value pair from `propertyMap` on the given `properties` store.
- `clearProperties(properties, keys)` deletes each key in `keys` from the given `properties` store.
- Guarded `module.exports` block present.

**ConfigurationManager:**

- `this.documentProperties` is no longer a field (constructor, JSDoc).
- `ensureInitialized()` does not reference `documentProperties`.
- `maybeDeserializeProperties()` checks only `scriptProperties` key count.
- All existing getters/setters continue to work (regression).

### Required test cases (Red first)

GASPropertiesUtils tests (`tests/utils/gasPropertiesUtils.test.js`):

1. `getScriptProperties()` calls `PropertiesService.getScriptProperties()`.
2. `getUserProperties()` calls `PropertiesService.getUserProperties()`.
3. `applyProperties` sets multiple keys on a mock property store.
4. `clearProperties` deletes specified keys from a mock property store.

ConfigurationManager tests:

1. `ensureInitialized()` does not initialise `documentProperties`.
2. `maybeDeserializeProperties()` works with only `scriptProperties` (regression).
3. Config get/set operations unchanged (regression).

### Section checks

- `npm test -- tests/utils/gasPropertiesUtils.test.js` (new file)
- `npm test -- tests/configurationManager/` (existing tests — verify no regressions)
- `npm run lint:backend`

### Optional `@remarks` JSDoc follow-through

- Document that `GASPropertiesUtils` is the canonical entry point for `PropertiesService`; direct calls should be migrated opportunistically.

### Implementation notes / deviations / follow-up

- `this.documentProperties = null;` was fully removed from the constructor (not just left as null) — the property is now absent on instances, matching the acceptance criteria.
- `GASPropertiesUtils.applyProperties()` uses `Object.entries()` with destructuring to avoid `security/detect-object-injection` lint violations.
- One existing test in `configurationManager.test.js` was updated: `getDocumentProperties` assertion changed from `toHaveBeenCalledTimes(1)` to `not.toHaveBeenCalled()` since `ensureInitialized()` no longer calls it.

---

## Section 2 — `ABClassController.loadClass` throw-on-missing

### Objective

Change `loadClass` to throw when no stored collection or document exists for the given `classId`, instead of auto-initialising a new empty class.

### Constraints

- File: `src/backend/y_controllers/ABClassController.js`.
- Only `loadClass` changes; `upsertABClass` and `updateABClass` are untouched.
- Existing callers (`processSelectedAssignment`, `ensureDefinitionFromInputs`) already expect the class to exist.
- Throw a descriptive `Error` with the `classId` in the message.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

None (local change only).

### Acceptance criteria

- `loadClass('nonexistent-id')` throws an `Error`.
- Error message includes the `classId`.
- `loadClass(existingClassId)` continues to work as before (loads, refreshes roster, returns `ABClass`).
- `upsertABClass` still creates new classes and `updateABClass` still throws on missing (unchanged).

### Required test cases (Red first)

Backend controller tests:

1. `loadClass` with non-existent `classId` throws `Error`.
2. `loadClass` with existing `classId` returns `ABClass` instance (unchanged).
3. `ensureDefinitionFromInputs` with an existing class returns `{ definition, courseId, abClass }` unchanged (regression: `ensureDefinitionFromInputs` calls `loadClass` internally).
4. `upsertABClass` creates a new class when none exists (unchanged, regression).
5. `updateABClass` throws `RangeError` when class does not exist (unchanged, regression).

### Section checks

- `npm test -- tests/controllers/abclass-loadClass.test.js` (new file, following existing `abclass-*.test.js` naming convention)
- Regression: `npm test -- tests/controllers/abclass-upsert-update.test.js` (upsert/update must remain unchanged)
- `npm run lint:backend`

### Optional `@remarks` JSDoc follow-through

- Document that `loadClass` no longer auto-initialises; callers must ensure the class exists before calling.

### Implementation notes / deviations / follow-up

- Both `!collection` and `!document` branches now throw `new Error(...)` with the `classId` in the message using template literals.
- `upsertABClass` and `updateABClass` are untouched — confirmed via diff.
- Both existing callers (`processSelectedAssignment` and `ensureDefinitionFromInputs`) already handle the throw via try/catch.

---

## Section 3 — UserProperties migration for trigger context

### Objective

Migrate trigger context storage from `DocumentProperties` to `UserProperties` via `GASPropertiesUtils`, fix the globals `startProcessing` signature to pass `courseId`, and remove `applyDocumentProperties` / `clearDocumentProperties` from `AssignmentController`.

### Constraints

- Files: `src/backend/y_controllers/AssignmentController.js`, `src/backend/AssignmentProcessor/globals.js`, `src/backend/Utils/Utils.js`.
- Depends on GASPropertiesUtils (must exist before this section).
- `startProcessing` controller method: use `GASPropertiesUtils.getUserProperties()` instead of `PropertiesService.getDocumentProperties()`; use `GASPropertiesUtils.applyProperties()` instead of `this.applyDocumentProperties()`.
- `processSelectedAssignment`: use `GASPropertiesUtils.getUserProperties()` for reads and cleanup; use `GASPropertiesUtils.clearProperties()` instead of `this.clearDocumentProperties()`.
- Remove `applyDocumentProperties` and `clearDocumentProperties` methods from `AssignmentController`.
- Remove `Utils.clearDocumentProperties()` from `Utils.js` (no production callers).
- Globals `startProcessing(assignmentId, definitionKey)` → `startProcessing(assignmentId, definitionKey, courseId)`.
- Lock scope remains `LockService.getDocumentLock()` (unchanged).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `GASPropertiesUtils.applyProperties` / `GASPropertiesUtils.clearProperties` (reuse from Section 1a)
   - Decision: `reuse` (already created in Section 1a)
   - Owning module/path: `src/backend/Utils/00_GASPropertiesUtils.js`
   - Call-site rationale: replaces `AssignmentController.applyDocumentProperties` / `clearDocumentProperties`
   - Relevant canonical doc target: none (utility class)
   - Planned doc status: already `Not implemented` from Section 1a

2. Helper: `Utils.clearDocumentProperties()` — removed
   - Decision: `keep local` → removed
   - Call-site rationale: no callers; GAS standalone scripts don't use DocumentProperties
   - Planned doc status: N/A (removal)

### Acceptance criteria

- `startProcessing` reads/writes `UserProperties` via `GASPropertiesUtils.getUserProperties()`.
- `startProcessing` uses `GASPropertiesUtils.applyProperties()` to store trigger context.
- `processSelectedAssignment` reads from `UserProperties` via `GASPropertiesUtils.getUserProperties()`.
- `processSelectedAssignment` cleanup uses `GASPropertiesUtils.clearProperties()`.
- `applyDocumentProperties` and `clearDocumentProperties` methods are removed from `AssignmentController`.
- `Utils.clearDocumentProperties()` is removed from `Utils.js`.
- Globals `startProcessing` accepts and passes `courseId`.
- No `DocumentProperties` references remain in `startProcessing` or `processSelectedAssignment`.

### Required test cases (Red first)

Backend controller tests:

1. `startProcessing` uses `GASPropertiesUtils.getUserProperties()` to store trigger context.
2. `processSelectedAssignment` reads from `GASPropertiesUtils.getUserProperties()`.
3. `processSelectedAssignment` cleanup uses `GASPropertiesUtils.clearProperties()`.
4. `applyDocumentProperties` does not exist on `AssignmentController`.
5. `clearDocumentProperties` does not exist on `AssignmentController`.

Utils tests:

1. `Utils.clearDocumentProperties` is `undefined`.

Backend globals tests:

1. `globals.startProcessing(assignmentId, definitionKey, courseId)` calls controller with all three args.
2. Do **not** assert on `saveStartAndShowProgress` presence/absence — that test is deferred to Section 5 when the function is actually removed.

### Section checks

- `npm test -- tests/controllers/assignmentController` (existing test files covering `startProcessing` and `processSelectedAssignment`)
- `npm test -- tests/assignmentProcessor/globals.test.js`
- `npm run lint:backend`
- Verify no remaining `DocumentProperties` references in `startProcessing` or `processSelectedAssignment`.

### Implementation notes / deviations / follow-up

- All `PropertiesService.getDocumentProperties()` references in `startProcessing` and `processSelectedAssignment` replaced with `GASPropertiesUtils.getUserProperties()`.
- `applyDocumentProperties` and `clearDocumentProperties` fully removed from `AssignmentController`.
- `Utils.clearDocumentProperties()` removed (no production callers).
- `globals.startProcessing` signature updated to `(assignmentId, definitionKey, courseId)` — backward-compatible via `courseId = ''` default in controller.
- 3 JSDoc references and 1 runtime log message updated from "document properties" to "user properties".

---

## Section 4 — `runAssignmentPipeline` throw-on-stale

### Objective

Change `runAssignmentPipeline` to throw `DefinitionStaleError` instead of silently re-parsing when documents have changed. Use per-document `isNewer` checks so each document's staleness is independently reported.

### Constraints

- File: `src/backend/y_controllers/AssignmentController.js`.
- Depends on Section 1 (`DefinitionStaleError` exists).
- Replace `Utils.definitionNeedsRefresh` with two `Utils.isNewer` calls.
- The error is caught by `processSelectedAssignment`'s existing try/catch and surfaced via `ProgressTracker.logAndThrowError`.
- `AssignmentDefinitionController._resolveTaskStateForUpsert`'s use of `definitionNeedsRefresh` is unrelated and must not be changed.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

None (uses existing `Utils.isNewer`; no new helpers).

### Acceptance criteria

- When reference document is newer, `DefinitionStaleError` is thrown with `referenceStale: true`, `templateStale: false`.
- When template document is newer, `DefinitionStaleError` is thrown with `referenceStale: false`, `templateStale: true`.
- When both are newer, both flags are `true`.
- When neither is newer, pipeline proceeds normally (no throw).
- `AssignmentDefinitionController._resolveTaskStateForUpsert` is unchanged (regression).
- Old re-parse code path (lines 287–299 in current `AssignmentController.js`) is removed.

### Required test cases (Red first)

Backend controller tests:

1. Stale reference document → throws `DefinitionStaleError` with `referenceStale: true`, `referenceLastModified` set to Drive timestamp.
2. Stale template document → throws `DefinitionStaleError` with `templateStale: true`, `templateLastModified` set to Drive timestamp.
3. Both stale → throws with both flags `true`.
4. Neither stale → no throw, pipeline continues.
5. Error includes correct `definitionKey`.
6. When `runAssignmentPipeline` throws `DefinitionStaleError`, `processSelectedAssignment` catches it and calls `logAndThrowError` (regression: catch-path handling of new error type).

### Section checks

- `npm test -- tests/controllers/assignmentController` (existing test files)
- `npm run lint:backend`
- Verify `AssignmentDefinitionController` tests still pass (regression).

### Optional `@remarks` JSDoc follow-through

- Document why individual `isNewer` calls are used instead of `definitionNeedsRefresh` (per-document staleness reporting for the frontend).

### Implementation notes / deviations / follow-up

- Replaced `definitionNeedsRefresh` with two individual `Utils.isNewer` calls for per-document staleness reporting.
- Removed unused `controller` variable (was only used for `controller.saveDefinition()` in the removed re-parse branch).
- `AssignmentDefinitionController._resolveTaskStateForUpsert`'s use of `definitionNeedsRefresh` is confirmed untouched.
- `userPropertiesMigration.test.js` and `hydration.test.js` updated to accommodate new code path.

---

## Section 5 — `saveStartAndShowProgress` removal

### Objective

Remove `saveStartAndShowProgress` from `AssignmentController` and `AssignmentProcessor/globals.js`. All other globals functions remain.

### Constraints

- Files: `src/backend/y_controllers/AssignmentController.js`, `src/backend/AssignmentProcessor/globals.js`.
- Only `saveStartAndShowProgress` is removed.
- `triggerProcessSelectedAssignment`, `startProcessing`, `createDefinitionFromWizardInputs`, `removeTrigger`, `testWorkflow` remain in globals.
- Controller constants `TOAST_DURATION_SECONDS` and `ASSESSMENT_RUN_SUCCESS_MESSAGE` are also used by other methods and must not be removed.
- No compatibility shim for legacy HTML UI.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

None (removal only).

### Acceptance criteria

- `AssignmentController` no longer has a `saveStartAndShowProgress` method.
- `globals.js` no longer has a `saveStartAndShowProgress` function or exports it.
- `globals.js` `module.exports` no longer includes `saveStartAndShowProgress`.
- All other globals functions remain and work.
- Controller still has `ensureDefinitionFromInputs`, `startProcessing`, `processSelectedAssignment`, etc.

### Required test cases (Red first)

Backend globals tests:

1. `globals.saveStartAndShowProgress` is `undefined`.
2. Other globals functions (`startProcessing`, `triggerProcessSelectedAssignment`, etc.) are still exported.

Backend controller tests:

1. `controller.saveStartAndShowProgress` is `undefined`.
2. Other controller methods unaffected.

### Section checks

- `npm test -- tests/assignmentProcessor/globals.test.js`
- `npm test -- tests/controllers/assignmentController`
- `npm run lint:backend`

### Implementation notes / deviations / follow-up

- Removed `saveStartAndShowProgress` method from both `AssignmentController` and `globals.js`.
- Constants `TOAST_DURATION_SECONDS`, `PROCESS_LOCK_TIMEOUT_MS`, `ASSESSMENT_RUN_SUCCESS_MESSAGE` preserved (used by other methods).
- All other globals exports and controller methods confirmed intact.

---

## Section 6 — `z_apiHandler.js` transport changes

### Objective

Add `DEFINITION_STALE` to `API_ERROR_CODE_MAP`, extend `_mapErrorToFailureEnvelope` to recognise `DefinitionStaleError`, extend the `_failure` envelope shape to accept an optional `details` payload, and update the Node test block.

### Constraints

- File: `src/backend/z_Api/z_apiHandler.js`.
- Depends on Section 1 (`DefinitionStaleError` exists).
- `DEFINITION_STALE` added to `API_ERROR_CODE_MAP`.
- `_mapErrorToFailureEnvelope` gets a case for `DefinitionStaleError.name` mapping to `DEFINITION_STALE`.
- The error envelope includes `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified` in a `details` block nested inside `error`: `{ ok: false, requestId, error: { code, message, retriable, details: { definitionKey, referenceStale, templateStale, referenceLastModified, templateLastModified } } }`.
- `_failure` method extended to accept optional `details` parameter.
- Node test block `require`s `DefinitionStaleError` so `DefinitionStaleError.name` is available.
- Error is non-retriable.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/z_apiHandler.js` (current `_failure` and `_mapErrorToFailureEnvelope`)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

None (local changes to existing transport infrastructure).

### Acceptance criteria

- `API_ERROR_CODE_MAP` includes `DEFINITION_STALE: 'DEFINITION_STALE'`.
- `_mapErrorToFailureEnvelope` recognises `DefinitionStaleError` and maps to `DEFINITION_STALE`.
- Mapped error envelope includes `details: { definitionKey, referenceStale, templateStale, referenceLastModified, templateLastModified }` nested inside the `error` object.
- Envelope `retriable` is `false`.
- `_failure` accepts optional `details` parameter without breaking existing callers.
- Node test block `require`s `DefinitionStaleError`; `DefinitionStaleError.name` is accessible.
- Existing error mappings (`ApiRateLimitError`, `ApiValidationError`, `ApiDisabledError`) are unchanged (regression).

### Required test cases (Red first)

API-layer tests:

1. `_mapErrorToFailureEnvelope` with `DefinitionStaleError` returns envelope with `code: 'DEFINITION_STALE'`.
2. Envelope `error.details` includes `definitionKey`, `referenceStale`, `templateStale`, `referenceLastModified`, `templateLastModified`.
3. `retriable` is `false`.
4. `_failure(requestId, code, message, retriable, details)` includes `details` key in the returned `error` object when `details` is provided, and omits the `details` key when `details` is `undefined` (backward-compatible).
5. `_failure` without `details` produces same output as before (regression).
6. Existing error mappings unchanged (regression).

### Section checks

- `npm test -- tests/api/apiHandler/` (existing dispatcher test files; extend `dispatcher-errors.test.js` or create `dispatcher-definition-stale.test.js`)
- `npm run lint:backend`

### Optional `@remarks` JSDoc follow-through

- Document the `details` extension on `_failure` and the `DefinitionStaleError` case in `_mapErrorToFailureEnvelope`.

### Implementation notes / deviations / follow-up

- `_failure` extended with optional 5th `details` parameter; `details` key omitted when not provided (backward-compatible).
- `isDefinitionStale` flag used in `_mapErrorToFailureEnvelope` to bypass the `hasMessage` guard for `DefinitionStaleError` — ensures the error code maps correctly even with empty messages.
- `tests/api/apiHandler/shared.js` `makeVmGlobals` updated with `DefinitionStaleError` stub for VM-context tests.
- `docs/developer/backend/api-layer.md` error mapping section should be updated to include `DefinitionStaleError → DEFINITION_STALE` (deferred to documentation section).

---

## Section 7 — `startAssessmentRun` controller method and API handler

### Objective

Create the `startAssessmentRun` controller method on `AssignmentController`, the `startAssessmentRun_` API handler in a new `z_Api/assignmentAssessment.js` file, and register it in `ALLOWLISTED_METHOD_HANDLERS`.

### Constraints

- Depends on Sections 1, 2, 3, 6 (error type, loadClass, UserProperties, transport).
- Controller method validates inputs, resolves definition, checks per-document freshness, resolves ABClass, delegates to `startProcessing`.
- Returns `null` (apiHandler wraps in success envelope).
- API handler is a thin trailing-underscore helper that validates transport shape and delegates to the controller.
- Transport validation failures must throw `ApiValidationError` (mapped to `INVALID_REQUEST`). Domain validation in the controller throws plain `Error` (mapped to `INTERNAL_ERROR`). Follows `src/backend/AGENTS.md` §0.2.
- New file: `src/backend/z_Api/assignmentAssessment.js`.
- GAS concatenation: `z_Api` files load after controllers. Ensure `AssignmentController` is available as a global.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentController.js` (existing patterns: `createDefinitionFromWizardInputs`, `ensureDefinitionFromInputs`)
- `src/backend/z_Api/assignmentDefinitionPartials.js` (primary pattern reference for trailing-underscore API handlers)
- `src/backend/Utils/ErrorTypes/ApiValidationError.js` (error type used for transport validation)
- `src/backend/z_Api/z_apiHandler.js` (ALLOWLISTED_METHOD_HANDLERS registration)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `startAssessmentRun_` (API handler)
   - Decision: `new`
   - Owning module/path: `src/backend/z_Api/assignmentAssessment.js`
   - Call-site rationale: transport-boundary handler following trailing-underscore pattern
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` (apiHandler registry)
   - Planned doc status: `Not implemented`

### Acceptance criteria

**Controller method:**

- `startAssessmentRun({ definitionKey, assignmentId, courseId })` validates all three parameters are non-empty strings.
- Fetches full definition via `definitionController.getDefinitionByKey`; throws if not found.
- Checks per-document freshness using `Utils.isNewer`; throws `DefinitionStaleError` if stale.
- Resolves ABClass via `abClassController.loadClass(courseId)`; throws if not found.
- Delegates to `startProcessing(assignmentId, definitionKey, courseId)`.
- Returns `null`.

**API handler:**

- `startAssessmentRun_(parameters)` validates `parameters` is a plain object with required string fields.
- Delegates to `new AssignmentController().startAssessmentRun(parameters)`.
- Exported via guarded `module.exports`.
- Registered as `startAssessmentRun` in `ALLOWLISTED_METHOD_HANDLERS`.

### Required test cases (Red first)

Backend controller tests (new file: `tests/controllers/assignmentController.startAssessmentRun.test.js`; follows existing `tests/controllers/` convention alongside `assignmentController.detectDocumentType.test.js` and `assignmentController.hydration.test.js`):

1. Happy path: valid inputs → calls `startProcessing`, returns `null`.
2. Missing `definitionKey` → throws.
3. Missing `assignmentId` → throws.
4. Missing `courseId` → throws.
5. Non-string `definitionKey` → throws.
6. `definitionKey` not found → throws.
7. Stale reference → throws `DefinitionStaleError` with `referenceStale: true`.
8. Stale template → throws `DefinitionStaleError` with `templateStale: true`.
9. ABClass not found → throws.

API-layer tests:

1. `startAssessmentRun_` throws `ApiValidationError` when `parameters` is not a plain object.
2. `startAssessmentRun_` throws `ApiValidationError` when a required string field is missing.
3. `startAssessmentRun_` delegates to controller on valid input and returns result.
4. Handler is exported for Node tests.

### Section checks

- `npm test -- tests/controllers/assignmentController.startAssessmentRun.test.js` (new file)
- `npm test -- tests/api/assignmentAssessment.test.js` (new file)
- `npm run lint:backend`

### Implementation notes / deviations / follow-up

- Created `startAssessmentRun` controller method and `startAssessmentRun_` API handler.
- Transport validation (non-empty string) kept in API layer per §0.2; controller trusts validated input.
- Used `Validate.requireParams` + `Validate.validateNonEmptyString` in API handler.
- Changed definition-not-found from `TypeError` to plain `Error` (semantic correctness).
- Registered `startAssessmentRun` in `ALLOWLISTED_METHOD_HANDLERS`; updated registry count to 26.
- `EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS` updated in shared.js.

---

## Section 8 — `createDefinitionFromWizardInputs` API handler

### Objective

Wire the existing `createDefinitionFromWizardInputs` controller method to the `apiHandler` transport by adding a trailing-underscore handler in `z_Api/assignmentDefinitionPartials.js` and registering it in `ALLOWLISTED_METHOD_HANDLERS`.

### Constraints

- Depends on nothing for transport wiring (independent section).
- Has a **runtime** dependency on Section 2: `createDefinitionFromWizardInputs` → `ensureDefinitionFromInputs` → `loadClass`. After Section 2 lands, calling this handler for a class that doesn't exist will throw. Tests should expect throw-on-missing-class behaviour, not auto-initialise.
- Existing logic in controller and globals is unchanged.
- New handler follows the same pattern as `upsertAssignmentDefinition_` in the same file.
- The globals wrapper function remains in `AssignmentProcessor/globals.js`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/assignmentDefinitionPartials.js` (existing handler patterns)
- `src/backend/y_controllers/AssignmentController.js` (`createDefinitionFromWizardInputs`)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`

### Shared helper plan

1. Helper: `createDefinitionFromWizardInputs_` (API handler)
   - Decision: `new`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js`
   - Call-site rationale: transport-boundary handler for existing controller method; co-located with definition-partials family
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` (apiHandler registry)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `createDefinitionFromWizardInputs_` validates transport shape.
- Delegates to `new AssignmentController().createDefinitionFromWizardInputs(parameters)`.
- Registered as `createDefinitionFromWizardInputs` in `ALLOWLISTED_METHOD_HANDLERS`.
- Exported via guarded `module.exports` alongside existing exports.
- Existing globals function continues to work.

### Required test cases (Red first)

API-layer tests:

1. Handler validates required parameters (`assignmentId`, `courseId`, `referenceDocumentId`, `templateDocumentId`).
2. Handler delegates to controller and returns definition payload.
3. Handler is exported and accessible in Node tests.
4. Handler propagates error when `loadClass` throws for a non-existent class (after Section 2 lands).

### Section checks

- `npm test -- tests/api/assignmentDefinitionPartials.test.js` (or relevant test file)
- `npm run lint:backend`
- Verify existing `assignmentDefinitionPartials` tests still pass (regression).

### Implementation notes / deviations / follow-up

- _To be filled during implementation._

---

## Regression and contract hardening

### Objective

Verify that all touched areas work together and no regressions were introduced.

### Constraints

- Prefer focused test runs before broader validation.
- Include backward-compatibility checks for `processSelectedAssignment` trigger flow.

### Acceptance criteria

- All new tests pass.
- All existing tests in touched files pass.
- `npm run lint:backend` passes.
- `processSelectedAssignment` trigger flow works end-to-end with `UserProperties`.

### Required test cases/checks

1. Run `npm test -- tests/utils/gasPropertiesUtils.test.js`
2. Run `npm test -- tests/configurationManager/`
3. Run `npm test -- tests/controllers/assignmentController`
4. Run `npm test -- tests/controllers/abclass`
5. Run `npm test -- tests/assignmentProcessor/globals.test.js`
6. Run `npm test -- tests/api/` (all API-layer tests)
7. Run `npm test -- tests/api/apiDefinitionStaleError.test.js`
8. Run `npm test -- tests/api/apiHandler/`
9. Verify mandatory-read evidence is complete for all delegated regression handoffs.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- _To be filled during implementation._

---

## Documentation and rollout notes

### Objective

Update docs to reflect the new flow and removed legacy global.

### Constraints

- Only modify documents relevant to the touched areas.
- Use British English.

### Acceptance criteria

- `docs/developer/AssessmentFlow.md` updated: remove `saveStartAndShowProgress`, document `startAssessmentRun`.
- `docs/developer/backend/AssessmentFlow.md` updated similarly (if separate copy exists).
- `docs/developer/backend/api-layer.md` updated with new `ALLOWLISTED_METHOD_HANDLERS` entries and `DEFINITION_STALE` error mapping in the "Error mapping" section.
- `docs/developer/backend/` (utility-class docs) updated with `GASPropertiesUtils` entry.

### Required checks

1. Verify docs mention `startAssessmentRun` as the canonical assessment-start method.
2. Verify `saveStartAndShowProgress` is removed from docs or marked as removed.
3. Reconcile planned shared-helper entries in canonical docs: update `Not implemented` → implemented where delivered.

### Optional `@remarks` JSDoc review

- Confirm `@remarks` on `startAssessmentRun`, `DefinitionStaleError`, and `_mapErrorToFailureEnvelope` are present where planned in earlier sections.

### Implementation notes / deviations / follow-up

- _To be filled during implementation._

---

## Suggested implementation order

1. **Section 1**: `DefinitionStaleError` (foundational, no dependencies)
2. **Section 1a**: `GASPropertiesUtils` + `ConfigurationManager` update (foundational; needed before Section 3)
3. **Section 2**: `loadClass` throw-on-missing (independent)
4. **Section 3**: UserProperties migration + `Utils.clearDocumentProperties` removal (depends on 1a)
5. **Section 6**: `z_apiHandler.js` transport changes (depends on Section 1)
6. **Section 4**: `runAssignmentPipeline` throw-on-stale (depends on Section 1)
7. **Section 5**: `saveStartAndShowProgress` removal (depends on Sections 3, 4 being verified)
8. **Section 7**: `startAssessmentRun` controller + handler (depends on Sections 1, 2, 3, 6)
9. **Section 8**: `createDefinitionFromWizardInputs` handler (transport-wiring independent; should run after Section 2 for consistent test behaviour on class-not-found paths)
10. **Regression and contract hardening**
11. **Documentation and rollout**
