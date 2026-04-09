# Frontend Layout Specification Template

Use this template when a feature needs a dedicated UI/layout document in addition to its core specification and implementation plan.

This document should define layout hierarchy, visible regions, component choices, workflow surfaces, and user-visible states. It should tighten frontend behaviour without drifting into backend contract design or delivery sequencing.

## Writing rules

- Use explicit, testable language.
- Keep the document UI-focused; move backend contracts and domain rules into `SPEC.md`.
- Keep implementation sequencing and task breakdowns in `ACTION_PLAN.md` or workstream plans.
- Do not prescribe frontend file structure unless a hard ownership boundary is itself part of the agreed UI contract.
- Prefer concrete component and state language over vague design commentary.
- State what is intentionally out of scope so the layout surface does not expand implicitly.
- Use British English in all prose.

## Suggested companion documents

- `SPEC.md` for domain rules, contracts, and scope boundaries
- `ACTION_PLAN.md` for implementation sequencing
- feature-specific frontend testing or navigation docs where relevant

---

# [Feature name] Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for **[feature name]**.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- [other canonical docs that materially shape this surface]

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the page, route, tab, drawer, or modal hierarchy for this feature
2. the major visible regions inside the surface
3. the preferred UI components for each region
4. the user-visible states of the main surface
5. the user-visible states of important modal or secondary workflows
6. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the owning page or composition layer thin.
2. Preserve the existing app navigation model unless the spec explicitly says otherwise.
3. Prefer one clear visible layout over nested inner tabs or layered navigation unless there is a strong product reason.
4. Use built-in Ant Design behaviours before creating bespoke interaction patterns.
5. Keep important status, error, and selection state visible without forcing the user into a secondary workflow.
6. Favour layouts that remain understandable on smaller screens and in reduced-motion mode.
7. Keep responsibilities clear between composition, state orchestration, and presentational regions.

## Ant Design references consulted

List the official components that materially inform this layout. Remove anything that is not actually relevant.

- [Tabs](https://ant.design/components/tabs)
- [Card](https://ant.design/components/card)
- [Table](https://ant.design/components/table)
- [Form](https://ant.design/components/form)
- [Modal](https://ant.design/components/modal)
- [Drawer](https://ant.design/components/drawer)
- [Alert](https://ant.design/components/alert)
- [Empty](https://ant.design/components/empty)
- [Skeleton](https://ant.design/components/skeleton)
- [Flex](https://ant.design/components/flex)
- [Space](https://ant.design/components/space)

## Surface hierarchy

```text
[Owning page or route]
└── [Feature root]
    ├── [Top-level region]
    ├── [Top-level region]
    └── [Secondary workflow surface]
```

State explicitly if this is the only supported entry point for the feature and list any entry points that must not be added.

## No extra navigation layers

State whether the surface should avoid nested tabs, nested routes, accordions-as-navigation, or other secondary structure that would weaken clarity.

Rationale:

- [reason tied to usability]
- [reason tied to state visibility]
- [reason tied to implementation simplicity]

Remove this section if additional navigation layers are genuinely required.

## Outer layout

## Recommended page skeleton

```text
[Feature root]
└── [Flex / Space / Layout container]
    ├── [Alert stack]
    ├── [Summary region]
    ├── [Primary interaction region]
    └── [Supporting region]
```

## Recommended top-level UI components

### 1. `[Primary container component]`

Use `[component]` for:

- [region]
- [region]

Reason:

- [why this is the right structural primitive]
- [why it fits existing app patterns]

### 2. `[Spacing or layout component]`

Use `[component]` for:

- [stacking, grouping, or responsive arrangement]

Reason:

- [why this is preferable to ad-hoc layout styling]

### 3. `[Status component]`

Use `[component]` for:

- [blocking failure]
- [warning]
- [success or summary feedback]

Reason:

- [why this keeps important state visible]

Add or remove subsections so they match the real layout.

## Region-by-region design

Create one subsection for each major visible region.

## 1. [Region name]

### Components

- `[component]`
- `[component]`

### Content

List what belongs in this region:

- [content item]
- [content item]

### States

1. **Initial loading**
   - [what should render]
   - [what should stay hidden or disabled]
2. **Ready**
   - [normal visible content]
3. **Empty**
   - [empty-state presentation]
4. **Warning**
   - [warning treatment]
5. **Blocking failure**
   - [error treatment]

### Notes

- [ordering rule]
- [visibility or persistence rule]
- [interaction rule]

## 2. [Region name]

### Components

- `[component]`
- `[component]`

### Recommended structure

```text
[Region]
├── [Child]
└── [Child]
```

### States

1. **No selection / inactive / unavailable**
   - [disabled behaviour]
   - [tooltip or explanation rule]
2. **Ready**
   - [normal behaviour]
3. **Mutation in progress**
   - [loading or disabled behaviour]
4. **Post-mutation**
   - [reset or persistence rule]

### Notes

- [selection reset rule]
- [controlled-state rule]

Repeat this pattern until every major region is covered.

## Data-heavy regions

Use this section when the layout contains a table, list, grid, or other data surface.

### Recommended components

- `[Table | List | Cards | Tree | custom primitive]`
- `[Badge | Tag | Tooltip | Empty]`

### Core features to use

- `[row key or item key rule]`
- `[sorting or filtering rule]`
- `[pagination or virtualisation rule]`
- `[empty text or empty-state slot rule]`

### Recommended columns, fields, or cards

1. [field or column]
2. [field or column]
3. [field or column]

### States

1. **Initial load in progress**
   - [loading presentation]
2. **Ready with data**
   - [normal render]
3. **Ready with no data**
   - [empty-state render]
4. **Partial-load warning**
   - [warning plus visible/stale-data rule]
5. **Blocking failure**
   - [what not to render as interactive]

### Notes

- [row action rule]
- [status presentation rule]
- [stale-data handling rule]

## Workflow surfaces

Create one subsection for each modal, drawer, inline expansion, or secondary workflow that materially affects layout.

## [Workflow name]

### Surface type

- `[Modal | Drawer | Inline panel | Popover]`

### Trigger

- [where the user launches it]
- [eligibility rule]

### Components

- `[component]`
- `[component]`

### Layout structure

```text
[Workflow surface]
├── [Intro or warning region]
├── [Primary form or content]
└── [Footer actions]
```

### States

1. **Closed**
   - [default trigger state]
2. **Open and ready**
   - [normal contents]
3. **Submitting**
   - [disabled/loading rules]
4. **Validation failure**
   - [where feedback appears]
5. **Completed**
   - [close, remain open, or rebase behaviour]

### Notes

- [modal hierarchy rule]
- [destructive-action copy rule]
- [focus-return rule]

Repeat as needed for each important workflow.

## Global state rules

Document the top-level visible states for the feature as a whole.

### Blocking error state

- [what is shown]
- [what is not shown as interactive]

### Partial-load state

- [what warning is shown]
- [what remains usable]

### Empty state

- [what explanatory copy is needed]
- [which actions remain available]

### Success and mutation feedback

- [where success or warning summaries appear]
- [how long they persist or when they are replaced]

## Responsive behaviour

- [stacking rule for narrow widths]
- [scroll behaviour rule]
- [column collapse or wrap rule]
- [minimum action visibility rule]

## Accessibility and motion

- [focus-management rule]
- [keyboard interaction rule]
- [tooltip-only information should or should not be duplicated in visible text]
- [reduced-motion rule]
- [screen-reader labelling rule]

## Implementation guardrails

- Do not introduce alternative entry points unless the core spec explicitly requires them.
- Do not duplicate domain rules here that belong in `SPEC.md`.
- Do not add bespoke layout abstractions when existing Ant Design primitives are sufficient.
- Do not hide important error, warning, or destructive-operation outcomes inside transient surfaces only.
- Keep layout decisions aligned with existing frontend shell and navigation guidance.

## Open questions

Use this section only for unresolved layout questions that still need a product or engineering decision.

1. [Open question]
2. [Open question]
