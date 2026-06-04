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

- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper: `src/frontend/src/features/classes/bulkMutationOrchestration.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/queryInvalidation.ts`
- Classes reference-data workflow helpers: `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`
- Classes Page test fixtures and rendering helpers (including `createFixtureClassPartial`, `createFixtureYearGroup`, `renderClassesPage`, `toPlainClassPartials`, and shared fixture constants): `src/frontend/src/test/classes/classesPageTestHelpers.tsx`

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
- Owning path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/bulkMutationOrchestration.ts`
- Status: `Implemented`
- Rationale: the panel now drives top-level bulk actions through descriptor-shaped action data while preserving `runBulkMutationOrchestration(...)` as the shared mutation boundary

2. Helper or contract: metadata bulk-update contract for editable existing rows

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulkMetadataUpdateFlow.ts`
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
- Owning path: `src/frontend/src/features/classes/BulkFormModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `BulkCreateModal.tsx`, `BulkSetSelectModal.tsx`, and `BulkSetCourseLengthModal.tsx` now present a justified three-caller family for a narrow feature-local shell that owns reset-on-cancel, submit-on-OK, inline submission error rendering, and modal busy semantics without becoming a generic wrapper

2. Helper or contract: classes reference-data modal helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`, `src/frontend/src/features/classes/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the current helper split already covers the shared reference-data workflow and should not be replaced or widened during this refactor

3. Helper or contract: one-off destructive confirmation modals

- Decision: keep local
- Owning path: `src/frontend/src/features/classes/BulkDeleteModal.tsx`, `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Implemented`
- Rationale: both confirmation flows remain workflow-specific one-offs whose copy and footer semantics do not yet justify a shared abstraction

### 9.9 Classes reference-data modal add-action standard

1. Helper or contract: reference-data modal scaffold

- Decision: new
- Owning path: `src/frontend/src/features/classes/ReferenceDataManagementModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx` now reuse the extracted scaffold for modal shell composition, standard Cancel/close wiring, start-aligned content-width create-action presentation, and slot placement; a topic reference-data modal is an accepted next sibling caller

2. Helper or contract: existing inline dialog and reference-data helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/classes/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`, `src/frontend/src/features/classes/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the extracted scaffold composes the existing dialog and workflow helper family rather than replacing it, because those modules already own the inner-dialog contract and reference-data workflow helpers coherently; the scaffold uses these helpers for inline form and delete dialog slots

3. Helper or contract: `ReferenceDataTrustBoundary` type extension in `manageReferenceDataHelpers.ts`

- Decision: extend (planned for future topic caller)
- Owning path: `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`
- Status: `Not implemented`
- Rationale: the `ReferenceDataTrustBoundary` union type currently covers `'cohorts' | 'yearGroups'`; when the accepted next topic reference-data modal caller is implemented, `'assignmentTopics'` must be added to this union so the blocking-load trust-boundary helpers (`getPersistedBlockingLoadError`, `setPersistedBlockingLoadError`, `clearPersistedBlockingLoadError`, `syncReferenceDataModalBusyState`) work correctly for the topic entity; this is a deliberate deferred extension, not a speculative abstraction

### 9.10 Section 5 de-sloppification: classes reference-data loading and test constants

1. Helper or contract: ReferenceDataInitialLoadingState (shared loading skeleton component)

- Decision: new
- Owning path: `src/frontend/src/features/classes/ReferenceDataInitialLoadingState.tsx`
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
- Owning path: `src/frontend/src/pages/classes/classesPageModel.ts` or an equivalent page-adjacent local helper
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
