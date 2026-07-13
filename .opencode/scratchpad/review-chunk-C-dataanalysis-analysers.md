# Code Review — Frontend dataAnalysis Analysers + zod + fixtures

**Scope:** `feat/ReactFrontend...HEAD` diff for 11 files under `src/frontend/src/services/dataAnalysis/analysers` and `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` plus the shared fixture `src/frontend/src/test/dataAnalysis/fixtures.ts`.

**Mandatory docs read:** `AGENTS.md`, `src/frontend/AGENTS.md`, `docs/developer/frontend/frontend-testing.md`, `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `docs/developer/frontend/metric-display-precision.md`, `docs/developer/frontend/metric-icon-display.md`, `docs/developer/frontend/frontend-logging-and-error-handling.md`.

**Automated checks:**

- `npm exec tsc -- -b src/frontend/tsconfig.json` → **PASS** (exit 0)
- `npx eslint <11 in-scope files>` → **PASS** (exit 0; no `console`, no `any`, no unused)
- `npm run test:frontend -- src/services/dataAnalysis/analysers src/services/dataAnalysis/dataAnalysis.zod.spec.ts` → **114 tests PASS** (7 files)

---

## Summary

**Verdict: PASS** (no blocking issues). All in-scope automated checks pass, the production code is type-safe, lint-clean, correctly implements the intended rollup precedence change, and includes a genuine latent bug fix. There are no `console.*` calls, no empty `catch` blocks, no implicit `any`, no backend imports, files are under 500 lines, exports are function declarations, and British English is used throughout. Two non-blocking items below (stale RED/GREEN comments and a test-only default-value nitpick) should be tidied but do not block merge.

> Note (out of scope, flagged for awareness): running the _whole_ `dataAnalysis` folder surfaces 9 failures in `metricDisplay/metricTone.spec.ts` and `metricDisplay/MetricPill.spec.tsx`. These are **not** in this review's file list, do not import or depend on the changed analyser/zod/fixtures code, and concern colour-gradient lightness values (`34%` vs `38%`). They are pre-existing/independent of this diff and are not counted against this verdict.

---

## Critical

None.

---

## Improvement

### IMP-1 (Tests): Stale "RED phase / GREEN phase / will FAIL in the Red phase / does not yet exist in production" comments now misdescribe the code

The diff implements the features these tests were originally written against in a TDD red→green cycle. The accompanying comments still assert that the functionality is _missing_ or that assertions _will fail_ — which is now false. They actively mislead a future maintainer reading the suite.

Representative in-scope locations:

- `src/frontend/src/services/dataAnalysis/analysers/perStudentTaskMetrics.spec.ts` — lines 13, 54, 117, 174 ("RED phase: perStudentTaskMetrics is undefined", "does not yet exist in production").
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts` — lines 87, 281, 333, 532, 533.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts` — lines 33, 95, 103, 114, 155, 196, 254, 315, 367, 438, 927.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts` — lines 269, 318, 382, 578, 615, 616.
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts` — lines 648, 655, 711, 728–729, 736–738, 756.

Recommendation: strip the phase annotations ("RED phase", "GREEN phase", "will FAIL in the Red phase", "does not yet exist in production", "currently private") from these comments now that the behaviour is implemented and the assertions pass. Keep the descriptive part of each comment where it still adds value.

---

## Nitpick

### NIT-1 (Test helper): Default parameters added to `createTaskPartial`

`src/frontend/src/test/dataAnalysis/fixtures.ts` — `createTaskPartial(taskId, taskWeighting = 1, taskTitle = null)` introduces a new `taskTitle = null` default. Core principle #7 / frontend §13 prefer no defaults unless instructed, and the new `taskTitle = null` default is unnecessary (all call sites pass `taskTitle` explicitly or accept the literal). The other defaults here (`taskWeighting = 1`, `definitionKey = 'dk_algebra'`, `assignmentWeighting = 1`, `primaryTopicKey = 'algebra'`, `className = 'Test Class'`, `studentIds = []`) are pre-existing test-fixture convention.

This is test-only and low severity, but the newly-added `taskTitle = null` default should ideally be removed (pass `null` at the one or two call sites that need it) to stay consistent with the "no defaults unless instructed" rule. Not blocking.

---

## Positive findings (not issues)

- **Latent bug fixed — `task.id` → `task.taskId`:** `averagingAnalyser.accumulation.ts` `preRegisterTasks` and `accumulateDataPoints` previously read `task.id`, but the `TaskPartial` schema (`src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`) uses `taskId`. The old loose inline type `{ id: string }` masked this; the new code aligns with the real schema field (`import type { TaskPartial }`). This is a correct, behaviour-changing fix and the fixtures were updated in lockstep (`createTaskPartial` now emits `taskId`).
- **Rollup precedence change is intentional, documented, and tested:** `rollupMetric` now treats `error` entries as _excluded_ at aggregation levels (result is `error` only when **every** input is `error`), matching `computeOverallComposite` and the `MetricResult` schema doc comment. All three locations (rollupMetric.ts, averagingAnalyser.accumulation.ts `computeOverallComposite`, dataAnalysis.zod.ts) updated their JSDoc consistently. 27 `rollupMetric` tests (incl. `describe.each` across the three criteria) and the `computeOverallComposite` metadata-aggregation tests pass.
- **`perStudentTaskMetrics` wiring is correct:** `AveragingResultSchema` gained an optional `perStudentTaskMetrics: z.array(PerStudentTaskMetricSchema)`, `averagingAnalyser.ts` populates it via the new `buildPerStudentTaskMetrics`, and the function deterministically sorts by `studentId` then `taskKey`. The empty-per-(student,task) fallback in `analyseClass` correctly delegates to `rollupAccumulators([accumulators.classAccum])`, so `rollupMetric` is never invoked with an empty array (its fail-fast `throw` is preserved).
- **`accumToMetric` output conforms to `MetricResult`:** `totalDataPoints` is tracked for both numeric and `'N'` scores in `criterionAccumulation`, so `notAttempted`/`error` branches always satisfy the `MetricResultSchema` invariants (`totalDataPoints >= 1` for notAttempted, `= 0` for error).
- **DRY/WET and abstraction:** the shared `rollupMetric` / `computeOverallComposite` helpers are reused (not duplicated) by `buildPerStudentRows`, `buildPerTaskRows`, and `averagingAnalyser.ts`, consistent with `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17. No cross-module DRY violations, no speculative new abstractions.
- **Functions exported as functions** (not arrow-constant exports) across `rollupMetric.ts`, `averagingAnalyser.ts`, `averagingAnalyser.accumulation.ts`, `fixtures.ts`; the `*.zod.ts` const schema exports are the idiomatic Zod pattern (values, not functions) and are correctly excluded from that rule.

---

## Checklist outcomes (in-scope focus)

- [x] No `console.*` in any active source file (ESLint enforced; 0 matches)
- [x] No empty `catch` blocks
- [x] British English in comments/identifiers (`analyse`, `behaviour`-consistent)
- [x] No speculative scope beyond the explicit request
- [x] `dataAnalysis.zod.ts` derives types via `z.infer<>` from the schema (§9 frontend)
- [x] No default values introduced in production code; `DEFAULT_CRITERION_WEIGHTINGS` set in `AveragingAnalyser` constructor only (test-only default in NIT-1 is the sole exception, low severity)
- [x] Files ≤ 500 lines (largest in scope: `averagingAnalyser.accumulation.ts` = 465; `rollupMetric.ts` = 247; `dataAnalysis.zod.ts` = 220)
- [x] TypeScript: no implicit `any`; explicit types on public interfaces (tsc `-b` clean)
- [x] No imports from `src/backend/`
- [x] Functions exported as functions, not arrow-constant exports
- [x] Tests assert behavioural outcomes (MetricResult state/value/metadata), are hermetic (no `google.script.run`), and reuse shared fixtures (`fixtures.ts`) and `averagingAnalyserAssertions.ts` per `frontend-testing.md`
