# Backend Agent Instructions (`src/backend`)

Applies when editing `src/backend/**` and backend runtime behaviour.

opencode injects this file when you touch a backend file. The docs it points to are **not** injected — read them when the trigger below applies. Keep this file to non-negotiables and the read gate; move detailed policy, rationale, and inventories into the docs.

## 1. Scope

- Backend code is plain Google Apps Script (V8) JavaScript under `src/backend/**`, targeting `src/backend/appsscript.json`. It is not TypeScript and not a Node module graph.
- Backend files are concatenated into a single GAS script before execution, so definition order and numeric file prefixes are part of runtime behaviour (§5.2).
- Use GAS services for platform operations instead of non-GAS alternatives that do not execute in Apps Script, and do not introduce Node/browser runtime dependencies.

## 2. Non-negotiables

- Route every frontend request through `apiHandler` in `src/backend/z_Api/z_apiHandler.js`; register all frontend-callable methods in `ALLOWLISTED_METHOD_HANDLERS`, the sole transport registry. Do not add parallel method-name registries.
- Return plain response data from handler closures; envelope shaping (`ok`, `requestId`, `error`) stays in `apiHandler`.
- Backend functions are private by default: every top-level backend function **must** have a trailing underscore (`_`) so GAS does not expose it to `google.script.run`. The only public entrypoints are `apiHandler`, `doGet`, and `triggerHandler`. Register frontend-callable handlers as anonymous closures in `ALLOWLISTED_METHOD_HANDLERS` — they are not globals, so they are already private. The static global-exposure guard test enforces this boundary. See `docs/developer/security/attack-surface-reduction.md` for the exposure model.
- `google.script.run` prohibits `Date`, `Function`, and DOM values in both parameters and return values, including inside nested objects and arrays. Convert live `Date` objects to ISO 8601 strings with `DateUtils` at the transport boundary (see `docs/developer/backend/api-layer.md`).
- Treat 550 lines as a hard decomposition trigger for any backend file in scope. Decompose it with the facade pattern in the same change; never game the threshold with formatting tricks (see §8).
- Access singletons via `Class.getInstance()`; never construct one directly.
- Fail loudly: validate direct inputs and let genuine wiring errors surface. Never catch-and-ignore errors, and do not hide known internal wiring behind defensive existence/type checks.
- Set default values in a module's constructor only; root `AGENTS.md` owns this rule.

## 3. Required documentation

Read the matching doc before you act. When in doubt, read it.

| Doc                                                            | Read before                                                                                       | Covers                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/developer/backend/api-layer.md`                          | adding or changing a frontend-callable method, transport validation, or the `apiHandler` registry | API layer, validation ownership rules, sole-transport registry, endpoints, prohibited types |
| `docs/developer/backend/backend-logging-and-error-handling.md` | changing logging, error handling, or user-facing failure feedback                                 | `ABLogger`/`ProgressTracker` usage, log levels, error-boundary standards                    |
| `docs/developer/backend/backend-testing.md`                    | writing or changing backend tests                                                                 | Vitest setup, GAS load order, mock factories, test-harness rules                            |
| `docs/developer/backend/backend-file-organisation.md`          | splitting an oversized file or grouping `z_Api` files                                             | facade-pattern decomposition, `z_Api` domain folders                                        |
| `docs/developer/backend/AssessmentFlow.md`                     | changing the assessment pipeline                                                                  | assessment workflow and data flow                                                           |
| `docs/developer/backend/rehydration.md`                        | hydrating a full assignment from partial class objects                                            | rehydration model                                                                           |
| `docs/developer/backend/singletons.md`                         | adding or changing a singleton                                                                    | singleton pattern and conventions                                                           |
| `docs/developer/backend/oauth-scopes.md`                       | adding or changing OAuth scopes                                                                   | scopes in `appsscript.json`                                                                 |
| `docs/developer/backend/Vendoring.md`                          | adding or changing a vendored asset                                                               | vendoring policy                                                                            |
| `docs/developer/data-shapes/INDEX.md`                          | changing a backend-facing contract                                                                | canonical data-shape specifications                                                         |
| `docs/developer/security/README.md`                            | changing authentication, access control, deployment, or data handling                             | security layering model and threat model                                                    |
| `docs/developer/builder/builder-script.md`                     | changing the manifest or build inputs                                                             | manifest merge and build pipeline                                                           |

## 4. API entry layer

`apiHandler` is the sole frontend transport entrypoint for all active `z_Api` methods.

- **Trivial handlers** — a single controller delegation with no private helpers — inline an anonymous closure directly in `ALLOWLISTED_METHOD_HANDLERS`:

```javascript
getABClassPartials: () => new ABClassController().getAllClassPartials(),
```

- **Non-trivial handlers** — validation helpers, multi-step logic, or data transformation — define a trailing-underscore helper in the relevant `z_Api` file and call it from a thin closure:

```javascript
// In googleClassrooms.js — the trailing underscore keeps this off google.script.run
function getGoogleClassrooms_(parameters) { … }
```

```javascript
// In z_apiHandler.js ALLOWLISTED_METHOD_HANDLERS
getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
```

GAS excludes trailing-underscore functions from the `google.script.run` callable surface (§2), so no IIFE or namespace-object wrapper is required. Internal helpers that are not transport entries (for example `validateParametersObject_`) use the same suffix. Export trailing-underscore handlers from the guarded `module.exports` block (§5.1) so Node unit tests can reach them.

Configuration transport: `getBackendConfig` and `setBackendConfig` in `src/backend/z_Api/apiConfig.js` are canonical; do not reintroduce transport through `src/backend/ConfigurationManager/99_globals.js`.

See `docs/developer/backend/api-layer.md` for the full pattern, admission/completion tracking, the current handler inventory, and the endpoint contracts.

## 5. Runtime model, load order, and the Node boundary

Use GAS-native services where applicable:

- Storage/state: `PropertiesService`
- Triggers/scheduling: `ScriptApp` (or existing trigger wrappers)
- Locking: `LockService`
- HTTP: `UrlFetchApp`
- Workspace data access: `SpreadsheetApp`, `SlidesApp`, `DriveApp`, advanced services in manifest

Many of these GAS services already have wrapper modules. Check the codebase for these before using them directly.

### 5.1 Node test compatibility boundary

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

- Keep this block at the end of the file, and keep it minimal: export only what tests need from that file.
- Do not add any other Node compatibility code to production files — top-of-file guarded `require(...)` blocks, alias variables for globals, mixed runtime/module initialisation, or Node fallbacks. Expose GAS globals only in the test harness. Treat any such production code as a justified exception, not the default pattern.
- If tests need older paths, aliases, or globals, fix the tests first, usually in `tests/setupGlobals.js` or the relevant test helper.

### 5.2 Concatenation and load-order model

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

## 6. Validation ownership and utilities

### 6.1 Validation ownership

Transport-boundary validation belongs in API-layer trailing-underscore helpers. Domain invariants belong in the called controller, class, or manager.

Rules:

1. **Transport validation in API-layer trailing-underscore helpers** — shape of the incoming request, type of envelope fields, path-character safety on string identifiers, foreign-API response shape validation.
2. **Domain invariants in the controller** — non-empty string checks, integer range checks, required-field completeness, business-rule validation. Do not reimplement these in the transport layer.
3. **No duplication** unless an explicit security defence-in-depth guard is required; mark any deliberate duplicate with a code comment explaining the intent so it survives future de-sloppification reviews.
4. **All new functionality must follow this rule** from the point of introduction.
5. **Old functionality touched during a change should be opportunistically refactored** toward this rule; keep opportunistic scope local and low-risk.

See `docs/developer/backend/api-layer.md` — "Validation ownership rules" — for the canonical policy and examples.

### 6.2 Validation and utility contracts

Use `src/backend/Utils/Validate.js` for generic validation. Required parameter presence pattern:

```javascript
Validate.requireParams({ paramName1, paramName2 }, 'methodName');
```

Use `src/backend/Utils/00_ArrayUtils.js` for generic array operations.

Rules:

- Reuse the existing generic validator or utility method before adding a new one.
- Add reusable generic validators to `Validate` and reusable generic array helpers to `ArrayUtils`.
- Keep domain/business-specific validation and array logic in the owning class.
- Do not duplicate generic validation or array logic across modules.
- New `ArrayUtils` methods must remain static and carry JSDoc; preserve the file's `00_` prefix and load order (see §5.2).
- For the transport-vs-domain validation ownership rules that apply to `z_Api` files, see §6.1.

#### `ArrayUtils`

`ArrayUtils` provides generic static array helpers and follows the same pattern as `Validate.js`.

**Available utilities**:

- `ITEM_NOT_FOUND_INDEX` - Global sentinel constant (-1) for a "not found" index, from `src/backend/00_Constants.js` (not an `ArrayUtils` member)
- `ArrayUtils.findIndexWithPredicate(items, predicate)` - Finds index of first item matching predicate
- `ArrayUtils.findWithPredicate(items, predicate)` - Finds first item matching predicate, returns `null` if not found
- `ArrayUtils.serialiseArray(items)` - Serialises array by calling toJSON() on each item if available

**Usage Pattern**:

```javascript
// In production files (GAS runtime)
/* global ArrayUtils */
const index = ArrayUtils.findIndexWithPredicate(items, (item) => item.id === targetId);

// In tests (Node environment)
// ArrayUtils is set up as global in tests/setupGlobals.js
const item = ArrayUtils.findWithPredicate(items, (item) => item.name === targetName);
```

**Implementation Notes**:

- The `serialiseOwner` method from `ABClass.js` was intentionally kept as an instance method in `ABClass` as it is specific to that class's serialization logic
- Array utility methods are truly generic and reusable across the codebase.

## 7. Authentication and deployment

`src/backend/Utils/AuthService.js` is the application-level authorisation singleton. Access it with `AuthService.getInstance()` and never instantiate it directly; access resolution fails closed for empty or broken configuration. See `docs/developer/security/application-authentication.md` for the access model (bootstrap claim, trigger `neverClaim` context, auth modes) and `docs/developer/data-shapes/auth-users.md` for the auth-mode contract.

The backend manifest must retain `webapp.executeAs: USER_ACCESSING` and `webapp.access: DOMAIN`. This identity model requires deployment within a Google Workspace domain; a personal Gmail deployment must be reviewed with the deploying administrator before rollout.

## 8. File and folder organisation

- Group `z_Api` files into a domain folder when two or more share a common domain prefix; keep single-file domains flat.
- Full rules — the facade-pattern decomposition procedure and the `z_Api` domain-folder convention — are in `docs/developer/backend/backend-file-organisation.md`.

## 9. Logging and error handling

- Canonical policy: `docs/developer/backend/backend-logging-and-error-handling.md`.
- User-facing failures: `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`.
- Developer diagnostics: `ABLogger.getInstance().info/warn/error/debug(...)`; `ABLogger` is mandatory for new backend code and direct `console.*` calls are not allowed.
- Never add an empty `catch`, and never duplicate the same error detail in both `logError` and `ABLogger.error`.
- The canonical doc covers log levels, boundary standards, `apiHandler` diagnostics, secret hygiene, and the error-type inventory.

## 10. Manifest and service changes

When backend behaviour requires new scopes or services:

- Update `src/backend/appsscript.json`.
- Keep additions minimal and justified.
- The builder manifest merge uses the backend manifest as its base (see `docs/developer/builder/builder-script.md`).

## 11. Testing delegation

- Delegate all backend test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.opencode/agents/testing-specialist.md` and `docs/developer/backend/backend-testing.md` before changing tests.
