# Code Review — Backend Test Changes (Chunk B)

**Scope:** Backend test changes between `feat/ReactFrontend` and `HEAD`.
**Files reviewed:** 13 (11 test files + 2 helpers).

**Mandatory reading completed:** `AGENTS.md` (root), `src/backend/AGENTS.md`, `docs/developer/backend/backend-testing.md`, `docs/developer/backend/backend-logging-and-error-handling.md`. Source exercised: `src/backend/Models/AssignmentDefinition.js`, `src/backend/Models/TaskDefinition.js`, `src/backend/z_Api/assignmentDefinitionValidation.js` (verified the `tasks must be an array.` error string at line 678).

**Automated checks:**

- `npm run lint:backend` → 0 errors (only pre-existing `max-lines` warnings on unrelated files, plus a pre-existing warning on `tests/assignment/assignmentFactory.test.js` which is not a regression introduced by this diff).
- `npx vitest run` over all 11 in-scope test files → **459 tests passed, 0 failed**.
- `grep` for `console.*` across all in-scope test/helper files → no matches.

---

## Summary

**Verdict: Needs Improvement**

The wire-format migration (partial `AssignmentDefinition.tasks` changed from `null` to an array of lightweight `{ taskId, taskWeighting, taskTitle }` summaries) is correctly and consistently reflected across the tests, the assertions accurately match the implemented behaviour, and the entire in-scope suite is green with a clean lint. However, two tests carry stale "RED / will fail" labels that contradict reality (the code is already GREEN and the assertions pass), and one `describe` block retains a banned "Section N" name that the testing policy requires renaming when the file is touched. Neither blocks merge on its own, but both should be cleaned up.

---

## Critical

None. The suite is hermetic (no live GAS services; all `ProgressTracker`/`ABClass`/`DbManager`/`TaskDefinition` dependencies are mocked or rehydrated), no failing tests, no `console.*`, no empty catches, British English throughout.

---

## Improvement

### 1. Mislabeled "RED" tests that actually PASS (contradicts TDD signalling)

The repository uses "RED Phase" scaffolding as a convention for genuinely-failing tests, so leaving passing tests labelled "RED / will fail" is actively misleading: it implies the feature is incomplete / the suite carries known failures, and risks a future maintainer "fixing" correct code or missing a real regression.

- **`tests/backend-api/assignmentDefinitionPartials.unit.test.js:1905`**

  ```js
  describe('toPartialJSON taskTitle emission (RED — tests fail until Green)', () => {
  ```

  and **`:1938`**

  ```js
  // RED: toPartialJSON does not yet emit taskId — this assertion will fail
  expect(partial.tasks[0]).toHaveProperty('taskTitle', task.taskTitle);
  ```

  Reality: `AssignmentDefinition._computePartialTasks()` (source lines 352–368) already emits `taskId`, `taskWeighting`, and `taskTitle`. The test **passes** (verified: 290 tests in this file pass). The "RED — tests fail until Green" describe name and the "will fail" comment are inaccurate.

- **`tests/models/assignmentDefinition.test.js:275`–`:277`**
  ```js
  // RED PHASE: This test intentionally fails against the current buggy code.
  // AssignmentDefinition.fromJSON drops the tasks array when it is an array
  ```
  and **`:305`–`:306`**
  ```js
  // This assertion MUST fail on the current buggy code because
  // fromJSON nulls the tasks array, producing tasks: [] via toPartialJSON.
  ```
  Reality: `AssignmentDefinition.fromJSON` (source lines 402–418) coerces `tasks ?? []` when the key is present and otherwise passes arrays through verbatim — it does **not** null the array. The round-trip test **passes** (verified). The "intentionally fails" / "MUST fail" comments are inaccurate.

**Recommended fix:** Either (a) remove the "RED"/"will fail"/"intentionally fails" wording and rename the describe blocks to behaviour-focused names (e.g. `describe('toPartialJSON emits taskTitle per task')` and `describe('fromJSON -> toPartialJSON round-trip preserves tasks array on partial definitions')`), or (b) if these are genuinely meant to document not-yet-implemented behaviour, move them to a separate failing scaffold — but since the behaviour is already implemented, (a) is correct.

### 2. `describe('AssignmentDefinition - Section 1 Model Changes', ...)` violates the testing policy

- **`tests/models/assignmentDefinition.test.js:5`**

  ```js
  describe('AssignmentDefinition - Section 1 Model Changes', () => {
  ```

  `docs/developer/backend/backend-testing.md` § "Anti-Patterns Seen In This Repository" / Anti-Pattern #4 explicitly states: _"treat existing SECTION_\* constants or 'Section N ...' describe titles in the test suite as legacy names and rename them to behaviour-focused names when you next touch those tests, rather than copying the old pattern."\_

  This file is in scope (it was modified by this diff — the new nested `describe` and several updated tests), so the rule applies. The describe should be renamed to describe the behaviour under test (e.g. `describe('AssignmentDefinition tasks / partial wire format')` or similar), not the planning-section number.

---

## Nitpick

### 1. Direct `new ClassName()` construction in the RED block instead of `fromJSON()` rehydration

- **`tests/backend-api/assignmentDefinitionPartials.unit.test.js` (the `toPartialJSON taskTitle emission` block)**
  ```js
  const task = new TaskDefinition({ taskTitle: 'My Task Title' }, 3);
  const def = new AssignmentDefinition({ ... tasks: { [task.id]: task }, ... });
  ```
  `backend-testing.md` (and the cross-module review checklist) prefers `fromJSON()` rehydration over `new ClassName()` in backend tests to avoid GAS-constructor dependencies. Here the constructor runs fine in Node (globals are set up), so it is not a defect — but for consistency with the rest of the suite (e.g. `modelFactories` uses `fromJSON`), consider building the definition via `AssignmentDefinition.fromJSON(...)` with a keyed-tasks payload. Low priority.

### 2. Pre-existing `max-lines` warning on `tests/assignment/assignmentFactory.test.js`

`npm run lint:backend` reports `tests/assignment/assignmentFactory.test.js 501:1 warning File has too many lines (519). Maximum allowed is 500`. This is **pre-existing** (the diff only added a `tasks: []` line) and not a regression from this change, so it is not blocking. Flagged for awareness only.

---

## Behaviour / Coverage Notes (positive)

- The migration is internally consistent: every call site that previously passed `tasks: null` for partial definitions now passes `tasks: []`, and full-definition paths still use keyed task objects. `toPartialJSON` output shape (`{ taskId, taskWeighting, taskTitle }`) is asserted in `assignmentDefinitionValidation.test.js`, `assignmentSerialisation.test.js`, `abclassController.readClass.test.js`, `assignmentDefinitionController.upsert.test.js`, and `assignmentDefinition.test.js`.
- `assignmentDefinitionPartials.unit.test.js` correctly updated the `validatePartialRow_` error contract from `'tasks must be null in partial transport.'` to `'tasks must be an array.'` — matching the source (`assignmentDefinitionValidation.js:678`). The "valid tasks array" / "non-array tasks value" cases exercise both success and failure paths.
- `abclassController.rehydrateAssignment.test.js` strengthened assertions to verify the rehydrated definition holds a keyed (non-array) task object (`expect(Array.isArray(...)).toBe(false)`), which guards against the partial-array shape leaking into the full store — good behavioural coverage.
- `DUMMY_TASK_PARTIALS` helper (`tests/helpers/modelFactories.js:303`) is a clean, documented, reusable fixture and is correctly exported.
