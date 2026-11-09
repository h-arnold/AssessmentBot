# Feature Delivery Plan (TDD-First) — Attempt-Baseline Analysis Mode (issue #305)

> **Status (in progress):** Implementation underway on branch `feat/issue-305-attempt-baseline-mode`. Current phase: Section 1 (red). Baseline established 2026-11-05 on this branch: 7/8 checks pass; `backend-lint-check` fails only on four pre-existing `max-lines` warnings in untouched backend test files (`tests/backend-api/assignmentDefinitionPartials.unit.test.js`, `tests/dbManager/dbManager.test.js`, `tests/googleClassroom/classroomApiClient.test.js`, `tests/utils/batchUpdateUtility.test.js`) — accepted as pre-existing technical debt for this frontend-only plan; report: `.ts-regression-checker/reports/session-feat-issue-305-attempt-baseline-mode/baseline/baseline.txt`.

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

---

## Section 2 — Baseline selection + averaging analyser: pool, intersection, filtering, excluded resolution

### Objective

- Implement `attemptBaselineSelection.ts` (post-accumulation) and the shared attempt predicate; wire pool derivation, intersection baseline, aggregate filtering, the `excluded`/composite/conversion rules, and per-task flags through the averaging analyser — with the empty-baseline throw.

### Constraints

- Post-accumulation derivation over `perStudentTaskAccums` (SPEC Placement; `displayCount` is the attempt signal; no second raw-data walk). Predicate input: `ReadonlyArray<PerStudentTaskMetric>` projected via `buildPerStudentTaskMetrics`.
- Pool: candidates = ≥1-attempt roster students; size `min(|candidates|, max(2, ceil(0.1 × rosterSize)))`; distinct-`taskKey` attempt counts; `studentId` tie-break; eligibility fails below 2 candidates or below 3 roster students.
- Empty intersection throws with descriptive error naming the class (no fallback; user-settled).
- Per-student conversion: only `computed`/`notAttempted` → `excluded` preserving resolved `totalDataPoints`, constructing `value: null`/`totalWeight: 0`/`applicableDataPoints: 0`; already-`excluded` untouched; `overall` via `computeOverallComposite` over converted criteria; all-`error` stays `error`; the `studentAccums` fallback keeps today's path only for students with no per-(student, task) accumulators.
- Mode invariance: `perStudentTaskMetrics` byte-identical across modes; per-class/per-student rollups keep today's all-accumulator scope (pool is the only roster-scoped step).
- Production pinning was completed in Section 1 (constraint only referenced, not re-done here).

### Shared helper plan

1. `attemptBaselineSelection.ts` — `new`; `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`; register §9.27.1 → status flips on delivery.
2. Shared attempt predicate — `new export` from the same module; register §9.27.2.
3. Reuse (no extraction): `buildTaskKey`, `resolveAssignmentDefinitionData`/`createTaskWeightingIndex`, `rollupMetric`, `computeOverallComposite`, `buildPerStudentTaskMetrics`.

### Data-shape planning block

- Implement data-shape item 3's domain rules (candidacy, attempt definition, intersection, conversion/composite rules); item 3's status reconciles here.

### Canonical fixture note

- Canonical synthetic-corpus fixtures are loaded at call sites via the established `?raw` pattern (Section 1 helper entry 2). `medium` claims covered here: pool sizing 2, tie-break (pool-boundary tie at roster indices 3 vs 4 — seven attempts each, identical attempt sets — broken by `studentId`; pool membership **and** pool-array order asserted explicitly), E-condition candidacy evidence (rosters 1 and 2 — `ASSESSMENT_FAILED` and `SOURCE_UNREADABLE` — zero attempts despite participating in five assignments), the raw-`N`-alongside-numeric attempt case at roster 0, a non-degenerate 7-of-9-key baseline (outside-baseline pair: `definition-2-slides` in class-0/2, `definition-0-slides` in class-1/3), and eligibility thresholds. Local hand-built fixtures per SPEC's split: all-outside-baseline student; disjoint attempt sets; sparse-evidence newly assessed class; pool > 2 (`ceil`); <2 attempters; <3 roster; all-`N` item; shared-`taskKey` collapse; zero-weight already-`excluded`; zero-evidence variants.

### Delegation mandatory reads

- Testing Specialist: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`, `@src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.composite.ts`
- Code Reviewer: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Acceptance criteria

- Baseline mode recomputes per-student/per-class aggregates for all four metrics from baseline-restricted accumulators; non-baseline tasks keep absolute row values with `false` flags on `PerTaskRow` only.
- Pool/intersection/eligibility/throw behave per decisions 3–5 and 11; **both** ordinary throw scenarios covered (disjoint pool attempt sets; sparse-evidence newly assessed class).
- Excluded/conversion/composite rules per the acceptance matrix; absolute mode unchanged byte-for-byte; `perStudentTaskMetrics` identical across modes.

### Required test cases (Red first)

Frontend tests:

1. `attemptBaselineSelection.spec.ts` (new): candidate derivation (numeric/N/missing/E semantics), pool sizing incl. cap and `ceil`, min-2, tie-break on distinct taskKeys with `studentId` order, intersection, eligibility predicates, descriptive throw — **under both named scenarios**.
2. `averagingAnalyser.filters.spec.ts`: filtering restricts aggregation only; `perTask` flags; `perStudentTaskMetrics` mode-invariance (byte-identical arrays both modes).
3. `averagingAnalyser.rows.excluded.spec.ts` (existing host) + `.rows.spec.ts`/`.metricResolution.spec.ts` as needed: excluded conversion matrix (computed/notAttempted → excluded preserving resolved counts; already-excluded untouched; all-error stays error; no-accumulator student keeps fallback path; `overall` composite summed/`excluded`/`error` cases).
4. Scoping: per-class independence; rollups retain all-accumulator scope in both modes.
5. Absolute-mode regression: unchanged outputs (Section 1's equivalence tests extended to end-to-end analyser calls).

### Section checks

- `npm run test:frontend -- src/services/dataAnalysis`
- `npm run lint:frontend:check`
- Data-shape item 3 reconciled; §9.27.1/.2 flipped to implemented.

### Implementation notes / deviations / follow-up

- Record the exact throw message copy (consumed by the §5 surface error handling).

---

## Section 3 — Heatmap projection: `HeatmapTaskColumn.includedInAttemptBaseline`

### Objective

- Project the flag onto task columns through `buildTaskColumns`' required second parameter, with `adaptMetricsToHeatmap` as the mode-bearing supplier and explicit `null` across the merged chain — including the column-level output sweep.

### Constraints

- `buildTaskColumns(partial, baselineSet: ReadonlySet<string> | null)`; supplier derives from its own `analyserResult` under the fail-fast narrowing rule; merged chain (`buildMergedTaskColumnsInClassOrder` → `buildMergedTaskColumns` → `buildTaskColumns`) passes `null` explicitly; no props change hands anywhere; `HeatmapCell` unchanged.
- Column-level only in v1. The table-level `TaskHeatmapColumn` required-field hop is implemented in §5c but the **instrumentation for it is owned here** where it belongs to the adapter contract — likewise every adapter-typed `MergedHeatmapTaskColumn` literal, since `MergedHeatmapTaskColumn` gains the required field in this section. The hand-built column hosts to update here: `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` (`TASK_COLUMNS`), `src/frontend/src/test/dataAnalysis/heatmapFixtures.ts` (`createHeatmapMergedResult` — merged-column literal), `src/frontend/src/features/taskHeatmap/useHeatmapsPageData.preview.spec.ts:194` (typed `MergedHeatmapResult` literal), `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.merged.spec.tsx` (`taskColumns: MergedHeatmapTaskColumn[]` at `:99`, `:145`, `:202`) and `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.zeroWeight.spec.tsx` (`buildMergedZeroWeightResult(): MergedHeatmapResult` at `:64`). (`heatmapsPipeline.spec.ts:184` builds its merged-result literal as `as unknown as MergedHeatmapResult` — exempt.)

### Shared helper plan

1. `buildTaskColumns`/merged chain — `extend`; owning paths `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` (+ `heatmapAdapter.merged.ts`); register §9.27.4 → status reconciles on delivery.

### Data-shape planning block

- Implement data-shape item 8 as written (supplier = `adaptMetricsToHeatmap`; three-link explicit-null chain); reconcile item 8's status here.

### Canonical fixture note

- `medium` exercises a non-degenerate 7-of-9-key baseline: baseline mode yields `includedInAttemptBaseline: false` columns for the two outside-baseline tasks (class-0/2: `definition-2-slides`; class-1/3: `definition-0-slides`), so baseline column projection with mixed flags is assertable canonically; absolute/merged paths stay all-`true` via the explicit `null`. Surface-level false-marker rendering with local fixtures is §5c work.

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`, `@src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`, `@src/frontend/src/test/taskHeatmapTableTestHelpers.ts`
- Code Reviewer: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Acceptance criteria

- Baseline-mode Class-page projection yields per-column flags from `attemptBaseline.baselineTaskKeys`; absolute/merged paths all `true` via explicit `null`; `adaptMetricsToHeatmap` fails fast on a missing echo.
- Entire tree green (column-level sweep complete).

### Required test cases (Red first)

Frontend tests:

1. `heatmapAdapter.spec.ts`: required second parameter; derived set in baseline; `null` in absolute; fail-fast throw on missing echo.
2. `heatmapAdapter.merged.spec.ts`: merged chain passes explicit `null`; merged columns inherit `true`.
3. `averagingAnalyser.assignmentProcessing.spec.ts:165` (sole direct caller) + `heatmapAdapter.weighting.spec.ts` (import at `:15`; direct calls at `:36` and `:45`; `:82` is an `adaptMetricsToHeatmap` error-message assertion — not a direct call, and not edited for the second parameter): direct callers updated for the required second parameter.

### Section checks

- `npm run test:frontend -- src/services/dataAnalysis`
- `npm run test:frontend -- src`
- `npm run lint:frontend:check`
- Data-shape item 8 reconciled; §9.27.4 flipped.

### Implementation notes / deviations / follow-up

- Note any additional direct `buildTaskColumns` callers discovered.

---

## Section 4 — summary-contract reconciliation + metric-display mode-aware label

### Objective

- Add the mode-aware `excluded` accessible label (`metricTone`/`MetricPill`/`studentAveragesTableColumns`) and reconcile the summary-contract data-shape entry; production pinning and fixture sweeps are already done (Sections 1/3) — this section verifies them as regression only.

### Constraints

- `MetricPill` gains an **optional** `analysisMode` prop; Class-page consumers pass it explicitly (unit assertion on `RecentAssignmentCard` lands in §5b); baseline wording names both causes (zero weighting + outside the baseline); `TaskPreviewCard` untouched; full threading chain per SPEC helper entry 3.
- `assignmentSummaryAnalyser` stays absolute internally (pin landed in Section 1); verify item 5's summary-contract invariants.

### Shared helper plan

1. `metricTone.ts` `EXCLUDED_METRIC_ACCESSIBLE_LABEL` + `MetricPill` consumer — `extend`; register §9.27.3 (label content) → reconciles here; threading completes in §5b.
2. `studentAveragesTableColumns.tsx` label builder — `extend`; completes §9.27.3 in §5b.

### Data-shape planning block

- Reconciles data-shape item 5 (summary contract unchanged; internal delegation pinned absolute — landed in Section 1).
- Item 7's label stance is display-only; reconciles here for the label-content half.

### Canonical fixture note

- Regression verification of the seeded output-side sweeps (SPEC output-side list); no canonical regeneration.

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`, `@src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/services/dataAnalysis/analysers/assignmentSummaryAnalyser.ts`
- Code Reviewer: `@docs/plans/issue-305/SPEC.md`

### Acceptance criteria

- Absolute mode renders today's weighting wording unchanged; baseline-mode aggregate `excluded` announces the two-cause wording (unit-tested at `metricTone` and `MetricPill` levels); summary invariant verified.
- Full frontend unit suite green.

### Required test cases (Red first)

Frontend tests:

1. `metricTone.spec.ts`: baseline wording names both causes; absolute/three-state task-display flow unchanged.
2. `MetricPill.spec.tsx`: mode-conditional label; no prop → weighting wording.
3. `src/frontend/src/services/dataAnalysis/assignmentSummary.spec.ts` (existing host): internal delegation remains `absolute` and public schema untouched; task summaries identical across a baseline-mode caller-supplied mode.

### Section checks

- `npm run test:frontend -- src`
- `npm run lint:frontend:check`
- §9.27.3 label-content half reconciled — full chain in §5b; item 5 reconciled.

### Implementation notes / deviations / follow-up

- Record the final two-cause wording copy (consumed by §5b's label assertions).

---

## Section 5 — Class-page delivery (split for independent testability)

### 5a — Mode control, availability, retention

### Objective

- The hook's mode parameter, retention (previous-render pattern), `baselineAvailability`, the header-slot `Segmented` card, and the state machine wiring.

### Constraints

- **LOC watch (`docs/developer/frontend/frontend-architecture.md`; `src/frontend/AGENTS.md` §2):** projected hook growth: retention state pairs + derived availability + memo dep ≈ +30 lines → `useClassPageData.ts` ≈ 486 (below the 550 trigger); the availability resolver is pre-placed in `useClassPageData.helpers.ts` (register §9.27.5) keeping hook growth to wiring. Measure both files after implementation; if the measured count exceeds 550, decompose **in-change** with the named targets: retention/availability hook beside `useClassPageData.ts` or a region-renderer module beside `ClassPageContent.tsx` ("analysis/orchestration split"; region split).
- Header slot per layout spec: third stacked element, `Card size="small"`, `Flex` (`wrap`, `align="center"`, gap `APP_GAP_SM`), label+control; props `analysisMode`/`onAnalysisModeChange`/`baselineAvailability`; `ClassesPage` passes `key={selectedClassId}` (wired here, asserted in §5b).
- Availability per SPEC decision 6; `reason` single source; live Segmented disabled-tooltip check in this section's red phase (pinned wrapper fallback).
- The interim literal at `useClassPageData.ts:133` is replaced by the hook parameter here.

### Shared helper plan

1. Availability resolver — `extend` into the existing `useClassPageData.helpers.ts` (register §9.27.5's classification: existing helper surface, not a new abstraction) → reconciles on delivery.

### Data-shape planning block

- `ClassPageData.baselineAvailability` is hook-local UI state — no canonical entry (verified); no new schema members.

### Canonical fixture note

- `useClassPageData` hook suites update for the second parameter + availability field; local hand-built fixture states for the full availability table.

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/classPage/useClassPageData.ts`, `@src/frontend/src/features/classPage/useClassPageData.helpers.ts`, `@src/frontend/src/features/classPage/ClassPage.tsx`, `@src/frontend/src/pages/ClassesPage.tsx`, `@src/frontend/src/pages/pageContent.ts`, `@src/frontend/src/features/taskHeatmap/HeatmapSelectionBar.tsx`
- Code Reviewer: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`

### Acceptance criteria

- Toggle re-runs analysis synchronously without refetch; all availability states per decision 6 (incl. dataset-blocked → 'awaiting-data'; remount clears retention); control DOM contract per the recorded decision (aria-labelledby overriding the rc hard-coded label; option tooltips only when enabled); Segmented live-check outcome recorded; hook ≤ measured threshold or decomposed in-change.

### Required test cases (Red first)

Frontend tests:

1. The `useClassPageData` hook spec family — currently split across `useClassPageData.spec.ts` and the `.blocking`/`.memoisation`/`.postAnalysis`/`.assignmentQueries`/`.diagnostics` siblings (new availability/retention cases land in `useClassPageData.spec.ts` or a new adjacent sibling): mode parameter in memo deps; retention previous-render pattern; full availability table (first-success; retention-survives-throw; pre-success blocking incl. dataset-blocked → 'awaiting-data'; ineligible ×2 reasons; optional-metrics-missing → 'awaiting-data'; remount clears); re-run on toggle; no refetch.
2. `ClassesPage` composition assertion: `ClassPage` receives the class-scoped `key` (guaranteed remount reset).
3. `ClassPage`/header component tests: slot in both views + blocking; named props; disabled/tooltip/sr-node DOM contract (always-rendered node, empty when enabled, bound exactly while disabled); aria-labelledby present.

### Section checks

- `npm run test:frontend -- src/features/classPage`
- `npm run lint:frontend:check`
- §9.27.5 reconciled; measured LOC recorded; Segmented live-check outcome noted below.

### Implementation notes / deviations / follow-up

- **Measured LOC:** hook `___`, content `___` (fill); decomposition applied/not applied and why. Segmented disabled-tooltip live check: fired/did-not-fire.

### 5b — Card/table aggregates, label threading, header key

### Objective

- `classPageAdapter` card rule; `analysisMode` threading to `RecentAssignmentCard` and the column builder; the mode-aware labels on the Class-page surfaces.

### Constraints

- Adapter reads `analyserResult.appliedAnalysisMode`; rule: filtered rollup → empty-set fallback conversion → `computeOverallComposite` (SPEC display rules).
- Threading chain: `ClassPage` → `ClassPageContent` → `renderReadyContent` (options object) → `ClassPageReady` → `RecentAssignmentsSection` → `RecentAssignmentCard`; `ClassPageReady` → `StudentAveragesTableCard` → `studentAveragesTableColumns.tsx`.
- **LOC watch:** `ClassPageContent.tsx` projected +≈20 → ≈469; measured in notes; decompose in-change via the named region-renderer module if >550.

### Shared helper plan

- Completes §9.27.3 (threading half; copy home `pageContent.ts` `classDetail` per layout spec).

### Data-shape planning block

- Reconciles data-shape item 6 (downstream aggregate consumers: adapter rule, empty-set conversion, composite; plus the true "no new entry" for `baselineAvailability`).

### Canonical fixture note

- `classPageAdapterTestFixtures.ts` + adapter suites gain baseline-mode/`excluded` cases from local hand-built fixtures (SPEC list). Note: medium-corpus loading in any new spec here follows the `?raw` call-site pattern (deliberate non-shared per the recorded canonicalFixturePrimitives decision).

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/classPage/classPageAdapter.ts`, `@src/frontend/src/features/classPage/ClassPageContent.tsx`, `@src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`, `@src/frontend/src/features/classPage/RecentAssignmentCard.tsx`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/pages/pageContent.ts`
- Code Reviewer: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`

### Acceptance criteria

- Cards/averages recompute per mode; card zero-evidence variant stays `error`; excluded labels mode-aware on cards + students-table `aria-label`; no overview-region layout shift.

### Required test cases (Red first)

Frontend tests:

1. `classPageAdapter.recentAssignments.spec.ts` + `.aggregation.spec.ts`: card filter rule; empty-set fallback conversion; zero-evidence stays `error`; zero-weight already-`excluded` keeps cause.
2. `classPageAdapter.zod.spec.ts`: `appliedAnalysisMode` read; display metrics parse with `excluded`.
3. `RecentAssignmentCard.spec.tsx`: `analysisMode` threading assertion (§9.27.3 unit-assertion host); mode-aware labels.
4. `ClassesPage` remount key assertion (with §5a's wiring).

### Section checks

- `npm run test:frontend -- src/features/classPage`
- `npm run lint:frontend:check`
- §9.27.3 fully reconciled; data-shape item 6 reconciled; measured LOC recorded.

### Implementation notes / deviations / follow-up

- Measured LOC: content `___`; decomposition decision.

### 5c — Embedded heatmap column marking + caption

### Objective

- `TaskHeatmapTable`-level flag, marked headings via the extended zero-weight helpers, merge inheritance, and the caption.

### Constraints

- Required `TaskHeatmapColumn.includedInAttemptBaseline` (sweep owner: Section 3, which also owns the adapter-typed `MergedHeatmapTaskColumn` literals in `TaskHeatmapTable.merged.spec.tsx` and `buildMergedZeroWeightResult()` in `TaskHeatmapTable.zeroWeight.spec.tsx`). The remaining `TaskHeatmapTable`-family specs (`TaskHeatmapTable.spec.tsx`, `.preview.spec.tsx`, `.status.spec.tsx`) build no column literals — they consume `TASK_COLUMNS` — so no literal edits are needed there; §5c owns the marker/caption/edge-class surface work and the assertion updates in the table specs below.
- Visual language + helper signatures per layout spec §4; caption inside `TaskHeatmapTable` beside the existing notice (`role="status"`, `aria-live="polite"`, `type="secondary"`); copy constants beside `taskHeatmapZeroWeightHeader.tsx`.

### Shared helper plan

1. `buildTaskHeaderPresentation`/`getZeroWeightMetricEdgeClass` — `extend` (options-object input; single visual language; composed tooltip/aria-label ordering).

### Data-shape planning block

- No adapter-level change (item 8 done in Section 3); presentation contract stays a TS interface (no data-shape entry).

### Canonical fixture note

- Local hand-built fixtures; the `medium` non-degenerate 7-of-9-key baseline (two `false` columns per class) loads via the call-site `?raw` pattern when useful (deliberate non-sharing per the recorded canonicalFixturePrimitives decision).

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@src/frontend/src/features/taskHeatmap/taskHeatmapZeroWeightHeader.tsx`, `@src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx`
- Code Reviewer: `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`

### Acceptance criteria

- Marked columns render marker + composed tooltip/aria-label; merge inheritance; caption presence/absence live semantics; body-cell edge classes consistent; absolute mode byte-identical presentation.

### Required test cases (Red first)

Frontend tests:

1. `TaskHeatmapTable.spec`-family: marked headings (both helpers extended; composed co-occurrence order); merge flag inheritance; caption presence + live semantics.
2. Updated zero-weight-suite assertions (constants/classes; helper-signature + body-cell DOM assertions per layout spec §4).

### Section checks

- `npm run test:frontend -- src/features/taskHeatmap`
- `npm run lint:frontend:check`

### Implementation notes / deviations / follow-up

- Record any merge/marker edge cases discovered.

### 5d — E2E browser coverage (Playwright)

### Objective

- Browser coverage of the feature's user-visible interaction, per the E2E policy: toggle → aggregate change → toggle back; keyboard/radio semantics; blocking-recovery; screenshots; first-use checks.

### Constraints

- Owner: `Playwright` agent. Named spec: **`src/frontend/e2e-tests/class-page-baseline-mode.spec.ts`** (kebab-case, issue-keyed precedent).
- Scenario extension owned here: `src/frontend/e2e-tests/helpers/task-heatmap-class-fixtures.ts` gains an explicit "students that skip tasks" option so column markers (`false`) become assertable. This module now owns the ten-student scenario (`HEATMAP_STUDENTS`, :33; every student attempts all three `HEATMAP_TASK_IDS` through `buildSubmissionItems(student, hasEmptySubmissions)`, :159) — `task-heatmap-fixtures.ts` no longer holds it. The all-or-nothing `hasEmptySubmissions` switch on `buildClassFullDocument(:179)` is not sufficient: add a per-student/per-task skip option so some students miss some tasks while the rest attempt everything (the default all-submit scenario is degenerately in-baseline — verified).
- Screenshot re-captures stay in `navigation-screenshots.spec.ts` (`class-page-overview`, `task-heatmap`); `heatmaps-builder` baseline must remain unchanged.
- First-use checks: both themes, focus-ring visibility, thumb-motion settled before post-toggle assertions/captures.

### Delegation mandatory reads

- Playwright: `@docs/developer/frontend/frontend-playwright-e2e.md`, `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/e2e-tests/navigation-screenshots.spec.ts`, `@src/frontend/e2e-tests/helpers/task-heatmap-class-fixtures.ts`

### Acceptance criteria

- Toggle behaviour, keyboard interaction, recovery, and column-marker assertions pass; screenshots re-captured deliberately (not tolerance-leaned).

### Required test cases (Red first)

E2E tests:

1. `class-page-baseline-mode.spec.ts`: toggle → aggregates change → toggle back; keyboard radio semantics; recovery path (baseline throw → control reachable → toggle → recovery).
2. Extended fixture option: skip-tasks students → assert baseline-off column marker + caption in the heatmap view.
3. `navigation-screenshots.spec.ts` re-captures; `heatmaps-builder` unchanged assertion.

### Section checks

- `npm run test:frontend:e2e -- e2e-tests/class-page-baseline-mode.spec.ts`
- `npm run test:frontend:e2e -- e2e-tests/navigation-screenshots.spec.ts`

### Implementation notes / deviations / follow-up

- Record the scenario-extension shape and the live Segmented decision if it differs from the recorded one. **Ordering note (deliberate):** the layout spec makes the first-use Segmented checks (both themes, focus ring, thumb motion) "the first implementation step"; they are hosted here in §5d because 5b/5c build their suites on the landed control — 5a's component tests still assert the DOM contract the checks depend on. (SPEC and the layout spec call the antd-source-pin re-verification "§5a's first-use live check" — the same §5a red-phase moment as the disabled-tooltip check; the themes/focus-ring/thumb-motion checks are the §5d-hosted subset. One term, two hosted locations, both deliberate.)

---

## Section 6 — Pedagogy and architecture documentation

### Objective

- Deliver the same-change documentation.

### Constraints

- Delegate to `Docs`; modify only the four documents in SPEC's docs bullet: `docs/pedagogy/data-analysis-scoring.md`, `docs/developer/frontend/data-analysis-architecture.md`, `docs/developer/frontend/navigation-consistency-status.md`, `docs/developer/data-shapes/frontend-data-analysis-response.md`.

### Delegation mandatory reads

- Docs: `@docs/plans/issue-305/SPEC.md`, `@docs/plans/issue-305/ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@docs/plans/issue-305/ACTION_PLAN.md`, the four document targets above, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

- Teacher-facing mode explanation (what changes, what stays absolute); pipeline placement named post-accumulation; data-shape items 1–8 statuses finalised; §9.27 entries reconciled; navigation tracker records the third always-rendered header element.

### Required checks

1. `npm run lint:frontend:check` (no doc-driven code drift)
2. Planned-entry reconciliation complete (no stale `Not implemented` on delivered items; the out-of-v1 generator-extension plan stays recorded as deferred).

### Section checks

- All statuses reconciled; deviations notes filled.

### Implementation notes / deviations / follow-up

- Fill during delivery.

---

## Section 7 — Regression and contract hardening

### Objective

- Prove absolute equivalence, contract safety, E2E visual stability, and three-document consistency end-to-end.

### Constraints

- Prefer focused runs, then the full gate; `Docs` and `Playwright` carry the final reconciliation/checking reads.

### Delegation mandatory reads

- Docs: `@docs/plans/issue-305/SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- Playwright: `@docs/developer/frontend/frontend-playwright-e2e.md`, `@src/frontend/e2e-tests/class-page-baseline-mode.spec.ts`

### Acceptance criteria

- Full local gate green; committed fixtures unchanged (byte-for-byte regeneration check); no regression in touch-free suites.

### Required test cases/checks

1. `npm run run-all-checks`
2. `npm run test:synthetic -- syntheticCommittedFixtureRegeneration`
3. Full E2E targets per §5d
4. Three-document consistency pass: SPEC decisions ↔ data-shape items ↔ §9.27 entries (`Docs` reconciliation).

### Section checks

- Gate green; deviations recorded.

### Implementation notes / deviations / follow-up

- Fill during delivery.

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
