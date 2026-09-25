# Pre-PR Review — planning/issue-307-zero-weight-assessment

- **Base branch:** origin/main
- **Generated:** 2026-09-23T16:05:00Z
- **Health gate:** PASS (0 regressions, 0 new failures, 11 fixes vs baseline). Note: the gate's overall status prints FAILING because of 10 `max-lines` backend-lint failures that are byte-identical to the baseline (pre-existing; verified in the baseline report). The first gate attempt produced 139 spurious E2E failures caused by the Playwright dev server refusing connections (`net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173`), not by the diff; a clean re-run passed E2E with 1 fix.
- **Changed files:** 93 (93 files changed, 9446 insertions(+), 5671 deletions(-))

## Verdict

**Fail** — three focuses reported Critical findings (out-of-scope agent/model config changes in the diff; a silent `?? 1` full-weight fallback for unknown taskIds; deletion of merge-parity/collapsed-column accumulation tests without replacement). These must be resolved before opening the PR.

## Focus areas

### Repo rule compliance

**Verdict: FAIL**

Diff findings:

- **[Critical] Scope creep — agent configuration:** `.opencode/agents/implementation.md:4`, `.opencode/agents/testing-specialist.md:4`, and `opencode.jsonc:4` change the configured model to `opencode/mimo-v2.6-flash-free`. These changes do not support the frontend zero-weight feature; the plan describes a frontend-focused scope at `ACTION_PLAN.md:31-46`. Remove them from this issue diff or handle them separately.
- **[Critical] Task-level contracts permit aggregate-only `excluded`:** `dataAnalysis.zod.ts:137-141` defines the narrow task-display union without `excluded`, and `dataAnalysis.zod.ts:262-270` applies it to per-student-task output. However, `taskHeatmapTableColumns.tsx:69-76` types heatmap cells as the full `MetricResult`, while `TaskPreviewCard.tsx:43-45` now accepts both `metricState: 'excluded'` and `metricScore: null`. Its computed branch converts the score with `Number(score)` at `TaskPreviewCard.tsx:85-93`, so an allowed-by-type `{ metricState: 'computed', metricScore: null }` becomes numeric zero instead of surfacing invalid data. The added `excluded` reassembly at `TaskPreviewCard.tsx:113-120` also treats the aggregate-only state as valid task-preview data. This conflicts with the canonical task-display contract (`frontend-data-analysis-response.md:268-283`). Narrow the task-level types and fail fast on an invalid state/value pairing rather than rendering it.
- **[Improvement] Missing Playwright coverage for the new filter interaction:** `metricRangeFilterDropdown.tsx:137-146` adds an interactive "Include Excluded" checkbox. The unit test covers it at `metricRangeFilterDropdown.spec.tsx:273-282`, but the changed browser filter test exercises the range slider only (`task-heatmap.spec.ts:155-182`); no Playwright spec under `src/frontend/e2e-tests/` covers the new checkbox. The frontend testing policy requires Playwright coverage for every new or changed user-visible interaction (`frontend-testing.md:56-66`). Add a browser test that toggles the control and verifies the aggregate filtering result.
- **[Nitpick] Inconsistent subsection numbering:** `frontend-shared-helpers-and-abstraction-standards.md:651` renumbers the Class page section to `9.19`, but its first subsection remains `9.18.1` at line 655. Renumber the nested headings consistently.
- **[Nitpick] Stale file-size notes:** The same document still reports `metricTone.ts` as approximately 223 lines (`frontend-shared-helpers-and-abstraction-standards.md:494`) and `MetricPill.tsx` as 125 lines (`:509`), while the reviewed files now end at lines 313 and 177 respectively. Update or remove those counts.

#### Incidental (triage)

- None.

### KISS & DRY

Diff findings:

- **[Improvement] D-1. Unreachable fallback branch with non-null assertion in new module.** `averagingAnalyser.composite.ts:87` (`if (denominator === 0) return resolveTerminalComposite(criteria, criterionWeightings)!;`). `resolveTerminalComposite` returns `null` only when `hasComputed` is true (composite.ts:119-126), which is exactly the condition for `toComputedEntry` (composite.ts:57) to emit an entry, so `denominator > 0` is guaranteed at line 87. The branch is a leftover of the pre-refactor logic. Dead code plus a `!` assertion; delete it.
- **[Improvement] D-2. Effective-weighting formula now duplicated with two independent sources of truth.** `heatmapAdapter.buildTaskColumns` computes `assignmentWeighting ?? 1` × `taskWeighting ?? 1` and derives `includedInAverage` (heatmapAdapter.ts:111-121), while the analyser computes the identical product via `resolveEffectiveWeight` (`averagingAnalyser.accumulation.ts:45-53`) with the same `?? 1` defaults echoed in `resolveAssignmentDefinition.ts:38-39`. If one default or formula drifts, the heatmap header's "includedInAverage" and the analyser's accumulator weights disagree. Extract one shared `resolveEffectiveWeight(partial, taskId)`.
- **[Improvement] D-3. Three metric-to-display-text formatters with divergent `excluded` handling.** `MetricPill.formatDisplayText` (MetricPill.tsx:104-116, renders `'Excluded'`), `renderClassPageScore` (studentAveragesTableColumns.tsx:84-95, renders `'Excluded'`), and `renderScore` in the heatmap (taskHeatmapTableColumns.tsx:157-165, no `excluded` branch — any non-computed/non-`N` state falls through to `'E'`). Two of the three were touched by this diff, yet the third was left unaligned. An `excluded` cell would silently render as `E`. A single shared `formatMetricDisplayText(metric, precision)` in `metricDisplay/` would remove the triplication and the latent mislabel.
- **[Improvement] D-4. Meaningless delegation wrapper and re-export shim retained after the split.** `accumToMetric` is now a bare pass-through to `resolveAggregateMetric` (`averagingAnalyser.accumulation.ts:33-35`); rows.ts calls the wrapper while importing `resolveDisplayMetric` directly from `metricResolution` (rows.ts:8). Similarly, the re-export block `averagingAnalyser.accumulation.ts:13-18` is consumed in production only by `averagingAnalyser.ts:2` and `rows.ts:7`; its remaining raison d'être is spec imports.
- **[Improvement] D-5. Three new fixture modules duplicate shared test scaffolding.** `createTestQueryClient` is byte-identical in `src/test/heatmapsPageDataFixtures.ts:24-30` and `src/test/taskHeatmapPageFixtures.ts:12-18`; near-identical `ClassFull` fixtures in three files; near-identical merged-result fixtures (`createMergedResult` heatmapsPageDataFixtures.ts:255-274 vs `buildMergedResult` heatmapBuilderSurfaceTestHelpers.ts:56-77); near-identical definition-partial fixtures in three files plus the existing `src/test/dataAnalysis/fixtures.ts:203-237`. At minimum share the byte-identical utilities.
- **[Improvement] D-6. Redundant excluded guard at task level.** `resolveDisplayMetric` can only return `computed`/`notAttempted`/`error` (averagingAnalyser.metricResolution.ts:51-77), yet `buildPerStudentTaskMetrics` wraps every field in `toTaskDisplayMetric`, whose only job is to throw on `excluded` (averagingAnalyser.taskProjection.ts:43-46, 13-15). If `resolveDisplayMetric` declared the narrow return type, the wrapper would be provably unnecessary here.
- **[Nitpick] N-1. One-caller helper wrapping a single comparison.** `isComputedMetricInRange` (metricRangeFilter.tsx:65-67) — the inline form was simpler.
- **[Nitpick] N-2. Positional boolean API grew.** `applyFilter` now takes four sequential booleans (metricRangeFilterDropdown.tsx:66-83), and the three checkbox blocks (metricRangeFilterDropdown.tsx:117-146) are copy-paste siblings.
- **[Nitpick] N-3. Rank constants add indirection without meaning.** `FIRST/SECOND/THIRD/FOURTH_METRIC_STATE_RANK` (metricStateRank.ts:14-17) just restate the Map's positional indices.
- **[Nitpick] N-4. Duplicated fail-fast contribution lookup.** `requireAverageContribution` (averagingAnalyser.rows.ts:130-139) and the inline guard in `buildPerStudentTaskMetrics` (averagingAnalyser.taskProjection.ts:34-37) implement the same "get or throw".
- **[Nitpick] N-5. Positional array for criterion weights.** `[criterionWeightings.completeness, criterionWeightings.accuracy, criterionWeightings.spag][index]` (averagingAnalyser.composite.ts:123-125) — a keyed record lookup is less brittle.

Positive KISS verdicts: accumulatorRegistry, composite, metricResolution, taskProjection, metricDisplay changes, and `taskHeatmapZeroWeightHeader` all earn their place. The diff also removes real duplication (old dual-path per-task rollup; the zero-weight `nCount++` accumulator-faking hack).

#### Incidental (triage)

- **[Improvement] I-1.** Composite `taskKey` format `` `${definitionKey}::${taskId}` `` is constructed ad hoc in five modules (heatmapAdapter.ts:115, buildCellPreviewLookup.ts:137, averagingAnalyser.accumulation.ts:105, accumulatorRegistry.ts:47/86/122). A single `buildTaskKey()` would centralise the contract.
- **[Improvement] I-2.** `WEIGHTS` (classPageAdapter.ts:42-46) duplicates `DEFAULT_CRITERION_WEIGHTINGS` (averagingAnalyser.ts:15).
- **[Improvement] I-3.** Forename/Surname column scaffolding duplicated between TaskHeatmapTable.tsx:135-160 and studentAveragesTableColumns.tsx:178-203.
- **[Nitpick] I-4.** `buildMetricRangeFilter` re-encodes a legacy `activeRange` with hard-coded `false` flags (metricRangeFilter.tsx:130-138).
- **[Nitpick] I-5.** The aria-label template is built twice per metric sub-column with an identical string (taskHeatmapTableColumns.tsx:346, :356).
- **[Nitpick] I-6.** `taskHeatmapZeroWeightHeader.tsx` exports only constants and selector functions from a `.tsx` — a `.ts` would be the consistent home.
- **[Nitpick] I-7.** Two different `UseQueryResult` mocking idioms in files added by this same change (heatmapsPageDataFixtures.ts:74-113 vs heatmapBuilderSurfaceTestHelpers.ts:79-93).

### De-sloppification

Diff findings:

- **[Critical] C1. Unreachable `denominator === 0` fallback with a lying non-null assertion — `averagingAnalyser.composite.ts:87`.** `resolveTerminalComposite` returns `null` only when `hasComputed` is true (composite.ts:157), whose predicate (composite.ts:119-126) is exactly `toComputedEntry`'s (composite.ts:57); therefore `denominator > 0` is guaranteed at line 82's non-empty path, and if `entries` were empty the first call at line 42-43 already returned a terminal result. Line 87 is provably unreachable, and if it ever were reached the second call would also return `null`, which the `!` silently casts to a valid `MetricResult`. Recommended: delete the branch (or replace with a `determineState`-style exhaustive match that throws).
- **[Improvement] I1. Compat facade in `averagingAnalyser.accumulation.ts` should be collapsed** (accumulation.ts:13-18, 33-35). Three parallel routes to the same symbols: owning module, facade re-export, and old-name wrapper (`accumToMetric` has 7 call sites in rows.ts plus spec usage). Import from owning modules directly and drop the re-export block and wrapper.
- **[Improvement] D2. Unreachable zero-weight invariant throw in `rollupMetric` — `rollupMetric.ts:299-301`.** `accumulateComputed` returns early for `totalWeight <= 0` before setting `hasComputed` (rollupMetric.ts:102-104); both computed-path branches derive `finalTotalWeight` from `computedTotalWeight` (>0 by construction) plus positive `naTotalWeight` (rollupMetric.ts:287-297), so `finalTotalWeight === 0` at line 299 cannot occur post-guard. No spec asserts the throw. Delete lines 298-301 (or re-add the contract line the diff just deleted).
- **[Improvement] D3. Dead `?? 1` guards on schema-guaranteed non-nullable values — `heatmapAdapter.ts:113`.** `taskWeighting: z.number()` is not nullable (taskPartial.zod.ts:19-23), so `(task.taskWeighting ?? 1)` guards a guaranteed value. (`partial.assignmentWeighting ?? 1` on line 111 is legitimate — that field is nullable.) Also `partial.tasks ?? []` in accumulation.ts:141 and resolveAssignmentDefinition.ts:40 is dead — schema requires the array. Drop the dead guards.
- **[Improvement] I3. `resolveDisplayMetric` should own the narrow display union; `toTaskDisplayMetric` then becomes unnecessary** — `metricResolution.ts:51-77`, `taskProjection.ts:10-16,43-46`, `rows.ts:184-187`. `displayTotalDataPoints` increments in lockstep with `displayCount`/`displayNCount` (criterionAccumulation.ts:32-34, 42-43, 76-78, 86-87), so the fourth state is impossible; the runtime guard's throw is unreachable at every current call site. Type `resolveDisplayMetric`'s return as the internal three-state union and delete `toTaskDisplayMetric`.
- **[Improvement] I4. Duplicated effective-weight derivation across analyser and adapter** — `averagingAnalyser.accumulation.ts:45-53,131-145` vs `heatmapAdapter.ts:110-124` (three modules independently express the same contract). Extract one `computeEffectiveWeight(partial, taskId)` helper and consume it in both paths.
- **[Improvement] I5. `resolveDisplayMetric`'s excluded branch + `metricInRange`'s object-lookup refactor are noise-indirections** (metricResolution.ts:28-36, metricRangeFilter.tsx:41-56). Collapse the excluded chain in `resolveDisplayMetric`; inline `isComputedMetricInRange`.
- **[Improvement] I5b. Duplicated `Math.max(0, …)` clamp** — `rollupMetric.ts:308-310`: the diff is ≥ 0 by construction; dead-clamping defensive code.
- **[Nitpick] N1 — `hasTerminalNotAttempted`**: one-line, one-caller helper (rollupMetric.ts:154-156); inline it.
- **[Nitpick] N2 — `isComputedMetricInRange`** (metricRangeFilter.tsx:65-68): one-caller named function.
- **[Nitpick] N3 — `assertValidRange`** (metricTone.ts:193-199, sole call site :247): same one-caller pattern; keep only one convention.
- **[Nitpick] N4 — Zero-constant naming ceremony** (metricStateRank.ts:14-17): four constants used once each for map literal values 0-3; inline literals.
- **[Nitpick] N5 — Spec re-declares exported constants** (TaskHeatmapTable.zeroWeight.spec.tsx:9-13): `ZERO_WEIGHT_EXPLANATION`/`ZERO_WEIGHT_GROUP_CLASS`/`ZERO_WEIGHT_FIRST_CLASS`/`ZERO_WEIGHT_LAST_CLASS` are exported from `taskHeatmapZeroWeightHeader.tsx:6-10` yet the new spec re-types all four literals. Import them.
- **[Nitpick] N6 — e2e helper barrel re-exports unneeded names** (task-heatmap-end-to-end-helpers.ts:13-18): `HEATMAP_ASSIGNMENT_NAME` and `HEATMAP_CLASS_ID` re-exports have no importers.
- **[Nitpick] N7 — Disabled reason copy duplication in test helper** (`heatmapBuilderSurfaceTestHelpers.ts:21` vs the private constant at `HeatmapSelectionBar.tsx:43`).

#### Incidental (triage)

- **[Improvement] IM1 — `classAccum` is write-only dead accumulation work** (averagingAnalyser.ts:121-132, criterionAccumulation.ts:174, 237). Its only reader is a fallback that runs only when `perStudentTaskAccums` is empty — exactly when `classAccum` is provably all-zero. One of four accumulator targets is pure runtime waste on every data point. Behaviour-preserving simplification possible.
- **[Improvement] IM2 — duplicated `requireAverageContribution` fail-fast** (averagingAnalyser.rows.ts:130-139 vs averagingAnalyser.taskProjection.ts:33-37).
- **[Improvement] IM3 — One-caller extraction of `renderEmptyArtifactPlaceholder`** (TaskPreviewCard.tsx:135-147, sole caller :167).
- **[Improvement] IM3b — Duplicate metric-by-state copy logic across three modules** (taskHeatmapTableColumns.tsx:157-165, studentAveragesTableColumns.tsx:84-95, MetricPill.tsx:104-116) — the shared `formatMetricDisplayText` fix.
- **[Nitpick] NI1 — `accumToMetric` island re-exported for one spec file.**
- **[Nitpick] NI3 — `ROUNDUP` `appliedCriterionWeightings` double-spread** (averagingAnalyser.ts:57-59, 153).
- **[Nitpick] NI5 — Task-preview `metricScore`/`metricState` flatten-then-reassemble** (TaskPreviewCard.tsx:81-123 + assembleTaskPreviewData.ts:60-63): passing a real `MetricResult` prop through would delete the 40-line fabricator.
- **[Nitpick] NI7 — rollupMetric.ts header @remarks still narrate pre-diff history** ("The prior implementation iterated 4–5 times", rollupMetric.ts:196-212, and similar at averagingAnalyser.ts:87-91, rows.ts:18-21, composite.ts:21-27).

### Performance (Big-O)

No Critical or Improvement diff findings. The diff materially improves the hot-path profile: `buildPerTaskRows` now reads task-level accumulators directly (O(S·T) index build + rollups → **O(T)**), and `accumulateDataPoints` is **O(P·T + I)** overall — appropriate.

- **[Nitpick] 1. `processAssignment`: redundant per-item `ensureAverageContribution` + duplicate `taskKey` string construction** — averagingAnalyser.accumulation.ts:98-106; each item builds the taskKey 2–3 times (accumulation.ts:105; accumulatorRegistry.ts:86, 122). O(I) constant-factor overhead; negligible at I ≈ 10³–10⁴.
- **[Nitpick] 2. `computeOverallComposite` double terminal resolution** — averagingAnalyser.composite.ts:42-43 and 87: `resolveTerminalComposite` runs again on the `denominator === 0` path. O(1); noted only because it sits on the per-row hot path.

#### Incidental (triage)

- **[Improvement] 1. `buildCellsForStudent` linear scan per cell** — heatmapAdapter.ts:149-151: `studentMetrics.find(...)` inside `taskColumns.map` gives **O(R·T²)** worst case per adapter run. At 30 students × 40 tasks ≈ 48k comparisons — acceptable, but a `Map<taskKey, PerStudentTaskMetric>` built once in `groupMetricsByStudent` (heatmapAdapter.ts:176-190) would make it **O(R·T)**. (Pre-existing pattern.)
- **[Improvement] 2. Eager popover-content assembly per cell render** — taskHeatmapTableColumns.tsx:359-371: `content={buildPopoverContent({...})}` evaluates during every cell render, so the "deferred until the popover opens" claim (taskHeatmapTableColumns.tsx:287-288) doesn't hold; `spreadsheetToMarkdownTable` re-converts the full grid — **O(rendered cells × artifact size)**. Lazy content would eliminate it. (Pre-existing pattern.)
- **[Nitpick] 3. `buildAdaptiveTierGroups` repeated column scans** — taskHeatmapTableColumns.tsx:442-446: **O(G × T)** with intermediate arrays; a single-pass bucket would be **O(T + G)**.
- **[Nitpick] 4. `onCell`/`render` duplicate per-cell computation** — studentAveragesTableColumns.tsx:130-144: 2× work per cell.
- **[Nitpick] 5. `splitStudentName` called twice per row** — TaskHeatmapTable.tsx:145, 158.
- **[Nitpick] 6. `buildPerStudentTaskMetrics` sort** — averagingAnalyser.taskProjection.ts:50-52: **O(M log M)**; acceptable.

### Logging & error-handling rules

- **[Critical]** None. No `console.*` in production source (all emission via `logFrontendEvent`/`logFrontendError`); no new `catch` blocks; no double-logging; fail-fast helpers throw only and leave logging to the hook boundary — correct rethrow-at-boundary discipline.
- **[Improvement] 1. Silent first-write-wins on conflicting contribution metadata** — `averagingAnalyser.accumulatorRegistry.ts:123` (`if (contributions.has(taskKey)) return;`) discards any later `effectiveWeight` for an already-registered taskKey with no diagnostic and no invariant check. A warn (or thrown invariant) on a mismatching weight would make a producer bug visible.
- **[Improvement] 2. Undocumented silent substitution in per-task overall** — `averagingAnalyser.rows.ts:177`: `composite.state === 'excluded' ? displayOverall : composite` silently swaps the composite result for the raw accumulator's `overall` with neither JSDoc nor inline comment. If spec-mandated, document it; otherwise narrow it with an explicit assertion.
- **[Nitpick] 3. Degenerate-range throw now fires inside render** — `metricTone.ts:193-199` (`assertValidRange`) throws from `resolveMetricTone`, called during component render (MetricPill.tsx:162, studentAveragesTableColumns.tsx:132, taskHeatmapTableColumns.tsx:344). All current callers pass static constants, so it cannot fire from runtime data; behaviour identical to pre-diff inline throw.

#### Incidental (triage)

- **[Improvement] 1. Bare ZodError at the analyser output boundary lacks structured diagnostics** — `dataAnalysisService.ts:62` throws a raw ZodError reaching generic hook logs (useClassPageData.ts:150, 194). Surfacing `error.issues` at this parse boundary would ease triage of producer-invariant failures.
- **[Nitpick] 2. Inconsistent optional handling of `partial.tasks`** — accumulation.ts:141 and resolveAssignmentDefinition.ts:39 apply dead `?? []` fallbacks while `buildTaskColumns` calls `partial.tasks.map(...)` directly (heatmapAdapter.ts:112).
- **[Nitpick] 3. Silent `?? 1` default for missing task weighting** — `averagingAnalyser.accumulation.ts:51`; only reachable via a producer/map-build bug.
- **[Nitpick] 4. Silent decode fallback in the range-filter dropdown** — `metricRangeFilterDropdown.tsx:59-61`; pre-existing.
- **[Nitpick] 5. Pipeline log-dedupe edge cases** — `heatmapsPipeline.ts:97-102`; documented consequences of the agreed L-4 decision; recorded for completeness.

### UI layer layout / design principles / accessibility

No Critical findings. Overall the change is highly conformant with `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md` (exact tooltip copy, `hover`+`focus` trigger, theme-aware box-shadow token, static border, state rank, backward-compatible filter key decoding).

- **[Improvement] 1. Focusable tooltip target relies on `aria-label` on a role-less `<span>`** — `taskHeatmapZeroWeightHeader.tsx:36`. `aria-label` is formally prohibited on elements with implicit `generic` role, so the spec-mandated combined accessible name may not be exposed by some AT. Recommend an explicit semantic (e.g. `role="note"`).
- **[Improvement] 2. `onHeaderCell` aria-label omits the zero-weight explanation and conflicts with the inner span's name** — `taskHeatmapZeroWeightHeader.tsx:42-44` vs `:36`. Suggest `${title} — ${ZERO_WEIGHT_EXPLANATION}` on the `th` (or drop the span-level duplicate).
- **[Improvement] 3. Excluded aria-label drops student/metric context** — `studentAveragesTableColumns.tsx:134-136`: excluded cells announce only `EXCLUDED_METRIC_ACCESSIBLE_LABEL`, unlike every other state. Suggest `${record.studentName}, ${meta.label}: ${EXCLUDED_METRIC_ACCESSIBLE_LABEL}`.
- **[Improvement] 4. `Excluded` visible text in a 48px column** — `studentAveragesTableColumns.tsx:126,143` renders "Excluded" in `APP_COL_WIDTH_METRIC_PILL = 48` (src/theme/spacing.ts:73); previously used for single-character pills. With fixed table layout the word will wrap or overflow. Worth verifying visually or widening this column.
- **[Improvement] 5. New `EXCLUDED_CELL_STYLE` hard-codes light-theme hexes** — `metricTone.ts:88` (`#f0f0f0` / `#595959`). In dark mode an excluded cell renders as a bright light-grey block; the border marker correctly uses the theme-aware token (index.css:168-179) but the cell style does not.
- **[Improvement] 6. "Include Excluded" checkbox shown in heatmap task filters where `excluded` can never occur** — `metricRangeFilterDropdown.tsx:137-146` is shared by `buildTaskMetricSubColumns` (taskHeatmapTableColumns.tsx:318-326), but task-level display metrics never resolve to `excluded`. Dead UI in the heatmap; consider making the toggle conditional on the surface.
- **[Improvement] 7. Preview header aria-label announces "score: null" for excluded** — `TaskPreviewCard.tsx:216` builds `${label} score: ${String(metricScore)}`; with the widened `metricScore` union this can produce "Completeness score: null". Latent only, but diff-introduced.
- **[Nitpick] 8. Single-metric group edge case** — `taskHeatmapZeroWeightHeader.tsx:63-68`: when `metricCount === 1`, index 0 returns only `-first`, so the right edge would be missing. Unreachable today (3 metric keys).
- **[Nitpick] 9. No explicit focus-visible styling on the tooltip target** — `taskHeatmapZeroWeightHeader.tsx:36`; the rest of the codebase styles `:focus-visible` deliberately (index.css:57-60).
- **[Nitpick] 10. Defensive `renderScore` catch-all mislabels excluded as "E"** — `taskHeatmapTableColumns.tsx:157-165`; unreachable at task level but inconsistent with `renderClassPageScore`.

#### Incidental (triage)

- **[Improvement] 1. Heatmap cell aria-labels use the task ID, not the task title** — `taskHeatmapTableColumns.tsx:346,356`; `taskTitle ?? taskId` would be more meaningful (header already uses it, TaskHeatmapTable.tsx:170).
- **[Improvement] 2. `aria-label` on a non-interactive `Flex` div in the preview header** — `TaskPreviewCard.tsx:212-217`; a labelled group or visually-hidden text would be reliable.
- **[Nitpick] 3. `aria-haspopup="dialog"` vs AntD Popover's actual role** — `taskHeatmapTableColumns.tsx:379`.
- **[Nitpick] 4. Hard-coded light-theme cell palettes (pre-existing precedent for diff finding #5)** — `metricTone.ts:79-85`, `:114-117`.
- **[Nitpick] 5. Inline spacing literals in the filter dropdown** — `metricRangeFilterDropdown.tsx:91` (`padding: 8, width: 240`), not token-based.
- **[Nitpick] 6. "No submissions yet" caption is not announced** — `TaskHeatmapTable.tsx:210-211` toggles a paragraph without `role="status"`/live-region semantics.

### Data shape / schema consistency

No Critical findings. The four-state/narrow-union split is applied consistently at every traced boundary, and every produced shape satisfies its schema invariants.

- **[Improvement] 1. `AverageContribution` is produced by two independent derivations with duplicated defaulting — divergence risk.** Analyser: `resolveEffectiveWeight` (averagingAnalyser.accumulation.ts:45-53) + `ensureAverageContribution` (averagingAnalyser.accumulatorRegistry.ts:116-124); adapter re-derives independently in `buildTaskColumns` (heatmapAdapter.ts:110-123). The Zod refine (dataAnalysis.zod.ts:168-170) catches internal contradiction but not divergence between the two producers for the same `taskKey` — the zero-weight header styling (taskHeatmapTableColumns.tsx:329-333) would then contradict the actual analyser contribution. Recommend a single shared effective-weight helper.
- **[Improvement] 2. `TaskDisplayMetricSchema` is not exported; the display type is re-declared by hand via `Extract`.** `dataAnalysis.zod.ts:137-141` defines the narrow union but only `MetricResult` is exported; `averagingAnalyser.taskProjection.ts:12` reconstructs it as `Extract<MetricResult, { state: 'computed' | 'notAttempted' | 'error' }>`. If a state is added to the schema without updating the `Extract`, TS and runtime validation diverge silently. Export `z.infer<typeof TaskDisplayMetricSchema>` and use it.
- **[Improvement] 3. `renderScore` maps the new `excluded` state to `'E'`, inconsistent with `MetricPill`'s "Excluded" label** — taskHeatmapTableColumns.tsx:157-165 vs MetricPill.tsx:112-114. Unreachable today, but an exhaustive switch (or shared formatter) would fail fast.
- **[Nitpick] 4. Two divergent "no-data N" placeholder shapes.** `NOT_ATTEMPTED_METRIC` (heatmapAdapter.ts:93-99) uses `totalDataPoints: 1` while the Class page's `noDataMetric()` (classPageAdapter.ts:107-115) uses `totalDataPoints: 0`; the semantic difference is invisible to consumers.
- **[Nitpick] 5. JSDoc vs actual aggregate `error` shape** — `dataAnalysis.zod.ts:78` states `error` means "no data points at all", but aggregate-level error results carry summed positive `totalWeight`/`totalDataPoints` (averagingAnalyser.composite.ts:108-118, rollupMetric.ts:172-179).
- **[Nitpick] 6. `ClassPageNoDataMetric` is structurally assignable to TS `MetricResult` despite Zod rejecting it** — `getStudentMetric` (classPageAdapter.zod.ts:66-69) can return a value typed `MetricResult` that fails `MetricResultSchema.safeParse` (proven at classPageAdapter.zod.spec.ts:223).
- **[Nitpick] 7. `NotAttemptedMetricSchema` permits `totalWeight: 0`**, yet rollup/composite logic keys "positive-weight raw N" off `totalWeight > 0` (rollupMetric.ts:125-130, composite.ts:127-129); schema-indistinguishable from a contributing task by convention only.

#### Incidental (triage)

- **[Improvement]** `getMetricStateRank` silently falls back to `?? 0` (metricStateRank.ts:47-50) — an unknown/future state would rank as `computed` instead of failing fast. Dead today.
- **[Nitpick]** `onHeaderCell` aria-label masks the inner span's richer label (taskHeatmapZeroWeightHeader.tsx:42-44 vs :36).
- **[Nitpick]** Submission items whose `taskId` is absent from the partial get implicit `effectiveWeight = assignmentWeighting × 1` (averagingAnalyser.accumulation.ts:51) and can never appear as a column (heatmapAdapter.ts:112).
- **[Nitpick]** `metricInRange`'s three boolean default parameters place defaults in a function signature rather than a module constructor (metricRangeFilter.tsx:43-45).
- **[Nitpick]** Dual import paths via `accumulation.ts` re-exports (averagingAnalyser.accumulation.ts:17-18).

### Test-coverage gaps

- **[Critical] 1. Merge-parity and collapsed-column accumulation tests deleted without replacement.** `heatmapAdapter.merged.spec.ts` lost three behaviour tests (`git show origin/main:…merged.spec.ts` lines 317, 356, 384: "collapses two instances … identity from the FIRST classFull occurrence", "feeds merged (accumulated) metrics into the single collapsed column", "identical cells … (merge parity)"). The replacement `heatmapAdapter.merged.contribution.spec.ts:109-123` covers first-occurrence identity and contribution metadata only; neither accumulated-metric feeding of the collapsed column nor the cell-identity merge-parity contract (still documented at `heatmapAdapter.merged.ts:124-131`) has any remaining test.
- **[Improvement] 2. `averagingAnalyser.metricResolution.ts` exports have no direct tests** — its namesake spec imports `computeOverallComposite`, `AveragingAnalyser` and fixtures (lines 2-18) but never `resolveDisplayMetric` or `resolveAggregateMetric`. Direct boundary cases (metricResolution.ts:51-60, 61-69) are unasserted in isolation.
- **[Improvement] 3. New fail-fast paths are untested**: `toTaskDisplayMetric` excluded-rejection throw (taskProjection.ts:13-14), `buildPerStudentTaskMetrics` missing-contribution throw (taskProjection.ts:34-37), `requireAverageContribution` throw (rows.ts:135-138), and the `logFrontendEvent('warn', …)` skip path for a missing definition partial (accumulation.ts:203-210). No spec references any of these.
- **[Improvement] 4. New user-visible interaction without Playwright coverage** — the "Include Excluded" checkbox (metricRangeFilterDropdown.tsx:137-146); mandatory rule at `frontend-testing.md:56`; the E2E band-filter journey (task-heatmap.spec.ts:146+) was not extended, and no e2e spec references it.
- **[Improvement] 5. `TaskPreviewCard` `excluded` branch is entirely untested** — new `buildMetricResult` case (TaskPreviewCard.tsx:113-121), placeholder copy (TaskPreviewCard.tsx:142-144), and widened props (TaskPreviewCard.tsx:43-44) have no spec coverage.
- **[Nitpick] 6. Dropdown state restore from a 5-part key is unasserted** — `metricRangeFilterDropdown.spec.tsx:102` reopens with the legacy 4-part key; no test pins `includeExcluded` hydration (metricRangeFilterDropdown.tsx:57-64).
- **[Nitpick] 7. `index.css` zero-weight visuals asserted only by class presence** — box-shadow rules (index.css:168-180) are checked via `toHaveClass` (TaskHeatmapTable.zeroWeight.spec.tsx:137-148) and class counts in E2E (task-heatmap.spec.ts:135-141); the actual visual is never asserted, so a broken/renamed CSS rule would pass all suites.
- **[Nitpick] 8. `accumulatorRegistry.ts` helpers have no direct unit tests** — `preRegisterTasks`, `getOrCreate*`, `ensureAverageContribution` are only exercised through analyser specs.

#### Incidental (triage)

- **Unreachable branch** (`rollupMetric.ts:299-301`): the `finalTotalWeight === 0` throw cannot fire; also counts as a permanently uncovered branch against the 85% branch threshold.
- **`assembleTaskPreviewData` can emit `excluded` into a display the schema forbids** (assembleTaskPreviewData.ts:49 passes `metricResult.state` straight through while `dataAnalysis.zod.ts:137-141` excludes `excluded` from task display); the `TaskPreviewCard` excluded branch is therefore currently unreachable via real data flow. If intentional defensiveness, the decision is untested and undocumented at the call site.
- **Fixture mutation via double casts** in `heatmapAdapter.merged.contribution.spec.ts:139-141,163-165` — diverges from the project's factory-override fixture convention (`frontend-testing.md:213-234`).

### Error-handling robustness

- **[Critical] C1. Silent default-to-full-weight fallback for submission items whose `taskId` is absent from the live partial — wrong averages with no signal.** `resolveEffectiveWeight` (averagingAnalyser.accumulation.ts:45-53) does `taskWeightByDefinitionKey.get(definitionKey)?.get(taskId) ?? 1`. The task-weight map is built only from the live partial's `tasks` list (accumulation.ts:137-143). If a submission item carries a stale/renamed `taskId` not present in the partial (there is no Zod cross-validation between `submission.items` keys and `partial.tasks` — `AveragingAnalyserInputSchema` at dataAnalysis.zod.ts:57-61 validates each side independently), the `?? 1` silently grants it full effective weight. `processAssignment` (accumulation.ts:91-122) then accumulates its scores into student/class/task averages, and `ensureAverageContribution` records `includedInAverage: true` (accumulation.ts:98-103) — a task that was deleted/re-keyed silently inflates averages while also surfacing as a phantom `perTask` row (accumulatorRegistry.ts:81-91). No log, no throw. An unknown taskId should be dropped with a warn log (like the missing-partial path at accumulation.ts:203-210) or thrown.
- **[Improvement] I1. `partial.assignmentWeighting ?? 1` in `buildTaskColumns` silently treats an unset weighting as full weight.** heatmapAdapter.ts:111-113 — a null (unconfigured) weighting is silently presented to users as `includedInAverage: true` (heatmapAdapter.ts:120) and drives the zero-weight tooltip header (taskHeatmapZeroWeightHeader.tsx:22-31) in the opposite direction to reality. For a feature whose purpose is making weight inclusion explicit, "missing weight ⇒ full weight" deserves either a documented decision or an excluded/zero-weight treatment. (The `task.taskWeighting ?? 1` half is dead code — taskPartial.zod.ts:18-21.)
- **[Improvement] I2. Missing `(student, taskKey)` cells are silently fabricated as `notAttempted`.** heatmapAdapter.ts:93-99 (`NOT_ATTEMPTED_METRIC`, fabricated `totalDataPoints: 1`) and 149-163. A taskKey mismatch between the warm-up partial and the analyser's metrics would render every cell as `N` with zero diagnostic output. At minimum log a warn when a column's taskKey has no metric for any student.
- **[Improvement] I3. `matchingPerTask ?? []` silently masks analyser/adapter divergence on the Class page.** classPageAdapter.ts:169-179, fed from `perTaskLookup.get(definitionKey)` at classPageAdapter.ts:336. A warn log distinguishing "no submissions" from "no analyser rows" would prevent silent misdiagnosis.
- **[Improvement] I4. No runtime guard that `score` is numeric when `metricState === 'computed'`.** TaskPreviewCard.tsx:85-94: `Number(null)` is `0` and `Number('N')` is `NaN`, which would silently render a bogus pill. Contract-hardening: tighten the union to a discriminated pairing or assert `typeof score === 'number'`.
- **[Improvement] I5. `perStudentTaskMetrics ?? []` silently no-ops on absent field.** heatmapAdapter.ts:182: an analyser result lacking it means the heatmap renders an all-`N` grid with no indication of a producer contract break. Consider a warn.
- **[Nitpick] N1. Non-null assertion hides a cross-function invariant in `computeOverallComposite`.** averagingAnalyser.composite.ts:87; a plain `throw new Error(...)` fallback would be more robust.
- **[Nitpick] N2. Dead defensive defaults on required fields.** accumulation.ts:141 `(partial.tasks ?? [])`; heatmapAdapter.ts:113 `task.taskWeighting ?? 1`.
- **[Nitpick] N3. Unknown-state fallbacks default to rank 0 / excluded.** metricStateRank.ts:60 (`?? 0`); metricRangeFilter.tsx:50-54 (`includeByState[metric.state]` returns falsy for a future state).
- **[Nitpick] N4. Unreachable `excluded` branch fabricates display counts.** TaskPreviewCard.tsx:113-121 synthesises an `excluded` MetricResult with `totalDataPoints: 1`; currently unreachable.
- **[Nitpick] N5. First-write-wins on contribution metadata.** averagingAnalyser.accumulatorRegistry.ts:123.

#### Incidental (triage)

- **[Improvement] Inc-1.** `resolveAssignmentDefinitionData` silently defaults a null assignment weighting to full weight (resolveAssignmentDefinition.ts:37-38) — the analyser's authoritative weighting source feeding the new zero-weight logic.
- **[Nitpick] Inc-2.** Scores that are neither `number` nor `'N'` are silently dropped (averagingAnalyser.criterionAccumulation.ts:29-49) without counter or log; pre-existing.
- **[Nitpick] Inc-3.** Obscure failure for null `studentName` in row sorting (averagingAnalyser.rows.ts:113-117): bare `TypeError`; message won't name the offending student.
- **[Nitpick] Inc-4.** `getStudentMetric` return type is narrower than its actual values (classPageAdapter.zod.ts:66-84); type-level misrepresentation.
- **[Nitpick] Inc-5.** Duplicated criterion-weighting defaults outside a constructor (classPageAdapter.ts:42-46 vs averagingAnalyser.ts:15).
- **Positive:** no broad catch/swallow or missing rethrows in the diffed entry points; `analyse`/`analyseClass` and both adapters fail fast with typed errors; boundary validation delegated to Zod as documented.

### Canonical contract/docs consistency

No Critical findings. All field names, types, optionality and constraints in `frontend-data-analysis-response.md` match `dataAnalysis.zod.ts:89-293`; INDEX.md correctly indexes the contract; ACTION_PLAN phases 1–5 + regression + docs fully cover SPEC decisions 1–14.

- **[Improvement] 1. Documented null-`studentName` throw is only incidentally enforced, and misses the single-row case.** `frontend-data-analysis-response.md:99` claims the row builder throws on a null name; the only failure path is the sort comparator's non-null assertion (averagingAnalyser.rows.ts:113-116) — a TypeError raised only when ≥2 rows are compared. Null names are reachable because accumulators are seeded from the nullable submission `studentName` (classDetailService.zod.ts:101; averagingAnalyser.accumulation.ts:89). Either add an explicit fail-fast or soften the doc claim.
- **[Improvement] 2. Submission items whose `taskId` is absent from the live partial silently contribute at full weight — undocumented.** The `?? 1` (averagingAnalyser.accumulation.ts:51) fires also for a _taskId_ missing from the map built solely from the partial's tasks (accumulation.ts:139-143); such items inflate averages at `assignmentWeighting × 1` while having no heatmap column (heatmapAdapter.ts:110-124). The contract documents only the weighting case (frontend-data-analysis-response.md:59-62); the task-absent-from-partial case is not described anywhere.
- **[Nitpick] 1. Negative-weight guarantee holds only on the analyser path, not the adapter path.** `buildTaskColumns` computes the same metadata without any Zod validation (heatmapAdapter.ts:118-121) while the contract types the descriptor field as `AverageContribution` (:364).
- **[Nitpick] 2. The no-data `notAttempted` placeholder is manufactured by analyser-scope code, not only "the Class-page adapter model"** (frontend-data-analysis-response.md:310-311 vs averagingAnalyser.composite.ts:139-147). Wording misplaces where the shape originates.
- **[Nitpick] 3. SPEC "currently" statements now read as present tense under an "implemented" status** (SPEC.md:97-98, :93-96). Consider past tense ("at planning time").
- **[Nitpick] 4. Analyser File Index omits `averagingAnalyser.filters.ts`** (frontend-data-analysis-response.md:457-468; data-analysis-architecture.md:141-152) though imported at averagingAnalyser.ts:3.
- **[Nitpick] 5. `MetricToneResolution.color` field JSDoc omits the `excluded` → `'default'` mapping** (metricTone.ts:37-41) though the resolver returns `'default'` (metricTone.ts:278-284).
- **[Nitpick] 6. Pedagogy colour list omits the Excluded neutral treatment** (data-analysis-scoring.md:121).

#### Incidental (triage)

- **[Nitpick]** `getStudentMetric` declares return type `MetricResult` but indexes metrics typed `ClassPageDisplayMetricSchema` (classPageAdapter.zod.ts:66-69); pre-existing type-level blur.
- **[Nitpick]** The heatmap missing-cell fallback `NOT_ATTEMPTED_METRIC` (heatmapAdapter.ts:93-99) is never mentioned in the contract's "raw `N`" discussion (frontend-data-analysis-response.md:328-331).
- **[Nitpick] (Planning-artefact drift, as permitted)** ACTION_PLAN execution status declares delivery complete (ACTION_PLAN.md:5-9), but per-section shared-helper plans still carry "status: Not implemented" markers (ACTION_PLAN.md:158-159, 162-163, 246, 252-253, 351-352, 449-450, 551-556). Cosmetic.

## Decisions

Recorded 2026-09-23 via interactive decision pass with the user. Cross-focus duplicates were grouped and decided once; each entry notes every focus that raised it.

### Critical findings

- **[Repo rule compliance / Critical] Scope creep — agent config model change (`opencode.jsonc:4`, `src/../.opencode/agents/implementation.md:4`, `.opencode/agents/testing-specialist.md:4`)** — Decision: **Fix now (Remove from PR)**. Approach: restore these three files to their `origin/main` versions before opening the PR; the model change is unrelated to the zero-weight feature scope (ACTION_PLAN.md:31-46). Rationale: keeps the PR scoped to issue #307 as the plan mandates.
- **[Error-handling / Critical] Unknown taskId silently defaulted to full weight (`averagingAnalyser.accumulation.ts:45-53`)** — Decision: **Fix now (Drop + warn)**. Approach: submission items whose `taskId` is absent from the live partial's task list must be dropped from accumulation and logged with a warn-level `logFrontendEvent` (mirroring the existing missing-partial warn at accumulation.ts:203-210) instead of silently contributing at `effectiveWeight = assignmentWeighting × 1`. The documented weight-defaulting semantics must be updated to describe only genuinely absent _weighting_ values (see docs decision below). Rationale: silent average inflation defeats the purpose of the zero-weight feature.
- **[Repo rule compliance / Critical] Task-level contracts permit aggregate-only `excluded` (`TaskPreviewCard.tsx:43-45,85-93,113-120`; `taskHeatmapTableColumns.tsx:69-76`; conflicts with `frontend-data-analysis-response.md:268-283`)** — Decision: **Fix now (Narrow types)**. Approach: type heatmap cells as the narrow `TaskDisplayMetric` union; make `TaskPreviewCard`'s flat `metricState`/`metricScore` props a discriminated pairing so `{computed, null}` cannot be type-legal and `Number(score)` coercion cannot silently produce 0; the unreachable `excluded` reassembly branch is then deleted by the type narrowing. Also covers UI Improvement 7 ("score: null" aria label — moot once invalid pairings are unrepresentable). Rationale: fail fast on invalid state/value pairs at the type level rather than rendering them.
- **[Test-coverage / Critical] Merge-parity and collapsed-column accumulation tests deleted without replacement (`heatmapAdapter.merged.spec.ts` lost three behaviour tests; contract still documented at `heatmapAdapter.merged.ts:124-131`)** — Decision: **Fix now (Restore tests)**. Approach: port the three deleted tests (collapsed-column identity from first `classFull` occurrence, accumulated-metric feeding of the collapsed column, cell merge parity) into `heatmapAdapter.merged.contribution.spec.ts`. Rationale: documented contract with zero remaining coverage.

### Improvements (fix now, agreed approach)

- **[KISS D-2 / de-slop I4 / data-shape 1] Duplicated effective-weight derivation (analyser vs adapter)** — Decision: **Fix now (Extract helper)**. Approach: one shared `computeEffectiveWeight(partial, taskId)` (or equivalent) consumed by both `averagingAnalyser.accumulation.ts` and `heatmapAdapter.buildTaskColumns`, so the zero-weight header can never contradict the analyser.
- **[De-slop C1 / KISS D-1] Unreachable `denominator === 0` fallback + lying non-null assertion (`averagingAnalyser.composite.ts:87`)** — Decision: **Fix now (Delete)**. Also moots performance nitpick 2 (double terminal resolution) and error N1 (`!` → throw discussion).
- **[De-slop D2] Unreachable `finalTotalWeight === 0` throw (`rollupMetric.ts:298-301`)** — Decision: **Fix now (Delete throw)**. The same diff made the state unreachable and removed the contract line; also removes a permanently uncovered branch against the 85% branch threshold (test-coverage incidental).
- **[De-slop D3 / error N2] Dead `?? 1` / `?? []` guards on schema-guaranteed values** — Decision: **Fix now (Drop dead guards)**. Approach: drop `task.taskWeighting ?? 1` (heatmapAdapter.ts:113) and `partial.tasks ?? []` (accumulation.ts:141, resolveAssignmentDefinition.ts:40). Keep the legitimate nullable `partial.assignmentWeighting ?? 1` (documented per the weight-semantics decision below).
- **[KISS D-6 / de-slop I3 / data-shape 2] Narrow display union; delete `toTaskDisplayMetric`** — Decision: **Fix now (Narrow + delete guard)**. Approach: export `z.infer<typeof TaskDisplayMetricSchema>` from `dataAnalysis.zod.ts`, type `resolveDisplayMetric`'s return with it, delete the always-throw-cold `toTaskDisplayMetric` wrapper and the hand-rolled `Extract` in `taskProjection.ts:12`; keep the guard only where the composite can genuinely be `excluded` (or narrow per `buildPerTaskRows` vs `buildPerStudentTaskMetrics` callers).
- **[KISS D-3 / de-slop IM3b / data-shape 3 / UI 10] Three divergent metric-to-display-text formatters** — Decision: **Fix now (Unify)**. Approach: single shared `formatMetricDisplayText` in `metricDisplay/` used by `MetricPill.formatDisplayText`, `renderClassPageScore`, and the heatmap cell renderer; eliminates the latent `'E'` mislabel for `excluded`.
- **[KISS D-4 / de-slop I1] Compat facade in `averagingAnalyser.accumulation.ts`** — Decision: **Fix now (Collapse)**. Approach: import from owning modules (`accumulatorRegistry`, `taskProjection`, `metricResolution`) directly in production and specs; drop the re-export block (accumulation.ts:13-18) and the `accumToMetric` pass-through (accumulation.ts:33-35).
- **[KISS D-5] Duplicated test fixtures across three new modules** — Decision: **Fix now (Consolidate)**. Approach: at minimum share the byte-identical `createTestQueryClient`; consolidate `ClassFull`, merged-result and definition-partial fixtures into a common home.
- **[Logging 2] Undocumented silent substitution at `averagingAnalyser.rows.ts:177`** — Decision: **Fix now (Document)**. Approach: document the spec rule in `buildPerTaskRows`' JSDoc with reference to the SPEC section explaining the excluded → displayOverall substitution.
- **[Logging 1 / error N5] First-write-wins on contribution metadata (`averagingAnalyser.accumulatorRegistry.ts:123`)** — Decision: **Fix now (Throw invariant)** — user chose an invariant throw (not the recommended warn) on a mismatching `effectiveWeight` for an already-registered taskKey, so a producer bug fails loudly.
- **[Error I1 + canonical docs 2] `assignmentWeighting ?? 1` full-weight semantics + undocumented task-absent case** — Decision: **Fix now (Document decision)**. Approach: keep `?? 1` semantics for now but document the decision in the contract doc and in code; the task-absent-from-partial case must be documented per the Critical drop+warn decision; revisit excluded treatment of missing weights later.
- **[Error I2, I3, I5] Three silent adapter fallbacks mask producer divergence** — Decision: **Fix now (Add all three warns)**. Approach: warn logs for (a) a column taskKey with no metric for any student (heatmapAdapter.ts:93-99, 149-163), (b) absent `perStudentTaskMetrics` (heatmapAdapter.ts:182), (c) Class-page `matchingPerTask` absent (classPageAdapter.ts:169-179) — distinguishing "no submissions" from "no analyser rows".
- **[Repo rule compliance / test-coverage 4] No Playwright coverage for the "Include Excluded" checkbox** — Decision: **Fix now (Add E2E test)**. Approach: extend `task-heatmap.spec.ts` (or a new e2e spec) to toggle the checkbox and verify aggregate filtering; satisfies `frontend-testing.md:56`.
- **[Test-coverage 2, 3, 5] Direct tests missing** — Decision: **Fix now (Add all)**. Approach: add direct tests for `resolveDisplayMetric`/`resolveAggregateMetric` boundary cases, the new fail-fast throws (`toTaskDisplayMetric`, `requireAverageContribution`, missing-contribution), the missing-partial warn path, and `TaskPreviewCard`'s excluded branch/`buildMetricResult`.
- **[UI 1 + 2] Zero-weight header a11y semantics** — Decision: **Fix now (Fix both)**. Approach: give the tooltip span an explicit semantic (e.g. `role="note"` or equivalent) and set the `th` aria-label to `${title} — ${ZERO_WEIGHT_EXPLANATION}` (or drop the span-level duplicate).
- **[UI 3] Excluded cell aria-label lacks student/metric context (`studentAveragesTableColumns.tsx:134-136`)** — Decision: **Fix now**. Approach: announce `${studentName}, ${label}: Excluded` like every other state.
- **[UI 4] "Excluded" text in 48px column (`studentAveragesTableColumns.tsx:126,143`)** — Decision: **Fix now (Verify then fix)**. Approach: verify visually; if it wraps/overflows, widen the column or shorten the pill text while keeping the accessible name.
- **[UI 5] `EXCLUDED_CELL_STYLE` hard-codes light-theme hexes (`metricTone.ts:88`)** — Decision: **Fix now (Theme-aware)**. Approach: use theme-aware tokens, consistent with the border marker at index.css:168-179.
- **[UI 6] "Include Excluded" checkbox is dead UI in heatmap task filters** — Decision: **Fix now (Conditional toggle)**. Approach: render the checkbox only on surfaces where `excluded` can occur (aggregate/student/class filters), not heatmap task filters (metricRangeFilterDropdown.tsx:137-146 via taskHeatmapTableColumns.tsx:318-326).
- **[De-slop I5 + KISS N-1, de-slop N1-N3] One-caller helper noise** — Decision: **Fix now (Inline)**. Approach: inline `isComputedMetricInRange`, `hasTerminalNotAttempted`, and `renderEmptyArtifactPlaceholder` (incident IM3, decided below); collapse the `excluded` chain in `resolveDisplayMetric`'s sibling logic; revisit `assertValidRange` under a single convention.
- **[De-slop I5b] Dead `Math.max(0, …)` clamp (`rollupMetric.ts:308-310`)** — Decision: **Fix now**. Approach: `Math.max(finalTotalDataPoints, accumulator.observedDataPoints)` with a wording note.
- **[KISS N-2] `applyFilter` four sequential booleans + copy-paste checkbox blocks** — Decision: **Fix now (Refactor)**. Approach: options-object signature and derived checkbox state in `metricRangeFilterDropdown.tsx:66-83,117-146`.
- **[Canonical docs 1-2 + nitpicks 1-6] Docs cross-reference gaps** — Decision: **Fix now (Update all docs)**. Approach: update `frontend-data-analysis-response.md` (null-name claim softened or enforced with an explicit fail-fast that also covers the single-row case; task-absent-from-partial behaviour per the Critical decision; negative-weight adapter-path caveat; add `NOT_ATTEMPTED_METRIC` sentence per docs incidental 2; file index), `data-analysis-architecture.md` (file index), SPEC.md tense, `data-analysis-scoring.md` colour list, `metricTone.ts` colour JSDoc, and the `frontend-shared-helpers-and-abstraction-standards.md` numbering (9.19 vs 9.18.1) and stale line counts (metricTone.ts, MetricPill.tsx).
- **[Logging incidental 1] Bare ZodError at `dataAnalysisService.ts:62`** — Decision: **Fix now (Improve diagnostics)**. Approach: surface structured `error.issues` at the parse boundary per the policy's `zodIssues` pattern.
- **[De-slop incidental IM1] `classAccum` write-only dead accumulation** — Decision: **Fix now** — user chose to simplify in this PR rather than ticket. Approach: behaviour-preserving simplification (fallback rolls a fresh accumulator; drop the dead write path), verified with a test-equivalence check.
- **[Performance incidentals 1-2] Linear cell scan + eager popover assembly (pre-existing patterns)** — Decision: **Fix now (Fix both)**. Approach: Map-based `taskKey → metric` lookup built once in `groupMetricsByStudent` (O(R·T²) → O(R·T)) and lazy popover content (open-state gate or memoisation) at taskHeatmapTableColumns.tsx:359-371.
- **[KISS incidentals I-2, I-3] WEIGHTS duplication + Forename/Surname column duplication** — Decision: **Fix now (Share builder)**. Approach: import `DEFAULT_CRITERION_WEIGHTINGS` instead of re-declaring `WEIGHTS`; add a shared split-name column builder beside `splitStudentName` used by both tables.

### Nitpicks (fix now, agreed approach)

- **[KISS N-3/N-4, de-slop N4/N5, data-shape incidental, error N3] metricStateRank constants, `?? 0` fallback, spec re-typing** — Decision: **Fix now (Fix all three)**: import the four constants in `TaskHeatmapTable.zeroWeight.spec.tsx:9-13` instead of re-typing them; inline the rank literals and remove the four `FIRST..FOURTH_METRIC_STATE_RANK` constants; throw on unknown state in `getMetricStateRank` (metricStateRank.ts:60) instead of silently defaulting to rank 0.
- **[KISS N-2] `applyFilter` positional booleans** — Decision: **Fix now (Refactor to options object)**.
- **[Data-shape nitpicks 4-7] Schema precision** — Decision: **Fix now (Fix all)**: align/document the two no-data N placeholders (`NOT_ATTEMPTED_METRIC` vs `noDataMetric()`), fix the aggregate `error` JSDoc claim (dataAnalysis.zod.ts:78), document the `NotAttemptedMetricSchema` `totalWeight: 0` zero-weight convention, and correct `getStudentMetric`'s return annotation (classPageAdapter.zod.ts:66-69).
- **[Test-coverage nitpicks 6-8] Minor test gaps** — Decision: **Fix now (Add all)**: 5-part key hydration test for `includeExcluded`, a box-shadow/visual assertion for the zero-weight classes (so a broken/renamed CSS rule fails), and direct `accumulatorRegistry` unit tests.
- **[UI nitpicks 8-9 + incidentals 1, 2, 6] Remaining UI polish** — Decision: **Fix now (Fix listed items)**: single-metric `-first`/`-last` edge guard (taskHeatmapZeroWeightHeader.tsx:63-68), explicit `:focus-visible` styling on the tooltip target, task-title-based cell aria-labels (taskHeatmapTableColumns.tsx:346,356), visually-hidden text or labelled group for the preview header (TaskPreviewCard.tsx:212-217), and `role="status"`/live-region semantics for the no-submissions caption (TaskHeatmapTable.tsx:210-211).
- **[KISS I-4, I-5 + UI incidentals 3, 5] Small UI/filter items** — Decision: **Fix now**: correct or remove `aria-haspopup="dialog"` (taskHeatmapTableColumns.tsx:379), single aria-label template helper per metric sub-column, shared default-state factory for the legacy `activeRange` re-encoding (metricRangeFilter.tsx:130-138), and `metricInRange` boolean defaults replaced with a named constant/policy.
- **[KISS N-4, N-5, de-slop N6, N7, I-1] Remaining cheap nitpicks** — Decision: **Fix now (Fix cheap ones)**: deduplicate the fail-fast contribution lookup (rows.ts:130-139 vs taskProjection.ts:34-37), keyed record for criterion weights (composite.ts:123-125), remove unused e2e barrel re-exports (task-heatmap-end-to-end-helpers.ts:13-18), import the disabled-reason copy in `heatmapBuilderSurfaceTestHelpers.ts:21`, and introduce a single `buildTaskKey(definitionKey, taskId)` helper for the ad-hoc template used in five modules (also covers the performance nitpick about duplicate taskKey string construction).
- **[Error incidentals Inc-2, Inc-3 + logging incidentals 4, 5] Last stragglers** — Decision: **Fix three, note one**. Fix: (a) the null-`studentName` failure path names the offending student (combined with the doc-claim fix); (b) count/log silently-dropped non-number/non-`N` scores (criterionAccumulation.ts:29-49); (c) share the decode-fallback default handling for malformed filter keys (metricRangeFilterDropdown.tsx:59-61). Note only: the pipeline log-dedupe edge cases (heatmapsPipeline.ts:97-102) are documented consequences of an agreed decision — no action.
- **[De-slop incidental IM3] `renderEmptyArtifactPlaceholder` one-caller extraction (TaskPreviewCard.tsx:135-147)** — Decision: **Fix now (Inline)**.

### Deferred (post-merge cleanup — GitHub issue to be created)

- **TaskPreviewCard `MetricResult` flatten-then-reassemble fabricator** (~40 lines, TaskPreviewCard.tsx:81-123 + assembleTaskPreviewData.ts:60-63; SPEC-signed-off but the fabricator could be deleted by passing a real `MetricResult` prop through).
- **Pre-diff history narration in JSDoc headers** (rollupMetric.ts:196-212, averagingAnalyser.ts:87-91, rows.ts:18-21, composite.ts:21-27).
- **`getStudentMetric` return-type blur** (classPageAdapter.zod.ts:66-69) — recorded here as well as fixed per the schema-precision decision; the GitHub issue covers residual type-model cleanup.
- **`splitStudentName` called twice per row** (TaskHeatmapTable.tsx:145, 158) and other trivial per-cell work (onCell/render duplication at studentAveragesTableColumns.tsx:130-144, `buildAdaptiveTierGroups` repeated scans at taskHeatmapTableColumns.tsx:442-446).
- Decision: **Create one GitHub tracking issue** listing these items after this review is finalised. Created: https://github.com/h-arnold/AssessmentBot/issues/313.

### Decision clarifications (implementation choices settled by precedent, 2026-09-23 second pass)

Each "Fix now" decision above can admit more than one implementation. Where a repo rule or precedent settles the choice, it is recorded here so an implementing agent need not re-ask:

1. **`computeEffectiveWeight` home** → `services/assignmentDefinition/assignmentDefinitionUtilities.ts`. Precedent: `heatmapAdapter.ts:12` already imports `getAssignmentDefinitionPartial` from that module; the weighting contract is partials-domain.
2. **`buildTaskKey` home** → new standalone flat module `services/dataAnalysis/taskKey.ts`. Precedent: `services/dataAnalysis/compareStudentNames.ts` standalone-helper pattern; 5 call sites satisfy the ≥2-callsite extraction rule.
3. **Fixture consolidation home** → extend `src/test/dataAnalysis/` (shared-helpers standards §3.4; frontend-testing.md:150-154 "prefer extending an existing helper"). Share `createTestQueryClient`, `ClassFull`, partial and merged-result builders there.
4. **Zero-weight header a11y** → keep the span's combined accessible name (mandated by `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md:117`) and set the `th` aria-label to `${title} — ${ZERO_WEIGHT_EXPLANATION}`; do not add `role="note"` — the spec mandates a native focusable header-label element.
5. **Excluded cell styling** → move `EXCLUDED_CELL_STYLE` to `index.css` using theme tokens, mirroring the zero-weight border marker (index.css:168-179).
6. **Preview-header and no-submissions a11y** → repo-established dynamic-region pattern `role="status" aria-live="polite"` (HeatmapBuilderSurface.tsx:162/197, ClassPageContent.tsx:186); live semantics suit the pinned preview, which updates while pinned.
7. **Adapter diagnostic warns** → `logFrontendEvent('warn', …)` per the missing-partial pattern (accumulation.ts:203-210), emitted once per gap (per column / per absent field / per definition).
8. **No-data placeholder divergence** → document both shapes as intentional (heatmap placeholder = schema-required `NotAttemptedMetric`; Class-page placeholder = documented `ClassPageNoDataMetric` exception); do not unify values.
9. **`metricInRange` boolean default params** → replaced by an explicit filter-flags object, consistent with the `applyFilter` options-object refactor.
10. **Null `studentName`** → explicit fail-fast in the row builder naming the `studentId`, covering the single-row case and satisfying the documented guarantee.
11. **ZodError diagnostics** → structured `zodIssues` parse pattern per the logging/error policy at `dataAnalysisService.ts:62`.
12. **48px column** → verify visually; if it overflows, widen the class-page metric column (`APP_COL_WIDTH_METRIC_PILL` has a single consumer) rather than shortening the spec'd "Excluded" copy.
13. **Disabled-reason copy** → move to `pageContent` (precedent: HeatmapBuilderSurface.tsx:37 sources copy from `pageContent`).
14. **`getMetricStateRank`** → throw on unknown state; inline rank literals; spec imports the constants from `taskHeatmapZeroWeightHeader`.
15. **`getStudentMetric`** → fix the return annotation now; deeper type-model cleanup stays deferred to issue #313.
16. **`classAccum` simplification** → behaviour-preserving: fallback rolls a fresh `createDataPointAccumulator()`, drop the dead write path; verify test-equivalence.
17. **Conditional "Include Excluded"** → dropdown builder gains a prop (shown by default); heatmap task filters pass false; aggregate/student/class surfaces keep it.
18. **`getStudentMetric`/type blur, JSDoc history, fabricator, trivial per-cell work** → remain deferred to issue #313 (unchanged).

### Decision clarifications (user-settled, no repo precedent available)

- **`aria-haspopup="dialog"` (`taskHeatmapTableColumns.tsx:379`)** — Decision: **Remove the attribute** (and update the `taskHeatmapTableTestHelpers.ts` seam comment that references it). Rationale: AntD Popover exposes no dialog role, the hint misleads, and it is the codebase's only `aria-haspopup`; the test seam relies on the aria-label, not the attribute.
- **Dropped undefined scores (`averagingAnalyser.criterionAccumulation.ts:29-49`)** — Decision: **Warn-level log per dropped score**. Rationale: user chose to treat undefined scores as producer-bug signal rather than legitimate missing data; emit a single warn per dropped item with stable context, per the logging policy's warn discipline.
- **Shared Forename/Surname column builder location** — Decision: **New feature-shared module `src/frontend/src/features/shared/studentNameTableColumns.tsx`**, imported by both `studentAveragesTableColumns.tsx` and `TaskHeatmapTable.tsx`. Rationale: `splitStudentName.ts` must stay pure (no antd) per its standing rule; `features/shared/` is a new cross-feature home for antd-coupled shared column builders, documented in the shared-helpers standards when implemented.

### Explicitly wontfix / no action

- **Pipeline log-dedupe edge cases** (heatmapsPipeline.ts:97-102) — documented consequence of the agreed L-4 no-double-logging decision.
- **Logging incidental 2** (inconsistent `partial.tasks ?? []` handling) — subsumed by the dead-guards decision.
- **Logging incidental 3** (silent `?? 1` for a missing task weighting in the map) — subsumed by the weight-semantics documentation decision.
- **UI incidental 5 (inline spacing literals in the dropdown)** and **logging incidental 5's related notes** — cosmetic, no action this PR beyond the shared default-state factory item.
- **TaskHeatmapTable `.tsx` exports only constants** (KISS I-6) — no explicit decision recorded; left as-is unless touched during the facade/`buildTaskKey` work.
