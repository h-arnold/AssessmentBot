# Classes Page Specification

## Status

- Draft v1.0
- Created to define the dedicated Classes page before implementation planning begins

## Purpose

This document defines the intended behaviour for the Classes page.

The feature will be used to:

- provide a dedicated top-level page for browsing classes defined in `ABClassPartials`
- group those classes by year group using the startup-loaded `yearGroups` reference dataset
- present a simple card-based browse surface with placeholder `View` and `Edit` controls for later work

This feature is **not** intended to:

- replace the existing Settings > Classes tab in this iteration
- add drag-and-drop, manual ordering, or cross-year-group movement of cards or panels
- make the placeholder `View` and `Edit` controls functional in this iteration

## Agreed product decisions

1. The Classes page is a new top-level navigation destination and does not remove the existing Settings > Classes tab.
2. The canonical shared navigation key and page-copy key for this page is `classes`.
3. The page renders one collapse panel per year-group record from the authoritative shared `yearGroups` dataset that is warmed at app startup.
4. Year-group panels are ordered alphabetically by `YearGroup.name`, using `YearGroup.key` as the deterministic tie-break.
5. The page renders cards only for records returned by `getABClassPartials()` and does not inherit the existing Settings-table merge with Google Classrooms data.
6. Cards inside each year-group panel are ordered alphabetically by `className`, using `classId` as the deterministic tie-break.
7. If any class partial has `className === null`, `yearGroupKey === null`, or a `yearGroupKey` that does not resolve against the currently loaded `yearGroups` dataset, the Classes page owned surface fails closed and renders a blocking error state instead of partial content.
8. The page remains read-only in this iteration. `View` and `Edit` are visible placeholder controls only.
9. No dragging, dropping, manual reordering, or ordering persistence is included.
10. Assumption: the year-group collapse uses standard multi-expand behaviour rather than accordion mode, and the first alphabetical panel is expanded on initial ready render when at least one panel exists.

## Existing system constraints

These constraints materially shape the feature.

### Backend or API constraints already in place

- Frontend transport access must remain behind `callApi(...)` through existing service modules.
- `getABClassPartials()` is the existing frontend wrapper for the allowlisted `apiHandler` method `getABClassPartials`.
- `getYearGroups()` is the existing frontend wrapper for the allowlisted `apiHandler` method `getYearGroups`.
- No new `apiHandler` method, allowlist entry, request shape, response shape, or persistence change is required for this iteration.

### Current data-shape constraints

- `ClassPartial` currently exposes `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey`, `classOwner`, `teachers`, and tri-state `active`.
- `YearGroup` currently exposes `key` and `name` only.
- `yearGroupKey` is authoritative for grouping; display labels must be resolved from the current `yearGroups` dataset.
- Although the current transport schema allows `className` to be `null`, this page treats `null` `className` as invalid data and fails closed rather than deriving a fallback label.

### Frontend or consumer architecture constraints

- Shell navigation metadata and page rendering remain centralised in `src/frontend/src/navigation/appNavigation.tsx`.
- Shared page headings and summaries remain centralised in `src/frontend/src/pages/pageContent.ts`.
- `PageSection` remains the shared page-shell wrapper for top-level navigation pages.
- Shared React Query definitions and startup warm-up contracts must continue to come from `src/frontend/src/query/sharedQueries.ts`.
- Loading, refresh, fail-closed degradation, and width choices must follow `docs/developer/frontend/frontend-loading-and-width-standards.md`.

## Domain and contract recommendations

### Why this approach is preferable

- It reuses the existing startup-loaded datasets and service contracts, so the first iteration stays local to the frontend.
- It keeps the new browsing surface separate from the operational Settings table, which reduces the risk of unintentionally pulling bulk-management behaviour into this scope.
- It treats unresolved year-group mappings as a trust failure rather than silently hiding or mis-grouping records.

### Recommended data shapes

#### Classes page card model

```ts
{
  classId: string;
  className: string;
  yearGroupKey: string;
  yearGroupLabel: string;
}
```

#### Classes page panel model

```ts
{
  yearGroupKey: string;
  yearGroupLabel: string;
  classes: Array<{
    classId: string;
    className: string;
    yearGroupKey: string;
    yearGroupLabel: string;
  }>;
}
```

#### Blocking invalid-data view-model recommendation

```ts
{
  type: 'invalidClassesPageData';
  classIds: string[];
}
```

This is a page-local recommendation only. It is not a new shared frontend or backend error contract.

### Naming recommendation

Prefer:

- `className`
- `yearGroupLabel`
- `yearGroupPanels`
- `groupedClasses`

Avoid:

- `row`
- `tableData`
- `classGroups`

The new page is a card- and panel-based surface rather than a table.

### Validation recommendation

#### Frontend

- Treat any class partial with `yearGroupKey === null` as an immediate blocking trust failure for the page.
- Treat any class partial whose `yearGroupKey` does not resolve to a loaded year-group record as an immediate blocking trust failure for the page.
- Treat any class partial with `className === null` as an immediate blocking trust failure for the page.
- Treat the placeholder `View` and `Edit` controls as disabled presentation controls in this iteration so the page does not imply an available workflow.

#### Backend

- No backend validation changes are required in this iteration.
- Existing Zod validation in the frontend service layer remains the transport boundary, while this page adds a stricter page-owned rendering invariant that requires non-null `className` and a non-null, resolvable `yearGroupKey` before content can render.

### Display-resolution recommendation

- Resolve panel labels from the current `yearGroups` dataset by key.
- Resolve `yearGroupLabel` from `YearGroup.name` and render `className` directly from the class partial.
- Do not look up Google Classrooms labels or merge Google Classroom-only rows for this page.

## Feature architecture

### Placement

- The page belongs in the top-level frontend navigation alongside Dashboard, Assignments, and Settings.
- The canonical shell key for this page is `classes`, and the shared page heading and summary must be defined under the same `classes` key in the existing shell contracts.
- The existing Settings > Classes tab remains a separate table-based operational surface and must not be removed in this iteration.
- The new page must not introduce a second source of truth for navigation metadata or page copy outside the existing shared navigation and page-content modules.

### Proposed high-level tree

```text
AppShell
└── ClassesPage
    └── Classes page content
        ├── Status region
        └── Year-group collapse
            └── Class-card collection per panel
```

### Out of scope for this surface

- bulk create, bulk delete, and bulk metadata editing workflows
- inline class editing or detail drawers
- drag/drop between year groups
- persisted expand or collapse preferences

## Data loading and orchestration

### Required datasets or dependencies

- `classPartials`
- `yearGroups`

### Prefetch or initialisation policy

#### Startup

- Reuse the existing startup warm-up datasets for `classPartials` and `yearGroups`.
- The app-level startup warm-up boundary remains the owner of initial dataset readiness.
- The page should derive startup trust and failure from the existing dataset-level warm-up checks for `classPartials` and `yearGroups` rather than from a coarse global warm-up flag.

#### Feature entry

- The page consumes the shared React Query caches for `classPartials` and `yearGroups`.
- The page does not introduce any new startup-prefetched datasets.
- The page does not depend on `googleClassrooms` data for rendering.
- The page continues to consume the existing shared query definitions even if a startup-prefetched dataset previously failed, so normal query recovery and refetch behaviour remain available.

#### Manual refresh

- No dedicated manual refresh control is required in this iteration.

### Query or transport additions

- Reuse the existing shared class-partials and year-groups query definitions.
- No new frontend service wrapper or backend method is required.

## Core view model or behavioural model

### Suggested shape

```ts
{
  panels: Array<{
    key: string;
    label: string;
    classes: Array<{
      classId: string;
      className: string;
    }>;
  }>;
  defaultExpandedPanelKeys: string[];
}
```

### Derivation or merge rules

#### Blocking invalid-mapping state

- If any class partial has `className === null`, the page enters a blocking error state.
- If any class partial has `yearGroupKey === null`, the page enters a blocking error state.
- If any class partial resolves to no matching year group, the page enters a blocking error state.
- The blocking state suppresses the normal collapse and card content for the owned surface.

#### Ready grouped state

- Group `ClassPartial` records by `yearGroupKey`.
- Render one panel for every year group in the loaded `yearGroups` dataset, even when that panel currently has no classes.
- Only cards whose `yearGroupKey` matches the panel key appear in that panel.

#### Empty year-group-configuration state

- If the `yearGroups` dataset is trustworthy but empty and there are no class partials, render a page-level empty state rather than an empty collapse.
- If the `yearGroups` dataset is trustworthy but empty while class partials exist, the page enters the blocking invalid-mapping state because the class grouping cannot be trusted.

### Sort order or priority rules

1. Year-group panels sort by `YearGroup.name` ascending using locale-aware, case-insensitive comparison.
2. Equal year-group names sort by `YearGroup.key` ascending.
3. Cards inside each panel sort by `className` ascending using locale-aware, case-insensitive comparison.
4. Equal class names sort by `classId` ascending.

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Collapse` for year-group grouping
- Ant Design `Card` for each class surface
- Ant Design `Alert` for blocking failures
- Ant Design `Empty` for explicit empty states
- Ant Design `Skeleton` for initial blocking load

### Fields, columns, or visible sections

1. Shared page heading and summary for the Classes top-level page
2. A status region that owns skeleton, blocking alert, and local refresh messaging
3. One collapse bar per loaded year group
4. A class-card region within each expanded year-group panel
5. Disabled placeholder `View` and `Edit` buttons inside each class card

### Sorting, filtering, or navigation rules

- There is no user-controlled sorting in this iteration.
- There is no search or filtering in this iteration.
- Collapse expansion is local UI state only and must not introduce nested routing or secondary navigation.

### Rendering rules

#### Initial loading

- If `classPartials` or `yearGroups` has no usable data yet, render a shape-matched skeleton in the Classes page owned region.
- Hide the collapse and cards until the required data becomes usable.

#### Ready with data

- Render the ordered year-group collapse.
- Render ordered class cards under each panel.
- Keep the placeholder buttons visible but disabled.

#### Ready with no class partials

- If trustworthy year groups exist but there are no class partials, render the ordered year-group collapse.
- Each panel body renders an in-panel empty presentation rather than blank whitespace.
- Do not replace the collapse with a second page-level empty state in this case because the bars are year-group-driven.

#### Ready with no configured year groups

- If both datasets are trustworthy and both are empty, render a page-level empty state explaining that no year groups are configured yet.

#### Blocking failure

- Render the blocking-state treatment in the Classes page owned region.
- Suppress the collapse and all class cards.

#### Background refresh

- Keep the current grouped content visible while refreshing if the page still has trustworthy grouped data.
- Publish local busy semantics and visible refresh feedback in the page-owned surface.
- If refreshed data becomes untrustworthy because grouping can no longer be resolved, transition to the blocking state.

## Workflow specification

## Browse year-grouped classes

### Eligible inputs or preconditions

- `classPartials` and `yearGroups` are both available and trustworthy.
- Every class partial has a non-null `className` and a non-null `yearGroupKey` that resolves to a loaded year-group record.

### Inputs, fields, or confirmation copy

- Collapse headers display year-group labels.
- Cards display the class name from `ABClassPartials`.
- Cards include disabled placeholder `View` and `Edit` buttons.

### Behaviour

- Users can expand or collapse any year-group panel.
- Multiple year-group panels may remain expanded at the same time.
- The first alphabetical year-group panel is expanded on initial ready render when at least one panel exists.

### Success outcome

- Users can browse ABClass partial records grouped by year group.

## Placeholder class actions

### Eligible inputs or preconditions

- A class card is visible.

### Inputs, fields, or confirmation copy

- Disabled `View` button
- Disabled `Edit` button

### Behaviour

- Both controls are visible as placeholders.
- Neither control launches navigation, a modal, or a mutation in this iteration.

### Success outcome

- The page communicates the intended future action locations without expanding current scope.

## Open questions and deliberate deferrals

- The future `View` workflow is deferred.
- The future `Edit` workflow is deferred.
- Any additional class-card metadata beyond `className` is deferred.
