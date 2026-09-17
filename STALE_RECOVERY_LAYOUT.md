# Stale Definition Recovery Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for **stale assignment-definition recovery** (issue #301), the **in-modal create-path conversion** (SPEC decision 9), and the related **explicit reparse action** in the Assignments-page update wizard.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md` (drafted after this document)
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the modal hierarchy for the recovery workflow inside `AssessTaskModal`
2. the in-modal conversion of the genuine create path inside `AssessTaskModal` (SPEC decision 9)
3. the visible regions and states of both workflows
4. the preferred UI components for each region
5. the **Reparse documents** action in the Assignments-page update wizard
6. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md` (`forceReparse`, `expectedDefinitionUpdatedAt`, `DEFINITION_STALE`, `DEFINITION_PARSE_FAILED`)
- rollout or sequencing decisions (those belong in `ACTION_PLAN.md`)
- the wizard's existing two-stage form structure beyond what recovery touches

## Design principles

1. **One modal at a time.** All recovery states render inside the single owning `AssessTaskModal`; the wizard review surface replaces the modal body rather than stacking a second `Modal`.
2. Keep the owning modal composition thin; recovery state transitions belong to the assessment orchestration module (see `SPEC.md` decomposition requirement).
3. Use built-in Ant Design behaviours (`Modal`, `Alert`, `Button` loading/disabled) before bespoke interaction patterns.
4. Keep important status visible in the owning modal; do not hide parse failures behind transient messages.

## Ant Design references consulted

Official Ant Design documentation (cached notes under `docs/developer/frontend/ant-design-docs-cache/`, sourced from ant.design component pages):

- [Modal](https://ant.design/components/modal) — single owning modal, footer composition, `destroyOnHidden`
- [Alert](https://ant.design/components/alert) — warning/error/success/info states; actions live in the modal footer, not inside the Alert
- [Button](https://ant.design/components/button) — `loading`, `disabled`, `danger`, primary/secondary hierarchy
- [Space](https://ant.design/components/space) — vertical body stacking and footer button grouping
- [Skeleton](https://ant.design/components/skeleton) — reparsing busy state (shape-matched skeleton per loading standards)
- [Typography](https://ant.design/components/typography) — explanatory copy

## Surface hierarchy

```text
ClassesPage (page composition root)
└── AssessTaskModal (single owning modal — only supported entry point for recovery)
    ├── Assignment selection body (idle flow, unchanged)
    ├── No-match choice body (unchanged as a prompt)
    │   └── Create path (converted): wizard review content rendered in-modal
    ├── Link picker body (unchanged)
    └── Recovery workflow surfaces (new)
        ├── Stale prompt region
        ├── Reparsing region
        └── Review surface (extracted wizard review content rendered in-modal)
```

`AssessTaskModal` is the **only** entry point for stale recovery. The recovery flow must not be reachable from the Assignments-page wizard or any other surface. The Assignments-page wizard gains only the explicit **Reparse documents** action described below. The genuine create path inside `AssessTaskModal` renders in-modal per SPEC decision 9: after choosing Create, the wizard content (stage one then stage two) replaces the modal body instead of stacking a second modal (see region 4's shell-boundary refactor).

## No extra navigation layers

The recovery workflow must not introduce nested tabs, nested routes, or additional stacked modals. Today `AssessTaskModal` renders `AssignmentDefinitionWizardModal` as a **second stacked modal** when `noMatchResolution === 'creating'`; recovery replaces that pattern: the wizard review surface renders **inside** the owning modal body.

Rationale:

- Recovery is a single linear process (stale → reparse → review → approve); stacking two modals hides the owning context and muddies which footer is active.
- One modal keeps error state visible in one place instead of split across two surfaces.
- One modal means one footer and one close/cancel path, simplifying focus and Escape handling.

## Outer layout

### Recommended surface skeleton

```text
AssessTaskModal (Modal, title "Assess Task — {className}")
└── Body (Space vertical, full width)
    ├── [Recovery Alert stack] (stale prompt / review caveat / parse failure / approval-failed error)
    ├── [Primary interaction region] (selection, choice, link picker, or review form)
    └── [Busy region] (skeleton during reparse)
└── Footer (Space horizontal, right-aligned)
    └── [Context-appropriate actions per state table below]
```

## Region-by-region design

## 1. Recovery Alert stack (modal body, top)

### Components

- `Alert`: `warning` (stale prompt, approval rejected as stale), `info` (review-surface caveat), `error` (parse failure, approval failed)

### Content

- **Stale prompt**: explanation that the definition's reference or template document has changed (uses the backend `DEFINITION_STALE` message), plus which action follows from **Update**.
- **Parse failure**: the `DEFINITION_PARSE_FAILED` explanation; explicitly states nothing was saved and no assessment started.
- **Review-surface caveat** (each entry into review after Update): one-line note that reparsing has already refreshed the stored definition and cancelling review discards only unsaved edits.

### States

1. **Not in recovery** — no recovery Alert rendered; existing assessment success/error Alerts behave unchanged.
2. **Stale prompt visible** — warning Alert at top; body region behind it shows no interactive selection content.
3. **Parse failure** — error Alert replaces the reparse region; no successful review panel may render; footer offers **Retry** and **Cancel** (see region 3).
4. **Approval rejected as stale** — warning Alert shown at the stale prompt after a failed approval save; per `SPEC.md`, another reparse and approval are required.

### Notes

- Recovery Alerts are persistent (not closable); they leave only via the footer actions or a state transition.
- Alert copy is user-facing text; exact wording follows `SPEC.md` decisions 1, 7 and 8 and is asserted in component tests.

## 2. Stale prompt state (footer + body)

### Components

- `Alert` (warning) in body
- Footer: `Button` **Cancel** (default), `Button` **Update** (primary) — Cancel rendered first, matching the existing footer convention (e.g. `renderLinkingFooter`)

### Content

- Body: warning Alert only. No assignment `Select`, no choice buttons, no review form.
- Footer: **Update** begins recovery (targets the existing `definitionKey`); **Cancel** closes the assessment modal entirely.

### States

1. **Prompt ready** — both buttons enabled.
2. **Transitioning to reparse** — buttons disabled while the recovery transition starts.

### Notes

- **Cancel must close the modal.** It must not open the no-match/create choice (this corrects today's behaviour where dismissal paths funnel into `choice`).
- The stale prompt never appears while a wizard or link picker is open; it replaces them.

## 3. Reparsing region

### Components

- `Skeleton` (shape-matched to the review form region, per loading standards)
- Footer: **Cancel** button (default) only; closes the modal and abandons recovery.

### Content

- Body: skeleton plus the persistent warning Alert noting the definition is being refreshed.
- No review form, no selection controls.
- The footer contains only Cancel, so no primary-action busy affordance applies in this state; the skeleton is the busy indicator, with accessible busy semantics.

### States

1. **Reparsing in progress** — skeleton visible; Cancel is the only footer action.
2. **Reparse failed** — parse-failure Alert (region 1); footer offers **Cancel** (default, first) then **Retry** (primary, a deliberate user re-trigger of the reparse mutation — never an automatic parse loop).
3. **Reparse succeeded** — transitions to review state; skeleton replaced by the review form.

### Notes

- The reparsing state must keep the owning modal open; it must not flash the selection body.
- Closing mid-reparse abandons recovery but does **not** roll back the server-side reparse (per `SPEC.md` decision 5, the reparse persists); no rollback UI or cancel-disable is required.

## 4. Review surface (wizard review rendered in-modal)

### Components

- Wizard review **content** extracted from `AssignmentDefinitionWizardModalShell` (body form + footer actions), rendered as the owning modal's **body**, replacing selection/choice/link content
- Recovery Alert stack remains above it when applicable

### Shell boundary refactor (required)

`AssignmentDefinitionWizardModalShell` currently owns its own `Modal` chrome (wide-data width token, footer) in every render branch, and its `mode` prop only supports `'create' | 'update'`. Recovery reuses the shell's presentation via a minimal structural refactor:

1. Extract the shell's body form and footer content into a reusable **review-content component** (chrome-free), consumed by both the existing full-shell modal and the recovery surface. The extracted component covers both wizard stages (the shell's `hasParsedTasks` gating selects stage-one URL entry versus stage-two review); recovery exercises only stage two, and the genuine create-path conversion (SPEC decision 9) exercises **both stages** — stage one (URL entry/parse) and stage two (metadata/weighting review) — through the same component.
2. The existing create/update wizard keeps its own `Modal` and behaviour unchanged; only its internals are re-composed from the extracted content component.
3. The recovery surface renders the review-content component inside `AssessTaskModal`'s body, with the owning modal's own footer suppressed while review is active (see footer rule below).
4. The discard-confirm dialog and Manage Topics / Manage Year Groups child modals are rendered by the recovery wiring (mirroring `AssignmentDefinitionWizardModal.tsx`), since the shell alone does not own them.
5. The review surface uses the new recovery entry intent from the wizard entry contract (`SPEC.md` handoff): an existing `definitionKey` plus an approval-success callback; it never uses `mode="create"`.
6. **Canonical documentation (required before implementation starts):** the extracted chrome-free review-content component must be recorded as a planned-only `Not implemented` entry in `docs/developer/frontend/frontend-modal-patterns.md` §3.4 (the wizard modal-family entry gains a second consumer and a new extracted component), alongside the `SPEC.md` handoff items in the shared-helper registry. The implementing agent moves these entries to implemented status as part of the work.

### Footer ownership during review

While the review surface is active, `AssessTaskModal`'s own footer (`getFooterContent`) is **suppressed** and the review content's own footer actions (Save / cancel path) are rendered at the bottom of the owning modal body. Exactly one footer is visible at all times. Component tests assert this by asserting the absence of the owning footer's actions (e.g. "Start Assessment") and the presence of the review footer's primary action during review.

### Recommended structure

```text
AssessTaskModal body
├── Recovery Alert stack
└── Review-content component (wizard stage two: metadata + weighting review)
    └── Review footer actions (Save / cancel path)
```

### Content

- The wizard review surface shows the reparsed definition for the existing `definitionKey`: metadata, year group, assignment weighting, and task weightings (unchanged tasks keep stored weightings per `SPEC.md` decision 3).
- First-stage URL parsing UI is bypassed; recovery enters directly at review.

### States

1. **Review ready** — form interactive; review footer actions visible; owning modal footer suppressed.
2. **Dirty edits** — existing wizard dirty-state gating applies unchanged (document URL fields disabled, discard confirmation on close).
3. **Saving approval** — review footer primary action shows the wizard's `isMutationBusy` busy treatment; conflicting actions disabled.
4. **Approval success** — review surface unmounts; owning modal footer returns; assessment flow resumes in the owning modal (loading → success/error Alert per existing assessment states).
5. **Approval rejected as stale (`DEFINITION_STALE` on save)** — review surface unmounts; the modal returns to the stale prompt state (Update/Cancel), requiring another reparse and approval before assessment can start. Entered review edits are not preserved across this transition (the reparse supersedes them).
6. **Approval failed (non-stale error on save)** — error Alert above the review form; entered review edits are retained; the review footer retry action remains available. No automatic retry.

### Notes

- The wizard's child dialogs (Manage Topics, Manage Year Groups, discard confirm) keep their existing modal behaviour; they are transient pickers rendered by the recovery wiring, not stacked workflow surfaces.
- **Cancel from review** ends recovery: it discards unsaved edits, keeps the owning modal open, and leaves the user on the assignment selection body in `idle` state. It never closes the owning modal.
- Approval continues the original assessment flow with the same definition, coursework, and class identifiers (`SPEC.md` decision 5).

## 5. Assignment selection, no-match choice, and link picker bodies

Unchanged from current behaviour except:

- `transitionToStaleRecovery` no longer routes into `noMatchResolution === 'creating'`; the `creating` branch retains only the genuine create-new-definition path.
- Recovery no longer routes through the stacked `AssignmentDefinitionWizardModal` instance inside `AssessTaskModal`. The genuine create path is converted to the same in-modal rendering (SPEC decision 9): the stacked instance is removed and the create flow renders through the extracted review-content component, delivered as a gated step before recovery UI so recovery builds on a proven composition.

## Workflow surfaces

## Stale recovery workflow

### Surface type

- Single `Modal` (`AssessTaskModal`) with in-body surface swapping. No second `Modal`.

### Trigger

- Any start attempt that rejects with `ApiTransportError` code `DEFINITION_STALE`, covering all three entry origins per `SPEC.md`: the matched-definition path, the link flow, and a start using a newly created definition. Any `startAssessmentRun` rejection with this code enters recovery using the definition key from the captured start context.

### Components

- `Modal`, `Alert`, `Button`, `Skeleton`
- Extracted chrome-free review-content component (shell internals via the required shell-boundary refactor in region 4)

### Layout structure

```text
AssessTaskModal
├── State: stale prompt      → warning Alert + [Cancel] [Update]
├── State: reparsing         → warning Alert + skeleton + [Cancel]
├── State: review            → (caveat Alert) + review content + review footer (owning footer suppressed)
├── State: parse failure     → error Alert + [Cancel] [Retry]
├── State: approval stale    → back to stale prompt (warning Alert + [Cancel] [Update])
└── State: approval failed   → error Alert above review form + review footer (edits retained)
```

### States

1. **Closed** — recovery states unreachable; normal assessment modal.
2. **Open (stale prompt)** — warning Alert; Cancel then Update.
3. **Reparsing** — skeleton; Cancel only.
4. **Review** — review content in-modal; review footer actions; owning modal footer suppressed.
5. **Parse failure** — error Alert; Cancel then Retry (Retry re-triggers the reparse mutation deliberately).
6. **Approval saving** — review footer busy treatment (`isMutationBusy` on the primary action); conflicting actions disabled.
7. **Approval rejected as stale** — return to the stale prompt state (state 2); another reparse and approval required.
8. **Approval failed (non-stale)** — error Alert above the review form; review edits retained; review footer retry available.
9. **Completed** — review unmounts; owning modal footer returns; assessment lifecycle resumes (loading → success/error).

### Notes

- Busy mechanisms per state: reparse uses the skeleton as the busy indicator (footer is Cancel-only); approval save uses the review footer's existing `isMutationBusy` treatment. The owning modal's `confirmLoading` is not the mechanism for either.
- Escape/`onCancel` behaviour follows the active state's Cancel semantics (prompt and failure close the modal; review follows wizard discard rules; reparsing close abandons recovery without server-side rollback).

## Reparse documents action (Assignments-page update wizard)

### Surface type

- New stage-one placement in the existing `AssignmentDefinitionWizardModal` (update mode), no new modal. There is no existing document-action slot in unchanged-URL update mode (the current Re-parse button only renders when a URL change is pending), so this is a new button placement, not a reuse of an existing slot.

### Trigger

- User opens the update wizard from the Assignments page for a definition whose document URLs are unchanged.

### Components

- `Button` **Reparse documents** (default variant) in the stage-one document region
- Existing reparse busy/disabled affordances reused

### States

1. **Enabled** — update mode, document URLs unchanged, the loaded definition is trustworthy, no mutation is pending, and there are no unsaved metadata/weighting edits or pending URL changes.
2. **Disabled** — any of the enabling conditions fails. When disabled because edits must first be saved or discarded, the disabled state carries a visible explanation (helper text or tooltip text duplicated in accessible text) that the user must save or discard edits before reparsing.
3. **In progress** — button `loading`; conflicting edits disabled (existing reparse gating).
4. **Failed** — existing wizard blocking-error treatment; no partial persistence.
5. **Succeeded** — tasks and weights refresh in place in the existing edit surface; the user continues editing as usual; the refresh is visible via the existing task-row update (no new toast, no stage transition).

### Notes

- Opening the update modal or background refetches must **never** trigger reparse automatically (`SPEC.md` decision 6).
- The action is not added to create mode (nothing to reparse).

## Global state rules

### Blocking error state

- Parse failure: error Alert in the owning modal body; no review form, no partial save, no assessment start (`SPEC.md` decision 8).

### Partial-load state

- Approval rejected as stale: the review surface unmounts and the modal returns to the Update/Cancel stale prompt (warning Alert). Non-stale approval failures keep the review edits and show an error Alert with retry available. No mid-review concurrent-change warning exists: the frontend sends no document timestamps and cannot detect document changes before save; staleness is only knowable from the backend's save-time rejection.

### Empty state

- Not applicable; recovery always has a concrete stale definition to act on.

### Success and mutation feedback

- Approval success: owning modal returns to the existing assessment success Alert ("Assessment started for …").
- Wizard save success inside review: existing wizard behaviour (transition/auto-assessment trigger) unchanged.

## Responsive behaviour

- **Width while wizard content is active (decided):** the owning `AssessTaskModal` adopts the approved `--app-modal-width-wide-data` exception token while any wizard content is active in-modal — both the recovery review surface and the converted create path (stage one or stage two). The review content includes the task-weightings table, the documented justification for that exception in the wizard shell, and the wizard surfaces must render the same content without horizontal compression. When no wizard content is active, the modal returns to its current default width.
- Footer button groups wrap on narrow widths via `Space` wrapping; both actions remain visible.

## Accessibility and motion

- On entering the stale prompt, focus moves to the modal body start (standard Modal focus behaviour); Alert copy is real text, not tooltip-only.
- Skeletons expose accessible busy semantics per the loading standards (`aria-label` on the busy region, matching `AssignmentSelectSkeleton` precedent).
- Cancel/Update buttons have visible text labels; destructive or context-dependent actions (Cancel during review discarding edits) are confirmed by the existing wizard discard dialog.
- Reduced-motion: no new animations introduced; the extracted review content inherits existing reduced-motion defaults.

## Implementation guardrails

- Do not add a second stacked `Modal` for recovery states; the review content renders in the owning modal body via the shell-boundary refactor (extracted chrome-free review-content component).
- The existing full-shell create/update wizard keeps its own `Modal` chrome and behaviour; only its internals are re-composed from the extracted content component. Do not redesign the shell's visual presentation, form layout, or behaviours.
- Do not add alternative recovery entry points; `AssessTaskModal` is the only entry.
- The recovery review surface uses the new recovery entry intent (existing `definitionKey` + approval-success callback); it never uses `mode="create"`.
- The genuine create path inside `AssessTaskModal` renders in-modal per SPEC decision 9 with identical flow behaviour (choice → parse → review → auto-assessment); do not change create contracts while converting its presentation.
- Do not add the Reparse action to create mode or trigger reparse from modal open or background refetch.
- Do not invent a mid-review document-change warning; staleness is only knowable from the backend's save-time rejection.
- Do not duplicate `SPEC.md` contract rules here.

## Open questions

None. The former Open question 1 (create-path in-modal conversion) is resolved as SPEC decision 9: the create path converts to in-modal rendering as a gated delivery step after wizard decomposition and before recovery UI.
