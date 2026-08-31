# Navigation Consistency — Status Document

## Overview

This document tracks the implementation of consistent page navigation across the ClassPage and TaskHeatmapPage, using a shared `PageTitleCard` + `PageNavCard` component pattern.

## Design Decision

The navigation pattern uses **two separate cards** per page level:

1. **`PageTitleCard`** — a Card containing only a `Typography.Title`. No buttons, no actions.
2. **`PageNavCard`** — a Card with a back button on the left and action buttons right-aligned on the right.

This separation keeps title and navigation concerns independent, so child pages can stack a parent title card above their own title + nav cards without inheriting the parent's action buttons.

### Layout per page level

**Top-level (Class Page):**

```
[PageTitleCard — class name, level 2]
[PageNavCard — "Back to Classes" | Edit Student Details + Start New Assessment]
[Recent Assignments section]
[Student Averages table]
```

**Child page (Task Heatmap):**

```
[PageTitleCard — parent class name, level 2]
[PageTitleCard — assignment name, level 4]
[PageNavCard — "Back to Class overview" | Refresh]
[Task Heatmap table]
```

Parent-level action buttons (Edit Student Details, Start New Assessment) do NOT appear on the child page.

## Completed Work

### 1. Shared Components (`src/frontend/src/components/PageHeader.tsx`)

**Status: Implemented and lint-clean**

Exports two components:

| Component       | Props                                                   | Purpose                                             |
| --------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `PageTitleCard` | `title: string`, `titleLevel?: 2 \| 3 \| 4` (default 4) | Renders a Card with a Typography.Title only         |
| `PageNavCard`   | `onBack?`, `backLabel?`, `backAriaLabel?`, `actions?`   | Renders a Card with back button left, actions right |

Key design choices:

- Back button uses `type="default"` (not `type="text"`) for proper padding/border consistency
- Actions are wrapped in `Space` with `APP_SPACE_SIZE_TIGHT` (8px gap)
- Card uses `size="small"` per the data-card convention in spacing standards

### 2. Unit Tests (`src/frontend/src/components/PageHeader.spec.tsx`)

**Status: Implemented — 10 tests, all passing**

| Describe Block  | Tests                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PageTitleCard` | 3 tests — default level, custom level, renders inside Card                                                                       |
| `PageNavCard`   | 7 tests — back button rendering, click handler, no-back case, actions rendering, multiple actions, defaults, renders inside Card |

### 3. ClassPage (`src/frontend/src/features/classPage/ClassPage.tsx`)

**Status: Implemented**

Changes:

- Removed standalone `Typography.Title` (was conditionally rendered during non-loading)
- Replaced with `PageTitleCard` (level 2) + `PageNavCard` (back + ClassPageHeaderActions)
- `ClassPageHeaderActions` moved from `ClassPageContent` → `ClassPage` (rendered inside `PageNavCard` actions slot)
- Added `onStartNewAssessment` prop to `ClassPageContent` (used by empty-state CTA in `RecentAssignmentsSection`)

### 4. TaskHeatmapPage (`src/frontend/src/features/taskHeatmap/TaskHeatmapPage.tsx`)

**Status: Implemented**

Changes:

- Replaced single combined header Card with three-card stack:
  1. `PageTitleCard` — parent class name (level 2)
  2. `PageTitleCard` — assignment name (level 4)
  3. `PageNavCard` — back button + Refresh action
- `HeaderLabels` type extended to include `className` (derived from `classFull.className`)
- `TaskTitlesUnavailableError` path also updated to render the three-card stack + Alert

### 5. ClassPageContent (`src/frontend/src/features/classPage/ClassPageContent.tsx`)

**Status: Implemented**

Changes:

- Removed `ClassPageHeaderActions` import and usage from `ClassPageReady`
- Removed `ClassPageHeaderActions` mock from spec file
- `ClassPageReady` now renders only `RecentAssignmentsSection` + `StudentAveragesTableCard`
- `onStartNewAssessment` prop retained (used by `RecentAssignmentsSection` empty-state CTA)
- Updated JSDoc to reflect header actions are now rendered by parent `ClassPage`

### 6. Updated Spec Files

| File                            | Status             | Changes                                                                                                            |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ClassPageContent.spec.tsx`     | Passing (10 tests) | Removed `ClassPageHeaderActions` mock; removed assertions about it                                                 |
| `ClassPage.spec.tsx`            | Passing (4 tests)  | Updated modal tests to click "Start New Assessment" button directly instead of extracting callback from mock props |
| `TaskHeatmapPage.spec.tsx`      | Passing (2 tests)  | Updated assertion to expect both "Class A" and "Assignment One" text (parent + child title cards)                  |
| `ClassPageHeatmapView.spec.tsx` | Passing (3 tests)  | Removed `ClassPageHeaderActions` mock (no longer imported by ClassPageContent)                                     |

### 7. Playwright Screenshot Tests (`src/frontend/e2e-tests/navigation-screenshots.spec.ts`)

**Status: Created, snapshots generated**

Two tests:

1. `Class Page overview with PageHeader` — navigates to class detail, captures screenshot
2. `Task Heatmap with PageHeader` — navigates to heatmap, captures screenshot

Snapshots saved at:

- `e2e-tests/navigation-screenshots.spec.ts-snapshots/class-page-overview-chromium-linux.png`
- `e2e-tests/navigation-screenshots.spec.ts-snapshots/task-heatmap-chromium-linux.png`

### 8. Heatmaps standalone top-level entry (`src/frontend/src/pages/HeatmapsPage.tsx`)

**Status: Implemented**

Adds a new top-level navigation key `heatmaps` to the shared navigation contract, giving direct access to a standalone Heatmaps page built from the same two-card navigation pattern.

Changes:

- `AppNavigationKey` union gains `'heatmaps'`; `navigationDefinitions` places it between `assignments` and `settings` (menu order: dashboard, classes, assignments, heatmaps, settings).
- Menu label sourced from `pageContent.heatmaps.heading`; icon is the Lucide `Flame` wrapped by `renderNavigationIcon` (decorative, `aria-hidden`), consistent with the other Lucide navigation icons.
- `renderNavigationPage('heatmaps')` returns `<HeatmapsPage />`, so the entry is directly navigable and does not route through Class Page `selectedView` state (no second page-selection source of truth).
- `pages/HeatmapsPage.tsx` (14 LOC) is a thin composition root that renders ONLY `features/taskHeatmap/HeatmapBuilderSurface` — no hooks, services, or state machines — matching the thinness of `ClassesPage.tsx`.
- The builder surface composes the documented two-card stack (`PageTitleCard` level 2 + `PageNavCard` actions-only with Refresh), keeping the new entry consistent with the navigation pattern recorded here.
- Existing navigation specs extended (not weakened) for the new key; `navigation-screenshots.spec.ts` gained a committed Heatmaps baseline.

## Outstanding Work

### 1. Full Test Suite Run

**Priority: High**

All individual spec files pass, but the full frontend test suite has not been run end-to-end. Need to verify:

- All 19 classPage tests pass together
- No regressions in other feature specs
- Full lint check passes (`npm run lint:frontend:check`)

### 2. Playwright Screenshot Tests — Re-run with Updated UI

**Priority: High**

The existing screenshots were captured with the **first design** (single combined `PageHeader` Card). They need to be re-captured with the **new two-card design** (`PageTitleCard` + `PageNavCard`):

- `class-page-overview.png` — should show two separate cards (title + nav)
- `task-heatmap.png` — should show three separate cards (parent title + child title + nav)

Command: `npm run test:e2e -- navigation-screenshots.spec.ts --update-snapshots`

### 3. ClassPage Loading Skeleton

**Priority: Medium**

The `ClassPageLoading` skeleton in `ClassPageContent.tsx` still uses a single `Skeleton.Input` for the heading. With the new two-card layout, the skeleton should reflect:

- A larger skeleton for the title card (level 2 heading)
- A skeleton for the nav card (back button + action buttons)

Currently the skeleton only shows a heading placeholder. The nav card skeleton is missing.

### 4. Documentation

**Priority: Low**

The navigation consistency pattern should be documented for future pages. Consider adding to:

- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` — or a new dedicated doc
- The `PageHeader.tsx` module JSDoc already documents the pattern well

### 5. ClassPage `titleLevel` Prop on `PageTitleCard`

**Priority: Low (informational)**

The `PageTitleCard` on ClassPage uses `titleLevel={2}`. The TaskHeatmapPage parent title also uses `titleLevel={2}`. This is intentional — both represent the class-level heading. No action needed, but worth noting for consistency.

## File Inventory

### New Files

| File                                                    | Lines | Purpose                                                |
| ------------------------------------------------------- | ----- | ------------------------------------------------------ |
| `src/frontend/src/components/PageHeader.tsx`            | 116   | Shared `PageTitleCard` + `PageNavCard` components      |
| `src/frontend/src/components/PageHeader.spec.tsx`       | 86    | Unit tests (10 tests)                                  |
| `src/frontend/e2e-tests/navigation-screenshots.spec.ts` | 74    | Playwright screenshot tests                            |
| `src/frontend/src/pages/HeatmapsPage.tsx`               | 14    | Thin composition root for the standalone Heatmaps page |

### Modified Files

| File                                                                | Key Changes                                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/features/classPage/ClassPage.tsx`                 | Replaced `Typography.Title` with `PageTitleCard` + `PageNavCard`; moved `ClassPageHeaderActions` into nav card |
| `src/frontend/src/features/taskHeatmap/TaskHeatmapPage.tsx`         | Replaced single header Card with three-card stack; added `className` to `HeaderLabels`                         |
| `src/frontend/src/features/classPage/ClassPageContent.tsx`          | Removed `ClassPageHeaderActions` from `ClassPageReady`; retained `onStartNewAssessment` for empty-state CTA    |
| `src/frontend/src/features/classPage/ClassPageContent.spec.tsx`     | Removed `ClassPageHeaderActions` mock and assertions                                                           |
| `src/frontend/src/features/classPage/ClassPage.spec.tsx`            | Updated modal tests to click button directly                                                                   |
| `src/frontend/src/features/taskHeatmap/TaskHeatmapPage.spec.tsx`    | Updated assertions for parent + child title cards                                                              |
| `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` | Removed `ClassPageHeaderActions` mock                                                                          |
| `src/frontend/src/navigation/appNavigation.tsx`                     | Added `heatmaps` navigation key (Flame icon, between assignments and settings) and `renderNavigationPage` case |

## Lint Status

All changed files pass `npm run lint:frontend:check` with zero errors or warnings in the modified files.

## Test Status

| Suite                           | Tests  | Status          |
| ------------------------------- | ------ | --------------- |
| `PageHeader.spec.tsx`           | 10     | All passing     |
| `ClassPage.spec.tsx`            | 4      | All passing     |
| `ClassPageContent.spec.tsx`     | 10     | All passing     |
| `TaskHeatmapPage.spec.tsx`      | 2      | All passing     |
| `ClassPageHeatmapView.spec.tsx` | 3      | All passing     |
| **Total**                       | **29** | **All passing** |
