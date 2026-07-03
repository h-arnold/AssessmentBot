# Class Page Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC_CLASS_PAGE.md` — domain rules, contracts, and scope boundaries.
2. Read `CLASS_PAGE_LAYOUT.md` — layout hierarchy, component choices, visible states.
3. Read `SPEC_CLASS_PAGE_PREPARATION.md` — the two prep deliverables (rename + data analysis service change) that must be in place before this plan starts.
4. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
5. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec or layout docs.

## Scope and assumptions

### Scope

- The Class page feature: a per-class overview surface that opens inline when a teacher clicks the `View` button on a class card in `ClassesPage`.
- All frontend files listed in `SPEC_CLASS_PAGE.md` §"Files created or modified by the Class page deliverable".
- Shell integration: `selectedClassId` state in `ClassesPage.tsx`, enabled `View` button.
- Feature-local adapter, model, data hook, composition root, presentational components, and Zod schema.
- `pageContent.ts` update with `classDetail` entries.
- Playwright E2E tests covering the full user journey at key integration points.

### Out of scope

- The prep spec deliverables (rename, data analysis service change, shared display helpers). Those are already implemented.
- Backend changes. The Class page requires no backend changes.
- URL-based routing, deep linking, browser back/forward. v1.1+ scope.
- Drill-down views (per-assignment, per-student). v1.1+ scope.
- Refresh/invalidation after `Start New Assessment` completes. v1.1+ scope.
- `Tooltip`/`aria-label` on `MetricPill` for accessibility. v1.1+ scope.

### Assumptions

1. The prep spec deliverables (rename, `MetricResult` discriminated union, `rollupMetric` helper, `metricDisplay/` helpers, `formatUpdatedAtLabel` extraction) are all in place and tested. The action plan starts at the Class page deliverable.
2. The `AssessTaskModal` component is reusable as-is with no signature change.
3. The `getABClass` query and `assignmentDefinitionPartials` warm-up dataset are available via existing React Query primitives.
4. All new files live under `src/frontend/src/features/classPage/` with no `index.ts` barrel.
5. The `RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320` constant is feature-local (sole v1 consumer).
6. The `pageContent.classDetail` entries are extracted to `pageContent.ts` alongside the existing `dashboard`, `assignments`, `classes`, `settings` entries.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments, documentation, and user-facing text.
- Export functions as functions, not constants assigned to arrow functions (per `src/frontend/AGENTS.md` §2).
- Zod-first validation: define schema first, derive types via `z.infer` (per `src/frontend/AGENTS.md` §9).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend E2E tests: `npm run test:frontend:e2e -- <target>`
- Frontend type-check: `npm --prefix src/frontend run typecheck`

---

## Section 1 — Page content strings and adapter Zod schema

### Objective

- Add the `classDetail` entries to `pageContent.ts` (static strings for the page heading, summary, and empty-state copy).
- Create the adapter's Zod output schema (`classPageAdapter.zod.ts`) defining `RecentAssignmentCardModel`, `StudentAverageRowModel`, and `ClassPageAdapterResult`.
- This section establishes the data contracts that all downstream components consume.

### Constraints

- `pageContent.ts` currently has 23 lines. Adding 4 string entries keeps it well under any splitting threshold.
- The adapter Zod schema is the trust boundary between the analyser and the UI; per `src/frontend/AGENTS.md` §9, Zod-first validation is mandatory for trust boundaries.
- The `RecentAssignmentCardMetricSchema` reuses the data analysis service's `MetricResult` discriminated union (imported from `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`).
- No `index.ts` barrel in `features/classPage/`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"Adapter responsibilities" and §"Main user-facing surface"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Shared helper plan

No new shared helpers in this section. The adapter Zod schema is feature-local.

### Acceptance criteria

- `pageContent.ts` exports all four `pageContent.classDetail` entries: `heading` (`'Class Overview'`), `summary` (`'Review assessment performance for this class.'`), `recentAssignmentsEmpty` (`'No recent assessments yet'`), and `searchEmpty` (`'No students match your search'`).
- `classPageAdapter.zod.ts` defines `RecentAssignmentCardModelSchema`, `StudentAverageRowModelSchema`, and `ClassPageAdapterResultSchema`.
- The schemas import `MetricResult` from `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`.
- All types are derived via `z.infer<typeof ...>` — no duplicate type declarations.
- Co-located `classPageAdapter.zod.spec.ts` validates round-trip and rejection of invalid shapes.

### Required test cases (Red first)

Frontend tests:

1. `pageContent.ts` — exports `pageContent.classDetail.heading` as `'Class Overview'`.
2. `pageContent.ts` — exports `pageContent.classDetail.summary` as `'Review assessment performance for this class.'`.
3. `pageContent.ts` — exports `pageContent.classDetail.recentAssignmentsEmpty` as `'No recent assessments yet'`.
4. `pageContent.ts` — exports `pageContent.classDetail.searchEmpty` as `'No students match your search'`.
5. `classPageAdapter.zod.spec.ts` — `RecentAssignmentCardModelSchema` rejects missing `assignmentId`.
6. `classPageAdapter.zod.spec.ts` — `RecentAssignmentCardModelSchema` rejects invalid `MetricResult` shapes (e.g. `state: 'computed'` with `value: 'N'`).
7. `classPageAdapter.zod.spec.ts` — `StudentAverageRowModelSchema` rejects missing `studentId`.
8. `classPageAdapter.zod.spec.ts` — `ClassPageAdapterResultSchema` round-trips a valid adapter output.
9. `classPageAdapter.zod.spec.ts` — `ClassPageAdapterResultSchema` rejects an adapter output with an invalid `MetricResult` in `classMetrics`.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/classPageAdapter.zod.spec.ts`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

None. The schema files are straightforward contract definitions.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 1 implemented and reviewed clean. Files created: `classPageAdapter.zod.ts`, `pageContent.spec.ts`, `classPageAdapter.zod.spec.ts`. File modified: `pageContent.ts` (added `classDetail` entries). All 17 tests pass, lint clean (0 errors), TypeScript clean.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** The adapter, model, and all presentational components import from this schema module.

---

## Section 2 — Adapter (pure function)

### Objective

- Create `classPageAdapter.ts` — the pure adapter that translates `AveragingResult` + `ClassFull` into the canonical `ClassPageAdapterResult` shape.
- Owns the assignment-level rollup (via the shared `rollupMetric` helper), the recent-assignments top-3 sort and limit, the no-data row synthesis, the date formatting, and the trust validation.
- Co-located `classPageAdapter.spec.ts` covering the full contract.

### Constraints

- Pure function. No I/O, no React imports, no Ant Design imports. The only side effect is throwing on data integrity violations.
- Synchronous. No `await` calls, no `Promise` returns.
- Imports the shared `rollupMetric` helper from `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`.
- Imports the shared `formatUpdatedAtLabel` helper from `src/frontend/src/utils/dateFormatting.ts`.
- Imports `ClassFull` and `AssignmentPartial` types from the existing Zod schemas.
- The adapter throws on: null `updatedAt`, duplicate `studentId`, duplicate `assignmentId`, unparseable `updatedAt`.
- The per-assignment `average` is computed as a composite of the three rolled-up criterion metrics (40/40/20 weighting with SPaG-renormalisation). The composite logic is not in `rollupMetric` — it is in the adapter.
- Projected post-change size: ~250–300 lines (well under the 500-line threshold).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"classPageAdapter — pure adapter"
- `SPEC_CLASS_PAGE_PREPARATION.md` §"rollupMetric helper contract" and §"Assignment-level rollup rule"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `SPEC_CLASS_PAGE.md` §"classPageAdapter — pure adapter"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`

### Shared helper plan

Helper decision entries:

1. Helper: `rollupMetric(subTasks, metric)`
   - Decision: `reuse` (already implemented by prep spec)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
   - Call-site rationale: The adapter calls `rollupMetric` for each of the three criteria to roll per-task `MetricResult` values into per-assignment values. The same helper is called by the analyser's row builders.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

2. Helper: `formatUpdatedAtLabel(updatedAt)`
   - Decision: `reuse` (already implemented by prep spec)
   - Owning module/path: `src/frontend/src/utils/dateFormatting.ts`
   - Call-site rationale: The adapter formats the `updatedAt` ISO string for the "Last Assessed" line.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `classPageAdapter.ts` exports `adaptClassPageToViewModel(input)` returning `ClassPageAdapterResult`.
- The adapter rolls up per-task metrics into per-assignment values using `rollupMetric` for three criteria.
- The adapter computes the per-assignment `average` as a composite (40/40/20 weighting).
- The adapter sorts assignments by `updatedAt` descending and takes the top 3.
- The adapter synthesises no-data rows for unassessed students (all `MetricResult` fields as `notAttempted`).
- The adapter calls `formatUpdatedAtLabel` for the `lastAssessedAtLabel` field.
- The adapter throws on null `updatedAt`, duplicate `studentId`, or duplicate `assignmentId`.
- Co-located spec covers all the above behaviours.

### Required test cases (Red first)

Frontend tests:

1. `classPageAdapter.spec.ts` — returns empty `recentAssignments` when the class has no assignments.
2. `classPageAdapter.spec.ts` — returns up to 3 `recentAssignments` sorted by `updatedAt` descending.
3. `classPageAdapter.spec.ts` — rolls up per-task metrics into per-assignment values using `rollupMetric` for `completeness`, `accuracy`, `spag`.
4. `classPageAdapter.spec.ts` — computes per-assignment `average` as a composite with 40/40/20 weighting.
5. `classPageAdapter.spec.ts` — per-assignment `average` is `error` when any of the three criteria is `error` (error escalation).
6. `classPageAdapter.spec.ts` — per-assignment `average` is `notAttempted` when all three criteria are `notAttempted` and none is `computed`.
7. `classPageAdapter.spec.ts` — handles `notAttempted` sub-tasks in the composite (SPaG-renormalisation: renormalise to completeness + accuracy over 0.8 when SPaG is `notAttempted`).
8. `classPageAdapter.spec.ts` — synthesises no-data rows for students not in `analyserResult.perStudent`.
9. `classPageAdapter.spec.ts` — sorts `studentAverages` by `studentName` ascending with `studentId` tie-breaker.
10. `classPageAdapter.spec.ts` — formats `lastAssessedAtLabel` via `formatUpdatedAtLabel`.
11. `classPageAdapter.spec.ts` — throws on null `updatedAt` with a structured error referencing `assignmentId`.
12. `classPageAdapter.spec.ts` — throws on duplicate `studentId`.
13. `classPageAdapter.spec.ts` — throws on duplicate `assignmentId`.
14. `classPageAdapter.spec.ts` — passes through `classMetrics` from the analyser's `perClass` unchanged.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/classPageAdapter.spec.ts`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

The adapter's `adaptClassPageToViewModel` should document:

- Why null `updatedAt` throws (data integrity bar is higher than for a generic table cell).
- Why the `average` composite is not in `rollupMetric` (it is a composite of three per-criterion rollups, not a fourth independent weighted average).
- The trust validation rationale (uniqueness of `studentId` and `assignmentId`).

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 2 implemented and reviewed clean. Files created: `classPageAdapter.ts` (520 lines), `classPageAdapter.spec.ts` (15 tests). Uses `rollupMetric` (reused from existing shared helper), `formatUpdatedAtLabel` (reused from existing helper). Composite average computed inline (40/40/20 with SPaG renormalisation), error escalation, trust validation, no-data row synthesis. All 15 tests pass, lint clean (0 errors), TypeScript clean. Full regression: 112 test files, 1331 tests pass (14 pre-existing warnings unchanged).
- **Deviations from plan:** The implementation is ~520 lines (vs projected 250–300). This is within the 500-line threshold; no splitting needed. The extra length comes from thorough JSDoc documentation, trust validation helpers, and the no-data row synthesis logic.
- **Follow-up implications for later sections:** The adapter is consumed by `useClassPageData` (Section 6) and indirectly by the model (Section 3) and all presentational components.

---

## Section 3 — Model (pure view-model builder)

### Objective

- Create `classPageModel.ts` — the pure view-model builder that applies user-controlled filtering and sorting to the adapter's canonical output.
- Co-located `classPageModel.spec.ts` covering the full contract.

### Constraints

- Pure function. No I/O, no React imports, no Ant Design imports.
- Synchronous. No `await` calls, no `Promise` returns.
- No data validation. The model trusts the adapter's output.
- The model's `viewing` field has been removed from v1 (static `Typography.Text` label, not a `Select`).
- Default sort: `studentName` ascending (the adapter's canonical order).
- The state-aware sort comparator: `computed` (by numeric value) → `notAttempted` → `error` (always last for `asc`; reversed for `desc`).
- The search filter: case-insensitive substring match on `studentName`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"classPageModel — view-model builder"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC_CLASS_PAGE.md` §"classPageModel — view-model builder"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`

### Shared helper plan

No new shared helpers. The model is feature-local.

### Acceptance criteria

- `classPageModel.ts` exports `buildClassPageViewModel(input)` returning `ClassPageViewModel`.
- The model applies case-insensitive substring search on `studentName`.
- The model sorts by the given column and direction with the state-aware comparator.
- The model passes through `recentAssignments` and `classMetrics` unchanged.
- Default sort is `studentName` ascending.
- Co-located spec covers all the above behaviours.

### Required test cases (Red first)

Frontend tests:

1. `classPageModel.spec.ts` — passes through `recentAssignments` and `classMetrics` unchanged.
2. `classPageModel.spec.ts` — filters `studentAverages` by case-insensitive substring on `studentName`.
3. `classPageModel.spec.ts` — returns all students when `searchTerm` is empty.
4. `classPageModel.spec.ts` — sorts by `studentName` ascending (default).
5. `classPageModel.spec.ts` — sorts by `studentName` descending.
6. `classPageModel.spec.ts` — sorts by `completeness` ascending: `computed` (by value) → `notAttempted` → `error`.
7. `classPageModel.spec.ts` — sorts by `completeness` descending: `error` → `notAttempted` → `computed` (by value).
8. `classPageModel.spec.ts` — tie-breaks by `studentId` ascending when state and value are equal (for metric columns).
9. `classPageModel.spec.ts` — tie-breaks by `studentId` ascending when student names are identical (for `studentName` column).
10. `classPageModel.spec.ts` — resets to default sort (`studentName` ascending) when no `sort` field is supplied.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/classPageModel.spec.ts`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

The state-aware sort comparator should document:

- The rank order for `asc` vs `desc` and why `error` is always last for `asc` and always first for `desc`.
- The `studentId` tie-breaker rationale (deterministic sorting for testability).

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 3 Red and Green phases complete. Test file `classPageModel.spec.ts` (531 lines, 12 test cases) created covering: pass-through fields, search filtering (case-insensitive), studentName sorting (asc/desc/case-insensitive), state-aware metric sorting (completeness asc/desc), tie-breaking (metric values and names), default sort fallback (null and undefined). Implementation file `classPageModel.ts` (199 lines) created with: pass-through fields, case-insensitive search filter, state-aware metric sort comparator (Map-based rank lookup), locale-aware studentName sort with always-ascending studentId tie-break, default sort fallback. Lint clean (0 errors). TypeScript clean. Review approved with minor findings (addressed: semicolons→commas in DEFAULT_SORT type, tie-break direction consistency). Full regression: 113 test files, 1343 tests pass (12 new tests added, zero regressions).
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** The model is consumed by `StudentAveragesTableCard` (Section 5).

---

## Section 4 — Header actions and recent assignments components

### Objective

- Create `ClassPageHeaderActions.tsx` — the two top-right buttons (`Edit Student Details` disabled, `Start New Assessment` enabled).
- Create `RecentAssignmentCard.tsx` — one card with title, last-assessed line, and four `MetricPill` instances.
- Create `RecentAssignmentsSection.tsx` — the section `Card` wrapping the card row or the empty state.
- Update `pageContent.ts` if any entries are missing (covered in Section 1; this section depends on it).

### Constraints

- `ClassPageHeaderActions` is pure presentational. It receives `onStartNewAssessment` as a prop.
- The `Edit Student Details` button is disabled, wrapped in a `Tooltip` via a `span` (Ant Design v6 pattern).
- `RecentAssignmentCard` receives a fully-built `RecentAssignmentCardModel` and renders four `MetricPill` instances. The `Average` cell uses `emphasised={true}`.
- `RecentAssignmentCard` is fully static — no hover, no click handler, no `hoverable` prop in v1.
- `RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320` is a feature-local constant in `RecentAssignmentCard.tsx`.
- `RecentAssignmentsSection` owns no state. It receives `recentAssignments`, `onStartNewAssessment`, and renders the section `Card` (`size="small"`, `title="Recent Assignments"`).
- The empty state renders `Empty` inside the section `Card` body with `description="No recent assessments yet"` and a `Button type="primary" icon={<PlusOutlined />}` as children.
- The section `Card` `title` renders above both the card row and the empty state.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"Component responsibilities"
- `CLASS_PAGE_LAYOUT.md` §"Recent Assignments Section" and §"Page Heading and Header Actions"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `SPEC_CLASS_PAGE.md` §"Component responsibilities"
- `CLASS_PAGE_LAYOUT.md` §"Recent Assignments Section" and §"Page Heading and Header Actions"
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (reference for the `span`-wrapper `Tooltip` pattern on disabled buttons)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Shared helper plan

Helper decision entries:

1. Helper: `MetricPill` (Ant Design `Tag` component)
   - Decision: `reuse` (implemented by prep spec)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
   - Call-site rationale: `RecentAssignmentCard` and `studentAveragesTableColumns` render `MetricPill` for each metric cell.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `ClassPageHeaderActions.tsx` renders the disabled `Edit Student Details` button with a `Tooltip` and the enabled `Start New Assessment` button.
- `RecentAssignmentCard.tsx` renders the assignment name, "Last Assessed: {date}" line, and four `MetricPill` instances.
- `RecentAssignmentCard.tsx` uses `emphasised={true}` on the `Average` cell's `MetricPill`.
- `RecentAssignmentsSection.tsx` renders the section `Card` with `title="Recent Assignments"` wrapping the card row or the empty state.
- The empty state renders `Empty` with the CTA button inside the section `Card` body.
- All three components have co-located specs.

### Required test cases (Red first)

Frontend tests:

1. `ClassPageHeaderActions.spec.tsx` — renders the disabled `Edit Student Details` button.
2. `ClassPageHeaderActions.spec.tsx` — renders the enabled `Start New Assessment` button.
3. `ClassPageHeaderActions.spec.tsx` — calls `onStartNewAssessment` when the primary button is clicked.
4. `ClassPageHeaderActions.spec.tsx` — wraps the disabled button in a `Tooltip` with "Coming soon" text.
5. `RecentAssignmentCard.spec.tsx` — renders the assignment name as the card title.
6. `RecentAssignmentCard.spec.tsx` — renders the "Last Assessed: {date}" line.
7. `RecentAssignmentCard.spec.tsx` — renders four `MetricPill` instances (Completeness, Accuracy, SpAG, Average).
8. `RecentAssignmentCard.spec.tsx` — uses `emphasised={true}` on the Average pill.
9. `RecentAssignmentCard.spec.tsx` — renders `Card` with `style={{ width: 320 }}` (the `RECENT_ASSIGNMENT_CARD_WIDTH_PX` constant).
10. `RecentAssignmentsSection.spec.tsx` — renders the section `Card` with `title="Recent Assignments"`.
11. `RecentAssignmentsSection.spec.tsx` — renders up to 3 `RecentAssignmentCard` components inside the card body.
12. `RecentAssignmentsSection.spec.tsx` — renders the empty state with `Empty` and CTA button when `recentAssignments` is empty.
13. `RecentAssignmentsSection.spec.tsx` — calls `onStartNewAssessment` when the empty-state CTA button is clicked.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/ClassPageHeaderActions.spec.tsx`
- `npm run test:frontend -- src/frontend/src/features/classPage/RecentAssignmentCard.spec.tsx`
- `npm run test:frontend -- src/frontend/src/features/classPage/RecentAssignmentsSection.spec.tsx`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

- `RecentAssignmentCard` should document why the card width is a feature-local constant (sole v1 consumer; promotion to shared token deferred until a second consumer emerges).
- `ClassPageHeaderActions` should document the `span`-wrapper pattern for the disabled button's `Tooltip`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** These components are composed by `ClassPageReady` (Section 7).

---

## Section 5 — Student averages table card and column definitions

### Objective

- Create `studentAveragesTableColumns.tsx` — column definitions for the Student Averages `Table`.
- Create `StudentAveragesTableCard.tsx` — the `Card` wrapping the control row (search + label) and the `Table`.
- Co-located specs for both.

### Constraints

- The columns function is pure. It does not call React hooks. It is called at render time by `StudentAveragesTableCard`.
- Five columns: `studentName`, `completeness`, `accuracy`, `spag`, `average` (fixed order).
- The `studentName` column: `sorter` locale-aware, case-insensitive, `studentId` tie-breaker. No `filters`.
- The four metric columns: `sorter` state-aware (delegated to the model), `filters` with five `MetricToneColor` values, `onFilter` using `resolveMetricTone`.
- The `Average` column uses `emphasised={true}` on `MetricPill`.
- `StudentAveragesTableCard` owns `searchTerm`, `sort`, and `filters` state.
- The control row uses `Input.Search` (left) and `Typography.Text type="secondary"` (right) in a `Flex justify="space-between"`.
- The `Table` uses `pagination={false}`, `size="small"`, `scroll={{ x: 'max-content' }}`.
- The `Table` empty text is `Empty description="No students match your search"`.
- `StudentAveragesTableCard` calls `buildClassPageViewModel` inside a `useMemo` keyed on `[adapterResult, filters, sort, searchTerm]`.
- `StudentAveragesTableCard` calls `buildStudentAveragesTableColumns` inside a `useMemo` keyed on `[filters]`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"studentAveragesTableColumns" and §"StudentAveragesTableCard"
- `CLASS_PAGE_LAYOUT.md` §"Student Averages Table Card"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `SPEC_CLASS_PAGE.md` §"studentAveragesTableColumns" and §"StudentAveragesTableCard"
- `CLASS_PAGE_LAYOUT.md` §"Student Averages Table Card"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Shared helper plan

Helper decision entries:

1. Helper: `resolveMetricTone(metric, range, errorColor)`
   - Decision: `reuse` (implemented by prep spec)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
   - Call-site rationale: The `onFilter` predicate uses `resolveMetricTone` to compute the cell's band for column-level filtering.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `studentAveragesTableColumns.tsx` exports `buildStudentAveragesTableColumns(filters)` returning column definitions.
- Five columns with correct keys, headers, sort comparator wiring, and filter wiring.
- `StudentAveragesTableCard.tsx` renders the `Card` with control row and `Table`.
- The `Table` sorts via `Table.onChange` mapped to the model's `sort` state.
- Clear-sort (third click) resets to default `studentName` ascending.
- The table empty text renders `Empty` with "No students match your search".
- Both components have co-located specs.

### Required test cases (Red first)

Frontend tests:

1. `studentAveragesTableColumns.spec.tsx` — returns five columns with correct keys and headers.
2. `studentAveragesTableColumns.spec.tsx` — `studentName` column has no `filters`/`filteredValue`/`onFilter`.
3. `studentAveragesTableColumns.spec.tsx` — metric columns have five filter entries with exact values: `{ text: 'Red (low)', value: 'red' }`, `{ text: 'Amber (mid)', value: 'gold' }`, `{ text: 'Green (high)', value: 'green' }`, `{ text: 'Not Attempted', value: 'default' }`, `{ text: 'Error', value: 'volcano' }` (matching `MetricToneColor` from the prep spec).
4. `studentAveragesTableColumns.spec.tsx` — `onFilter` predicate matches correct band via `resolveMetricTone` (strict equality on `MetricToneColor` string).
5. `studentAveragesTableColumns.spec.tsx` — `Average` column uses `emphasised={true}` on the `MetricPill`.
6. `StudentAveragesTableCard.spec.tsx` — renders the `Card` with `title="Student Averages"`.
7. `StudentAveragesTableCard.spec.tsx` — renders the `Input.Search` with placeholder "Search by name".
8. `StudentAveragesTableCard.spec.tsx` — renders the static "Viewing: Overall Class Averages" label.
9. `StudentAveragesTableCard.spec.tsx` — renders the `Table` with `pagination={false}` and `size="small"`.
10. `StudentAveragesTableCard.spec.tsx` — updates `searchTerm` on `Input.Search` change.
11. `StudentAveragesTableCard.spec.tsx` — maps `Table.onChange` sorter event to the model's `sort` state.
12. `StudentAveragesTableCard.spec.tsx` — resets to default sort `{ column: 'studentName', direction: 'asc' }` when `sorter.order` is `null` (clear-sort on third click).
13. `StudentAveragesTableCard.spec.tsx` — renders `Empty` with "No students match your search" when `dataSource` is empty.
14. `StudentAveragesTableCard.spec.tsx` — `Input.Search` does not render `enterButton` (no search icon button; filters apply on keystroke).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/studentAveragesTableColumns.spec.tsx`
- `npm run test:frontend -- src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

- The column definitions should document why the `MetricToneColor` token set is the filter value set (not the `MetricResult.state` name set) and how the `onFilter` predicate uses `resolveMetricTone` to compute the band.
- The `Table.onChange` sorter mapping should document the clear-sort handling (third click → `sorter.order` is `null`).

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** These components are composed by `ClassPageReady` (Section 7).

---

## Section 6 — Data orchestrator hook (`useClassPageData`)

### Objective

- Create `useClassPageData.ts` — the data orchestrator hook that wires together the per-class query, the warm-up-backed `assignmentDefinitionPartials` read, the analyser call, the adapter call, and the surface state computation.
- Co-located `useClassPageData.spec.ts` covering the full contract.

### Constraints

- Pure hook. No I/O beyond the React Query calls and the synchronous analyser/adapter calls. No `useEffect` (other than what React Query uses internally).
- Memoised analyser call. Keyed on `[classFull, assignmentDefinitionPartials]`. Not called when either input is `null`.
- Memoised adapter call. Keyed on `[analyserResult, classFull]`. Not called when `analyserResult` is `null`.
- The `refetch` entry point captures `classId` at call time via `useRef` (or equivalent) to avoid stale-closure bugs.
- The hook produces a typed `ClassPageData` result with `surfaceState` as a discriminated union (`loading` | `blocking` | `ready`).
- Error precedence: `classNotFound` > `classQueryError` > `assignmentDefinitionPartialsFailed` > `assignmentDefinitionPartialsUntrustworthy` > `adapterError` > `analyserError`.
- `analyserResult` and `adapterResult` are non-null only when `surfaceState.status === 'ready'`.
- Projected post-change size: ~300–350 lines (well under the 500-line threshold; no facade decomposition required).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `SPEC_CLASS_PAGE.md` §"useClassPageData — data orchestrator hook"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `SPEC_CLASS_PAGE.md` §"useClassPageData — data orchestrator hook"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

### Shared helper plan

Helper decision entries:

1. Helper: `usePageDataset('assignmentDefinitionPartials')`
   - Decision: `reuse` (existing hook)
   - Owning module/path: `src/frontend/src/hooks/usePageDataset.ts`
   - Call-site rationale: The hook reads the warm-up-backed `assignmentDefinitionPartials` dataset for surface-state computation.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

2. Helper: `DataAnalysisService.analyse(input)`
   - Decision: `reuse` (existing service)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
   - Call-site rationale: The hook calls the analyser synchronously after the per-class query and assignment-definition-partials are ready.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

3. Helper: `queryKeys` (query key factory)
   - Decision: `reuse` (existing factory)
   - Owning module/path: `src/frontend/src/query/queryKeys.ts`
   - Call-site rationale: Provides `getABClass` query key and `assignmentDefinitionPartials` query key for React Query consistency.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `useClassPageData.ts` exports `useClassPageData(classId)` returning `ClassPageData`.
- The hook issues the `getABClass` query via `useQuery` (or equivalent React Query primitive).
- The hook reads `assignmentDefinitionPartials` via `usePageDataset`.
- The hook calls `DataAnalysisService.analyse(...)` synchronously when inputs are ready.
- The hook calls `classPageAdapter.adaptClassPageToViewModel(...)` synchronously when the analyser result is ready.
- The hook produces `surfaceState` as a discriminated union with the correct error precedence.
- The hook's `refetch` always uses the freshest `classId` (no stale-closure bugs).
- Co-located spec covers all the above behaviours.

### Required test cases (Red first)

Frontend tests:

1. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'loading' }` when the per-class query is in flight.
2. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'classNotFound' } }` when `getABClass` returns `null`.
3. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'classQueryError' } }` when the per-class query errors.
4. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'assignmentDefinitionPartialsFailed' } }` when the warm-up dataset fails.
5. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'assignmentDefinitionPartialsUntrustworthy' } }` when the warm-up dataset is marked ready but untrustworthy.
6. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'adapterError' } }` when the adapter throws.
7. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'blocking'; error: { type: 'analyserError' } }` when the analyser throws.
8. `useClassPageData.spec.ts` — returns `surfaceState: { status: 'ready' }` with non-null `adapterResult` when all inputs are ready.
9. `useClassPageData.spec.ts` — calls the analyser synchronously when both `classFull` and `assignmentDefinitionPartials` are ready.
10. `useClassPageData.spec.ts` — calls the adapter synchronously when the analyser result is ready.
11. `useClassPageData.spec.ts` — analyser is not re-called when `classFull` and `assignmentDefinitionPartials` are referentially equal (memoisation).
12. `useClassPageData.spec.ts` — adapter is not re-called when `analyserResult` and `classFull` are referentially equal (memoisation).
13. `useClassPageData.spec.ts` — analyser is re-called when `classFull` changes (memoisation invalidation).
14. `useClassPageData.spec.ts` — adapter is re-called when `analyserResult` changes (memoisation invalidation).
15. `useClassPageData.spec.ts` — `refetch` re-triggers the per-class query with the current `classId`.
16. `useClassPageData.spec.ts` — blocking state takes precedence over loading state (error during loading surfaces immediately).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/useClassPageData.spec.ts`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

- The hook should document why `analyserResult` and `adapterResult` are non-null only when `surfaceState.status === 'ready'`.
- The `refetch` entry point should document the `useRef` pattern for `classId` capture and why it prevents stale-closure bugs.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** The hook is consumed by `ClassPage.tsx` (Section 7).

---

## Section 7 — Page composition root, content dispatcher, and breadcrumb

### Objective

- Create `ClassPage.tsx` — the page composition root. Thin: calls the hook, owns the modal state, dispatches per-state content, renders the breadcrumb `Classes` link and the modal at the page level.
- Create `ClassPageContent.tsx` — the per-state dispatcher (`ClassPageLoading`, `ClassPageBlocking`, `ClassPageReady`).
- The breadcrumb is rendered in-page by `ClassPage.tsx` (three segments: `AssessmentBot Frontend / Classes / {className}`).
- Co-located specs for both.

### Constraints

- `ClassPage.tsx` is a thin composition root. It owns: modal state (`isAssessModalOpen`), breadcrumb `Classes` link wiring, and the per-state content dispatcher.
- `ClassPageContent.tsx` is a thin `switch (status)` dispatcher returning `ClassPageLoading`, `ClassPageBlocking`, or `ClassPageReady`. The three sub-components are co-located in the same file (not split into separate files) because they are small and tightly coupled.
- `ClassPageLoading` renders shape-matched skeletons (heading + card row + table region). The skeleton uses the paragraph-row pattern consistent with existing pages (per `CLASS_PAGE_LAYOUT.md`).
- `ClassPageBlocking` renders a single `Result` per `error.type` with the correct status variant (`warning` for retryable, `error` for non-retryable).
- `ClassPageReady` renders the full content tree (heading row with header actions, `RecentAssignmentsSection`, `StudentAveragesTableCard`).
- The `AssessTaskModal` is rendered at the page root (not inside `ClassPageReady`) because the modal open/close state spans the loading/blocking/ready states.
- The breadcrumb's `Classes` segment is clickable, clearing `selectedClassId`. The third segment (`{className}`) is non-clickable.
- Projected post-change size: `ClassPage.tsx` ~80–120 lines, `ClassPageContent.tsx` ~150–200 lines (well under the 500-line threshold).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `SPEC_CLASS_PAGE.md` §"Page composition root" and §"Error, loading, and empty-state rules"
- `CLASS_PAGE_LAYOUT.md` §"Surface hierarchy" and §"Global state rules"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
- `SPEC_CLASS_PAGE.md` §"Page composition root" and §"Shell and routing integration"
- `CLASS_PAGE_LAYOUT.md` §"Surface hierarchy" and §"Region-by-region design"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

### Shared helper plan

Helper decision entries:

1. Helper: `AssessTaskModal`
   - Decision: `reuse` (existing component, unchanged)
   - Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
   - Call-site rationale: The page composition root renders the modal with `classId`, `className`, and `onClose` props.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Implemented`

### Acceptance criteria

- `ClassPage.tsx` calls `useClassPageData(classId)` and dispatches per-state content.
- `ClassPage.tsx` owns `isAssessModalOpen` state and renders `AssessTaskModal` at the page level.
- `ClassPage.tsx` renders the three-segment breadcrumb with a clickable `Classes` segment.
- `ClassPageContent.tsx` renders `ClassPageLoading` with shape-matched skeletons during loading.
- `ClassPageContent.tsx` renders `ClassPageBlocking` with the correct `Result` per error type.
- `ClassPageContent.tsx` renders `ClassPageReady` with the full content tree.
- `ClassPageBlocking` renders `Retry` for retryable errors and `Back to Classes` for non-retryable errors.
- `ClassPageBlocking` always renders `Back to Classes` as a secondary action.
- Both components have co-located specs.

### Required test cases (Red first)

Frontend tests:

1. `ClassPage.spec.tsx` — renders the three-segment breadcrumb with `Classes` clickable and `{className}` non-clickable.
2. `ClassPage.spec.tsx` — renders the page heading with the class name.
3. `ClassPage.spec.tsx` — renders the `ClassPageHeaderActions` with both buttons.
4. `ClassPage.spec.tsx` — opens the `AssessTaskModal` when `Start New Assessment` is clicked.
5. `ClassPage.spec.tsx` — closes the `AssessTaskModal` when `onClose` is called.
6. `ClassPage.spec.tsx` — calls `onNavigateToClasses` prop when the breadcrumb `Classes` segment is clicked.
7. `ClassPage.spec.tsx` — both the shell's two-segment breadcrumb and the class page's three-segment breadcrumb are visible (accepted v1 visual duplication).
8. `ClassPageContent.spec.tsx` — renders `ClassPageLoading` with shape-matched skeletons (heading skeleton, card-row skeleton, table skeleton) when `surfaceState.status === 'loading'`.
9. `ClassPageContent.spec.tsx` — renders `ClassPageBlocking` with `Result status="warning"` for `classQueryError` (retryable) and includes `Retry` + `Back to Classes` buttons.
10. `ClassPageContent.spec.tsx` — renders `ClassPageBlocking` with `Result status="warning"` for `analyserError` (retryable) and includes `Retry` + `Back to Classes` buttons.
11. `ClassPageContent.spec.tsx` — renders `ClassPageBlocking` with `Result status="error"` for `classNotFound` (non-retryable) and includes only `Back to Classes` button.
12. `ClassPageContent.spec.tsx` — renders `ClassPageBlocking` with `Result status="error"` for `adapterError` (non-retryable) and includes only `Back to Classes` button.
13. `ClassPageContent.spec.tsx` — renders `ClassPageReady` with the full content tree (heading, header actions, recent assignments, student averages table) when `surfaceState.status === 'ready'`.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/ClassPage.spec.tsx`
- `npm run test:frontend -- src/frontend/src/features/classPage/ClassPageContent.spec.tsx`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

- `ClassPage` should document why the `AssessTaskModal` is rendered at the page root (modal state spans loading/blocking/ready states).
- `ClassPageContent` should document the extraction rationale (per-state branching has 6 blocking-state variants and 1 ready variant; inlining in the page root would push the file over 250 lines and mix presentation with composition). The three co-located sub-components (`ClassPageLoading`, `ClassPageBlocking`, `ClassPageReady`) should each document their rendering contract:
  - `ClassPageLoading`: shape-matched skeletons (heading + card row + table region) using the paragraph-row pattern consistent with existing pages.
  - `ClassPageBlocking`: single `Result` per `error.type` with correct status variant (`warning` for retryable, `error` for non-retryable); retryable errors include `Retry` + `Back to Classes` buttons; non-retryable errors include only `Back to Classes`.
  - `ClassPageReady`: full content tree (heading row with header actions, `RecentAssignmentsSection`, `StudentAveragesTableCard`).
- The breadcrumb should document the temporary visual duplication with the shell's two-segment breadcrumb (accepted v1 trade-off).

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** This section completes the feature-local component tree. Section 8 integrates with the shell.

---

## Section 8 — Shell integration (`ClassesPage.tsx`)

### Objective

- Modify `ClassesPage.tsx` to add `selectedClassId` page-local state, branch the render to show the class detail view when a class is selected, and enable the `View` button on each class card.
- The `AppShell` and `appNavigation.tsx` are **not modified** in v1.

### Constraints

- `ClassesPage.tsx` currently has 355 lines. The changes add ~30–40 lines (state declaration, render branch, enabled button), keeping it well under any splitting threshold.
- `selectedClassId: string | null` is the page-local state. It is set when the user clicks `View` and cleared when the user invokes either back affordance.
- The render branch: `selectedClassId === null` → existing class list; `selectedClassId !== null` → `<ClassPage classId={selectedClassId} onNavigateToClasses={() => setSelectedClassId(null)} />`.
- The `View` button on each class card: remove `disabled` and `tabIndex={-1}`, add `onClick` that calls `setSelectedClassId(card.classId)`.
- The `AssessTaskModal` state for the class list is unchanged. The modal state for the class detail view is owned by `ClassPage.tsx`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"ClassesPage.tsx changes"
- `CLASS_PAGE_LAYOUT.md` §"Surface hierarchy"

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC_CLASS_PAGE.md` §"ClassesPage.tsx changes" and §"Shell and routing integration"
- `CLASS_PAGE_LAYOUT.md` §"Surface hierarchy"

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`

### Shared helper plan

No new shared helpers. The `ClassPage` component is imported directly.

### Acceptance criteria

- `ClassesPage.tsx` has `selectedClassId: string | null` state.
- Clicking the `View` button sets `selectedClassId` to the card's `classId`.
- When `selectedClassId` is set, `ClassPage` is rendered inline instead of the class list.
- `ClassPage` receives `onNavigateToClasses={() => setSelectedClassId(null)}` prop.
- The `View` button is no longer disabled and no longer has `tabIndex={-1}`.
- The `View` button remains `type="text"` (unchanged visual style; only the disabled state changes).
- The sidebar `Classes` entry stays highlighted (nav key remains `classes`).
- Existing `ClassesPage` spec is updated with the new behaviour.

### Required test cases (Red first)

Frontend tests:

1. `ClassesPage.spec.tsx` (update existing) — renders the `View` button as enabled (not `disabled`).
2. `ClassesPage.spec.tsx` (update existing) — clicking the `View` button sets `selectedClassId` and renders `ClassPage`.
3. `ClassesPage.spec.tsx` (update existing) — `ClassPage` receives `onNavigateToClasses` prop that clears `selectedClassId`.
4. `ClassesPage.spec.tsx` (update existing) — clicking the breadcrumb `Classes` link in `ClassPage` clears `selectedClassId` and renders the class list (full integration).
5. `ClassesPage.spec.tsx` (update existing) — the `View` button does not have `tabIndex={-1}`.

### Section checks

- `npm run test:frontend -- src/frontend/src/pages/ClassesPage.spec.tsx`
- `npm run lint:frontend`
- `npm --prefix src/frontend run typecheck`

### Optional `@remarks` JSDoc follow-through

- The render branch should document the v1 trade-offs (no deep linking, no browser back/forward, refresh drops to class list).

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** This section completes the full integration. Section 9 adds E2E tests.

---

## Section 9 — Playwright E2E tests

### Objective

- Add Playwright E2E tests covering the full user journey for the Class page.
- Tests are placed at key integration points to verify the complete flow works end-to-end.

### Constraints

- Per `docs/developer/frontend/frontend-playwright-e2e.md`, every new user-visible interaction must have Playwright coverage.
- Tests use the runtime mock infrastructure (queue-based mock system simulating backend responses).
- Each test response queue needs 2 entries per StrictMode double-effect.
- Tests must be independently runnable with mocks installed before navigation.
- Use role-based locators and web-first assertions.

### Delegation mandatory reads (when sub-agents are used)

Playwright mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-playwright-e2e.md`
- `docs/developer/frontend/frontend-testing.md`
- `SPEC_CLASS_PAGE.md` §"Workflow specification"
- `CLASS_PAGE_LAYOUT.md` §"Workflow surfaces"

### Shared helper plan

No new shared helpers. E2E tests use existing test infrastructure.

### Acceptance criteria

- E2E tests cover the full user journey: class list → click View → class page → header actions → recent assignments → student averages → return to class list.
- E2E tests cover the empty state (class with no assignments).
- E2E tests cover the error state (class not found).
- E2E tests cover the `Start New Assessment` workflow (open modal → close modal).
- All tests pass with the mock infrastructure.

### Required test cases (Red first)

Playwright E2E tests:

1. `classPage.e2e.spec.ts` — navigates from class list to class page when `View` is clicked.
2. `classPage.e2e.spec.ts` — renders the class name as the page heading.
3. `classPage.e2e.spec.ts` — renders up to 3 Recent Assignment cards with metric pills.
4. `classPage.e2e.spec.ts` — renders the Student Averages table with search and sort.
5. `classPage.e2e.spec.ts` — searches for a student by name and filters the table.
6. `classPage.e2e.spec.ts` — sorts a metric column and verifies the sort order.
7. `classPage.e2e.spec.ts` — renders the empty state when the class has no assignments.
8. `classPage.e2e.spec.ts` — clicks the empty-state CTA and opens the `AssessTaskModal`.
9. `classPage.e2e.spec.ts` — renders the blocking error state with `Result status="error"` and only `Back to Classes` button when the class is not found (non-retryable).
10. `classPage.e2e.spec.ts` — renders the blocking error state with `Result status="warning"` and `Retry` + `Back to Classes` buttons when the class query fails (retryable).
11. `classPage.e2e.spec.ts` — clicks `Back to Classes` on the blocking error state and returns to the class list.
12. `classPage.e2e.spec.ts` — clicks `Retry` on a retryable error state and re-fetches the class data.
13. `classPage.e2e.spec.ts` — clicks `Start New Assessment` in the header and opens the `AssessTaskModal`.
14. `classPage.e2e.spec.ts` — closes the `AssessTaskModal` and returns to the class page.
15. `classPage.e2e.spec.ts` — clicks the breadcrumb `Classes` segment and returns to the class list.

### Section checks

- `npm run test:frontend:e2e -- classPage`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

None. E2E tests are self-documenting via their descriptive test names.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after implementation.
- **Deviations from plan:** to be filled after implementation.
- **Follow-up implications for later sections:** This section completes the E2E coverage. Section 10 handles regression and documentation.

---

## Section 10 — Regression and contract hardening

### Objective

- Run all touched frontend test suites to verify no regressions.
- Run lint and type-check across the frontend.
- Verify mandatory-read evidence is complete for every delegated handoff.

### Constraints

- Prefer focused test runs before broader validation.
- All tests from Sections 1–9 must be green.

### Acceptance criteria

- All frontend unit/component tests pass.
- All Playwright E2E tests pass.
- Frontend lint passes (`npm run lint:frontend`).
- Frontend type-check passes (`npm --prefix src/frontend run typecheck`).
- Mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Required test cases/checks

1. Run the full frontend unit/component test suite: `npm run test:frontend`
2. Run the full Playwright E2E test suite: `npm run test:frontend:e2e`
3. Run frontend lint: `npm run lint:frontend`
4. Run frontend type-check: `npm --prefix src/frontend run typecheck`
5. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.
6. **Note:** Backend lint and tests are not required for the Class page deliverable. The Class page does not touch backend files. The prep spec's backend changes (rename) are already covered by the prep spec's own regression phase.

### Section checks

- All commands above return green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after regression phase.
- **Deviations from plan:** to be filled after regression phase.

---

## Section 11 — Documentation and rollout notes

### Objective

- Update canonical docs to match the implemented feature and highlight any caveats.
- Reconcile planned shared-helper entries in canonical docs.

### Constraints

- Only modify documents relevant to the touched areas.
- Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with the new feature-local helpers.
- Update `docs/developer/frontend/frontend-loading-and-width-standards.md` with the class page's skeleton structure and blocking-state treatment.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` records the new `classPageAdapter`, `classPageModel`, `useClassPageData`, and the v1 routing model as implemented entries.
- `docs/developer/frontend/frontend-loading-and-width-standards.md` records the class page's skeleton structure and the `Result` blocking-state deviation.
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` records the breadcrumb visual duplication as an accepted v1 trade-off.
- `docs/developer/frontend/frontend-modal-patterns.md` records the `AssessTaskModal` reuse from the class page (if not already documented).
- Any deviations or caveats are documented.
- Mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.

### Required checks

1. Verify docs mention the new feature-local helpers and the v1 routing model.
2. Verify docs mention the class page's skeleton structure and blocking-state treatment.
3. Confirm notes/deviations fields are filled during implementation.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
5. Reconcile planned shared-helper entries in canonical docs: update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation.
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan.
- If no `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled after documentation pass.
- **Deviations from plan:** to be filled after documentation pass.

---

## Suggested implementation order

1. **Section 1** — Page content strings and adapter Zod schema (establishes data contracts)
2. **Section 2** — Adapter (pure function, depends on Section 1 schemas)
3. **Section 3** — Model (pure function, depends on Section 1 schemas)
4. **Section 4** — Header actions and recent assignments components (presentational, depends on Section 1 schemas and prep spec helpers)
5. **Section 5** — Student averages table card and column definitions (presentational, depends on Section 1 schemas and prep spec helpers)
6. **Section 6** — Data orchestrator hook (depends on Sections 1–3)
7. **Section 7** — Page composition root and content dispatcher (depends on Sections 4–6)
8. **Section 8** — Shell integration (depends on Section 7)
9. **Section 9** — Playwright E2E tests (depends on Section 8)
10. **Section 10** — Regression and contract hardening (depends on Sections 1–9)
11. **Section 11** — Documentation and rollout notes (depends on Sections 1–10)

Sections 1–3 can be developed in parallel (no inter-dependencies beyond the shared Zod schema). Sections 4–5 can be developed in parallel (no inter-dependencies). Section 6 depends on 1–3. Section 7 depends on 4–6. Section 8 depends on 7. Section 9 depends on 8. Sections 10–11 are sequential gates.
