# Classes Reference-Data Modal Family Specification

## Status

- Draft v2.0
- Updated to promote the classes reference-data modal family from a caller-local action standard into a narrow extracted scaffold because a topic reference-data modal is now an accepted near-term sibling.

## Purpose

This document defines the intended behaviour for the classes reference-data modal family and its extracted scaffold contract.

The feature will be used to:

- remove the current full-width call-to-action appearance from the existing Manage Cohorts and Manage Year Groups modals
- extract the shared outer modal shell used by the current reference-data CRUD modals
- make the next topic reference-data modal reuse a documented family scaffold rather than copying the current outer-shell pattern again

This feature is **not** intended to:

- redefine action-button standards for unrelated pages, tables, or non-reference-data modals across the whole frontend
- replace the existing inline dialog helpers with a generic app-wide CRUD abstraction
- change the existing create, edit, delete, toggle-active, loading, or fail-closed workflow contracts already owned by the current reference-data modals

## Agreed product decisions

1. The scope is limited to the classes reference-data modal family currently represented by `ManageCohortsModal` and `ManageYearGroupsModal`, plus the accepted near-term topic reference-data modal that deliberately reuses the same workflow family.
2. The family now justifies one narrow extracted scaffold from the two active callers alone, with the later topic modal treated as an intended future consumer rather than the sole reason the extraction is worthwhile.
3. The extracted scaffold owns the outer Ant Design `Modal` shell, the standard `Cancel` footer, and all close wiring for that shell. In this phase that means the footer button, modal close icon, mask-close path, and keyboard-close path all funnel through the same caller-supplied `onClose`, alongside the ready-state body stack, top action row, modal-level refresh busy semantics, shared busy/status region placement, table region placement, and inline-dialog slot placement.
4. The extracted scaffold does not own entity-specific columns, row actions, mutation handlers, form validation copy, or delete-copy wording.
5. Each family caller keeps one top-level create action in the ready state, and that action renders in a start-aligned action row sized to its content rather than stretching to the modal body width.
6. The create action remains the single primary action in the ready state. Row-level Edit and Delete actions keep their current emphasis and placement.
7. The default leading icon for create actions in this family is `PlusOutlined`, and the scaffold owns that default internally for this phase.
8. A different Ant Design icon may replace `PlusOutlined` only when a later explicit spec or documented product decision approves that deviation for a workflow whose domain meaning is genuinely clearer with a different icon. Ant Design application icons are an acceptable source only in that explicitly approved case.
9. For text-plus-icon create buttons, the accessible button name must remain the visible text label, and the icon must behave as decorative content rather than a separately announced control.
10. The decorative add icon must expose the stable family test seam `data-testid="reference-data-create-action-icon"` so tests do not depend on incidental Ant Design SVG markup.
11. The same create-action placement and icon rule applies in both the populated-table state and the empty-table state.
12. When inline create, edit, or delete dialog sections are open, the existing ready-state body stays visible, including the top action row and table.
13. Blocking-load, background-refresh, inline create/edit form, inline delete confirmation, and delete-blocked behaviours remain unchanged by this standard.
14. The caller-owned scaffold inputs for this phase are exactly: `open`, `modalTitle`, `modalClassName`, `modalWidth`, `createActionLabel`, `tableAriaLabel`, `emptyTableCopy`, `refreshStatusCopy`, `isInitialLoading`, `isRefreshing`, `loadError`, `loadingState`, `rows`, `columns`, `inlineAlert`, `inlineDialog`, `onClose`, and `onCreate`.
15. The accepted next topic modal is treated as an intended future consumer of this scaffold, but its final owner boundary is not settled by this spec.
16. If that later topic modal lands outside the current owner boundary, promotion to a broader shared location becomes follow-up work rather than a blocker for this phase.
17. This family standardises on reference-data rows exposing `key` as the row identity field, and the scaffold owns `rowKey="key"` rather than widening the scaffold API with a row-key prop in this phase.

## Existing system constraints

### Backend or API constraints already in place

- This change is frontend-only and must not require backend contract changes.
- Existing reference-data service calls, query invalidation, and trust-boundary refresh rules remain authoritative.
- Topic reference data already exists as a frontend service/query surface, so the accepted next caller justifies the outer scaffold extraction without requiring a new read-side dataset contract first.

### Current data-shape constraints

- Cohort and year-group entities keep their existing transport and rendering fields.
- The accepted topic sibling uses the existing `{ key, name }` topic reference-data contract on the read side.
- No new data fields are required to support the scaffold extraction itself.

### Frontend or consumer architecture constraints

- The affected surfaces belong to the classes reference-data workflow family documented in `docs/developer/frontend/frontend-modal-patterns.md`.
- The current modal body uses Ant Design `Flex`, `Button`, `Table`, `Alert`, `Skeleton`, and inline dialog sections.
- The current full-width appearance is a layout consequence of the existing vertical flex container rather than an intentional `block` button contract.
- The existing helper family already covers inline dialogs and reference-data workflow helpers in `InlineDialog.tsx`, `manageReferenceDataDialogs.tsx`, and `manageReferenceDataHelpers.ts`.
- Topic mutation transport, invalidation rules, and any extension of the current reference-data helper family beyond cohorts and year groups remain future work outside this spec.
- The future topic caller will require extending the `ReferenceDataTrustBoundary` union type in `manageReferenceDataHelpers.ts` to include `'topics'`. This is a known `extend` decision on that module when the topic caller is implemented; it is recorded as upcoming work in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` and is not a blocker for the current scaffold extraction.
- The duplicated part worth extracting now is the outer modal shell and ready-state body composition shared by `ManageCohortsModal` and `ManageYearGroupsModal`.

## Domain and contract recommendations

### Why this approach is preferable

- It corrects the current visual mismatch without changing the surrounding CRUD workflow.
- It gives the current and next sibling modal one documented outer-shell contract instead of repeating the same status/action/table/dialog composition.
- It keeps the abstraction narrow enough to remain feature-local and testable.

### Recommended UI contract shape

#### Reference-data modal scaffold contract

```ts
{
  callerOwnedInputs: {
    open: boolean;
    modalTitle: string;
    modalClassName: string;
    modalWidth: number;
    createActionLabel: string;
    tableAriaLabel: string;
    emptyTableCopy: string;
    refreshStatusCopy: string;
    isInitialLoading: boolean;
    isRefreshing: boolean;
    loadError: string | null;
    loadingState: ReactElement;
    // The scaffold component is generic: <T extends { key: string }>
    // Each caller binds T to its own entity type (e.g. Cohort, YearGroup)
    rows: T[];
    columns: TableColumnType<T>[];
    inlineAlert?: ReactElement | null; // rendered below the action row and before the table, not at the modal-body top
    inlineDialog?: ReactElement | null; // form and delete dialogs are mutually exclusive; callers combine them into one expression, e.g. renderFormDialog(...) ?? renderDeleteDialog(...)
    onClose: () => void; // caller-local cleanup wrapper that resets transient modal state before delegating upward
    onCreate: () => void;
  };
  scaffoldOwnedInvariants: {
    createActionIcon: 'PlusOutlined';
    createActionIconTestId: 'reference-data-create-action-icon';
    footer: 'single Cancel action wired to onClose';
    closeWiring: 'footer button, close icon, mask close, and keyboard close all delegate to onClose';
    rowKey: 'key'; // invariant because T extends { key: string }
    buttonNameSource: 'visible text label';
    iconTreatment: 'decorative';
    busySemantics: 'modal-level aria-busy during refresh';
    busySelectorClass: 'reference-data-modal-scaffold-wrapper'; // applied via classNames.wrapper to .ant-modal-wrap
    busySelectorStrategy: 'compound selector .reference-data-modal-scaffold-wrapper [role="dialog"] — classNames.wrapper places the class on .ant-modal-wrap, not on [role="dialog"] directly, so a descendant selector navigates to the inner dialog element';
  };
}
```

### Naming recommendation

Prefer:

- `Create cohort`
- `Create year group`
- `Create topic`
- `Create <entity>` labels that name the target record explicitly

Avoid:

- unlabeled icon-only add buttons for this modal family
- generic labels such as `Create` when the entity name can be stated clearly
- drifting to `Add <entity>` in future sibling modals unless a later spec deliberately standardises a different verb

### Validation recommendation

#### Frontend

- The create button must remain discoverable by its visible text label in populated and empty states.
- The create button must not expand to the full modal-body width unless a future spec explicitly declares a call-to-action surface.
- The create icon should be decorative so tests and assistive technology continue to resolve the control by its text label.
- The decorative icon wrapper must expose `data-testid="reference-data-create-action-icon"` through the shared scaffold.
- The scaffold must honour the full caller-owned input list settled above rather than silently standardising those values in this phase.
- The scaffold owns modal-level `aria-busy` refresh semantics for the family while preserving caller class names for styling and stable targeting where required. The busy-state DOM selector must anchor to an internal scaffold-owned class set via `classNames.wrapper` on the Ant Design `Modal` component, not the caller-supplied `modalClassName`. This decouples busy-state wiring from caller configuration and makes the selector an invariant of the scaffold.
- The scaffold owns all modal-close routes for the family shell and funnels them through the caller-supplied `onClose` rather than leaving footer or chrome-close wiring to each caller.
- The caller-supplied `onClose` remains the caller-local cleanup boundary for transient form, delete, and inline-dialog state before any parent-level close delegation happens.

#### Backend

- None. This standard does not alter backend validation or transport.

### Display-resolution recommendation

- The create action should visually align with the main modal content start edge.
- The leading icon should read as supplementary affordance, not as the primary source of meaning.

## Feature architecture

### Placement

- The current owning surfaces are `src/frontend/src/features/classes/ManageCohortsModal.tsx` and `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`.
- The accepted next sibling is a topic reference-data modal using the same outer CRUD shell pattern.
- The extracted scaffold should remain feature-local under the current classes reference-data owner boundary for this phase.
- This family must not move into separate routes, drawers, or nested Ant Design modal portals.

### Proposed high-level tree

```text
Classes feature
└── Reference-data modal family
    ├── ReferenceDataManagementModalScaffold
    ├── ManageCohortsModal
    │   └── scaffold slots: status, create row, alert, table, inline dialog
    ├── ManageYearGroupsModal
    │   └── scaffold slots: status, create row, table, inline dialog

Future consumer (owner TBD)
└── Topic reference-data modal
  └── scaffold slots: status, create row, table, inline dialog
```

### Out of scope for this surface

- changing row-action button icons or row-action ordering
- introducing a cross-feature shared modal abstraction for unrelated modal families
- redesigning the existing inline dialog helper family beyond the slots it already provides

## Data loading and orchestration

### Required datasets or dependencies

- `cohorts`
- `yearGroups`
- `assignmentTopics` for the accepted next sibling caller on the read side

### Prefetch or initialisation policy

#### Startup

- No startup changes are required for this extraction.

#### Feature entry

- The create action remains part of the ready modal body only after trustworthy data is available.

#### Manual refresh

- No manual refresh control is added.

### Query or transport additions

- None for this extraction itself.

## Core view model or behavioural model

### Suggested shape

```ts
{
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  createAction: {
    visible: boolean;
    label: string;
    icon: 'PlusOutlined';
    width: 'content-width';
    alignment: 'start';
  }
  modalShell: {
    className: string;
    width: number;
  }
  emptyTableCopy: string;
  refreshStatusCopy: string;
  inlineDialogVisible: boolean;
  tableVisible: boolean;
}
```

### Derivation or merge rules

#### Blocking state

- When the modal is in initial-loading or blocking-failure state, suppress the ready body and therefore suppress the create action.
- Background refresh does not hide the create action.

#### Ready state

- When trustworthy data is present, render the create action before the table content.
- Empty-table and populated-table states both keep the action visible in the same position.
- Inline dialog states keep the ready-state body visible, including the start-aligned create-action row and the table.

### Sort order or priority rules

1. Blocking load state
2. Ready state with persistent create action
3. Optional inline dialog state layered inside the same modal body

## Main user-facing surface specification

### Recommended components or primitives

- Narrow extracted scaffold component
- Ant Design `Button` with leading icon
- Ant Design `Flex` for the modal-body stack and action-row alignment
- Ant Design `Table`
- Ant Design `Alert` and `Skeleton` for existing state treatments

### Fields, columns, or visible sections

1. Refresh or status region when present
2. Start-aligned create-action row
3. Optional caller-specific alert slot
4. Reference-data table
5. Existing inline create/edit/delete dialog region

### Sorting, filtering, or navigation rules

- None added by this standard.

### Rendering rules

#### Ready with data

- Render the create button above the table.
- Keep the button start-aligned and content-width.
- Show the leading `PlusOutlined` icon unless a workflow-specific icon is explicitly justified.

#### Ready with no data

- Preserve the same create-action row above the empty table state.
- Do not promote the button to a full-width call-to-action solely because the table is empty.

#### Background refresh

- Keep the create action visible and usable unless a conflicting write is in progress under an existing rule.
- Preserve the current modal-level busy semantics.

#### Inline dialog open

- Keep the create-action row and the table visible while the inline create, edit, or delete section is rendered below them.
- Do not replace the ready-state body with a standalone secondary surface.

#### Blocking failure

- Suppress the ready body, including the create action, and keep the existing blocking-state treatment.

## Workflow specification

## Open reference-data management modal

### Eligible inputs or preconditions

- The user opens one of the family callers.
- Trustworthy reference-data content is available or is loading.

### Behaviour

- The caller renders through the shared scaffold contract.
- Entity-specific columns, alerts, and inline dialogs are injected through scaffold slots.

### Success outcome

- The user sees a consistent outer modal shell across cohorts, year groups, and the next topic caller.

## Trigger create flow

### Eligible inputs or preconditions

- The modal is in ready state.

### Behaviour

- Activating the create button opens the existing entity-specific inline create dialog.
- The scaffold does not own the form fields or submit handler.

## Testing and observability expectations

- Shared helper coverage should verify the scaffold contract for blocking, ready, empty, refresh, alert-slot, and inline-dialog-slot states.
- Caller coverage should continue to verify entity-specific behaviour such as cohort toggle errors, column rendering, and create/edit/delete workflow entry.
- Unit/component coverage should assert that the shared scaffold exposes `data-testid="reference-data-create-action-icon"` once per ready-state caller while preserving the same accessible button name.
- Shared helper coverage should verify that caller-supplied modal width, modal class name, empty-table copy, and refresh-status copy are preserved.
- Shared helper coverage should verify that modal-level `aria-busy` refresh semantics move into the scaffold rather than remaining duplicated in each caller.
- Shared helper coverage should verify that the scaffold owns the standard `Cancel` footer and close wiring.
- Playwright coverage should verify that cohort and year-group callers still render a visible, start-aligned, non-full-width create button after migrating to the scaffold.

## Open questions

- The owner boundary for the accepted next topic reference-data modal is not yet settled. If it lands outside the current classes feature boundary, the scaffold will need to be promoted to a shared location. Deferred as follow-up work per agreed decisions 15 and 16. The consumption pattern itself (same outer CRUD shell) is settled.
