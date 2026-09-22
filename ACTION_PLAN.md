# Zero-Weight Assessment Display and Aggregation — Delivery Plan (TDD-First)

## Read-first context

Before executing any section, read:

1. [`SPEC.md`](SPEC.md)
2. [`TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`](TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md)
3. [`docs/developer/frontend/data-analysis-architecture.md`](docs/developer/frontend/data-analysis-architecture.md)
4. [`docs/developer/data-shapes/frontend-data-analysis-response.md`](docs/developer/data-shapes/frontend-data-analysis-response.md)
5. `src/frontend/AGENTS.md` and the frontend testing policy.

The specification, layout specification, architecture document, and canonical
data-shape contract settle behaviour. This plan sequences their delivery only.

## Scope and assumptions

### Scope

- Preserve numeric scores for zero-effective-weight observations while excluding
  them from averages.
- Add the aggregate-only `excluded` metric state and contribution metadata.
- Render aggregate `excluded` values through the current Class page consumer
  surfaces while retaining raw task-level heatmap displays.
- Project that metadata through embedded and merged heatmaps.
- Add the agreed shared display treatment and zero-weight heatmap indicators.
- Update the planned documentation to implemented status after delivery.

### Out of scope

- Backend, API, persistence, route, or assignment/task-weight editing changes.
- Criterion-weighting and SPaG-renormalisation changes.
- Assignment-instance re-keying for `perStudentTaskMetrics`.

### Assumptions

1. The existing `small` synthetic profile remains the canonical realistic base.
   Zero weighting is a focused boundary mutation applied locally to a cloned
   profile with independently pre-computed expected values; no competing
   committed realistic fixture or generator extension is required.
2. The two existing zero-weight synthetic-`notAttempted` behaviour tests in the
   accumulation spec are migrated rather than retained as legacy behaviour
   tests.
3. The frontend 550-line hard limit applies to every modified module under
   `src/frontend/src/**`, including co-located specs. The stricter planning
   threshold of 500 lines triggers a separation plan before a projected breach.

---

## Global constraints and quality gates

### Engineering constraints

- Use the live assignment-definition partial as the sole weighting source.
- Keep analyser and adapter layers independent of React and Ant Design.
- Do not infer contribution from a score or duplicate weighting resolution in
  the heatmap table.
- Preserve genuine raw `N`, score formatting, conditional cell backgrounds,
  and existing positive-weight behaviour.
- Use British English in code comments and documentation.

### TDD workflow (mandatory per section)

1. **Red:** add or migrate the specified failing tests.
2. **Green:** implement only the behaviour needed to pass them.
3. **Refactor:** make the required responsibility-based file separations with
   all focused tests green.
4. Run the section checks and enforce the delegated `Files read` evidence gate.

### Delegation mandatory-read gate

For every sub-agent hand-off, include the relevant `@`-prefixed files listed in
the section, require an explicit `Files read` list, and reject the hand-off if
any listed file is absent. Use Testing Specialist for Vitest work, Implementation
for production changes, Code Reviewer after each implementation section, and
Docs for the final reconciliation.

### Module-size plan

| In-scope file                                          | Current LOC | Projected in-place LOC | Required separation / target                                                                                                                              |
| ------------------------------------------------------ | ----------: | ---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataAnalysis.zod.ts`                                  |         220 |                   ~300 | None; remain below 500.                                                                                                                                   |
| `dataAnalysis.zod.spec.ts`                             |         778 |                   ~850 | Split schema input/filter and result/output suites; each target ≤450 LOC.                                                                                 |
| `averagingAnalyser.accumulation.ts`                    |         509 |                   ~650 | Split into a ≤260 LOC orchestration facade plus analyser-local accumulator and metric-resolution modules, each ≤250 LOC.                                  |
| `averagingAnalyser.accumulation.spec.ts`               |         978 |                 ~1,100 | Split assignment processing, zero-weight boundary, and metric-resolution suites; each target ≤450 LOC.                                                    |
| `rollupMetric.spec.ts`                                 |         603 |                   ~650 | Split established roll-up cases from new `excluded` precedence cases; each target ≤400 LOC.                                                               |
| `heatmapAdapter.merged.spec.ts`                        |         512 |                   ~570 | Split general merged projection from contribution-column/deduplication cases; each target ≤400 LOC.                                                       |
| `heatmapAdapter.spec.ts`                               |         442 |                   ~520 | No planned split; remain below 500, then split column-metadata cases if actual additions exceed estimate.                                                 |
| `taskHeatmapTableColumns.tsx`                          |         439 |                   ~530 | Extract feature-local zero-weight header/edge presentation helper; keep column builder ≤460 LOC and helper ≤180 LOC.                                      |
| `TaskHeatmapTable.spec.tsx`                            |       1,393 |                 ~1,500 | Split existing table tests by concern (table core, filters/sorting, preview interactions) and add a zero-weight presentation suite; each target ≤500 LOC. |
| `classPageModel.spec.ts`                               |         491 |                   ~530 | Split view-model construction from sort/filter cases; each target ≤350 LOC.                                                                               |
| `studentAveragesTableColumns.spec.tsx`                 |         432 |                   ~490 | No planned split; remain below 500, then re-evaluate if test additions exceed estimate.                                                                   |
| `e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` |         578 |                   ~620 | Split scenario construction from zero-weight scenario options/assertion helpers; each target ≤400 LOC.                                                    |

All other in-scope production modules are currently below 500 LOC and are
projected to remain below 500. Recount every modified module before completion;
if an estimate is wrong, separate by domain responsibility rather than reducing
formatting or documentation.

---

## Section 1 — Public contract and validation

### Objective

Introduce the validated `AverageContribution` shape and the aggregate-only
`excluded` `MetricResult` state without allowing task-level display metrics to
be replaced by `excluded`.

### Constraints

- Implement the planned contract in
  `docs/developer/data-shapes/frontend-data-analysis-response.md` exactly.
- `includedInAverage` must be true exactly when `effectiveWeight > 0`.
- `excluded` requires `value: null`, `totalWeight: 0`, zero applicable points,
  and at least one total point.
- Require contribution metadata on `PerStudentTaskMetric` and `PerTaskRow`; do
  not add it to student/class aggregate rows.
- Use a narrow display-scope metric union (computed, notAttempted, error) for
  `PerStudentTaskMetric` and `PerTaskRow`; keep the four-state shared union for
  aggregate result shapes. Do not conceal this rule in a broad refinement.
- Apply the first module-size separation in the table above before adding tests
  to the 778-line schema spec.

### Delegation mandatory reads

Testing Specialist: `@SPEC.md`,
`@docs/developer/data-shapes/frontend-data-analysis-response.md`,
`@src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`,
`@src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`.

Implementation: the same files plus
`@docs/developer/frontend/data-analysis-architecture.md` and
`@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.

Code Reviewer: the same implementation reads plus
`@src/frontend/AGENTS.md`.

### Shared helper and data-shape plan

1. `AverageContributionSchema`
   - Decision: extend existing shared schema module.
   - Owner: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`.
   - Rationale: analyser rows and both heatmap adapters share one invariant.
   - Canonical entries: `frontend-data-analysis-response.md` and shared-helper
     standards §9.18; status: **Not implemented**.
2. `MetricResult` state consumers
   - Decision: extend the shared `metricDisplay/` group in Section 4, rather
     than add feature-specific state unions.
   - Canonical entry: shared-helper standards §9.18; status: **Not implemented**.

### Acceptance criteria

- Zod accepts valid `excluded` only where aggregate output permits it.
- Zod rejects contradictory contribution metadata and invalid `excluded` data.
- Public task-level results require valid contribution metadata and retain only
  raw display states (`computed`, `notAttempted`, `error`).
- Existing valid positive-weight result shapes remain accepted.

### Required test cases (Red first)

1. Add `excluded` valid/invalid discriminated-union tests.
2. Add both truth-table directions for `AverageContribution`.
3. Add task-row acceptance tests with contribution metadata and reject
   task-level `excluded` fixtures.
4. Confirm `AveragingResult.perClass` accepts `excluded`.

### Canonical-fixture note

Schema tests use local minimal boundary objects only; no synthetic profile is
appropriate or required.

### Section checks

- `npm run test:frontend -- dataAnalysis.zod`
- `npm run lint:frontend`
- All split schema specs are ≤500 LOC and all delegated hand-offs pass the
  mandatory-read gate.

### Optional `@remarks` JSDoc follow-through

Document why `excluded` is aggregate-only and why contribution metadata is
validated separately from display evidence.

---

## Section 2 — Analyser dual accumulation and aggregate resolution

### Objective

Replace synthetic-`N` zero-weight handling with separate display and
contribution accumulation, then resolve aggregate states using the agreed
precedence.

### Constraints

- Resolve effective weight from live assignment-definition partials only.
- Do not skip real assessments when assignment or task weighting is zero.
- Numeric zero-weight task results stay numeric; multiple numeric observations
  use an unweighted display mean.
- Parent averages consume positive-weight evidence only; `N` affects them only
  when raw and positive-weight.
- All-error aggregates remain `error`; zero-contribution non-error aggregates
  become `excluded`.
- Before Green work, split the 509-line accumulation module and 978-line spec
  according to the module-size plan. Keep the existing public analyser facade
  and imports stable where feasible.

### Delegation mandatory reads

Testing Specialist: `@SPEC.md`, `@docs/developer/frontend/data-analysis-architecture.md`,
`@docs/developer/data-shapes/frontend-data-analysis-response.md`,
`@docs/developer/testing/synthetic-test-data.md`,
`@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`,
`@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`,
`@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`,
`@src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`.

Implementation: the same files plus `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`,
`@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`,
`@src/frontend/src/services/dataAnalysis/analysers/perStudentTaskMetrics.spec.ts`, and
`@src/frontend/src/test/dataAnalysis/fixtures.ts`.

Code Reviewer: implementation reads plus `@src/frontend/AGENTS.md`.

### Shared helper and data-shape plan

1. Analyser-local display/contribution accumulators
   - Decision: new, keep local to `services/dataAnalysis/analysers/`.
   - Owner: extracted accumulation modules described in the architecture doc.
   - Rationale: they have multiple analyser callers but no feature consumer;
     exporting a UI-facing shared helper would leak internal state.
   - Canonical doc: architecture document; status: **Not implemented**.
2. Aggregate state resolution
   - Decision: extend existing `rollupMetric.ts` rather than duplicate
     precedence in row builders.
   - Owner: `rollupMetric.ts`.
   - Canonical docs: data-shape contract and shared-helper standards §9.18
     item 4;
     status: **Not implemented**.

### Acceptance criteria

- Zero assignment weighting and zero task weighting both retain numeric
  task-level results and report `includedInAverage: false`.
- Zero-weight raw `N` remains `notAttempted` at task level but cannot create an
  aggregate not-attempted penalty.
- Mixed positive/zero observations use only positive-weight contributions in
  parent averages.
- All-zero non-error parent aggregates resolve to `excluded`; all-error ones
  resolve to `error`.
- Overall-composite resolution preserves `excluded` when all applicable
  criterion aggregates are excluded; mixed `excluded`/`error` and a positive
  contribution follow the specification's overall precedence.
- Per-task and per-student-task outputs carry correct contribution metadata.
- Where a public task display result is rolled into an aggregate, `computed`
  values contribute only with `totalWeight > 0`, and raw `notAttempted` affects
  parent handling only with `totalWeight > 0`; observed zero-weight non-error
  inputs ensure an all-zero set becomes `excluded`, not `error`.

### Required test cases (Red first)

1. Migrate the two existing zero-assignment/task-weight synthetic-not-attempted tests to
   numeric display and excluded aggregate assertions.
2. Add raw-`N` zero-weight and positive-weight control cases.
3. Add mixed positive/zero numeric expected-value tests proving numerator and
   denominator exclusion.
4. Add zero-weight multi-observation display-mean case.
5. Add four-way parent-state precedence and `rollupMetric` cases.
6. Add overall-composite cases for all-excluded, excluded/error-only, and
   excluded-plus-positive-contribution criteria.
7. Clone the canonical `small` synthetic profile locally, mutate only the
   relevant live task/assignment weights, and assert independently calculated
   expected results in integration coverage.

### Canonical-fixture note

Use the canonical `small` profile (seed 17031) as the source of realistic
class/assignment data. The zero-weight mutation is a narrow boundary fixture,
kept local to these tests. Migrate the touched existing synthetic-`N` tests;
do not add a second realistic fixture system or generator profile.

### Section checks

- `npm run test:frontend -- averagingAnalyser`
- `npm run test:frontend -- rollupMetric`
- `npm run test:frontend -- perStudentTaskMetrics`
- `npm run test:frontend -- dataAnalysis.integration.scenarios`
- `npm run lint:frontend`
- All extracted analyser and test modules meet the module-size plan.

### Optional `@remarks` JSDoc follow-through

Preserve the rationale for dual accumulation, live-weight resolution, and the
aggregate-only meaning of `excluded` next to the resolution boundary.

---

## Section 3 — Heatmap adapter contribution projection

### Objective

Carry authoritative task contribution metadata through embedded and merged
heatmap view models without changing task-cell score semantics.

### Constraints

- Both adapters derive `averageContribution` from the resolved live partial.
- Adapter derivation must apply the same established defaulting as analyser
  resolution: absent assignment or task weighting means `1` before calculating
  the product, so display metadata cannot disagree with analyser evidence.
- Merged duplicate definition-scoped task keys retain one unambiguous value.
- Missing-cell fallback remains the existing genuine no-submission behaviour;
  it must not be repurposed for zero weighting.
- Split the projected-over-limit merged-adapter spec before adding tests.

### Delegation mandatory reads

Testing Specialist: `@SPEC.md`,
`@docs/developer/data-shapes/frontend-data-analysis-response.md`,
`@src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`,
`@src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`,
`@src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts`,
`@src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.spec.ts`.

Implementation: the same files plus
`@src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts`.

Code Reviewer: implementation reads plus `@src/frontend/AGENTS.md`.

### Shared helper and data-shape plan

1. Heatmap task-column metadata
   - Decision: extend existing embedded and merged adapter descriptors.
   - Owners: `heatmapAdapter.ts`, `heatmapAdapter.merged.ts`.
   - Rationale: adapters already own definition-backed view-model projection;
     table code must not resolve or calculate this data.
   - Canonical contract: `frontend-data-analysis-response.md`; status:
     **Not implemented**.

### Acceptance criteria

- Embedded and merged task columns expose valid `averageContribution`.
- A zero-weight column preserves numeric cell values and reports false
  `includedInAverage`.
- Merged deduplication preserves the definition-scoped contribution value.

### Required test cases (Red first)

1. Assert positive and zero-weight embedded column metadata.
2. Assert zero-weight numeric cells remain numeric.
3. Assert merged task-column metadata survives deduplication and assignment-tier
   grouping inputs.

### Canonical-fixture note

Use existing adapter unit fixtures plus a local zero-weight boundary mutation.
Opportunistically migrate touched positive-weight descriptors to include the
now-required contribution field.

### Section checks

- `npm run test:frontend -- heatmapAdapter`
- `npm run lint:frontend`
- Adapter output and all modified adapter specs stay below 500 LOC after the
  required split.

### Optional `@remarks` JSDoc follow-through

Document that adapter metadata, rather than a displayed score, is authoritative
for heatmap zero-weight presentation.

---

## Section 4 — Shared metric state display, filtering, ordering, and Class page aggregates

### Objective

Make `excluded` a complete shared metric-display state across all current
consumers, including the Class page surfaces where aggregate values are visible.

### Constraints

- Extend shared `metricDisplay/` modules only; do not add a heatmap-local state
  renderer or comparator.
- `Excluded` is distinct from `N` and `E`, has its agreed accessible text, and
  is non-numeric.
- Sort ascending after `notAttempted` and before `error`; preserve computed
  value ordering and existing descending semantics.
- Add a separate filter toggle and keep encoded filter parsing backward-safe for
  existing selected keys: append `includeExcluded` as the fifth `|`-separated
  field. Existing four-part keys decode with `includeExcluded: false`; do not
  insert the new field before the existing `includeError` field.
- The Class page adapter remains a typed passthrough; its student averages,
  class metrics, metric table, and state-aware sorting must render or pass
  through `excluded` rather than assume the old three-state union. Its Recent
  Assignment card roll-up is aggregate scope: extend the shared
  contribution-aware `rollupMetric`/overall-composite path so all-zero-weight
  assignments resolve to `excluded` instead of throwing.
- Preserve the existing Class-page no-data placeholder (`N`, zero total data
  points) as a presentation-only adapter value. Add a narrow
  `ClassPageDisplayMetricSchema` union in `classPageAdapter.zod.ts` for that
  exact shape; do not weaken `MetricResultSchema`, invent a data point, or
  relabel no-data rows as `excluded`.
- Split the projected-over-limit `classPageModel.spec.ts` before adding state
  ordering coverage.

### Delegation mandatory reads

Testing Specialist and Implementation: `@SPEC.md`,
`@docs/developer/data-shapes/frontend-data-analysis-response.md`,
`@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricStateRank.ts`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricComparator.ts`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts`,
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx`, and
`@src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.tsx`.

Testing Specialist and Implementation must also read:
`@src/frontend/src/features/classPage/classPageAdapter.ts`,
`@src/frontend/src/features/classPage/classPageAdapter.zod.ts`,
`@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`,
`@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`,
`@src/frontend/src/features/classPage/RecentAssignmentCard.tsx`, and
`@src/frontend/src/features/classPage/classPageModel.ts`.

Code Reviewer: those files plus `@src/frontend/AGENTS.md`.

### Shared helper and data-shape plan

1. Shared `metricDisplay/` state consumers
   - Decision: extend.
   - Owner: existing `metricDisplay/` modules.
   - Rationale and canonical status: shared-helper standards §9.18,
     **Not implemented**.

### Acceptance criteria

- Every shared state consumer handles `excluded` exhaustively.
- `MetricPill` shows **Excluded** with the specified accessible meaning and a
  distinct neutral visual treatment.
- Filters include/exclude `excluded` independently of numeric range, `N`, and
  `E`; sorting follows the agreed state order.
- The Class page Student Averages table and Recent Assignment cards visibly
  render **Excluded** for aggregate inputs, and adapter schemas/pass-through
  student/class models accept the state without local reinterpretation.
- A Recent Assignment card with all-zero-weight assessed tasks renders
  `excluded` for each aggregate criterion and its overall average; mixed
  positive/zero tasks use only the positive-weight contribution.
- The Class-page adapter schema accepts its exact existing zero-data no-data
  placeholder only through the adapter-local display union; it remains distinct
  from a raw `N` and an `excluded` aggregate.

### Required test cases (Red first)

1. Tone and pill rendering tests for `excluded` label, accessibility, and
   distinct treatment.
2. State-rank and comparator tests covering both directions.
3. Filter-key round trips, old-key compatibility where applicable, predicate,
   and dropdown-checkbox interaction tests.
4. Add Class page table-column render/filter tests, adapter-schema/passthrough
   tests, card rendering tests, and state-aware model sorting tests for
   `excluded`.
5. Add Recent Assignment adapter roll-up tests for all-zero-weight numeric,
   zero-weight raw `N`, all-error, and mixed positive/zero inputs; add
   overall-composite tests for the same state precedence.
6. Add a no-data adapter-model schema regression test proving its local
   zero-data placeholder is accepted without changing the analyser contract.

### Canonical-fixture note

Use local discriminated-union boundary objects. Existing metric-display tests
are the canonical consumer coverage and should be extended, not replaced.
The existing Playwright task-heatmap journey fixture is not the synthetic
profile system; extend it with a narrow zero-weight boundary option following
the established E2E helper pattern.

### Section checks

- `npm run test:frontend -- metricDisplay`
- `npm run test:frontend -- classPageAdapter`
- `npm run test:frontend -- StudentAveragesTableCard`
- `npm run test:frontend -- RecentAssignmentCard`
- `npm run test:frontend -- classPageModel`
- `npm run lint:frontend`
- Recount all modified display modules/specs; split by concern if any crosses
  500 LOC, including the required class-page model spec split.

### Optional `@remarks` JSDoc follow-through

Document the state order and why `excluded` is not an alias for `notAttempted`.

---

## Section 5 — Task heatmap zero-weight presentation

### Objective

Render the approved zero-weight task-header Tooltip and group-edge marker using
adapter-supplied metadata, while preserving all score-cell behaviour.

### Constraints

- Follow `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md` exactly.
- Use Ant Design `Tooltip` with `trigger={['hover', 'focus']}` on one focusable,
  non-actionable header-label element per zero-weight task group.
- Use theme-aware 2px inset box-shadow edges on group header and first/last
  metric cells; do not change score backgrounds, dimensions, padding, preview,
  sorting, or filters.
- Extract the feature-local zero-weight header/edge presentation helper before
  adding the feature to the 439-line column builder. Split the 1,393-line table
  spec by responsibility before adding its new cases. This deliberately applies
  the repository's 500-line planning threshold before the 550-line hard limit.

### Delegation mandatory reads

Testing Specialist and Implementation: `@SPEC.md`,
`@TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`,
`@docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
`@docs/developer/frontend/data-analysis-architecture.md`,
`@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`,
`@src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx`,
`@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.spec.tsx`, and
`@src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.spec.ts`.

Code Reviewer: those files plus `@src/frontend/AGENTS.md`.

### Shared helper and data-shape plan

1. Zero-weight header/edge presentation
   - Decision: new, keep feature-local.
   - Owner: extracted `taskHeatmapZeroWeightHeader.tsx` (or equivalently clear
     feature-local name).
   - Rationale: it serves the heatmap's grouped Ant Design Table only and is
     required to keep the column builder within the planned size boundary.
   - Canonical entry: shared-helper standards §9.18; status: **Not implemented**.
2. Contribution metadata consumption
   - Decision: reuse adapter descriptor field; no weighting utility in the UI.
   - Owner: `TaskHeatmapColumn.averageContribution` contract.
   - Canonical entry: `frontend-data-analysis-response.md`; status:
     **Not implemented**.

### Acceptance criteria

- Only zero-effective-weight groups receive the Tooltip, focusable label, and
  marker; positive-weight groups remain byte-for-byte equivalent in behaviour.
- Tooltip content and accessible name use the exact approved wording.
- The marker spans the grouped header and first/last sub-column cells, including
  merged heatmaps, without touching sticky name columns.
- Numeric zero-weight and genuine `N` cells remain visible as their original
  values; aggregate `Excluded` remains distinguishable from both.

### Required test cases (Red first)

1. Render a zero-weight embedded task group and assert Tooltip pointer/focus
   behaviour, one tab stop, exact text, accessible name, and non-actionability.
2. Assert first/last cell and grouped-header marker styles/classes for embedded
   and merged task groups, including positive-weight absence.
3. Assert conditional-format backgrounds and score rendering are unchanged.
4. Assert zero-weight numeric, raw `N`, and aggregate `Excluded` render as
   three distinct states.

### Canonical-fixture note

Use adapter-produced local zero-weight boundary view models in component tests.
Migrate touched `TaskHeatmapTable` fixtures to require contribution metadata;
do not create a second heatmap fixture framework.

### Section checks

- `npm run test:frontend -- TaskHeatmapTable`
- `npm run test:frontend -- taskHeatmapTableColumns`
- `npm run lint:frontend`
- All modified task-heatmap production and test modules meet the size plan.

### Optional `@remarks` JSDoc follow-through

Record that header styling is presentation-only and receives authoritative
contribution metadata from adapters.

---

## Regression and contract hardening

### Objective

Verify end-to-end frontend contract consistency, preserve established analysis
behaviour, and ensure no modified module exceeds the size limit.

### Acceptance criteria and required checks

1. Run all focused suites from Sections 1–5, then `npm run test:frontend`.
2. Run `npm run lint:frontend` and the frontend type-check command defined by
   the package scripts.
3. Use the existing task-heatmap Playwright harness to create a zero-weight
   scenario. Assert the Class page's visible aggregate **Excluded** result,
   then open the heatmap and assert that the same task still shows its numeric
   score plus the approved zero-weight presentation. Split the 578-line E2E
   helper by scenario-construction responsibility before extending it.
   Playwright mandatory reads: `@SPEC.md`,
   `@TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`,
   `@src/frontend/e2e-tests/task-heatmap.spec.ts`, and
   `@src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`.
4. Parse/validate realistic local clone-and-mutate fixture output independently
   from the service under test.
5. Recount every modified `src/frontend/src/**` file and confirm ≤550 LOC,
   with the planned files ≤500 LOC; also confirm the modified E2E files meet
   their explicit plan targets.
6. Code Reviewer returns a clean pass after each implementation/review loop and
   every delegated hand-off passes the `Files read` gate.

---

## Documentation and rollout notes

### Objective

Reconcile planned documentation with the shipped implementation without
claiming backend or API changes that do not exist.

### Required checks

1. Docs agent reads `@SPEC.md`, `@TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`,
   `@docs/developer/frontend/data-analysis-architecture.md`,
   `@docs/developer/data-shapes/frontend-data-analysis-response.md`,
   `@docs/pedagogy/data-analysis-scoring.md`, and
   `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`;
   its hand-off must list every file under `Files read`.
2. Replace `Planned — Not implemented` markers in the architecture and
   data-shape documents only for delivered behaviour; retain any genuinely
   pending marker.
3. Update the teacher-facing zero-weight section from planned to current
   behaviour and keep the explanation non-technical.
4. Reconcile shared-helper standards §9.18 with actual module names, ownership,
   and statuses.
5. Confirm the data-shape index correctly says this is an in-memory frontend
   validation contract with no persistence or API endpoint.

---

## Suggested implementation order

1. Section 1 — Public contract and validation.
2. Section 2 — Analyser dual accumulation and aggregate resolution.
3. Section 3 — Heatmap adapter contribution projection.
4. Section 4 — Shared metric display, filtering, and ordering.
5. Section 5 — Task heatmap presentation.
6. Regression and contract hardening.
7. Documentation and rollout reconciliation.
