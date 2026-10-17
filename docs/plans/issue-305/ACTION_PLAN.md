# Feature Delivery Plan (TDD-First) — Attempt-Baseline Analysis Mode (issue #305)

## Read-First Context

Before writing or executing this plan:

1. Read `@SPEC.md` — product behaviour, contracts, decisions 1–9, display rules, fixture strategy, and scope boundaries.
2. Read `@ATTEMPT_BASELINE_MODE_LAYOUT.md` — header-slot composition, control states, heatmap column marking, accessibility rules.
3. Read `@docs/developer/data-shapes/frontend-data-analysis-response.md` — the "Planned contract additions (Not implemented, issue #305)" block (items 1–8) is the target contract this plan implements and reconciles.
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
4. Canonical synthetic fixtures support scoring at pool min 2, tie-break ordering, echo/flags, E-condition attempts, and eligibility thresholds; every other behavioural case uses local hand-built fixtures per SPEC's fixture paragraph (no generator changes in v1).
5. Between Sections 1 and 4 the whole test tree stays green — no section leaves red suites behind (the blast-radius sweep exits with Section 1).

---

## Global constraints and quality gates

### Engineering constraints

- No un-instructed defaults: `analysisMode` is required at all five non-test input construction sites and in test fixtures via the shared builder fix point; `attemptBaseline` narrowing is fail-fast; `buildTaskColumns`' second parameter is required (explicit `null` for absolute); `TaskHeatmapColumn.includedInAttemptBaseline` is required.
- Absolute-mode output stays byte-identical to current behaviour except the `appliedAnalysisMode: 'absolute'` echo and `includedInAttemptBaseline: true` flags (SPEC decision 7).
- Frontend files crossing 550 lines must decompose in-change (`src/frontend/AGENTS.md` §15): watch `useClassPageData.ts` (498) and `ClassPageContent.tsx` (449); §5 records projected and measured counts.
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

### Objective

- Add the required `analysisMode` to the analysis filter; the `appliedAnalysisMode`/`attemptBaseline` echo block; `PerTaskRowSchema.includedInAttemptBaseline`; the named `AnalysisMode` enum export — **and own every blast-radius consequence so Sections 2–5 never inherit a red tree**:
  1. **Test-builder fix point:** `buildInput()`/`buildSingleStudentInput()` in `src/frontend/src/test/dataAnalysis/fixtures.ts` gain `analysisMode: 'absolute'` once (constructor-like scope, root `AGENTS.md` §2.1.10).
  2. **Literal input-construction sites** (all fail the moment the field is required): `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts` (`AnalysisFilterSchema.parse({ classIds: [...] })`), `src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts:132`, `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.spec.ts` (six occurrences, first at `:84`), `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts:241` and `:490`, `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts:469`, `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.metricResolution.spec.ts:460` (`AveragingAnalyserInputSchema.parse` direct), `src/frontend/src/features/taskHeatmap/useHeatmapsPageData.spec.ts` (`:358/361` filter `toEqual` assertions must include the default `'absolute'`), and `tests/synthetic-analysis/syntheticApiRoundTripBridge.test.ts:162`.
  3. **Four non-hook production sites pinned `'absolute'`** with literal values (their final state anyway — zero behavioural risk moved earlier): `heatmapsPipeline.ts:128`, `useHeatmapSelectionSummary.ts:46`, `TaskHeatmapPage.tsx:137`, `analysers/assignmentSummaryAnalyser.ts:138` (internal delegation, inside the analyse call at `:137–141`).
  4. **Named interim literal** at `useClassPageData.ts:140` (`'absolute'`) — replaced by the section-5a hook parameter, tracked in that section's notes.
  5. **Row-level output sweep** (fixtures building `PerTaskRow`): `src/frontend/src/test/dataAnalysis/fixtures.ts`, inline row literal specs (`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.result.spec.ts`, `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.parity.spec.ts`, the adapter-side row fixtures in `src/frontend/src/test/classPage/classPageAdapterTestFixtures.ts`).

### Constraints

- Frontend-only validation change; no transport or persistence (SPEC §Planned contract additions).
- `attemptBaseline` stays optional on the result; the narrowing fail-fast rule is schema-tested here and consumer-enforced from Section 2.
- `PerStudentTaskMetric` carries **no** flag.

### Shared helper plan

1. `AnalysisModeSchema`/`AnalysisMode` — `new` (schema enum in `dataAnalysis.zod.ts`); canonical doc target: data-shape items 1/4.
2. Medium synthetic-corpus loading — **follows the established call-site `?raw` pattern** (deliberate, per the recorded decision in `src/frontend/src/test/shared/canonicalFixturePrimitives.ts`'s `@remarks`: record loading stays at the call site and is deliberately not shared; the `@synthetic/*` alias exists only in the E2E TS layer and is not resolvable from the Vitest app project). Sections 1 and 2 import the committed `medium` views at their own call sites per `averagingAnalyser.metricResolution.spec.ts:6–8` precedent — no shared loader is created.
3. `buildInput`/`buildSingleStudentInput` — `extend` (`src/frontend/src/test/dataAnalysis/fixtures.ts`).

### Data-shape planning block

- Implement data-shape doc items 1–4 exactly as recorded (filter field, echo block, row flag, narrowing rule); remove `Not implemented` markers from items 1–4 as delivered. Item 5 (summary contract) lands its implementation in Section 1 via the `analysers/assignmentSummaryAnalyser.ts:138` pin and is reconciled in Section 4.

### Canonical fixture note

- The **bridge stays on `small`** (hard-coded `SMALL_PROFILE` in `syntheticApiRoundTripBridge.test.ts:28–42`) and merely gains the explicit `analysisMode: 'absolute'`. The **`medium` echo/flag round-trip gets a named host**: a new spec under `src/frontend/src/services/dataAnalysis/` loading the committed `medium` views via the call-site `?raw` pattern (helper entry 2's recorded approach). Canonical claims covered: pool sizing 2, tie-break pool-array order, E-condition candidacy, eligibility thresholds — reused by Section 2 identically. No canonical regeneration (byte-for-byte policy); all other cases local hand-built.

### Delegation mandatory reads

- Testing Specialist: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`, `@src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`, `@src/frontend/src/services/dataAnalysis/analysers/assignmentSummaryAnalyser.ts`, `@src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts`, `@src/frontend/src/features/taskHeatmap/useHeatmapSelectionSummary.ts`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapPage.tsx`, `@src/frontend/src/features/classPage/useClassPageData.ts`
- Code Reviewer: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Acceptance criteria

- `AnalysisFilterSchema` rejects an input without `analysisMode`; accepts both enum values; result echo/block parse per items 1–4.
- Absolute-mode result: `appliedAnalysisMode: 'absolute'`, no `attemptBaseline`, `includedInAttemptBaseline: true` on every `PerTaskRow`; otherwise byte-identical.
- Entire frontend + synthetic test trees green at section end (sweep complete).
- `npm run run-all-checks` green (first full-gate checkpoint).

### Required test cases (Red first)

Frontend tests:

1. `dataAnalysis.zod.spec.ts`: filter without `analysisMode` fails; both values pass; strictObject rejects unknown keys; result-echo block shape (`poolStudentIds` min 2, `baselineTaskKeys` min 1).
2. `dataAnalysis.zod.result.spec.ts` + `buildCellPreviewLookup.parity.spec.ts`: absolute result parses with echo/row flags; adapter-input fixtures parse with flags.
3. `averagingAnalyser.spec.ts`: absolute-mode byte-equivalence vs current behaviour plus echo/flags.
4. Bridge: `small` + explicit `'absolute'` round-trips end-to-end.
5. Medium round-trip (call-site `?raw` load in a new spec under `src/frontend/src/services/dataAnalysis/` — no shared loader, per helper entry 2): `medium` result with echo/flags through the service schema.
6. Narrowing rule at schema level: documented consumer contract (tested fully at analyser level in Section 2).

### Section checks

- `npm run test:frontend -- src/services/dataAnalysis`
- `npm run test:frontend -- src`
- `npm run test:synthetic -- syntheticApiRoundTripBridge`
- `npm run lint:frontend:check`
- Shared-helper/data-shape statuses reconciled for items 1–4 (+5 partial).

### Implementation notes / deviations / follow-up

- Record the interim literal key for §5a; record any additional literal sites discovered during the sweep.

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

- Canonical synthetic-corpus fixtures are loaded at call sites via the established `?raw` pattern (Section 1 helper entry 2). `medium` claims covered here: pool sizing 2, tie-break (pool-array order asserted explicitly — indices 0/2 tied at 9), E-condition candidacy evidence (roster index 1: zero attempts despite participating), eligibility thresholds. Local hand-built fixtures per SPEC's split: all-outside-baseline student; disjoint attempt sets; sparse-evidence newly assessed class; pool > 2 (`ceil`); <2 attempters; <3 roster; all-`N` item; shared-`taskKey` collapse; zero-weight already-`excluded`; zero-evidence variants.

### Delegation mandatory reads

- Testing Specialist: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`, `@src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`, `@src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.composite.ts`
- Code Reviewer: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Acceptance criteria

- Baseline mode recomputes per-student/per-class aggregates for all four metrics from baseline-restricted accumulators; non-baseline tasks keep absolute row values with `false` flags on `PerTaskRow` only.
- Pool/intersection/eligibility/throw behave per decisions 3–4; **both** ordinary throw scenarios covered (disjoint pool attempt sets; sparse-evidence newly assessed class).
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
- Column-level only in v1. The table-level `TaskHeatmapColumn` required-field hop is implemented in §5c but the **instrumentation for it is owned here** where it belongs to the adapter contract: `taskHeatmapTableTestHelpers.ts` (`TASK_COLUMNS`) and the heatmap fixture modules are updated in this section.

### Shared helper plan

1. `buildTaskColumns`/merged chain — `extend`; owning paths `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` (+ `heatmapAdapter.merged.ts`); register §9.27.4 → status reconciles on delivery.

### Data-shape planning block

- Implement data-shape item 8 as written (supplier = `adaptMetricsToHeatmap`; three-link explicit-null chain); reconcile item 8's status here.

### Canonical fixture note

- No canonical needs; `medium` exercises all-true columns in baseline (degenerate full set). Column-`false` coverage is §5c surface work with local fixtures.

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`, `@src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`, `@src/frontend/src/test/taskHeatmapTableTestHelpers.ts`
- Code Reviewer: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`

### Acceptance criteria

- Baseline-mode Class-page projection yields per-column flags from `attemptBaseline.baselineTaskKeys`; absolute/merged paths all `true` via explicit `null`; `adaptMetricsToHeatmap` fails fast on a missing echo.
- Entire tree green (column-level sweep complete).

### Required test cases (Red first)

Frontend tests:

1. `heatmapAdapter.spec.ts`: required second parameter; derived set in baseline; `null` in absolute; fail-fast throw on missing echo.
2. `heatmapAdapter.merged.spec.ts`: merged chain passes explicit `null`; merged columns inherit `true`.
3. `averagingAnalyser.assignmentProcessing.spec.ts` + `heatmapAdapter.weighting.spec.ts` (:14/:23): direct callers updated for the required second parameter.

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
- Implementation: `@SPEC.md`, `@src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`, `@src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/services/dataAnalysis/analysers/assignmentSummaryAnalyser.ts`
- Code Reviewer: `@SPEC.md`

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

- **LOC watch (§15):** projected hook growth: retention state pairs + derived availability + memo dep ≈ +30 lines → `useClassPageData.ts` ≈ 528 (below the 550 trigger); the availability resolver is pre-placed in `useClassPageData.helpers.ts` (register §9.27.5) keeping hook growth to wiring. Measure both files after implementation; if the measured count exceeds 550, decompose **in-change** with the named targets: retention/availability hook beside `useClassPageData.ts` or a region-renderer module beside `ClassPageContent.tsx` ("analysis/orchestration split"; region split).
- Header slot per layout spec: third stacked element, `Card size="small"`, `Flex` (`wrap`, `align="center"`, gap `APP_GAP_SM`), label+control; props `analysisMode`/`onAnalysisModeChange`/`baselineAvailability`; `ClassesPage` passes `key={selectedClassId}` (wired here, asserted in §5b).
- Availability per SPEC decision 6; `reason` single source; live Segmented disabled-tooltip check in this section's red phase (pinned wrapper fallback).
- The interim literal at `useClassPageData.ts:140` is replaced by the hook parameter here.

### Shared helper plan

1. Availability resolver — `extend` into the existing `useClassPageData.helpers.ts` (register §9.27.5's classification: existing helper surface, not a new abstraction) → reconciles on delivery.

### Data-shape planning block

- `ClassPageData.baselineAvailability` is hook-local UI state — no canonical entry (verified); no new schema members.

### Canonical fixture note

- `useClassPageData` hook suites update for the second parameter + availability field; local hand-built fixture states for the full availability table.

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`
- Implementation: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/classPage/useClassPageData.ts`, `@src/frontend/src/features/classPage/useClassPageData.helpers.ts`, `@src/frontend/src/features/classPage/ClassPage.tsx`, `@src/frontend/src/pages/ClassesPage.tsx`, `@src/frontend/src/pages/pageContent.ts`, `@src/frontend/src/features/taskHeatmap/HeatmapSelectionBar.tsx`
- Code Reviewer: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`

### Acceptance criteria

- Toggle re-runs analysis synchronously without refetch; all availability states per decision 6 (incl. dataset-blocked → 'awaiting-data'; remount clears retention); control DOM contract per the recorded decision (aria-labelledby overriding the rc hard-coded label; option tooltips only when enabled); Segmented live-check outcome recorded; hook ≤ measured threshold or decomposed in-change.

### Required test cases (Red first)

Frontend tests:

1. `useClassPageData.spec.ts` (5 suites): mode parameter in memo deps; retention previous-render pattern; full availability table (first-success; retention-survives-throw; pre-success blocking incl. dataset-blocked → 'awaiting-data'; ineligible ×2 reasons; optional-metrics-missing → 'awaiting-data'; remount clears); re-run on toggle; no refetch.
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
- Implementation: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/classPage/classPageAdapter.ts`, `@src/frontend/src/features/classPage/ClassPageContent.tsx`, `@src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`, `@src/frontend/src/features/classPage/RecentAssignmentCard.tsx`, `@src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, `@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, `@src/frontend/src/pages/pageContent.ts`
- Code Reviewer: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`

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

- Required `TaskHeatmapColumn.includedInAttemptBaseline` (sweep owner: Section 3; the hand-built column hosts updated here: `TaskHeatmapTable.spec.tsx`, `.preview.spec.tsx`, `.status.spec.tsx`, `.merged.spec.tsx`, `.zeroWeight.spec.tsx`).
- Visual language + helper signatures per layout spec §4; caption inside `TaskHeatmapTable` beside the existing notice (`role="status"`, `aria-live="polite"`, `type="secondary"`); copy constants beside `taskHeatmapZeroWeightHeader.tsx`.

### Shared helper plan

1. `buildTaskHeaderPresentation`/`getZeroWeightMetricEdgeClass` — `extend` (options-object input; single visual language; composed tooltip/aria-label ordering).

### Data-shape planning block

- No adapter-level change (item 8 done in Section 3); presentation contract stays a TS interface (no data-shape entry).

### Canonical fixture note

- Local hand-built fixtures; the `medium` all-true case loads via the call-site `?raw` pattern when useful (deliberate non-sharing per the recorded canonicalFixturePrimitives decision).

### Delegation mandatory reads

- Testing Specialist: `@docs/developer/frontend/frontend-testing.md`
- Implementation: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx`, `@src/frontend/src/features/taskHeatmap/taskHeatmapZeroWeightHeader.tsx`, `@src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx`
- Code Reviewer: `@ATTEMPT_BASELINE_MODE_LAYOUT.md`

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
- Scenario extension owned here: `src/frontend/e2e-tests/helpers/task-heatmap-fixtures.ts` gains an explicit "students that skip tasks" option so column markers (`false`) become assertable (the default all-submit scenario is degenerately in-baseline — verified).
- Screenshot re-captures stay in `navigation-screenshots.spec.ts` (`class-page-overview`, `task-heatmap`); `heatmaps-builder` baseline must remain unchanged.
- First-use checks: both themes, focus-ring visibility, thumb-motion settled before post-toggle assertions/captures.

### Delegation mandatory reads

- Playwright: `@docs/developer/frontend/frontend-playwright-e2e.md`, `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@src/frontend/e2e-tests/navigation-screenshots.spec.ts`, `@src/frontend/e2e-tests/helpers/task-heatmap-fixtures.ts`

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

- Record the scenario-extension shape and the live Segmented decision if it differs from the recorded one. **Ordering note (deliberate):** the layout spec makes the first-use Segmented checks (both themes, focus ring, thumb motion) "the first implementation step"; they are hosted here in §5d because 5b/5c build their suites on the landed control — 5a's component tests still assert the DOM contract the checks depend on.

---

## Section 6 — Pedagogy and architecture documentation

### Objective

- Deliver the same-change documentation.

### Constraints

- Delegate to `Docs`; modify only the four documents in SPEC's docs bullet: `docs/pedagogy/data-analysis-scoring.md`, `docs/developer/frontend/data-analysis-architecture.md`, `docs/developer/frontend/navigation-consistency-status.md`, `docs/developer/data-shapes/frontend-data-analysis-response.md`.

### Delegation mandatory reads

- Docs: `@SPEC.md`, `@ATTEMPT_BASELINE_MODE_LAYOUT.md`, `@ACTION_PLAN.md`, the four document targets above, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

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

- Docs: `@SPEC.md`, `@docs/developer/data-shapes/frontend-data-analysis-response.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
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
