# Classes Bulk Progress Modal Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the progress modal that appears during queued bulk actions on the Classes settings page.

Use it alongside:

- `SPEC.md` for domain rules, contracts, and scope boundaries
- `ACTION_PLAN.md` for implementation sequencing
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the modal hierarchy during a queued bulk action
2. the major visible regions inside the progress modal
3. the preferred Ant Design components for each region
4. the user-visible states of the progress modal
5. responsive, accessibility, and motion expectations that affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the progress modal narrow and focused: one title, one current action, one progress bar, one count, one Cancel button.
2. Avoid nested modals — input/confirmation modals close before the progress modal opens.
3. Use built-in Ant Design behaviours before creating bespoke interaction patterns.
4. Keep important status, error, and cancellation outcomes visible without forcing the user into a secondary workflow.
5. Favour layouts that remain understandable on smaller screens and in reduced-motion mode.
6. Keep responsibilities clear between the hook (state), the modal component (presentation), and the panel (composition).

## Ant Design references consulted

- [Modal](https://ant.design/components/modal)
- [Progress](https://ant.design/components/progress)
- [Flex](https://ant.design/components/flex)
- [Typography](https://ant.design/components/typography)
- [Button](https://ant.design/components/button)

## Surface hierarchy

```text
SettingsPage
└── ClassesManagementPanel
    └── ClassesBulkProgressModal (auto-opened during queued bulk actions)
        ├── Header (title "Bulk class update in progress" + close X)
        ├── Body
        │   ├── Current item text ({verb} class {className})
        │   ├── Progress bar
        │   └── Count row
        └── Footer
            └── Cancel button
```

This is the only supported entry point for the progress modal. It must not be triggered from other pages or surfaces.

## No extra navigation layers

The progress modal contains no tabs, routes, accordions, or nested navigation. It is a single-step status surface.

Rationale:

- The user only needs to observe progress and optionally cancel remaining items.
- Nested structure would slow comprehension during a long-running task.
- Implementation simplicity reduces the risk of focus and dismissal bugs.

## Outer layout

### Recommended page skeleton

```text
ClassesManagementPanel
└── Card (settings-tab-panel)
    ├── ClassesAlertStack
    ├── ClassesSummaryCard
    ├── ClassesToolbar
    ├── ClassesTable
    ├── existing bulk input/confirmation modals
    └── ClassesBulkProgressModal
```

## Recommended top-level UI components

### 1. `Modal`

Use `Modal` for:

- the progress modal shell
- the title region (title: "Bulk class update in progress")
- the footer slot that holds the Cancel button
- the close X that dismisses without cancelling

Reason:

- `Modal` is the established pattern for workflow-blocking status surfaces in this app.
- It provides mask, keyboard close, and focus management behaviour out of the box.
- The Modal's own title element renders the heading; do not wrap the title in an additional heading tag.
- It keeps the progress surface separate from the page layout without requiring z-index choreography.

### 2. `Progress` (line type)

Use `Progress` (default `type="line"`) for:

- the visual progress indicator

Reason:

- A horizontal line bar is the clearest way to show `{completed} / {total}` proportionally.
- Ant Design's line Progress uses `status="active"` while the queue is running. The modal closes automatically on drain, so the progress bar does not need a terminal `success` or `exception` state.
- The default percent text can be hidden (`showInfo={false}`) because the count is shown separately.

### 3. `Flex`

Use `Flex` for:

- vertical stacking of current-item text, progress bar, and count in the modal body
- horizontal alignment of the count to the bottom-right

Reason:

- `Flex` is the project's standard block-level layout primitive.
- It avoids ad-hoc margin strings and keeps alignment explicit.

### 4. `Typography.Text`

Use `Typography.Text` for:

- the current item label
- the count label

Reason:

- Consistent with the existing type scale and colour tokens.
- Supports `aria-live` politely for screen-reader progress announcements.

## Region-by-region design

### 1. Progress modal body

### Components

- `Flex` (vertical, gap)
- `Typography.Text`
- `Progress`

### Content

- Current item text: `{verb} class {className}`
- Progress bar: percentage derived from `completed / total`
- Count: `{completed} / {total}` aligned to the bottom-right of the body

### States

1. **Queue active, first item starting**
   - Current item text shows the first class.
   - Progress bar shows `0%` or the first small increment.
   - Count shows `0 / {total}`.
2. **Queue active, mid-batch**
   - Current item text updates to the active class.
   - Progress bar fills proportionally.
   - Count updates as items settle.
3. **Queue draining**
   - Current item text shows the final active class.
   - Progress bar approaches `100%`.
   - Count shows `{total - active} / {total}`.
4. **Queue drained**
   - Modal closes automatically.
   - No completion UI inside the modal; outcome alerts appear in the panel.

### Notes

- The current-item text and count must be wrapped in an `aria-live="polite"` region so screen readers announce updates. The live region must exist in the DOM before updates begin and should not be nested inside an `aria-busy="true"` ancestor; place it either outside the busy body or mark the live region itself `aria-busy="false"`.
- The progress bar should not show the built-in percent text (`showInfo={false}`) because the count is displayed separately.
- The modal body content (excluding the live region) should be marked `aria-busy="true"` while the queue is active.

### 2. Progress modal footer

### Components

- `Modal` footer slot
- `Button`

### Recommended structure

```text
Footer (Flex justify="flex-end")
└── Cancel button
```

### States

1. **Pending items exist**
   - Cancel button is enabled and reads "Cancel remaining".
2. **No pending items**
   - Cancel button is disabled.
3. **Queue drained**
   - Modal closes; footer is not visible independently.

### Notes

- Use a custom `footer` render so the default OK button is not shown. The footer Cancel button calls the queue-cancellation handler (`onCancelQueue`).
- The modal's standard header close X, mask click, and Escape key call the dismiss handler (`onDismissProgressModal`) and do not cancel queued items.
- The Cancel button must not be the primary OK button; it is a secondary destructive-ish action that cancels remaining work.

## Workflow surfaces

### Queued bulk action progress

### Surface type

- `Modal`

### Trigger

- User confirms a bulk action from any of the existing bulk modals or toolbar buttons on the Classes settings page.
- The triggering modal closes and the progress modal opens automatically.

### Components

- `Modal`
- `Progress`
- `Flex`
- `Typography.Text`
- `Button`

### Layout structure

```text
Modal
├── Header: "Bulk class update in progress" + close X
├── Body (Flex vertical)
│   ├── Current item text
│   ├── Progress bar
│   └── Count (right-aligned)
└── Footer
    └── Cancel button
```

### States

1. **Closed**
   - Default state; no queue active.
2. **Open and running**
   - Body shows current item, progress bar, and count.
   - Footer Cancel button enabled if pending items exist.
3. **Hidden while active (user dismissed)**
   - Modal is hidden but processing continues.
   - Toolbar and table selection remain disabled.
4. **Open and cancelling**
   - User clicked Cancel; pending items are removed.
   - Active item continues; modal stays open until drain.
5. **Completed**
   - Modal closes automatically.
   - Panel alert banner shows outcome.

### Notes

- The modal must not be `closable={false}` because the user must be able to dismiss it.
- Mask click should also dismiss (standard Modal behaviour), not cancel.
- The modal should be `centered` so it is visually stable as content updates.
- Use the default Ant Design Modal width (`520`) unless a narrower value is justified during implementation.

## Global state rules

### Blocking error state

- Blocking failures of underlying data queries continue to use the panel-level `ClassesAlertStack` and suppress the table.
- The progress modal is not shown if the panel is in a blocking error state.

### Partial-load state

- Not applicable to this surface.

### Empty state

- Not applicable: the modal only opens when at least one row is queued.

### Success and mutation feedback

- Success, partial failure, refresh failure, and cancellation summary all appear in the existing `ClassesAlertStack` after the modal closes.
- The modal itself does not show a final success/failure state.

## Responsive behaviour

- The modal width should remain the default Ant Design Modal width on desktop and adapt naturally on narrow viewports.
- The count label should stay right-aligned; on very narrow screens it may wrap below the progress bar if necessary.
- The Cancel button should remain visible and tappable on touch devices.

## Accessibility and motion

- On open, rely on Ant Design Modal's default focus behaviour, which lands focus on the close X or title region; it must not land on the Cancel button, to avoid accidental cancellation. No explicit `autoFocus` prop is required.
- Wrap the current-item text and count in an `aria-live="polite"` region.
- Mark the modal body content (excluding the live region) as `aria-busy="true"` while the queue is active.
- Ensure the close X has an accessible label such as "Close progress modal".
- Ensure the Cancel button label clearly describes the action, e.g. "Cancel remaining".
- Progress bar motion must respect `prefers-reduced-motion`; verify the Ant Design default during implementation and add an explicit reduced-motion style if needed.
- When the modal closes on drain, move focus to the first enabled button in the Classes toolbar region, or to the toolbar region container if no button is enabled.

## Implementation guardrails

- Do not introduce alternative entry points for the progress modal.
- Do not duplicate domain rules here that belong in `SPEC.md`.
- Do not add bespoke layout abstractions when existing Ant Design primitives are sufficient.
- Do not hide important cancellation outcomes inside transient surfaces only — cancellation results are surfaced through the panel alert banner.
- Keep layout decisions aligned with existing frontend shell and navigation guidance.

## Open questions

None remaining.
