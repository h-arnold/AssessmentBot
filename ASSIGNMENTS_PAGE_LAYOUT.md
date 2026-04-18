# Assignments Management v1 Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for **Assignments Management v1**.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the Assignments page layout inside the existing shell navigation
2. the major visible regions inside the page
3. the preferred Ant Design components for those regions
4. the user-visible states for loading, ready, empty, blocking-failure, and delete flows
5. the single-row delete confirmation surface
6. responsive and accessibility expectations that materially affect the layout

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- create or update workflows for assignment definitions
- any full-definition fetch, detail drawer, or detail modal

## Design principles

1. Keep the Assignments page as a single visible surface in the existing shell.
2. Keep the page composition thin and push orchestration into feature hooks and query wiring.
3. Prefer built-in Ant Design table, card, alert, skeleton, and modal behaviours over bespoke interaction patterns.
4. Keep important status and delete feedback visible on the page rather than hiding it in transient-only feedback.
5. Preserve the shell header and summary even when the Assignments-owned region is loading or blocked.
6. Avoid nested tabs, drawers, accordions-as-navigation, row expansion, or secondary routes in v1.
7. Keep v1 read-only apart from the explicit single-row delete action.

## Ant Design references consulted

- [Table](https://ant.design/components/table/)
- [Card](https://ant.design/components/card/)
- [Modal](https://ant.design/components/modal/)
- [Alert](https://ant.design/components/alert/)
- [Empty](https://ant.design/components/empty/)
- [Skeleton](https://ant.design/components/skeleton/)
- [Flex](https://ant.design/components/flex/)
- [Space](https://ant.design/components/space/)
- [Button](https://ant.design/components/button/)

## Surface hierarchy

```text
App shell
└── Assignments navigation entry
    └── AssignmentsPage
        └── PageSection
            └── Assignments management surface
                ├── Status and actions region
                ├── Assignment definitions table region
                └── Delete confirmation modal
```

This is the only supported frontend entry point for Assignments Management v1.

Do not add:

- nested Assignments tabs
- row expansion panels
- a details drawer
- a dedicated create or update route

## No extra navigation layers

The Assignments surface must stay as one page-level workflow with no extra navigation layers.

Rationale:

- the approved v1 scope is a single dataset-backed management view
- visible data state and delete state should remain in one place
- nested structure would imply broader read or edit capability than v1 actually supports

## Outer layout

## Recommended page skeleton

```text
PageSection
└── Flex vertical gap={16}
    ├── Status/actions card
    └── Definitions table card
```

The page heading remains `Assignments`.

The summary copy should be updated from the current placeholder so it reflects definition management rather than marking work. Recommended summary copy:

`Review assignment-definition partials and remove obsolete definitions without loading full task data.`

## Recommended top-level UI components

### 1. `PageSection`

Use `PageSection` for:

- the shared page heading and summary chrome
- consistent shell spacing with Dashboard and Settings

Reason:

- it preserves the established page wrapper used by the current shell
- it keeps Assignments aligned with the existing navigation views

### 2. `Flex` with vertical stacking

Use `Flex` for:

- the owned Assignments surface stack
- responsive wrapping of toolbar actions inside the status/actions region

Reason:

- the existing frontend already uses Ant `Flex` for stacked management surfaces
- Ant `Flex` supports `gap` and wrap behaviour without feature-local spacing utilities

### 3. `Card`

Use `Card` for:

- the status/actions region
- the table region

Reason:

- cards match the existing management-panel pattern used in Settings
- they keep status, controls, and data visually grouped without introducing another navigation layer

### 4. `Alert`

Use `Alert` for:

- blocking load or trust failures
- delete success feedback
- delete failure feedback

Reason:

- frontend guidance already prefers `Alert` for hard-failure treatment
- page-local alerts keep status visible during retries and post-delete refresh handling

## Region-by-region design

## 1. Status and actions region

### Components

- `Card`
- `Flex`
- `Space`
- `Alert`
- `Button`
- `Typography.Text`

### Content

This region owns:

- the page-local alert stack for blocking, success, and error feedback
- the manual retry / refresh trigger
- disabled placeholder `Create assignment` and `Update assignment` buttons
- a short helper note explaining that create and update are not available in v1

### Recommended structure

```text
Status/actions card
└── Flex vertical gap={12}
    ├── Alert stack
    └── Flex wrap gap={8} justify="space-between"
        ├── Left: helper copy
        └── Right: action buttons
            ├── Retry / refresh
            ├── Create assignment (disabled placeholder)
            └── Update assignment (disabled placeholder)
```

### States

1. **Initial loading**
   - Render the card immediately below the page summary.
   - Show skeleton treatment for the action row.
   - Do not show success or error alerts before a real outcome exists.
2. **Ready**
   - Show the retry / refresh button.
   - Show disabled placeholder create/update buttons.
   - Show helper copy that these buttons are not available in v1.
3. **Delete success**
   - Show a success `Alert` in this region.
   - Keep the rest of the page visible while the feedback is present.
4. **Delete failure**
   - Show an error `Alert` in this region.
   - Keep the row data visible so the user can review and retry.
5. **Blocking failure**
   - Show a blocking error `Alert` with retry / refresh.
   - Keep the page heading and this card visible.
   - Suppress the normal table region until trustworthy data returns.

### Notes

- The retry / refresh button must refetch `assignmentDefinitionPartials` only.
- The placeholder buttons must stay disabled in all states in v1.
- The placeholder buttons must not open a modal, navigate, or imply edit availability.
- The disabled `Update assignment` placeholder must not introduce row selection or any hidden edit state in v1.
- Do not rely on tooltip-only copy to explain disabled placeholders; keep an always-visible helper note.

## 2. Assignment definitions table region

### Components

- `Card`
- `Table`
- `Button`
- `Empty`

### Recommended structure

```text
Definitions table card
├── Card title: "Assignment definitions"
├── Card extra: reset sort and filters button
└── Table
    ├── Title
    ├── Topic
    ├── Year group
    ├── Document type
    ├── Last updated
    └── Actions
```

### States

1. **Initial loading**
   - Show a shape-matched skeleton in place of the table body and table controls.
   - Do not render stale or placeholder row data.
2. **Ready with data**
   - Show the table with validated rows only.
   - Apply the default sort from `SPEC.md`.
   - Keep filter controls and reset control visible.
3. **Ready with no data**
   - Show the table card with an `Empty` state in the table region.
   - Keep the retry button available in the status/actions card.
4. **Refresh in progress**
   - Keep the table visible.
   - Mark the data workflow region busy instead of reverting to a full-page skeleton.
5. **Blocking failure**
   - Hide this card completely when the Assignments surface has no trustworthy payload.

### Notes

- Use `definitionKey` as the row key.
- Keep the v1 table unpaginated unless the approved planning docs change later.
- Do not add row selection, bulk actions, row expansion, or inline editing.
- Do not make the row itself clickable.
- `createdAt` stays out of the visible columns in v1.

## Data-heavy regions

### Recommended components

- `Table`
- `Button`
- `Empty`

### Core features to use

- row key: `definitionKey`
- built-in column filters for each displayed data column
- deterministic local sort and filter reset control
- card-level reset button rather than hidden per-column-only reset behaviour
- no pagination in v1

### Recommended columns, fields, or cells

1. `primaryTitle`
2. `primaryTopic`
3. `yearGroup`
4. `documentType`
5. `updatedAt`
6. row-level delete action

### Filter behaviour

1. `primaryTitle`, `primaryTopic`, and `documentType` filters use exact option-value matching against raw row values.
2. `yearGroup` filter uses stringified values and renders `null` as `—`.
3. `updatedAt` filter uses displayed `DD/MM/YYYY` labels and renders `null` as `—`.
4. The reset control restores the default sort and clears all active filters in one action.

### Column rendering rules

1. **Title**
   - Render as plain text, not a link.
2. **Topic**
   - Render as plain text.
3. **Year group**
   - Render explicit unset state as `—`.
4. **Document type**
   - Render the raw domain value from the validated payload.
5. **Last updated**
   - Render the approved display label derived from `updatedAt`.
   - Render explicit unset state as `—`.
6. **Actions**
   - Render a row-level delete trigger only.
   - Keep delete disabled for rows whose keys are visible but not safely deletable.

### States

1. **Initial load in progress**
   - Show table-shaped skeleton treatment.
2. **Ready with data**
   - Show the full table.
3. **Ready with no data**
   - Show the table shell with `Empty`.
4. **Mutation in progress**
   - Keep the table visible.
   - Disable conflicting delete actions while the delete mutation is active.
5. **Post-delete refresh failure**
   - Transition back to the page-level blocking-failure treatment defined above.

## Secondary workflow surface

## Delete confirmation modal

### Components

- `Modal`
- `Typography.Text`

### Purpose

This is the only secondary workflow surface in v1.

### Behaviour

1. Launch from an enabled row-level delete action only.
2. Show the assignment title in the confirmation copy.
3. State clearly that the delete is permanent.
4. Use modal confirm-loading while the delete request is in flight.
5. Disable conflicting delete launches on the page while the modal submit path is active.
6. Close on success before the post-delete refetch settles back into the page surface.
7. On failure, keep the table visible and return feedback to the page-local alert region rather than leaving a silent failure.

### Explicit non-goals

- no `Popconfirm`
- no inline row expansion confirmation
- no delete drawer

## Responsive behaviour

1. Keep the page as a single-column stack at all supported widths.
2. Let the action buttons wrap within the status/actions card rather than forcing a horizontal overflow row.
3. Keep the table layout as a table on smaller screens; do not switch to a separate card-list layout in v1.
4. If horizontal pressure appears on smaller screens, prefer table scrolling over hiding approved columns.
5. Keep the reset button and retry button visible without requiring a separate overflow menu in v1.

## Accessibility and motion expectations

1. Keep the page heading and summary available regardless of data state.
2. Give the owned data workflow region an explicit accessible label such as `Assignments management panel`.
3. Expose `aria-busy` on the owned data workflow region during refresh or delete-driven refresh work.
4. Give the table an explicit `aria-label`.
5. Ensure the blocking error `Alert` and success/error mutation feedback remain in reading order above the data region.
6. Return focus predictably after the delete modal closes.
7. Keep reduced-motion behaviour aligned with shared shell defaults; do not add bespoke animation to this surface.

## Out of scope for this layout

- functional create workflow
- functional update workflow
- full-definition view or fetch
- bulk actions
- secondary tabs or nested routes
- row details panel
- archived, duplicate, or restore flows
