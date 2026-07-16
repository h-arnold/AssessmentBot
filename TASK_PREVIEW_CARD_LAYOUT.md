# Task Preview Card Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the **Task Preview Card** — the Ant Design Popover that appears when hovering over or clicking a metric sub-cell in the `TaskHeatmapTable`.

Use it alongside:

- `SPEC.md` (domain rules, contracts, scope boundaries)
- `ACTION_PLAN.md` (implementation sequencing)
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md` (8px grid)
- `docs/developer/frontend/frontend-modal-patterns.md` (popover-family guidance)

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. The popover trigger and placement behaviour on the heatmap table
2. The internal layout of the popover card (header, reasoning, student response)
3. The three artifact renderers (image, markdown table, markdown text)
4. The user-visible states (computed, notAttempted, error, no-data)
5. Responsive and accessibility expectations

This document does **not** redefine:

- Backend contracts already settled in `SPEC.md`
- Rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- Shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the popover content self-contained — no navigation, no actions, no edits.
2. Use Ant Design `Popover` with its built-in `trigger={['hover', 'click']}` behaviour.
3. The card body scrolls when content exceeds the viewport — never let the popover overflow the screen.
4. Preserve the heatmap table layout — the popover is an overlay, not an inline expansion.
5. Keep the trigger element a plain `<span>` (non-focusable) in v1; keyboard focus trigger is deferred.
6. Spacing follows the 8px grid exclusively (see `frontend-spacing-and-padding-standards.md`).

## Ant Design references consulted

- [Popover](https://ant.design/components/popover) — trigger wrapper with hover + click-to-pin
- [Card](https://ant.design/components/card) — content container inside the popover
- [Typography](https://ant.design/components/typography) — section labels and reasoning text
- [Divider](https://ant.design/components/divider) — separator between reasoning and response sections
- [Tag](https://ant.design/components/tag) — reused via `MetricPill` for the score display
- [Image](https://ant.design/components/image) — considered but rejected; a plain `<img>` is sufficient for v1

## Surface hierarchy

```text
TaskHeatmapTable (Ant Design Table)
└── Metric sub-cell <td> (render function)
    └── Ant Design Popover (trigger={['hover', 'click']}, placement="right")
        └── Ant Design Card (size="small", maxWidth=400)
            ├── Card title (header row)
            │   ├── Typography.Text (metric label with colon, e.g. "Completeness:")
            │   └── MetricPill (score tag)
            └── Card body
                ├── Reasoning section
                │   ├── Typography.Text label: "Reasoning"
                │   └── Typography.Text content: reasoning string
                ├── Divider
                └── Student Response section
                    ├── Typography.Text label: "Student Response"
                    └── Artifact renderer
                         ├── ImageRenderer (<img>) — for IMAGE artifacts
                         └── MarkdownRenderer (react-markdown) — for TABLE/TEXT artifacts
```

This is the only supported entry point for the feature. The popover is triggered exclusively from metric sub-cells in the `TaskHeatmapTable`.

## No extra navigation layers

The popover is a read-only preview surface. It contains no tabs, no accordions, no links, and no action buttons. Rationale:

- The user's goal is to quickly inspect the reasoning and response for a single cell — a single scrollable card is the simplest layout.
- Adding tabs or nested navigation would force the user into a secondary workflow for what should be a glanceable interaction.
- The click-to-pin behaviour (Popover `trigger={['hover', 'click']}`) already supports extended reading without needing a separate modal or drawer.

## Outer layout

The popover is positioned by Ant Design's Popover placement engine. The spec recommends `placement="right"` so the card appears to the right of the hovered cell, keeping the user's focus on the table. Ant Design auto-flips to `left` when the right side is off-screen.

The popover's width is determined by its content, capped at 400px by the card's `maxWidth`. The card body has a `maxHeight: 480` with `overflow: 'auto'` to prevent viewport overflow.

## Region-by-region design

## 1. Popover trigger (metric sub-cell)

### Components

- Ant Design `Popover` wrapping the existing cell `render` output (`<span>{renderScore(m)}</span>`)

### Content

The trigger element is the existing metric score `<span>` rendered by `TaskHeatmapTable`. No visual change to the trigger itself — the popover is an invisible wrapper.

### States

1. **Idle** — cell displays the metric score as before (no popover visible)
2. **Hover** — after `mouseEnterDelay` (0.1s), the popover appears
3. **Pinned** — after click, the popover remains visible after mouse leave
4. **Closed** — after mouse leave (unpinned) or second click (pinned), the popover disappears

### Notes

- The trigger element is a plain `<span>` (not focusable). Keyboard focus trigger is deferred.
  - The Popover keeps its content cached between hover cycles by default: `fresh` (boolean, default `false` since antd 5.10.0) means the tooltip caches content when closed, so no override is required to avoid re-rendering the markdown/image on each hover. `destroyOnHidden` (default `false`; the v5 `destroyTooltipOnHide` was renamed to `destroyOnHidden` in v6) keeps the DOM mounted rather than unmounting it on hide. Both defaults yield the desired "keep mounted and cached" behaviour, so no explicit prop override is required unless a future antd major version changes them.

## 2. Popover card header

### Components

- Ant Design `Card` with `size="small"` and `style={{ maxWidth: 400 }}`
- `MetricPill` (reused from heatmap cells)
- `Typography.Text` for the metric label with colon

### Content

The card `title` is a centred horizontal flex row containing:

1. `Typography.Text` — the metric label from `METRIC_DISPLAY_META.get(metricKey).label` with a trailing colon (e.g. "Completeness:", "Accuracy:", "SPaG:")
2. `MetricPill` — the score tag, reassembled from `metricState` + `metricScore`

### Recommended structure

```text
Card title (Flex row, gap=8, justify=center)
├── Typography.Text (metric label with colon, e.g. "Completeness:")
└── MetricPill (score, precision=0, compact=true)
```

### States

1. **Computed** — `MetricPill` shows the integer score with tone colour (red/gold/green gradient)
2. **Not-attempted** — `MetricPill` shows "N" in grey (`default` token)
3. **Error** — `MetricPill` shows "E" in `volcano`

### Notes

- `MetricPill` is used with `precision={0}` (integer scores) and `compact={true}` (smaller footprint for the dense header).
- The header uses `Flex` with `gap={APP_GAP_SM}` (8px) and `justify="center"` for centred spacing between label and pill.
- The card is constrained to `maxWidth: 400` to keep the preview compact.

## 3. Reasoning section

### Components

- `Typography.Text` with `strong` for the section label
- `Typography.Paragraph` or `Typography.Text` for the reasoning content

### Content

- Label: "Reasoning" (bold, `Typography.Text strong`)
- Content: the LLM reasoning string from the assessment (plain text, no markdown rendering needed — reasoning is always plain prose)

### Recommended structure

```text
Flex vertical, gap=8
├── Typography.Text (strong): "Reasoning"
└── Typography.Text: reasoning string (or "No reasoning available" placeholder)
```

### States

1. **Ready** — reasoning text is displayed
2. **Empty** — "No reasoning available" placeholder (reasoning string is empty or missing)

### Notes

- Reasoning is rendered as plain text (not markdown) because the LLM always returns prose for the reasoning field.
- The reasoning text wraps naturally within the card body width.
- No `maxHeight` on the reasoning section alone — the card body's `maxHeight` with `overflow: 'auto'` handles long reasoning.

## 4. Divider

### Components

- Ant Design `Divider` with `plain` variant (or default)

### Content

A horizontal rule separating the reasoning and student response sections.

### Notes

- The `Divider` uses Ant Design's default styling — no custom margins needed.
- In dark mode, the divider colour adapts automatically via the design token.

## 5. Student Response section

### Components

- `Typography.Text` with `strong` for the section label
- `ImageRenderer` (for IMAGE artifacts) or `MarkdownRenderer` (for TABLE/TEXT artifacts)

### Content

- Label: "Student Response" (bold, `Typography.Text strong`)
- Content: the artifact, rendered by the appropriate renderer

### Recommended structure

```text
Flex vertical, gap=8
├── Typography.Text (strong): "Student Response"
└── Artifact renderer
    ├── ImageRenderer — <img> with maxWidth=100%, maxHeight=400px, alt="Student response image"
    └── MarkdownRenderer — react-markdown + remark-gfm output
```

### States

1. **IMAGE artifact** — `<img>` element with the base64 data URL as `src`
2. **TABLE artifact** — markdown table rendered by `react-markdown` + `remark-gfm`
3. **TEXT artifact** — markdown text rendered by `react-markdown`
4. **No content** — "No submission available" or "Error loading response" placeholder

### Notes

- The `ImageRenderer` constrains the image to `maxWidth: '100%'` and `maxHeight: 400` to prevent the popover from growing too tall.
- The `MarkdownRenderer` applies basic table styling (borders, padding) via a CSS class so markdown tables are readable.
- `react-markdown` escapes raw HTML by default — no `rehype-raw` is used.

## Data-heavy regions

The popover is not a data-heavy region — it displays a single cell's data. However, the markdown table renderer may produce a table that exceeds the card body width.

### Recommended components

- `react-markdown` + `remark-gfm` for table rendering
- CSS class for table styling: `border-collapse: collapse`, cell borders, padding

### Core features to use

- `remark-gfm` plugin for GFM table syntax support
- Default `react-markdown` behaviour for all other markdown (paragraphs, lists, bold, italic, code)

### States

1. **Short content** — fits within the card body, no scrolling needed
2. **Long content** — card body scrolls vertically (`overflow: 'auto'`)
3. **Wide table** — table may exceed card width; the card body scrolls horizontally if needed (implementation decision: prefer horizontal scroll over wrapping, since markdown tables lose readability when cells wrap)

## Workflow surfaces

## Hover preview

### Surface type

- Ant Design `Popover`

### Trigger

- Hover over a metric sub-cell in the `TaskHeatmapTable`
- `mouseEnterDelay`: 0.1s (Ant Design default)
- `mouseLeaveDelay`: 0.1s (Ant Design default)

### Components

- `Popover` with `trigger="hover"` (combined with `click` via array)
- `placement="right"` (auto-flips to `left` when needed)

### States

1. **Closed** — no popover visible
2. **Open (hover)** — popover appears after 0.1s delay
3. **Closed (mouse leave)** — popover disappears after 0.1s delay (unless pinned)

## Click-to-pin

### Surface type

- Ant Design `Popover` (same component, `trigger` includes `'click'`)

### Trigger

- Click on a metric sub-cell

### Components

- `Popover` with `trigger={['hover', 'click']}`

### States

1. **Closed** — no popover visible
2. **Open (click)** — popover appears and remains visible after mouse leave
3. **Closed (second click or outside click)** — popover disappears

### Notes

- The Popover's built-in click-to-toggle behaviour handles pin/unpin without custom state management.
- Clicking outside the popover also closes it (Ant Design default).

## Global state rules

### Blocking error state

- If `getTaskPreviewData` returns `null`, the popover shows: "Task data not available"
- This replaces the entire card content (header + reasoning + response)

### Partial-load state

- Not applicable in v1 — the popover content is synchronously derived from fixture data

### Empty state

- **No reasoning**: "No reasoning available" placeholder in the reasoning section
- **No artifact content**: "No submission available" (notAttempted) or "Error loading response" (error) in the student response section

### Success and mutation feedback

- Not applicable — the popover is read-only, no mutations occur

## Responsive behaviour

- The popover width is content-driven, capped at 400px by the card's `maxWidth`. On narrow screens, Ant Design auto-flips placement from `right` to `left`.
- The card body `maxHeight` prevents the popover from exceeding the viewport height.
- Long markdown tables may require horizontal scrolling within the card body.
- The image renderer's `maxWidth: '100%'` ensures images scale down on narrow popovers.

## Accessibility and motion

- The trigger element is a plain `<span>` (not focusable) in v1. Keyboard users cannot trigger the popover via focus. This is a **signed-off v1 accessibility gap** — focus trigger is deferred.
- The card header's wrapping `Flex` container has a composite `aria-label` describing the metric and score (e.g. "Completeness score: 5").
- The student response image has `alt="Student response image"`.
- No motion/animation beyond Ant Design's default Popover entrance animation. Reduced-motion users see the standard Ant Design behaviour (no custom motion overrides).
- `react-markdown` produces semantic HTML (`<table>`, `<tr>`, `<td>`, `<p>`, `<ul>`, etc.) — screen readers can navigate the rendered content.

## Implementation guardrails

- Do not introduce a custom popover component — use Ant Design `Popover` directly.
- Do not add action buttons, links, or edit capabilities to the popover.
- Do not make the trigger element focusable in v1 (deferred).
- Do not add `rehype-raw` to the markdown renderer (XSS guard).
  - Keep the `MarkdownRenderer` and `ImageRenderer` in their own subdirectories under `src/frontend/src/components/MarkdownRenderer/` and `src/frontend/src/components/ImageRenderer/` respectively (each in its own subdirectory per the shared-component convention used by `MetricIconLabel/`, `PageHeader/`, and `SelectWithAddNew/`), as shared components expected to be reused across the project.
- Spacing values must be multiples of 8 (or documented 4px exceptions).
- The `@see TASK_HEATMAP_LAYOUT.md` references in `TaskHeatmapTable.tsx`, `TaskHeatmapPage.tsx`, `ClassPageHeatmapView.spec.tsx`, and `TaskHeatmapTable.spec.tsx` must be updated to point to this document during implementation. (The fifth reference in `frontend-shared-helpers-and-abstraction-standards.md:741` was already corrected.)

## Open questions

None.
