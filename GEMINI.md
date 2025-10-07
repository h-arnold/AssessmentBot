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

- `./CONTRIBUTING.md` - General coding and documentation style guide
- `./docs/developer/testing.md` - Testing patterns and best practices
- `./docs/developer/singletons.md` - Singleton pattern implementation guide
- `./docs/developer/DATA_SHAPES.md` - Data structure specifications

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

Important: Defensive guards policy

- Do not implement defensive programming guards (existence checks, typeof/feature detection, optional chaining as a gate) for known internal calls or GAS services. Prefer uncaught exceptions over masking issues.
- The only acceptable guards are explicit parameter validation for public methods/functions.

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

Add tests for any new serialisable or stateful logic:
Prohibited: Apps Script services, network, timers tied to GAS.
Always consult testing docs at `./docs/developer/testing.md` before writing or debugging tests.

### 5. Singleton Pattern

Always via `Class.getInstance()`. Refer to `./docs/developer/singletons.md` when modifying or creating new Singletons.

### 6. Serialisation

Implement `toJSON()` / static `fromJSON()` for new serialisable entities. Use only primitives & plain objects/arrays. Strip runtime-only refs (GAS objects, functions, Dates → normalise).

### 7. Hashing & Equality

Use `Utils.generateHash`. Do not assert literal hash strings. Assert existence, stability, and change upon content mutation.

### 8. Performance & Quotas

Batch using existing utilities (e.g. `BatchUpdateUtility`). No new frameworks. Avoid premature caching—add only if duplication is measurable.

### 9. JSDoc Minimum

```javascript
/**
 * Concise description.
 * @param {Type} name - Purpose (British English).
 * @return {Type} Meaningful result description.
 * @remarks Edge cases only if non-obvious.
 */
```

Inline brief comments for complex branches.
| ------------------------ | ------------------------------------------- |
| User-visible failure | ProgressTracker.logError(msg, details) |
| Dev debug info | ABLogger.getInstance().debugUi(label, data) |
| Missing required param | Validate then throw/log+throw |
| Unsure placement | Mirror closest existing pattern |
| New entity type? | Check Models/Artifacts first |
| Serialisable logic added | Add tests |

### 11. Anti-Patterns (Never)

- Empty catch blocks.
- Parallel custom logger utilities.
- Environment-specific values inside models.
- Overuse of optional chaining to mask logic requirements.
- Abstractions “for future flexibility” without need.
- Apps Script service calls inside tests.
- Defensive guards for known internal APIs or GAS services (e.g., `if (SpreadsheetApp && ...)`, `if (DriveApp?.getFileById)`).
- Feature detection for internal loggers or methods you own (e.g., `typeof logger.info === 'function'`).

#### Example anti-pattern (swallowing errors):

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

### 15. Ultra‑Compact Quick Card

PRIORITY: KISS > Explicit request > Style > Logging contract > Tests (logic only)
DO: Reuse, JSDoc minimal, singletons via getInstance, proper error logging, tests for serialisable/stateful logic.
DON'T: Duplicate logs, add speculative abstractions, use GAS APIs in tests, swallow errors, broad refactors without need.
FALLBACK: If safe+minimal implement; if required value missing validate & throw; if unclear state assumption & proceed.

GUARDS: No defensive runtime guards; validate direct parameters only. Assume internal/GAS APIs exist and let failures surface (prefer uncaught exceptions over masking issues).
