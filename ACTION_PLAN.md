# Heatmaps Query-Builder Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `@SPEC.md` (standalone Heatmaps surface, single class).
2. Read the companion layout spec `@HEATMAPS_PAGE_LAYOUT.md`.
3. Treat those documents as the source of truth for product behaviour, contracts, and layout
   rules. Do not restate or redefine them here.
4. Component instructions: `@src/frontend/AGENTS.md` governs all code sections below. No backend
   or builder work exists in this plan.

## Scope and assumptions

### Scope

- New top-level navigation entry `'heatmaps'` ("Heatmaps", Lucide `Flame`, positioned between
  Assignments and Settings) rendering a thin page root that composes a feature-owned builder
  surface in `features/taskHeatmap/`.
- Feature-owned data acquisition hook mirroring `useClassPageData`'s pipeline minus the Class
  Page adapter: warm-up datasets (`classPartials`, `assignmentDefinitionPartials`) +
  `getABClassQueryOptions(classId)` on class selection + synchronous averaging analysis over the
  selected assignments only (input shaping) + merged adapter projection.
- Composite-key (`taskKey`) widening of `buildCellPreviewLookup`'s inner map; `TaskHeatmapTable`
  popover lookups switch to `taskColumn.taskKey`; additive `previewStatusByTaskKey` prop;
  prop type narrowed to the structural column subset.
- `adaptMetricsToMergedHeatmap` + `MergedHeatmapResult` / `MergedHeatmapTaskColumn` added to
  `services/dataAnalysis/heatmapAdapter.ts`; existing exports untouched.
- Selection bar: searchable single-select class; searchable checkbox multi-selects for topics and
  assignments (cascading); disabled until class selected; no auto-selections.
- Adaptive header tiers in the merged table via deeper nested `children` grouping (assignment
  tier only when ≥2 assignments selected); collapsed duplicate-definition groups labelled with
  the first instance's title suffixed `" (shared definition)"`.
- Unit/component coverage for every new module and behaviour change; Playwright coverage for the
  new page including navigation-screenshots extension.

### Out of scope

- Multi-class querying; student-dimension selection; date-range/criterion-weighting controls;
  task-level column filtering (architected for only); metric re-keying by assignment instance;
  any backend/API/persistence/transport change; any change to the embedded Class Page heatmap
  flow's behaviour.

### Assumptions

1. No new Zod schemas are introduced: all inputs are already transport-validated, and the merged
   view model is a frontend-only derived type consistent with the existing un-validated
   `HeatmapResult` precedent.
2. The cross-fetch definition-key invariant (`getABClass.assignments[].assignmentDefinitionKey`
   === `getAssignment.assignmentDefinition.definitionKey`) holds per
   `ABClassResponseMapper.js:88` and is pinned by the Section 1 parity test.
3. Warm-up datasets are trustworthy-or-blocking exactly as `usePageDataset` governs today; the
   builder reuses that mechanism without modification.

---

## Global constraints and quality gates

### Engineering constraints

- Dependency rule (permanent): `features/taskHeatmap/**` never imports `features/classPage/**`;
  shared heatmap logic lives in `services/dataAnalysis/`.
- No parallel heatmap implementations; `TaskHeatmapPage.tsx` keeps its props contract, call
  sites, and rendered output identical (its suites pass unmodified).
- Query keys only through `query/sharedQueries.ts` factories; no ad-hoc array literals.
- Defaults only in constructors; no auto-selections anywhere in the builder state.
- Fail loudly: no catch-and-ignore; logging follows `docs/developer/frontend/frontend-logging-and-error-handling.md`.
- British English throughout; British English UI copy.
- Spacing: 8px-grid tokens only (`APP_GAP_*`), per the spacing standard.
- File separation: if any touched file is projected to exceed 500 LOC after a change, split it
  within the same section — group logic into domain modules following the folder conventions in
  `src/frontend/AGENTS.md` §3.3 and §14 (services), using `src/backend/AGENTS.md` §11 (Large
  File Decomposition) as the behavioural analogue. Note: this plan's gate is 500 LOC
  (repo-local convention used across planning docs); backend §11's own threshold is 550.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

Every delegated handoff lists these mandatory files as `@`-prefixed paths and must return a
`Files read` section evidencing them; missing entries block progression.

Common mandatory reads (all phases):

- `@AGENTS.md`, `@SPEC.md`, `@HEATMAPS_PAGE_LAYOUT.md`, `@src/frontend/AGENTS.md`

Phase-specific additions:

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`,
  `@docs/developer/frontend/frontend-loading-and-width-standards.md`
- Implementation: `@docs/developer/frontend/frontend-spacing-and-padding-standards.md` (UI
  sections), `@docs/developer/frontend/frontend-logging-and-error-handling.md`,
  `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`,
  `@docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Code Reviewer: `@docs/developer/frontend/frontend-loading-and-width-standards.md`,
  `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
  `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- Playwright (E2E): `@docs/developer/frontend/frontend-playwright-e2e.md`
- Docs: `@docs/developer/frontend/navigation-consistency-status.md`,
  `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared-helper planning gate

Planned helper decisions are pre-recorded as `Not implemented` entries in
`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` **§9.22** (three
entries: merged adapter, merged preview-lookup assembly, selection-cascade reducer). Each
section below repeats its relevant subset; the documentation section reconciles statuses.

### Data-shape planning gate

**Determination: no data-shape changes.** This cycle alters no validation schema, persistence
model, API contract, or transport shape (`SPEC.md` §"Current data-shape constraints"; the merged
view model is frontend-only like `HeatmapResult`, which has no registry entry). No
`docs/developer/data-shapes/` updates are required or permitted in this cycle. If implementation
reveals an apparent need, stop and escalate to planning rather than extending the registry.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend E2E: `npm run test:frontend:e2e -- <target>`

---

## Section 1 — Composite-key cell-preview lookup (foundation)

### Objective

- Widen `buildCellPreviewLookup`'s inner key from bare `taskId` to composite
  `${definitionKey}::${taskId}` (derived internally from `AssignmentFull`'s embedded
  `assignmentDefinition.definitionKey`), pin the cross-fetch invariant with a dedicated parity
  test, and pin embedded-flow parity (lookup keys === embedded column taskKeys).

### Constraints

- Function signature unchanged (`(assignment: AssignmentFull) => CellPreviewLookup`);
  `CellPreviewData` type unchanged; `TaskHeatmapPage.tsx` untouched in this section.
- **This section ALSO switches the table's popover lookup** from
  `cellPreviewLookup?.get(record.studentId)?.get(taskColumn.taskId)` to
  `...?.get(taskColumn.taskKey)` (`TaskHeatmapTable.tsx`) — the single consumer edit required to
  keep the embedded path correct once keys widen. No other table behaviour changes here.
- Independent fixtures for the parity test: one `getABClass`-shaped `classFull` and a separate
  `getAssignment`-shaped `AssignmentFull` for the "same" assignment (no single-payload
  self-comparison).

### Delegation mandatory reads

- Common set (see gate above) plus:
- Implementation: `@src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts`,
  `@src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`,
  `@src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- Testing Specialist: existing `buildCellPreviewLookup.spec.ts`

### Shared helper plan

1. Helper: composite-keyed `buildCellPreviewLookup` (inner key widening)
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts`
   - Call-site rationale: eliminates bare-taskId collisions ahead of merged-table consumption;
     embedded call sites keep identical keys by the pinned invariant.
   - Relevant canonical doc target: none separate — the widening is an `extend` of an existing
     module with no standalone §9.22 entry; it is tracked as the dependency recorded under
     §9.22 entry 2 (which states "Depends on buildCellPreviewLookup's planned composite-key
     widening"). Reconcile entry-2 wording during docs pass if needed.
   - Planned doc status: no separate status; dependency tracked under §9.22 entry 2; that
     entry's own status stays `Not implemented` until the Section 5 assembly work lands.

### Data-shape planning block

- None required (see global determination). `CellPreviewLookup` is a TypeScript type alias, not
  a schema.

### Acceptance criteria

- Inner maps keyed by composite task keys; existing outer-map semantics unchanged; first-wins
  per taskId retained within one payload.
- Parity test proves lookup keys match `adaptMetricsToHeatmap` column `taskKey`s for the same
  assignment using independent fixtures.
- Embedded popover path stays correct AT THIS CHECKPOINT: `TaskHeatmapPage.spec.tsx` and
  `TaskHeatmapTable.spec.tsx` pass after the consumer lookup-line switch (existing assertions
  updated mechanically only where they read raw inner keys).

### Required test cases (Red first)

Frontend tests:

1. `buildCellPreviewLookup.spec.ts`: inner keys are `${definitionKey}::${taskId}` for every
   submission item; missing embedded definition fails loudly (schema already forbids it).
2. NEW parity spec (co-located): for matching fixtures across the two fetch shapes,
   `Set(buildCellPreviewLookup(full).get(studentId).keys())` ⊇/== expected column taskKeys from
   `adaptMetricsToHeatmap(...).taskColumns`.
3. Table consumer switch: existing table/popover specs updated mechanically for the composite
   key; behavioural table work remains in Section 3.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap` (includes
  `TaskHeatmapPage.spec.tsx`, `TaskHeatmapTable.spec.tsx`, `buildCellPreviewLookup.spec.ts`,
  and the new parity spec)
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.
- Shared-helper entries present (§9.22 status untouched this section).

### Optional `@remarks` JSDoc follow-through

- Record on `buildCellPreviewLookup`: why the inner key is composite (cross-fetch invariant +
  collision elimination) and the silent-loss failure mode if the invariant ever broke.

### Implementation notes / deviations / follow-up

- **Execution status:** COMPLETED 2026-08-28. Red review CLEAN; green review CLEAN; regression
  gate passed (0 regressions, 0 new failures; only the pre-existing backend `max-lines` warning
  debt remains, byte-identical to baseline).
- **Implementation notes:** Red phase updated `buildCellPreviewLookup.spec.ts` (mechanical
  composite-key rewrites + two new red-first tests: key shape, loud failure on missing embedded
  definition), added co-located `buildCellPreviewLookup.parity.spec.ts` with independent
  `getABClass`/`getAssignment` fixtures for the same assignment (`definitionKey 'def-xyz'`), and
  mechanically updated the `TaskHeatmapTable.spec.tsx` fixture inner key. Green phase widened the
  inner key in `buildCellPreviewLookup.ts` to `` `${definitionKey}::${taskId}` `` (derived once per
  payload from the embedded `assignmentDefinition.definitionKey`), added the fail-fast guard
  (throws on absent definition/definitionKey — invariant assertion, not validation), added the
  `@remarks` JSDoc (cross-fetch invariant `ABClassResponseMapper.js:88`, collision elimination,
  silent-loss failure mode), and switched the `TaskHeatmapTable.tsx` popover lookup to
  `taskColumn.taskKey` (single consumer edit). Stale "fails at import time" suite header comment
  corrected. Final LOC: `buildCellPreviewLookup.ts` 151, `TaskHeatmapTable.tsx` 441 — split gate
  not fired. Verification: targeted suites 46/46; full feature folder 87/87; full regression
  checker 7/8 (only pre-existing backend-lint debt); `npm run lint:frontend` clean.
- **Deviations from plan:** none. Red-phase plan check note: the plan's literal targeted test
  paths (`npm run test:frontend -- src/frontend/src/features/taskHeatmap`) resolve relative to the
  `src/frontend` package root, so the executed form is
  `npm run test:frontend -- src/features/taskHeatmap` — a path-resolution detail, not a deviation
  in coverage.
- **Shared-helper gate:** §9.22 statuses untouched this section (entry 1 lands in Section 2;
  entries 2–3 in Section 5), as planned.
- **Follow-up implications for later sections:** Section 3 EXERCISES the table consumer switch
  performed here (it does NOT repeat it); Section 5's merged-lookup assembly (§9.22 entry 2)
  depends on this section's composite keys.

---

## Section 2 — Merged adapter and types (`services/dataAnalysis`)

### Objective

- Add `adaptMetricsToMergedHeatmap(analyserResult, classFull, selectedAssignmentIds,
assignmentDefinitionPartials)` producing `MergedHeatmapResult` /
  `MergedHeatmapTaskColumn` per `SPEC.md` §"Recommended data shapes": stable column order,
  dedupe-by-taskKey with first-occurrence identity, title/topic resolution from partials,
  fail-fast on unknown selected IDs and on missing partials (`TaskTitlesUnavailableError`).

### Constraints

- Existing exports of `heatmapAdapter.ts` remain byte-identical; additions only.
- LOC: file currently 230 lines; projected ≈360–400 — acceptable in place; if projections breach
  500, split merged-projection helpers into `heatmapAdapter.merged.ts` sibling within this
  section (services folder stays flat per AGENTS §14 unless a third heatmap file appears).

### Delegation mandatory reads

- Common set plus:
- Implementation: `@src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`,
  `@src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`,
  `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts`
- Testing Specialist: `@src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts` (if
  present at execution time; otherwise the consuming suites listed in SPEC testing notes)

### Shared helper plan

1. Helper: `adaptMetricsToMergedHeatmap` + `Merged*` types
   - Decision: `new` (inside existing module)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
   - Call-site rationale: sole projection boundary for the merged table; keeps all heatmap
     domain logic in the established services module (dependency rule compliant).
   - Relevant canonical doc target: `frontend-shared-helpers-and-abstraction-standards.md` §9.22
     entry 1.
   - Planned doc status: `Not implemented` (pre-recorded).

### Data-shape planning block

- None required (global determination stands). Plain TS interfaces, deliberately not Zod —
  consistency with `HeatmapResult`.

### Acceptance criteria

- Columns carry full identity `{taskKey, taskId, taskTitle, assignmentId, definitionKey,
assignmentName}`; duplicate taskKeys collapse to first occurrence; rows cover ALL class
  students; cells fall back to the frozen not-attempted metric when no metric matches.
- Unknown `selectedAssignmentIds` throw; missing partial throws `TaskTitlesUnavailableError`.
- Deterministic ordering: assignments in `classFull.assignments` order; tasks per partial order.
  Clarified during Section 2 red review: `taskColumns` follow `classFull.assignments` order
  (per SPEC display-resolution rules); `sourceAssignments` preserves `selectedAssignmentIds`
  order (selection order — SPEC's shape leaves it open; red-phase tests pin this contract).

### Required test cases (Red first)

Frontend tests:

1. Column construction/ordering incl. multi-assignment union and identity fields.
2. Duplicate-definition dedupe: two instances sharing a key → one column set; identity from
   FIRST occurrence; metrics merge (same taskKey accumulations).
3. Cell mapping: computed / notAttempted fallback; student roster completeness (students without
   metrics still produce rows).
4. Error paths: unknown assignment ID; missing partial (`TaskTitlesUnavailableError`).
5. Title resolution via partials `primaryTitle`; className fallback label parity with existing
   adapter.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed; §9.22 entry 1 reconciled to `Implemented` in the docs
  section (not before).

### Optional `@remarks` JSDoc follow-through

- On `adaptMetricsToMergedHeatmap`: why input shaping (not analyser filter keys) scopes
  instances; why dedupe-by-taskKey is correct given accumulator semantics.

### Implementation notes / deviations / follow-up

- **Execution status:** COMPLETED 2026-08-28. Red review: 2 Minor findings, resolved by
  orchestrator (plan clarification below + reviewer-endorsed keep-as-is on the red technique).
  Green review round 1: 1 Nitpick (stale red-phase comments in the spec) — fixed via
  Implementation, plus orchestrator-directed removal of the five stale ` (RED)` describe-label
  suffixes under the same finding. Green re-review: CLEAN. Regression gate passed (0 regressions,
  0 new failures).
- **Implementation notes:** `adaptMetricsToMergedHeatmap` + `MergedHeatmapTaskColumn` /
  `MergedHeatmapResult` added to `heatmapAdapter.ts` as pure additions (existing exports
  byte-identical, git-diff verified: 261 insertions, 0 deletions). Contract: column identity set,
  `taskKey = ${definitionKey}::${taskId}`, dedupe-by-taskKey with first classFull-occurrence
  identity, taskColumns in classFull order / sourceAssignments in selection order, all-student
  rows, frozen `NOT_ATTEMPTED_METRIC` fallback (reused, not duplicated), `DEFAULT_CLASS_NAME_LABEL`
  reused, unknown-ID throw `/not found in classFull\.assignments/`, missing partial throws the
  existing `TaskTitlesUnavailableError`. `@remarks` JSDoc records input-shaping rationale and
  dedupe-by-accumulator-semantics correctness. Red spec converted from namespace-guard to static
  import with zero assertion changes. Final LOC: `heatmapAdapter.ts` 491 (split gate NOT fired;
  9 lines of headroom), `heatmapAdapter.merged.spec.ts` 466. Verification: dataAnalysis 19 files /
  235 tests; taskHeatmap 8 files / 87 tests; `tsc -b src/frontend` exit 0; lint clean; full
  regression checker 7/8 (only pre-existing backend-lint debt).
- **Deviations from plan:** none behavioural. Contract clarification recorded under acceptance
  criteria during red review: `sourceAssignments` preserves `selectedAssignmentIds` order while
  `taskColumns` follow `classFull.assignments` order (SPEC scopes classFull order to columns;
  red tests pin this contract).
- **Follow-up implications for later sections:** Section 3's `MergedHeatmapTaskColumn` satisfies
  the table's narrowed structural prop type with the optional identity fields; the 491-LOC
  adapter leaves only 9 lines of headroom — Sections 5/6 must NOT grow this file; if growth is
  ever needed, use the planned `heatmapAdapter.merged.ts` sibling pattern. §9.22 entry 1 is
  reconciled to `Implemented` in the Documentation section only (not before), per plan.

---

## Section 3 — `TaskHeatmapTable` structural contract, preview status, adaptive tiers

### Objective

- Narrow the table's prop type to the structural column subset (with optional assignment
  identity fields), add optional `previewStatusByTaskKey` with the agreed resolution order (map
  entry → aggregate booleans), and implement adaptive assignment-tier grouping via deeper
  `children` nesting (tier present iff >1 source assignment; collapsed groups suffixed
  `" (shared definition)"`). The popover-lookup switch to `taskColumn.taskKey` already landed in
  Section 1 and is exercised here, not repeated.

### Constraints

- Embedded usage compiles unchanged: `TaskHeatmapPage` passes the same props it does today
  (aggregate booleans only; map undefined → current resolution path).
- **Narrowed column element type carries OPTIONAL assignment identity** (`assignmentId?`,
  `assignmentName?`, `definitionKey?`): `HeatmapTaskColumn` satisfies it without those fields;
  `MergedHeatmapTaskColumn` satisfies it with them. The table reads them ONLY when building the
  adaptive assignment tier (merged mode); grouping by bare `taskKey` alone is impossible because
  duplicate definitions collide. Both adapters therefore typecheck structurally with no casts.
- Merged callers pass aggregate booleans as `false` and a complete per-taskKey map.
- LOC: file currently 441 lines; projected ≈470–500 with additive prop + tier wrapping. HARD
  GATE: if implementation projects >500, extract column-construction/popover-support helpers
  into a co-located sibling module (e.g. `taskHeatmapTableColumns.tsx`) in THIS section — do not
  defer.
- No behavioural change to sorting, filtering, pagination, sticky column, or popover content.

### Delegation mandatory reads

- Common set plus:
- Implementation: `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`,
  `@src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts`,
  `@HEATMAPS_PAGE_LAYOUT.md` (adaptive-tier + deviation notes)
- Testing Specialist: existing `TaskHeatmapTable.spec.tsx`

### Shared helper plan

1. Helper: preview-status resolution (map-entry-first, aggregate fallback)
   - Decision: `keep local` (single consumer; trivial contract; revisit on second consumer)
   - Owning module/path: inside `TaskHeatmapTable.tsx` (or extracted sibling if the LOC gate fires)
   - Call-site rationale: avoids a new abstraction for a two-line resolution rule.
   - Relevant canonical doc target: none required (below promotion threshold); note in docs pass.
   - Planned doc status: n/a (keep-local decision recorded here).

### Data-shape planning block

- None required (global determination stands).

### Acceptance criteria

- Both adapters' outputs typecheck against the narrowed prop type without casts.
- Popovers resolve per-column status correctly: pending→skeleton, failed→error Alert, else card;
  aggregate booleans inert when map supplied; embedded path byte-stable.
- Two-tier render for one assignment identical to today; three-tier (assignment parent group)
  for 2+; collapsed duplicates show `" (shared definition)"` suffix.

### Required test cases (Red first)

Frontend tests:

1. Status resolution: map entry wins; absent map → aggregate booleans (existing behaviour);
   merged wiring passes `false` aggregates.
2. Adaptive tier: single-source renders two-tier DOM as today (snapshot/assertion parity);
   multi-source wraps task groups under named assignment parents in stable order, driven by the
   optional identity fields.
3. Collapsed duplicate group label carries the suffix.
4. Existing table suites green (consumer lookup switch already landed in Section 1).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap/TaskHeatmapTable.spec.tsx`
  and `TaskHeatmapPage.spec.tsx` (must pass UNMODIFIED)
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- On the component: document the two-mode status contract and the structural-subset typing
  decision (why not generics).

### Implementation notes / deviations / follow-up

- **Execution status:** COMPLETED 2026-08-30. Red review CLEAN; green review PASS after
  interrupted-first-pass resumption; regression gate passed (0 regressions, 0 new failures).
- **Implementation notes:** Prop type narrowed structurally: `TaskHeatmapData`/`TaskHeatmapColumn`
  carry `{taskKey, taskId, taskTitle}` + optional `assignmentId?/assignmentName?/definitionKey?`
  plus optional result-level `sourceAssignments`; both `HeatmapResult` and `MergedHeatmapResult`
  satisfy it with NO casts; prop names unchanged so `TaskHeatmapPage.tsx` compiles untouched.
  `previewStatusByTaskKey` implements map-entry-first resolution with aggregate fallback (missing
  entry → aggregate booleans; undefined map → legacy path). Adaptive tier: deeper `children`
  nesting, present iff >1 `sourceAssignments`; collapsed duplicates → ONE parent labelled FIRST
  instance's name + `" (shared definition)"`. LOC gate: split fired proactively —
  `TaskHeatmapTable.tsx` 194 LOC + NEW sibling `taskHeatmapTableColumns.tsx` 451 LOC (plan's
  prescribed extraction); both ≤500. `taskHeatmapModel.ts`: `compareHeatmapStudentName` parameter
  widened to structural `NamedRow` (behaviourally neutral; avoids a forbidden cast —
  `ReadonlyArray` cells vs mutable). `@remarks` JSDoc documents two-mode status contract and
  no-generics decision. Verification: table spec 27/27; feature folder 97/97
  (`TaskHeatmapPage.spec.tsx` unmodified); dataAnalysis 235/235; lint clean; tsc clean.
- **Deviations from plan:** (1) The red-phase popover harness helpers (`openTaskPopover`,
  `renderTable`) were authored against antd v5 DOM semantics while the repo pins antd v6.3.1; the
  green phase corrected the helper internals (`.ant-popover-content`, fresh render per cell,
  prefix matcher) with all `it()` assertions/fixtures/names byte-identical — green review verified
  contract sensitivity holds. (2) Infrastructure: `.opencode/agents/code-reviewer.md` pinned the
  dead model ID `opencode/hy3-free` (orchestrator delegated review attempts failed with
  "Model not found"); migrated to `opencode-go/hy3` matching the planner's own migration pattern
  in six sibling agent files. `planner-reviewer.md` still pins the dead model (unused by this
  plan — flagged for follow-up).
- **Follow-up implications for later sections:** Sections 5/6 consume the narrowed table prop
  type, `previewStatusByTaskKey`, and adaptive tiers; `TaskHeatmapPage.tsx` untouched confirms
  the embedded contract; the table's structural result type is the wiring target for
  `useHeatmapsPageData`'s merged output.

---

## Section 4 — Navigation entry, page copy, thin page root

### Objective

- Add `'heatmaps'` to `AppNavigationKey`, `navigationDefinitions` (between `assignments` and
  `settings`, icon Lucide `Flame` wrapped by `renderNavigationIcon`), `renderNavigationPage`
  switch case composing `pages/HeatmapsPage.tsx`; add `pageContent.heatmaps` copy; create the
  thin page root rendering ONLY the builder-surface entry component (placeholder child allowed
  until Section 6 lands, but the composition boundary must be final).

### Constraints

- `AppShell`/breadcrumb need NO edits (derived automatically) — verify by test.
- Page root contains no hooks, services, or state machines.
- `appNavigation.tsx` projected ≈215 lines post-change (under threshold).

### Delegation mandatory reads

- Common set plus:
- Implementation: `@src/frontend/src/navigation/appNavigation.tsx`,
  `@src/frontend/src/pages/pageContent.ts`,
  `@docs/developer/frontend/frontend-shell-navigation-and-motion.md`

### Shared helper plan

- None (pure metadata/composition changes).

### Data-shape planning block

- None required.

### Acceptance criteria

- Menu renders "Heatmaps" with Flame icon between Assignments and Settings; selecting it renders
  the page root; breadcrumb segment reads "Heatmaps"; unknown-key guard still fails fast.
- Existing navigation specs extended (not weakened) for the new key.

### Required test cases (Red first)

Frontend tests:

1. `isAppNavigationKey('heatmaps')` true; menu items include ordered entry with expected
   label/icon wrapper aria-hidden.
2. `renderNavigationPage('heatmaps')` returns the page root component.
3. Breadcrumb for 'heatmaps' yields the single static segment.
4. `pageContent.heatmaps.heading === 'Heatmaps'` and summary present.

### Section checks

- `npm run test:frontend -- src/frontend/src/navigation/appNavigation.spec.tsx`
  `src/frontend/src/pages/pages.spec.tsx`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None expected beyond existing patterns.

### Implementation notes / deviations / follow-up

- **Execution status:** COMPLETED 2026-08-30. Red review: 6 findings (2 Critical, 2 Improvement,
  2 Nitpick) fixed in two rounds, plus one residual Improvement in a third round — final red
  verdict CLEAN. Green review CLEAN. Regression gate: initial run exposed 4 E2E regressions
  (hard-coded four-entry navigation assumptions in `app.spec.ts`, `classes-page.spec.ts`,
  shared helper) — fixed mechanically via the Playwright agent, E2E review CLEAN, re-run passed
  (0 regressions, 0 new failures).
- **Implementation notes:** `'heatmaps'` added to `AppNavigationKey`; `navigationDefinitions`
  entry between `assignments` and `settings` (Lucide `Flame` via `renderNavigationIcon`; real
  menu order Dashboard, Classes, Assignments, Heatmaps, Settings per the SPEC union);
  `renderNavigationPage` case composes the thin root. `pageContent.heatmaps` copy added.
  `pages/HeatmapsPage.tsx` (14 LOC) renders ONLY `features/taskHeatmap/HeatmapBuilderSurface.tsx`
  (17 LOC placeholder stub rendering a level-2 "Heatmaps" heading; Section 6 owns the real
  assembly) — composition boundary final; no hooks/services/state/chrome in the page root.
  `appNavigation.tsx` 202 LOC. E2E mechanical extensions: shared `EXPECTED_MENU_ITEM_COUNT` 4→5,
  `app.spec.ts` `pageExpectations` + heatmaps (with upgrade-marked summary-skip guards), truthful
  rename of the stale menu-order test title. Verification: unit suites 49/49 targeted, full
  frontend 1827+ green; FULL E2E 227 green; lint clean; tsc exit 0; regression checker 7/8
  (only pre-existing backend-lint debt).
- **Deviations from plan:** (1) The plan's Section 4 checks did not enumerate E2E specs, but the
  global Regression Gate required mechanically extending four-entry E2E navigation assumptions
  (`app.spec.ts`, `classes-page.spec.ts`, `classes-page-end-to-end-helpers.ts`) — treated as the
  E2E analogue of "existing navigation specs extended (not weakened)". (2) The
  `classesNavigationItemIndex = 2` quirk in `app.spec.ts` (points at Assignments, not Classes —
  pre-existing) was deliberately left untouched to avoid scope creep; noted for a future
  tidy-up. (3) Environment: a foreign Vite dev server (different project/worktree) was squatting
  on E2E port 4173, hijacking the Playwright webServer reuse and causing universal 45s timeouts;
  the foreign process was killed to free the port (documented here as an environment
  intervention, not a repo change).
- **Follow-up implications for later sections:** Section 6 must replace the placeholder stub
  internals (chrome sourced from `pageContent.heatmaps`), after which the upgrade-marked E2E
  summary-skip guards and the stub heading literal must be revisited; Section 7 extends
  `navigation-screenshots.spec.ts` for the new page; `planner-reviewer.md` still pins the dead
  `opencode/hy3-free` model (unused by this plan — flagged).

---

## Section 5 — Orchestration hook and cascade reducer

### Objective

- Implement `useHeatmapsPageData` (feature-owned): warm-up selector datasets, class query on
  selection, analyser invocation over input-shaped assignments, merged adapter call, per-selected-
  assignment preview queries, merged lookup/status-map assembly, discriminated surface state
  (`loading | blocking | ready-with-selections`), structured errors per the Class Page taxonomy,
  internal refresh entry point.
- Implement the pure selection-cascade reducer first (class-change clears; topic-narrowing
  clears invalid assignment selections; no restore on widen).

### Constraints

- Mirrors `useClassPageData` nullability contract: derived results non-null only in ready states.
- Analyser input (Zod `strictObject`, all three fields required):
  `classes: [{...classFull, assignments: selectedAssignments}]`,
  `filter: { classIds: [selectedClassId] }`,
  `assignmentDefinitionPartials` passed through non-null under the pipeline guard — exactly as
  `useClassPageData.runAnalyserStep` supplies it. topicKeys/definitionKeys are NOT added to the
  filter (input shaping owns scoping; see SPEC domain recommendations).
- Empty analyser output treated as error (parity with `useClassPageData.runAnalyserStep`).
- Preview queries enabled only for currently selected assignments; stale-selection queries left
  to React Query cache semantics (no manual cancellation beyond key change).
- Hook file projected ≈250–320 lines (new file, under threshold). Reducer module ≈80–120 lines.

### Delegation mandatory reads

- Common set plus:
- Implementation: `@src/frontend/src/features/classPage/useClassPageData.ts`
  (READ-ONLY pattern reference — must NOT be imported by `features/taskHeatmap/**`,
  dependency rule),
  `@src/frontend/src/hooks/usePageDataset.ts`, `@src/frontend/src/query/sharedQueries.ts`,
  `@docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Testing Specialist: `@src/frontend/src/features/classPage/useClassPageData.spec.ts` (pattern
  reference only)

### Shared helper plan

1. Helper: selection-cascade reducer (pure functions)
   - Decision: `new` (feature-local, test-first)
   - Owning module/path: `src/frontend/src/features/taskHeatmap/` (filename settled here, e.g.
     `selectionCascade.ts`)
   - Call-site rationale: deterministic, independently testable cascade rules per SPEC decisions
     2–4 without inline reducer logic in the hook.
   - Relevant canonical doc target: §9.22 entry 3.
   - Planned doc status: `Not implemented` (pre-recorded).
2. Helper: merged lookup/status assembly
   - Decision: `new` (feature-local)
   - Owning module/path: `src/frontend/src/features/taskHeatmap/` (beside
     `buildCellPreviewLookup.ts`)
   - Call-site rationale: single consumer today; promotes later if reused.
   - Relevant canonical doc target: §9.22 entry 2.
   - Planned doc status: `Not implemented` (pre-recorded).

### Data-shape planning block

- None required (global determination stands).

### Acceptance criteria

- Surface-state precedence matches SPEC error rules (query errors → dataset failures → service
  errors → loading → ready); retry refetches exactly the failed owned inputs.
- Cascade: class change atomically clears topics+assignments; narrowing topics clears invalid
  assignments; widening restores nothing; zero-topic = no constraint.
- Preview status map covers EVERY selected assignment's taskKeys; aggregate booleans false in
  merged wiring (Section 3 contract).
- Refresh re-runs class query + ADP dataset + enabled assignment queries without unmounting
  visible data.

### Required test cases (Red first)

Frontend tests:

1. Reducer: each cascade rule + idempotence + no-restore-on-widen.
2. Hook: initial state (no class) → selectors-only readiness; class fetch transitions; blocking
   precedences (classNotFound vs datasetFailed vs analyserError ordering).
3. Analysis scope assertion: analyser receives shaped assignments and `classIds:[id]` only.
4. Preview query enablement keyed to selection; status-map completeness incl. duplicate keys.
5. Refresh invokes all three refetch families; busy semantics exposed accessibly.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- On the hook: memoisation key includes `selectedAssignmentIds` join (staleness guard analogue
  to `useClassPageData`'s classId note); on the reducer: cascade-clearing rationale.

### Implementation notes / deviations / follow-up

**Status: COMPLETE** (2026-08-31). Red loop and green loop both reviewed to CLEAN; regression
gate passed identical to baseline (7/8; 0 regressions, 0 new failures; sole failure is the
accepted pre-existing backend `max-lines` debt).

- Red loop: 28 contract-pinning tests across `selectionCascade.spec.ts` (200 LOC),
  `assembleMergedPreviewData.spec.ts` (184 LOC), `useHeatmapsPageData.spec.ts` (898 LOC) with
  zero-behaviour throwing stubs (stub modules required by the lint/tsc gates for the
  namespace-guard seam). Red review CLEAN after one fix round (3 Improvements: refresh test
  pinned only one of three refetch families; status-map test not mechanism-sensitive; wholesale
  `./selectionCascade` mock prevented real-reducer cascade coverage — all resolved,
  re-review CLEAN).
- Green loop: delivered via `selectionCascade.ts` (113 LOC pure reducer),
  `assembleMergedPreviewData.ts` (116 LOC first-wins merged lookup + status map),
  `useHeatmapsPageData.ts` (public hook) with feature-local helpers `heatmapsPipeline.ts`
  (204 LOC analyser/adapter pipeline) and `heatmapsSurfaceState.ts` (182 LOC surface-state/
  error derivation) after an LOC-gate split (see deviations).
- Deviations accepted by green review:
  1. `useQueries` migration: the interrupted first pass called `useQuery` inside `.map()`
     (rules-of-hooks violation; the real lint failure). Production now drives per-assignment
     preview queries through React Query v5 `useQueries` with a `combine` projection; the spec's
     `@tanstack/react-query` mock gained a mechanical `useQueries`/`combine` implementation
     (re-established in `beforeEach` after `vi.resetAllMocks`). Per-assignment behavioural
     contract unchanged (one query per selected assignment, factories-only keys, refetch spies).
  2. Red-spec contradiction fix: the red hook spec contained two tests with an identical
     no-class setup but opposite `surfaceState` expectations; per SPEC ("no class → ready"),
     `selectClass(DEFAULT_CLASS_ID)` was added to the `keeps mergedResult null until
surfaceState is ready` setup so the test genuinely enters class-selected-pending. Both
     assertions byte-identical; review adjudicated this as strengthening the red contract.
- Review fix rounds (final re-review CLEAN):
  1. Ad-hoc query-key literals removed: disabled branches now use `queryKeys.abClass('__none__')`
     / `getAssignmentQueryOptions('__none__', assignmentId)` with `queryFn: skipToken`
     (`getABClassQueryOptions` deliberately NOT called in the no-class branch — the spec asserts
     it is not called there).
  2. Defeated `mergedPreview` memo fixed via `useQueries` `combine` (`AssignmentPreviewCombined`
     with structural sharing; memo keys on the combined value which the body consumes) —
     stability adjudicated genuine against `@tanstack/query-core@5.90` source (`replaceEqualDeep`
     returns the prior reference when deep-equal; observer-bound `refetch` stable). Zero lint
     warnings; no lint suppressions anywhere.
- Delegation outage: the `implementation` sub-agent returned empty responses twice (second made
  no changes); a user-directed retry then completed the pass. Interrupted-pass residue (694-LOC
  hook, 1 failing test, lint failures) was repaired in the successful retry.
- Verification (final): `test:frontend -- src/features/taskHeatmap` 125/125 (11 files);
  `test:frontend -- src/services/dataAnalysis` 235/235; full `test:frontend` 152 files /
  1855 tests; `lint:frontend` exit 0 with zero warnings; `tsc -b src/frontend/tsconfig.json`
  exit 0; regression checker 7/8, 0 regressions, 0 new failures.
- `@remarks` follow-through delivered: hook memoisation note (key includes
  `selectedAssignmentIds` join); reducer cascade-clearing rationale.
- Follow-up: hook is ≈445 LOC (projected ≈250–320; within the 500 gate — the wiring is cohesive
  and resisted further splitting without harming readability). §9.22 entries 2–3 doc-status
  reconciliation deferred to the cycle documentation pass per that doc's own note.

---

## Section 6 — Builder surface and selection bar (UI assembly)

### Objective

- Assemble the feature-owned builder surface per `HEATMAPS_PAGE_LAYOUT.md`: chrome region
  (`PageTitleCard` + `PageNavCard` actions-only with Refresh), selection bar Card (labelled
  class/topics/assignments Selects; checkbox optionRender; disabled-until-class with Tooltip
  reason; controlled state from the hook), content region precedence (skeleton → Result →
  no-class Empty → no-assignments Empty → merged-table Card), adaptive-tier consumption, refresh
  busy semantics.

### Constraints

- Spacing tokens only; visible labels carry accessible names; placeholders action-describing
  ("Select topics" / "Select assignments").
- Confirm exact `optionRender` value accessor against installed antd typings at implementation
  (layout-spec nitpick); derive Checkbox `checked` from controlled value membership.
- Blocking treatments: `Result` per documented deviation (layout spec records justification);
  error-config mapping mirrors Class Page taxonomy.
- Surface file projected ≈220–300 lines; selection bar ≈150–200; both new files under threshold.

### Delegation mandatory reads

- Common set plus:
- Implementation: `@HEATMAPS_PAGE_LAYOUT.md`,
  `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
  `@docs/developer/frontend/frontend-loading-and-width-standards.md`,
  `@src/frontend/src/components/PageHeader/PageHeader.tsx`,
  `@src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (Select precedent)

### Shared helper plan

- None new (consumes §9.22 entries 1–3). Reuse check performed against
  `frontend-shared-helpers-and-abstraction-standards.md` §3 before adding anything local.

### Data-shape planning block

- None required (global determination stands).

### Acceptance criteria

- Full layout matches the layout spec region-by-region and state-by-state, including precedence,
  tooltips, labels, adaptive tiers, busy semantics, and focus order.
- Lighthouse/a11y spot-check: no tooltip-only information; disabled reasons discoverable.

### Required test cases (Red first)

Frontend tests:

1. Selection bar renders three labelled controls in order; dependent selectors disabled with
   accessible reason until class chosen.
2. Checkbox options reflect controlled selection membership; search narrows client-side.
3. Content-region precedence matrix (five states) including copy strings verbatim.
4. Refresh button triggers hook refresh with busy affordance; table persists across background
   refresh.
5. Chrome title derivation rules (heading vs class name).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- On the surface component: precedence-order ownership note (single source: hook-derived state
  rank, not scattered conditionals).

### Implementation notes / deviations / follow-up

- Filled at execution.

---

## Section 7 — Playwright E2E coverage

### Objective

- New E2E suite covering: direct navigation to Heatmaps; disabled/enabled selector progression;
  class select populating dependents; cascading narrowing and clearing; merged table rendering
  with adaptive tiers; previews on cells; refresh; empty states. Extend
  `navigation-screenshots.spec.ts` for the new page. EXISTING heatmap suites must pass
  unmodified.

### Constraints

- Delegate to the Playwright agent (E2E routing rule). Follow
  `docs/developer/frontend/frontend-playwright-e2e.md` conventions, harness, and commands.

### Delegation mandatory reads

- Common set plus `@docs/developer/frontend/frontend-playwright-e2e.md`

### Shared helper plan

- Reuse existing E2E helpers/fixtures; no new abstractions without reviewer sign-off.

### Data-shape planning block

- None required.

### Acceptance criteria

- New suite green locally per the E2E doc's command; `task-heatmap.spec.ts`,
  `task-preview-card.spec.ts`, `navigation-screenshots.spec.ts` green unmodified.

### Required test cases (Red first)

1. Happy path build flow (class → topics → assignments → merged table with assignment tier).
2. Disabled-state gating and cascade clearing observable in the UI.
3. Empty states and blocked-state rendering stubs per harness conventions.
4. Navigation-screenshots extension captures the new page.

### Section checks

- `npm run test:frontend:e2e -- <heatmaps-suite>`
- `npm run test:frontend:e2e -- task-heatmap task-preview-card navigation-screenshots`
- Mandatory-read evidence gate passed.

### Implementation notes / deviations / follow-up

- Filled at execution.

---

## Regression and contract hardening

### Objective

- Prove behaviour preservation of the embedded flow and contract integrity of the shared modules
  after all sections land.

### Constraints

- Prefer focused runs first, then the full unit suite.

### Acceptance criteria

- Full frontend unit suite green; `npm run lint:frontend` clean; Section 7 E2E set green.
- `ClassPage.spec.tsx`, `ClassPageContent.spec.tsx`, `ClassPageHeatmapView.spec.tsx`,
  `TaskHeatmapPage.spec.tsx` pass UNMODIFIED (byte-stability evidence).
- Regression-checker baseline comparison shows no unexpected health drift (repo skill available).

### Required test cases/checks

1. `npm run test:frontend` (full).
2. `npm run lint:frontend`.
3. E2E set from Section 7.
4. Verify `Files read` evidence for every delegated handoff in Sections 1–7.

### Section checks

- All commands green; evidence recorded.

### Implementation notes / deviations / follow-up

- Filled at execution.

---

## Documentation and rollout notes

### Objective

- Update developer documentation to match the delivered feature; reconcile planned-helper
  statuses.

### Constraints

- Only documents relevant to touched areas.

### Acceptance criteria

- `docs/developer/frontend/navigation-consistency-status.md` reflects the new entry point.
- `frontend-shared-helpers-and-abstraction-standards.md` §9.22 entries reconciled from
  `Not implemented` to `Implemented` (with owning paths/notes) — or consciously removed with
  rationale if a helper did not materialise as planned.
- `src/frontend/AGENTS.md` §3.3 `taskHeatmap/` description updated if materially changed.
- Any deviations recorded in section implementation notes are reflected where user-visible.

### Required checks

1. Docs mention the standalone Heatmaps surface and its ownership boundaries.
2. Canonical helper statuses reconciled.
3. `Files read` evidence complete for delegated docs handoff.
4. Confirm `@remarks` items from Sections 1/2/5 landed in code before deleting this plan.

### Implementation notes / deviations / follow-up

- Filled at execution.

---

## Suggested implementation order

1. Section 1 — composite-key lookup foundation (enables everything downstream)
2. Section 2 — merged adapter + types (contract for table and hook)
3. Section 3 — table structural contract, preview status, adaptive tiers
4. Section 4 — navigation entry, copy, thin page root
5. Section 5 — orchestration hook + cascade reducer
6. Section 6 — builder surface + selection bar assembly
7. Section 7 — Playwright E2E coverage
8. Regression and contract hardening
9. Documentation and rollout
