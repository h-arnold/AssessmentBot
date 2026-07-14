# Pre-PR Code Review — `opencode/crisp-meadow` vs `feat/ReactFrontend`

**Review type:** REVIEW-ONLY (no edits). Focus: latent bug hunting — logical errors that could cause
runtime errors or incorrect results.

**Scope reviewed (production source):**

- Analysers: `averagingAnalyser.accumulation.ts`, `averagingAnalyser.ts`, `averagingAnalyser.criterionAccumulation.ts`, `resolveAssignmentDefinition.ts`, `rollupMetric.ts`, `heatmapAdapter.ts`
- React components: `ClassPage.tsx`, `ClassPageContent.tsx`, `TaskHeatmapPage.tsx`, `TaskHeatmapTable.tsx`, `studentAveragesTableColumns.tsx`, `StudentAveragesTableCard.tsx`, `metricRangeFilter.tsx`, `metricRangeFilterDropdown.tsx`
- Hooks/data: `useClassPageData.ts`, `useClassPageData.helpers.ts`, `classPageAdapter.ts`
- Schemas/util: `dataAnalysis.zod.ts`, `classDetailService.zod.ts`, `assignmentDefinitionPartials.zod.ts`, `assignmentDefinitionUtilities.ts`, `metricTone.ts`, `metricRangeKey.ts`
- Backend: `AssignmentDefinition.js`, `ABClassAssignmentOps.js`, `AssignmentDefinitionPersistence.js`, `assignmentDefinitionTransport.js`, `assignmentDefinitionValidation.js`

---

## VERDICT: **NEEDS IMPROVEMENT** (1 blocker-class functional bug, 2 majors). No compile/type crashes found in static reading; the issues are logic/state bugs that survive type-checking.

---

## BLOCKERS (must fix before merge)

### B1. TaskHeatmapPage — heatmap result computed once, goes STALE after Refresh

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:125-127` (and `computeHeatmapState` 77-91, used as `useState` lazy initializer)
- **Bug:** `heatmapResult` is produced by `useState(() => computeHeatmapState(analyserResult, classFull, assignmentId, assignmentDefinitionPartials))`. A `useState` lazy initializer runs **once on mount only**. The component receives new `analyserResult`/`classFull`/`assignmentDefinitionPartials` after `refetch`, but the state is never recomputed.
- **Trigger:** On the heatmap view, click **Refresh** (`refetch` → `queryRefetch()` + `adpRefetch()`). `useClassPageData` recomputes `analyserResult` synchronously; `computeIsLoading` (helpers.ts:125-135) returns `false` during a refetch because `isPending` is false (cached data) and `adapterResult` stays non-null — so `surfaceState` stays `'ready'` and `TaskHeatmapPage` is **not** remounted. The stale `heatmapResult` is rendered.
- **Impact:** User sees outdated scores / outdated "no submissions" state after refreshing; data only updates if the user navigates back to overview and re-opens the heatmap (forcing a remount).
- **Severity:** Blocker (incorrect results shown to the user after an explicit refresh action).
- **Suggested fix:** Do not store derived data from props in `useState`. Compute instead with `useMemo(() => computeHeatmapState(...), [analyserResult, classFull, assignmentId, assignmentDefinitionPartials])`, or add a `key` that changes on refetch (e.g. `key={classFullUpdatedAt}`), or move `adaptMetricsToHeatmap` into the hook. Keep the `try/catch` so errors still land in state.

---

## MAJORS (should fix before merge)

### M1. Backend `persistAssignmentRun` removed the partial-definition guard without replacing it with the new `Array.isArray` check

- **File:line:** `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js:43-128` (the `if (assignment.assignmentDefinition?.tasks === null) throw ...` block was deleted)
- **Bug:** Partial-definition detection changed semantics on this branch: a partial definition now has `tasks` as an **array** (not `null`). The old defensive guard `if (assignment.assignmentDefinition?.tasks === null) throw new Error('Cannot persist full assignment with partial assignmentDefinition (tasks: null)')` was removed, but was **not** replaced with the equivalent `if (Array.isArray(assignment.assignmentDefinition?.tasks)) throw ...`. So a still-partial (array) definition now passes through `persistAssignmentRun` silently.
- **Trigger:** Persist an assignment whose `assignmentDefinition.tasks` is still an array (e.g. caller path that does not first call `ensureFullDefinition`, or `ensureFullDefinition` silently no-ops because the registry holds a partial).
- **Impact:** A partial definition gets persisted where a full one is expected. Downstream `rehydrateAssignment` (`ABClassAssignmentOps.js:243-268`) then throws `Failed to rehydrate definition '…': the authoritative record is a partial (tasks is an array)` because `storedDefinition.tasks` is an array → `!Array.isArray(...)` is false. This is a runtime error / data-consistency break.
- **Severity:** Major (correctness + potential thrown error downstream).
- **Suggested fix:** Restore the guard using the new partial sentinel:
  ```js
  if (Array.isArray(assignment.assignmentDefinition?.tasks)) {
    throw new Error(
      'Cannot persist full assignment with partial assignmentDefinition (tasks is an array)'
    );
  }
  ```
  (Keep the `try/catch` + `ABLogger` already wrapping the body.)

### M2. Score-range filters are non-functional on both the Student Averages table and the Heatmap table

- **File:line:** `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx:119` (`const [filters] = useState<StudentAveragesTableFilters>(INITIAL_FILTERS);` — **setter discarded**) and `:162-183` (`handleTableChange` ignores the `filters` arg named `_filters`); `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:222` (`activeRange: []` hardcoded).
- **Bug:** `buildMetricRangeFilter` always returns a `filteredValue` key. For the Student Averages table it is derived from `activeRange: columnFilters`, but `filters` state is never updated (setter discarded, `onChange` ignores it), so `activeRange` is permanently the empty `INITIAL_FILTERS` → `filteredValue` is `undefined` → `onFilter` is never applied. For the Heatmap table `activeRange` is hardcoded `[]`, so the same applies. The dropdown UI renders and appears to work (slider + N/E toggles + confirm) but the table never actually filters rows.
- **Trigger:** Any use of the per-column score-range filter dropdown on either table.
- **Impact:** Filters are decorative; rows are never hidden. Functional defect (the column "filters" advertised in the file header are not wired).
- **Severity:** Major (functional). _Note:_ the discarded-setter pattern **predates** this branch (base `feat/ReactFrontend` already had `const [filters] = useState(...)`), so this is not a new regression introduced here — but this branch reworked the filter UI to a new range-dropdown implementation and did not address the broken wiring. Flagged so it is fixed rather than shipped.
- **Suggested fix:** In `StudentAveragesTableCard`, use `const [filters, setFilters] = useState(...)` and in `handleTableChange` read the second (`filters`) argument and `setFilters(...)`. In `TaskHeatmapTable`, lift the active range state into the component (or `TaskHeatmapPage`) and pass the real `activeRange` into `buildMetricRangeFilter` so `filteredValue` reflects the user's selection.

---

## IMPROVEMENTS (non-blocking, correctness/robustness)

### I1. `resolveAssignmentDefinitionData` throwing on a missing partial makes the WHOLE class page blocking

- **File:line:** `src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts:32-34` (called from `averagingAnalyser.accumulation.ts:293` inside `accumulateDataPoints`, which is inside the analyser step caught by `useClassPageData.runAnalyserStep` → `analyserError` → `surfaceState: 'blocking'`).
- **Bug/behaviour:** Previously a missing partial fell back to the embedded `assignment.assignmentDefinition`. Now it **throws**, so a single `definitionKey` referenced by any assignment but absent from the warm-up `assignmentDefinitionPartials` fails the entire analyser run and flips the whole Class page into a blocking error — not just that assignment.
- **Trigger:** Warm-up partials dataset is missing one referenced definition key (or a class has an assignment whose `definitionKey` isn't in the registry).
- **Impact:** Over-aggressive failure (per spec fail-fast is acceptable, but the blast radius is the entire class, which may be surprising).
- **Severity:** Improvement — confirm this is the desired blast radius; otherwise degrade per-assignment (skip + log) rather than throw for the whole class.

### I2. `weight === 0` skip produces spurious `error` ('E') cells for tasks that actually have submissions

- **File:line:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:210-213`
- **Bug:** When `assignmentWeighting * taskWeighting === 0`, the data point is skipped (`continue`), but the task was already pre-registered (`preRegisterTasks`) with a zeroed accumulator. `accumToMetric` then sees `applicableDataPoints === 0 && nCount === 0` → returns `state: 'error'` (value `'E'`).
- **Trigger:** A definition or task with weighting `0` that still has submissions.
- **Impact:** The heatmap shows 'E' (error) for a weighted-out task instead of "no data / excluded", which is misleading to a teacher. (Edge case — weighting 0 is unusual but valid.)
- **Severity:** Improvement.

### I3. `computeOverallComposite` throws if all computed criteria happen to have zero weight

- **File:line:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:421-423`
- **Bug:** `if (denominator === 0) throw new Error('computeOverallComposite: no computed criteria in composite')`. Reachable only if every computed criterion's weighting is `0` (e.g. a custom `CriterionWeightings` with all computed weights `0`). Throws rather than returning a safe `notAttempted`/error MetricResult. Default `WEIGHTS` make this unreachable today, but the function is reused in `classPageAdapter.computeAverageMetric`, so a caller passing degenerate weights would crash the adapter.
- **Severity:** Improvement (defensive).

---

## NITPICKS

### N1. `heatmapAdapter.ts` shares a single mutable `NOT_ATTEMPTED_METRIC` object across all missing cells

- **File:line:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:74-80` (used at `:171-176`).
- **Bug:** Currently never mutated, so safe today. But every missing cell references the **same** object; any future code that mutates a cell's metric (e.g. `metric.totalWeight = …`) would corrupt all missing cells.
- **Fix:** Return a fresh object per missing cell, or document it as frozen/read-only.

### N2. `TaskHeatmapTable.tsx:131` uses `rows.toSorted(...)` (ES2023)

- **File:line:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx:131`
- **`toSorted`** is ES2023. Fine in modern browsers / current builder target, but consider `rows.slice().sort(compareHeatmapStudentName)` for maximum compatibility and to avoid a hard runtime `TypeError` on any down-level runtime.

### N3. `AssignmentDefinition.toJSON()` now assumes `this.tasks` is a keyed object

- **File:line:** `src/backend/Models/AssignmentDefinition.js:280-296`
- **Bug:** `toJSON()` unconditionally does `Object.fromEntries(Object.entries(this.tasks).map(...))`. If ever called on a partial instance (where `this.tasks` is an array of `{taskId, taskWeighting, taskTitle}`), `Object.entries(array)` yields index keys and the plain summary objects lack `toJSON`, producing a malformed keyed object. The doc comment says "do not call on partial instances", but it is a latent footgun if a caller violates that.
- **Severity:** Nitpick (documented contract).

### N4. `TaskTitlesUnavailableError` for `null` task titles is effectively dead code given the schema

- **File:line:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:159-161` (`taskColumns.some((c) => c.taskTitle === null)`)
- **Note:** `AssignmentDefinitionPartialSchema.tasks` is `z.array(TaskPartialSchema)` and `TaskPartialSchema.taskTitle` is a required `string` (non-nullable), and `getAssignmentDefinitionPartials_` enforces `Array.isArray(row.tasks)`. So `taskTitle` is always a string and this branch never throws. Harmless, but the null-title path can be removed or the schema made nullable if null titles are genuinely expected.

---

## SUMMARY OF FILES READ (evidence gate)

- Frontend: `TaskHeatmapPage.tsx`, `TaskHeatmapTable.tsx`, `ClassPage.tsx`, `ClassPageContent.tsx`, `StudentAveragesTableCard.tsx`, `studentAveragesTableColumns.tsx`, `metricRangeFilter.tsx`, `metricRangeFilterDropdown.tsx`, `metricRangeKey.ts`, `metricTone.ts`, `metricDisplayMeta.ts` (skimmed via import), `classPageAdapter.ts` (diff), `useClassPageData.ts`, `useClassPageData.helpers.ts`, `dataAnalysis.zod.ts` (diff), `classDetailService.zod.ts`, `assignmentDefinitionPartials.zod.ts`, `assignmentDefinitionUtilities.ts`, `RecentAssignmentCard.tsx`/`RecentAssignmentsSection.tsx` (grep), `averagingAnalyser.accumulation.ts`, `averagingAnalyser.ts` (diff), `averagingAnalyser.criterionAccumulation.ts`, `resolveAssignmentDefinition.ts`, `rollupMetric.ts`, `heatmapAdapter.ts`
- Backend: `AssignmentDefinition.js`, `ABClassAssignmentOps.js`, `AssignmentDefinitionPersistence.js`, `assignmentDefinitionTransport.js`, `assignmentDefinitionValidation.js` (all diffs)
- Docs/AGENTS: `AGENTS.md`, `src/frontend/AGENTS.md`, `src/backend/AGENTS.md`

**No automated checks were run (per instructions).**

---

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
