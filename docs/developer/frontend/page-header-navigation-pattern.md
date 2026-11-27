# Page header and navigation pattern

This document defines the page-level title and navigation cards used by the Class page and the
task heatmap. Use it when adding a page header or page-level actions.

## Two-card design

Each page level renders two separate cards:

1. **`PageTitleCard`** — a `Card` (`size="small"`) containing only a `Typography.Title`.
2. **`PageNavCard`** — a `Card` (`size="small"`) with a back button on the left and action buttons
   right-aligned.

Keeping title and navigation independent lets a child page stack the parent's title card above its
own title and nav cards without inheriting the parent's actions.

Both components live in `src/frontend/src/components/PageHeader/PageHeader.tsx`; their props and
JSDoc are the component contract.

## Layout per page level

Class page (ready):

```text
[PageTitleCard — class name, level 2]
[PageNavCard — "Back to Classes" | Edit Student Details + Start New Assessment]
[Assignments table]
[Student Averages table — "Averages basis" Segmented in card top-right extra]
```

Task heatmap (child of the Class page, ready):

```text
[PageTitleCard — parent class name, level 2]
[PageTitleCard — assignment name, level 4]
[PageNavCard — "Back to Class overview" | Re-run Assessment + Refresh]
[Task Heatmap table — "Averages basis" Segmented in card top-right extra]
```

Parent-level actions (Edit Student Details, Start New Assessment) must not appear on the child page.

## Component rules

- `PageTitleCard` carries no buttons, links or other actions. Put page actions in `PageNavCard`.
- `PageTitleCard` defaults to heading level 4; the Class page passes `titleLevel={2}`.
- The back button uses `type="default"` (not `type="text"`) so it keeps the standard padding and
  border shared with the action buttons.
- Actions keep their declared order. `Re-run Assessment` sits immediately left of `Refresh` and
  renders only when the Class page supplies an `onReRunAssessment` callback.
- `wrapActions` is opt-in. Enable it only where buttons must wrap to separate left-aligned rows at
  narrow widths; the heatmap nav card enables it, the Class page overview card does not.
- The heatmap nav card shows a static `Reassessment required` tag when the selected assignment
  reads as `assessmentContractVersion === 'legacy'`. The tag is text only: no close control,
  tooltip or live region. A successful re-run plus the class refresh removes it; there is no
  optimistic removal.
- The title-error branch of the heatmap renders a Back-only nav card, without the tag or
  wrapping.

## Mode-control slot

`AveragesBasisControl` (`src/frontend/src/components/AveragesBasisControl/AveragesBasisControl.tsx`)
hosts the "Averages basis" `Segmented` control (`All tasks` | `Baseline tasks`). It is card chrome,
not part of `PageTitleCard` or `PageNavCard`.

- In ready states it sits in the top-right `extra` of the Student Averages card (overview) and of
  the card wrapping `TaskHeatmapTable` (embedded heatmap view).
  `renderAveragesBasisControlExtra.tsx` guards the `extra`, so direct renders keep their original
  card head.
- While `blocking`, a fallback card between the title and nav cards hosts the control so the escape
  back to `All tasks` stays reachable. Mount exactly one control: the fallback replaces the in-card
  one.
- Standalone Heatmaps renders no control; the embedded heatmap hosts it only when the Class page
  supplies all three mode props.
- The visible label is `sr-only` but stays the `aria-labelledby` target, preserving the accessible
  name "Averages basis". Disabled-state accessibility is documented in the component JSDoc.

## Related standards

- Spacing and card sizing: [frontend-spacing-and-padding-standards.md](frontend-spacing-and-padding-standards.md)
- Shell navigation and breadcrumbs: [frontend-shell-navigation-and-motion.md](frontend-shell-navigation-and-motion.md)
- Loading and width behaviour: [frontend-loading-and-width-standards.md](frontend-loading-and-width-standards.md)
- Assessment modal and re-run contract: [Assess Task modal re-run entry](frontend-modal-patterns.md#36-assess-task-modal-re-run-entry)
