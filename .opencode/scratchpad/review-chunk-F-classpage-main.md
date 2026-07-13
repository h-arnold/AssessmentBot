# Code Review — Chunk F: `classPage` MAIN + RecentAssignments + StudentAverages

**Reviewer:** Code Reviewer agent
**Diff basis:** `git diff feat/ReactFrontend...HEAD` across 17 scoped files
**Scope:** Frontend module only (`src/frontend/src/features/classPage/*`)

---

## Summary

**FAIL** — The automated test gate is **red**: 3 Vitest tests fail across 2 in-scope spec files, all of them regressions introduced by this change set. TypeScript build (`tsc -b`) and scoped ESLint are clean (0 errors). The failing suite must be made green before merge.

---

## Method / Checks Performed

| Check                           | Command                                         | Result                      |
| ------------------------------- | ----------------------------------------------- | --------------------------- |
| TypeScript build (all frontend) | `tsc -- -b src/frontend/tsconfig.json` (forced) | **PASS** (exit 0)           |
| ESLint — 9 production files     | `eslint` on each prod file                      | **0 errors**                |
| ESLint — 7 spec files           | `eslint` on each spec file                      | **0 errors, 9 warnings**    |
| Unit/component tests (scope)    | `vitest run src/features/classPage/`            | **FAIL** — 3 tests, 2 files |

**Full `npm run lint:frontend` could not complete within the environment timeout**, but the scoped equivalent (per-file `eslint` on every touched file) passed with 0 errors, and `tsc -b` is clean from the repo root, so the lint/type gates for the scoped files are confirmed green.

Docs read: repo `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/frontend-testing.md`, `frontend-shared-helpers-and-abstraction-standards.md`, `frontend-spacing-and-padding-standards.md`, `frontend-logging-and-error-handling.md`, `frontend-shell-navigation-and-motion.md`, and `https://ant.design/llms.txt`.

---

## Critical

### C1 — Vitest suite is red: 3 failing tests, all regressions from this change set

The following in-scope tests currently fail (`npx vitest run src/features/classPage/` → `Tests 3 failed | 152 passed (155)`):

1. **`studentAveragesTableColumns.spec.tsx:110`** — `returns five columns with correct keys and headers`
   - The diff rewrote this test's metric-column assertion from a plain string/aria-label comparison to `screen.getByLabelText(expectedHeader)` (diff line 2015). `MetricIconLabel` renders the label as `aria-label` on an `<svg>` (see `MetricIconLabel.tsx:51`). `getByLabelText` does **not** resolve an `<svg aria-label>` in this RTL/HappyDOM environment, so the assertion throws "Unable to find an element with the label …".
   - **Fix:** assert the accessible label with `container.querySelector('[aria-label="Completeness"]')` (as the prior test style did) or `screen.getByRole('img', { name: 'Completeness' })`. The component is correct; the test query is wrong.

2. **`studentAveragesTableColumns.spec.tsx:220`** — `Average column uses emphasised={true} on the MetricPill`
   - The change set altered `buildMetricColumn`'s `render` (now `studentAveragesTableColumns.tsx:135-137`) from an emphasised `MetricPill` to a plain `<span>{renderClassPageScore(...)}</span>`. The test still queries `.ant-tag` and asserts `fontWeight: '600'`, which no longer exists. The test was **not updated** to match the new behaviour and is now stale.
   - **Fix:** either (a) update/remove the test to reflect the plain-span render, or (b) if average-cell emphasis was intended to be retained in the table, restore an emphasised rendering. A behavioural decision is required (see I1).

3. **`RecentAssignmentCard.spec.tsx:97-100`** — `renders metric labels for Completeness, Accuracy, SpAG, and Average`
   - New test added by this change set using `screen.getByLabelText('Completeness')` etc. against `MetricIconLabel` SVGs. Fails for the same root cause as #1 (SVG `aria-label` is not matched by `getByLabelText` here).
   - **Fix:** same as #1 — `getByRole('img', { name })` or `querySelector('[aria-label="…"]')`.

**Verdict:** All three are pre-merge blockers. The change set left the test suite red; per project policy (AGENTS.md §3.11 / code-reviewer.md §6) failing automated checks are Critical and must be resolved before merge.

---

## Improvement

### I1 — Average-column emphasis is now ambiguous in the Student Averages table

`buildMetricColumn` (`studentAveragesTableColumns.tsx:108-139`) no longer applies any emphasis to the average (or any metric) cell — it renders a plain `<span>`. Meanwhile the `emphasised` concept is correctly used in `RecentAssignmentCard.tsx` (lines 62, 122) where the Average pill is `emphasised={true}`. Decide and document whether the table's average cell should retain visual prominence; if not, retire the related test (#C1-2) and any orphaned `emphasised` metadata so the two surfaces are consistent.

### I2 — `MetricIconLabel` (new dependency) has no dedicated unit test

`MetricIconLabel.tsx` is a **new, unscoped** file introduced by this change and consumed by `studentAveragesTableColumns.tsx` and `RecentAssignmentCard.tsx`, but it has no `.spec.tsx` (and is outside the 17 scoped files). It is only exercised indirectly. Add a focused unit test for the new component (aria-label, tooltip title, dark-mode token colour) so its behaviour is locked.

### I3 — Consider promoting `MetricIconLabel` to a shared component

The icon-with-tooltip-and-aria-label pattern is generic. It is currently feature-local with a well-documented exception to the shared `LucideIcon` wrapper (`MetricIconLabel.tsx:10-18`, antd `Icon` injection conflict). If the same pattern appears elsewhere, promote it to `src/frontend/src/components` per `frontend-shared-helpers-and-abstraction-standards.md`; otherwise the documented deviation is acceptable.

### I4 — Playwright E2E coverage for the class-page main view

This is a substantial user-visible surface (average table with range filters, recent-assignment cards, heatmap launch). No E2E update is present in the scoped set. Per the frontend rules, user-visible interactions should have passing Playwright E2E. Add/extend an E2E for the class page main view (outside the 17 scoped files, but recommended before this ships).

---

## Nitpick

### N1 — 9 ESLint `no-magic-numbers` warnings in `studentAveragesTableColumns.spec.tsx`

Lines **150, 151, 155, 156, 160, 161** raise `No magic number: 2 / 4 / 5` (score-range filter assertions). These are warnings (not errors) so the build is green, but for readability consider extracting the expected boundary numbers into named constants (e.g. `LOW_SCORE = 2`, `MID_SCORE = 4`, `HIGH_SCORE = 5`).

### N2 — `align: 'center'` literals are correct API values, not British-English issues

Grep flagged `align: 'center'` in `studentAveragesTableColumns.tsx` (e.g. line 122) and `classPageModel.ts`. These are Ant Design `Table` column enum values and must remain the literal `'center'`; **do not** "anglicise" them to `'centre'`. No British-English violations were found in comments, identifiers, or user-facing strings in the additions.

---

## Checklist (Frontend subset applied)

- [x] No `console.*` in production files (grep: none).
- [x] No `src/backend/` imports in scoped files (grep: none).
- [x] Functions exported as `function`, not arrow-const (grep for `export const … = (` : none).
- [x] TypeScript: `tsc -b` clean, no implicit `any` on public surfaces.
- [x] `App.tsx` untouched / remains thin composition root (not in scoped set; ClassPage is route-level only).
- [x] No `@ant-design/v5-patch-for-react-19` added.
- [x] No CDN-dependent runtime assets introduced.
- [x] Files ≤ 500 lines (ClassPageContent.tsx 443 is the largest; within limit).
- [x] British English: no American-spelling violations in additions.
- [x] Spacing: no raw non-8px-multiple padding/margin/gap literals in additions (`MetricIconLabel` uses `width: '100%'` and icon `size`/`strokeWidth`, not layout spacing).
- [ ] **Tests green** — **FAIL** (C1). Must be resolved.

---

## Files Read (evidence)

Production (full): `ClassPage.tsx`, `ClassPageContent.tsx`, `ClassPageHeaderActions.tsx`, `classPageAdapter.ts`, `classPageModel.ts`, `RecentAssignmentCard.tsx`, `RecentAssignmentsSection.tsx`, `StudentAveragesTableCard.tsx`, `studentAveragesTableColumns.tsx`, `MetricIconLabel.tsx` (unscoped dependency).

Specs (full): `ClassPage.spec.tsx`, `ClassPageContent.spec.tsx`, `classPageAdapter.spec.ts`, `classPageModel.spec.ts`, `RecentAssignmentCard.spec.tsx`, `RecentAssignmentsSection.spec.tsx`, `studentAveragesTableColumns.spec.tsx`.

Diff: `/tmp/opencode/classpage-diff.txt` (2446 lines, read in full).

Docs: repo `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/{frontend-testing,frontend-shared-helpers-and-abstraction-standards,frontend-spacing-and-padding-standards,frontend-logging-and-error-handling,frontend-shell-navigation-and-motion}.md`, `https://ant.design/llms.txt`.

---

**Reminder to calling agent:** You must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean. The blocking item here is **C1 (red Vitest suite)**; I1–I4 and N1–N2 should be triaged alongside it.
