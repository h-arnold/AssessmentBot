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

### 1.1 Node test compatibility boundary

- Production backend files run in a concatenated GAS script environment first, not a Node module graph.
- Do not add `require`, `import`, `export`, `module.exports`, or other Node module wiring to production backend logic just to satisfy tests.
- The only permitted Node-testing shim in production backend files is a guarded export block at the end of the file, for example:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    myFunction,
    MyClass,
  };
}
```

- Keep this block at the end of the file.
- Keep it minimal: export only what tests need from that file.
- If tests need older paths or aliases, prefer fixing the tests or adding test-only wrappers outside the runtime path instead of adding more Node-specific code to backend runtime files.
- Exception: a small guarded Node fallback may be acceptable when a file must read a constant/helper during tests and the GAS runtime normally provides it globally. Keep such fallbacks minimal, guarded, and behaviourally identical to GAS.

### 1.2 Concatenation and load-order model

- Backend files are effectively evaluated as one large script in GAS, so definition order matters.
- Assume later files can see globals created by earlier files; do not assume the reverse.
- When a file depends on a symbol defined elsewhere, preserve or introduce file ordering that guarantees that symbol already exists by the time the file is evaluated.
- Numeric prefixes are load-order signposts and must remain stable unless the load order is intentionally being changed.

Current common prefix meanings:

- `00_*`: foundational runtime primitives/constants that must exist very early
- `01_*`, `02_*`, `03_*`: ordered support files that define constants, defaults, validators, or helper values used by later files
- `98_*`: primary class/module implementation that depends on earlier support files
- `99_*`: globals or thin entry helpers that should load after the main implementation

Rules:

- Preserve existing numbering when editing files.
- If you split a backend concern across multiple files, use numbering to make dependency order obvious.
- Prefer references via already-defined globals in GAS-facing code rather than introducing module imports.
- Do not rename numbered files casually; tests, build steps, and runtime ordering may rely on those names.
- Keep `y_*` and `z_*` directories/files in their established relative order when adding new backend entry surfaces or controllers.

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
- Keep runtime exports GAS-compatible; the guarded `if (typeof module !== 'undefined' && module.exports)` block at the end of the file is the default and preferred test-enablement pattern.

## 6. Manifest and Service Changes

When backend behaviour requires new scopes/services:

- Update `src/backend/appsscript.json`.
- Keep scope/service additions minimal and justified.
- Remember builder manifest merge uses backend manifest as base.

## 7. Testing Delegation

- Delegate all test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/backend/backend-testing.md` before changing tests.
