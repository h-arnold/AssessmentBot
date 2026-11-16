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

Class page:

```text
[PageTitleCard — class name, level 2]
[Mode-control slot — "Averages basis" Segmented]
[PageNavCard — "Back to Classes" | Edit Student Details + Start New Assessment]
[Recent Assignments section]
[Student Averages table]
```

Task heatmap (child of the Class page):

```text
[PageTitleCard — parent class name, level 2]
[Mode-control slot — owned by the Class page header]
[PageTitleCard — assignment name, level 4]
[PageNavCard — "Back to Class overview" | Re-run Assessment + Refresh]
[Task Heatmap table]
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

The Class page header has a third element between its title and nav cards:
`ClassPageModeControl` (`src/frontend/src/features/classPage/ClassPageModeControl.tsx`). It hosts the
"Averages basis" `Segmented` control (`All tasks` | `Baseline tasks`).

- The slot is page-level and outside this title/nav pattern. It must not become part of
  `PageTitleCard` or `PageNavCard`.
- Render it with the header in every child view and blocking state, so the escape back to
  `All tasks` stays reachable during a baseline-mode failure.
- The Heatmaps surfaces gain no mode control; the embedded heatmap marks baseline data through
  data only.
- Disabled-state accessibility (tooltip plus sr-only description) is documented in the component
  JSDoc.

## Related standards

- Spacing and card sizing: [frontend-spacing-and-padding-standards.md](frontend-spacing-and-padding-standards.md)
- Shell navigation and breadcrumbs: [frontend-shell-navigation-and-motion.md](frontend-shell-navigation-and-motion.md)
- Loading and width behaviour: [frontend-loading-and-width-standards.md](frontend-loading-and-width-standards.md)
- Assessment modal and re-run contract: [frontend-modal-patterns.md §3.6](frontend-modal-patterns.md#36-assess-task-modal-re-run-entry)
