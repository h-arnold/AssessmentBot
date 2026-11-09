# Legacy Assignment Status Layout

## Purpose and scope

Use with root `SPEC.md` and `ACTION_PLAN.md`. Add one assignment status tag to the existing class task heatmap. No page, modal, alert panel or new action is added. Recent-assignment cards and the standalone heatmap builder are unchanged, as requested by the user.

## Ant Design references consulted

Official documentation consulted during planning:

- [Tag](https://ant.design/components/tag): `color="warning"`, visible text, no close button.
- [Flex](https://ant.design/components/flex): wrapped rows with token spacing.
- [Space](https://ant.design/components/space): wrapping related inline controls.

## Surface hierarchy

```text
TaskHeatmapPage
├── PageTitleCard — existing assignment title
├── PageNavCard
│   ├── Back to Class overview
│   └── actions: [Reassessment required] [Re-run Assessment] [Refresh]
├── existing summary
└── existing heatmap and previews
```

## Navigation card

- Derive legacy status from the selected assignment in the loaded `classFull.assignments`, not from preview errors or the separately fetched full result. No new request is needed.
- For `'legacy'`, render an Ant Design `Tag`, `color="warning"`, with exact text **Reassessment required**, immediately before Re-run Assessment. The tag has no close, click or keyboard action and is not a button.
- Use the existing in-feature `style={{ margin: 0 }}` tag treatment so Space's 8px gap is the only horizontal spacing; do not leave Tag's extra trailing margin.
- For `1`, omit the tag. Keep Re-run Assessment immediately before Refresh; preserve callback arguments and existing button behaviour.
- Without a rerun callback, keep the tag immediately before Refresh.
- In the existing task-title error state, keep the navigation unchanged: Back only, no tag and no rerun/refresh actions. Keep the existing error message.
- No tag on the class overview, recent-assignment cards, student-average table or individual task cells.

## Scores, previews and states

- Numeric/N results, explicit E results, summaries and averages retain normal rendering. A legacy marker does not grey out, blank or disable them.
- A corrupt task displays the existing E treatment. A healthy neighbouring task keeps its score and preview. The tag is assignment-level and does not replace either treatment.
- While a full preview is loading or fails, the tag still follows the loaded class response. Preserve the existing preview loading/error behaviour.
- A successful rerun and settled class refresh removes the tag when that assignment now carries `1`. An unsuccessful rerun leaves the tag and saved results intact. No optimistic removal.
- Existing empty/no-submission states remain unchanged. Legacy status is still visible when the task heatmap itself renders.
- Invalid assignment/class roots retain existing blocking errors; do not invent student-ID recovery UI.

## Responsive behaviour

- Desktop order: Back on the left; tag, Re-run Assessment and Refresh on the right.
- At narrow widths, Back and the actions group may occupy separate rows. Each wrapped single-item row renders at the row start under the existing `space-between` justification. The tag and buttons wrap in the same order; no clipping, overlap or new page-level horizontal overflow.
- Reuse `PageNavCard` with an opt-in `wrapActions?: boolean` prop. When true, enable wrapping in its outer Flex and action Space. The outer Flex gains `gap={APP_GAP_SM}` (8px) for both row/column gaps, and action Space retains `APP_SPACE_SIZE_TIGHT` (8px). Omitted/false preserves every other caller's layout. Do not change `PageTitleCard` or create a parallel navigation component.
- Enable wrapping for the normal navigation card in `TaskHeatmapPage` only. The title-error branch remains unchanged. Keep card padding and the heatmap's existing width/scroll policy.

## Accessibility and motion

- Visible text conveys the status without relying on colour or a tooltip. Do not add a focus stop or live-region announcement to this static tag.
- Keep existing button names, focus order and keyboard activation. Tab order stays Back → Re-run Assessment → Refresh when those actions are present.
- Use Ant Design's theme colours in light/dark modes. No animation or new motion is needed.

## Acceptance checks

- Browser checks at 1440×900 and 390×844: readable tag, action order, no overlap or clipping, current assignment has no tag, recent cards have no tag.
- Browser journey: legacy numeric cell and source preview remain visible; corrupt sibling is E; rerun success removes tag after refresh, failure leaves it.
- Component checks: marker and selected-assignment switching; no rerun callback; full-preview loading/failure; title-error navigation remains Back-only without the tag; wrapActions omitted/false/true contract for shared PageNavCard.
- Scope tag assertions to the navigation card. Stored explicit `REASSESSMENT_REQUIRED` errors may use the same reasoning text inside previews; that text remains supported and is not the assignment status tag.

No open layout questions or authorised deferrals.

## Documentation follow-through

Update `docs/developer/frontend/navigation-consistency-status.md` in the same change: add `wrapActions` to the PageNavCard prop table and record the task-heatmap tag/action order and wrapping. Keep its title-error inventory Back-only. Reconcile the planned shared-helper entry with the delivered prop.
