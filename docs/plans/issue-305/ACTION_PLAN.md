# Feature Delivery Plan (TDD-First) — Attempt-Baseline Analysis Mode (issue #305)

> **Status (in progress):** Implementation underway on branch `feat/issue-305-attempt-baseline-mode`. Sections 1–6 complete (`b2199cfe`; `f1709904`; `c397b481`; `05132a38`; `33cb92c8`; `34412807`; `0f8d8d3f`; `dfc4729e`, gates clean); Section 7 complete and pushed (`cf935b49`, gate run `2026-11-10T14:24Z` clean). Current phase: Documentation and rollout notes. Baseline refreshed 2026-11-09 on the merged tree (`origin/main` · `4635f18b`): `backend-lint-check` fails only on four pre-existing `max-lines` warnings in untouched backend test files — accepted as pre-existing technical debt for this frontend-only plan; report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/baseline/baseline.txt`.

## Read-First Context

Before writing or executing this plan:

1. Read `@docs/plans/issue-305/SPEC.md` — product behaviour, contracts, decisions 1–13 (incl. 6a), display rules, fixture strategy, and scope boundaries.
2. Read `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md` — header-slot composition, control states, heatmap column marking, accessibility rules.
3. Read `@docs/developer/data-shapes/frontend-data-analysis-response.md` — the "Planned contract changes (not implemented)" block (items 1–8) is the target contract this plan implements and reconciles.
4. Read `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.27 — the planned-only helper register (entries 1–5).

## Scope and assumptions

### Scope

- Frontend-only: `src/frontend/**` — analysis schemas, averaging analyser, heatmap adapters, Class-page hook/features, metric-display helpers, tests, and canonical docs.
- Enabling contracts first (Section 1 carries the full required-field blast radius so later sections are never red on earlier work), then analyser behaviour, projection, display helpers, then the Class-page control and surfaces (split), then regression/docs.

### Out of scope

- Any backend, transport, or persistence change (SPEC §Scope).
- The Heatmaps page, Heatmap builder surface, and any other surface's aggregates (SPEC decisions 1, 9).
- AssignmentSummarySchema and task-summary behaviour (SPEC decision 9).
- Configurable pool fraction/size/minimums, persisted mode preference, baseline-exploration UI (SPEC §Defer from v1).
- Cell-level heatmap marking (layout spec: column-level only in v1).

### Assumptions

1. The planned data-shape entries (items 1–8) and helper entries (§9.27.1–5) already recorded in the canonical docs are the authoritative target; each section updates their status as delivered.
2. Lint constraints are hard: `react-hooks/refs` and `react-hooks/set-state-in-effect` are errors — the availability retention must use the previous-render state pattern (SPEC decision 6; verified lint-clean).
3. The Segmented disabled-tooltip treatment starts from the recorded no-wrapper decision; the live check runs as part of §5a's red phase with the pinned wrapper fallback.
4. Canonical synthetic fixtures support scoring at pool min 2, pool-boundary tie-break ordering, echo/flags, E-condition attempts, and eligibility thresholds; every other behavioural case uses local hand-built fixtures per SPEC's fixture paragraph (no generator changes in v1).
5. Between Sections 1 and 4 the whole test tree stays green — no section leaves red suites behind (the blast-radius sweep exits with Section 1).

---

## Global constraints and quality gates

### Engineering constraints

- No un-instructed defaults: `analysisMode` is required at all six non-test input construction sites and in test fixtures via the shared builder fix point; `attemptBaseline` narrowing is fail-fast; `buildTaskColumns`' second parameter is required (explicit `null` for absolute); `TaskHeatmapColumn.includedInAttemptBaseline` is required.
- Absolute-mode output stays byte-identical to current behaviour except the `appliedAnalysisMode: 'absolute'` echo and `includedInAttemptBaseline: true` flags (SPEC decisions 7 and 12).
- Frontend files crossing 550 lines must decompose in-change (`docs/developer/frontend/frontend-architecture.md`; `src/frontend/AGENTS.md` §2 Non-negotiables): watch `useClassPageData.ts` (456) and `ClassPageContent.tsx` (449); §5 records projected and measured counts.
- All spacing via tokens (`APP_GAP_SM`, `APP_GAP_MD`, existing Card defaults); no new layout patterns.
- E2E routing: `Playwright` owns all browser-test work (root `AGENTS.md` §5); no toggle ships without browser coverage.

### TDD workflow (mandatory per section)

Red → Green → Refactor per section; run the section's verification commands before moving on; every section ends green.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend` / `npm run lint:frontend:check`
- Frontend unit tests (Vitest root is `src/frontend`; filters are **frontend-root-relative**): `npm run test:frontend -- <path-relative-to-src/frontend>` (e.g. `src/services/dataAnalysis`), per `docs/developer/frontend/frontend-testing.md`
- Synthetic-analysis project (root, **not** under `test:frontend`): `npm run test:synthetic -- <target>`
- Frontend E2E: `npm run test:frontend:e2e -- e2e-tests/<spec>.spec.ts`
- Full local gate before handoff: `npm run run-all-checks`

---

## Section 1 — Schema contracts + required-field contract-enabling sweep

### Outcome (compacted)

Delivered the attempt-baseline schema contracts and the full required-field sweep, leaving Sections 2–5 a green tree:

- `dataAnalysis.zod.ts` exports `AnalysisModeSchema`/`AnalysisMode` (`'absolute' | 'topDecileBaseline'`); the strict `AnalysisFilterSchema` requires `analysisMode`; `AveragingResultSchema` requires the `appliedAnalysisMode` echo and the optional strict `attemptBaseline` block; `PerTaskRowSchema` requires `includedInAttemptBaseline: boolean`. Nothing on `PerStudentTaskMetric` or cells; no `baselineTaskCount` (SPEC decision 7 and data-shape item 3 record two fields only).
- The test-builder fix point (`buildInput`/`buildSingleStudentInput`) gained `analysisMode: 'absolute'` once; every plan-listed literal site plus the additional sites recorded in the notes below was pinned `'absolute'`.
- The analyser emits the echo and always-true row flags as literals and no `attemptBaseline` block yet (Section 2 owns that).
- Data-shape items 1–4 are marked implemented and item 5 partial (Section 4 reconciles); the §9.27 register gained new entries 6–8 recording this section's delivered helpers (`AnalysisModeSchema`/`AnalysisMode`, the deliberate call-site medium-corpus decision, and the `buildInput`/`buildSingleStudentInput` extend), each marked `Implemented` for Section 1; entries 1–5 remain `Not implemented` and flip with Sections 2–5a.

Section checks passed: `npm run typecheck:all` exit 0; `npm run test:frontend -- src` 318 files / 3070 passed; `npm run test:frontend -- src/services/dataAnalysis` 450/450; `npm run test:synthetic -- syntheticApiRoundTripBridge` 14/14; `npm run lint:frontend:check` 0 errors / 17 warnings (the true pre-plan baseline — see the retained correction below); Prettier clean on all 42 changed files; review PASS with zero in-scope findings. The full-gate `run-all-checks` checkpoint is still to run.

### Retained for later sections

- **Contract shapes (Sections 2–5 consumers):**

  ```ts
  // dataAnalysis.zod.ts
  export const AnalysisModeSchema = z.enum(['absolute', 'topDecileBaseline']);
  export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

  AnalysisFilterSchema = z.strictObject({
    classIds: z.array(z.string().min(1)).min(1),
    analysisMode: AnalysisModeSchema, // required, no default
    // dateRange/topicKeys/assignmentDefinitionKeys/criterionWeightings unchanged
  });

  AveragingResultSchema = z.strictObject({
    // ...existing fields...
    appliedAnalysisMode: AnalysisModeSchema, // required echo
    attemptBaseline: AttemptBaselineSchema.optional(), // absolute mode omits
  });

  PerTaskRowSchema = z.strictObject({
    // ...existing fields...
    includedInAttemptBaseline: z.boolean(), // required on every task row
  });
  // PerStudentTaskMetricSchema: no flag; cells stay absolute
  ```

  Module-private `AttemptBaselineSchema` is `poolStudentIds: z.array(z.string()).min(BASELINE_POOL_MINIMUM)` plus `baselineTaskKeys: z.array(z.string().min(1)).min(1)`, with `BASELINE_POOL_MINIMUM = 2` kept so the schema bound and Section 2's derivation minimum agree by name. The narrowing rule is schema-tested here and consumer-enforced from Section 2: an attempt-baseline result without `attemptBaseline` is an invariant violation (fail fast with a throw); an `attemptBaseline?.baselineTaskKeys ?? []` fallback is forbidden. `perStudentTaskMetrics` contents stay mode-independent.

- **Analyser handoff to Section 2:** the analyser does **not** emit `attemptBaseline` yet — `averagingAnalyser.ts` emits `appliedAnalysisMode: 'absolute'` and `buildPerTaskRows` sets `includedInAttemptBaseline: true` as literals (truthful while only absolute behaviour exists). Section 2 derives the pool, intersection and filtering and emits the block plus per-row flags from the input mode; `perStudentTaskMetrics` stays byte-identical across modes.
- **Production pins (keep; the §5a site is the one later replaced):** `heatmapsPipeline.ts:128`, `useHeatmapSelectionSummary.ts:46`, `TaskHeatmapPage.tsx:136`, `assignmentSummaryAnalyser.ts:140` (item-5 internal delegation; Section 4 reconciles), `abClassMetadataService.ts:53`. Additional sweep sites and the §5a interim literal key (`useClassPageData.ts:135` — the plan's original line pointer is stale; Section 5a's constraint still cites :133) are recorded in the Implementation notes below.
- **Lint baseline:** 17 warnings is the true pre-plan `lint:frontend:check` baseline (it supersedes the 19 previously recorded in the plan header); treat 0 errors / 17 warnings as the no-regression floor in later sections' lint runs.
- **Medium-corpus loading (used by Sections 2, 3 and 5b):** deliberately stays at call sites via the `?raw` pattern — no shared loader is created (recorded decision in `src/frontend/src/test/shared/canonicalFixturePrimitives.ts`'s `@remarks`). The `@synthetic/*` alias resolves from the Vitest app project (`vite.config.ts` `resolve.alias` plus `tsconfig.app.json` paths; exercised by `averagingAnalyser.metricResolution.spec.ts:6–8`), and `dataAnalysis.mediumRoundTrip.spec.ts` is the delivered named host for the `medium` echo/flag round-trip.
- **Outstanding follow-ups:** those in the Implementation notes below, plus the pending full-gate `run-all-checks` checkpoint noted above.

### Implementation notes / deviations / follow-up

- **§5a interim literal key (confirmed):** `src/frontend/src/features/classPage/useClassPageData.ts:135` — `filter: { classIds: [classId], analysisMode: 'absolute' }` inside `runAnalyserStep`; Section 5a replaces the literal with the hook parameter.
- **Additional literal sites discovered during the sweep (beyond Section 1 step 2's list):** `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts:120/:125` (caught by the pre-flight recon), and `src/frontend/src/test/dataAnalysis/legacyAssessmentParityOracle.ts:79` (caught by the post-change grep sweep; `AveragingAnalyserInputSchema.parse` input — invisible to `tsc` because `parse` accepts `unknown`). All pinned `'absolute'`.
- **Result-echo notes:** every typed `AveragingResult` fixture in step 6's list gained `appliedAnalysisMode: 'absolute'` as listed; `heatmapAdapter.merged.contribution.spec.ts`'s ten `tsc` sites all flow from its one shared `satisfies AveragingResult` fixture (single fix point). Removing the red-phase `as unknown as` cast in `buildCellPreviewLookup.parity.spec.ts` surfaced a genuinely missing `averageContribution` on the merged fixture's two metric entries (added — fixture completion, no assertion touched). `dataAnalysisService.spec.ts`'s three invalid-filter literals needed `as const` on `'absolute'` (no contextual type on the spread-built object).
- **`baselineTaskCount` not added:** the tasking mentioned a `baselineTaskCount` int-min-1 field, but SPEC decision 7, SPEC's "Recommended data shapes" block, data-shape item 3 and the red-phase tests record only `poolStudentIds` (min 2) and `baselineTaskKeys` (min 1, key min 1); the block is implemented exactly as recorded.
- **Analyser echo pinned literal:** `averagingAnalyser.ts` emits `appliedAnalysisMode: 'absolute'` (and `buildPerTaskRows` sets `includedInAttemptBaseline: true`) as literals — Section 1 implements no baseline behaviour, so the literal is the truthful "mode actually applied"; Section 2 derives both from the input mode.
- **Remaining `as unknown as` casts (all pre-existing, not red-phase bridges):** `buildCellPreviewLookup.parity.spec.ts` merged `ClassFull`/`AssignmentFull` fixtures (missing-metadata fixture shapes, unrelated to the mode contract) and the pre-existing dynamic-import cast in `dataAnalysis.zod.spec.ts:29` (committed before this plan; not a red-phase bridge). No "Temporary red-phase bridge" comment remains.
- **Docs sync outcome:** §9.27 register reconciliation applied in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (new entries 6–8 for this section's helpers, heading retitled "helper decisions", entries 1–5 left `Not implemented`); 2-line JSDoc-only addition on `AnalysisFilterSchema` in `dataAnalysis.zod.ts`; data-shape doc edits verified correct (`frontend-data-analysis-response.md` items 1–4 implemented / 5 partial, no residual markers; `assessment.md` and `student-submission.md` inbound anchors retargeted correctly). Scoped re-validation after the JSDoc edit: Prettier clean, frontend tsc exit 0, `lint:frontend:check` 0 errors / 17 warnings. Reported out-of-scope drift: `docs/developer/data-shapes/assessment.md` ~:517 carries a stale "preview error states remain unimplemented" claim contradicting the canonical doc — logged as a nitpick for the preview workstream's docs pass, not fixed here. Playwright E2E suite not run (no user-visible change in this section).
- **Section regression gate (run 1, 2026-11-09T19:23Z, pre-rework): FAILING.** Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/runs/2026-11-09T19-23-10.126Z/comparison.txt`. `checksFailing: 2` (backend-lint-check = accepted pre-existing debt, unchanged); lint deltas: 4 "fixes" and 2 "regressions" from max-lines fingerprint shifts. Dispositions: `classes-page-end-to-end-helpers.ts` (657→635) and the `classes-page.spec.ts`/`settings-backend.spec.ts`/ legacy deltas are attributable to the branch merge of `origin/main` (`4635f18b`, landing #347 et al.) that occurred after the 2026-11-05 baseline — recorded as merge-window baseline staleness, not section regressions (the Nov 5 baseline predates merge drift). `averagingAnalyser.rows.spec.ts` (637→638) IS attributable to this section's sweep and violated the frontend non-negotiable "decompose any frontend file over 550 lines in scope for your change, in the same change"; rework: decomposed (refactor review PASS, test parity 450/450 across 52 hosts, full suite 3070/3070 across 320 files, tsc exit 0) and the baseline refreshed on the merged tree (baseline dir removed; re-baselined 2026-11-09T20:11Z).
- **Section regression gate (run 2, 2026-11-09T20:24Z, post-rework — section-completion gate, supersedes run 1): PASSED.** Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/runs/2026-11-09T20-24-59.799Z/comparison.json` (fresh baseline manifest created 2026-11-09T20:11Z on the merged tree). Totals: `regressionsCount: 0`, `newFailuresCount: 0`, `fixesCount: 0`; `checksPassing: 7`, `checksFailing: 1` — the only failing check is `backend-lint-check` (4 pre-existing accepted `max-lines` warnings, present in the fresh baseline with zero deltas). Frontend lint warnings now 16 (the rows-spec decomposition removed one); refactor-review record: `.opencode/scratchpad/review-issue305-section1-refactor.md`.
- **Commit record:** `b2199cfe` ("feat(issue-305): add analysis-mode schema contracts and required-field sweep" — all 46 Section 1 files: schema contract, analyser emission, literal sweep, rows-spec decomposition, docs updates, compacted plan). Branch `feat/issue-305-attempt-baseline-mode`; `git push origin` succeeded (c5d26db8..b2199cfe fast-forward, which also published the user's merge commit `4635f18b` of origin/main). Pre-commit hooks passed (Prettier on staged files, staged lint, typecheck:all); no hook bypasses used. Deferred-findings log: `.opencode/scratchpad/feat-issue-305-attempt-baseline-mode-deferred-findings.md` (2 nitpick rows, both disregarded; no Critical/Material findings).

---

## Section 2 — Baseline selection + averaging analyser: pool, intersection, filtering, excluded resolution

### Outcome (compacted)

Delivered `attemptBaselineSelection.ts` and the averaging-analyser baseline wiring: post-accumulation pool derivation (attempt predicate, candidate ranking with `studentId` tie-break, intersection baseline, eligibility), baseline-scoped aggregation over all four metrics, the analyser now deriving the `appliedAnalysisMode` echo, `attemptBaseline` block and per-row flags from the input mode (replacing Section 1's absolute literals), and `PerTaskRow.includedInAttemptBaseline` as membership-only; `collectClassAccumulators` was extracted in `averagingAnalyser.ts` (behaviour-neutral, complexity lint fix).

Section checks passed: dataAnalysis suite 489/489 (55 files); full frontend 3109/3109 (323 files; +3/+39 exactly the red deltas); `test:synthetic -- syntheticApiRoundTripBridge` 14/14; `typecheck:all` exit 0; `lint:frontend:check` 0 errors / 16 warnings; Prettier clean; red review PASS after 3 findings (1 false-red Critical→Material, 1 fixture/comment mismatch, 1 comment typo — all fixed and VERIFIED FIXED in re-reviews); green review PASS with zero in-scope findings and the full-repo coverage gate passed (`test:frontend:coverage` 323 files/3109, all thresholds above the 85% gate).

### Retained for later sections

- **Module and export surface** (`src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`): `isAttemptMetric(metric)` — an attempt is any criterion `computed` (all-`N`, `E` and absent items are not attempts; weighting plays no part); `collectRosterAttemptCandidates(perStudentTaskMetrics, rosterStudentIds)` — roster-scoped, ascending by `studentId`; `isAttemptBaselineEligible(rosterStudentCount, candidateStudentCount)` — roster ≥ 3 and candidates ≥ 2; `deriveAttemptBaseline(input)` → `{ poolStudentIds, baselineTaskKeys }`, which also fails fast on an ineligible class. Module-private constants: `BASELINE_POOL_FRACTION = 0.1`, `BASELINE_POOL_MINIMUM = 2`, `BASELINE_ROSTER_MINIMUM = 3`. §5a's availability resolver composes the same predicate and eligibility helper with the retained result's `perStudentTaskMetrics` and the `classFull` roster.
- **Two-site empty-intersection throw (no silent fallback anywhere):** derivation-level in `attemptBaselineSelection.ts`, only when the 0.1-fraction bound truncates the pool to the structural minimum while unused candidates remain — `deriveAttemptBaseline: class '<classId>' derived an empty attempt baseline: the <poolSize> pooled students attempted no task key in common`; analyser-level in `averagingAnalyser.ts` `deriveClassBaseline`, every other empty intersection, thrown before any result (protecting the schema's `baselineTaskKeys.min(1)`) — `AveragingAnalyser: class '<classId>' derived an empty attempt baseline: the <poolSize> pooled students attempted no task key in common`. The `'c_001'`/`2` literals in the delivered test pins are test-fixture values; the messages are parameterised by class id and pool size.
- **§5 throw consumption:** both copies are blocking errors for the §5 surface error handling (they join the Class page's existing blocking treatment; recovery is via the mode control, not Retry).
- **Mirror constant:** `BASELINE_POOL_MINIMUM = 2` is mirrored in `dataAnalysis.zod.ts` (schema bound) and `attemptBaselineSelection.ts` (derivation minimum) — a deliberate "agree by name" mirror per SPEC decision 13, reviewer-verified as not drift; change both together.
- **`collectClassAccumulators`:** the per-class rollup's accumulator collection (baseline-restricted in baseline mode, all-accumulator scope otherwise) is factored into `collectClassAccumulators` in `averagingAnalyser.ts`; later analyser edits route through it.
- **Invariance guarantees (later sections keep byte-identical):** `perStudentTaskMetrics` for the same input in both modes (§3 heatmap substitution and §5a availability depend on identical evidence); absolute-mode output apart from the `'absolute'` echo and always-`true` flags (SPEC decision 12); per-class/per-student rollups keep today's all-accumulator scope in both modes (the pool is the only roster-scoped step); per-task row values stay absolute with membership-only flags (`baselineTaskKeys?.has(taskKey) ?? true` in `averagingAnalyser.rows.ts`); a baseline-mode result always carries `attemptBaseline` — consumers narrow fail-fast and an `attemptBaseline?.baselineTaskKeys ?? []` fallback stays forbidden.
- **Deviations:** the predicate is named `isAttemptMetric` (the red specs pin only the three other named exports; §9.27.2 describes the role, not a name); the red-phase analyser host is `averagingAnalyser.baselineMode.spec.ts` rather than extending `filters.spec.ts`; the canonical round-trip host is `dataAnalysis.mediumBaselineRoundTrip.spec.ts`, sibling to `dataAnalysis.mediumRoundTrip.spec.ts`.
- **Lint floor:** `lint:frontend:check` is now 0 errors / 16 warnings (the rows-spec decomposition removed one); this supersedes Section 1's retained 17-warning floor for later sections' lint comparisons.
- **Docs sync:** data-shape item 3's status flipped to `Implemented (Section 2)` and §9.27 entries 1–2 flipped to `Implemented` for Section 2 in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (intro recount; entries 3–5 byte-untouched); data-shape item 2 corrected ("emits the input's mode — `'absolute'` since Section 1, and `'topDecileBaseline'` with the baseline block since Section 2"); the intro/status narrowed remaining planned work to Sections 3–5; `attemptBaselineSelection.ts` added to the File Index; the two-site throw recorded inside item 3's existing bullet. Scope: both docs, no source JSDoc edits needed (verified accurate), no new pages. Reported untreated nitpick drift: `assessment.md` ~:518 stale preview claim (already logged) and `INDEX.md:33` outstanding-planned phrasing (still true until Sections 3–5a land).

### Implementation notes / deviations / follow-up

- **Two-site throw message copy (recorded; consumed by the §5 surface error handling):** derivation-level — `deriveAttemptBaseline: class 'c_001' derived an empty attempt baseline: the 2 pooled students attempted no task key in common`; analyser-level (`averagingAnalyser.ts` `deriveClassBaseline`) — `AveragingAnalyser: class 'c_001' derived an empty attempt baseline: the 2 pooled students attempted no task key in common`. Both copies are blocking errors; the `'c_001'`/`2` literals are test-fixture values (the messages are parameterised by class id and pool size).
- **Section regression gate (2026-11-10T00:11Z): PASSED.** Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/runs/2026-11-10T00-11-17.262Z/comparison.json`. Totals: `regressionsCount: 0`, `newFailuresCount: 0`, `fixesCount: 0`; `checksPassing: 7`, `checksFailing: 1` — the only failing check is `backend-lint-check` (4 pre-existing accepted `max-lines` warnings, zero deltas vs the 2026-11-09T20:11Z baseline). Review records: red `.opencode/scratchpad/review-issue305-section2-red-recheck.md` (final PASS), green `.opencode/scratchpad/review-issue305-section2-green.md` (PASS).
- **Commit record:** `f1709904` ("feat(issue-305): derive attempt baseline and wire baseline-mode aggregation" — 11 files: the new module, analyser wiring, 4 spec hosts, docs flips, compacted plan). Branch `feat/issue-305-attempt-baseline-mode`; `git push origin` succeeded (356b97ba..f1709904). Pre-commit hooks passed (Prettier, staged lint, typecheck:all); no hook bypasses used. This note itself was included in the same commit (placeholder text said "pending").

---

## Section 3 — Heatmap projection: `HeatmapTaskColumn.includedInAttemptBaseline`

### Outcome (compacted)

Delivered the attempt-baseline flag onto heatmap task columns: `buildTaskColumns(partial, baselineSet: ReadonlySet<string> | null)` gained its required second parameter (`heatmapAdapter.ts:160`), fed by a private `deriveAttemptBaselineSet` supplier in `heatmapAdapter.ts` that derives the set from the result's own mode echo and `attemptBaseline` block under the fail-fast narrowing rule; `HeatmapTaskColumn` and `MergedHeatmapTaskColumn` now require `includedInAttemptBaseline: boolean`; the merged chain passes an explicit `null` and inherits `true` (it never enters baseline mode, SPEC decision 1); `HeatmapCell` is unchanged and `adaptMetricsToHeatmap`'s signature is unchanged (`TaskHeatmapPage.tsx:163` sole production caller, untouched). The column-level output sweep is complete — five hand-built column hosts plus four additional tsc-surfaced sites all pinned `true` (inventory retained below), `heatmapsPipeline.spec.ts:184`'s exempt cast untouched, and the required green edits landed on existing output pins (`heatmapAdapter.spec.ts` :55/:61/:67, `heatmapAdapter.merged.contribution.spec.ts:148`).

Section checks passed: full `test:frontend -- src` 3120/3120 (323 files; +11 red deltas turned green), dataAnalysis 500/500 (55 files), `typecheck:all` exit 0, `lint:frontend:check` 0 errors / 16 warnings, Prettier clean; green review PASS with zero in-scope findings (reviewer independently recomputed the medium-corpus baseline and re-ran the full coverage gate: 323 files/3120, new code 100% lines); red review PASS first round.

### Retained for later sections

- **Contract shapes (§5c consumers):** `buildTaskColumns(partial, baselineSet: ReadonlySet<string> | null)` — the second parameter is required, no default. Two production call facts: the derived-set call at `heatmapAdapter.ts:457` and the merged chain's explicit `null` at `heatmapAdapter.merged.ts:104`. Both `HeatmapTaskColumn` and `MergedHeatmapTaskColumn` require `includedInAttemptBaseline: boolean` (merged inherits it via the existing spread of the base projection). The **table-level** `TaskHeatmapColumn` required-field hop remains §5c work, as does surface-level false-marker rendering; Playwright E2E is §5d.
- **Fail-fast message shapes (parameterised by class id; blocking errors for §5's surface error handling):** `adaptMetricsToHeatmap: analyser result for class '<classId>' is missing the required appliedAnalysisMode echo` — thrown for a missing **and** an unrecognised echo — and `adaptMetricsToHeatmap: baseline-mode analyser result for class '<classId>' is missing the required attemptBaseline block`. The echo check is implemented as a both-literals comparison (`!== 'absolute' && !== 'topDecileBaseline'`) because `sonarjs/different-types-comparison` conflicts with `unicorn/no-typeof-undefined`; no lint rule was disabled.
- **Sweep inventory (§5's surface sweeps must not re-inventory):** hand-built column hosts — `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` (`TASK_COLUMNS`, two column literals), `src/frontend/src/test/dataAnalysis/heatmapFixtures.ts` (`createHeatmapMergedResult`, merged-column literal), `src/frontend/src/features/taskHeatmap/useHeatmapsPageData.preview.spec.ts:194` (typed `MergedHeatmapResult` literal), `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.merged.spec.tsx` (nine `MergedHeatmapTaskColumn` literals), `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.zeroWeight.spec.tsx` (two literals plus the `buildMergedZeroWeightResult()` builder) — plus four additional tsc-surfaced sites: `assembleMergedPreviewData.spec.ts:72` (`col()` builder), `assembleMergedPreviewData.errors.spec.ts:85` (`column()` builder), `heatmapsPreviewQueries.spec.ts:131` (`column()` builder), `src/frontend/src/services/dataAnalysis/assignmentSummaryAdapter.spec.ts:34` (`COLUMNS` literal). All pinned `true`; `heatmapsPipeline.spec.ts:184`'s `as unknown as MergedHeatmapResult` cast is exempt and untouched.
- **Passed down:** `heatmapAdapter.weighting.spec.ts:82` is an `adaptMetricsToHeatmap` error-message assertion, not a direct `buildTaskColumns` call — any future edition of the signature work must leave it untouched (avoid re-breaking it).

### Implementation notes / deviations / follow-up

- **Direct `buildTaskColumns` callers (recorded):** complete inventory — the two production sites named above, plus test callers `heatmapAdapter.weighting.spec.ts:36/:45` and `averagingAnalyser.assignmentProcessing.spec.ts:165` which were updated for the required second parameter; no further direct callers exist. `weighting.spec.ts:82` untouched by design (see the passed-down note above).
- **Red-spec consistency fix (deviation):** `dataAnalysis.mediumBaselineRoundTrip.spec.ts`'s all-four-classes assertion originally used class-0's expected keys, contradicting its own first assertion; fixed to per-class `EXPECTED_BASELINE_KEYS_BY_CLASS` (each class's complement of its outside-baseline pair) with the first assertion byte-identical and exact 7-key per-class equality preserved. Ground truth was independently recomputed from the committed corpus twice (green reviewer and implementer).
- **Docs sync:** data-shape item 8 flipped to `Implemented (Section 3)` in `docs/developer/data-shapes/frontend-data-analysis-response.md` (both descriptors require the field; both fail-fast throw shapes recorded; the projection-contract field table gained the `includedInAttemptBaseline` row with set provenance; Status paragraph/intro narrowed to Sections 4–5 outstanding; item 4's forward reference retargeted); §9.27.4 flipped to `Implemented` for Section 3 in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (intro recount updated; entries 3/5/6–8 untouched). One comment-only source trim in `heatmapAdapter.ts` (supplier JSDoc transient planning reference → durable `data-shape item 8` pointer). Scoped re-validation: Prettier clean, frontend tsc exit 0, `lint:frontend:check` 0 errors / 16 warnings. Reported untreated nitpick drift: item 9's preview-precedence list has a pre-existing numbering typo (third step labelled 2), and `adaptMetricsToHeatmap`'s `@remarks` retains historical planning vocabulary ("Breaking change (Section 8)", "(E3–F3)") from the warm-up-partials feature plan.
- **Section regression gate (2026-11-10T01:52Z): PASSED.** Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/runs/2026-11-10T01-52-17.533Z/comparison.json`. Totals: `regressionsCount: 0`, `newFailuresCount: 0`, `fixesCount: 0`; `checksPassing: 7`, `checksFailing: 1` — the only failing check is `backend-lint-check` (4 pre-existing accepted `max-lines` warnings, zero deltas vs the 2026-11-09T20:11Z baseline). Review records: red `.opencode/scratchpad/review-issue305-section3-red.md` (PASS), green `.opencode/scratchpad/review-issue305-section3-green.md` (PASS, zero in-scope findings).
- **Commit record:** `c397b481` ("feat(issue-305): project attempt-baseline flag onto heatmap task columns" — 20 files: adapter supplier/signature, merged chain, sweep + output pins, canonical red-spec fix, docs flips, compacted plan). Branch `feat/issue-305-attempt-baseline-mode`; `git push origin` succeeded (08dd1b1f..c397b481). Pre-commit hooks passed (Prettier, staged lint, typecheck:all); no hook bypasses used.

---

## Section 4 — summary-contract reconciliation + metric-display mode-aware label

### Outcome (compacted)

Delivered the mode-aware `excluded` accessible label and reconciled the summary-contract display half:

- `metricTone.ts` gained `BASELINE_EXCLUDED_METRIC_ACCESSIBLE_LABEL` beside the unchanged `EXCLUDED_METRIC_ACCESSIBLE_LABEL`, plus the exported resolver `resolveExcludedMetricAccessibleLabel(analysisMode?: AnalysisMode): string` — `'topDecileBaseline'` → the two-cause wording; `absolute`/no-arg → the weighting-only copy.
- `MetricPill.tsx` gained the optional `analysisMode?: AnalysisMode` prop, consumed only by the excluded-state `aria-label` (tone invariants pinned; no-prop = the absolute copy, correct for the three-state task-display flow — `TaskPreviewCard` and `features/taskHeatmap/**` stay untouched).
- `studentAveragesTableColumns.tsx:122` routes through the resolver with no argument — byte-identical rendering; §5b does the real threading.
- Production readers of the resolver: exactly `MetricPill.tsx:173` and `studentAveragesTableColumns.tsx:122`.
- The `assignmentSummary` regression host stayed green untouched, verifying the summary invariants (see Retained below); the red-phase shims (namespace-Partial cast, typed-props spread) are fully replaced — no `as unknown as` remains except the pre-existing pinned invalid-mode injection at `assignmentSummary.spec.ts:314`.

Section checks passed: scoped 701/701 (82 files over `src/services/dataAnalysis src/features/classPage`); full `test:frontend -- src` 3132/3132 (323 files; +12 vs Section 3); `typecheck:all` exit 0; `lint:frontend:check` 0 errors / 16 warnings; Prettier clean; red review PASS first round; green review PASS zero in-scope findings (full coverage gate re-run: 323 files/3132 tests, 95.59/91.68/95.41/96.28 above the 85% gate).

### Retained for later sections

- **Label constants (both verbatim; §5b's label assertions consume them):**
  - `EXCLUDED_METRIC_ACCESSIBLE_LABEL` — `Excluded from average: displayed work had zero weighting.`
  - `BASELINE_EXCLUDED_METRIC_ACCESSIBLE_LABEL` — `Excluded from average: displayed work had zero weighting, or fell outside the baseline task set.`
- **Resolver:** `resolveExcludedMetricAccessibleLabel(analysisMode?: AnalysisMode): string` in `metricTone.ts` — `'topDecileBaseline'` → the two-cause wording; `absolute`/no-arg → the weighting-only copy.
- **Production reader sites (exactly two):** `MetricPill.tsx:173` and `studentAveragesTableColumns.tsx:122` (the latter no-arg until §5b threads the mode).
- **§5b to-do facts:** the `RecentAssignmentCard` unit assertion on explicit `analysisMode` threading lands in §5b; the full threading chain (`ClassPage` → `ClassPageContent` → `renderReadyContent` → `ClassPageReady` → `RecentAssignmentsSection` → `RecentAssignmentCard`, and `ClassPageReady` → `StudentAveragesTableCard` → `studentAveragesTableColumns.tsx`) completes §5b, where §9.27.3 fully reconciles.
- **Summary invariant facts (regression-verified this section):** `assignmentSummaryAnalyser.ts:140` keeps the internal `'absolute'` pin (landed in Section 1); the public summary schema is unchanged; the mode-isolation regression guard in `assignmentSummary.spec.ts` (task summaries identical across a baseline-mode caller-supplied mode) exists and stays green.

### Implementation notes / deviations / follow-up

- **Recorded label copy (consumed by §5b's label assertions):** weighting-only — `Excluded from average: displayed work had zero weighting.`; baseline two-cause — `Excluded from average: displayed work had zero weighting, or fell outside the baseline task set.` §5b asserts against these exact strings.
- **Docs sync (completed):** data-shape item 5 flipped to `Implemented (Section 4)` (invariants verified against code: `assignmentSummaryAnalyser.ts:140` `'absolute'` pin, unchanged public schema) and item 7 gained a two-half block (`Implemented (Section 4, label content only)` with the verbatim wording/constants/resolver/prop facts + `Planned (Section 5)` linking the Display-contract quote update) in `docs/developer/data-shapes/frontend-data-analysis-response.md`; the Status paragraph/index recount narrowed remaining planned work to the Class-page mode control; §9.27 entry 3 flipped per the register's lifecycle idiom (`Implemented` for Section 4 label content; Section 5 completes the threading) with the intro recount moved to its own clause (entries 5/6–8 untouched). No source edits needed (JSDoc verified accurate); no new pages; `INDEX.md` verified-only. §5b's doc-pass obligations recorded on item 7: update the Display-contract quote, fully flip §9.27.3, reconcile item 6, update the intro recount.
- **Test-delta composition (+12 vs Section 3, verified via the three hosts' diffs):** `metricTone.spec.ts` +3 (both wording modes), `MetricPill.spec.tsx` +5 (baseline red, absolute/no-prop optionality, tone parity, non-excluded states), `assignmentSummary.spec.ts` +4 (regression guards: mode-isolation, byte-identical cross-mode summaries, public key-set pins, boundary rejection) — no new host files.
- **Section regression gate (2026-11-10T03:07Z): PASSED.** Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/runs/2026-11-10T03-07-50.381Z/comparison.json`. Totals: `regressionsCount: 0`, `newFailuresCount: 0`, `fixesCount: 0`; `checksPassing: 7`, `checksFailing: 1` — the only failing check is `backend-lint-check` (4 pre-existing accepted `max-lines` warnings, zero deltas). Review records: red `.opencode/scratchpad/review-issue305-section4-red.md` (PASS), green `.opencode/scratchpad/review-issue305-section4-green.md` (PASS).
- **Commit record:** `05132a38` ("feat(issue-305): add mode-aware excluded accessible label" — 9 files: resolver + constants, MetricPill prop, table-columns routing, regression guards, docs reconciliations, compacted plan). Branch `feat/issue-305-attempt-baseline-mode`; `git push origin` succeeded (b8071a98..05132a38). Pre-commit hooks passed; no hook bypasses used.

---

## Section 5 — Class-page delivery (split for independent testability)

### 5a — Mode control, availability, retention

### Outcome (compacted)

Delivered the Class page's attempt-baseline mode control, availability resolution and result retention:

- `useClassPageData` takes a required `analysisMode` second parameter (fail-fast; replaces Section 1's interim literal) and includes it in the analysis memo dependency list.
- Retention uses the previous-render state pattern, so the last successful analyser result survives a baseline-mode blocking throw within one mounted class and is cleared on the class-change remount.
- `baselineAvailability` resolves during render via the pure resolver in `useClassPageData.helpers.ts`; the new `ClassPageModeControl.tsx` (115 lines) renders the header-slot `Segmented` card with the recorded DOM contract; `ClassPage.tsx` owns the mode state.

Section checks passed: `src/features/classPage` 208/208 (29 files); `src/pages` 99/99; full `test:frontend -- src` 3152/3152 (325 files; +20 vs Section 4 = the red deltas); `typecheck:all` exit 0; `lint:frontend:check` 0 errors / 16 warnings; Prettier clean; red review PASS; green review PASS with zero in-scope findings.

### Retained for later sections (§5b/§5d consumption)

- **Hook signature:** `useClassPageData(classId, analysisMode)` — the second parameter is required (no default) and `analysisMode` sits in the analysis memo dependency list.
- **Retention pattern:** previous-render state pairs (`retainedAnalyserResult`/`seenAnalyserResult`) updated during render behind a converging guard; the retained result survives a later baseline-mode blocking throw, is superseded by any newer success, and is cleared on the class-change remount (`ClassesPage.tsx` passes `key={selectedClassId}` — wired here, asserted in §5b).
- **Availability resolver** (`useClassPageData.helpers.ts`): exported `BaselineAvailability` `{ status: 'ready' | 'awaiting-data' | 'ineligible'; reason: string | null }` and pure `resolveBaselineAvailability(analyserResult, retainedAnalyserResult, classFull)`. Precedence: `analyserResult ?? retainedAnalyserResult` — the current render's successful result always wins; the retained state supplies attempt evidence only when it is `null`. Absence rules: `classFull === null` or evidence without `perStudentTaskMetrics` resolves `'awaiting-data'` — absence never produces `'ineligible'`. Eligibility composes Section 2's `collectRosterAttemptCandidates` + `isAttemptBaselineEligible` over the `classFull.students[].id` roster; `reason` is populated for both disabled statuses and `null` only for `'ready'`.
- **Reason copy (single-sourced in helpers, verbatim):** `Waiting for class data`; `Baseline mode needs at least 3 students in this class`; `Baseline mode needs at least 2 students who attempted some work`.
- **Control copy (module-private in `ClassPageModeControl.tsx`, verbatim):** label `Averages basis` (id `class-page-mode-control-label`); options `All tasks`/`Baseline tasks`; baseline tooltip `Uses the tasks the ten-percent most-engaged students (minimum 2) have all attempted.` (enabled branch only); sr node id `class-page-mode-control-description`, always rendered, carrying the reason while disabled and empty while enabled (`aria-describedby` bound exactly while disabled). §5b wires the `pageContent.ts` `classDetail` copy home.
- **DOM contract + antd decision outcome (antd 6.6.7):** header slot = third stacked element, `Card size="small"`, `Flex` (`wrap`, `align="center"`, gap `APP_GAP_SM`), label+control; props `analysisMode`/`onAnalysisModeChange`/`baselineAvailability`; root `Tooltip` unconditional (`title = reason` while disabled); `aria-labelledby` overrides the underlying hard-coded `aria-label="segmented control"` (caller props spread after antd defaults); no wrapper span; per-option tooltips in the enabled branch only (antd wraps option tooltips unconditionally, so a disabled-state hover would fire competing popups); neither antd nor the underlying control emits `aria-disabled` — the disabled state surfaces as the root disabled class plus disabled radio inputs.
- **LOC record:** `useClassPageData.ts` 495 (+39), `ClassPageContent.tsx` 449 untouched — both under the 550 trigger, no decomposition; the threshold watch closes unless a later section pushes a watched file over.
- **postAnalysis render-pass contract:** `postAnalysis.spec.ts` `READY_RENDER_PASS_COUNT = 2` — the retention pattern re-renders once on first success; post-commit execution still deduped. §5b's hook suites must respect this template.
- **§5b threading entry points:** mode state lives in `ClassPage.tsx` (`useState<AnalysisMode>('absolute')`); §5b threads `mode` through the `renderReadyContent` options object; the control's `key` guarantee comes from the `ClassPage` remount.

### Implementation notes / deviations / follow-up

- **Measured LOC:** hook `useClassPageData.ts` 495 (+39 from 456); `ClassPageContent.tsx` 449 untouched. No decomposition applied — the hook stayed under the 550 trigger (the resolver's pre-placement in `useClassPageData.helpers.ts` kept hook growth to wiring/retention).
- **Docs sync (completed):** §9.27.5 flipped to `Implemented` for Section 5a in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (intro recount; entry body carries the resolver type/signature, precedence rule, and the three verbatim reason constants). Data-shape doc: Status/intro narrowed remaining planned work to the §5b–5d remainder (mode threading to display labels, embedded heatmap marking + caption, E2E); item 7's planned bullet retargeted `Planned (Section 5)` → `Planned (Section 5b)`; item 6 untouched (§5b pending). No JSDoc edits needed (all changed exports verified accurate). Untouched reported items: `navigation-consistency-status.md` third-header-element recording stays with Section 6; `SPEC.md:358`'s stale 456 figure is plan snapshot language; `ClassPageModeControl.tsx`'s copy-home pointer comment updates in §5b's pass when `pageContent.classDetail` owns it.
- **Segmented disabled-tooltip live check: did not fire** — the pinned wrapper fallback was NOT triggered; the root tooltip reads because rc sets no `pointer-events: none` on the disabled control.
- **Section gate run 1 FAILED then passed on re-run (§2.6 rework path):** run `2026-11-10T04-51-56.736Z` failed `frontend-e2e-check` with 3 regressions: two deterministic `task-heatmap-summary` strict-mode tooltip collisions plus the `classes-crud-bulk-progress` "Set cohort" failure. Diagnosis (trace-verified): §5a's `ClassPageModeControl` card grew the header stack → `focus()` scrolls moved heatmap table headers under the stationary mouse → competing antd tooltips opened and persisted → the tests' bare global `getByRole('tooltip')` collided. The user ruled `classes-crud-bulk-progress` a **known flaky test** (do not chase). The schema-mismatch/Date-object hypothesis was ruled out by evidence: all content assertions passed before the collisions and no validation/Date errors appeared in any console output.
- **Gate rework:** Playwright fixed `src/frontend/e2e-tests/task-heatmap-summary.spec.ts` only (+20/−8): mouse parked at `(0, 0)` before each scroll-inducing `focus()` in the two failing tests, and all four tooltip locators in those tests named (`{ name: /N means not attempted…/ }`, `{ name: /An assessment error…/ }`); test 3 untouched; semantics unchanged. Validated: fixed tests ×3 repeats green; full describe ×3 green (27 passed); full E2E suite 336 passed / 1 failed (the known-flaky classes-crud test ticked in that run; not chased); typecheck exit 0; lint 0 errors / 16 warnings; Prettier clean. Green re-review of the E2E diff: PASS, zero in-scope findings (`.opencode/scratchpad/review-issue305-section5a-e2e-gate-rework.md`).
- **Section gate re-run PASSED (supersedes run 1):** `2026-11-10T06-50-58.219Z` — 7/8 checks passing with **0 regressions / 0 new failures**; `frontend-e2e-check: passing` (the known-flaky `classes-crud-bulk-progress` test also happened to pass on this run; its flake is recorded below). The sole failing check, `backend-lint-check`, carries the 4 pre-existing `max-lines` failures in untouched backend test files accepted as technical debt at the baseline (`baseline/checks/backend-lint-check/raw.json` contains the identical 4 findings; never counted as regressions).
- **Known-flake record (user decision):** `classes-crud-bulk-progress` "Set cohort" (`tests` site: `e2e-tests/helpers/classes-crud-bulk-scaffold.ts:39` `clickModalConfirmAndDismiss`) is a known flaky test per the user; not to be fixed or chased. Recorded in the deferred-findings log; if it fails in a future gate run, surface it as the known flake rather than as a section regression.
- **Commit record:** `33cb92c8` — "feat(frontend): add attempt-baseline mode control, availability and retention (issue #305, Section 5a)" — 20 files changed, +1404/−146, pushed to `feat/issue-305-attempt-baseline-mode` (`b02732ea..33cb92c8`); push confirmed; worktree clean afterwards. Prettier/lint/typecheck pre-commit hooks all green.

### 5b — Card/table aggregates, label threading, header key

### Outcome (compacted)

Delivered the Class page's baseline-mode card/table aggregates and label threading:

- New `classPageAdapter.baselineCardRollup.ts` owns the card rule: `deriveCardBaselineSet` (fail-fast narrowing from the result's own `appliedAnalysisMode` echo) and `rollupCardCriteria` (baseline-filtered rollup with the empty-set `excluded` fallback conversion); the card `average` still derives through the untouched `computeAverageMetric` → `computeOverallComposite` path. `classPageAdapter.ts` is the module's sole consumer and stays a pure function of `analyserResult`.
- `analysisMode` threads through the full chain so the card pills and the students-table `aria-label` render the mode-aware `excluded` wording; the embedded heatmap view receives no mode props.
- Header copies verbatim-moved to the `pageContent.ts` `classDetail` home; the excluded labels stay single-sourced in `metricTone.ts`.
- §9.27.3's threading unit assertion landed in `RecentAssignmentCard.spec.tsx`; the §5a-wired `ClassesPage` remount is asserted by the existing `ClassesPage.shell.spec.tsx` mount-count behaviour test (no new test needed).

Section checks passed: `src/features/classPage` 217/217 (29 files); `src/pages` 99/99; full `test:frontend -- src` 3161/3161 (325 files; +9 vs Section 5a); `typecheck:all` exit 0; `lint:frontend:check` 0 errors / 16 warnings; Prettier clean (16 touched files); red review PASS; green review PASS with zero in-scope findings.

### Retained for later sections (§5c/§5d/6/7 consumption)

- **Card-rollup module contract** (`src/frontend/src/features/classPage/classPageAdapter.baselineCardRollup.ts`; sole consumer `classPageAdapter.ts`): `deriveCardBaselineSet(analyserResult)` reads the `appliedAnalysisMode` echo as the single source of truth — a missing/unrecognised echo, or a baseline-mode result without its `attemptBaseline` block, throws; an `attemptBaseline?.baselineTaskKeys ?? []` fallback is forbidden; absolute mode returns `null`. The adapter only ever sees fresh schema-parsed results (sole production call site in `useClassPageData`), so the throws are defence-in-depth for non-parsed inputs. `rollupCardCriteria(rows, baselineTaskSet)`: `null` rolls up every row (byte-identical to the pre-change inline loop); baseline mode filters rows by `buildTaskKey(definitionKey, taskId)` membership — equivalent to filtering on `includedInAttemptBaseline: true` because `averagingAnalyser.rows.ts:313` sets the flag as `baselineTaskKeys?.has(taskKey) ?? true`; an empty filtered set rolls up the unfiltered rows per criterion and converts only `computed`/`notAttempted` to the `ExcludedMetricSchema` literals (`value: null`, `totalWeight: 0`, `applicableDataPoints: 0`) while preserving the resolved observed `totalDataPoints`; an already-`excluded` zero-weight rollup keeps its cause untouched. The module is only reached with non-empty rows — the `rows.length === 0` → `noDataMetric()` placeholder branch stays in the adapter (data-shape item 6).
- **Red-phase guards (later sections and Section 7 keep these green):** the card `average`/row `overall` composite is never converted directly — it derives from the converted criteria via `computeOverallComposite`, so its resolved `totalDataPoints` is the sum of the converted criteria's counts (all-`error` stays `error` td 0; a mixture converges on `excluded`); `ExcludedMetricSchema`'s `totalDataPoints >= 1` is never violated — zero-evidence `error` td 0 stays `error` and no `excluded` is synthesised without observed evidence; absolute-mode invariance (SPEC decision 12) — rows flagged `includedInAttemptBaseline: false` still roll up unfiltered when the echo is `'absolute'`; the mode echo alone is the switch.
- **Threading chain + optional-prop design (§5c/§5d/6 rely on the shape):** `ClassPage` (owns `useState<AnalysisMode>('absolute')`) → `ClassPageContent` (optional prop) → `renderReadyContent` (options object) → `ClassPageReady` → `RecentAssignmentsSection` → `RecentAssignmentCard` → each `MetricPill`; and `ClassPageReady` → `StudentAveragesTableCard` → `buildStudentAveragesTableColumns(filters, analysisMode)` → `buildMetricColumn` → `resolveExcludedMetricAccessibleLabel(analysisMode)`. Props stay optional at every hop; the page passes the mode explicitly (no React context); absent renders the weighting-only wording. `renderReadyContent`'s `TaskHeatmapPage` branch passes no mode — `features/taskHeatmap/**` keeps only its known `'absolute'` pins. The analysis memo deps widened to `[filters, analysisMode]`; the view-model memo stays `[adapterResult, searchTerm, sort]` (mode already baked into `adapterResult`).
- **Copy homes:** header copies live in `pageContent.ts` `classDetail.{modeControlLabel, absoluteModeOptionLabel, baselineModeOptionLabel, baselineModeOptionTooltip}` (consumed by `ClassPageModeControl`, whose module-private constants and pointer comment were removed); the excluded labels stay single-sourced in `metricTone.ts` (`EXCLUDED_METRIC_ACCESSIBLE_LABEL` / `BASELINE_EXCLUDED_METRIC_ACCESSIBLE_LABEL` + resolver, Section 4, untouched). §5b's label assertions consume the exported constants rather than restating literals.
- **Fixture basis:** all §5b baseline/`excluded` cases are local hand-built fixtures (`classPageAdapterTestFixtures.ts` + the adapter suites); no canonical-corpus loading and no committed fixtures were added — `medium`'s three recent cards per class are all in-baseline, so outside-baseline card scenarios are not expressible canonically (recorded in SPEC).
- **LOC record and threshold watches:** `ClassPageContent.tsx` 470 (+21); `classPageAdapter.ts` 421 + extracted `classPageAdapter.baselineCardRollup.ts` 166 (both under the 500-line lint cap and the 550 decomposition trigger — reviewer-verified as a genuine responsibility split, not threshold-gaming); `useClassPageData.ts` 495 untouched — no decomposition, and the 550 watch stays closed unless a later section pushes a watched file over. `classPageAdapter.zod.spec.ts` sits at 499 lines, at the lint `max-lines` warning boundary — watch it if later sections grow its assertions.
- **Reconciliation state later sections rely on:** §9.27.3 is fully reconciled (Section 4's label content plus this section's threading half; the docs sync records the `Implemented` flip); data-shape item 6 is reconciled (adapter rule, empty-set conversion and composite facts recorded, plus the confirmed "no new entry" for `baselineAvailability`). Section 6 finalises statuses; Section 7's three-document consistency pass checks them.

### Implementation notes / deviations / follow-up

- Measured LOC: `ClassPageContent.tsx` 470 (+21 from 449); `classPageAdapter.ts` 421 + new `classPageAdapter.baselineCardRollup.ts` 166; `useClassPageData.ts` 495 untouched. The plan-named LOC-watch file (`ClassPageContent`) stayed under the 550 trigger — no region-renderer decomposition; the adapter rule was extracted in-change only because the adapter breach-rule pushed it over the 500-line lint cap (466→566 mid-change; reviewer-verified responsibility split).
- Review records: red `.opencode/scratchpad/review-issue305-section5b-red.md` (PASS, zero findings); green `.opencode/scratchpad/review-issue305-section5b-green.md` (PASS, zero in-scope findings).
- Docs sync (completed, no new pages): data-shape doc — item 6 flipped `Implemented (Section 5b)` naming the module, `classPageAdapter.ts` sole-consumer fact, the fail-fast contract and the `baselineAvailability` no-new-entry decision; item 7 flipped `Implemented (Section 5b, threading)` with both chains; the Status/intro narrowed remaining planned work to §5c (embedded heatmap marking + caption) and §5d (E2E); the Display-contract quote (was at :926–928) now names `resolveExcludedMetricAccessibleLabel(analysisMode?)` and carries both the weighting-only and the baseline both-causes quoted wordings; the new module added to the doc's File Index. Shared-helpers doc — §9.27 intro recount now says entry 3 is `Implemented` and all eight entries are implemented (remaining plan sections add no further entries); §9.27.3 flipped `Implemented (label content for Section 4; threading for Section 5b)` extended with the delivered consumers, the `metricTone` single-source note, the `pageContent.classDetail` copy home and the closed §5a pointer-comment follow-up. No JSDoc edits needed (all changed public symbols verified accurate). Untouched by design: `navigation-consistency-status.md` (Section 6 owns the third-header-element recording).
- **Section gate PASSED:** run `2026-11-10T08:16:35.698Z` vs baseline `2026-11-09T20:11:14.004Z` — 7/8 checks passing, **0 regressions / 0 new failures**; `frontend-e2e-check: passing` (the known-flaky classes-crud test passed on this run; its user-decided known-flake record stands from §5a). Sole failing check `backend-lint-check` carries the identical 4 pre-existing `max-lines` findings in untouched backend test files accepted as technical debt at the baseline.
- **Commit record:** `34412807` — "feat(frontend): thread baseline mode to Class-page aggregates and labels (issue #305, Section 5b)" — 19 files changed, +826/−205, pushed to `feat/issue-305-attempt-baseline-mode` (`228b740d..34412807`); push confirmed; pre-commit hooks (Prettier/lint/typecheck) green.

### 5c — Embedded heatmap column marking + caption

### Outcome (compacted)

Delivered the embedded heatmap's baseline column marking and caption: `TaskHeatmapColumn` (the table-level structural contract in `taskHeatmapTableColumns.tsx`) now requires `includedInAttemptBaseline: boolean`; both zero-weight helpers gained a required trailing options-object parameter and mark zero-weighted and outside-baseline columns with one visual language (marker, composed tooltip/aria-label, group and edge classes); merged columns inherit the flag through the existing spread; the caption renders inside `TaskHeatmapTable` when at least one column sits outside the baseline. New red-first host `TaskHeatmapTable.baseline.spec.tsx` (9 tests); `TaskHeatmapTable.zeroWeight.spec.tsx` updated for the helper signatures and shared constants.

Section checks passed: `npm run test:frontend -- src/features/taskHeatmap` 387/387 across 45 files; full frontend 3176/3176 across 326 files; `typecheck:all` exit 0; `lint:frontend:check` 0 errors / 16 warnings; red review PASS (`.opencode/scratchpad/review-issue305-section5c-red.md`); green review PASS with zero in-scope findings (`.opencode/scratchpad/review-issue305-section5c-green.md`).

### Retained for later sections (§5d/6/7 consumption)

- **Helper signatures (later-section-breaking if missed):** `buildTaskHeaderPresentation(title, averageContribution, options)` and `getZeroWeightMetricEdgeClass(metricIndex, metricCount, averageContribution, options)` in `taskHeatmapZeroWeightHeader.tsx` both end in a required `options: Readonly<{ includedInAttemptBaseline: boolean }>` — no default; every caller passes it. `TaskHeatmapColumn` requires `includedInAttemptBaseline: boolean` — an optional field plus a `?? true` fallback stays forbidden.
- **Flag plumbing + no-mode-props guarantee:** `TaskHeatmapTable.tsx` builds the options object from the adapter-projected `taskColumn.includedInAttemptBaseline`; `buildTaskMetricSubColumns` forwards it to `getZeroWeightMetricEdgeClass` (single production call site; antd applies the class to both `th` and body `td`s). No `analysisMode` prop or state enters `features/taskHeatmap/**` — the flag arrives only through the heatmap projection.
- **Caption contract:** rendered inside `TaskHeatmapTable`, after the existing no-submissions notice and above the `<Table>`, as `Typography.Paragraph` with `role="status"`, `aria-live="polite"`, `type="secondary"`; shows exactly when at least one task column has `includedInAttemptBaseline === false` (`hasBaselineOffColumn` memo; a zero-column list never shows it). Constants `BASELINE_OFF_EXPLANATION`, `BASELINE_CAPTION` and `BASELINE_MARKER` (`'†'`) live in `taskHeatmapZeroWeightHeader.tsx` beside the zero-weight ones.
- **Composer ordering rule:** zero-weight + baseline-off co-occurrence renders one tooltip body with both facts, baseline-off first (`${BASELINE_OFF_EXPLANATION} ${ZERO_WEIGHT_EXPLANATION}`); the heading-span `aria-label` and the `onHeaderCell` label follow the same order.
- **Byte-identical absolute mode:** with `includedInAverage && includedInAttemptBaseline` both helpers return the plain rendering (`{ title }` / `undefined`); pinned by the required flag (no fallback anywhere), the sweep-pinned `true` fixtures, the new absolute-invariance negatives (no caption, no `role="group"`, no `†` in embedded and merged renders), and the untouched pre-existing table suites (`.spec`/`.preview`/`.status`/`.merged`).
- **Merge inheritance:** merged columns inherit the flag via the existing spread; adapter-level inheritance (explicit `null` → all `true`) stays pinned by Section 3's `heatmapAdapter.merged.spec.ts`; the §5c tests exercise the merged tier path with a `false` flag under the assignment-tier parent.
- **LOC record:** `TaskHeatmapTable.tsx` 230, `taskHeatmapZeroWeightHeader.tsx` 112, `taskHeatmapTableColumns.tsx` 464 — all under the 550 trigger; no decomposition.
- **Fixture facts:** the only table-level column literal builder is `taskHeatmapTableColumns.spec.ts`'s `column()`, which gained the one-line `includedInAttemptBaseline: true` (plumbing-required); `TASK_COLUMNS` in `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` is adapter-typed and already carried the flag from Section 3; the remaining table-family specs build no column literals — they consume `TASK_COLUMNS`. Canonical `medium` (non-degenerate 7-of-9-key baseline, two `false` columns per class) loads via the call-site `?raw` pattern when useful — deliberate non-sharing per the recorded `canonicalFixturePrimitives` decision.
- **Red-phase literal-vs-constants note:** red-phase tests restated the copy as spec-local literals because the production constants did not exist yet; green created them and the tests now consume the shared constants — §5d E2E asserts these surfaces (marker, tooltip explanation, caption).
- **Data-shape:** no data-shape entry — the presentation contract stays a TS interface (item 8 done in Section 3).

### Implementation notes / deviations / follow-up

- No merge/marker edge-case findings emerged (red and green reviews both PASS with zero findings; merge inheritance exercised under the assignment-tier parent and pinned at adapter level by Section 3).
- Measured LOC: `TaskHeatmapTable.tsx` 230, `taskHeatmapZeroWeightHeader.tsx` 112, `taskHeatmapTableColumns.tsx` 464 — all under the 500 cap and 550 trigger; no decomposition. Green-phase lint repair cycle renamed booleans (`isZeroWeighted`/`isBaselineOff`) to clear 3 transient unicorn errors.
- Plumbing-required test edit: `taskHeatmapTableColumns.spec.ts` `column()` fixture gained the required flag (`true`, neutral).
- Docs sync (completed, no new pages): data-shape doc — Status/intro now include the delivered heatmap marking + caption (Section 5c) and narrow remaining planned work to §5d E2E; item 8 verified accurate, no change. Shared-helpers doc — §9.27 intro recount narrowed to "(E2E browser coverage)"; entry 4 amended to attribute the flag's presentation rendering (marker, composed tooltip/label text, edge classes, caption) to Section 5c; register still 8/8 Implemented, no new entry (the two extended helpers are pre-existing zero-weight-feature helpers with no §9.27 entry). `data-analysis-architecture.md` — zero-weight-header module description widened to the one-visual-language reality (`†` suffix, table-level caption). JSDoc: `TaskHeatmapTable.tsx` module docstring updated to "no-submissions and baseline captions" (comment-only, 2 lines; scoped lint + frontend tsc re-run clean by the docs delegation; covered by the section gate). Untouched by design: `navigation-consistency-status.md` (Section 6), `docs/pedagogy/data-analysis-scoring.md` (teacher-facing explanation is Section 6's deliverable).
- Section regression gate (run `2026-11-10T11:04Z`): 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing. Sole failing check is `backend-lint-check` with the four pre-existing `max-lines` debts in untouched backend test files — identical to baseline, accepted technical debt, not regressions. Playwright E2E passed cleanly; the known-flaky `classes-crud-bulk-progress` "Set cohort" test did not tick this run. Report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/`.
- Commit record: `fe1f064b` — "feat(frontend): mark attempt-baseline heatmap columns and add baseline caption (issue #305, Section 5c)" — branch `feat/issue-305-attempt-baseline-mode`, pushed successfully (pre-commit Prettier/lint/typecheck clean).

### 5d — E2E browser coverage (Playwright)

### Outcome (compacted)

Delivered the feature's E2E browser coverage: new spec `class-page-baseline-mode.spec.ts` (386 lines, 6 tests, green-on-arrival — empirically verified against the real browser via a temporary probe spec since deleted) covering toggle → aggregate change → toggle back with exact pinned values, keyboard radio semantics, the blocking-recovery path (the real derivation-level empty-baseline throw observed in the browser log), the skip-tasks baseline-off marker/caption/tooltip assertions, and the first-use checks (both themes, focus-ring visibility, thumb-motion settled before post-toggle assertions/captures). `task-heatmap-class-fixtures.ts` gained the skip-tasks scenario extension — exported `HeatmapTaskId` and `HeatmapSkippedTasksByStudentId`, plus an optional `skippedTasksByStudentId` parameter on `buildClassFullDocument` threaded through `buildSubmissionItems` (unknown ids throw) — making baseline-off columns assertable. `navigation-screenshots.spec.ts` gained pre-capture assertions (mode control visible with `All tasks` checked before the Class-page captures; mode-control radiogroup `toHaveCount(0)` before the Heatmaps-builder capture), and the two Class-page baselines (`class-page-overview`, `task-heatmap`) were deliberately re-captured; the `heatmaps-builder` baseline stayed byte-identical.

Section checks passed: `npm run lint:frontend:check` exit 0 (0 errors / 16 pre-existing warnings, the plan's retained floor); `npm run test:frontend:e2e -- e2e-tests/navigation-screenshots.spec.ts` 3/3 passed; `npm run test:frontend:e2e -- e2e-tests/class-page-baseline-mode.spec.ts` 6/6 passed; frontend type-check including the e2e project exit 0; red review PASS with zero findings and green review PASS with zero findings (`.opencode/scratchpad/review-issue305-section5d-red.md`, `.opencode/scratchpad/review-issue305-section5d-green.md`). The full E2E suite was not run — the section checks name exactly these two specs, and production code is unchanged since §5c's clean full-suite gate.

### Implementation notes / deviations / follow-up

- **Deliberate baseline re-capture (why the scoped flags were needed):** the pinned Playwright 1.64's default `--update-snapshots` mode only rewrites snapshots whose comparison fails, and the stale baselines still passed within the spec's `maxDiffPixelRatio: 0.1` tolerance — so `--update-snapshots=all` scoped with `-g "Class Page overview|Task Heatmap"` was required to force the rewrite while guaranteeing the Heatmaps-builder baseline could not be rewritten. Capture config untouched; the non-#305 pixel drift in the re-captured baselines is attributed to the `4635f18b` merge (merged-main drift — Forename/Surname split, synthetic-corpus values, summary cards, "Re-run Assessment" button, "Heatmaps" sidebar — reviewer spot-checked against that commit range), not feature fallout.
- **Known-flake sighting (skip decision):** the `classes-crud-bulk-progress` "Set cohort" test was sighted during this section and never chased — user-acknowledged known flake, already recorded in the deferred-findings log; future gate runs surface it as the known flake, not a section regression.
- **Deferred-findings ledger:** unchanged by this section (1 known-flake row, 6 nitpick rows) and remains the authoritative ledger; no new follow-ups left for Sections 6/7.
- **First-use checks hosting (deliberate deviation from the layout spec's ordering):** the layout spec makes the first-use Segmented checks "the first implementation step"; they are hosted here because 5b/5c build their suites on the landed control — 5a's component tests assert the DOM contract the checks depend on. (SPEC and the layout spec call the antd-source-pin re-verification "§5a's first-use live check"; the themes/focus-ring/thumb-motion checks are the §5d-hosted subset.)

---

## Section 6 — Pedagogy and architecture documentation

### Outcome (compacted)

Delivered the plan's canonical documentation in a single Docs pass — review PASS with zero findings (`.opencode/scratchpad/review-issue305-section6-docs.md`); all five acceptance criteria confirmed against source. Section checks passed: `npm run lint:frontend:check` 0 errors / 16 warnings (retained floor); planned-entry reconciliation complete — no stale `Not implemented`/`Planned` marker in any of the four documents; the out-of-v1 generator-extension plan remains recorded as deferred (SPEC.md:357).

### Retained for later sections (Section 7 / final passes)

- The four documents' reconciled final states are Section 7's consistency-pass baseline (its check 4: SPEC decisions ↔ data-shape items ↔ §9.27 entries). §9.27 reconciliation was verify-only here: register 8/8 `Implemented` with section attribution; the shared-helpers doc sits outside this section's four-document surface.
- Final-pass nitpicks (deferred-findings log, all disregarded): the §9.27 intro's "remaining section (E2E browser coverage)" phrase is tense-stale post-§5d; `INDEX.md:33`'s outstanding-planned-change claim is newly stale; `assessment.md:519` stale preview claim; `heatmapAdapter.ts` `@remarks` planning vocabulary.

### Implementation notes / deviations / follow-up

- Delivered (single Docs pass; review PASS with zero findings — record: `.opencode/scratchpad/review-issue305-section6-docs.md`): scoring doc gained the teacher-facing "Averages basis: all tasks or baseline tasks" section (what changes, what stays absolute, plain-language selection rule with the class-of-24 worked example, limits) and the three Excluded cause-statements were amended for baseline-mode truthfulness; architecture doc gained "Attempt-baseline mode (post-accumulation)" (derivation ownership + accumulation-filter flow, verified against `averagingAnalyser.ts:202–234`) plus ownership-table/module-inventory/Status updates; navigation tracker recorded the third always-rendered header element (Design Decision section, both layout blocks, Completed Work §10) and corrected §7's re-capture claim to match §5d; data-shape items 1–8 all finalised `Implemented (Section N)` with Status/intro/Legacy-pointer narratives closed (net-zero line change).
- Required checks: `npm run lint:frontend:check` 0 errors / 16 warnings (retained floor); planned-entry reconciliation complete — no stale `Not implemented`/`Planned` marker in any of the four documents; the out-of-v1 generator-extension plan remains recorded as deferred (SPEC.md:357).
- §9.27 reconciliation was verify-only (the shared-helpers doc is outside this section's four-document surface): register confirmed 8/8 `Implemented` with section attribution; no edit needed. One new nitpick recorded for the final pass: the §9.27 intro's "remaining section (E2E browser coverage)" phrasing is tense-stale post-§5d (deferred-findings log, disregarded).
- Docs-sync pass (§2.4): not applicable — this section IS the plan's documentation delivery; no code, test, or behaviour changed.
- Out-of-scope findings re-reported by delivery and review, all pre-existing ledger rows (no new rows): `assessment.md:519` stale preview claim (Section 1), `INDEX.md:33` outstanding-planned-change claim (Section 2 — now newly stale and awaiting the final pass), `heatmapAdapter.ts` `@remarks` planning vocabulary (Section 3).
- Section regression gate (run `2026-11-10T13:49Z`): 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing. Sole failing check is `backend-lint-check` with the four pre-existing `max-lines` debts in untouched backend test files — identical to baseline, accepted technical debt, not regressions. Playwright E2E passed cleanly; the known-flaky `classes-crud-bulk-progress` "Set cohort" test did not tick this run.
- Commit record: `dfc4729e` — "docs: deliver attempt-baseline pedagogy and architecture documentation (issue #305, Section 6)" — branch `feat/issue-305-attempt-baseline-mode`, pushed successfully (pre-commit Prettier/lint/typecheck clean).

---

## Section 7 — Regression and contract hardening

### Outcome (compacted)

All four checks proven green. Verification-only section: no files changed by it apart from one one-line documentation retense already delivered by the consistency pass (check 4).

- **Check 1 — `npm run run-all-checks`:** green modulo the accepted debt. The chained run aborts at `lint:backend:check` (0 errors / 4 pre-existing `max-lines` warnings in untouched backend test files, `--max-warnings 0` — accepted technical debt, not regressions), so the remaining steps were run independently and all passed: `test:coverage` all five legs green (backend 270 files/3749 tests, frontend 326/3176, builder 23/252, synthetic 54/764, plugins 2/33), `lint:synthetic:check` green, `build:production` green (all 10 GAS-bundle steps, determinism checksums recorded).
- **Check 2 — `npm run test:synthetic -- syntheticCommittedFixtureRegeneration`:** green 7/7 — committed synthetic fixtures byte-for-byte stable.
- **Check 3 — full E2E targets per §5d:** green via the Playwright delegation: 6/6 + 3/3 with zero retries consumed; the two Class-page screenshot baselines byte-stable (git blob hashes identical to the §5d re-capture at `0f8d8d3f`; `heatmaps-builder` untouched since Nov 5); §5d assertions confirmed still pinning the delivered behaviour.
- **Check 4 — three-document consistency pass:** green via the Docs delegation: SPEC decisions ↔ data-shape items 1–8 and data-shape ↔ §9.27 both consistent with zero disagreement; the §9.27 intro's stale "(E2E browser coverage)" phrase retensed (one line, net-zero, authorised by the deferred-findings ledger's Section 6 row); sweep clean.

### Retained for later sections (Documentation-and-rollout notes + final report)

- **The four check results** as recorded above, with the accepted-debt shape of check 1: the only non-green element in the full gate is `backend-lint-check`'s 4 pre-existing `max-lines` warnings in untouched backend test files — accepted technical debt, never a section regression.
- **Byte-stability evidence chain (E2E baselines):** the two Class-page screenshot baselines are byte-stable — git blob hashes identical to the §5d re-capture at `0f8d8d3f`, `heatmaps-builder` untouched since Nov 5, capture deterministic, and today's runs green. Caveat for the record: the spec's inline `maxDiffPixelRatio: 0.1` means a passing run alone does not mathematically prove pixel-exactness; stability rests on the combined chain (identical hashes + no rendering-relevant change + deterministic capture + green runs). A tolerance-0 probe was correctly not created — the delegation's no-file-changes exclusion forbade it.
- **Awareness-only observations (not failures, not chased):** an antd `rc-collapse` "children will be removed" deprecation warning in the Vite dev-server console on Classes-page load (dependency-level; zero changes since §5d); the builder vitest coverage run's interleaved `regression-checker:` log lines are the checker's own failure-path fixtures exercised by the builder project's tests of the checker tool (not gate failures).
- **Deferred-findings ledger rows carried into the final documentation pass (three known out-of-surface drifts):** `INDEX.md:33`, `assessment.md:519`, and the `heatmapAdapter.ts` `@remarks` planning vocabulary. The `@remarks` row appears already resolved (keyword sweep finds nothing); the other two remain open for the final pass.

### Implementation notes / deviations / follow-up

- No deviations from the plan's verification shape. Docs sync (§2.4): not applicable as a separate pass — this section IS the plan's documentation delivery; its one worktree change is the consistency pass's retense edit in the shared-helpers doc (one line, net-zero, authorised by the deferred-findings ledger's Section 6 row).
- Section regression gate (run `2026-11-10T14:24Z`): 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing. Sole failing check is `backend-lint-check` with the four pre-existing `max-lines` debts in untouched backend test files — identical to baseline, accepted technical debt, not regressions. Playwright E2E passed cleanly; the known-flaky `classes-crud-bulk-progress` "Set cohort" test did not tick this run.
- Commit record: `cf935b49` — "docs: reconcile three-document consistency and record Section 7 hardening results (issue #305, Section 7)" — branch `feat/issue-305-attempt-baseline-mode`, pushed successfully (pre-commit Prettier/lint/typecheck clean).

---

## Documentation and rollout notes

### Objective

- Landing summary and caveats (joint with Section 6).

### Acceptance criteria

- All canonical docs reflect delivered behaviour; planned-only entries reconciled, including the explicitly recorded **out-of-v1 generator-extension plan** (per-task participation stage in `scripts/synthetic-test-data/generateSubmissions.js` + invariant-guard updates + `npm run fixtures:synthetic` regeneration note) remaining marked as a deferred plan, not delivered.

### Required checks

1. Section 6 acceptance criteria confirmed in final state.
2. `@remarks` audit: planned `@remarks` from Sections 1–5 exist in code.

### Implementation notes / deviations / follow-up

- Fill during delivery.

---

## Suggested implementation order

1. **Section 1** — schema contracts + full blast-radius sweep (everything downstream starts green)
2. **Section 2** — baseline selection + analyser behaviour
3. **Section 3** — heatmap projection + column-level sweep
4. **Section 4** — summary reconciliation + display helpers
5. **Section 5a → 5b → 5c → 5d** — control/availability, aggregates/labels, heatmap marking, E2E
6. **Section 6** — documentation pass
7. **Section 7** — full gate + hardening
