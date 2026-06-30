# Class Page Specification

## Status

- **Skeleton draft v1.0** — all 15 open questions in the main list are now resolved. The first component-level section (`RecentAssignmentCard`) is fleshed out; the remaining component-level sections (`RecentAssignmentsSection`, `StudentAveragesTableCard`, `studentAveragesTableColumns`, `ClassPageHeaderActions`, page-level composition root) are still placeholders to be filled in by a follow-up pass. Each follow-up adds a sibling component-level section in the same shape.
- The card-section open question on the "Completed:" wording is **resolved** as a side effect of a bigger decision (see below). The label is **Last Assessed** (not "Completed"), the field is `updatedAt` (not `lastUpdated`), and a null `updatedAt` is a data bug that fails fast at the adapter boundary.
- The card-section open question on the **empty state** is also **resolved**: the section renders an Ant Design `Empty` with a primary `Start New Assessment` CTA that opens the existing `AssessTaskModal`. The same callback is shared with the header button via the page-level composition root.
- It is **not** a full spec. Per the planner's brief, the follow-up discussion will fill in the remaining component-level behavioural details for `RecentAssignmentsSection`, `StudentAveragesTableCard`, `studentAveragesTableColumns`, `ClassPageHeaderActions`, and the page-level composition root. Each follow-up adds a sibling component-level section in the same shape.
- The feature now spans **three deliverables** that must be sequenced: (1) `AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead), (2) data analysis service contract change (lead), (3) the Class page (dependent). The rename is sequenced before the data analysis service change because the data analysis service touches fixtures and downstream code that share the property name. The full ordering is documented in the **Implementation readiness** section.
- The user confirmed: (a) fix the `N` vs `E` distinction in the data analysis service rather than plaster over it in the display; (b) supersede the "amber = 3" anchor in favour of a dynamic midpoint rule; (c) **rename `lastUpdated` to `updatedAt` on `AssignmentPartial`** as a deliberate breaking change with no backwards-compat shim, so the field name is consistent with the rest of the codebase; the card's "Last Assessed" line reads from `updatedAt`, and a null `updatedAt` on a candidate assignment is a data bug that fails fast at the adapter boundary (page renders blocking state); (d) the Recent Assignment Card title should be the assignment name (not the literal "Recent Assignments" repeated on every card — the section heading renders that once); (e) the Average cell is visually emphasised while the other three cells are uniform; (f) the card is fully static with no hover or click handler for v1.
- Open questions deliberately deferred to that follow-up discussion are listed in the **Open questions** section at the end; card-specific deferred items are listed at the end of the **Component-level behaviour — `RecentAssignmentCard`** section.

## Purpose

This feature adds a per-class overview surface that opens when a teacher clicks the currently disabled `View` button on a class card in `ClassesPage`. The surface summarises the class's assessment performance:

- A row of up to three "Recent Assignments" cards, each showing per-assignment metric averages.
- A full-width table of per-student metric averages across the class.
- Two action buttons in the page header: `Edit Student Details` (placeholder, disabled for v1) and `Start New Assessment` (reuses the existing `AssessTaskModal`).

This feature will **not** add editing of student details, new assessment workflows, or assignment creation. Those are existing or out-of-scope flows.

## Confirmed product decisions

1. **Separate top-level navigation key** (Q1 = B). The class page is its own page in the shell, not a state swap inside `ClassesPage`. This keeps the class page's growing complexity out of `ClassesPage`.
2. **View-entry fetch of the full AB class** (Q2 = A). Startup warmup is unchanged. When the user opens a class page, the page issues a `getABClass` query via the existing `queryKeys.abClass(classId)` key. The page renders a shape-matched skeleton while the fetch is in flight.
3. **Recently completed = three assignments with the most recent activity timestamp** (Q3). For v1, "activity timestamp" = the `updatedAt` field on each `AssignmentPartial` inside `ClassFull.assignments[]`, sorted descending. Fewer than three cards are shown when the class has fewer assignments; cards are centre-aligned in that case. The card labels this line "Last Assessed:" (not "Completed:"), reflecting the per-assessment activity semantic.
4. **Naming note (Q3 clarification — resolved during card planning by decision 12).** The card needs the per-assignment-instance activity timestamp, semantically "when was this assignment last assessed?". The codebase has three timestamp fields that sound related: `AssignmentPartial.lastUpdated` (per-assignment-instance, currently nullable), `StudentSubmissionPartial.updatedAt` (per-submission, non-nullable), and `AssignmentDefinitionPartial.updatedAt` (per-definition, nullable). None of the three maps cleanly to a non-nullable "last assessed" timestamp. The user has chosen to **rename `AssignmentPartial.lastUpdated` to `updatedAt` and make it the canonical "last assessed" timestamp** (decision 12 below). This is a deliberate breaking schema change; no backwards-compat shim is added. After the rename, `AssignmentPartial.updatedAt` is the source of the "Last Assessed" line.
5. **Adapter is a separate feature-local module** that takes the data analysis service's typed output and produces the per-assignment and per-student shape the UI consumes. The adapter is feature-scoped; the data analysis service stays a pure, presentational-agnostic orchestrator.
6. **Average column = the analyser's `overall` metric** (the 40/40/20 weighted overall by default, with the SPaG-renormalisation rule inherited from the analyser).
7. **"Edit Student Details"** is rendered as a disabled button in v1 with an Ant Design `Tooltip` reading `Coming soon` to explain the placeholder.
8. **"Start New Assessment"** opens the existing `AssessTaskModal` with the current `classId` and `className`, identical to the `ClassesPage` card flow.
9. **No backend changes** are required. `getABClass` exists; the `AveragingAnalyser` is a pure frontend orchestrator. **Superseded by decision 10**: the data analysis service is in scope after all (see Data analysis service changes below). The "no backend changes" half of the decision still holds — only the frontend `AveragingAnalyser` and `dataAnalysis.zod.ts` change.
10. **`N` vs `E` distinction is a data analysis service concern, not a display concern.** The current analyser conflates "not attempted" (raw `score === 'N'`), "no data points", and "processing error" into a single `value: null` state. This is wrong. The analyser must preserve and surface `N` (legitimate not-attempted) and `E` (processing error / no usable data) as first-class states. The display layer consumes the resulting richer `MetricResult` and renders each state distinctly. The user explicitly chose to fix the contract now rather than plaster over it in the display.
11. **Heatmap pill band boundaries are dynamic, derived from a configurable scoring range.** The helper takes an optional `{ lower, upper }` range (default `{ lower: 0, upper: 5 }`) and computes the boundaries as midpoints: `amber = (lower + upper) / 2`, `red/amber = (lower + amber) / 2`, `amber/green = (amber + upper) / 2`. This supersedes the previously discussed "amber = 3" anchor. The bands become equal-width thirds of the range: red occupies the lowest 25 %, amber the middle 50 %, green the top 25 %.
12. **Rename `AssignmentPartial.lastUpdated` to `AssignmentPartial.updatedAt` as a deliberate breaking schema change, with no backwards-compat shim.** The codebase has three timestamp fields whose names overlap (`AssignmentPartial.lastUpdated`, `StudentSubmissionPartial.updatedAt`, `AssignmentDefinitionPartial.updatedAt`). The card's "Last Assessed" line is semantically a per-assignment-instance activity timestamp, which is exactly what `AssignmentPartial.lastUpdated` already represents. Renaming the field to `updatedAt` brings the assignment model in line with the rest of the codebase and removes the confusion. This is a breaking change: every frontend and backend caller that reads `AssignmentPartial.lastUpdated` must be updated to read `AssignmentPartial.updatedAt` in the same change. No aliasing, no deprecation period, no migration helper. **Fail-fast semantics:** a `null` `updatedAt` on a candidate assignment is a data bug; the adapter throws and the page renders a blocking state. The `—` placeholder is no longer used for this line. The renamed field is the new canonical source for the "Last Assessed" timestamp.

## Existing system constraints

### Backend / API

- `getABClass({ classId })` returns `ClassFull | null` via `callApi('getABClass', { classId })`. Returns `null` on `ClassNotFoundError`; we treat `null` as a blocking state.
- `ClassFull` shape (from `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`): `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey`, `classOwner`, `teachers`, `students[]`, `assignments[]`, `active`.
- `AssignmentPartial` shape (from `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`): `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `updatedAt`, `createdAt`, `documentType`, `submissions[]`, `assignmentDefinition`. The `updatedAt` field is the renamed `lastUpdated` field (decision 12); see the "AssignmentPartial `lastUpdated` → `updatedAt` rename" lead deliverable below for the change contract.
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

## `AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead deliverable)

The Class page requires a per-assignment-instance "last assessed" timestamp. The existing field is `AssignmentPartial.lastUpdated` (`z.string().nullable()` at `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts:116`). Per decision 12, this field is **renamed to `updatedAt`** so it matches the naming convention used elsewhere in the codebase, and the card's "Last Assessed" line reads from the new field. This is a deliberate breaking schema change with no backwards-compat shim.

### Why this is needed

The codebase has three timestamp fields whose names overlap and whose semantics differ:

| Model                         | Field                       | Type                                    | Semantics                                                                          |
| ----------------------------- | --------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `AssignmentPartial`           | `lastUpdated` → `updatedAt` | `z.string().nullable()`                 | Per-assignment-instance activity timestamp                                         |
| `StudentSubmissionPartial`    | `updatedAt`                 | `z.string()`                            | Per-submission timestamp (when the individual submission was last updated)         |
| `AssignmentDefinitionPartial` | `updatedAt`                 | `NullableIsoDateTimeWithTimezoneSchema` | Per-definition template timestamp (when the assignment _template_ was last edited) |

For the card's "Last Assessed" line, the per-assignment-instance activity timestamp is the correct semantic. Today that field is named `lastUpdated`, which is inconsistent with the rest of the codebase. The rename is a pure naming change — the wire shape, the on-disk model, and the test fixtures all need to be updated, but the data semantics do not change.

### Schema contract

After the rename, the `AssignmentPartial` shape is:

```ts
export const AssignmentPartialSchema = z.object({
  courseId: z.string(),
  assignmentId: z.string(),
  assignmentName: z.string(),
  dueDate: z.string().nullable(),
  updatedAt: z.string().nullable(), // renamed from lastUpdated
  createdAt: z.string(),
  documentType: z.string().nullable(),
  submissions: z.array(StudentSubmissionPartialSchema),
  assignmentDefinition: AssignmentDefinitionPartialSchema,
});
```

The type stays `z.string().nullable()`. The cardinality (always present, may be null) is preserved. The null semantics become **fail-fast at the adapter boundary** (see "Fail-fast semantics" below), so the model contract now treats a null `updatedAt` as a data bug rather than a soft signal.

### Breaking-change policy

This is a **deliberate breaking change**. There is **no backwards-compat shim, no deprecation alias, no migration helper**. Every frontend and backend caller of `AssignmentPartial.lastUpdated` must be updated to read `AssignmentPartial.updatedAt` in the same change. The action plan must include the rename across:

- The frontend Zod schema (1 line in `classDetailService.zod.ts`).
- The backend source model (`Assignment.toPartialJSON()` and its underlying field) — the wire shape changes from `lastUpdated` to `updatedAt`.
- The backend `getABClass` controller and any serialisation helpers.
- All frontend callers of `lastUpdated` on `AssignmentPartial` (search via `rg "lastUpdated" src/frontend/src` to enumerate; the field does not currently appear to be consumed by production frontend code outside this spec, but test fixtures do).
- All backend callers of `lastUpdated` on `Assignment` (search via `rg "lastUpdated" src/backend`).
- All test fixtures (frontend `src/frontend/src/test/dataAnalysis/fixtures.ts` line 175; backend `tests/api/` and `tests/services/` fixtures).
- Documentation that references the field name (`docs/developer/frontend/`, `docs/pedagogy/`, `docs/architecture/`).

The fail-fast boundary in the adapter catches any call site that is missed at runtime.

### Fail-fast semantics

After the rename, a `null` `updatedAt` on a candidate assignment is treated as a **data bug**. The adapter does not silently drop the assignment; it throws. The page catches the error and renders a blocking state (per `frontend-loading-and-width-standards.md` §2.2, §5).

This is a deliberate strengthening of the existing "drop assignments with `lastUpdated === null`" behaviour. The new rule is:

> If any candidate assignment in the input has `updatedAt === null`, the adapter throws and the page renders a blocking state.

The rationale: a null `updatedAt` on an assignment with submissions is a data-integrity issue that the team should see immediately, not silently work around. The "no recent activity" UX is now expressed as "no assignments in the class" (empty state), not as "assignments exist but lack a timestamp" (silent drop).

### Files affected by this deliverable

- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`** — rename `lastUpdated` to `updatedAt` in `AssignmentPartialSchema` (line 116). Update the JSDoc comment to note the rename and the new fail-fast contract.
- **`src/frontend/src/test/dataAnalysis/fixtures.ts`** — update `createAssignmentPartial` (line 175) to emit `updatedAt: null` (or a real ISO string in tests that need a valid value).
- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`** — update any test fixtures that use `lastUpdated` (line 76) to use `updatedAt`.
- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`** — update any test fixtures that use `lastUpdated` (line 60) to use `updatedAt`.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`** — update any test fixtures that use `lastUpdated` on `AssignmentPartial`.
- **`src/backend/Models/Assignment.js`** (or equivalent) — rename the underlying field and update `toPartialJSON()` to emit `updatedAt` instead of `lastUpdated`.
- **`src/backend/Controllers/ClassDetailController.js`** (or equivalent) — verify the `getABClass` controller serialises the field as `updatedAt`.
- **Backend test fixtures** — update any backend test fixtures that use the field name.
- **`src/frontend/src/features/classPage/classPageAdapter.ts`** — read `updatedAt` (not `lastUpdated`); implement the fail-fast throw when the field is null on a candidate assignment.
- **Documentation** — update any canonical doc that references the field by name.

### Sequencing rationale

This deliverable leads the data analysis service change because the data analysis service touches fixtures and downstream code that share the property name. If the data analysis service change went first, the new `MetricResult` discriminated union would land on a model whose `AssignmentPartial.lastUpdated` field is about to be renamed, creating churn in the test fixtures and risking a mixed intermediate state. By doing the rename first, the data analysis service change happens on a clean schema.

The full sequencing is: (1) rename, (2) data analysis service change, (3) Class page. The action plan must respect this ordering.

### What this deliverable does NOT change

- The `MetricResult` shape is unchanged. The discriminator state (`computed` / `notAttempted` / `error`) is unaffected by the rename.
- The `ClassFull` shape is unchanged. The field is renamed on the inner `AssignmentPartial`, not on `ClassFull`.
- The `getABClass` API surface is unchanged. The wire shape changes (the field name changes), but the method signature and response envelope are the same.
- The card's "Last Assessed" label is new for v1; existing surfaces that previously showed `lastUpdated` (e.g., `AssignmentsPage.formatUpdatedAtLabel`) are updated to use the new field name in the same change.

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

The accumulator in `averagingAnalyser.accumulation.ts` is updated so each per-criterion sub-accumulator produces one of the three states based on the data it has seen (per the strict trigger resolved in open question 8):

| Condition                                                             | State          | Value         |
| --------------------------------------------------------------------- | -------------- | ------------- |
| At least one numeric score and at least one `applicableDataPoint`     | `computed`     | weighted mean |
| No numeric scores but at least one raw `'N'` score                    | `notAttempted` | `'N'`         |
| No scores at all (no submissions, or all scores structurally invalid) | `error`        | `'E'`         |

A "mixed" case (e.g., a student with one numeric score and one `'N'`) produces `computed` — the `'N'` is dropped from the average, consistent with the existing SPaG-renormalisation rule (`data-analysis-scoring.md:71-77`).

**Rollup rule (per-student, per-class, per-assignment):** when rolling sub-accumulator states upward, classify them into `computed` / `notAttempted` / `error` and apply the rule resolved in open question 9: if zero sub-accumulators are `computed` and all are `error`, the rollup is `error`; if zero sub-accumulators are `computed` and all are `notAttempted`, the rollup is `notAttempted`; otherwise, compute a weighted average over the `computed` sub-accumulators only, with `error` and `notAttempted` sub-accumulators excluded from the calculation. Rationale: the LLM service sometimes fails on a single task; blocking the entire assignment's computation for one task failure is overkill and limits the usefulness of the tool. `error` sub-tasks are excluded gracefully, not propagated. The rollup only escalates to `error` when there is nothing left to average over.

**Failure modes that produce a hard throw (not `error` state):** divide-by-zero during weighted averaging on this criterion, `NaN`/`Infinity` in the result, unexpected schema-shape violations. These are not caught and converted to `error`; they propagate as exceptions from the data analysis service, and the page surfaces them as a blocking state via the existing fail-closed pattern (`frontend-loading-and-width-standards.md` §5). The accumulator's contract is the three-state assignment; defensive guards for `NaN`/`Infinity` etc. are not added in v1.

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
   - `Edit Student Details` button — disabled for v1, with a tooltip `Coming soon` to explain the placeholder.
   - `Start New Assessment` button — opens `AssessTaskModal` for the current class.
5. **Recent Assignments section** — up to three cards, horizontally arranged, centre-aligned:
   - Each card title region: assignment name (rendered as the Ant Design `Card` `title` prop), then `Last Assessed: {date}` line. The literal "Recent Assignments" label is the section heading above the row, not on every card. The "Last Assessed" line never renders a `—` placeholder; a missing `updatedAt` is a data bug that the adapter surfaces as a blocking state (decision 12).
   - Each card body: four metric cells in a row — `Completeness`, `Accuracy`, `SpAG`, `Average` — each rendered as a `MetricPill` (see Components to create). For a `computed` cell, the pill shows the numeric value with the RAG colour; for a `notAttempted` cell, the pill shows `N` in grey; for an `error` cell, the pill shows `E` in the error colour. The `Average` cell is visually emphasised (larger / bolder) to match the mockup.
   - When fewer than three assignments exist, render only the available cards; the row remains centre-aligned.
   - When zero assignments exist, render an Ant Design `Empty` in place of the card row, with a description like `No recent assessments yet` and a primary `Start New Assessment` button below the message. The button opens the existing `AssessTaskModal` for the current class — the same handler as the header button. The sub-section heading `Recent Assignments` still renders above the empty state. The empty state is a positive nudge for new classes that have not been assessed yet.
6. **Student Averages section** — full-width `Card`:
   - View-control row: `Viewing: {Select}` on the left, `Input.Search` on the right. The Select has a single placeholder option `Overall Class Averages` and is marked `disabled` in v1 — the user can see the control but cannot change it. This preserves the design intent and future-proofs the API for v1.1 alternative views (`By Topic`, `By Student`, `By Criterion`) without committing to a backend analysis pipeline in v1. The `Input.Search` filters the `Student Name` column only, case-insensitive substring match, applied client-side over the in-memory table data.
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
- **`classPageAdapter.ts`** (with optional `classPageAdapter.zod.ts`) — adapter layer. The only module that knows how to translate the analyser's `AveragingResult` (and the raw `ClassFull`) into the view-model shape. Sibling to `classPageModel.ts` so the two concerns stay separate (aggregation / ordering logic in the model, raw-to-view mapping in the adapter). Consumes the new `MetricResult` discriminated union from the data analysis service change. Co-located `.spec.ts`.
- **`RecentAssignmentsSection.tsx`** — presentational container that renders the centred row of up-to-three `RecentAssignmentCard` instances and the empty state. Accepts a `onStartNewAssessment: () => void` callback prop; when the section is empty, it renders an Ant Design `Empty` with a primary `Start New Assessment` button that calls the callback. No state, no data fetching.
- **`RecentAssignmentCard.tsx`** — one card. Receives a fully-built `RecentAssignmentCardModel` (per [Component-level behaviour — RecentAssignmentCard](#component-level-behaviour--recentassignmentcard) below) and renders the title, last-assessed line, and four `MetricPill` instances. Pure presentational, no data fetching, no click handler, no hoverable.
- **`StudentAveragesTableCard.tsx`** — `Card` wrapping the view-control row (a `Select` with the single placeholder option `Overall Class Averages` marked `disabled` in v1, plus a search `Input`) and the `Table`. No data fetching. The Select's `disabled` state and the placeholder option are the v1 contract; the layout spec records the exact label and styling.
- **`studentAveragesTableColumns.tsx`** — column definitions for the table (one source of truth for column keys, headers, sort/filter wiring, pill rendering). Each metric column's `render` function delegates to `MetricPill` (see Shared display helpers below). Co-located `.spec.tsx`.
- **`ClassPageHeaderActions.tsx`** — presentational component for the two top-right buttons. Receives a `onStartNewAssessment: () => void` callback prop and passes it through to its `Start New Assessment` button (the same callback used by the empty state in `RecentAssignmentsSection`). Owns the tooltip on the disabled `Edit Student Details`. Does not own the `AssessTaskModal` open/close state — that lives in the page-level composition root.

### Shared display helpers (`src/frontend/src/services/dataAnalysis/metricDisplay/`)

This subfolder is created because the `MetricPill` and its tone resolver are conceptually bound to the `MetricResult` shape produced by the data analysis service. At least two production files (`metricTone.ts`, `MetricPill.tsx`, and their spec companions) share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §12. The Class page is the first caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller, so the helper is **shared** rather than feature-local.

- **`metricTone.ts`** — pure tone resolver. Input: a `MetricResult` (the new discriminated union) plus an optional `{ lower, upper }` range (default `{ lower: 0, upper: 5 }`). Output: a `MetricToneResolution` describing the tag color, the display value, and the muted flag. No React imports, no antd imports. Co-located `metricTone.spec.ts`.
- **`MetricPill.tsx`** — presentational component. Input: a `MetricResult` plus an optional `range` prop and an optional `emphasised` flag (used by the `Average` cell). Renders an Ant Design `Tag` (`variant="filled"`) in the resolved colour, with the resolved display value. Co-located `MetricPill.spec.tsx`.
- **`index.ts`** — barrel re-export of the two above so feature code can import `import { MetricPill } from 'src/frontend/src/services/dataAnalysis/metricDisplay';` (per `src/frontend/AGENTS.md` §12, barrels are optional but reasonable when a service domain exports a small, cohesive set of unrelated symbols).

### Tone resolution rules (v1)

The `resolveMetricTone` function applies the dynamic midpoint rule (decision 11) plus the state discriminator:

| `state`        | Value range condition                                   | Ant Design Tag color | Display label    |
| -------------- | ------------------------------------------------------- | -------------------- | ---------------- |
| `computed`     | `value < (3·lower + upper) / 4`                         | `red`                | formatted number |
| `computed`     | `(3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4` | `gold`               | formatted number |
| `computed`     | `value ≥ (lower + 3·upper) / 4`                         | `green`              | formatted number |
| `notAttempted` | (any)                                                   | `default` (grey)     | `N`              |
| `error`        | (any)                                                   | `volcano`            | `E`              |

For the default range `{ lower: 0, upper: 5 }`:

- Red threshold: `1.25`
- Amber thresholds: `1.25 ≤ value < 3.75`
- Green threshold: `3.75`

The `error` color (`volcano`) is the existing Ant Design preset for "important but not fatal" — red is reserved for the lowest band of computed values. The user is open to a different error color; the helper accepts an optional `errorColor` prop so the choice is testable.

### Number formatting

`MetricPill` formats `computed` values to two decimal places (matching the mockup, e.g. `2.18`, `3.63`). The precision is a `MetricPill` prop (`precision?: number`, default `2`) so future call sites can override.

### Navigation / shell plumbing

- **`src/frontend/src/navigation/appNavigation.tsx`** — extend `AppNavigationKey` to include `'class-detail'`; extend the breadcrumb builder to support three segments when the class-detail key is active, with the second segment (`Classes`) rendered as a clickable link that navigates back to `classes`; extend `renderNavigationPage` to switch on the new key and pass through the selected `classId`.
- **`src/frontend/src/AppShell.tsx`** — hold a `selectedClassId` in shell state (alongside `selectedNavigationKey`); clear it when navigation moves away from `class-detail`; ensure the Sidebar still highlights `classes` when the class-detail key is active. Three back affordances are wired: the sidebar `Classes` entry, the breadcrumb `Classes` link, and an in-page `Back to Classes` button on the class page (see "Back affordance" resolution in open question 13). All three routes set `selectedClassId = null` and the navigation key back to `classes`.
- **`src/frontend/src/pages/ClassesPage.tsx`** — enable the View button: remove the `disabled` and `tabIndex={-1}` attributes; on click, set the shell's `selectedClassId` and switch the nav key to `class-detail`.

### Reused, unchanged

- `AssessTaskModal` (`src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`) — same props contract (`open`, `classId`, `className`, `onClose`).
- `DataAnalysisService` (orchestrator) — the public `analyse(input, analyserKey)` entry point and its `AveragingAnalyser` registry stay intact. **The internal `MetricResult` shape changes** per the Data analysis service changes section above; this is an internal contract change, not a public API change.
- `getABClass` / `getABClassQueryOptions` (`src/frontend/src/services/googleClassrooms/classDetail/`, `src/frontend/src/query/sharedQueries.ts`).
- `usePageDataset` / `useStartupWarmupState` for the `assignmentDefinitionPartials` warm-up-backed read.
- `useQuery` directly for the per-class `abClass` query (per `frontend-react-query-and-prefetch.md` §2 — `abClass` is explicitly not warmup-backed).

## Component-level behaviour — `RecentAssignmentCard`

This section pins down the contract for `src/frontend/src/features/classPage/RecentAssignmentCard.tsx` and its model. It is the source of truth for the adapter producer and the section consumer; later sections (the layout spec and the action plan) inherit this contract verbatim.

### Purpose and scope

`RecentAssignmentCard` renders one card in the **Recent Assignments** row of the Class page. It summarises the four rolled-up criterion metrics (completeness, accuracy, SpAG, average) for a single assignment instance, and the assignment's "completed" date.

**In scope**

- Rendering the card title (the assignment name).
- Rendering the "Last Assessed: {date}" line.
- Rendering four `MetricPill` instances (one per criterion), with the **Average** cell visually emphasised.
- Honouring the `MetricResult` discriminated-union state in each cell.

**Out of scope** (rendered or owned elsewhere)

- The "Recent Assignments" sub-section heading above the row — owned by `RecentAssignmentsSection`.
- The row layout, gap, and centre-alignment of the three cards — owned by `RecentAssignmentsSection`.
- The empty-state for zero cards, including the `Start New Assessment` CTA — owned by `RecentAssignmentsSection`.
- The per-assignment rollup from perTask `MetricResult` values — owned by `classPageAdapter`.
- Drill-down navigation to a per-assignment detail view (deferred; see Open question 16).
- The actual `MetricPill` rendering — owned by `services/dataAnalysis/metricdisplay/MetricPill`.

### Inputs — `RecentAssignmentCardModel`

The card is pure presentational and consumes a single, fully-built model. The model is produced by `classPageAdapter` and validated by a Zod schema co-located in `classPageAdapter.zod.ts`. The card imports the inferred TypeScript type and trusts the upstream validation.

```ts
// Sketch only — the canonical schema lives in classPageAdapter.zod.ts
const RecentAssignmentCardMetricSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema, // { state: 'computed', value: number, ... }
  NotAttemptedMetricSchema, // { state: 'notAttempted', value: 'N', ... }
  ErrorMetricSchema, // { state: 'error', value: 'E', ... }
]);

const RecentAssignmentCardModelSchema = z.strictObject({
  assignmentId: z.string().min(1), // unique instance id; React key
  assignmentName: z.string(), // shown in the card title
  lastAssessedAt: z.string(), // ISO 8601 string, derived from AssignmentPartial.updatedAt
  // (renamed from `lastUpdated` per decision 12).
  // Non-nullable: a null `updatedAt` is a data bug
  // and the adapter throws before the model is built.
  lastAssessedAtLabel: z.string(), // pre-formatted display label (en-GB locale, e.g. '2025-11-05')
  metrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    average: RecentAssignmentCardMetricSchema,
  }),
});
```

**Field notes**

- `assignmentId` is the per-instance identifier on `AssignmentPartial.assignmentId`. The card does not use it for navigation in v1; it is exposed in the model for traceability and for the React `key` in the section row.
- `lastAssessedAt` carries the original `updatedAt` ISO string. It is **non-nullable** in the model: a null `updatedAt` on the source `AssignmentPartial` is a data bug, the adapter throws, and the page renders a blocking state (per decision 12). The card does not need a `—` placeholder.
- `lastAssessedAtLabel` is the pre-formatted display label, computed by the adapter using the same `formatUpdatedAtLabel` helper used by `AssignmentsPage.tsx:148-160`. The card renders `{lastAssessedAtLabel}` verbatim — see "Date formatting" below for the rationale.
- `metrics` reuses the data analysis service's `MetricResult` discriminated union verbatim (see "Data analysis service changes" above). The card does not branch on shape beyond what `MetricPill` already does.
- `definitionKey` is intentionally **not** in the model. The card does not need it; the adapter uses it for the rollup and the React key, and the model only carries what the card renders.

### Layout and structure

The card is a single Ant Design `Card` (default border, `size="small"`) with three structural regions, in this order:

1. **Title region** — the `Card` `title` prop. The title text is the assignment's `assignmentName` only (e.g. `Coding Fundamentals`). The literal `Assignment:` prefix is **not** rendered; the section heading `Recent Assignments` is rendered once above the row by `RecentAssignmentsSection`. The "title region" is therefore the Ant Design `Card` header, not a custom body block.
2. **Last-assessed line** — a single line below the title rendered as `Typography.Text type="secondary"` reading `Last Assessed: {lastAssessedAtLabel}` (e.g. `Last Assessed: 2025-11-05`). The `lastAssessedAtLabel` is pre-formatted by the adapter (see "Date formatting" below). The card never renders a `—` placeholder for this line: a null or unparseable `updatedAt` on the source `AssignmentPartial` is a data bug, the adapter throws, and the page renders a blocking state.
3. **Metric cells row** — a single horizontal row containing four cells, in this fixed left-to-right order: **Completeness**, **Accuracy**, **SpAG**, **Average**. The first three are uniform; the **Average** cell is visually emphasised (see "Average cell emphasis" below).

The card body uses the default Ant Design `Card` padding. The card width is **fixed** to a single new panel-width token (see "Width token" below); the section row handles centre-alignment and gap, not the card.

### Metric cell rendering

#### The three uniform cells (Completeness, Accuracy, SpAG)

Each uniform cell is a horizontal `Flex` (`justify="space-between"`, `align="center"`) containing:

- A `Typography.Text type="secondary"` label on the left (e.g. `Completeness`).
- A `MetricPill` on the right, with `emphasised={false}` and the default `range` (`{ lower: 0, upper: 5 }`).

The label and pill are vertically centred. The cell flexes to fit the card body, with the label and pill each hugging their content. The three uniform cells share a single `Flex` container with `justify="space-between"` so the labels align on the left edge and the pills align on the right edge of the card body.

#### The emphasised Average cell

The Average cell is a vertical `Flex` (`orientation="vertical"`, `align="center"`, `gap` small) containing:

- A `Typography.Text type="secondary"` label `Average` on top, slightly larger or same size as the uniform labels (visual review needed — the mockup suggests it is the same size or marginally larger).
- A `MetricPill` below, with `emphasised={true}` and the default `range`. The `emphasised` flag increases the pill's font size (~1.25x) and weight to match the mockup's bolder, larger `3.05` / `3.21` / `2.67` values.

The Average cell visually balances the four-cell row because the three uniform cells are laid out horizontally; the vertical Average cell anchors the right end of the row with a stronger visual weight. The exact pixel sizes for the emphasised pill are a layout-spec concern; the contract is the `emphasised` flag, not the pixel size.

### Rendering rules per `MetricResult` state

The card does not branch on state — it passes each `MetricResult` to `MetricPill`, which applies the tone-resolution rules in the "Tone resolution rules (v1)" section above. The card's contract is summarised in the table below for clarity, not as a duplication of `MetricPill`.

| `state`        | Pill display                   | Pill color                                                       | Visible in the cell as                 |
| -------------- | ------------------------------ | ---------------------------------------------------------------- | -------------------------------------- |
| `computed`     | Formatted number (e.g. `2.18`) | `red` / `gold` / `green` based on value vs. the range thresholds | The numeric value with the band colour |
| `notAttempted` | `N` (uppercase)                | `default` (grey)                                                 | A muted grey `N`                       |
| `error`        | `E` (uppercase)                | `volcano`                                                        | A `volcano` `E`                        |

**Important behavioural notes**

- The card renders the pill colour even when the cell is "degraded" (`notAttempted` or `error`). It does not collapse the cell or hide the pill. A teacher's eye should land on every cell and recognise the state's meaning from the colour + label.
- The card does **not** add extra copy (e.g. "No data", "Not attempted", "Error"). The pill label and colour are the only signal. This keeps the layout compact and consistent across the table and the cards.
- The card does **not** add a tooltip on the pill in v1. The pill label is the affordance. Tooltip copy for the states is a follow-up (see Card-specific open questions below).
- The `Average` cell uses the same state rules; the only difference is the `emphasised` flag and the vertical layout. An `Average` pill in `notAttempted` or `error` is still shown larger and bolder.

### Date formatting

The card does not call `Date` parsing or locale formatting directly. Instead, the adapter pre-formats the "Last Assessed" date into a display label string and stores it in the model under `lastAssessedAtLabel: string` (option B, confirmed).

- The card receives the pre-formatted label and renders it verbatim as `Last Assessed: {lastAssessedAtLabel}`.
- The adapter calls the same `formatUpdatedAtLabel` helper used by `AssignmentsPage.tsx:148-160` and stores the result.
- The raw `lastAssessedAt` ISO string is also kept in the model for future use (e.g. drill-down or sort).
- The card holds no formatting concern; the adapter is the only module that knows the locale.

**Where the helper lives**

The `formatUpdatedAtLabel` helper currently lives in `AssignmentsPage.tsx` as a private function. The recommended move is to extract it to a shared location (e.g. `src/frontend/src/utils/dateFormatting.ts` or as part of the class-page feature) and call it from both `AssignmentsPage` and the adapter. The action plan should record this extraction as a small, contained refactor of `AssignmentsPage.tsx`. The helper's `—` fallback (for unparseable ISO strings) is kept for `AssignmentsPage`'s use; the class page adapter throws instead (per decision 12) because the data integrity bar for the "Last Assessed" line is higher than for a generic table cell.

### Behaviour

- **Pure presentational.** No React state, no `useEffect`, no data fetching, no callbacks, no refs. The card reads `props.model` and renders.
- **No interactivity.** No `onClick`, no `hoverable`, no `cursor: pointer`, no focus ring. Drill-down is out of scope for v1 (open question 16). The card is informational only.
- **No defaults inside the card.** `precision`, `range`, and `emphasised` all come from the props the section passes through; the card does not set its own defaults. The `MetricPill` helper's own defaults (precision = 2, range = `{ lower: 0, upper: 5 }`, emphasised = false) are the contractually set defaults at the helper level (`src/frontend/AGENTS.md` §11).
- **Accessible title region.** The Ant Design `Card` `title` is rendered as a heading. The card does not add a redundant `aria-label`; the `Card`'s built-in title semantics are sufficient.
- **Accessible last-assessed line.** The `Typography.Text type="secondary"` line is plain text; it is part of the card's content and is read in source order. No additional `aria-label` is required.
- **Accessible pill cells.** The four pills are rendered in source order inside the card body. No additional `aria-label` is required for v1. A future iteration may add a screen-reader-only description (e.g. `Completeness: 2.18`) once the product confirms the desired level of detail.
- **Bounded by loading standards.** When the parent page is in the blocking state, the card is not rendered at all (the section shows the blocking treatment). When the parent page is in the loading state, the card is replaced by a shape-matched `Skeleton` placeholder (per `frontend-loading-and-width-standards.md` §3). The card itself does not render a skeleton.

### Composition

The card is rendered exclusively by `RecentAssignmentsSection`. The section owns:

- The sub-section heading `Recent Assignments` (e.g. `<Title level={3}>` above the row).
- The row container (e.g. an Ant Design `Flex justify="center" gap` or a `Row`/`Col` grid).
- The empty-state message when zero cards exist, including the `Start New Assessment` CTA. The CTA receives a `onStartNewAssessment: () => void` callback that the page-level composition root owns; the same callback is passed to `ClassPageHeaderActions` for the header button. The two entry points (header and empty-state CTA) are intentionally redundant so the action is discoverable for new classes.
- The per-card keying (`<RecentAssignmentCard key={model.assignmentId} model={model} />`).

The card does not know about its position in the row, the row's gap, the section's heading, or the section's CTA. This keeps the card testable in isolation with a single `model` prop and a fixed width.

### Width token

The card's outer width is fixed. The recommended width is **320 px**, which is wider than the existing class card (`CLASSES_CARD_WIDTH_PX = 268` at `ClassesPage.tsx:30`) because the four-cell row needs horizontal room for three labels and three pills plus one emphasised Average cell. The card is **not** fluid — it is a fixed-width panel that the section centres in the row.

The width should be a new shared panel-width token (per `frontend-loading-and-width-standards.md` §7) added to the shared width-token set, e.g. `--app-panel-width-recent-assignment-card`. The action plan should record this token addition in the canonical doc with status `Not implemented` before the layout work begins. Feature-local literals are not acceptable.

### Card-specific open questions

These are deliberately deferred and do not block the spec from being expanded.

1. **Exact pixel size of the `emphasised` Average pill.** The contract is the `emphasised={true}` flag on `MetricPill`; the exact font size, weight, and padding belong to the layout spec. The implementation agent will pick values that match the mockup and the Ant Design Tag scale. Recommend 1.25x font size, weight 600, slightly larger padding.
2. **Average label size.** Whether the `Average` text label is the same size as the three uniform labels or slightly larger. The mockup suggests it is the same size or marginally larger; the layout spec should confirm.
3. **Empty-state copy.** **Resolved.** The section renders an Ant Design `Empty` with a description like `No recent assessments yet` and a primary `Start New Assessment` button below the message. The CTA opens the existing `AssessTaskModal` for the current class (the same handler as the header button). The page-level composition root owns the `AssessTaskModal` open/close state and passes the handler down to both `RecentAssignmentsSection` and `ClassPageHeaderActions`. Removed from open questions.
4. **Tooltip on pills.** Whether each pill should add a `Tooltip` with a screen-reader-friendly description (e.g. "Completeness: 2.18 out of 5 — Green band"). Defer to v1.1; the pill label is sufficient for v1.
5. **Date label source of truth.** **Resolved — option B (pre-formatted label in the model).** The adapter calls the `formatUpdatedAtLabel` helper and stores the result in `lastAssessedAtLabel`. The card renders verbatim. Removed from open questions.

## Adapters required

The data analysis service output is generic (per-class, per-student, per-task) and is shared with future surfaces. The class page must not couple the UI directly to that shape. The adapter layer owns this translation.

### `classPageAdapter.ts` — proposed contract

```
adaptClassPageToViewModel(input: {
  analyserResult: AveragingResult;       // perClass / perStudent / perTask, all using the new MetricResult discriminated union
  classFull: ClassFull;                  // raw assignment list with updatedAt timestamps (renamed from lastUpdated)
}): {
  recentAssignments: RecentAssignmentCardModel[];   // length 0..3, sorted by updatedAt desc
  studentAverages: StudentAverageRowModel[];        // sorted by studentName asc
  classMetrics: { completeness; accuracy; spag; overall } MetricResult; // passthrough of perClass
}
```

`RecentAssignmentCardModel` is the shape consumed by the `RecentAssignmentCard` component, defined in full under [Component-level behaviour — `RecentAssignmentCard`](#component-level-behaviour--recentassignmentcard) above. The adapter is the sole producer; the card is the sole consumer.

Key adapter responsibilities:

- **Recent assignments rollup.** Group `perTask` rows by `definitionKey`. For each assignment group, roll the four `MetricResult` fields into one assignment-level value using the rollup precedence rule (see below). Sort by the matching `classFull.assignments[].updatedAt` descending; take the top three. **Fail-fast:** if any candidate assignment has `updatedAt === null`, the adapter throws and the page renders a blocking state (decision 12). A null `updatedAt` is treated as a data bug, not a soft signal.
- **Assignment-level rollup rule.** For each of the four criteria, roll the perTask `MetricResult` values upward using the rule resolved in open question 9: classify sub-tasks into `computed` / `notAttempted` / `error`. If zero sub-tasks are `computed` and all sub-tasks are `error`, the rolled metric is `error`. If zero sub-tasks are `computed` and all sub-tasks are `notAttempted`, the rolled metric is `notAttempted`. Otherwise, compute a **weighted average over the `computed` sub-tasks only**, with `error` and `notAttempted` sub-tasks excluded from the calculation (their weight is 0). Rationale: the LLM service sometimes fails on a single task; blocking the entire assignment's computation for one task failure is overkill. `error` sub-tasks are excluded gracefully, not propagated. The rollup only escalates to `error` when there's nothing left to average over.
- **Student averages — full roster, with no-data rows.** `studentAverages` rows cover **all** students in `classFull.students`, not just the ones the analyser returned. The adapter merges the analyser's `perStudent` output with `classFull.students` as follows: for each student in the full roster, if the analyser returned a row for that student, the adapter uses it; otherwise the adapter synthesises a "no data" row with all four criteria as `notAttempted` (`{ state: 'notAttempted', value: 'N', applicableDataPoints: 0, totalDataPoints: 0 }`). The synthesised rows use the student's `id` and `name` from `classFull.students`; `studentName` is the canonical display name. The full list is sorted by `studentName` ascending (case-insensitive, locale-aware, with `studentId` as the deterministic tie-breaker). The `studentAverages` model is the `PerStudentRow` schema; the `MetricResult` discriminated union already supports the `notAttempted` state for all four criteria, so the model does not need a new "no data" discriminator — the no-data case is encoded by all four fields being in `notAttempted` state.
- **Class metrics passthrough.** `classMetrics` is the analyser's `perClass` field.
- **Date formatting.** The card's `Last Assessed: {date}` line is formatted from `updatedAt` in `en-GB` locale (consistent with `AssignmentsPage.formatUpdatedAtLabel`). The adapter is responsible for calling the date-formatting helper and storing the pre-formatted label in the `lastAssessedAtLabel` field of the model (see "Date formatting" under Component-level behaviour above). The raw `lastAssessedAt` ISO string is also retained in the model for future use. The `—` fallback in `formatUpdatedAtLabel` is not used for the class page; a null or unparseable `updatedAt` is a data bug and the adapter throws.
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

**Class page (dependent deliverable):**

- `ClassPage.tsx` — composition root, projected < 150 lines.
- `useClassPageData.ts` — projected < 120 lines.
- `classPageAdapter.ts` — projected < 200 lines (slightly larger than initially estimated because the new `MetricResult` discriminated union adds branching).
- `classPageModel.ts` — projected < 200 lines.
- `RecentAssignmentsSection.tsx` — projected < 80 lines (slightly larger than initially estimated because it now owns the empty-state CTA, which adds an `<Empty>` block, a button, and a callback prop).
- `RecentAssignmentCard.tsx` — projected < 100 lines.
- `StudentAveragesTableCard.tsx` — projected < 150 lines.
- `studentAveragesTableColumns.tsx` — projected < 120 lines.
- `ClassPageHeaderActions.tsx` — projected < 80 lines.

**Shared display helpers (data analysis deliverable, owned by services/dataAnalysis):**

- `metricDisplay/metricTone.ts` — projected < 80 lines.
- `metricDisplay/MetricPill.tsx` — projected < 80 lines.
- `metricDisplay/index.ts` — projected < 10 lines.

**Data analysis service changes (lead deliverable, existing files only):**

- `dataAnalysis.zod.ts` — currently 176 lines; projected to grow to ~220 lines (discriminated union replaces refine).
- `averagingAnalyser.accumulation.ts` — currently 447 lines; projected to grow to ~520 lines. **This crosses the 550-line threshold after the change.** Per `src/frontend/AGENTS.md` §12, we should plan a facade-pattern decomposition of `averagingAnalyser.accumulation.ts` in the same change set. The decomposition plan: split `accumulation.ts` into `accumulation/metricAccumulator.js` (the accumulator primitives), `accumulation/accumulationPolicies.js` (the state assignment rules), and `accumulation/index.js` (the facade that delegates). The new files collectively stay well under 550 lines each; the existing public surface is preserved.
- `averagingAnalyser.rows.ts` — currently 69 lines; projected to grow to ~110 lines (new rollup precedence logic). Stays well under the threshold.

The facade-pattern decomposition of `averagingAnalyser.accumulation.ts` is a **mandatory** sub-task of the data analysis service change. The action plan must include it explicitly.

**`AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead deliverable, small but pervasive):**

- `classDetailService.zod.ts` — 1-line rename; projected size unchanged (~142 lines).
- `Assignment.js` (backend) — rename of the underlying field and `toPartialJSON()`; projected size unchanged.
- All test fixtures (frontend `fixtures.ts`, backend `tests/api/`, `tests/services/`) — projected size unchanged; the rename is a string substitution.
- No new files are introduced by this deliverable.

## Testing expectations (skeleton level)

### Data analysis service deliverable (lead)

- **Schema tests** — `dataAnalysis.zod.spec.ts` must cover the new `MetricResult` discriminated union: `computed`, `notAttempted`, and `error` each round-trip, and the schema rejects mismatches (e.g. `state: 'computed'` with `value: 'N'`).
- **Accumulator tests** — `averagingAnalyser.accumulation.spec.ts` must cover each of the three state assignment rules in the table above, plus the mixed (numeric + `'N'`) → `computed` case.
- **Rows tests** — `averagingAnalyser.rows.ts` tests must cover the rollup precedence (error wins over notAttempted wins over computed) and the all-`notAttempted` → `notAttempted` rollup.
- **End-to-end analyser tests** — `averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts` updated to assert the new state shape on the public output.
- **Fixture updates** — `src/frontend/src/test/dataAnalysis/fixtures.ts` extended with builders that produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs.

### `AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead)

- **Schema tests** — `classDetailService.zod.spec.ts` must cover the renamed `updatedAt` field on `AssignmentPartial`. The `lastUpdated` reference must be replaced with `updatedAt`; the schema must reject `lastUpdated` and accept `updatedAt`.
- **Fixture updates** — `src/frontend/src/test/dataAnalysis/fixtures.ts`, `classDetailService.zod.spec.ts`, `classDetailService.spec.ts`, and any other fixture that uses the field name must be updated to use `updatedAt`.
- **Backend tests** — any backend test fixture that uses the field name must be updated to use `updatedAt`. The `getABClass` test must assert the new field name on the wire.
- **Regression** — the rename must be applied as a single breaking change; no test should pass with the old name present, and no test should pass with the new name absent.

### Shared display helper tests

- **`metricTone.spec.ts`** — for each state, the resolver returns the expected color, display value, and muted flag. For `computed`, boundary cases at the red/amber and amber/green edges are covered (using the default range and a custom range).
- **`MetricPill.spec.tsx`** — renders the right Ant Design `Tag` color and label for each state. The `emphasised` prop produces a larger / bolder tag. The `precision` prop formats the number correctly.

### Class page tests (dependent)

- **Adapter unit tests** — given a fixed `AveragingResult` (with the new `MetricResult` discriminated union) and `ClassFull`, the adapter produces the expected `recentAssignments` (length, ordering, rollup) and `studentAverages` (ordering). Co-located `classPageAdapter.spec.ts`.
- **Model unit tests** — given fixed adapter output, the model applies the search / sort filters correctly. Co-located `classPageModel.spec.ts`.
- **Component unit tests** — one spec per presentational component (`RecentAssignmentCard.spec.tsx`, `StudentAveragesTableCard.spec.tsx`, etc.). `MetricPill` is exercised via the shared helper spec above, not duplicated here.
- **Hook unit tests** — `useClassPageData.spec.ts` covers the loading / blocking / ready state transitions and the React Query / `DataAnalysisService` wiring.
- **Page test** — `ClassPage.spec.tsx` covers the heading, breadcrumb, header actions, and the owned-surface skeleton / blocking / empty / ready states.
- **Regression** — enable the View button in `ClassesPage.spec.tsx` and add a click-to-navigate assertion.

## Documentation expectations (skeleton level)

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** — record the planned `resolveMetricTone`, `MetricPill`, and `metricDisplay/` subfolder decisions as **deferred / not yet implemented** entries in §9 so the de-sloppification review can see them. Also record the planned `classPageAdapter` and `classPageModel` decisions (already drafted in the previous skeleton, still planned). All five entries will be reconciled against the actual implementation during the documentation pass. Also record the planned `formatUpdatedAtLabel` extraction from `AssignmentsPage.tsx` to a shared helper module.
- **`docs/developer/frontend/frontend-react-query-and-prefetch.md`** — no change expected. The class page uses the existing per-class `abClass` query, which is already documented as view-entry (not warmup-backed).
- **`docs/pedagogy/data-analysis-scoring.md`** — update the "Understanding the numbers in the results table" section to describe the three `MetricResult` states (`computed`, `notAttempted`, `error`). The pedagogy is the right place to explain to teachers what each state means. Also document the new "Last Assessed" line on the Recent Assignments cards, including the fail-fast behaviour when `updatedAt` is missing.
- **`docs/architecture/`** — no change expected.

## Open questions for follow-up discussion

These are deliberately deferred; the answers will fill in the **Component-level behaviour** section of the full spec and may prompt additional components.

### Display behaviour (Class page)

1. **Pill colour thresholds.** **Resolved by decision 11** — the band boundaries are dynamic, derived from a configurable range with default `{ lower: 0, upper: 5 }`. Red below `(3·lower + upper) / 4`, gold up to `(lower + 3·upper) / 4`, green above. For the default range: red below 1.25, amber 1.25–3.75, green 3.75 and above. Removed from open questions.
2. **"Completed: —" wording.** **Resolved by decision 12 (renamed to "Last Assessed:" with fail-fast semantics).** The line reads `Last Assessed: {date}` (not "Completed:"). The date comes from `AssignmentPartial.updatedAt` (renamed from `lastUpdated`). A null `updatedAt` is a data bug; the adapter throws and the page renders a blocking state. No `—` placeholder is used for this line. Removed from open questions.
3. **Empty state for the Recent Assignments section.** **Resolved.** The section renders an Ant Design `Empty` with a description like `No recent assessments yet` and a primary `Start New Assessment` button below the message. The CTA opens the existing `AssessTaskModal` for the current class. The fail-fast case (assignments exist but `updatedAt === null`) is a blocking state, not an empty state, and is handled by the page-level error boundary. Removed from open questions.
4. **The "Viewing: Overall Class Averages" Select.** **Resolved.** The Select has a single placeholder option `Overall Class Averages` and is marked `disabled` in v1. The user can see the control but cannot change it. The component-level contract for the Select lives under the (forthcoming) `StudentAveragesTableCard` section in the full spec. Removed from open questions.
5. **Search input behaviour.** **Resolved.** The `Input.Search` filters the `Student Name` column only, case-insensitive substring match, applied client-side over the in-memory table data. Removed from open questions.
6. **Sort defaults and column-level filter wiring on the metric columns.** **Resolved.** All five columns (`Student Name`, `Completeness`, `Accuracy`, `SpAG`, `Average`) are sortable via the Ant Design `Table` column sort affordances. Each metric column also gets a column-level filter (the filter icon is visible in the mockup next to each column header); the exact filter UI (range slider, band checkbox, numeric threshold) is a layout-spec decision. Default sort is `Student Name` ascending (consistent with the analyser's `buildPerStudentRows` ordering). The sort comparator for metric columns is **state-aware**: `error` cells sort to the end regardless of numeric value, then `notAttempted`, then `computed` sorted by numeric value. The `Student Name` comparator is locale-aware, case-insensitive, with `studentId` as the deterministic tie-breaker. Removed from open questions.
7. **Header action tooltip on `Edit Student Details`.** **Resolved.** The disabled button has an Ant Design `Tooltip` with the copy `Coming soon`. Removed from open questions.

### Data and contract behaviour (data analysis service — lead deliverable)

8. **What exactly triggers the `error` state?** **Resolved — strict trigger.** The `error` state is produced when the criterion has **no data points at all** (no submissions, or every submission structurally invalid). Numeric scores produce `computed`; raw `N` scores produce `notAttempted`; absence of scores produces `error`. Analyser-internal exceptions (e.g. divide-by-zero during weighted averaging, NaN/Infinity in the result, unexpected schema-shape violations) are NOT caught and produce a hard throw at the data analysis service boundary; the page surfaces such throws as a blocking state via the existing fail-closed pattern (`frontend-loading-and-width-standards.md` §5). The accumulator's contract is the three-state assignment; defensive guards for `NaN`/`Infinity` etc. are not added in v1. Removed from open questions.
9. **Assignment-level rollup precedence (Class page adapter).** **Resolved — error sub-tasks excluded gracefully.** For each of the four criteria, classify sub-tasks into `computed` / `notAttempted` / `error`. If zero sub-tasks are `computed` and all sub-tasks are `error`, the rolled metric is `error`. If zero sub-tasks are `computed` and all sub-tasks are `notAttempted`, the rolled metric is `notAttempted`. Otherwise, compute a **weighted average over the `computed` sub-tasks only**, with `error` and `notAttempted` sub-tasks excluded from the calculation. The rationale: the LLM service sometimes fails on a single task; blocking the entire assignment's computation for one task failure is overkill and limits the usefulness of the tool. `error` sub-tasks are excluded gracefully, not propagated. The rollup only escalates to `error` when there's nothing left to average over. Removed from open questions.
10. **Number formatting for the pills.** **Resolved** — two decimal places, controlled by a `precision` prop on `MetricPill` (default 2). The mockup's `> 3.5` / `< 2.0` style labels are not part of the v1 pill output; they appear to be illustrative hints rather than the final cell text. The user should confirm that the final cell text is just the formatted number (e.g., `2.18`), not a value-with-threshold label.
11. **Error color choice for `error` state.** **Resolved.** The `error` pill uses Ant Design `volcano` (a reddish-orange preset, hex roughly `#fa541c`). `red` is reserved for the lowest band of `computed` values to keep the visual hierarchy clear (worst score = red, processing error = volcano). Removed from open questions.
12. **No-data students (Class page).** **Resolved — show all class students with a "no data" row.** The table renders all students in `classFull.students`, not just the ones the analyser returned. Students with no assessment data show `N` in all four metric columns (per the `notAttempted` state). The adapter merges the analyser's `perStudent` output with `classFull.students` and synthesises a no-data row for unassessed students (see "Student averages — full roster, with no-data rows" in the Adapters required section). Removed from open questions.

### Routing and shell behaviour

13. **Back affordance.** **Resolved — three affordances.** The user can return to `ClassesPage` from the class page via: (a) the sidebar `Classes` entry, (b) the breadcrumb `Classes` segment, which is rendered as a clickable link when the class-detail key is active, (c) an in-page `Back to Classes` button on the class page (a `<Button type="default">` with a left-arrow icon, positioned at the top-left of the class page just below the breadcrumb). All three routes set `selectedClassId = null` and the navigation key back to `classes`. The class page owns the in-page button; the breadcrumb and sidebar are owned by the shell. Removed from open questions.
14. **`selectedClassId` lifecycle.** **Resolved.** The shell resets `selectedClassId` to `null` whenever the user navigates to any non-class-detail page (Dashboard, Assignments, Settings, or any future top-level page). The state is only valid when the navigation key is `class-detail`. The class page's in-page `Back to Classes` button, the breadcrumb `Classes` link, and the sidebar `Classes` entry all clear `selectedClassId` and set the navigation key back to `classes`. Removed from open questions.
15. **Should the View button be in a different visual state when it would navigate?** **Resolved — keep the current text-only style.** The View button on each class card remains a plain text button (`type="text"`, no icon, no underline). The cursor changes to `pointer` on hover (default Ant Design behaviour for non-disabled buttons), which is enough of a navigation affordance. The disabled → enabled state change is itself the affordance. Removed from open questions.

### Future (not v1)

16. **Drill-down from a Recent Assignment card to a per-assignment detail view.** Out of scope for v1.
17. **Drill-down from a student row to a per-student detail view.** Out of scope for v1.
18. **Refresh control / invalidation after `Start New Assessment` completes.** The data analysis service should be re-run after a successful assessment; what triggers that? Possibly a button in the page header, or auto-refresh on focus. Defer.
19. **Cohort-level aggregations across multiple classes.** Out of scope (covered by the future cohort analysis in the pedagogy doc). The shared `metricDisplay/` helper is designed to be reusable here.
20. **Per-class "Edit Student Details" functionality.** Out of scope; placeholder only.

## Implementation readiness

- The **three-deliverable ordering** is: (1) `AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead); (2) data analysis service contract change (lead); (3) Class page (dependent). The action plan must respect this ordering. The rename is sequenced first because the data analysis service change touches fixtures and downstream code that share the property name; doing the rename first avoids a mixed intermediate state.
- The data analysis service change includes a mandatory sub-task: facade-pattern decomposition of `averagingAnalyser.accumulation.ts` once it crosses the 550-line threshold (`src/frontend/AGENTS.md` §12). The action plan must include the decomposition explicitly.
- The `AssignmentPartial` rename includes a **mandatory sub-task**: extracting `formatUpdatedAtLabel` from `AssignmentsPage.tsx` to a shared helper module so both `AssignmentsPage` and the new `classPageAdapter` can call it without duplicating the formatting logic. The action plan must include this extraction explicitly.
- The shared `metricDisplay/` helper is justified for shared ownership by the "at least two active call sites" rule (`frontend-shared-helpers-and-abstraction-standards.md` §4.3): the Class page is the first caller, cohort / trend / distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller.
- The `AssignmentPartial` rename is a **deliberate breaking schema change**. No backwards-compat shim. The action plan must include a one-shot rename across the frontend Zod schema, the backend source model, all callers, and all test fixtures.
- The `AssessTaskModal` is reused unchanged.
- Recommended next step: walk through the open questions in this document section by section (especially the data analysis service questions 8, 9, 11), update each with the agreed answer, then expand the skeleton into the full `SPEC.md` and the matching `ACTION_PLAN.md`.
