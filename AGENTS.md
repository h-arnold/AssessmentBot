## AssessmentBot – LLM Execution Contract (Optimised)

### Project Overview

AssessmentBot automates assessment of student work in Google Slides and Sheets by comparing submissions against reference materials. Built with Google Apps Script, it integrates with Google Classroom and uses an LLM backend for intelligent evaluation. The tool scores submissions on Completeness, Accuracy, and SPaG (Spelling, Punctuation, Grammar).

**Technology Stack:**

- Google Apps Script (GAS) for frontend/automation
- Node.js + Vitest for unit testing
- ESLint for linting
- Prettier for code formatting

**Key Directories:**

- `src/AdminSheet/` - Main application code (Controllers, Models, Sheets, Utils, etc.)
- `src/assessmentRecordTemplate/` - Template for individual assignment records
- `tests/` - Vitest unit tests (logic only, no GAS services)
- `docs/` - User and developer documentation

**Essential Commands:**

```bash
npm test          # Run all tests
npm run test:watch # Run tests in watch mode
npm run lint      # Check code style
npm run lint:fix  # Auto-fix linting issues
npm run format    # Format code with Prettier
```

**Key Documentation:**

- `./CONTRIBUTING.md` - General coding and documentation style guide.
- `./docs/developer/AssessmentFlow.md` - High-level overview of the assessment pipeline: how submissions are ingested, compared to references, and scored.
- `./docs/developer/DATA_SHAPES.md` - Authoritative definitions of serialisable data structures and shapes used across models, requests and persistence.
- `./docs/developer/rehydration.md` - How assignment and application state is persisted and rehydrated, including versioning and migration notes.
- `./docs/developer/testing.md` - Test patterns and best practices for Vitest unit tests, mocking of Apps Script services, and test organisation.
- `./docs/developer/singletons.md` - Conventions and examples for the singleton pattern used across the codebase (`getInstance` usage, lifecycle considerations).
- `./docs/developer/oauth-scopes.md` - The OAuth scopes required for Google Apps Script integrations and the rationale for each scope.
- `./docs/developer/UI.md` - Front-end UI conventions, modal/dialog patterns, accessibility considerations and styling guidance.
- `./docs/developer/Vendoring.md` - Guidance for vendoring third-party libraries into the Apps Script project and the associated tooling/workflows.

### 0. Prime Directives (Highest Priority – never violate)

1. KISS: simplest working solution. No speculative abstraction.
2. Assume all modules, classes, functions and methods are present. Do not guard against this. Do not add existence checks or feature detection for GAS APIs, singletons, or internal calls; only validate direct function parameters.
3. Only fulfil the explicit request (no scope creep). Ask ONLY if truly blocked.
4. British English everywhere.
5. Obey naming & style rules (below). Stay consistent with existing patterns.
6. Never silently swallow errors. Fail fast or surface via required logging pattern.
7. Reuse existing classes/utilities before creating new ones.
8. Do not add production code purely for tests.
9. For errors: either `ProgressTracker.logError(userMsg, devDetails)` OR `ABLogger.*` (dev). Do not duplicate same error in both unless dev details not passed to logError.
10. Use `Validate` class for generic validation. Use `Validate.requireParams()` for parameter existence checks. Only implement class-specific validation within classes.
11. **MANDATORY**: Delegate all UI and testing duties to the appropriate sub-agents (`Testing Specialist`, `UI Specialist`). Do not implement UI or tests directly.

### 0.1 Sub-Agent Protocols (Stateless Delegation)

**Available Agents:**

- **Testing Specialist**: All `tests/` logic. Instructions: `.github/agents/Testing.agent.md`
- **UI Specialist**: All `src/AdminSheet/UI/` logic. Instructions: `.github/agents/UI.agent.md`

**Context Management (CRITICAL):**

- Sub-agents are **stateless**. They do not share your chat history or open files.
- You **MUST** `read_file` relevant context first.
- You **MUST** include file contents, error logs, and requirements explicitly in the `prompt` field of `runSubagent`.
- Do not assume the agent knows "what changed". Tell it exactly what changed.

Important: Defensive guards policy

- Do not implement defensive programming guards (existence checks, typeof/feature detection, optional chaining as a gate) for known internal calls or GAS services. Prefer uncaught exceptions over masking issues.
- The only acceptable guards are explicit parameter validation for public methods/functions using the `Validate` class.

### 1. Style & Naming

| Item                | Rule                                 |
| ------------------- | ------------------------------------ |
| Classes             | PascalCase                           |
| Methods / variables | camelCase                            |
| Constants           | const NAME (UPPER or clear semantic) |
| Indent              | 2 spaces                             |
| Language            | British English                      |
| Paths               | Core: `src/AdminSheet`               |
| Load order          | Preserve numeric prefixes            |

Avoid abbreviations unless universally recognised (URL, ID, API).

### 2. Architecture Map

Singleton base: `src/AdminSheet/00_BaseSingleton.js` (canonical). Examples: `ABLogger`, `ProgressTracker`, `ConfigurationManager`, `DbManager`.
Domains: Controllers (`y_controllers`), Sheets, AssignmentProcessor, Models (+ Artifacts), RequestHandlers, DocumentParsers, UpdateAndInitManager, Utils.

### 3. Error & Logging Contract

User-facing failure: `ProgressTracker.getInstance().logError(userMessage, { devContext, err })`.
Developer diagnostics: `ABLogger.getInstance().debugUi/info/warn/error(...)`.
If dev details already provided as second param to `logError`, do NOT separately call `ABLogger.error` with the same info.
No `console.*` in new code.
Required value absent? Validate & throw (or log + throw). Optional deep access may use `?.` but not to hide bugs.

Additional clarity:

- Do not wrap logger usage in existence/type checks (e.g., `if (logger && typeof logger.info === 'function')`). Assume `ABLogger.getInstance()` and its methods exist; call them directly. Let failures surface.

### 4. Tests (Vitest: logic only)

**DELEGATION MANDATORY**: Do not write or run tests directly.

1. Identify the logic to test.
2. Read the source file to be tested.
3. Call `runSubagent` (Testing Specialist) with the source code and test requirements.

### 5. Validation

Use the `Validate` utility class (`src/AdminSheet/Utils/Validate.js`) for all generic validation:

**Required pattern for parameter existence:**

```javascript
Validate.requireParams({ paramName1, paramName2 }, 'methodName');
```

**Rules:**

- Check the `Validate` class for existing validators before implementing new validation logic.
- Add new generic validators to the `Validate` class when needed for reuse across the codebase.
- Use `Validate` for generic type/format checks and parameter presence validation.
- Only implement class-specific validation within classes (e.g., domain-specific business logic).
- Do not duplicate generic validation logic across classes.

### 6. Singleton Pattern

Always via `Class.getInstance()`. Refer to `./docs/developer/singletons.md` when modifying or creating new Singletons.

### 7. Serialisation

Implement `toJSON()` / static `fromJSON()` for new serialisable entities. Use only primitives & plain objects/arrays. Strip runtime-only refs (GAS objects, functions, Dates → normalise).

### 8. Hashing & Equality

Use `Utils.generateHash`. Do not assert literal hash strings. Assert existence, stability, and change upon content mutation.

### 8. Performance & Quotas

Batch using existing utilities (e.g. `BatchUpdateUtility`). No new frameworks. Avoid premature caching—add only if duplication is measurable.

### 9. JSDoc Minimum

/\*\*

- Concise description.
- @param {Type} name - Purpose (British English).
- @return {Type} Meaningful result description.
- @remarks Edge cases only if non-obvious.
  \*/
  Inline brief comments for complex branches.

### 10. Decision Cheat Sheet

| Situation                 | Action                                          |
| ------------------------- | ----------------------------------------------- |
| **UI Change required**    | **Run Sub-Agent: UI Specialist**                |
| **Logic needs testing**   | **Run Sub-Agent: Testing Specialist**           |
| User-visible failure      | ProgressTracker.logError(msg, details)          |
| Dev debug info            | ABLogger.getInstance().debugUi(label, data)     |
| Missing required param    | Validate.requireParams({ param }, 'methodName') |
| Generic type/format check | Use Validate.isString/isEmail/etc               |
| Unsure placement          | Mirror closest existing pattern                 |
| New entity type?          | Check Models/Artifacts first                    |

### 11. Anti-Patterns (Never)

- Empty catch blocks.
- Parallel custom logger utilities.
- Environment-specific values inside models.
- Overuse of optional chaining to mask logic requirements.
- Abstractions “for future flexibility” without need.
- Apps Script service calls inside tests.
- Defensive guards for known internal APIs or GAS services (e.g., `if (SpreadsheetApp && ...)`, `if (DriveApp?.getFileById)`).
- Feature detection for internal loggers or methods you own (e.g., `typeof logger.info === 'function'`).

#### Example anti-pattern (swallowing errors)

##### Anti pattern

Unnecessary type guard that makes code difficult to read.

```javascript
const client = typeof ABClass !== 'undefined' ? ABClass : require('../GoogleClassroom/ABClass.js');
if (!client || typeof client.fetchCourse !== 'function')
  throw new Error('ABClass.fetchCourse is not available');
```

##### Correct implementation

Directly calls the class, method or function.

```javascript
const abClass = new ABClass(classId);
```

Rationale: do not hide errors. Fail fast (throw) or log via ProgressTracker so failures are visible and debuggable. **Prefer uncaught exceptions over silent errors**.

#### Additional anti-pattern (logger feature detection)

```javascript
// Anti-pattern: defensive existence/type checks
const logger = ABLogger && ABLogger.getInstance ? ABLogger.getInstance() : null;
if (logger && typeof logger.info === 'function') {
  logger.info('Ensured folder exists');
}
```

```javascript
// Correct: assume availability and fail fast if misconfigured
ABLogger.getInstance().info('Ensured folder exists');
```

### 12. Top-Level Triggers Template

```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err; // preserve fail-fast
}
```

### 13. Domain Glossary

Assessment: Evaluation of student submission vs reference artefacts.
Artifact: Normalised extracted content unit (text, image, table, etc.).
TaskDefinition: Specification of expected artefacts & criteria.
Submission: Student-submitted document(s).
Cohort: Group/class aggregate analysis.

### 14. Ambiguity Rule

State 1–2 concise assumptions, proceed with simplest compliant implementation.

### 16. Ultra‑Compact Quick Card

PRIORITY: KISS > Explicit request > Style > Logging contract > Tests (logic only)
DO: Reuse, JSDoc minimal, singletons via getInstance, proper error logging, tests for serialisable/stateful logic, use Validate.requireParams for param checks.
DON'T: Duplicate logs, add speculative abstractions, use GAS APIs in tests, swallow errors, broad refactors without need, duplicate validation logic.
FALLBACK: Assume fallback is not required unless explicitly stated.

GUARDS: No defensive runtime guards; validate direct parameters only using Validate class. Assume internal/GAS APIs exist and let failures surface (prefer uncaught exceptions over masking issues).

## Codex delegation (codex-delegate)

````markdown
## Spawning sub-agents

Use `codex-delegate` to spawn a focused sub-agent for a specific task. Keep tasks small, pass constraints in `--instructions`, and set `--timeout-minutes` to 10 or more for long-running jobs.

Example:

```bash
codex-delegate --role implementation \
  --task "Add input validation to the assessor controller" \
  --instructions "Use existing DTO patterns; update tests." \
  --working-dir packages/my-app \
  --timeout-minutes 10
```

While a sub-agent is running, expect a heartbeat line (`agent is still working`) roughly every minute if no new stream events arrive.

**IMPORTANT**: Be patient. Some tasks will take several minutes and if the agent is thinking, you may not see any output for a while. If you see the heartbeat line, it is still working. If there is an error with the agent, `codex-delegate` will throw an error. If you stop it early, you may lose the work it has done so far. If you think it has stalled, check the logs for details `codex-delegate.log` (or set `--log-file` to write logs to a different path).

### Sub-agent roles

Sub-agent roles are defined in the `.codex` folder, along with the configuration file. To create a new role, add a markdown file with the role name (e.g. `implementation.md`) and a prompt template for that role. Empty files are ignored. Use `--list-roles` to see the discovered roles.
````

## Creating new agents (roles)

Roles are defined by prompt templates in the `.codex` folder. To create a new agent:

1. Create a new file at `.codex/<role>.md` with the prompt template for that role.
2. Keep the template non-empty; empty files are ignored.
3. Run `codex-delegate --list-roles` to confirm it is discovered.
4. Invoke it with `codex-delegate --role <role> --task "..."`

`AGENTS.md` files inside `.codex` are ignored for role discovery.

## Configuration (.codex)

The CLI uses a per-project `.codex` folder for both configuration and role templates.

- Config file: `.codex/codex-delegate-config.json`
- Role templates: `.codex/<role>.md` (ignored if empty)
- `AGENTS.md` is always ignored for role discovery

Run the init command to create the default config file, or let the CLI create it on first run:

```bash
codex-delegate init
```

Config defaults (stored when the file is first created) come from the CLI defaults:

- `sandbox`: `danger-full-access`
- `approval`: `never`
- `network`: `true`
- `webSearch`: `live`
- `overrideWireApi`: `true`
- `verbose`: `false`
- `timeoutMinutes`: `10`

Role, task, and instructions are CLI-only and are never read from config files.

Config precedence is:

1. Built-in defaults
2. `.codex/codex-delegate-config.json`
3. CLI flags

Wire API note: `codex-delegate` overrides `wire_api` to `responses` by default. If you set `overrideWireApi` to `false`, ensure your Codex `config.toml` uses `wire_api = "responses"` or `wire_api = "chat"` to avoid startup errors. If `responses_websocket` is detected in `config.toml`, `codex-delegate` will isolate `CODEX_HOME` to a local `.codex/codex-home` folder to avoid the failure.
