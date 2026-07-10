# Task Heatmap — Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (v2.0, reviewed clean).
2. Read the companion `TASK_HEATMAP_LAYOUT.md` (v2.0, reviewed clean).
3. Treat both documents as the source of truth for product behaviour, contracts, and layout rules. Do **not** restate or redefine material already settled in those docs.

This plan delivers the single-assignment Task Heatmap as a **projection** of the existing
`AnalysisFilter` + `AveragingAnalyser` pipeline. It adds granular `perStudentTaskMetrics` to
`AveragingResult`, a pure `adaptMetricsToHeatmap` adapter, a compact `MetricPill` variant, a
grouped-header `TaskHeatmapTable`, and a `TaskHeatmapPage` reached from a `RecentAssignmentCard`
click via a new ClassPage view-state. No parallel filter/transform engine is introduced.

---

## Scope and assumptions

### Scope

- Extend `AveragingResult` (frontend `dataAnalysis.zod.ts`) with `perStudentTaskMetrics: PerStudentTaskMetric[]`, exposed from the analyser's internal `perStudentTaskAccums`.
- Add `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId): HeatmapResult` adapter.
- Add a compact `MetricPill` variant (`precision: 2`, distinct from `emphasised`).
- Build `TaskHeatmapTable` (grouped headers, band `filters`/`onFilter`, sorters, sticky first column, `aria-label`s).
- Build `TaskHeatmapPage` and wire it into `ClassPage` via a new `overview | heatmap` view-state; add an `onOpenHeatmap(assignmentId)` handler to `RecentAssignmentCard`.
- Add Vitest unit/component coverage for the adapter, comparator, table columns, and page; add a Playwright E2E covering the full user journey (using `tests/__mocks__/data/anon-test-data.json` as the class fixture source).

### Out of scope

- `assignmentIds` analyser-level filter and multi-assignment heatmap (deferred in `SPEC.md` §Deferrals).
- In-assignment task search (deferred in `SPEC.md`).
- Persisting sort/filter preferences (user-declined).
- Column reordering (user-declined).
- Backend changes — the analyser remains a pure frontend function and `getABClass` is unchanged, but `AssignmentDefinition.toPartialJSON()` must emit `taskId` + `taskTitle` per task (see Section 7). The stale, test-only `validatePartialRow_` guard is reconciled to match the live `toPartialJSON()` shape; `getAssignmentDefinitionPartials_` did not invoke it in production and still does not. No new endpoint is required.

### Assumptions

1. `useClassPageData` already produces `analyserResult: AveragingResult` (with the new `perStudentTaskMetrics`) and `classFull: ClassFull`; the heatmap view consumes both unchanged. The analyser is invoked once per class, so Student Averages is unaffected.
2. Task columns are derived from the warm-up `assignmentDefinitionPartials` located by the assignment's `definitionKey` via `getAssignmentDefinitionPartial` (not from the embedded `assignmentDefinition.tasks`, which carries the weight-summary shape without titles). The partial task shape is `TaskPartial[]` = `{ taskId, taskWeighting, taskTitle }` after Section 7 lands in full (commit 7a adds `taskTitle`; commit 7b+§8 renames `id` → `taskId`). `taskKey` is `${definitionKey}::${taskId}`. Note: `classFull.assignments[].assignmentDefinition` IS typed `AssignmentDefinitionPartialSchema` (`classDetailService.zod.ts:126`), so the embedded `tasks` and the warm-up `tasks` share the SAME shape — the rename affects both paths in lock-step (Section 7 Steps 1a + 1b).
3. The heatmap column set is sourced from the warm-up `assignmentDefinitionPartials` (Sections 7–8), so the E2E fixture must seed that dataset for the assignment's `definitionKey` with three tasks (`task_001`, `task_002`, `task_003`), each `{ taskId, taskWeighting: 1, taskTitle: '<human-readable>' }`. (See `ACTION_PLAN.md` §"BLOCKING BUG" for the verified root cause: the embedded `classFull.assignments[].assignmentDefinition.tasks` carries the weight-summary shape and lacks `taskTitle` in the existing v1 emitter — it is NOT necessarily null, and the column-source defect is missing titles, not column missing entirely. Post-§7, the emitter includes `taskTitle`.) The fixture keeps the tasks available on the base anon fixture so the "no submissions" variant strips submissions while the task list stays populated (distinct from the zero-tasks variant).
4. The E2E fixture loader imports `anon-test-data.json` via a repo-relative path from `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`. If Vite's `server.fs.allow` blocks the cross-root import during E2E, the implementation falls back to a co-located typed `ClassFull` literal seeded from the same data (recorded as a deviation in Section 6).
5. Band-filter values are the `MetricToneColor` tokens `red | gold | green | default | volcano`, with visible labels `Red (low)`, `Amber (mid)`, `Green (high)`, `Not Attempted`, `Error` (reused from `METRIC_COLUMN_FILTERS`).
6. v1 single-assignment selection assumes the selected assignment's `definitionKey` is unique within `classFull.assignments` (no two assignments in the class share a `definitionKey`). If two assignments collide, their per-(student, task) accumulators merge under the same `taskKey`; this is out of scope for v1 because existing duplicate/integrity checks are expected to catch such data, and the deferred `assignmentIds` re-keying also closes it.
7. `taskColumns` are derived from the warm-up `assignmentDefinitionPartials` located by `assignment.assignmentDefinition.definitionKey` via `getAssignmentDefinitionPartial` (treated as authoritative for column structure); `perStudentTaskMetrics` `taskKey`s derive from submission item keys and are expected to agree for valid data.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; delegate behaviour to services/analysers/adapters.
- Fail fast on invalid inputs (e.g. `ClassFullSchema` strict parse in `getABClass` adapter).
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, consistent with repository conventions.
- British English in comments and documentation.
- No speculative scope expansion.

### TDD workflow (mandatory per section)

For each section: **Red** (failing test) → **Green** (smallest change) → **Refactor** → run section checks.

### Delegation mandatory-read gate

When a section is delegated, the plan defines required docs; the sub-agent handoff must include `Files read` with every mandatory path; if any is missing, return the work and block progression.

### Shared-helper planning gate

Where helper reuse/extension/new helpers are expected, the section records the decision and (for production helpers) planned canonical-doc entries marked `Not implemented`.

### Module sizing / LOC (Planner §1.11)

| File                                                                  | Current LOC | Projected LOC | Action                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/dataAnalysis/dataAnalysis.zod.ts`                           | 197         | ~235          | No separation (< 500)                                                                                                                                                                                                      |
| `services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`   | 418         | ~470          | No separation. **If** it crosses 500, extract `buildPerStudentTaskMetrics` into `averagingAnalyser.perStudentTaskMetrics.ts`.                                                                                              |
| `services/dataAnalysis/metricDisplay/MetricPill.tsx`                  | 125         | ~170          | No separation                                                                                                                                                                                                              |
| `features/classPage/classPageModel.ts`                                | 189         | ~210          | Add `compareHeatmapStudentName` (keep local) + `export` `METRIC_STATE_RANK_ASC` (reused by heatmap comparator)                                                                                                             |
| `features/classPage/RecentAssignmentCard.tsx`                         | 92          | ~120          | Add `onOpenHeatmap` prop                                                                                                                                                                                                   |
| `features/classPage/useClassPageData.ts`                              | 404         | 404           | **Unchanged**                                                                                                                                                                                                              |
| `features/classPage/studentAveragesTableColumns.tsx`                  | 164         | ~168          | `export` `METRIC_COLUMN_FILTERS` (reused by the heatmap table); `compareStudentNames` reused as-is. `DEFAULT_TONE_RANGE` is **not** exported — the heatmap table calls `resolveMetricTone(metric)` with the default range. |
| `services/dataAnalysis/heatmapAdapter.ts`                             | 165         | ~215          | §8 adds `TaskTitlesUnavailableError` (class), the required 4th parameter, partial-source `buildTaskColumns`, and `TaskTitlesUnavailableError` branching. < 500 — no separation.                                            |
| `features/classPage/TaskHeatmapTable.tsx`                             | —           | < 300         | Fresh file (Section 4)                                                                                                                                                                                                     |
| `features/classPage/TaskHeatmapPage.tsx`                              | 123         | ~175          | §8 adds the `TaskTitlesUnavailableError` / generic-`Error` branch in the existing try-catch and the in-view `Alert`. < 500 — no separation.                                                                                |
| `features/classPage/ClassPageContent.tsx`                             | 436         | ~455          | §8 widens the `ready` heatmap gate (lines 307–312) and forwards an `assignmentDefinitionPartials` prop. < 500 — no separation.                                                                                             |
| `features/classPage/ClassPage.tsx`                                    | existing    | +~10          | §8 destructures `assignmentDefinitionPartials` from `useClassPageData` and threads it through `ClassPageContent`.                                                                                                          |
| `services/assignmentDefinition/taskPartial.zod.ts`                    | 20          | ~25           | §7 Step 1a/1b: add `taskTitle` (nullable) + rename `id` → `taskId`.                                                                                                                                                        |
| `backend/Models/AssignmentDefinition.js`                              | 414         | ~418          | §7 Step 2a/2b: add `taskTitle` to `toPartialJSON()` map + rename `id` → `taskId` in the emit. GAS exposure unchanged (guarded `module.exports` retained).                                                                  |
| New: `services/assignmentDefinition/assignmentDefinitionUtilities.ts` | —           | < 25          | Fresh file (§7 Step 4) — `getAssignmentDefinitionPartial` pure helper. Single-file utility; no folder expansion triggered.                                                                                                 |

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests: `npm run test:frontend:e2e -- <target>`
- Backend tests: not required (no backend change)

---

## Section 1 — Expose `perStudentTaskMetrics` on `AveragingResult`

### Objective

Surface the analyser's internal per-(student, task) accumulators as a typed, validated field on
`AveragingResult` so downstream projections (the heatmap) can consume granular metrics without
re-running analysis or re-ingesting `ClassFull`.

### Constraints

- Do **not** change `AnalysisFilter`, `filterAssignments`, or the analyser rollup logic (`perStudent`, `perTask`, `perClass`).
- Reuse the existing `accumToMetric` path (`averagingAnalyser.accumulation.ts:40-68`) so the exposed metrics are computed identically to every other scope.
- `taskKey` is `${definitionKey}::${taskId}` (no `assignmentId` in v1 — see `SPEC.md` §Deferrals).
- `overall` is retained on each `PerStudentTaskMetric` (the accumulator already populates it).
- `classId` is carried on each `PerStudentTaskMetric` for future cross-class merge (v1 single-class only).
- **Match `SPEC.md` §"Recommended data shapes" exactly:** `perStudentTaskMetrics` is an **optional** field, and `PerStudentTaskMetricSchema` is a `z.strictObject` with **only** `classId`, `studentId`, `taskKey`, `completeness`, `accuracy`, `spag`, `overall`. Do **not** add `taskId`/`taskTitle` here — those live only on `HeatmapResult.taskColumns` (added by the adapter in Section 2). `taskKey` already encodes `taskId`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (§"Recommended data contract", §"Granular accumulator", §Deferrals)
- `TASK_HEATMAP_LAYOUT.md` (§"Data flow")
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.criterionAccumulation.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs: same set as above, plus `src/frontend/AGENTS.md` §9.

Code Reviewer mandatory docs: same set plus `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`.

### Shared helper plan

1. Helper: `accumToMetric` (existing)
   - Decision: `reuse` — call it for each criterion when building `PerStudentTaskMetric`.
   - Owning module: `averagingAnalyser.accumulation.ts`.
   - Call-site rationale: single conversion path for `DataPointAccumulator` → `MetricResult`.
2. Helper: `buildPerStudentTaskMetrics` (new, internal to analyser)
   - Decision: `new` (keep local to analyser package).
   - Owning module: `averagingAnalyser.accumulation.ts` (or `averagingAnalyser.perStudentTaskMetrics.ts` if LOC crosses 500).
   - Call-site rationale: converts `perStudentTaskAccums` into the validated `PerStudentTaskMetric[]`.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 — record as `Not implemented` (feature-local helpers are still logged per the shared-helper gate).
   - Planned doc status: `Not implemented` (production helper, feature-local; still recorded per shared-helper gate).
3. Helper: `PerStudentTaskMetricSchema` (new zod)
   - Decision: `new`.
   - Owning module: `dataAnalysis.zod.ts`.

### Acceptance criteria

- `AveragingResultSchema` gains an **optional** `perStudentTaskMetrics: z.array(PerStudentTaskMetricSchema)` field (matches `SPEC.md` §"Recommended data shapes" exactly).
- `PerStudentTaskMetricSchema` is a `z.strictObject` with exactly `classId`, `studentId`, `taskKey`, `completeness`, `accuracy`, `spag`, `overall` (no `taskId`/`taskTitle` — `taskKey` encodes the task; `taskId`/`taskTitle` are carried only on `HeatmapResult.taskColumns` by the adapter).
- The analyser populates `perStudentTaskMetrics` from `perStudentTaskAccums` (one entry per `(classId, studentId, taskKey)` present in the accumulators); when no per-student-task data exists the field may be omitted (optional).
- Existing `perStudent`/`perTask`/`perClass` results are unchanged and Student Averages behaviour is unaffected.
- `AveragingResultSchema` remains a `z.strictObject` (no silent extra keys).

### Required test cases (Red first)

Backend/model Vitest:

1. `dataAnalysis.zod.spec.ts`: `PerStudentTaskMetricSchema` parses a valid metric (criterion scores `0..5` and `'N'`; `classId`/`studentId`/`taskKey` strings) — and **rejects** any extra keys such as `taskId`/`taskTitle` (strict object).
2. `dataAnalysis.zod.spec.ts`: `AveragingResultSchema` treats `perStudentTaskMetrics` as **optional** — a result without it still parses; when present it must be an array of `PerStudentTaskMetricSchema`.
3. `averagingAnalyser.accumulation.spec.ts` (or a new `perStudentTaskMetrics.spec.ts`): given the existing accumulation fixtures, `perStudentTaskAccums` yields exactly one `PerStudentTaskMetric` per `(studentId, taskKey)`, with `classId` echoed from the input class, `taskKey = \`${definitionKey}::${taskId}\``, and `completeness/accuracy/spag/overall`equal to`accumToMetric(accumulator)` for that scope.
4. `averagingAnalyser.spec.ts`: the `AveragingResult` returned by `analyse(...)` now includes `perStudentTaskMetrics` of the expected length and shape, and `perStudent`/`perTask` counts are unchanged from prior baselines.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs.
- Shared-helper planning entries present; planned `buildPerStudentTaskMetrics` entry added to canonical doc with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Add an `@remarks` on `PerStudentTaskMetricSchema` noting `taskKey` omits `assignmentId` in v1 (deferred multi-assignment re-keying) — mirrors `SPEC.md` §Deferrals.

### Implementation notes / deviations / follow-up

- Implemented `PerStudentTaskMetricSchema` (`z.strictObject`, exactly `classId/studentId/taskKey/completeness/accuracy/spag/overall`, no `taskId`/`taskTitle`) and optional `perStudentTaskMetrics` on `AveragingResultSchema` (kept strict). `@remarks` added noting v1 `assignmentId` omission (mirrors `SPEC.md` §Deferrals).
- `buildPerStudentTaskMetrics(classId, perStudentTaskAccums)` added to `averagingAnalyser.accumulation.ts` (now ~456 LOC, under the 500 threshold — no premature extraction). Reuses the existing `accumToMetric` path for every criterion; output deterministically sorted by `studentId` then `taskKey`.
- `analyseClass` populates `perStudentTaskMetrics` from `accumulators.perStudentTaskAccums`; `perStudent`/`perTask`/`perClass` and `AnalysisFilter`/`filterAssignments` untouched (Student Averages unaffected, verified by unchanged counts in `averagingAnalyser.spec.ts`).
- Canonical-doc entry for `buildPerStudentTaskMetrics` recorded in `frontend-shared-helpers-and-abstraction-standards.md` §9.20 (Data analysis accumulator helpers — the correct canonical home for this analyser-domain helper) with status `Not implemented` before implementation, then updated to `Implemented` post-green. Minor deviation from the plan's §9.18 reference, justified because the helper lives in the data-analysis accumulator domain, not the Class page feature folder.
- RED→GREEN verified: 148 `dataAnalysis` Vitest tests pass (including the 7 formerly-failing Section 1 tests); `lint:frontend` clean (0 errors, 0 warnings after extracting the `4.2` magic number in the test); `builder:compile` clean.
- Regression-gate note: combined `regression-checker` run showed `frontend-e2e-check` flip to failing, but `New Failures Count: 0` and an isolated re-run of the full e2e suite returned 212 passed — confirmed infrastructure flake, not a code regression.

---

## Section 2 — Heatmap adapter: `adaptMetricsToHeatmap` and `HeatmapResult`

### Objective

Add a pure adapter that projects `AveragingResult` + `ClassFull` + `assignmentId` into a `HeatmapResult` view model: assignment/class names, the selected assignment's task columns, and per-student rows of per-task metric cells.

### Constraints

> **[Superseded by Section 8 — blocking-bug fix]** Column sourcing for `adaptMetricsToHeatmap` is rewritten by Section 8. The originally-implemented v1 behaviour below (derived `taskColumns` from the embedded `assignment.assignmentDefinition.tasks`, which carries the weight-summary shape and lacks `taskTitle`; hard-coded `taskTitle: null` on every column) is replaced by: sourcing `taskColumns` and `taskTitle` from the warm-up partial located via `getAssignmentDefinitionPartial`, with `TaskTitlesUnavailableError` thrown on a missing partial or `null` title. The acceptance criteria and required test cases below describe the originally-implemented behaviour; **Section 8's "Required test cases (Red first)" and acceptance criteria are authoritative** and supersede items 1, 5, and the `taskTitle: null` assertions below.

- Pure function; no React Query, no `google.script.run`, no side effects.
- Filter `perStudentTaskMetrics` to the selected assignment's `taskKey`s; group by `studentId` into `rows`.
- `assignmentName` from the selected assignment's `assignmentDefinition.primaryTitle` (the assignment is located in `classFull.assignments` by `assignmentId`, mirroring `classPageAdapter.ts:330`); `className` from `classFull.className`, falling back to a static default label when `null` (reuse the `ClassPage.tsx` fallback pattern, e.g. `pageContent.classDetail.heading`, since the view model is reused more widely).
- If `assignmentId` is not found in `classFull.assignments`, throw (fail fast — matches `SPEC.md` "assignment not found" handling). The throw is caught and converted to navigation by `TaskHeatmapPage` (Section 5): it logs via the frontend logger and calls `onBack`, so no in-view error message is shown (per `SPEC.md`/`TASK_HEATMAP_LAYOUT.md`).
- If the assignment has zero tasks, `taskColumns` is empty and `rows[].cells` is empty (zero-tasks variant).
- The adapter's `HeatmapCell` / `HeatmapRow` / `HeatmapResult` match `SPEC.md` §"Heatmap view model" exactly: `HeatmapCell = { completeness, accuracy, spag }`; `HeatmapRow = { studentId, studentName, cells }`; `HeatmapResult = { assignmentId, assignmentName, className, rows, taskColumns }`. `taskId` / `taskTitle` appear **only** on `taskColumns`, never on the cell or row. The `taskKey` → `taskId` split used for `aria-label`s is done at the `TaskHeatmapTable` layer from `taskColumns`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (§"Recommended data contract" `HeatmapResult`/`HeatmapRow`/`HeatmapCell`; §"Adapter projection"; §"Empty state")
- `TASK_HEATMAP_LAYOUT.md` (§"Data flow", §"Empty state")
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` (`ClassFull`, `TaskPartial`)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §9, §13.

Code Reviewer mandatory docs: same set plus `SPEC.md`.

### Shared helper plan

1. Helper: `adaptMetricsToHeatmap` (new)
   - Decision: `new`.
   - Owning module: `services/dataAnalysis/heatmapAdapter.ts` (single-file service; flat under `services/dataAnalysis/` per §13).
   - Call-site rationale: single projection boundary consumed by `TaskHeatmapPage`.
   - Planned doc status: `Not implemented`.
2. Helper: `buildHeatmapTaskColumns` / `buildHeatmapRows` (new, internal helpers in `heatmapAdapter.ts`)
   - Decision: `new` (keep local to adapter module).
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)` returns `HeatmapResult` with `assignmentName`, `className`, `assignmentId`, `taskColumns`, `rows`.
- `taskColumns` length equals the located partial's `tasks` length, in task order; each carries `taskKey`, `taskId`, and `taskTitle` sourced from the warm-up partial (nullable; see Section 8 — the originally-implemented acceptance hard-coded `taskTitle: null`, now superseded by Section 8).
- Each `row` maps one student; `cells` length equals `taskColumns` length and is ordered to match `taskColumns`; each cell carries the matching `PerStudentTaskMetric` criterion `MetricResult`s.
- Students absent from `perStudentTaskMetrics` for this assignment still appear as rows with `notAttempted` cells (`'N'`) (empty-state contract).
- Throws when `assignmentId` is absent from `classFull.assignments`.

### Required test cases (Red first)

Frontend Vitest:

1. `heatmapAdapter.spec.ts`: given an `AveragingResult` with `perStudentTaskMetrics` for three `taskKey`s and a `ClassFull` whose assignment has three `tasks`, the adapter returns three `taskColumns` in task order and one row per student, each with three cells aligned by `taskKey`.
2. `heatmapAdapter.spec.ts`: a student with no submission for the assignment yields a row whose cells are `notAttempted` (`score: 'N'`, `state: 'notAttempted'`).
3. `heatmapAdapter.spec.ts`: an assignment with zero `tasks` yields `taskColumns: []` and rows with empty `cells`.
4. `heatmapAdapter.spec.ts`: an unknown `assignmentId` throws (fail fast).
5. `heatmapAdapter.spec.ts`: `assignmentName`/`className` are taken from `classFull`; `taskTitle` is read from the warm-up partial via `getAssignmentDefinitionPartial` (nullable). **[Superseded by Section 8]** Update the originally-implemented `taskTitle: null` assertion to seed a partial with titles and assert they are reflected; add a case asserting `TaskTitlesUnavailableError` when the partial is missing or a title is `null` (see Section 8).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `adaptMetricsToHeatmap` describing the v1 single-assignment selection (adapter-side `taskKey` derivation) and the multi-assignment deferral note.

### Implementation notes / deviations / follow-up

- Added `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` (single-file service, flat under `services/dataAnalysis/` per AGENTS §13). Exports `HeatmapCell`/`HeatmapRow`/`HeatmapTaskColumn`/`HeatmapResult` interfaces (view-model types, NOT a new Zod boundary — matching SPEC) and `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)`.
- Pure function: no React Query, no `google.script.run`, no side effects. Throws on unknown `assignmentId` (fail fast). `assignmentName` from `primaryTitle`; `className` from `classFull.className ?? 'Class Overview'` (the static default mirrors `pageContent.classDetail.heading` used by `ClassPage.tsx`). **[Superseded by Section 8]** The original v1 implementation derived `taskColumns` from `assignment.assignmentDefinition.tasks` and hard-coded `taskTitle: null`; Section 8 re-sources both from the warm-up partial via `getAssignmentDefinitionPartial` and throws `TaskTitlesUnavailableError` on a missing partial or `null` title.
- **[Superseded by Section 8]** `taskColumns` are now derived from the warm-up partial (via `getAssignmentDefinitionPartial`) in task order; `taskKey = \`${definitionKey}::${taskId}\``, `taskId`, `taskTitle`read from the partial (nullable). Zero tasks →`[]`. `perStudentTaskMetrics`filtered to this assignment's taskKeys (and matching`classId`), grouped by `studentId`; one row per `classFull.students`; missing student–task → shared `notAttempted` cell (`state: 'notAttempted', value: 'N'`).
- Minor review fix: tightened `HeatmapRow.studentName` from `string | null` to `string` to match SPEC exactly (`StudentSummary.name` is non-null).
- Canonical-doc entry for `adaptMetricsToHeatmap` recorded in §9.20 (Not implemented before green, then Implemented).
- RED→GREEN verified: 6 `heatmapAdapter.spec.ts` tests pass; full frontend vitest 1471 passed; `lint:frontend` 0/0; `builder:compile` clean.
- Regression-gate note: combined `regression-checker` again showed `frontend-test-coverage-check` and `frontend-e2e-check` flip to failing, but `New Failures Count: 0`; isolated re-runs confirmed both fully green (vitest 1471 passed, e2e 212 passed) — confirmed infrastructure flake, not a code regression.

---

## Section 3 — Compact `MetricPill` variant

### Objective

Add a compact `MetricPill` variant for dense heatmap cells: 2 decimal places (`precision: 2`), a smaller footprint than `emphasised`, and the same `resolveMetricTone` colouring/aria semantics.

### Constraints

- Do **not** change the existing `emphasised` variant or its callers.
- `compact` and `emphasised` are mutually exclusive render paths; a cell is one or the other.
- Keep the `aria-label`/`role` contract identical to the existing pill (see `MetricPill.tsx`).
- Match ClassPage `MetricPill` rendering conventions (the heatmap uses 2dp, consistent with how ClassPage presents scores).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `TASK_HEATMAP_LAYOUT.md` (§"Cell rendering", compact variant, 2dp)
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §4 (Ant Design check).

Code Reviewer mandatory docs: same set.

### Shared helper plan

1. Helper: `MetricPill` (existing component)
   - Decision: `extend` — add a `variant: 'emphasised' | 'compact'` (or `compact: boolean`) prop. Keep `precision` handling; `compact` implies `precision: 2`.
   - Owning module: `metricDisplay/MetricPill.tsx`.
   - Call-site rationale: heatmap cells need a smaller, 2dp pill distinct from the card `emphasised` pill.
   - Planned doc status: `Not implemented` (extension of existing helper).

### Acceptance criteria

- `MetricPill` accepts `variant="compact"` (or `compact`) and renders the score at 2dp (e.g. `5` → `5.00`).
- Compact pill applies the same `resolveMetricTone` colour band as `emphasised`.
- `MetricPill` itself renders **no** `aria-label`/`role` in v1 (a signed-off accessibility gap, identical to the existing variant); the per-cell `aria-label` is the `TaskHeatmapTable` column's responsibility (see Section 4). `variant="compact"` must not introduce aria that the existing variant lacks.
- Existing `emphasised` callers (RecentAssignmentCard, StudentAveragesTableCard) are visually and behaviourally unchanged.

### Required test cases (Red first)

Frontend Vitest (component):

1. `MetricPill.spec.tsx`: `variant="compact"` renders a numeric score `5` as `5.00`, applies the green band colour, and applies a reduced footprint (smaller font and padding than `emphasised`, per `TASK_HEATMAP_LAYOUT.md` §"Cell rendering").
2. `MetricPill.spec.tsx`: `variant="compact"` with `state: 'notAttempted'` renders `N` (no decimal padding) and the `default` band.
3. `MetricPill.spec.tsx`: `variant="compact"` renders the same resolved-colour `Tag` as `emphasised` for an equivalent score and introduces no `aria-label`/`role` (the cell-level `aria-label` is owned by `TaskHeatmapTable`, not the pill).
4. `MetricPill.spec.tsx`: `emphasised` (default) behaviour is unchanged (regression).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- Added `compact?: boolean` prop to `MetricPill` (chosen form of the plan's "variant='compact' (or compact: boolean)", aligning with the layout spec's concrete `<MetricPill compact={true} />`). When set: `fontSize: '12px'`, `padding: '2px 4px'`; `precision` stays the default `2` (so `5` → `5.00`).
- Extracted a pure `buildPillStyle(muted, emphasised, compact)` helper to keep `MetricPill` function complexity at/under the limit; `emphasised` (17.5px / 600) and `muted` (`opacity: 0.55`) behaviour preserved byte-for-byte; `compact`/`emphasised` are mutually exclusive render paths (`else if`). `resolveMetricTone` unchanged; no `aria-label`/`role` added (v1 signed-off gap preserved).
- `metricTone.ts` untouched; existing `emphasised` callers (RecentAssignmentCard, StudentAveragesTableCard) unaffected.
- RED→GREEN verified: 14 `MetricPill` Vitest tests pass; `lint:frontend` clean (0 errors, 0 warnings); `builder:compile` clean. Stray `MetricPill.orig.tsx` editor backup removed before commit.
- Regression-gate note: combined `regression-checker` confirmed `Regressions Count: 0` / `New Failures Count: 0`; all in-scope frontend checks green. A transient `builder-test-coverage` flip in one concurrent run was a flaky builder suite (no builder code touched) and was green in the confirming run.

---

## Section 4 — `TaskHeatmapTable` (grouped headers, band filters, sorters)

### Objective

Build the presentational `TaskHeatmapTable` from a `HeatmapResult`: 2-row grouped header (Student Name + one top-level column per task spanning Completeness/Accuracy/SPaG), sticky first column, band `filters`/`onFilter`, sorters, horizontal scroll, and per-cell `aria-label`s.

### Constraints

- Student Name is a top-level column with no `children` (spans both header rows automatically); `fixed: 'start'` + explicit `width` (~200).
- Each task column has `children` = Completeness / Accuracy / SPaG, each with `filters: METRIC_COLUMN_FILTERS` (exported from `studentAveragesTableColumns.tsx`) and an `onFilter` comparing `resolveMetricTone(metric).color === String(value)` (reuse the existing pattern, default tone range).
- Sort: Student Name uses `compareHeatmapStudentName` (a `HeatmapRow`-compatible wrapper around `compareStudentNames`, see Section 5); each metric sub-column uses the SPEC-ordered comparator (numeric `value` asc → `notAttempted` → `error` → `studentId` tie-break).
- Band-filter `onFilter` operates over derived `MetricResult` values (UI concern, not data-layer).
- `pagination={false}`, `bordered`, `scroll={{ x: 'max-content' }}`.
- Cell `aria-label`: "[Student Name], [Task ID], [Metric]: [Score]" (v1 uses `taskId`; `taskTitle` is `null`).
- Empty-state: table always renders every student row and every task column; when no submissions exist, cells are `notAttempted` (`'N'`) and a "No submissions yet" caption is shown above the table; zero-tasks variant renders no task columns.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `TASK_HEATMAP_LAYOUT.md` (entire — components, columns, filters, sorters, empty state, aria)
- `SPEC.md` (§"Rendering rules", §"Sorting, filtering", §"Empty state", §"Accessibility")
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx` (`METRIC_COLUMN_FILTERS`, `onFilter` pattern, `compareStudentNames`)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts` (`resolveMetricTone`, `MetricToneColor`)
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx` (compact variant)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §4, §6.1.

Code Reviewer mandatory docs: same set plus `TASK_HEATMAP_LAYOUT.md`.

### Shared helper plan

1. Helper: `METRIC_COLUMN_FILTERS` (existing)
   - Decision: `reuse` — imported (now exported) from `studentAveragesTableColumns.tsx` for heatmap metric sub-columns (same five `MetricToneColor` values/labels). `resolveMetricTone(metric)` is called with the default range (no `DEFAULT_TONE_RANGE` import).
   - Owning module: `features/classPage/studentAveragesTableColumns.tsx`.
2. Helper: `compareHeatmapStudentName` (new, see Section 5)
   - Decision: `new` (keep local to `classPageModel.ts`).
   - Used here as the Student Name `sorter.compare`.
3. Helper: `buildHeatmapTableColumns(heatmapResult)` (new, internal to `TaskHeatmapTable.tsx`)
   - Decision: `new` (keep local to the table component).
   - Planned doc status: `Not implemented`.
4. Helper: SPEC-ordered metric comparator
   - Decision: `reuse` — `classPageModel.ts` defines `METRIC_STATE_RANK_ASC` (computed → `notAttempted` → `error`) and `buildMetricComparator`, but both are currently module-internal and `buildMetricComparator` reads `getStudentMetric(record.metrics, column)` (not applicable to `HeatmapRow`, which has `cells`). The plan **exports `METRIC_STATE_RANK_ASC`** from `classPageModel.ts` and adds a small `HeatmapRow`-typed comparator in `TaskHeatmapTable.tsx` that imports and reuses that rank map (rather than re-declaring a second copy of the state-rank mapping). `classPageModel.ts` LOC rises slightly (see LOC table).
   - Owning module: `features/classPage/classPageModel.ts` (export `METRIC_STATE_RANK_ASC`; reuse) + `features/classPage/TaskHeatmapTable.tsx` (HeatmapRow-typed wrapper).

### Acceptance criteria

- Renders a `Table` with a 2-row grouped header: Student Name (top-level, sticky) and one group per task column with Completeness/Accuracy/SPaG children.
- Each metric sub-column exposes band filters; selecting a band hides rows whose cells for that column are not in the band.
- Student Name sort uses `compareHeatmapStudentName`; metric sub-columns sort by the SPEC-ordered comparator.
- Each cell renders a compact `MetricPill` with the correct band colour and an `aria-label` of the form "[Student Name], [Task ID], [Metric]: [Score]".
- Empty-state: fully rendered roster with `'N'` cells and a "No submissions yet" caption; zero-tasks variant renders no task columns.
- Dependency: the Student Name comparator `compareHeatmapStudentName` is delivered in Section 5 — build Section 5 before wiring the table's Student Name `sorter`.

### Required test cases (Red first)

Frontend Vitest (component, using a `HeatmapResult` fixture):

1. `TaskHeatmapTable.spec.tsx`: renders the grouped header with one group per `taskColumn` and three metric sub-columns each.
2. `TaskHeatmapTable.spec.tsx`: applying the `Green (high)` filter on `Task 1 > Completeness` removes rows whose `Task 1` Completeness band is not `green`.
3. `TaskHeatmapTable.spec.tsx`: Student Name column sorts via `compareHeatmapStudentName` (locale-aware, `studentId` tie-break).
4. `TaskHeatmapTable.spec.tsx`: each metric cell has `aria-label` matching "[Student Name], [Task ID], [Metric]: [Score]".
5. `TaskHeatmapTable.spec.tsx`: empty-state fixture (no submissions) renders all student rows with `notAttempted` cells and the "No submissions yet" caption; zero-tasks fixture renders no task columns.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Note on grouped-header `children` + top-level Student Name column span behaviour (Ant Design v6) to avoid future `rowSpan` confusion (per `SPEC.md` note).

### Implementation notes / deviations / follow-up

- **Section 4 (completed — `TaskHeatmapTable`):**
  - New `TaskHeatmapTable.tsx`: Ant Design `Table<HeatmapRow>`, `rowKey="studentId"`, `pagination={false}`, `bordered`, `scroll={{ x: 'max-content' }}`, `aria-label="Task Heatmap"`. Student Name = sticky top-level column (`fixed:'start'`, `width:200`) with `sorter` via the exported `compareHeatmapStudentName` (`multiple:1`, `defaultSortOrder:'ascend'`); initial ascending order achieved by pre-sorting the `dataSource` with `.toSorted(compareHeatmapStudentName)` because `defaultSortOrder` does not auto-apply the initial sort in the installed Ant Design version (non-mutating copy).
  - Per-task grouped columns from `taskColumns` (title = `taskId`; `taskTitle` is `null` in v1), each with `Completeness`/`Accuracy`/`SPaG` children carrying `METRIC_COLUMN_FILTERS`, a `resolveMetricTone`-based `onFilter` (`color === String(value)`), a SPEC-ordered `sorter` built on the exported `METRIC_STATE_RANK_ASC` (`multiple:2`; computed by value asc → `notAttempted` → `error`, `studentId` tie-break), and a `compact` `MetricPill` wrapped in a `span` whose `aria-label` is exactly `"[Student Name], [Task ID], [Metric]: [Score]"` (`value.toFixed(2)` / `N` / `E`).
  - Empty-state: "No submissions yet" caption above the table only when `taskColumns.length > 0 && rows.length > 0 &&` every cell is `notAttempted` (guard suppresses it for the zero-tasks variant where `taskColumns: []` → only the Student Name column renders).
  - Two production exports added: `METRIC_COLUMN_FILTERS` (from `studentAveragesTableColumns.tsx`) and `METRIC_STATE_RANK_ASC` (from `classPageModel.ts`); both reused by the heatmap table, no second copy of the rank map or predicate.
  - Tests (RED): `TaskHeatmapTable.spec.tsx` — 6 tests (grouped header; Green filter removes non-green rows; Student Name sort via `compareHeatmapStudentName`; per-cell `aria-label` format incl. computed/`notAttempted`/`error`/`Accuracy`; no-submissions caption; zero-tasks variant). All fail before Green for the correct reasons (missing `./TaskHeatmapTable`; unused-import cleaned during Red Review).
  - Green Review: 1 Minor (`multiple: METRIC_COLUMN_FILTERS.length` vs documented `multiple: 2`) returned and fixed to `2`.
  - Regression Gate: PASS (Regressions 0, New Failures 0; pre-existing out-of-scope `backend-lint-check` + `backend-test-coverage-check` failures unchanged).
  - Canonical doc: §9.18.2 (`METRIC_STATE_RANK_ASC` export note), §9.18.12 (`TaskHeatmapTable`) added.

---

## Section 5 — `TaskHeatmapPage`, view-state wiring, and `RecentAssignmentCard` click

### Objective

Create `TaskHeatmapPage` (renders from `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)`) and wire it into `ClassPage` behind a new `overview | heatmap` view-state, entered from a `RecentAssignmentCard` click and exited via a Back button.

### Constraints

- `ClassPage` owns the `selectedView` state (`useState<{ view: 'overview' | 'heatmap'; assignmentId?: string }>`), default `overview`. Setter is `setSelectedView`.
- `ClassPage` already calls `useClassPageData(classId)`; it must destructure `analyserResult` (currently **not** plumbed past `ClassPage`) alongside `surfaceState`, `classFull`, `adapterResult`, `error`, `refetch`. Because `ClassPage` renders `ClassPageContent` (not `TaskHeatmapPage` directly), `ClassPage` must pass `selectedView`, `analyserResult`, `classFull`, `refetch`, `onBack`, and `onOpenHeatmap` as props into `ClassPageContent`. `ClassPageContent` forwards `analyserResult`, `classFull`, `refetch`, and `onBack` into `TaskHeatmapPage`, and forwards `onOpenHeatmap` into `RecentAssignmentsSection` → `RecentAssignmentCard`. `TaskHeatmapPage` must **not** call `useClassPageData` itself — a second hook instance would re-run the analyser, violating the "no new analysis call" contract.
- `ClassPageContent`'s dispatcher currently switches only on `surfaceState.status`; it must additionally render `TaskHeatmapPage` (instead of `ClassPageReady`) when `selectedView.view === 'heatmap'`, still gated on `surfaceState.status === 'ready'`.
- `analyserResult` and `classFull` are typed `AveragingResult | null` / `ClassFull | null` by `useClassPageData`. `ClassPage`/`ClassPageContent` must narrow on `surfaceState.status === 'ready' && selectedView.view === 'heatmap'` before rendering `TaskHeatmapPage`, and `TaskHeatmapPage`'s props are typed `analyserResult: AveragingResult` and `classFull: ClassFull` (non-null). The gate guarantees both are non-null at that point.
- `adaptMetricsToHeatmap` throws on an unknown `assignmentId` (fail fast, Section 2). Because `SPEC.md`/`TASK_HEATMAP_LAYOUT.md` require auto-navigation back to the overview with **no in-view error message**, `TaskHeatmapPage` must wrap the `adaptMetricsToHeatmap` call in a `try`/`catch`: on catch it logs the error through the frontend logger (`src/frontend/src/logging/frontendLogger.ts`, context `'TaskHeatmapPage'`, with `errorMessage`/`stack`) per `docs/developer/frontend/frontend-logging-and-error-handling.md` §3 and §8.5 (explicit mapping, never `console.*`, never silent ignore) and then calls `onBack()` to return to the overview.
- `ClassPage`'s `breadcrumbItems` memo must append a `Task Heatmap` segment when `selectedView.view === 'heatmap'` (the first two segments — root and `Classes` — and the `className` segment already exist).
- Pass `onOpenHeatmap(assignmentId)` down `ClassPageReady` → `RecentAssignmentsSection` → `RecentAssignmentCard`.
- `RecentAssignmentCard` gains an `onOpenHeatmap(assignmentId)` prop and becomes clickable (button/role) — removing the "static card, no click handler" v1 limitation for this card only.
- The heatmap view mounts only when `surfaceState.status === 'ready'` and `selectedView.view === 'heatmap'`.
- `TaskHeatmapPage` header: assignment name (title), class name (secondary), Back button calling `setSelectedView({ view: 'overview' })`. The header is always visible, even during table loading (table loading is covered by the existing surface-state skeleton before `ready`).
- Reuse `refetch` for refresh (no new fetch logic).
- `compareHeatmapStudentName` is added to `classPageModel.ts` as a `HeatmapRow`-compatible wrapper around `compareStudentNames` (do **not** import the `StudentAverageRowModel`-typed `compareStudentNames` directly into the heatmap table — row shapes differ).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (§"Page composition", §"Navigation / breadcrumb", §"Loading state", §"Empty state")
- `TASK_HEATMAP_LAYOUT.md` (§"1. Header region", §"2. Control region", §"Back button", §"Notes")
- `src/frontend/src/features/classPage/ClassPage.tsx`
- `src/frontend/src/features/classPage/ClassPageContent.tsx`
- `src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`
- `src/frontend/src/features/classPage/RecentAssignmentCard.tsx`
- `src/frontend/src/features/classPage/classPageModel.ts` (`compareStudentNames`)
- `src/frontend/src/features/classPage/useClassPageData.ts` (surface-state, `analyserResult`, `classFull`, `refetch`)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §3.1, §3.3 and `docs/developer/frontend/frontend-logging-and-error-handling.md` (for the `adaptMetricsToHeatmap` throw handler).

Code Reviewer mandatory docs: same set plus `TASK_HEATMAP_LAYOUT.md` and `SPEC.md`.

### Shared helper plan

1. Helper: `compareHeatmapStudentName` (new)
   - Decision: `new` (keep local to `classPageModel.ts`; mirrors locale-aware logic of `compareStudentNames`).
   - Owning module: `features/classPage/classPageModel.ts`.
   - Call-site rationale: `HeatmapRow`-typed comparator for the heatmap Student Name column (avoids an unsafe `StudentAverageRowModel` import).
   - Planned doc status: `Not implemented`.
2. Helper: `onOpenHeatmap` prop threading (new)
   - Decision: `new` (prop added to `RecentAssignmentCard`, `RecentAssignmentsSection`, `ClassPageReady`).
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `ClassPage` (via `ClassPageContent`) renders the heatmap view (instead of `ClassPageReady`) when `selectedView.view === 'heatmap'` and `surfaceState.status === 'ready'`.
- Clicking a `RecentAssignmentCard` calls `onOpenHeatmap(assignmentId)` and switches `selectedView` to the heatmap.
- `TaskHeatmapPage` receives `analyserResult: AveragingResult` and `classFull: ClassFull` (non-null, narrowed by the `ready` + `heatmap` gate) plus `refetch` and `onBack` as props (no second `useClassPageData` call); the Back button calls `onBack`.
- `TaskHeatmapPage` renders assignment name + class name + Back button; Back calls `setSelectedView({ view: 'overview' })`.
- `TaskHeatmapPage` renders `TaskHeatmapTable` from `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)`.
- On `adaptMetricsToHeatmap` throwing (unknown `assignmentId`), `TaskHeatmapPage` logs via the frontend logger and calls `onBack` (no in-view error message).
- `ClassPage`'s `breadcrumbItems` appends a `Task Heatmap` segment while in the heatmap view.
- The heatmap view is only reachable in `ready` surface state (no partial-load rendering in v1).
- `compareHeatmapStudentName` exists and is `HeatmapRow`-compatible; the heatmap table uses it (not `compareStudentNames` directly).

### Required test cases (Red first)

Frontend Vitest (component):

1. `RecentAssignmentCard.spec.tsx`: clicking the card invokes `onOpenHeatmap` with its `assignmentId` (regression: existing presentational assertions still pass).
2. `RecentAssignmentsSection.spec.tsx`: passes `onOpenHeatmap` through to each card.
3. `ClassPage.spec.tsx` / `ClassPageContent.spec.tsx`: in `ready` state, clicking a recent assignment card switches the rendered surface to `TaskHeatmapPage`; Back returns to the overview tree.
4. `classPageModel.spec.ts`: `compareHeatmapStudentName` orders two `HeatmapRow`s identically to `compareStudentNames` on the same names, with a `studentId` tie-break, and accepts `HeatmapRow` (not `StudentAverageRowModel`).
5. `TaskHeatmapPage.spec.tsx`: renders header (assignment name, class name, Back) and the table from a `HeatmapResult` fixture; Back calls `onBack`.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `compareHeatmapStudentName` explaining the `HeatmapRow` vs `StudentAverageRowModel` distinction.

### Implementation notes / deviations / follow-up

- **Section 5a (completed — `compareHeatmapStudentName` + `RecentAssignmentCard` click + `RecentAssignmentsSection` prop threading):**
  - `compareHeatmapStudentName(a: HeatmapRow, b: HeatmapRow): number` added and exported from `classPageModel.ts`; delegates to the canonical `compareStudentNames` logic (locale-aware, `sensitivity: 'base'`, `studentId` ascending tie-break) via a type cast. Mirrors `compareStudentNames` semantics exactly without duplicating the body (avoids `sonarjs/no-identical-functions`). `HeatmapRow` import is type-only.
  - `RecentAssignmentCard` gained optional `onOpenHeatmap?: (assignmentId: string) => void`. When provided, the card root becomes an activatable button (`role="button"`, `tabIndex={0}`, `cursor: 'pointer'`, mouse click + Enter/Space activation); when absent it remains a static display card (backward compatible). Stale header JSDoc updated; redundant defensive guard removed.
  - `RecentAssignmentsSection` gained optional `onOpenHeatmap?: (assignmentId: string) => void` and forwards it to every `RecentAssignmentCard`.
  - Tests (RED): 6 new spec tests added across `classPageModel.spec.ts` (`compareHeatmapStudentName` — ordering, `studentId` tie-break, case-insensitivity), `RecentAssignmentCard.spec.tsx` (click → `onOpenHeatmap(assignmentId)`), and `RecentAssignmentsSection.spec.tsx` (per-card forwarding across 2 cards). All fail before Green for the correct reasons.
  - Green Review: 2 Minor items (stale header `@remarks`; redundant defensive guard) returned and fixed.
  - Regression Gate: PASS (Regressions 0, New Failures 0; pre-existing out-of-scope `backend-lint-check` + `backend-test-coverage-check` failures unchanged).
  - Canonical doc: §9.18.7 (`RecentAssignmentCard`) interactivity note updated, §9.18.8 (`RecentAssignmentsSection`) onOpenHeatmap note added, §9.18.11 (`compareHeatmapStudentName`) added.
- **Section 5b (completed — `TaskHeatmapPage` + `ClassPage` view-state wiring):**
  - New `TaskHeatmapPage.tsx`: `adaptMetricsToHeatmap` computed exactly once via a `useState` lazy initializer; on throw it logs via `logFrontendError('TaskHeatmapPage', error)` inside a `useEffect` and then calls `onBack()` (auto-navigate back, NO in-view `Alert`). On success renders the three `Card`s — header (`Typography.Title` assignment name + back `Button` `aria-label="Back to Class overview"` + secondary class name), control (refresh `Button` → `refetch`), and the table `Card` (`TaskHeatmapTable`). Does NOT call `useClassPageData` (reuses the passed `analyserResult`).
  - `ClassPageContent` gained `analyserResult`, `classFull`, `selectedView`, `onOpenHeatmap`, `onBack`, `refetch` props. In the `ready` case, when `selectedView.view === 'heatmap' && selectedView.assignmentId !== undefined && analyserResult && classFull`, it renders `TaskHeatmapPage` (non-null props); otherwise the overview tree forwards `onOpenHeatmap` → `RecentAssignmentsSection` → `RecentAssignmentCard`.
  - `ClassPage` owns `selectedView` state (default `overview`), destructures `analyserResult` from the single `useClassPageData` (no second analysis), wires `handleOpenHeatmap`/`handleBack`, and appends a `Task Heatmap` breadcrumb segment when in the heatmap view.
  - Tests (RED): `ClassPageHeatmapView.spec.tsx` — 3 integration tests (card click opens heatmap; Back returns to overview; unknown `assignmentId` auto-navigates back via `logFrontendError` + `onBack`, no in-view error). All fail before Green for the correct reasons. `ClassPageContent.spec.tsx` updated to supply the six new required props (no logic change).
  - Green Review: 2 Minor items (removed `?? ''` default on `assignmentId` per core principle #7; removed a stray/duplicate JSDoc block) returned and fixed.
  - Regression Gate: PASS (Regressions 0, New Failures 0; all in-scope frontend/CI checks green; pre-existing out-of-scope `backend-lint-check` + `backend-test-coverage-check` failures unchanged).
  - Canonical doc: §9.18.4 (`ClassPage` selectedView + breadcrumb), §9.18.5 (`ClassPageContent` heatmap branch), §9.18.13 (`TaskHeatmapPage`) added. (Note: `METRIC_STATE_RANK_ASC` was already exported in Section 4.)

---

## Section 6 — Playwright E2E: full user journey (uses `anon-test-data.json`)

### Objective

Cover the complete, user-visible heatmap journey in a real browser: navigate to the class, open the heatmap from a recent assignment card, verify grouped header + colour-coded cells, exercise band filtering and sorting, and return to the overview. Also cover loading and the "no submissions / zero tasks" variants.

### Constraints

- E2E tests live in `src/frontend/e2e-tests/**/*.spec.ts`; runtime mocks via `installRuntimeMock(page, scenario)` **before** `page.goto`.
- Analysis is a pure frontend function — the E2E mocks the **ClassPage data pipeline**, not analysis. `createHeatmapScenario` must mirror `createClassesScenario` and return a `RuntimeScenario` containing: `getAuthorisationStatus`, `getABClassPartials`, `getCohorts`, `getYearGroups`, `getAssignmentTopics`, `getAssignmentDefinitionPartials` (the warm-up `usePageDataset('assignmentDefinitionPartials')` must be satisfied or the surface never reaches `ready`), **plus** `getABClass` (two identical success entries for React 19 StrictMode double-effect). No analysis mock is needed.
- Build the `ClassFull` fixture from `tests/__mocks__/data/anon-test-data.json` (Assumption 3/4): map the single class, its 33 students, the assignment, and submission scores; **derive** `assignmentDefinition.tasks` as `[{ taskId: 'task_001', taskWeighting: 1, taskTitle: 'Task 1' }, { taskId: 'task_002', taskWeighting: 1, taskTitle: 'Task 2' }, { taskId: 'task_003', taskWeighting: 1, taskTitle: 'Task 3' }]` from submission item keys (post-§7 task shape uses `taskId`, and `taskTitle` keeps the fixture valid if the embedded definition is fully validated). **Note:** these embedded `tasks` are NOT the heatmap column source (that is the warm-up `assignmentDefinitionPartials`, per §8); they exist only so the `ClassFull` is well-formed. The column source must be seeded on the warm-up partial for the assignment's `definitionKey` (Assumption 3).
- StrictMode double-effect: every `getABClass` queue needs **two** identical success entries.
- Use `applyColumnFilterOption(page, columnHeaderName, optionLabel)` from `endToEndRuntimeMocks.ts` for band filters; use role-based locators; never `waitForTimeout`.
- Deduplicate fixture code via a new E2E helper module `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` that owns `buildHeatmapClassFull()` and `createHeatmapScenario()`.

### Delegation mandatory reads

Playwright mandatory docs:

- `docs/developer/frontend/frontend-playwright-e2e.md` (entire — runtime mocks, StrictMode rule, antd interaction patterns, anti-patterns)
- `SPEC.md` (§"Page composition", §"Empty state", §"Accessibility")
- `TASK_HEATMAP_LAYOUT.md` (entire)
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` (scenario factory pattern to mirror)
- `tests/__mocks__/data/anon-test-data.json` (fixture source)

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §8, §13.

Code Reviewer mandatory docs: same set plus `SPEC.md`/`TASK_HEATMAP_LAYOUT.md`.

### Shared helper plan

1. Helper: `buildHeatmapClassFull()` (new, test-only)
   - Decision: `new` (test fixture builder).
   - Owning module: `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` (imports `anon-test-data.json`; matches the `classes-page-end-to-end-helpers.ts` pattern).
   - Call-site rationale: single source of the `ClassFull` journey fixture derived from the shared mock.
   - Planned doc status: `Not implemented` (test-only; no production canonical-doc entry).
2. Helper: `createHeatmapScenario(classFull)` (new, test-only)
   - Decision: `new` — wraps auth + reference-data + `getABClass` (×2) into a `RuntimeScenario`.
   - Owning module: `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`.
3. Helper: `METRIC_COLUMN_FILTERS` (existing, production)
   - Decision: `reuse` — filter labels `Red (low)`/`Amber (mid)`/`Green (high)`/`Not Attempted`/`Error` drive the E2E band-filter steps.

### Acceptance criteria

- **Full journey:** From Classes, open the class; in `ready` state the recent-assignment card "4. Presenting our Findings - Video Plan" is visible; clicking it shows `TaskHeatmapPage` with a grouped header (Student Name + Task 1/2/3, each Completeness/Accuracy/SPaG) and colour-coded cells (compact `MetricPill`) with correct `aria-label`s.
- **Band filter:** filtering `Task 1 > Completeness` by `Green (high)` hides rows whose Task 1 Completeness is not green (e.g. Student One `N` and Student Ten `0` disappear; high-scorers remain).
- **Sort:** clicking Student Name reorders rows via `compareHeatmapStudentName`.
- **Back:** the Back button returns to the overview (`ClassPageReady` tree).
- **Loading:** a `deferredSuccess` `getABClass` shows the shape-matched skeleton, then the heatmap becomes interactive after release.
- **Empty / zero-tasks variants:** a fixture with zero submissions renders the full roster with `N` cells + "No submissions yet" caption; a fixture with zero tasks renders no task columns.

### Required test cases (Red first)

Frontend E2E (Playwright):

1. `e2e-tests/task-heatmap.spec.ts` — "opens heatmap from recent assignment card": installs `createHeatmapScenario(buildHeatmapClassFull())`, navigates to the class, clicks the card, asserts `TaskHeatmapPage` header (assignment name, class name), grouped header, and that Student Two's Task 1 Completeness cell shows the green band and `aria-label` "Student Two, task_001, Completeness: 5".
2. `e2e-tests/task-heatmap.spec.ts` — "band filter hides non-matching rows": on the heatmap, apply `Green (high)` to the first task's Completeness column; assert Student One (`N`) and Student Ten (`0`) are absent from the visible rows while a green-band student remains.
3. `e2e-tests/task-heatmap.spec.ts` — "student name sort": click Student Name header; assert rows are ordered via `compareHeatmapStudentName`.
4. `e2e-tests/task-heatmap.spec.ts` — "back returns to overview": from the heatmap, click Back; assert the overview `ClassPageReady` content (Recent Assignments + Student Averages) is visible again.
5. `e2e-tests/task-heatmap.spec.ts` — "loading skeleton then ready": use a `deferredSuccess` `getABClass`; assert skeleton (`role="status"`) then heatmap table after `releaseNextDeferredSuccess`.
6. `e2e-tests/task-heatmap.spec.ts` — empty-state variants: (a) **no submissions** — derive `tasks` from the base anon fixture (Assumption 3), then strip submissions; assert the full roster renders with `N` cells + the "No submissions yet" caption (tasks remain present, so this is distinct from the zero-tasks variant). (b) **zero tasks** — derive `tasks: []`; assert no task columns render.
   - The `assignment not found` path is intentionally **not** covered by E2E: `SPEC.md`/`TASK_HEATMAP_LAYOUT.md` mark it effectively unreachable in v1 (the `assignmentId` always originates from a validated clicked card).

### Section checks

- `npm run test:frontend:e2e -- e2e-tests/task-heatmap.spec.ts`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None (test-only section).

### Implementation notes / deviations / follow-up

- If Vite `server.fs.allow` blocks the cross-root `anon-test-data.json` import, co-locate a typed `ClassFull` literal seeded from the same data and record the deviation here.
- (other notes filled during implementation)

---

## Regression and contract hardening

### Objective

Verify the heatmap feature against existing suites and lint, and confirm Student Averages / ClassPage behaviour is unaffected.

### Constraints

- Prefer focused test runs before broader validation.
- No production contract changes beyond those specified above.

### Acceptance criteria

- All new Vitest suites pass.
- The new E2E suite passes.
- `npm run lint:frontend` is clean.
- Existing `studentAverages*` and `classPage*` suites still pass (no behavioural regression).
- `AveragingResultSchema` strict-object invariant holds (no leaked keys).

### Required test cases/checks

1. `npm run test:frontend -- src/frontend/src/services/dataAnalysis`
2. `npm run test:frontend -- src/frontend/src/features/classPage`
3. `npm run test:frontend:e2e -- e2e-tests/task-heatmap.spec.ts`
4. `npm run lint:frontend`
5. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- Run the commands above and ensure green results.

### Implementation notes / deviations / follow-up

- (filled during implementation)

---

## Documentation and rollout notes

### Objective

Update docs to match the implemented feature and highlight caveats (multi-assignment deferral, `tasks: null` fixture derivation, compact `MetricPill`).

### Constraints

- Only modify documents relevant to the touched areas.
- British English.

### Acceptance criteria

- `SPEC.md` and `TASK_HEATMAP_LAYOUT.md` remain the canonical feature docs; any implementation deviation is recorded in this `ACTION_PLAN.md` "Implementation notes" sections.
- `frontend-shared-helpers-and-abstraction-standards.md` is updated to mark the planned `buildPerStudentTaskMetrics`, `adaptMetricsToHeatmap`, `compareHeatmapStudentName`, and compact `MetricPill` entries as implemented (or kept `Not implemented` if deferred).
- The `tasks: null` → derived `tasks` E2E fixture note is captured so future fixture authors know why the anon mock needs augmentation.

### Required checks

1. Verify docs mention the data-source/projection strategy.
2. Verify the multi-assignment deferral is documented as a known limitation.
3. Confirm mandatory-read evidence is complete for delegated docs/review handoffs.
4. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Confirm the `@remarks` planned in Sections 1, 2, and 5 are present in code before this plan is retired.

### Implementation notes / deviations / follow-up

- (filled during implementation)

### BLOCKING BUG — Task Heatmap renders unusable column headers on live data

**Symptom:** the heatmap renders task columns whose headers fall back to `taskId` (no human-readable title) on live data — and on assignments with zero tasks, only the sticky Student Name column renders.

**Root cause (verified against live code):**

1. `adaptMetricsToHeatmap` (`heatmapAdapter.ts:73–79`) builds `taskColumns` solely from `classFull.assignments[].assignmentDefinition.tasks`. `classFull.assignments[].assignmentDefinition` is typed `AssignmentDefinitionPartialSchema` (`classDetailService.zod.ts:126`), so the embedded `tasks` IS the `TaskPartial[]` shape — the same shape as the warm-up partials.
2. `AssignmentDefinition.toPartialJSON()` (`Models/AssignmentDefinition.js:347–353`) emits `tasks: []` for zero-task assignments, or `tasks: [{ id, taskWeighting }]` for with-task assignments — NOT `null`. (The earlier draft's "tasks is null/empty" wording was inaccurate; the live emitter produces a weight-only summary array.)
3. The summary shape lacks `taskTitle`. The adapter (line 77) hardcodes `taskTitle: null` for every column, so the table header always falls back to the bare `taskId`. The defect is therefore "column headers are missing human-readable titles" rather than "no columns render at all" — for with-task assignments the columns DO render with weight-summary data; for zero-task assignments the columns are absent (the genuine "no columns" case).
4. The earlier draft's "the embedded definition is empty in live data" framing was wrong: it conflated the two defect classes. The actual blocker for a usable heatmap is the missing title (always `null` from the embedded summary), and the actual blocker for column-count fidelity on zero-task assignments is the `[]` emission.

**Resolution:** Sections 7 and 8 below. Section 7 adds `taskTitle` to the partial task shape (renaming `id` → `taskId` for shape consistency with `AssignmentDefinitionTaskSchema`), and introduces the `getAssignmentDefinitionPartial(partials, definitionKey)` helper. Section 8 sources both the column set and the human-readable `taskTitle` from the warm-up partial (via that helper), creates `TaskTitlesUnavailableError`, and handles the missing-title / zero-tasks edge cases distinctly. On valid live data (with-tasks assignments whose partial includes titles), the heatmap now renders usable column headers; on zero-task assignments, `taskColumns: []` renders no task columns (the intended empty state); on missing partial or `null` title, `TaskTitlesUnavailableError` renders an in-view `Alert`.

---

## Suggested implementation order

> **Tree-green staging:** Sections 7 and 8 are split across two atomic commits so the tree never breaks between them (see §7 §"Plan" §"Tree-green staging note"):
>
> - **Commit 7a** — Section 7 Steps 1a + 2a (additive: add nullable `taskTitle` to `TaskPartialSchema` + add `taskTitle` to `toPartialJSON()` emission) — tree stays green.
> - **Commit 7b+§8** — Section 7 Steps 1b, 2b, 3 + Step 4 (optional) + Section 8 (adapter rewrite + analyser consumer-side rename + prop-thread + `TaskTitlesUnavailableError` + ready-gate widener + Alert handling) — single paired commit, tree stays green at its boundaries.
> - The `validatePartialRow_` test reconciliation (Section 7 Step 5) lands in 7a (recommended) or 7b+§8 (acceptable).
>
> 1. Section 1 — `perStudentTaskMetrics` on `AveragingResult` (foundation; unblocks adapter).
> 2. Section 3 — compact `MetricPill` (independent; needed by the table).
> 3. Section 2 — `adaptMetricsToHeatmap` adapter (depends on Section 1).
> 4. Section 5 — `compareHeatmapStudentName` + `RecentAssignmentCard` click + view-state (independent of Sections 2/3/4 except sharing the `HeatmapRow` type shape; `compareHeatmapStudentName` does not depend on `MetricPill`).
> 5. Section 4 — `TaskHeatmapTable` (depends on Sections 2, 3, 5 comparator).
> 6. Section 5 (cont.) — `TaskHeatmapPage` composition (depends on Sections 2, 4).
> 7. **Commit 7a** — Section 7 Steps 1a + 2a + (recommended) Step 5 (additive `taskTitle` on schema + backend + stale-guard test reconciliation; tree stays green; no production consumer reads `taskTitle` yet).
> 8. **Commit 7b+§8** (single paired commit) — Section 7 Steps 1b + 2b + 3 (+ Step 4 if not landed in 7a) AND Section 8 in full (adapter required 4th parameter; column-source shift; analyser `task.id` rename; prop-thread through `ClassPage` / `ClassPageContent` / `TaskHeatmapPage`; `TaskTitlesUnavailableError`; in-view `Alert` handling with header Card visible; ready-gate widener on `ClassPageContent`; canonical-doc entries). Tree stays green at both commit boundaries.
> 9. Section 6 — E2E full journey (depends on all UI sections, now including Sections 7–8).
> 10. Regression and contract hardening.
> 11. Documentation and rollout notes.

---

## Section 7 — TaskPartial → `taskId` consistency + `taskTitle` on partial + `assignmentDefinitionUtilities`

### Problem

The two task shapes disagree on the identifier field name:

- `TaskPartialSchema` (`taskPartial.zod.ts:15`): uses `id`
- `AssignmentDefinitionTask` (`assignmentDefinition.zod.ts`): uses `taskId`

The `taskId` convention dominates the codebase (`taskKey = '${definitionKey}::${taskId}'`, plus `TaskDefinition.toJSON()` already emits `taskId` and `taskTitle` at `Models/TaskDefinition.js:82,144–149`), so `TaskPartial` must be renamed for consistency. Additionally, `AssignmentDefinitionPartial.tasks` currently lacks `taskTitle`, which is needed for human-readable heatmap column headers.

### Plan

> **Tree-green staging note:** Section 7 is split into two atomic commits so the tree never breaks between Section 7 and Section 8:
>
> - **Commit 7a — Step 1a + Step 2a (additive only):** add the nullable `taskTitle` field to `TaskPartialSchema` and the matching `taskTitle` emission in `toPartialJSON()`. These are purely additive — `z.strictObject` accepts a new nullable field without rejecting any current data, and the backend emitter (`Step 2a`) starts emitting `taskTitle` on every served definition (`TaskDefinition` requires it in its constructor at `Models/TaskDefinition.js:29`, so there is no `null`-emitting edge case at the source). No production consumer reads `taskTitle` yet, so the analyser, adapter, and all existing tests remain green. The frontend `AssignmentDefinitionPartialSchema` already requires `tasks: Array<TaskPartial>` (line 210); adding `taskTitle` as a known-nullable field keeps `z.strictObject` accepting every payload it accepted before, plus the new `taskTitle` field after Step 2a emits it.
> - **Commit 7b+§8 — Step 1b + Step 2b + Section 8:** the `id` → `taskId` rename (Step 1b), the matching `{ id } → { taskId }` emission in `toPartialJSON()` (Step 2b), every catch-up find-replace from Step 3, the new `assignmentDefinitionUtilities.ts` (Step 4), and the full Section 8 adapter rewrite happen **in one commit**, so the only commit that breaks existing `task.id` references is the same commit that fixes `heatmapAdapter.ts`, the analyser source code, and every `TaskPartial`-shaped test fixture in lock-step. The tree compiles and the full test suite stays green at both commit 7a and commit 7b+§8; there is no intermediate commit where `task.id` references no longer type-check.
> - `validatePartialRow_` test reconciliation (Step 5) may land in either 7a or 7b+§8; recommended 7a so the backend guard tests match the additive `taskTitle` emission immediately (the guard currently rejects any non-null `tasks`, which already disagrees with the live `toPartialJSON()` emitter, so fixing it earlier is safe).
>
> See §"Suggested implementation order" for the precise sequence including Sections 1–6.

#### 1a. `TaskPartialSchema` — add nullable `taskTitle` (additive, no rename)

**File:** `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`

```ts
// Before
const TaskPartialSchema = z.strictObject({
  id: z.string().min(1),
  taskWeighting: z.number(),
});

// After (step 1a — additive only)
const TaskPartialSchema = z.strictObject({
  id: z.string().min(1),
  taskWeighting: z.number(),
  taskTitle: z.string().nullable(),
});
```

- `taskTitle` is `nullable` so legacy/missing titles are representable and reach the `TaskTitlesUnavailableError` path (see Section 8); the backend `toPartialJSON()` always emits it for current data (Step 2a below).
- `AssignmentDefinitionPartialTasksSchema` is `z.array(TaskPartialSchema)` (`assignmentDefinitionPartials.zod.ts:172`), so this propagates to the partial task list automatically.
- The `taskPartial.zod.spec.ts` "rejects extra fields (strict schema)" test at line 24 currently uses `taskTitle` as its bogus extra field — that case must be UPDATED in 7a so `taskTitle` is treated as a known accepted field; use a different bogus extra field (e.g. `extra`) for the strict-object rejection assertion.

#### 1b. `TaskPartialSchema` — rename `id` → `taskId` (paired with Section 8)

**File:** `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`

```ts
// After step 1b (paired with Section 8 — destructive rename in the same commit)
const TaskPartialSchema = z.strictObject({
  taskId: z.string().min(1),
  taskWeighting: z.number(),
  taskTitle: z.string().nullable(),
});
```

- This rename is the load-bearing, tree-breaking change in Section 7. It MUST land in the same commit as Step 3 (catch-up find-replace) and Section 8 (adapter rewrite + analyser `task.id` access rename), because the rename invalidates every `task.id` consumer enumerated in Step 3.
- The `taskPartial.zod.spec.ts` assertions pinning `{ id: 't_abc123', taskWeighting: 2, taskTitle: null }` are updated in this commit to pin `{ taskId: 't_abc123', taskWeighting: 2, taskTitle: null }`.

#### 2a. Backend `AssignmentDefinition.toPartialJSON()` — emit `taskTitle` (additive, no rename)

**File:** `src/backend/Models/AssignmentDefinition.js`

In `toPartialJSON()`, add `taskTitle` to the existing map (no `id` rename yet — that's 2b):

```ts
// After step 2a
Object.values(this.tasks).map((task) => ({
  id: task.id,
  taskWeighting: task.taskWeighting,
  taskTitle: task.taskTitle,
}));
```

- `TaskDefinition` already exposes `this.taskTitle` (`Models/TaskDefinition.js:30`), so this is a one-line addition. No `null` fallback needed at the emitter; `TaskDefinition` requires `taskTitle` in its constructor (`Models/TaskDefinition.js:29`).
- Update the stale `'tasks must be null in partial transport.'` assertion at `tests/backend-api/assignmentDefinitionPartials.unit.test.js:2036` to accept the now-populated `tasks` array (with the new `taskTitle` field) — see Step 5.

#### 2b. Backend `AssignmentDefinition.toPartialJSON()` — rename `id` → `taskId` (paired with Section 8)

**File:** `src/backend/Models/AssignmentDefinition.js`

In `toPartialJSON()`, change each mapped task from `{ id, taskWeighting, taskTitle }` (post-2a) to `{ taskId: task.id, taskWeighting, taskTitle: task.taskTitle }`:

```ts
// After step 2b (paired with Section 8)
Object.values(this.tasks).map((task) => ({
  taskId: task.id,
  taskWeighting: task.taskWeighting,
  taskTitle: task.taskTitle,
}));
```

- This rename lands in the same commit as 1b, Step 3, and Section 8 so the live wire and the frontend `TaskPartialSchema` shift together.
- The backend test asserting the `toPartialJSON()` emission shape must assert `{ taskId, taskWeighting, taskTitle }` (the load-bearing test from Step 5).

#### 3. Catch-up find-replace for `TaskPartial.id` references (load-bearing)

> **Staging:** this step lands in commit 7b+§8 (paired with Step 1b's rename and Section 8's adapter rewrite), so the only commit that breaks `task.id` references is the same commit that fixes every one of them.

This step is the load-bearing change in Section 7, NOT a cosmetic rename. After Step 1 renames `TaskPartialSchema.id` → `taskId` (a `z.strictObject`), every consumer of `TaskPartial`-shaped data must be updated in the same commit so the tree stays green. Below is the explicit enumeration (verified at planning time) of every `task.id` access in frontend source.

**Important contract invariant:** `taskKey` derivation (`${definitionKey}::${taskId}`) is **unchanged** by this step. Only the property access name on the source object shifts from `task.id` to `task.taskId`; the emitted `taskKey` string format is identical, so per-student-task accumulator keys, `PerStudentTaskMetric.taskKey`, and Section 1's accumulator-output tests all keep passing unchanged. The emitted `taskId` field on `PerTaskRow` is also unchanged (still `taskId`; the source property just moves).

**Also relevant:** `ClassFull.assignments[].assignmentDefinition` is typed `AssignmentDefinitionPartialSchema` (`classDetailService.zod.ts:126`), meaning the embedded assignment definition and the warm-up `assignmentDefinitionPartials` BOTH use the `TaskPartial[]` shape. The rename therefore affects both the embedded-assignment path and the warm-up path simultaneously — there is no "only the warm-up path" here.

Production code (must rename before tree compiles):

- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:77,83` — `preRegisterTasks` parameter is typed `ReadonlyArray<{ id: string }>`. Tighten to `ReadonlyArray<TaskPartial>` (preferred) or `ReadonlyArray<{ taskId: string }>` so the rename is type-driven.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:88` — `const taskKey = \`${definitionKey}::${task.id}\`;`→`task.taskId`. `taskKey` format unchanged.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:92` — `taskId: task.id` → `task.taskId`.
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:75–76` — `buildTaskColumns` reads `task.id` twice. Note: Section 8 re-sources this from the warm-up partial and rewrites this function in full; the rename here is required purely so the file compiles between Sections 7 and 8.

Test fixtures and specs (must rename before specs re-parse):

- `src/frontend/src/test/dataAnalysis/fixtures.ts:147–151` — `createTaskPartial(id, …)` returns `{ id, taskWeighting }`. Rename the parameter `id` → `taskId` (parameter rename optional but recommended for clarity) and the returned object key `id` → `taskId`. Add `taskTitle?: string | null` as an optional third argument defaulting to `null` so existing call sites do not need to be touched (this keeps the fixture useful for both the pre-Section-8 heatmap tests, which still hardcode `null`, and the post-Section-8 tests, which will pass titles).
- `src/frontend/src/test/dataAnalysis/fixtures.ts:149,168,176` — update the `createDefinitionPartial` `tasks` override type from `Array<{ id: string; taskWeighting: number }>` to `Array<{ taskId: string; taskWeighting: number; taskTitle?: string | null }>`.
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.spec.ts:16–50` — five assertions pinning `{ id: 't_abc123', taskWeighting: 2 }` and rejects-`taskTitle` cases. Update to pin `{ taskId, taskWeighting, taskTitle: null }` (acceptsNullable), and flip the "rejects extra `taskTitle`" test to "accepts nullable `taskTitle`".
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts:3` — `TaskPartialFixture` type uses `{ id: string; taskWeighting: number }`; rename.
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts:413,418` — `tasks: [{ id: 't_abc123', taskWeighting: 2 }]` and the matching `toEqual` assertion.
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts:459` — the "rejects extra fields" case at line 459 uses `taskTitle` as the extra field;flip it to assert `taskTitle` is now an accepted (nullable) field, and use a different bogus extra field (e.g. `extra`) for the strict-object rejection test.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts` and `averagingAnalyser.filters.spec.ts` — every `createTaskPartial('t_001', …)` call site. No signature change required if `createTaskPartial` keeps its 2-arg shape; only the returned object key changes (consumed via `task.id` in production, never by the tests directly), so these specs do not need edits beyond what production-code rename already covers. Re-run them in §7 section checks to confirm.

Verify with `npm run lint:frontend && npm run typecheck` — a clean run is impossible while any unrenamed `task.id` reference remains, because the schema is a `z.strictObject` and TypeScript will reject the missing `id` property.

#### 4. `assignmentDefinitionUtilities.ts` — pure `getAssignmentDefinitionPartial` helper

> **Staging:** the new module can land in either commit 7a or 7b+§8 — it has no callers until §8. Recommended 7b+§8 so the helper and its only consumer (the adapter) land together; alternatively land in 7a as a self-contained utility and add §8 as its first consumer.

**File:** `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` (new)

> **Naming note:** the file is named `assignmentDefinitionUtilities.ts` (not `…Utils.ts`) because the frontend `unicorn/prevent-abbreviations` rule (severity `warn`) is enforced under `--max-warnings 0` by `lint:frontend:check`, so the abbreviated `Utils` form would fail the commit gate. No eslint override is introduced.

```ts
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from './assignmentDefinitionPartials.zod';

export function getAssignmentDefinitionPartial(
  partials: AssignmentDefinitionPartialsResponse,
  definitionKey: string
): AssignmentDefinitionPartial | null {
  return partials.find((p) => p.definitionKey === definitionKey) ?? null;
}
```

- This module is a pure utility; no wrapper class. It is the single seam through which the heatmap adapter locates a warm-up partial by `definitionKey` — keeping all `assignmentDefinitionPartials` dataset navigation in the `assignmentDefinition` module.
- The per-task `taskTitle` is read directly off the returned partial's `tasks` entries by the caller (no separate title-lookup helper is needed — that would be a redundant wrapper).
- Returns `null` when no partial matches the `definitionKey`; the calling adapter turns this into `TaskTitlesUnavailableError` (see Section 8).

#### 5. Stale `validatePartialRow_` test-only guard (test reconciliation, not a live constraint)

**File:** `src/backend/z_Api/assignmentDefinitionValidation.js`

Codebase verification note: at planning time, `validatePartialRow_` (line 669) is **defined and exported but never invoked from production backend code**. `getAssignmentDefinitionPartials_` (`assignmentDefinitionTransport.js:113–121`) validates only that the controller response is an array; it does not call `validatePartialRow_`. The guard is exercised solely from `tests/backend-api/assignmentDefinitionPartials.unit.test.js` (see the `describe('validatePartialRow_', …)` block at line 1905 and the `expectedError: 'tasks must be null in partial transport.'` assertion at line 2036).

Furthermore, the live `AssignmentDefinition.toPartialJSON()` (`Models/AssignmentDefinition.js:347–353`) **already** emits `tasks: []` (zero-task case) or `tasks: [{ id, taskWeighting }]` (with-task case) — not `null`. The frontend `AssignmentDefinitionPartialSchema` (`assignmentDefinitionPartials.zod.ts:210`) already requires `tasks: Array<TaskPartial>`. The model output and the wire acceptance therefore already disagree with the stale test-only guard; the guard has been stale and dead since the partial-tasks shape introduced in a prior round.

Action: this step is **test reconciliation, not a live constraint lift**. TDD:

1. Update `tests/backend-api/assignmentDefinitionPartials.unit.test.js` so the `validatePartialRow_` block mirrors the live `toPartialJSON()` behaviour: it must now accept `tasks: []`, accept `tasks: [{ taskId, taskWeighting, taskTitle }]`, and reject the deprecated `{ id, … }` shape (the inverse of the prior assertion).
2. Update the `'tasks must be null in partial transport.'` asserted-error test to instead assert the new reasons the guard rejects (e.g. `'tasks must be an array in partial transport.'` if any non-array value is passed), OR mark this thrown-error case as removed-by-design. Recommended: replace the guard body entirely with `if (!Array.isArray(row.tasks)) throw …` so the guard still fails loudly on a malformed (non-array) `tasks` value, but accepts the live `[]` / `[{ taskId, … }]` shape.
3. Add a backend test asserting `toPartialJSON()` now emits `{ taskId: task.id, taskWeighting, taskTitle: task.taskTitle }` per task (this is the load-bearing test for Step 2's backend change).

Backend test delegation note: backend test work is delegated per `src/backend/AGENTS.md` §10 (`Testing Specialist` for backend tests when sub-agent delegation is available).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md` §9 (Zod-strictObject + `z.infer` convention; `* .zod.ts` co-location)
- `src/backend/AGENTS.md` §1.2 (transport-vs-domain validation ownership), §2.1 (Node test compatibility boundary — guarded `module.exports`), §10 (backend test delegation)
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` and `taskPartial.zod.spec.ts`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` and `assignmentDefinitionPartials.zod.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` (lines 77–92 — `preRegisterTasks` signature + read sites)
- `src/frontend/src/test/dataAnalysis/fixtures.ts` (`createTaskPartial`, `createDefinitionPartial`)
- `src/backend/Models/AssignmentDefinition.js` (lines 333–357 — `toPartialJSON`)
- `src/backend/z_Api/assignmentDefinitionValidation.js` (lines 669–680 — `validatePartialRow_`)
- `src/backend/z_Api/assignmentDefinitionTransport.js` (lines 92–121 — `toTransportPartialRow_` and `getAssignmentDefinitionPartials_`, to confirm the guard is not invoked in production)
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js` (lines 1905, 2036 — the test-only guard assertions being reconciled)
- `docs/developer/backend/backend-testing.md` (backend test conventions)
- `docs/developer/frontend/frontend-testing.md` (frontend Zod test conventions)

Implementation mandatory docs: same set, plus `src/frontend/AGENTS.md` §2 (export functions as functions, not arrow-const assignments — applies if a helper export is needed) and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (shared-helper gate).

Code Reviewer mandatory docs: same set plus `SPEC.md` and `TASK_HEATMAP_LAYOUT.md`.

### Shared helper plan

1. Helper: `getAssignmentDefinitionPartial` (new)
   - Decision: `new` (pure utility; single seam for warm-up-partial navigation by `definitionKey`).
   - Owning module: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` (new module). Single-file utility; no folder expansion is triggered because the helper is the only fixed member, and grouping rules (`src/frontend/AGENTS.md` §13) require ≥2 sharing files before folder-creating. The existing `services/assignmentDefinition/` folder already houses the `*.zod.ts` siblings, so `assignmentDefinitionUtilities.ts` joins them without a structural change.
   - Call-site rationale: the heatmap adapter is the first and only consumer; placing the helper in the assignment-definition module keeps all `assignmentDefinitionPartials` dataset navigation in that domain (per `src/frontend/AGENTS.md` §3.2).
   - Relevant canonical-doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — record as `Not implemented` (Section 7 pre-implementation), update to `Implemented` after green. Likely slot: §9.20 (Data analysis accumulator helpers area, mirroring the Section 1 deviation note at line 178) OR a new §9.x entry for assignment-definition-domain helpers. (Decide at implementation time; the canonical home is the assignment-definition domain, not the ClassPage feature folder.)
   - Planned doc status: `Not implemented`.
2. Helper: `TaskPartialSchema` extension (existing schema, extended)
   - Decision: `extend` — add `taskTitle` (nullable); rename `id` → `taskId`. No new abstraction is introduced — the schema remains the canonical wire shape for `AssignmentDefinition.toPartialJSON()`.
   - Owning module: `services/assignmentDefinition/taskPartial.zod.ts`.

### Acceptance criteria

- `TaskPartialSchema` emits `taskId` + nullable `taskTitle` (no `id`).
- `toPartialJSON()` emits `taskId` + `taskTitle` per task (load-bearing — covered by a dedicated backend test).
- `getAssignmentDefinitionPartial(partials, definitionKey)` returns the matching `AssignmentDefinitionPartial` or `null`.
- No `id` references remain on `TaskPartial`-shaped data in frontend files (verified by the Section 7 section checks below — TypeScript will not compile while any remain).
- `taskKey` derivation (`${definitionKey}::${taskId}`) is **unchanged** by the rename; `PerStudentTaskMetric.taskKey` and the Section 1 accumulator-output tests keep passing without re-keying.
- The stale `validatePartialRow_` test-only guard is reconciled with the live `toPartialJSON()` behaviour (accepts `[]` and `[{ taskId, taskWeighting, taskTitle }]`; still rejects non-array `tasks`).
- `npm run lint:frontend && npm run typecheck` pass.
- Existing `averagingAnalyser*` and `assignmentDefinitionPartials*` green suites remain green (the rename is a property-name shift, not a contract shift).

### Section checks

- `npm run lint:frontend && npm run typecheck`
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition src/frontend/src/services/dataAnalysis`
- Backend: `npm run test:backend -- tests/backend-api/assignmentDefinitionPartials.unit.test.js` (verifies the guard test reconciliation and the new `toPartialJSON` emission test).
- Mandatory-read evidence gate passed.
- **Status: COMPLETE.** Section 7 delivered across two atomic commits so the tree never breaks: **Commit 7a** (Steps 1a+2a, additive `taskTitle`) and **Commit 7b+§8** (Steps 1b+2b+3+4 + the Section 8 adapter rewrite), pair-landing per the tree-green staging note. All section checks green at both boundaries.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `TaskPartialSchema` recording that `taskId` (not `id`) aligns with `AssignmentDefinitionTaskSchema.taskId`, and that `taskTitle` is nullable so legacy/missing titles reach the `TaskTitlesUnavailableError` path (Section 8).

### Implementation notes / deviations / follow-up (7a — additive: `taskTitle` on `TaskPartialSchema` + backend emit + guard reconciliation)

- `TaskPartialSchema` (`taskPartial.zod.ts`) gained `taskTitle: z.string().nullable()` — **REQUIRED, not optional**. A first Green attempt weakened it to `.optional()` to dodge a test that omitted `taskTitle`; this was rejected in review (Critical C1/C2) and corrected by repairing the offending fixtures/tests instead of relaxing the contract. `@remarks` added noting the 7b `id`→`taskId` rename and the `TaskTitlesUnavailableError` path.
- Backend `AssignmentDefinition.toPartialJSON()` (`Models/AssignmentDefinition.js`) now emits `taskTitle: task.taskTitle` per task (additive; `id` retained — the rename to `taskId` is 7b). `TaskDefinition` requires `taskTitle` in its constructor, so no null fallback needed.
- Stale `validatePartialRow_` test-only guard (`z_Api/assignmentDefinitionValidation.js`) reconciled: body replaced with `if (!Array.isArray(row.tasks)) throw …` so it accepts the live `[]` / `[{ id, taskWeighting, taskTitle }]` shape and still fails loudly on a non-array `tasks`; the thrown message matches the updated test (`'tasks must be an array.'`). Confirmed `validatePartialRow_` is never invoked from production (`getAssignmentDefinitionPartials_` does not call it).
- Tests: `taskPartial.zod.spec.ts` + `assignmentDefinitionPartials.zod.spec.ts` strict-rejection tests flipped from `taskTitle` (now an accepted field) to `extra`; both assert nullable `taskTitle` is accepted. Backend `assignmentDefinitionPartials.unit.test.js` gained a `toPartialJSON` emission test and reconciled the `validatePartialRow_` block.
- Fixture/test repair for the now-required `taskTitle`: `createTaskPartial` (`fixtures.ts`) returns `taskTitle: null` (optional 3rd arg); `createDefinitionPartial`/`createAssignmentPartial` override types widened; literals in `classDetailService.zod.spec.ts`, `averagingAnalyser.accumulation.spec.ts`, and `ClassPageHeatmapView.spec.tsx` gained `taskTitle: null`.
- **E2E regression fix (same commit):** making `taskTitle` required broke all 7 `task-heatmap.spec.ts` E2E tests because the journey fixture's embedded `assignmentDefinition.tasks` lacked `taskTitle`. `task-heatmap-end-to-end-helpers.ts` `buildClassFullDocument` now derives tasks as `[{ id, taskWeighting: 1, taskTitle: 'Task N' }, …]`; the warm-up `getAssignmentDefinitionPartials` stays `[]` (Section 8 seeds it). All 7 heatmap E2E tests pass again.
- **Doc correction:** the plan's backend test path used the wrong directory (`tests/api/backend/`); the actual path is `tests/backend-api/` (corrected in the Section checks / Step 5.3 above).
- Regression Gate (re-run): task-heatmap E2E regressions resolved (0 new heatmap failures). Remaining failing checks are pre-existing accepted technical debt: `backend-lint-check` 14 `max-lines` warnings (incl. a fingerprint shift on the grown `assignmentDefinitionPartials.unit.test.js` 2733→2777 lines — same warning, not a new error), `backend-test-coverage-check`, `frontend-e2e-check` 4 theme-toggle failures (unrelated to heatmap), `builder-test-coverage-check` 1 flaky builder test. No new defect attributable to 7a.
- GREEN→REGRESSION verified: `assignmentDefinition` 161, `dataAnalysis` 181, `classDetail` 55, `classPage` 149 Vitest pass; `lint:frontend` 0/0; `tsc` clean; backend `assignmentDefinitionPartials.unit.test.js` 290 pass; `task-heatmap.spec.ts` 7 pass.

---

## Section 8 — Heatmap wiring: source columns/titles from warm-up partials via `getAssignmentDefinitionPartial`, `TaskTitlesUnavailableError`, in-view Alert

### Problem

`adaptMetricsToHeatmap` (`heatmapAdapter.ts:73–79`) builds `taskColumns` from the embedded `classFull.assignments[].assignmentDefinition.tasks`, which carries the weight-summary shape (`{ id, taskWeighting }` — and post-§7 `{ taskId, taskWeighting, taskTitle }`) but no human-readable titles for the live emitter (the live `toPartialJSON()` emits `taskTitle` from `task.taskTitle` only after §7 lands). See `ACTION_PLAN.md` §"BLOCKING BUG" for the verified root cause: the defect is "column headers always fall back to bare `taskId`" (missing title), not "no columns render" except for genuine zero-task assignments.

The fix sources both the column set (task IDs + ordering) **and** the human-readable `taskTitle` from the warm-up `assignmentDefinitionPartials` dataset, located by the assignment's `definitionKey` via `getAssignmentDefinitionPartial` (Section 7). The embedded `assignmentDefinition` is used only to obtain the assignment's `definitionKey` and `primaryTitle`; it is no longer the source of the task list or the per-task titles.

### Plan

#### 1. Define `TaskTitlesUnavailableError`

**File:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`

```ts
export class TaskTitlesUnavailableError extends Error {
  constructor(definitionKey: string) {
    super(`Task titles unavailable for definition "${definitionKey}"`);
    this.name = 'TaskTitlesUnavailableError';
  }
}
```

#### 2. `adaptMetricsToHeatmap` — accept `assignmentDefinitionPartials` (required 4th parameter) and source columns from the located partial

**File:** `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`

Add a 4th parameter `assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse` to `adaptMetricsToHeatmap`. The parameter is **required** (no default value) — per AGENTS core principle #7 ("Never set defaults unless explicitly instructed"), and because there is no sensible default: `null` always throws `TaskTitlesUnavailableError`, and `[]` always throws `TaskTitlesUnavailableError` for any non-empty assignment. The previous 3-arg signature is a **breaking** change for the existing call site at `TaskHeatmapPage.tsx:66` (and for the existing 6 `heatmapAdapter.spec.ts` tests) — both are updated in this same commit (see Step 3 and Required test cases).

Signature:

```ts
export function adaptMetricsToHeatmap(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentId: string,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse
): HeatmapResult { … }
```

Change `buildTaskColumns` so it receives the located partial (not the embedded definition) and reads tasks directly:

```ts
function buildTaskColumns(partial: AssignmentDefinitionPartial): HeatmapTaskColumn[] {
  return partial.tasks.map((task) => ({
    taskKey: `${partial.definitionKey}::${task.taskId}`,
    taskId: task.taskId,
    taskTitle: task.taskTitle,
  }));
}
```

In `adaptMetricsToHeatmap`, locate the partial by the assignment's `definitionKey` (from `assignment.assignmentDefinition.definitionKey`) and branch:

```ts
const definitionKey = assignment.assignmentDefinition.definitionKey;
const partial = getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey);
if (!partial) {
  throw new TaskTitlesUnavailableError(definitionKey);
}
const taskColumns = buildTaskColumns(partial);
// After building, if any non-empty column has a null taskTitle, treat as unavailable:
if (taskColumns.length > 0 && taskColumns.some((c) => c.taskTitle === null)) {
  throw new TaskTitlesUnavailableError(definitionKey);
}
```

Return type unchanged.

#### 3. Prop-thread `assignmentDefinitionPartials` → heatmap (with ready-gate widening)

- **`ClassPage.tsx:67`** — destructure `assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null` from `useClassPageData` (already in the return) and pass down. Note that the existing destructure at line 67 today does not include it; widen the destructure here.
- **`ClassPageContent.tsx`** — add `assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null` prop; forward to `TaskHeatmapPage`. **Widen the ready gate at lines 307–312** for the heatmap branch: in addition to `analyserResult !== null && classFull !== null`, require `assignmentDefinitionPartials !== null` for the heatmap view branch. The non-heatmap (overview) `ClassPageReady` tree is unchanged. (See "Null handling" below.)
- **`TaskHeatmapPage.tsx`** — extend component props to accept `assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse` (non-null, narrowed at the gate) and pass it to `adaptMetricsToHeatmap`. The existing `analyserResult: AveragingResult` and `classFull: ClassFull` remain non-null by virtue of the narrowed gate; mirror that contract for `assignmentDefinitionPartials`.

**Null handling for `assignmentDefinitionPartials`:** when the warm-up dataset is stale (`useClassPageData` exposes the `assignmentDefinitionPartialsFailed` or `assignmentDefinitionPartialsUntrustworthy` blocking error types), the surface-state machine blocks on `surfaceState.status === 'blocking'` and the heatmap view is unreachable. Reaching the `ready` + `heatmap` branch implies the warm-up dataset is available; the narrowed ready gate makes this invariant explicit (so a future refactor that breaks the implicit guarantee fails loudly rather than silently passing `null` through to `adaptMetricsToHeatmap`). `TaskHeatmapPage` therefore does **not** need its own null check on `assignmentDefinitionPartials` — the gate guarantees it. (If a future surface-state change makes the warm-up dataset optional for the heatmap, the gate narrowing here must be revisited; flag this in the JSDoc for `TaskHeatmapPage`'s set-`assignmentDefinitionPartials` prop.)

#### 4. Error handling in `TaskHeatmapPage`

**File:** `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`

In the try–catch that calls `adaptMetricsToHeatmap`:

- `TaskTitlesUnavailableError`: render an **in-view Ant Design `Alert`** (`type="error"`, `showIcon`, `message="Task titles are currently unavailable."`, `description="Please try reloading the page."`) in place of the table region (`taskColumns` is never built when this throws — the adapter throws before `buildTaskColumns` returns a non-empty array). The header `Card` (assignment name + class name + Back button) stays visible so the user can still leave the view manually. Do **not** call `onBack` — the user must see the defect. See "Alert-rendering choice" below for the exact layout.
- All other errors (unknown `assignmentId`, etc.): unchanged — log via frontend logger and call `onBack` (no in-view error).
- When `taskColumns` is empty (zero tasks): render normally with no error (empty state). Note: an empty `taskColumns` only occurs when the partial genuinely has zero `tasks`; a missing partial is the `TaskTitlesUnavailableError` case above, not the empty state, because the partial lookup throws BEFORE `taskColumns` is built.

**Alert-rendering choice (locked):** when `TaskTitlesUnavailableError` is thrown, `TaskHeatmapPage` renders the existing header `Card` (unchanged), then **replaces the control-region and table-region `Card`s body** with a single `Alert` of `type="error"`, `showIcon`, `message="Task titles are currently unavailable."`, `description="Please try reloading the page."`. No table renders, no `TaskHeatmapTable` mounts, no Student Name column renders — the `adaptMetricsToHeatmap` exception means there is no `HeatmapResult` to render. Back and Refresh buttons remain functional (Back returns to overview; Refresh re-runs `useClassPageData.refetch`). This is the authoritative behaviour; it is mirrored verbatim in `SPEC.md` §"Error, loading, and empty-state rules" and `TASK_HEATMAP_LAYOUT.md` §"1. Header region — Error (task titles unavailable)".

#### 5. Update the layout spec error state

**File:** `TASK_HEATMAP_LAYOUT.md`

Add an error-state subsection for "task titles unavailable" (in-view `Alert`, type `error`, the message + description above, no `onBack`, header `Card` visible, table region replaced by the Alert), mirroring the existing "assignment not found" entry. The existing layout spec entry already says "the table region stays visible" — that wording is incorrect after this decision and is updated here to "the table region is replaced by the Alert." This keeps the UI-focused source of truth consistent with the new behaviour (per `frontend/AGENTS.md` §6.1).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md` §3.2 (hooks vs services), §6.1 (loading/width standards), §9 (Zod shapes)
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md` §3 and §8.5 (the `logFrontendError` invocations and explicit-error-mapping rule)
- `SPEC.md` (§"Recommended data contract" `HeatmapResult`/`HeatmapRow`/`HeatmapCell`; §"Adapter projection"; §"Empty state"; §"Error, loading, and empty-state rules")
- `TASK_HEATMAP_LAYOUT.md` (§"1. Header region", §"3. Table region", §"Empty state")
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` (current; will be modified)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` (`AssignmentDefinitionPartialsResponse`)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` (new, post-§7)
- `src/frontend/src/features/classPage/useClassPageData.ts` (`assignmentDefinitionPartials` return; surface-state machine; lines 117–124)
- `src/frontend/src/features/classPage/ClassPage.tsx` (existing destructure at line 67; view-state, breadcrumb)
- `src/frontend/src/features/classPage/ClassPageContent.tsx` (ready gate at lines 307–312; existing `ClassPageHeatmapView.spec.tsx`)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (current; current `adaptMetricsToHeatmap` 3-arg call at line 66)

Implementation mandatory docs: same set plus `src/frontend/AGENTS.md` §3.1 (composition boundary), §3.3 (feature directory layout), §6.1 (loading and width standards).

Code Reviewer mandatory docs: same set plus `SPEC.md` and `TASK_HEATMAP_LAYOUT.md`.

### Shared helper plan

1. Helper: `adaptMetricsToHeatmap` (existing, extended)
   - Decision: `extend` — add a required 4th parameter (`assignmentDefinitionPartials`); switch `buildTaskColumns` from the embedded definition to the located partial; add `TaskTitlesUnavailableError` branching. No new abstraction is created; the existing adapter signature change is breaking-but-co-located.
   - Owning module: `services/dataAnalysis/heatmapAdapter.ts`.
   - Call-site rationale: single projection boundary consumed by `TaskHeatmapPage`.
   - Planned doc status: `Implemented` (already recorded in §9.20 per Section 2); the §9.20 entry should be updated post-§8 to note the required 4th-parameter extension and the new error class.
2. Helper: `TaskTitlesUnavailableError` (new)
   - Decision: `new` (custom error class; canonical source of the "titles unavailable" sentinel distinguished from the generic `Error` thrown for unknown `assignmentId`).
   - Owning module: `services/dataAnalysis/heatmapAdapter.ts` (co-located with `adaptMetricsToHeatmap`, the throw site).
   - Call-site rationale: `TaskHeatmapPage` distinguishes error types in its catch; `TaskTitlesUnavailableError` triggers the in-view `Alert` (all other errors trigger auto-navigate).
   - Relevant canonical-doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — record as `Not implemented` before §8 implementation, update to `Implemented` after green. Slot suggestion: §9.20 (Data analysis accumulator helpers area, mirroring Section 1's helper slot).
   - Planned doc status: `Not implemented`.
3. Helper: `getAssignmentDefinitionPartial` (deliver in Section 7; consumed here)
   - Its own shared-helper plan is in Section 7 — recorded once there to avoid duplicate canonical-doc entries.

### Acceptance criteria

- `adaptMetricsToHeatmap` has a **required** 4th parameter `assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse` (no default); the 3-arg call is no longer valid TypeScript.
- Task heatmap columns (IDs + ordering + `taskTitle`) are sourced from the warm-up partial located by `definitionKey` via `getAssignmentDefinitionPartial`; the embedded `assignmentDefinition.tasks` is no longer the column source.
- A missing partial (or any non-empty column with `null` `taskTitle`) throws `TaskTitlesUnavailableError` → in-view `Alert` (`type="error"`, `showIcon`, `message="Task titles are currently unavailable."`, `description="Please try reloading the page."`); no `TaskHeatmapTable` mounts; header `Card` visible; no `onBack` auto-navigate.
- Unknown `assignmentId` still throws a generic `Error` → auto-navigates with log-only.
- Zero tasks (`partial.tasks: []`) → `taskColumns: []`, normal empty-table rendering (no error).
- The `ClassPageContent` `ready` heatmap gate at lines 307–312 is widened to also require `assignmentDefinitionPartials !== null`; the overview gate is unchanged.
- `npm run lint:frontend && npm run typecheck` pass.
- All 11 `Required test cases (Red first)` below are implemented and pass.
- `TASK_HEATMAP_LAYOUT.md` documents the new error state with the corrected layout (Alert in place of the table region; header `Card` visible).
- Existing Sections 1–6 tests remain green after the UPDATE port (cases 1–4) and the new error-path and component tests (cases 5–11). The 6 Section-2 `heatmapAdapter.spec.ts` tests are not deleted; they are ported in place.
- Canonical-doc entry for `TaskTitlesUnavailableError` recorded as `Not implemented` before §8 implementation; updated to `Implemented` after green.

### Required test cases (Red first)

Frontend Vitest — `heatmapAdapter.spec.ts` (UPDATE the existing 6 Section-2 tests; ADD new error-path tests):

> The Section-2 spec file (`heatmapAdapter.spec.ts`) currently has 6 passing tests asserted against the originally-implemented v1 adapter (3-arg signature; `taskColumns` from embedded `assignmentDefinition.tasks`; `taskTitle: null`). **All 6 must be updated in this Red phase** so each call passes the new 4th argument — without that, the spec file will not compile under the new signature. Plus the new error-path tests below.

UPDATE (existing Section-2 cases, ported to the 4-arg signature):

1. `heatmapAdapter.spec.ts` (ported case 1): given an `AveragingResult` with `perStudentTaskMetrics` for three `taskKey`s, a `ClassFull` whose assignment has the matching `definitionKey`, AND a warm-up `assignmentDefinitionPartials` array whose matching partial has three `tasks` (`{ taskId, taskWeighting, taskTitle }` each), the adapter returns three `taskColumns` in task order with `taskTitle` reflecting the partial — and one row per student, each with three cells aligned by `taskKey`.
2. `heatmapAdapter.spec.ts` (ported case 2): a student with no submission for the assignment yields a row whose cells are `notAttempted` (`score: 'N'`, `state: 'notAttempted'`) when the partial provides titles for the columns.
3. `heatmapAdapter.spec.ts` (ported case 3): a partial whose `tasks: []` yields `taskColumns: []` and rows with empty `cells` (zero-tasks variant — the partial IS located but is empty).
4. `heatmapAdapter.spec.ts` (ported case 4): an unknown `assignmentId` throws a generic `Error` (fail fast — auto-navigate path). Note: this throw is NOT `TaskTitlesUnavailableError`; `TaskHeatmapPage` distinguishes the two.

ADD (new Section-8 error-path cases):

5. `heatmapAdapter.spec.ts` (new): the warm-up `assignmentDefinitionPartials` array contains NO partial for the assignment's `definitionKey` → `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError`. Assert via `expect(() => …).toThrow(TaskTitlesUnavailableError)`.
6. `heatmapAdapter.spec.ts` (new): the located partial has at least one `tasks[i].taskTitle === null` → `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError` (legacy data defect).
7. `heatmapAdapter.spec.ts` (new): a partial whose `tasks` are all populated with non-null `taskTitle` does NOT throw `TaskTitlesUnavailableError` even if the embedded `classFull.assignments[].assignmentDefinition.tasks` is the weight-summary shape (confirming the column source is the partial, NOT the embedded definition). Assert the returned `taskColumns` carry the partial's titles and not `null`.
8. `heatmapAdapter.spec.ts` (new, regression): passing the 4th argument as an empty array `[]` for an assignment whose partial would otherwise be needed throws `TaskTitlesUnavailableError` — confirms no silently-degraded fallback.

Frontend Vitest — `TaskHeatmapPage.spec.tsx` (new tests, accreting onto the existing Section-5b tests):

9. `TaskHeatmapPage.spec.tsx`: when `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError`, the page renders the `Alert` (`type="error"`, `showIcon`, `message="Task titles are currently unavailable."`, `description="Please try reloading the page."`) in place of the table, the header `Card` (assignment name + class name + Back) stays visible, Back calls `onBack`, and `onBack` is NOT invoked automatically on the throw (no auto-navigate).
10. `TaskHeatmapPage.spec.tsx`: when `adaptMetricsToHeatmap` throws a generic `Error` (unknown `assignmentId`), the page logs via `logFrontendError('TaskHeatmapPage', …)`, calls `onBack` exactly once, and renders NO `Alert`.
11. `ClassPageContent.spec.tsx`: the heatmap `ready` branch now requires `assignmentDefinitionPartials !== null`; an existing test that supplies `null` for the warm-up dataset must NO LONGER reach `TaskHeatmapPage` (it should fall back to the overview tree, matching the surface-state block semantics in `useClassPageData.helpers.ts`). Update existing `ClassPageContent` ready-state tests to supply a non-null `assignmentDefinitionPartials` for the heatmap branch.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts`
- `npm run test:frontend -- src/frontend/src/features/classPage`
- `npm run lint:frontend && npm run typecheck`
- Mandatory-read evidence gate passed.
- **Status: COMPLETE (paired commit 7b+§8 with Section 7 Steps 1b/2b/3/4).** All steps (1–5) implemented: 4-arg `adaptMetricsToHeatmap`, `TaskTitlesUnavailableError`, prop-thread `assignmentDefinitionPartials` through `ClassPage`→`ClassPageContent`→`TaskHeatmapPage`, in-view `Alert` (header `Card` visible, no `onBack` on title error), ready-gate widener on `ClassPageContent`, and `TASK_HEATMAP_LAYOUT.md` error-state update.
- **`getAssignmentDefinitionPartial` helper** landed as `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` (Step 4). NOTE: filename is `…Utilities.ts` (not `…Utils.ts`) — the abbreviated form triggers `unicorn/prevent-abbreviations`, which is enforced under `--max-warnings 0` by `lint:frontend:check`; no eslint override was introduced (AGENTS.md rule #10).
- **Regression Gate reconciliation within this commit:** the `id`→`taskId` rename in `toPartialJSON()` had a wider blast radius than the three originally-planned backend test files — `tests/assignment/assignmentDefinitionValidation.test.js`, `tests/assignment/assignmentSerialisation.test.js`, and `tests/controllers/assignmentDefinitionController.upsert.test.js` still asserted the old `id` emission and regressed; all three were updated to expect `{ taskId, taskWeighting, taskTitle }`. The Section 8 4-arg adapter also broke the `task-heatmap.spec.ts` E2E journey (7 tests) because the warm-up `getAssignmentDefinitionPartials` partial was empty; `task-heatmap-end-to-end-helpers.ts` `createHeatmapScenario` now seeds a populated partial with `taskId`+`taskTitle` tasks, restoring all 7 journey tests.
- **Verified green:** `tsc` clean; `lint:frontend:check` 0 errors / 0 warnings; `lint:backend:check` 0 errors (14 pre-existing `max-lines` warnings are accepted debt); frontend Vitest 494 pass; backend Vitest 1893 pass; `task-heatmap.spec.ts` 7 E2E pass. Remaining regression-checker "failures" are all pre-existing baseline debt: `backend-lint-check` `max-lines` (incl. a benign line-count shift 2733→2777 on `assignmentDefinitionPartials.unit.test.js` from required test edits), `backend-test-coverage-check` (coverage threshold), `frontend-e2e-check` flaky app-shell `app.spec.ts` tests (nav/theme, unrelated to heatmap), `builder-test-coverage-check` 1 flaky builder test.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `adaptMetricsToHeatmap` describing (a) the breaking 4-arg signature change vs the originally-implemented 3-arg v1 adapter, (b) the column source shift from embedded definition to warm-up partial, and (c) the `TaskTitlesUnavailableError` semantics. Update the existing `@remarks` rather than appending a duplicate.
- Add `@remarks` to `TaskHeatmapPage`'s `assignmentDefinitionPartials` prop noting the `ClassPageContent` ready-gate narrow guarantees non-null.
