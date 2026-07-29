# Pre-PR Review — `feature/read-rehydrate-assignment`

- **Base branch:** main
- **Generated:** 2026-07-28T14:10:00.000Z
- **Last updated:** 2026-07-29T00:08:15.978Z (after 8-step fix iteration)
- **Regression gate:** PASS — 0 regressions, 0 new failures (baseline maintained). Two false-positive flags (backend-lint delta on a pre-existing `max-lines` file, flaky E2E tests passing on re-run) are not genuine regressions.
- **Changed files:** 20+ (`~ 500 insertions(+), ~ 200 deletions(-)` — includes test additions, doc updates, and deletions)

## Verdict

**Pass** — all 10 decisions (2 Critical, 7 Improvements, 1 Nitpick) implemented and verified. Tests: 1902/1902 passing (120 files). Lint: same 13 pre-existing `max-lines` warnings (accepted technical debt). E2E: passing on re-run (flaky failures unrelated to backend-only changes).

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
- Facade test (`abclassController.readRehydrateAssignment.test.js:280-294`) — negative assertions declined (sufficient coverage via ops-level tests; facade-level negative assertions on `_roster`/`_persistence` would be brittle to future refactoring of the sub-class injection pattern).

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

## Decisions (All Completed)

All 10 decisions were implemented across 8 steps. Verification: 1902/1902 tests passing, lint baseline maintained, regression gate clean.

### Repo rule compliance / De-Sloppification

- **[Critical] `ABClassAssignmentOps.js:160-168` and `202-211`** — Duplicated validation. **✅ Done.** Step 1 removed `rehydrateAssignment` entirely (eliminating the outer validation block at 160-168). Step 8 removed the redundant `requireParams` at line 202. `readRehydrateAssignment`'s `typeof`/`trim()` checks remain as the sole validation for its own inputs.

- **[Critical] `ABClassAssignmentOps.js:255`** — Stale log prefix. **✅ Done.** Step 3 changed `'rehydrateAssignment:'` → `'_loadFullAssignmentDocument:'`.

- **[Improvement] `ABClassAssignmentOps.js:223-229`** — Double-logging. **✅ Done.** Step 2 removed the try/catch wrapper from `readRehydrateAssignment`. Errors now propagate to the boundary (`getAssignment_`) which handles not-found (WARN) vs other errors (ERROR + rethrow) correctly.

- **[Improvement] `ABClassAssignmentOps.js:157-184`** — Remove `rehydrateAssignment`. **✅ Done.** Step 1 deleted `rehydrateAssignment` from `ABClassAssignmentOps.js`, its facade from `ABClassController/index.js`, the dead `processSelectedAssignment` block from `AssignmentController.js:141-144`, and the `_replaceAssignmentInClass` method (both class + facade). Removed the dedicated facade test file `abclassController.rehydrateAssignment.test.js`. Updated test mocks and `controllerTestHelpers.js`. Cleaned up stale doc references.

- **[Improvement] Test stale "RED Phase" header.** **✅ Done.** Step 4 replaced the header with a factual description matching delivered state.

- **[Improvement] `_ensureFullDefinition` test gaps.** **✅ Done.** Step 5 added 3 tests covering: (a) `definitionKey` absent — `getDefinitionByKey` not called; (b) authoritative-partial — throws; (c) `getDefinitionByKey` called with `(definitionKey, { form: 'full' })`.

- **[Improvement] `assignment.md` ~line 370 + ~line 124.** **✅ Done.** Step 6 reworded line 124 (internal hydration, not caller responsibility) and line 370 (resolve-then-throw semantics).

- **[Improvement] `assignment.md` File Index ~line 453.** **✅ Done.** Step 6 added missing methods (`readRehydrateAssignment`, `_ensureFullDefinition`, `_validateAssignmentDocument`, `_getFullAssignmentCollectionName`); removed `rehydrateAssignment` (deleted).

### Error-handling robustness

- **[Improvement] `ABClassAssignmentOps.js:223-230`** — Double-logging. **✅ Done.** Covered by Step 2 try/catch removal.

### Data-shape docs consistency

- **[Improvement] `assignment.md:370`** — Resolve-then-throw semantics. **✅ Done.**
- **[Improvement] `assignment.md:124`** — Internal hydration. **✅ Done.**
- **[Nitpick] `assignment.md:453`** — File Index. **✅ Done.**

### British-English consistency

- **[Nitpick] `api-layer.md:155`** — `toward` → `towards`. **✅ Done.**

### Backend data shape / schema consistency

- **[Nitpick] Redundant `requireParams` calls.** **✅ Done.** Step 8 removed `requireParams({ courseId, assignmentId }, 'readRehydrateAssignment')` from `ABClassAssignmentOps.js:202` and `requireParams({ definitionKey, assignmentId, courseId }, 'startAssessmentRun')` from `assignmentAssessment.js:22`. Verified tests pass with only `validateNonEmptyString` guarding — all missing-param tests assert `.toThrow(Error)`, which both `requireParams` and `validateNonEmptyString` satisfy.

### Security & secrets

- **[Nitpick] `api-layer.md:406`** — `hasControlCharacters_` → `validateSafeTrimmedIdentifier_`. **✅ Done.**

### Test-coverage gaps

- **[Improvement] `_ensureFullDefinition` test gaps** — **✅ Done.** Covered by Step 5.

---

## Recommended Implementation Order

Merge-safe ordering — each step is independent; earlier steps unlock later ones. All 8 steps completed.

| Step | Change                                                                                                                                                | Rationale                                                                                                                                                                                                                                                                         | Status  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | **Remove `rehydrateAssignment` + `_replaceAssignmentInClass`** (ABClassAssignmentOps.js, ABClassController/index.js, AssignmentController.js:141-144) | Eliminates dead mutation path, the latent `processSelectedAssignment` bug (rehydration throw prevents fresh assignment from being persisted), and half the duplicated validation in one pass. Also removes facade delegators and any `rehydrateAssignment`-specific facade tests. | ✅ Done |
| 2    | **Remove `readRehydrateAssignment` try/catch** (ABClassAssignmentOps.js:223-230)                                                                      | Resolves double-logging and ERROR-level-on-not-found. Can only be safely verified after step 1 confirms `rehydrateAssignment`'s catch still covers the write path.                                                                                                                | ✅ Done |
| 3    | **Fix stale log prefix** (ABClassAssignmentOps.js:255)                                                                                                | Trivial one-liner — `'rehydrateAssignment:'` → `'_loadFullAssignmentDocument:'`. Safe to do any time.                                                                                                                                                                             | ✅ Done |
| 4    | **Fix stale test comment** (test file header lines 1-11)                                                                                              | Text-only change, no risk.                                                                                                                                                                                                                                                        | ✅ Done |
| 5    | **Add `_ensureFullDefinition` tests**                                                                                                                 | Fills 3 coverage gaps: (a) `definitionKey` absent early-return, (b) authoritative-partial throw, (c) `getDefinitionByKey` call args.                                                                                                                                              | ✅ Done |
| 6    | **Update data-shape docs** (assignment.md lines 124, 370, File Index)                                                                                 | Safe text-only changes. File Index should be updated after step 1 so `rehydrateAssignment` entry is removed rather than kept.                                                                                                                                                     | ✅ Done |
| 7    | **Fix doc references** (api-layer.md:155 `toward`→`towards`, :406 `hasControlCharacters_`→`validateSafeTrimmedIdentifier_`)                           | Safe text-only changes.                                                                                                                                                                                                                                                           | ✅ Done |
| 8    | **Remove redundant `Validate.requireParams`** (ABClassAssignmentOps.js:202, assignmentAssessment.js:22)                                               | Safe deletion after confirming no test depends on `requireParams` catching null/undefined before the `typeof` checks. Verify no test supplies `undefined`/`null` explicitly.                                                                                                      | ✅ Done |
