# Code Review Synthesis — `feat/ReactFrontend` … `HEAD`

**Scope:** All source/test/config changes between `feat/ReactFrontend` and `HEAD` (120 files, +9,421 / −1,803).
**Method:** The diff was split into 8 logically-grouped chunks and reviewed in parallel by independent Code Reviewer agents. This document consolidates their findings. Per-chunk detail lives in `.opencode/scratchpad/review-chunk-*.md`.

## Chunk allocation

| Chunk | Area                                                     | Reviewer verdict          |
| ----- | -------------------------------------------------------- | ------------------------- |
| A     | Backend source (`src/backend/**`)                        | Needs Improvement         |
| B     | Backend tests (`tests/**`)                               | Needs Improvement         |
| C     | Frontend `dataAnalysis` analysers + zod + fixtures       | **PASS**                  |
| D     | Frontend `dataAnalysis/metricDisplay` + `heatmapAdapter` | **FAIL** (red unit suite) |
| E     | Frontend `classPage` TaskHeatmap sub-feature             | **PASS**                  |
| F     | Frontend `classPage` main + Recent/StudentAverages       | **FAIL** (red unit suite) |
| G     | Frontend shell/nav/pages/theme/components/misc + config  | Needs Improvement         |
| H     | Frontend E2E (Playwright)                                | **FAIL** (lint + red E2E) |

## Executive summary

**Overall verdict: FAIL — do not merge until the blocking items below are cleared.** Three independent automated gates are currently red (two frontend unit suites, one E2E suite), the E2E lint gate fails, a backend `catch` can mask the original error, and two cross-chunk defects break the class-page E2E. The substantive new logic (analysers, rollup precedence, heatmap adapter, class-page components) is otherwise sound and standards-compliant.

Three cross-cutting themes appear repeatedly and should be handled as a single clean-up pass:

1. **Stale TDD "RED phase / will fail" comments** in committed specs (chunks B, C, D, E, F, H). The features are implemented and the tests pass, so the labels are actively misleading. Remove the phase framing and rename any `(RED)`/`Section N` describe blocks to behaviour-focused names.
2. **SVG `aria-label` queried via `getByLabelText`** (chunks F, E) — `getByLabelText` does not resolve an `<svg aria-label>` in the RTL/HappyDOM stack; use `getByRole('img', { name })` or `querySelector('[aria-label="…"]')`.
3. **Implementation/test/doc/JSDoc drift on the metric gradient** (chunk D) — the single most urgent functional defect.

---

## Blocking — Critical (must fix before merge)

### B1. Red frontend unit suites (two independent failures)

- **metricDisplay (9 failures):** `metricTone.spec.ts` (8) + `MetricPill.spec.tsx` (1).
  - `metricTone.ts:140-144`, `:158-164` use `hue = 120·t^1.5`, `lightness = 34 + 9·sin(πt)`, and `notAttempted → '#434343'` with a filled cell style.
  - The committed tests (and planning doc `frontend-shared-helpers-and-abstraction-standards.md` §9.17, and the inline JSDoc at `metricTone.ts:33-38`/`:177-190`) expect a **linear** `hue = 120·t`, `lightness = 38 + 10·sin(πt)`, and `notAttempted → 'default'` / empty cell style.
  - **Action:** choose the authoritative gradient design and make implementation, tests, §9.17 doc, and JSDoc agree. Do not merge with a red suite.
- **classPage main (3 failures):**
  1. `studentAveragesTableColumns.spec.tsx:110` — `getByLabelText('Completeness')` fails because `MetricIconLabel` renders the label on an `<svg aria-label>` (`MetricIconLabel.tsx:51`), which `getByLabelText` does not resolve here.
  2. `studentAveragesTableColumns.spec.tsx:220` — `buildMetricColumn` render changed to a plain `<span>` (`studentAveragesTableColumns.tsx:135-137`) but the test still asserts `.ant-tag`/`fontWeight 600` (stale).
  3. `RecentAssignmentCard.spec.tsx:97-100` — same `getByLabelText` SVG issue.
  - **Action:** switch selectors to `getByRole('img', { name })` / `querySelector('[aria-label="…"]')`; update or retire the stale emphasised-pill assertion (see I1/F).

### B2. Red Playwright E2E — duplicate class-name `<h2>`

- `e2e-tests/task-heatmap.spec.ts:40` and `:73` fail: `getByRole('heading', { name: '7C2 Digital Technology 2025-2026' })` resolves to **two** elements (strict-mode violation).
- Root cause: `ClassPage.tsx:76` **and** `TaskHeatmapPage.tsx:172` (and the `:156` error path) both render `<PageTitleCard title={className} titleLevel={2} />`. `PageTitleCard` itself is correct; this is a usage conflict in the classPage feature.
- **Action:** establish a single owner of the class-name title (the parent `ClassPage`), and have the child view render only the assignment/section title, or suppress the parent title when a child view is active.

### B3. E2E lint gate failure — JSDoc

- `e2e-tests/navigation-screenshots.spec.ts:20` — `openTaskHeatmap` JSDoc has `@param page` with no description/type → `jsdoc/require-param-description` + `jsdoc/require-param-type`. Not auto-fixable, so `lint:frontend:check` fails.
- **Action:** add `@param {Page} page - …`.

### B4. E2E filter test hangs — misspelled antd class

- `e2e-tests/shared/endToEndRuntimeMocks.ts:651` uses `.ant-dropdown` (single `d`); the real antd v6.3.1 token is `.ant-dropdown` (two `d`s). The new `task-heatmap.spec.ts` band-filter test calls `applyColumnFilterOption`, so `activeFilterPopup` is always empty and `toBeVisible()` times out.
- **Action:** correct to `.ant-dropdown:visible` (also fix the same typo in the two out-of-scope sibling specs).

### B5. Backend catch masks the original error

- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js` — `persistAssignmentRun` catch builds `logger.error(..., { courseId: assignment.courseId, assignmentId: assignment.assignmentId, err: error })`. When `assignment` is `undefined` (the exact case the leading guard rejects), the property access throws a _new_ `TypeError`, replaces the meaningful error, and **prevents `logger.error` from running**.
- **Action:** null-safe access — `assignment?.courseId` / `assignment?.assignmentId`. (`rehydrateAssignment`'s catch is safe; only `persistAssignmentRun` needs the fix.)

### B6. Lint error in `TaskHeatmapTable.spec.tsx:20`

- `jsdoc/require-param-type` on a helper's `page` param (`TaskHeatmapTable.spec.tsx` is in the PR diff but outside chunks E/F scope; flagged in chunk G). Must be fixed because pre-commit lint is mandated.

---

## Improvement (non-blocking, recommended)

- **D-I1/I3:** rename `MetricRangeFilterProps` → `MetricRangeFilterProperties` (matches the `…Properties` convention) and extract gradient magic numbers (`120`, `1.5`, `34`, `9`) to named constants.
- **D-I2:** `buildMetricRangeFilter` always emits `includeNotAttempted:false, includeError:false` in the controlled `filteredValue`, dropping the N/E toggles the dropdown can set — reconcile with the consumer (`TaskHeatmapTable`).
- **D-I4/I5:** update the stale "RED-phase" header in `heatmapAdapter.spec.ts`; confirm the `DEFAULT_CLASS_NAME_LABEL = 'Class Overview'` fallback in `heatmapAdapter.ts:77` is required (core principle #7) and document it if so.
- **F-I1:** average-column emphasis is now ambiguous — `buildMetricColumn` renders a plain `<span>` while `RecentAssignmentCard` keeps `emphasised={true}`. Decide and document one behaviour; retire the orphaned assertion/test.
- **F-I2/I3:** `MetricIconLabel` (new, consumed widely) has no dedicated unit test; consider promoting it to `src/frontend/src/components` once the pattern recurs.
- **F-I4 / G:** add a class-page main-view Playwright E2E (substantial user-visible surface, currently no E2E update).
- **A-I1:** `AssignmentDefinition.toJSON()` (`AssignmentDefinition.js:285-311`) assumes `this.tasks` is a keyed object; for a partial (array `tasks`) it emits an index-keyed object that reloads as a corrupt "full" definition. Make it array-aware or document it as full-only (latent today; `toJSON` only called on full instances).
- **A-I2:** `getAssignmentDefinitionPartials_` (assignmentDefinitionTransport.js) does not call `validatePartialRow_` at read time, so the new array-tasks contract is enforced by tests only, not in production — wire it in.
- **A-I3:** `ABClassAssignmentOps` public methods throw raw `TypeError` instead of `Validate.requireParams` (pre-existing; adopt canonical validator while touched).
- **B:** remove stale "RED / will fail" labels in `assignmentDefinitionPartials.unit.test.js:1905,1938` and `assignmentDefinition.test.js:275,305`; rename the banned `describe('AssignmentDefinition - Section 1 Model Changes', …)` to a behaviour-focused name (`backend-testing.md` Anti-Pattern #4).
- **E-I2:** `TaskHeatmapPage.tsx:140-145` `useEffect` that logs + calls `onBack` on generic error has no StrictMode guard → double log/navigate under React 19 dev StrictMode. Add a `useRef` guard.
- **G-I1:** `ClassesManagementPanel.tsx` uses deprecated `Collapse.Panel` (keep only for keyboard support) — verify it survives the pinned antd v6 and track migration.
- **G-I2:** `PageSection.tsx` `level = 2` default is effectively dead (all callers pass `titleLevel`); consider making it required.
- **G-I3:** `LinkableDefinitionList.tsx` `export const … = memo(function …)` — prefer exporting the function and `export default memo(...)`.
- **H-I2:** duplicated `openHeatmapClass` / `openTaskHeatmap` nav helpers — consolidate into the shared E2E helper.
- **H-I1:** malformed nested JSDoc on `HEATMAP_CLASS_ID` in `task-heatmap-end-to-end-helpers.ts:36-38` swallows the intended doc — remove the stray `/**`.

## Nitpick (low severity, optional)

- **D/Magic numbers:** extract `0.5` step and index `2` constants; `resolveDiscreteCellStyle` (`metricTone.ts:251-269`) can collapse to `return METRIC_TONE_CELL_STYLE[token];`.
- **C-N1:** `fixtures.ts` `createTaskPartial` adds an unnecessary `taskTitle = null` default (test-only).
- **F-N1:** 9 `no-magic-numbers` warnings in `studentAveragesTableColumns.spec.tsx` (lines 150/151/155/156/160/161) — extract boundary constants. `align: 'center'` literals are valid antd API values, **do not** anglicise.
- **G-N:** `ReferenceDataManagementModalScaffold.tsx` mixes `React.ReactElement`/`ReactElement`; `classDetailService.zod.spec.ts` is 519 lines (just over the 500 guideline); `AppShell.tsx` Sider widths are fixed pixels rather than tokens; the `unicorn/no-keyword-prefix` disable in `eslint.config.js` could be narrowed.
- **H-N:** `METRIC_SUBCOLUMN_COUNT = 3` (task-heatmap.spec.ts:16) coincidentally equals the task count — rename to `EXPECTED_TASK_GROUP_COUNT`; minor comment typo; warm-up factory entry-count asymmetry.
- **A-N:** stale JSDoc on `toPartialJSON()` (emits `{ taskId, taskWeighting, taskTitle }`, not `{ id, taskWeighting }`); `assignmentDefinitionValidation.js` 707 lines (pre-existing warning).
- **E-N:** `TaskHeatmapTable.spec.tsx:345` magic `2`; redundant `?? ''` defaults in `getHeaderLabels`; redundant `role="alert"` on antd `Alert`.

## Out-of-scope / collateral (not introduced by this change)

- Pre-existing `readonly`-assignment TS errors in `e2e-tests/shared/endToEndRuntimeMocks.ts` (lines 162–495). Playwright transpiles without a full `tsc` type-check, so they do not block the E2E run, but a future strict `tsc --noEmit` over the e2e tree would fail. Track separately.

---

## Required actions before re-submission (ordered)

1. **B1** — reconcile metricTone gradient (impl/test/doc/JSDoc) and fix the 3 classPage unit-test failures (selectors + stale assertion). Both unit suites must be green.
2. **B2** — remove the duplicate class-name `<h2>` in the classPage feature.
3. **B3 / B6** — fix the two E2E/spec JSDoc `@param` lint errors.
4. **B4** — correct `.ant-dropdown` → `.ant-dropdown` so the heatmap filter E2E resolves.
5. **B5** — null-safe the `persistAssignmentRun` catch.
6. Sweep stale "RED phase / will fail / Section N" comments across all in-scope specs.
7. Triage the remaining Improvement/Nitpick items; re-run lint + unit + E2E gates, then resubmit to the reviewer until clean.
