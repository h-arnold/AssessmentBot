# Backend Agent Instructions (`src/backend`)

Applies when editing `src/backend/**` and backend runtime behaviour.

## 0. Key Documentation

| Doc                                                            | Summary                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `docs/developer/backend/backend-logging-and-error-handling.md` | Logging and error handling policy for backend code      |
| `docs/developer/backend/backend-testing.md`                    | Backend testing conventions and commands                |
| `docs/developer/backend/api-layer.md`                          | API layer design, validation ownership rules            |
| `docs/developer/backend/AssessmentFlow.md`                     | Assessment workflow and data flow (canonical reference) |
| `docs/developer/data-shapes/INDEX.md`                          | Canonical data-shape specifications (contract registry) |
| `docs/developer/backend/rehydration.md`                        | Full assignment hydration from partial class objects    |
| `docs/developer/backend/singletons.md`                         | Singleton pattern guide and conventions                 |
| `docs/developer/backend/oauth-scopes.md`                       | Managing OAuth scopes in appsscript.json                |
| `docs/developer/backend/Vendoring.md`                          | Third-party asset vendoring policy                      |

## 1. Backend API Entry Layer

### 1.1 Required `apiHandler` pattern

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

### 1.2 Validation ownership

Transport-boundary validation belongs in API-layer trailing-underscore helpers. Domain invariants belong in the called controller, class, or manager.

Rules:

1. **Transport validation in API-layer trailing-underscore helpers** — shape of the incoming request, type of envelope fields, path-character safety on string identifiers, foreign-API response shape validation.
2. **Domain invariants in the controller** — non-empty string checks, integer range checks, required-field completeness, business-rule validation. Do not reimplement these in the transport layer.
3. **No duplication** unless an explicit security defence-in-depth guard is required; mark any deliberate duplicate with a code comment explaining the intent so it survives future de-sloppification reviews.
4. **All new functionality must follow this rule** from the point of introduction.
5. **Old functionality touched during a change should be opportunistically refactored** toward this rule; keep opportunistic scope local and low-risk.

See `docs/developer/backend/api-layer.md` — "Validation ownership rules" — for the canonical policy and examples.

## 2. Runtime Model (GAS V8 Script)

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

### 2.1 Node test compatibility boundary

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

### 2.2 Concatenation and load-order model

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

### 2.3 AuthService singleton

- `src/backend/Utils/AuthService.js` is the singleton for application-level authorisation.
- It centralises Google Group membership checks, role mapping, successful-result caching, and
  access-attempt audit logging.
- The API gate fails open during bootstrap when `AUTH_GROUP_EMAIL` is empty so an administrator can
  configure the application. Trigger execution passes `requireConfigured: true` and fails closed.
- Access the service with `AuthService.getInstance()`; do not instantiate it directly.

### 2.4 Backend function exposure and security audit

Backend functions are private by default: every top-level backend function **must** have a trailing
underscore (`_`) so Google Apps Script does not expose it to `google.script.run`. The exceptions are
the public entrypoints `apiHandler`, `doGet`, and `triggerHandler`, plus functions explicitly named
in `ALLOWLISTED_METHOD_HANDLERS` when that constant is present. The Section 7 security audit deleted
six dead wrappers and renamed 20 required functions to this convention; the static global-exposure
guard test protects the boundary.

### 2.5 Web-app deployment block

The backend manifest must retain `webapp.executeAs: USER_ACCESSING` and `webapp.access: DOMAIN`.
This identity model requires deployment within a Google Workspace domain; a personal Gmail
deployment must be reviewed with the deploying administrator before rollout.

### 2.6 Trigger handler architecture

- Trigger functionality lives in the `src/backend/Triggers/` domain folder.
- `triggerHandler()` is the single public trigger entrypoint and performs validate-then-dispatch
  with fail-closed authorisation.
- `TriggerController` owns Script Properties context storage keyed by `triggerUid`:
  `trigger:<uid>:method` and `trigger:<uid>:params`.
- `TRIGGER_METHOD_HANDLERS` is the registry for dispatchable trigger methods.
- `triggerHandler()` owns cleanup for resolved trigger IDs: it clears context and deletes the fired
  trigger, including when dispatch throws.

## 3. Validation Contract (Backend Only)

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
- See § 1.2 above for the transport-vs-domain validation ownership rules that apply specifically
  to `z_Api` files.

## 3.1 Utility Classes (Backend Only)

Use `src/backend/Utils/00_ArrayUtils.js` for generic array operations.

### ArrayUtils Class

`ArrayUtils` is a utility class that provides generic array helper methods as static functions. It follows the same pattern as `Validate.js` and is designed for reuse across the codebase.

**Design Pattern**:

- Defined in `src/backend/Utils/00_ArrayUtils.js` with `00_` prefix to ensure proper GAS concatenation load order (loads before `Models/ABClass.js`)
- Static methods only - no instantiation required
- Exported for Node/Vitest environment via guarded `module.exports` block
- Accessed as global in GAS runtime via file concatenation

**Available utilities**:

- `ArrayUtils.ITEM_NOT_FOUND_INDEX` - Constant value (-1) for "not found" index
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
- Array utility methods are truly generic and reusable across the codebase

Rules:

- Use existing utility methods before adding new ones.
- Add reusable generic array helpers to `ArrayUtils`.
- Keep domain/business-specific array logic in the owning class.
- Do not duplicate generic array logic across modules.
- When adding new methods to `ArrayUtils`, maintain the static method pattern and add appropriate JSDoc.
- The `00_` prefix must be preserved to maintain GAS load ordering.

## 4. Error and Logging Contract (Backend Only)

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

## 5. Defensive-Guard Policy

- Do not add existence/type/feature checks for known internal modules, singletons, logger methods, or GAS services.
- Validate direct input parameters; do not mask internal wiring issues.

## 6. Backend Conventions

- Singletons: always via `Class.getInstance()`.
- Preserve existing file/load ordering conventions (including numeric prefixes where present).
- Keep runtime exports GAS-compatible; the guarded `if (typeof module !== 'undefined' && module.exports)` block at the end of the file is the default and preferred test-enablement pattern.
- When tests fail because a GAS global is missing in Node, update the test harness before changing production backend code.

## 7. Manifest and Service Changes

When backend behaviour requires new scopes/services:

- Update `src/backend/appsscript.json`.
- Keep scope/service additions minimal and justified.
- Remember builder manifest merge uses backend manifest as base.

## 8. Default Values Rule

- Default values must be set in a module's constructor only.
- If defaults are found elsewhere, they should be opportunistically moved to the constructor of the module.

## 9. Date handling at the transport boundary

`google.script.run` prohibits `Date` objects in return values (see `src/frontend/AGENTS.md` §5.3
for the full rules). All API handler functions must convert live `Date` objects to ISO strings
before returning data.

- Use `DateUtils.normaliseDateFields(response, ['field1', 'field2'])` for shallow or known
  date fields. Apply the call after the controller returns and before the handler returns.
- Use `DateUtils.deepConvertDates(value)` for responses with deeply nested date objects
  (e.g. assignments with nested submissions). This recursively converts all `Date` objects
  to ISO strings. Apply this in the specific handler rather than in `apiHandler` to avoid
  the performance cost on endpoints that do not need it.
- This is the canonical pattern; do not inline `instanceof Date` checks or push conversion into
  controllers or models.
- `DateUtils` lives at `src/backend/Utils/DateUtils.js` and exports `normaliseDateFields`,
  `deepConvertDates`, `isNewer`, `definitionNeedsRefresh`, `getFormattedDate`, and `getFutureDate`.

## 10. Testing Delegation

- Delegate all test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/backend/backend-testing.md` before changing tests.

## 11. Large File Decomposition (Non-API Files)

When a non-API backend file (`y_controllers/`, `Models/`, `DocumentParsers/`, `Assessors/`,
`RequestHandlers/`, `GoogleDriveManager/`, etc.) exceeds **550 lines** and can be meaningfully
split into distinct responsibilities, decompose it using the **facade-pattern** established by
`AssignmentDefinitionController`:

1. **Create a folder** named after the original file/class (e.g. `ABClassController/`).
2. **Create `index.js`** as the facade — it exports the original public class, which delegates
   to sub-classes injected in the constructor.
3. **Create sub-classes** at natural responsibility boundaries. Each sub-class file should own
   one coherent concern (e.g. persistence, validation, response mapping, reference data).
   Name them after their concern (e.g. `ABClassPersistence.js`, `ABClassValidation.js`).

Canonical example — `AssignmentDefinition` controller:

```
y_controllers/AssignmentDefinition/
├── index.js                               # Facade — AssignmentDefinitionController class
├── AssignmentDefinitionValidation.js       # Domain validation
├── AssignmentDefinitionReferenceData.js    # Reference data resolution
├── AssignmentDefinitionTaskParser.js       # Task document parsing
├── AssignmentDefinitionTaskWeighting.js    # Task weighting logic
├── AssignmentDefinitionPersistence.js      # Database read/write
├── AssignmentDefinitionUpsertOrchestrator.js  # Upsert orchestration
└── AssignmentDefinitionResponseMapper.js   # Response shape mapping
```

Rules:

- Do not split files under 550 lines unless there is a clear maintainability reason.
- Keep the public API surface (method names and signatures) identical after decomposition;
  the facade must preserve backward compatibility.
- Do not pre-emptively split files that are approaching 550 lines; wait until the threshold
  is crossed or a concrete maintenance need arises.
- When splitting, keep GAS concatenation order in mind — the facade file (`index.js`) must
  load after all sub-class files. Use numeric prefixes on sub-class files if dependency
  ordering requires it.
- Sub-class constructors should accept their dependencies via a single options object
  parameter for consistency with the existing pattern.

## 12. API Domain Folder Organisation (`z_Api`)

When two or more `z_Api` files share a common domain prefix, group them into a domain folder
named after that prefix.

Domain prefix is the leading part of the filename before the first capital letter or second
conceptual segment (e.g. `abclass` in `abclassMutations.js`, `abclassRead.js`, and
`abclassValidation.js`).

Example — currently grouped `z_Api` files for a domain:

```
z_Api/abclass/
├── abclassMutations.js        # ABClass create/update/delete transport handlers
├── abclassRead.js             # ABClass read transport handlers
└── abclassValidation.js       # Transport-boundary validation
```

Files sharing a prefix that remain flat are candidates for future grouping (e.g.
`assignmentDefinitionTransport.js` and `assignmentDefinitionValidation.js`).

Rules:

- Create a domain folder when **at least 2 files** share a common domain prefix.
- Keep trailing-underscore private function and `module.exports` patterns intact inside
  the moved files (see §1.1).
- Keep single-file domains flat in `z_Api/`. Do not create folders for them.
- Update `ALLOWLISTED_METHOD_HANDLERS` import paths in `z_apiHandler.js` if relative paths
  change due to folder nesting.
- Ensure `module.exports` exports are updated to reflect the new path for test imports.
