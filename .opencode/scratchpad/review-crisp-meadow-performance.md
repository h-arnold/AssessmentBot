# Performance Review — branch `opencode/crisp-meadow` vs `feat/ReactFrontend`

**Scope:** PERFORMANCE ONLY — focus on O(N²) and worse algorithms in the listed
data-analysis / class-page files. REVIEW-ONLY; no automated checks run; no edits.

**Files reviewed (read in full):**

- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts`
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
- `src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts`
- `src/frontend/src/features/classPage/classPageAdapter.ts`
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.tsx`
- Supporting (referenced): `classPageModel.ts`, `classPageAdapter.zod.ts`
- Consumers (for memoisation grounding): `TaskHeatmapPage.tsx`, `StudentAveragesTableCard.tsx`

---

## Overall verdict

**PASS with non-blocking Improvements.** At expected scale (a class with up to a few
hundred students and up to a few dozen tasks), there are **no algorithmically dangerous
O(N²)+ blow-ups**. Every heavy loop in the review set is **output/data-proportional
(O(S·T) or O(C·A·S·T), i.e. proportional to the size of the input it must aggregate)**,
which is optimal. The authors already proactively used `Map`/`Set` indices to avoid
N² lookups (see the explicit notes in `averagingAnalyser.accumulation.ts` and
`averagingAnalyser.filters.ts`). The single "nested-loop" shape
(`collectAccumulatorsForTask` called per task over all students) is O(S·T) and is **not**
worse than the unavoidable aggregation cost.

The only genuine scaling risk at large sizes is **render/JSON volume in `TaskHeatmapTable`
with `pagination={false}`** — a DOM/rendering concern, not an algorithm-complexity blow-up.
That, plus two minor wasted-computation / memoisation items, are the highest-impact rewrites,
all classified as Improvement/Nitpick (not Critical).

---

## Detailed findings

### Files with clean (optimal) complexity — no action

- **`averagingAnalyser.accumulation.ts`** (`accumulateDataPoints`, `processAssignment`,
  `buildPerStudentTaskMetrics`): Builds `taskWeightByDefinitionKey` (a two-level `Map`)
  once, then uses O(1) `.get()` inside the submission×item loop. Single pass over all
  data points → O(total data points). Already the right approach. ✅
- **`averagingAnalyser.filters.ts`** (`filterAssignments`): Builds `topicKeySet` /
  `definitionKeySet` `Set`s once, uses O(1) `.has()` inside `.filter()`. ✅
- **`rollupMetric.ts`** (`rollupMetric`, `accumulateOne`): Single `for…of` pass per call,
  O(n). ✅
- **`resolveAssignmentDefinition.ts`**: O(1) `Map.get`. ✅
- **`metricRangeFilter.tsx`** / **`metricRangeFilterDropdown.tsx`**: `buildMetricRangeFilter`
  is O(1); `onFilter` runs once per visible row on filter apply (single pass). ✅
- **`studentAveragesTableColumns.tsx`**: `buildStudentAveragesTableColumns` builds 4 metric
  columns at O(1). Already invoked inside `useMemo` in `StudentAveragesTableCard.tsx`
  (lines 133-134), so it is not recomputed on every render. ✅
- **`classPageModel.ts`** (`buildClassPageViewModel`): one filter pass + one sort → O(S). ✅

### Findings to consider (all non-blocking)

#### Improvement — 1 (highest-impact, real-world scaling): render volume in `TaskHeatmapTable.tsx`

- **Location:** `TaskHeatmapTable.tsx:263-273` — `<Table … pagination={false} … />` and the
  column build at lines 204-256.
- **Current complexity:** The table renders **all** rows × all columns with no pagination.
  Columns = `taskColumns.length × 3` (completeness/accuracy/spag). Cells rendered ≈
  `students × (tasks × 3)` = **O(S·T)** DOM nodes, every one via an `onCell` + `render`
  closure.
- **Why it matters at scale:** This is the dominant cost at large sizes. Google Classroom
  classes can hold up to ~1000 students; an assignment may have dozens of tasks. At
  S=200, T=50 → ~30,000 `<td>` cells; at S=1000, T=50 → ~150,000 cells. Ant Design renders
  all of them eagerly. This is a rendering/DOM blow-up (not an algorithm blow-up), but it is
  the real risk on this branch if a large class is opened. Sort/filter also operate over the
  full matrix each interaction.
- **Faster approach:** Enable `pagination` (or virtualise rows), and/or cap/pre-group task
  columns; keep `scroll={{ x: 'max-content' }}` but bound the row count. This converts the
  on-screen cost from O(S·T) to O(pageSize·T). Note: this is a UX/rendering change, not an
  algorithm rewrite — flag for the Implementation agent rather than treating as a defect.

#### Improvement — 2 (minor wasted computation): `classPageAdapter.ts`

- **Location:** `classPageAdapter.ts:292-311` — loops over **all** `classFull.assignments`,
  calling `buildRecentAssignment` (which rolls up per-task metrics via `rollupMetric` ×3) for
  every assignment, then `recentAssignments.sort(...).slice(0, MAX_RECENT_ASSIGNMENTS)`.
- **Current complexity:** Roll-up work done for **all A assignments**, but only **3** are kept.
  Waste = (A − 3) rollups, each O(perTask rows for that assignment) ≈ O(T). So ~ (A−3)·T
  wasted iterations.
- **Why it matters:** At realistic A (≈20-50) this is a few hundred to low-thousands of extra
  `rollupMetric` iterations — negligible in absolute terms, but it is clearly wasteful and
  easy to fix.
- **Faster approach:** Sort assignments by `updatedAt` descending and `slice(0, 3)` **first**,
  then roll up only those 3. Single-pass sort is still O(A log A); roll-up drops to O(3·T).

#### Improvement — 3 (memoisation robustness): `TaskHeatmapTable.tsx`

- **Location:** `TaskHeatmapTable.tsx:187` (`sortedRows`), `:192-202` (`hasNoSubmissions`),
  `:204-256` (`columns`).
- **Current complexity:** Recomputed on **every** component render without `useMemo`.
  `hasNoSubmissions` is O(S·T); `columns` builds 3T column descriptors (each with a
  `buildMetricRangeFilter` + closures) on every render; `sortedRows` is O(S log S).
- **Why it matters:** In practice impact is **low** — `heatmapResult` is produced once via a
  `useState` lazy initializer in `TaskHeatmapPage.tsx:125-127`, so `TaskHeatmapTable` only
  re-renders on user-driven sort/filter changes, not on parent re-renders. Still, recomputing
  `columns`/`hasNoSubmissions` on each sort/filter interaction is needless.
- **Faster approach:** Wrap `sortedRows`, `hasNoSubmissions`, and `columns` in `useMemo`
  keyed on `heatmapResult` (and `taskColumns`). Low risk, removes redundant work.

#### Nitpick — 4 (avoidable per-student Map rebuild): `heatmapAdapter.ts`

- **Location:** `heatmapAdapter.ts:198-200` — `metricByTaskKey` `Map` rebuilt for every
  student inside `classFull.students.map`.
- **Current complexity:** O(S·T) total (building a Map of size ≈T per student). Output is also
  O(S·T), so this is asymptotically optimal — but the Map is rebuilt redundantly when
  `taskColumns` order is fixed and `studentMetrics` is small.
- **Faster approach (optional):** Since `taskColumns` is a fixed ordered array, map
  `studentMetrics` into a positionally-indexed array once per student (or pre-sort
  `studentMetrics` by `taskColumns` order) to avoid a `Map` allocation per student. Constant-
  factor only; not a real risk.

#### Nitpick — 5 (constant-factor, optional): `averagingAnalyser.rows.ts`

- **Location:** `averagingAnalyser.rows.ts:56-66` (`collectAccumulatorsForTask`) called from
  `buildPerTaskRows` (`:159-160`) once per task over all `perStudentTaskAccums` (S students).
- **Current complexity:** O(T·S) — for each of T tasks it scans all S students' nested maps.
  Total = S·T `Map.get`s, which equals the size of the per-(student,task) matrix — i.e. the
  data it must aggregate. Not worse than the unavoidable cost; producing T rows from an S·T
  matrix inherently touches S·T cells.
- **Faster approach (optional, only if profiling demands):** Build an **inverted index**
  (`taskKey → accumulator[]`) once with a single O(S·T) pass, then O(1) lookup per task
  instead of rescanning all students T times. Asymptotically identical (both O(S·T)) but
  better constant factor and cache locality. **Not a real risk at expected scale** — do not
  prioritise.

---

## Summary table

| File                                                                                                                                    | Pattern                            | Complexity                | Risk at expected scale | Action                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------- | ---------------------- | ---------------------- |
| TaskHeatmapTable.tsx                                                                                                                    | full-matrix render, pagination off | O(S·T) cells in DOM       | **Real (rendering)**   | Improvement 1          |
| classPageAdapter.ts                                                                                                                     | roll up all A, keep 3              | O((A−3)·T) wasted         | Low                    | Improvement 2          |
| TaskHeatmapTable.tsx                                                                                                                    | recompute columns/sort each render | O(S·T)+O(S log S)         | Low (stable prop)      | Improvement 3          |
| heatmapAdapter.ts                                                                                                                       | per-student Map rebuild            | O(S·T)                    | Negligible             | Nitpick 4              |
| averagingAnalyser.rows.ts                                                                                                               | rescan students per task           | O(S·T)                    | Negligible             | Nitpick 5              |
| accumulation / filters / rollupMetric / resolveAssignmentDefinition / metricRangeFilter* / studentAveragesTableColumns / classPageModel | —                                  | O(n) with Map/Set indices | None                   | None — already optimal |

## Bottom line

No O(N²)+ **algorithmic** defect exists in the review set. The codebase already uses index
`Map`s/`Set`s and single-pass accumulation everywhere it matters. The highest-impact change is
**rendering** (paginate/virtualise `TaskHeatmapTable`), which is a UX/rendering concern rather
than a complexity blow-up. Items 2-5 are minor and non-blocking.
