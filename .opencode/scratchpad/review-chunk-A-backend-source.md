# Code Review — Chunk A (Backend Source)

**Scope:** Backend source changes between `feat/ReactFrontend` and `HEAD` for:

- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js`
- `src/backend/z_Api/assignmentDefinitionTransport.js`
- `src/backend/z_Api/assignmentDefinitionValidation.js`

## Summary

**Verdict: Needs Improvement** — One Critical regression in `ABClassAssignmentOps.persistAssignmentRun` (the newly added `try/catch` can mask the original error and swallow the developer log when `assignment` is `undefined`), plus a latent correctness gap in `AssignmentDefinition.toJSON()` that cannot serialise the now-supported array-tasks (partial) form. Lint passes (0 errors; pre-existing `max-lines` warnings only). No `console.*`, no empty `catch`, British English and Node export guards all present.

---

## Critical

### C1 — `ABClassAssignmentOps.persistAssignmentRun` catch block can mask the original error and skip logging

**File:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
**Evidence:** lines 43–139 (new `try/catch` wrapping), specifically the `catch` at lines 131–138:

```js
} catch (error) {
  logger.error('persistAssignmentRun failed', {
    courseId: assignment.courseId,      // <-- evaluated even if assignment is undefined
    assignmentId: assignment.assignmentId,
    err: error,
  });
  throw error;
}
```

The `try` block's very first guard is `if (!abClass || !assignment) { throw new TypeError('persistAssignmentRun requires abClass and assignment'); }`. When `assignment` is `undefined` (a valid input that this guard is meant to reject cleanly), control enters the `catch`, where `assignment.courseId` is evaluated while building the `logger.error(...)` arguments. That property access throws a _new_ `TypeError: Cannot read properties of undefined (reading 'courseId')`, which propagates out of the `catch` and:

1. **replaces** the meaningful `"persistAssignmentRun requires abClass and assignment"` error, and
2. **prevents `logger.error(...)` from ever being called**, so no developer diagnostic is recorded.

This violates the fail-fast principle and the mandated top-level error-boundary pattern ("log once at the catch boundary, rethrow the original"). The early guards exist precisely to catch `undefined` inputs, so this is a reachable regression, not a hypothetical.

**Fix:** make the catch log arguments null-safe, e.g.

```js
logger.error('persistAssignmentRun failed', {
  courseId: assignment?.courseId,
  assignmentId: assignment?.assignmentId,
  err: error,
});
throw error;
```

(Note: `rehydrateAssignment`'s `catch` is safe — it logs `courseId`/`assignmentId` derived outside the `try`/from the parameter — so only `persistAssignmentRun` needs this fix.)

---

## Improvement

### I1 — `AssignmentDefinition.toJSON()` cannot serialise the new array-tasks (partial) form

**File:** `src/backend/Models/AssignmentDefinition.js`
**Evidence:** `toJSON()` (lines 285–311) and constructor semantics (lines 108–125, 336–368).

The diff makes partials first-class: a partial `AssignmentDefinition` now legitimately holds `this.tasks` as an **array** of lightweight `{taskId, taskWeighting, taskTitle}` summaries (constructor stores arrays verbatim; `_computePartialTasks()` handles arrays). However `toJSON()` still assumes `this.tasks` is a keyed object:

```js
toJSON() {
  const tasks = Object.fromEntries(
    Object.entries(this.tasks).map(([taskId, task]) => [taskId, task.toJSON ? task.toJSON() : task])
  );
  ...
}
```

For a partial instance (`this.tasks = [...]`) this yields `tasks: { "0": {...}, "1": {...} }` — an **index-keyed object**, not an array. When that JSON is later read back via `fromJSON`, `json.tasks` is an object (not an array), so the constructor routes to `_validateFull()` and `_hydrateTasks({...})`, producing a corrupt "full" definition from partial summaries. `toJSON()` is a core model serializer that now silently emits wrong output for a state the model itself permits.

**Reachability:** In current flows `toJSON()` is only invoked on **full** (object-tasks) instances — `AssignmentDefinitionPersistence._persistDefinitionWithRollback` and `AssignmentDefinitionResponseMapper._getFullAssignmentDefinition` both receive full definitions. So this is **currently latent**, but it is a real contract violation within the model and a fragile trap for any future/edge caller (e.g. mistakenly passing a partial to `getFull`, or persisting a partial). The model test `tests/models/assignmentDefinition.test.js` exercises `toJSON()` on partials (lines 129–167) but only asserts `yearGroup` absence, never `tasks` shape, so the defect is untested.

**Recommendation:** Either (a) make `toJSON()` array-aware (e.g. when `Array.isArray(this.tasks)`, map summaries to a JSON array form), or (b) explicitly document that `toJSON()` is full-definition-only and guard against being called on a partial. Option (a) is preferred for robustness given partials are now a supported state.

### I2 — `getAssignmentDefinitionPartials_` does not enforce `validatePartialRow_` in production

**File:** `src/backend/z_Api/assignmentDefinitionTransport.js` (line 113) vs `src/backend/z_Api/assignmentDefinitionValidation.js` (`validatePartialRow_`, lines 669–680)

`validatePartialRow_` (updated by this diff to require `tasks` to be an array) is exported and exercised by unit tests (`tests/backend-api/assignmentDefinitionPartials.unit.test.js`), but it is **not called** by `getAssignmentDefinitionPartials_()` in the runtime path. The `api-layer.md` claims this handler "rejects malformed rows with `ApiValidationError` when required fields are missing..." — that enforcement does not actually occur at transport read time; only `toTransportPartialRow_` (which calls `toPartialJSON()`) runs. This means the new array-tasks contract on read responses is validated only by tests, not in production. Pre-existing architectural gap surfaced by the diff; recommend wiring `validatePartialRow_` into `getAssignmentDefinitionPartials_` (or consolidating the validation so the documented contract holds at runtime).

### I3 — Public methods lack `Validate.requireParams` (opportunistic)

**File:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`

`persistAssignmentRun(abClass, assignment)` and `rehydrateAssignment(abClass, assignmentId)` validate their inputs with raw `TypeError` throws rather than the mandated `Validate.requireParams({ ... }, 'methodName')` pattern. This is a backend standard ("`Validate.requireParams` at the start of every public method") and is pre-existing in this file; the diff added a `try/catch` but did not adopt the canonical validator. Low priority and opportunistic — only flag because the file was already being touched.

---

## Nitpick

### N1 — Stale JSDoc on `toPartialJSON()`

**File:** `src/backend/Models/AssignmentDefinition.js`, lines 313–317: the doc states the payload "Carries `tasks` as an array of lightweight `{ id, taskWeighting }` summaries" but `_computePartialTasks()` actually emits `{ taskId, taskWeighting, taskTitle }` (confirmed by tests at `tests/models/assignmentDefinition.test.js:228`). Update the comment to match the emitted shape.

### N2 — `assignmentDefinitionValidation.js` exceeds 500 lines

**File:** `src/backend/z_Api/assignmentDefinitionValidation.js` — lint reports 707 lines (`max-lines` warning). This is **pre-existing** and not worsened by this diff (the diff only changed a comment and the `validatePartialRow_` array check). Noted for awareness; decomposition is out of scope for this change and governed by `src/backend/AGENTS.md` §11 (which sets the threshold at 550 for non-API files; this is a `z_Api` file).

---

## Checklist Compliance (backend focus)

- `Validate.requireParams` at start of every public method — **Partial**: present in `AssignmentDefinitionPersistence.getByKey`/`delete` and the orchestrator, but absent in `ABClassAssignmentOps` public methods (I3, pre-existing).
- Errors logged via `ProgressTracker.logError`/`ABLogger.*` then rethrown, not double-logged — **Pass** for new code, except the C1 mask bug.
- Singletons via `Class.getInstance()` — **Pass** (`ABLogger.getInstance()`, `ProgressTracker.getInstance()` used correctly; `AssignmentDefinitionController`/`ABClassController` are instantiated via `new`, consistent with existing established pattern).
- No Node.js/browser runtime APIs — **Pass**.
- GAS service wrapper modules checked — **Pass** (no raw GAS services added).
- New entities implement `toJSON()`/`fromJSON()` — **Pass** (model retains both; `fromJSON` coerces legacy `null` tasks to `[]`).
- Node export guarded — **Pass** (all five files end with the guarded `module.exports` block).
- No defensive feature-detection guards on known internals/GAS — **Pass**.
- No `console.*`, no empty `catch`, British English — **Pass**.
- No default values introduced without instruction — **Pass** (`assignmentWeighting` default of 1 remains in constructor per §8; `tasks` now correctly has no default).
- Files ≤ 500 lines — **Pass for the 4 source files**; `assignmentDefinitionValidation.js` is 707 (N2, pre-existing warning).

---

## Files Read (full content)

- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js`
- `src/backend/z_Api/assignmentDefinitionTransport.js`
- `src/backend/z_Api/assignmentDefinitionValidation.js`
- Supporting reachability reads: `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionResponseMapper.js`, `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`
- Tests consulted (behaviour confirmation only): `tests/models/assignmentDefinition.test.js`, `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js`, `tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- Mandatory docs: `AGENTS.md`, `src/backend/AGENTS.md`, `docs/developer/backend/backend-logging-and-error-handling.md`, `docs/developer/backend/api-layer.md`, `docs/developer/backend/backend-testing.md`

## Automated Checks

- `npm run lint:backend`: **0 errors**, 14 `max-lines` warnings (all pre-existing, none introduced by this diff).
- Backend full test suite not executed per instructions; relevant tests read to confirm behaviour.
