# Backend Agent Instructions (`src/backend`)

Applies when editing `src/backend/**` and backend runtime behaviour.

## 0. Backend API Entry Layer

- `src/backend/z_Api` is the current active entry surface for functions called from the frontend via `google.script.run` / `apiHandler` as migration progresses.
- Organise API files by domain/resource in a REST-ish style.
- Keep API functions thin and delegate to controller classes unless delegation would add unnecessary verbosity.
- Existing backend `globals.js` files are migration references and should be removed once equivalent `z_Api` functions exist.

### 0.1 Required `apiHandler` pattern

- Treat `src/backend/z_Api/z_apiHandler.js` as the single frontend transport entrypoint.
- `apiHandler` is the **sole** function callable by `google.script.run` for all active `z_Api` methods.
- Register all frontend-callable methods as entries in `ALLOWLISTED_METHOD_HANDLERS` inside `z_apiHandler.js`. This object is the sole transport registry; do not add parallel method-name registries elsewhere.
- Return plain response data from handler closures; envelope shaping (`ok`, `requestId`, `error`) must stay in `apiHandler`.
- Keep admission/completion tracking (`_runAdmissionPhase`, `_runCompletionPhase`) intact for all allowlisted methods.
- Treat `getBackendConfig` and `setBackendConfig` in `src/backend/z_Api/apiConfig.js` as the canonical backend configuration transport methods.
- Do not reintroduce configuration transport through `src/backend/ConfigurationManager/99_globals.js`; that legacy transport file has been removed.

#### Trivial handlers — inline closures

For simple one-liner controller delegations with no private helpers, inline the call as an anonymous closure directly in `ALLOWLISTED_METHOD_HANDLERS`:

```javascript
getABClassPartials: () => new ABClassController().getAllClassPartials(),
```

Anonymous closures in a `const` object are not exposed to `google.script.run`.

#### Non-trivial handlers — trailing-underscore private helper functions

For handlers that require validation helpers, multi-step logic, or data transformation, define trailing-underscore helper functions in the relevant `z_Api` file and call them from a thin closure in `ALLOWLISTED_METHOD_HANDLERS`:

```javascript
// In googleClassrooms.js — trailing underscore prevents GAS from exposing this to google.script.run
function getGoogleClassrooms_(parameters) { … }
```

```javascript
// In z_apiHandler.js ALLOWLISTED_METHOD_HANDLERS
getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
```

The official Apps Script specification excludes functions whose names end with `_` from the callable surface exposed to `google.script.run`. No IIFE or namespace-object wrapper is required; the trailing underscore is sufficient and cleaner.

Internal helper functions within a `z_Api` file that are not transport-entry functions (e.g. `validateParametersObject_`) also use the trailing underscore for consistency and to prevent accidental GAS-global exposure.

Export trailing-underscore handlers from the guarded `module.exports` block so that Node unit tests can access them without polluting `globalThis`:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getGoogleClassrooms_ };
}
```

This pattern is now used by `getGoogleClassrooms_`, `getAssignmentDefinitionPartials_`, `deleteAssignmentDefinition_`, `getBackendConfig_`, `setBackendConfig_`, `upsertABClass_`, `updateABClass_`, and `deleteABClass_` in their respective `z_Api` files.

### 0.2 Validation ownership

Transport-boundary validation belongs in API-layer trailing-underscore helpers. Domain invariants belong in the called controller, class, or manager.

Rules:

1. **Transport validation in API-layer trailing-underscore helpers** — shape of the incoming request, type of envelope fields, path-character safety on string identifiers, foreign-API response shape validation.
2. **Domain invariants in the controller** — non-empty string checks, integer range checks, required-field completeness, business-rule validation. Do not reimplement these in the transport layer.
3. **No duplication** unless an explicit security defence-in-depth guard is required; mark any deliberate duplicate with a code comment explaining the intent so it survives future de-sloppification reviews.
4. **All new functionality must follow this rule** from the point of introduction.
5. **Old functionality touched during a change should be opportunistically refactored** toward this rule; keep opportunistic scope local and low-risk.

See `docs/developer/backend/api-layer.md` — "Validation ownership rules" — for the canonical policy and examples.

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
- Never add `require`, `import`, `export`, `module.exports`, or other Node module wiring to production backend logic just to satisfy tests.
- The **only** permitted Node-testing shim in production backend files is a guarded export block at the end of the file, for example:

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
- If tests need older paths, aliases, or globals, fix the tests first, usually in `tests/setupGlobals.js` or the relevant test helper.
- Exposing GAS globals in the test harness. **NEVER** add Node fallback code to production files.
- Do not add top-of-file Node compatibility snippets such as guarded `require(...)` blocks, alias variables for globals, or mixed runtime/module initialisation unless there is no safer alternative and the user explicitly accepts it.
- Treat any non-export Node-specific production code as an exception case that requires justification, not the default pattern.

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
- For tests, mirror that order in `tests/setupGlobals.js` by attaching required globals before loading dependent modules.
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
- See § 0.2 above for the transport-vs-domain validation ownership rules that apply specifically
  to `z_Api` files.

## 3. Error and Logging Contract (Backend Only)

Canonical policy source of truth:

- `docs/developer/backend/backend-logging-and-error-handling.md`

User-facing failures:

- `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`

Developer diagnostics:

- `ABLogger.getInstance().debugUi/info/warn/error(...)`

Rules:

- `ABLogger` is mandatory for all new backend code in active backend areas.
- Do not add direct `console.log/info/warn/error` calls in new backend code.
- When touching existing backend code, opportunistically refactor nearby touched direct `console.*` calls to `ABLogger`, keeping scope local and low-risk.
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
- When tests fail because a GAS global is missing in Node, update the test harness before changing production backend code.

## 6. Manifest and Service Changes

When backend behaviour requires new scopes/services:

- Update `src/backend/appsscript.json`.
- Keep scope/service additions minimal and justified.
- Remember builder manifest merge uses backend manifest as base.

## 7. Testing Delegation

- Delegate all test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/backend/backend-testing.md` before changing tests.
