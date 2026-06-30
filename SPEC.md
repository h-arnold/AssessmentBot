# Class Page Specification

## Status

- **Skeleton draft v0.2** — expanded to cover the data analysis service changes that the Class page depends on.
- It is **not** a full spec. Per the planner's brief, the follow-up discussion will fill in the remaining component-level behavioural details, at which point this skeleton will be expanded into the full spec using `docs/developer/SPEC_TEMPLATE.md`.
- The feature now spans **two deliverables** that must be sequenced: the data analysis service contract change (lead) and the Class page (dependent). This is documented in the new **Data analysis service changes** section.
- The user confirmed: (a) fix the `N` vs `E` distinction in the data analysis service rather than plaster over it in the display; (b) supersede the "amber = 3" anchor in favour of a dynamic midpoint rule.
- Open questions deliberately deferred to that follow-up discussion are listed in the **Open questions** section at the end.

## Purpose

This feature adds a per-class overview surface that opens when a teacher clicks the currently disabled `View` button on a class card in `ClassesPage`. The surface summarises the class's assessment performance:

- A row of up to three "Recent Assignments" cards, each showing per-assignment metric averages.
- A full-width table of per-student metric averages across the class.
- Two action buttons in the page header: `Edit Student Details` (placeholder, disabled for v1) and `Start New Assessment` (reuses the existing `AssessTaskModal`).

This feature will **not** add editing of student details, new assessment workflows, or assignment creation. Those are existing or out-of-scope flows.

## Confirmed product decisions

1. **Separate top-level navigation key** (Q1 = B). The class page is its own page in the shell, not a state swap inside `ClassesPage`. This keeps the class page's growing complexity out of `ClassesPage`.
2. **View-entry fetch of the full AB class** (Q2 = A). Startup warmup is unchanged. When the user opens a class page, the page issues a `getABClass` query via the existing `queryKeys.abClass(classId)` key. The page renders a shape-matched skeleton while the fetch is in flight.
3. **Recently completed = three assignments with the most recent activity timestamp** (Q3). For v1, "activity timestamp" = the `lastUpdated` field on each `AssignmentPartial` inside `ClassFull.assignments[]`, sorted descending. Fewer than three cards are shown when the class has fewer assignments; cards are centre-aligned in that case.
4. **Naming note (Q3 clarification).** The user described this as the `updatedAt` property; the actual field on the `AssignmentPartial` model is `lastUpdated` (`updatedAt` exists on `AssignmentDefinitionPartial`, a different model). The spec uses `lastUpdated` because the assignment-instance activity timestamp is the intended semantic. Confirm or correct in the follow-up discussion.
5. **Adapter is a separate feature-local module** that takes the data analysis service's typed output and produces the per-assignment and per-student shape the UI consumes. The adapter is feature-scoped; the data analysis service stays a pure, presentational-agnostic orchestrator.
6. **Average column = the analyser's `overall` metric** (the 40/40/20 weighted overall by default, with the SPaG-renormalisation rule inherited from the analyser).
7. **"Edit Student Details"** is rendered as a disabled button in v1. A tooltip explains it is a placeholder.
8. **"Start New Assessment"** opens the existing `AssessTaskModal` with the current `classId` and `className`, identical to the `ClassesPage` card flow.
9. **No backend changes** are required. `getABClass` exists; the `AveragingAnalyser` is a pure frontend orchestrator. **Superseded by decision 10**: the data analysis service is in scope after all (see Data analysis service changes below). The "no backend changes" half of the decision still holds — only the frontend `AveragingAnalyser` and `dataAnalysis.zod.ts` change.
10. **`N` vs `E` distinction is a data analysis service concern, not a display concern.** The current analyser conflates "not attempted" (raw `score === 'N'`), "no data points", and "processing error" into a single `value: null` state. This is wrong. The analyser must preserve and surface `N` (legitimate not-attempted) and `E` (processing error / no usable data) as first-class states. The display layer consumes the resulting richer `MetricResult` and renders each state distinctly. The user explicitly chose to fix the contract now rather than plaster over it in the display.
11. **Heatmap pill band boundaries are dynamic, derived from a configurable scoring range.** The helper takes an optional `{ lower, upper }` range (default `{ lower: 0, upper: 5 }`) and computes the boundaries as midpoints: `amber = (lower + upper) / 2`, `red/amber = (lower + amber) / 2`, `amber/green = (amber + upper) / 2`. This supersedes the previously discussed "amber = 3" anchor. The bands become equal-width thirds of the range: red occupies the lowest 25 %, amber the middle 50 %, green the top 25 %.

## Existing system constraints

### Backend / API

- `getABClass({ classId })` returns `ClassFull | null` via `callApi('getABClass', { classId })`. Returns `null` on `ClassNotFoundError`; we treat `null` as a blocking state.
- `ClassFull` shape (from `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`): `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey`, `classOwner`, `teachers`, `students[]`, `assignments[]`, `active`.
- `AssignmentPartial` shape: `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `lastUpdated`, `createdAt`, `documentType`, `submissions[]`, `assignmentDefinition`.
- `StudentSubmissionPartial` shape: `studentId`, `studentName`, `assignmentId`, `documentId`, `items` (dict keyed by `taskId`), `createdAt`, `updatedAt`.

### Data analysis (already in place)

- `DataAnalysisService.analyse(input, analyserKey = 'averaging')` is a pure orchestrator.
- `AveragingAnalyserInput` shape (from `dataAnalysis.zod.ts`): `{ filter: AnalysisFilter; classes: ClassFull[]; assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse }`.
- `AnalysisFilter` requires `classIds: string[]` (min 1); `dateRange`, `topicKeys`, `assignmentDefinitionKeys`, and `criterionWeightings` are optional.
- `AveragingResult` shape: `{ classId, className, perStudent, perTask, perClass, appliedCriterionWeightings }`.
- `PerStudentRow` is keyed by `studentId` and carries flat `completeness`, `accuracy`, `spag`, `overall` `MetricResult` fields.
- `PerTaskRow` is keyed by `(definitionKey, taskId)` and carries the same four flat metrics. **One row per task, not per assignment** — see the adapter note in §"Adapters required".
- `MetricResult` is `{ value: number | null; totalWeight; applicableDataPoints; totalDataPoints }`. `value === null` ⇔ `applicableDataPoints === 0`.
- `assignmentDefinitionPartials` is already in startup warmup (see `sharedQueries.ts` `startupWarmupQueryDefinitions`).

### Frontend / architecture

- `appNavigation.tsx` uses a state-based `AppNavigationKey` enum (`dashboard | classes | assignments | settings`). The breadcrumb supports exactly two segments today; the class page needs a third segment (`/ Classes / {className}`).
- `ClassesPage` currently renders the disabled View button at `src/frontend/src/pages/ClassesPage.tsx:163-165`.
- `AssessTaskModal` is reusable as-is. It reads `classId`, `className`, `onClose` — no signature change required.
- The shell's `App.useApp()` provider is available for context-aware `message` / `notification` feedback if needed.
- Shared helpers, query infrastructure, and width tokens are documented in `docs/developer/frontend/`. The new feature must follow these policies.

## Data analysis service changes (lead deliverable)

The Class page requires a richer `MetricResult` than the current analyser produces. This section is the lead deliverable; the Class page work depends on it.

### Why this is needed

The current `MetricResult` (`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts:72-89`) carries `value: number | null` with the invariant `value === null ⇔ applicableDataPoints === 0`. The accumulator (`averagingAnalyser.accumulation.ts:142-167`) actively produces `value === null` for three distinct cases:

1. A raw score of `'N'` (student did not attempt) — legitimate not-applicable state.
2. No submissions at all (the student has no work to assess).
3. All submissions for a criterion were structurally invalid or otherwise unusable.

The teacher cannot distinguish these three on screen. Per the user's decision 10, the analyser must preserve and surface each case as a first-class state, not collapse them into `null`.

### Proposed new `MetricResult` shape

Replace the current `value: number | null` with a discriminated union by `state`:

```ts
const ComputedMetricSchema = z.strictObject({
  state: z.literal('computed'),
  value: z.number(),
  totalWeight: z.number(),
  applicableDataPoints: z.number().int().min(0),
  totalDataPoints: z.number().int().min(0),
});

const NotAttemptedMetricSchema = z.strictObject({
  state: z.literal('notAttempted'),
  value: z.literal('N'),
  totalWeight: z.number(),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(1), // at least one 'N' was seen
});

const ErrorMetricSchema = z.strictObject({
  state: z.literal('error'),
  value: z.literal('E'),
  totalWeight: z.literal(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.literal(0), // no data at all
});

export const MetricResultSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ErrorMetricSchema,
]);
```

The `state` discriminator is the primary key; consumers branch on it. The `value` field is a `number` for `computed`, the literal `'N'` for `notAttempted`, and the literal `'E'` for `error`. The numeric invariant is no longer encoded as a Zod `.refine()` — it falls out of the discriminated union naturally.

### State assignment rules (v1)

The accumulator in `averagingAnalyser.accumulation.ts` is updated so each per-criterion sub-accumulator produces one of the three states based on the data it has seen:

| Condition                                                             | State          | Value         |
| --------------------------------------------------------------------- | -------------- | ------------- |
| At least one numeric score and at least one `applicableDataPoint`     | `computed`     | weighted mean |
| No numeric scores but at least one raw `'N'` score                    | `notAttempted` | `'N'`         |
| No scores at all (no submissions, or all scores structurally invalid) | `error`        | `'E'`         |

A "mixed" case (e.g., a student with one numeric score and one `'N'`) produces `computed` — the `'N'` is dropped from the average, consistent with the existing SPaG-renormalisation rule (`data-analysis-scoring.md:71-77`). The per-task and per-student aggregations then propagate the state upward: if any sub-accumulator is in a non-`computed` state, the rollup produces the most-severe non-`computed` state (error wins over notAttempted wins over computed). Exact rollup precedence is an open question (see Open questions).

### Files affected by this deliverable

- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`** — replace the `MetricResultSchema` definition per the new shape. Update `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, `PerClassResult`, and `DataAnalysisResponseSchema` to thread the new `MetricResult` shape through.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`** — update `accumulateMetricsToTarget` (and any helpers it calls) so each sub-accumulator returns one of the three states, with the assignment rules above. Update `accumToMetric` to map the accumulator state to a `MetricResult` discriminated union value.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`** — update `buildPerStudentRows` and `buildPerTaskRows` to roll the new `MetricResult` upward with the precedence rule.
- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`** — rewrite the `MetricResultSchema` test cases for the discriminated union. Add explicit tests for each of the three states.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`** — rewrite the accumulator tests to assert the state output.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`** — rewrite the per-student / per-task rollup tests with the new state.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`** — update the end-to-end analyser tests to assert the new state shape.
- **`src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`** — update the orchestrator tests.
- **`src/frontend/src/test/dataAnalysis/fixtures.ts`** — update or add fixtures that produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs, so the new tests can reuse them.
- **`docs/pedagogy/data-analysis-scoring.md`** — update the table at line 79–88 ("Understanding the numbers in the results table") to describe the three states. The "Value" row needs to distinguish the number case from the `N` case from the `E` case.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`** — `AssessmentScore` already permits `'N'`; this is fine. The `MetricAccumulator` and `DataPointAccumulator` interfaces are unchanged in shape (they remain internal mutable accumulators); only the conversion to the public `MetricResult` discriminated union changes.

### Sequencing rationale

This deliverable leads the Class page work because the Class page's adapter, the `MetricPill` helper, the column render functions, and the page's owned-surface blocking logic all consume the new `MetricResult` shape. The Class page cannot ship a working heatmap without the `state` discriminator in place.

The data analysis service currently has **no production consumers** in the codebase (`grep` for `DataAnalysisService` and `analyse(` in `src/frontend/src/**/*.tsx` returns zero matches). All callers are tests. This makes the contract change low-risk: we update the schema, the service, and the tests, and there is no UI code to break.

## What the page must display

The visible content (per the supplied mockup `CLASSES_PAGE_MOCKUP.png`):

1. **Breadcrumb** with three segments: `AssessmentBot Frontend / Classes / {className}`.
2. **Page heading** showing the class name (e.g. `7A1 Digital Technology 2025-2026`).
3. **Page summary** (single sentence; copy TBD in follow-up).
4. **Top-right header actions**, right-aligned:
   - `Edit Student Details` button — disabled for v1, with a tooltip "Coming soon" or similar (TBD).
   - `Start New Assessment` button — opens `AssessTaskModal` for the current class.
5. **Recent Assignments section** — up to three cards, horizontally arranged, centre-aligned:
   - Each card title region: bold "Recent Assignments" label, then `Assignment: {assignmentName}` line, then `Completed: {date}` (or "Completed: —" when no activity timestamp is available).
   - Each card body: four metric cells in a row — `Completeness`, `Accuracy`, `SpAG`, `Average` — each rendered as a `MetricPill` (see Components to create). For a `computed` cell, the pill shows the numeric value with the RAG colour; for a `notAttempted` cell, the pill shows `N` in grey; for an `error` cell, the pill shows `E` in the error colour. The `Average` cell is visually emphasised (larger / bolder) to match the mockup.
   - When fewer than three assignments exist, render only the available cards; the row remains centre-aligned.
   - When zero assignments exist, render an empty-state message in place of the cards row (TBD wording).
6. **Student Averages section** — full-width `Card`:
   - View-control row: `Viewing: {Select}` on the left, `Input.Search` on the right.
   - Ant Design `Table` with columns: `Student Name`, `Completeness`, `Accuracy`, `SpAG`, `Average`. Each numeric cell is a `MetricPill` matching the card pill style.
   - Filter / sort / search behaviour is **deferred to the follow-up discussion** (see Open questions).

## Components to create

Frontend, in approximate ownership order:

### Page-level (composition roots; thin)

- **`src/frontend/src/pages/ClassPage.tsx`** — page composition root. Owns the heading, summary, header actions, and delegates to the feature components. Must stay thin per `src/frontend/AGENTS.md` §2.1.
- **`src/frontend/src/pages/pageContent.ts`** — add a `classDetail` entry (heading + summary strings) so the breadcrumb and page both read from one source.

### Feature-level (`src/frontend/src/features/classPage/`)

- **`useClassPageData.ts`** — orchestrates the `getABClass` query, the cached `assignmentDefinitionPartials` and `classPartials` reads, the `DataAnalysisService.analyse(...)` call, and produces a typed `ClassPageData` result with the loading / blocking / ready states per the loading-and-width-standards policy.
- **`classPageModel.ts`** (or `.ts`) — pure view-model builder. Takes the typed inputs and produces the per-card and per-row shapes the UI consumes. Pure function, no I/O. Co-located `.spec.ts`.
- **`classPageAdapter.ts`** (with optional `classPageAdapter.zod.ts`) — adapter layer. The only module that knows how to translate the analyser's `AveragingResult` (and the raw `ClassFull`) into the view-model shape. Sibling to `classPageModel.ts` so the two concerns stay separate (aggregation / ordering logic in the model, raw-to-view mapping in the adapter). Co-located `.spec.ts`.
- **`RecentAssignmentsSection.tsx`** — presentational container that renders the centred row of up-to-three `RecentAssignmentCard` instances and the empty state. No state, no data fetching.
- **`RecentAssignmentCard.tsx`** — one card. Receives a fully-built `RecentAssignmentCardModel` (per the model above) and renders the title, completion date, and four metric pills. No data fetching.
- **`StudentAveragesTableCard.tsx`** — `Card` wrapping the view-control row (`Viewing` Select, search input) and the `Table`. No data fetching.
- **`studentAveragesTableColumns.tsx`** — column definitions for the table (one source of truth for column keys, headers, sort/filter wiring, pill rendering). Co-located `.spec.tsx`.
- **`MetricPill.tsx`** — presentational component that renders a single number (or the `—` placeholder) as a colour-coded pill. Lives at feature root (single in-scope caller is the class page today; promote to a shared location if a second caller materialises). Co-located `.spec.tsx`.
- **`ClassPageHeaderActions.tsx`** — presentational component for the two top-right buttons; owns the tooltip on the disabled `Edit Student Details` and the `Start New Assessment` click handler that opens the `AssessTaskModal`.

### Navigation / shell plumbing

- **`src/frontend/src/navigation/appNavigation.tsx`** — extend `AppNavigationKey` to include `'class-detail'`; extend the breadcrumb builder to support three segments when the class-detail key is active; extend `renderNavigationPage` to switch on the new key and pass through the selected `classId`.
- **`src/frontend/src/AppShell.tsx`** — hold a `selectedClassId` in shell state (alongside `selectedNavigationKey`); clear it when navigation moves away from `class-detail`; ensure the Sidebar still highlights `classes` when the class-detail key is active (so the Back affordance is consistent). A "Back to Classes" affordance is **deferred to follow-up** (see Open questions).
- **`src/frontend/src/pages/ClassesPage.tsx`** — enable the View button: remove the `disabled` and `tabIndex={-1}` attributes; on click, set the shell's `selectedClassId` and switch the nav key to `class-detail`.

### Reused, unchanged

- `AssessTaskModal` (`src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`) — same props contract (`open`, `classId`, `className`, `onClose`).
- `DataAnalysisService` + `AveragingAnalyser` (`src/frontend/src/services/dataAnalysis/`) — already produce `perClass`, `perStudent`, `perTask`.
- `getABClass` / `getABClassQueryOptions` (`src/frontend/src/services/googleClassrooms/classDetail/`, `src/frontend/src/query/sharedQueries.ts`).
- `usePageDataset` / `useStartupWarmupState` for the `assignmentDefinitionPartials` warm-up-backed read.
- `useQuery` directly for the per-class `abClass` query (per `frontend-react-query-and-prefetch.md` §2 — `abClass` is explicitly not warmup-backed).

## Adapters required

The data analysis service output is generic (per-class, per-student, per-task) and is shared with future surfaces. The class page must not couple the UI directly to that shape. The adapter layer owns this translation.

### `classPageAdapter.ts` — proposed contract

```
adaptClassPageToViewModel(input: {
  analyserResult: AveragingResult;       // perClass / perStudent / perTask
  classFull: ClassFull;                  // raw assignment list with lastUpdated timestamps
}): {
  recentAssignments: RecentAssignmentCardModel[];   // length 0..3, sorted by lastUpdated desc
  studentAverages: StudentAverageRowModel[];        // sorted by studentName asc
  classMetrics: { completeness; accuracy; spag; overall } MetricResult; // passthrough of perClass
}
```

Key adapter responsibilities:

- **Recent assignments rollup.** Group `perTask` rows by `definitionKey`. For each assignment group, roll the four `MetricResult` fields into one assignment-level value. Sort by the matching `classFull.assignments[].lastUpdated` descending; take the top three. Drop assignments with `lastUpdated === null` (these are not "recently completed").
- **Assignment-level rollup rule.** Aggregate perTask `MetricResult` fields by weighted average: `value = sum(value_i * totalWeight_i) / sum(totalWeight_i)`, with `applicableDataPoints`, `totalDataPoints`, and `totalWeight` summed. For the `value`, if any sub-task has `value !== null` then the rolled value is the weighted average; if all sub-tasks have `value === null` then the rolled value is `null`. (The exact rollup formula and the handling of `null` values is **deferred to follow-up** — see Open questions.)
- **Student averages passthrough.** `studentAverages` rows mirror `perStudent` rows in the same order, with each `MetricResult` field preserved. Sort by `studentName` ascending (case-insensitive, locale-aware, with `studentId` as the deterministic tie-breaker).
- **Class metrics passthrough.** `classMetrics` is the analyser's `perClass` field.
- **Date formatting.** The card's `Completed: {date}` line is formatted from `lastUpdated` in `en-GB` locale (consistent with `AssignmentsPage.formatUpdatedAtLabel`).
- **Trust validation.** If `classFull` is `null` (ClassNotFoundError) the adapter returns a "not-found" outcome so the page can render a blocking state. (Other fail-closed rules are in `frontend-loading-and-width-standards.md` §5.)

### `classPageModel.ts` — proposed contract

```
buildClassPageViewModel(input: {
  analyserResult: AveragingResult;
  classFull: ClassFull;
  filters: { searchTerm: string; viewing: 'overallClassAverages' | ... };
  sort: { column: 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average'; direction: 'asc' | 'desc' };
}): ClassPageViewModel
```

The model applies user-controlled filtering and sorting on top of the adapter output. Pure function. Co-located with `classPageModel.spec.ts`.

## Backend changes

**None.** `getABClass` is the only transport needed. The data analysis service is a frontend-only orchestrator. No `z_Api` handler changes, no controller changes, no model changes.

## File-separation expectation

The user has flagged that this surface will grow. The skeleton intentionally keeps each file in its own module so the 500-line decomposition rule (`src/frontend/AGENTS.md` §12, `src/backend/AGENTS.md` §10) is satisfied by structure rather than by retrospective splitting. No file is currently projected to exceed 500 lines:

- `ClassPage.tsx` — composition root, projected < 150 lines.
- `useClassPageData.ts` — projected < 120 lines.
- `classPageAdapter.ts` — projected < 180 lines.
- `classPageModel.ts` — projected < 180 lines.
- `RecentAssignmentsSection.tsx` — projected < 60 lines.
- `RecentAssignmentCard.tsx` — projected < 100 lines.
- `StudentAveragesTableCard.tsx` — projected < 150 lines.
- `studentAveragesTableColumns.tsx` — projected < 120 lines.
- `MetricPill.tsx` — projected < 60 lines.
- `ClassPageHeaderActions.tsx` — projected < 80 lines.

## Testing expectations (skeleton level)

- **Adapter unit tests** — given a fixed `AveragingResult` + `ClassFull`, the adapter produces the expected `recentAssignments` (length, ordering, rollup) and `studentAverages` (ordering). Co-located `classPageAdapter.spec.ts`.
- **Model unit tests** — given fixed adapter output, the model applies the search / sort filters correctly. Co-located `classPageModel.spec.ts`.
- **Component unit tests** — one spec per presentational component (`RecentAssignmentCard.spec.tsx`, `StudentAveragesTableCard.spec.tsx`, `MetricPill.spec.tsx`, etc.).
- **Hook unit tests** — `useClassPageData.spec.ts` covers the loading / blocking / ready state transitions and the React Query / `DataAnalysisService` wiring.
- **Page test** — `ClassPage.spec.tsx` covers the heading, breadcrumb, header actions, and the owned-surface skeleton / blocking / empty / ready states.
- **Regression** — enable the View button in `ClassesPage.spec.tsx` and add a click-to-navigate assertion.

## Documentation expectations (skeleton level)

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** — record the planned `classPageAdapter` and `classPageModel` decisions as **deferred / not yet implemented** entries so the de-sloppification review can see them.
- **`docs/developer/frontend/frontend-react-query-and-prefetch.md`** — if any new prefetch policy emerges (none expected for v1), update accordingly. Otherwise no change.
- **`docs/architecture/`** or **`docs/pedagogy/`** — only if the user-facing semantics need a teacher-readable explainer (e.g. how "recently completed" is chosen). TBD in follow-up.

## Open questions for follow-up discussion

These are deliberately deferred; the answers will fill in the **Component-level behaviour** section of the full spec and may prompt additional components.

### Display behaviour

1. **Pill colour thresholds.** What numeric bands map to green / yellow / red? Mockup suggests roughly `≥ 3.5` green, `2.0–3.5` yellow, `< 2.0` red, but this needs to be agreed and centralised (probably in a constants module or in `MetricPill.tsx`).
2. **"Completed: —" wording.** When `lastUpdated` is null, what does the card say? Mockup doesn't cover this. Likely `Completed: —` to match the page's `—` placeholder convention.
3. **Empty state for the Recent Assignments section.** What copy / icon when the class has zero assignments? Or zero assignments with `lastUpdated !== null`?
4. **The "Viewing: Overall Class Averages" Select.** What are the v1 options? Likely one option (a placeholder) for v1, with the dropdown disabled, or the dropdown deferred entirely. Confirm.
5. **Search input behaviour.** Filter which column(s)? Just `studentName`? Case-insensitive substring?
6. **Sort defaults and column-level filter wiring on the metric columns.** Should the user be able to sort / filter the metrics columns? Mockup shows column sort affordances on every column. Confirm metric-column filter behaviour.
7. **Header action tooltip on `Edit Student Details`.** Wording (e.g. "Coming soon", "Not available in this release").

### Data and contract behaviour

8. **Assignment-level rollup formula** in the adapter (see "Adapters required" above). Is a simple weighted average of perTask values correct, or should the rollup re-derive from raw submissions? If we want to keep the adapter thin, the simple weighted average is the right v1 choice; if we want rollup fidelity to the analyser, we'd re-run a per-assignment sub-analysis. Recommend the simple weighted average for v1.
9. **`lastUpdated === null` cards.** Should they be shown at all? The "Recently completed" semantic implies `lastUpdated !== null`; my recommendation is to hide them. Confirm.
10. **Number formatting for the pills.** `2.18` in the mockup uses two decimal places. Confirm. Also confirm the `> 3.5` style of pill label in the mockup (it appears to be a value-with-threshold label rather than just the number). Investigate before drafting.
11. **Student Name column sort direction default.** Mockup shows ascending. Confirm.
12. **No-data students.** `perStudent` only contains students with at least one assessment data point. Should the table show "no data" placeholder rows for students in `classFull.students` that have no submissions, or should the table only show students that the analyser returned? My recommendation is to only show analyser-returned students in v1, with a follow-up if teachers tell us they want "no data" rows visible.

### Routing and shell behaviour

13. **Back affordance.** When the class page is open, how does the user return to `ClassesPage`? Options: (a) Sidebar click on `Classes` (already wired), (b) an in-page `Back to Classes` button, (c) both. Recommend both for affordance.
14. **`selectedClassId` lifecycle.** Should it be reset when the user navigates to a non-class-detail page, or only on Sidebar `Classes` re-click? Recommend reset on any non-class-detail navigation.
15. **Should the View button be in a different visual state when it would navigate?** (Probably no; the current Button + icon style is fine.)

### Future (not v1)

16. **Drill-down from a Recent Assignment card to a per-assignment detail view.** Out of scope for v1.
17. **Drill-down from a student row to a per-student detail view.** Out of scope for v1.
18. **Refresh control / invalidation after `Start New Assessment` completes.** The data analysis service should be re-run after a successful assessment; what triggers that? Possibly a button in the page header, or auto-refresh on focus. Defer.
19. **Cohort-level aggregations across multiple classes.** Out of scope (covered by the future cohort analysis in the pedagogy doc).
20. **Per-class "Edit Student Details" functionality.** Out of scope; placeholder only.

## Implementation readiness

- All confirmed decisions are concrete enough to start drafting the action plan after the follow-up discussion.
- No backend, build, or shared-config changes are implied by the skeleton.
- The data analysis service and AssessTaskModal are reused unchanged, so implementation is contained to `src/frontend/src/`.
- Recommended next step: walk through the open questions in this document section by section, update each with the agreed answer, then expand the skeleton into the full `SPEC.md` and the matching `ACTION_PLAN.md`.
