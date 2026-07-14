# Logging & Error-Handling Review — `opencode/crisp-meadow` vs `feat/ReactFrontend`

- **Reviewer**: Code Reviewer (logging/error-handling focus)
- **Date**: 2026-07-14
- **Scope**: Backend production source (5 files) + Frontend production source (applies to changed files in scope).
- **Automated checks**: NOT run (per task constraint). Review is manual, based on diffs + policy docs.
- **Policy sources read**: `docs/developer/backend/backend-logging-and-error-handling.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`, `src/backend/AGENTS.md`, `src/frontend/AGENTS.md`.

## Overall Verdict: NEEDS IMPROVEMENT

No `console.*` leaks, no empty `catch` blocks, and the single frontend `try/catch` is correctly handled. However, a backend **fail-fast guard was removed** (data-integrity regression, finding B2) and there is a **silent-corruption risk in `toJSON()`** (finding B1). One borderline frontend UX gap (F1). Prioritised blockers below.

---

## Blockers / Must-Fix (MAJOR)

### B2 — `persistAssignmentRun` partial-definition guard removed (data-integrity / fail-fast regression)

- **File**: `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- **Contract violated**: Backend error-handling §5 ("fail-fast"; "Do not suppress errors") + AGENTS.md §4 top-level pattern.
- **What changed**: The pre-change guard inside the method was deleted:
  ```diff
  - if (assignment.assignmentDefinition?.tasks === null) {
  -   throw new Error('Cannot persist full assignment with partial assignmentDefinition (tasks: null)');
  - }
  ```
  With the new model semantics, a _partial_ definition now has `tasks` as an **array** (not `null`). No equivalent guard (`Array.isArray(...)`) was added.
- **Risk**: `persistAssignmentRun` calls `assignment.toJSON()`, which serialises `assignmentDefinition.tasks` into the _full-assignment_ collection. If a partial (array-tasks) definition ever reaches this method, it is silently persisted as if it were full, corrupting stored data.
- **Current-path impact**: The sole production caller (`AssignmentController.js:158`) always passes a full definition fetched via `getDefinitionByKey(definitionKey, { form: 'full' })`, so active corruption is _unlikely today_. But the public method's fail-fast contract is weakened, and any future/alternate caller could corrupt data.
- **Suggested fix**: Restore an adapted guard immediately after the `Validate.requireParams`/field checks:
  ```javascript
  if (Array.isArray(assignment.assignmentDefinition?.tasks)) {
    throw new Error(
      'Cannot persist full assignment with partial assignmentDefinition (tasks is an array)'
    );
  }
  ```
  (Keep it inside or just before the `try` so it fails fast with a clear message.)

### B1 — `AssignmentDefinition.toJSON()` silently corrupts when called on a partial (array `tasks`)

- **File**: `src/backend/Models/AssignmentDefinition.js` (in `toJSON()`, and `_computePartialTasks`/`toPartialJSON` are correct).
- **Contract violated**: "errors are not silently swallowed" / consistent error wrapping.
- **What changed**: `toJSON()` no longer handles the partial case. It now does:
  ```javascript
  const tasks = Object.fromEntries(
    Object.entries(this.tasks).map(([taskId, task]) => [taskId, task.toJSON ? task.toJSON() : task])
  );
  ```
  For a **partial** instance, `this.tasks` is now an **array** (verbatim lightweight summaries). `Object.entries(array)` yields `[[0, item0], [1, item1], ...]`, producing a malformed object keyed by numeric indices instead of `taskId`s — silently, with no error. Previously the `tasks === null` branch at least produced `tasks: null`.
- **Risk**: Silent data corruption if `toJSON()` is ever invoked on a partial instance (e.g. a caller mixes up `toJSON` vs `toPartialJSON`). The JSDoc now notes "do not call on partial instances" but the method fails open rather than failing fast.
- **Suggested fix** (pick one):
  - Add a fail-fast guard at the top of `toJSON()`: `if (Array.isArray(this.tasks)) { throw new TypeError('toJSON() must not be called on a partial AssignmentDefinition (tasks is an array). Use toPartialJSON().'); }`
  - Or keep `toJSON()` strictly full-only and rely on the existing JSDoc (lower safety). Strongly prefer the guard.

---

## Improvements (MINOR — not blocking)

### F1 — `TaskHeatmapPage` generic error: logged but silently navigates back with no user feedback

- **File**: `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (lines ~140–150, 2851–2911).
- **Contract violated**: Frontend policy §6 "Default hard-failure UI state should be a top-level Ant Design `Alert` unless a stronger UX case is explicitly documented" and "fail loudly in development".
- **What happens**: For a generic (non-`TaskTitlesUnavailableError`) error, the component calls `logFrontendError('TaskHeatmapPage', state.error)` (dev/console only) and then `backCallback()`, returning `null`. The user is silently returned to the overview with **no in-app error message**. (The `TaskTitlesUnavailableError` path correctly renders an `Alert`.)
- **Note**: This is _documented_ in the component JSDoc/SPEC, so it is not a hard violation, but from a logging/error-handling standpoint the end user gets zero feedback for a real failure.
- **Suggested fix**: In addition to `logFrontendError`, surface a user-safe message via the Ant Design `App.useApp()` `message`/`notification` (or a top-level `Alert`) before/while navigating back, so the failure is not silent from the user's perspective. At minimum, confirm this is the intended product behaviour.

### B3 (informational, no action) — Constructor `logAndThrowError` logging is correct

- `src/backend/Models/AssignmentDefinition.js` constructor now calls `ProgressTracker.getInstance().logAndThrowError('AssignmentDefinition requires a tasks value…', { devContext: { tasks } })`. Verified that `ProgressTracker.logError` also routes a developer diagnostic through `ABLogger.getInstance().error(...)`, so both user-facing and developer channels are covered with no duplication. Consistent with the existing `_validateFull` pattern. No change required. (Minor style note: a model-level validation error is surfaced as a _user-facing_ progress error; acceptable given existing convention, but could alternatively be developer-only `ABLogger` if the caller is always backend code.)

---

## Checks that PASSED (in scope, no findings)

- **No `console.*` calls** in any changed backend or frontend production source (verified by diff grep of all 5 backend files + 46 frontend production files in scope).
- **No empty `catch` blocks**. Backend has exactly one `try/catch` (in `persistAssignmentRun`), which logs via `ABLogger.getInstance().error('persistAssignmentRun failed', { courseId, assignmentId, err })` and rethrows — correct.
- **Caught errors are logged/handled or rethrown**: `persistAssignmentRun` (ABLogger + rethrow, user-facing handled at `AssignmentController` boundary via `progressTracker.logAndThrowError`); `TaskHeatmapPage` (logFrontendError + explicit map); `heatmapAdapter` throws typed `TaskTitlesUnavailableError`/`Error` that are handled upstream.
- **Transport-boundary validation**: `assignmentDefinitionTransport.js` `getAssignmentDefinitionPartials_` now enforces `Array.isArray(row.tasks)` and `assignmentDefinitionValidation.js` `validatePartialRow_` rejects non-array `tasks` with `throwValidationError_` — correct fail-fast at the boundary, no console.
- **`_ensureFullDefinition` guard correctly adapted** from `tasks !== null` → `Array.isArray(tasks)` in `ABClassAssignmentOps.js` (line ~243) and `rehydrateAssignment` throws `'… the authoritative record is a partial (tasks is an array).'` — consistent with new semantics.
- **`Validate.requireParams` adopted** in `persistAssignmentRun` and `rehydrateAssignment` (backend validation contract satisfied).
- **`ClassSelectionContext.tsx`** throws `TypeError` when called without a provider — acceptable fail-fast dev guard.
- **Frontend logger usage** goes through `logFrontendError` (which normalises via `normaliseUnknownError` and includes `errorMessage` + `stack`), not raw `console`. ESLint console-boundary policy is respected.

## Files read for this review

- Policy: `docs/developer/backend/backend-logging-and-error-handling.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Module contracts: `src/backend/AGENTS.md`, `src/frontend/AGENTS.md`
- Backend diffs: `src/backend/Models/AssignmentDefinition.js`, `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`, `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js`, `src/backend/z_Api/assignmentDefinitionTransport.js`, `src/backend/z_Api/assignmentDefinitionValidation.js`
- Frontend diffs (production, in scope): all 46 files listed in scope; error-handling focus on `TaskHeatmapPage.tsx`, `heatmapAdapter.ts`, `resolveAssignmentDefinition.ts`, `rollupMetric.ts`, `averagingAnalyser*.ts`, `ClassPage.tsx`, `ClassPageContent.tsx`, `classPageAdapter.ts`, `ClassSelectionContext.tsx`
- Support: `src/backend/Utils/ProgressTracker.js` (`logError`/`logAndThrowError`), `src/frontend/src/logging/frontendLogger.ts` (`logFrontendError`), `src/backend/y_controllers/AssignmentController.js` (caller of `persistAssignmentRun`)

## Recommended next step

Address **B2** (restore adapted partial guard in `persistAssignmentRun`) and **B1** (fail-fast in `AssignmentDefinition.toJSON()`) before merge. Re-submit to reviewer after fixes.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
