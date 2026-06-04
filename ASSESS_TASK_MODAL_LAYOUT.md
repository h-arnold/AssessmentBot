# Assess Task Modal — Layout Specification

## Purpose

This document defines the layout, component choices, and user-visible states for the **Assess Task modal** launched from the Classes page.

Use it alongside:

- `SPEC.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the modal hierarchy and its relationship to the Classes page
2. the major visible regions inside the modal
3. the preferred Ant Design components for each region
4. the user-visible states of the modal surface
5. responsive and accessibility expectations

This document does **not** redefine:

- backend contracts settled in `SPEC.md`
- the modal state machine already defined in `SPEC.md`
- shared frontend policies in canonical developer docs

## Design principles

1. The modal is a simple selection workflow — not a form, not a wizard.
2. Keep the modal thin: dropdown, confirmation text, two footer actions.
3. Use built-in Ant Design behaviours before creating bespoke interaction patterns.
4. Follow the modal error pattern from `frontend-modal-patterns.md` §7: errors stay inside the modal; the modal stays open.
5. Default modal width; no wide-data token needed.

## Ant Design references consulted

- [Modal](https://ant.design/components/modal)
- [Select](https://ant.design/components/select)
- [Button](https://ant.design/components/button)
- [Alert](https://ant.design/components/alert)
- [Empty](https://ant.design/components/empty)
- [Spin](https://ant.design/components/spin)
- [Space](https://ant.design/components/space)
- [Typography](https://ant.design/components/typography)
- [Tooltip](https://ant.design/components/tooltip)

## Surface hierarchy

```text
ClassesPage
└── YearGroupPanel (Collapse.Panel)
    └── ClassCard (Ant Design Card, 268 px)
        ├── ViewButton (unchanged, disabled, kept as-is)
        └── AssessTaskButton (Ant Design Button, icon-only, tooltip, replaces Edit button)
            └── AssessTaskModal (Ant Design Modal, default width)
                ├── [Loading state] Spin centred in modal body
                ├── [Error state] Alert inside modal body
                ├── [Empty state] Empty component inside modal body
                └── [Ready state]
                    ├── SelectLabel (Typography.Text: "Select assignment")
                    ├── AssignmentSelect (Ant Design Select)
                    ├── SelectedAssignmentTitle (Typography.Text type="secondary", conditional)
                    └── Modal footer
                        ├── Cancel (Ant Design Button)
                        └── Start Assessment (Ant Design Button type="primary", disabled when no selection)
```

The Assess Task button **replaces** the current disabled "Edit" button in the card body. The disabled "View" button is **unchanged** and remains alongside the new Assess Task button.

## Region-by-region design

### 1. AssessTaskButton (card-level trigger)

**Components**: `Button` with `icon` prop and `Tooltip`.

**Content**:

- Icon only (no visible text). Any Ant Design icon suggestive of assessment or task review is acceptable (e.g., `AuditOutlined`, `CheckSquareOutlined`, `FormOutlined`).
- Tooltip text: "Assess Task".

**States**:

- Always enabled when the card is rendered (the button does not depend on reference-data readiness).

### 2. AssessTaskModal shell

**Components**: `Modal`.

**Props**:

- `title`: `"Assess Task — {className}"` where `className` comes from the card's `ClassPartial`.
- `open`: controlled by parent state.
- `onCancel`: closes the modal and discards selection.
- `footer`: custom footer with Cancel and Start Assessment buttons (not the default OK/Cancel pair).

**Width**: default Ant Design modal width (520 px). No custom width token.

**Keyboard**: `Escape` closes the modal (default Ant Design behaviour). The Select component handles its own keyboard navigation (ArrowUp/ArrowDown to navigate options, Enter to select).

### 3. Loading state

**Components**: `Spin` centred in the modal body.

**Content**: A centred spinner. No skeleton is appropriate here because the content is a dropdown — a shape-matched skeleton for a dropdown would be a thin rectangle that a spinner communicates more clearly.

**Footer**: Cancel button and a disabled Start Assessment button. The Start Assessment button is always rendered (never conditionally removed) to keep the footer layout stable across states.

### 4. Error state

**Components**: `Alert` (type `error`) inside the modal body, replacing the Select area.

**Content**: Error message describing the fetch failure. No dropdown is shown.

**Footer**: Cancel button and a disabled Start Assessment button.

### 5. Ready state (no selection)

**Components**: `Space` (vertical) containing `Select` and a placeholder for the selected title.

**Content**:

- `Select` with `placeholder="Select an assignment"`.
- Options populated from the fetched assignment list, each with `value={assignmentId}` and `label={title}`.
- The selected-title area renders nothing when no assignment is selected (or renders a zero-height placeholder to prevent layout shift).

**Footer**: Cancel button and a disabled Start Assessment button.

### 6. Ready state (selection made)

**Components**: `Space` (vertical) containing `Select` (with value) and `Typography.Text` showing the selected title.

**Content**:

- `Select` shows the currently selected assignment.
- Below the Select: `Typography.Text type="secondary"` displaying the selected assignment's title as confirmation.

**Footer**: Cancel button and an enabled `Button type="primary"` labelled "Start Assessment".

### 7. Empty state (no assignments for course)

**Components**: Ant Design `Empty` component inside the modal body.

**Content**: "No assignments found for this class" (exact copy deferred to implementation). The Select is not rendered.

**Footer**: Cancel button and a disabled Start Assessment button.

## Responsive behaviour

- The modal uses default Ant Design responsive behaviour. On narrow viewports (< 576 px), the modal becomes full-width automatically.
- The Select component handles overflow with its built-in dropdown positioning.
- The card trigger button stays at 268 px max-width per the existing card layout.

## Accessibility

- The modal title (`"Assess Task — {className}"`) serves as the accessible name for the modal.
- The Select must have a visible `Typography.Text` label ("Select assignment") placed above it. The visible label serves both sighted and screen-reader users. Do not rely on `aria-label` alone — invisible affordances alone are not sufficient for sighted users.
- The selected-title confirmation text provides feedback that an assignment has been chosen.
- The Start Assessment button's enabled/disabled state communicates actionability.
- The card trigger button is icon-only and must have `aria-label="Assess Task"`. The `Tooltip` component sets `aria-describedby`, not `aria-label`, so it cannot serve as the accessible name. Both `aria-label` and tooltip are required.
- Follow `frontend-modal-patterns.md` §8 for accessibility rules on modals and buttons.

## Motion

- The modal inherits the global reduced-motion behaviour from `AppThemeShell`. When the OS signals `prefers-reduced-motion: reduce`, modal open/close transitions are disabled via the Ant Design `motion` theme token.
- The `destroyOnHidden` prop is not set on this modal (defaults to `false`). Unlike form-scaffold modals that use `destroyOnHidden` for form reset, this modal has no form state to reset. Keeping the DOM intact between opens avoids unnecessary remounts. However, the modal's internal state (selection, loading, error) must be reset on each open — the caller is responsible for this via a `key={classId}` or an explicit reset effect. The `SPEC.md` rule that "reopening the modal for the same class always triggers a fresh fetch" already implies this.

## Start Assessment click behaviour

- When clicked (in the enabled state), the button must show no loading spinner, no disabled transition, and no visual state change beyond the native click feedback. It is a pure no-op placeholder for future wiring.
- This is a deliberate deviation from the standard `frontend-loading-and-width-standards.md` §6 short-running-mutation pattern — there is no mutation here, so no confirm-loading state is appropriate.
