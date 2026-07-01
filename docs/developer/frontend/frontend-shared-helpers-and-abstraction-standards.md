# Frontend Shared Helpers and Abstraction Standards

This document is the canonical policy for shared-helper discovery and abstraction decisions in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 1. Purpose and scope

Use this policy to decide whether to:

- reuse an existing helper
- extend an existing helper
- keep logic local
- extract a new shared helper

It applies to production frontend source under `src/frontend/src/**`.

## 2. Reuse-first rule

Before creating any new helper, you must:

1. identify the behaviour you want to share
2. check the canonical helper locations in Section 3
3. prefer extending an existing helper when it keeps that helper coherent
4. create a new helper only when no suitable helper exists

Do not create a new helper only to move code out of a large file.

## 3. Canonical helper map (check these first)

### 3.1 Server-state and query contracts

- Query keys: `src/frontend/src/query/queryKeys.ts`
- Shared query definitions and warm-up contracts: `src/frontend/src/query/sharedQueries.ts`
- `getStartupWarmupQueryOptions()` public export: `src/frontend/src/query/sharedQueries.ts`
- Query invalidation helpers: `src/frontend/src/query/queryInvalidationHelpers.ts`
- Query client foundation/provider: `src/frontend/src/query/queryClient.ts`, `src/frontend/src/query/AppQueryProvider.tsx`

### 3.1a Hooks and derivation helpers

- Page dataset-state hook and pure helpers: `src/frontend/src/hooks/usePageDataset.ts`

### 3.2 Error and transport helpers

- Unknown-error normalisation: `src/frontend/src/errors/normaliseUnknownError.ts`
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`

### 3.3 Feature-shared helpers (existing local precedents)

- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/table/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper (sequential FIFO): `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
- Classes batch-mutation shared types: `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Reference-data workflow helpers: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`
- Classes Page test fixtures and rendering helpers (including `createFixtureClassPartial`, `createFixtureYearGroup`, `renderClassesPage`, `toPlainClassPartials`, and shared fixture constants): `src/frontend/src/test/classes/classesPageTestHelpers.tsx`

- Shared data-analysis test fixtures and assertion helpers: `src/frontend/src/test/dataAnalysis/` (fixtures, averaging analyser assertions). Placement follows the shared test helpers convention; cross-referenced from `docs/developer/frontend/frontend-testing.md`.

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

## 4. Extraction decision rules

### 4.1 Keep logic local when

- there is one call site and no clear independent contract
- extraction would only rename existing code without removing duplication
- extraction introduces a large prop or argument pass-through surface

### 4.2 Extend an existing helper when

- the new behaviour matches the helper's existing responsibility
- call sites already depend on that helper contract
- extension reduces repeated logic in active call paths

### 4.3 Create a new helper when

- at least two active call sites need the same behaviour now, or
- one call site exists now but a documented near-term second call site is in the accepted scope, and
- the helper owns a coherent contract (not only a pass-through wrapper)

## 5. Anti-patterns to reject

Reject these patterns during implementation and review:

- single-caller wrapper extraction that does not own an independent contract
- duplicated orchestration skeletons copied across handlers instead of descriptor-driven derivation
- duplicated routing render sources for the same navigation key set
- mirrored validation error state where two stores track the same errors without distinct responsibilities
- ad-hoc helper modules created without checking the canonical helper map

## 6. Placement and naming

- Keep cross-feature helpers in stable shared domains (`query`, `errors`, `logging`, `services`) when the contract is genuinely cross-feature.
- Keep feature-specific helpers inside the owning feature folder.
- Name helpers by the contract they provide, not by where they were extracted from.
- Prefer explicit function exports and typed return contracts.

## 7. Review and PR checks

For frontend changes that add or modify helpers, include a short helper audit in the PR description:

- which existing helpers were checked
- whether logic was reused, extended, kept local, or extracted
- why extraction was justified when a new helper was introduced

Reviewer checks:

1. no unjustified one-caller abstraction extraction
2. no duplicated orchestration added where descriptor/config derivation is feasible
3. no duplicate source of truth for routing/render mapping
4. no duplicated validation-error source of truth without explicit contract boundaries

## 8. Relationship to other canonical docs

This document defines helper discovery and abstraction rules.

Use topic-specific docs for runtime policy details:

- React Query and prefetch policy: `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Loading, width, and busy-state semantics: `docs/developer/frontend/frontend-loading-and-width-standards.md`
- Logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Testing helper and harness policy: `docs/developer/frontend/frontend-testing.md`
- Shell navigation and motion policy: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 9. Frontend de-sloppification helper outcomes

These entries record the resolved helper and abstraction decisions from the frontend de-sloppification pass.
Keep them aligned with the current implementation if later cleanup extends, reverts, or supersedes these outcomes.

### 9.1 Assignments page filter cleanup

1. Helper or contract: assignments column-filter descriptor and single typed filter setter

- Decision: keep local
- Owning path: `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Implemented`
- Rationale: the repeated filter callbacks and column wiring now collapse into page-local descriptors plus one typed setter path, without introducing a speculative cross-feature helper

### 9.2 Shell navigation cleanup

1. Helper or contract: navigation page renderer source of truth

- Decision: reuse
- Owning path: `src/frontend/src/navigation/appNavigation.tsx`
- Status: `Implemented`
- Rationale: `renderNavigationPage(...)` is now the single runtime source of truth for navigation-key-to-page rendering, and `AppShell` consumes that contract instead of keeping a second page-selection switch

### 9.3 Settings page tab cleanup

1. Helper or contract: settings tab item construction

- Decision: keep local
- Owning path: `src/frontend/src/pages/SettingsPage.tsx`
- Status: `Implemented`
- Rationale: the two fixed Settings tabs now stay local to `SettingsPage`, so the page no longer preserves the removed one-caller wrapper chain

### 9.4 Classes bulk-action cleanup

1. Helper or contract: bulk action descriptor feeding shared orchestration

- Decision: extend
- Owning path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Status: `Implemented`
- Rationale: the panel now drives top-level bulk actions through descriptor-shaped action data while preserving `runMutationWithRequiredClassPartialsRefresh(...)` as the shared mutation-boundary helper in `bulk/queryInvalidation.ts`

2. Helper or contract: metadata bulk-update contract for editable existing rows

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Status: `Implemented`
- Rationale: cohort, year-group, and course-length updates now converge on one feature-local metadata contract for eligibility filtering, payload validation, and batch mutation dispatch

3. Helper or contract: selected-row derivation for toolbar consumers

- Decision: keep local
- Owning path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
- Status: `Implemented`
- Rationale: the feature root now derives `selectedRows` once and passes that subset into `ClassesToolbar` instead of recomputing it in the child

### 9.5 Backend settings validation cleanup

1. Helper or contract: local schema-aware field descriptor path for backend settings fields

- Decision: keep local
- Owning path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- Status: `Implemented`
- Rationale: repeated `Form.Item` wiring now flows through a local descriptor-driven render path inside the panel, and Ant Design form meta remains the single validation-error source of truth

### 9.6 Page copy reuse in tests

1. Helper or contract: page copy source of truth for frontend tests

- Decision: reuse
- Owning path: `src/frontend/src/pages/pageContent.ts`
- Status: `Implemented`
- Rationale: touched tests now reuse `pageContent` where they only need the stable production headings and summaries, rather than mirroring that copy in a separate helper

### 9.7 Classes bulk modal-shell extraction

1. Helper or contract: shared modal submit shell for classes bulk-edit dialogs

- Decision: defer
- Owning path: `src/frontend/src/features/classes/BulkCreateModal.tsx`, `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- Status: `Deferred`
- Rationale: the current pair still shares similar shell structure, but this pass intentionally kept the duplication local rather than introducing a speculative wrapper without a clearer third caller or tighter shared contract

### 9.8 Classes modal-family compliance refactor

These entries record the delivered helper decisions for the classes modal-family compliance refactor.
This section supersedes the earlier Section 9.7 defer decision for the specific three-caller refactor now in scope.

1. Helper or contract: classes bulk form modal scaffold

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `BulkCreateModal.tsx`, `BulkSetSelectModal.tsx`, and `BulkSetCourseLengthModal.tsx` now present a justified three-caller family for a narrow feature-local shell that owns reset-on-cancel, submit-on-OK, inline submission error rendering, and modal busy semantics without becoming a generic wrapper

2. Helper or contract: classes reference-data modal helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`, `src/frontend/src/features/referenceData/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the current helper split already covers the shared reference-data workflow and should not be replaced or widened during this refactor

3. Helper or contract: one-off destructive confirmation modals

- Decision: keep local
- Owning path: `src/frontend/src/features/classes/bulk/BulkDeleteModal.tsx`, `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Implemented`
- Rationale: both confirmation flows remain workflow-specific one-offs whose copy and footer semantics do not yet justify a shared abstraction

### 9.9 Classes reference-data modal add-action standard

1. Helper or contract: reference-data modal scaffold

- Decision: new
- Owning path: `src/frontend/src/features/referenceData/ReferenceDataManagementModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx` now reuse the extracted scaffold for modal shell composition, standard Cancel/close wiring, start-aligned content-width create-action presentation, and slot placement; a topic reference-data modal is an accepted next sibling caller

2. Helper or contract: existing inline dialog and reference-data helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`, `src/frontend/src/features/referenceData/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the extracted scaffold composes the existing dialog and workflow helper family rather than replacing it, because those modules already own the inner-dialog contract and reference-data workflow helpers coherently; the scaffold uses these helpers for inline form and delete dialog slots

3. Helper or contract: `ReferenceDataTrustBoundary` type extension in `manageReferenceDataHelpers.ts`

- Decision: extend
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`
- Status: `Implemented`
- Rationale: the `ReferenceDataTrustBoundary` union type now covers `'cohorts' | 'yearGroups' | 'assignmentTopics'` — `'assignmentTopics'` was added when the topic reference-data modal caller (`ManageTopicsModal.tsx`) was implemented, so the blocking-load trust-boundary helpers (`getPersistedBlockingLoadError`, `setPersistedBlockingLoadError`, `clearPersistedBlockingLoadError`, `syncReferenceDataModalBusyState`) work correctly for the topic entity

### 9.10 Section 5 de-sloppification: classes reference-data loading and test constants

1. Helper or contract: ReferenceDataInitialLoadingState (shared loading skeleton component)

- Decision: new
- Owning path: `src/frontend/src/features/referenceData/ReferenceDataInitialLoadingState.tsx`
- Status: `Implemented`
- Rationale: Extracted from duplicated ManageCohortsInitialLoadingState and ManageYearGroupsInitialLoadingState functions

2. Helper or contract: Classes CRUD test constants (ALIGNMENT_TOLERANCE_PX, MIN_WIDTH_DIFFERENCE_PX)

- Decision: new
- Owning path: `src/frontend/e2e-tests/classes-crud.shared.ts`
- Status: `Implemented`
- Rationale: Extracted from duplicated definitions in classes-crud-manage-cohorts.spec.ts and classes-crud-manage-year-groups.spec.ts

### 9.11 Classes page planning decisions

1. Helper or contract: navigation page renderer source of truth for the top-level Classes page

- Decision: reuse
- Owning path: `src/frontend/src/navigation/appNavigation.tsx`
- Status: `Implemented`
- Rationale: the new top-level Classes page must extend the existing shell navigation and page-render contract rather than introducing a second source of truth for navigation keys, labels, or page routing

2. Helper or contract: Classes page grouped view-model builder

- Decision: keep local
- Owning path: `src/frontend/src/pages/classesPageModel.ts` or an equivalent page-adjacent local helper
- Status: `Implemented`
- Rationale: the grouping, deterministic ordering, and fail-closed trust rules are specific to the dedicated Classes browse page and should not widen the existing Settings Classes helper family that serves different merge and workflow needs

3. Helper or contract: shared Playwright GAS runtime mock for Classes page journeys

- Decision: reuse
- Owning path: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- Status: `Implemented`
- Rationale: the existing deferred-success queue, method-call tracker, and per-method response queues already provide the right browser harness for the Classes page, so implementation should extend that shared mock surface instead of creating a parallel runtime mock layer

### 9.12 Dataset-state deduplication helpers

1. Helper or contract: `getStartupWarmupQueryOptions`

- Decision: new
- Owning path: `src/frontend/src/query/sharedQueries.ts`
- Status: `Implemented`
- Rationale: resolves a `StartupWarmupDatasetKey` to its shared query options without duplicating the internal `startupWarmupQueryDefinitions` mapping; consumed by `usePageDataset` and by any future page or hook that needs typed query options for a warm-up dataset

2. Helper or contract: `usePageDataset` hook

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: centralises the per-dataset query setup — calls `useStartupWarmupState`, `getStartupWarmupQueryOptions`, and `useQuery` with `enabled: isDatasetReady || isDatasetFailed` and `refetchOnMount: false` — so pages do not repeat this boilerplate for each warm-up-backed dataset; consumed by `ClassesPage` and `AssignmentsPage`

3. Helper or contract: `computePageDatasetState`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that derives `PageDatasetState` (six boolean flags) from a query result, warm-up state, and dataset key; called by `usePageDataset` and available for direct composition by pages that need per-dataset state outside the hook

4. Helper or contract: `computePageSurfaceBlocking`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that decides whether a single dataset should block the page surface — blocks on warm-up failure without recoverable data, untrustworthy-but-ready datasets, and ready datasets with query errors; pages compose their own blocking surface from this per-dataset decision

5. Helper or contract: `computeDatasetRenderable`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that decides whether a dataset is renderable — true when trustworthy or recovered after warm-up failure; pages compose their own loading and content decisions from this per-dataset signal

6. Helper or contract: `computePageSurfaceBusy`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function returning `true` when any fetch or mutation flag is truthy; provides the common busy signal for `aria-busy` and spinner affordances; pages with additional busy triggers layer those on top

7. Helper or contract: `refetchAfterStaleInvalidate`

- Decision: new
- Owning path: `src/frontend/src/query/queryInvalidationHelpers.ts`
- Status: `Implemented`
- Rationale: wraps the invalidate-then-explicit-refetch pattern required for queries that may be disabled at invalidation time (e.g. warm-up-gated queries with `enabled: isDatasetReady || isDatasetFailed`); called from manual retry and post-mutation refresh flows; not the general invalidation pattern — plain `invalidateQueries` is preferred for actively-observed queries per `frontend-react-query-and-prefetch.md` §7

8. Helper or contract: `PageDatasetState` type

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: typed contract for the six derived boolean flags (`hasQueryData`, `isQueryError`, `isDatasetFailed`, `isDatasetReady`, `isDatasetTrustworthy`, `hasTrustworthyDataset`) shared between the `usePageDataset` hook and the pure derivation helpers

9. Helper or contract: `PageDatasetResult<TData>` type

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: generic typed contract for the hook return shape — bundles a typed `UseQueryResult<TData>` with a `PageDatasetState` so consuming pages can access typed `query.data` without casts

### 9.13 Assess Task Happy Path

1. Helper or contract: `findMatchingDefinition`

- Decision: new
- Owning path: `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
- Status: `Implemented`
- Rationale: pure matching logic extracted for independent unit testing; no existing helper covers this combination of title, topic, and year-group lookups

### 9.14 Assess Task No-Match — Topic Existence Check

1. Helper or contract: topic existence check (`topics.some(t => t.key === selectedAssignment.topicId)`)

- Decision: `keep local`
- Owning path: `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- Status: `Implemented`
- Rationale: single-caller, one-liner lookup; no existing helper matches this contract. Implementation at line 91 of AssessTaskModal.tsx: `assignmentTopics?.some((t) => t.key === selectedAssignment.topicId)`

### 9.15 API queueing system

1. Helper: `QueueState` interface

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: exported type consumed by `getQueueState` callers (ABClass creation progress bar in v1; future consumers)
- Status: `Implemented`

2. Helper: `callApiQueued` function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: ABClass creation (sequentially enqueue class creation calls to avoid race condition); Google Classroom pre-fetch (sequentially enqueue background fetch calls to stay under concurrent ceiling)
- Status: `Implemented`

3. Helper: `getQueueState` function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: ABClass creation progress bar polls this for `{ pending, active }` to derive completion metrics
- Status: `Implemented`

4. Helper: `cancelApiQueued` function

- Decision: `extend`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: small additive function that clears pending entries for a job name; consumed only by the classes bulk queue in v1
- Status: `Implemented`

### 9.16 AssessTask "Link to Existing Definition" helpers

1. Helper: `caseInsensitiveTrimmedEquals` feature-local pure helper

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
- Call-site rationale: provides case-insensitive trimmed string equality (`a.trim().toLowerCase() === b.trim().toLowerCase()`) shared by the matcher (`findMatchingDefinition`) and the picker derivation helper (`getLinkableDefinitionsForModal`). The helper is feature-local (not exported from the modal feature directory) per §3.4 because it has exactly two in-scope callers now. Not `private` to a single file because both callers are in separate sibling files.
- Status: `Implemented`

2. Helper: `getLinkableDefinitionsForModal` pure helper

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
- Call-site rationale: derives the `LinkableDefinition[]` for the picker by filtering cached `AssignmentDefinitionPartial[]` to the class's `yearGroupKey` and sorting by `fuse.js` fuzzy title rank with `updatedAt` desc as the tie-breaker. The helper is colocated with the matcher (separate file), exported for unit testing, and has exactly one caller (`AssessTaskModal`).
- Status: `Implemented`

3. Helper: `LinkableDefinitionList` presentational component

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- Call-site rationale: renders the picker as an Ant Design `Radio.Group` with vertical orientation, block width, and JSX children (rich per-row content with title and subtitle). The component is presentational (no state, no side effects); it receives the derived `LinkableDefinition[]` and the current selection, and emits `onSelect(definitionKey)`. All rows are always selectable. The component has exactly one caller (`AssessTaskModal`) and is not promoted to a shared component.
- Status: `Implemented`

### 9.17 Class page data analysis display helpers

These entries record the planned shared display helpers for the Class page feature. The Class page is the first caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller, so the helpers are planned as **shared** rather than feature-local.

1. Helper: `resolveMetricTone(metric: MetricResult, range?: MetricToneRange, errorColor?: MetricToneColor): MetricToneResolution` — pure tone resolver

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
- Call-site rationale: maps the data analysis service's `MetricResult` discriminated union (`state: 'computed' | 'notAttempted' | 'error'`) to a `{ color, displayValue, muted }` triple that the Ant Design `Tag` consumes. The range parameter (default `{ lower: 0, upper: 5 }`) is used to compute the band boundaries via the midpoint rule: `redAmberBoundary = (3·lower + upper) / 4`, `amberGreenBoundary = (lower + 3·upper) / 4`. The `errorColor` parameter (default `'volcano'`) is the `Tag` color for the `error` state. Pure function, no React or antd imports. Validates `range.upper > range.lower` and throws on violation.
- Status: `Implemented`
- Implementation notes:
  - Added `errorColor: MetricToneColor` parameter (not in the planning-time signature) per the spec reconciliation in Section 1 and `SPEC_CLASS_PAGE_PREPARATION.md`. The default (`'volcano'`) lives in `resolveMetricTone`; `MetricPill` is a pass-through with no `errorColor`-level default.
  - The band-boundary `>` vs `>=` distinction at the amber/green boundary matches the ACTION_PLAN test case 3 (value `3.75` → gold, not green — amber side inclusive). The function uses `value > amberGreenBoundary` for green; the boundary value itself falls in the gold band.
  - Exported types: `MetricToneColor`, `MetricToneRange`, `MetricToneResolution`.
  - `MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano'` is a cross-spec contract (used by Class page column filter). Any future revision is a cross-spec breaking change.
  - The `error` color (`volcano`) is the existing Ant Design preset for "important but not fatal" — `red` is reserved for the lowest band of `computed` values to keep visual hierarchy clear.
  - File size: 146 lines (under 550; no separation needed).
- Planned doc reconciliation: confirmed the resolver remains pure (no antd imports), the range parameter is honoured, and the `errorColor` default is set in `resolveMetricTone` (not in `MetricPill`) per the spec contract — the default-value rule "defaults must be set in a module's constructor only" is moot here because `resolveMetricTone` is a pure function, not a module constructor, and the default is set in the function parameter signature.

2. Helper: `MetricPill` presentational component

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
- Call-site rationale: renders a single `MetricResult` as a coloured Ant Design `Tag` using the output of `resolveMetricTone`. Exposes `precision` (default 2), `emphasised` (default false), `range` (pass-through), and `errorColor` (pass-through; no `MetricPill`-level default — the default lives in `resolveMetricTone`). Consumed by `RecentAssignmentCard` (four instances per card) and by the four metric columns of `StudentAveragesTable` (via the column `render` function). Future consumers: cohort, trend, and distribution analyses.
- Status: `Implemented`
- Implementation notes:
  - Renders Ant Design `Tag` with the resolved color. No explicit `variant="filled"` prop — the default filled variant is used. The `bordered` prop is left at its default (`true`).
  - The `emphasised` flag applies `fontSize: '17.5px'` (1.25× default) and `fontWeight: 600` via the `style` prop, merged with the muted opacity (`0.55`) when both are active.
  - The `precision` prop is ignored for `notAttempted` and `error` (the literal `'N'` and `'E'` are rendered as-is).
  - No `Tooltip` or `aria-label` in v1 (signed-off accessibility gap per `SPEC_CLASS_PAGE_PREPARATION.md`).
  - No interactivity: no `onClick`, no `cursor: pointer`, no focus ring.
  - File size: 125 lines (under 550; no separation needed).
- Planned doc reconciliation: confirmed the Tag color choices: `computed` uses `red` / `gold` / `green` bands; `notAttempted` uses `default` (grey); `error` uses `volcano` (default) with `errorColor` pass-through. The `error` color (`volcano`) is agreed and closed per Section 1 spec reconciliation — `red` is reserved for the lowest band of `computed` values to keep visual hierarchy clear.

3. Helper: `metricDisplay/` subfolder under `services/dataAnalysis/`

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/`
- Call-site rationale: at least two production files (`metricTone.ts`, `MetricPill.tsx`) plus their spec companions share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §13 ("Create a subfolder when at least 2 files share a common domain prefix"). No `index.ts` barrel is created in v1 per spec decision 8; consumers import directly (e.g. `import { resolveMetricTone } from '.../metricDisplay/metricTone'`). This is a deliberate v1 simplification; a barrel may be added in a later de-sloppification pass if call sites get noisy.
- Status: `Implemented`
- Implementation notes:
  - Folder created at the planned path. Contains `metricTone.ts`, `MetricPill.tsx`, `metricTone.spec.ts`, `MetricPill.spec.tsx` (4 files).
  - No `index.ts` barrel confirmed. Direct imports only.
  - The existing `services/dataAnalysis/` directory structure (`analysers/`, flat files) is preserved.
- Planned doc reconciliation: confirmed the subfolder is created at the planned path and the existing directory structure is preserved.

4. Helper: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` — shared rollup precedence function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone; not in `accumulation/` subfolder)
- Call-site rationale: called by both `buildPerStudentRows` and `buildPerTaskRows` in `averagingAnalyser.rows.ts`, and by the Class page's `classPageAdapter`, applying the same three-way rollup precedence across all aggregation levels. The function operates on the public `MetricResult` discriminated union (not internal `MetricAccumulator` values) and takes a metric discriminator to apply per-metric `notAttempted` handling (for accuracy and completeness, `notAttempted` contributes 0; for SPaG, `notAttempted` is excluded). The `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only — `'average'` is intentionally excluded because the average is a composite of the three per-criterion rollups at the consumer level, not a fourth independent weighted average. Pure function, no React or antd imports.
- Status: `Implemented`
- Implementation notes:
  - Implemented in Section 3 of the action plan as part of the MetricResult discriminated-union refactor.
  - Rollup precedence: `error` > `notAttempted` > `computed`. First matching state wins.
  - Per-metric `notAttempted` handling: for accuracy and completeness, `notAttempted` contributes 0; for SPaG, `notAttempted` is excluded from numerator/denominator.
  - The function is called from `averagingAnalyser.rows.ts` row builders and will be consumed by the Class page adapter.
  - Standalone file (not in `accumulation/` subfolder) per the spec reconciliation; the facade decomposition of `averagingAnalyser.accumulation.ts` is deferred to a future pass (see §9.18 item 3).
- Planned doc reconciliation: confirmed the rollup is called from both analyser row builders and the precedence rule (`error` > `notAttempted` > `computed`) and per-metric `notAttempted` handling match the `SPEC_CLASS_PAGE_PREPARATION.md` contract.

### 9.18 Class page feature-local helpers

These entries record the planned feature-local helpers for the Class page. Per `frontend-shared-helpers-and-abstraction-standards.md` §4.4 ("Keep feature-specific helpers inside the owning feature folder"), these stay in `src/frontend/src/features/classPage/` and are not promoted to shared scope unless a documented cross-feature reuse emerges.

1. Helper: `classPageAdapter` pure adapter module

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.ts`
- Call-site rationale: the only module that knows how to translate the data analysis service's `AveragingResult` (with the new `MetricResult` discriminated union) plus the raw `ClassFull` into the view-model shapes the Class page consumes (`RecentAssignmentCardModel[]`, `StudentAverageRowModel[]`, `classMetrics`). Owns the assignment-level rollup precedence (error > notAttempted > computed) and the `updatedAt`-based recent-assignment selection. Has exactly one caller (`useClassPageData`); promotion to a shared adapter would only make sense if a second consumer surface appears.
- Status: `Not implemented`
- Planned doc reconciliation: confirm the rollup precedence is documented inline in the adapter and that the `MetricResult` discriminated union is consumed via a `switch (metric.state)` rather than nullable checks.

2. Helper: `classPageModel` pure view-model builder

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
- Call-site rationale: pure view-model builder that applies user-controlled filtering and sorting (search term, column sort, future `Viewing` dropdown) on top of the adapter output. Has exactly one caller (`useClassPageData`); kept local because the search / sort / dropdown surface is specific to the Class page's owned region and does not generalise to other features.
- Status: `Not implemented`
- Planned doc reconciliation: confirm the model remains a pure function and that no React or React Query imports leak in.

3. Structural change: facade decomposition of `averagingAnalyser.accumulation.ts`

- Decision: `defer`
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/accumulation/` (new subfolder), with `averagingAnalyser.accumulation.ts` becoming a facade.
- Call-site rationale: the projected post-change size is ~500–530 lines, which is under the 550-line threshold for facade decomposition per `src/frontend/AGENTS.md` §13 ("Do not pre-emptively split files that are approaching 550 lines; wait until the threshold is crossed or a concrete maintenance need arises"). The decomposition is deferred until the threshold is crossed or a concrete maintenance need arises. A concrete maintenance need (e.g. the three-way state assignment logic is hard to test in isolation) may trigger the decomposition in a future pass.
- Status: `Deferred`
- Planned doc reconciliation: confirm the projected post-change size at implementation time and confirm the defer decision remains valid.

### 9.19 Frontend pure formatting helpers

These entries record the planned pure formatting helpers extracted from feature code into shared utility modules.
Per `SPEC_CLASS_PAGE_PREPARATION.md` line 382, the canonical home for these helpers is `src/frontend/src/utils/` — a new top-level folder for pure formatting / utility functions shared across the frontend. The folder is not governed by `src/frontend/AGENTS.md` §13 (which covers `services/` subfolders only); this is a separate convention for helpers that have no React, Ant Design, I/O, or state dependencies.

1. Helper: `formatUpdatedAtLabel(updatedAt: string | null): string` — date formatting helper

- Decision: `new`
- Owning module/path: `src/frontend/src/utils/dateFormatting.ts` (new `utils/` folder, first entry)
- Call-site rationale: extracted from `AssignmentsPage.tsx` as part of the rename deliverable because the Class page's `classPageAdapter` needs the same formatter. `en-GB` locale, date-only, rendered in UTC. The em-dash fallback (`UNAVAILABLE_VALUE = '—'`) is defined locally in the new module (does not import from `AssignmentsPage.tsx`). Pure formatting function, no React / antd / I/O / state. The Class page adapter does not use the fallback; it throws upstream on null or unparseable input. The helper preserves the fallback for the `AssignmentsPage` caller.
- Status: `Implemented`
- Implementation notes:
  - Implemented in Section 2 of the action plan alongside the `lastUpdated` → `updatedAt` rename.
  - The helper lives at `src/frontend/src/utils/dateFormatting.ts` (first entry in the new `utils/` folder).
  - `UNAVAILABLE_VALUE = '—'` is defined locally in `dateFormatting.ts`.
  - The helper preserves the existing `AssignmentsPage` behaviour (em-dash fallback for null/unparseable) while the Class page adapter (`classPageAdapter`) throws upstream on null.
  - Pure function: en-GB locale, date-only, rendered in UTC. No React / antd / I/O / state.
- Planned doc reconciliation: confirmed the helper lives at the planned path, preserves the existing `AssignmentsPage` behaviour, and the `UNAVAILABLE_VALUE` constant is defined locally (not imported from `AssignmentsPage.tsx`).

## 10. Frontend utils folder convention

The `src/frontend/src/utils/` folder exists for pure formatting / utility functions that are shared across the frontend. This folder is a separate convention from `src/frontend/AGENTS.md` §13, which governs only `services/` subfolder organisation.

### Rules

- **Pure functions only.** Files in `utils/` must have no React, Ant Design, I/O, or state dependencies. They are plain TypeScript modules exporting typed pure functions.
- **No `src/frontend/AGENTS.md` §13 governance.** The §13 subfolder-by-domain-prefix rule applies only to `services/`. The `utils/` folder is a flat namespace; files are named by the domain they format (e.g. `dateFormatting.ts`). A future subfolder reorganisation may be considered if the folder exceeds 5–6 files, but no barrel exports (`index.ts`) are created in v1 — consumers import directly.
- **First entry:** `dateFormatting.ts` — exports `formatUpdatedAtLabel(updatedAt: string | null): string`. See §9.19 item 1 above for the full contract.
