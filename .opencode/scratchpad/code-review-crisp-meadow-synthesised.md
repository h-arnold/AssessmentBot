# Synthesised Code Review — `opencode/crisp-meadow` vs `feat/ReactFrontend`

**Source reviews merged:**

- `review-findings-crisp-meadow.md` (general latent-bug review)
- `review-crisp-meadow-logging.md` (logging/error-handling)
- `review-crisp-meadow-performance.md` (performance)
- `review-scope-crisp-meadow.md` (scope/evidence)

**Overall verdict:** NEEDS IMPROVEMENT — 1 Blocker, 2 Majors, several Improvements, plus non-blocking performance/robustness items. No compile/type crashes; issues are logic/state/error-handling that survive type-check.

**Fix-orchestration guidance:** Issues are grouped into **batches** below. Each batch is coherent (same file area / same root cause) so a single delegation to the `Implementation` agent can resolve it end-to-end. Cross-referenced source findings are noted per item.

---

## Batch A — Backend fail-fast guards (data-integrity) — BLOCKER + MAJOR

**Root cause (shared):** On this branch a _partial_ `AssignmentDefinition` now has `tasks` as an **array** (not `null`). Two defensive guards that relied on the old `tasks === null` sentinel were removed/weakened and not replaced with the new `Array.isArray` check.

### A1 — `AssignmentDefinition.toJSON()` silently corrupts on a partial instance — BLOCKER-equivalent

- **Files:** `src/backend/Models/AssignmentDefinition.js` (`toJSON()`, ~lines 280–296)
- **Source findings:** logging **B1**, findings **N3**
- **Bug:** `toJSON()` does `Object.fromEntries(Object.entries(this.tasks).map(...))` unconditionally. On a partial instance `this.tasks` is an **array** → `Object.entries(array)` yields numeric-index keys and the plain summary objects lack `toJSON`, producing a malformed keyed object with **no error**. JSDoc says "do not call on partial" but the method fails open.
- **Fix:** Add a fail-fast guard at top of `toJSON()`:
  ```javascript
  if (Array.isArray(this.tasks)) {
    throw new TypeError(
      'toJSON() must not be called on a partial AssignmentDefinition (tasks is an array). Use toPartialJSON().'
    );
  }
  ```

### A2 — `persistAssignmentRun` partial guard removed — MAJOR

- **Files:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js` (`persistAssignmentRun`, ~lines 43–128)
- **Source findings:** logging **B2**, findings **M1**
- **Bug:** The old guard `if (assignment.assignmentDefinition?.tasks === null) throw ...` was deleted and **not** replaced with the new partial sentinel. A still-partial (array-`tasks`) definition now passes `persistAssignmentRun` silently, then `rehydrateAssignment` throws downstream (`the authoritative record is a partial (tasks is an array)`).
- **Fix:** Restore the adapted guard immediately after the `Validate.requireParams`/field checks (inside or just before the `try`):
  ```javascript
  if (Array.isArray(assignment.assignmentDefinition?.tasks)) {
    throw new Error(
      'Cannot persist full assignment with partial assignmentDefinition (tasks is an array)'
    );
  }
  ```

**Batch notes:** `_ensureFullDefinition` (ABClassAssignmentOps ~line 243) and `rehydrateAssignment` already correctly use `Array.isArray` — these are the only two gaps. _EnsureFullDefinition_ guard and transport/boundary validation (`assignmentDefinitionTransport.js`, `assignmentDefinitionValidation.js`) are already correct and need no change.

---

## Batch B — Frontend correctness bugs — BLOCKER + MAJOR

### B1 — `TaskHeatmapPage` heatmap result goes STALE after Refresh — BLOCKER

- **File:** `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:125–127` (`useState(() => computeHeatmapState(...))` lazy initializer)
- **Source findings:** findings **B1**
- **Bug:** Derived `heatmapResult` is stored in `useState` (runs once on mount). After `refetch`, new `analyserResult`/`classFull`/`assignmentDefinitionPartials` arrive but state is never recomputed; `computeIsLoading` returns `false` during refetch (cached data) so the page is not remounted → stale scores / "no submissions" state shown after an explicit Refresh.
- **Fix (pick one):** Replace `useState` lazy init with `useMemo(() => computeHeatmapState(...), [analyserResult, classFull, assignmentId, assignmentDefinitionPartials])`; OR add a `key` that changes on refetch (e.g. `key={classFullUpdatedAt}`); OR move `adaptMetricsToHeatmap` into the hook. Keep the existing `try/catch`.

### B2 — Score-range filters are non-functional on both tables — MAJOR

- **Files:** `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx:119` (setter discarded `const [filters] = useState(...)`) + `:162–183` (`handleTableChange` ignores `_filters`); `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:222` (`activeRange: []` hardcoded)
- **Source findings:** findings **M2**
- **Bug:** `buildMetricRangeFilter` returns a `filteredValue` keyed off `activeRange`. In `StudentAveragesTableCard` the `filters` state setter is discarded and `onChange` ignores the `filters` arg → `activeRange` is permanently empty → `filteredValue` is `undefined` → `onFilter` never applied. In `TaskHeatmapTable` `activeRange` is hardcoded `[]`. The dropdown UI appears to work but **never filters rows**.
- **Note:** The discarded-setter pattern predates this branch; this branch reworked the filter UI and left the wiring broken. Not a new regression but must be fixed before shipping.
- **Fix:** In `StudentAveragesTableCard` use `const [filters, setFilters] = useState(...)` and read/apply the second (`filters`) arg in `handleTableChange`. In `TaskHeatmapTable` lift active-range state into the component (or `TaskHeatmapPage`) and pass the real `activeRange` into `buildMetricRangeFilter`.

---

## Batch C — Frontend analyser robustness — IMPROVEMENTS

### C1 — `resolveAssignmentDefinition` throw flips whole Class page to blocking — IMPROVEMENT

- **Files:** `src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts:32–34` (called from `averagingAnalyser.accumulation.ts:293` inside `accumulateDataPoints`)
- **Source findings:** findings **I1**
- **Bug:** A missing partial now throws (was previously a fallback to embedded `assignment.assignmentDefinition`). A single `definitionKey` absent from warm-up partials fails the entire analyser run → whole Class page `surfaceState: 'blocking'`.
- **Fix / decision:** Confirm intended blast radius. If too aggressive, degrade per-assignment (skip + log) instead of throwing for the whole class.

### C2 — `weight === 0` skip shows spurious `'E'` cells — IMPROVEMENT

- **File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:210–213`
- **Source findings:** findings **I2**
- **Bug:** When `assignmentWeighting * taskWeighting === 0` the data point is `continue`d, but the task was pre-registered with a zeroed accumulator → `accumToMetric` sees `applicableDataPoints === 0 && nCount === 0` → returns `state: 'error'` (`'E'`). Misleading for a weighted-out task that actually has submissions.
- **Fix:** Distinguish "excluded by zero weight" from "error" (e.g. return a `notAttempted`/excluded MetricResult rather than `'E'`).

### C3 — `computeOverallComposite` throws on all-zero weights — IMPROVEMENT (defensive)

- **File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:421–423`
- **Source findings:** findings **I3**
- **Bug:** `if (denominator === 0) throw new Error('computeOverallComposite: no computed criteria in composite')`. Reachable when every computed criterion's weighting is `0`; reused by `classPageAdapter.computeAverageMetric`, so a degenerate caller would crash the adapter (unreachable with default `WEIGHTS`).
- **Fix:** Return a safe `notAttempted`/error MetricResult instead of throwing.

---

## Batch D — Frontend UX / error-handling — MINOR

### D1 — `TaskHeatmapPage` generic error silently navigates back with no user feedback — MINOR

- **File:** `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (~lines 140–150, 2851–2911)
- **Source findings:** logging **F1**
- **Bug:** For a generic (non-`TaskTitlesUnavailableError`) error the component calls `logFrontendError(...)` (dev/console only) then `backCallback()` returning `null` — the user is silently returned to the overview with no in-app message. The `TaskTitlesUnavailableError` path correctly renders an `Alert`.
- **Fix:** Surface a user-safe message (Ant Design `App.useApp()` `message`/`notification`, or top-level `Alert`) before/while navigating back. Confirm this is intended product behaviour at minimum.

---

## Batch E — Frontend performance / rendering — IMPROVEMENTS (non-blocking)

### E1 — `TaskHeatmapTable` renders full S×T matrix with pagination off — highest-impact (RENDERING)

- **File:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:263–273` (`<Table … pagination={false} … />`; columns built ~204–256)
- **Source findings:** performance **Improvement 1**
- **Bug:** Renders all rows × (`taskColumns.length × 3`) cells ≈ O(S·T) DOM nodes, every one via `onCell`+`render` closure. At large classes (GC up to ~1000 students, dozens of tasks) this is the dominant cost / real scaling risk. Sort/filter operate over the full matrix each interaction.
- **Fix:** Enable `pagination` (or virtualise rows) and/or cap/pre-group task columns; keep `scroll={{ x: 'max-content' }}` but bound row count. UX/rendering change — flag to Implementation, not a defect.

### E2 — `TaskHeatmapTable` recomputes columns/sort/hasNoSubmissions each render — IMPROVEMENT

- **File:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:187` (`sortedRows`), `:192–202` (`hasNoSubmissions`), `:204–256` (`columns`)
- **Source findings:** performance **Improvement 3**
- **Bug:** Recomputed on every render without `useMemo`. Impact low in practice (`heatmapResult` is produced once via lazy `useState` in `TaskHeatmapPage`), but redundant on each sort/filter interaction.
- **Fix:** Wrap `sortedRows`, `hasNoSubmissions`, `columns` in `useMemo` keyed on `heatmapResult` (and `taskColumns`).

### E3 — `classPageAdapter` rolls up all A assignments but keeps 3 — IMPROVEMENT (minor waste)

- **File:** `src/frontend/src/features/classPage/classPageAdapter.ts:292–311`
- **Source findings:** performance **Improvement 2**
- **Bug:** `buildRecentAssignment` (3× `rollupMetric`) runs for **all** A assignments, then `sort().slice(0, MAX_RECENT_ASSIGNMENTS)` keeps 3 → ~ (A−3)·T wasted rollups.
- **Fix:** Sort by `updatedAt` desc and `slice(0, 3)` **first**, then roll up only those 3.

### E4 — `heatmapAdapter` rebuilds `metricByTaskKey` Map per student — NITPICK

- **File:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:198–200`
- **Source findings:** performance **Nitpick 4**
- **Bug:** O(S·T) asymptotically optimal, but Map allocation per student is redundant when `taskColumns` order is fixed.
- **Fix (optional):** Map `studentMetrics` into a positionally-indexed array once per student to avoid per-student Map allocation. Constant-factor only.

### E5 — `averagingAnalyser.rows` rescans students per task — NITPICK

- **File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts:56–66` (`collectAccumulatorsForTask`)
- **Source findings:** performance **Nitpick 5**
- **Bug:** O(T·S) — for each task scans all S students. Equals the matrix size (unavoidable cost) but rescanning is a worse constant factor.
- **Fix (optional, only if profiling demands):** Build an inverted index `taskKey → accumulator[]` once with a single O(S·T) pass. Not a real risk at expected scale.

---

## Batch F — Minor code-quality nitpicks — NON-BLOCKING

### F1 — Shared mutable `NOT_ATTEMPTED_METRIC` object — NITPICK

- **File:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:74–80` (used `:171–176`)
- **Source findings:** findings **N1**
- **Bug:** A single object is shared across all missing cells; never mutated today, but a future mutation would corrupt all missing cells.
- **Fix:** Return a fresh object per missing cell, or document it as frozen/read-only.

### F2 — `rows.toSorted(...)` is ES2023 — NITPICK

- **File:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:131`
- **Source findings:** findings **N2**
- **Bug:** `toSorted` (ES2023) could `TypeError` on any down-level runtime.
- **Fix:** Use `rows.slice().sort(compareHeatmapStudentName)` for maximum compatibility.

### F3 — `TaskTitlesUnavailableError` null-title branch is effectively dead code — NITPICK

- **File:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:159–161`
- **Source findings:** findings **N4**
- **Bug:** `AssignmentDefinitionPartialSchema.tasks` requires non-nullable `taskTitle` and `getAssignmentDefinitionPartials_` enforces `Array.isArray(row.tasks)`, so `c.taskTitle === null` never true.
- **Fix:** Remove the branch, or make the schema nullable if null titles are genuinely expected.

---

## Areas that PASSED (no action required)

- **Backend logging**: no `console.*` leaks, no empty `catch` blocks; `persistAssignmentRun` logs via `ABLogger.getInstance().error(...)` and rethrows; `ProgressTracker.logAndThrowError` routes diagnostics correctly (logging B3).
- **Transport-boundary validation**: `assignmentDefinitionTransport.js` + `assignmentDefinitionValidation.js` enforce `Array.isArray(row.tasks)` fail-fast.
- **`_ensureFullDefinition` guard** correctly adapted to `Array.isArray`.
- **`Validate.requireParams`** adopted in `persistAssignmentRun` / `rehydrateAssignment`.
- **Frontend logger usage** goes through `logFrontendError` (normalises via `normaliseUnknownError`), not raw `console`.
- **`ClassSelectionContext`** throws `TypeError` without a provider (acceptable dev guard).
- **Performance**: no O(N²)+ algorithmic defects. `accumulation.ts`, `filters.ts`, `rollupMetric.ts`, `resolveAssignmentDefinition.ts`, `metricRangeFilter*.tsx`, `studentAveragesTableColumns.tsx`, `classPageModel.ts` all use Map/Set indices and single-pass accumulation — optimal.

## Priority order for orchestration

1. **Batch A** (backend data-integrity) — must fix before merge.
2. **Batch B** (frontend blocker + major) — must fix before merge.
3. **Batch C** (analyser robustness) — should fix before merge.
4. **Batch D** + **Batch E** (UX + performance) — schedule, non-blocking.
5. **Batch F** (nitpicks) — opportunistic.

> Per AGENTS.md §6, after fixes re-submit the diff to `Code Reviewer` and iterate until the review returns clean.
