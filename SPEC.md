# TaskHeatmap Feature Extraction Specification

## Status

- Draft v1.4 — v1.3 (flat `services/dataAnalysis/compareStudentNames.ts` placement per AGENTS §14; corrected spec-move examples; §9.18→§9.17 reclassification instruction) amended after second Planner Reviewer pass: testing expectations corrected so the new `compareStudentNames.spec.ts` explicitly gains a **new** case-insensitivity test (the only existing case-insensitivity assertion relocates with the `compareHeatmapStudentName` block to `taskHeatmapModel.spec.ts`).

## Purpose

This document defines the organisational extraction of the Task Heatmap feature (currently embedded in `src/frontend/src/features/classPage/`) into an independent feature module at `src/frontend/src/features/taskHeatmap/`.

The extraction prepares for a planned future evolution (documented here as agreed direction, **not** as deliverables of this cycle) in which the Task Heatmap page becomes a parameterised, embeddable surface: calling pages pass query parameters (classes, students, assignments, topics) and the feature acquires and derives its own data. That evolution will be delivered gradually alongside the querying tools that enable it, in later implementation cycles.

This cycle is strictly organisational: **all runtime behaviour, props contracts, rendering output, logging, and error handling are preserved exactly as they are today.**

This feature/extraction is **not** intended to:

- Change any user-visible behaviour, layout, copy, or interaction.
- Introduce the query-parameter data contract or move data acquisition into the feature (future cycles).
- Rename components, alter prop names, or alter the component tree.
- Refactor any classPage overview code beyond updating import paths and relocating the helpers listed below.

## Agreed product decisions

1. **Full cluster move.** All six production modules of the heatmap presentation chain move to `features/taskHeatmap/`, together with their co-located specs (see "Proposed high-level tree"). Moving only `TaskHeatmapPage.tsx` was rejected: it would leave the extracted page importing classPage internals transitively, defeating reuse from non-ClassPage surfaces.
2. **Directory name.** The new feature directory is `features/taskHeatmap/` (camelCase, consistent with `assignmentWizard/`, `referenceData/`).
3. **Dependency direction (binding rule).** From this extraction onwards, `features/taskHeatmap/**` must not import from `features/classPage/**`. classPage imports from taskHeatmap **for composition only** (rendering `TaskHeatmapPage`); where logic is genuinely shared by both features, it lives in the shared services layer (e.g. `services/dataAnalysis/`) and both features import it from there — never feature-to-feature for logic. This codifies the owner's stated intent that the heatmap becomes the general analytics surface and aligns decision 3 exactly with the Future-direction guardrail (shared logic never lives inside either consumer).
4. **Shared helper placement (by domain affinity).**
   - `METRIC_STATE_RANK_ASC`, `METRIC_STATE_RANK_DESC`, and `getMetricStateRank` relocate to the shared services layer at `services/dataAnalysis/metricDisplay/metricStateRank.ts` (new small module). Rationale: these rank `MetricResult['state']` — generic metric-domain semantics already hosted there (`metricDisplayMeta`, `metricTone`, `metricRangeFilter` are consumed by both features). Neither feature owns them.
   - `compareStudentNames` relocates to the shared services layer, placed **flat** at `services/dataAnalysis/compareStudentNames.ts` with a co-located spec. Rationale: it orders the minimal structural shape `{ studentName, studentId }` that both `StudentAverageRowModel` and `HeatmapRow` derive from services-layer `ClassFull` data — generic student-domain semantics consumed by both features; neither feature owns it. Flat placement (rather than a `studentDisplay/` subfolder) follows `src/frontend/AGENTS.md` §14 ("keep single-file services flat … do not create folders for them") and the existing single-module precedent `services/dataAnalysis/heatmapAdapter.ts`; a subfolder is created only if future `studentDisplay*` siblings join it. The comparator is structurally re-typed onto `Readonly<{ studentName: string; studentId: string }>` (or equivalent minimal structural shape) so it carries no feature-owned type into the services layer. Behaviour is identical; existing classPage call sites (`classPageAdapter.ts`, `studentAveragesTableColumns.tsx`, `buildClassPageViewModel`) remain compatible through structural typing and import from the new services path.
   - `compareHeatmapStudentName` relocates to `features/taskHeatmap/taskHeatmapModel.ts` as a `HeatmapRow`-typed wrapper importing the canonical `compareStudentNames` from the services layer (`services/dataAnalysis/compareStudentNames`). Delegation from `compareHeatmapStudentName` to `compareStudentNames` is preserved so there is exactly one source of truth for locale-aware name ordering (no duplicated comparison logic); because both comparators now operate on the same structural shape, the previous `as unknown as StudentAverageRowModel` cast disappears.
5. **Props contract unchanged.** `TaskHeatmapPage` retains exactly its current props (`analyserResult`, `classFull`, `assignmentId`, `assignmentDefinitionPartials`, `onBack`, `refetch`) with identical types and semantics. The ClassPage continues to own the data pipeline (`useClassPageData`) and passes computed results down.
6. **Future direction (recorded, deferred).** The feature is expected to evolve into a parameterised, embeddable analytics surface with its own query contract, feature-owned data acquisition, and parameterisable chrome. See the dedicated **"Future direction — next implementation rounds"** section below for the full target architecture, indicative phases, guardrails, and deferred open questions. Nothing in this cycle may preclude that evolution; no work towards it is in scope for this cycle.

## Future direction — next implementation rounds

This section records the owner's agreed target architecture that this extraction prepares for. It is **non-normative for the current cycle**: it commits to direction and guardrails only, and every increment below requires its own clarification and planning round before implementation.

### Target model: parameterised, embeddable analytics surface

The Task Heatmap feature ultimately visualises task data for **any number of classes, students, assignments, and topics**. Calling pages compose the heatmap and pass a query; the feature acquires, validates, and derives everything it renders:

1. **Query-parameter input contract (feature-owned).** `TaskHeatmapPage` evolves from consuming pre-computed data props (`analyserResult`, `classFull`, `assignmentDefinitionPartials`) to accepting a query object owned by the feature — indicatively shaped like:
   ```ts
   // Illustrative only — final shape is settled in the next planning round
   // against the querying tools available at that time.
   type TaskHeatmapQuery = Readonly<{
     classIds: readonly string[];
     assignmentIds?: readonly string[]; // absent/empty = all assignments in scope
     studentIds?: readonly string[];
     topicKeys?: readonly string[];
   }>;
   ```
   The contract will require a Zod schema with a canonical entry under `docs/developer/data-shapes/`.
2. **Feature-owned data acquisition.** Data loading moves inside the feature behind its own hooks, composing the shared React Query factories and the `DataAnalysisService` pipeline that `useClassPageData` orchestrates today. Precedent already exists inside the component (the cell-preview `useQuery(getAssignmentQueryOptions(...))`). A surface-state machine (`loading` / `blocking` / `ready`) moves into the feature, replacing the caller-side ready-gate narrowing currently performed by `ClassPageContent`.
3. **Embeddability.** Any page composes the same component: ClassPage passes a single-class/assignment context; future cohort-, topic-, and student-level analysis pages pass different queries. No parallel heatmap implementations are permitted anywhere in the app.
4. **Parameterisable chrome.** Composition details that are hardcoded today become inputs or internal concerns: back-navigation label/target (currently the literal "Back to Class overview"), refresh semantics (`refetch` currently re-runs the _caller's_ pipeline; with feature-owned queries refresh becomes internal query invalidation), and header/title derivation that assumes exactly one class.
5. **ClassPage migration (final step of the transition).** ClassPage's heatmap branch shrinks from passing computed data to passing parameters (e.g. class + assignment selection); `selectedView` view-state plumbing remains classPage-owned.

### Indicative phases (each gated on its own planning round)

- **Phase A — multi-assignment within one class.** Removes the single-`assignmentId` assumption: projection of several assignments per render, multi-assignment header/title strategy, cell-preview lookups spanning more than one assignment. Current blockers: `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId, adp)` projects exactly one assignment, and `getAssignmentQueryOptions(courseId, assignmentId)` is single-assignment.
- **Phase B — multi-class.** Feature-owned fetches across N classes. Grounding facts: the analysis input schema already types `filter.classIds` as an array (`dataAnalysis.zod.ts`), but the averaging analyser logic does **not** consume `classIds` at all today — its filtering considers `topicKeys` and `assignmentDefinitionKeys` (materialised as sets in `averagingAnalyser.ts`) and `dateRange` (applied as a `{ from, to }` range object in `averagingAnalyser.filters.ts`) only — so multi-class filtering must be built, not merely enabled. Additionally, `getABClassQueryOptions(classId)` fetches one class, and both `classPageAdapter.adaptClassPageToViewModel` and `services/dataAnalysis/heatmapAdapter` assume a single `ClassFull`. A services-layer contract extension (or new adapter) is expected and must be specified canonically before use.
- **Phase C — cohort/topic dimensions.** Depends on querying tools and reference-data joins that do not exist yet; largest unknown, planned last.

### Guardrails established now that bind future rounds

- The dependency rule in decision 3 is permanent: `features/taskHeatmap/**` never imports `features/classPage/**`; shared logic lives in `services/dataAnalysis/` (or another neutral shared layer), never inside either consumer.
- Query keys continue to be defined through shared factory helpers only (no ad-hoc array literals), so invalidation and prefetch stay consistent as acquisition moves inward.
- No new ClassPage-specific copy, labels, or assumptions may be added to moved components during this cycle; chrome parameterisation happens once, in the future round, rather than accumulating special cases.
- Presentation components remain prop-driven and pure over their inputs so the future query→view-model substitution does not touch rendering logic.

### Open questions deferred to the next planning round

1. Final `TaskHeatmapQuery` field set, defaults, and validation rules.
2. Whether multi-assignment/multi-class support extends `heatmapAdapter` in place or introduces a new adapter module in `services/dataAnalysis/`.
3. Chrome/navigation API shape (back label/target, title source) for embedded usage.
4. Selection-state ownership when embedded (host page vs feature-internal), given the app has no router and state-based navigation today.
5. E2E harness impact: which suites gain parameterised variants and how `navigation-screenshots.spec.ts` coverage extends to new embedding pages.

## Existing system constraints

### Frontend architecture constraints

- Navigation is state-based; there is no router. Composition chain: `pages/ClassesPage.tsx` → `features/classPage/ClassPage.tsx` → `ClassPageContent.tsx` → `TaskHeatmapPage`. `ClassPageContent` branches on `selectedView.view === 'heatmap'` and renders `TaskHeatmapPage` with narrowed non-null props. This chain is unchanged apart from the import path in `ClassPageContent.tsx`.
- `TaskHeatmapPage` runs its own React Query (`getAssignmentQueryOptions(courseId, assignmentId)`, where `courseId` equals `ClassFull.classId`) for cell-preview popover data. This stays inside the moved component, unmodified.
- Test coupling: exactly two spec files mock moved modules by relative path — `ClassPageContent.spec.tsx` (`vi.mock('./TaskHeatmapPage', ...)` at line 55) and `ClassPage.spec.tsx` (`vi.mock('./TaskHeatmapTable', ...)` at line 129). Their mock paths must be updated in step with the moves or Vitest module interception breaks silently. `ClassPageHeatmapView.spec.tsx` requires **no edit**: it mocks neither module and reaches them through the real `ClassPageContent` import, so it is exercised transitively when that import path changes.
- Production import-path updates required by helper relocation (beyond the moves themselves):
  - `ClassPageContent.tsx` line 43 — `./TaskHeatmapPage` → `../taskHeatmap/TaskHeatmapPage`.
  - `classPageAdapter.ts` line 29 — imports `compareStudentNames` from `./classPageModel`; must repoint to the new owning module (`services/dataAnalysis/compareStudentNames`).
  - `studentAveragesTableColumns.tsx` line 33 — imports `compareStudentNames` from `./classPageModel`; same repointing.
  - `classPageModel.ts` — loses its local definitions of the relocated symbols and gains new services-layer imports: `compareStudentNames` from `services/dataAnalysis/compareStudentNames` and `getMetricStateRank` from `services/dataAnalysis/metricDisplay/metricStateRank`. Its co-located spec does not import these symbols directly except for the relocated describe blocks (see "Testing expectations").
  - `TaskHeatmapTable.tsx` lines 31–34 — the `./classPageModel` import is replaced by a sibling import of `compareHeatmapStudentName` from `./taskHeatmapModel` and a services-layer import of `METRIC_STATE_RANK_ASC` from `metricDisplay/metricStateRank`.
  - The co-located specs `classPageAdapter.spec.ts` and `studentAveragesTableColumns.spec.tsx` do not import `compareStudentNames` directly and need no edits.
- `src/frontend/AGENTS.md` §3.3 enumerates the current feature directories; adding `taskHeatmap/` requires updating that list.
- Canonical helper documentation in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§9.18.x entries) records owning paths for the relocated helpers; those entries must be updated to the new owning paths.
- Path references to `features/classPage/TaskHeatmapPage.tsx` exist in `docs/developer/frontend/navigation-consistency-status.md` (lines 77, 189, 193) and are updated as part of the documentation pass. `docs/developer/frontend/frontend-spacing-and-padding-standards.md` contains only the bare filename `TaskHeatmapPage.tsx` (line 239, no directory path); because the filename is unchanged by this extraction, that document needs **no** edit — noted here only so implementers do not search for a full-path reference that does not exist.

### Current data-shape constraints

- No validation schema, persistence model, API contract, or transport shape changes in this cycle. No canonical data-shape documents require updates.

## Domain and contract recommendations

Not applicable beyond the decisions above: no domain, naming, validation, or display-resolution changes are introduced. The only contract-adjacent change is the structural re-typing of `compareStudentNames` described in decision 4, which alters TypeScript annotations only — never runtime behaviour or ordering semantics (locale-aware, case-insensitive, `studentId` ascending tie-break).

## Feature architecture

### Placement

- Canonical home: `src/frontend/src/features/taskHeatmap/` owns the Task Heatmap presentation feature.
- Explicitly forbidden: parallel duplicates of these modules under `features/classPage/` (or anywhere else); re-export shims left behind in `classPage` (importers update to the new paths directly); any new `features/taskHeatmap/**` → `features/classPage/**` import.

### Proposed high-level tree

```text
src/frontend/src/
├── features/
│   ├── taskHeatmap/                      # NEW feature directory
│   │   ├── TaskHeatmapPage.tsx           # moved unchanged
│   │   ├── TaskHeatmapPage.spec.tsx      # moved; relative imports verified/adjusted
│   │   ├── TaskHeatmapTable.tsx          # moved; classPageModel import replaced (see below)
│   │   ├── TaskHeatmapTable.spec.tsx     # moved
│   │   ├── TaskPreviewCard.tsx           # moved unchanged
│   │   ├── TaskPreviewCard.spec.tsx      # moved
│   │   ├── assembleTaskPreviewData.ts    # moved unchanged
│   │   ├── assembleTaskPreviewData.spec.ts
│   │   ├── buildCellPreviewLookup.ts     # moved unchanged
│   │   ├── buildCellPreviewLookup.spec.ts
│   │   ├── spreadsheetToMarkdownTable.ts # moved unchanged
│   │   ├── spreadsheetToMarkdownTable.spec.ts
│   │   └── taskHeatmapModel.ts           # NEW: compareHeatmapStudentName (+ spec),
│   │                                     #      imports canonical compareStudentNames
│   │                                     #      from services/dataAnalysis/
│   └── classPage/
│       ├── classPageModel.ts             # slimmed: keeps ClassPageViewModel, DEFAULT_SORT,
│       │                                 #   buildMetricComparator, compareAssignmentUpdatedAtDesc,
│       │                                 #   buildClassPageViewModel; NEW services-layer imports:
│       │                                 #   getMetricStateRank (…/metricDisplay/metricStateRank),
│       │                                 #   compareStudentNames (…/compareStudentNames)
│       ├── classPageModel.spec.ts        # relocated comparator describe blocks move out:
│       │                                 #   compareHeatmapStudentName → taskHeatmapModel.spec.ts,
│       │                                 #   compareStudentNames → compareStudentNames.spec.ts
│       ├── classPageAdapter.ts           # compareStudentNames import repointed to services
│       ├── studentAveragesTableColumns.tsx  # compareStudentNames import repointed to services
│       ├── ClassPageContent.tsx          # import path update only
│       └── ... (all other files unchanged)
├── services/dataAnalysis/metricDisplay/
│   └── metricStateRank.ts                # NEW: exports METRIC_STATE_RANK_ASC, METRIC_STATE_RANK_DESC,
│                                         #      getMetricStateRank (+ co-located spec)
├── services/dataAnalysis/compareStudentNames.ts  # NEW (flat, single-module per AGENTS §14):
│                                         #      exports compareStudentNames (structural type)
│                                         #      (+ co-located spec)
└── pages/, components/, services/…       # unchanged
```

Note: `METRIC_STATE_RANK_DESC` and `getMetricStateRank` were previously module-private in `classPageModel.ts`; they become exports of the new `metricStateRank.ts` module. `METRIC_STATE_RANK_ASC` is likewise exported from there (it is already an export today, consumed by `TaskHeatmapTable`). `buildMetricComparator` remains private to `classPageModel.ts` and consumes the relocated `getMetricStateRank`; `classPageModel.ts` retains no direct reference to either rank map after relocation.

### Out of scope for this surface

- Query-parameter data contract; feature-owned data acquisition hooks.
- Parameterisable navigation chrome (back label/target).
- Any multi-class, cohort, or topic aggregation capability.
- Any change to `useClassPageData`, the analyser/adapter pipeline, or prefetch policy.

## Data loading and orchestration

Unchanged. The ClassPage-owned pipeline continues to produce `analyserResult`, `classFull`, and `assignmentDefinitionPartials`; the moved component continues to run its internal assignment query for cell previews. No query keys, warm-up, prefetch, or invalidation rules are added or altered.

## Main user-facing surface specification

No user-facing change of any kind. Rendering output, Ant Design structure, spacing tokens, loading states, error states (`TaskTitlesUnavailableError` Alert path; generic-error log-toast-back path), accessibility labels, and refresh behaviour are byte-for-byte preserved. E2E suites (`task-heatmap.spec.ts`, `task-preview-card.spec.ts`, `navigation-screenshots.spec.ts`) must continue to pass unmodified — they are the primary behavioural regression net for this claim.

## Error, loading, and empty-state rules

Unchanged and preserved verbatim by the move: title-unavailable in-view Alert without auto-navigation; generic-error logging (`logFrontendError('TaskHeatmapPage', …)`), user-safe toast, single `onBack` invocation guarded against StrictMode double-execution; assignment-query error/not-found logging guards; popover skeleton/error handling in `TaskHeatmapTable`.

## Accessibility and usability notes

No changes. All existing aria-labels, focus behaviour, and keyboard interactions are preserved by construction (no JSX modifications beyond import paths).

## Backend changes required to support agreed behaviour

None.

## Planning handoff notes

- TDD applies even to a pure move: specs travel with their modules; any spec referencing a relocated symbol (the `compareStudentNames` and `compareHeatmapStudentName` describe blocks in `classPageModel.spec.ts`) moves in the same section that relocates the symbol, and the suite must be green before and after each section. (Note: no existing spec asserts `METRIC_STATE_RANK_ASC`/`_DESC`/`getMetricStateRank` directly — coverage for the relocated rank maps is new coverage, added in the same section as the move per "Testing expectations".)
- Relative import depth is unchanged (`features/x/` → `features/y/`), so `../../services/…`-style imports inside moved files need no edits; only sibling (`./…`) imports and the two classPage-level spec mock paths (`ClassPage.spec.tsx`, `ClassPageContent.spec.tsx`) change.
- File sizes after the move: largest production module is `TaskHeatmapTable.tsx` (470 lines, under the 500-line separation threshold; the move adds no lines to it). No file-separation work arises from this cycle.
- Shared-helper planning gate: this cycle **relocates** existing helpers rather than creating abstractions; the action plan must include a shared-helper block recording each relocation (decision `keep local` → new owning path) and must reconcile the §9.18.x canonical entries in `frontend-shared-helpers-and-abstraction-standards.md`, including reclassifying the promoted helpers into the shared-helper section (see "Documentation and rollout notes").
- Verification must include `npm run lint:frontend`, the touched Vitest suites, the full frontend unit suite, and the heatmap-related Playwright E2E suites (unmodified, green).

## Testing expectations

- Frontend unit/component: all six moved spec suites pass at their new paths with only mechanical import adjustments; `classPageModel.spec.ts` passes after removal of the relocated blocks (both comparator describe blocks move out — see the tree note above); `ClassPage.spec.tsx` and `ClassPageContent.spec.tsx` pass with updated mock paths; `ClassPageHeatmapView.spec.tsx` passes **unmodified** (it exercises the chain transitively through `ClassPageContent`); new `taskHeatmapModel.spec.ts` covers `compareHeatmapStudentName` (including its existing case-insensitivity assertion, which relocates with that block); new co-located `services/dataAnalysis/compareStudentNames.spec.ts` covers the relocated student-name comparator — ordering and `studentId` tie-break assertions come from the former `classPageModel.spec.ts` describe block, and a **new** case-insensitivity test must be written for it (the only existing case-insensitivity assertion lives in the `compareHeatmapStudentName` block, which relocates to `taskHeatmapModel.spec.ts`); new coverage asserts `metricStateRank.ts` exports behave identically to the prior in-module maps (new tests — no existing spec asserts these symbols today).
- Frontend E2E: `task-heatmap.spec.ts`, `task-preview-card.spec.ts`, `navigation-screenshots.spec.ts` pass **without modification** (behaviour-preservation evidence).
- No backend tests affected.

## Documentation and rollout notes

- Update `src/frontend/AGENTS.md` §3.3 feature directory list to include `taskHeatmap/`.
- Update entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` for the relocated helpers. Because §9.18 is explicitly scoped to **feature-local classPage helpers** ("not promoted to shared scope unless a documented cross-feature reuse emerges"), the promoted helpers are **reclassified**, not merely re-pathed: §9.18.10 `compareStudentNames` moves into the shared-helper section (§9.17) with new owning path `services/dataAnalysis/compareStudentNames.ts` and its new structural parameter shape; the rank-maps/metric-state-sorting entry likewise moves to §9.17 with owning path `services/dataAnalysis/metricDisplay/metricStateRank.ts`. §9.18.11 `compareHeatmapStudentName` stays feature-local with owning path `features/taskHeatmap/taskHeatmapModel.ts` and a delegation target updated to the services-layer comparator. Update the §9.18.12 TaskHeatmapTable entry (including its re-use attribution) and the §9.18.13 TaskHeatmapPage composition entry for the new import paths.
- Update path references in `docs/developer/frontend/navigation-consistency-status.md`. No edit needed in `frontend-spacing-and-padding-standards.md` (bare filename only; filename unchanged).
- Stale `@see ACTION_PLAN.md §N` / `@see SPEC.md` JSDoc pointers inside moved file headers may be refreshed to point at this document where trivially editable during the move; no other comment rewrites.

## V1 scope recommendation

### Include in v1

- Full cluster move to `features/taskHeatmap/` with co-located specs.
- Relocation of the four shared helpers per decisions 3–4, including structural re-typing of `compareStudentNames`.
- Import-path updates: `ClassPageContent.tsx`; `classPageAdapter.ts` (services path); `studentAveragesTableColumns.tsx` (services path); `classPageModel.ts` (new services-layer imports of relocated symbols); `TaskHeatmapTable.tsx` (replaced sibling/services imports); mock paths in `ClassPage.spec.tsx` and `ClassPageContent.spec.tsx`.
- Documentation updates listed above; full regression verification including unmodified E2E suites.

### Defer from v1

- Everything in the "Future direction — next implementation rounds" section, and any opportunistic cleanup not required by the move.

## Open questions

None remaining for this cycle. Scope, directory name, dependency-direction rule, and helper placement are settled; behaviour preservation is a hard acceptance constraint verified by the unmodified unit and E2E suites. Open questions concerning future rounds are deliberately recorded under "Future direction — next implementation rounds" rather than here.
