# Pre-PR Review — `feature/read-rehydrate-assignment`

- **Base branch:** main
- **Generated:** 2026-07-28T14:10:00.000Z
- **Regression gate:** PASS — 0 regressions, 0 new failures. The 13 pre-existing `max-lines` lint violations (all in files untouched by this branch) are accepted technical debt.
- **Changed files:** 17 (`480 insertions(+), 117 deletions(-)`)

## Verdict

**Fail** — two Critical items remain (duplicated validation across method boundaries, stale log message in shared helper). Both are straightforward to fix and can be addressed before merge.

## Focus areas

### Repo rule compliance

**Summary:** Needs Improvement — no Critical items; one Improvement, two Nitpicks.

**Improvement:**

- **Double-logging of identical error across `readRehydrateAssignment` → its callers** (`ABClassAssignmentOps.js:223-229` logs, then `ABClassAssignmentOps.js:177-183` and `assignmentAssessment.js:140` log the same error again). Violates the backend logging policy ("not double-logged identically"; log/rethrow at the top-level boundary). Also causes a benign `AssignmentNotFoundError` to be logged at **ERROR** level by `readRehydrateAssignment` and again as WARN by `getAssignment_` (`:137`). Fix: drop the `try/catch` logger in `readRehydrateAssignment`.

**Nitpick:**

- `rehydrateAssignment` (`:166-168`) re-validates `assignmentId` that `readRehydrateAssignment` (`:208-212`) already validates — redundant domain rule (api-layer.md §1.2 rule 3).
- `docs/developer/data-shapes/assignment.md:452` file index for `ABClassAssignmentOps.js` omits the new `readRehydrateAssignment` (and pre-existing `rehydrateAssignment`).

#### Incidental (triage)

- `assignmentAssessment.js:1` omits `AssignmentController` from its `/* global */` despite use at `:27` — pre-existing, not introduced by this branch.

### KISS & DRY

**Summary:** Pass — the core refactor is sound and SOLID-compliant.

**Improvement:**

- **Discrepancy between stated diff intent and actual code for `rehydrateAssignment` mutation** (`ABClassAssignmentOps.js:174`). The diff summary claims `rehydrateAssignment` was "updated to remove ABClass mutation", but it still calls `_replaceAssignmentInClass(abClass, ...)`. If the intent was non-mutating, `rehydrateAssignment` would be a redundant pass-through of `readRehydrateAssignment`. If the intent was to keep mutation, the split is correct. Must be clarified before sign-off.

**Nitpick:**

- Misleading log prefix `'rehydrateAssignment: loading full assignment'` in `_loadFullAssignmentDocument` (`ABClassAssignmentOps.js:255`) — this helper is now also called from `readRehydrateAssignment`.
- Repeated hand-rolled non-empty-string guards across `ABClassAssignmentOps.js` where `Validate.validateNonEmptyString` exists in the transport layer. Acceptable WET per method-prefix convention.
- `rehydrateAssignment` (`:166-168`) validates `assignmentId` again after `readRehydrateAssignment` (`:208-212`) already validates it — minor duplicated validation.

#### Incidental (triage)

- Stale RED-phase comments in `tests/controllers/abclassController.readRehydrateAssignment.test.js`.
- `getAssignment_` KISS improvement: replacing `loadClass` + `rehydrateAssignment` with single `readRehydrateAssignment` removes roster-refresh overhead from the read path.

### De-Sloppification

**Summary:** Needs Improvement — two Critical items, two Improvements, one Nitpick.

**Critical:**

- **Duplicated validation in `rehydrateAssignment` → `readRehydrateAssignment` chain** (`ABClassAssignmentOps.js:160-168` and `:202-211`). When `rehydrateAssignment` delegates to `readRehydrateAssignment`, the same `typeof`/`trim()` checks on `assignmentId` and `courseId`/`abClass.classId` are performed twice. `Validate.requireParams` also called twice. The outer method should trust the inner method's validation. Fix: remove the manual `typeof` checks from `rehydrateAssignment` (lines 162-168), keeping only the `abClass`-specific check.
- **Stale log message in shared private helper `_loadFullAssignmentDocument`** (`ABClassAssignmentOps.js:255`). Logs `'rehydrateAssignment: loading full assignment'` but is now called from both `rehydrateAssignment` and `readRehydrateAssignment`. When called from the read-only path, the log is misleading. Fix: change to `'_loadFullAssignmentDocument: loading full assignment'`.

**Improvement:**

- **Stale TDD "RED Phase" comment** in `tests/controllers/abclassController.readRehydrateAssignment.test.js:1-11`. Header says tests "should FAIL initially because readRehydrateAssignment() has not been implemented yet" — but it is implemented and all tests pass.
- **`Validate.requireParams` subsumed by manual type checks** (`ABClassAssignmentOps.js:202` vs `:204-211`). Manual checks already cover null/undefined; `requireParams` adds no additional safety. Low priority.

**Nitpick:**

- `api-layer.md:406` references `hasControlCharacters_` but actual code in `assignmentAssessment.js:52-66` uses `validateSafeTrimmedIdentifier_` (which internally calls `hasControlCharacters_`). Minor doc accuracy issue.

### Performance (Big-O)

**Summary:** Pass — no performance regression; the refactor is a clear read-path win. No Critical or Improvement items.

**Findings:**

- `readRehydrateAssignment` complexity: **O(1) DB + O(S×I) deserialisation** (S = # submissions, I = # items/submission). No loops, nested iteration, or N+1 queries.
- The old `loadClass` + `rehydrateAssignment` flow required **O(T + S_students) Classroom API network calls** plus a roster write-back. The new flow drops all of that.
- Performance improvement is real and substantial: the read path now scales with assignment payload size rather than class roster size.

**Nitpick (incidental):**

- `02_AssignmentRehydration.js:51` rebuilds `new Set([...])` of known fields on every `_baseFromJSON` call — O(F) overhead per rehydration, hoistable to module-level constant.

### Logging rules compliance

**Summary:** Pass — the in-scope diff is fully logging-compliant. No `console.*`, correct log boundaries, log-and-rethrow discipline preserved.

**Incidental (triage):**

- `readRehydrateAssignment` logs `AssignmentNotFoundError` at **error** level, but the read path treats not-found as a graceful `null` return. Recommend branching to `warn` in the new method.
- `_loadFullAssignmentDocument` info log uses stale prefix `'rehydrateAssignment: loading full assignment'` — now also called via `readRehydrateAssignment`.

### Frontend layout / design / accessibility

_(not in scope for this diff — no frontend files changed)_

### Frontend data shape / schema consistency

_(not in scope for this diff — no frontend files changed)_

### Backend data shape / schema consistency

**Summary:** The agent was unable to read the full `ABClassAssignmentOps.js` file via the injected `files` array and attempted a self-read. Findings from the other agents confirm the response shape is preserved (uncontroversial refactor). See data-shape docs consistency below for detailed findings on the canonical docs.

### Security & secrets

**Summary:** Pass (clean). No Critical or Improvement items. The refactor preserves existing transport-boundary validation and introduces no credential, `PropertiesService`/`ScriptApp`/`HtmlService`, or injection regressions.

**Findings:**

- `readRehydrateAssignment` (`ABClassAssignmentOps.js:199-212`) validates `typeof` + non-empty only; path/control-character safety remains at the transport boundary (`assignmentAssessment.js:110-111`) — correct per validation-ownership policy.
- Collection name `assign_full_${courseId}_${assignmentId}` is safe: both values validated upstream before reaching controller, and `findOne` uses structured query.
- Read-only path removes roster refresh / ABClass mutation / persistence writes — surface reduction.
- `progressTracker` strip preserved (`assignmentAssessment.js:125`).

### Test-coverage gaps

**Summary:** No Critical items. Three Improvements, two Nitpicks.

**Improvement:**

- **`_ensureFullDefinition` failure branch (authoritative definition also partial) is untested** (`ABClassAssignmentOps.js:303-310`). The `else` throw is never hit in tests. Add a test where `getDefinitionByKey` returns an object with `tasks: []`.
- **`_ensureFullDefinition` early-return when `definitionKey` is absent is not asserted** (`ABClassAssignmentOps.js:291-292`). No test verifies that `getDefinitionByKey` is NOT called when `definitionKey` is missing.
- **Argument to `getDefinitionByKey` is not asserted** (`ABClassAssignmentOps.js:299`). The stub at `tests/controllers/abclassController.readRehydrateAssignment.test.js:197-205` ignores arguments. The `{ form: 'full' }` argument is never verified.

**Nitpick:**

- `Validate.requireParams` in `readRehydrateAssignment` (`:202`) is not independently exercised — empty-string cases fall through to the `TypeError` checks. Low value.
- Facade test (`abclassController.readRehydrateAssignment.test.js:280-294`) lacks negative assertions that `_roster`, persistence, and `DbManager` collaborators are not invoked.

### British-English consistency

**Summary:** Pass — the branch's diff introduces no American-English spelling leaks.

**Incidental (triage):**

- `docs/developer/backend/api-layer.md:155` uses `toward` (American) — should be `towards`. Pre-existing, not in this diff.

### Error-handling robustness

**Summary:** Needs Improvement — no Critical, two Improvements, one Nitpick.

**Improvement:**

- **`readRehydrateAssignment` double-logs and logs graceful not-found at ERROR level** (`ABClassAssignmentOps.js:223-230`). `AssignmentNotFoundError` is caught here as `error`, then `getAssignment_` (`assignmentAssessment.js:136-139`) catches it as `warn` and returns `null`. Net effect: every not-found produces spurious ERROR + WARN. Fix: remove this try/catch (boundary owns logging) or branch to `warn` for `AssignmentNotFoundError`.
- **`rehydrateAssignment` now double-logs via the new delegation** (`ABClassAssignmentOps.js:172-184`). `readRehydrateAssignment` logs first (per above), then this wrapper logs again. Fix: log at exactly one layer.

**Nitpick:**

- Typed-error asymmetry in `readRehydrateAssignment` (`ABClassAssignmentOps.js:204-212` throws `TypeError` for empty strings) is preserved from the existing patterns and correct.

#### Incidental (triage)

- `getAssignment_` still does not call `Validate.requireParams` for presence (`assignmentAssessment.js:101-111`), unlike `startAssessmentRun_` (`:22`). Pre-existing inconsistency.
- Not-found now returns `null` instead of throwing `ClassNotFoundError` (the old `loadClass` step is gone). Behavioural change worth recording in PR notes.
- `_validateAssignmentDocument` / `_replaceAssignmentInClass` throw generic `Error` — pre-existing.

### Data-shape docs consistency

**Summary:** Needs Improvement — no Critical, two Improvements, one Nitpick.

**Improvement:**

- **`assignment.md` ~line 370 (`Key domain validation rules`) overstates failure mode.** The code (`ABClassAssignmentOps.js:290-312`, `_ensureFullDefinition`) does not throw for a partial _embedded_ definition — it first resolves via `getDefinitionByKey`. It only throws when the authoritative record is itself a partial. Reword to describe resolve-then-throw semantics.
- **`assignment.md` ~line 124 (`Key contract notes`) contains stale/contradictory text.** "callers must ensure the assignment is fully hydrated before calling `getAssignment`" — the handler path (`readRehydrateAssignment`) performs hydration internally. The "this will throw" clause only applies to unresolvable/authoritative-partial edge cases.

**Nitpick:**

- File Index `ABClassAssignmentOps.js` entry (`assignment.md:~453`) lists only `_loadFullAssignmentDocument, persistAssignmentRun`; omits `readRehydrateAssignment`, `rehydrateAssignment`, `_ensureFullDefinition`, `_validateAssignmentDocument`.

#### Incidental (triage)

- `_loadFullAssignmentDocument` log prefix `'rehydrateAssignment: loading full assignment'` is shared by both methods — SPEC I1 explicitly accepted this to keep scope minimal.

---

## Decisions

### Repo rule compliance / De-Sloppification

- **[Critical] `ABClassAssignmentOps.js:160-168` and `202-211`** — Duplicated validation (`typeof`/`trim()` checks on `assignmentId`/`courseId` performed twice in the `rehydrateAssignment` → `readRehydrateAssignment` delegation chain). **Decision: Fix now.** Approach: remove the manual `typeof`/`trim()` checks from `rehydrateAssignment` (lines 162-168). Keep only the `abClass`-specific validation in `rehydrateAssignment`. `readRehydrateAssignment` already validates its own inputs correctly. Rationale: no cross-trust-boundary defence argument exists for same-class delegation.

- **[Critical] `ABClassAssignmentOps.js:255`** — Stale log prefix `'rehydrateAssignment: loading full assignment'` in `_loadFullAssignmentDocument`, now called from both `rehydrateAssignment` and `readRehydrateAssignment`. **Decision: Fix now.** Approach: change prefix to `'_loadFullAssignmentDocument: loading full assignment'`. Rationale: misleading logs during debugging of the read-only path.

- **[Improvement] `ABClassAssignmentOps.js:223-229`** — `readRehydrateAssignment` catch block logs `AssignmentNotFoundError` at ERROR level, then `getAssignment_` catches it as WARN and returns null. Double-log + incorrect severity. **Decision: Fix now.** Approach: remove the try/catch wrapper from `readRehydrateAssignment` entirely. Let the boundary (`getAssignment_`) own all logging. The guard clause in `getAssignment_` correctly handles not-found (WARN) vs other errors (ERROR + rethrow). Also resolves the `rehydrateAssignment` double-logging issue (Improvement #2 in error-handling review), as the wrapper at lines 172-184 will become the sole log point after `rehydrateAssignment` is removed per the decision below.

- **[Improvement] `ABClassAssignmentOps.js:157-184`** — `rehydrateAssignment` still calls `_replaceAssignmentInClass(abClass, ...)` despite the refactor's stated intent to remove mutation. **Decision: Remove `rehydrateAssignment` entirely.** Approach: delete the method from `ABClassAssignmentOps.js` and the facade from `ABClassController/index.js`. Update `AssignmentController.startAssessmentRun()` to call `readRehydrateAssignment(courseId, assignmentId)` directly. Remove the facade test (`abclassController.readRehydrateAssignment.test.js:280-294`) which tests delegation through `rehydrateAssignment`. Update any remaining references. Rationale: `rehydrateAssignment` becomes a redundant pass-through once non-mutating; the caller `startAssessmentRun` can call `readRehydrateAssignment` directly without an intermediary.

- **[Improvement] `tests/controllers/abclassController.readRehydrateAssignment.test.js:1-11`** — Stale "RED Phase" header comment. **Decision: Fix now.** Approach: remove "(RED Phase)" and "should FAIL initially" sentences from the header. Replace with factual description matching delivered state.

- **[Improvement] Test-coverage gaps in `_ensureFullDefinition`** (`ABClassAssignmentOps.js:291-292`, `299`, `303-310`). **Decision: Add tests now.** Add tests for: (a) `definitionKey` absent early-return — verify `getDefinitionByKey` is NOT called; (b) authoritative definition is partial — verify throw message; (c) assert `getDefinitionByKey` was called with `(definitionKey, { form: 'full' })`.

- **[Improvement] `docs/developer/data-shapes/assignment.md` ~line 370** — Overstates failure mode. **Decision: Fix both now.** Approach: line 370 — reword to describe resolve-then-throw semantics ("resolves partial definitions via `getDefinitionByKey`; throws only when the authoritative record is itself a partial"). Line 124 — drop "callers must ensure the assignment is fully hydrated" and clarify that `readRehydrateAssignment` owns hydration internally.

- **[Improvement] `docs/developer/data-shapes/assignment.md` File Index ~line 453** — Omits `readRehydrateAssignment` from the `ABClassAssignmentOps.js` entry. **Decision: Fix now.** Approach: add `readRehydrateAssignment`, `_ensureFullDefinition`, `_validateAssignmentDocument` to the File Index. Note: `rehydrateAssignment` entry left as-is pending the removal decision above; update or remove depending on whether the method is deleted.

### Error-handling robustness

- **[Improvement] `ABClassAssignmentOps.js:223-230`** — Double-logging of errors across `readRehydrateAssignment` and its callers. **Decision: Fix now.** Approach: covered by the try/catch removal decision above — removing the `readRehydrateAssignment` catch eliminates the redundant log entirely.

### Data-shape docs consistency

- **[Improvement] `docs/developer/data-shapes/assignment.md:370`** — Doc overstates failure mode. **Decision: Fix now.** Covered above.
- **[Improvement] `docs/developer/data-shapes/assignment.md:124`** — Stale caller-responsibility note. **Decision: Fix now.** Covered above.
- **[Nitpick] `docs/developer/data-shapes/assignment.md:453`** — File Index missing entries. **Decision: Fix now.** Covered above.

### British-English consistency

- **[Nitpick] `docs/developer/backend/api-layer.md:155`** — `toward` → `towards`. **Decision: Fix now.** Approach: correct 'toward' to 'towards' in the opportunistic refactoring guidance.

### Backend data shape / schema consistency

- **[Nitpick] `ABClassAssignmentOps.js:202`** — `Validate.requireParams` is subsumed by the manual `typeof`/`trim()` checks. **Decision: Remove the redundant `requireParams` calls directly; do not extend the utility.** During review, extending `Validate.requireParams` with a `{ trim: true }` option was evaluated and rejected as disproportionate — it would require utility changes, error-type reconciliation (`Error` vs `TypeError`), message-format changes, and test updates, but would only benefit ~3 call sites (direct string-parameter checks). It cannot handle the nested-property validation pattern (`abClass.classId`, `assignment.courseId`) that accounts for most typeof/trim usage. The genuinely redundant calls are exactly those where `requireParams` validates the **same scalar parameter** that is immediately checked again by a typeof/trim or `validateNonEmptyString` guard. At these sites, `requireParams` can be safely deleted because the subsequent guard implicitly rejects null/undefined (`typeof null !== 'string'`). Concretely: delete `requireParams({ courseId, assignmentId }, 'readRehydrateAssignment')` from `ABClassAssignmentOps.js:202` and delete `requireParams({ definitionKey, assignmentId, courseId }, 'startAssessmentRun')` from `assignmentAssessment.js:22`. All other `requireParams` call sites across the codebase are either sole-validation (keep) or protect an object parameter from null-access crashes (keep).

- **[Nitpick] Facade test for `ABClassController.readRehydrateAssignment`** (`abclassController.readRehydrateAssignment.test.js:280-294`) — lacks negative assertions. **Decision: Add negative assertions.** Approach: extend the facade test to assert that `_roster`, persistence, and `DbManager` collaborators are NOT invoked during a `readRehydrateAssignment` call, preventing future regression that re-introduces side effects.

### Security & secrets

- **[Nitpick] `docs/developer/backend/api-layer.md:406`** — References `hasControlCharacters_` but code uses `validateSafeTrimmedIdentifier_`. **Decision: Fix now.** Approach: update to "using `validateSafeTrimmedIdentifier_` (which internally uses `hasControlCharacters_`) from `assignmentDefinitionValidation.js`".

### Test-coverage gaps

- **[Improvement] `_ensureFullDefinition` test gaps** — **Decision: Add tests now.** Covered above.
- **[Nitpick] Facade test lacks negative assertions** — **Decision: Add negative assertions.** Covered above.
