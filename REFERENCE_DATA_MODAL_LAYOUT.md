# Classes Reference-Data Modal Family Layout Specification

## Status

- Draft v1.0

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the extracted classes reference-data modal scaffold.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-testing.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, shared modal policy, or implementation plan.

## Scope of this document

This document covers:

1. the scaffold hierarchy for the current cohort and year-group callers and the accepted next topic caller
2. the placement and sizing of the top-level create action
3. the preferred Ant Design primitives for the scaffold body and slots
4. the user-visible states that affect whether the action is shown, hidden, or stays visible
5. the accessibility expectations for text-plus-icon action buttons in this modal family

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- existing inline form and delete-dialog structure beyond their relationship to the scaffold slots
- unrelated page-level or modal-level action-button standards outside this modal family

## Design principles

1. Keep the existing modal workflow recognisable and minimally changed.
2. Treat the create control as a normal modal action, not as a banner-style call to action.
3. Preserve one clear visual starting point for the modal body and top action row.
4. Extract only the outer shell and slot layout that is already duplicated across current callers.
5. Keep the visible label as the primary source of meaning; the icon only reinforces it.
6. Preserve stable accessible names and browser-test selectors while improving the visual layout.

## Ant Design references consulted

- [Buttons design guidance](https://ant.design/docs/spec/buttons.md)
- [Icons design guidance](https://ant.design/docs/spec/icon.md)
- [Alignment design guidance](https://ant.design/docs/spec/alignment.md)
- [Button component](https://ant.design/components/button)
- [Flex component](https://ant.design/components/flex)
- [Modal component](https://ant.design/components/modal)
- [Table component](https://ant.design/components/table)

## Surface hierarchy

```text
ReferenceDataManagementModalScaffold
└── Ant Design Modal
    ├── Standard Cancel footer
    ├── Modal body stack [one of]:
    │   ├── Blocking state region (initial load or blocking failure)
    │   └── Ready state region
    │       ├── Refresh status region (conditional)
    │       ├── Top action row
    │       │   └── Primary create button with leading icon
    │       ├── Inline warning/error slot (conditional)
    │       └── Reference-data table slot
    └── Inline dialog slot (conditional, rendered as sibling of modal body)
```

This is the supported family entry pattern for the current extraction. No nested routes, drawers, or secondary navigation layers should be added for this surface.

Caller-owned shell inputs that remain configurable in this phase:

- modal title
- modal class name
- modal width
- create action label
- table empty-state copy
- refresh-status copy

## No extra navigation layers

The scaffold should avoid nested tabs, accordions-as-navigation, or additional toolbar rows.

Rationale:

- the current workflow is already shallow and understandable
- the change concerns one shared outer shell, not navigation complexity
- extra layers would increase visual noise for a narrow family scaffold

## Outer layout

The scaffold relies on Ant Design `Modal` defaults for modal-body overflow and scroll behaviour. No explicit overflow or scroll policy is set; Ant Design handles scroll when modal content exceeds the viewport height. The caller-supplied `modalWidth` is the only width input; the scaffold does not impose a fixed height or override the default modal-body padding.

## Recommended modal-body skeleton

```text
Modal
├── Modal body (Flex, vertical) [one of]:
│   ├── Blocking: Skeleton or blocking Alert
│   └── Ready:
│       ├── Status text (conditional)
│       ├── Start-aligned action row
│       ├── Feature-specific alert slot (conditional)
│       └── Table slot
└── Inline dialog slot (sibling of modal body, conditional)
```

## Recommended top-level UI components

### 1. `Modal` for the shared shell

Use `Modal` for:

- family-owned outer shell rendering
- standard close wiring and single `Cancel` footer action

Reason:

- both current callers already duplicate the same footer and close pattern
- moving that pattern into the scaffold is part of the agreed extraction boundary

### 2. `Flex` for scaffold-body stacking

Use `Flex` for:

- vertical spacing between status, action row, alerts, and table
- a distinct action-row wrapper that avoids the current cross-axis stretch effect on the button

Reason:

- it preserves the existing layout primitive already used by both modals
- it allows the extracted scaffold to own the duplicated composition without widening into a generic app-wide wrapper

### 3. `Button` for the create action

Use `Button` for:

- the single primary create action in ready state

Reason:

- Ant Design button guidance treats a wide call-to-action treatment as a special case rather than a default modal-body pattern
- the button can carry a leading icon without changing the action wording

### 4. `Table` for the data region slot

Use `Table` for:

- the existing cohort and year-group lists
- the accepted next topic list surface

Reason:

- the scaffold should position the data region consistently without owning entity-specific column definitions

## Region-by-region design

## 1. Blocking state region

### Components

- `Skeleton`
- `Alert`

### Content

- shape-matched loading state for initial load
- blocking error state when no trustworthy data is available

### States

1. **Initial loading**
   - render the existing loading region
   - hide the action row and table slot
2. **Blocking failure**
   - render the existing blocking `Alert`
   - hide the action row and table slot

### Notes

- this surface keeps the existing fail-closed behaviour
- the create action is part of ready state only

## 2. Top action row

### Components

- `Flex`
- `Button`

### Recommended structure

```text
Top action row
└── Primary create button
    ├── decorative leading icon
    └── entity-specific text label
```

### States

1. **Ready**
   - render one start-aligned primary button above the table slot
   - keep the button width equal to its content width rather than the full modal-body width
2. **Background refresh**
   - keep the action row visible
   - preserve the current modal busy semantics
3. **Empty**
   - keep the action row in the same position above the empty table state

### Notes

- the button must not use a full-width presentation for this modal family
- the action row should share the same left starting edge as the table slot and status content
- the button uses `PlusOutlined` by default
- the scaffold owns `PlusOutlined` as the internal default in this phase
- a workflow-specific Ant Design icon may replace `PlusOutlined` only when explicitly justified in a future spec

## 3. Data table slot

### Components

- `Table`
- existing row action buttons and switch controls where relevant

### Content

- cohort, year-group, or future topic rows
- existing empty-state copy from the table locale

### States

1. **Ready with data**
   - render the table below the action row
2. **Ready with no data**
   - render the same action row above the table empty state
3. **Background refresh**
   - keep trusted table content visible under the current busy-state treatment

### Notes

- the scaffold owns placement, not the entity-specific column contract
- the scaffold also preserves caller-supplied empty-state copy instead of standardising one family-wide string in this phase
- the scaffold preserves caller-supplied refresh-status copy instead of standardising one family-wide message in this phase

## 4. Inline dialog slot

### Components

- existing `InlineDialog`
- existing shared create/edit and delete dialog helpers

### States

1. **Create/edit open**
   - render the existing inline form dialog inside the modal body
2. **Delete open**
   - render the existing inline delete dialog inside the modal body

### Notes

- the inline dialog slot is rendered as a sibling of the modal body `Flex` container inside the `Modal` shell, not inside the `Flex` stack; this matches the existing pattern in `ManageCohortsModal` and `ManageYearGroupsModal` where form and delete dialog sections are siblings of the ready-state body at the `<Modal>` level
- this standard does not relocate or redesign the inline dialog family
- the create action above the table remains the entry point into the create dialog

## Footer ownership

### Standard footer

- the scaffold owns one footer button labelled `Cancel`
- the footer button closes the modal through the caller-supplied `onClose`
- the modal close icon, mask-close path, and keyboard-close path also delegate through that same caller-supplied `onClose`
- callers do not provide custom footer content or parallel shell-close wiring in this phase

## Accessibility and interaction expectations

1. The create button must remain discoverable by its visible text label, for example `Create cohort`.
2. The leading icon is decorative and should not introduce a second spoken label that competes with the button text.
3. The decorative icon wrapper must expose `data-testid="reference-data-create-action-icon"` so tests do not rely on incidental Ant Design SVG structure.
4. The button remains a text-plus-icon control, not an icon-only control.
5. Keyboard and pointer interaction continue to open the same inline create dialog as today.
6. Browser tests should be able to find the button by role and visible name, while icon-presence checks use the explicit stable seam rather than incidental SVG markup.

## Responsive and width expectations

1. The button should render at content width in typical desktop modal widths.
2. The button should align to the main content column or table-slot start edge within an 8 px tolerance.
3. The button width should remain at least 32 px narrower than the main content region so it does not read as full width.
4. The button should remain start-aligned on narrower widths rather than stretching across the modal body.
5. No separate mobile-only full-width treatment is introduced by this change.
6. The scaffold must honour caller-supplied modal widths rather than collapsing the family onto one width without a later explicit decision.
