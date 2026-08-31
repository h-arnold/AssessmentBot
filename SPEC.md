# Standalone Heatmaps Surface Specification (Query Builder, Single Class)

## Status

- Draft v1.0 — first planning round for the post-extraction querying cycle.
- Supersedes the delivered extraction spec (implemented in commit `ab54e3d`); that document's
  binding guardrails are carried forward below. The previous spec's "Future direction" Phase A
  (multi-assignment within one class) plus feature-owned acquisition begin here.

## Purpose

This document defines the first querying increment for the Task Heatmap feature: a standalone,
directly navigable **Heatmaps** page where the user builds task heatmaps by selecting:

1. exactly **one class** (which triggers the same full assignment fetch the Class Page performs),
2. zero or more **topics**, and
3. zero or more **assignments**

via a selection bar positioned directly above the heatmap table region. Selections render into a
**single merged heatmap table** spanning all selected assignments.

This feature is **not** intended to:

- Support more than one class per analysis (multi-class querying is deferred; the averaging
  analyser consumes only the classes the caller passes and never reads `filter.classIds`).
- Change any behaviour of the Class Page–embedded heatmap flow (`ClassPageContent` →
  `TaskHeatmapPage`) beyond nothing at all — that path is byte-stable.
- Add date-range or criterion-weighting controls.
- Implement task-based column filtering (recorded as future work in "Future direction"; this
  cycle only architects for it).
- Introduce any backend, API, persistence, or transport change.

## Agreed product decisions

1. **New top-level navigation entry labelled "Heatmaps".** Added to the state-based shell
   navigation (`dashboard | classes | assignments | heatmaps | settings`) — authoritatively
   positioned **between "Assignments" and "Settings"**, keeping the two content surfaces adjacent
   and Settings last. It carries a Lucide icon
   (icon choice is settled in the layout spec). It renders a thin page composition root that
   composes the taskHeatmap feature's new builder surface. Breadcrumb treatment follows the
   existing shell pattern (single static segment sourced from `pageContent`).
2. **Single class per analysis.** The class selector is a searchable single-select. Choosing a
   class triggers the full per-class fetch via `getABClassQueryOptions(classId)` exactly as
   `useClassPageData` does today, populating the topic and assignment selectors from that
   payload. Changing the class resets topic and assignment selections.
3. **Cascading topic → assignment selection.** Topics and assignments are searchable multi-selects
   presenting checkbox-style options. With no topic selected, all of the class's assignments are
   selectable. When one or more topics are selected, the assignment options narrow to assignments
   whose resolved `primaryTopicKey` matches the selected topics. If changing the topic selection
   invalidates already-selected assignments, those assignment selections are cleared.
4. **Progressive enablement.** The topic and assignment selectors are disabled until a class is
   selected. They become enabled once the class fetch completes successfully.
5. **Single merged table.** All selected assignments render into ONE heatmap table: rows are the
   class's students; columns are the union of the selected assignments' task columns, grouped so
   each assignment's tasks remain visually identifiable. The existing single-assignment
   `adaptMetricsToHeatmap` function is left untouched; a new services-layer merged-adapter
   function produces the combined view model.
6. **No automatic selections.** Nothing is pre-selected after a class loads (repo rule: defaults
   are never set unless instructed). Until at least one assignment is selected, the table region
   shows an explanatory empty state instead of a table.
7. **Future-work note (task filtering).** A later cycle is expected to add per-task column
   filtering on the merged table. To keep that cheap, every produced task column carries its full
   identity (assignment ID, definition key, task key, task ID, and display titles) so a future
   filter can slice columns without reshaping the view model.

## Existing system constraints

### Backend or API constraints already in place

- No backend change is permitted in this cycle. All acquisition uses existing allow-listed
  methods via existing frontend services: `getABClassPartials` (warm-up class list),
  `getAssignmentDefinitionPartials` (warm-up definition registry), and `getABClass` (per-class
  full read). The `getAssignmentTopics` warm-up dataset is available but is NOT consumed by this
  surface — topic labels resolve from the definition partials (see display-resolution rules).
- The averaging analyser (`services/dataAnalysis/analysers/averagingAnalyser.ts`) analyses
  whatever `classes[]` it is given; it ignores `filter.classIds`. Single-class scoping is
  achieved by passing exactly one fetched `ClassFull`.
- The analyser's own `topicKeys` / `assignmentDefinitionKeys` filters operate at definition-key
  granularity and intersect; because the builder shapes the input to exactly the selected
  assignment instances (see "Domain and contract recommendations"), those filter fields are not
  required for correct scoping in this cycle.
- `google.script.run` prohibits `Date`/`Function`/DOM types anywhere in payloads; all timestamps
  remain ISO strings end-to-end. No new transport payloads are introduced.

### Current data-shape constraints

- No validation schema, persistence model, API contract, or transport shape changes. The
  canonical data-shapes registry (`docs/developer/data-shapes/INDEX.md`) covers
  transport/persistence boundaries only; the merged heatmap view model is a frontend-only
  derived type (like today's `HeatmapResult`) and therefore requires no registry entry.
- Per-student-task metrics are keyed by `taskKey = ${definitionKey}::taskId` (no assignment-ID
  component). Consequence: two assignment instances sharing one definition key produce identical
  task keys and their submissions merge into the same accumulators. The merged table therefore
  de-duplicates columns by `taskKey`; such assignments share one column set fed by merged data,
  and the collapsed column's identity fields (assignment ID/name) are taken from the FIRST
  occurrence in the stable column order. This merged-semantics behaviour is accepted for v1 and
  documented in the UI (see rendering rules); re-keying metrics by assignment instance is
  deferred to a later cycle.
- Cell-preview lookups are built from one `AssignmentFull` payload and keyed
  `studentId → taskId → CellPreviewData`. **Agreed reconciliation:** the shared
  `buildCellPreviewLookup` widens its INNER key to the composite `taskKey`
  (`${definitionKey}::${taskId}`), derived internally from the payload's embedded
  `assignmentDefinition.definitionKey` (present on `AssignmentFull`) — the function signature
  and therefore the embedded `TaskHeatmapPage` call site stay unchanged.
  **Cross-fetch invariant:** parity between lookup keys and column keys depends on the backend
  guarantee that `getABClass`'s `assignments[].assignmentDefinitionKey` equals `getAssignment`'s
  `assignmentDefinition.definitionKey` for the same assignment. This holds today because the
  class mapper derives `assignmentDefinitionKey` from the very same embedded definition document
  (`src/backend/y_controllers/ABClassController/ABClassResponseMapper.js:88`); it is an
  inter-fetch contract, not a frontend construct, so it MUST be pinned by an explicit regression
  test asserting that, for the same assignment, the keys produced by `buildCellPreviewLookup`
  match the embedded heatmap columns' `taskKey`s (the unmodified embedded suites remain the
  wider safety net). If ever violated, embedded popovers would silently lose data rather than
  crash — hence the dedicated test. `TaskHeatmapTable` switches its popover lookup from bare
  `taskId` to `taskColumn.taskKey` (the one accepted edit to the shared table), eliminating bare
  `taskId` collisions across definitions. The lookup's co-located spec updates in lockstep;
  embedded suites must stay green.

### Frontend or consumer architecture constraints

- Navigation is state-based (no router). `navigation/appNavigation.tsx` is the single runtime
  source of truth for navigation-key-to-page rendering; the shell breadcrumb derives from
  `pageContent` headings. Adding the `heatmaps` key touches the `AppNavigationKey` union,
  `navigationDefinitions`, the `renderNavigationPage` switch, and `pages/pageContent.ts`.
- Dependency-direction guardrail (carried forward from the extraction spec, permanent):
  `features/taskHeatmap/**` must never import `features/classPage/**`. Shared logic lives in the
  services layer (`services/dataAnalysis/**`).
- No parallel heatmap implementations: the standalone surface composes the existing
  presentation components (`TaskHeatmapTable` and the metric-display helpers). Page-level chrome
  (title, back/refresh affordances) legitimately differs between the embedded variant and the
  builder surface; the table itself must not be duplicated.
- React Query keys continue to be defined through shared factory helpers only
  (`query/sharedQueries.ts`); no ad-hoc array literals.
- Loading/width standards apply: initial entry with no usable data renders a shape-matched
  skeleton; once usable data exists it stays visible during refresh with a scoped busy
  affordance; degraded/untrustworthy warm-up datasets fail closed (blocking treatment) exactly
  as `useClassPageData` handles them via `usePageDataset`.
- Frontend logging/error-handling policy applies to all new logging paths.

## Domain and contract recommendations

### Why this approach is preferable

- **Input shaping over analyser filter keys.** Scoping analysis to the exact selected assignment
  instances by passing a filtered `assignments` array on the single `ClassFull` gives precise
  instance-level semantics with zero analyser changes, and keeps topic narrowing consistent with
  the cascade rule (every selected assignment already matches the selected topics at analysis
  time). Definition-key-granularity analyser filters would wrongly include sibling instances of
  the same definition.
- **New merged-adapter function beside the existing one.** Extending
  `services/dataAnalysis/heatmapAdapter.ts` with an additional exported function (rather than
  altering `adaptMetricsToHeatmap`) guarantees zero regression risk for the embedded Class Page
  flow while keeping all heatmap-domain logic in the established module.
- **Composite-keyed preview lookup.** `buildCellPreviewLookup` keys its inner map by composite
  `taskKey` (see "Current data-shape constraints"); a small assembly step merges the per-selected-
  assignment lookups into one `studentId → taskKey → CellPreviewData` map, first-wins in stable
  column order for duplicate keys.
- **Per-column preview status (merged mode).** The table gains ONE additive optional prop,
  `previewStatusByTaskKey: ReadonlyMap<string, { isLoading: boolean; hasError: boolean }>`
  (absent/undefined in embedded usage). Popover status resolution order: map entry for the
  column's `taskKey`, else the existing aggregate booleans. **Merged-mode contract:** the
  aggregate `isAssignmentLoading`/`showAssignmentError` props are passed as `false` by the
  builder surface — status is owned entirely by the map, which is populated for EVERY selected
  assignment's task keys (including duplicates' first occurrences). Embedded behaviour is
  unchanged; in merged mode a failed individual assignment query flags only that assignment's
  columns, scores still render, and partial failures never masquerade as "not attempted".

### Merged adapter and type contract

- Signature: `adaptMetricsToMergedHeatmap(analyserResult, classFull, selectedAssignmentIds,
assignmentDefinitionPartials)`. Because analyser output carries no `assignmentId` (metrics are
  keyed by `taskKey` only), the adapter derives the `taskKey → assignment identity` mapping from
  `classFull.assignments` restricted to `selectedAssignmentIds`, resolving titles from the
  partials registry.
- **New types, not extensions.** `HeatmapResult`, `HeatmapTaskColumn`, and
  `adaptMetricsToHeatmap` remain untouched. The merged output uses NEW types
  (`MergedHeatmapResult`, `MergedHeatmapTaskColumn`) whose column entries carry the full identity
  set (`taskKey`, `taskId`, `taskTitle`, `assignmentId`, `definitionKey`, `assignmentName`).
- **Shared-table structural contract.** `TaskHeatmapTable`'s prop type narrows to the structural
  subset it actually reads — columns `{ taskKey; taskId; taskTitle }` plus OPTIONAL assignment
  identity (`assignmentId?`, `assignmentName?`, `definitionKey?`) consumed only when building
  the adaptive merged-tier grouping (impossible from bare `taskKey` alone, which collides across
  duplicate definitions) — and rows/cells unchanged. Both adapters' outputs satisfy it
  structurally with no casts, no generics ceremony, and no runtime branching on surface
  identity.

### Recommended data shapes

#### Merged heatmap view model (`MergedHeatmapResult` — NEW type, frontend-only)

```ts
{
  classId: string;
  className: string;
  sourceAssignments: ReadonlyArray<{
    assignmentId: string;
    definitionKey: string;
    assignmentName: string; // resolved primaryTitle
  }>;
  taskColumns: ReadonlyArray<{
    taskKey: string; // `${definitionKey}::${taskId}`
    taskId: string;
    taskTitle: string | null;
    assignmentId: string; // full column identity (future task filtering);
    // first occurrence wins for collapsed duplicates
    definitionKey: string;
    assignmentName: string;
  }>;
  rows: ReadonlyArray<{
    studentId: string;
    studentName: string;
    cells: ReadonlyArray<{
      completeness: MetricResult;
      accuracy: MetricResult;
      spag: MetricResult;
    }>;
  }>;
}
```

This is a distinct type from `HeatmapResult` (which stays byte-identical). The field set above is
the agreed target contract for implementation.

#### Selection state (feature-owned, illustrative)

```ts
{
  classId: string | null;      // null = no class chosen yet
  topicKeys: readonly string[];
  assignmentIds: readonly string[];
}
```

### Naming recommendation

Prefer:

- `heatmaps` (navigation key), `HeatmapsPage` (thin page root)
- `adaptMetricsToMergedHeatmap` (merged adapter function)
- `useHeatmapsPageData` (feature-owned orchestration hook)

Avoid:

- A second `TaskHeatmapPage`-style name for the builder surface (invites parallel-implementation
  drift); prefer a distinctly named builder/surface component.
- Reusing the term "filter" for the selection bar (it builds the query; it does not filter an
  already-rendered table).

### Validation recommendation

#### Frontend

- The class selector accepts only IDs present in the warm-up class-partials dataset; the topic
  and assignment selectors accept only keys/IDs derivable from the loaded class payload and its
  definition partials. No free-text entry (search narrows options only).
- Selecting a class clears prior topic/assignment selections (decision 2).
- Assignment selections that no longer match the active topic set are cleared automatically
  (decision 3).

#### Backend

- None. No backend validation changes.

### Display-resolution recommendation

- **Topic labels** resolve from the class's assignment-definition partials: identity =
  `primaryTopicKey`, display = the partial's `primaryTopic` field. Unique-ified across the
  class's assignments; ordering locale-aware ascending by display label.
- **Assignment labels** resolve via each assignment's `definitionKey` → partial `primaryTitle`
  (same resolution the embedded heatmap header uses today).
- **Assignments with no resolvable definition partial** are omitted from the assignment selector
  and logged as warnings (consistent with the analyser, which excludes and warns about them).
- **Column ordering** in the merged table: selected assignments in the stable order they appear
  in `ClassFull.assignments`; within an assignment, tasks follow the definition partial's task
  order; duplicate `taskKey`s collapse to the first occurrence.

## Feature architecture

### Placement

- Canonical home: `src/frontend/src/features/taskHeatmap/` owns the builder surface, its
  selection-bar components, its orchestration hook, and any feature-scoped helpers.
- Thin page composition root: `src/frontend/src/pages/HeatmapsPage.tsx` composes the feature
  entry component via `renderNavigationPage('heatmaps')`. No feature logic in `pages/`.
- Services-layer additions (merged adapter, merged preview-lookup assembly) live under
  `services/dataAnalysis/` so both surfaces could consume them.
- Explicitly forbidden: any `features/taskHeatmap/**` → `features/classPage/**` import; any
  second heatmap-table implementation; routing this surface through Class Page state
  (`selectedView`).

### Proposed high-level tree

```text
src/frontend/src/
├── navigation/appNavigation.tsx            # + 'heatmaps' key/icon/page mapping
├── pages/
│   ├── pageContent.ts                      # + heatmaps heading/summary copy
│   └── HeatmapsPage.tsx                    # NEW thin composition root
├── features/taskHeatmap/
│   ├── TaskHeatmapPage.tsx                 # UNCHANGED (embedded variant; call sites identical)
│   ├── TaskHeatmapTable.tsx                # EDITED: popover lookup by taskKey; + optional
│   │                                       #   previewStatusByTaskKey prop; prop type narrowed
│   │                                       #   to the structural column subset
│   ├── buildCellPreviewLookup.ts           # EDITED: inner key widened to composite taskKey
│   │                                       #   (derived from payload's embedded definitionKey)
│   ├── HeatmapBuilder*.tsx                 # NEW builder surface + selection-bar components
│   └── useHeatmapsPageData.ts              # NEW feature-owned orchestration hook
└── services/dataAnalysis/
    └── heatmapAdapter.ts                   # EXTENDED: + adaptMetricsToMergedHeatmap and the
                                            #   Merged* types (existing exports untouched)
```

### Out of scope for this surface

- Multi-class selection or aggregation (Phase B of the recorded roadmap).
- Student-dimension selection; cohort/topic analytics beyond topic-scoped assignment narrowing.
- Date-range and criterion-weighting controls.
- Task-level column filtering (architected for, not implemented).
- Any change to the embedded `TaskHeatmapPage` behaviour, props contract, or E2E-verified flows.
- Persisting or sharing query configurations.

## Data loading and orchestration

### Required datasets or dependencies

- Warm-up dataset `classPartials` — class selector options (`classId`, `className`).
- Warm-up dataset `assignmentDefinitionPartials` — label/topic resolution and analyser input;
  consumed through `usePageDataset` with the same failed/untrustworthy fail-closed semantics as
  `useClassPageData`.
- Per-class query `getABClassQueryOptions(classId)` — triggered by class selection; provides
  roster and assignment instances.
- Per-assignment full reads `getAssignmentQueryOptions(courseId, assignmentId)` — one per
  selected assignment, feeding the merged cell-preview lookup.

### Prefetch or initialisation policy

#### Startup

- No new startup prefetch. The three warm-up datasets already cover selector sources.

#### Feature entry

- On entry with no class selected: only warm-up-backed selector data is read; no per-class fetch.
- On class selection: the per-class query runs; topic/assignment selectors populate when it
  resolves. No assignment full-reads occur until assignments are selected.

#### Manual refresh

- A manual refresh control re-runs the class query, the assignment-definition-partials dataset
  query, and all enabled per-assignment queries. It exposes explicit accessible busy semantics
  and keeps usable data visible during the refresh.

### Query or transport additions

- None. All queries reuse existing shared factories and keys. Invalidation/refresh stays inside
  the feature hook; the caller-side `refetch` prop pattern of the embedded variant is not
  replicated.

## Core view model or behavioural model

### Suggested shape

See "Recommended data shapes" above. The orchestrator hook exposes a discriminated surface state
(`loading` | `blocking` | `ready`-with-selections) plus structured errors, mirroring
`useClassPageData`'s nullability contract: derived results are non-null only in ready states.

### Derivation or merge rules

#### Class selected

- Topic options = unique `primaryTopicKey`/`primaryTopic` pairs across the class's assignments'
  resolvable partials.
- Assignment options = class assignments with resolvable partials, narrowed by active topic set.

#### Analysis scope

- Analyser receives `classes: [ { ...classFull, assignments: selectedAssignments } ]` and
  `filter: { classIds: [selectedClassId] }`; `assignmentDefinitionPartials` passed through.

#### Merged table derivation

- Columns: per "Display-resolution recommendation" ordering; duplicate `taskKey`s collapse.
- Cells: metric looked up by `(studentId, taskKey)`; missing pairs render the frozen
  not-attempted cell (existing behaviour).

### Sort order or priority rules

1. Rows default-sort by student name (locale-aware, case-insensitive) then `studentId`
   tie-break — identical to the embedded table's default.
2. Metric sub-column sorters and score-range filters behave identically to the embedded table
   (state rank → value → `studentId` tie-break).
3. Column groups ordered per the deterministic rules above; no user column reordering in v1.

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Select` (searchable; single-select for class; checkbox multi-select presentation
  for topics and assignments) inside a dedicated selection bar region.
- Existing `TaskHeatmapTable` for the merged table; existing `PageTitleCard`/`PageNavCard`
  primitives for chrome; `Alert`/`Result`/`Skeleton` per the shared loading and error standards.
- Exact component choices are settled in the companion layout spec after Ant Design doc
  consultation.

### Fields, columns, or visible sections

1. Selection bar: class selector, topic selector, assignment selector (left-to-right, fixed
   order), each labelled.
2. Merged heatmap table region (student name column + per-task grouped metric sub-columns).
3. Chrome: page title reflecting current scope; refresh control.

### Sorting, filtering, or navigation rules

- Search-as-you-type narrows selector options (no server round-trips).
- Table sorting/filtering inherited from `TaskHeatmapTable` unchanged.
- Leaving the page discards builder state (no persistence); navigating away via the sidebar
  behaves like every other top-level page.

### Rendering rules

#### No class selected

- Topic and assignment selectors disabled with an explanatory affordance (tooltip/aria);
  table region shows "select a class" guidance.

#### Class loading

- Shape-matched skeleton for the class-dependent regions; selection bar visible with class
  selector busy.

#### Class loaded, no assignments selected

- Selectors enabled and populated; table region shows selection guidance empty state.

#### Ready with selections

- Single merged table rendered; assignment-group headers identify which tasks belong to which
  assignment (exact visual treatment in the layout spec).

#### Duplicate definition keys among selected assignments

- Columns collapse per the merge rule; the affected assignment group header notes the shared
  definition so merged data is not mistaken for per-instance data.

#### Zero-option edge cases

- A class with no assignments: selectors render empty-options states with guidance copy.
- All selected cells not-attempted: existing "No submissions yet" caption is reused.

## Workflow specification

## Build a heatmap from the Heatmaps page

### Eligible inputs or preconditions

- At least one class exists in the class-partials dataset; the selected class resolves via
  `getABClass`.

### Inputs, fields, or confirmation copy

- Class (single), Topics (multi), Assignments (multi) — see decisions 2–4.

### Behaviour

- Selecting a class triggers the full fetch and populates dependent selectors; cascading narrows
  assignments when topics are active; selecting assignments merges their task columns into one
  table.
- Success: merged table renders with per-assignment group headers; previews work per cell.
- Failure: class-query or dataset failures block with retryable/unretryable treatments matching
  the Class Page error taxonomy; per-assignment preview failures degrade only the affected
  popovers (existing pattern), never the table.

## Error, loading, and empty-state rules

### Blocking failure

- Class query error/not-found, warm-up dataset failure/untrustworthiness, or analyser/adapter
  failure block the affected owned region using the established error-config-map pattern
  (warning + Retry when retryable; error otherwise). Sidebar navigation remains available.

### Partial-load or partial-success failure

- Individual assignment full-read failures affect only that assignment's popover previews via
  the `previewStatusByTaskKey` map (skeleton while that query is pending; error content inside
  the Popover when it failed), leaving scores rendered. Partial failures never render as
  "not attempted" data.

### Empty states

#### No class selected

- Guidance copy in the table region; dependent selectors disabled.

#### Class without assignments / no matching options

- Empty-options guidance in the affected selector; table region retains selection guidance.

#### No assignments selected

- Selection-guidance empty state replaces the table region.

## Accessibility and usability notes

- Disabled selectors expose an accessible reason (not colour alone); tooltips do not carry
  information unavailable to assistive technology.
- Multi-select controls use checkbox-style options with visible check state and keyboard support
  per Ant Design behaviour.
- Busy/refresh affordances expose explicit accessible status semantics per the loading standard.
- Cell interactions inherit the existing keyboard-operable popover pattern.
- Selection changes never move focus unexpectedly; clearing cascaded selections is announced by
  the control's own semantics (no toast spam).

## Backend changes required to support agreed behaviour

1. None.

Multi-class support, metric re-keying by assignment instance, and any server-side analysis are
explicitly deferred and require their own planning rounds.

## Planning handoff notes

- A frontend layout spec IS required (new page, new navigation entry, selection bar, merged-table
  header treatment). Ant Design documentation must be consulted for the multi-select components
  before that document is drafted; a further clarification round precedes it.
- File-size planning inputs (current LOC): `TaskHeatmapTable.tsx` 441 (accepted edits: taskKey
  lookup switch, one optional prop, narrowed prop type — projected ≈470–490; if projections
  breach 500 during implementation, separate column-building/popover helpers into a sibling
  module per the frontend splitting rules); `heatmapAdapter.ts` 230 (projected ≈360–400 after
  `adaptMetricsToMergedHeatmap` + `Merged*` types — acceptable in-place); `useClassPageData.ts`
  501 is NOT extended — the builder gets its own hook module; `appNavigation.tsx` 193 (+~20).
  New files (hook, selection bar, builder surface, thin page) start well under thresholds;
  apply the repo-local 500-LOC split gate during implementation if projections breach limits
  (folder conventions: `src/frontend/AGENTS.md` §3.3 and §14; behavioural analogue
  `src/backend/AGENTS.md` §11).
- "UNCHANGED" guarantees are behavioural, not textual-frozen: `TaskHeatmapPage.tsx` keeps its
  props contract, call sites, and rendered output identical (its unit specs and E2E suites must
  pass unmodified). If implementation reveals a genuinely valuable behaviour-preserving helper
  extraction from it (e.g. label resolution), the shared-helper gate governs and such extraction
  is permissible provided every embedded suite stays green; otherwise prefer the merged adapter
  owning its own resolution logic (it resolves titles independently anyway).
- Shared-helper gate: before creating any helper, check
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`; expected
  candidates (label resolution reuse from `getHeaderLabels`-style logic, merged lookup assembly)
  must be recorded as planned entries with status `Not implemented` in the action plan before
  implementation.
- Testing: embedded-flow suites must pass unmodified (behaviour-preservation net). The
  `buildCellPreviewLookup.spec.ts` suite updates in lockstep with the composite-key change
  (red-first), and `TaskHeatmapTable` specs cover both status-resolution paths (map entry vs
  aggregate booleans). The mandated cross-fetch parity regression test (see data-shape
  constraints) must use INDEPENDENT fixtures for the two fetches — a `getABClass`-shaped
  `classFull` and a separate `getAssignment`-shaped `AssignmentFull` for the same assignment —
  so the inter-fetch contract is genuinely exercised rather than self-compared within one
  payload. New unit coverage: merged adapter (ordering, dedupe-by-taskKey with
  first-occurrence identity, merged cells, unknown-assignment errors, title resolution), merged
  lookup assembly (first-wins collisions, per-assignment failure flagging), hook surface-state
  machine, selection-bar cascade logic, thin page mapping. Playwright coverage for the new page
  follows `docs/developer/frontend/frontend-playwright-e2e.md` (including navigation-screenshots
  extension).
- Verification commands: `npm run lint:frontend`; targeted then full frontend Vitest suites;
  heatmap-related Playwright suites including the unmodified embedded ones.

## Testing expectations

- Frontend unit/component: as enumerated in the handoff notes; embedded `TaskHeatmapPage`,
  `TaskHeatmapTable` (existing specs adjusted only for additive props, if any), and all
  Class Page suites green without behavioural edits.
- Frontend E2E: existing `task-heatmap.spec.ts`, `task-preview-card.spec.ts`,
  `navigation-screenshots.spec.ts` pass unmodified; new suites cover the builder workflow
  (select class → select topics → select assignments → merged table renders; cascade-clearing;
  disabled states; refresh).
- Backend tests: none affected.

## Documentation and rollout notes

- Update `docs/developer/frontend/navigation-consistency-status.md` for the new entry point.
- Update `src/frontend/AGENTS.md` §3.3 wording if the feature-directory description for
  `taskHeatmap/` materially changes.
- Record any new shared helpers in the shared-helpers canonical doc during the docs pass.
- No rollout/migration dependency: purely additive frontend surface.

## Future direction (recorded, non-normative)

1. **Task-based column filtering** (next likely increment): slice the merged table's columns via
   the identity fields carried on each task column (decision 7). Likely surfaced as a third
   selection dimension or per-group header menus; requires its own clarification round.
2. **Metric re-keying by assignment instance** so same-definition instances stop merging.
3. **Phase B — multi-class**: requires fetching N classes, analyser consumption of multi-class
   inputs (or caller-side aggregation), and adapter extension; largest structural step, planned
   last with its own planning round.

## Open questions

None blocking this cycle. The design decisions raised in review (preview-lookup keying
reconciliation, merged adapter signature, merged-vs-existing type boundary, per-column preview
status) are resolved above as binding recommendations. Remaining visual treatment choices
(group-header styling, selector component variants, icon) are settled in the layout clarification
round and do not affect contracts.
