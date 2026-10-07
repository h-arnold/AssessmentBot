# Task Preview Source Link Layout — Issue #19

## Purpose and scope

Use alongside `SPEC.md` and `ACTION_PLAN.md`. Define only the source action within the existing preview card/popover. No new route, page, modal, drawer or navigation layer; source resolution is owned by the specification.

## Official Ant Design references consulted

- https://ant.design/components/card — `extra` is the top-right action slot; `styles`/`classNames` expose header/title/extra regions. Retain small Card and its built-in padding.
- https://ant.design/components/button — `icon`, `href`, `target`, `type`, `size`; href renders a link, so native navigation semantics need no click orchestration.
- https://ant.design/components/tooltip — simple explanatory text and explicit `trigger={['hover', 'focus']}` for keyboard users. Use the Ant Button directly as the trigger rather than a custom event/ref wrapper.

## Surface hierarchy

```text
Class assignment heatmap OR standalone/merged Heatmaps
└── Existing metric-cell Popover
    └── Existing deferred loading/error/ready content
        └── TaskPreviewCard (ready)
            ├── Header
            │   ├── Centred metric label + MetricPill (existing live status)
            │   └── Top-right source link + hover/focus Tooltip (sibling, not in live status)
            └── Existing scrollable reasoning and student response body
```

## Header regions and component choices

### Metric region

Preserve label, colon, compact score pill, `role="status"`, `aria-live="polite"` and score accessible label. Centre this group on the card's horizontal centre, whether or not the source action exists. The source action must not shift it left or overlap it.

Use Card's `extra` action slot. Reserve matching non-interactive space on the left of the title region to balance the occupied right action width, using project-owned header styling and the existing spacing constants. The balancing space must not create a focus target or announced content. When no action exists, the title remains centred without an unnecessary visible placeholder.

### Source region

- Icon-only Ant Design `Button type="text" size="small"` with `href` (native anchor semantics). This is the documented icon-only text-button exception in the spacing standards.
- `LucideIcon` with Lucide `ExternalLink`; explicit starting size 16px, stroke width 1.5, inherited theme-aware action colour, decorative accessibility semantics (no icon title).
- Starting 24px square action. Keep it vertically centred in the header and at the existing right header inset. Use the existing small Card padding rather than adding arbitrary margins.
- Set `aria-label` explicitly on the Button/anchor: **Open source document (opens in a new tab)**. Tooltip supplies the same visible text on hover and focus; it is not the sole accessible-name mechanism. Action retains a visible focus indicator. `_blank` and `noopener noreferrer` as specified.
- The action stays in the header, outside the body scroll area and outside the metric live region. No visible label or duplicate body/footer link.

## Visible states

| State                         | Treatment                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Ready, source URL present     | One top-right source link; metric/body unchanged                                                   |
| Ready, document root fallback | Same action and label, href has no fragment; do not imply an exact slide/tab in the tooltip        |
| Ready, no URL / no submission | No action and no disabled placeholder; preserve current empty-content treatment                    |
| Full-data loading or failure  | Existing deferred skeleton/error treatment; no invented source link                                |
| Refresh                       | Retain existing usable card behaviour; no extra navigation request or spinner for this static link |

## Responsive and accessibility behaviour

- Keep `CARD_MAX_WIDTH = 400` and existing body height/scroll conventions. At narrow widths, constrain the card to the available viewport width; do not enlarge the page or require sideways scrolling merely to reach the action. Use a feature-local Card style if necessary, not oversized global `index.css` changes.
- Fixed invariants: icon/action wholly inside the header and viewport, no intersection with metric label/pill, metric centred on whole card, body rendering unchanged.
- Pointer movement from cell to card/action must leave the existing popover usable, without moving keyboard focus. As expressly approved by the user, Enter/Space on a cell opens its popover and focuses the rendered source link; Escape from trigger or preview closes it and restores the trigger. Loading/error/no-link content retains trigger focus, with a one-time focus transfer on ready only if that keyboard-opened preview remains open and the trigger still has focus. Do not steal focus after a user moves elsewhere. Tab and Shift+Tab remain untrapped. Returning to the original app tab preserves its view. Keep the existing body portal; use local focus refs and controlled open state, not global popup-container changes. The focus transfer is deferred by one microtask; the rationale is recorded once in §9.26 of `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- No new motion. Existing reduced-motion behaviour must remain intact; geometry checks wait for stable layout rather than measuring an entrance-animation frame.
- At ≤390px the feature-local `TaskMetricPreviewCell.module.css` hides only the popover arrow, whose box otherwise spills 4px past the right viewport edge and widens the page's horizontal scroll width. The card, action and table region are unchanged; placement, trigger behaviour and the desktop arrow are preserved. This is a local containment fix, not a relaxation of the no-new-overflow invariant.

## Authorised visual tuning and acceptance evidence

The user authorised the Playwright agent to adjust final icon/action dimensions and header spacing if the initial 16px/24px proposal looked wrong or inconsistent with the app; placement, semantics, centring and source behaviour are not tunable. One representative visual inspection replaces the exhaustive viewport/zoom capture matrix and the separate 200% browser-zoom walkthrough; the geometry measurements and tolerances below are unchanged. The accepted values are the 16px icon, 24px action and 1.5 stroke, with the narrow-viewport arrow absence accepted.

Use the Card header/extra semantic styles with `alignItems: 'center'` and an inline-flex action/icon wrapper to obtain vertical alignment; compliant alignment styles are within the authorised spacing/alignment tuning. Do not change Card padding arbitrarily or alter shared icon behaviour for this local action.

Review desktop 1440×900 and narrow 390×844 viewports in light and dark themes as one representative visual check. The exhaustive viewport/zoom matrix and the separate 200% browser-zoom walkthrough are not completion requirements; the accessibility, source-correctness and no-overlap/clipping invariants still apply. Both entry points require a browser journey, and the sample set covers the canonical ready card plus text, table and image card bodies. The desktop coordinates use the pointer journey; the narrow coordinates use the keyboard journey, because the heatmap's sticky name columns cover the metric cells at 390px. Preserve existing rendering.

For stable ready cards, measure:

1. Actual SVG width and height equal the final reviewed icon size within 1 CSS pixel.
2. Action width/height equal the final reviewed target size within 1 CSS pixel.
3. Metric-group horizontal centre differs from the card centre by at most 2 CSS pixels.
4. Icon/action vertical centre differs from the header centre by at most 2 CSS pixels.
5. Action lies to the right of the metric, does not overlap it and retains the Card's right header inset. Compare the action's right edge with the header content boundary, accounting for built-in padding.
6. Header content is inside the card and viewport, with no clipping or new horizontal overflow.
7. The left balancing region's rendered width matches the action's rendered width within 1 CSS pixel, so the reserved non-interactive space balances the occupied right action and the metric group stays centred on the whole card. The 1 CSS pixel allowance covers rendered measurement and subpixel rounding only; it does not relax the centring, icon/action size or non-overlap checks above.

Use project-owned region selectors plus accessible link/status names; do not infer alignment solely from DOM order or SVG attributes. Capture card-level screenshots (normal, hovered and keyboard-focused) and contextual screenshots of both entry points. The normal and keyboard-focused captures are taken at every representative coordinate, while the hovered capture is taken at the desktop pointer coordinates only; the narrow coordinates use the keyboard journey, so their hovered capture is omitted and the hover/tooltip affordance is represented by the desktop captures. Visually inspect the captured images against issue #19's illustration and neighbouring app actions for scale, stroke, centring, spacing, focus and theme contrast. Screenshots without an actual review do not satisfy this requirement.

Record final values, measurements, screenshot paths, viewport/theme, review verdict and any tuning rationale in the implementation notes of `ACTION_PLAN.md`. Update this layout document and geometry assertions to those final values before sign-off. Do not bless a screenshot baseline solely because a test passes.
