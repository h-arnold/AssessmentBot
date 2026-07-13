# Code Review — Frontend `metricDisplay` + `heatmapAdapter` (feat/ReactFrontend…HEAD)

**Reviewer:** Code Reviewer agent
**Scope:** 9 files under `src/frontend/src/services/dataAnalysis/`
**Mandatory reading completed:** `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/frontend-testing.md`, `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `docs/developer/frontend/metric-display-precision.md`, `docs/developer/frontend/metric-icon-display.md`, `docs/developer/frontend/frontend-spacing-and-padding-standards.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`. Ant Design v6 `Tag`/`Slider` class behaviour was confirmed empirically from the test run (not only from docs).

---

## Summary

**Verdict: FAIL** — the branch does not pass its own frontend unit tests. `metricTone.spec.ts` and `MetricPill.spec.tsx` contain **9 failing assertions** because the implementation (`metricTone.ts`) was reworked (gradient formula + `notAttempted` colour) in a way that no longer matches the committed tests, the planning doc (`frontend-shared-helpers-and-abstraction-standards.md` §9.17), or the inline JSDoc. Automated checks: `tsc` passes; **lint errors exist but are in an out-of-scope file**; within scope only warnings are produced.

The branch must not be merged until the implementation, tests, planning doc, and inline JSDoc are reconciled and the suite is green. Detailed findings below.

---

## Critical (must fix before merge)

### C1. `metricTone.spec.ts` — 8 tests fail; implementation gradient formula disagrees with the tests (and the §9.17 design doc)

The committed tests encode a **linear** gradient: hue `120·t`, lightness `38 + 10·sin(πt)`, and `notAttempted` → `color: 'default'`, `cellStyle: {}`.

The committed implementation uses a **different** formula:

- `resolveGradientFill` (metricTone.ts:140-144): `hue = 120·t^1.5`, `lightness = 34 + 9·sin(πt)`
- `resolveGradientCellStyle` (metricTone.ts:158-164): `120·t^1.5` for hue
- `notAttempted` branch (metricTone.ts:225-232): `color = NOT_ATTEMPTED_GREY = '#434343'`, `cellStyle = { backgroundColor:'#e8e8e8', color:'#434343' }`

Empirically observed failures (from `npm --prefix src/frontend run test -- metricDisplay/metricTone.spec.ts ...`):

| Test                           | Expected                                    | Received                                |
| ------------------------------ | ------------------------------------------- | --------------------------------------- |
| floor (value 0, default range) | `hsl(0.0, 70%, 38.0%)`                      | `hsl(0.0, 70%, 34.0%)`                  |
| value 1 (default range)        | `hsl(24.0, 70%, 43.9%)`                     | `hsl(10.7, 70%, …)` (hue `120·0.2^1.5`) |
| midpoint (value 2.5)           | `hsl(60.0, 70%, 48.0%)` (amber)             | `hsl(42.4, 70%, 43.0%)` (orange-red)    |
| ceiling (value 5)              | `hsl(120.0, 70%, 38.0%)`                    | `hsl(120.0, 70%, 34.0%)`                |
| 0-100 range value 0 / 50 / 100 | linear `0/60/120` hue, `38/48/38` lightness | `120·t^1.5` hue, `34+9·sin` lightness   |
| `notAttempted`                 | `color:'default'`, `cellStyle:{}`           | `color:'#434343'`, `cellStyle:{…}`      |

Evidence:

- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts:140-144` and `:158-164` (formula)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts:225-232` (`notAttempted`)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.spec.ts:27-95` (expected values)
- Planning doc `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 1 states the hue "sweeps red (0) → amber (60) → green (120)" (i.e. **linear**, midpoint = amber 60) and "`notAttempted` returns `'default'` (no fill)". The tests align with the doc; the implementation diverges.

**Required action:** Decide the authoritative gradient design (linear per doc/test, or the `t^1.5` bias per the code's own JSDoc) and make the implementation, the tests, the §9.17 planning doc, and the inline JSDoc all agree. Do not merge with a red suite.

### C2. `MetricPill.spec.tsx` — compact `notAttempted` test fails (expects `ant-tag-default`, gets a custom-coloured tag)

`src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.spec.tsx:206-220` asserts, for a `notAttempted` metric rendered with `compact`, that the tag class contains `ant-tag-default`. Because the implementation now resolves `notAttempted` → `color:'#434343'` (a custom colour string), Ant Design renders an `ant-tag-filled` tag with that dark-grey background — **not** `ant-tag-default`. The assertion therefore fails.

This is the same root cause as C1 (`notAttempted` colour divergence). The test header at `MetricPill.spec.tsx:183` still says _"RED phase — compact prop does not exist yet"_, but `compact` **is** implemented (MetricPill.tsx:47, 88-91), so the test is no longer RED-phase — it is an assertion that contradicts the current implementation.

Evidence: `MetricPill.spec.tsx:206-220`; `MetricPill.tsx:148` (`<Tag color={resolution.color} …>`); `metricTone.ts:225-232`.

**Required action:** Reconcile with C1 (pick `'default'` or `'#434343'` consistently across impl, tests, doc, JSDoc).

### C3. Inline JSDoc in `metricTone.ts` contradicts the code (drift)

`metricTone.ts:33-38` documents `MetricToneResolution.color` as _"for `notAttempted` it is `'default'`"_, but the code returns `'#434343'`. Likewise the `@remarks` on `resolveMetricTone` (lines 177-190) describes a gradient that "sweeps red → amber → green" while the implementation uses `t^1.5`, which does **not** reach amber (60) at the midpoint. The JSDoc must be corrected to match whichever formula is chosen in C1, or the code must match the JSDoc — they currently describe different behaviour.

Evidence: `metricTone.ts:33-38`, `:177-190` vs `:140-144`, `:225-232`.

---

## Improvement (not blocking, but should be addressed)

### I1. `metricRangeFilter.tsx` — type name `MetricRangeFilterProps` violates the project `…Properties` naming convention

Lint warning `unicorn/prevent-abbreviations` fires at `metricRangeFilter.tsx:72`. The codebase consistently names prop/contract types `…Properties` (e.g. `MetricPillProperties`, `MetricPillProperties` in MetricPill.tsx). Rename `MetricRangeFilterProps` → `MetricRangeFilterProperties` for consistency.

### I2. `metricRangeFilter.tsx` — `filteredValue` encoding drops the N/E include toggles

`buildMetricRangeFilter` (metricRangeFilter.tsx:97-110) always builds `filteredValue` with `includeNotAttempted: false, includeError: false`, even though the dropdown can set `includeN`/`includeE` to `true` (metricRangeFilterDropdown.tsx `applyFilter`). Because `filteredValue` is the antd _controlled_ value, a parent that tracks only `[min, max]` will feed a key that ignores the toggles the dropdown just set, causing a divergence between the controlled `filteredValue` and the `selectedKeys` the dropdown applied. Either encode the toggles into the controlled `filteredValue` from the parent's filter state, or document that N/E are session-only and cannot be reflected in the controlled key. (The consumer `TaskHeatmapTable` is outside this review scope, so verify the wiring there.)

### I3. `metricTone.ts` — extract the gradient magic numbers to named constants

Lint warnings `no-magic-numbers` fire for `120`, `1.5`, `34`, `9` (metricTone.ts:141-142, 159). These are domain-tuning constants for the gradient; name them (e.g. `GRADIENT_HUE_MAX = 120`, `GRADIENT_HUE_BIAS = 1.5`, `GRADIENT_LIGHTNESS_BASE = 34`, `GRADIENT_LIGHTNESS_AMPLITUDE = 9`) so the formula is self-documenting and the linter is satisfied. (Same applies to the `0.5` step defaults in `metricRangeFilter.tsx:97` and `metricRangeFilterDropdown.tsx:40`, and the index `2` in `metricRangeKey.ts:65` — these are warnings only.)

### I4. `heatmapAdapter.spec.ts` — stale "RED-phase / expected to FAIL" file header

The spec header (heatmapAdapter.spec.ts:1-17) states the tests "are expected to FAIL because … TaskTitlesUnavailableError does not exist yet … adaptMetricsToHeatmap still has the old 3-arg signature". All of those symbols **now exist** and the tests pass. The header is misleading and should be updated to reflect that this is now a green spec, so future readers are not confused into thinking failures are expected.

### I5. `heatmapAdapter.ts` — `DEFAULT_CLASS_NAME_LABEL = 'Class Overview'` is an unrequested fallback default

`heatmapAdapter.ts:77` introduces a default label used when `classFull.className` is `null`. Per core principle #7 ("Never set defaults unless explicitly instructed to do so") and #12, confirm this fallback is actually required by the contract; if so, note the rationale in a comment, and prefer sourcing the fallback from a shared constant if one exists. Low severity (British-English copy is correct), but worth a deliberate decision.

---

## Nitpick

- **N1.** `metricRangeFilter.tsx` default `step = 0.5` and `metricRangeFilterDropdown.tsx` default `step = 0.5` duplicate the same literal; a shared `DEFAULT_RANGE_STEP = 0.5` constant would avoid drift (minor).
- **N2.** `resolveDiscreteCellStyle` (metricTone.ts:251-269) is a `switch` that maps each `MetricToneColor` to `METRIC_TONE_CELL_STYLE[token]`. This can be collapsed to `return METRIC_TONE_CELL_STYLE[token];` (the record is keyed by the same union), removing the switch boilerplate. Functionally identical; purely a readability tidy.
- **N3.** `metricTone.spec.ts:76` and the new compact tests in `MetricPill.spec.tsx` trigger `no-magic-numbers` warnings (e.g. `5`); harmless in tests but consistent with I3 if extracted.

---

## Automated-check results (scoped)

- **`npm exec tsc -- -b src/frontend/tsconfig.json`** → PASS (exit 0).
- **`npm run lint:frontend`** → exits non-zero (LINT_EXIT=1) **but only because of 2 errors in `src/frontend/e2e-tests/navigation-screenshots.spec.ts`, which is OUTSIDE this review's diff scope.** Within the 9 in-scope files there are **no lint errors** — only warnings: `unicorn/prevent-abbreviations` (`MetricRangeFilterProps`, I1) and `no-magic-numbers` (I3/N1/N3). Those out-of-scope e2e errors should be fixed separately so the lint gate is green, but they are not part of this change and not blocking _this_ review.
- **Tests** → `npm --prefix src/frontend run test -- metricDisplay/metricTone.spec.ts metricDisplay/MetricPill.spec.tsx heatmapAdapter.spec.ts` → **9 failed / 27 passed** across 2 files (metricTone.spec.ts 8, MetricPill.spec.tsx 1). `heatmapAdapter.spec.ts` passes.

## Checklist (frontend)

- [x] No `console.*` in any in-scope source file (verified by read + lint).
- [x] No empty `catch` blocks.
- [x] British English in comments/identifiers/user-facing text (prose uses "colour"; `color` is the idiomatic antd/React prop name).
- [x] No speculative scope beyond the diff.
- [~] No default values without instruction — `DEFAULT_CLASS_NAME_LABEL` (I5) and React prop defaults (`emphasised=false`, `compact=false`, `precision=2`) are idiomatic/sanctioned by §9.17; flag I5 for a decision.
- [x] Functions exported as functions, not arrow-constant exports (all `export function` / `export class`; `METRIC_TONE_CELL_STYLE` is a data const, not a function).
- [x] `@remarks`/`JSDoc` present on key functions/classes (drift noted in C3).
- [x] Files ≤ 500 lines (largest in scope: heatmapAdapter.spec.ts 437; all others well under).
- [x] No imports from `src/backend/` (imports are from sibling `services/*` + `antd` + `react`).
- [x] Spacing on 8px grid — `metricRangeFilterDropdown.tsx` uses `padding:8`, `gap:8`; `MetricPill.tsx` compact `padding:'2px 4px'` is the documented 4px exception (spacing doc §5.2). Font sizes are not spacing.
- [~] Metric precision/icon conventions — `MetricPill` keeps `precision` default 2, `compact` passes through `precision` (heatmap overrides to 0 per metric-display-precision.md); verified consistent with that doc. The `notAttempted` colour divergence (C1/C2) is the open issue.
- [x] Playwright — these are pure/component units (resolver, adapter, pill, filter builder); no new user-visible interaction introduced that lacks a Playwright path (the heatmap consumer lives outside this diff).

---

## Files read (evidence)

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/metric-display-precision.md`
- `docs/developer/frontend/metric-icon-display.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.spec.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.spec.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
