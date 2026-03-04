## AssessmentBot – Agent Execution Contract

This file contains project-specific constraints that are not reliably discoverable from code alone.
Discover architecture details, scripts, and local workflows from the repository when needed.

### 1. Prime Directives (Do Not Violate)

1. KISS: implement the simplest working solution. No speculative abstraction.
2. Only fulfil the explicit request. No scope creep unless blocked.
3. Use British English in code comments, docs, and user-facing text.
4. Reuse existing classes/utilities before creating new ones.
5. Do not add production code purely to satisfy tests.
6. Do not silently swallow errors. Fail fast, or log and rethrow.
7. No defensive runtime guards for known internal/GAS APIs.
8. Validate direct parameters only, using `Validate`.
9. Follow the logging contract exactly (below); do not duplicate error logs.
10. Delegate UI and testing tasks to the specified sub-agents.

### 2. Mandatory Sub-Agent Delegation

- Test work: delegate to `Testing Specialist` (`.github/agents/Testing.agent.md`).
- Do not implement UI or tests directly in the main agent.

Sub-agent protocol (critical):

- Sub-agents are stateless.
- Read relevant files first.
- Pass concrete context in `runSubagent` prompt: relevant source snippets, errors, requirements, and expected output.
- Explicitly describe what changed; do not assume shared history.

### 3. Validation and Defensive-Guard Policy

- Use `Validate.requireParams({ ... }, 'methodName')` for required parameter presence checks.
- Use existing generic validators in `src/AdminSheet/Utils/Validate.js` before adding new ones.
- Add new reusable generic validators to `Validate`, not ad hoc in multiple classes.
- Keep class-specific business validation inside the owning class.
- Do not add existence/type/feature checks for internal classes, singletons, logger methods, or GAS services.
- Prefer uncaught exceptions over masking misconfiguration.

### 4. Error and Logging Contract

User-visible failures:

- `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`

Developer diagnostics:

- `ABLogger.getInstance().debugUi/info/warn/error(...)`

Rules:

- If equivalent developer detail is already passed to `logError`, do not separately log the same error detail via `ABLogger.error`.
- No `console.*` in new code.
- Do not wrap logger calls in defensive checks.

Top-level trigger template:

```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err;
}
```

### 5. Naming, Style, and Structure

- Classes: `PascalCase`
- Methods/variables: `camelCase`
- Constants: `const NAME` (UPPER_CASE or clear semantic constant naming)
- Indentation: 2 spaces
- Keep existing numeric load-order prefixes intact where present
- Avoid unnecessary abbreviations (except standard ones such as URL, ID, API)

Export style:

- Prefer `export function name(...)` for reusable exported module utilities.
- Use exported arrow constants only when function-expression semantics are required.

### 6. TypeScript/ESLint Config Rule

Before modifying any TypeScript or ESLint configuration file, read:

- `./docs/developer/TypeScriptAndLintConfigHierarchy.md`

Rule:

- Shared standards belong in shared/root configs.
- Runtime/component-specific behaviour belongs in leaf configs only.

### 7. Singleton, Serialisation, Hashing

Singletons:

- Access via `Class.getInstance()`.
- Reference: `./docs/developer/singletons.md` when adding/changing singleton behaviour.

Serialisation:

- New serialisable entities must implement `toJSON()` and static `fromJSON()`.
- Persist only primitives/plain objects/arrays.
- Strip runtime-only references (GAS objects, functions); normalise dates.

Hash/equality:

- Use `Utils.generateHash`.
- Do not assert literal hash strings; assert existence, stability, and mutation sensitivity.

### 8. High-Risk Anti-Patterns (Never)

- Empty `catch` blocks.
- Defensive feature detection for internal methods/services you own.
- Optional chaining used to hide required logic failures.
- Duplicate logging of the same underlying error context.
- New abstractions added only for hypothetical future flexibility.
- Apps Script service calls inside logic unit tests.

### 9. Ambiguity Rule

- State 1-2 concise assumptions and proceed with the simplest compliant implementation.
- If placement is unclear, mirror the closest existing pattern.
