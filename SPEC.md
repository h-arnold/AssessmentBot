# Auth Service Specification

## Status

- Draft v1.8 — post-planning-review fixes applied (see "Changes from v1.7"). Ready to build `ACTION_PLAN.md` from.

### Changes from v1.7

- **R1 (Backend-enforced compulsory-once-set):** `setAuthGroupEmail('')` is rejected when a non-blank value is already stored; the write path surfaces an aggregated error entry. Changing to a different non-blank email remains allowed. Recovery stays via hand-editing Script Properties (Admin lockout recovery). This is the backend layer of the compulsory-once-set rule; the form-level guard is the frontend layer.
- **R2 (`checkAccess` method option):** `options` now accepts `method?: string`; when provided, the audit log records the requested method ("method if available"). The API gate passes `request.method`; `triggerHandler` passes the trigger method resolved from context during input validation.
- **R3 (Gate placement vs method lookup):** The auth gate runs after request validation but **before the allowlist method lookup** and admission phase — non-members receive `FORBIDDEN` uniformly and cannot probe which API methods exist. Gate-exempt status is determined by method name (`getAuthorisationStatus`).
- **R4 (Guard-test static scan precision):** The static source scan is line-start anchored (`^function`) so indented nested declarations (e.g. `apiConfig.js`'s `safeSet`) are not false-flagged, and it skips backend files that do not exist at scan time (e.g. `triggerHandler.js` before the Triggers/ section).
- **R5 (GWS-domain prerequisite + staging verification):** `webapp.access: "DOMAIN"` is only valid within a Google Workspace domain; the GWS-domain prerequisite is recorded as an explicit assumption, and a staging verification checklist was added to the rollout steps. **User-confirmed:** the deployment is in a Google Workspace domain; `DOMAIN` is correct.
- **R6 (Warmup failure rendering):** The gate only denies on `FORBIDDEN`. Non-FORBIDDEN warmup failures render children normally — the gate does not add a second blocking layer; existing per-surface degraded/blocking states apply (confirmed user decision).
- **R7 (Stale scope comment only):** The stale "DO NOT UPDATE THE REQUIRED SCOPES HERE" comment (references non-existent `src/AdminSheet`/`scripts/sync-appscript.js`) is removed; `REQUIRED_SCOPES` is kept in sync with `appsscript.json` manually. The existing `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` call at `TriggerController.js:17` matches the documented `requireScopes(authMode, oAuthScopes)` signature and is **not** modified (an earlier draft recorded it as a defect; that premise was verified incorrect against the official Apps Script reference and is retracted).

### Changes from v1.6

- **C1/C2/C3 (Gate design simplified):** `getAuthorisationStatus` is now **gate-exempt** (checks OAuth scopes only, returns boolean). The auth gate on all other methods checks **group membership only**. The richer `{ oauthGranted, groupAllowed }` payload from v1.6 has been dropped in favour of a single boolean.
- **C4 (Stale exemption text):** Replaced with gate-exempt description.
- **C5 (Missing files):** Added `apiConfig.js` to backend change lists. `authService.zod.ts` and `authService.ts` are unchanged (boolean return stays as-is).
- **C6 (Test harness):** SPEC.md acknowledges test-harness requirements (GAS stubs, file deletions/relocations). Detailed test planning deferred to `ACTION_PLAN.md`.
- **C7 (Cleanup ownership):** `triggerHandler()` owns all cleanup. New-flow step updated.
- **C8 (Allowlist alignment):** Testing expectations aligned to exact three-entry allowlist (`apiHandler`, `doGet`, `triggerHandler`).
- **C9 (Vendored exposure):** Documented as accepted risk; GitHub issue to be opened for follow-up.
- **C10 (Validation):** Transport schemas use `z.union([z.literal(''), z.email()]).optional()` (blank-tolerant, matches `BackendUrlSchema` precedent). `apiConfig.js` always emits the field. Form-level validation: compulsory once set. Recovery via Script Properties UI.
- **I1 (Trigger auth):** Re-check group membership, fail closed.
- **I2 (Malformed input):** Validate-then-dispatch, fail loud. Cleanup only for known triggerUid.
- **I3 (Cache-hit denial):** Removed unreachable path.
- **I4 (Cache invalidation):** Removed unimplementable requirement from `setBackendConfig`.
- **I5 (ScriptProperties collision):** Noted that `maybeDeserializeProperties()` is likely dead code; its removal is a separate scope item.
- **I6 (Shared helpers):** Spec now uses existing `globalExposure.test.js` guard test helper. Shared-helper section added.
- **I7 (Empty files):** Three empty files and their tests to be deleted; tree fixed to include `triggerProcessSelectedAssignment`.
- **I8 (Denial UI):** Hook returns `{ isAuthorised, isLoading }`. Group denial via `FORBIDDEN` → existing error infrastructure.
- **I9 (Config defaults):** `02_defaults.js` DEFAULTS entry and blank-aware getter added to change lists.
- **I10 (Helper text):** Descriptor type extended with `helperText` field, hard-coded special cases replaced with declarative rendering.
- **I11 (Zod schema, corrected — review finding I3):** Single canonical transport form: `z.union([z.literal(''), z.email()]).optional()` (blank-tolerant — matches C10 and rollout steps 837-838). Form-level compulsory-once-set. Backend transport always emits `authGroupEmail` with `|| ''` fallback (unchanged from the field-always-present pattern used by every other config field). An earlier `z.email().optional()` wording was inconsistent — `z.email()` rejects the `''` the backend always emits, so the union form is mandatory.
- **I12 (GASPropertiesUtils):** Trigger context storage uses `GASPropertiesUtils`, not raw `PropertiesService`.
- **I13 (Open questions):** Resolved inline. `webapp.access = "DOMAIN"`.
- **I14 (Data-shape doc):** Deferred to action plan and docs subagent.
- **I15 (Scope docs):** Note `appsscript.json` was updated; don't duplicate scope enumeration.
- **I16 (FORBIDDEN justification):** Fixed — "authenticated but not a group member", no contrast with `UNAUTHORISED`.
- **I17 (Accuracy):** Method name corrected to `startAssessmentRun`. `console.*` → `ABLogger` in scope.

### Changes from fifth-pass review

- **C-a (Flow diagram):** Fixed step-number routing: gate-exempt methods skip to step 7 (admission), not step 6 (GroupsApp check).
- **C-b (Blank-tolerant validation, corrected — review finding I3):** Transport schemas use `z.union([z.literal(''), z.email()]).optional()` (blank-tolerant; field absent = undefined = not configured). Backend transport always emits the field with `|| ''` fallback. An earlier `z.email().optional()` wording was inconsistent — `z.email()` rejects the `''` the backend always emits.
- **I-a (Zod v4 idiom):** Use `z.email()` instead of deprecated `z.string().email()`.
- **I-b (AppAuthGate provider):** Block around existing `StartupWarmupStateProvider`. `isAuthResolved` → `!isLoading`.
- **I-c (Hook error):** Hook returns `{ isAuthorised, isLoading, error: string | null }`. Gate has loading/error/OAuth-denied/authorised states.
- **I-d (Helper text):** Keep `apiKey` dynamic helper case. Add static `helperText` for `authGroupEmail` only.
- **I-e (Trigger identity, resolved — verified against official Apps Script docs):** `getActiveUser().getEmail()` is available in installable-trigger context because installable triggers run under the account of the user who created them (with that user's authorization). Bypass auth cache for trigger re-check so revocation is detected immediately. Staging verification retained as a prudent check.

### Changes from sixth-pass review

- **C1 (Group denial in gate):** Gate observes warmup query `FORBIDDEN` via shared signal; replaces children with access-denied message. Hook stays OAuth-only.
- **C2 (Form schema):** `BackendSettingsFormSchema` uses `z.union([z.literal(''), z.email()])` (blank-tolerant, follows `jsonDbRootFolderId` precedent). Transport schemas use `z.union([z.literal(''), z.email()]).optional()` (blank-tolerant, matches `BackendUrlSchema` precedent). `apiConfig.js` always emits with `|| ''` fallback.
- **I1 (Cache bypass):** `AuthService.checkAccess()` accepts `{ bypassCache?, requireConfigured? }` options. `triggerHandler()` calls `checkAccess({ bypassCache: true, requireConfigured: true })`.
- **I2 (Trigger unconfigured):** Triggers denied when `AUTH_GROUP_EMAIL` is unconfigured (more restrictive than the API gate's bootstrap fail-open).
- **I3 (Hook FORBIDDEN):** Removed from `useAuthorisationStatus` — hook scopes to its own transport errors only. Group denial observed via gate (C1).
- **I4 (REQUIRED_SCOPES):** Stale comment about non-existent sync script fixed. Scopes updated directly.
- **I5 (Retry wiring):** Retry button uses `queryClient.invalidateQueries` for the `getAuthorisationStatus` query.
- **N1 (Helper text):** "Replace" changed to "extend/keep". `apiKey` dynamic case preserved.
- **N2 (Error code doc):** "Error code enum" → "documented error-code table".
- **N3 (Current hook shape):** Existing constraint description corrected from `{ isAuthorised, isLoading }` to the actual current `{ authViewState, authError, isAuthResolved, isAuthorised }`.
- **N4 (Guard test):** Added note that action plan must enumerate backend source files and exclude allowlisted entrypoints.

### Changes from seventh-pass review

- **C1 (Stale FORBIDDEN refs):** Removed "handle FORBIDDEN" from Placement, tree, and Testing hook section. FORBIDDEN-via-warmup test added to AppAuthGate tests.
- **C2 (Transport blank handling):** Read and write transport schemas use `z.union([z.literal(''), z.email()]).optional()` (blank-tolerant, matches `BackendUrlSchema` precedent). `apiConfig.js` always emits the field.
- **I1 (AuthStatusCard):** Simplified — access-status card (user decision): shows authorised content when granted, generic "You do not have access to this application." when denied (no reason-specific copy). Loading/error states owned by the gate.
- **I2 (Transient shell):** Decision 10 updated to accept transient shell render before warmup FORBIDDEN retraction. Safety via closed queries.
- **I3 (Test gaps):** Added gate FORBIDDEN-via-warmup test, form blank-tolerance test, form compulsory-once-set rejection test.
- **I4 (CacheManager console):** `console.error` → `ABLogger` conversion in scope for `CacheManager.js`.

---

## Purpose

This document defines the intended behaviour for the Auth Service — an application-level access control layer that verifies every API caller is an authorised member of a designated Google Group before any request is processed.

The service will be used to:

- Provide defence-in-depth on top of the existing GAS deployment-level permissions (execute-as-user, Drive-access restrictions).
- Verify that the calling user is a member of a pre-configured Google Group before dispatching any protected API handler.
- Map the user's Google Group role to an application role (admin or user) for future use by downstream handlers.
- Provide an audit trail of all access attempts (allowed and denied) via structured logging.

This feature is **not** intended to:

- Replace or duplicate the existing OAuth scope authorisation check (`ScriptAppManager.isAuthorised()` / `getAuthorisationStatus`).
- Introduce a custom login flow, session tokens, or any ceremony on top of Google's existing authentication.
- Manage group membership — that remains in the Google Groups admin UI.

## Agreed product decisions

1. **Google Groups membership is the authorisation source.** The app checks whether the calling user is a member of a designated Google Group via `GroupsApp.getGroupByEmail()` and `group.hasUser()`. The full member list never touches the script's storage.
2. **`Session.getActiveUser().getEmail()` is the identity source.** In a web app deployed to "execute as user accessing the web app", this reliably returns the accessing user's email. **Identity-model clarification (review finding C2 — verified against the official Apps Script Session reference):** the docs state `User.getEmail()` returns a blank string when the script runs _without the user's authorization_ — e.g. a web app deployed "execute as me" (`USER_DEPLOYING`), anonymous access, or trigger/custom-function contexts — and that this restriction "generally does not apply" when the deployer belongs to the same Google Workspace domain as the user. The `executeAs: USER_ACCESSING` + `access: DOMAIN` combination mandated here is the valid pairing under which the signed-in domain member's email is available; `DOMAIN` access does not blank the email. The blank-email denial at line 687 remains as defence-in-depth.
3. **Role mapping is simple for v1.** `OWNER` and `MANAGER` map to `admin`. `MEMBER` maps to `user`. All other roles (`INVITED`, `PENDING`, `BANNED`) are denied.
4. **Fail closed.** If the email is blank, if GroupsApp throws, if the group does not exist, or if any unexpected error occurs, access is denied.
5. **Cache for performance.** Auth results are cached in `CacheService` via the existing `CacheManager` (extended with generic methods) with a 6-hour TTL. Only successful authorisations are cached; denials are not cached, so a user who is subsequently added to the group will be authorised on their next request without waiting for cache expiry.
6. **Auth check runs before the admission phase.** Unauthorised users are rejected immediately without consuming lock resources or counting against rate limits.
7. **`getAuthorisationStatus` is gate-exempt.** The `getAuthorisationStatus` handler checks OAuth scope authorisation only (via `ScriptAppManager.isAuthorised()`) and returns a boolean. It is **exempt** from the group membership gate — this allows the frontend to determine OAuth status before making gated calls. The auth gate on all other methods checks group membership only.
8. **Audit logging of all access attempts.** Every API call is logged with the user's email, method name, and outcome (allowed/denied) via `ABLogger`.
9. **Frontend distinguishes denial types by mechanism.** OAuth denial is resolved via the gate-exempt `getAuthorisationStatus` (boolean). Group denial is communicated via the `FORBIDDEN` error code from the gate on protected methods. The frontend uses two independent mechanisms rather than a combined payload.
10. **`AppAuthGate` must be a truly blocking gate.** The frontend auth gate must prevent rendering of protected content when the user is unauthorised. OAuth denial blocks before children render. Group denial (detected via warmup query `FORBIDDEN`) may cause a transient shell render before the gate retracts it; safety rests on all protected queries failing closed (no data reaches the client). This is a marked improvement over the current behaviour where the gate only controls startup warmup.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` in `z_apiHandler.js` is the sole frontend transport entrypoint. All requests flow through `ApiDispatcher.handle()`.
- `ApiDispatcher` extends `BaseSingleton` and manages request lifecycle: validation → admission (lock + rate limit) → handler dispatch → completion.
- `ALLOWLISTED_METHOD_HANDLERS` is the sole transport registry.
- The existing `getAuthorisationStatus` handler checks OAuth scope authorisation via `ScriptAppManager.isAuthorised()` — this is a platform-level concern (has the user granted the required scopes?), distinct from the application-level group membership check. **It will remain gate-exempt.**
- `ConfigurationManager` is the canonical singleton for reading/writing `PropertiesService` data. New config keys are added to `CONFIG_KEYS` and `CONFIG_SCHEMA` in `01_configKeysAndSchema.js`. Defaults are set in `02_defaults.js`.
- `CacheManager` in `src/backend/RequestHandlers/CacheManager.js` wraps `CacheService.getScriptCache()` but currently exposes only assessment-specific methods. It must be extended with generic `get`, `put`, and `remove` methods for the auth cache.
- `ABLogger` is mandatory for all new backend code. No direct `console.*` calls.
- Backend files run in a concatenated GAS environment; load order matters. `AuthService` must load after `BaseSingleton` (its class-extends dependency). Other dependencies (`CacheManager`, `ConfigurationManager`, `Session`, `GroupsApp`) are referenced only inside method bodies and resolved at call time — no load-order requirement for those.
- The `appsscript.json` manifest requires **two** new scopes: `https://www.googleapis.com/auth/groups` for `GroupsApp` access, and `https://www.googleapis.com/auth/userinfo.email` for `Session.getActiveUser().getEmail()`. Neither scope is currently declared.
- The `appsscript.json` manifest must declare a `webapp` block with `"executeAs": "USER_ACCESSING"` and `"access": "DOMAIN"`. Without this, `Session.getActiveUser().getEmail()` may return the deployer's identity or a blank string depending on deployment mode, breaking the identity model entirely. The current manifest has no `webapp` block.
- The `GASPropertiesUtils` wrapper (`Utils/00_GASPropertiesUtils.js`) is the canonical entry point for Script/User properties access. All new property access must use it, not raw `PropertiesService`.

### Current data-shape constraints

- The `ApiDispatcher._failure()` envelope accepts `{ code, message, retriable, details? }`. A new `FORBIDDEN` code must be added to `API_ERROR_CODE_MAP`.
- The frontend error-handling layer must recognise the new `FORBIDDEN` code (or it will fall through to a generic error display).
- The `getBackendConfig`/`setBackendConfig` transport payload includes the `apiConfig.js` file which builds the backend config object. Adding `authGroupEmail` requires changes there too.

### Frontend or consumer architecture constraints

- The frontend already handles error envelopes from `apiHandler`. A `FORBIDDEN` response will arrive through the same `google.script.run` failure path. The frontend must display a clear "access denied" message rather than a generic error.
- The frontend has a two-layer auth structure:
  1. **`AppAuthGate`** (composed in `main.tsx`) wraps the entire app. It currently only controls startup warmup orchestration — it does NOT block rendering of protected content. This must change.
  2. **`useAuthorisationStatus`** hook calls `getAuthorisationStatus` (the OAuth scope check, gate-exempt). The current hook returns `{ authViewState, authError, isAuthResolved, isAuthorised }`. The target return shape is `{ isAuthorised, isLoading, error }`.
  3. **`AuthStatusCard`** displays the auth status (loading/authorised/unauthorised). This is currently the only content in `App.tsx`.
- The backend config transport (`getBackendConfig`/`setBackendConfig`) is the canonical mechanism for reading and writing backend configuration. The new `authGroupEmail` field must be added to the transport schema, the `apiConfig.js` payload builder, and the settings form.
- The frontend uses Zod for validation. The `authGroupEmail` field must be validated as an email address when non-empty.
- The frontend settings panel (`BackendSettingsPanel.tsx`) renders form fields from a descriptor array. The descriptor type will be extended with a `helperText` field to support declarative helper text for the new field.

### Security audit: public functions bypassing auth

A comprehensive code audit has identified **28 public functions** (top-level function declarations without a trailing underscore) across the backend. In Google Apps Script, any top-level function that does not end with an underscore (`_`) is automatically exposed to `google.script.run`, meaning it can be called directly from the browser console or by any script with access to the web app URL, completely bypassing the auth check in `apiHandler`.

**Reconciliation:** 2 permanent entrypoints + 6 dead wrappers to delete + 20 functions to rename = 28 total.

#### Permanent public entrypoints (KEEP — 2 functions)

These functions are the legitimate public entrypoints and must remain public:

| File                    | Function     | Purpose                                                   |
| ----------------------- | ------------ | --------------------------------------------------------- |
| `z_Api/z_apiHandler.js` | `apiHandler` | Sole frontend transport entrypoint — auth gate lives here |
| `z_Api/WebApp.js`       | `doGet`      | Web app HTTP GET entrypoint                               |

A third public entrypoint will be added for trigger execution:

| File                         | Function         | Purpose                                                   |
| ---------------------------- | ---------------- | --------------------------------------------------------- |
| `Triggers/triggerHandler.js` | `triggerHandler` | Sole trigger execution entrypoint — auth check + dispatch |

#### Allowlisted API methods (already private — no action required)

The functions registered in `ALLOWLISTED_METHOD_HANDLERS` already use trailing underscores (private by convention) and are wrapped in anonymous closures. They are not exposed to `google.script.run` and are already protected by the auth gate in `ApiDispatcher.handle()`. No rename or other action is required for these functions.

The guard test allowlist is exactly: `apiHandler`, `doGet`, `triggerHandler`.

#### Trigger handler architecture (NEW)

The trigger execution model has been redesigned to provide centralised auth checking, similar to the `apiHandler` pattern for frontend calls.

**Current flow (no auth, UserProperties-based):**

1. Frontend calls `startAssessmentRun(...)` via `apiHandler`
2. `AssignmentController.startProcessing()` stores task context in **UserProperties**
3. Creates a trigger pointing at `triggerProcessSelectedAssignment`
4. Trigger fires → GAS calls `triggerProcessSelectedAssignment()` directly
5. Function reads context from UserProperties, processes the assignment

**New flow (with auth, ScriptProperties-based, keyed by triggerUid):**

1. Frontend calls `startAssessmentRun(...)` via `apiHandler` (auth already checked here)
2. `AssignmentController.startProcessing()` creates the trigger, receives `triggerUid` from GAS
3. Stores task context in **ScriptProperties** keyed by triggerUid:
   - `trigger:<uid>:method` = `'processSelectedAssignment'`
   - `trigger:<uid>:params` = JSON `{ assignmentId, definitionKey, courseId }`
4. Creates trigger pointing at `triggerHandler` (the single public entrypoint)
5. Trigger fires → GAS calls `triggerHandler(event)` with `event.triggerUid`
6. `triggerHandler()` validates input (rejects malformed/missing event with fail-loud logging)
7. `triggerHandler()` runs auth check via `AuthService.checkAccess()` — **fail closed** (denies if email is blank or group check fails; ensures revoked users' triggers do not run)
8. If denied → log and abort, clean up trigger context
9. If allowed → retrieve context via `TriggerController.getTriggerContext(triggerUid)`
10. Dispatch to registered handler in `TRIGGER_METHOD_HANDLERS` map, passing params
11. Cleanup in `finally` block: `TriggerController.clearTriggerContext(triggerUid)`, `triggerController.deleteTriggerById(triggerUid)`

**TriggerController responsibilities:**

- `storeTriggerContext(triggerUid, { method, params })` — stores to ScriptProperties via `GASPropertiesUtils`
- `getTriggerContext(triggerUid)` — retrieves and returns `{ method, params }`
- `clearTriggerContext(triggerUid)` — removes all keys for that triggerUid

**Handler registry (similar to ALLOWLISTED_METHOD_HANDLERS):**

```javascript
const TRIGGER_METHOD_HANDLERS = {
  processSelectedAssignment: (params) =>
    new AssignmentController().processSelectedAssignment(params),
  // future: someOtherTask: (params) => ...,
};
```

**Handler signature change:**
`processSelectedAssignment()` no longer reads from UserProperties internally — it receives the params directly:

```javascript
processSelectedAssignment({ assignmentId, definitionKey, courseId }) {
  // Use params directly, no property reads
}
```

**Migration requirements:**

- Existing triggers must be drained before deploying (they use the old UserProperties model)
- Users must re-authorise the app to grant the new scopes
- The old `triggerProcessSelectedAssignment` function is deleted (replaced by `triggerHandler`)
- `TriggerController.createTimeBasedTrigger` hardcoded recovery path must be updated to use `'triggerHandler'` instead of `'triggerProcessSelectedAssignment'`

**Cleanup ownership:**
`triggerHandler()` owns all cleanup in a `finally` block:

- Clears trigger context via `TriggerController.clearTriggerContext(triggerUid)`
- Deletes the fired trigger via `triggerController.deleteTriggerById(triggerUid)` (prevents trigger accumulation)
- Cleanup only runs for a resolved, known triggerUid (malformed input does not trigger cleanup)
- This ensures cleanup happens even if the handler throws

**Why this architecture:**

- Centralises auth checking for all trigger-based execution (similar to `apiHandler` for frontend calls)
- Supports any number of concurrent triggers without collision (keyed by triggerUid)
- Scales to new trigger methods — just add entries to `TRIGGER_METHOD_HANDLERS`
- TriggerController owns the storage mechanism, so handlers don't need to know about it
- Auth is checked once, centrally, before any handler runs
- Fail-closed ensures revoked users' triggers do not execute

#### Functions to DELETE (dead code — 6 functions)

These functions have no production callers and should be deleted entirely:

| File                             | Function                           | Reason                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AssignmentProcessor/globals.js` | `startProcessing`                  | Wrapper around `AssignmentController.startProcessing()`. The controller method is called directly from the API handler, not through this wrapper.                                                  |
| `AssignmentProcessor/globals.js` | `removeTrigger`                    | No production callers found. Trigger removal is handled internally by controllers.                                                                                                                 |
| `AssignmentProcessor/globals.js` | `testWorkflow`                     | Debug function with no production callers.                                                                                                                                                         |
| `AssignmentProcessor/globals.js` | `triggerProcessSelectedAssignment` | Replaced by `triggerHandler()` entrypoint in the new trigger architecture.                                                                                                                         |
| `y_controllers/globals.js`       | `getAllPartialDefinitions`         | Wrapper around `controller.getAllPartialDefinitions()`. The actual method is called from `assignmentDefinitionTransport.js` via `getAssignmentDefinitionController_().getAllPartialDefinitions()`. |
| `Utils/logError.js`              | `logError`                         | All `logError` calls in the codebase are `progressTracker.logError()`, not the standalone function. This violates the ABLogger policy and should be removed.                                       |

**File-level deletions:** After deleting these functions, the following files will be empty and must be **deleted entirely** along with their corresponding test files:

- `src/backend/Utils/logError.js` and `tests/utils/logError.test.js`
- `src/backend/y_controllers/globals.js`
- `src/backend/AssignmentProcessor/globals.js` and `tests/assignmentProcessor/globals.test.js`

#### Functions to RENAME (still needed, make private — 20 functions)

These functions are internal utilities, validators, or helpers that should never have been exposed to `google.script.run`. Rename with trailing underscore:

| File                                                   | Function                                  | Action                                         |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| `AssignmentProcessor/Assignment/index.js`              | `defineLazySubclass`                      | → `defineLazySubclass_()`                      |
| `ConfigurationManager/03_validators.js`                | `validateLogLevel`                        | → `validateLogLevel_()`                        |
| `ConfigurationManager/03_validators.js`                | `validateRequiredClassInfoStringProperty` | → `validateRequiredClassInfoStringProperty_()` |
| `ConfigurationManager/03_validators.js`                | `validateApiKey`                          | → `validateApiKey_()`                          |
| `ConfigurationManager/03_validators.js`                | `toBoolean`                               | → `toBoolean_()`                               |
| `ConfigurationManager/03_validators.js`                | `toBooleanString`                         | → `toBooleanString_()`                         |
| `ConfigurationManager/03_validators.js`                | `toReadableKey`                           | → `toReadableKey_()`                           |
| `ConfigurationManager/03_validators.js`                | `validateClassInfo`                       | → `validateClassInfo_()`                       |
| `ConfigurationManager/98_ConfigurationManagerClass.js` | `safeGetPropertyKeys`                     | → `safeGetPropertyKeys_()`                     |
| `ConfigurationManager/98_ConfigurationManagerClass.js` | `safeParseConfigObject`                   | → `safeParseConfigObject_()`                   |
| `Models/Cohort.js`                                     | `getCurrentAcademicYearStart`             | → `getCurrentAcademicYearStart_()`             |
| `Utils/ABLogger.js`                                    | `isErrorLike`                             | → `isErrorLike_()`                             |
| `y_controllers/ReferenceDataController.js`             | `generateStableKey`                       | → `generateStableKey_()`                       |
| `z_Api/requestStore.js`                                | `createStartedRecord`                     | → `createStartedRecord_()`                     |
| `z_Api/requestStore.js`                                | `loadStore`                               | → `loadStore_()`                               |
| `z_Api/requestStore.js`                                | `saveStore`                               | → `saveStore_()`                               |
| `z_Api/requestStore.js`                                | `markSuccess`                             | → `markSuccess_()`                             |
| `z_Api/requestStore.js`                                | `markError`                               | → `markError_()`                               |
| `z_Api/requestStore.js`                                | `pruneStaleEntries`                       | → `pruneStaleEntries_()`                       |
| `z_Api/requestStore.js`                                | `compactStore`                            | → `compactStore_()`                            |

**Note on requestStore functions:** These are not in `ALLOWLISTED_METHOD_HANDLERS`. They are loaded via `require('./requestStore.js')` and used internally by `apiHandler` for admission tracking. They are public by accident and must be renamed.

#### Required actions

1. **Delete 6 dead wrapper functions** (no production callers). Delete empty source files and their test counterparts.
2. **Rename 20 functions** with trailing underscores.
3. **Update all internal references** to use the new names.
4. **Update `module.exports`** in each file to export the renamed functions.
5. **Create `Triggers/` domain folder** and move `TriggerController.js` from `Utils/` to `Triggers/`.
6. **Convert `console.*` in `TriggerController.js` to `ABLogger`** as part of the move (per backend opportunistic-refactor rule).
7. **Create `triggerHandler.js`** in `Triggers/` — single public entrypoint for trigger execution.
8. **Create `triggerMethodHandlers.js`** in `Triggers/` — contains `TRIGGER_METHOD_HANDLERS` registry.
9. **Extend `TriggerController`** with context storage methods (`storeTriggerContext`, `getTriggerContext`, `clearTriggerContext`) using `GASPropertiesUtils`.
10. **Update `AssignmentController.startProcessing()`** to use the new trigger context storage model.
11. **Update `AssignmentController.processSelectedAssignment()`** to accept params directly instead of reading from UserProperties.
12. **Update `TriggerController.createTimeBasedTrigger`** hardcoded recovery path to use `'triggerHandler'` instead of `'triggerProcessSelectedAssignment'`.
13. **Drain existing triggers** before deploying (they use the old UserProperties model).
14. **Add documentation** to `src/backend/AGENTS.md` establishing the private-by-default convention and the trigger handler architecture.
15. **Add a guard test** that extends the existing `tests/api/apiHandler/globalExposure.test.js` helper to scan all backend files for public function declarations and fails if any are found that are not in the explicit allowlist (`apiHandler`, `doGet`, `triggerHandler`). The static scan is **line-start anchored** (`^function`) so indented nested declarations (e.g. `apiConfig.js`'s `safeSet`) are not false-flagged, and it skips backend files that do not exist at scan time (e.g. `triggerHandler.js` before the Triggers/ section — `triggerHandler` is allowlisted from the start).

## Shared-helper planning

The following abstraction decisions are implied by the scope and should be recorded in the relevant canonical docs as planned-only entries marked `Not implemented`:

| Abstraction                                            | Canonical doc                                                                  | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic `get`/`put`/`remove` methods on `CacheManager` | `docs/developer/backend/singletons.md`                                         | Add a new CacheManager entry describing the extended generic cache methods. Mark as `Not implemented`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Extend descriptor type with `helperText` field         | `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | Add `helperText?: string` to the form descriptor type. Use static `helperText` for `authGroupEmail` and other static fields. The existing `apiKey` dynamic helper case is preserved as-is. Mark as `Not implemented`.                                                                                                                                                                                                                                                                                                                                                                        |
| Guard test uses static source scan of backend files    | `tests/api/apiHandler/globalExposure.test.js`                                  | Extend the existing global-exposure guard test to scan all backend files using a static source scan (reading file text and flagging top-level `function` declarations without trailing underscore, excluding the three allowlisted entrypoints). The scan is line-start anchored (`^function`) to avoid false-flagging indented nested declarations, and skips backend files that do not exist at scan time. This avoids the load-time `class extends`/`ReferenceError` failures inherent to the execution-based `loadModuleGlobalsInVmContext` approach. Action plan §7 adopts this method. |

## Domain and contract recommendations

### Recommended data shapes

#### Auth result (internal, not transported)

```javascript
{
  allowed: true,
  role: 'admin' | 'user',
  email: 'teacher@school.edu'
}
```

#### Auth cache entry (stored in CacheService)

```javascript
// Key: "auth:<groupEmail>:<email>"
// Value (JSON string):
{
  allowed: true,
  role: 'admin' | 'user'
}
// Denials are never cached.
```

**Revocation latency:** The cache key includes the configured group email so that changing the group invalidates all cached entries by construction. Cache entries naturally expire after the 6-hour TTL. No explicit cache invalidation on config change is required.

#### Error envelope for denied access

```javascript
{
  ok: false,
  requestId: '<uuid>',
  error: {
    code: 'FORBIDDEN',
    message: 'Access denied.',
    retriable: false
  }
}
```

### Naming recommendation

Prefer:

- `AuthService` — the class name.
- `AUTH_GROUP_EMAIL` — the ConfigurationManager key for the group email.
- `FORBIDDEN` — the error code for group membership denial.
- `admin` / `user` — the application role names.
- `triggerHandler` — the single public entrypoint for trigger execution.
- `TRIGGER_METHOD_HANDLERS` — the registry map for trigger methods (similar to `ALLOWLISTED_METHOD_HANDLERS`).
- `trigger:<uid>:method` / `trigger:<uid>:params` — ScriptProperties keys for trigger context.

Avoid:

- `AuthManager` — inconsistent with the existing `ScriptAppManager` (which handles OAuth scope authorisation, a different concern).
- `authorise` / `authoriseUser` — ambiguous with the existing `isAuthorised()` which checks OAuth scopes.
- `TriggerDispatcher` — the dispatch logic lives in `triggerHandler()` directly, not a separate class.

## Data-shape planning

This feature changes several contracts that cross persistence, transport, or validation boundaries. Per `docs/developer/data-shapes/INDEX.md`, the relevant canonical data-shape docs must be updated with planned-only entries marked `Not implemented` **before** any code changes land. The implementation agent should update those entries to remove the `Not implemented` marker as they implement them.

| Change                                                                                      | Canonical doc                                                 | Action                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authGroupEmail` added to `getBackendConfig`/`setBackendConfig` payloads                    | `docs/developer/data-shapes/backend-config.md`                | Add `authGroupEmail` field to the backend config shape. Mark as `Not implemented`.                                                                                                                               |
| New `FORBIDDEN` code in the shared error envelope                                           | `docs/developer/data-shapes/transport-envelope.md`            | Add `FORBIDDEN` to the documented error-code table. Mark as `Not implemented`.                                                                                                                                   |
| `getAuthorisationStatus` remains gate-exempt (boolean return, unchanged shape)              | —                                                             | **No change needed** — the boolean return shape is unchanged.                                                                                                                                                    |
| 7 `requestStore` functions renamed                                                          | `docs/developer/data-shapes/request-store.md`                 | Update function names to trailing-underscore versions. Mark as `Not implemented`.                                                                                                                                |
| New ScriptProperties trigger-context shape (`trigger:<uid>:method`, `trigger:<uid>:params`) | **New file:** `docs/developer/data-shapes/trigger-context.md` | Create new contract file documenting the trigger context storage shape. Add row to `INDEX.md`. Mark as `Not implemented`.                                                                                        |
| New CacheService auth-cache entry (`auth:<groupEmail>:<email>`)                             | **New file:** `docs/developer/data-shapes/auth-cache.md`      | Create new contract file documenting the auth cache entry shape. Add row to `INDEX.md`. Mark as `Not implemented`.                                                                                               |
| Frontend `BackendSettingsFormSchema` for `authGroupEmail`                                   | `docs/developer/data-shapes/backend-config.md`                | The form schema (`backendSettingsForm.zod.ts`) mirrors the backend config transport contract. No separate frontend data-shape file needed — reconcile against the `authGroupEmail` entry in `backend-config.md`. |

**Ordering requirement:** Data-shape doc entries must be created before the corresponding code changes in the action plan. This ensures the implementation agent has a documented target contract to build against.

## Feature architecture

### Placement

#### Backend

- `src/backend/Triggers/` — **new domain folder** for all trigger-related functionality:
  - `TriggerController.js` — moved from `Utils/`, extended with context storage methods, `console.*` converted to `ABLogger`
  - `triggerHandler.js` — new file containing the `triggerHandler()` entrypoint function (validate-then-dispatch, fail-closed auth, cleanup in finally)
  - `triggerMethodHandlers.js` — new file containing the `TRIGGER_METHOD_HANDLERS` registry and handler implementations
- `src/backend/Utils/AuthService.js` — the singleton class (extends `BaseSingleton`, auth check + role resolution).
- `src/backend/RequestHandlers/CacheManager.js` — extended with generic `get`, `put`, `remove` methods.
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` — new `AUTH_GROUP_EMAIL` key and schema entry.
- `src/backend/ConfigurationManager/02_defaults.js` — new `AUTH_GROUP_EMAIL` default entry (`''`).
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` — new `getAuthGroupEmail()` blank-aware getter.
- `src/backend/z_Api/z_apiHandler.js` — auth gate added to `ApiDispatcher.handle()` after request validation but **before the allowlist method lookup** and `_runAdmissionPhase()`. `getAuthorisationStatus` is gate-exempt (determined by method name).
- `src/backend/z_Api/apiConfig.js` — add `authGroupEmail` to backend config transport payload.
- `src/backend/AssignmentProcessor/globals.js` — **DELETE** (all 4 functions deleted, file empty).
- `src/backend/y_controllers/AssignmentController.js` — update `startProcessing()` and `processSelectedAssignment()` to use new trigger context model.
- `src/backend/appsscript.json` — new `groups` and `userinfo.email` scopes, new `webapp` block.

#### Frontend

- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` — add `authGroupEmail` to `BackendConfigSchema` and `BackendConfigWriteInputSchema`.
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts` — add `authGroupEmail` to `BackendSettingsFormSchema` (`z.union([z.literal(''), z.email()])`, blank-tolerant, form-level compulsory-once-set).
- `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts` — map `authGroupEmail` in both directions.
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx` — extend descriptor type with `helperText`, add form field descriptor for `authGroupEmail`, keep existing `apiKey` dynamic helper case.
- `src/frontend/src/features/auth/useAuthorisationStatus.ts` — update return type to `{ isAuthorised, isLoading, error }`. Hook handles its own transport errors only (not FORBIDDEN).
- `src/frontend/src/features/auth/AppAuthGate.tsx` — make truly blocking (around `StartupWarmupStateProvider`). Render loading/OAuth prompt/error/children based on hook state.
- `src/frontend/src/features/auth/AuthStatusCard.tsx` — minimal hook contract change (new return shape with error field).
- `src/frontend/src/errors/map-error-to-ui.ts` — register `FORBIDDEN` error code.

### Proposed high-level tree

```text
src/backend/
├── Triggers/                          # NEW — domain folder for all trigger functionality
│   ├── TriggerController.js           # MOVED from Utils/, extended, console.* → ABLogger
│   ├── triggerHandler.js              # NEW — single public entrypoint for trigger execution
│   └── triggerMethodHandlers.js       # NEW — TRIGGER_METHOD_HANDLERS registry
├── Utils/
│   └── AuthService.js                 # NEW — singleton, auth check + role resolution
├── RequestHandlers/
│   └── CacheManager.js                # EXTEND — add generic get/put/remove
├── ConfigurationManager/
│   ├── 01_configKeysAndSchema.js      # EXTEND — add AUTH_GROUP_EMAIL
│   ├── 02_defaults.js                 # EXTEND — add AUTH_GROUP_EMAIL default
│   └── 98_ConfigurationManagerClass.js # EXTEND — add getAuthGroupEmail()
├── AssignmentProcessor/
│   └── globals.js                     # DELETE — all 4 functions gone, file deleted
├── y_controllers/
│   ├── AssignmentController.js        # EXTEND — update startProcessing() and processSelectedAssignment()
│   └── globals.js                     # DELETE — getAllPartialDefinitions removed, file deleted
├── z_Api/
│   ├── z_apiHandler.js                # EXTEND — auth gate in ApiDispatcher.handle()
│   ├── apiConfig.js                   # EXTEND — add authGroupEmail to payload
│   └── requestStore.js                # RENAME — all functions to trailing underscore
└── appsscript.json                    # EXTEND — add groups + userinfo.email scopes, add webapp block

src/frontend/src/
├── services/backendConfiguration/
│   └── backendConfiguration.zod.ts    # EXTEND — add authGroupEmail field
├── features/settings/backend/
│   ├── backendSettingsForm.zod.ts     # EXTEND — add authGroupEmail (compulsory-once-set)
│   ├── backendSettingsFormMapper.ts   # EXTEND — map authGroupEmail
│   └── BackendSettingsPanel.tsx       # EXTEND — extend descriptor type, add field (apiKey case kept)
├── features/auth/
│   ├── useAuthorisationStatus.ts      # EXTEND — return { isAuthorised, isLoading, error }, own transport errors only
│   ├── AppAuthGate.tsx                # EXTEND — make truly blocking around StartupWarmupStateProvider
│   └── AuthStatusCard.tsx             # EXTEND — simplified (denial subsumed by gate)
└── errors/
    └── map-error-to-ui.ts             # EXTEND — register FORBIDDEN
```

### Out of scope for v1

- Role-based method filtering (deferred to v2+ — v1 maps roles but does not restrict methods by role).
- A frontend admin UI for managing the group membership.
- Token-based or session-based auth on top of Google's existing authentication.
- Removal of `maybeDeserializeProperties()` in `ConfigurationManager` (likely dead code from Sheets-based era; separate scope item).

## Data loading and orchestration

### Required datasets or dependencies

- `Session.getActiveUser()` — GAS built-in, no additional setup.
- `GroupsApp.getGroupByEmail()` — requires `groups` and `userinfo.email` scopes in `appsscript.json`.
- `CacheService.getScriptCache()` — via extended `CacheManager`.
- `ConfigurationManager` — for the group email config value.

### Prefetch or initialisation policy

#### Startup

- None. The AuthService uses lazy initialisation (singleton pattern). No heavy work at file load.

#### Feature entry

- The group membership auth check runs on every `apiHandler` call (except gate-exempt `getAuthorisationStatus`), before the admission phase.
- First call: cache miss → `GroupsApp` lookup → cache result with 6-hour TTL.
- Subsequent calls within 6 hours: cache hit → return cached result.
- Denials are never cached, so the next request will always re-check `GroupsApp`.

#### Trigger execution

- The auth check runs on every `triggerHandler()` call, before dispatching to the registered handler. **Bypasses cache** and **requires group to be configured** (denies when unconfigured — more restrictive than the API gate).
- Trigger context is stored in ScriptProperties keyed by `triggerUid` (not UserProperties).
- `triggerHandler(event)` validates input, resolves triggerUid, retrieves context via `TriggerController.getTriggerContext(triggerUid)`, dispatches to handler, then cleans up context and deletes the trigger in a `finally` block.
- Multiple concurrent triggers are supported — each has its own isolated context keyed by triggerUid.
- On auth denial: log and abort, clean up trigger context. Fail-closed (blank email → deny).
- Malformed input (missing event, unknown triggerUid, unknown method) triggers fail-loud logging and error return without cleanup.

#### Manual refresh

- No manual refresh control. The cache TTL is the refresh mechanism.

### Query or transport additions

- No new API methods. The auth check is internal to `ApiDispatcher.handle()`.
- `getAuthorisationStatus` remains gate-exempt and returns a boolean (OAuth scope check only). Its contract is unchanged.

## Core view model or behavioural model

### Auth check flow

```text
apiHandler(request)
  │
  ├─ ApiDispatcher.handle(request)
  │    │
  │    ├─ 1. Validate request shape (existing)
  │    │
  │    ├─ 2. Check if method is gate-exempt
  │    │    ├─ getAuthorisationStatus → skip to step 7 (admission)
  │    │    └─ All other methods → go to step 3
  │    │
  │    ├─ 3. Read AUTH_GROUP_EMAIL from ConfigurationManager
  │    │    ├─ If empty/missing → FAIL OPEN: log warn, proceed to admission
  │    │    └─ If set → go to step 4
  │    │
  │    ├─ 4. Resolve user email via Session.getActiveUser().getEmail()
  │    │    └─ If blank → deny (FORBIDDEN), log warning
  │    │
  │    ├─ 5. Check cache for key "auth:<groupEmail>:<email>"
  │    │    ├─ Cache hit → proceed to admission (cache only stores allowed users)
  │    │    └─ Cache miss → go to step 6
  │    │
  │    ├─ 6. Call GroupsApp.getGroupByEmail(configuredGroupEmail)
  │    │    ├─ If group not found or error → deny (FORBIDDEN), log error
  │    │    └─ If group found → call group.hasUser(email)
  │    │         ├─ If member → get role via group.getRole(email)
  │    │         │    ├─ Map OWNER/MANAGER → admin, MEMBER → user
  │    │         │    ├─ Cache { allowed: true, role } with 6h TTL
  │    │         │    └─ Proceed to admission
  │    │         └─ If not member → deny (FORBIDDEN), log warning
  │    │              (denial is not cached)
  │    │
  │    ├─ 7. _runAdmissionPhase (existing)
  │    │
  │    ├─ 8. Handler dispatch (existing)
  │    │    └─ getAuthorisationStatus: check OAuth via ScriptAppManager.isAuthorised()
  │    │       → return boolean (gate-exempt, no group check)
  │    │
  │    └─ 9. _runCompletionPhase (existing)
```

### Role mapping

| GroupsApp Role | Application Role | Access  |
| -------------- | ---------------- | ------- |
| `OWNER`        | `admin`          | Allowed |
| `MANAGER`      | `admin`          | Allowed |
| `MEMBER`       | `user`           | Allowed |
| `INVITED`      | —                | Denied  |
| `PENDING`      | —                | Denied  |
| `BANNED`       | —                | Denied  |

### Sort order or priority rules

Not applicable — this is a boolean gate, not a ranked model.

## Main user-facing surface specification

### Recommended components or primitives

- **`AppAuthGate`** — the blocking auth gate that wraps the entire app. Must prevent rendering of protected content when unauthorised.
- **`useAuthorisationStatus`** — the hook that resolves OAuth scope status. Returns `{ isAuthorised, isLoading, error }`.
- **`AuthStatusCard`** — access-status card: shows authorised content when access is granted, and a generic "You do not have access to this application." message when denied (no reason-specific copy; user decision). Loading and error states are owned by `AppAuthGate`.
- **`BackendSettingsPanel`** — the settings form where admins configure the auth group email.

### Fields, columns, or visible sections

#### Backend Settings Panel — new field

- **Auth group email** — a text input field for the Google Group email address.
  - Located in the "Backend" section of the settings form.
  - Validated as an email address using Zod (`z.union([z.literal(''), z.email()])` — blank-tolerant).
  - **Form-level validation:** Once set, the field is compulsory (cannot be cleared to blank). This is enforced in the form submission logic, and the **backend independently rejects clearing** (`setAuthGroupEmail('')` is refused when a value is already stored) as defence-in-depth. Lockout recovery requires hand-editing Script Properties.
  - Helper text: "Enter the email address of the Google Group whose members are allowed to access this application."

### Rendering rules

#### Authorised user

- Normal app behaviour. No visible change.
- `AppAuthGate` renders children normally.

#### Denied user — group membership denial (FORBIDDEN)

- The backend's auth gate returns `FORBIDDEN` on any protected method call.
- The existing frontend error-handling infrastructure processes the `FORBIDDEN` error code.
- The user sees the mapped error message: "You do not have permission to access this application. Please contact your administrator."
- No recovery path is offered (the user cannot self-resolve).

#### Denied user — OAuth scope denial (recoverable)

- `getAuthorisationStatus` (gate-exempt) returns `false`.
- `AppAuthGate` blocks rendering of all protected content.
- The frontend displays a message indicating that permissions are required.
- Example message: "Please grant the required permissions to use this application. Reload the page to try again."

#### Transport error during auth check

- If `getAuthorisationStatus` fails with a transport error (e.g. `RATE_LIMITED`, network error), `useAuthorisationStatus` returns `{ error: '<message>', isLoading: false }`.
- `AppAuthGate` renders the error message with a retry option.
- This is distinct from OAuth denial — the user should retry, not grant permissions.

#### Loading state

- `AppAuthGate` shows a loading indicator while auth state is being resolved.
- No protected content is rendered during loading.

## Workflow specification

## Admin configures the auth group

### Eligible inputs or preconditions

- The admin has edit access to the script project.
- A Google Group exists with the teachers who should have access.

### Inputs, fields, or confirmation copy

- The group email address is stored as a ScriptProperty via `ConfigurationManager`.
- The key is `AUTH_GROUP_EMAIL`.
- The value is the full email address of the Google Group (e.g., `teachers@school.edu`).
- The field is optional initially but **compulsory once set** (cannot be cleared to blank through the UI). The backend also rejects clearing a stored value via `setBackendConfig` (defence-in-depth).

### Behaviour

- The admin sets the group email via the existing backend config mechanism (`setBackendConfig`).
- The value is validated as a valid email address when non-empty.
- On the next API call, the AuthService uses this group email for membership checks.

## Teacher accesses the app

### Eligible inputs or preconditions

- The teacher has a Google account in the same domain.
- The teacher is a member of the configured Google Group.
- The teacher has authorised the script's OAuth scopes (existing flow).

### Behaviour

1. The teacher opens the app URL.
2. The frontend loads and renders `AppAuthGate`.
3. `useAuthorisationStatus` calls `getAuthorisationStatus` (gate-exempt) to check OAuth scopes.
4. **If the auth check experiences a transport failure:**
   - `useAuthorisationStatus` returns `{ error: '<message>', isLoading: false }`.
   - `AppAuthGate` renders the error message with a retry option (not the OAuth denial message).
5. **If OAuth scopes are not granted:**
   - `getAuthorisationStatus` returns `false`.
   - `useAuthorisationStatus` returns `{ isAuthorised: false, isLoading: false, error: null }`.
   - `AppAuthGate` renders the "Permissions required" message (recoverable — reload to grant).
   - No protected content is rendered.
6. **If OAuth scopes are granted:**
   - `getAuthorisationStatus` returns `true`.
   - `useAuthorisationStatus` returns `{ isAuthorised: true, isLoading: false, error: null }`.
   - `AppAuthGate` proceeds to render the protected application (inside `StartupWarmupStateProvider`).
   - On subsequent protected API calls:
     - **If no group is configured (bootstrap state):** The auth gate fails open — all users are allowed with a warning log. The admin should configure the group email as soon as possible.
     - **If the teacher is in the group:** The auth gate allows the request. Normal app behaviour.
     - **If the teacher is not in the group:** The auth gate returns `FORBIDDEN`. The frontend error infrastructure displays the "Access denied" message. The user cannot self-resolve.

## Error, loading, and empty-state rules

### Blocking failure

- If `Session.getActiveUser().getEmail()` returns a blank string, access is denied. This should not happen in the "execute as user" deployment model, but the check is a defence-in-depth guard.
- If `GroupsApp.getGroupByEmail()` throws (group not found, permission error), access is denied.
- If the `AUTH_GROUP_EMAIL` config value is missing or empty, access is **allowed** (fail-open) with a loud warning. This is the bootstrap state.

### Frontend blocking states

- **Auth loading state:** `AppAuthGate` shows a loading indicator while `isLoading` is `true`. No protected content is rendered.
- **Auth transport error:** `AppAuthGate` shows the error message with a retry option when `error` is non-null. No protected content is rendered. This is distinct from OAuth denial.
- **OAuth denial:** `AppAuthGate` shows "Permissions required" message when `isAuthorised === false` and `error === null`. User can reload to grant permissions.
- **Group denial (FORBIDDEN):** The existing frontend error infrastructure processes the error code. The user sees a permanent "Access denied" message with no recovery path.
- **Warmup failure (non-FORBIDDEN):** The gate renders children normally — it does not add a second blocking layer. Existing per-surface degraded/blocking states apply (e.g. the startup warmup provider's own failure handling).
- **Backend config load failure:** The settings panel shows an error alert. The user cannot configure the auth group email until the backend config is loadable.

### Partial-load or partial-success failure

Not applicable — auth is a binary gate.

### Empty states

#### No config value set

- All users are **allowed** (fail-open). The audit log shows a warning on every request: "Auth group email not configured — failing open."
- The admin should set the `AUTH_GROUP_EMAIL` config value as soon as possible via the backend settings form.
- This is a deliberate bootstrap state — it allows the admin to access the settings form to configure the group.

#### Group does not exist

- All users are denied. The audit log shows the GroupsApp error.
- The admin must verify the group email is correct.

## Accessibility and usability notes

- The auth check is invisible to authorised users. No additional UI or interaction is required.
- Denied users see a clear "Access denied" message via the existing error-handling path.
- The denial message should be presented in a way that is accessible to screen readers (using appropriate ARIA attributes).
- The loading state during auth resolution should be announced to screen readers.
- No confirmation is needed for destructive actions (there are none in the auth flow).
- The auth group email field in the settings form should have appropriate helper text and validation feedback.

## Backend changes required to support agreed behaviour

1. **Create `AuthService` singleton**
   - Location: `src/backend/Utils/AuthService.js`
   - Extends `BaseSingleton`
   - Methods: `isGroupMember(email)` returns `{ allowed, role }` (private, checks group membership), `checkAccess(options?)` resolves email and delegates to `isGroupMember`. `options` accepts `{ bypassCache?: boolean, requireConfigured?: boolean, method?: string }`. When `method` is provided it is included in the audit log entry (the "method if available" the audit contract promises); the API gate passes `request.method`, `triggerHandler` passes the trigger method resolved from context.
   - **Naming note:** The private method is named `isGroupMember` to avoid collision with `ScriptAppManager.isAuthorised()` (which checks OAuth scopes, a different concern). SPEC §Naming advises against names ambiguous with the existing OAuth check.
   - **Fail-open when unconfigured:** If `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured` is not set, `checkAccess()` returns `{ allowed: true, role: 'user' }` with a loud `ABLogger.warn`. This is the bootstrap state for the API gate.
   - **Fail-closed when `requireConfigured` is set:** If `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured: true`, `checkAccess()` denies with a loud `ABLogger.error`. This is used by `triggerHandler()`.

2. **Extend `CacheManager` with generic methods**
   - Add `get(key)`, `put(key, value, ttlSeconds)`, `remove(key)` methods
   - Keep existing assessment-specific methods unchanged
   - Generic methods handle serialisation/deserialisation and error handling
   - **Convert existing `console.error` calls to `ABLogger`** as part of this change (touched file, same opportunistic-refactor rule as `TriggerController`)

3. **Add `AUTH_GROUP_EMAIL` to ConfigurationManager**
   - Add key to `CONFIG_KEYS` in `01_configKeysAndSchema.js`
   - Add schema entry with blank-tolerant email validation (blank → `''`, otherwise validate as email)
   - Add `AUTH_GROUP_EMAIL: ''` to `DEFAULTS` in `02_defaults.js` (defaults to `''` — the getter returns `''` when blank, triggering fail-open)
   - Add `getAuthGroupEmail()` blank-aware getter and `setAuthGroupEmail(value)` setter to `98_ConfigurationManagerClass.js`
   - Include `authGroupEmail` in `getBackendConfig_()` transport payload (`apiConfig.js`). **Always emits** `authGroupEmail: getAuthGroupEmail() || ''`.
   - Add `authGroupEmail` to `setBackendConfig_()` write path (`apiConfig.js`): add an entry to the `updates` array calling `configManager.setAuthGroupEmail(value)`
   - **Backend-enforced compulsory-once-set:** `setAuthGroupEmail('')` (blank) is rejected when a non-blank value is already stored — the stored value is preserved and the write path surfaces an aggregated error entry so the frontend can display the rejection. Changing the value to a different non-blank email remains allowed. This is the backend layer of the compulsory-once-set rule (defence-in-depth; the form-level guard is the frontend layer). Recovery stays via hand-editing Script Properties (see Admin lockout recovery).

4. **Add auth gate to `ApiDispatcher.handle()`**
   - Insert auth check after request validation, **before the allowlist method lookup** and `_runAdmissionPhase()`. Non-members receive `FORBIDDEN` uniformly and cannot probe which API methods exist (`UNKNOWN_METHOD` responses are only observable by authorised callers).
   - Gate applies to all methods **except** `getAuthorisationStatus` (gate-exempt). Gate-exempt status is determined by the method name before the gate runs — the full allowlist lookup happens after the gate.
   - On denial, return `_failure(requestId, 'FORBIDDEN', 'Access denied.', false)`
   - Do not proceed to admission phase on denial
   - Pass `method: request.method` to `checkAccess()` so the audit log records the requested method.
   - **Fail-open when `AUTH_GROUP_EMAIL` is empty:** Skip the auth check and proceed to admission with a warning log.

5. **Add `FORBIDDEN` to `API_ERROR_CODE_MAP`**
   - Add `FORBIDDEN: 'FORBIDDEN'` to the map in `z_apiHandler.js`
   - Justification: "authenticated but not a group member"

6. **`getAuthorisationStatus` handler remains gate-exempt**
   - File: `src/backend/z_Api/z_apiHandler.js` (handler in `ALLOWLISTED_METHOD_HANDLERS`)
   - Continues checking OAuth scope authorisation via `ScriptAppManager.isAuthorised()` and returns boolean
   - No group membership check — that is handled by the gate on all other methods
   - Contract is unchanged from current behaviour

7. **Add required scopes and webapp block to `appsscript.json`**
   - Add `"https://www.googleapis.com/auth/groups"` to `oauthScopes` array
   - Add `"https://www.googleapis.com/auth/userinfo.email"` to `oauthScopes` array
   - Add `"webapp": { "executeAs": "USER_ACCESSING", "access": "DOMAIN" }` block
   - **This is critical:** Without `userinfo.email`, `Session.getActiveUser().getEmail()` returns blank → all users denied. Without `webapp.executeAs = USER_ACCESSING`, the identity model is unreliable.
   - **GWS-domain prerequisite (assumption):** `webapp.access: "DOMAIN"` is only valid when the deployment belongs to a Google Workspace domain. This feature assumes the project is deployed within such a domain (the same Workspace org as the Google Group). If the project uses a personal (Gmail) identity, DOMAIN access is not applicable — confirm the appropriate `access` value with the deploying admin before rollout.

8. **Secure all public functions that bypass auth**
   - Delete 6 dead wrapper functions (no production callers)
   - Delete 3 empty source files (`Utils/logError.js`, `y_controllers/globals.js`, `AssignmentProcessor/globals.js`)
   - Delete corresponding test files (`tests/utils/logError.test.js`, `tests/assignmentProcessor/globals.test.js`)
   - Rename 20 internal functions with trailing underscores (see Security Audit table above)
   - This includes the 7 `requestStore.js` functions which are public by accident (not in ALLOWLISTED_METHOD_HANDLERS)
   - Update all internal references to use the new names
   - Update `module.exports` in each file to export the renamed functions
   - This is a **blocking prerequisite** for the auth service deployment

9. **Create `Triggers/` domain folder and `triggerHandler()` entrypoint**
   - Location: `src/backend/Triggers/` (new domain folder per repo rules)
   - Move `TriggerController.js` from `Utils/` to `Triggers/`
   - Convert all `console.*` calls in `TriggerController.js` to `ABLogger` as part of the move
   - Create `triggerHandler.js` — single public entrypoint for all trigger execution
   - Create `triggerMethodHandlers.js` — contains `TRIGGER_METHOD_HANDLERS` registry and handler implementations
   - `triggerHandler()` validates input before dispatching (missing event → log error via `ABLogger` and abort; unknown triggerUid → log error and abort; unknown method → log error and abort). **No return value is expected from a trigger** — GAS discards trigger return values, so validation failures surface via fail-loud logging + skipping execution (review finding C3)
   - Performs auth check via `AuthService.checkAccess({ bypassCache: true, requireConfigured: true, method: <trigger method> })` before dispatching. **Bypasses the auth cache** (always calls `GroupsApp` directly so that recently revoked users are detected immediately). **Requires group to be configured** (denies if `AUTH_GROUP_EMAIL` is empty — triggers are more restrictive than the API gate which fails open in bootstrap). The trigger method is resolved from the trigger context during input validation (the unknown-method check reads `context.method`), so it is available at auth time and recorded in the audit log.
   - Retrieves trigger context via `TriggerController.getTriggerContext(triggerUid)`
   - Dispatches to registered handler in `TRIGGER_METHOD_HANDLERS` map, passing params
   - Cleans up trigger context and deletes trigger in `finally` block (only for known, resolved triggerUid)
   - On auth denial: log and abort, clean up trigger context

10. **Extend `TriggerController` with context storage methods**
    - Location: `src/backend/Triggers/TriggerController.js` (moved from `Utils/`)
    - `storeTriggerContext(triggerUid, { method, params })` — stores to ScriptProperties via `GASPropertiesUtils`, keyed by triggerUid
    - `getTriggerContext(triggerUid)` — retrieves and returns `{ method, params }`
    - `clearTriggerContext(triggerUid)` — removes all keys for that triggerUid
    - This centralises the storage mechanism so handlers don't need to know about it

11. **Update `AssignmentController.startProcessing()`**
    - Create trigger pointing at `triggerHandler` (not `triggerProcessSelectedAssignment`)
    - Store task context via `TriggerController.storeTriggerContext(triggerUid, { method: 'processSelectedAssignment', params: { assignmentId, definitionKey, courseId } })`
    - No longer uses UserProperties for task context

12. **Update `AssignmentController.processSelectedAssignment()`**
    - Accept params directly: `processSelectedAssignment({ assignmentId, definitionKey, courseId })`
    - No longer reads from UserProperties internally
    - No longer cleans up trigger context or deletes the trigger — `triggerHandler()` owns all cleanup

13. **Update `TriggerController.REQUIRED_SCOPES`**
    - Add `https://www.googleapis.com/auth/groups` and `https://www.googleapis.com/auth/userinfo.email` to the `REQUIRED_SCOPES` array directly (the stale comment referencing a non-existent `src/AdminSheet`/`sync-appscript.js` is legacy; no sync script exists in the repo).
    - Update the stale comment to note that scopes should be kept in sync with `appsscript.json` manually.

14. **Add documentation for private-by-default convention**
    - Update `src/backend/AGENTS.md` to document that all backend functions must be private (underscore-suffixed) except for the three permanent entrypoints (`apiHandler`, `doGet`, `triggerHandler`) and functions explicitly registered in `ALLOWLISTED_METHOD_HANDLERS`.
    - Document the trigger handler architecture and `TriggerController` context storage pattern.
    - This is a repo-wide convention to prevent future auth bypass surface.

15. **Add guard test for public function exposure**
    - Extend the existing `tests/api/apiHandler/globalExposure.test.js` guard test to scan all backend files for public function declarations (no trailing underscore) using a static source scan (read file text, flag top-level `function` declarations) and fail if any are found that are not in the explicit allowlist (`apiHandler`, `doGet`, `triggerHandler`). The action plan must enumerate backend source files (excluding tests and vendored code) and discover them via a glob over `src/backend/**/*.js` at test time. The three allowlisted entrypoints must be excluded from the scan.
    - **Scan precision:** anchor the match to line starts (`^function`) so indented nested function declarations (e.g. `apiConfig.js`'s `safeSet`) are not false-flagged; skip backend source files that do not exist at scan time (e.g. `src/backend/Triggers/triggerHandler.js` before the Triggers/ section creates it — `triggerHandler` is allowlisted from the start).

16. **Frontend error handling for `FORBIDDEN`**
    - The frontend must recognise the `FORBIDDEN` error code and display a clear "Access denied" message.
    - The user must not see the app interface if denied.

## Frontend changes required to support agreed behaviour

1. **Add `authGroupEmail` to backend config transport schema**
   - File: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
   - Add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()` to `BackendConfigSchema` (read schema — blank-tolerant, follows the `z.union([…, z.literal('')])` idiom established by `BackendUrlSchema`)
   - Add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()` to `BackendConfigWriteInputSchema` (write schema — patch payload, field is optional)
   - **Backend transport:** `apiConfig.js` **always** emits `authGroupEmail: getAuthGroupEmail() || ''` (matches the field-always-present pattern of every other config field; the blank-tolerant schema handles `''` naturally)
   - **Write mapper:** always maps the field (coalescing `undefined → ''` on read-back); no omit-when-blank logic needed

2. **Add `authGroupEmail` to backend settings form schema**
   - File: `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
   - Add `authGroupEmail` to `BackendSettingsFormSchema` as a blank-tolerant email field using `z.union([z.literal(''), z.email()])`. This tolerates an empty string (the `Input` component submits `''` when blank) while validating non-empty values as email addresses. (Note: the `jsonDbRootFolderId` form field uses a different blank-tolerant idiom — `z.union` is chosen here for clarity with the email validator.)
   - **Form-level validation rule:** Once the field has a value, it cannot be cleared to blank. This is enforced in the form submission logic, not the Zod schema. The backend independently enforces the same rule: `setBackendConfig` with a blank `authGroupEmail` while a value is stored is rejected (defence-in-depth).

3. **Map `authGroupEmail` in the form mapper**
   - File: `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
   - Add `authGroupEmail` to `mapBackendConfigToBackendSettingsFormValues` (read direction)
   - Add `authGroupEmail` to `mapBackendSettingsFormValuesToBackendConfigWriteInput` (write direction)

4. **Extend descriptor type and add form field to settings panel**
   - File: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
   - Extend the form field descriptor type with `helperText?: string`
   - Add a new field descriptor with static `helperText` for `authGroupEmail`
   - The existing `apiKey` dynamic helper case (`getApiKeyHelperCopy(hasApiKey)`) is preserved as-is
     ```typescript
     {
       name: 'authGroupEmail',
       label: 'Auth group email',
       renderInput: () => <Input type="email" autoComplete="email" />,
       section: 'Backend',
       withSchemaValidation: true,
       helperText: 'Enter the email address of the Google Group whose members are allowed to access this application.',
     }
     ```

5. **Register `FORBIDDEN` error code in shared error mapping**
   - File: `src/frontend/src/errors/map-error-to-ui.ts`
   - Register `FORBIDDEN` in the `errorCodes` object and `errorCodeToMessageMap`:
     ```typescript
     FORBIDDEN: 'You do not have permission to access this application. Please contact your administrator.';
     ```
   - The justification is: the user is authenticated (has a Google account) but not a member of the configured group.

6. **Update `useAuthorisationStatus` hook contract**
   - File: `src/frontend/src/features/auth/useAuthorisationStatus.ts`
   - Update the return type to `{ isAuthorised: boolean, isLoading: boolean, error: string | null }`
   - `getAuthorisationStatus` remains gate-exempt and returns a boolean (unchanged contract)
   - `error` captures transport failures (e.g. `RATE_LIMITED`, network errors) distinct from OAuth denial
   - The hook does **not** handle `FORBIDDEN` — group denial is observed by the gate via warmup query failures (see change 7)

7. **Make `AppAuthGate` truly blocking**
   - File: `src/frontend/src/features/auth/AppAuthGate.tsx`
   - Currently `AppAuthGate` only controls startup warmup orchestration. It must be updated to prevent rendering of protected content when unauthorised.
   - The blocking gate is added **around** the existing `StartupWarmupStateProvider`/`warmStartupQueries` orchestration — children render inside the provider only when authorised.
   - The existing `isAuthResolved` guard maps to `!isLoading`.
   - Consume `{ isAuthorised, isLoading, error }` from `useAuthorisationStatus`.
   - When `isLoading === true`: render a loading indicator.
   - When `error` is non-null: render a transport error message with retry option. The retry triggers a refetch of the `getAuthorisationStatus` query via `queryClient.invalidateQueries`.
   - When `isAuthorised === false`: render the OAuth "Permissions required" message (recoverable).
   - When `isAuthorised === true`: render children inside `StartupWarmupStateProvider` (protected content).
   - **Group-denial detection:** The gate reads the warmup query error from the React Query cache. When the error's `code` field equals `'FORBIDDEN'` (from `map-error-to-ui.ts`), the gate switches to a denied render state, replacing children with the access-denied message. **Non-FORBIDDEN warmup failures render children normally** — the gate does not add a second blocking layer; existing per-surface degraded/blocking states apply (confirmed user decision). The gate only denies on `FORBIDDEN`, ensuring its "access denied" message is shown specifically for group membership denial.

8. **Update `AuthStatusCard` for new hook contract**
   - File: `src/frontend/src/features/auth/AuthStatusCard.tsx`
   - Update to consume the new hook return shape (`{ isAuthorised, isLoading, error }`)
   - Simplified to an **access-status card (user decision):** shows authorised content when access is granted, and a generic "You do not have access to this application." message when denied — without reason-specific copy. Loading/error states are owned by `AppAuthGate`.

## Planning handoff notes

### Backend prerequisites

- **Security critical:** 6 dead wrapper functions must be deleted, 3 empty source files and 2 test files must be deleted, 20 internal functions must be renamed with trailing underscores before the auth service is deployed.
- **Trigger architecture:** New `triggerHandler()` entrypoint must be created. `TriggerController` must be extended with context storage methods (using `GASPropertiesUtils`). `AssignmentController.startProcessing()` and `processSelectedAssignment()` must be updated to use the new trigger context model.
- **Trigger migration:** Existing triggers must be drained before deploying (they use the old UserProperties model). After deploying, new triggers will point at `triggerHandler` and use ScriptProperties keyed by triggerUid.
- **Trigger identity (verified against official Apps Script docs):** `Session.getActiveUser().getEmail()` is available in installable-trigger execution context — the Installable Triggers guide states installable triggers "always run under the account of the person who created them" with that user's authorization, so the trigger resolves the creating user's email (not blank). Staging verification (rollout step 4) is retained as a prudent pre-production check before the fail-closed trigger auth rule is deployed.
- **Scopes critical:** Both `groups` and `userinfo.email` scopes must be added to `appsscript.json`. Without `userinfo.email`, `Session.getActiveUser().getEmail()` returns blank → all users denied.
- **Deployment mode critical:** The `webapp` block must be added to `appsscript.json` with `executeAs: USER_ACCESSING` and `access: DOMAIN`. Without this, the identity model is unreliable.
- The `CacheManager` extension is a prerequisite for the `AuthService` implementation. The generic methods must be in place before the auth cache logic is built.
- The `AUTH_GROUP_EMAIL` config key must be added to `ConfigurationManager` (`01_configKeysAndSchema.js`, `02_defaults.js`, `98_ConfigurationManagerClass.js`) before the `AuthService` can read it.
- The `FORBIDDEN` error code must be added to `API_ERROR_CODE_MAP` before the auth gate can return it.
- The `authGroupEmail` field must be included in the backend config transport payload (`apiConfig.js`) before the frontend can read/write it.
- **Documentation:** `src/backend/AGENTS.md` must be updated with the private-by-default convention and trigger handler architecture before the security changes are merged.
- **Test harness:** GAS stubs (`Session`, `GroupsApp`, `CacheService`) must be provisioned in the test harness before the auth gate can be integrated into dispatcher tests. Test file deletions and relocations must be handled.

### Frontend prerequisites

- The `authGroupEmail` field must be added to the backend config transport schema before the frontend settings form can include it.
- The descriptor type extension (`helperText`) must land before the settings panel field descriptor references it.
- The `FORBIDDEN` error code must be registered in `map-error-to-ui.ts` before `useAuthorisationStatus` can handle it.
- `AppAuthGate` must be made truly blocking before the app can be considered secure for handling sensitive data about minors.

### Bootstrap sequence

The deployment must follow this sequence to avoid bricking the app:

1. **Drain existing triggers** before deploying (they use the old UserProperties model and point at `triggerProcessSelectedAssignment`).
2. Deploy with all security changes (function deletions/renames, new trigger architecture, scopes, webapp block, auth gate).
3. On first access, the auth gate is in **fail-open** state (no group configured). All users are allowed with a warning log.
4. The admin accesses the settings form and sets the `AUTH_GROUP_EMAIL` value.
5. From that point forward, the auth gate is **fail-closed**. Only group members are allowed.
6. New triggers created after deployment will point at `triggerHandler` and use ScriptProperties keyed by triggerUid.

## Testing expectations

### Backend tests

- **`AuthService` unit tests:** Must be tested with mocked `Session`, `GroupsApp`, `CacheManager`, and `ConfigurationManager`. Test cases:
  - Authorised user (cache miss → GroupsApp check → cache set → return allowed)
  - Authorised user (cache hit → return allowed without GroupsApp call)
  - Denied user (cache miss → GroupsApp check → return denied, no cache set)
  - Blank email → deny
  - GroupsApp error → deny
  - Group not found → deny
  - **Missing config value → allow (fail-open) with warning log**
  - Role mapping: OWNER → admin, MANAGER → admin, MEMBER → user, INVITED → deny, PENDING → deny, BANNED → deny
  - Audit logging: verify `ABLogger` is called for allowed and denied attempts
- **`CacheManager` generic methods unit tests:** Must be tested with mocked `CacheService`. Test `get`, `put`, `remove` methods.
- **`ApiDispatcher` unit tests:** Must verify the auth gate runs before the admission phase and that denied requests do not consume lock resources. Must verify fail-open behaviour when `AUTH_GROUP_EMAIL` is empty. Must verify `getAuthorisationStatus` is gate-exempt.
- **`triggerHandler` unit tests:** Must verify auth check runs before dispatch. Must verify context retrieval via `TriggerController.getTriggerContext(triggerUid)`. Must verify dispatch to correct handler in `TRIGGER_METHOD_HANDLERS`. Must verify context cleanup in `finally` block. Must verify auth denial logs and aborts. Must verify malformed input handling (missing event, unknown triggerUid, unknown method).
- **`TriggerController` context storage tests:** Must verify `storeTriggerContext`, `getTriggerContext`, `clearTriggerContext` methods. Must verify ScriptProperties are keyed by triggerUid via `GASPropertiesUtils`. Must verify concurrent triggers don't collide.
- **`AssignmentController` trigger integration tests:** Must verify `startProcessing()` stores context via `TriggerController.storeTriggerContext()` with correct method and params. Must verify `processSelectedAssignment()` accepts params directly.
- **Test harness provisioning:** GAS stubs for `Session`, `GroupsApp`, and `CacheService` must be added to `tests/setupGlobals.js` or `tests/helpers` before the gate can be integrated. Any existing test file whose source is deleted must also be deleted. `tests/utils/triggerController.test.js` must be relocated to `tests/triggers/`.
- **Public function security guard test:** The existing `tests/api/apiHandler/globalExposure.test.js` must be extended to scan all backend files for public function declarations (no trailing underscore) using a static source scan and fail if any are found that are not in the explicit allowlist (`apiHandler`, `doGet`, `triggerHandler`). The scan is line-start anchored (`^function`) so indented nested declarations are not false-flagged, and it skips backend files that do not exist at scan time.

### Frontend tests

- **`backendConfiguration.zod.ts` tests:** Verify `authGroupEmail` is included in read and write schemas. Verify email validation rejects invalid emails.
- **`backendSettingsForm.zod.ts` tests:** Verify `authGroupEmail` field is validated as an email address when non-empty.
- **`backendSettingsFormMapper.ts` tests:** Verify `authGroupEmail` is mapped correctly in both directions.
- **`BackendSettingsPanel` component tests:** Verify the new field renders with correct label, input type, and declarative helper text.
- **`useAuthorisationStatus` tests:** Verify the hook surfaces its own transport errors (e.g. `RATE_LIMITED`) via `error`. Verify boolean return from `getAuthorisationStatus` drives `isAuthorised`. The hook does **not** observe `FORBIDDEN` — that is tested at the gate level.
- **`AppAuthGate` tests:** Verify the gate blocks rendering of children when `!isAuthorised`. Verify loading state is shown while auth is resolving. Verify children are rendered when authorised. **Verify the gate renders the mapped "access denied" message when a warmup query fails with `FORBIDDEN`.** Verify the transport error state renders with a retry option.
- **`BackendSettingsForm` tests:** Verify `authGroupEmail` form field accepts `''` (blank, bootstrap state). Verify non-empty values are validated as email addresses. Verify the compulsory-once-set rule: clearing a previously-set value is rejected.

### Integration tests

- Verify the full flow from frontend API call → auth check → handler dispatch (or denial).
- Verify that a user not in the Google Group receives `FORBIDDEN` on every protected API call and the frontend displays the appropriate denial message.
- Verify `getAuthorisationStatus` is gate-exempt and resolves OAuth status without group check.

## Documentation and rollout notes

### Backend documentation

- `docs/developer/backend/oauth-scopes.md` should note that `appsscript.json` has been updated with new scopes (do not duplicate the scope enumeration — the canonical source is `appsscript.json`).
- `src/backend/AGENTS.md` must be updated with:
  - A note about the `AuthService` singleton and its role in the request lifecycle.
  - The **private-by-default convention**: all backend functions must be private (underscore-suffixed) except for the three permanent entrypoints (`apiHandler`, `doGet`, `triggerHandler`) and functions explicitly registered in `ALLOWLISTED_METHOD_HANDLERS`.
  - A note about the `webapp` block requirement in `appsscript.json`.
  - A new section documenting the **trigger handler architecture**: `Triggers/` domain folder, `triggerHandler()` as the single entrypoint, `TriggerController` context storage, `TRIGGER_METHOD_HANDLERS` registry, and the ScriptProperties-keyed-by-triggerUid model.

### Frontend documentation

- No new documentation files are required, but the frontend AGENTS.md may need a note about the blocking auth gate pattern.

### Rollout steps

1. The admin must create a Google Group and populate it with authorised teachers.
2. **Verify the `webapp` block** in `appsscript.json` declares `"executeAs": "USER_ACCESSING"` and `"access": "DOMAIN"`. If not, add it and redeploy.
3. The app must be redeployed after the `groups` and `userinfo.email` scopes are added to `appsscript.json`. Users must re-authorise the app to grant the new scopes (this happens automatically on next access).
4. **Staging verification (before enabling production group enforcement):** In a staging deployment with the new scopes and webapp block, verify:
   - `Session.getActiveUser().getEmail()` resolves to the signed-in user's email (not blank).
   - The Google Group resolves via `GroupsApp.getGroupByEmail()` and membership checks behave as expected.
   - A non-member receives `FORBIDDEN` on a protected API call.
   - The web app is reachable at DOMAIN level and the signed-in identity is used (`executeAs: USER_ACCESSING`).
   - **Trigger identity:** `Session.getActiveUser().getEmail()` resolves in installable-trigger execution context (this gates the fail-closed trigger auth rule — see Planning handoff notes).
     Only after these pass, proceed to production enforcement.
5. **Before deploying to production:** Drain all existing triggers (they use the old UserProperties model). After deploying, new triggers will point at `triggerHandler` and use ScriptProperties keyed by triggerUid.
6. On first access after deployment, the auth gate will be in **fail-open** state (no group configured). The admin should immediately set the `AUTH_GROUP_EMAIL` config value via the backend settings form.
7. Once the group email is configured, the auth gate becomes **fail-closed**. All subsequent requests will require valid group membership.

### Admin lockout recovery

If the admin accidentally sets an incorrect `AUTH_GROUP_EMAIL` (e.g., a group they are not a member of), they will be locked out of the app UI. Recovery procedure:

1. Open the Apps Script IDE for the deployment.
2. Navigate to **Project Settings** → **Script Properties**.
3. Find the `__CONFIG_STORE_KEY__` property (this contains all backend config as a JSON blob).
4. Edit the JSON value to remove or blank the `authGroupEmail` field.
5. Save the property.
6. The auth gate returns to **fail-open** state on the next request.
7. The admin can now access the settings form and set the correct group email.

**Operational risk:** Hand-editing the JSON blob is error-prone. Consider promoting the deferred "verify caller's own membership before persisting" guard into v1 to prevent this scenario. This is deferred to a future iteration.

## V1 scope recommendation

### Include in v1

- Google Groups membership check via `GroupsApp`.
- Role mapping (OWNER/MANAGER → admin, MEMBER → user).
- Auth cache with 6-hour TTL via extended `CacheManager` (only successful authorisations are cached).
- Cache key includes group email for revocation latency control.
- Fail-closed behaviour for all error cases **except** missing config (fail-open with warning).
- Audit logging of all access attempts.
- `FORBIDDEN` error code registered in shared error mapping.
- `AUTH_GROUP_EMAIL` config key in `ConfigurationManager` (with `02_defaults.js` entry and blank-aware getter) and backend config transport.
- `getAuthorisationStatus` gate-exempt (OAuth only, boolean return, unchanged contract).
- All API methods are accessible to both admin and user roles (no role-based restrictions in v1).
- **Security: Delete 6 dead wrapper functions** and 3 empty source files, delete corresponding test files.
- **Security: Rename 20 internal functions with trailing underscores** (including requestStore functions which are public by accident).
- **Security: Create `Triggers/` domain folder** and move `TriggerController.js` from `Utils/` to `Triggers/` (convert `console.*` to `ABLogger`).
- **Security: Create `triggerHandler.js`** in `Triggers/` — single public entrypoint for trigger execution with centralised auth checking, validate-then-dispatch, fail-closed.
- **Security: Create `triggerMethodHandlers.js`** in `Triggers/` — contains `TRIGGER_METHOD_HANDLERS` registry.
- **Security: Extend `TriggerController`** with context storage methods (`storeTriggerContext`, `getTriggerContext`, `clearTriggerContext`) keyed by triggerUid in ScriptProperties, using `GASPropertiesUtils`.
- **Security: Update `AssignmentController`** to use new trigger context model (no longer UserProperties).
- **Security: Extend guard test** using existing `globalExposure.test.js` helper to prevent future public function exposure.
- **Security: Add `userinfo.email` scope** to `appsscript.json` (required for `Session.getActiveUser().getEmail()`).
- **Security: Add `webapp` block** to `appsscript.json` with `executeAs: USER_ACCESSING`, `access: DOMAIN`.
- **Documentation: Private-by-default convention** and trigger handler architecture in `src/backend/AGENTS.md`.
- **Data-shape docs:** Update canonical contracts before code changes.
- Frontend: `authGroupEmail` field in backend settings form (compulsory-once-set, blank-tolerant initial state).
- Frontend: Extend descriptor type with `helperText` field. Use static `helperText` for `authGroupEmail`; preserve `apiKey` dynamic helper case.
- Frontend: `AppAuthGate` as a truly blocking gate (prevents rendering of protected content when unauthorised).
- Frontend: Distinction between OAuth denial (recoverable, via `getAuthorisationStatus` boolean) and group denial (permanent, via `FORBIDDEN` error code).
- Frontend: `FORBIDDEN` registered in shared error mapping (`map-error-to-ui.ts`).

### Defer from v1

- Role-based method filtering using an allow-list approach (methods are closed by default; each method explicitly declares which roles can access it). This will be added in a later version.
- A frontend admin UI for managing the group membership (separate from the settings form field).
- Custom role definitions beyond admin/user.
- Auth cache warming or pre-fetching.
- Self-membership verification guard on `setBackendConfig` (prevents admin lockout but adds complexity).
- Removal of `maybeDeserializeProperties()` in `ConfigurationManager` (likely dead code from Sheets-based era; separate scope item).

### Accepted risk

- **Vendored JsonDbApp exposure:** The inlined vendored code in `scripts/builder/vendor/jsondbapp/src/**` contains 10 top-level non-underscore function declarations (including `loadDatabase` and `createAndInitialiseDatabase`) that are exposed to `google.script.run` in the deployed bundle. These bypass the auth gate. This is an accepted risk for v1 — a GitHub issue will be opened to address it separately.

### Future role-based method filtering (v2+)

When role-based method filtering is implemented, it will use an **allow-list approach** rather than a deny-list:

- Each API method in `ALLOWLISTED_METHOD_HANDLERS` will declare which roles can access it.
- By default, a method is closed to all roles unless explicitly granted.
- This is a security-first approach: access is denied unless explicitly permitted, rather than permitted unless explicitly denied.
- The role information resolved during the auth check (admin/user) will be passed to the method dispatcher, which will consult the allow-list before invoking the handler.
- If a user's role is not in the method's allow-list, the request will be denied with a `FORBIDDEN` error (same as an unauthorised user).
