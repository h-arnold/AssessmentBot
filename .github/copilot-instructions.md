## AssessmentBot – LLM Execution Contract (Optimised)

### 0. Prime Directives (Highest Priority – never violate)
1. KISS: simplest working solution. No speculative abstraction.
2. Assume all modules, classes, functions and methods are present. Do not guard against this.
3. Only fulfil the explicit request (no scope creep). Ask ONLY if truly blocked.
4. British English everywhere.
5. Obey naming & style rules (below). Stay consistent with existing patterns.
6. Never silently swallow errors. Fail fast or surface via required logging pattern.
7. Reuse existing classes/utilities before creating new ones.
8. Do not add production code purely for tests.
9. For errors: either `ProgressTracker.logError(userMsg, devDetails)` OR `ABLogger.*` (dev). Do not duplicate same error in both unless dev details not passed to logError.

### 1. Style & Naming
| Item | Rule |
|------|------|
| Classes | PascalCase |
| Methods / variables | camelCase |
| Constants | const NAME (UPPER or clear semantic) |
| Indent | 2 spaces |
| Language | British English |
| Paths | Core: `src/AdminSheet` |
| Load order | Preserve numeric prefixes |
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

### 4. Creation Rules
Create NEW component only if domain gap exists:
- Model: new persistent domain entity.
- Artifact: new assessable content type (mirror existing numbering pattern).
- Sheet manager: new sheet lifecycle (create + populate + update) required.
- Request handler: new external/batch/cached service.
Else extend existing code.

### 5. Tests (Vitest: logic only)
Add tests for any new serialisable or stateful logic:
- Normalisation behaviour
- Hash stability (truthiness + changes when content changes)
- JSON round trip (`toJSON` / `fromJSON`)
- Edge cases (empty, null, large)
Prohibited: Apps Script services, network, timers tied to GAS.
Artifacts in tests use primitive data only.

### 6. Singleton Pattern
Always via `Class.getInstance()`. For test isolation use provided `resetForTests()` if exposed. Never `new` a singleton directly.

### 7. Serialisation
Implement `toJSON()` / static `fromJSON()` for new serialisable entities. Use only primitives & plain objects/arrays. Strip runtime-only refs (GAS objects, functions, Dates → normalise).

### 8. Hashing & Equality
Use `Utils.generateHash`. Do not assert literal hash strings. Assert existence, stability, and change upon content mutation.

### 9. Performance & Quotas
Batch using existing utilities (e.g. `BatchUpdateUtility`). No new frameworks. Avoid premature caching—add only if duplication is measurable.

### 10. JSDoc Minimum
/**
 * Concise description.
 * @param {Type} name - Purpose (British English).
 * @return {Type} Meaningful result description.
 * @remarks Edge cases only if non-obvious.
 */
Inline brief comments for complex branches.

### 11. Decision Cheat Sheet
| Situation | Action |
|-----------|--------|
| User-visible failure | ProgressTracker.logError(msg, details) |
| Dev debug info | ABLogger.getInstance().debugUi(label, data) |
| Missing required param | Validate then throw/log+throw |
| Unsure placement | Mirror closest existing pattern |
| New entity type? | Check Models/Artifacts first |
| Serialisable logic added | Add tests |

### 12. Anti-Patterns (Never)
- Empty catch blocks.
- Parallel custom logger utilities.
- Environment-specific values inside models.
- Overuse of optional chaining to mask logic requirements.
- Abstractions “for future flexibility” without need.
- Apps Script service calls inside tests.

#### Example anti-pattern (swallowing errors):

##### Anti pattern

Unnecessary type guard that makes code difficult to read.

```javascript

const client = typeof ABClass !== 'undefined' ? ABClass : require('../GoogleClassroom/ABClass.js');
if (!client || typeof client.fetchCourse !== 'function') throw new Error('ABClass.fetchCourse is not available');
```


##### Correct implementation
Directly calls the class, method or function.

```javascript

const abClass = new ABClass(classId)
```

Rationale: do not hide errors. Fail fast (throw) or log via ProgressTracker so failures are visible and debuggable. **Prefer uncaught exceptions over silent errors**.

### 13. Implementation Flow (LLM Macro)
1. Parse request → enumerate explicit requirements.
2. Search for existing similar implementations.
3. Define minimal delta (avoid broad refactor unless required).
4. Implement change.
5. Add/adjust tests (logic only).
6. Run tests.
7. Summarise changes & confirm constraints.

### 14. Response Protocol (When Acting)
Preamble: single sentence on next action.
Multi-step: maintain todo list (one in-progress).
After edits: list changed files + purpose.
Quality gates (if code changed): run tests, note pass/fail.
Avoid repeating unchanged plan parts.

### 15. Edge Handling
Explicitly handle: null/undefined public inputs, empty arrays/strings if meaningful, large input (avoid obvious O(n²) pitfalls).
Defer until asked: i18n, config generalisation, multi-tenant abstractions.

### 16. Top-Level Triggers Template
```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err; // preserve fail-fast
}
```

### 17. Domain Glossary
Assessment: Evaluation of student submission vs reference artefacts.
Artifact: Normalised extracted content unit (text, image, table, etc.).
TaskDefinition: Specification of expected artefacts & criteria.
Submission: Student-submitted document(s).
Cohort: Group/class aggregate analysis.

### 18. Ambiguity Rule
State 1–2 concise assumptions, proceed with simplest compliant implementation.

### 19. Ultra‑Compact Quick Card
PRIORITY: KISS > Explicit request > Style > Logging contract > Tests (logic only)
DO: Reuse, JSDoc minimal, singletons via getInstance, proper error logging, tests for serialisable/stateful logic.
DON'T: Duplicate logs, add speculative abstractions, use GAS APIs in tests, swallow errors, broad refactors without need.
FALLBACK: If safe+minimal implement; if required value missing validate & throw; if unclear state assumption & proceed.
