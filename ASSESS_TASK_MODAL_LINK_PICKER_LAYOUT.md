# AssessTask Modal — "Link to Existing Definition" Picker Layout Specification

## Status

- Draft v1.0

## Purpose

This document defines the explicit layout, component hierarchy, and user-visible
states for the new `LinkableDefinitionList` workflow surface inside the existing
`AssessTaskModal`. It is the UI-focused companion to
[`SPEC.md`](./SPEC.md) and must be read alongside it; this document
intentionally does not redefine the contracts, scope, or sequencing that
`SPEC.md` already settles.

Use it alongside:

- [`SPEC.md`](./SPEC.md) — feature spec, contracts, scope boundaries
- [`ACTION_PLAN.md`](./ACTION_PLAN.md) — implementation sequencing
- [`docs/developer/frontend/frontend-modal-patterns.md`](./frontend/frontend-modal-patterns.md) — modal family registry
- [`docs/developer/frontend/frontend-loading-and-width-standards.md`](./frontend/frontend-loading-and-width-standards.md) — modal loading and width rules
- [`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`](./frontend/frontend-shared-helpers-and-abstraction-standards.md) — shared-helpers conventions

## Scope of this document

This document covers:

1. The visible region of the new "Link to Existing Definition" sub-flow inside
   the existing `AssessTaskModal`.
2. The Ant Design primitive choices for the picker and the choice-prompt
   buttons.
3. The user-visible states of the picker (initial, ready, error, loading,
   success).
4. The accessibility and keyboard-navigation behaviour of the picker.
5. The relationship between the new sub-flow and the existing choice-prompt
   layout (Create New Definition button + Link to Existing Definition button).

This document does **not** redefine:

- Backend contracts already settled in `SPEC.md`.
- Rollout or sequencing decisions already settled in `ACTION_PLAN.md`.
- Shared frontend policies already defined in canonical developer docs.
- The matcher's case-insensitive trimmed equality, the orchestrator's
  `_resolveAlternateTopics`, the Zod schema extension, or any other
  implementation-level detail.

## Design principles

1. Keep the new picker inside the existing `AssessTaskModal` rather than as a
   nested modal. The existing `noMatchResolution` state machine
   (`'idle' | 'choice' | 'creating' | 'linking'`) and `assessmentState` state
   machine (`'idle' | 'loading' | 'success' | 'error'`) already model this
   flow's lifecycle.
2. Reuse Ant Design primitives for built-in accessibility, single-selection,
   and keyboard-navigation behaviour. Do not reimplement these.
3. Keep the choice-prompt layout consistent with the existing
   "Create New Definition" + (now) "Link to Existing Definition" two-button
   `Space` pattern.
4. The picker list is short (one or two dozen rows expected). No virtual
   scrolling, no in-picker search, no pagination in v1.
5. The picker reads from local modal state (cached `AssignmentDefinitionPartial`
   rows) — no loading affordance is needed for the picker itself; the
   loading affordance applies to the post-selection upsert + start-assessment
   run.
6. **Every row in the picker is always selectable.** The "already linked"
   concept was considered and removed per stakeholder decision. If the
   matcher found a match (`'matched'` or `'ambiguous'`), the link flow would
   not be triggered; if the matcher returned `'no-match'`, then no definition
   currently covers the assignment's title+topic combination, so every
   definition in the picker is a valid link target.

## Ant Design references consulted

List of official Ant Design v6 components materially informing this layout:

- [`Modal`](https://ant.design/components/modal) — the existing outer modal
  (no change to the modal API; the picker is a body branch).
- [`Alert`](https://ant.design/components/alert) — the existing no-match Alert
  in the choice prompt (unchanged) and the success/error Alerts in the
  post-link flow.
- [`Button`](https://ant.design/components/button) — the existing "Create New
  Definition" + new "Link to Existing Definition" buttons in the choice
  prompt; the new "Link" and "Cancel" buttons in the picker footer; the
  existing "Close" button in the success footer.
- [`Tooltip`](https://ant.design/components/tooltip) — the tooltip on the
  disabled "Link to Existing Definition" button when the picker would be
  empty; the tooltip on the disabled "Link" button when no row is selected.
- [`Spin`](https://ant.design/components/spin) — the post-selection loading
  affordance when `assessmentState === 'loading'` (same pattern as the
  wizard-creation loading state).
- [`Radio`](https://ant.design/components/radio) / [`Radio.Group`](https://ant.design/components/radio) — the
  picker primitive. Supports single selection, `orientation="vertical"` for a
  list-of-rows feel, and built-in keyboard navigation (arrow keys via the
  `name` prop group).
- [`Flex`](https://ant.design/components/flex) — the inner layout of each
  `Radio` row (vertical stack of title and subtitle).

The Ant Design v6 [`List`](https://ant.design/components/list) component is
**avoided** for this picker. The official `List` docs note that the component
is "deprecated" as of v6 and "will be removed in the next major version"
in favour of the forthcoming `Listy` component. The picker must not depend
on `List` because: (a) it is slated for removal; (b) `Radio.Group` is a
strictly better fit for the use case regardless of deprecation status
(built-in single selection, vertical orientation, and keyboard navigation
are all first-class on `Radio.Group` and would each require custom code on
`List`).

## Surface hierarchy

```text
AssessTaskModal (existing)
└── Body — four orthogonal states
    ├── fetchState === 'loading'           → Spin
    ├── fetchState === 'error'             → Alert
    ├── assignments.length === 0           → Empty
    └── fetchState === 'ready'
        └── noMatchResolution sub-state
            ├── 'idle'                     → assignment Select (existing)
            ├── 'choice'                   → choice prompt Alert + 2 buttons
            │   ├── "Create New Definition" (Button, primary, existing)
            │   └── "Link to Existing Definition" (Button, new)
            │       └── disabled-with-Tooltip when picker would be empty
            ├── 'creating'                 → AssignmentDefinitionWizardModal (existing)
            └── 'linking' (NEW)            → LinkableDefinitionList (new) + Link + Cancel
```

The new `LinkableDefinitionList` is rendered in the `'linking'` sub-state of
the existing `noMatchResolution` machine. It is **not** a new modal. The
post-link `assessmentState` (`'loading' | 'success' | 'error'`) reuses the
existing modal's loading / success / error body patterns (Spin / Alert /
Alert).

## No extra navigation layers

The picker is rendered inline in the existing modal body, not as a nested
modal, drawer, or accordion. The state machine (Decision 11 in `SPEC.md`)
explicitly extends `noMatchResolution` with `'linking'` and reuses
`assessmentState` rather than introducing a parallel state machine.

Rationale:

- **Usability** — the user is performing a single decision (link to one
  definition) as a sub-step of a single workflow (assess a Google Classroom
  assignment). A nested modal would interrupt that workflow and require the
  user to remember context.
- **State visibility** — the choice prompt, picker, loading, success, and
  error are all visible states of the same owned surface (the modal body).
  Rendering them as one continuous flow keeps the user's mental model
  simple.
- **Implementation simplicity** — the existing modal's body and footer
  functions already switch on `noMatchResolution` and `assessmentState`. The
  new branches slot in without a parallel state machine.

## Outer layout

### Recommended page skeleton

```text
AssessTaskModal
└── <Modal>
    └── <Modal body>
        ├── <no-match Alert>          (existing, in 'choice' state; also in 'linking' state)
        ├── <LinkableDefinitionList>  (NEW, in 'linking' state only)
        │   └── <Radio.Group orientation="vertical" block>
        │       ├── <Radio value={definitionKey}>
        │       │   └── <Flex vertical gap={2}>
        │       │       ├── <Typography.Text strong ellipsis={{ rows: 1 }}>primaryTitle</Typography.Text>
        │       │       └── <Typography.Text type="secondary" ellipsis={{ rows: 1 }}>primaryTopic · yearGroupLabel</Typography.Text>
        │       │   </Flex>
        │       └── <Radio ...> ... </Radio>
        └── <Wizard or empty>          (existing, in 'creating' state)
    └── <Modal footer>
        └── (existing 2-button / Cancel / Close switch, extended for 'linking')
```

### Recommended top-level UI components

#### 1. `Modal` (existing)

Use `Modal` for:

- The outer container of the AssessTask modal.

No change to the modal API. The picker renders as a modal body branch in the
`'linking'` sub-state.

#### 2. `Space` + `Flex` (existing patterns)

Use `Space` for:

- The button row in the choice prompt (existing pattern; extended with the
  new "Link to Existing Definition" button).
- The picker footer button row (Link + Cancel).

Use `Flex` or `Space.Compact` for:

- The vertical spacing between the no-match Alert, the picker list, and the
  picker footer (existing modal body pattern).

Reason:

- These are the existing modal's spacing primitives. Reusing them keeps the
  picker's visual rhythm consistent with the rest of the modal.

#### 3. `Alert` (existing)

Use `Alert` for:

- The no-match explanation in the choice prompt (existing).
- The success Alert in the post-link `assessmentState === 'success'`
  state (mirrors the wizard-success Alert).
- The error Alert in the post-link `assessmentState === 'error'` state
  (mirrors the wizard-error Alert).

Reason:

- `Alert` is the canonical blocking-state primitive per
  `frontend-loading-and-width-standards.md` §2.2 and per
  `src/frontend/AGENTS.md` §5.1.

#### 4. `Tooltip` (existing)

Use `Tooltip` for:

- The disabled "Link to Existing Definition" button in the choice prompt when
  the picker would be empty (no definitions match the class's year group).
- The disabled "Link" button in the picker footer when no row is selected.

Reason:

- `Tooltip` keeps the disabled state informative without forcing the user
  into a secondary workflow to discover why the button is disabled.

#### 5. `Radio.Group` (NEW)

Use `Radio.Group` for:

- The `LinkableDefinitionList` picker. Set `orientation="vertical"` and
  `block` (full-width options) to render the picker as a list of clickable
  rows. Use **JSX children** (one `<Radio>` per `LinkableDefinition`) rather
  than the `options` prop. The `options` prop is restricted to plain-string
  labels and does not support the rich per-row content (title +
  `Typography.Text` subtitle) the picker requires; mixing `options` with
  rich JSX children is not supported. The `Radio.Group` JSX-children
  pattern is:

  ```tsx
  <Radio.Group
    value={selectedDefinitionKey}
    onChange={onSelect}
    orientation="vertical"
    block
    name="linkable-definition"
  >
    {linkableDefinitions.map((def) => (
      <Radio key={def.definitionKey} value={def.definitionKey}>
        <Flex vertical gap={2}>
          <Typography.Text strong ellipsis={{ rows: 1 }}>
            {def.primaryTitle}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis={{ rows: 1 }}>
            {def.primaryTopic} · {def.yearGroupLabel}
          </Typography.Text>
        </Flex>
      </Radio>
    ))}
  </Radio.Group>
  ```

Reason:

- Built-in single-selection, vertical orientation, and keyboard navigation
  (arrow keys via the `name` prop group). Avoids reimplementing well-trodden
  interaction patterns. The `List` component is explicitly avoided (see
  "Ant Design references consulted" above).
- Every row is always selectable — no `disabled` prop is used.

#### 6. `Spin` (existing)

Use `Spin` for:

- The post-selection loading affordance when
  `assessmentState === 'loading'` (same pattern as the wizard-creation
  loading state).

## Region-by-region design

## 1. Choice prompt (existing body branch, extended)

### Components

- `Alert` (existing, no-match explanation)
- `Space` (existing button row)
- `Button` × 2 (existing "Create New Definition" + new "Link to Existing Definition")
- `Tooltip` (NEW, around the new button when disabled)

### Content

The choice prompt is unchanged in copy, except for the addition of the new
"Link to Existing Definition" button next to the existing "Create New
Definition" button. The `Alert` body remains the no-match explanation
including the Google Classroom assignment title.

### States

1. **Both buttons enabled** (the modal is in `'choice'` state and at least one
   definition matches the class's `yearGroupKey`).
   - Body: `Alert` (no-match explanation).
   - Footer: Cancel.
   - Buttons: "Create New Definition" (primary) + "Link to Existing
     Definition" (default), both enabled.
2. **Link button disabled with Tooltip** (the modal is in `'choice'` state
   and the picker would be empty — no definition matches the class's
   `yearGroupKey`).
   - Body: `Alert` (no-match explanation).
   - Footer: Cancel.
   - Buttons: "Create New Definition" (primary, enabled) + "Link to Existing
     Definition" (default, disabled). The disabled button is wrapped in a
     `Tooltip` whose title is "No assignment definitions exist for this
     class's year group.".
3. **Every row already linked is not a guard condition** — the `isAlreadyLinked`
   concept was removed per stakeholder decision. Every definition that passes
   the year-group filter is a valid link target. Therefore the "all already
   linked" disabled button state is **not implemented**.

### Notes

- The button order is fixed: "Create New Definition" first (primary), "Link
  to Existing Definition" second (default). This matches the user's
  mental model: "I need to act on this Google Classroom assignment; my
  choices are create or link."
- The Tooltip on the disabled "Link to Existing Definition" button uses the
  existing Tooltip pattern (the wizard-creation cancel-confirmation modal
  uses the same wrapper). It must be keyboard-accessible (focus-then-hover).

## 2. Picker list (NEW body branch)

### Components

- `Alert` (existing no-match explanation, kept for context)
- `Radio.Group` (`orientation="vertical"`, `block`, `name` set for keyboard
  navigation)
- `Radio` (one per `LinkableDefinition`; all rows are always selectable)
- `Typography.Text` × 2 (title, subtitle)

### Recommended structure

```text
<LinkableDefinitionList>
├── <Alert type="info" description="No matching assignment definition found for '<title>'. Link to an existing definition to associate the Google Classroom assignment with it." />
├── <Radio.Group
    │     value={selectedDefinitionKey}
    │     onChange={onSelect}
    │     orientation="vertical"
    │     block
    │     name="linkable-definition">
│   ├── <Radio value={def.definitionKey}>
│   │   <Flex vertical gap={2}>
│   │     <Typography.Text strong ellipsis={{ rows: 1 }}>{def.primaryTitle}</Typography.Text>
│   │     <Typography.Text type="secondary" ellipsis={{ rows: 1 }}>{def.primaryTopic} · {def.yearGroupLabel}</Typography.Text>
│   │   </Flex>
│   │ </Radio>
│   ├── <Radio value={def.definitionKey} ...> ... </Radio>
│   └── ...
│ </Radio.Group>
```

### States

1. **Initial (no selection)**
   - The picker is visible with the Radio.Group and the no-match Alert.
   - No row is selected.
   - The Link button in the footer is disabled.
2. **Row selected**
   - One row is visually highlighted (the Radio.Group's selected state).
   - The Link button in the footer is enabled.

### Notes

- The no-match Alert copy is extended from the choice-prompt copy to read
  "Link to an existing definition to associate the Google Classroom
  assignment with it." This sets the user's expectation that the picker
  is the link action.
- There is **no** "Already linked" Tag, **no** disabled `Radio` rows,
  **no** `aria-live` summary, and **no** already-linked logic. Every row
  is always selectable. This simplification was confirmed by the
  stakeholder: if the matcher found a match, the link flow would not
  trigger; if `'no-match'` was returned, every definition in the picker
  is a valid link target.

## 3. Post-link loading (existing body pattern)

### Components

- `Spin` (existing modal loading pattern)

### Content

The body shows a centred `Spin` with no additional text. The picker is
hidden.

### States

1. **In flight**
   - The body renders a `Spin`.
   - The footer renders Cancel + a primary "Link" button with
     `loading={true}` and `disabled={true}`. The label remains "Link"
     (not "Start Assessment" — the user clicked "Link", not "Start
     Assessment", and the button label should match the action the
     user initiated; "Start Assessment" is the matched-path label and
     would be misleading here).
2. **Cancellation by the user**
   - The user can click Cancel to close the modal mid-flight. The
     optimistic state of the modal is reset to `'linking'` + `'idle'`
     on next open.

## 4. Post-link success (existing body pattern)

### Components

- `Alert` (success)

### Content

The body shows a success `Alert` with the Google Classroom assignment's
title ("Assessment started for '<title>'.", identical copy to the
wizard-success and matched-success flows). The picker is hidden.

### States

1. **Visible**
   - The body renders the success Alert.
   - The footer renders a single Close button (mirrors the wizard-success
     footer).
2. **Closed by the user**
   - Clicking Close calls the modal's `onClose` callback, which closes the
     modal and resets the state machine for next open.

## 5. Post-link error (existing body pattern)

### Components

- `Alert` (error)

### Content

The body shows an error `Alert` with the backend's `error.message` text.
The picker is hidden.

### States

1. **Visible**
   - The body renders the error Alert.
   - The footer renders a Cancel button.
   - When `hasLinkSucceeded === true` (upsert committed, assessment run
     failed with a non-recoverable error), the error Alert explains that
     the link was committed but the assessment could not be started.
     The footer shows a single Close button.
   - When `hasLinkSucceeded === false` (upsert failed), the error Alert
     describes the failure and the footer shows a single Cancel button
     that closes the modal.
2. **`DEFINITION_STALE` recovery** — when `startAssessmentRun` rejects
   with `DEFINITION_STALE`, the link (the alternateTitle write) is
   **preserved** and the modal transitions to the **wizard's 2nd panel**
   (task weightings), with the document re-parsed and pre-populated from
   the stale definition. This is the same recovery path used by the
   existing wizard flow and applies to both the link flow and the
   standard wizard-create-stale flow.
3. **Closed by the user**
   - Clicking Cancel or Close closes the modal. The partials cache has been
     invalidated on the failure path (Decision 10 in `SPEC.md`), so the
     next modal open shows a freshly-refetched picker.

## Picker row interaction details

### Click behaviour

- Clicking a row selects it (the `Radio.Group`'s `value` updates)
  and enables the Link button.
- Clicking outside the picker (e.g. on the modal mask) closes the modal —
  the existing modal mask-click behaviour. This is the same as the
  choice-prompt mask-click behaviour.
- **Every row is always selectable** — there is no disabled row state.

### Keyboard behaviour

- `Tab` moves focus into the picker; subsequent `Tab` presses move focus
  through the rows and then to the Link and Cancel buttons in the footer.
- `Arrow Up` / `Arrow Down` move focus between rows within the
  `Radio.Group`. This works because Ant Design's `Radio` component renders
  native `<input type="radio">` elements with the same `name` attribute;
  browser-level radio-group keyboard navigation is a fundamental HTML
  behaviour that all browsers support. The `name` prop on the `Radio.Group`
  is propagated to each underlying `<input>`, enabling this.
- `Space` or `Enter` on a focused row selects it.
- `Enter` on the focused Link button triggers the upsert + start-assessment
  run (the same path as clicking the button).

## Workflow surfaces

The picker is the only new workflow surface in this feature. The existing
"Create New Definition" wizard remains as a peer workflow surface; the
choice-prompt body is the workflow-switching surface.

## Workflow: Link to Existing Definition

### Surface type

- Inline modal body branch (no new modal, no new drawer, no new panel).

### Trigger

- The user clicks the "Link to Existing Definition" button in the choice
  prompt.
- Eligibility rule: at least one `LinkableDefinition` exists (i.e. the
  partials cache has at least one row whose `yearGroupKey` matches the
  class's `yearGroupKey`). If zero rows exist, the button is disabled with
  a Tooltip.

### Components

- `Alert` (no-match explanation, extended copy)
- `Radio.Group` (vertical, block, single-selection)
- `Radio` (one per `LinkableDefinition`; all rows selectable)
- `Typography.Text` × 2 (title, subtitle)
- `Button` (Link, primary, disabled until a row is selected) + `Button`
  (Cancel, default)

### Layout structure

```text
Workflow surface (body of the AssessTaskModal in 'linking' state)
├── Alert (no-match explanation, extended copy)
├── Radio.Group
│   └── Radio rows (title, subtitle; all rows selectable)
└── (footer)
    ├── Button (Link, primary, disabled until a row is selected)
    └── Button (Cancel, default)
```

### States

1. **Closed** (the choice prompt is shown instead; the picker is not
   rendered).
2. **Open and ready** (the user clicked the link button; the picker is
   rendered with the filtered and sorted `LinkableDefinition[]`).
3. **Submitting** (the user clicked Link; `assessmentState === 'loading'`;
   the body shows a `Spin`; the footer shows Cancel + a disabled, loading
   "Link" button).
4. **Validation failure** (N/A — the picker has no free-form input; all
   "validation" is server-side and is rendered as a post-link error Alert).
5. **Completed** (success or error; the body shows the success or error
   Alert; the footer shows Close or Cancel).
6. **Stale recovery** (`startAssessmentRun` rejects with `DEFINITION_STALE`;
   the link is preserved and the modal transitions to the wizard's 2nd
   panel for task-weighting re-entry).

### Notes

- **Modal hierarchy rule** — the picker is not a nested modal. The existing
  `Modal` owns the entire workflow.
- **Destructive-action copy rule** — no destructive actions in the picker.
  The "Cancel" button in the picker footer returns to the choice prompt
  (per Decision 13 in `SPEC.md`); it does not destroy any data.
- **Focus-return rule** — when the picker is closed (Cancel returns to
  choice), focus returns to the "Link to Existing Definition" button in
  the choice prompt. When the modal is closed entirely (Cancel in the
  loading or success or error state), focus returns to the trigger that
  opened the modal (the "Assess Task" button on the class card).

## Global state rules

### Blocking error state

- The post-link error `Alert` replaces the body. The picker is hidden.
  The footer shows a single Cancel or Close button depending on
  `hasLinkSucceeded`.

### Partial-load state

- Not applicable. The picker reads from the cached partials; there is no
  in-flight fetch. The partials may be stale, but staleness alone does
  not trigger fail-closed behaviour per
  `frontend-loading-and-width-standards.md` §5. The upsert failure path
  invalidates the partials cache (Decision 10 in `SPEC.md`) so the next
  open shows freshly-fetched data.

### Empty state

- The choice-prompt guard handles the empty-picker case: if no definition
  matches the class's year group, the "Link to Existing Definition" button
  is disabled with a Tooltip. The picker is only reachable when at least
  one linkable definition exists, so the picker-level empty state is not
  rendered by `LinkableDefinitionList`. The modal body renders the empty
  state (or the choice-prompt handles it) at the modal's discretion.

### Success and mutation feedback

- The success `Alert` is the same primitive used for the wizard-success
  flow. The success Alert is shown until the user clicks Close (which
  closes the modal).

## Responsive behaviour

- The picker renders inside the existing `Modal`. The modal's existing
  responsive rules apply (the modal is fixed-width on desktop and
  near-full-width on mobile).
- The `Radio.Group`'s `block` prop ensures the rows span the full width
  of the modal body, which is the desired behaviour on all screen sizes.
- Title and subtitle use `Typography.Text` with
  `ellipsis={{ rows: 1 }}` to prevent horizontal overflow on narrow
  viewports. Long titles are visually truncated with an ellipsis; the
  full title is preserved in the `title` HTML attribute on the
  `Typography.Text` element via Ant Design's `ellipsis` behaviour.
  The `Radio` label slot receives accessible content from its children,
  so screen readers will read the full (non-truncated) text even when
  it is visually elided. The `title` attribute on the inner
  `Typography.Text` provides a hover tooltip for the full title.

## Accessibility and motion

- **Focus management** — when the picker opens, focus moves to the
  `Radio.Group` (specifically, the first linkable row). When the picker
  closes via Cancel, focus returns to the "Link to Existing Definition"
  button in the choice prompt.
- **Keyboard interaction** — the `Radio.Group` is a real radio group in
  the accessibility tree. Arrow keys move between rows, `Space` or
  `Enter` activates a row, `Tab` moves out of the group to the Link
  button in the footer.
- **No disabled rows** — every row is always selectable, so no `aria-live`
  summary or disabled-row compensation is needed.
- **Tooltip accessibility on disabled Link buttons** — both disabled Link
  buttons (the choice-prompt "Link to Existing Definition" button and the
  picker footer "Link" button) are wrapped in a `<span tabIndex={0}>` so
  the surrounding `Tooltip` can be triggered by keyboard focus. This
  follows the existing pattern in `AssessTaskModal.tsx` (lines 426-430).
- **No tooltip-only information** — the picker state is visible through
  the Alert, the Radio.Group, and the disabled button states. No
  critical information is hidden behind a tooltip-only surface.
- **Reduced motion** — the picker uses the default Ant Design motion
  duration, which is honoured by `prefers-reduced-motion` per the
  Ant Design v6 defaults.
- **Screen reader labelling** — each `Radio` has a `value` (the
  `definitionKey`); the `label` slot provides the accessible name
  (the title). The subtitle is read as associated text.

## Implementation guardrails

- Do not introduce alternative entry points for the link flow. The only
  trigger is the "Link to Existing Definition" button in the choice
  prompt inside `AssessTaskModal`.
- Do not duplicate domain rules from `SPEC.md` (e.g. the year-group
  filter, the `DEFINITION_STALE` recovery path). The picker consumes the
  derived `LinkableDefinition[]` produced by `getLinkableDefinitionsForModal`.
- Do not add bespoke layout abstractions when existing Ant Design
  primitives are sufficient. The `Radio.Group` is the canonical primitive
  for this picker.
- Do not add `disabled` prop on `Radio` rows — every row is always
  selectable.
- Do not add an `aria-live` summary or "Already linked" Tag — these are
  no longer part of the feature.
- Keep layout decisions aligned with existing frontend shell and
  navigation guidance.

## Open questions

None. The `Radio.Group` decision is finalised in this document; the
stakeholder has confirmed the simplification (every row always selectable);
and the spec has settled the contracts.
