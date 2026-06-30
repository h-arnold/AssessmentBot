# Class Page Specification

## Status

- **Skeleton draft v1.3** — all 15 open questions in the main list are now resolved. Twelve component-level sections are fleshed out, in dependency order: `metricTone` (pure tone resolver), `MetricPill` (presentational Ant Design `Tag`), `classPageAdapter` (raw-to-canonical view-model translation), `useClassPageData` (data orchestrator hook that calls the adapter), `classPageModel` (filter / sort on top of the adapter output), `RecentAssignmentCard`, `studentAveragesTableColumns` (column definitions for the table), `ClassPageHeaderActions` (header buttons), `StudentAveragesTableCard` (search / select / table card), `RecentAssignmentsSection` (heading + row of cards + empty state), `ClassPage.tsx` (page composition root), and **Shell and routing integration** (cross-cutting changes to `appNavigation.tsx`, `AppShell.tsx`, and `ClassesPage.tsx`). The shell integration is a section because the changes span three existing files rather than introducing a new component. The rollup rule at line 227 was clarified in v1.3: `notAttempted` contributes 0 for accuracy and completeness but is excluded from SPAG; the adapter section's equivalent rule and summary were updated to match.
- The card-section open question on the "Completed:" wording is **resolved** as a side effect of a bigger decision (see below). The label is **Last Assessed** (not "Completed"), the field is `updatedAt` (not `lastUpdated`), and a null `updatedAt` is a data bug that fails fast at the adapter boundary.
- The card-section open question on the **empty state** is also **resolved**: the section renders an Ant Design `Empty` with a primary `Start New Assessment` CTA that opens the existing `AssessTaskModal`. The same callback is shared with the header button via the page-level composition root.
- The spec is **complete at the component level**. All component-level decisions for v1 are captured. The next step is to draft `ACTION_PLAN.md` (a TDD-first delivery plan) against the agreed contracts. The action plan must respect the three-deliverable ordering (rename → data analysis service → Class page) and the file-separation projections.
- The feature spans **three deliverables** that must be sequenced: (1) `AssignmentPartial` `lastUpdated` → `updatedAt` rename (lead), (2) data analysis service contract change (lead), (3) the Class page (dependent). The rename is sequenced before the data analysis service change because the data analysis service touches fixtures and downstream code that share the property name. The full ordering is documented in the **Implementation readiness** section.
- The user confirmed: (a) fix the `N` vs `E` distinction in the data analysis service rather than plaster over it in the display; (b) supersede the "amber = 3" anchor in favour of a dynamic midpoint rule; (c) **rename `lastUpdated` to `updatedAt` on `AssignmentPartial`** as a deliberate breaking change with no backwards-compat shim, so the field name is consistent with the rest of the codebase; the card's "Last Assessed" line reads from `updatedAt`, and a null `updatedAt` on a candidate assignment is a data bug that fails fast at the adapter boundary (page renders blocking state); (d) the Recent Assignment Card title should be the assignment name (not the literal "Recent Assignments" repeated on every card — the section heading renders that once); (e) the Average cell is visually emphasised while the other three cells are uniform; (f) the card is fully static with no hover or click handler for v1.
- Open questions deliberately deferred to a future iteration are listed in the **Open questions** section at the end; the future items (drill-down, refresh control, cohort aggregations) are out of scope for v1.

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

For the card's "Last Assessed" line, the per-assignment-instance activity timestamp is the correct semantic. Today that field is named `lastUpdated`, which is inconsistent with the rest of the codebase. The rename of the field itself is a naming change (the wire shape, the on-disk model, and the test fixtures all need to be updated to emit `updatedAt` instead of `lastUpdated`). However, this deliverable also changes the **null-handling contract**: after the rename, a `null` `updatedAt` on a candidate assignment is a data bug that causes a throw at the adapter boundary (see "Fail-fast semantics" below), rather than silently dropping the assignment. This null-handling change is a semantic change, not a pure naming change.

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

- **`src/backend/Models/Assignment.js`** — rename `this.lastUpdated` to `this.updatedAt`; update `toPartialJSON()` (line 77) to emit `updatedAt`; rename methods `getLastUpdated` → `getUpdatedAt`, `setLastUpdated` → `setUpdatedAt`, `touchUpdated` → `touchUpdated` (this method name already uses the new convention and is fine as-is, but verify); update `knownFields` to reflect the new field name.
- **`src/backend/y_controllers/AssignmentController.js`** — update the stale comment at line 152 (`// Update lastUpdated value and persist assignment data`) to reference `updatedAt`.
- **No change needed in `src/backend/z_Api/abclass/abclassRead.js`** — the `getABClass` transport handler delegates to `ABClassController.readClass()`, which relies on `Assignment.toPartialJSON()` for serialising the per-assignment fields. The rename is fully contained within `Assignment.js`; no date normalisation is performed at this handler level (see the existing JSDoc in `abclassRead.js:50-56`).
- **`src/backend/z_Api/assignmentAssessment.js`** — update `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` (line 141) to use `'updatedAt'` instead of `'lastUpdated'`. This is critical: missing this rename would cause the date-normalisation step to silently skip the renamed field, leaving live `Date` objects in the response that violate `google.script.run` serialisation constraints.
- **Backend test fixtures** — update any backend test fixtures that use the field name, including `tests/api/assignmentLastUpdated.test.js` (if it exists).
- **Backend documentation** — update any canonical doc that references `Assignment.lastUpdated` (e.g., `docs/developer/backend/`, `docs/architecture/`).
- **`src/frontend/src/features/classPage/classPageAdapter.ts`** — read `updatedAt` (not `lastUpdated`); implement the fail-fast throw when the field is null on a candidate assignment.
- **Documentation** — update any canonical doc that references the field by name.

**Explicitly out of scope for this rename:** `scripts/builder/vendor/` `CollectionMetadata` and `99_MasterIndex.js` — these use `lastUpdated` in a different domain (builder metadata), not `Assignment` model data. Do not rename them.

### Sequencing rationale

This deliverable leads the data analysis service change because the data analysis service touches fixtures and downstream code that share the property name. If the data analysis service change went first, the new `MetricResult` discriminated union would land on a model whose `AssignmentPartial.lastUpdated` field is about to be renamed, creating churn in the test fixtures and risking a mixed intermediate state. By doing the rename first, the data analysis service change happens on a clean schema.

The full sequencing is: (1) rename, (2) data analysis service change, (3) Class page. The action plan must respect this ordering.

### What this deliverable does NOT change

- The `MetricResult` shape is unchanged. The discriminator state (`computed` / `notAttempted` / `error`) is unaffected by the rename.
- The `ClassFull` shape is unchanged. The field is renamed on the inner `AssignmentPartial`, not on `ClassFull`.
- The `getABClass` API surface is unchanged. The wire shape changes (the field name changes), but the method signature and response envelope are the same.
- The card's "Last Assessed" label is new for v1; existing surfaces that consume `AssignmentPartial.lastUpdated` are updated to read `AssignmentPartial.updatedAt` in the same change. (Note: `AssignmentsPage.tsx` already passes `row.updatedAt` and does not need a rename.)

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
  totalWeight: z.number().min(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(0), // may be > 0 when submissions exist but have no assessments
});

export const MetricResultSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ErrorMetricSchema,
]);
```

The `state` discriminator is the primary key; consumers branch on it. The `value` field is a `number` for `computed`, the literal `'N'` for `notAttempted`, and the literal `'E'` for `error`. The numeric invariant is no longer encoded as a Zod `.refine()` — it falls out of the discriminated union naturally.

**Important:** the `'E'` literal exists **only** in the `MetricResult` discriminated union (the analyser's output). It is **not** added to `PartialAssessmentScoreSchema` (`classDetailService.zod.ts:10-13`), which validates backend wire data and stays `number | 'N'`. The backend storage model does not produce `'E'` — a failed assessment simply has no entry in the `assessments` dict (`{}`). The `'E'` state is produced by the analyser when it has seen zero usable data points for a particular metric at a particular aggregation level.

### State assignment rules (v1)

The accumulator in `averagingAnalyser.accumulation.ts` is updated so each per-criterion sub-accumulator produces one of the three states based on the data it has seen (per the strict trigger resolved in open question 8). The `MetricAccumulator` interface is extended with an `nCount: number` field (initialised to 0 in `createAccumulator`) that tracks how many raw `'N'` scores were seen per criterion, so the accumulator can distinguish `notAttempted` from `error` at conversion time.

| Condition                                                                          | State          | Value         |
| ---------------------------------------------------------------------------------- | -------------- | ------------- |
| At least one numeric score (`applicableDataPoints > 0`)                            | `computed`     | weighted mean |
| No numeric scores but at least one raw `'N'` score (`nCount > 0`)                  | `notAttempted` | `'N'`         |
| No scores at all — `nCount === 0` and `applicableDataPoints === 0`                 | `error`        | `'E'`         |
| (submissions exist, no assessments performed, or all scores structurally unusable) |                |               |

A "mixed" case (e.g., a student with one numeric score and one `'N'`) produces `computed` — the `'N'` is dropped from the average, consistent with the existing SPaG-renormalisation rule (`data-analysis-scoring.md:71-77`).

**Rollup rule (per-student, per-class, per-assignment):** when rolling sub-accumulator states upward, classify them into `computed` / `notAttempted` / `error` and apply the following precedence:

1. If **any** sub-accumulator is `computed`, the rollup is `computed` — but only the `computed` and `notAttempted` sub-accumulators participate in the weighted average (not attempted assigns a score of 0 for accuracy and completeness, but does not affect the SPAG score); `error` sub-accumulators are excluded from the calculation.
2. If **no** sub-accumulator is `computed` but **at least one** is `notAttempted`, the rollup is `notAttempted`.
3. Otherwise (all sub-accumulators are `error`), the rollup is `error`.

Rationale: the LLM service sometimes fails on a single task; blocking the entire assignment's computation for one task failure is overkill and limits the usefulness of the tool. `error` sub-tasks are excluded gracefully, not propagated. The rollup only escalates to `error` when there is nothing left to average over.

**Failure modes that produce a hard throw (not `error` state):** divide-by-zero during weighted averaging on this criterion, `NaN`/`Infinity` in the result, unexpected schema-shape violations. These are not caught and converted to `error`; they propagate as exceptions from the data analysis service, and the page surfaces them as a blocking state via the existing fail-closed pattern (`frontend-loading-and-width-standards.md` §5). The accumulator's contract is the three-state assignment; defensive guards for `NaN`/`Infinity` etc. are not added in v1.

### Files affected by this deliverable

- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`** — replace the `MetricResultSchema` definition per the new shape. Update `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, `PerClassResult`, and `DataAnalysisResponseSchema` to thread the new `MetricResult` shape through.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`** — update `accumulateMetricsToTarget` to track `'N'` scores via the new `nCount` field on each sub-accumulator. Update `accumToMetric` to map the accumulator state to a `MetricResult` discriminated union value using the three-way check (`applicableDataPoints > 0` → `computed`, `nCount > 0` → `notAttempted`, otherwise `error`). Also extract a shared `rollupMetric` helper (see the rollup rule above) used by both `buildPerStudentRows` and `buildPerTaskRows`.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`** — update `buildPerStudentRows` and `buildPerTaskRows` to call the shared `rollupMetric` helper when aggregating across sub-accumulators, rather than calling `accumToMetric` directly on each sub-accumulator. This ensures both row builders apply the same `error` > `notAttempted` > `computed` precedence rule.
- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`** — rewrite the `MetricResultSchema` test cases for the discriminated union. Add explicit tests for each of the three states.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`** — rewrite the accumulator tests to assert the state output.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`** — rewrite the per-student / per-task rollup tests with the new state.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`** — update the end-to-end analyser tests to assert the new state shape.
- **`src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`** — update the orchestrator tests.
- **`src/frontend/src/test/dataAnalysis/fixtures.ts`** — update or add fixtures that produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs, so the new tests can reuse them.
- **`docs/pedagogy/data-analysis-scoring.md`** — update the table at line 79–88 ("Understanding the numbers in the results table") to describe the three states. The "Value" row needs to distinguish the number case from the `N` case from the `E` case.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`** — extend the `MetricAccumulator` interface with an `nCount: number` field (initialised to 0 in `createAccumulator`) so the accumulator can distinguish `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and `applicableDataPoints === 0`). The `AssessmentScore` type stays `number | 'N' | undefined`; the `'E'` literal does not appear here because it is a `MetricResult`-output concept, not a raw-score concept.

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

- **`src/frontend/src/pages/ClassPage.tsx`** — page composition root. Owns the heading, summary, header actions, modal state, and delegates to the feature components. Full contract in [Component-level behaviour — `ClassPage.tsx` (composition root)](#component-level-behaviour--classpagetx-composition-root) above.
- **`src/frontend/src/pages/pageContent.ts`** — add a `classDetail` entry (heading + summary strings) so the breadcrumb and page both read from one source.

### Feature-level (`src/frontend/src/features/classPage/`)

- **`useClassPageData.ts`** — orchestrates the per-class `getABClass` query, the warm-up-backed `assignmentDefinitionPartials` read, the `DataAnalysisService.analyse(...)` call, and the `classPageAdapter.adaptClassPageToViewModel(...)` call. Produces a typed `ClassPageData` result with the loading / blocking / ready / busy surface state per the loading-and-width-standards policy. Full contract in [Component-level behaviour — `useClassPageData`](#component-level-behaviour--useclasspagedata) below.
- **`classPageModel.ts`** (or `.ts`) — pure view-model builder. Takes the adapter's canonical output plus the current search and sort state, and produces the final view-model shape consumed by the Student Averages table. Pure function, no I/O. Full contract in [Component-level behaviour — `classPageModel`](#component-level-behaviour--classpagemodel) above.
- **`classPageAdapter.ts`** (with optional `classPageAdapter.zod.ts`) — adapter layer. The only module that knows how to translate the analyser's `AveragingResult` (and the raw `ClassFull`) into the view-model shape. Sibling to `classPageModel.ts` so the two concerns stay separate (aggregation / ordering logic in the model, raw-to-view mapping in the adapter). Consumes the new `MetricResult` discriminated union from the data analysis service change. Full contract in [Component-level behaviour — `classPageAdapter`](#component-level-behaviour--classpageadapter) above.
- **`RecentAssignmentsSection.tsx`** — presentational container that renders the centred row of up-to-three `RecentAssignmentCard` instances and the empty state. Accepts a `onStartNewAssessment: () => void` callback prop; when the section is empty, it renders an Ant Design `Empty` with a primary `Start New Assessment` button that calls the callback. No state, no data fetching. Full contract in [Component-level behaviour — `RecentAssignmentsSection`](#component-level-behaviour--recentassignmentssection) above.
- **`RecentAssignmentCard.tsx`** — one card. Receives a fully-built `RecentAssignmentCardModel` (per [Component-level behaviour — RecentAssignmentCard](#component-level-behaviour--recentassignmentcard) above) and renders the title, last-assessed line, and four `MetricPill` instances. Pure presentational, no data fetching, no click handler, no hoverable.
- **`StudentAveragesTableCard.tsx`** — `Card` wrapping the view-control row (a `Select` with the single placeholder option `Overall Class Averages` marked `disabled` in v1, plus a search `Input`) and the `Table`. No data fetching. Full contract in [Component-level behaviour — `StudentAveragesTableCard`](#component-level-behaviour--studentaveragestablecard) above. The Select's `disabled` state and the placeholder option are the v1 contract; the layout spec records the exact label and styling.
- **`studentAveragesTableColumns.tsx`** — column definitions for the table (one source of truth for column keys, headers, sort/filter wiring, pill rendering). Each metric column's `render` function delegates to `MetricPill` (see Shared display helpers below). Full contract in [Component-level behaviour — `studentAveragesTableColumns`](#component-level-behaviour--studentaveragestablecolumns) above.
- **`ClassPageHeaderActions.tsx`** — presentational component for the two top-right buttons. Receives a `onStartNewAssessment: () => void` callback prop and passes it through to its `Start New Assessment` button (the same callback used by the empty state in `RecentAssignmentsSection`). Owns the tooltip on the disabled `Edit Student Details`. Does not own the `AssessTaskModal` open/close state — that lives in the page-level composition root. Full contract in [Component-level behaviour — `ClassPageHeaderActions`](#component-level-behaviour--classpageheaderactions) above.

### Shared display helpers (`src/frontend/src/services/dataAnalysis/metricDisplay/`)

This subfolder is created because the `MetricPill` and its tone resolver are conceptually bound to the `MetricResult` shape produced by the data analysis service. At least two production files (`metricTone.ts`, `MetricPill.tsx`, and their spec companions) share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §12. The Class page is the first caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller, so the helper is **shared** rather than feature-local.

- **`metricTone.ts`** — pure tone resolver. Full contract in [Component-level behaviour — `metricTone`](#component-level-behaviour--metrictone) below. Co-located `metricTone.spec.ts`.
- **`MetricPill.tsx`** — presentational component that renders an Ant Design `Tag`. Full contract in [Component-level behaviour — `MetricPill`](#component-level-behaviour--metricpill) below. Co-located `MetricPill.spec.tsx`.
- **`index.ts`** — barrel re-export of the two above so feature code can import `import { MetricPill } from 'src/frontend/src/services/dataAnalysis/metricDisplay';` (per `src/frontend/AGENTS.md` §12, barrels are optional but reasonable when a service domain exports a small, cohesive set of unrelated symbols).

### Navigation / shell plumbing

The cross-cutting changes to the shell, the navigation registry, and the existing `ClassesPage` are documented in full in the [Shell and routing integration](#shell-and-routing-integration) section above. The bullets below are a brief overview; the full contract is in that section.

- **`src/frontend/src/navigation/appNavigation.tsx`** — extend `AppNavigationKey` to include `'class-detail'`; extend the breadcrumb builder to support three segments when the class-detail key is active, with the second segment (`Classes`) rendered as a clickable link that navigates back to `classes`; extend `renderNavigationPage` to switch on the new key and pass through the selected `classId`.
- **`src/frontend/src/AppShell.tsx`** — hold a `selectedClassId` in shell state (alongside `selectedNavigationKey`); clear it when navigation moves away from `class-detail`; ensure the Sidebar still highlights `classes` when the class-detail key is active. Three back affordances are wired: the sidebar `Classes` entry, the breadcrumb `Classes` link, and an in-page `Back to Classes` button on the class page. All three routes set `selectedClassId = null` and the navigation key back to `classes`.
- **`src/frontend/src/pages/ClassesPage.tsx`** — enable the View button: remove the `disabled` and `tabIndex={-1}` attributes; on click, set the shell's `selectedClassId` and switch the nav key to `class-detail`.

### Reused, unchanged

- `AssessTaskModal` (`src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`) — same props contract (`open`, `classId`, `className`, `onClose`).
- `DataAnalysisService` (orchestrator) — the public `analyse(input, analyserKey)` entry point and its `AveragingAnalyser` registry stay intact. **The internal `MetricResult` shape changes** per the Data analysis service changes section above; this is an internal contract change, not a public API change.
- `getABClass` / `getABClassQueryOptions` (`src/frontend/src/services/googleClassrooms/classDetail/`, `src/frontend/src/query/sharedQueries.ts`).
- `usePageDataset` / `useStartupWarmupState` for the `assignmentDefinitionPartials` warm-up-backed read.
- `useQuery` directly for the per-class `abClass` query (per `frontend-react-query-and-prefetch.md` §2 — `abClass` is explicitly not warmup-backed).

## Component-level behaviour — `metricTone`

This section pins down the contract for `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`. It is the source of truth for the tone resolver; the `MetricPill` component (next section) and any future caller (cohort / trend / distribution analyses per `docs/pedagogy/data-analysis-scoring.md:92-99`) inherit this contract verbatim.

### Purpose and scope

`metricTone` is a pure function that maps a `MetricResult` (the new discriminated union produced by the data analysis service) plus an optional scoring range to a `MetricToneResolution` describing the Ant Design `Tag` color, the raw display value, and a muted flag.

**In scope**

- Resolving the `color` token (`red` / `gold` / `green` / `default` / `volcano`) for the three `MetricResult` states plus the three `computed` bands.
- Resolving the raw `displayValue` (`number` for `computed`, literal `'N'` for `notAttempted`, literal `'E'` for `error`).
- Resolving the `muted` boolean (`true` for `notAttempted`, `false` otherwise).
- Applying the dynamic midpoint rule (decision 11) for the `computed` bands.

**Out of scope** (rendered or owned elsewhere)

- Number formatting (precision) — owned by `MetricPill`.
- The Ant Design `Tag` rendering — owned by `MetricPill`.
- The `MetricResult` discriminated union definition — owned by the data analysis service.
- The `emphasised` flag — owned by `MetricPill` (it is a presentational concern, not a tone-resolution concern).
- Any I/O, React, or Ant Design concern.

### Inputs

```ts
// Sketch only — the canonical type lives in metricTone.ts
type MetricToneRange = { lower: number; upper: number };

function resolveMetricTone(
  metric: MetricResult, // required: the new discriminated union
  range: MetricToneRange = { lower: 0, upper: 5 }, // optional, default { lower: 0, upper: 5 }
  errorColor: 'volcano' = 'volcano' // optional, default 'volcano'; pass-through for testability
): MetricToneResolution;
```

**Field notes**

- `metric` is the `MetricResult` discriminated union. The function branches on `metric.state`.
- `range` defines the scoring scale's lower and upper bounds. The function uses the dynamic midpoint rule (decision 11) to derive the red / amber / green band thresholds from the range. For the default range `{ lower: 0, upper: 5 }`, the thresholds are red below `1.25`, amber `[1.25, 3.75)`, green `[3.75, ∞)`. For a 0-100 range, the thresholds are red below `25`, amber `[25, 75)`, green `[75, 100]`. The helper does not validate that `range.upper > range.lower`; passing a degenerate range is undefined behaviour in v1.
- `errorColor` is the Ant Design `Tag` color token used for the `error` state. Default `'volcano'`. Exposed for testability and for future visual revisions (e.g. switching to a different Ant Design preset if `'volcano'` is replaced). `MetricPill` passes its own `errorColor` prop through to this parameter; the default is identical at both layers.

### Outputs

```ts
// Sketch only — the canonical type lives in metricTone.ts
type MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano';

type MetricToneResolution = {
  color: MetricToneColor; // the Ant Design Tag color token
  displayValue: number | 'N' | 'E'; // the raw, unformatted value to display
  muted: boolean; // true for notAttempted, false otherwise
};
```

**Field notes**

- `color` is one of the Ant Design `Tag` preset color tokens. `MetricPill` passes this to `<Tag color={...} />`. The five tokens cover the three `computed` bands (`red`, `gold`, `green`), the `notAttempted` state (`default` = grey), and the `error` state (`volcano`, overridable via `errorColor`).
- `displayValue` is the raw, unformatted value. For `computed`, it is `metric.value` as a `number` (no precision formatting applied). For `notAttempted`, the literal `'N'`. For `error`, the literal `'E'`. `MetricPill` applies the `precision` formatting to numeric values when rendering.
- `muted` is `true` for `notAttempted` and `false` for `computed` and `error`. `MetricPill` uses this to apply additional visual de-emphasis (e.g. `opacity: 0.7`) to the `notAttempted` pill beyond just the `default` (grey) color. The exact opacity value is a layout-spec concern.

### Tone resolution rules (v1)

The `resolveMetricTone` function applies the dynamic midpoint rule (decision 11) plus the state discriminator:

| `state`        | Value range condition                                   | `color`                            | `displayValue` | `muted` |
| -------------- | ------------------------------------------------------- | ---------------------------------- | -------------- | ------- |
| `computed`     | `value < (3·lower + upper) / 4`                         | `red`                              | `metric.value` | `false` |
| `computed`     | `(3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4` | `gold`                             | `metric.value` | `false` |
| `computed`     | `value ≥ (lower + 3·upper) / 4`                         | `green`                            | `metric.value` | `false` |
| `notAttempted` | (any)                                                   | `default`                          | `'N'`          | `true`  |
| `error`        | (any)                                                   | `errorColor` (default `'volcano'`) | `'E'`          | `false` |

For the default range `{ lower: 0, upper: 5 }`:

- Red threshold: `1.25`
- Amber thresholds: `1.25 ≤ value < 3.75`
- Green threshold: `3.75`

The `error` color (`volcano`) is the existing Ant Design preset for "important but not fatal" — red is reserved for the lowest band of `computed` values to keep the visual hierarchy clear (worst score = red, processing error = volcano). The user is open to a different error color; `errorColor` is exposed for testability and future visual revisions.

### Behaviour

- **Pure function.** No side effects, no React imports, no Ant Design imports, no I/O, no state, no thrown exceptions.
- **Defaults live in the function signature** (per `src/frontend/AGENTS.md` §11). `range` defaults to `{ lower: 0, upper: 5 }`; `errorColor` defaults to `'volcano'`.
- **No range validation.** A `range.upper <= range.lower` is undefined behaviour in v1; the helper does not throw or warn.
- **No `NaN` / `Infinity` guards.** The `metric.value` is taken as-is for `computed` states. If a caller passes a `MetricResult` with `value: NaN` or `value: Infinity`, the function returns the value through; the data analysis service is contractually responsible for not producing such values (see "Failure modes that produce a hard throw" in the Data analysis service changes section).
- **No caching / memoisation.** The function is cheap to call; `MetricPill` invokes it on every render. If a future caller discovers a hot path, memoisation is a localised change inside `MetricPill`.

### Composition

- `metricTone` is called only by `MetricPill` in v1. Future callers (cohort, trend, distribution analyses per `docs/pedagogy/data-analysis-scoring.md:92-99`) can import it directly from the `metricDisplay` barrel.
- The helper is **not** called by `classPageAdapter` or `classPageModel` — those modules deal in `MetricResult` values, not `MetricToneResolution` values. The mapping from `MetricResult` to `MetricToneResolution` happens in the presentational layer (`MetricPill`).
- The helper is **not** called by `useClassPageData` — that hook deals in `MetricResult` values and feature-specific shapes.

### Open questions

None. All decisions for v1 are captured above.

## Component-level behaviour — `MetricPill`

This section pins down the contract for `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`. It is the source of truth for the presentational pill; the `RecentAssignmentCard` and `studentAveragesTableColumns` consumers inherit this contract verbatim.

### Purpose and scope

`MetricPill` is a presentational React component that renders a `MetricResult` as an Ant Design `Tag` with the resolved color, the formatted display value, and optional emphasis / muted styles.

**In scope**

- Calling `resolveMetricTone` (from the previous section) with the supplied `metric` and `range`.
- Applying the `precision` formatting to `computed` numeric values (default 2 decimal places).
- Rendering an Ant Design `Tag` (`variant="filled"`) with the resolved color and the formatted display value.
- Applying the `emphasised` style (larger font, bolder weight) when `emphasised={true}`.
- Applying the `muted` style (lower opacity) when the resolved `muted === true`.

**Out of scope** (rendered or owned elsewhere)

- The tone-resolution rules (color, display value, muted) — owned by `metricTone`.
- The `MetricResult` discriminated union definition — owned by the data analysis service.
- The pill's position within a cell or its cell's layout — owned by the consumer (e.g. `RecentAssignmentCard`, `studentAveragesTableColumns`).
- The Ant Design `Tooltip` wrapper for screen-reader-friendly copy — deferred to v1.1.

### Inputs — `MetricPillProps`

```ts
// Sketch only — the canonical type lives in MetricPill.tsx
type MetricPillProps = {
  metric: MetricResult; // required: the new discriminated union
  range?: { lower: number; upper: number }; // optional, default { lower: 0, upper: 5 }
  emphasised?: boolean; // optional, default false
  precision?: number; // optional, default 2
  errorColor?: 'volcano'; // optional, default 'volcano'
};
```

**Field notes**

- `metric` is the `MetricResult` discriminated union. Required.
- `range` is the scoring scale's lower and upper bounds, passed through to `resolveMetricTone`. Optional, default `{ lower: 0, upper: 5 }`.
- `emphasised` controls the visual weight of the pill. When `true`, the pill is larger (~1.25x font size) and bolder (weight 600). Used by the `Average` cell in `RecentAssignmentCard`. Optional, default `false`.
- `precision` controls the number of decimal places for `computed` values. Ignored for `notAttempted` and `error` (the literal `'N'` and `'E'` are always rendered as-is). Optional, default `2`.
- `errorColor` is the Ant Design `Tag` color token used for the `error` state. Passed through to `resolveMetricTone`. Optional, default `'volcano'`. Exposed for testability and for future visual revisions.

### Layout and structure

The component renders a single Ant Design `Tag` with the following structure:

```tsx
<Tag
  color={resolution.color}
  variant="filled"
  style={{
    // Emphasised style: larger font, bolder weight
    ...(emphasised ? { fontSize: '1.25em', fontWeight: 600 } : {}),
    // Muted style: lower opacity (only when notAttempted)
    ...(resolution.muted ? { opacity: 0.7 } : {}),
  }}
>
  {formatDisplayValue(resolution.displayValue, precision)}
</Tag>
```

The exact inline style values (font size, weight, padding, opacity) are layout-spec concerns and will be confirmed against the mockup. The contract is the presence of these styles, not the exact pixel values.

### Rendering rules per `MetricResult` state

| `state`        | Pill display                             | Pill color                                                                                               | `muted` |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `computed`     | `value.toFixed(precision)` (e.g. `2.18`) | `red` / `gold` / `green` based on the range (see [`metricTone`](#component-level-behaviour--metrictone)) | `false` |
| `notAttempted` | `N` (uppercase)                          | `default` (grey)                                                                                         | `true`  |
| `error`        | `E` (uppercase)                          | `errorColor` (default `'volcano'`)                                                                       | `false` |

**Important behavioural notes**

- The pill renders the color and label even when the cell is "degraded" (`notAttempted` or `error`). It does not collapse the cell or hide the pill. A teacher's eye should land on every cell and recognise the state's meaning from the colour + label.
- The pill does **not** add extra copy (e.g. "No data", "Not attempted", "Error"). The label and color are the only signal. This keeps the layout compact and consistent across the cards and the table.
- The pill does **not** add a `Tooltip` in v1. A future iteration may add a `Tooltip` wrapper with screen-reader-friendly copy (e.g. "Completeness: 2.18 out of 5 — Green band") — deferred to v1.1.
- The `emphasised` flag applies to the pill's font size and weight only. It does not change the color, the precision, or the display value.
- The `muted` flag (from `resolveMetricTone`) applies a lower opacity to the pill. It is set only for `notAttempted`; the `computed` and `error` pills are always fully opaque.

### Number formatting

`MetricPill` formats `computed` values to `precision` decimal places (default `2`), matching the mockup (e.g. `2.18`, `3.63`). The formatting uses `Number.prototype.toFixed(precision)`, which is the standard library; no external library is required.

- For `precision = 2` and `value = 2.18`, the display is `'2.18'`.
- For `precision = 2` and `value = 3.6`, the display is `'3.60'` (trailing zero preserved by `toFixed`).
- For `precision = 2` and `value = 5`, the display is `'5.00'`.
- For `notAttempted`, the display is `'N'` (precision ignored).
- For `error`, the display is `'E'` (precision ignored).

The `precision` prop defaults to `2` in the function signature (per `src/frontend/AGENTS.md` §11). Future call sites can override the precision per use case.

### Behaviour

- **Pure presentational.** No React state, no `useEffect`, no data fetching, no callbacks, no refs. The component reads `props` and renders.
- **No defaults inside the component other than the documented ones.** `precision` defaults to `2`, `range` defaults to `{ lower: 0, upper: 5 }`, `emphasised` defaults to `false`, `errorColor` defaults to `'volcano'`. Defaults are set in the function signature (per `src/frontend/AGENTS.md` §11).
- **No interactivity.** No `onClick`, no `cursor: pointer`, no focus ring. The pill is informational only.
- **Accessible.** The Ant Design `Tag` renders its content as plain text in source order. No `aria-label` is added in v1; the pill label and color are the affordance. A future iteration may add a screen-reader-only description (e.g. `Completeness: 2.18 out of 5`) once the product confirms the desired level of detail.
- **No `Tooltip` wrapper in v1.** A `Tooltip` wrapper would change the accessibility tree and require a separate decision; deferred to v1.1.
- **Bounded by loading standards.** When the parent is in the loading state, the pill is replaced by a shape-matched `Skeleton` placeholder. The pill itself does not render a skeleton.

### Composition

`MetricPill` is called by:

- `RecentAssignmentCard` — four pills per card, one per criterion (Completeness, Accuracy, SpAG, Average). The `Average` pill uses `emphasised={true}`. The other three use `emphasised={false}` and the default `range`.
- `studentAveragesTableColumns` — one pill per metric cell in the Student Averages table (four columns: Completeness, Accuracy, SpAG, Average). Whether the `Average` column uses `emphasised={true}` is a layout-spec concern; the contract is that `emphasised` is available to the column definitions.

`MetricPill` is **not** called by `classPageAdapter` or `classPageModel` — those modules deal in `MetricResult` values, not presentational pills.

### Open questions

None. All decisions for v1 are captured above.

## Component-level behaviour — `classPageAdapter`

This section pins down the contract for `src/frontend/src/features/classPage/classPageAdapter.ts` (with the optional co-located `classPageAdapter.zod.ts` for the output Zod schema). It is the source of truth for the adapter layer; `useClassPageData` (the only consumer in v1) and any future test code inherit this contract verbatim.

### Purpose and scope

`classPageAdapter` is the adapter layer that translates the raw data analysis service output (`AveragingResult`) plus the raw class document (`ClassFull`) into the canonical view-model shape consumed by the Class page UI sections. It is the only module that knows how to roll up per-task `MetricResult` values into per-assignment values, sort and limit the recent-assignments list, synthesise no-data rows for unassessed students, pre-format the "Last Assessed" date label, and apply the fail-fast semantics for null `updatedAt`.

**In scope**

- The adapter function `adaptClassPageToViewModel` (pure, synchronous).
- The assignment-level rollup rule: classify sub-tasks into `computed` / `notAttempted` / `error`; weighted average over `computed` and `notAttempted` sub-tasks (with `notAttempted` contributing 0 for accuracy and completeness, and excluded for SPAG and overall); `error` sub-tasks excluded; escalates to `notAttempted` or `error` only when no `computed` sub-tasks exist.
- The recent-assignments sort and limit (top 3 by `updatedAt` desc).
- The student-averages no-data row synthesis (all students from `classFull.students` get a row, with a synthesised `notAttempted` row for unassessed students).
- The date formatting via the shared `formatUpdatedAtLabel` helper.
- The fail-fast semantics for null `updatedAt` (throws, no `—` placeholder).
- The Zod schema for the view-model output (optional co-located `classPageAdapter.zod.ts`).

**Out of scope** (owned elsewhere)

- The analyser itself (`DataAnalysisService.analyse(...)`).
- The `MetricResult` discriminated union definition (owned by the data analysis service).
- The `RecentAssignmentCardModel` shape (owned by `RecentAssignmentCard`; the adapter is the sole producer).
- The `StudentAverageRowModel` shape (owned by `studentAveragesTableColumns`; the adapter is the sole producer).
- User-controlled filtering and sorting (owned by `classPageModel`).
- The `formatUpdatedAtLabel` helper itself (owned by the shared helper module; the `AssignmentPartial` rename deliverable extracts it from `AssignmentsPage.tsx`).
- Date locale configuration (the `en-GB` locale is hardcoded for v1).

### Inputs

```ts
// Sketch only — the canonical signature lives in classPageAdapter.ts
adaptClassPageToViewModel(input: {
  analyserResult: AveragingResult;
  classFull: ClassFull;
}): ClassPageAdapterResult;
```

**Field notes**

- `analyserResult` is the per-class `AveragingResult` from `DataAnalysisService.analyse(...)`. The hook (`useClassPageData`) selects the result matching `classFull.id` from the `DataAnalysisResponse` array.
- `classFull` is the single-class document from `getABClass({ classId })`. Non-null; the hook does not call the adapter when `classFull` is null.
- The function throws if any candidate assignment has `updatedAt === null` (decision 12). The hook catches the throw and surfaces it as a blocking state via the structured `error.type === 'adapterError'` field.
- The function throws if `classFull` is structurally invalid (e.g. duplicate student IDs, malformed assignments). The hook surfaces the throw as a blocking state.

### Outputs

```ts
// Sketch only — the canonical type lives in classPageAdapter.zod.ts
type ClassPageAdapterResult = {
  recentAssignments: RecentAssignmentCardModel[]; // top 3, sorted by updatedAt desc
  studentAverages: StudentAverageRowModel[]; // full roster, sorted by studentName asc
  classMetrics: {
    completeness: MetricResult;
    accuracy: MetricResult;
    spag: MetricResult;
    overall: MetricResult;
  };
};
```

**Field notes**

- `recentAssignments` is the top-3 list of `RecentAssignmentCardModel`, sorted by `updatedAt` desc. May be empty (if the class has no assignments). Each model includes `assignmentId`, `assignmentName`, `lastAssessedAt` (ISO), `lastAssessedAtLabel` (pre-formatted), and `metrics: { completeness, accuracy, spag, average }` (each a `MetricResult`). The "Recent" name reflects this top-3 limit.
- `studentAverages` is the full roster with no-data rows synthesised. Each row is a `StudentAverageRowModel` with `studentId`, `studentName`, and `metrics: { completeness, accuracy, spag, average }` (each a `MetricResult`). Sorted by `studentName` asc (canonical, default sort).
- `classMetrics` is the passthrough of the analyser's `perClass` field. Each metric is a `MetricResult`.
- The output is the **canonical** view-model: no user-controlled filtering or sorting is applied here. The `classPageModel` applies the search filter and sort at render time.

### Adapter responsibilities

#### Recent assignments rollup

For each `AssignmentPartial` in `classFull.assignments`:

1. Find the matching `perTask` rows in `analyserResult.perTask` (by `definitionKey`).
2. Roll the per-task `MetricResult` values into a per-assignment value for each of the four criteria using the rollup rule below.
3. Build a `RecentAssignmentCardModel` with the rolled-up metrics.
4. If `assignment.updatedAt === null`, throw with a structured `Error` (decision 12). The error message references the `assignmentId` for diagnostics.
5. Otherwise, format the date via `formatUpdatedAtLabel` and store the result in `lastAssessedAtLabel`. The raw ISO string is also stored in `lastAssessedAt`.

After building all models, sort by `updatedAt` desc, take the top 3. If fewer than 3 assignments exist, return whatever is available. The "Recent" name reflects this top-3 limit.

#### Assignment-level rollup rule

For each of the four criteria (`completeness`, `accuracy`, `spag`, `average`), classify sub-tasks into `computed` / `notAttempted` / `error`:

- If zero sub-tasks are `computed` and all sub-tasks are `error`, the rolled metric is `error`.
- If zero sub-tasks are `computed` and **at least one** sub-task is `notAttempted`, the rolled metric is `notAttempted`.
- Otherwise (at least one `computed` sub-task), compute a weighted average over the `computed` and `notAttempted` sub-tasks only, with `error` sub-tasks excluded. The handling of `notAttempted` sub-tasks depends on the metric:
  - For **accuracy** and **completeness**: `notAttempted` contributes a score of **0** — its weight is included in the denominator, zero in the numerator.
  - For **SPAG** and the **average (overall)**: `notAttempted` is excluded from the calculation — its weight is not counted in the denominator, consistent with the principle that SPAG cannot be assessed on unsubmitted work, and that the overall is a composite of the three per-criterion rollups.

The rationale: the LLM service sometimes fails on a single task; blocking the entire assignment's computation for one task failure is overkill and limits the usefulness of the tool. `error` sub-tasks are excluded gracefully, not propagated. The rollup only escalates to `error` when there's nothing left to average over. The per-metric differentiation for `notAttempted` reflects the pedagogical reality that unsubmitted work correctly scores 0 for completion and correctness but cannot be evaluated for SPAG.

The same rule is applied to the analyser's per-student and per-class rollups (see the "Data analysis service changes" lead deliverable section, rollup rule at line 227). The adapter's assignment-level rollup is the fourth application of the rule.

#### Student averages — full roster, with no-data rows

`studentAverages` rows cover **all** students in `classFull.students`, not just the ones the analyser returned. The adapter:

1. Builds a lookup map: `studentId → PerStudentRow` from `analyserResult.perStudent`.
2. For each student in `classFull.students`:
   - If the student is in the lookup map, use the analyser's `PerStudentRow` (which is already a `MetricResult` discriminated union value).
   - Otherwise, synthesise a no-data row with all four criteria as `notAttempted`: `{ state: 'notAttempted', value: 'N', applicableDataPoints: 0, totalDataPoints: 0 }`.
3. Build a `StudentAverageRowModel` for each student with the student ID, student name, and the four metrics.
4. Sort by `studentName` ascending (case-insensitive, locale-aware, with `studentId` as the deterministic tie-breaker).

The `notAttempted` state already supports the no-data case, so no new discriminator is needed.

#### Class metrics passthrough

`classMetrics` is the analyser's `perClass` field passed through unchanged. Each metric is a `MetricResult`.

#### Date formatting

The card's "Last Assessed: {date}" line is formatted from `updatedAt` in `en-GB` locale (consistent with `AssignmentsPage.formatUpdatedAtLabel`). The adapter:

1. Calls the shared `formatUpdatedAtLabel` helper (extracted from `AssignmentsPage.tsx` to a shared module as part of the `AssignmentPartial` rename deliverable).
2. Stores the result in `lastAssessedAtLabel`.
3. The raw `lastAssessedAt` ISO string is also retained in the model for future use (e.g. drill-down or sort).

The `—` fallback in `formatUpdatedAtLabel` is **not** used for the class page. A null or unparseable `updatedAt` is a data bug and the adapter throws. The data integrity bar for the "Last Assessed" line is higher than for a generic table cell.

#### Trust validation

The adapter validates the input shape via Zod before processing. If `classFull` is structurally invalid (e.g. duplicate student IDs, missing required fields, malformed assignments), the adapter throws. The hook surfaces the throw as a blocking state.

The adapter does **not** validate the `MetricResult` discriminated union; that is the analyser's responsibility (the analyser validates via Zod before returning).

### Behaviour

- **Pure function.** No I/O, no React imports, no React Query, no Ant Design imports. The only side effect is throwing on data integrity violations.
- **Synchronous.** No `await` calls, no `Promise` returns.
- **No defaults inside the adapter.** All inputs are required. The function does not set default ranges, default precision, or default sort. Defaults live in the consumer's constructor or in the shared helpers (`metricTone`, `MetricPill`).
- **No caching / memoisation.** The hook calls the adapter inside a `useMemo`. If a future caller needs caching, memoisation is the consumer's responsibility.
- **Fail loudly.** The adapter throws on data integrity violations (null `updatedAt`, structurally invalid `classFull`, unparseable `updatedAt`). The hook catches the throw and surfaces it as a blocking state.
- **No locale configuration.** The `en-GB` locale is hardcoded for v1. Future i18n work would extract this to a shared locale constant.
- **Accessibility semantics are not owned by the adapter.** The adapter produces data; the page renders the accessible UI.

### Composition

- The adapter is called by `useClassPageData` inside a `useMemo` keyed on `[analyserResult, classFull]`. The adapter is the only consumer in v1.
- The adapter calls the shared `formatUpdatedAtLabel` helper (extracted from `AssignmentsPage.tsx`).
- The adapter does **not** call the analyser. The analyser is called by the hook before the adapter.
- The adapter is **not** called by `classPageModel` (the model takes the adapter's output, not the raw inputs).
- The adapter is **not** called by any presentational component directly. All access goes through the hook.

### Open questions

None. All decisions for v1 are captured above.

## Component-level behaviour — `useClassPageData`

This section pins down the contract for `src/frontend/src/features/classPage/useClassPageData.ts`. It is the source of truth for the data orchestrator hook; the `ClassPage` composition root consumes its output and decides what to render.

### Purpose and scope

`useClassPageData` is the data orchestrator hook for the Class page. It wires together the per-class query (`getABClass({ classId })`), the warm-up-backed read of `assignmentDefinitionPartials`, the synchronous `DataAnalysisService.analyse(...)` call, and the `classPageAdapter.adaptClassPageToViewModel(...)` call. The hook produces a single typed `ClassPageData` result that includes the raw inputs, the derived analyser + adapter output, the structured error (if any), and the combined loading / blocking / ready / busy surface state per `frontend-loading-and-width-standards.md` §2-§5.

**In scope**

- Reading the per-class query via `useQuery` with `getABClassQueryOptions(classId)`.
- Reading the warm-up-backed `assignmentDefinitionPartials` dataset via `usePageDataset('assignmentDefinitionPartials')`.
- Calling the analyser inside a `useMemo` once both inputs are available; capturing any thrown error.
- Calling the adapter inside a `useMemo` once the analyser result is available; capturing any thrown error.
- Combining the per-class query state, the warm-up-backed dataset state, and the analyser / adapter outcomes into a single `ClassPageData` result with the surface state.
- Computing the busy state from the underlying query's `isFetching` flags.

**Out of scope** (rendered or owned elsewhere)

- The analyser and adapter themselves — owned by `services/dataAnalysis` and `features/classPage/classPageAdapter.ts` respectively. The hook only invokes them.
- The model (user-controlled filtering / sorting) — owned by `features/classPage/classPageModel.ts` and called at render time by the section components that own the user-controlled state (search term, sort column). The hook produces the adapter's canonical view-model, not the filtered / sorted view-model.
- The `AssessTaskModal` open / close state — owned by the page-level composition root.
- The page rendering decisions (skeleton, blocking, content) — owned by the page-level composition root, which reads `ClassPageData.surfaceState` and `ClassPageData.isBusy`.
- The `selectedClassId` shell state — owned by `AppShell`.
- The loading / blocking primitive components themselves (skeleton, `Alert`) — owned by the page-level composition root. The hook exposes the state; the page renders the primitive.

### Inputs

```ts
// Sketch only — the canonical type lives in useClassPageData.ts
function useClassPageData(classId: string): ClassPageData;
```

**Field notes**

- `classId` is the selected class's ID. The page-level composition root reads this from the shell's `selectedClassId` state. The hook does not own this state; it is passed in as a hook argument.
- The hook is reactive to `classId` changes: if the user navigates from one class to another via the breadcrumb or sidebar, the hook's inputs change and the surface state transitions through loading / blocking / ready accordingly. React Query's `queryKey: queryKeys.abClass(classId)` handles the per-class query keying.

### Output — `ClassPageData`

```ts
// Sketch only — the canonical type lives in useClassPageData.ts
type ClassPageData = Readonly<{
  // Raw per-class query
  classFull: ClassFull | null;
  classFullQuery: UseQueryResult<ClassFull | null, Error>;

  // Raw warm-up-backed dataset
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null;
  assignmentDefinitionPartialsDatasetState: PageDatasetState;

  // Derived analyser + adapter output
  analyserResult: AveragingResult | null;
  adapterResult: ClassPageAdapterResult | null;

  // The structured error (null if no error)
  error: ClassPageError | null;

  // The combined surface state and busy flag
  surfaceState: ClassPageSurfaceState;
  isBusy: boolean;

  // The retry entry point. Re-triggers both the per-class query and the
  // warm-up dataset read, and re-runs the analyser + adapter pipeline.
  // The page-level composition root's `Result.retryButton.onClick` calls this.
  refetch: () => void;
}>;

type ClassPageSurfaceState = Readonly<{
  isLoading: boolean;
  isBlocking: boolean;
  isReady: boolean;
}>;

type ClassPageError = Readonly<
  | { type: 'classNotFound' }
  | { type: 'classQueryError'; cause: Error }
  | { type: 'analyserError'; cause: Error }
  | { type: 'adapterError'; cause: Error }
  | { type: 'assignmentDefinitionPartialsFailed' }
  | { type: 'assignmentDefinitionPartialsUntrustworthy' }
>;
```

**Field notes**

- `classFull` is the per-class query data; `null` while loading, errored, or when the class is not found. The `getABClass` contract maps `ClassNotFoundError` to `null` at the transport boundary (see `classDetailService.ts`).
- `classFullQuery` is the underlying React Query result, exposed so the page can read `isFetching` and the original error for the busy affordance and diagnostics.
- `assignmentDefinitionPartials` is the warm-up-backed data; `null` while the dataset is loading, failed, or untrustworthy.
- `assignmentDefinitionPartialsDatasetState` is the raw `PageDatasetState` from `usePageDataset`, exposed for diagnostics and for any subregion that wants to render its own loading affordance.
- `analyserResult` is the analyser's per-class output; `null` while the analyser hasn't run or threw. The hook calls the analyser only when both `classFull` and `assignmentDefinitionPartials` are non-null.
- `adapterResult` is the adapter's view-model; `null` while the adapter hasn't run or threw. The hook calls the adapter only when `analyserResult` is non-null.
- `error` is the structured error describing why the page is in a blocking state. The hook picks the **first** applicable error from the precedence below; the page can read this for diagnostics and the user-facing message.
- `surfaceState` is the combined `isLoading` / `isBlocking` / `isReady` state. These are mutually exclusive in the rendering sense (the page picks one branch), but the underlying flags may overlap (e.g. `isBlocking` is `true` even if `isLoading` is also `true`).
- `isBusy` is `true` when any underlying query is fetching (for the localised busy affordance on background refresh, per `frontend-loading-and-width-standards.md` §4).
- `refetch` is the retry entry point. It re-triggers both the per-class query and the warm-up dataset read, and re-runs the analyser + adapter pipeline. The page-level composition root's blocking `Result.retryButton.onClick` calls this for retryable errors. The hook is the single owner of the retry policy; the page is a thin caller. For non-retryable errors (`classNotFound`, `adapterError`), the page renders a `Back to Classes` button instead.

### Data sources

| Source                                              | Type                                       | Purpose                                                                                           |
| --------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `getABClassQueryOptions(classId)`                   | `useQuery` (per-class, not warm-up-backed) | The single class document. Query key: `queryKeys.abClass(classId)`.                               |
| `usePageDataset('assignmentDefinitionPartials')`    | `usePageDataset` (warm-up-backed)          | The cross-reference table of assignment definitions. Trust required.                              |
| `DataAnalysisService.analyse(input, 'averaging')`   | Pure function call inside `useMemo`        | Converts the class + definitions + filter into a per-class `AveragingResult`.                     |
| `classPageAdapter.adaptClassPageToViewModel(input)` | Pure function call inside `useMemo`        | Converts the analyser result + `classFull` into the view-model shape consumed by the UI sections. |

**Why `classPartials` is NOT read here.** The Class page reads the single class document via `getABClass` (per-class query), not via the `classPartials` warm-up dataset (which is the list of all classes used by `ClassesPage`). The earlier one-line description in the spec had this confused; this section is the source of truth. `classPartials` is not used by `useClassPageData`.

### State machine

The hook combines three independent state machines into a single `surfaceState`:

1. **Per-class query state** (`classFullQuery`):
   - `isPending: true` → loading
   - `isError: true` → blocking (`error.type === 'classQueryError'`)
   - `data === null` (success but null) → blocking (`error.type === 'classNotFound'`)
   - `data !== null` (success with data) → ready input

2. **Warm-up-backed dataset state** (`assignmentDefinitionPartialsDatasetState`):
   - `isDatasetFailed && (!hasQueryData || isQueryError)` → blocking (`error.type === 'assignmentDefinitionPartialsFailed'`)
   - `!isDatasetTrustworthy && isDatasetReady` → blocking (`error.type === 'assignmentDefinitionPartialsUntrustworthy'`)
   - `!isDatasetReady && !isDatasetFailed` → loading
   - `hasTrustworthyDataset` → ready input

3. **Analyser + adapter outcomes**:
   - Analyser throws → blocking (`error.type === 'analyserError'`). The error is captured at the `try` / `catch` boundary; React Query state is not affected.
   - Adapter throws → blocking (`error.type === 'adapterError'`). Same pattern.
   - Both return valid results → ready input.

**Combined `surfaceState` rules**

| Condition                                                                                                                 | `isLoading`             | `isBlocking` | `isReady` |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------ | --------- |
| Any input is in the loading state AND no blocking has occurred                                                            | `true`                  | `false`      | `false`   |
| Any input has failed (query error, class not found, dataset failed, dataset untrustworthy, analyser error, adapter error) | `false`                 | `true`       | `false`   |
| All inputs are ready AND analyser and adapter have produced valid results                                                 | `false`                 | `false`      | `true`    |
| Multiple states overlap (e.g. loading AND blocking)                                                                       | `false` (blocking wins) | `true`       | `false`   |

**Error precedence.** The hook picks the first applicable error from this precedence, top to bottom:

1. `classNotFound` (per-class query returned `null`)
2. `classQueryError` (per-class query errored)
3. `assignmentDefinitionPartialsFailed` (warm-up dataset failed)
4. `assignmentDefinitionPartialsUntrustworthy` (warm-up dataset untrustworthy but marked ready)
5. `analyserError` (analyser threw)
6. `adapterError` (adapter threw)

The page-level composition root reads `error.type` to pick a user-facing message and diagnostic log. The hook does not format the user-facing message; that's a presentation concern.

### Behaviour

- **Pure hook.** No I/O beyond the React Query calls and the synchronous analyser / adapter calls. No `useEffect` (other than what React Query uses internally). No subscriptions, no event listeners.
- **No data fetching owned by the hook.** All data fetching is delegated to React Query via `useQuery` and `usePageDataset`. The hook only orchestrates the existing primitives.
- **Memoised analyser call.** The analyser is called inside a `useMemo` keyed on `[classFull, assignmentDefinitionPartials, classId]`. The analyser is not called when either input is `null`. The analyser is re-called only when the inputs change.
- **Memoised adapter call.** The adapter is called inside a `useMemo` keyed on `[analyserResult, classFull]`. The adapter is not called when `analyserResult` is `null`. The adapter is re-called only when the analyser result or class full changes.
- **No data is mutated.** The hook does not call any mutation hooks (no `useMutation`, no `invalidateQueries`).
- **No side effects on render.** The hook does not write to console (other than the standard React Query logging via the configured logger), does not dispatch events, does not store anything in local storage or session storage. Logging and error reporting follow `frontend-logging-and-error-handling.md`.
- **No defaults inside the hook.** The hook takes a single argument (`classId: string`) and produces a single result. There is no optional configuration (no `range`, no `analyserKey`, no `filter`). The analyser key is hardcoded to `'averaging'` (the v1 default) and the filter is `{ classIds: [classId] }` (a single-class filter). Future multi-class or alternative-view filters are out of scope.
- **Fail loudly.** The hook does not catch-and-ignore analyser or adapter errors. It captures them in the `error` field and surfaces them as a blocking state. Console errors follow the standard logging policy (`frontend-logging-and-error-handling.md`).
- **Accessibility semantics are not owned by the hook.** The hook produces state; the page renders accessible loading (`role="status"`, `aria-live="polite"`) and busy (`aria-busy="true"`) regions. The hook is silent on accessibility.

### Composition

- `useClassPageData` is called only by `src/frontend/src/features/classPage/ClassPage.tsx` (the page composition root) in v1.
- The hook calls into:
  - `useQuery` from `@tanstack/react-query` (via `getABClassQueryOptions(classId)`)
  - `usePageDataset` from `src/frontend/src/hooks/usePageDataset.ts`
  - `DataAnalysisService` from `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
  - `classPageAdapter` from `src/frontend/src/features/classPage/classPageAdapter.ts`
- The page-level composition root consumes `ClassPageData` and renders the page sections (`RecentAssignmentsSection`, `StudentAveragesTableCard`, `ClassPageHeaderActions`) using the data from `adapterResult`. The page also owns the `AssessTaskModal` open / close state and the `onStartNewAssessment` callback that flows into the section components.

### Open questions

None for the hook's data flow contract. The page-level composition root's user-facing message format (e.g. "Class not found" vs "Couldn't load class") is a layout / copy concern and lives in the layout spec, not here.

## Component-level behaviour — `classPageModel`

This section pins down the contract for `src/frontend/src/features/classPage/classPageModel.ts`. It is the source of truth for the model layer; `StudentAveragesTableCard` (the only consumer in v1) and any future test code inherit this contract verbatim.

### Purpose and scope

`classPageModel` is the view-model layer that applies user-controlled filtering and sorting to the adapter's canonical output. The model is a pure function that takes the adapter's result plus the current search and sort state, and produces the final view-model shape consumed by the Student Averages table.

**In scope**

- The model function `buildClassPageViewModel` (pure, synchronous).
- The search filter: case-insensitive substring on `studentName`.
- The sort: locale-aware, state-aware comparator (`error` → `notAttempted` → `computed` by value, with `studentId` as the tie-breaker for `studentName`).
- Pass-through of `recentAssignments` and `classMetrics` (the model does not modify them).
- Echo of the `viewing` field (a placeholder for future views; always `'overallClassAverages'` in v1).

**Out of scope** (owned elsewhere)

- The adapter (owned by `classPageAdapter`).
- The `RecentAssignmentCardModel` shape (owned by `RecentAssignmentCard`).
- The `StudentAverageRowModel` shape (owned by `studentAveragesTableColumns`).
- The user-controlled state itself (the search input, sort state) — owned by the section components that render the controls. The model is called by the section component with the current state at render time.
- The Ant Design `Input.Search`, `Select`, and `Table` components — the model is a pure function; the UI controls are owned by the table card.

### Inputs

```ts
// Sketch only — the canonical type lives in classPageModel.ts
buildClassPageViewModel(input: {
  adapterResult: ClassPageAdapterResult;
  filters: {
    searchTerm: string;                           // '' means no filter
    viewing: 'overallClassAverages';              // placeholder; only one option in v1
  };
  sort: {
    column: 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average';
    direction: 'asc' | 'desc';
  };
}): ClassPageViewModel;
```

**Field notes**

- `adapterResult` is the canonical view-model from `classPageAdapter.adaptClassPageToViewModel`. The model transforms `studentAverages` (filter + sort) and passes through `recentAssignments` and `classMetrics`. The model does **not** re-derive the rollup or the no-data synthesis — those are the adapter's job.
- `filters.searchTerm` is the current value of the `Input.Search` control. Empty string means no filter. The filter is case-insensitive substring on `studentName`.
- `filters.viewing` is the current value of the `Select` control. In v1, the only option is `'overallClassAverages'`. The model preserves this value in the output for future use, but the model itself does not branch on it.
- `sort.column` is the column to sort by. The five options correspond to the five table columns (`Student Name`, `Completeness`, `Accuracy`, `SpAG`, `Average`).
- `sort.direction` is the sort direction. `'asc'` or `'desc'`.

### Outputs

```ts
// Sketch only — the canonical type lives in classPageModel.ts
type ClassPageViewModel = {
  recentAssignments: RecentAssignmentCardModel[]; // pass-through from adapterResult
  studentAverages: StudentAverageRowModel[]; // filtered + sorted from adapterResult
  classMetrics: {
    completeness: MetricResult;
    accuracy: MetricResult;
    spag: MetricResult;
    overall: MetricResult;
  }; // pass-through from adapterResult
};
```

**Field notes**

- `recentAssignments` is the adapter's output, unchanged.
- `studentAverages` is the adapter's output, filtered by `searchTerm` and sorted by the given `column` and `direction`.
- `classMetrics` is the adapter's output, unchanged.
- The output shape matches the adapter's output shape; the contract difference is that the model's `studentAverages` is filtered and sorted by user state.

### Model responsibilities

#### Search filter

- Apply a case-insensitive substring match on `studentName`.
- Empty `searchTerm` → no filter (all students included).
- Non-empty `searchTerm` → only students whose `studentName.toLowerCase()` contains `searchTerm.toLowerCase()` are included.
- The filter is applied **before** the sort.

#### Sort

- Sort `studentAverages` by the given `column` and `direction`.
- The comparator for `studentName` is locale-aware, case-insensitive, with `studentId` as the deterministic tie-breaker.
- The comparator for each metric column is state-aware:
  - `error` cells sort to the end regardless of numeric value.
  - `notAttempted` cells sort after `computed` but before `error`.
  - `computed` cells sort by numeric value.
- Default sort is `studentName` ascending (the adapter's canonical order). If the consumer does not supply a `sort` field, the model uses the default.

#### Pass-through of unchanged fields

- `recentAssignments` is taken from `adapterResult.recentAssignments` verbatim.
- `classMetrics` is taken from `adapterResult.classMetrics` verbatim.
- The model does not transform these fields; the contract difference is only in `studentAverages`.

### Behaviour

- **Pure function.** No I/O, no React imports, no Ant Design imports. The only side effect is the synchronous transformation.
- **Synchronous.** No `await` calls, no `Promise` returns.
- **No defaults inside the model.** All inputs are required. The function does not set default sort or default filter; consumers pass them explicitly. The default sort (if no consumer state is available) is `studentName` asc, applied at the call site.
- **No caching / memoisation.** The consumer calls the model inside a `useMemo`. If a future caller needs caching, memoisation is the consumer's responsibility.
- **No data validation.** The model trusts the adapter's output. If the adapter's output is structurally invalid, the model's behaviour is undefined.
- **Accessibility semantics are not owned by the model.** The model produces data; the table section renders the accessible UI.

### Composition

- The model is called by `StudentAveragesTableCard` inside a `useMemo` keyed on `[adapterResult, filters, sort]`. The model is the only consumer in v1.
- The model is **not** called by `useClassPageData` (the hook only calls the adapter, not the model).
- The model is **not** called by the page composition root.
- The model is **not** called by the recent-assignments section (the cards use the adapter's output directly, with no user-controlled filtering or sorting).

### Open questions

None. All decisions for v1 are captured above.

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

The card does not branch on state — it passes each `MetricResult` to `MetricPill`, which applies the tone-resolution rules in the [Component-level behaviour — `metricTone`](#component-level-behaviour--metrictone) section. The card's contract is summarised in the table below for clarity, not as a duplication of `MetricPill`.

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

## Component-level behaviour — `studentAveragesTableColumns`

This section pins down the contract for `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`. It is the source of truth for the column definitions; `StudentAveragesTableCard` (the only consumer in v1) and any future test code inherit this contract verbatim.

### Purpose and scope

`studentAveragesTableColumns` is a pure function that returns the column definitions for the Student Averages `Table`. It is the only module that knows the column keys, headers, sort comparator wiring, column-level filter wiring, and the `MetricPill` cell rendering for the table. The function takes the current `filters` and `onFiltersChange` so the columns can re-render the filter dropdown's checked state from the controlled state owned by `StudentAveragesTableCard`.

**In scope**

- Five column definitions: `studentName`, `completeness`, `accuracy`, `spag`, `average` (this fixed order is the column order in the table).
- The sort comparator wiring for all five columns. The `studentName` comparator is locale-aware, case-insensitive, with `studentId` as the deterministic tie-breaker. The metric column comparators are state-aware (`error` → `notAttempted` → `computed` by value) per the [Component-level behaviour — `classPageModel`](#component-level-behaviour--classpagemodel) section.
- The column-level filter wiring for the four metric columns. The exact filter UI is a layout-spec concern; the contract is the `filters` (list of selectable values) and `onFilter` (filter predicate) per the standard Ant Design `Table` column API. The `studentName` column has no filter.
- The cell `render` functions: `studentName` renders the `studentName` string as `Typography.Text`; each metric column renders a `MetricPill` per the [Component-level behaviour — `MetricPill`](#component-level-behaviour--metricpill) section.

**Out of scope** (owned elsewhere)

- The `Input.Search` and the `Select` (Viewing) — owned by `StudentAveragesTableCard`.
- The `searchTerm` and `sort` state — owned by `StudentAveragesTableCard` (and passed into the model layer).
- The `MetricPill` component itself — owned by `services/dataAnalysis/metricDisplay/MetricPill`.
- The `StudentAverageRowModel` shape — owned by `classPageAdapter` (the adapter is the sole producer).
- The `filters` state itself — owned by `StudentAveragesTableCard`. The columns function only receives the current value and the change callback; it does not own the state.

### Inputs

```ts
// Sketch only — the canonical signature lives in studentAveragesTableColumns.tsx
function buildStudentAveragesTableColumns(input: {
  filters: StudentAveragesTableFilters;
  onFiltersChange: (next: StudentAveragesTableFilters) => void;
}): TableColumnsType<StudentAverageRowModel>;
```

**Field notes**

- `filters` is the controlled filter state owned by `StudentAveragesTableCard`. It is a `Readonly<Record<MetricColumnKey, ReadonlySet<MetricBand>>>` — for each of the four metric columns, the set of bands the user has selected. The empty set means "no filter for this column". The filter is satisfied when the cell's band is in the set; when the set is empty, all cells pass.
- `onFiltersChange` is the callback the columns use to update the filter state when the user toggles a value in the filter dropdown. The page-level table card owns the state and re-renders the columns function with the new state.
- The function does not read the `searchTerm` (owned by `StudentAveragesTableCard` and applied by `classPageModel`); the columns only see the filtered rows passed in via the `Table`'s `dataSource` prop. The columns do not apply the search filter themselves.
- The function does not own the sort state; the `sorter` is a function and the `Table` reads the controlled `sort` from the parent.

### Outputs

The function returns an `Ant Design TableColumnsType<StudentAverageRowModel>` of length 5. Each column has:

| `key`          | `dataIndex`            | `title`        | `sorter`                              | `filters` / `onFilter` | `render`                           |
| -------------- | ---------------------- | -------------- | ------------------------------------- | ---------------------- | ---------------------------------- |
| `studentName`  | `studentName`          | `Student Name` | Locale-aware, `studentId` tie-breaker | (none)                 | Plain text                         |
| `completeness` | `metrics.completeness` | `Completeness` | State-aware comparator                | Band filter            | `MetricPill`                       |
| `accuracy`     | `metrics.accuracy`     | `Accuracy`     | State-aware comparator                | Band filter            | `MetricPill`                       |
| `spag`         | `metrics.spag`         | `SpAG`         | State-aware comparator                | Band filter            | `MetricPill`                       |
| `average`      | `metrics.average`      | `Average`      | State-aware comparator                | Band filter            | `MetricPill` (`emphasised={true}`) |

**Field notes**

- The `Average` column uses `emphasised={true}` on the `MetricPill` to match the visual weight of the `Average` cell on the Recent Assignment cards. The exact font size and weight are a layout-spec concern; the contract is the `emphasised` flag.
- The band filter values for each metric column are: `'red' | 'gold' | 'green' | 'notAttempted' | 'error'`. The set of selectable values is fixed in v1 — the column exposes all five options; the layout spec decides the order in the dropdown and the checkbox / multiselect rendering.
- The `onFilter` function for a metric column is `(value: MetricBand, record: StudentAverageRowModel) => boolean` — the band is computed by `resolveMetricTone(record.metrics[columnKey], defaultRange).color`, then compared to the value. The columns function does not call `resolveMetricTone` for the sort comparator; the model layer applies the state-aware sort to the rows before they reach the table.
- The `studentName` column has no `filters` / `onFilter` — the search input is the only filter, and it is applied at the model layer (case-insensitive substring on `studentName`).
- The columns function is pure: it does not call `useState`, `useEffect`, or any other React hook. It is called at render time by `StudentAveragesTableCard` and the result is passed to the `Table`.

### Behaviour

- **Pure function.** No React state, no I/O, no callbacks other than `onFiltersChange` (which the columns invoke when the user toggles a filter). The function returns a new array of column definitions on each call; React's identity check is the only memoisation concern, and the table card wraps the call in `useMemo` keyed on `[filters, onFiltersChange]`.
- **No defaults inside the function.** All behaviour is derived from the inputs. The column titles are inline strings; the layout spec records any future customisation.
- **No interactivity beyond filter toggles.** The `render` function for each cell is a pure mapping from `MetricResult` to `MetricPill`. The cell does not have an `onClick` in v1.
- **Bounded by loading standards.** When the parent is in the loading state, the columns function is not called (the table card renders a `Skeleton` instead). When the parent is in the blocking state, the columns function is not called. When the parent is in the ready state, the columns function is called once per render with the latest `filters` and `onFiltersChange`.

### Composition

The function is called by `StudentAveragesTableCard` at render time:

```ts
const columns = useMemo(
  () => buildStudentAveragesTableColumns({ filters, onFiltersChange: setFilters }),
  [filters]
);
```

The `Table` is rendered with `dataSource={viewModel.studentAverages}` (the model's filtered + sorted output) and `columns={columns}`. The columns function is not called by any other component in v1.

### Open questions

None. All decisions for v1 are captured above. The exact filter dropdown UI (checkbox list ordering, multiselect vs. single-select, any "clear filters" affordance) is a layout-spec decision.

## Component-level behaviour — `ClassPageHeaderActions`

This section pins down the contract for `src/frontend/src/features/classPage/ClassPageHeaderActions.tsx`. It is the source of truth for the header action buttons; the page-level composition root (next section) consumes the component and owns the callback.

### Purpose and scope

`ClassPageHeaderActions` renders the two top-right action buttons on the Class page: a disabled `Edit Student Details` button (placeholder for a future iteration, with a `Coming soon` tooltip) and an enabled `Start New Assessment` button that opens the existing `AssessTaskModal`. The component is presentational and owns no state; the page composition root owns the `onStartNewAssessment` callback.

**In scope**

- Rendering the two buttons in a horizontal row.
- The `Tooltip` wrapper on the disabled `Edit Student Details` button with the copy `Coming soon`.
- The `Start New Assessment` button (primary type) that invokes the `onStartNewAssessment` callback.
- The empty state of the two buttons (e.g., when no `onStartNewAssessment` callback is provided — the disabled button is still rendered, the enabled button is still rendered but its `onClick` is a no-op).

**Out of scope** (owned elsewhere)

- The `AssessTaskModal` itself — owned by `features/classes/AssessTaskModal/`. The component never imports it; the page composition root renders the modal.
- The `AssessTaskModal` open / close state — owned by the page composition root. The component only receives the `onStartNewAssessment` callback and invokes it.
- The `selectedClassId` shell state — owned by `AppShell`.
- The exact pixel positioning (top-right corner, gap between buttons, alignment with the page heading) — a layout-spec concern.

### Inputs

```ts
// Sketch only — the canonical signature lives in ClassPageHeaderActions.tsx
function ClassPageHeaderActions(props: { onStartNewAssessment: () => void }): JSX.Element;
```

**Field notes**

- `onStartNewAssessment` is invoked when the user clicks the `Start New Assessment` button. The page composition root owns the callback (which opens the `AssessTaskModal`).
- The component does not take a `classId` prop. The button click is a generic "open the modal" action; the page composition root is responsible for passing the correct `classId` to the modal.
- The component does not take a `disabled` prop for the `Start New Assessment` button. The button is always enabled in v1; the parent page composition root decides whether the page is in a state where the modal should not be opened (e.g., blocking or loading), and can either render the component conditionally or wrap the callback with a guard.

### Outputs

A small horizontal container (e.g., an Ant Design `Space`) with two buttons:

- **Edit Student Details** — `Button type="default" disabled icon={<EditOutlined />}`. Wrapped in a `Tooltip title="Coming soon"`.
- **Start New Assessment** — `Button type="primary" icon={<PlusOutlined />}` (or similar; the layout spec decides the icon). Invokes `onStartNewAssessment` on click.

**Field notes**

- The disabled `Edit Student Details` button has the `Tooltip` wrapper; the `Tooltip` does not render when the button is enabled. The Ant Design `Tooltip` is the v1 contract for the "Coming soon" copy; the layout spec may swap it for a `Popconfirm` or other affordance in a future iteration.
- The two buttons share a single `Space` container with a small `gap`. The container is right-aligned within its parent (the page heading row) — the layout spec decides the alignment.
- The component does not render a heading or summary. It is purely the action buttons.

### Behaviour

- **Pure presentational.** No React state, no `useEffect`, no data fetching. The component reads `props` and renders.
- **No defaults inside the component.** Both buttons are always rendered. The `onStartNewAssessment` callback is the only optional input; if it is `undefined` (which is not the v1 contract but is a defensive option), the `Start New Assessment` button's `onClick` is a no-op.
- **No accessibility concerns beyond Ant Design defaults.** The disabled button is correctly announced as `disabled` by Ant Design; the `Tooltip` copy is announced as the accessible description. The layout spec records any further accessibility decisions.

### Composition

The component is rendered by `ClassPage.tsx` (the page composition root) at the top of the page, in the page heading row alongside the page title. The component is not used by any other page in v1.

### Open questions

None. All decisions for v1 are captured above. The exact icon for each button is a layout-spec decision.

## Component-level behaviour — `StudentAveragesTableCard`

This section pins down the contract for `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`. It is the source of truth for the Student Averages table card; the page composition root (next section) consumes the component and passes the adapter's output.

### Purpose and scope

`StudentAveragesTableCard` is the card on the Class page that hosts the Student Averages `Table`. It owns the user-controlled state (the search term, the sort, the band filters), composes the `Table` with the column definitions, and calls `classPageModel.buildClassPageViewModel` to derive the final view-model from the adapter's output plus the user state. It is the only component in v1 that calls `classPageModel`.

**In scope**

- Owning the `searchTerm` state (a string).
- Owning the `sort` state (`{ column, direction }`).
- Owning the `filters` state (band filters per metric column).
- Rendering the control row: `Input.Search` (left) and `Select` (right, with the single placeholder option `Overall Class Averages` marked `disabled`).
- Rendering the `Table` with the column definitions from `buildStudentAveragesTableColumns` and the data from the model's `studentAverages`.
- Calling `buildClassPageViewModel` inside a `useMemo` keyed on `[adapterResult, filters, sort, searchTerm]`.
- Handling the empty state of the `Table` (e.g., no rows match the search) with an Ant Design `Empty` placeholder.

**Out of scope** (owned elsewhere)

- The data fetching, the analyser call, and the adapter call — owned by `useClassPageData` and `classPageAdapter`. The component receives `adapterResult` as a prop.
- The `MetricPill` component — owned by `services/dataAnalysis/metricDisplay/MetricPill`.
- The column definitions — owned by `studentAveragesTableColumns`. The component only calls the function and passes the result to the `Table`.
- The `buildClassPageViewModel` function — owned by `classPageModel`. The component only calls the function and uses the result.
- The `formatUpdatedAtLabel` helper — owned by the shared helper module.
- The exact control row layout, gap, alignment, and visual treatment — a layout-spec concern.

### Inputs

```ts
// Sketch only — the canonical signature lives in StudentAveragesTableCard.tsx
function StudentAveragesTableCard(props: { adapterResult: ClassPageAdapterResult }): JSX.Element;
```

**Field notes**

- `adapterResult` is the adapter's canonical output. The component does not receive the raw `classFull` or the raw analyser result; it only sees the view-model shape.
- The component does not take the `classId` prop; it does not need it. The page composition root reads the `classId` separately for the modal and the back button.
- The component does not take a `loading` or `error` prop; the page composition root decides whether to render the card at all. When the page is in loading or blocking, the card is replaced by a `Skeleton` or a `Result` at the page level (the card itself does not render either).

### Internal state

| State        | Type                                                              | Initial value                                    | Owner (this component) |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------ | ---------------------- |
| `searchTerm` | `string`                                                          | `''`                                             | Yes                    |
| `sort`       | `{ column: SortableColumn; direction: 'ascend' \| 'descend' }`    | `{ column: 'studentName', direction: 'ascend' }` | Yes                    |
| `filters`    | `StudentAveragesTableFilters` (band filter set per metric column) | All columns: empty set (no filter)               | Yes                    |

**Field notes**

- The `searchTerm` is debounced or not, depending on the layout spec. For v1, the simplest implementation is to apply the search on every keystroke (the model is a pure synchronous function over an in-memory list, so the cost is negligible). The layout spec may add a debounce if performance is a concern.
- The `sort` is the controlled `Table.sort` state. When the user clicks a column header, the `Table.onChange` callback updates the `sort` state. The `Table` is rendered with `sortColumn` and `sortOrder` derived from this state.
- The `filters` is the controlled filter state. When the user toggles a value in a column's filter dropdown, the `columns.onFilter` callback (from `buildStudentAveragesTableColumns`) updates the `filters` state.

### Outputs

A card (Ant Design `Card`, default border, `size="small"`) with three regions:

1. **Title region** — `Student Averages` (the section title).
2. **Control row** — a horizontal `Flex justify="space-between"` containing:
   - `Input.Search` on the left, with `placeholder="Search by name"` and `onChange` updating `searchTerm`.
   - `Select` on the right, with the single placeholder option `Overall Class Averages` marked `disabled`, defaulting to that option.
3. **Table** — an Ant Design `Table` with:
   - `dataSource` = the model's `studentAverages` (filtered + sorted).
   - `columns` = the result of `buildStudentAveragesTableColumns({ filters, onFiltersChange: setFilters })`.
   - `rowKey` = `studentId` (each row is keyed by the student's ID).
   - `pagination` = `false` (the table shows all matching rows; pagination is out of scope for v1).
   - `size` = `small` (consistent with the rest of the page).
   - `locale.emptyText` = an Ant Design `Empty` placeholder with description `No students match your search` (only shown when the search filters out all rows; if the data has zero students, the same `Empty` is shown).

**Field notes**

- The `Select` is **not** a real control in v1 — it has a single option and is `disabled`. The control is rendered so the user can see the v1 placeholder. The component does not own any `Select` state because the option is fixed.
- The card width is the natural width of the page content area; the card is not a fixed-width panel like `RecentAssignmentCard`.
- The table `pagination` is disabled in v1. The class page is expected to host small classes (typically < 30 students); pagination is a future iteration if a class size exceeds a threshold.
- The `Empty` placeholder for the search-empty case is a small `Empty` with no CTA. The page already has a `Start New Assessment` CTA in the header; the table does not need its own.

### Behaviour

- **Holds local state via `useState`.** Three pieces of state, all primitive; the model layer is a pure synchronous function so there is no need for `useReducer` or `useEffect`.
- **No data fetching.** The component receives `adapterResult` as a prop and assumes it is non-null (the page composition root only renders the card when the page is in the `isReady` state).
- **No `useEffect` for derived state.** The model's output is derived inside `useMemo`; no `useEffect` is needed.
- **Memoised columns and view-model.** The columns and the view-model are wrapped in `useMemo` to avoid recomputation on unrelated re-renders. The `useMemo` keys are documented in the "Composition" section below.
- **Bounded by loading standards.** When the parent page is in the loading or blocking state, the card is not rendered. When the parent is in the ready state, the card renders the full table.

### Composition

```ts
function StudentAveragesTableCard({ adapterResult }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ column, direction }>({ column: 'studentName', direction: 'ascend' });
  const [filters, setFilters] = useState<StudentAveragesTableFilters>(DEFAULT_FILTERS);

  const viewModel = useMemo(
    () => buildClassPageViewModel({ adapterResult, filters, sort, searchTerm }),
    [adapterResult, filters, sort, searchTerm],
  );

  const columns = useMemo(
    () => buildStudentAveragesTableColumns({ filters, onFiltersChange: setFilters }),
    [filters],
  );

  return (
    <Card title="Student Averages" size="small">
      <Flex justify="space-between" align="center">
        <Input.Search placeholder="Search by name" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <Select value="overallClassAverages" disabled options={[{ value: 'overallClassAverages', label: 'Overall Class Averages', disabled: true }]} />
      </Flex>
      <Table
        dataSource={viewModel.studentAverages}
        columns={columns}
        rowKey="studentId"
        pagination={false}
        size="small"
        onChange={handleTableChange}
        locale={{ emptyText: <Empty description="No students match your search" /> }}
      />
    </Card>
  );
}
```

The `handleTableChange` updates the `sort` state from the `Table`'s `onChange` event (Ant Design's `Table` exposes `sorter` and `filters` from the event; the component reads `sorter.columnKey` and `sorter.order`).

### Open questions

None. All decisions for v1 are captured above. The debounce on the search input, the table `size` variant, and the exact control row gap are layout-spec decisions.

## Component-level behaviour — `RecentAssignmentsSection`

This section pins down the contract for `src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`. It is the source of truth for the Recent Assignments section; the page composition root (next section) consumes the component and passes the adapter's output plus the `onStartNewAssessment` callback.

### Purpose and scope

`RecentAssignmentsSection` is the presentational container that renders the "Recent Assignments" sub-section of the Class page. It owns the section heading, the centred row of up-to-three `RecentAssignmentCard` instances, and the empty state with the `Start New Assessment` CTA. It is purely presentational; the page composition root owns the `onStartNewAssessment` callback and the adapter's output.

**In scope**

- Rendering the sub-section heading (e.g., `<Title level={3}>Recent Assignments</Title>`).
- Rendering the row of up-to-three `RecentAssignmentCard` instances, centred, with a fixed gap.
- Rendering the empty state when `recentAssignments.length === 0`: an Ant Design `Empty` with a description and a primary `Start New Assessment` button.
- Per-card keying: `<RecentAssignmentCard key={model.assignmentId} model={model} />`.

**Out of scope** (owned elsewhere)

- The `RecentAssignmentCard` component itself — owned by the [`RecentAssignmentCard` section](#component-level-behaviour--recentassignmentcard) above.
- The `AssessTaskModal` — owned by `features/classes/AssessTaskModal/`. The component only invokes the `onStartNewAssessment` callback; the page composition root renders the modal.
- The page heading and the back button — owned by the page composition root.
- The exact heading level, gap between cards, and centred alignment — a layout-spec concern.

### Inputs

```ts
// Sketch only — the canonical signature lives in RecentAssignmentsSection.tsx
function RecentAssignmentsSection(props: {
  recentAssignments: RecentAssignmentCardModel[];
  onStartNewAssessment: () => void;
}): JSX.Element;
```

**Field notes**

- `recentAssignments` is the adapter's `recentAssignments` output (already sorted by `updatedAt` desc and limited to the top 3). The section does not slice or sort the list further.
- `onStartNewAssessment` is the same callback the header actions use. The page composition root owns the callback and passes it to both `ClassPageHeaderActions` and `RecentAssignmentsSection`.
- The component does not take a `loading` or `error` prop; the page composition root decides whether to render the section at all.

### Outputs

A `<section>` (or a `PageSection` if the layout spec decides to use the shared wrapper) with three structural regions:

1. **Heading region** — a single `<Title level={3}>Recent Assignments</Title>` (or similar). The exact level is a layout-spec concern.
2. **Row region** — when `recentAssignments.length > 0`:
   - A horizontal `Flex justify="center" gap` containing one `RecentAssignmentCard` per item in `recentAssignments`.
   - The cards share a fixed `gap`; the row is centred within the page content area.
   - Each card is keyed by `model.assignmentId`.
3. **Empty region** — when `recentAssignments.length === 0`:
   - An Ant Design `Empty` with description `No recent assessments yet`.
   - A primary `Button` reading `Start New Assessment` directly below the message, invoking `onStartNewAssessment` on click.

**Field notes**

- The empty state and the row region are mutually exclusive. The component renders one or the other, never both.
- The `Start New Assessment` button in the empty state is the same callback as the header button. The two entry points are intentionally redundant so the action is discoverable for new classes.
- The section does not render a `Skeleton` placeholder; the page composition root renders the page-level `Skeleton` when the page is in the loading state, and the section is not rendered at all.

### Behaviour

- **Pure presentational.** No React state, no `useEffect`, no data fetching, no callbacks other than `onStartNewAssessment`. The component reads `props` and renders.
- **No defaults inside the component.** The list is rendered as-is; the section does not slice, sort, or filter.
- **Bounded by loading standards.** When the parent page is in the loading or blocking state, the section is not rendered. When the parent is in the ready state, the section renders the full row or the empty state.

### Composition

The section is rendered by `ClassPage.tsx` (the page composition root) below the page heading and the header actions, above the `StudentAveragesTableCard`. The component is not used by any other page in v1.

### Open questions

None. All decisions for v1 are captured above. The exact heading level, the gap between cards, and the empty state copy are layout-spec decisions.

## Component-level behaviour — `ClassPage.tsx` (composition root)

This section pins down the contract for `src/frontend/src/pages/ClassPage.tsx`. It is the source of truth for the page-level composition root; the shell's `renderNavigationPage` calls the page when the active key is `class-detail` and the `classId` is set.

### Purpose and scope

`ClassPage` is the page-level composition root for the Class page. It is a thin component that:

- Calls the `useClassPageData(classId)` hook to get the typed `ClassPageData`.
- Owns the `AssessTaskModal` open / close state and the `onStartNewAssessment` callback.
- Renders the page-level loading, blocking, or content treatment based on the hook's `surfaceState`.
- Renders the in-page `Back to Classes` button (the third of the three back affordances per open question 13).
- Renders the page heading (heading + summary from `pageContent.ts`).
- Composes the three sections: `ClassPageHeaderActions`, `RecentAssignmentsSection`, `StudentAveragesTableCard`.
- Renders the `AssessTaskModal` at the page level (controlled by the local state).

**In scope**

- The page-level loading, blocking, and content rendering decisions based on `ClassPageData.surfaceState`.
- The `Back to Classes` button (a `Button type="default" icon={<ArrowLeftOutlined />}`) that clears the shell's `selectedClassId` and sets the navigation key to `classes`. The other two back affordances (sidebar and breadcrumb) are owned by the shell.
- The `AssessTaskModal` open / close state and the `onStartNewAssessment` callback.
- The page-level `Result` component (Ant Design) for the blocking state, with a copy that depends on `error.type`.
- The page-level `Skeleton` placeholders for the loading state.
- The page heading (from `pageContent.ts`).
- Composition of the three sections.

**Out of scope** (owned elsewhere)

- The data fetching — owned by `useClassPageData`. The page only consumes the hook's output.
- The adapter and model — owned by `classPageAdapter` and `classPageModel`. The page only consumes their output via the hook and the `StudentAveragesTableCard`.
- The `selectedClassId` shell state — owned by `AppShell`. The page invokes the shell's clear-and-navigate callback.
- The sidebar and breadcrumb back affordances — owned by `AppShell` and `appNavigation.tsx` respectively.
- The exact copy for the blocking state's `Result` (e.g., "Class not found" vs "Couldn't load class") — a layout-spec concern, but the page decides which `error.type` maps to which copy.
- The exact `Skeleton` shapes and counts — a layout-spec concern.

### Inputs

```ts
// Sketch only — the canonical signature lives in ClassPage.tsx
function ClassPage(props: { classId: string }): JSX.Element;
```

**Field notes**

- `classId` is the selected class's ID. The shell's `renderNavigationPage` passes it through from the shell's `selectedClassId` state. The page does not own this state; it is a controlled input.
- The page does not take a `classFull` prop; it reads `classFull` from the hook's output. The hook is the source of truth for the class document.

### Internal state

| State               | Type      | Initial value | Owner (this component) |
| ------------------- | --------- | ------------- | ---------------------- |
| `isAssessModalOpen` | `boolean` | `false`       | Yes                    |

**Field notes**

- The `isAssessModalOpen` state is the only state the page owns. All other state comes from the hook or the controlled props.
- The `onStartNewAssessment` callback is a closure that sets `isAssessModalOpen` to `true`. The callback is passed to `ClassPageHeaderActions` and `RecentAssignmentsSection` (for the empty state CTA).
- The `onCloseAssessModal` callback sets `isAssessModalOpen` to `false` and is passed to the `AssessTaskModal`.

### Outputs

A page (Ant Design `Page` or a plain `<div>` per the layout spec) with the following structure:

1. **Heading row** — a horizontal `Flex justify="space-between" align="center"` containing:
   - The page title (heading + summary from `pageContent.classDetail`).
   - The `Back to Classes` button on the left (or top, depending on the layout spec's reading of open question 13).
   - The `ClassPageHeaderActions` on the right.
2. **Recent Assignments section** — `<RecentAssignmentsSection recentAssignments={adapterResult.recentAssignments} onStartNewAssessment={onStartNewAssessment} />`.
3. **Student Averages table card** — `<StudentAveragesTableCard adapterResult={adapterResult} />`.
4. **AssessTaskModal** — `<AssessTaskModal open={isAssessModalOpen} classId={classId} className={classFull.name} onClose={onCloseAssessModal} />`.

The actual rendered content depends on `surfaceState`:

- **`isBlocking: true`** — render a single Ant Design `Result` (with `status="warning"` or `status="error"` per the layout spec) and a `Back to Classes` button. The exact copy depends on `error.type`:
  - `classNotFound` → "Class not found" + back button
  - `classQueryError` → "Couldn't load class" + retry button (which calls the hook's `refetch`)
  - `analyserError` → "Couldn't compute averages" + retry button
  - `adapterError` → "Class data is invalid" + back button (this is the fail-fast case from decision 12 — there is no way to recover without fixing the data)
  - `assignmentDefinitionPartialsFailed` → "Couldn't load assessment definitions" + retry button
  - `assignmentDefinitionPartialsUntrustworthy` → "Assessment definitions are unavailable" + retry button
- **`isLoading: true`** — render `Skeleton` placeholders for the heading row, the Recent Assignments section, and the Student Averages table card. The `Skeleton` shapes match the actual content (heading, three cards in a row, table rows).
- **`isReady: true`** — render the full content tree above.
- **`isBusy: true`** (independent of `surfaceState`) — the content is still rendered; the page does not show a separate busy treatment. The `isBusy` flag is exposed for future use (e.g., a refresh button with a spinner); the v1 contract is that the busy state does not change the visible content.

**Field notes**

- The `Back to Classes` button is the third of the three back affordances per open question 13. Its `onClick` is a closure that invokes the shell's clear-and-navigate callback. The shell owns the navigation key and the `selectedClassId` state; the page only invokes the callback.
- The `Retry` button (for retryable errors) calls the hook's `refetch` function (which re-triggers both the per-class query and the warm-up dataset, and re-runs the analyser + adapter pipeline). The page reads the `refetch` function from the hook's output and passes it to the `Result` component. The hook is the single owner of the retry policy; the page is a thin caller.
- The `AssessTaskModal` is always rendered in the JSX (regardless of `surfaceState`); its `open` prop is the `isAssessModalOpen` state. The modal is hidden visually when `open` is `false`, so there is no harm in rendering it.

### Behaviour

- **Thin composition root.** The page's logic is mostly:
  1. Call the hook.
  2. Switch on `surfaceState` to decide what to render.
  3. Pass the right props to the three sections and the modal.
- **No data transformation.** The page does not call `classPageAdapter` or `classPageModel`; both are invoked lower in the tree (the adapter by the hook, the model by the table card).
- **No `useEffect` for derived state.** The page is a pure function of the hook's output and the local modal state.
- **Bounded by loading standards.** The page follows `frontend-loading-and-width-standards.md` §2-§5: loading uses `Skeleton`, blocking uses `Result`, content uses the section components.

### Composition

The page is rendered by `appNavigation.tsx`'s `renderNavigationPage` function when the active key is `class-detail` and the `classId` is set. The page is the only consumer of `useClassPageData`, `RecentAssignmentsSection`, `StudentAveragesTableCard`, and `ClassPageHeaderActions` in v1.

### Open questions

None. All decisions for v1 are captured above. The exact `Skeleton` shapes, the blocking `Result` copy per `error.type`, the `Back to Classes` button positioning, and the page heading layout are layout-spec decisions.

## Shell and routing integration

This section pins down the contract for the cross-cutting changes to the shell, the navigation registry, and the existing `ClassesPage`. These changes are necessary to wire the new `class-detail` route and the three back affordances (per open questions 13, 14, 15), but they are not a single component — they touch three existing files. This section is the source of truth for the contract; the implementation agent updates the three files accordingly.

### Files changed

- `src/frontend/src/navigation/appNavigation.tsx` — extend `AppNavigationKey`, extend the breadcrumb builder, extend `renderNavigationPage`.
- `src/frontend/src/AppShell.tsx` — add `selectedClassId` shell state, clear it on non-class-detail navigation, wire the three back affordances.
- `src/frontend/src/pages/ClassesPage.tsx` — enable the View button on each class card.

### `appNavigation.tsx` changes

**`AppNavigationKey` extension** — add `'class-detail'` to the enum (or string union) of navigation keys. The new key represents the Class page (the page rendered for a selected class).

**Breadcrumb builder** — extend the breadcrumb builder function to support a three-segment breadcrumb when the active key is `class-detail`:

- Segment 1: `Classes` (clickable, navigates back to `classes` and clears `selectedClassId`).
- Segment 2: `{classFull.name}` (non-clickable, the current page).

The existing `classes` key produces a two-segment breadcrumb (`Classes` non-clickable). The existing `dashboard` / `assignments` / `settings` keys produce their existing breadcrumbs (single segment).

**`renderNavigationPage` extension** — extend the switch to handle `class-detail`:

- When the active key is `class-detail` AND `selectedClassId` is non-null → render `<ClassPage classId={selectedClassId} />`.
- When the active key is `class-detail` AND `selectedClassId` is null → fall back to the `classes` key (defensive; the shell should never produce this state, but the fallback prevents a blank page).
- The existing cases for `dashboard`, `assignments`, `settings`, `classes` are unchanged.

**Field notes**

- The breadcrumb's `Classes` segment is the second of the three back affordances per open question 13. Its `onClick` is a closure that invokes the shell's clear-and-navigate callback. The breadcrumb renders the segment as a clickable link (`<a>` with `href` or `<Button type="link">`); the layout spec decides the exact rendering.
- The `class-detail` key is a "view entry" in the navigation registry, not a "warmup-backed" key per `frontend-react-query-and-prefetch.md` §2. The per-class query is already documented as view-entry; no prefetch changes are required.

### `AppShell.tsx` changes

**`selectedClassId` state** — add a `selectedClassId: string | null` state alongside the existing `selectedNavigationKey` state. The state is held in `AppShell` (top-level component) and passed down to the sidebar, the breadcrumb, and the `renderNavigationPage` function.

**State lifecycle** (per open question 14):

- `selectedClassId` is set to the class's ID when the user clicks a View button on a class card.
- `selectedClassId` is reset to `null` whenever the user navigates to any non-class-detail key (`dashboard`, `assignments`, `settings`, or any future top-level key).
- `selectedClassId` is reset to `null` when the user invokes any of the three back affordances (sidebar, breadcrumb, in-page button).
- The state is only valid when the active key is `class-detail`. The shell's `renderNavigationPage` function is the only consumer that needs it.

**Three back affordances** (per open question 13):

- **Sidebar** — when the active key is `class-detail`, the `Classes` sidebar entry is still highlighted as the active entry (the class page is conceptually a sub-page of the Classes page). Clicking it clears `selectedClassId` and sets the key back to `classes`.
- **Breadcrumb** — the breadcrumb's `Classes` segment is a clickable link (per the `appNavigation.tsx` change above). Clicking it clears `selectedClassId` and sets the key back to `classes`.
- **In-page button** — the in-page `Back to Classes` button (per the [`ClassPage.tsx` section](#component-level-behaviour--classpagetx-composition-root) above). Clicking it clears `selectedClassId` and sets the key back to `classes`.

All three routes invoke the same `clearClassAndNavigateToClasses()` function on the shell.

**Field notes**

- The shell's `selectedClassId` state is the source of truth for the classId. The `ClassPage` reads it via the `renderNavigationPage` function and passes it down. The shell does not pass `selectedClassId` to the `ClassPage` as a prop controlled by React Query or similar — it is a plain `useState` value in the shell.
- The `clearClassAndNavigateToClasses` function is a closure that updates both `selectedClassId` and `selectedNavigationKey` in a single state update. The state updates are batched (React 18+) and the page re-renders with the new active key.

### `ClassesPage.tsx` changes

**Enable the View button** (per open question 15) — on each class card, the `View` button changes from disabled to enabled:

- Remove the `disabled` and `tabIndex={-1}` attributes from the `Button`.
- Set the button's `type` to `"text"` (the current style is preserved per open question 15; only the disabled state changes).
- Add an `onClick` handler that invokes the shell's `selectClassAndNavigateToClassDetail(classId)` function.

The `selectClassAndNavigateToClassDetail` function is a closure on the shell that sets `selectedClassId` to the classId and sets `selectedNavigationKey` to `'class-detail'`.

**Field notes**

- The View button's visual style is unchanged (text-only, no icon, no underline). The `cursor: pointer` on hover (default Ant Design behaviour for non-disabled buttons) is the navigation affordance.
- The `selectClassAndNavigateToClassDetail` function is passed down from `AppShell` to `ClassesPage` via a prop or context. The exact wiring is a layout-spec concern.
- The disabled → enabled state change is the affordance per open question 15. The implementation does not need a new icon, tooltip, or visual treatment.

### Open questions

None. All decisions for v1 are captured above. The exact sidebar highlight behaviour (highlight the parent `Classes` entry, or a new `Class Detail` entry) and the breadcrumb `Classes` link rendering are layout-spec decisions.

## Adapters required

The data analysis service output is generic (per-class, per-student, per-task) and is shared with future surfaces. The class page must not couple the UI directly to that shape. The adapter and model layers own the translation from raw analyser output to the view-model shape consumed by the UI sections.

- **`classPageAdapter.ts`** (with optional co-located `classPageAdapter.zod.ts`) — pure adapter. Translates the analyser's `AveragingResult` plus the raw `ClassFull` into the canonical view-model shape (`recentAssignments`, `studentAverages`, `classMetrics`). Owns the assignment-level rollup rule, the recent-assignments top-3 sort and limit, the no-data row synthesis, the date formatting, and the fail-fast semantics for null `updatedAt`. Called only by `useClassPageData` inside a `useMemo`. Full contract in [Component-level behaviour — `classPageAdapter`](#component-level-behaviour--classpageadapter) above.
- **`classPageModel.ts`** — pure view-model builder. Takes the adapter's canonical output plus the current search and sort state, and produces the final view-model shape consumed by the Student Averages table. Applies a case-insensitive substring search filter on `studentName` and a state-aware sort by the given column and direction. `recentAssignments` and `classMetrics` are pass-throughs. Called only by `StudentAveragesTableCard` inside a `useMemo` keyed on `[adapterResult, filters, sort]`. Full contract in [Component-level behaviour — `classPageModel`](#component-level-behaviour--classpagemodel) above.
- **`index.ts`** — barrel re-export of the two above so feature code can import `import { adaptClassPageToViewModel, buildClassPageViewModel } from 'src/frontend/src/features/classPage/';` (per `src/frontend/AGENTS.md` §12, barrels are optional but reasonable when a feature exports a small, cohesive set of symbols).

## Backend changes

**None.** `getABClass` is the only transport needed. The data analysis service is a frontend-only orchestrator. No `z_Api` handler changes, no controller changes, no model changes.

## File-separation expectation

The user has flagged that this surface will grow. The skeleton intentionally keeps each file in its own module so the 500-line decomposition rule (`src/frontend/AGENTS.md` §12, `src/backend/AGENTS.md` §10) is satisfied by structure rather than by retrospective splitting. No file is currently projected to exceed 500 lines:

**Class page (dependent deliverable):**

- `ClassPage.tsx` — composition root, projected < 200 lines (page-level blocking / loading / ready switch, modal state, `Back to Classes` button, three-section composition, AssessTaskModal wiring; larger than initially estimated because the surface state switch and the six `error.type` copy variants add branching).
- `useClassPageData.ts` — projected < 200 lines (includes the surface state computation, error precedence, and memoised analyser / adapter orchestration; larger than initially estimated because the new `MetricResult` discriminated union adds analyser-input branching and the structured `ClassPageError` adds error-mapping logic).
- `classPageAdapter.ts` — projected < 250 lines (raw-to-view translation: assignment-level rollup rule, top-3 sort and limit, no-data row synthesis, date formatting, and trust validation; larger than initially estimated because the new `MetricResult` discriminated union adds branching).
- `classPageAdapter.zod.ts` (optional) — projected < 50 lines (output Zod schema for `ClassPageAdapterResult`).
- `classPageModel.ts` — projected < 150 lines (filter + sort + state-aware comparator; smaller than initially estimated because the model is a focused transformation on top of the adapter's output, not a re-derivation).
- `classPage/index.ts` (optional barrel) — projected < 10 lines.
- `RecentAssignmentsSection.tsx` — projected < 100 lines (heading + row of cards + empty state; includes the `<Empty>` block, the `Start New Assessment` button, and the `Title` heading).
- `RecentAssignmentCard.tsx` — projected < 100 lines.
- `StudentAveragesTableCard.tsx` — projected < 150 lines (control row + `Table` + `useMemo` for columns and view-model; size estimate from the per-component section).
- `studentAveragesTableColumns.tsx` — projected < 200 lines (five column definitions; larger than initially estimated because the band filter wiring, the state-aware sort comparator, and the `MetricPill` cell rendering add a non-trivial amount of code per column).
- `ClassPageHeaderActions.tsx` — projected < 80 lines (two buttons + tooltip).

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

- **Adapter unit tests** — co-located `classPageAdapter.spec.ts`. Tests inherit the adapter's component-level contract (the `Purpose and scope`, `Inputs`, `Outputs`, `Behaviour` sections above) as their assertions.
- **Model unit tests** — co-located `classPageModel.spec.ts`. Tests inherit the model's component-level contract.
- **Column unit tests** — co-located `studentAveragesTableColumns.spec.tsx`. Tests inherit the column function's component-level contract.
- **Component unit tests** — one spec per presentational component (`RecentAssignmentCard.spec.tsx`, `StudentAveragesTableCard.spec.tsx`, `RecentAssignmentsSection.spec.tsx`, `ClassPageHeaderActions.spec.tsx`). `MetricPill` is exercised via the shared helper spec above, not duplicated here.
- **Hook unit tests** — co-located `useClassPageData.spec.ts`. Tests inherit the hook's component-level contract.
- **Page test** — `ClassPage.spec.tsx` covers the heading, header actions, modal state, and the page-level skeleton / blocking / ready states.
- **Regression** — enable the View button in `ClassesPage.spec.tsx` and add a click-to-navigate assertion. The shell integration is tested via the page test and the existing shell tests (no new shell test files are introduced; the changes touch existing files).

The full red-first test cases for each spec file are documented in `ACTION_PLAN.md` (the action plan is the source of truth for the per-section test plans, in the TDD-first Red / Green / Refactor ordering). This spec defines the contracts the tests assert against.

## Documentation expectations (skeleton level)

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** — record the planned `resolveMetricTone`, `MetricPill`, and `metricDisplay/` subfolder decisions as **deferred / not yet implemented** entries in §9 so the de-sloppification review can see them. Also record the planned `classPageAdapter`, `classPageModel`, `useClassPageData`, `RecentAssignmentsSection`, `StudentAveragesTableCard`, `studentAveragesTableColumns`, `ClassPageHeaderActions`, `ClassPage.tsx`, and shell integration decisions (all now fleshed out in this spec but not yet implemented). All entries will be reconciled against the actual implementation during the documentation pass. Also record the planned `formatUpdatedAtLabel` extraction from `AssignmentsPage.tsx` to a shared helper module.
- **`docs/developer/frontend/frontend-react-query-and-prefetch.md`** — no change expected. The class page uses the existing per-class `abClass` query, which is already documented as view-entry (not warmup-backed).
- **`docs/pedagogy/data-analysis-scoring.md`** — update the "Understanding the numbers in the results table" section to describe the three `MetricResult` states (`computed`, `notAttempted`, `error`). The pedagogy is the right place to explain to teachers what each state means. Also document the new "Last Assessed" line on the Recent Assignments cards, including the fail-fast behaviour when `updatedAt` is missing.
- **`docs/architecture/`** — no change expected.

## Open questions for follow-up discussion

All 15 main open questions are **resolved** (recorded inline in the bullets below). The four "future" items (drill-down, refresh, cohort, edit students) are deferred to a future iteration and are not v1 scope. The component-level sections above are the source of truth for v1.

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
- Recommended next step: draft `ACTION_PLAN.md` against the agreed contracts in this spec. The action plan must respect the three-deliverable ordering (rename → data analysis service → Class page), include the `averagingAnalyser.accumulation.ts` facade decomposition as an explicit section, include the `formatUpdatedAtLabel` extraction from `AssignmentsPage.tsx` to a shared helper as an explicit sub-task of the rename deliverable, and use the TDD-first Red / Green / Refactor ordering inside each section. The action plan does **not** duplicate this spec's contracts; it inherits them by reference and adds the implementation sequence, the red-first test cases, the per-section checks, and the documentation / rollout tasks.
