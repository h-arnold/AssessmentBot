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
[PageNavCard — "Back to Class overview" | Re-run Assessment + Refresh]
[Task Heatmap table]
```

`Re-run Assessment` sits immediately left of `Refresh` and renders only when the owning Class page supplies an `onReRunAssessment` callback (see Completed Work §9).

Parent-level action buttons (Edit Student Details, Start New Assessment) do NOT appear on the child page.

## Completed Work

### 1. Shared Components (`src/frontend/src/components/PageHeader/PageHeader.tsx`)

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

### 2. Unit Tests (`src/frontend/src/components/PageHeader/PageHeader.spec.tsx`)

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

- Replaced the single combined header Card with a title + nav stack:
  1. `PageTitleCard` — assignment name (rendered by `TaskHeatmapPage`)
  2. `PageNavCard` — back button + Refresh action
- The parent class-name `PageTitleCard` (level 2) is rendered by `ClassPage`'s header, not by `TaskHeatmapPage`; the child page supplies only its own assignment-title card so the two stack visually.
- `TaskTitlesUnavailableError` path also renders the title + nav cards alongside the `Alert`.
- The `Re-run Assessment` action was added to the nav card by issue #298 (see Completed Work §9).

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

**Status: Implemented — 3 tests, all passing; snapshots committed and current**

Three tests, verified via `npm run test:frontend:e2e -- navigation-screenshots.spec.ts`:

1. `Class Page overview with PageHeader` — navigates to class detail, captures screenshot
2. `Task Heatmap with PageHeader` — navigates to heatmap, captures screenshot
3. `Heatmaps builder with PageHeader` — opens the standalone Heatmaps nav entry, captures screenshot

Snapshots committed at:

- `e2e-tests/navigation-screenshots.spec.ts-snapshots/class-page-overview-chromium-linux.png`
- `e2e-tests/navigation-screenshots.spec.ts-snapshots/task-heatmap-chromium-linux.png`
- `e2e-tests/navigation-screenshots.spec.ts-snapshots/heatmaps-builder-chromium-linux.png`

The committed snapshots were captured with the title + nav card design, so no re-capture is outstanding.

### 8. Heatmaps standalone top-level entry (`src/frontend/src/pages/HeatmapsPage.tsx`)

**Status: Implemented**

Adds a new top-level navigation key `heatmaps` to the shared navigation contract, giving direct access to a standalone Heatmaps page built from the same two-card navigation pattern.

Changes:

- `AppNavigationKey` union gains `'heatmaps'`; `navigationDefinitions` places it between `assignments` and `settings` (menu order: dashboard, classes, assignments, heatmaps, settings).
- Menu label sourced from `pageContent.heatmaps.heading`; icon is the Lucide `Flame` wrapped by `renderNavigationIcon` (decorative, `aria-hidden`), consistent with the other Lucide navigation icons.
- `renderNavigationPage('heatmaps')` returns `<HeatmapsPage />`, so the entry is directly navigable and does not route through Class Page `selectedView` state (no second page-selection source of truth).
- `pages/HeatmapsPage.tsx` (21 LOC) is a thin composition root that renders ONLY `features/taskHeatmap/HeatmapBuilderSurface` — no hooks, services, or state machines — matching the thinness of `ClassesPage.tsx`.
- The builder surface composes the documented two-card stack (`PageTitleCard` level 2 + `PageNavCard` actions-only with Refresh), keeping the new entry consistent with the navigation pattern recorded here.
- Existing navigation specs extended (not weakened) for the new key; `navigation-screenshots.spec.ts` gained a committed Heatmaps baseline.

### 9. Re-run Assessment action in the child heatmap nav (issue #298)

**Status: Implemented**

Adds a `Re-run Assessment` action immediately left of `Refresh` in the child heatmap `PageNavCard`, wired to the existing `AssessTaskModal` through an explicit re-run context.

Changes:

- `TaskHeatmapPage` accepts an optional `onReRunAssessment(context)` callback and renders the `Re-run Assessment` button (Lucide `RotateCcw`) only when the callback is supplied, immediately left of `Refresh`; `Back to Class overview` stays on the left. `TaskHeatmapPage.reRunAssessment.spec.tsx` pins the placement, the `{ assignmentId, definitionKey }` payload, and the omission when no callback is supplied.
- `ClassPageContent` forwards `onReRunAssessment` to `TaskHeatmapPage`; `ClassPage` owns the `reRunContext` state and opens the modal with it. `handleStartNewAssessment` clears any re-run context so the manual entry never carries one, and `handleCloseModal` clears it on close.
- `AssessTaskModal` renders the re-run body/footer (`AssessTaskReRunSurface`) and auto-starts one run (`useAssessTaskReRunFlow`) instead of the assignment selector. The full entry, matching, success, failure, and recovery contract is recorded in `frontend-modal-patterns.md` §3.6 and `frontend-shared-helpers-and-abstraction-standards.md` §9.25.
- The entry uses the class's persisted `assignmentDefinitionKey` and never re-matches by title, topic, or year group; a missing assignment, null key, or unreadable registry fails closed with an in-modal `Alert` instead of starting against a different definition.
- A success response means the run has been queued in the background, not that results are ready; the heatmap `Refresh` action reloads results after processing.

The full frontend suite, frontend lint check, and Playwright navigation screenshots passed during the issue #298 regression comparison.

## Outstanding Work

### 1. ClassPage Loading Skeleton

**Priority: Medium**

The `ClassPageLoading` skeleton in `ClassPageContent.tsx` still uses a single `Skeleton.Input` for the heading. With the title + nav card layout, the skeleton should reflect:

- A larger skeleton for the title card (level 2 heading)
- A skeleton for the nav card (back button + action buttons)

Currently the skeleton only shows a heading placeholder. The nav card skeleton is missing.

### 2. Documentation

**Priority: Low**

The navigation consistency pattern should be documented for future pages. Consider adding to:

- `docs/developer/frontend/frontend-shell-navigation-and-motion.md` — or a new dedicated doc
- The `PageHeader/PageHeader.tsx` module JSDoc already documents the pattern well

### 3. ClassPage `titleLevel` Prop on `PageTitleCard`

**Priority: Low (informational)**

The `PageTitleCard` on ClassPage uses `titleLevel={2}` for the class-level heading, including when the Task Heatmap is open. `TaskHeatmapPage` renders the assignment heading separately. No action needed, but worth noting for consistency.

## File Inventory

### New Files

| File                                                                           | Lines | Purpose                                                |
| ------------------------------------------------------------------------------ | ----- | ------------------------------------------------------ |
| `src/frontend/src/components/PageHeader/PageHeader.tsx`                        | 116   | Shared `PageTitleCard` + `PageNavCard` components      |
| `src/frontend/src/components/PageHeader/PageHeader.spec.tsx`                   | 86    | Unit tests (10 tests)                                  |
| `src/frontend/e2e-tests/navigation-screenshots.spec.ts`                        | 86    | Playwright screenshot tests (3 tests)                  |
| `src/frontend/src/pages/HeatmapsPage.tsx`                                      | 21    | Thin composition root for the standalone Heatmaps page |
| `src/frontend/src/features/shared/reRunAssessmentContext.ts`                   | 24    | Cross-feature re-run entry contract (`ReRunContext`)   |
| `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskReRunFlow.ts`  | 192   | Automatic single-run re-run orchestration              |
| `src/frontend/src/features/classes/AssessTaskModal/AssessTaskReRunSurface.tsx` | 129   | Re-run modal body and footer                           |

### Modified Files

| File                                                                      | Key Changes                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/features/classPage/ClassPage.tsx`                       | Replaced `Typography.Title` with `PageTitleCard` + `PageNavCard`; moved `ClassPageHeaderActions` into nav card; added `reRunContext` state and `handleReRunAssessment` (issue #298) |
| `src/frontend/src/features/taskHeatmap/TaskHeatmapPage.tsx`               | Replaced single header Card with title + nav card stack; added `Re-run Assessment` action left of `Refresh` (issue #298)                                                            |
| `src/frontend/src/features/classPage/ClassPageContent.tsx`                | Removed `ClassPageHeaderActions` from `ClassPageReady`; retained `onStartNewAssessment`; forwards `onReRunAssessment` to the heatmap                                                |
| `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`   | Renders the re-run body/footer and auto-start path when `reRunContext` is supplied (issue #298)                                                                                     |
| `src/frontend/src/features/classes/AssessTaskModal/assessTaskFlowData.ts` | Added `resolveReRunTarget` + `getValidatedDefinitionPartials` (issue #298)                                                                                                          |
| `src/frontend/src/features/classPage/ClassPageContent.spec.tsx`           | Removed `ClassPageHeaderActions` mock and assertions                                                                                                                                |
| `src/frontend/src/features/classPage/ClassPage.spec.tsx`                  | Updated modal tests to click button directly                                                                                                                                        |
| `src/frontend/src/features/taskHeatmap/TaskHeatmapPage.spec.tsx`          | Updated assertions for parent + child title cards                                                                                                                                   |
| `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx`       | Removed `ClassPageHeaderActions` mock                                                                                                                                               |
| `src/frontend/src/navigation/appNavigation.tsx`                           | Added `heatmaps` navigation key (Flame icon, between assignments and settings) and `renderNavigationPage` case                                                                      |

## Lint Status

All changed files pass `npm run lint:frontend:check` with zero errors or warnings in the modified files.

## Test Status

| Suite                                  | Tests  | Status          |
| -------------------------------------- | ------ | --------------- |
| `PageHeader.spec.tsx`                  | 10     | All passing     |
| `ClassPage.spec.tsx`                   | 6      | All passing     |
| `ClassPageContent.spec.tsx`            | 10     | All passing     |
| `TaskHeatmapPage.spec.tsx`             | 2      | All passing     |
| `ClassPageHeatmapView.spec.tsx`        | 3      | All passing     |
| **Vitest total**                       | **31** | **All passing** |
| `navigation-screenshots.spec.ts` (E2E) | 3      | All passing     |
