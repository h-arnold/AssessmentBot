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

- Page dataset-state hook and pure helpers: `src/frontend/src/hooks/usePageDataset.ts` — also hosts the shared neutral `computeDatasetBlockingReason` / `DatasetBlockingReason` resolver (a discriminated reason: `none` | `failed` | `untrustworthy` | `queryError`) used by both `classPage` (`useClassPageData.helpers`) and the standalone Heatmaps surface (`heatmapsSurfaceState`) to derive their feature-specific blocking errors from a single precedence decision; this resolved a three-way drift
- Once-only conditional callback hook (React 19 StrictMode-safe): `src/frontend/src/hooks/useLogOnce.ts`

### 3.2 Error and transport helpers

- Unknown-error normalisation: `src/frontend/src/errors/normaliseUnknownError.ts`
- Unknown → `Error` normalisation: `toError(unknown): Error` in `src/frontend/src/errors/normaliseUnknownError.ts` — the canonical `unknown → Error` helper (S-N4) used across features; complements `normaliseUnknownError` (which returns a plain payload) when a caller needs a concrete `Error` instance
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Shared blocking-error → `Result` config resolver and `BlockingConfig` type: `src/frontend/src/errors/blockingConfig.ts` (per-feature copy maps supply the error-specific titles; the resolver mechanism is shared)
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`; the standalone Heatmaps feature's pipeline and assembly diagnostics route through the bounded-dedupe `logPipelineError` wrapper in `src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts` rather than calling the sink directly, so an identical diagnostic raised on a memo recomputation is logged once.
- Sequential API request queue: `callApiQueued`, `getQueueState`, `cancelApiQueued`, and `QueueState` in `src/frontend/src/services/apiService.ts` — one FIFO queue for method batches (ABClass creation, Classroom pre-fetch); extend it rather than adding a parallel queue.

### 3.3 Feature-shared helpers (existing local precedents)

- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/table/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper (sequential FIFO): `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
- Classes batch-mutation shared types: `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Reference-data workflow helpers: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`
- Year-group presentation ordering: `src/frontend/src/features/referenceData/yearGroupSorting.ts` — source of truth for immutable, natural year-group ordering.
- Classes bulk form modal scaffold: `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx` — three-caller shell owning reset-on-cancel, submit-on-OK, inline submission error rendering, and busy semantics.
- Reference-data modal family: `ReferenceDataManagementModalScaffold.tsx`, `manageReferenceDataDialogs.tsx`, `InlineDialog.tsx`, and `ReferenceDataInitialLoadingState.tsx` (under `src/frontend/src/features/referenceData/`) — extend this family for new reference-data modals rather than composing a fresh shell.
- Cross-feature re-run entry contract: `src/frontend/src/features/shared/reRunAssessmentContext.ts` — `ReRunContext` lives in `features/shared` so `features/taskHeatmap/**` never imports `features/classPage/**`.

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`
- Classes Page test fixtures and rendering helpers (including `createFixtureClassPartial`, `createFixtureYearGroup`, `renderClassesPage`, `toPlainClassPartials`, and shared fixture constants): `src/frontend/src/test/classes/classesPageTestHelpers.tsx`
- Classes bulk-set flow test helpers (exports `makeRow`, `assertQueuedBatchMutationCalledOnce`, `assertSingleSelectedRowEdit`): `src/frontend/src/test/classes/bulkFlowTestHelpers.ts` — shared by the `bulkSetYearGroup` and `bulkSetCohort` specs to keep the row-fixture and queued-batch-call assertion logic DRY.

- Shared data-analysis test fixtures and assertion helpers: `src/frontend/src/test/dataAnalysis/` (fixtures, averaging analyser assertions). Placement follows the shared test helpers convention; cross-referenced from `docs/developer/frontend/frontend-testing.md`.
- Shared document-order button-name helpers for placement assertions: `src/frontend/src/test/shared/buttonOrderingTestHelpers.ts` (exports `getAccessibleButtonNames` and `getAccessibleButtonIndex`), so specs assert relative action placement against the same accessible names.
- Production page copy for assertions: `src/frontend/src/pages/pageContent.ts` — reuse the stable headings and summaries from here instead of mirroring them in tests.

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

### 3.5 Shared presentational components

- `ImageRenderer` (planned → implemented, status: Implemented): shared presentational component at `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`. Renders a base64 data URL as a constrained `<img>` (maxWidth 100%, height auto, maxHeight 400, default alt "Student response image"). Introduced for the Task Preview Card; expected to be reused across the project. Reused by the Task Preview Card.
- `MarkdownRenderer` (planned → implemented, status: Implemented): shared presentational component at `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`. Renders markdown text and tables via `react-markdown` + `remark-gfm` (no `rehype-raw`, for XSS safety). Co-located CSS for basic table styling. Introduced for the Task Preview Card; expected to be reused across the project. Implemented with `react-markdown` + `remark-gfm`, no `rehype-raw`, and a co-located `MarkdownRenderer.module.css`.

### 3.6 Student-name helpers

- `splitStudentName` (status: `Implemented`): shared deterministic helper module at `src/frontend/src/utils/splitStudentName.ts`. It exports:
  - `splitStudentName(studentName: string): { forename: string; surname: string }` — the first whitespace-separated token becomes `forename`; the remaining tokens are joined with single spaces as `surname`. Leading, trailing, and repeated internal whitespace is collapsed; an empty or whitespace-only name returns two empty strings. Honourifics are never special-cased.
  - `compareStudentNamePart(part: 'forename' | 'surname', a, b): number` — selects the requested derived part of two `Readonly<{ studentName: string; studentId: string }>` rows, compares them locale-aware and case-insensitively, and tie-breaks by ascending `studentId`. The comparison is direction-neutral; call sites apply direction inversion.
- Consumers: the Student Averages table (`features/classPage/studentAveragesTableColumns.tsx` column renderers and per-column sorters, and `features/classPage/classPageModel.ts` explicit derived sort) and the Task Heatmap table (`features/taskHeatmap/TaskHeatmapTable.tsx` two sticky columns and their sorters). No duplicate per-feature name-splitting logic is permitted.
- **Standing requirement:** all tables displaying a student name use Forename and Surname columns derived via this shared helper. Default ordering stays full-name ascending through the unchanged `compareStudentNames` comparator.
- Shared Forename/Surname Ant Design columns: `buildStudentNameColumns<Row>(options)` at `src/frontend/src/features/shared/studentNameTableColumns.tsx` — the column counterpart consumed by the two tables above.
- The module is pure: no React, Ant Design, I/O, or state dependencies.

### 3.7 Data analysis display and projection helpers

- Metric display family: `src/frontend/src/services/dataAnalysis/metricDisplay/` — `resolveMetricTone` and `MetricPill.tsx` (colour and tone), `metricDisplayText.ts` (`formatMetricDisplayText`), `metricComparator.ts` and `metricStateRank.ts` (state-aware column ordering), and the score-range filter helpers (`metricRangeKey.ts`, `metricRangeFilter*.tsx`). One shared vocabulary for metric colour, text, ordering, and filtering across the Class page and the task heatmap; these were planned as shared because cohort, trend, and distribution analyses are the accepted second caller. The colour and label contract (including the `MetricToneColor` union) is cross-spec — do not restate or retype it per feature.
- Student-name row ordering: `src/frontend/src/services/dataAnalysis/compareStudentNames.ts` — callers consume it directly; do not add a feature-local wrapper. The Forename/Surname column comparator stays in Section 3.6.
- Heatmap projection: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` and `heatmapAdapter.merged.ts` — the shared `AveragingResult` → heatmap boundaries; feature-local heatmap helpers stay under `src/frontend/src/features/taskHeatmap/`. The analyser package and `taskKey.ts` inventory lives in `docs/developer/frontend/data-analysis-architecture.md`; do not duplicate it here.

### 3.8 Assignment and definition helpers

- Assignment transport: `src/frontend/src/services/assignmentAssessment/` — the `getAssignment` service (`assignmentAssessmentService.ts`) plus `AssignmentFullSchema` / `AssignmentFullResponseSchema` validation (`assignmentAssessment.zod.ts`).
- Effective weighting: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` — `TaskWeightingIndex` and `computeEffectiveWeight`, the single effective-weight resolver for analyser accumulation and heatmap column projection.

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

## 9. Helper decision register

Section 3 lists what exists; this section records what was **decided** — especially what the code cannot show: helpers deliberately not extracted, designs rejected or superseded, and decisions still pending.

Rules for new entries:

- Record one line: entry ID, decision, owning path, and a brief why. Add the why only when Section 4 would not give the same answer.
- Durable helper facts (path and contract) belong in Section 3. Implementation detail belongs in code JSDoc or the owning feature folder.
- Entry numbers are stable; retired entries leave gaps. Log entries that only restated delivered code were promoted to Section 3 and removed in the September 2026 cleanup.

### Decisions not to extract

- **9.1 Assignments page column filters** — keep local to `src/frontend/src/pages/AssignmentsPage.tsx`: page-local descriptors plus one typed filter setter; a cross-feature filter helper would be speculative.
- **9.3 Settings tabs** — keep local to `src/frontend/src/pages/SettingsPage.tsx`.
- **9.4 Selected-row derivation** — the Classes feature root derives `selectedRows` once and passes the subset to `ClassesToolbar`; no child recomputation.
- **9.5 Backend settings field descriptors** — keep local to `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`; Ant Design form meta remains the single validation-error source of truth.
- **9.7 / 9.8 Classes bulk modal shell** — a generic shared wrapper was deferred and never delivered; the resolved outcome is the narrow three-caller `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx`.
- **9.8 One-off destructive confirmations** — `src/frontend/src/features/classes/bulk/BulkDeleteModal.tsx` and `src/frontend/src/pages/AssignmentsPage.tsx` stay workflow-specific; no shared confirmation wrapper.
- **9.11 Classes page grouped view-model** — keep local to `src/frontend/src/pages/classesPageModel.ts`; do not widen the Settings Classes helper family, which serves different merge and workflow needs.
- **9.14 Topic existence check** — single-caller one-liner in `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`; no existing helper matches the contract.
- **9.16 / 9.16a AssessTask link and skeleton helpers** — `matchDefinitionForAssignment.ts`, `getLinkableDefinitionsForModal.ts`, `LinkableDefinitionList.tsx`, `AssignmentSelectSkeleton.tsx`, and `stringComparison.ts` stay in `src/frontend/src/features/classes/AssessTaskModal/`; two or three in-modal callers each, so they are not promoted.
- **9.19 Class page and task-heatmap surface** — every adapter, model, hook, dispatcher, presentational component, zero-weight header, and E2E scenario helper under `src/frontend/src/features/classPage/**` and `src/frontend/src/features/taskHeatmap/**` stays feature-local per Section 6; promotion requires a documented cross-feature caller.

### Rejected and superseded designs

- **9.24 Generic wizard orchestrator hook and entry-intent taxonomy — superseded and removed.** `resolveWizardEntryMode`, `useAssignmentWizardOrchestrator`, and the `{kind: ...}` recovery entry intent were deleted once `useAssessTaskRecoveryFlow` owned stale recovery. Only `buildReparseRequest` survives, in `src/frontend/src/features/assignmentWizard/assignmentWizardOrchestrator.ts`. Do not re-propose a generic entry-mode layer.

### Delivered decisions kept for existing cross-references

- **9.24 Stale-definition recovery (issue #301)** — delivered `useAssessTaskFlow`, `AssignmentDefinitionWizardReviewContent`, `assignmentWizardFormState`, and `AssignmentDiscardConfirm`. The modal contract is recorded in `frontend-modal-patterns.md` §3.4 and §3.5.
- **9.25 Explicit assessment re-run entry (issue #298)** — delivered `ReRunContext` (`src/frontend/src/features/shared/`), `resolveReRunTarget`, `useAssessTaskReRunFlow`, and `AssessTaskReRunSurface`. The modal contract is recorded in `frontend-modal-patterns.md` §3.6.

### Retained non-obvious implementation notes

These came out of the de-sloppification passes and cannot be recovered from reading the code:

- **antd v6 `Select` `optionRender`** exposes no `selected` flag; derive checkbox option state from controlled-value membership (`value` in the current selection), not from a `selected` argument.
- **Disabled-reason accessibility**: expose a disabled control's reason both as a hover `Tooltip` and as an sr-only `aria-describedby` node; mediate the antd `Tooltip` `cloneElement` wrapper with an intermediate `<span>` so the described-by binding survives.
- **antd `Table` `defaultSortOrder`** does not apply the initial sort in the installed version; pre-sort the `dataSource` instead (for example `rows.toSorted(compareStudentNames)`).
- **Disabled `Button` tooltips** need a `<span>` wrapper: antd v6 `Tooltip` does not trigger on a disabled button. This is the established codebase pattern.

## 9.26 Task preview source link planning (issue #19)

Reconcile each entry against the implemented feature. The Section 1 decomposition, the shared canonical-fixture selection, the nullable source-ID validation, the derived `sourceUrl` resolution/carry-through, the source-link action with its controlled keyboard-focus ownership, and the red-first Section 4 E2E oracle/scenarios have landed. Under the user-approved reduced finish line, the exhaustive viewport/zoom capture matrix and the separate 200% browser-zoom gate are waived; the representative visual inspection is complete, and the final focused review and regression validation are complete and accepted. See root `SPEC.md` and `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md`.

1. Existing preview derivation helpers — **extend**, delivered. `features/taskHeatmap/buildCellPreviewLookup.ts` resolves the derived nullable editor `sourceUrl` and attaches it to `CellPreviewData`; `assembleTaskPreviewData.ts` carries it unchanged onto `TaskPreviewData` (with an explicit `null` for a missing cell); `assembleMergedPreviewData.ts` preserves content/source identity through the existing merged first-wins pipeline because the URL travels inside the merged cell. It is never persisted and never added to an API response. **Status: Implemented**.
2. Source URL resolver — **keep local**, private logic in `features/taskHeatmap/buildCellPreviewLookup.ts`. The wizard's private `buildCanonicalUrl` in `features/assignmentWizard/assignmentWizardFormState.ts` was inspected but assumes selected supported form formats and restores reference/template URLs, whereas this logic resolves nullable per-student artefact/parent IDs and page anchors. Do not widen the wizard or introduce a generic URL framework. Fixed HTTPS editor host, encoded identifiers, supported-format branching and root fallback remain a coherent local contract. The derived `sourceUrl` is never image-export `artifact.metadata.sourceUrl`. **Status: Implemented** (private `resolveSourceUrl`, with `trimStoredId`/`buildEditorBaseUrl`).
3. Metric-cell popover responsibility — **new feature-local extraction**, delivered. `features/taskHeatmap/TaskMetricPreviewCell.tsx` owns the trigger/Popover pair and the preview's open state; `features/taskHeatmap/TaskMetricPreviewContent.tsx` owns the ready/loading/error body. Both were extracted from `taskHeatmapTableColumns.tsx`, which keeps column construction, sort/filter and tier grouping and delegates rendering to the cell. No generic popover abstraction or global portal change. **Status: Implemented** — behaviour-preserving extraction plus the approved keyboard handling recorded below.

   **Controlled open state and focus ownership (implemented).** The cell owns the preview's open state and passes it to the Popover as `open`; hover traversal, click pinning, outside-click dismissal and destroy-on-hide still raise `onOpenChange`, and the cell records what it is told. Enter or Space on the trigger opens the preview and arms one current-session focus intent, spent at most once on the ready body's source action and only while the trigger still holds focus. A loading, failed or source-less preview leaves the intent waiting, so a later readiness transfers focus once; closing the preview or the trigger losing focus cancels the intent persistently without withdrawing the preview. The trigger's `onBlur` observes departure, so tabbing away and later returning to a still-loading trigger never revives the transfer. Escape from the trigger or the portal closes the preview and returns focus to the cell, and Tab/Shift+Tab stay untrapped. The transfer is deferred by one `queueMicrotask` because moving focus opens the action's own hover/focus Tooltip, which Ant Design opens inside a synchronous `flushSync` while React is still committing and would otherwise log a development-only warning. Two local refs keep the decisions off the transport contract: the body ref identifies the one element the cell renders inside the portal, so "is focus inside the preview?" needs no global DOM query or Ant overlay handle, and the source-action ref is published to the cell through the optional `sourceAnchorRef` UI prop that a column builder cannot supply. The narrow-viewport containment fix is likewise local: `features/taskHeatmap/TaskMetricPreviewCell.module.css` hides only the popover arrow at ≤390px, where its box otherwise spills 4px past the right edge and widens the page's horizontal scroll width; no shared popover or global CSS is touched. The trigger exposes the disclosure state (`aria-expanded` from the open flag, `aria-haspopup="dialog"`) and the portal body is a non-modal `role="dialog"` named by that same shared accessible label, still with no focus trap; the trigger's local `:focus-visible` ring is themed from `index.css` rather than the browser default. The ready body memoises `assembleTaskPreviewData` in place — no added wrapper — so re-renders while the preview is open do not repeat the spreadsheet conversion.

4. Decorative action icon — **reuse**, delivered as a call site. `TaskPreviewCard.tsx`'s `SourceAction` renders `components/icons/LucideIcon.tsx` with Lucide `ExternalLink`, `size={16}` and `strokeWidth={1.5}`, wrapped in a hover/focus `Tooltip`; the wrapper and its spec own explicit width/height/fill integration and decorative semantics. The representative visual inspection accepted the 16px icon, 24px action and 1.5 stroke as legible, aligned and free of overlap or clipping, so those values are retained; the historical `metric-icon-display.md` sizing prose is unaffected and no unrelated metric label changed. **Status: Implemented** (call-site reuse landed and its dimensions are accepted; final focused review and regression validation complete).
5. Test fixtures/navigation — **reuse/extend**, delivered. Shared Vitest fixture selection now lives in `src/test/taskHeatmap/previewFixtures.ts`: it selects the canonical `small` `class-2` roster and its populated Slides `assignment-2-1` and Sheets `assignment-2-2` through the frontend raw-JSON import convention, validates every selected full record through `AssignmentFullSchema` / `ClassFullSchema`, derives identifiers, labels and content from those records rather than restating literals, and deep-freezes them so callers clone before mutation. Freeze, guard and TEXT-body primitives (`deepFreeze`, `requireRecord`, `requireTextArtifactContent`) are shared once in `src/test/shared/canonicalFixturePrimitives.ts`, used by this module and by the E2E fixture/expectation helpers. The assignment-schema fixtures moved to `src/test/assignmentAssessment/assignmentAssessment.zod.fixtures.ts` and re-export this module's canonical Slides record (`CANONICAL_SLIDES_ASSIGNMENT`) as `validFullAssignment`, so the schema and preview suites parse one canonical payload. The source-link runtime scenarios and navigation helpers are now authored as a red-first Section 4 suite (`e2e-tests/helpers/task-preview-source-link-{fixtures,expectations,scenarios,helpers,geometry}.ts` plus `task-preview-header-regions.ts`), reusing the existing `e2e-tests/shared/endToEndRuntimeMocks.ts` queues rather than a competing mock. `task-preview-source-link-helpers.ts` owns shared journey composition — the canonical runtime scenario wiring, the context-wide Google Docs stub route and the entry-point walk — for both the embedded and merged journeys; the interaction/navigation spec and the state/focus-session spec consume the composed journeys, while the visual spec drives the navigation helpers directly. The source-link action and its keyboard-focus ownership those specs exercise are now implemented in the extracted cell/card, and the narrow-geometry cases (including the local ≤390px arrow treatment) pass with their assertions unchanged. Under the user-approved reduced finish line, the exhaustive viewport/zoom matrix and the separate 200% browser-zoom gate are waived; the representative visual inspection is complete, and the final focused review and regression validation are complete and accepted. The unsupported realistic image/table content gap and generator-extension target are recorded in `ACTION_PLAN.md`; invalid/boundary variants remain local. **Status: Implemented and accepted under the reduced finish line.**

   **Shared primitives, layer-specific record loading (review-accepted).** The freeze, guard and TEXT-body primitives now live once in `src/test/shared/canonicalFixturePrimitives.ts` and are shared by the Vitest and Playwright fixtures, replacing the former per-domain `deepFreeze` copies. Only record loading stays per layer, and deliberately so: the Vitest fixture imports the committed views as raw text (`?raw`) and parses them, while the E2E fixture imports the same JSON directly — a real constraint of the Vite and Node runners. Callers clone the frozen canonical records before mutation, and no generic runtime helper is warranted.

6. E2E expected-URL oracle — **keep feature-local and deliberately independent**, in `src/frontend/e2e-tests/helpers/task-preview-source-link-expectations.ts`. The Section 4 walkthroughs drive the real client pipeline (mocked transport → `callApi` → assignment service Zod schema → `buildCellPreviewLookup`) and compare the rendered `href` and the captured new-tab navigation against an expectation this helper derives from the raw stored identifiers against a fixed HTTPS host and path. It deliberately imports neither the private production `resolveSourceUrl` nor the Vitest-only `buildExpectedSourceUrl`, so the assertion cannot validate the resolver against itself. Production resolution stays private to `features/taskHeatmap/buildCellPreviewLookup.ts`; do not introduce a generic runtime URL abstraction for either test layer. **Status: E2E oracle delivered; the source-link action and its focus behaviour are implemented and the narrow-geometry cases pass with assertions unchanged. Under the user-approved reduced finish line the exhaustive viewport/zoom matrix and separate 200% browser-zoom gate are waived, and the representative visual inspection is complete; the final focused review and regression validation are complete and accepted.**

## 10. Frontend utils folder convention

The `src/frontend/src/utils/` folder exists for pure formatting / utility functions that are shared across the frontend. This folder is a separate convention from `src/frontend/AGENTS.md` §13, which governs only `services/` subfolder organisation.

### Rules

- **Pure functions only.** Files in `utils/` must have no React, Ant Design, I/O, or state dependencies. They are plain TypeScript modules exporting typed pure functions.
- **No `src/frontend/AGENTS.md` §13 governance.** The §13 subfolder-by-domain-prefix rule applies only to `services/`. The `utils/` folder is a flat namespace; files are named by the domain they format (e.g. `dateFormatting.ts`). A future subfolder reorganisation may be considered if the folder exceeds 5–6 files, but no barrel exports (`index.ts`) are created in v1 — consumers import directly.
- **First entry:** `dateFormatting.ts` — exports `formatUpdatedAtLabel(updatedAt: string | null): string` (`en-GB`, date-only, rendered in UTC; em-dash fallback for null or unparseable input). The Class page adapter deliberately does not use the fallback: it throws upstream on null or unparseable input.
