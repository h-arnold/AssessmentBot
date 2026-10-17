# Attempt-Baseline Mode Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the **Class-page attempt-baseline analysis mode** (issue #305). The mode recomputes the Class page's aggregates from the task set shared by the top-decile most-engaged students.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`, `frontend-spacing-and-padding-standards.md`, `frontend-shell-navigation-and-motion.md` where they affect this surface

This document is intentionally UI-focused. It does not replace the underlying feature spec, data contracts, or implementation plan.

## Scope of this document

This document covers:

1. the Class-page region that hosts the mode control (the **only** surface hosting it)
2. the user-visible states of the control and of the aggregates it changes
3. the presentation of baseline-off heatmap task columns in the embedded heatmap view
4. accessibility, responsive, and motion expectations specific to the new elements

This document does **not** redefine:

- analysis contracts, pool/baseline derivation, or availability rules — settled in `SPEC.md` decisions 1–9
- the Heatmaps page (`features/taskHeatmap/` standalone surface), which never enters baseline mode and has no control (SPEC decision 1)
- shared frontend policies already defined in canonical developer docs

## Design principles

1. The control is a page-level filter, not a page identity change: no navigation layers are added and the page title stays first in reading order.
2. Mode visibility is never tooltip-only: the control's state is visible text, and baseline-off columns are marked in visible headings with a page-level caption.
3. Reuse documented precedents before inventing: the disabled-control tooltip treatment follows `HeatmapSelectionBar.tsx`, and the heatmap column marking follows `buildTaskHeaderPresentation` in `taskHeatmapZeroWeightHeader.tsx`.
4. The control must remain reachable and functional in every non-loading state, including blocking failures (SPEC decision 6a: the escape route back to `absolute`).
5. Spacing follows the 8px grid via existing tokens; no bespoke layout abstractions are introduced.

## Ant Design references consulted

Consulted for this layout (official documentation and installed antd 6.6.5 definitions; `Segmented`'s official page was fetched during planning, the components below have in-repo cache notes under `docs/developer/frontend/ant-design-docs-cache/`):

- [Segmented](https://ant.design/components/segmented) — the mode control: controlled `value`/`onChange`, two labelled options (`SegmentedLabeledOption` in the installed package), whole-control `disabled`, per-option `tooltip` (supplied **only** in the enabled branch — see the recorded decision, so two popups cannot compete while disabled), `name` for radio-group keyboard semantics, `small` size (24px height)
- [Tooltip](https://ant.design/components/tooltip) — disabled-reason copy; `trigger` `['hover', 'focus']` per the zero-weight precedent
- [Switch](https://ant.design/components/switch) — considered and rejected: a two-state boolean affordance mislabels a mode where the underlying question is "which tasks count", and `Segmented` gives each mode an explicit name (SPEC's layout-phase consultation)
- [Result](https://ant.design/components/result) — existing Class-page blocking state (`ClassPageBlocking`); unchanged
- [Skeleton](https://ant.design/components/skeleton) — existing shape-matched loading treatment; unchanged
- [Table](https://ant.design/components/table) — existing student averages table and embedded heatmap table; only header-cell presentation changes
- [Flex](https://ant.design/components/flex) / [Space](https://ant.design/components/space) — existing layout primitives around the header slot

## Surface hierarchy

```text
ClassesPage (pages/ClassesPage.tsx)
└── ClassPage (features/classPage/ClassPage.tsx)
    └── <Flex vertical>
        ├── ClassPageHeader (local component, always rendered when !isLoading)
        │   ├── PageTitleCard (class name) — unchanged, action-free
        │   ├── [NEW] Mode-control slot — always rendered when the header renders
        │   └── PageNavCard (overview child view only) — unchanged
        └── ClassPageContent (per-state dispatcher)
            ├── Loading: shape-matched skeleton (no header, no control)
            ├── Blocking: ClassPageBlocking Result (control stays visible above it)
            └── Ready (renderReadyContent)
                ├── RecentAssignmentsSection — card aggregates change with mode
                ├── StudentAveragesTableCard — averages change with mode
                └── TaskHeatmapPage (embedded child view) — column marking only
```

The Class page via `ClassesPage → ClassPage` is the only supported entry point for the mode control. No control is added to the Heatmap builder surface, the Heatmaps page, assignment pages, or the embedded `PageNavCard` actions slot. Modal surfaces (including `AssessTaskModal`) never see the mode; they show task-level evidence only.

## No extra navigation layers

No nested tabs, routes, accordions, or secondary structure are introduced. The mode toggle is a single always-visible control next to the page title; its entire effect is on the data already on screen.

Rationale:

- Mode is one binary question; surrounding content with navigation would bury it
- aggregates and markings must stay simultaneously visible so the user can compare modes while switching
- a section re-render on toggle is synchronous (SPEC decision 5); no async or modal workflow is involved

## Recommended page skeleton

```text
ClassPage
└── Flex vertical, gap APP_GAP_MD (existing)
    ├── PageTitleCard (class name)
    ├── [NEW] Mode-control slot — always rendered when !isLoading
    │   └── Card size="small" (mirrors HeatmapBuilderSurface's control card)
    │       └── Flex horizontal, gap APP_GAP_SM
    │           ├── visible group label "Averages basis"
    │           └── Segmented (small): "All tasks" | "Baseline tasks"
    ├── PageNavCard (overview child view only)
    └── ClassPageContent (state-dependent)
```

The slot is a **third element in the existing vertical card stack**, inserted between `PageTitleCard` and `PageNavCard` — this mirrors the app's one existing page-level control placement (`HeatmapBuilderSurface`: `Flex vertical` → `PageTitleCard` → `PageNavCard` → control `Card size="small"` → content region). The app has no horizontal header row anywhere (`PageTitleCard` call sites are all vertical stack members), so the control is **not** placed beside the title, and `PageTitleCard` stays full-width and unchanged. The chosen card keeps default `bodyPaddingSM` padding — no Card padding override.

## Recommended top-level UI components

### 1. `Segmented` (mode control)

Use `Segmented` for:

- the two-option mode selection

Reason:

- both options deserve explicit names — this is not an on/off boolean (rejecting `Switch`)
- controlled `value`/`onChange` mirrors the existing `HeatmapSelectionBar` single-selection patterns
- `name` keeps radio-group arrow-key semantics; `small` matches compact header placement
- installed types are `antd`'s `Segmented`/`SegmentedProps` and `SegmentedLabeledOption`/`SegmentedOptions` (the docs site's `SegmentedItemType` name does not exist as an export in the installed package — use `SegmentedLabeledOption`)
- whole-control `disabled` is the settled semantics for the unavailable state; per-item `disabled` + per-item `tooltip` is **rejected** as a fallback because the root stays enabled and focusable under it, contradicting the settled whole-control disabled state

### 2. `Tooltip` (unavailable reason and column explanation)

Use `Tooltip` for:

- the disabled control's reason (hover) as the hover-complement to the always-present sr-only description node
- baseline-off column explanations (mirroring the zero-weight precedent's `trigger={['hover', 'focus']}`)

Reason:

- keeps disabled-state copy out of the layout while remaining discoverable by keyboard via the focusable target
- exact reuse of an established, tested pattern

### 3. `Table` header-cell annotations (heatmap columns)

Use the existing `buildTaskHeaderPresentation`-style tuple for:

- baseline-off task-column headings in the embedded heatmap

Reason:

- the zero-weight precedent already solves "mark a non-averageing column with explanation + accessible header label"; baseline marking is the same shape with different cause

## Region-by-region design

## 1. Class-page header — mode-control slot

### Components

- `Segmented` (small) with visible group label
- `Tooltip` (disabled reason only)
- sr-only description node — **always rendered** (precedent: `HeatmapSelectionBar.tsx` renders it unconditionally so the `aria-describedby` target is robustly reachable)

### Content

- Visible group label: **"Averages basis"** (label element tied to the control via `id`/`aria-labelledby`; the label spells out what the toggle changes — the basis of the computed averages)
- Two options, in this order:
  1. **"All tasks"** — absolute mode (default on arrival)
  2. **"Baseline tasks"** — top-decile baseline mode
- Per-option tooltip (baseline option only), visible-copy summary: _"Uses the tasks the ten-percent most-engaged students (minimum 2) have all attempted."_ (final copy owned by this document; see States for the ineligible variants)
- Sr-only node text: when disabled, carries the same reason copy as the tooltip (single source: `ClassPageData.baselineAvailability.reason`). **The node is always in the DOM** (matching the `HeatmapSelectionBar` precedent recorded in the decision section): when enabled — `reason` is `null` — it renders as an **empty-text** node, and only the `aria-describedby` binding on the control is conditional (bound while disabled, absent when enabled). Red-phase DOM assertions target: node present in both states, empty content when enabled, reason copy when disabled, `aria-describedby` bound exactly while disabled

### Placement

- Inside `ClassPageHeader`'s fragment as a **third stacked element between `PageTitleCard` and `PageNavCard`**, formatted as `<Card size="small">` wrapping a horizontal `Flex` (`wrap`, `align="center"`, gap `APP_GAP_SM` — `wrap` matches the existing control-bar precedent in `HeatmapSelectionBar`/ builder surface context and prevents narrow-width overflow; `align="center"` is chosen on its own merits to vertically centre the single-row label next to the control) containing the visible group label and the `Segmented` — mirroring `HeatmapBuilderSurface`'s control card so no new layout pattern exists in the app. The **order deviation is deliberate**: `HeatmapBuilderSurface` places its control card after `PageNavCard`, but here the slot sits **before** it so the control's position is fixed across both child views (`PageNavCard` is overview-gated and would otherwise shift it)
- Rendered in **both** child views (overview and embedded heatmap) because the header renders whenever `!isLoading` (verified: `ClassPage.tsx:164–172`); `PageNavCard` remains overview-gated and unchanged
- The `navigation-consistency-status.md` "Layout per page level" section gains this third always-rendered element (it currently documents the two-card vertical stack); SPEC's same-change documentation list already mandates the update

### States

1. **Initial loading** (skeleton)
   - the header is not rendered, so the control is absent — nothing is interactive before data arrives
2. **Ready (eligible)**
   - enabled; selected option reflects `analysisMode`; selection is synchronous content update (no spinner)
3. **Awaiting data**
   - disabled; tooltip and sr-only node both say **"Waiting for class data"**; neutral, non-blaming copy
4. **Ineligible — roster below 3 students**
   - disabled; reason names it in plain language, e.g. **"Baseline mode needs at least 3 students in this class"**
5. **Ineligible — fewer than 2 engaged students**
   - disabled; reason names it, e.g. **"Baseline mode needs at least 2 students who attempted some work"**
6. **Blocking failure — after at least one successful result (baseline-mode throw)**
   - availability is `'ready'` from retained evidence (SPEC decision 6), so the control is **enabled**; the selected option stays the user's chosen mode (baseline stays selected while its failure is displayed); switching to "All tasks" recovers the page
   - the content region below shows the existing `Result` treatment
7. **Blocking failure — before any successful result (initial mount failure, dataset blocked/untrustworthy, adapter throw)**
   - availability is `'awaiting-data'` (SPEC decision 6: never `'ineligible'` while no successful analysis is possible), so the control is **disabled with "Waiting for class data"**
   - no mode-switch escape is needed here: the mode can only be `absolute` because no baseline run ever succeeded in this mount
8. **Mode state presentation while blocking**
   - the selected option always reflects `analysisMode`, so the mismatch between control and content is visible and explained by the `Result`'s retry affordance and the mode switch

### Notes

- The control never silently snaps itself back; only the user, a class change (remount), or a new page load changes the selection
- No layout shift in the overview regions when toggling: the students table already reserves fixed width for the visible `Excluded` label (`APP_COL_WIDTH_METRIC_PILL`), and card shapes are mode-invariant by construction; the Segmented track width is stable. **Exception (accepted):** the embedded heatmap view gains its caption line when baseline mode first marks a column — content below it is pushed down, and no scroll-anchor handling is added; this is a deliberate, bounded one-time shift
- Disabled-state semantics: the disabled control surfaces as the `-disabled` root class plus `disabled` radio inputs (neither antd nor `@rc-component/segmented` emits `aria-disabled` — red-phase tests assert class and input state, not an aria attribute); the sr-only node carries the reason while disabled

## 2. Recent-assignment cards

### Components

- existing card family (`RecentAssignmentCard`), unchanged structurally

### Content and states

1. **Absolute mode**
   - unchanged presentation
2. **Baseline mode**
   - aggregates recompute from baseline-restricted evidence; card pills reflecting `excluded` (either cause) render the mode-aware accessible label (SPEC decisions 7–8: baseline-mode label wording names both causes — zero weighting and outside the baseline task set)
   - a card whose criteria are all `error` keeps today's error presentation (`error` is never converted to `excluded`)
3. **Interaction rule**
   - no per-card control is added; the single header control governs all cards

### Notes

- Cards keep their existing count/status badges; only metric pills and their accessible labels change with mode
- In baseline mode the assignment summary cards (descriptive task evidence) are unchanged (SPEC decision 9)

## 3. Student averages table

### Components

- existing `StudentAveragesTableCard` and its column builder; no structural change

### Content and states

- Averages recompute per mode; the `excluded` state's accessible label is mode-aware through the column builder (planned helper entry)
- No extra column, badge, or filter is added for the mode; the header control plus task-column markings carry mode context

### Notes

- Row order and sort rules are unchanged across modes
- The table itself does not re-mount on toggle; values update in place

## 4. Embedded heatmap view — baseline-off column marking

### Components

- existing `TaskHeatmapTable`; header-cell annotation pattern from `taskHeatmapZeroWeightHeader.tsx`

### Recommended structure

```text
TaskHeatmapPage (embedded)
├── PageTitleCard (assignment, existing)
├── PageNavCard heatmap view (existing, "Back to overview")
├── HeatmapSummary cards (existing)
├── Card size="small"
│   ├── Notice / caption stack (inside TaskHeatmapTable, above the Table)
│   │   ├── existing no-submissions notice (when applicable)
│   │   └── [NEW] baseline caption (when ≥1 marked column)
│   └── TaskHeatmapTable
│       ├── Task-column heading group (per task)
│       │   └── marked heading: visible marker + Tooltip + onHeaderCell aria-label
│       └── cells (unchanged values)
```

### Content

- Column marking: a heading **suffixed with the visible marker "†"** for each column whose `includedInAttemptBaseline` is `false`; the heading is wrapped in the precedent's focusable `<span>`/`Tooltip` pattern with explanation copy _"Task outside the baseline set — shown, but not included in baseline averages."_
- **Visual language rules (decided):** marked headings **reuse** the zero-weight group class and metric edge classes (`ZERO_WEIGHT_GROUP_CLASS` + edge classes) — one "not averaging" visual language; the two causes are distinguished only by tooltip and `aria-label` text, never by different chrome. **Both** zero-weight helpers gain the new input as an options-object parameter — `buildTaskHeaderPresentation` for the heading tuple and `getZeroWeightMetricEdgeClass` for the `FIRST`/`LAST` edge classes, the latter applied at `taskHeatmapTableColumns.tsx:280–284` to metric headers **and body cells**; leaving the second helper untouched would give baseline-off columns the group chrome but lose the edge treatment, contradicting this one-language rule. When zero-weight and baseline-off co-occur, the `Tooltip` body is **one text with both facts, baseline-off first** (no stacked tooltips, no separate class layer), and the composed `aria-label` follows the same order. Extending the constants or these classes touches existing assertions: `TaskHeatmapTable.zeroWeight.spec.tsx` asserts the constants and classes verbatim — helper-signature assertions at `:108` and DOM body-cell class assertions at `:168–170` and `:271–272` (the affected test bodies span roughly `:106–282`).
- **Flag plumbing ownership:** the flag reaches `TaskHeatmapColumn` (`taskHeatmapTableColumns.tsx:60–68`) as a **required** field — an optional field plus a `?? true` fallback would be an un-instructed default (root `AGENTS.md` §2.1.7) and would betray the SPEC rule that a column without baseline information must never silently read as included. SPEC names only `HeatmapTaskColumn` (the adapter interface); this table-level hop plus its required-field blast radius is owned by this feature's implementation: `TaskHeatmapTable.merged.spec.tsx:99/145/202` hand-builds `MergedHeatmapTaskColumn[]`, and `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` plus the heatmap fixture modules update (the presentation contract stays a TS interface, not a Zod shape — no data-shape entry).
- Caption line (rendered once above the table when at least one marked column exists): _"† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them."_
- **Caption ownership and placement (decided):** the caption lives **inside `TaskHeatmapTable`**, immediately above the `<Table>`, after its existing above-table notice — the component that already holds `taskColumns` and already owns an in-place notice, so no prop plumbing is added and "above the table" is unambiguous. It renders as `Typography.Paragraph` — same element and live semantics as the existing sibling notice (`role="status"`, `aria-live="polite"`), with `type="secondary"` added for the explanatory tone — **deliberately so**: entering baseline mode silently changes aggregates, and this is the only surface-level explanation on the heatmap view; live-region announcement makes the aggregate change non-silent for AT users. Spacing follows the Card's existing stack (no new token).
- Merge behaviour: when a column group is merged, the merged column inherits the flag via the existing spread; if the merged flag is `false` the merged heading receives the marker (a merged group of mixed membership cannot occur: merge keys are definition-scoped and the flag is per task key)

### States

1. **Absolute mode**
   - no markers, no caption (byte-identical presentation to today)
2. **Baseline mode with marked columns**
   - markers + caption as above
3. **Baseline mode with no marked columns** (e.g. every task in baseline)
   - no markers, no caption — indistinguishable from absolute mode in the table; the control's active option is the sole mode indication, which is sufficient because aggregates do change

### Notes

- Cell values, colours, and cell tooltips are unchanged (SPEC decision 8: column-level marking only in v1; cell-level marking is out of scope)
- The zero-weight annotation and the baseline annotation may co-occur on one column (zero-weight tasks can be inside or outside the baseline). Ordering rule: the zero-weight `Tooltip` body is extended — zero-weight plus baseline-off renders one tooltip body with both facts, baseline-off first — never two stacked tooltips on one target

## Data-heavy regions

The student averages table and heatmap table are existing data regions; only the header-cell annotation and accessible-label rules above change. Additional rules for this feature:

### Core features to use

- existing row keys and sort orders (unchanged)
- `onHeaderCell` accessible labels for marked columns (precedent)
- no pagination or virtualisation changes

### States

1. **Initial load in progress** — existing skeletons; no mode-specific treatment
2. **Ready with data** — per-region states above; every aggregate update is a synchronous in-place re-render
3. **Ready with no data (empty class)** — existing empty states; the mode control is ineligible-disabled with its named reason
4. **Partial/load warnings** — unchanged (no new warning types)
5. **Blocking failure** — content replaced by `Result`; control per header-region states above

### Copy homes (decided)

All six new strings live in the codebase's two established locations:

- **Header copy** → `src/frontend/src/pages/pageContent.ts` under `classDetail` (the page-level copy module the Class page already uses): the group label "Averages basis", the two option labels, and the per-option tooltip summary
- **Heatmap-side copy** → constants co-located beside `taskHeatmapZeroWeightHeader.tsx` (the existing home of `ZERO_WEIGHT_EXPLANATION` and the group/tooltip class constants): the column tooltip explanation, the caption line, and the "†" marker
- The **disabled reason** strings are not new copy here — they are produced by the hook per SPEC decision 6 (`ClassPageData.baselineAvailability.reason`: neutral "Waiting for class data" plus the two eligibility reasons)

## Workflow surfaces

No new modal, drawer, popover, or inline-expansion workflow. `AssessTaskModal` and all existing modals are untouched by the mode and show task-level evidence only.

## Global state rules

### Blocking error state

- Content region: existing `ClassPageBlocking` `Result` (retryable `warning` for `analyserError`), unchanged
- Header region:
  - **baseline throw after a first successful result** — control enabled; toggling to "All tasks" recovers without needing `Retry` to resolve the deterministic throw
  - **blocking before any successful result** — control disabled with "Waiting for class data" (no escape needed; mode is still `absolute`)

### Partial-load state

- No new partial-load states; existing dataset warnings unchanged

### Empty state

- Existing class-empty/empty-observation treatments unchanged; the control is disabled with the named ineligible reason

### Success and mutation feedback

- Mode switches are silent and synchronous; no toast, message, or banner is added. The control's selected option plus the visible aggregate/mark changes are the feedback

## Responsive behaviour

- The mode-control slot wraps below the title on narrow widths (flex wrap); `Segmented` keeps its intrinsic content width and never stretches (`block` stays off) so the option labels never truncate
- The caption line above the heatmap table wraps to two lines on narrow widths; never clipped
- No scroll-anchor rules: the only toggle-induced height change is the heatmap caption line (accepted above); the overview regions keep their height across modes
- Minimum action visibility: the control stays visible on narrow widths (no collapse into an overflow menu)

## Accessibility and motion

- The control is an `aria-labelledby`-bound radio group (`Segmented` renders `input[type=radio]`; `name` groups arrow-key navigation); the label text "Averages basis" is the primary accessible name — the sr-only `aria-describedby` node supplies the disabled reason whenever the control is disabled and never relies on hover
- Installed-component facts worth recording: `@rc-component/segmented` imposes `role="radiogroup"`, a hard-coded `aria-label="segmented control"`, and `tabIndex: 0` **when enabled** (`tabIndex` is dropped when whole-control-disabled). Because caller props are spread after those defaults, `aria-labelledby` both applies and **overrides** the hard-coded label — set it explicitly so nobody relies on (or unknowingly leaves) the default English label; the group is unfocusable while disabled
- The disabled reason lives in one place (`ClassPageData.baselineAvailability.reason`) shared by the tooltip and the sr-only node, so hover and screen-reader text are identical by construction
- Marked column headings expose their explanation both visually (marker + tooltip on hover/focus of the focusable heading span) and to assistive tech (`aria-label` on the heading span and `onHeaderCell` on the column), mirroring the zero-weight precedent
- The mode-aware `excluded` accessible label keeps pill and table-cell announcements truthful in both modes (SPEC decision 7); no cause field exists in data, by design
- `Segmented` (small) introduces a thumb-slide animation (`MotionThumb`, `thumb-motion`, transitions on `transform`/`width` via `motionDurationSlow`); reduced motion is covered **indirectly** by the shell's global reduced-motion token (`AppThemeShell` sets `motion = !shouldReduceMotion`, and antd's alias zeroes all durations when `motion === false`) — no component-level handling is added. Post-toggle E2E assertions and screenshot capture should let the thumb motion settle first
- Focus is preserved across a mode toggle (re-render does not remount the control or tables)

## Existing artefacts affected

- **Committed Playwright baselines:** the Class-page header appears inside `src/frontend/e2e-tests/navigation-screenshots.spec.ts-snapshots/class-page-overview-chromium-linux.png` and `task-heatmap-chromium-linux.png`; the new header card changes both — re-capture is an explicit deliverable (also recorded in SPEC's E2E bullet), not something to lean on the suite's `maxDiffPixelRatio: 0.1` tolerance for. `heatmaps-builder-chromium-linux.png` must **remain unchanged** — the Heatmaps builder surface gains nothing from this feature
- **First use of `Segmented` in the app:** no current uses exist, so its rendering is unverified in situ — the first implementation step verifies the control inside the new header card in **both themes** (light/dark), focus-ring visibility, and the thumb motion (reduced-motion covered by the global token above)

## Implementation guardrails

- Do not render a mode control anywhere except the Class page header slot (SPEC decision 1); do not mode-gate `PageTitleCard` or `PageNavCard`
- Do not add a per-card, per-table, or per-cell mode switch
- Do not change cell values, colours, or cell tooltips for baseline-off columns
- Do not introduce bespoke abstractions where the Ant Design primitives and existing precedents (`buildTaskHeaderPresentation`, `HeatmapSelectionBar` disabled-tooltip treatment) suffice
- Do not show a spinner, skeleton, or message for the synchronous mode switch
- Do not re-derive accessible-label wording outside the planned `metricDisplay` helper entries (SPEC helper planning)
- Keep all new spacing on the 8px grid via existing tokens

## Recorded decision: disabled-tooltip treatment

**No `<span>` wrapper is required** — recorded now from installed-package source, with the live check kept as the first implementation step: `antd/lib/segmented/index.js` spreads caller props straight into `@rc-component/segmented`, whose root is a `div` that receives the spread **after** its own defaults (`es/index.js:197–215`), so Tooltip-injected mouse handlers land on the root; and `antd/lib/segmented/style/index.js:11–18, 202–203` sets only `color` + `cursor: not-allowed` for the disabled state — **no `pointer-events: none`** exists, unlike the disabled-`Button` case the shared wrapper-span rule was written for. Therefore `<Tooltip><Segmented disabled /></Tooltip>` fires on hover without a wrapper.

Decision rule pinned for the first-implementation live check: if a live contradiction appears (tooltip does not fire), adopt the wrapper-`<span>` fallback from `HeatmapSelectionBar`'s precedent — the sr-only node, uniform `reason` copy, and this decision's DOM assertions are unchanged by that swap. Per-item `disabled` + `tooltip` is not a sanctioned alternative (see the rejected-fallback note above). **Per-option tooltips are supplied only in the enabled branch** (omitted entirely while the control is disabled): antd implements option `tooltip` by wrapping each item node in a `Tooltip` unconditionally (`antd/es/segmented/index.js:86–98`), so with the disabled-reason `Tooltip` on the root, a disabled-state hover would otherwise fire two competing popups on one control; in the disabled state the root reason tooltip alone explains the situation. The sr-only node follows the `HeatmapSelectionBar` precedent **exactly**: module-level constant id (`DISABLED_REASON_ID`-style, safe because the Class page mounts once), sr-only node **always** rendered, Tooltip mounted unconditionally with `title={undefined}` when enabled, and `aria-describedby` bound only while disabled — leaving none of this conditional keeps red-phase DOM assertions deterministic.

## Open questions

None — all layout decisions above are settled; the Segmented disabled-tooltip check above is a verification step with a pinned decision rule, not an open product question.
