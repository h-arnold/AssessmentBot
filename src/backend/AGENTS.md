# Backend Agent Instructions (`src/backend`)

Applies when editing `src/backend/**` and backend runtime behaviour.

## 0. Backend API Entry Layer

- `src/backend/Api` is the target entry surface for functions called from the frontend via `google.script.run` as migration progresses.
- Organise API files by domain/resource in a REST-ish style.
- Keep API functions thin and delegate to controller classes unless delegation would add unnecessary verbosity.
- Existing backend `globals.js` files are migration references and should be removed once equivalent `Api` functions exist.

### 0.1 Required `apiHandler` migration pattern

- Treat `src/backend/Api/apiHandler.js` as the single frontend transport entrypoint.
- Register new frontend-callable methods in `src/backend/Api/apiConstants.js` (`API_METHODS` and `API_ALLOWLIST`).
- Implement allowlisted dispatch in `ApiDispatcher._invokeAllowlistedMethod(...)` and keep the handler path thin.
- Return plain response data from allowlisted methods; envelope shaping (`ok`, `requestId`, `error`) must stay in `apiHandler`.
- Keep admission/completion tracking (`_runAdmissionPhase`, `_runCompletionPhase`) intact for all allowlisted methods.

## 1. Runtime Model (GAS V8 Script)

- Target runtime is Google Apps Script V8 (`src/backend/appsscript.json`).
- Write plain GAS-compatible JavaScript (script/global style), not TypeScript.
- Do not introduce Node/browser runtime dependencies in backend runtime code.
- Use GAS services for platform operations instead of non-GAS alternatives.

Use GAS-native services where applicable:

- Storage/state: `PropertiesService`
- Triggers/scheduling: `ScriptApp` (or existing trigger wrappers)
- Locking: `LockService`
- HTTP: `UrlFetchApp`
- Workspace data access: `SpreadsheetApp`, `SlidesApp`, `DriveApp`, advanced services in manifest

**Important**: Many of these GAS services alrady have wrapper modules. Check the codebase for these before using them directly.

Do not replace GAS service calls with Node/browser equivalents that do not execute in Apps Script.

## 2. Validation Contract (Backend Only)

Use `src/backend/Utils/Validate.js` for generic validation.

Required parameter presence pattern:

```javascript
Validate.requireParams({ paramName1, paramName2 }, 'methodName');
```

Rules:

- Use existing generic validators before adding new ones.
- Add reusable generic validators to `Validate`.
- Keep domain/business-specific validation in the owning class.
- Do not duplicate generic validation logic across modules.

## 3. Error and Logging Contract (Backend Only)

User-facing failures:

- `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`

Developer diagnostics:

- `ABLogger.getInstance().debugUi/info/warn/error(...)`

Rules:

- Do not duplicate the same error details in both `logError` and `ABLogger.error`.
- Never add empty `catch` blocks.
- Do not suppress errors with defensive feature detection.
- Prefer fail-fast behaviour (log and rethrow when needed).

Top-level error boundary pattern:

```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err;
}
```

## 4. Defensive-Guard Policy

- Do not add existence/type/feature checks for known internal modules, singletons, logger methods, or GAS services.
- Validate direct input parameters; do not mask internal wiring issues.

## 5. Backend Conventions

- Singletons: always via `Class.getInstance()`.
- Preserve existing file/load ordering conventions (including numeric prefixes where present).
- Keep runtime exports GAS-compatible; Node-only exports must remain guarded (`if (typeof module !== 'undefined' ...)`) for tests.

## 6. Manifest and Service Changes

When backend behaviour requires new scopes/services:

- Update `src/backend/appsscript.json`.
- Keep scope/service additions minimal and justified.
- Remember builder manifest merge uses backend manifest as base.

## 7. Testing Delegation

- Delegate all test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/backend/backend-testing.md` before changing tests.
