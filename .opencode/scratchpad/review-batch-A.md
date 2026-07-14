# Code Review — Batch A (Backend fail-fast guards / data-integrity)

**Branch:** `opencode/crisp-meadow` (Batch A changes are uncommitted working-tree modifications against `feat/ReactFrontend`)
**Scope:** `AssignmentDefinition.toJSON()` guard (A1) and `ABClassAssignmentOps.persistAssignmentRun` guard (A2), plus their test changes.
**Validation run:**

- `npm run lint:backend` → **0 errors** (only pre-existing `max-lines` warnings on unrelated test files).
- `npm run test:backend -- tests/models/assignmentDefinition.test.js tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js` → **45 passed**.
- Full `npm run test:backend` (regression safety for the broader `tasks`-as-array transition) → **118 files / 1894 tests passed**.
- `tsc` N/A (GAS JavaScript).

---

## Summary

**Verdict: NEEDS IMPROVEMENT**

Both fail-fast guards (A1 and A2) are implemented correctly, are correctly placed, and comply with backend standards (`Validate.requireParams`, singleton/logging policy, no `console.*`, British English, no speculative scope). Lint is clean and the entire backend suite (1894 tests) passes, so the broader `tasks`-as-array transition that Batch A depends on introduces no regression.

However, the **new guard behaviour is not directly asserted by any test**: there is no test proving `toJSON()` _throws_ on a partial, and `ABClassAssignmentOps.unit.test.js` is still GREEN-phase smoke tests only, so the `persistAssignmentRun` partial guard is completely unexercised. Separately, `DATA_SHAPES.md` still documents the obsolete `tasks: null` partial sentinel that Batch A's guards explicitly supersede. These are quality/consistency gaps, not code defects.

---

## Critical

None. The guard code itself is correct and safe.

---

## Improvement

### I1 — A1 guard behaviour is not directly tested

- **File:** `tests/models/assignmentDefinition.test.js` (no test asserts `toJSON()` throws on a partial)
- **Detail:** `AssignmentDefinition.toJSON()` now throws `TypeError` when `this.tasks` is an array (partial). The current suite covers the _inverse_ path only — test #13 (`fromJSON → toPartialJSON` round-trip preserves the array) and the existing full-definition `toJSON` tests (lines 135, 182). Nothing constructs a partial (array `tasks`) and asserts `toJSON()` throws. A regression that deletes the guard would not be caught.
- **Fix:** Add a test such as:
  ```javascript
  it('should throw TypeError when toJSON() is called on a partial (tasks is an array)', () => {
    const def = AssignmentDefinition.fromJSON(partialDocWithArrayTasks);
    expect(() => def.toJSON()).toThrow(TypeError);
  });
  ```
- **Why it matters:** A1 is the blocker-equivalent data-integrity fix; its primary new behaviour (fail-fast) deserves a direct regression test.

### I2 — A2 guard is untested (`persistAssignmentRun` has no behavioural tests)

- **File:** `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js` (lines 1–51)
- **Detail:** The unit test file contains only GREEN-phase smoke checks (module loads, is a class, constructs, declares the expected methods). It never calls `persistAssignmentRun`, so the restored `Array.isArray(assignment.assignmentDefinition?.tasks)` guard (lines 76–80) is never exercised, and neither is the happy path.
- **Fix:** Add behavioural tests:
  - a full assignment (definition `tasks` keyed object) persists without throwing;
  - a partial assignment (definition `tasks` is an array) causes `persistAssignmentRun` to throw `TypeError` with the message `Cannot persist full assignment with partial assignmentDefinition (tasks is an array)`.
  - Assert the thrown error is not double-logged (single `logger.error` at the catch boundary, then rethrown).
- **Note:** This likely requires wiring `ABLogger`/`ProgressTracker`/a fake `dbManager` in the test harness; keep it local to this file.

### I3 — `DATA_SHAPES.md` still documents the obsolete `tasks: null` partial sentinel

- **File:** `docs/developer/backend/DATA_SHAPES.md` (lines 166, 173, 683, 745, 768, 835)
- **Detail:** The code on this branch now treats a **partial** `AssignmentDefinition` as one whose `tasks` is an **array** (the constructor even fails fast when `tasks` is absent). The docs still state, e.g., _"Partial Assignment Definitions: The embedded `assignmentDefinition` has `tasks: null`"_, _"Partial Definition Detection: Code detects partial definitions via `assignmentDefinition.tasks === null`"_, and _"`tasks` is always `null` in this transport shape."_ This directly contradicts the sentinel that Batch A's guards enforce (`Array.isArray(...)`).
- **Fix:** Update the relevant passages (and the example JSON blocks) to describe `tasks` as a lightweight `{ taskId, taskWeighting, taskTitle }[]` array for partials, or explicitly note the historical `null` form is coerced to `[]` on load. This is documentation-only and can be a separate doc batch, but it should land before merge so the guards are not later "fixed" back to `=== null` by a maintainer following the docs.
- **Caveat:** This is broader than Batch A (it is the whole feature's doc contract), so it may be routed separately; flagging because it is the canonical reference for the exact sentinel Batch A guards against.

---

## Nitpick

### N1 — A2 guard uses `TypeError` (synth review suggested `Error`)

- **File:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js` line 77
- **Detail:** The synthesised review's suggested snippet used `throw new Error(...)`; the implementation uses `throw new TypeError(...)`. This is **acceptable and arguably preferable** — the rest of `persistAssignmentRun` throws `TypeError` for invalid input, so the guard is now type-consistent. No change required; noted for transparency.

### N2 — `assignment.assignmentDefinition?.tasks` optional chaining

- **File:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js` line 76
- **Detail:** If `assignmentDefinition` is entirely absent, `?.tasks` is `undefined` and `Array.isArray(undefined)` is `false`, so the guard does not fire; failure would surface later in `assignment.toJSON()`. This is consistent with the guard's narrow purpose (catch _partial-array_ definitions) and is fine. No change required.

---

## Checklist confirmation (Batch A focus)

- [x] A1 `toJSON()` guard throws for partials — **correct**, lines 288–293; JSDoc (lines 281–287) states `@throws {TypeError}` on partial. ✓
- [x] A2 `persistAssignmentRun` guard placed after field validation, inside try, caught/logged/rethrown once (no double-log) — **correct**, lines 76–80 + catch 137–144. ✓
- [x] No `console.*` in changed code; `Validate.requireParams` used (line 47); `ABLogger` used for diagnostics; `/* global Validate */` declared. ✓
- [x] British English throughout; no speculative scope; defaults only in constructor. ✓
- [~] Test changes assert new behaviour — partial: round-trip tested, but **throw guards not directly tested** (see I1, I2).
- [~] Docs consistent with new sentinel — **not yet** (see I3).

---

## Files read

- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- `tests/models/assignmentDefinition.test.js`
- `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js`
- `.opencode/scratchpad/code-review-crisp-meadow-synthesised.md` (Batch A, lines 15–49)
- `docs/developer/backend/DATA_SHAPES.md`
- `docs/developer/backend/rehydration.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `src/backend/AGENTS.md`
- `AGENTS.md`
- (Plus `git diff` / `git show` of the base branch to confirm the guards are new uncommitted changes, and the full backend test run for regression safety.)
