# Code Review — FRONTEND classPage TASK HEATMAP sub-feature

**Scope:** `feat/ReactFrontend...HEAD` diff for 6 files:

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `src/frontend/src/features/classPage/MetricIconLabel.tsx`
- `src/frontend/src/features/classPage/MetricIconLabel.spec.tsx`

## Summary

**Verdict: PASS (with minor Improvement / Nitpick items, none blocking).**

The changes implement a Task Heatmap page, a heatmap `Table`, and a shared `MetricIconLabel`
presentational component, with co-located Vitest specs. All mandatory automated gates passed:

- `tsc -b src/frontend/tsconfig.json` → exit 0 (no type errors).
- ESLint on the 6 in-scope files (run from `src/frontend`) → 0 errors, 1 warning
  (`@typescript-eslint/no-magic-numbers` on `TaskHeatmapTable.spec.tsx:345`). The pre-commit
  hook runs `eslint --fix` **without** `--max-warnings 0` for frontend, so this warning does not
  block the hook.
- Frontend tests for the 3 component specs → 14 passed / 14 (MetricIconLabel 6, TaskHeatmapTable
  6, TaskHeatmapPage 2).

Behaviour is consistent with the canonical docs (`metric-icon-display.md`, `frontend-spacing-and-padding-standards.md`,
`frontend-logging-and-error-handling.md`, `frontend-testing.md`) and with the existing extracted helpers
(`compareHeatmapStudentName`, `METRIC_STATE_RANK_ASC`, `METRIC_DISPLAY_META`, `HEATMAP_METRIC_KEYS`).
The shared `buildMetricRangeFilter` helper (from `metricDisplay/metricRangeFilter.tsx`) is correctly
consumed. User-visible interaction is also covered by Playwright E2E (`e2e-tests/task-heatmap.spec.ts`,
added in the same range), satisfying the mandatory E2E coverage rule.

---

## Critical

None.

---

## Improvement

**1. Stale "RED-phase / expected to FAIL" comments in committed specs**

- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx` (lines 1–11) — the file header and
  `@remarks` state these tests are "expected to FAIL because TaskHeatmapPage does not yet: accept
  `assignmentDefinitionPartials` as a prop / import or handle `TaskTitlesUnavailableError` / render an
  in-view Alert / log via `logFrontendError`". The implementation now does all of those and the tests
  pass (verified: 2/2 pass).
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (lines 1–13) — similarly labelled
  "RED-phase tests" though the component is implemented and the tests pass (6/6).
- These comments are now misleading: a future maintainer could conclude the feature is incomplete or
  that a failing test is expected. Recommend removing the RED-phase framing and rewording the headers
  to describe what is actually verified.

**2. StrictMode double-invocation of the generic-error effect**

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:140-145` — the `useEffect` that calls
  `logFrontendError('TaskHeatmapPage', state.error)` and `backCallback()` runs on every render where
  `isGenericError` is true, with no guard. Under React 19 `React.StrictMode` (used in development),
  effects run twice on mount, so the error would be logged twice and `onBack` invoked twice in dev.
  The test asserts exactly one call because Testing-Library renders without StrictMode. The visible
  behaviour is acceptable (idempotent navigation), but double-logging is noisy. Consider a `useRef`
  guard so the log/navigation fires once even under StrictMode double-invocation.

---

## Nitpick

**1. Magic-number lint warning in spec**

- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx:345` —
  `expect(sliders.length).toBe(2)` triggers `@typescript-eslint/no-magic-numbers`. The rest of the
  file uses named constants (`TASK_GROUP_COUNT`, `METRIC_COLUMNS_PER_TASK`, `STUDENT_ROW_COUNT`); for
  consistency, introduce e.g. `SLIDER_HANDLE_COUNT = 2` (two-thumb Slider) and use it here. Non-blocking
  (pre-commit hook does not enforce `--max-warnings 0` for frontend).

**2. Redundant defensive `?? ''` defaults in header derivation**

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:62-68` (`getHeaderLabels`) — `classFull.className ?? ''`
  and `assignment?.assignmentDefinition.primaryTitle ?? ''`. `className` is typed `string` (not nullable),
  and the component is only mounted after the ready-gate narrows non-null `analyserResult`/`classFull`, so a
  matching assignment is guaranteed to exist (an unknown `assignmentId` is already rejected as a generic
  error upstream in `adaptMetricsToHeatmap`). These defaults are therefore dead/redundant. Core principle #7
  ("never set defaults unless explicitly instructed") favours removing them and letting the adapter guarantee
  hold; if a fallback is genuinely desired, document the rationale. Low risk.

**3. Minor: `role="alert"` on the Ant Design `Alert` is redundant**

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:163` — Ant Design `Alert` already applies
  `role="alert"` by default; the explicit `role="alert"` prop is harmless but redundant. The test
  additionally asserts `toHaveClass('ant-alert-error')` and the icon, which is correct.

---

## Checklist coverage (frontend)

- [x] TypeScript: no implicit `any`; explicit types — verified (tsc clean).
- [x] `App.tsx` thin composition root; side effects/async in hooks — N/A (these are feature components; no `App.tsx` changes).
- [x] No imports from `src/backend/` — verified (imports limited to `antd`, `lucide-react`, `react`, `theme/spacing`, `logging/frontendLogger`, `services/...`, `components/...`, `./classPageModel`, `./MetricIconLabel`).
- [x] Functions exported as functions, not arrow-constant exports — verified (`export function TaskHeatmapPage/TaskHeatmapTable/MetricIconLabel` and all helpers).
- [x] No `console.*`, no empty `catch`, British English — verified (the only `catch` in `computeHeatmapState` captures the error into state, matching the documented fail-closed design; no `console.*`; copy is British English).
- [x] No default values without instruction — see Nitpick #2 (redundant `?? ''`).
- [x] Spacing follows 8px grid — `APP_GAP_MD` (16px) used for `Flex` gap; `Card size="small"`; no inline magic padding/margin. `MetricIconLabel` span uses `width/display/align-items` only (layout, not spacing tokens).
- [x] Files ≤ 500 lines — TaskHeatmapPage 189, TaskHeatmapTable 273, MetricIconLabel 56, specs 79/211/496. All within limit.
- [x] Tests assert behavioural outcomes; hermetic — specs assert rendered headers, filter UI, sort order, per-cell `aria-label`, Alert content, `onBack`/log calls; mock `logFrontendError` only, no `google.script.run`/network.
- [x] KISS / SOLID / DRY — reuses existing extracted helpers (`compareHeatmapStudentName`, `METRIC_STATE_RANK_ASC`, `METRIC_DISPLAY_META`, `HEATMAP_METRIC_KEYS`) rather than duplicating rank maps; consumes shared `buildMetricRangeFilter`/`MetricPill` tone resolver; no cross-module DRY.
- [x] E2E coverage for user-visible interaction — `e2e-tests/task-heatmap.spec.ts` + helpers added in same range.

---

## Files read (mandatory + in-scope)

Mandatory docs:

- `AGENTS.md` (repo root)
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/metric-icon-display.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`

In-scope source/spec files:

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `src/frontend/src/features/classPage/MetricIconLabel.tsx`
- `src/frontend/src/features/classPage/MetricIconLabel.spec.tsx`

Supporting files verified for export/contract compatibility:

- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` (types/exports)
- `src/frontend/src/features/classPage/classPageModel.ts` (`compareHeatmapStudentName`, `METRIC_STATE_RANK_ASC`, `METRIC_DISPLAY_META`, `HEATMAP_METRIC_KEYS`, `HeatmapMetricKey`)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx` (`buildMetricRangeFilter` signature/return shape)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts` (`resolveMetricTone`, `MetricToneRange`)
- `src/frontend/src/theme/spacing.ts` (`APP_GAP_MD`, `APP_COL_WIDTH_STUDENT_NAME`, `APP_COL_WIDTH_METRIC`)
- `src/frontend/src/components/PageHeader.tsx` (`PageTitleCard`, `PageNavCard`)
- `src/frontend/src/components/icons/LucideIcon.tsx` (`LucideIconComponent`)

Note: Ant Design v6 LLM docs (`https://ant.design/llms.txt`) were not fetched over the network; the
review relied on the project's canonical `metric-icon-display.md` plus standard antd v6 `Table`
(grouped columns, `onCell`, `filterDropdown`), `Alert`, `Tooltip`, `Card`, `Flex`, `Button`
conventions, all of which are validated by the passing tsc build and the 14 passing component tests.

---

## Reminder to the calling agent

Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the
review comes back clean.
