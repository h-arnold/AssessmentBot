# Code Review — Frontend E2E (Playwright) Test Changes

**Scope:** Diff `feat/ReactFrontend...HEAD` for:
`src/frontend/e2e-tests/app.spec.ts`, `classes-page.spec.ts`, `helpers/classes-page-end-to-end-helpers.ts`, `helpers/task-heatmap-end-to-end-helpers.ts`, `navigation-screenshots.spec.ts`, `shared/endToEndRuntimeMocks.ts`, `task-heatmap.spec.ts`.

**Mandatory reading completed:** `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/frontend-testing.md`, `docs/developer/frontend/frontend-playwright-e2e.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`.

**Automated checks run:**

- ESLint scoped to the 7 changed files: **2 errors** (both in `navigation-screenshots.spec.ts`). Full `npm run lint:frontend` (type-aware over all of `src`) timed out at 300 s, so the scoped run was used as the authoritative signal for the changed files.
- `npm run test:frontend:e2e` was **not** executed: Chromium is not confirmed installed in this environment. Per instructions, the review does not fail on that basis; tests were instead reviewed for correctness, hermeticity, and behaviour-level assertions.

---

## Summary

**Verdict: FAIL** — the changes introduce a file (`navigation-screenshots.spec.ts`) that fails the project's ESLint JSDoc rules (`jsdoc/require-param-description`, `jsdoc/require-param-type`), and a `describe` block name that violates the repository-wide test-naming rule in `frontend-testing.md`. In addition, the new heatmap filter test depends on a shared helper that references a misspelled antd v6 class (`.ant-dropdown` vs the real `.ant-dropdown`), which would cause that test to hang on its `toBeVisible()` assertion. All items below must be resolved (or the `(RED)`/snapshot concerns explicitly waived) before merge.

---

## Critical

### C1 — `navigation-screenshots.spec.ts:20` — Failing JSDoc lint (blocks `lint:frontend:check`)

The `openTaskHeatmap` helper has a JSDoc `@param page` with neither a description nor a type. ESLint reports:

```
20:1  error  Missing JSDoc @param "page" description  jsdoc/require-param-description
20:1  error  Missing JSDoc @param "page" type         jsdoc/require-param-type
```

These two rules are **not auto-fixable** (`--fix` cannot synthesise a description/type), so `npm run lint:frontend:check` (which runs `eslint --max-warnings 0`) will fail. This is a hard merge blocker.

**Fix:** Add a typed, described param, e.g.

```ts
/**
 * Navigate to the Task Heatmap from the Classes list.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>}
 */
```

### C2 — `task-heatmap.spec.ts:39` — Temporary planning label in `describe` name (violates `frontend-testing.md`)

```ts
test.describe('Task Heatmap E2E journey (RED)', () => {
```

`frontend-testing.md` ("Test naming and traceability") states: _"Avoid temporary planning labels in test names and helpers … do not use action-plan section numbering such as Section 1, Section 2, or similar in `describe(...)` blocks, test titles, constants, or fixture names. This is a repository-wide rule."_ `(RED)` is a TDD-phase placeholder that becomes misleading once the feature is implemented and the suite passes. It must be removed.

**Fix:** Rename to a behaviour-describing label, e.g. `test.describe('Task Heatmap E2E journey', ...)` (and drop the `(RED)` suffix from any related titles/constants if present).

### C3 — `shared/endToEndRuntimeMocks.ts:651` (pre-existing, now exercised by new test) — Misspelled antd dropdown class breaks the filter helper

```ts
const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
```

The class is `.ant-dropdown` with **two** "d"s. Verified against the installed antd v6.3.1 (`node_modules/antd`): the only emitted token matching `ant-drop[a-z]*` is `ant-dropdown`. The code's `.ant-dropdown` (single "d") can never match, so `activeFilterPopup` is always empty and `await expect(activeFilterPopup).toBeVisible()` will time out.

This is pre-existing in the shared helper (the diff only changed `applyColumnFilterOption`'s signature/import, not this line), **but** the new in-scope test `task-heatmap.spec.ts` → `'band filter hides non-matching rows'` calls `applyColumnFilterOption(...)`, so the defect is now directly on the critical path of a reviewed test. (For reference, the same typo also exists in `classes-crud-table-controls.spec.ts:74` and `assignments-year-group-migration.spec.ts:120`, both out of this review's file set.)

**Fix:** Correct the selector to `.ant-dropdown:visible` in `endToEndRuntimeMocks.ts` (and, out of scope, the two sibling specs).

---

## Improvement

### I1 — `helpers/task-heatmap-end-to-end-helpers.ts:36-38` — Malformed nested JSDoc swallows the intended doc on an exported constant

```ts
/**
/** Class id for the heatmap journey fixture. */
export const HEATMAP_CLASS_ID = '100000000001';
```

The opening `/**` on line 36 is never closed by its own `*/`; the `*/` on line 37 closes it, which means the intended JSDoc comment for `HEATMAP_CLASS_ID` is swallowed as text inside the preceding comment block. The exported constant therefore ships with **no** JSDoc. This is a copy/paste artefact and should be cleaned up (remove the stray line-36 `/**`, leaving a single correct `/** ... */` for the constant, consistent with the other exported constants in this file).

### I2 — Duplicated navigation helper across two specs

`task-heatmap.spec.ts` defines `openHeatmapClass(page)` and `navigation-screenshots.spec.ts` defines `openTaskHeatmap(page)`. They are near-identical (goto → Classes menu → filter class card by `HEATMAP_CLASS_NAME` → View → wait "Recent Assignments" → click assignment card → wait heatmap table). Per the E2E testing guidance ("prefer extending an existing helper before copying setup logic") and the review checklist ("Helpers are reusable and not duplicating logic"), this belongs in `helpers/task-heatmap-end-to-end-helpers.ts` as a single shared export consumed by both specs.

### I3 — `navigation-screenshots.spec.ts` — Screenshot assertions are environment-sensitive

The two tests rely on `expect(page).toHaveScreenshot(..., { maxDiffPixelRatio: 0.1 })`. Pixel-comparison screenshots are notoriously flaky across CI runners (font substitution, antd version/theme defaults, anti-aliasing). If these are kept, ensure the CI image is regenerated on the same Chromium/build and document the rationale; otherwise prefer additional behaviour-level assertions (the heatmap spec already covers the behavioural paths well). Flagging because the file is named as a "navigation" test but only captures pixels — consider folding the navigation assertions into `task-heatmap.spec.ts` (which already asserts the same user-visible headings/table) and keeping screenshots only for genuine visual-regression intent.

### I4 — Tightly-coupled `aria-label` assertions

`task-heatmap.spec.ts` asserts exact, implementation-specific strings in several places:

- `page.getByRole('cell').filter({ has: page.locator('[aria-label="Student Two, task_001, Completeness: 5.00"]') })` (line 67-69)
- `table.locator('[aria-label="Completeness"]')` / `'Accuracy'` / `'SPaG'` (lines 201-203, 241, 244)

These are reasonable for E2E _accessibility_ coverage, but they bind the tests to a specific aria-label contract (format, capitalisation, 2-dp precision). They are correct _if_ the heatmap component emits exactly that label; if the component uses a different phrasing the tests fail for a cosmetic reason rather than a behavioural one. Confirm the label contract is intentional and stable, and consider asserting the visible band/colour as the primary signal with the aria-label as a secondary check. (Note the `5.00` 2-dp format does align with `metric-display-precision.md`, which is good.)

---

## Nitpick

### N1 — `task-heatmap.spec.ts:16` — Misleading constant name/value

```ts
const METRIC_SUBCOLUMN_COUNT = 3;
```

The comment says "Number of metric sub-columns **per task group** (Completeness, Accuracy, SPaG)" — i.e. it describes the _metrics per task_ — but the value `3` is actually used (line 62) to assert that the **"Completeness"** column header appears **3 times** (once per _task group_, because there are 3 tasks). The constant works only because the number of tasks (3) happens to equal the number of metrics (3). If the fixture ever used a different task count this assertion would silently break. Rename to `EXPECTED_TASK_GROUP_COUNT` (or derive it from `HEATMAP_TASK_IDS.length`) to remove the coincidence.

### N2 — Minor comment typo

`task-heatmap.spec.ts:55` comment reads `// Grouped header: ...` ("Grouped" → should be "Grouped" / "Grouped header"). Cosmetic only.

### N3 — Minor inconsistency in warm-up queue entry counts

In `task-heatmap-end-to-end-helpers.ts`, `createHeatmapScenario` provides **two** `getYearGroups` entries but only **one** `getABClassPartials` / `getCohorts` / `getAssignmentTopics` / `getAssignmentDefinitionPartials` entry. The existing `createClassesScenario` uses single entries for all of these. For warm-up reference data this is benign (an extra unconsumed entry is harmless, and a single entry matches the established pattern), but the asymmetry is worth normalising so the two factories stay consistent.

---

## Out-of-scope / collateral observation (NOT introduced by this change)

While writing the scratchpad, the TypeScript language server reported **pre-existing** type errors in `shared/endToEndRuntimeMocks.ts`:

- `162:14`, `178:14`, `191:14`, `204:14`, `220:14` — `Cannot assign to 'getAuthorisationStatus' / 'getABClassPartials' / 'getCohorts' / 'getYearGroups' / 'getAssignmentTopics' because it is a read-only property.`
- `292:12`, `297:12`, `355:12`, `360:12`, `361:12` — same for the assignment/wizard scenario factories.
- `495:5` — `readonly ResponseItem[]` cannot be assigned to mutable `ResponseItem[]`.

These are all in helper functions (`addAuthToScenario`, `addClassPartialsToScenario`, `createAssignmentsScenario`, `createWizardScenario`, …) that lie **outside** the 14-line diff for this file (the diff only touched the `import` and `applyColumnFilterOption`). They are therefore **not** introduced by the reviewed change and are pre-existing on both `feat/ReactFrontend` and `HEAD`.

Why it is only a collateral note and not a Critical item:

- Playwright compiles spec files via its own transpiler (esbuild/ts-node), which strips types **without** a full `tsc` type-check, so these errors do **not** block `npm run test:frontend:e2e` from running.
- My scoped ESLint run did not flag them (ESLint reports lint-rule violations, not raw TS compiler errors).

It is worth a separate follow-up (ideally outside this review): the `RuntimeScenario` type is `Readonly<{...}>` while the factory helpers mutate `scenario.<method> = ...`. Either make the scenario object non-readonly inside the factories (e.g. build into a mutable local then freeze/return) or change the assignment style. A future strict `tsc --noEmit` over the e2e tree would otherwise fail.

---

## Positive notes

- The `applyColumnFilterOption` signature extension (`Locator | string | RegExp`) is a genuine improvement: it lets the heatmap test scope the filter trigger to a specific table column header (`.first()`) rather than a global name lookup — good for the grouped-table case.
- `createHeatmapScenario` correctly mirrors `createClassesScenario` and provides **two** `getABClass` entries for React 19 StrictMode double-effect, matching the documented E2E rule. The `deferredClass` variant also supplies two `deferredSuccess` entries, consistent with `frontend-playwright-e2e.md`.
- The fixtures follow the documented `data: null` / `success` envelope shape and the runtime-mock `installRuntimeMock` is called **before** `page.goto`, satisfying the documented anti-patterns.
- British-English usage is consistent throughout the new test/helper code ("behaviour", "themed", "colours", "seeded", etc.); no American spellings were found in the changed files.
- No `console.*` calls and no speculative scope were introduced.

---

## Files read (full content)

1. `src/frontend/e2e-tests/app.spec.ts` (444 lines)
2. `src/frontend/e2e-tests/classes-page.spec.ts` (717 lines)
3. `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` (650 lines)
4. `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` (380 lines)
5. `src/frontend/e2e-tests/navigation-screenshots.spec.ts` (74 lines)
6. `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` (736 lines)
7. `src/frontend/e2e-tests/task-heatmap.spec.ts` (256 lines)
8. `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/frontend-testing.md`, `docs/developer/frontend/frontend-playwright-e2e.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`

## Verification commands used

- `git diff feat/ReactFrontend...HEAD -- <files>`
- ESLint scoped: `npx eslint <7 changed e2e files>` → 2 errors (navigation-screenshots.spec.ts)
- `grep` for `SLIDES` → helper value `'SLIDES'` matches `assignmentDefinition.zod.ts` enum (`z.enum(['SLIDES', 'SHEETS'])`); **no** enum mismatch (initially suspected, confirmed correct).
- `grep` for `APP_BREADCRUMB_BASE_LABEL` across `src/frontend` → **no** dangling references after its removal (clean).
- `grep`/`node -e` to confirm antd v6.3.1 dropdown class is `.ant-dropdown` (two d's).

---

## Required actions before re-submit

1. **C1** — Fix the JSDoc on `openTaskHeatmap` in `navigation-screenshots.spec.ts` (add `@param {Page} page` description + type).
2. **C2** — Remove `(RED)` from the `describe` name in `task-heatmap.spec.ts`.
3. **C3** — Correct `.ant-dropdown` → `.ant-dropdown` in `shared/endToEndRuntimeMocks.ts` (so the new heatmap filter test can resolve the popup).
4. Address **I1–I4** and **N1–N3** as appropriate.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
