# Assignment Definition Wizard Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the assignment definition create/update wizard.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the Assignments page entry points for create and update
2. the modal hierarchy and major visible regions
3. the preferred Ant Design primitives for each region
4. the user-visible states for create, update, loading, and re-parse resolution
5. responsive and accessibility expectations that materially affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the Assignments page as the sole owning surface.
2. Use one modal surface for both create and update rather than separate pages, drawers, or nested dialogs.
3. Avoid stepper-style navigation because the flow is mode-dependent and document re-parse is a conditional branch, not a fixed sequential wizard.
4. Keep document-change resolution visible inside the modal instead of hiding it behind confirmation portals.
5. Preserve visible context during refresh and short-running writes; only the affected modal region should block.
6. Keep the task-weighting surface readable without turning the modal into a second page.
7. Allow one secondary confirmation modal only for explicit close-with-discard decisions when unsaved post-parse edits would otherwise be lost.

## Official Ant Design documentation limitation

Live retrieval of `https://ant.design/llms.txt` was attempted during this planning pass, but the available toolset could not fetch the external resource. This document therefore records the intended component choices and implementation constraints, and implementation should verify those choices against the official Ant Design docs before code is merged.

Official references to verify during implementation:

- `https://ant.design/llms.txt`
- `https://ant.design/components/modal`
- `https://ant.design/components/form`
- `https://ant.design/components/input`
- `https://ant.design/components/select`
- `https://ant.design/components/input-number`
- `https://ant.design/components/table`
- `https://ant.design/components/alert`
- `https://ant.design/components/skeleton`
- `https://ant.design/components/empty`
- `https://ant.design/components/flex`
- `https://ant.design/components/space`

## Surface hierarchy

```text
AssignmentsPage
└── Assignment definitions region
    ├── Status and actions card
   │   ├── Refresh assignments data action
   │   └── Create assignment action
    ├── Assignment definitions table
    │   └── Row-level Update action
    └── AssignmentDefinitionWizardModal
        ├── Modal status stack
        ├── Document inputs region
        ├── Metadata and assignment-weighting region
        ├── Task-weighting region
        └── Footer action region
```

This is the only supported entry surface for the feature. No separate route, drawer, or deprecated AdminSheet entry point should be added.

## No extra navigation layers

The surface should avoid nested tabs, nested routes, and numbered step navigation.

Rationale:

- create and update share one edit surface after the first parse
- document re-parse is a temporary blocking state, not a stable navigation level
- a single modal body keeps save, cancel, and retry semantics explicit

## Outer layout

The wizard should use the approved wide-data modal width for its owned dialog surface because the post-parse state combines full-width document inputs with a task-weighting table.

The body should scroll within that chosen width. Implementation should avoid nested inner scroll panes unless final component constraints make them unavoidable.

Because the current shared width standards define page and panel tokens rather than a modal-specific token family, this feature requires a centralised width-standards update that introduces one approved wide-data modal exception before implementation is merged. Feature-local width literals are not allowed.

## Recommended page skeleton

```text
AssignmentsPage
└── AssignmentDefinitionWizardModal
    └── Space/Flex vertical stack
        ├── Alert stack
        ├── Document section card-like block
        ├── Metadata and assignment-weighting block
        └── Task-weighting block
```

## Recommended top-level UI components

### 1. `Modal`

Use `Modal` for:

- the shared create/update workflow container
- local loading, submission, and blocking-error ownership

Reason:

- the workflow is an owned secondary surface launched from an existing page
- modal confirm-loading and footer actions align with the repository's existing modal patterns

### 2. `Form`

Use `Form` for:

- document URL inputs
- metadata fields
- assignment-weighting input
- task-weighting value ownership

Reason:

- validation, disabled state, and submit wiring stay in one owned surface
- a single form model reduces drift between create stage two and update mode

### 3. `Alert`

Use `Alert` for:

- blocking local errors
- parse failure
- re-parse required state
- non-blocking success or state guidance when useful

Reason:

- important state stays visible inside the modal without nested dialogs

### 4. `Flex` and `Space`

Use `Flex` and `Space` for:

- vertical region stacking
- button-group alignment
- responsive grouping of small field clusters

Reason:

- they match existing frontend layout patterns and avoid bespoke spacing wrappers

## Region-by-region design

## 1. Modal status stack

### Components

- `Alert`
- `Space`

### Content

List what belongs in this region:

- blocking parse or load errors
- re-parse required explanatory copy only
- validation or trust warnings that block final save when relevant

### States

1. **Initial loading**
   - show only update-mode loading treatment here if the full definition is still loading
   - do not show stale warning copy before the mode is known
2. **Ready**
   - region is absent unless there is actionable state to communicate
3. **Warning**
   - show a persistent warning/info alert when document edits require re-parse or when validation state blocks final save
4. **Blocking failure**
   - show an error alert above the form body and keep the modal open

### Notes

- this region is informational only; the actionable `Re-parse` and `Cancel` controls live in the document inputs region
- alert copy must identify whether the reference document, template document, or both changed

## 2. Document inputs region

### Components

- `Form.Item`
- `Input`
- `Button`

### Recommended structure

```text
Document region
├── Reference document URL input
├── Template document URL input
└── Re-parse prompt action row when needed
```

### States

1. **Create before first parse**
   - both URL inputs are enabled
   - metadata fields are also visible and editable in the same form surface
   - the primary footer action performs parse and initial persistence using title, topic, year group, and document inputs from the same form
2. **Create after first parse**
   - both URL inputs remain visible and editable
   - any document change triggers the same re-parse-required state used in update mode
3. **Update initial loading**
   - render a shape-matched skeleton for both URL inputs until the full definition has loaded and canonical URLs can be reconstructed
   - keep document controls unavailable during this state
4. **Update blocking failure**
   - render the local blocking-state treatment for this region if the full-definition read cannot be trusted
   - do not render blank editable URL inputs in place of failed data
5. **Update ready**
   - canonical URLs reconstructed from stored IDs populate the inputs
6. **Unavailable because metadata or weighting edits are dirty**
   - both URL inputs are disabled
   - helper copy explains that the user must save current edits or close the modal and confirm discard before changing documents
7. **Document change pending**
   - URL inputs remain editable
   - the explicit `Re-parse` and `Cancel` actions appear directly below the changed URL inputs in this region
8. **Re-parse in progress**
   - re-parse action shows loading
   - URL inputs, footer actions, and modal close affordances are disabled until the mutation settles

### Close and cancel behaviour

1. **No pending document change**
   - the main modal close affordance, mask click, Escape key, and footer cancel follow the normal close rules for the current dirty state
2. **Pending document change**
   - the main modal close affordance, mask click, Escape key, and footer cancel are disabled until the inline `Re-parse` or `Cancel` path is resolved
   - the user must resolve the document-change state from this region rather than through a second confirmation surface
3. **Re-parse failure**
   - the edited URLs remain visible
   - the wizard returns to the pending-document-change state with inline `Re-parse` and `Cancel` actions re-enabled

### Notes

- URL fields are the only editable controls that remain active during the re-parse-required state
- cancel restores the last persisted canonical URLs
- if the user manually restores both URL fields to their persisted values, the pending document-change state clears automatically without requiring explicit `Cancel`
- this is the sole region that owns the actionable re-parse controls

## 3. Metadata and assignment-weighting region

### Components

- `Form.Item`
- `Input`
- `Select`
- `InputNumber`

### Content

List what belongs in this region:

- title input
- topic dropdown
- year-group dropdown
- assignment-weighting input after a successful stage-one parse or in update mode

### States

1. **Initial loading**
   - update mode shows a shape-matched skeleton for this region until the full definition and startup-owned topic/year-group reference data are available
   - create mode also shows a regional skeleton if the startup-owned topic or year-group reference data is still loading
2. **Ready**
   - all fields are editable once the full definition and required reference-data sets are trustworthy
3. **Create before first parse**
   - title, topic, and year group are visible and editable before the first parse
   - assignment weighting is not yet shown as an editable field in this state
   - task-dependent editing remains unavailable until stage one succeeds
4. **Disabled by pending document change**
   - all fields are disabled while re-parse or cancel resolution is pending
5. **Disabled pending year-group selection**
   - the year-group dropdown remains editable, but final save stays disabled until a valid selection is made
6. **Blocking reference-data failure**
   - create and update modes fail closed in this region if required topic or year-group data cannot be trusted or loaded

### Notes

- topic and year-group fields are dropdown-only
- assignment weighting appears on the shared post-parse edit surface and uses the same required numeric range as task weighting

## 4. Task-weighting region

### Components

- `Table`
- `InputNumber`
- `Empty`
- `Skeleton`

### Recommended structure

```text
Task-weighting region
└── Table
    ├── Task title column
    └── Task weighting input column
```

### States

1. **No parsed tasks yet**
   - show an `Empty` or inline explanatory placeholder stating that parsing is required before task weightings can be edited
2. **Initial task load in progress**
   - show a shape-matched skeleton in the table region
3. **Ready**
   - render task rows with editable numeric inputs
4. **Re-parse required**
   - disable all task-weighting inputs until re-parse or cancel resolves the document change
5. **Blocking failure**
   - preserve the region shell and show the blocking-state treatment locally if parsed task data cannot be trusted

### Notes

- pagination should be avoided in the first iteration unless task counts prove unmanageable
- the table should preserve a deterministic row order from the backend response so tests do not depend on client-side reshuffling

## Footer action region

### Components

- `Button`
- `Space`

### Content

- cancel action
- create-stage parse action before first parse
- save action for normal metadata and weighting saves

### States

1. **Create before first parse**
   - primary action is `Parse and continue`
   - footer cancel remains available
2. **Update initial loading**
   - save is not available while the full definition or startup-owned required reference data is still loading
   - footer cancel remains available
3. **Blocking load or reference-data failure**
   - save is not available
   - footer cancel remains available so the user can exit the fail-closed modal state
4. **Ready create/update state**
   - primary action is `Save`
5. **Pending document change**
   - save remains visible but disabled until document-change resolution completes
   - the actionable `Re-parse` and `Cancel` controls remain inline in the document inputs region rather than moving to the footer
6. **Validation-blocked save state**
   - save remains visible but disabled until the blocking validation issue is resolved
   - explanatory copy lives in the modal status stack
7. **Mutation in progress**
   - the active primary button shows loading
   - conflicting actions are disabled

### Notes

- the footer should not expose both `Save` and `Re-parse` as active primary actions at the same time
- while a background refresh is rebasing the open modal against trusted persisted data, keep the current usable content visible, mark the modal busy locally, and disable conflicting write actions on the owned modal surface

## Close-with-discard confirmation workflow

### Components

- `Modal`
- `Button`
- `Space`

### Purpose

- confirm user intent when closing the wizard would discard unsaved post-parse metadata or weighting edits

### Trigger conditions

1. the user activates the main modal close affordance or footer cancel action
2. the wizard currently has unsaved post-parse metadata or weighting edits
3. there is no active document-change re-parse decision in progress, because pending document changes must be resolved inline first

### Behaviour

1. open one secondary confirmation modal above the wizard
2. keep the main wizard state intact underneath until the user confirms or cancels the discard
3. use explicit actions such as `Keep editing` and `Discard changes`
4. if the user chooses `Keep editing`, close only the discard-confirmation modal and return focus to the wizard
5. if the user chooses `Discard changes`, close the confirmation modal and then close the wizard without persisting the unsaved edits

### Notes

- this is the only approved secondary confirmation surface for the workflow
- re-parse resolution remains inline in the main wizard and must not use this secondary confirmation modal
- discard confirmation is not required before stage-one create because the spec treats stage-one persistence as already saved work

## Data-heavy regions

### Recommended components

- `Table`
- `InputNumber`
- `Empty`

### Core features to use

- deterministic `rowKey` based on `taskId`
- no pagination in the first iteration
- inline numeric editing in the weighting column
- empty-state slot for the pre-parse state

### Recommended columns, fields, or cards

1. task title
2. task weighting

### States

1. **Initial load in progress**
   - render skeleton rows in the owned table region
2. **Ready with data**
   - render the parsed task set in stable order with required weighting inputs
3. **Ready with no data**
   - show explicit empty-state copy rather than a blank table
4. **Partial-load warning**
   - not applicable for the first iteration; fail closed if task data is untrustworthy

## Mode-specific workflow surfaces

## Create mode

- Modal title: `Create assignment definition`
- Initial body focus: document URL form surface
- Initial primary action: parse and persist via `upsertAssignmentDefinition`
- After first success: remain in the same modal, switch to the shared edit surface, and keep document URLs visible for possible re-parse

## Update mode

- Modal title: `Update assignment definition`
- Initial body focus: metadata edit surface once the full definition loads
- Entry is row-level only from the assignment definitions table
- The modal opens directly into the shared edit surface with reconstructed canonical URLs and parsed tasks

## Assignments table action cluster

- Top-level page actions remain `Refresh assignments data` plus `Create assignment` only.
- Row-level update is added alongside the existing delete action in the current actions column.
- Delete remains an existing independent action and is not redesigned by this feature.

## Responsive and accessibility expectations

- The modal must remain a single owned accessible dialog surface with clear title text for the current mode.
- Initial loading regions should expose status semantics while skeletons are shown.
- The modal body should scroll rather than introducing nested scrolling subpanes where avoidable.
- Disabled states caused by pending document changes must be paired with visible explanatory copy in the status stack.
- Focus should remain within the modal during open interaction states and return to the triggering control when the modal closes.
- Mask click and Escape-key dismissal must follow the same guarded close rules as the visible close controls.
- Error and warning treatments should remain inside the modal rather than relying on page-level toasts for critical workflow state.
- The primary wizard modal should use the approved wide-data dialog width rather than an ad hoc literal, with one scrolling body region inside that width.
- If the discard-confirmation modal opens, focus should move to that confirmation surface and return to the wizard trigger that launched it when the confirmation is dismissed.
