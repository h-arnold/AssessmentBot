# Heatmaps Page Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and
user-visible states for the standalone **Heatmaps** page (the task-heatmap query-builder
surface).

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

This document is intentionally UI-focused. It does not replace the underlying feature spec,
backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. the page hierarchy for the standalone Heatmaps surface and its navigation entry
2. the major visible regions inside the surface
3. the preferred UI components for each region
4. the user-visible states of the main surface
5. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- backend contracts already settled in `SPEC.md`
- rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- shared frontend policies already defined in canonical developer docs
- the embedded Class Page heatmap surface (unchanged by this work)

## Design principles

1. Keep the owning page (`pages/HeatmapsPage.tsx`) thin; the taskHeatmap feature owns all
   behaviour.
2. Preserve the existing state-based navigation model; the page is one more leaf in
   `renderNavigationPage`, nothing more exotic.
3. One clear vertical flow: identify scope (selection bar) → read results (merged table). No
   nested tabs, no secondary navigation layers.
4. Built-in Ant Design behaviours before bespoke patterns (Select multiple with rendered
   checkboxes, Table grouped headers).
5. Selection state, busy state, and empty-state guidance stay visible without dialogs.
6. Layouts remain understandable narrow and under reduced motion.
7. The merged table reuses `TaskHeatmapTable`; this page adds chrome and selection around it,
   never a second table implementation.

## Ant Design references consulted

Official documentation consulted during planning (Select API verified against ant.design v6.x;
repo-local cache exists at `docs/developer/frontend/ant-design-docs-cache/select.md`):

- [Select](https://ant.design/components/select) — `mode="multiple"` (search enabled by default),
  `showSearch={{ optionFilterProp: 'label' }}` (v6 object form, matches `AssessTaskModal`
  precedent), `optionRender` for explicit checkbox rows, `maxTagCount="responsive"` for overflow,
  `notFoundContent` for empty-option states, `loading`, `allowClear`, `placeholder`,
  `popupMatchSelectWidth={false}` so long titles read fully.
- [Table](https://ant.design/components/table) — arbitrarily nestable grouped `children` columns
  for the adaptive assignment tier (already used one level deep by `TaskHeatmapTable`).
- [Checkbox](https://ant.design/components/checkbox) — presentational check affordance inside
  rendered options.
- [Card](https://ant.design/components/card), [Flex](https://ant.design/components/flex),
  [Space](https://ant.design/components/space) — structural primitives per existing pages.
- [Alert](https://ant.design/components/alert), [Result](https://ant.design/components/result),
  [Skeleton](https://ant.design/components/skeleton), [Empty](https://ant.design/components/empty)
  — status and empty-state primitives per the loading/error standards.
- [Tooltip](https://ant.design/components/tooltip) — disabled-reason affordance.
- [Typography](https://ant.design/components/typography) — visible control labels.

## Navigation entry

- New sidebar item keyed `'heatmaps'`, label **"Heatmaps"** (from `pageContent.heatmaps.heading`),
  positioned after **Assignments** and before **Settings**.
- Icon: Lucide **`Flame`** (owner's delegation: "choose an appropriate lucide icon"). Rationale:
  reads as "heat"-map at a glance, distinct from GraduationCap (Classes) and BookA (Assignments);
  wrapped by the existing decorative-icon pattern (`renderNavigationIcon`) so it stays
  `aria-hidden`.
- Breadcrumb: the shell renders a single static segment sourced from the navigation label; no
  bespoke breadcrumb work.

## Surface hierarchy

```text
AppShell (navigation key 'heatmaps')
└── pages/HeatmapsPage.tsx                      # thin composition root: renders ONLY the
    │                                           #   feature builder surface; no hooks, no chrome
    └── features/taskHeatmap builder surface    # feature-owned entry component — owns ALL regions
        ├── Chrome region (title + refresh actions)
        ├── Selection bar region                # class / topics / assignments
        └── Content region                      # merged heatmap table OR guidance/blocked states
```

This is the ONLY supported direct entry point for the builder surface. The embedded path
(`ClassesPage → ClassPage → ClassPageContent → TaskHeatmapPage`) remains separate and unchanged;
no cross-links between the two surfaces are added in this cycle.

Ownership note: the page composition root renders the feature surface and nothing else. The
chrome region lives INSIDE the feature surface because the Refresh action requires the feature's
orchestration hook, and feature logic must not live in `pages/`.

## No extra navigation layers

The surface avoids nested tabs, inner routes, accordions-as-navigation, wizards, and modals.
Scope-building happens in one always-visible bar; results appear below it in one region.

Rationale:

- The query has exactly three dimensions in v1; a wizard would hide state the user needs to see.
- Keeping selections and results co-visible makes cascade-clearing behaviour observable.
- Fewer surfaces means fewer loading/busy contracts to honour.

## Outer layout

### Recommended page skeleton

Rendered by the feature builder surface (see ownership note above); the thin page root renders
exactly this one component.

```text
Heatmaps builder surface
└── Flex vertical gap={APP_GAP_MD}
    ├── PageTitleCard          # scope title (see Chrome region)
    ├── PageNavCard            # no back button; Refresh action right-aligned
    ├── Card size="small"      # Selection bar region
    │   └── Flex wrap gap={APP_GAP_MD}
    │       ├── Class field
    │       ├── Topics field
    │       └── Assignments field
    └── Content region         # skeleton | Result | Empty guidance | table Card
```

Spacing follows the 8px grid tokens; no feature-local literals.

## Recommended top-level UI components

### 1. `PageTitleCard` / `PageNavCard`

Use for:

- page identity (title) and the refresh action row.

Reason:

- identical chrome primitives to every other page; `PageNavCard` already supports omitting the
  back button, so no variant work is required.

### 2. `Flex` (wrap) inside a `Card`

Use for:

- the selection bar's three labelled controls.

Reason:

- wraps gracefully at narrow widths without horizontal scroll; matches the app's Flex-first
  composition style.

### 3. `Result` / `Alert` / `Skeleton` / `Empty`

Use for:

- blocking failure (`Result`), degraded-data notice (`Alert`), first-entry loading
  (`Skeleton`), and selection guidance (`Empty`) respectively.

Reason:

- prescribed by the shared loading and error-handling standards; keeps important state visible.

## Region-by-region design

## 1. Chrome region

### Components

- `PageTitleCard`
- `PageNavCard` (actions slot only)

### Content

- Title text derivation:
  - No class selected: `pageContent.heatmaps.heading` ("Heatmaps").
  - Class selected (any selection state): the selected class name.
- Actions: single `Refresh` button (icon `RefreshCw` size 16, matching the embedded variant).

### States

1. **Initial loading** — title shows the static heading; no skeleton needed (selection bar owns
   the visible loading signal).
2. **Ready** — derived title per the rules above; Refresh enabled whenever any owned query can
   be retried (class selected).
3. **Blocking failure** — chrome remains visible and stable above the blocking `Result`.

### Notes

- No back button: the sidebar and breadcrumb provide navigation; adding one would duplicate the
  shell's job.
- During refresh, the button exposes busy semantics (`aria-busy` on the region or Spin-affordance
  per the loading standard). During background refresh the table region never unmounts once data
  is visible; a blocking failure is the one state that replaces it (see Content region, blocking
  state).

## 2. Selection bar region

### Recommended structure

```text
Selection bar (Card size="small")
└── Flex wrap gap={APP_GAP_MD} align="end"
    ├── Field: Class        # label above control
    ├── Field: Topics       # label above control
    └── Field: Assignments  # label above control
```

Each field = `Flex vertical gap={APP_GAP_SM}` of a visible `Typography.Text` label and its
`Select`. Visible labels (not placeholders alone) carry the accessible names.

### Components

- Class: `Select` single-select — `showSearch={{ optionFilterProp: 'label' }}`, `allowClear`,
  `placeholder "Select a class"`.
- Topics / Assignments: `Select mode="multiple"` — same `showSearch` form, `allowClear`,
  `maxTagCount="responsive"`, `popupMatchSelectWidth={false}`, `optionRender` drawing a
  `Checkbox` beside the option label. **State binding:** the rendered Checkbox's `checked` is
  derived from membership of the option's value in the surface's controlled selected-values array
  — `optionRender`'s option object exposes NO `selected` flag, so do not read one; confirm the
  exact value accessor against the installed antd typings at implementation time (cached docs
  show field access via `option.data.*`). `notFoundContent` shows a short guidance string;
  placeholders are action-describing: `"Select topics"` / `"Select assignments"` (nothing is
  auto-selected).

### Content

- Class options: warm-up class partials, label = class name (nullable names render as
  `"(unnamed class)"`), sorted locale-aware ascending; value = `classId`.
- Topic options: unique topics derivable from the selected class's assignments via definition
  partials (`primaryTopicKey` value, `primaryTopic` label), locale-aware ascending.
- Assignment options: the class's resolvable assignments (`assignmentId` value, resolved
  `primaryTitle` label), narrowed by active topic selection (cascade), preserving
  `ClassFull.assignments` order.

### States

1. **No class selected**
   - Class selector enabled and populated from warm-up data.
   - Topics/Assignments disabled with a wrapping Tooltip: "Select a class first".
2. **Class fetch in progress**
   - Class selector shows its `loading` state; dependent selectors remain disabled (same
     tooltip); content region shows the shape-matched skeleton.
3. **Class loaded**
   - All three selectors enabled; topic/assignment options populated; no pre-selections.
4. **Cascade adjustment**
   - Narrowing topics immediately removes now-invalid assignment selections (observable in the
     control's tag chips); widening topics does not restore previously cleared selections.
5. **Refresh in progress**
   - Selectors stay interactive except while the class query itself is pending; no modal overlay.

### Notes

- Changing the class clears topic and assignment selections atomically (single state update, no
  intermediate inconsistent frame).
- Clearing the class selector returns the whole surface to the no-class-selected state.
- Selector values are fully controlled by the feature hook; no internal uncontrolled copies.

## 3. Content region

### Components

- Blocking/marginal failures: `Result` (warning + Retry where retryable) per the Class Page error
  taxonomy. **Documented deviation:** the loading standard's §2.2 default for subregion blocking
  is `Alert`; this surface intentionally uses `Result` for its primary content region, matching
  the Class Page precedent the standard permits for a stronger full-region UX case (error +
  structured Retry/extra actions). This note is that documented justification.
- First-entry loading: shape-matched `Skeleton` (title-bar input + paragraph rows approximating
  the table region) wrapped in `role="status"` / `aria-live="polite"`.
- No class selected: `Empty` with description copy: "Select a class to build a heatmap."
- No assignments selected: `Empty` with description copy: "Select one or more assignments to
  build a heatmap."
- Ready: `Card size="small"` containing `TaskHeatmapTable` fed the merged view model and the
  composite preview lookup/status map.

### Data-heavy region: merged heatmap table

#### Core features to use

- Reuse of `TaskHeatmapTable` unchanged in behaviour: sticky student-name column, per-metric
  sorters and range filters, pagination (50/page), `scroll.x max-content`, cell popovers.
- **Adaptive header tiers**: when ONE assignment is selected the table renders exactly as today
  (task → metric sub-columns, two tiers). When TWO OR MORE are selected, each assignment's
  existing task-column group is wrapped under a NEW parent group column whose `title` is the
  resolved assignment name — i.e. one level deeper `children` nesting (the idiomatic Ant Design
  mechanism; the header span across that assignment's tasks is computed automatically — do NOT
  hand-compute `colSpan` values). Single-selection never gains the extra tier.
- Collapsed duplicate definitions (two selected instances sharing one `definitionKey` produce one
  column set): the assignment tier shows the FIRST instance's title suffixed with
  `" (shared definition)"` so merged cells are never mistaken for per-instance data.

#### States

1. **Initial load in progress** — skeleton (above).
2. **Ready with data** — merged table; assignment tier present iff 2+ assignments selected.
3. **Ready, no submissions in scope** — existing "No submissions yet" caption above the table.
4. **Partial-load (per-assignment preview failure)** — scores render; affected columns'
   popovers show the error treatment via `previewStatusByTaskKey`; other columns unaffected.
5. **Blocking failure** — `Result` replaces ONLY this region; chrome and selection bar remain
   interactive so the user can pick a different class without leaving the page.

### Notes

- Row/column ordering, sorting, filtering, and popover behaviour are inherited; this page adds
  none.
- The table keeps visible during refresh (busy affordance scoped to the refresh button/region),
  per the loading standard.

## Workflow surfaces

None. This cycle introduces no modals, drawers, popovers-as-workflows, or inline expansion
panels on this page (cell-preview Popovers are part of the reused table component and already
specified there).

## Global state rules

### Blocking error state

- Region-scoped `Result` in the content region using the established taxonomy: class-not-found →
  non-retryable; class-query/dataset/analyser/adapter failures → retryable warning with Retry.
- Retry re-runs the failed pipeline inputs only; the selection bar remains usable throughout, so
  recovery never requires leaving the page.

### Partial-load state

- Per-assignment preview failures degrade only affected popovers (spec §Error rules in
  `SPEC.md`); no global warning banner for them.

### Empty state

- Exactly one guidance block at a time in the content region, in strict precedence order:
  1. skeleton (initial/warm-up loading and class-fetch loading)
  2. blocking `Result`
  3. "Select a class to build a heatmap." (no class selected)
  4. "Select one or more assignments to build a heatmap." (class loaded, no assignments selected)
  5. merged table (ready)

### Success and mutation feedback

- No mutations exist on this surface; no success toasts. Selection feedback is inherent in the
  controls (tag chips) and the appearing table.

## Responsive behaviour

- Selection bar fields wrap onto multiple rows at narrow widths (`Flex wrap`); each Select grows
  to fill available width with a sensible minimum (token-based, not pixel-frozen here).
- The table retains `scroll.x max-content` and the sticky student column; no column collapsing is
  added.
- Nothing on this page requires viewport-height fit; normal document scroll applies.

## Accessibility and motion

- Visible text labels name each selector; placeholders never carry sole information.
- Disabled selectors expose their reason via Tooltip AND remain discoverable to assistive tech
  through the adjacent label relationship; do not rely on colour alone.
- Rendered checkbox rows are presentational within AntD's option semantics: selection state is
  conveyed by the option's `aria-selected`, keeping keyboard operation native to the Select.
- Skeletons and refresh expose explicit `role="status"` / busy semantics per the loading
  standard.
- Reduced-motion users get the theme-global motion switch; no page-local animations are added.
- Focus order follows DOM order: refresh button → class → topics → assignments → table region
  (the title card contains no focusable element).
- Adaptive-tier changes (adding/removing the assignment tier) are content changes under the
  user's control; no focus jumps accompany them.

## Implementation guardrails

- Do not introduce alternative entry points (no links from Class Page cards, no deep-link state).
- Do not add modals, drawers, tabs, or wizard steps to this surface.
- Do not fork `TaskHeatmapTable` or reimplement cell rendering for merged mode; extend via props
  only.
- Do not place feature hooks or state machines in `pages/HeatmapsPage.tsx`.
- Follow the 8px-grid spacing tokens; reject undocumented pixel literals.
- Keep the adaptive-tier logic in the table's column construction, driven purely by the count of
  source assignments (no surface-identity branching).

## Open questions

None. Icon choice (Lucide `Flame`), adaptive tiers, and checkbox-in-dropdown presentation were
confirmed with the owner during the layout clarification round.
