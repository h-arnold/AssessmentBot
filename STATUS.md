# Status: Continuous Gradient + Score-Range Filter (Metric Display)

**Branch:** (work-in-progress class-page branch)
**Date:** 2026-07-13
**Author:** opencode (agent session)

---

## 1. Objective

Replace the old 3-band (`red` / `gold` / `green`) metric colouring with a **continuous
red → amber → green gradient** (darker red at the floor, darker green at the ceiling), and
replace the Student Averages / Heatmap column filters from colour-band filters with
**numeric score-range filters** built on an Ant Design `Slider` `filterDropdown`.

Subsequent refinements (this session):

- Make the `N` (not attempted) tone a **darker shade of grey**.
- Make a score of **`1` a darker shade of red**, which also pulls **`2` redder**.
- Add **endpoint numbers** to the filter slider and **`N` / `E` include toggles** to the
  filter dropdown.

---

## 2. Root Cause (original complaint)

`resolveMetricTone` bucketed the 0–5 scale into three bands via
`redAmberBoundary = 1.25` and `amberGreenBoundary = 3.75`, so `{2, 3} → gold` and
`{4, 5} → green` produced **identical** colours. The fix replaces the bands with a continuous
gradient and moves filtering to numeric ranges.

---

## 3. What Has Been Done

### 3.1 Gradient colouring (`metricTone.ts`)

- Removed band logic (`QUARTILE_WEIGHT`, `QUARTILE_DENOMINATOR`, `resolveComputedColor`).
- Added pure helpers: `clampUnit`, `resolveNormalisedPosition`, `resolveGradientFill`,
  `resolveGradientCellStyle`, `resolveDiscreteCellStyle`.
- `MetricToneResolution.color` is now a **`string`** (HSL gradient for computed, fixed token
  for discrete). Added `cellStyle: CSSProperties` so the whole cell carries the colour.
- **Gradient formula (current):**
  - Hue: `120 * t^1.5` (red-biased; `t` = normalised position in `[0, 1]`).
  - Lightness (fill + text): `34 + 9 * sin(π t)` → darkest at the range ends, lighter mid.
  - Cell background: `hsl(hue, 75%, 92%)`; cell text: `hsl(hue, 70%, 32%)`.
- **Effect of the red bias:** `1` → hue ≈ 11° / lightness ≈ 39% (dark red);
  `2` → hue ≈ 30° (red-orange, was ≈ 48° orange); `5` → hue 120° (dark green).
- **`N` tone:** new `NOT_ATTEMPTED_GREY = '#434343'` and `NOT_ATTEMPTED_CELL_STYLE`
  (`backgroundColor: '#e8e8e8'`, `color: '#434343'`). Previously used Ant's near-white
  `default` token. `MetricPill` now renders `N` as a filled dark-grey tag.

### 3.2 Shared score-range filter

- **`metricRangeKey.ts`** (new): `MetricRangeFilterState` type + `encodeMetricFilter` /
  `decodeMetricFilter`. Key format: `min|max|includeNotAttempted|includeError`
  (e.g. `0|5|0|0`). Component-free so it is fast-refresh safe and shared by the builder
  and dropdown.
- **`metricRangeFilter.tsx`** (new): `buildMetricRangeFilter<RecordType>`, `metricInRange`,
  types `MetricRangeFilterOptions` / `MetricRangeFilterProps`.
  - `metricInRange(metric, min, max, includeNotAttempted = false, includeError = false)` —
    backward-compatible signature (kept for existing specs). Computed values must fall in
    `[min, max]`; `N`/`E` pass only when their toggle is on.
- **`metricRangeFilterDropdown.tsx`** (new): `MetricRangeFilterDropdown` component.
  - Two-thumb Ant `Slider` over the metric range.
  - `marks` showing the **`min` / `max` endpoint numbers** on the slider.
  - "**Showing X – Y**" live range readout above the slider.
  - **`Include Not Attempted (N)`** and **`Include Error (E)`** checkboxes — apply the filter
    immediately (dropdown stays open) and persist via the encoded key.
  - **Reset** clears the selection.
  - Split into a standalone component (no sibling non-component exports) to satisfy the
    fast-refresh lint rule.

### 3.3 Consumers updated

- **`studentAveragesTableColumns.tsx`**: `StudentAveragesTableFilters` is now
  `readonly number[]` per column; removed `METRIC_COLUMN_FILTERS` and `arrayOrUndefined`;
  `buildMetricColumn` uses `buildMetricRangeFilter` + `cellStyle`. Stale "band filters"
  comments updated.
- **`TaskHeatmapTable.tsx`**: removed band filter; uses `buildMetricRangeFilter` + `cellStyle`;
  added `DEFAULT_TONE_RANGE`. Stale "band filters" comment updated.
- **`MetricPill.tsx`**: unchanged structurally — consumes `resolution.color` (now an HSL
  string), which renders correctly as a filled Ant `Tag`.

### 3.4 Specs (updated earlier in the session)

- `metricTone.spec.ts`, `MetricPill.spec.tsx`, `studentAveragesTableColumns.spec.tsx`
  (`metricInRange` + range-filter tests), `TaskHeatmapTable.spec.tsx` (rewrote band test to a
  range-filter UI-presence test). These were updated for the _initial_ gradient/range work and
  **will need re-alignment after the visual review** (see §5).

### 3.5 Docs (updated earlier in the session)

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — gradient +
  range-filter contract (helper 1, components 10 & 16, reuse note). The new `N`/`E` toggles and
  red-biased hue are **not yet reflected** here (see §5).

---

## 4. Verification Status

| Check                    | Result                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `eslint` (changed files) | **0 errors** (only pre-existing warnings: magic numbers, `dropdownProperties` abbreviation, `dropdownProps` name) |
| `tsc -b` (frontend)      | **Clean** (exit 0)                                                                                                |
| Affected unit tests      | Not run this session (user deferred — see §5)                                                                     |
| Visual confirmation      | **Pending** — user to verify the look in-browser                                                                  |

The 3 pre-existing test failures noted earlier (`returns five columns…`,
`Average column uses emphasised…`, `RecentAssignmentCard` label test) fail at `HEAD` too and
are unrelated to this change (they concern `MetricIconLabel` accessible-name lookup and the
average column not yet rendering a `MetricPill`).

---

## 5. Outstanding / To Do

1. **Visual review (blocking for sign-off).** User to confirm in-browser:
   - `N` grey is dark enough.
   - `1` reads as dark red and `2` reads redder.
   - Slider endpoint numbers + "Showing X – Y" readout are clear.
   - `N` / `E` toggles behave as expected (immediate apply, persist across open/close).
2. **Re-align specs after visual review** (user deferred tests this session):
   - `metricTone.spec.ts` hue/lightness assertions (now use `120 * t^1.5` and `34 + 9·sin`).
   - `metricTone.spec.ts` `NOT_ATTEMPTED` assertions (now `#434343` / grey cell style).
   - `metricRangeFilterDropdown` / `TaskHeatmapTable.spec.tsx` — add coverage for the `N`/`E`
     toggles and slider `marks`/readout if desired.
   - Re-run the full `dataAnalysis` + `classPage` suites and confirm only the 3 pre-existing
     unrelated failures remain.
3. **Doc update** for the `N`/`E` toggles and red-biased hue in
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
4. **Decision: default for `N`/`E` toggles.** Currently default **off** (range filter hides
   `N`/`E`). Confirm this is the desired default, or whether the dropdown should remember the
   last toggle state per column across filter changes (today it is seeded only from the stored
   `selectedKeys`).
5. **Pre-existing unrelated failures** (`ClassPage.tsx` `tsc` error at the `HEAD` WIP state,
   plus the two `studentAveragesTableColumns.spec.tsx` / `RecentAssignmentCard.spec.tsx`
   failures) are out of scope for this change but will block a clean pre-commit hook if/when
   this branch is committed. Recommend a separate fix pass.

---

## 6. Relevant Files

| File                                                                                 | Role                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`                 | Gradient resolver + `cellStyle` + `N` grey                |
| `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts`             | `MetricRangeFilterState` encode/decode                    |
| `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx`         | `buildMetricRangeFilter` + `metricInRange`                |
| `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.tsx` | Slider dropdown + `N`/`E` toggles                         |
| `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`                | Consumes `resolution.color` (HSL)                         |
| `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`                | Range filters + `cellStyle`                               |
| `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`                           | Range filters + `cellStyle`                               |
| `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`                   | Filter wiring (static `filters` state → Ant uncontrolled) |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`       | Shared-helper contract (partly updated)                   |

---

## 7. Open Questions for the User

- Is the current **off-by-default** behaviour for `N`/`E` toggles acceptable, or should they
  default to visible?
- Should the gradient's red bias be tuned further (e.g. stronger `t^1.5`, or a different
  exponent) once seen on real data?
- Any preference on whether the slider should also show intermediate tick labels (e.g. every
  integer) rather than just the two endpoints?
