# Class Page Specification

## Status

- Draft v1.0
- Source of truth for the Class page — the per-class overview surface that opens when a teacher clicks the `View` button on a class card in `ClassesPage`.
- Companion document: `SPEC_CLASS_PAGE_PREPARATION.md` (the two lead deliverables — the `AssignmentPartial` rename and the data analysis service contract change — must land first).
- The shared display helpers (`metricTone`, `MetricPill`) are owned by the prep spec; this spec consumes them by reference.
- The action plan for this work is drafted separately; this spec is intentionally implementation-agnostic and does not prescribe file ordering or red-first test cases.

## Purpose

The Class page summarises a single class's assessment performance. When a teacher clicks the `View` button on a class card in `ClassesPage`, the page opens inline (a child of `ClassesPage`, not a new top-level page) and shows:

- A row of up to three "Recent Assignments" cards, each showing per-assignment metric averages and a "Last Assessed" line.
- A full-width table of per-student metric averages across the class.
- Two action buttons in the page header: `Edit Student Details` (placeholder, disabled for v1) and `Start New Assessment` (reuses the existing `AssessTaskModal`).

The feature will be used to:

- give teachers a single at-a-glance view of recent per-assignment performance and overall class performance;
- surface the distinction between computed scores, not-attempted work, and processing errors (per the data analysis service's new `MetricResult` discriminated union — see the prep spec);
- provide a discoverable entry point for starting a new assessment on the current class.

The Class page is **not** intended to:

- Add editing of student details (the `Edit Student Details` button is a disabled placeholder for v1).
- Add new assessment workflows beyond the existing `AssessTaskModal`.
- Add assignment creation.
- Add drill-down to per-assignment or per-student detail views (deferred to v1.1+).
- Add URL-based routing (the class detail view is a child of `ClassesPage`; deep linking, browser back/forward, and refresh-from-class are v1.1+ scope).

## Agreed product decisions

The product decisions specific to the Class page are listed below. The data-layer decisions (rename, `MetricResult` discriminated union, `rollupMetric` helper) live in `SPEC_CLASS_PAGE_PREPARATION.md` and are referenced by this spec but not re-decided.

1. **The Class page is a child of `ClassesPage`, not a separate top-level navigation key.** The `AppNavigationKey` enum stays at the four top-level keys (`dashboard | classes | assignments | settings`). When the user clicks the `View` button on a class card, `ClassesPage` (which holds a `selectedClassId: string | null` page-local state) renders the class detail view inline; the active nav key remains `classes`, so the sidebar `Classes` entry stays highlighted. The class detail view is itself a thin composition root (`ClassPage`) that lives under `src/frontend/src/features/classPage/`. The `pages/` folder is reserved for top-level pages; feature components live under `features/`.
2. **View-entry fetch of the full AB class.** Startup warmup is unchanged. When the user opens a class page, the page issues a `getABClass` query via the existing `queryKeys.abClass(classId)` key. The page renders a shape-matched skeleton while the fetch is in flight.
3. **"Recently completed" = three assignments with the most recent activity timestamp.** For v1, "activity timestamp" = the `AssignmentPartial.updatedAt` field (renamed from `lastUpdated` per the prep spec decision 1), sorted descending. Fewer than three cards are shown when the class has fewer than three assignments; the row remains centre-aligned. The card label is "Last Assessed:" (not "Completed:"), reflecting the per-assessment activity semantic.
4. **The adapter is a separate feature-local module.** The adapter (`classPageAdapter`) takes the data analysis service's typed output and produces the per-assignment and per-student shape the UI consumes. The adapter is feature-scoped; the data analysis service stays a pure, presentational-agnostic orchestrator. The adapter shares the `rollupMetric` helper (defined at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` in the prep spec) with the analyser.
5. **The "Average" column / cell uses the analyser's `overall` metric** — the 40/40/20 weighted overall by default, with the SPaG-renormalisation rule inherited from the analyser. The "Average" cell in the Recent Assignment card and the "Average" column in the Student Averages table use the `emphasised` flag on `MetricPill` to render the cell larger and bolder.
6. **`Edit Student Details` is rendered as a disabled button in v1** with an Ant Design `Tooltip` reading `Coming soon` to explain the placeholder. The `Tooltip` wraps a `span` (or `div`) so it triggers on hover, because Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly.
7. **`Start New Assessment` opens the existing `AssessTaskModal`** with the current `classId` and `className`, identical to the `ClassesPage` card flow. The page-level composition root owns the `AssessTaskModal` open / close state and the `onStartNewAssessment` callback. The same callback is passed to both the header button and the empty-state CTA in `RecentAssignmentsSection`, so the action is discoverable from either entry point.
8. **Back affordances = sidebar `Classes` entry + breadcrumb `Classes` segment.** The in-page `Back to Classes` button is **not** rendered. The two shell affordances are consistent with the other pages in the app (`DashboardPage`, `AssignmentsPage`, `SettingsPage` have no in-page back button). The breadcrumb's `Classes` segment is rendered by the class detail view itself (not by `appNavigation.tsx`'s `getBreadcrumbItems`, which stays a 2-segment function of the nav key) and is clickable, clearing `selectedClassId` and keeping the nav key on `classes`.
9. **The "Viewing: Overall Class Averages" affordance is a static `Typography.Text` label.** No disabled `Select` placeholder (a disabled _option_ still renders an interactive dropdown with no selectable items, which is a UX dead-end). The alternative-views feature (`By Topic`, `By Student`, `By Criterion`) is v1.1+ scope. The model's `filters.viewing` field is therefore removed from v1.
10. **Pill cell text is just the formatted number** (e.g. `2.18`). The `MetricPill` renders `value.toFixed(precision)` (default precision 2); there is no value-with-threshold label, no band suffix, no "Green" / "Amber" text. The colour carries the band; the value carries the number.
11. **Number formatting precision is `2` decimal places by default** on `MetricPill` (matches the mockup's `2.18`, `3.60`, `5.00` examples). The precision is a `MetricPill` prop so future call sites can override it per use case.
12. **No `index.ts` barrel in `features/classPage/`.** Direct imports are clearer for two related symbols. The action plan records this as a deliberate v1 decision; a barrel may be added later if the feature grows.

## Existing system constraints

### Backend / API constraints

- `getABClass({ classId })` returns `ClassFull | null` via `callApi('getABClass', { classId })`. Returns `null` on `ClassNotFoundError`; we treat `null` as a blocking state.
- `ClassFull` shape (from `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`): `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey`, `classOwner`, `teachers`, `students[]`, `assignments[]`, `active`.
- `AssignmentPartial` shape: `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `updatedAt` (renamed from `lastUpdated` per the prep spec), `createdAt`, `documentType`, `submissions[]`, `assignmentDefinition`.
- `StudentSubmissionPartial` shape: `studentId`, `studentName`, `assignmentId`, `documentId`, `items` (dict keyed by `taskId`), `createdAt`, `updatedAt`.

### Data analysis constraints (already in place after the prep work)

- `DataAnalysisService.analyse(input, analyserKey = 'averaging')` is a pure orchestrator.
- `AveragingAnalyserInput` shape: `{ filter: AnalysisFilter; classes: ClassFull[]; assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse }`.
- `AnalysisFilter` requires `classIds: string[]` (min 1).
- `AveragingResult` shape: `{ classId, className, perStudent, perTask, perClass, appliedCriterionWeightings }`.
- `PerStudentRow` is keyed by `studentId` and carries flat `completeness`, `accuracy`, `spag`, `overall` `MetricResult` fields.
- `PerTaskRow` is keyed by `(definitionKey, taskId)` and carries the same four flat metrics. One row per task, not per assignment.
- `MetricResult` is a discriminated union by `state` (`computed` / `notAttempted` / `error`). See the prep spec for the full contract.
- The shared `rollupMetric` helper (defined in the prep spec) is called by both the analyser and the Class page adapter.
- `assignmentDefinitionPartials` is already in startup warmup (see `sharedQueries.ts` `startupWarmupQueryDefinitions`).

### Frontend / architecture constraints

- `appNavigation.tsx` uses a state-based `AppNavigationKey` enum (`dashboard | classes | assignments | settings`). The breadcrumb supports exactly two segments today (`AssessmentBot Frontend / {navKey}`), and `getBreadcrumbItems(key)` returns those two segments. The class page's third segment (`{className}`) is rendered by the class detail view itself, not by `appNavigation.tsx`'s `getBreadcrumbItems` (which stays a 2-segment function of the nav key). The class detail view also wires the click handler on the breadcrumb's `Classes` segment. **Implementation note (architectural gap):** the current `AppShell.tsx` renders the `Breadcrumb` from `getBreadcrumbItems(selectedNavigationKey)` inline, with no mechanism for a child page to extend or override the items. **v1 commitment (least-invasive mechanism):** the class detail view renders its own three-segment `Breadcrumb` in the page content area (below the shell's two-segment `Breadcrumb`), accepting the temporary visual duplication. The `AppShell` and `appNavigation.tsx` are not modified in v1. A future v1.1+ iteration may add a breadcrumb-override prop on `AppShell` and remove the duplication; that refactor is out of scope for v1. The v1 contract is that the three-segment breadcrumb is visible, the `Classes` link is clickable, and the third segment is non-clickable.
- `ClassesPage` currently renders the disabled `View` button at `src/frontend/src/pages/ClassesPage.tsx:163-165`. The class detail view is rendered inline by `ClassesPage` when `selectedClassId` is set, rather than by a separate top-level page.
- `AssessTaskModal` is reusable as-is. It reads `classId`, `className`, `onClose` — no signature change required.
- The shell's `App.useApp()` provider is available for context-aware `message` / `notification` feedback if needed.
- Shared helpers, query infrastructure, and width tokens are documented in `docs/developer/frontend/`. The new feature must follow these policies.
- The shared display helpers (`metricTone`, `MetricPill`) are owned by `SPEC_CLASS_PAGE_PREPARATION.md` and are imported directly into the Class page components. The Class page does not redefine the tone-resolution or pill-rendering contracts. The `metricDisplay/` subfolder is created under `src/frontend/src/services/dataAnalysis/` per the prep spec; the folder is justified by the ≥2 files sharing the `metricDisplay` domain prefix rule in `src/frontend/AGENTS.md` §13.

## Domain and contract recommendations

### Why this approach is preferable

- **A child-route under `ClassesPage` is the simplest viable model** for v1. The shell's `AppNavigationKey` enum and `getBreadcrumbItems` function stay unchanged. The trade-offs (no deep linking, no browser back/forward for the class detail, refresh from the class detail drops the user back to the class list) are explicit v1 limitations and are recorded as v1.1+ non-goals.
- **The adapter / model split keeps the trust boundary and the view-model transformation separate.** The adapter is the only module that knows how to roll up per-task `MetricResult` values into per-assignment values, sort and limit the recent-assignments list, synthesise no-data rows for unassessed students, and apply the fail-fast semantics for null `updatedAt`. The model is the only module that applies user-controlled filtering and sorting. The two concerns are independently testable.
- **A thin `ClassPage` composition root keeps the data and presentation layers below it independently testable.** The page root owns the modal state, the breadcrumb `Classes` link wiring, and the per-state content dispatcher (`ClassPageContent`). The data orchestrator (`useClassPageData`) is the sole data-fetching entry point; the adapter and model are called lower in the tree.
- **The "Viewing: ..." affordance is a static label, not a control.** A disabled `Select` would render an interactive dropdown with no selectable items, which is a UX dead-end. A static `Typography.Text` label is honest about the v1 limitation and is cheap to upgrade to a real `Select` in v1.1.

### Naming recommendation

- `selectedClassId: string | null` is the page-local state that lives in `ClassesPage`. The class detail view receives `classId` as a prop and the clear-and-navigate callback (`onNavigateToClasses`) as a prop.
- `ClassPageData` is the typed return value of `useClassPageData`. The shape is documented in the hook contract below.
- `ClassPageAdapterResult` is the typed return value of `classPageAdapter.adaptClassPageToViewModel(...)`. The shape is documented in the adapter contract below.
- `ClassPageViewModel` is the typed return value of `classPageModel.buildClassPageViewModel(...)`. The shape is documented in the model contract below.

## Feature architecture

### Placement

- **Page composition root:** `src/frontend/src/features/classPage/ClassPage.tsx`. The class detail view is a child of `ClassesPage`, not a top-level page, so the canonical `pages/` is reserved for top-level pages and the class detail view lives under `features/classPage/`. `pages/ClassesPage.tsx` renders `<ClassPage classId={...} />` inline when its `selectedClassId` is set.
- **Feature root:** `src/frontend/src/features/classPage/`. Contains the page composition root, the data hook, the adapter, the model, the table card, the recent-assignments section and card, the header actions, and the column definitions. No `index.ts` barrel.
- **Shared display helpers:** `src/frontend/src/services/dataAnalysis/metricDisplay/`. Owned by the prep spec; imported directly into the Class page components.
- **Format helper:** `src/frontend/src/utils/dateFormatting.ts`. Owned by the prep spec; imported directly into the adapter.

### Proposed high-level tree

```text
pages/ClassesPage.tsx
└── (when selectedClassId is set)
    └── features/classPage/ClassPage.tsx (composition root)
        ├── features/classPage/useClassPageData.ts (data orchestrator)
        ├── features/classPage/ClassPageContent.tsx (per-state dispatcher, co-located)
        │   ├── ClassPageLoading (shape-matched Skeleton)
        │   ├── ClassPageBlocking (per-error-type Ant Design Result)
        │   └── ClassPageReady (full content tree)
        │       ├── features/classPage/ClassPageHeaderActions.tsx
        │       ├── features/classPage/RecentAssignmentsSection.tsx
        │       │   └── features/classPage/RecentAssignmentCard.tsx
        │       │       └── services/dataAnalysis/metricDisplay/MetricPill.tsx
        │       └── features/classPage/StudentAveragesTableCard.tsx
        │           ├── features/classPage/studentAveragesTableColumns.tsx
        │           │   └── services/dataAnalysis/metricDisplay/MetricPill.tsx
        │           └── features/classPage/classPageModel.ts (view-model builder)
        ├── services/dataAnalysis/analysers/rollupMetric.ts (shared; defined in prep spec)
        └── features/classes/AssessTaskModal/AssessTaskModal.tsx (reused, unchanged)
```

### Files created or modified by the Class page deliverable

- **`src/frontend/src/pages/ClassesPage.tsx`** — add `selectedClassId` page-local state; branch the render to show the class detail view when a class is selected; enable the `View` button on each class card (remove `disabled` and `tabIndex={-1}`; add `onClick` that calls `setSelectedClassId(card.classId)`).
- **`src/frontend/src/features/classPage/ClassPage.tsx`** (new) — the page composition root. Thin: calls the hook, owns the modal state, dispatches per-state content, renders the breadcrumb `Classes` link and the modal at the page level.
- **`src/frontend/src/features/classPage/ClassPageContent.tsx`** (new, co-located) — the per-state dispatcher that delegates to `ClassPageLoading`, `ClassPageBlocking`, and `ClassPageReady`. The extraction is for complexity reasons, not file-size reasons: the page root needs to stay a thin composition root that owns only the modal state, the breadcrumb `Classes` link wiring, and the callback plumbing. The per-state branching (loading / blocking / ready) has 6 blocking-state variants and 1 ready variant; inlining this in the page root would push the file over the 250-line target and mix presentation concerns with composition concerns. `ClassPageContent` is a thin `switch (status)` dispatcher that returns the appropriate sub-component; the per-state sub-components are co-located in the same file (not split into separate files) because they are small and tightly coupled to the page-level error precedence. The action plan should record the extraction rationale so a future reviewer does not inline it back.

  The three co-located sub-components' contracts:
  - **`ClassPageLoading`** — renders a shape-matched `Skeleton` for the heading row, the Recent Assignments section (3 card-shaped skeletons), and the Student Averages table card (5 row-shaped skeletons). No props beyond the page heading strings.
  - **`ClassPageBlocking`** — renders a single Ant Design `Result` per `error.type` (per the error precedence table in the "Error, loading, and empty-state rules" section). Props: `{ error: ClassPageError, onRetry?: () => void, onNavigateToClasses: () => void }`. The retry button is rendered only for retryable error types; the back-to-classes button is always rendered.
  - **`ClassPageReady`** — renders the full content tree (heading row with `ClassPageHeaderActions`, `RecentAssignmentsSection`, `StudentAveragesTableCard`). Props: `{ classFull: ClassFull, adapterResult: ClassPageAdapterResult, onStartNewAssessment: () => void }`. The `AssessTaskModal` is rendered at the page root, not inside `ClassPageReady`, because the modal's open/close state spans the loading / blocking / ready states.

- **`src/frontend/src/features/classPage/useClassPageData.ts`** (new) — the data orchestrator hook. Wires together the per-class query, the warm-up-backed `assignmentDefinitionPartials` read, the analyser call, and the adapter call.
- **`src/frontend/src/features/classPage/classPageAdapter.ts`** (new) — pure adapter. Translates the analyser's `AveragingResult` plus the raw `ClassFull` into the canonical view-model shape. Owns the assignment-level rollup rule (via the shared `rollupMetric` helper), the recent-assignments top-3 sort and limit, the no-data row synthesis, the date formatting, the fail-fast semantics for null `updatedAt`, and the trust validation.
- **`src/frontend/src/features/classPage/classPageAdapter.zod.ts`** (new, co-located) — the Zod schema for the adapter's output. Mandatory: the adapter is a trust boundary between the analyser and the UI, and per `src/frontend/AGENTS.md` §9, Zod-first validation is mandatory for trust boundaries.
- **`src/frontend/src/features/classPage/classPageModel.ts`** (new) — pure view-model builder. Applies the search filter and sort to the adapter's output. The model's `viewing` field has been removed from v1 (the v1 control is a static `Typography.Text` label, not a `Select`).
- **`src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`** (new) — presentational container. Renders the heading, the row of cards, and the empty state. Owns no state; the page composition root owns the `onStartNewAssessment` callback.
- **`src/frontend/src/features/classPage/RecentAssignmentCard.tsx`** (new) — one card. Receives a fully-built `RecentAssignmentCardModel` and renders the title, last-assessed line, and four `MetricPill` instances. Pure presentational, no data fetching, no click handler, no hoverable.
- **`src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`** (new) — the `Card` wrapping the control row (an `Input.Search` on the left and a static `Typography.Text` label on the right) and the `Table`. Owns the user-controlled state (`searchTerm`, `sort`, `filters`) and calls the model to derive the final view-model.
- **`src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`** (new) — column definitions for the table. One source of truth for column keys, headers, sort comparator wiring, column-level filter wiring, and the `MetricPill` cell rendering.
- **`src/frontend/src/features/classPage/ClassPageHeaderActions.tsx`** (new) — the two top-right buttons (`Edit Student Details` disabled, `Start New Assessment` enabled). Owns the `Tooltip` wrapper on the disabled button. Pure presentational.
- **`src/frontend/src/pages/pageContent.ts`** — add a `classDetail` entry (heading + summary strings) for the page's static section heading. The page heading is composed of the static `pageContent.classDetail.heading` (e.g. `Class Overview`) and the dynamic `classFull.className` (e.g. `7A1 Digital Technology 2025-2026`); the breadcrumb's third segment uses the dynamic `className` only, not the static heading. Concrete example shape (the action plan's layout / copy pass will finalise the wording with product):
  ```ts
  classDetail: {
    heading: 'Class Overview',
    summary: 'Review assessment performance for this class.',
  }
  ```
  The `className` passed to the `AssessTaskModal` is `classFull.className ?? 'Unnamed class'` (or similar fallback) since the schema allows `className` to be null.

### Out of scope for this surface

- The data analysis service change. That lives in the prep spec.
- The `AssignmentPartial` rename. That lives in the prep spec.
- The shared display helpers (`metricTone`, `MetricPill`). They live in the prep spec; the Class page imports them.
- The `formatUpdatedAtLabel` helper. It lives in the prep spec; the Class page adapter imports it.
- URL-based routing, deep linking, browser back/forward, and refresh-from-class. Recorded as v1.1+ non-goals.
- Drill-down from a Recent Assignment card to a per-assignment detail view, and drill-down from a student row to a per-student detail view. Recorded as v1.1+ non-goals.
- A real `Select` for the "Viewing: ..." affordance, alternative views (`By Topic`, `By Student`, `By Criterion`), and a `Tooltip` / `aria-label` wrapper on `MetricPill` for accessibility. All v1.1+ non-goals.
- A refresh control or invalidation after `Start New Assessment` completes. Recorded as a v1.1+ non-goal.

## Data loading and orchestration

### Required datasets or dependencies

- `getABClass({ classId })` — the per-class query. Not warm-up-backed; view-entry fetch per decision 2.
- `assignmentDefinitionPartials` — the cross-reference table of assignment definitions. Warm-up-backed; consumed internally by the hook for surface-state computation.

### Prefetch or initialisation policy

- **Startup:** no change. The class page's inputs are not warm-up-backed.
- **Feature entry:** the per-class query is issued when the user opens the class page. The hook reads the warm-up-backed `assignmentDefinitionPartials` synchronously; if the dataset is not yet ready, the page renders the loading state.
- **Manual refresh:** no manual refresh control in v1. The `refetch` entry point on the hook is wired to the blocking state's retry button; it re-triggers both queries and re-runs the analyser / adapter pipeline.

### Query or transport additions

- None for the Class page deliverable. The class page uses the existing `getABClassQueryOptions(classId)` and the existing `usePageDataset('assignmentDefinitionPartials')` primitives.

## Core behavioural model

### `useClassPageData` — data orchestrator hook

**Purpose.** Wires together the per-class query (`getABClass({ classId })`), the warm-up-backed read of `assignmentDefinitionPartials`, the synchronous `DataAnalysisService.analyse(...)` call, and the `classPageAdapter.adaptClassPageToViewModel(...)` call. Produces a single typed `ClassPageData` result that includes the raw inputs, the derived analyser + adapter output, the structured error (if any), and the combined surface state per `frontend-loading-and-width-standards.md` §2-§5.

**Signature.** `function useClassPageData(classId: string): ClassPageData;`

**`ClassPageData` shape.**

```ts
type ClassPageData = Readonly<{
  // Raw per-class query
  classFull: ClassFull | null;
  classFullQuery: UseQueryResult<ClassFull | null, Error>;

  // Raw warm-up-backed dataset (consumed internally for surface state)
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null;

  // Derived analyser + adapter output
  analyserResult: AveragingResult | null;
  adapterResult: ClassPageAdapterResult | null;

  // The structured error (null if no error)
  error: ClassPageError | null;

  // The combined surface state
  surfaceState: ClassPageSurfaceState;

  // The retry entry point
  refetch: () => void;
}>;

type ClassPageSurfaceState =
  | { status: 'loading' }
  | { status: 'blocking'; error: ClassPageError }
  | { status: 'ready' };

type ClassPageError = Readonly<
  | { type: 'classNotFound' }
  | { type: 'classQueryError'; cause: Error }
  | { type: 'analyserError'; cause: Error }
  | { type: 'adapterError'; cause: Error }
  | { type: 'assignmentDefinitionPartialsFailed' }
  | { type: 'assignmentDefinitionPartialsUntrustworthy' }
>;
```

**Nullability contract.** `analyserResult` and `adapterResult` are non-null only when `surfaceState.status === 'ready'`. When the surface state is `loading` or `blocking`, both are `null` because the hook has not called (or has failed to call) the analyser / adapter pipeline. The page composition root must branch on `surfaceState.status` before reading `adapterResult.recentAssignments` or any other derived field. The discriminated union on `surfaceState` makes this type-safe at the call site.

The `assignmentDefinitionPartials` field is typed as `AssignmentDefinitionPartialsResponse | null` for symmetry with the other raw inputs, but the field is consumed only inside the hook (for surface-state computation); the page composition root does not read it directly.

**Combined `surfaceState` rules.**

| Condition                                                                                                                 | `surfaceState`                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Any input is in the loading state AND no blocking has occurred                                                            | `{ status: 'loading' }`         |
| Any input has failed (query error, class not found, dataset failed, dataset untrustworthy, analyser error, adapter error) | `{ status: 'blocking'; error }` |
| All inputs are ready AND analyser and adapter have produced valid results                                                 | `{ status: 'ready' }`           |

The `blocking` case takes precedence over `loading` (an error during loading surfaces immediately, not after the loading state resolves).

**Error precedence (top to bottom, first applicable wins).**

1. `classNotFound` (per-class query returned `null`)
2. `classQueryError` (per-class query errored)
3. `assignmentDefinitionPartialsFailed` (warm-up dataset failed)
4. `assignmentDefinitionPartialsUntrustworthy` (warm-up dataset untrustworthy but marked ready)
5. `adapterError` (adapter threw — typically a `classFull` structural defect)
6. `analyserError` (analyser threw — typically a computation error)

`adapterError` precedes `analyserError` because the adapter validates `classFull` structure (the more fundamental data contract) while the analyser runs on the validated input. In practice, `analyserError` and `adapterError` are mutually exclusive (the adapter is only called after the analyser succeeds), but the order reflects causal fundamentality.

**Behaviour.**

- Pure hook. No I/O beyond the React Query calls and the synchronous analyser / adapter calls. No `useEffect` (other than what React Query uses internally).
- Memoised analyser call. Keyed on `[classFull, assignmentDefinitionPartials]`. The analyser is not called when either input is `null`.
- Memoised adapter call. Keyed on `[analyserResult, classFull]`. The adapter is not called when `analyserResult` is `null`.
- `refetch` is the retry entry point. The hook captures `classId` at call time so the callback always uses the freshest `classId` (avoids stale-closure bugs that would cause the retry button to refetch a class the user is no longer viewing). The recommended pattern for v1 is a `useRef<string>` updated in a `useEffect` keyed on `[classId]`; the `refetch` callback reads from the ref at call time. An equivalent `useCallback` with `[classId]` in the dependency array is also acceptable, but the `useRef` pattern avoids recreating the callback on every `classId` change. React Query's query-key scoping handles cancellation on `classId` change.
- For non-retryable errors (`classNotFound`, `adapterError`), the page renders the breadcrumb's `Classes` link instead of a retry button.

### `classPageAdapter` — pure adapter

**Purpose.** Translates the raw data analysis service output (`AveragingResult`) plus the raw class document (`ClassFull`) into the canonical view-model shape consumed by the Class page UI sections. It is the only module that knows how to roll up per-task `MetricResult` values into per-assignment values, sort and limit the recent-assignments list, synthesise no-data rows for unassessed students, pre-format the "Last Assessed" date label, and apply the fail-fast semantics for null `updatedAt`.

**Signature.**

```ts
adaptClassPageToViewModel(input: {
  analyserResult: AveragingResult;
  classFull: ClassFull;
}): ClassPageAdapterResult;
```

**`ClassPageAdapterResult` shape.**

```ts
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

**Adapter responsibilities.**

- **Recent assignments rollup.** For each `AssignmentPartial` in `classFull.assignments`, find the matching `perTask` rows in `analyserResult.perTask` (by `definitionKey`), roll the per-task `MetricResult` values into a per-assignment value for each of the **three criteria** (`completeness`, `accuracy`, `spag`) using the shared `rollupMetric` helper, and build a `RecentAssignmentCardModel` with the three rolled-up criteria plus the per-assignment `average` (computed as a composite — see "Per-assignment `average` composite" below). If `assignment.updatedAt === null`, throw with a structured `Error`. The error message references the `assignmentId` for diagnostics. After building all models, sort by `updatedAt` desc, take the top 3. If fewer than 3 assignments exist, return whatever is available.
- **Assignment-level rollup rule (three criteria).** The rule for the three criteria (`completeness`, `accuracy`, `spag`) is implemented once as the shared `rollupMetric` helper at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` and called by both the analyser's row builders and the adapter. The adapter does **not** re-implement the rule for the three criteria. The per-metric `notAttempted` handling (0 for accuracy / completeness; excluded for SPAG) is documented in the prep spec.
- **Per-assignment `average` composite.** The per-assignment `average` is **not** computed by `rollupMetric` (the helper's `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only — the average is a composite, not a direct rollup). The adapter computes the per-assignment `average` as a composite of the three rolled-up criterion metrics, using the same 40/40/20 weighting as the analyser's per-task "overall" (with the SPaG-renormalisation rule when SPaG is `notAttempted`). The composite logic is the same at every aggregation level (per-task via the analyser's per-task logic, per-student / per-class via the analyser's row builders, per-assignment via the Class page adapter); it is implemented at the consumer level, not in the shared helper. The composite rule: (a) if any of the three criteria is `error`, the per-assignment `average` is `error`; (b) if all three are `notAttempted` and none is `computed`, the per-assignment `average` is `notAttempted`; (c) otherwise, compute the weighted average over the `computed` criteria, excluding `notAttempted` criteria, using 0.4 completeness + 0.4 accuracy + 0.2 spag (renormalised to completeness + accuracy over 0.8 when SPaG is `notAttempted`).
- **Student averages — full roster, with no-data rows.** The adapter builds a lookup map `studentId → PerStudentRow` from `analyserResult.perStudent`. For each student in `classFull.students`, use the analyser's `PerStudentRow` if present, otherwise synthesise a no-data row with all four `MetricResult` fields (the three criteria `completeness`, `accuracy`, `spag` plus the composite `average`) as `notAttempted`. Sort by `studentName` ascending (case-insensitive, locale-aware, with `studentId` as the deterministic tie-breaker). The `notAttempted` state already supports the no-data case, so no new discriminator is needed.
- **Class metrics passthrough.** `classMetrics` is the analyser's `perClass` field passed through unchanged. Each metric is a `MetricResult`.
- **Date formatting.** Calls the shared `formatUpdatedAtLabel` helper (extracted from `AssignmentsPage.tsx` to `src/frontend/src/utils/dateFormatting.ts` per the prep spec) and stores the result in `lastAssessedAtLabel`. The raw `lastAssessedAt` ISO string is also retained in the model for future use (e.g. drill-down or sort). The `—` fallback in `formatUpdatedAtLabel` is **not** used for the class page; a null or unparseable `updatedAt` is a data bug and the adapter throws. The data integrity bar for the "Last Assessed" line is higher than for a generic table cell.
- **Trust validation.** Validates two invariants the transport schema cannot express: uniqueness of `studentId` within `classFull.students`, and uniqueness of `assignmentId` within `classFull.assignments`. A class with non-empty `students` but empty `assignments` is **not** a data-integrity issue and does not throw (the empty state for `RecentAssignmentsSection` handles this case). A null `ClassFull.active` is also not a trust violation (the schema marks it `z.boolean().nullable()`); the adapter does not throw on a null `active` and the page does not interpret it. The adapter does not validate the `MetricResult` discriminated union; that is the analyser's responsibility. The adapter's trust validation is the source of the `error.type === 'adapterError'` blocking state in `useClassPageData`.

**Behaviour.**

- Pure function. No I/O, no React imports, no React Query, no Ant Design imports. The only side effect is throwing on data integrity violations.
- Synchronous. No `await` calls, no `Promise` returns.
- Fail loudly. Throws on data integrity violations (null `updatedAt`, structurally invalid `classFull`, unparseable `updatedAt`, duplicate `studentId` or `assignmentId`). The hook catches the throw and surfaces it as a blocking state.
- No locale configuration. The `en-GB` locale is hardcoded for v1. Future i18n work would extract this to a shared locale constant.

### `classPageModel` — view-model builder

**Purpose.** Applies user-controlled filtering and sorting to the adapter's canonical output. The model is a pure function that takes the adapter's result plus the current search and sort state, and produces the final view-model shape consumed by the Student Averages table.

**Signature.**

```ts
buildClassPageViewModel(input: {
  adapterResult: ClassPageAdapterResult;
  filters: {
    searchTerm: string; // '' means no filter
  };
  sort: {
    column: 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average';
    direction: 'asc' | 'desc';
  };
}): ClassPageViewModel;
```

**`ClassPageViewModel` shape.**

```ts
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

**Model responsibilities.**

- **Search filter.** Apply a case-insensitive substring match on `studentName`. Empty `searchTerm` → no filter. Non-empty `searchTerm` → only students whose `studentName.toLowerCase()` contains `searchTerm.toLowerCase()` are included. The filter is applied **before** the sort.
- **Sort.** Sort `studentAverages` by the given `column` and `direction`. The comparator for `studentName` is locale-aware, case-insensitive, with `studentId` as the deterministic tie-breaker. The comparator for each metric column is state-aware: state bands are fixed ranks that flip with `direction`; within the `computed` band, numeric values sort by `direction`. The exact rule:
  - For `direction: 'asc'`: rank order is `computed` (sorted by numeric value ascending) → `notAttempted` → `error` (always last).
  - For `direction: 'desc'`: rank order is `error` (always first) → `notAttempted` → `computed` (sorted by numeric value descending).
  - Cells with the same state and the same numeric value (or the same student name) are tie-broken by `studentId` ascending.
- **Default sort.** `studentName` ascending (the adapter's canonical order). If the consumer does not supply a `sort` field, the model uses the default.
- **Pass-through.** `recentAssignments` and `classMetrics` are taken from the adapter's output verbatim. The model does not transform these fields.

**Behaviour.**

- Pure function. No I/O, no React imports, no Ant Design imports.
- Synchronous. No `await` calls, no `Promise` returns.
- No data validation. The model trusts the adapter's output.

## Main user-facing surface

### Visible content (per the supplied mockup `CLASSES_PAGE_MOCKUP.png`)

1. **Breadcrumb** with three segments: `AssessmentBot Frontend / Classes / {className}`. The `Classes` segment is rendered by the class detail view itself (not by the shell's `getBreadcrumbItems`); the `Classes` segment is clickable, clearing `selectedClassId` and keeping the nav key on `classes`. The third segment (`{className}`) is non-clickable.
2. **Page heading** showing the class name (e.g. `7A1 Digital Technology 2025-2026`).
3. **Page summary** (single sentence; copy TBD in follow-up).
4. **Top-right header actions**, right-aligned:
   - `Edit Student Details` button — disabled for v1, with a tooltip `Coming soon` to explain the placeholder.
   - `Start New Assessment` button — opens `AssessTaskModal` for the current class.
5. **Recent Assignments section** — up to three cards, horizontally arranged, centre-aligned:
   - Each card title region: assignment name (rendered as the Ant Design `Card` `title` prop), then `Last Assessed: {date}` line. The literal "Recent Assignments" label is the section heading above the row, not on every card. The "Last Assessed" line never renders a `—` placeholder; a missing `updatedAt` is a data bug that the adapter surfaces as a blocking state.
   - Each card body: four metric cells in a row — `Completeness`, `Accuracy`, `SpAG`, `Average` — each rendered as a `MetricPill` (defined in the prep spec). For a `computed` cell, the pill shows the numeric value with the RAG colour; for a `notAttempted` cell, the pill shows `N` in grey; for an `error` cell, the pill shows `E` in the error colour. The `Average` cell is visually emphasised (larger / bolder) to match the mockup.
   - When fewer than three assignments exist, render only the available cards; the row remains centre-aligned.
   - When zero assignments exist, render an Ant Design `Empty` in place of the card row, with a description like `No recent assessments yet` and a primary `Start New Assessment` button below the message. The button opens the existing `AssessTaskModal` for the current class — the same handler as the header button. The sub-section heading `Recent Assignments` still renders above the empty state. The empty state is a positive nudge for new classes that have not been assessed yet.
6. **Student Averages section** — full-width `Card`:
   - View-control row: `Input.Search` on the left (placeholder "Search by name"), and a static `Typography.Text type="secondary"` label "Viewing: Overall Class Averages" on the right (decision 9). No `Select` in v1.
   - Ant Design `Table` with columns: `Student Name`, `Completeness`, `Accuracy`, `SpAG`, `Average`. Each numeric cell is a `MetricPill` matching the card pill style. The `Average` column uses `emphasised={true}` on the pill. The `Average` cell and column sort and filter by the `average` `MetricResult` field.
   - The `Table` is rendered with `pagination={false}` (the class page is expected to host small classes, typically < 30 students; pagination is a future iteration if a class size exceeds a threshold) and `size="small"` (consistent with the rest of the page).

**Note on `classMetrics`.** The `ClassPageAdapterResult` and `ClassPageViewModel` shapes both include a `classMetrics: { completeness, accuracy, spag, overall: MetricResult }` field (per the analyser's `perClass` output, passed through the adapter and model). **The `classMetrics` field is not rendered in the v1 visible content** (per the supplied mockup `CLASSES_PAGE_MOCKUP.png`, which does not show a "Class metrics" summary card). The field is computed by the adapter for future use (a v1.1+ "Class metrics summary" card, drill-down, or export feature) and is part of the view-model contract so the future work has a stable hook. The page composition root does not read `classMetrics` in v1.

### Component responsibilities

#### `RecentAssignmentCard`

- Renders one card. Receives a fully-built `RecentAssignmentCardModel`.
- Renders the title (assignment name), the "Last Assessed: {date}" line (`Typography.Text type="secondary"`), and four `MetricPill` instances (one per criterion: `Completeness`, `Accuracy`, `SpAG`, `Average`).
- The first three cells are uniform: vertical `Flex` with the label on top and the pill on the bottom, left-aligned.
- The `Average` cell is visually emphasised: vertical `Flex` with the label on top and the pill on the bottom, centre-aligned, with `MetricPill` set to `emphasised={true}`.
- The card is fully static with no hover or click handler for v1.
- The card width is a feature-local constant: `RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320` (vs `CLASSES_CARD_WIDTH_PX = 268` for the existing class cards on `ClassesPage`). The wider width is required to fit four metric cells (Completeness, Accuracy, SpAG, Average) side-by-side without wrapping the Average cell's emphasised content. Per `docs/developer/frontend/frontend-loading-and-width-standards.md` §7, a new shared width token is only justified when a second consumer needs the same width. The class page's `RecentAssignmentCard` is the sole v1 consumer; promoting to a shared token is deferred until a second consumer emerges. The width constant lives in `RecentAssignmentCard.tsx` with a comment explaining the rationale.

```ts
const RecentAssignmentCardModelSchema = z.strictObject({
  assignmentId: z.string().min(1), // unique instance id; React key
  assignmentName: z.string(), // shown in the card title
  lastAssessedAt: z.string(), // ISO 8601 string, derived from AssignmentPartial.updatedAt
  // (renamed from lastUpdated per the prep spec).
  // Non-nullable: a null updatedAt is a data bug
  // and the adapter throws before the model is built.
  lastAssessedAtLabel: z.string(), // pre-formatted display label (en-GB locale, e.g. '2025-11-05')
  metrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    average: RecentAssignmentCardMetricSchema,
  }),
});

const StudentAverageRowModelSchema = z.strictObject({
  studentId: z.string().min(1), // unique per class; row key in the table
  studentName: z.string(), // shown in the Student Name column
  metrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    average: RecentAssignmentCardMetricSchema,
  }),
});
```

`RecentAssignmentCardMetricSchema` (used inside both `RecentAssignmentCardModelSchema` and `StudentAverageRowModelSchema`) is the data analysis service's `MetricResult` discriminated union (defined in the prep spec) — `ComputedMetricSchema | NotAttemptedMetricSchema | ErrorMetricSchema`.

#### `RecentAssignmentsSection`

- Renders the section heading (`Recent Assignments`), the row of up to three cards, or the empty state.
- Owns no state. The page composition root owns the `onStartNewAssessment` callback.
- The empty state is an Ant Design `Empty` with a description (`No recent assessments yet`) and a primary `Start New Assessment` button below the message that calls the `onStartNewAssessment` callback. The button is rendered as a child of the `Empty` component (via the `Empty` children slot) rather than via a non-existent `button` prop. The visual treatment is: `Empty description="No recent assessments yet"` with a `<Button type="primary" icon={<PlusOutlined />}>Start New Assessment</Button>` as the children.
- The section's heading is rendered above both the row and the empty state (the empty state is positive-nudge copy, not a missing-data error).

#### `ClassPageHeaderActions`

- Renders the two top-right buttons in a horizontal `Space` (or `Flex`).
- `Edit Student Details`: `Button type="default" disabled icon={<EditOutlined />}`, wrapped in a `Tooltip title="Coming soon"` via a `span` wrapper, so the `Tooltip` triggers on hover despite the disabled `Button`. The `span`-wrapper pattern is the same as the existing `AssessTaskModal` "Link to Existing Definition" disabled button (per the established pattern in the codebase). Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly.
- `Start New Assessment`: `Button type="primary" icon={<PlusOutlined />}` (or similar; the exact icon is a layout-spec decision). Invokes the `onStartNewAssessment` callback on click.
- The component does not own the `AssessTaskModal` open / close state; the page composition root owns it.

#### `StudentAveragesTableCard`

- Renders the Student Averages `Card` (title `Student Averages`, size `small`).
- Owns the user-controlled state: `searchTerm: string` (initial `''`), `sort: { column, direction }` (initial `{ column: 'studentName', direction: 'ascend' }`), and `filters: StudentAveragesTableFilters` (initial: all columns: empty array, meaning "no filter").

  The `StudentAveragesTableFilters` type is:

  ```ts
  type StudentAveragesTableFilters = Readonly<{
    completeness: ReadonlyArray<MetricToneColor>;
    accuracy: ReadonlyArray<MetricToneColor>;
    spag: ReadonlyArray<MetricToneColor>;
    average: ReadonlyArray<MetricToneColor>;
  }>;
  ```

  Each column's filter array is a list of selected `MetricToneColor` values (imported from `metricTone` per the prep spec; the import path is `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone`). An empty array means "no filter for this column" (all rows pass). Ant Design v6's `filteredValue` expects an array, not a `Set`.

- Renders the control row: `Input.Search` on the left (`placeholder="Search by name"`, `onChange` updates `searchTerm`) and a static `Typography.Text type="secondary"` reading "Viewing: Overall Class Averages" on the right (no `Select` in v1).
- Calls `buildClassPageViewModel` inside a `useMemo` keyed on `[adapterResult, filters, sort, searchTerm]`. Calls `buildStudentAveragesTableColumns` inside a `useMemo` keyed on `[filters]`.
- Renders the `Table` with `dataSource` = the model's `studentAverages`, `columns` = the result of `buildStudentAveragesTableColumns`, `rowKey="studentId"`, `pagination={false}`, `size="small"`, and `locale.emptyText` = an Ant Design `Empty` placeholder with description "No students match your search". The `Empty` is shown only when `dataSource` is an empty array; the page-level loading and blocking states are handled by the composition root and replace the entire card.
- Maps the `Table.onChange` `sorter` event to the model's `sort` state. The `Table` exposes `sorter.columnKey` and `sorter.order`; the component maps Ant Design's `'ascend'` / `'descend'` to the model's `'asc'` / `'desc'` direction vocabulary and resets to the canonical default (`studentName` ascending) if the user clears the sort. **Clear-sort handling:** when the user clears the sort by clicking the sorted column header a third time, Ant Design v6 passes `sorter === false` (not an object). The component must detect this case and reset to the default sort. The state mapping also handles the case where `sorter` is an object without a `columnKey` or `order` (treated as a clear-sort event).
- **No search debounce in v1.** The model is a pure synchronous function over an in-memory list (class sizes are typically < 30 students), so the cost of filtering on every keystroke is negligible. Debouncing is a v1.1+ consideration if class sizes grow.

#### `studentAveragesTableColumns`

- Pure function that returns the column definitions for the Student Averages `Table`.
- Five columns: `studentName`, `completeness`, `accuracy`, `spag`, `average` (this fixed order is the column order in the table).
- The `studentName` column: `sorter` is locale-aware, case-insensitive, with `studentId` as the deterministic tie-breaker. No `filters` / `filteredValue` / `onFilter`. `render` is plain `Typography.Text`.
- The four metric columns: `sorter` is the state-aware comparator (delegated to the model). `filters` is the band filter array per the Ant Design `ColumnFilterItem[]` shape with the following fixed entries (in this order):
  - `{ text: 'Red (low)', value: 'red' }`
  - `{ text: 'Amber (mid)', value: 'gold' }`
  - `{ text: 'Green (high)', value: 'green' }`
  - `{ text: 'Not Attempted', value: 'default' }`
  - `{ text: 'Error', value: 'volcano' }`

  The `value` is always a `MetricToneColor` token, not a `MetricResult.state` name. The `text` is the user-facing label in the filter dropdown.
  `onFilter` is `(value: string, record: StudentAverageRowModel) => boolean`, computing the cell's band via `resolveMetricTone(record.metrics[columnKey], { lower: 0, upper: 5 }).color` and comparing the result to `value` (strict equality on the `MetricToneColor` string). The range `{ lower: 0, upper: 5 }` is the `metricTone` default range (per the prep spec) and matches the range used for rendering the `MetricPill` cells, so filter and visual colour cannot diverge. `render` is a `MetricPill` (defined in the prep spec). The `Average` column uses `emphasised={true}` on the `MetricPill`.

- The band set is the `MetricToneColor` token set (`'red' | 'gold' | 'green' | 'default' | 'volcano'`, a local type alias defined in the prep spec's `metricTone` module at `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`), not the `MetricResult.state` name set. The `onFilter` predicate compares the value against `resolveMetricTone(record.metrics[columnKey], { lower: 0, upper: 5 }).color`. A mismatched band set (e.g. using `'computed'` as a filter value) would silently break the filter (no value would ever match the predicate).
- The columns function is pure. It does not call `useState`, `useEffect`, or any other React hook. It is called at render time by `StudentAveragesTableCard` and the result is passed to the `Table`.

## Workflow specification

### Open the Class page from a class card

- The user clicks the `View` button on a class card in `ClassesPage`.
- `ClassesPage` sets `selectedClassId` to the card's `classId` and renders the class detail view (`<ClassPage classId={selectedClassId} onNavigateToClasses={...} />`).
- The class detail view calls `useClassPageData(classId)`. The hook issues the per-class query and reads the warm-up-backed `assignmentDefinitionPartials`. The page renders the loading state (a shape-matched skeleton) while the query is in flight.
- When the data is ready, the page renders the full content tree: heading row with header actions, Recent Assignments section, Student Averages table card, and the `AssessTaskModal` (closed) at the page level.

### Start a new assessment from the header

- The user clicks `Start New Assessment` in the page header.
- `ClassPageHeaderActions` invokes the `onStartNewAssessment` callback. The page composition root's callback sets `isAssessModalOpen` to `true`.
- The `AssessTaskModal` opens with the current `classId` and `className`. The user completes the assessment workflow. When the modal closes, `onCloseAssessModal` sets `isAssessModalOpen` to `false`.
- A refresh control / invalidation after `Start New Assessment` completes is recorded as a v1.1+ non-goal; the user must navigate away and back to see the new assessment's results in v1.

### Start a new assessment from the empty state

- When the class has zero recent assignments, the Recent Assignments section renders the empty state with a `Start New Assessment` button. The button is the same `onStartNewAssessment` callback as the header button (intentional redundancy so the action is discoverable for new classes).

### Return to the class list

- The user can return to the class list via either the sidebar's `Classes` entry or the breadcrumb's `Classes` segment. Both affordances clear `selectedClassId` (set to `null`) and keep the nav key on `classes`. The class detail view is unmounted and `ClassesPage` renders the class list again.

### Surface-state recovery

- For retryable errors (`classQueryError`, `analyserError`, `assignmentDefinitionPartialsFailed`, `assignmentDefinitionPartialsUntrustworthy`), the page renders an Ant Design `Result` with a retry button that calls the hook's `refetch`.
- For non-retryable errors (`classNotFound`, `adapterError`), the page renders an Ant Design `Result` with a back-to-classes button that invokes the breadcrumb's `Classes` link (clearing `selectedClassId`).

## Error, loading, and empty-state rules

### Blocking failure

The page uses Ant Design `Result` (not the default `Alert` from `frontend-loading-and-width-standards.md` §2.2) for full-page blocking states. The deviation is deliberate: a full-page blocking state is a different primitive than a subregion blocking alert. The class page's blocking state is a full-page owned surface.

Per `error.type`, the user-facing copy and affordances are:

| `error.type`                                | `Result` title                           | Primary action                                    |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| `classNotFound`                             | `Class not found`                        | `Back to Classes` (invokes `onNavigateToClasses`) |
| `classQueryError`                           | `Couldn't load class`                    | `Retry` (calls the hook's `refetch`)              |
| `analyserError`                             | `Couldn't compute averages`              | `Retry` (calls the hook's `refetch`)              |
| `adapterError`                              | `Class data is invalid`                  | `Back to Classes` (invokes `onNavigateToClasses`) |
| `assignmentDefinitionPartialsFailed`        | `Couldn't load assessment definitions`   | `Retry` (calls the hook's `refetch`)              |
| `assignmentDefinitionPartialsUntrustworthy` | `Assessment definitions are unavailable` | `Retry` (calls the hook's `refetch`)              |

The `Result`'s secondary action is `Back to Classes` (visible on every blocking state; the retry button is conditional on the error type).

### Partial-load or partial-success failure

The Class page does not have a partial-load state. The `getABClass` query and the `assignmentDefinitionPartials` warm-up dataset are the only data inputs. If either fails, the page is in a blocking state (above). A partial-load warning is not a v1 use case.

### Empty states

- **Recent Assignments section — no assignments in the class.** Ant Design `Empty` with description `No recent assessments yet` and a primary `Start New Assessment` button. The CTA opens the existing `AssessTaskModal` for the current class. The sub-section heading `Recent Assignments` still renders above the empty state.
- **Student Averages table — no students match the search.** Ant Design `Empty` with description `No students match your search`. No CTA (the page already has a `Start New Assessment` CTA in the header).

### Success and mutation feedback

- `Start New Assessment` opens the `AssessTaskModal`; the modal handles its own success / error feedback. The page does not render a separate `message` or `notification` for the assessment workflow.

## Accessibility and usability notes

- **The "Viewing: Overall Class Averages" label is a static `Typography.Text`, not a control.** Clicking it does nothing. The affordance is honest about the v1 limitation.
- **The disabled `Edit Student Details` button has a `Tooltip` wrapper.** Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly; the `Tooltip` wraps a `span` (or `div`) so it triggers on hover. The `Tooltip` copy is `Coming soon`.
- **The breadcrumb's `Classes` segment is clickable** in v1. Its `onClick` is a closure that invokes `ClassesPage`'s `setSelectedClassId(null)`. The class detail view owns both the rendering of the third segment (`{className}`, non-clickable) and the `Classes` link's click handler.
- **Pill accessibility gap (v1.1+ follow-up).** Color-coded pills with no text alternative fail WCAG 1.1.1 (Non-text Content) and 1.4.1 (Use of Color) for screen-reader and color-blind users. In v1, a teacher's eye recognises the state from the colour + the single-character label (`2.18`, `N`, `E`), but a screen reader announces only the label — it cannot distinguish `notAttempted` (`N` in grey) from `error` (`E` in volcano) from a low `computed` value without the colour context. v1.1 will add a `Tooltip` wrapper with screen-reader-friendly copy (e.g. `aria-label="Completeness: Not Attempted"`). This is a deliberate v1 trade-off, not a deferred nice-to-have; the product has signed off on the gap.
- **Loading state is announced.** The shape-matched `Skeleton` is rendered with `role="status"` and `aria-live="polite"` per `frontend-loading-and-width-standards.md`. The page composition root owns the accessible wrapper; the page's loading sub-component renders the primitives.
- **Focus management.** When the class page opens, focus stays on the trigger (the `View` button on the class card). When the modal opens, focus moves to the modal; when the modal closes, focus returns to the trigger that opened it. This is the standard Ant Design `Modal` behaviour; no custom focus management is added.

## Shell and routing integration

### Files changed

- `src/frontend/src/pages/ClassesPage.tsx` — add `selectedClassId` page-local state, branch the render to show the class detail view when a class is selected, enable the `View` button on each class card.
- `src/frontend/src/AppShell.tsx` — **no change for v1**. The shell continues to hold `selectedNavigationKey`; the `Classes` sidebar entry is highlighted as before. The shell is unaware of `selectedClassId`; the sidebar highlight works because the nav key stays `'classes'` when a class is selected.
- `src/frontend/src/navigation/appNavigation.tsx` — **no change in v1**. The `AppNavigationKey` enum stays `dashboard | classes | assignments | settings`. The `getBreadcrumbItems` function stays a 2-segment function of the nav key. The `renderNavigationPage` switch is unchanged.

### `ClassesPage.tsx` changes

- **`selectedClassId` state.** Add a `selectedClassId: string | null` state alongside any existing `ClassesPage` state. The state is the source of truth for which class is currently being viewed.
- **State lifecycle.**
  - `selectedClassId` is set to the class's ID when the user clicks a `View` button on a class card.
  - `selectedClassId` is reset to `null` when the user invokes either back affordance (sidebar `Classes` entry, breadcrumb `Classes` link).
  - The state is only valid when the active nav key is `classes`. If the user navigates to a different nav key (`dashboard`, `assignments`, `settings`), the state is reset on remount.
- **Render branching.**
  - `selectedClassId === null` → render the existing `ClassesPage` content (the list of class cards).
  - `selectedClassId !== null` → render `<ClassPage classId={selectedClassId} onNavigateToClasses={() => setSelectedClassId(null)} />` instead.
- **Enable the `View` button.** On each class card, the `View` button changes from disabled to enabled:
  - Remove the `disabled` and `tabIndex={-1}` attributes from the `Button`.
  - The button's `type` is already `"text"` in the current code (no change needed; only the disabled state changes).
  - Add an `onClick` handler that calls `setSelectedClassId(card.classId)`.
  - The View button's visual style is unchanged (text-only, no icon, no underline). The `cursor: pointer` on hover (default Ant Design behaviour for non-disabled buttons) is the navigation affordance.

### v1 trade-offs accepted

- **No deep linking.** `?classId=...` does not work in v1.
- **No browser back/forward support for the class detail.** The browser back button returns to the previous page (e.g. the dashboard), not to the class list.
- **Refresh from the class detail drops the user back to the class list.** A page refresh resets `selectedClassId` to `null`.

These are deliberate v1 limitations, not undecided questions. They are recorded as v1.1+ non-goals in the "V1 scope recommendation" section below.

## Backend changes required

None. The Class page itself requires no backend changes. The data analysis service change and the rename are frontend-only or covered by the prep spec.

## Planning handoff notes

- **Sequencing constraint.** The Class page is the dependent deliverable. The full ordering is: (1) prep spec deliverable (rename + data analysis service + shared display helpers), (2) Class page deliverable. The Class page cannot ship a working surface without the new `MetricResult` discriminated union in place.
- **The action plan must respect the three-deliverable ordering** documented in the prep spec: rename → data analysis service → shared display helpers → Class page.
- **The new `rollupMetric` helper (at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`) is owned by the prep spec and consumed by the Class page adapter.** The Class page does not re-implement the rollup rule for the three criteria. The action plan's Class page section must reference the helper (by module path) and exercise it via the adapter tests, not duplicate the helper. The helper's signature is `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` (operating on the public `MetricResult` discriminated union, not on internal `MetricAccumulator` values) — the prep spec's signature is authoritative, and the action plan must update the shared-helpers doc (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4) if its recorded signature diverges. The per-assignment `average` is **not** computed by `rollupMetric`; the adapter computes it as a composite of the three rolled-up criterion metrics, using the same 40/40/20 weighting (with the SPaG-renormalisation rule) as the analyser's per-task "overall".
- **The `formatUpdatedAtLabel` helper is owned by the prep spec and consumed by the Class page adapter.** The action plan's Class page section must reference the helper (by module path) and exercise it via the adapter tests, not duplicate the helper.
- **The shared display helpers (`metricTone`, `MetricPill`) are owned by the prep spec and consumed by the Class page components.** The action plan's Class page section must reference the helpers (by module path) and exercise them via the card and table component tests, not duplicate the helpers.
- **`MetricToneColor` is a cross-spec contract.** The local type alias `'red' | 'gold' | 'green' | 'default' | 'volcano'` is exported from `metricTone.ts` (prep spec) and consumed by `studentAveragesTableColumns` (Class page spec) as the column filter `value` set. The two specs must agree on the union. The prep spec is authoritative for the union; a future revision is a cross-spec breaking change.
- **The action plan must include a section for the shell / routing integration.** The changes touch `src/frontend/src/pages/ClassesPage.tsx`. The `AppShell` and `appNavigation.tsx` are not modified in v1.
- **The action plan must record the projected post-change file sizes for the Class page files** and the facade-decomposition decision (the projected sizes are all well under the 500-line threshold for frontend modules per `src/frontend/AGENTS.md` §13, so no file separation is required for v1).
- **The `useClassPageData` hook is a "thick hook" by design.** The projected post-change size is ~300–350 lines. The complexity is intentional: the hook combines the per-class query, the warm-up-backed dataset state, the analyser call, the adapter call, the surface state computation as a discriminated union, the 6-error-type precedence, and the `refetch` entry point. The action plan must record the size and the rationale.

## Testing expectations

- **`classPageAdapter.spec.ts` (new, co-located)** — covers the adapter's contract: assignment-level rollup (via the shared `rollupMetric` helper), recent-assignments top-3 sort and limit, no-data row synthesis for unassessed students, date formatting, fail-fast semantics for null `updatedAt`, and trust validation (uniqueness of `studentId` and `assignmentId`).
- **`classPageAdapter.zod.spec.ts` (new, co-located)** — covers the adapter's output Zod schema: `RecentAssignmentCardModel`, `StudentAverageRowModel`, and `classMetrics` round-trip; invalid `MetricResult` shapes are rejected.
- **`classPageModel.spec.ts` (new, co-located)** — covers the model's contract: search filter (case-insensitive substring on `studentName`), sort comparators (state-aware, direction-flipping, `studentId` tie-breaker), pass-through of `recentAssignments` and `classMetrics`.
- **`studentAveragesTableColumns.spec.tsx` (new, co-located)** — covers the columns function: column keys, headers, sort comparator wiring, column-level filter wiring, and the `MetricPill` cell rendering. The band filter predicate is tested for all five `MetricToneColor` values.
- **`RecentAssignmentCard.spec.tsx` (new, co-located)** — covers the card: title region, "Last Assessed" line, four pills (with the `Average` cell using `emphasised={true}`), and rendering of each `MetricResult` state.
- **`StudentAveragesTableCard.spec.tsx` (new, co-located)** — covers the table card: control row (search input + static label), `Table` rendering, sort state mapping from the `Table.onChange` event, and the empty state.
- **`RecentAssignmentsSection.spec.tsx` (new, co-located)** — covers the section: heading, row of cards, empty state with the `Start New Assessment` CTA.
- **`ClassPageHeaderActions.spec.tsx` (new, co-located)** — covers the header actions: the disabled `Edit Student Details` button with its `Tooltip` wrapper, the `Start New Assessment` button invoking the callback.
- **`useClassPageData.spec.ts` (new, co-located)** — covers the hook: the surface state discriminated union, the 6-error-type precedence, the memoised analyser / adapter orchestration, the `refetch` entry point with `classId` capture, and the error-to-blocking-state mapping.
- **`ClassPage.spec.tsx` (new, co-located)** — covers the page composition root: heading, header actions, modal state, the page-level skeleton / blocking / ready states, the breadcrumb `Classes` link wiring, and the `AssessTaskModal` integration.
- **Regression — `ClassesPage.spec.tsx`** — enable the `View` button assertion and add a click-to-navigate assertion. The shell integration is tested via the page test and the existing shell tests; no new shell test files are introduced.
- **`MetricPill` is exercised via the shared helper spec in the prep spec**, not duplicated here. The card and table component tests assert that the card / table renders a `MetricPill` with the right props; the helper's behaviour is tested in the prep spec.
- **The shared `rollupMetric` helper is exercised via the analyser tests (in the prep spec) and the adapter tests (here).** The adapter's `rollupMetric` usage is a thin pass-through; the helper's behaviour is tested in the prep spec.

## Documentation and rollout notes

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** — record the planned `classPageAdapter`, `classPageModel`, `useClassPageData`, `RecentAssignmentsSection`, `StudentAveragesTableCard`, `studentAveragesTableColumns`, `ClassPageHeaderActions`, `ClassPage.tsx`, and the v1 routing model (child route under `ClassesPage`, no `class-detail` nav key in v1) decisions in §9 as **deferred / not yet implemented** entries (reconciled against the actual implementation during the documentation pass).
- **`docs/developer/frontend/frontend-loading-and-width-standards.md`** — record the new `class-detail` page's shape-matched skeleton structure (heading + 3-card row + table) in §3, and note that the page uses Ant Design `Result` (not the default `Alert`) for full-page blocking states. The `RecentAssignmentCard` width is a feature-local constant for v1 (`RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320`); no new shared width token is added in v1.
- **`docs/developer/frontend/frontend-react-query-and-prefetch.md`** — no change expected. The class page uses the existing per-class `abClass` query, which is already documented as view-entry (not warmup-backed).
- **`docs/pedagogy/data-analysis-scoring.md`** — document the new "Last Assessed" line on the Recent Assignments cards, including the fail-fast behaviour when `updatedAt` is missing.
- **`docs/architecture/`** — no change expected.

## V1 scope recommendation

### Include in v1

- The Class page composition root, header actions, Recent Assignments section and card, Student Averages table card, table columns, useClassPageData hook, classPageAdapter, classPageAdapter.zod schema, and classPageModel.
- The shell / routing integration in `ClassesPage.tsx` (added `selectedClassId` state, branched render, enabled `View` button).
- The disabled `Edit Student Details` button with the `Coming soon` tooltip.
- The `Start New Assessment` button (reuses the existing `AssessTaskModal`).
- The static `Typography.Text` "Viewing: Overall Class Averages" label.
- The shape-matched `Skeleton` for the loading state and the per-error-type Ant Design `Result` for the blocking state.
- The `Input.Search` for the Student Averages table (case-insensitive substring on `studentName`).
- The column-level band filters on the four metric columns.
- The `RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320` feature-local constant.

### Defer from v1

- **Drill-down from a Recent Assignment card to a per-assignment detail view** (v1.1+).
- **Drill-down from a student row to a per-student detail view** (v1.1+).
- **Refresh control / invalidation after `Start New Assessment` completes** (v1.1+).
- **Cohort-level aggregations across multiple classes** (separate feature; the shared `metricDisplay/` helper is designed to be reusable here).
- **Per-class "Edit Student Details" functionality** (the button is a disabled placeholder in v1).
- **URL-based routing** (query-param or path-based). Enables deep linking, browser back/forward, and refresh-from-class. The v1 child-route model is sufficient for the current usage patterns.
- **Alternative views** (`By Topic`, `By Student`, `By Criterion`). Replace the static `Typography.Text` "Viewing: Overall Class Averages" label with a real `Select` and add the alternative-view data analysis.
- **`Tooltip` / `aria-label` on `MetricPill` for accessibility.** The v1 pills rely on colour + single-character labels (`N`, `E`, numeric). v1.1 will add a `Tooltip` wrapper with screen-reader-friendly copy.
- **`useClassPageData` `isBusy` flag.** The flag was removed from v1 because no consumer renders a busy affordance. v1.1 may reintroduce it with a page-header spinner when the refresh control lands.
- **`useClassPageData` hook facade decomposition.** Deferred until the hook exceeds the 500-line threshold for frontend modules (`src/frontend/AGENTS.md` §13) or a concrete maintenance need arises. The projected post-change size is ~300–350 lines, well under the threshold.

## Open questions

None for v1. All decisions for the Class page are captured above. The Class page composition root, the data orchestrator hook, the adapter, the model, the table card, the recent-assignments section and card, the header actions, the column definitions, the shell / routing integration, and the page-level loading / blocking / ready treatment are all fully specified and ready to be planned in detail by the action plan.

**Implementation-mechanism open questions (to be resolved by the action plan, not blocking the spec):**

- **Refetch `classId` capture pattern.** The spec recommends a `useRef` updated in a `useEffect` keyed on `[classId]`. The action plan may pick a different pattern (e.g. `useCallback` with a complete dependency array) as long as the callback always uses the freshest `classId`. The v1 contract is that the retry button on a blocking state always re-fetches the class the user is currently viewing, not a stale class from a previous render.

**Resolved mechanism decisions (no longer open):**

- **Breadcrumb wiring for the third segment.** Resolved: the class detail view renders its own three-segment `Breadcrumb` in the page content area, accepting the temporary visual duplication with the shell's two-segment `Breadcrumb`. The `AppShell` and `appNavigation.tsx` are not modified in v1. A v1.1+ refactor may add a breadcrumb-override prop on `AppShell` and remove the duplication.
