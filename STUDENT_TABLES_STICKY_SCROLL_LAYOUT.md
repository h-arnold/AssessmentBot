# Student Tables Sticky Scroll Layout Specification

## Purpose

This document defines the layout, visible regions, component choices, and user-visible states for the sticky table scroll and frozen student-name columns feature on the three surfaces that render a student table.

Use it alongside:

- `SPEC.md` — agreed product decisions, behaviour contract, and scope boundaries
- `ACTION_PLAN.md` — implementation sequencing (written after this document)
- `docs/developer/frontend/frontend-loading-and-width-standards.md` — width ownership and the §7.1 fluid-width exception
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` — shell navigation and motion

This document is intentionally UI-focused. It does not redefine the behaviour contract in `SPEC.md`, backend contracts (none change), or delivery sequencing.

## Scope of this document

This document covers:

1. the surface hierarchy of the three surfaces that render a student table
2. the major visible regions inside each surface, with unchanged regions marked as unchanged
3. the Ant Design components used by the changed table region
4. the user-visible states of the table region, including the viewport-pinned header and the sticky bar
5. responsive, accessibility, and motion expectations where they affect layout behaviour

This document does **not** redefine:

- the sticky-bar visibility rules, split-header DOM structure, or frozen-column contract (owned by `SPEC.md`)
- loading, blocking, or empty-state presentation of the surrounding pages (unchanged)
- shared frontend policies already defined in canonical developer docs

## Design principles

1. The change is expressed only through Ant Design `Table` props (`sticky`, the existing `scroll.x`, and column `fixed`), so the layout adds no wrapper component, hook, CSS module, or custom scrollbar.
2. The document remains the only scroll container: no ancestor of a table may introduce an overflow or clipping container, so the pinned header and sticky bar track the viewport.
3. Viewport-pinned elements overlay scrolled content at the viewport edges with a zero offset; no space is reserved and no layout shifts (confirmed with the product owner).
4. Ant Design's default stacking is accepted: the pinned header sits above body cells, fixed columns use z-index, and cell-preview popovers and filter dropdowns portal to `document.body` by default (the app sets no `getPopupContainer`), so they paint above the pinned header without any z-index overrides (confirmed with the product owner).
5. Existing page chrome (title cards, navigation cards, selection bar, summary cards, control rows) is unchanged.
6. No width change on any surface: the Class page already fills the shell content region, the Heatmaps page keeps its §7.1 fluid-width exception, and each table keeps its own horizontal scrolling with no document-level horizontal overflow.

## Ant Design references consulted

Official Ant Design documentation (ant.design), consulted for this layout:

- [Table](https://ant.design/components/table) — the `sticky` prop ("Set sticky header and scroll bar"; `boolean | { offsetHeader?, offsetScroll?, getContainer? }`, since 4.6.0), `scroll.x` accepting `'max-content'` (since 6.3.0), column `fixed: 'start'` requiring `scroll.x`, the "Fixed header and scroll bar with the page" demo (`table-demo-sticky`), and the `stickyScrollBarBg` / `stickyScrollBarBorderRadius` component tokens.
- [Card](https://ant.design/components/card) and [Flex](https://ant.design/components/flex) — the existing surface containers; unchanged by this feature.

## Surface hierarchy

```text
Class page (rendered full-width inside the shell content region)
├── Persistent class header (rendered in every non-loading state)
│   ├── Class-name PageTitleCard
│   ├── ClassPageModeControl (analysis mode)
│   └── PageNavCard ("Back to Classes" + header actions) — overview view only
├── Class overview (renders one branch at a time)
│   ├── Recent Assignments section
│   └── Student Averages card (Card, size="small")
│       ├── Control row (search input, "Viewing:" label)
│       └── Table — sticky header, sticky bar, fixed Forename/Surname
└── Assignment heatmap view (replaces the overview's content branches while open;
    the persistent class header above stays, minus the overview-only nav card)
    ├── Assignment PageTitleCard + navigation card (Back to Class overview, Re-run Assessment, Refresh)
    ├── Optional summary cards or summary Alert
    └── Task Heatmap card (Card, size="small")
        ├── Optional status paragraphs (no submissions, baseline caption)
        └── TaskHeatmapTable — sticky header, sticky bar, fixed Forename/Surname

Heatmaps page (app-page-content--fluid)
└── Heatmap builder surface
    ├── Page title card + navigation card (Refresh)
    ├── Selection bar card (class / topics / assignments selects)
    └── Content region
        ├── Loading skeleton / blocking Result / Empty states (unchanged)
        ├── Optional selection summary cards or Alert
        └── Task Heatmap card (Card, size="small")
            └── TaskHeatmapTable — sticky header, sticky bar, fixed Forename/Surname
```

These are the only entry points for the feature. No new page, tab, drawer, or modal is added. The Class page renders either the overview or the assignment heatmap view, never both, so at most one student table is in the document at a time on that page.

## No extra navigation layers

This feature adds no navigation structure — no tabs, routes, drawers, or modals. The only new visible elements are Ant Design's own pinned header and sticky bar inside the existing table region.

Rationale:

- each surface is already a single clear vertical stack (`Flex vertical gap={APP_GAP_MD}`);
- the pinned header and sticky bar are viewport furniture, not navigation;
- keeping the tree unchanged preserves state visibility and keeps the implementation to `Table` props.

## Outer layout

Each surface is a `Flex vertical gap={APP_GAP_MD}` stack inside the shell's `.app-content` region, scrolled by the document. The application header and sider are not fixed; they scroll with the document, so the sticky header and sticky bar offsets stay at their Ant Design defaults of `0`.

Recommended page skeleton (unchanged except the table region marked ▸):

```text
[Surface root: Flex vertical, gap 16px]
├── [PageTitleCard + PageNavCard]                      unchanged
│   (Class page: class-name title card + mode control always; nav card overview-only)
├── [Selection bar card — Heatmaps page only]          unchanged
├── [Summary cards / Alert]                            unchanged, optional
├── [Recent Assignments section — overview only]       unchanged
└── ▸ [Table card: Card size="small"]
    ├── [Control row — Student Averages only]          unchanged
    ├── ▸ Table (sticky header + sticky bar + fixed name columns)
    │   └── split render when sticky:
    │       ├── .ant-table-header.ant-table-sticky-holder → header <table>
    │       ├── .ant-table-body → body <table> (the horizontal scroll region)
    │       └── .ant-table-sticky-scroll → sticky bar (only with horizontal overflow)
    └── pagination row (outside the table container)    unchanged
```

## Recommended top-level UI components

### 1. `Card` (size="small")

Use `Card` for each table's owning panel on all three surfaces, exactly as today.

Reason:

- it is the existing container on every surface, so the pinned elements stay scoped to the card's table region;
- no panel resize or restyle is needed — the `Card` must simply not clip or scroll, so the document stays the sticky containing block.

### 2. `Flex` (vertical stack)

Use `Flex vertical gap={APP_GAP_MD}` for each surface's region stack, as today.

Reason:

- it matches the existing page pattern and the 8px spacing grid;
- no ad-hoc layout styling is introduced.

### 3. `Table` (sticky)

Use Ant Design `Table` with `sticky` enabled, the existing `scroll={{ x: 'max-content' }}`, and `fixed: 'start'` Forename/Surname columns on both student tables.

Reason:

- `sticky` plus `scroll.x` is Ant Design's documented "fixed header and scroll bar with the page" posture, which is exactly the requested behaviour;
- the split render (header holder, body scroll region, sticky bar) is the library's standard structure for this mode.

## Region-by-region design

### 1. Class page — chrome and recent assignments (unchanged)

#### Components

- `PageTitleCard`, `PageNavCard`, `ClassPageModeControl`, `ClassPageHeaderActions`
- `RecentAssignmentsSection`

#### Content

- Class name title, analysis-mode control, header actions, recent assignment cards.

#### States

- Loading: shape-matched skeletons in a labelled `role="status"` region.
- Blocking: a single `Result` per error type with Retry/Back actions.
- Ready: the full overview tree.

#### Notes

- None of these regions change; they scroll with the document and may pass under the pinned table header, which is the accepted overlay treatment.

### 2. Class page — Student Averages card (table region changed)

#### Components

- `Card size="small"` titled "Student Averages"
- `Flex` control row: search `Input` (keystroke filtering, no submit button) and a secondary "Viewing: Overall Class Averages" label
- `Table size="small"`, `pagination={false}`, `scroll={{ x: 'max-content' }}`, now `sticky`, with fixed Forename (104px) and Surname (96px) columns plus Completeness, Accuracy, SPaG, Average

#### States

1. **Initial loading** — page-level skeleton, card not yet rendered (unchanged).
2. **Ready, wide viewport, no horizontal overflow** — no sticky bar; the split render still applies (header holder + body table), and the header pins if it passes the viewport top.
3. **Ready, narrow viewport, horizontal overflow** — sticky bar appears at the viewport bottom while the table scroll region crosses the bottom edge; header pins at the viewport top while read; Forename/Surname stay at the start edge during horizontal panning.
4. **Empty (no search matches)** — the existing `Empty` locale inside the table body (unchanged).

#### Notes

- The table supplies no `aria-label`, so both halves of the split render stay unnamed.
- Sort and metric-range filter controls in the pinned header keep their current behaviour.

### 3. Class page — assignment heatmap view (table region changed)

#### Components

- Persistent class header above this view: class-name `PageTitleCard` + `ClassPageModeControl` (the overview-only "Back to Classes" `PageNavCard` is hidden here)
- Assignment `PageTitleCard`, `PageNavCard` with Back to Class overview / Re-run Assessment / Refresh actions and the optional legacy `Tag`
- `HeatmapSummary` (summary cards or a local `Alert`)
- `Card size="small"` containing `TaskHeatmapTable` (`aria-label="Task Heatmap"`, `bordered`, `pagination={{ pageSize: 50, showSizeChanger: true }}`)

#### Content

- Optional `role="status"` paragraphs above the table ("No submissions yet", baseline caption).
- Grouped header: Forename, Surname, then per-task groups with Completeness / Accuracy / SPaG sub-columns.

#### States

- Title-error: the table region is replaced by an in-view `Alert`; chrome stays (unchanged).
- Generic error: toast plus automatic back-navigation (unchanged).
- Ready: identical table states to region 2 (sticky bar with overflow, pinned header, fixed name columns).

#### Notes

- The `aria-label` is copied onto both the header and body tables by Ant Design 6.6.7; this is accepted in `SPEC.md` and must not be "fixed" in layout code.
- This view replaces the overview, so only one student table is present at a time.

### 4. Heatmaps page — builder chrome (unchanged)

#### Components

- `PageTitleCard` (level 2), `PageNavCard` with a busy-aware Refresh `Button`
- Selection bar `Card` with the class / topics / assignments `Select` cascade
- `ContentRegion` wrapper carrying `aria-busy` and a screen-reader live status during background refresh

#### States

- Loading: labelled `role="status"` region with a shape-matched `Skeleton`.
- Blocking: `Result` per error type with Retry where retryable.
- Empty: `Empty` for no-class and no-assignments selections.
- Ready: selection summary plus the heatmap card.

#### Notes

- The page keeps the `app-page-content--fluid` frame (frontend-loading-and-width-standards §7.1); no width change.

### 5. Heatmaps page — task heatmap card (table region changed)

#### Components

- Optional selection summary cards or `Alert`
- `Card size="small"` containing `TaskHeatmapTable` — the same component as the embedded view, so both heatmap surfaces share one implementation and one layout path

#### States

- Same table states as region 3. In merged mode the grouped header may add an assignment-tier group level; the sticky header, sticky bar, and fixed name columns behave identically.

## Data-heavy regions

Both student tables are Ant Design `Table` regions with the split sticky render.

### Recommended components

- `Table` with `sticky`, `scroll={{ x: 'max-content' }}`, `size="small"`, `rowKey="studentId"`
- Fixed `col` widths from the shared spacing tokens: Forename 104px, Surname 96px (total 200px, unchanged)
- Heatmap additionally: `bordered`, pagination with page-size changer
- Student Averages additionally: search control row and `Empty` locale

### Core features to use

- `scroll.x: 'max-content'` supplies the horizontal scroll region (`.ant-table-body`) and is required for both the sticky bar and fixed columns.
- Column `fixed: 'start'` on Forename and Surname only.
- Existing sorters, metric-range filters, and cell previews unchanged.

### Columns

1. Student Averages: Forename, Surname, Completeness, Accuracy, SPaG, Average.
2. Task Heatmap: Forename, Surname, then per-task groups of Completeness, Accuracy, SPaG.

No columns are added, removed, reordered, or resized.

### States

1. **Wide viewport, no horizontal overflow** — no sticky bar; header pins only when it passes the viewport top; fixed columns have no visible effect.
2. **Narrow viewport, horizontal overflow** — sticky bar renders and pins to the viewport bottom while the scroll region crosses the bottom edge; header pins at the top; Forename/Surname remain at the start edge while other columns move.
3. **Table end reached** — once the scroll region's bottom edge is within one native scrollbar height of the viewport bottom, the sticky bar hides and the table's own horizontal scrollbar is reachable at the table's end.
4. **Empty** — existing empty locale (Student Averages) or status paragraph above the table (heatmap); unchanged.

The normative visibility rules for the bar and header are owned by `SPEC.md` ("Core behavioural model"); this document records only their layout presentation: zero offsets, viewport-edge pinning, overlay without reserved space, bar spanning the scroll region's visible width.

## Workflow surfaces

No modal, drawer, or inline panel is added. The two visible interaction flows are Ant Design's own sticky affordances inside the table region.

### Horizontal navigation across a wide table

- **Surface type:** viewport-pinned sticky bar (`.ant-table-sticky-scroll` with `.ant-table-sticky-scroll-bar` thumb), not a modal or drawer.
- **Trigger:** the table has horizontal overflow and its scroll region crosses the viewport bottom edge.
- **Behaviour:** the bar appears at the viewport bottom; dragging it pans the table's `.ant-table-body` horizontally; thumb and scroll position stay synchronised; Forename/Surname stay visible; the bar hides when the table's own scrollbar becomes reachable.
- **Notes:** the bar is a pointer affordance and supplements, never replaces, the table's own scrollbar.

### Vertical reading with a pinned header

- **Surface type:** viewport-pinned header (`.ant-table-header.ant-table-sticky-holder`).
- **Trigger:** the table header would pass the viewport top while rows remain below.
- **Behaviour:** the header pins at the viewport top with offset 0; sort and filter controls stay operable; the header unpins at the table container's bottom edge (allowing for the sticky bar's height while it renders).
- **Notes:** pinning is independent of horizontal overflow.

## Global state rules

- **Blocking error state:** unchanged — the page-level `Result` replaces the content region (the persistent class header stays on the Class page); no table renders.
- **Loading state:** unchanged — labelled `role="status"` skeletons; no table renders.
- **Empty state:** unchanged — `Empty` selections on the Heatmaps page, `Empty` locale in the Student Averages table, status paragraph for the no-submissions heatmap.
- **Sticky bar visible state:** a layout-only state of the table region, governed by `SPEC.md`'s visibility matrix; it overlays the viewport bottom and never reserves space.
- **Pinned header state:** a layout-only state of the table region; overlays the viewport top while the table is read.

## Responsive behaviour

- A narrow viewport must be narrow in both dimensions: width below the surface's horizontal-overflow threshold (measured at runtime as `scrollWidth > clientWidth` on `.ant-table-body`; the repo's 390px `NARROW_VIEWPORT` convention pins the width only) and height below the table scroll region's rendered height (chosen at runtime).
- Forename and Surname stay fixed at 104px + 96px at every width, including 390px; there is no column collapse or responsive exception.
- The document must never gain horizontal overflow at any width: an overflowing table scrolls inside its own `.ant-table-body`, and the fluid heatmap frame widens the container rather than the document.
- Both pinned elements span the scroll region's visible width: the sticky bar directly, and the pinned header through its holder, which clips the full-width header table (`overflow: hidden`).
- Shell header/sider responsive behaviour is unchanged.

## Accessibility and motion

- The split render keeps column headers in the accessibility tree inside the header table; when a source `aria-label` is supplied (Task Heatmap), both tables carry it, so the accessible name resolves to two table elements — accepted in `SPEC.md` as Ant Design's standard fixed-header posture.
- Row and cell assertions base on `.ant-table-body` and header assertions on `.ant-table-header.ant-table-sticky-holder`; tests never resolve a sticky table by accessible name. This locator convention is to be added to `docs/developer/frontend/frontend-testing.md` and `docs/developer/frontend/frontend-playwright-e2e.md` as part of this change (see `SPEC.md` "Documentation and rollout notes").
- The table's own scroll region remains available to keyboard and assistive-technology users; the sticky bar adds no keyboard shortcut and is a pointer-only supplement.
- Fixed name columns remain in the accessibility tree with their existing header names and cell values; header controls keep accessible names and focus order while pinned.
- No new animation is introduced; the existing theme motion token already disables transitions under `prefers-reduced-motion`, so reduced-motion behaviour is unchanged.

## Implementation guardrails

- Express the layout only through `Table` props: `sticky`, the existing `scroll={{ x: 'max-content' }}`, and column `fixed: 'start'`. No new wrapper component, hook, CSS module, or bespoke scrollbar.
- Do not set `scroll.y` or any fixed-height table region; the document stays the only scroll container, and no ancestor of a table may clip (`overflow: hidden`/`clip`) or scroll.
- Leave the sticky offsets at their defaults (`0`); if the shell later gains a fixed header or footer, revisit the offsets in the same change that introduces it.
- Make no width, theme, or global-scrollbar changes; the §7.1 fluid-width exception stays scoped to heatmap pages and panels.
- Do not restyle the sticky bar or pinned header (tokens `stickyScrollBarBg` / `stickyScrollBarBorderRadius` remain Ant Design defaults).
- Do not redefine `SPEC.md`'s behaviour contract or visibility matrix here.

## Open questions

None. All layout decisions are resolved: the document is scoped to the changed table regions (product-owner confirmed), viewport-pinned elements overlay without reserved space (confirmed), and Ant Design's default stacking for the pinned header, fixed columns, and popovers is accepted (confirmed). Offsets, widths, column sizes, and state rules are settled in `SPEC.md`.
