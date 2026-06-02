# Classes Page Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the Classes page.

Use it alongside:

- `SPEC.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the dedicated top-level Classes page surface
2. the major visible regions inside the page
3. the preferred Ant Design components for year-group grouping and class cards
4. the user-visible loading, empty, ready, refresh, and blocking states
5. the placeholder `View` and `Edit` button presentation inside each class card
6. responsive and accessibility expectations where they affect layout behaviour

This document does **not** redefine:

- backend transport contracts already settled in `SPEC.md`
- future `View` and `Edit` workflows
- the existing Settings > Classes tab workflow

This layout assumes the canonical shell navigation key for the page is `classes`, matching the shared page-copy contract.

## Design principles

1. Keep the top-level page composition thin and aligned with existing `PageSection` usage.
2. Use `Collapse` for year-group grouping rather than introducing secondary tabs, nested routes, or bespoke navigation layers.
3. Use `Card` as the class-level information primitive so each class reads as a discrete entity.
4. Keep the first iteration visually simple and intentionally static: no drag handles, reorder affordances, inline edit controls, or workflow toolbars.
5. Fail closed when grouping data is not trustworthy instead of partially rendering mismatched cards.
6. Preserve usability on smaller screens by allowing the card region to wrap rather than enforcing a table-like layout.
7. Keep visible motion aligned with existing shell behaviour and avoid custom transition systems.

## Ant Design references consulted

- [Collapse](https://ant.design/components/collapse)
- [Card](https://ant.design/components/card)
- [Alert](https://ant.design/components/alert)
- [Empty](https://ant.design/components/empty)
- [Skeleton](https://ant.design/components/skeleton)
- [Flex](https://ant.design/components/flex)
- [Space](https://ant.design/components/space)
- [Button](https://ant.design/components/button)

## Surface hierarchy

```text
Classes page
└── PageSection
    └── Classes page content
        ├── Status region
        └── Year-group collapse region
            └── Expanded panel body
                └── Wrapping class-card collection
                    └── Class card
                  ├── Class name
                        └── Placeholder actions
```

This is the only supported new entry point for the card-based Classes browsing surface in this iteration.
The existing Settings > Classes tab remains a separate table-based operational surface.
The dedicated Classes page must not reuse the Settings classes management panel or its merged-table hook, because that workflow depends on Google Classrooms, cohorts, and bulk-management state that are outside this page's browse-only scope.

## No extra navigation layers

The page should avoid nested tabs, nested routes, drawers, modals, and accordion-as-navigation behaviour beyond the year-group grouping itself.

Rationale:

- the year-group collapse already provides the required organising structure
- the page is intended for direct browsing rather than multi-step workflow progression
- avoiding extra navigation layers keeps the surface compatible with the requested tight scope

## Outer layout

## Recommended page skeleton

```text
PageSection
└── children slot
   ├── Status region
   └── Primary content region
      └── Collapse
         └── Year-group panels
            └── Flex-wrapped class cards
```

## Recommended top-level UI components

### 1. `PageSection`

Use `PageSection` for:

- the top-level page heading and summary
- standard page-width ownership already used by other navigation pages

Reason:

- it preserves the existing top-level page shell contract
- it keeps navigation pages visually consistent without placing feature state in the shell
- it already owns the outer spacing plus the heading and summary, so the feature-owned layout begins in the `children` slot beneath that shell chrome

### 2. `Collapse`

Use `Collapse` for:

- the ordered list of year-group sections
- multi-expand browsing of grouped class cards

Reason:

- it directly matches the requested collapsible year-group bars
- Ant Design already supports labelled panels and non-accordion grouping without bespoke behaviour

### 3. `Card`

Use `Card` for:

- each individual class surface
- the placeholder action area for `View` and `Edit`

Reason:

- it gives each class a clear bounded surface
- it supports a simple title-and-actions layout without introducing a custom tile primitive

### 4. `Alert`, `Skeleton`, and `Empty`

Use `Alert` for:

- blocking failure or trust-failure states only

Use `Skeleton` for:

- initial blocking load before trustworthy page data is available

Use `Empty` for:

- explicit empty page or in-panel empty presentations

Reason:

- these match the canonical frontend loading and failure standards

## Region-by-region design

## 1. PageSection-owned shell region

### Components

- `PageSection`
- `Typography.Title`
- `Typography.Paragraph`

### Content

This region owns:

- the page title `Classes`
- a summary describing year-group grouped browsing of `ABClassPartials`

### States

1. **Initial loading**
   - the heading and summary remain visible
   - the content region below shows the loading skeleton
2. **Ready**
   - the heading and summary remain visible above the collapse surface
3. **Blocking failure**
   - the heading and summary remain visible above the blocking alert

### Notes

- The heading text and summary should come from the shared page copy source of truth rather than hard-coded local literals.
- This shell region is owned by `PageSection`, not by the feature-owned child layout.

## 2. Status region

### Components

- `Skeleton`
- `Alert`
- `Typography`

### Content

This region owns:

- the initial blocking loading presentation
- the blocking error presentation
- any concise refresh-status text when ready content stays visible

### States

1. **Initial loading**
   - render a shape-matched skeleton in the exact region later occupied by the collapse
   - expose a labelled `role="status"` loading region while the skeleton is visible
2. **Ready**
   - remove the skeleton and keep this region visually minimal unless refresh text is needed
3. **Warning**
   - optional non-blocking refresh text may appear above the primary content region while grouped content remains visible
4. **Blocking failure**
   - render an `Alert` in the owned page content region and suppress the primary content region entirely

### Notes

- This region must not render both the skeleton and the blocking alert at the same time.
- Blocking failure covers both load failure and invalid class-to-year-group mapping.
- Blocking failure also covers invalid class data such as `className === null`.

## 3. Primary content region

### Components

- `Collapse`
- `Empty`
- `Flex`

### Recommended structure

```text
Primary content region
├── Page-level Empty OR
└── Collapse
    ├── Panel: Year group A
    │   └── Card collection OR in-panel Empty
    ├── Panel: Year group B
    │   └── Card collection OR in-panel Empty
    └── Panel: Year group C
        └── Card collection OR in-panel Empty
```

### States

1. **Unavailable**
   - region is hidden because the status region owns the skeleton or blocking alert
2. **Ready with year groups**
   - render one panel per year group in alphabetical order
   - allow multiple panels to stay expanded at once
3. **Ready with no classes but configured year groups**
   - still render the year-group collapse
   - each panel body shows an in-panel empty presentation instead of blank whitespace
4. **Ready with no year groups and no classes**
   - replace the collapse with a page-level `Empty` state explaining that no year groups are configured yet
5. **Background refresh**
   - keep current panels visible and mark the region busy with `aria-busy="true"`
6. **Post-refresh trust failure**
   - remove the region and let the status region show the blocking-state treatment instead

### Notes

- the first alphabetical panel should be open on initial ready render when at least one panel exists
- panel labels are derived from year-group names and should not include class counts in this iteration
- expansion state is local UI state only and is not persisted across reloads

## 4. Class-card region

### Components

- `Flex`
- `Card`
- `Button`
- `Empty`

### Content

Each expanded panel body contains:

- a wrapping card layout for that year group's classes
- class title text rendered directly from `className`
- disabled placeholder `View` and `Edit` buttons for each class

### States

1. **Ready with cards**
   - show cards sorted alphabetically by `className`
   - cards wrap to the available panel width
2. **Ready with no cards in this panel**
   - show an in-panel empty message instead of blank whitespace
3. **Mutation in progress**
   - not applicable in this iteration because the card actions are placeholders only
4. **Post-mutation**
   - not applicable in this iteration

### Notes

- cards must not expose drag handles, reorder affordances, inline edit controls, or status chips in this first iteration
- buttons remain visible to reserve the future workflow affordance but stay disabled so the surface does not promise an unavailable action
- a class card must not render a fallback title; invalid `null` `className` data belongs to the blocking-failure path instead

## Data-heavy regions

### Recommended components

- `Collapse`
- `Card`
- `Flex`
- `Empty`

### Core features to use

- year-group key as the panel key
- class identifier as the card key
- alphabetical ordering only; no user-controlled sorting
- no pagination or virtualisation in this first iteration

### Recommended card fields

1. class name
2. disabled `View` button
3. disabled `Edit` button

### States

1. **Initial load in progress**
   - collapse is replaced by a shape-matched skeleton
2. **Ready with data**
   - collapse renders with card-bearing or empty panels
3. **Ready with no configured year groups**
   - a page-level empty state replaces the collapse
4. **Blocking invalid mapping**
   - collapse is suppressed and replaced by a blocking alert

## Responsive behaviour

- The page keeps standard outer page width ownership through `PageSection`.
- The collapse occupies the normal page content width rather than introducing a special narrow or modal layout.
- The class-card region wraps naturally so the layout can compress to fewer columns on smaller screens.
- Cards must remain readable at single-column mobile widths without horizontal scrolling.

## Accessibility and motion expectations

- The initial loading region exposes accessible loading semantics while the skeleton is present.
- Background refresh marks the relevant owned region busy and pairs that state with visible refresh text.
- Collapse headers remain keyboard-operable through native Ant Design behaviour.
- Placeholder `View` and `Edit` buttons remain programmatically exposed as disabled buttons.
- No bespoke motion should be added beyond default Ant Design and shell-token motion.

## Deliberate UI deferrals

- No badge, status chip, cohort label, teacher metadata, or secondary class details are required on the cards in this first iteration.
- No drag-and-drop or manual ordering affordance is permitted.
- No modal, drawer, or detail-pane launch is permitted from the placeholder actions in this iteration.
