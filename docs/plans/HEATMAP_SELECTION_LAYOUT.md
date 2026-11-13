# Heatmaps Selection Bar Dropdown Header Layout Specification

## Purpose

This document defines the layout, component hierarchy, and user-visible states for the select all / select none header added to the Topics and Assignments dropdowns on the standalone Heatmaps page (issue h-arnold/AssessmentBot#342), and the visible busy behaviour of the selection lag on that page (issue #343).

Use it alongside:

- `docs/plans/SPEC.md` — behavioural contract and decisions
- `docs/plans/ACTION_PLAN.md` — delivery sequencing
- `docs/developer/frontend/frontend-loading-and-width-standards.md` — busy/loading and width standards
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md` — 8px grid

This document is UI-focused; it does not redefine the contracts in `SPEC.md`.

## Scope of this document

1. the structure of the Topics and Assignments `Select` dropdown popups on the standalone Heatmaps page;
2. the select all / select none header row and its states;
3. the visible busy indication while the heatmap recomputes after a selection change (#343).

This document does **not** cover:

- the Class dropdown (single-select; no header);
- the heatmap table, summary cards, or page chrome beyond the busy signal;
- the embedded Class-page heatmap (`TaskHeatmapPage`), which has no selection bar.

## Design principles

1. Use built-in Ant Design Select behaviour; the header is added through `popupRender`, not a bespoke dropdown.
2. The header mirrors the existing option rows' checkbox style, so select-all reads as a bulk toggle of the visible options.
3. Selection state stays owned by `useHeatmapsPageData` / `selectionCascadeReducer`; the header only dispatches the existing `changeTopics` / `changeAssignments` actions.
4. #343 adds no new loading UI: the existing `aria-busy` content region (and Refresh button disabled state) carries the recompute lag.

## Ant Design references consulted

Official Ant Design v6 docs (ant.design/components/select, verified against installed antd 6.6.7 and the cached notes in `docs/developer/frontend/ant-design-docs-cache/select.md`):

- [Select](https://ant.design/components/select) — `popupRender` (custom dropdown content; `dropdownRender` is deprecated), `showSearch` object with `searchValue` (controlled), `onSearch`, `optionFilterProp: 'label'`, `autoClearSearchValue`, `optionRender`, `onSelect`/`onDeselect`/`onChange`/`onOpenChange`, FAQ "I don't want dropdown close when click inside `popupRender`" (`onMouseDown` with `preventDefault()` + `stopPropagation()`)
- [Checkbox](https://ant.design/components/checkbox) — `checked` / `indeterminate`
- [Button](https://ant.design/components/button) — `type="link"` for the "Select none" action
- [Divider](https://ant.design/components/divider) — header/list separation
- Existing app usage of `Flex`, `Space`, `Tooltip`, `Typography.Text` in `HeatmapSelectionBar.tsx`

## Surface hierarchy

```text
Heatmaps page (route)
└── HeatmapBuilderSurface
    ├── PageTitleCard
    ├── PageNavCard (Refresh)
    ├── Card — HeatmapSelectionBar
    │   ├── Class Select (single, searchable, allowClear; no header)
    │   ├── Topics Select (multiple; popupRender header)
    │   └── Assignments Select (multiple; popupRender header; topic-cascade-narrowed options)
    └── ContentRegion (aria-busy)
        └── summary cards + TaskHeatmapTable (or Skeleton / Result / Empty)
```

The standalone Heatmaps page is the only entry point for this layout; no other surface gains the header.

## Region-by-region design

### 1. Selection bar (`HeatmapSelectionBar`)

#### Components

- Existing `Flex` rows of labelled `Select`s; the Class `Select` is unchanged (single-select, no header).
- The Topics and Assignments `Select`s are rendered by the single feature-local header wrapper component (`frontend-shared-helpers-and-abstraction-standards.md` §9.30, `Not implemented`), which owns the controlled `showSearch.searchValue` state for each multi-select and passes `popupRender` containing the header described below; the wrapper guarantees one query state per Select.

#### Dropdown popup structure (Topics and Assignments)

```text
popupRender(originNode = default option list)
├── header row (only when the control's options array — post topic-cascade,
│   pre-search-filter — has more than one entry)
│   └── Flex justify="space-between" (8px-grid spacing tokens, APP_GAP_SM)
│       ├── "Select all": Checkbox (checked/indeterminate) + label, left
│       └── "Select none": Button type="link", right
├── Divider (rendered only together with the header row)
└── originNode (existing optionRender checkbox rows, unchanged)
```

#### Header states

1. **Hidden** — when the dropdown's full option list has 1 or 0 entries.
2. **Ready** — header row present; "Select all" checkbox `checked` when every shown option is selected, `indeterminate` when some but not all are, unchecked (not indeterminate) when the search query matches zero options.
3. **Select all clicked** — unions the currently shown options (search-query-matching; for Assignments also topic-cascade-narrowed) into the existing selection; dropdown stays open; the query is kept (per `SPEC.md` decision 5, the controlled `searchValue` is reset only on option selection via `onSelect`, which a header click never fires).
4. **Select none clicked** — clears the control's entire selection regardless of the query; dropdown stays open; the query is kept (same rule).

#### Notes

- Header clicks must not close the dropdown or steal focus: `onMouseDown` with both `preventDefault()` and `stopPropagation()` on the header container (Ant Design FAQ).
- The header-side scope computation mirrors the Selects' configured `showSearch.optionFilterProp: 'label'` filtering (case-insensitive label match) against the controlled `searchValue`, narrowed by the active topic cascade for Assignments.
- The header is implemented once as a feature-local component under `features/taskHeatmap` and shared by the two Selects (see `frontend-shared-helpers-and-abstraction-standards.md` §9.30, `Not implemented`).

### 2. Content region busy signal (#343)

#### Components

- Existing `ContentRegion` wrapper with `aria-busy` and the visually-hidden live status in `HeatmapBuilderSurface.tsx`; unchanged structure.

#### States

1. **Idle** — `aria-busy="false"`, live status empty.
2. **Refreshing or deferred recompute in flight** — `aria-busy="true"`, live status "Refreshing heatmap…"; the Refresh button is disabled (existing `disabled={isRefreshing}` coupling). The lag condition covers query fetching (existing) plus deferred-vs-urgent `(classId, assignmentIds)` inequality (new).
3. **Empty→selected transition** — the defensive `Skeleton` shows briefly while the deferred pipeline computes; intended, not an error.

## Global state rules

- Blocking error, loading skeleton, and empty states of the content region are unchanged from the current surface precedence (loading → blocking → no-class → no-assignments → table → defensive skeleton).
- The header never renders inside a blocking or loading content region — it lives in the selection Card, which stays interactive throughout.

## Responsive behaviour

- Unchanged: the selection bar's `Flex wrap` with `flex: 1, minWidth: 0` columns; `popupMatchSelectWidth={false}` on both multi-selects; the popup renders at its own width.

## Accessibility and motion

- Header actions carry accessible names: "Select all topics" / "Select none topics" and "Select all assignments" / "Select none assignments". Visible label text is "Select all" / "Select none"; the control qualifier ("topics"/"assignments") is supplied through the accessible name (e.g. `aria-label`), not the visible text.
- Ant Design's Select does not move keyboard focus into the portal-rendered popup (`Tab` selects the active option), so the header actions are pointer-operated; the selection itself remains keyboard-operable through the Select's native option toggling — arrow keys move the active option, Enter/Tab toggle it (Space types into the search input on these searchable selects). This reachability limit is deliberate and recorded in `SPEC.md`.
- The existing disabled-reason pattern for the dependent selects (`aria-describedby` node, DOM-present) is unchanged.
- No new animation or motion; reduced-motion behaviour unchanged.

## Implementation guardrails

- Do not use the deprecated `dropdownRender` or top-level `onSearch`/`searchValue` props; use `popupRender` and the `showSearch` object.
- Do not duplicate header logic across the two Selects; use the single feature-local header component (§9.30).
- Do not add a second selection state machine; dispatch through `selectionCascadeReducer` actions only.
- Do not re-key the pipeline on the urgent selection for table/summary rendering; #343's deferral contract lives in `SPEC.md`.
- Keep the change within `features/taskHeatmap/**`; no imports from `features/classPage/**`.

## Open questions

None — all interaction decisions are pinned in `docs/plans/SPEC.md` (decisions 1, 2, 5) and were confirmed by the user on 13 November 2026.
