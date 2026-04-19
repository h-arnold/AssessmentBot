# Frontend De-Sloppification Cleanup Specification

## Status

- Draft v1.0
- Created to turn the current frontend slop review into an implementation-ready cleanup spec for the active React frontend

## Purpose

This document defines the intended behaviour for the current frontend de-sloppification cleanup.

The cleanup will be used to:

- reduce duplicated orchestration, single-use wrapper layers, and pass-through helpers in the frontend page and settings surfaces
- preserve the current user-visible behaviour while making the code materially easier to scan, extend, and review
- enforce a net reduction in total lines of code across the completed implementation scope as an explicit success criterion for calling the work a cleanup

This cleanup is **not** intended to:

- add new product features, routes, tabs, filters, or backend capabilities
- redesign the current page layouts or introduce new interaction patterns where the existing behaviour is already acceptable

## Agreed product decisions

1. The implementation must preserve existing runtime behaviour unless the slop review explicitly calls out a simplification that does not alter user-visible outcomes.
2. A net reduction in LOC across the completed cleanup is a core requirement and non-negotiable. A cleanup that does not finish with fewer lines across the agreed scope is not complete cleanup work.
3. Removal, inlining, and consolidation take priority over new abstraction creation.
4. New helpers are only acceptable when they remove proven duplication across multiple active call sites or own a coherent independent contract.
5. Single-caller wrapper extraction is not an acceptable cleanup outcome.
6. Ant Design built-in component behaviour should be used directly where it already supports the required interaction, rather than adding local wrapper layers around Tabs, Table, Form, Modal, Alert, Flex, or Space.
7. The authoritative production page-render source must remain in `src/frontend/src/navigation/appNavigation.tsx`, with the shell consuming the validated navigation key instead of owning a parallel render switch.
8. The cleanup scope remains limited to the frontend areas listed in the slop review, their immediate helper graphs, and the directly affected frontend test files that currently duplicate production copy or preserved duplicate routing machinery.
9. The mandatory cleanup LOC accounting boundary is the following production-file baseline, counting direct renames or successor files when code is moved rather than deleted: `src/frontend/src/pages/AssignmentsPage.tsx`, `src/frontend/src/navigation/appNavigation.tsx`, `src/frontend/src/AppShell.tsx`, `src/frontend/src/pages/SettingsPage.tsx`, `src/frontend/src/pages/TabbedPageSection.tsx`, `src/frontend/src/pages/PageSection.tsx`, `src/frontend/src/pages/DashboardPage.tsx`, `src/frontend/src/pages/pageContent.ts`, `src/frontend/src/pages/SettingsPageGoogleClassroomsPrefetch.tsx`, `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/ClassesToolbar.tsx`, `src/frontend/src/features/classes/bulkMutationOrchestration.ts`, `src/frontend/src/features/classes/bulkSetCohortFlow.ts`, `src/frontend/src/features/classes/bulkSetYearGroupFlow.ts`, `src/frontend/src/features/classes/bulkSetCourseLengthFlow.ts`, `src/frontend/src/features/classes/bulkActiveStateFlow.ts`, `src/frontend/src/features/classes/bulkCreateFlow.ts`, `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`, `src/frontend/src/features/settings/backend/useBackendSettings.ts`, `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`, and `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`.
10. Required test, planning, and documentation follow-through remain in scope for delivery quality, but they do not replace the requirement for a net production-code reduction across that explicit cleanup baseline.

## Existing system constraints

### Backend or API constraints already in place

- Frontend-to-backend calls must continue to flow through `src/frontend/src/services/apiService.ts` and existing feature service contracts.
- Existing backend method names and request shapes for class mutations and backend settings writes must remain unchanged.
- This cleanup must not change backend transport contracts, retry behaviour, or startup warm-up contracts.

### Current data-shape constraints

- The assignments table continues to render `AssignmentDefinitionPartial` rows and the same filterable fields: title, topic, year group, document type, and updated date.
- Classes bulk actions continue to operate on the current `ClassesManagementRow` contract and existing status semantics (`active`, `inactive`, `notCreated`, `orphaned`).
- Backend settings validation continues to be defined by `BackendSettingsFormSchema` and the existing mapper and save flow.

### Frontend or consumer architecture constraints

- `src/frontend/src/navigation/appNavigation.tsx` remains the canonical navigation metadata surface.
- `SettingsPage` must preserve the current special-case behaviour that remounts the Classes tab when leaving it.
- The Settings surface must keep one stable `PageSection`-owned outer frame across tab switches.
- The outer Settings surface must continue to use the shared wide page-width contract, while the backend settings panel remains centred inside the shared default panel-width contract.
- `BackendSettingsPanel` must remain mounted across Settings tab switches unless a later approved spec explicitly changes that behaviour.
- `SettingsPageGoogleClassroomsPrefetch` must continue to run when the Settings page mounts, independent of the active tab.
- Loading, blocking-state, and busy-state semantics must continue to follow the existing frontend loading and width standards.
- Classes bulk workflows must preserve `runBulkMutationOrchestration(...)` as the shared mutation boundary unless implementation evidence shows a simpler change inside that contract.
- Frontend validation should continue to rely on Ant Design Form and Zod rather than bespoke duplicated state mirrors.
- `BackendSettingsPanel` remains the owner of the live Ant Design form instance, local edit state, and field meta, while `useBackendSettings` remains responsible for backend read/write orchestration and publishing rebased values after load and save.

## Domain and contract recommendations

### Why this approach is preferable

- It reduces maintenance cost by removing parallel sources of truth and repeated handler scaffolding.
- It preserves stable UI contracts while shrinking the surface area that later work must keep in sync.
- It sets a stronger repository precedent: shared helpers should exist because they own a real contract, not because a file was large.

### Recommended data shapes

#### Assignments column filter descriptor

```ts
{
  columnKey: 'primaryTitle' | 'primaryTopic' | 'yearGroup' | 'documentType' | 'updatedAt';
  headerLabel: string;
  filterLabel: string;
  selectedValues: FilterValue | null;
  options: ReadonlyArray<AssignmentsFilterOption>;
  renderValue?: (row: AssignmentDefinitionPartial) => string;
}
```

This descriptor is page-local and should only exist to derive repeated table column props.

#### Classes bulk action descriptor

```ts
{
  kind: 'create' | 'delete' | 'setActive' | 'setInactive' | 'setCohort' | 'setYearGroup' | 'setCourseLength';
  getEligibleRows: (rows: ClassesManagementRow[]) => ClassesManagementRow[];
  getActionCopy: () => {
    fullFailureTitle?: string;
    partialFailureTitle?: string;
    inlineFailureMessage?: string;
  };
  getModalInput?: () => {
    cohortKey?: string;
    yearGroupKey?: string;
    courseLength?: number;
  };
  runMutation: () => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
  resolveOutcome: (outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>) => Promise<void>;
}
```

This descriptor should extend the existing classes orchestration contract rather than creating a second orchestration layer, and it should remove repeated action copy and modal-input plumbing rather than centralising only the mutation call itself.

### Naming recommendation

Prefer:

- one authoritative navigation-key-to-page render contract in `src/frontend/src/navigation/appNavigation.tsx`
- `selectedRows`
- `filterDescriptor`
- `fieldError` values derived from the Ant Design form store

Avoid:

- duplicate page-renderer maps and switches for the same navigation keys
- `render...Content(...)` helpers that only split one component into a large prop bag hand-off
- separate mirrored error maps when the same field errors already live in Ant Design form state

### Validation recommendation

#### Frontend

- Use Ant Design Form field state as the primary validation-error source of truth for backend settings.
- Keep Zod as the schema authority for backend settings values and field-level validation decisions.
- Reuse Ant Design controlled filter props (`filteredValue`, `filterDropdown`, `filterIcon`, `onChange`) directly instead of wrapping them in single-use factories when a local descriptor can drive them.
- Keep modal submit state aligned with Ant Design `confirmLoading`, `destroyOnHidden`, and existing modal closure rules.

#### Backend

- No backend validation or contract changes are part of this cleanup.
- Existing backend rejection behaviour remains authoritative for invalid class updates and backend settings writes.

### Display-resolution recommendation

- Preserve current headings, summaries, alert copy, and table labels unless the cleanup explicitly removes a duplicate source of truth by reusing the existing production copy.
- Keep page- and panel-level status visibility unchanged: blocking errors remain visible, mutation failures remain surfaced, and loading states remain scoped to the owned surface.
- Preserve the current stable Settings frame and width-token routing: the tab set remains inside one shared page frame, and the backend settings panel remains centred within the narrower default panel width inside that stable frame.

## Feature architecture

### Placement

- The cleanup lives in `src/frontend/src/pages/**`, `src/frontend/src/navigation/**`, `src/frontend/src/AppShell.tsx`, `src/frontend/src/features/classes/**`, `src/frontend/src/features/settings/backend/**`, and the directly affected frontend test files that currently duplicate production copy or preserved duplicate routing behaviour.
- No parallel cleanup entry point should be created in deprecated frontend areas or in unrelated shared modules.

### Proposed high-level tree

```text
Frontend shell cleanup
├── page-layer simplification
│   ├── AssignmentsPage filter wiring
│   ├── App navigation render source
│   └── SettingsPage tab construction
├── classes feature cleanup
│   ├── bulk action orchestration
│   ├── metadata update flows
│   ├── panel render structure
│   └── toolbar selection derivation
└── backend settings cleanup
    ├── validated field wiring
    └── validation-error source of truth
```

### Out of scope for this surface

- changing business rules for assignment deletion, class creation, class activation, or backend settings persistence
- adding new reusable cross-feature helper libraries unless active duplication proves they are necessary within the accepted scope
- visual redesign beyond what falls out of removing redundant wrapper layers

## Data loading and orchestration

### Required datasets or dependencies

- Startup warm-up and `assignmentDefinitionPartials` query readiness rules for `AssignmentsPage`
- Existing React Query invalidation and refresh contracts for classes and backend config
- Existing reference-data sources for cohorts and year groups

### Prefetch or initialisation policy

#### Startup

- No new startup-prefetch behaviour is introduced.
- Existing startup warm-up ownership remains unchanged.

#### Feature entry

- Settings and assignments entry behaviour remains unchanged.
- The Settings page continues to trigger the existing Google Classrooms prefetch side effect on page mount.
- Cleanup may move logic between local helpers and component bodies, but it must not change when data loads begin.

#### Manual refresh

- Existing manual refresh affordances remain present and semantically unchanged.
- Cleanup may simplify the code that wires these affordances, but not remove or redesign them.

### Query or transport additions

- No new query keys or API methods are expected.
- Any classes cleanup should reuse existing query invalidation and refresh helpers.
- Directly affected frontend tests may stop duplicating production page copy where strict test-data independence is not required.

## Core behavioural model

### Assignments page cleanup

- One typed filter state update path should replace the current repeated per-column setter pattern.
- One page-local descriptor-driven approach should replace repeated table-column filter wiring.
- Existing filter choices, matching behaviour, reset behaviour, and accessibility labels must remain intact.

### Navigation cleanup

- There must be one authoritative production render source for `dashboard`, `assignments`, and `settings` page selection.
- That render contract remains owned by `src/frontend/src/navigation/appNavigation.tsx`.
- The fail-fast boundary stays at navigation input validation, not at duplicate runtime layers around already narrowed keys.
- `src/frontend/src/AppShell.tsx` must consume the validated navigation key without a second page-selection switch.
- The dashboard path must continue to pass the injected dashboard content slot through unchanged.
- Tests must assert against the surviving source of truth rather than preserving duplicate runtime machinery.

### Settings page cleanup

- Settings tabs remain exactly two fixed tabs: Classes and Backend settings.
- The Classes tab remount-on-leave behaviour remains intact.
- Backend settings must not remount on ordinary tab switches, so unsaved form edits and existing load/save lifecycle behaviour continue to behave as they do now.
- The current stable Settings page frame must survive tab switches without replacing the outer `PageSection` wrapper or changing width-token routing.
- The current single-caller `TabbedPageSection` indirection should not survive unless a second real production caller emerges during implementation.

### Classes feature cleanup

- `ClassesManagementPanel` remains the feature root and continues to own modal state, mutation busy state, outcome alerts, and table suppression logic.
- Shared bulk orchestration remains centralised, but action-specific handlers should be descriptor-driven or otherwise materially deduplicated.
- That deduplication target includes repeated action copy, repeated mutation-handler scaffolding, and repeated modal-supplied input plumbing, not only the final mutation call.
- The three metadata update flows should converge on one shared feature-local pattern unless implementation evidence shows a material behavioural difference that must stay separate.
- Selection semantics must be derived once per render path and passed downward rather than recomputed independently by parent and child.
- Top-level bulk actions and metadata modal actions remain separate outcome families even if their orchestration becomes more shared.
- The single-caller `renderClassesManagementPanelContent(...)` split should be removed unless implementation extracts smaller coherent subcomponents with clear ownership.
- The existing bulk modal-shell similarity between `BulkCreateModal` and `BulkSetSelectModal` is deliberately out of scope for this pass unless implementation can simplify it without introducing a new shared shell abstraction or increasing LOC.

### Backend settings cleanup

- Field-level validation display, help text, and rules should be driven from one feature-local pattern instead of repeated per-field wiring.
- The panel should not mirror the same field errors in both Ant Design form meta and a second controlled map unless the implementation can prove the two stores have distinct responsibilities.
- The cleanup must preserve the current ownership boundary where the panel owns the live form state and the hook owns query-backed load, save, refresh, and rebase orchestration.
- Existing save, refresh, blocking-load, and API-key helper semantics must remain unchanged.

## Main user-facing surface specification

### Recommended components or primitives

- `Table` controlled column filter props and `filterDropdown` support for assignments
- `Tabs` `items` in `SettingsPage`, without introducing global tab-destruction behaviour that would remount Backend settings on ordinary tab switches
- `PageSection` as the stable shared frame for the Settings surface
- `Form` / `Form.Item` as the backend settings validation surface
- `Modal` `confirmLoading` and `destroyOnHidden` for existing classes modal flows
- `Alert`, `Flex`, and `Space` for visible status stacks and workflow layout without extra wrapper layers

### Fields, columns, or visible sections

1. Assignments status/actions card and assignment definitions table remain visible where they are today.
2. Settings page heading, summary, and two-tab structure remain visible where they are today.
3. Classes summary, toolbar, table, outcome alerts, and modal stack remain visible where they are today.
4. Backend settings section cards and save control remain visible where they are today.

### Sorting, filtering, or navigation rules

- Assignments filters remain controlled and resettable.
- Navigation still rejects invalid menu keys at the input boundary.
- Settings tab changes continue to be controlled by the page, not hidden inside a generic wrapper.

### Rendering rules

#### Behaviour-preserving cleanup

- Visible output should remain equivalent before and after cleanup for supported states.
- Any structural refactor that changes rendered copy, alert ordering, filter availability, or tab lifecycle must be treated as scope drift unless explicitly justified in implementation notes.

#### LOC gate

- Each cleanup section should target local line removal or a justified temporary increase that is reversed within the same workstream.
- The mandatory LOC pass/fail gate is measured against the scoped production cleanup files and their immediate helper graph.
- The completed implementation must finish with a net production-code LOC reduction across that agreed scope; otherwise the work has failed the cleanup goal.

## Workflow specification

## Assignments filter workflow

### Eligible inputs or preconditions

- Assignment definition data is available through the existing query path.
- User selects one of the current exact-match filter options per filterable column.

### Inputs, fields, or confirmation copy

- Existing filter option labels and accessible filter labels remain unchanged.
- Reset still clears all filters together.

### Outcome rules

- The same rows remain visible for the same selected filter values.
- No new filter UI or search semantics are introduced.

## Shell navigation workflow

### Eligible inputs or preconditions

- Navigation input has already been narrowed to `AppNavigationKey` by the shell event boundary.

### Outcome rules

- The selected page remains the same for each key.
- Breadcrumb labels remain sourced from the same navigation metadata.
- Dashboard content injected by the shell continues to reach the dashboard page unchanged.
- Invalid raw keys still fail fast before they reach the selected-page render path.

## Classes bulk action workflow

### Eligible inputs or preconditions

- The same selection eligibility rules continue to apply for create, delete, active-state, cohort, year-group, and course-length actions.
- The bulk create workflow continues to seed course length with an initial value of `1` and validates it against the current course-length rules.

### Outcome rules

- Bulk action success, partial-failure, full-failure, refresh-required, modal-close, and selection-retention outcomes remain equivalent.
- Cleanup must not change which rows are eligible for each action.

### Top-level bulk action outcomes

- Create, delete, set-active, and set-inactive actions continue to resolve through panel-level alert and surface-close behaviour.
- These actions continue to clear or retain selected rows in the same circumstances they do now.

### Metadata modal action outcomes

- Cohort, year-group, and course-length actions continue to preserve the current modal-specific behaviour.
- Full failure keeps the relevant metadata modal open and shows inline modal error state.
- Partial failure may close the modal while surfacing warning state at panel level and retaining rejected-row selection.
- Successful outcomes and refresh-failure handling must remain equivalent to the current metadata modal flows.

## Backend settings validation workflow

### Eligible inputs or preconditions

- The form remains backed by the current schema and save hook.

### Outcome rules

- The same invalid values remain invalid.
- The same load, save, and refresh states remain visible.
- The same first invalid field remains scroll-targetable on submit failure.
- A blank API key continues to retain the stored key when one already exists.
- The frontend must not echo the masked read value back into the API key input or save payload.

## Acceptance focus

The cleanup is acceptable when:

- the scoped frontend areas behave the same from a user perspective
- duplicate sources of truth and single-use wrapper layers identified in the slop review are removed or materially reduced
- helper choices align with `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- the final implementation produces a net LOC reduction across the scoped production cleanup surface, because no LOC reduction means the duplication has only been moved rather than removed

## Open questions

- Deliberate deferral: the current bulk modal-shell duplication noted as an improvement item in the slop review stays out of scope for this pass unless it naturally falls out of the accepted classes cleanup without adding a new abstraction layer.
