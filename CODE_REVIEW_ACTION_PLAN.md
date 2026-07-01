# Code Review Remediation Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `CODE_REVIEW.md` — source of truth for the 26 findings to address.
2. Read `SPEC_CLASS_PAGE_PREPARATION.md` — the product spec; its boundary rules and contracts override any implementation assumption.
3. Read `ACTION_PLAN.md` — the original feature delivery plan (preserved; not overwritten).
4. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
5. Use this action plan to sequence remediation and testing; do not restate material already settled in the spec.

## Scope and assumptions

### Scope

- All 6 CRITICAL findings in `CODE_REVIEW.md`.
- All 8 MAJOR findings in `CODE_REVIEW.md`.
- All 4 MINOR findings in `CODE_REVIEW.md`.
- All 6 test coverage gaps identified in `CODE_REVIEW.md`.
- Frontend source and test files under `src/frontend/src/services/dataAnalysis/` and `src/frontend/src/test/dataAnalysis/`.
- One test-setup file: `src/frontend/src/test/setup.ts` (MINOR-4).

### Out of scope

- The Class page itself (owned by `SPEC_CLASS_PAGE.md` and a separate action plan).
- Shell / routing / feature-level changes outside the data analysis service.
- Builder scripts or backend files (the review findings are frontend-only).
- Adding new product features; this is remediation only.

### Assumptions

1. **CRITICAL-3 metadata aggregation:** The spec does not define how `computeOverallComposite` should aggregate `totalWeight`, `applicableDataPoints`, and `totalDataPoints` across criteria. The user confirmed the desired semantics is **sum** (not `Math.max`). This plan treats that as a spec amendment and implements sum-based aggregation.
2. **CRITICAL-2 dual paths:** Unifying the per-class rollup to always use `rollupMetric` (removing the `accumToMetric(classAccum)` fallback) is the correct fix. The fallback was a short-circuit that produced semantically different results.
3. **CRITICAL-5 `rollupAccumulators` reuse:** The `rollupAccumulators` function in `averagingAnalyser.rows.ts` is currently private. It must be exported for reuse in `averagingAnalyser.ts` `analyseClass`.
4. **CRITICAL-6 single-pass `rollupMetric`:** The 4-5-iteration-per-call pattern is fused into a single pass with early-exit precedence logic (error > notAttempted > computed, with per-metric notAttempted handling). This is a structural rewrite of `rollupMetric`, which subsumes MAJOR-1 and MAJOR-2 (the structural twin consolidation).
5. **MAJOR-5 redundant validation:** The 65-line `validateSubTasks` function in `rollupMetric.ts` is redundant because Zod guarantees structural validity at the analyser boundary. It is removed (replaced by the empty-array guard only).
6. **MAJOR-4 file-size threshold:** `averagingAnalyser.accumulation.ts` is currently 649 lines, already above the 550-line threshold. The CRITICAL-3 fix alone does not grow it; the fix swaps `Math.max` for sum which is a same-line-count change. However, the review finding requires addressing the over-threshold state. Criterion-accumulation logic is extracted to a new module `averagingAnalyser.criterionAccumulation.ts` to bring the file under 550 lines.
7. **MAJOR-6 reverse index:** The reverse index in `buildPerTaskRows` (lines 135-143) is replaced by direct iteration over `perStudentTaskAccums`.
8. **MAJOR-7 temporary arrays:** The three intermediate `MetricResult[]` arrays in `analyseClass` are eliminated by feeding accumulators directly into `rollupAccumulators` (or the single-pass equivalent).
9. **MAJOR-8 and MINOR-1:** "color" → "colour" in `metricTone.ts` JSDoc and the JSDoc table boundary update are bundled with CRITICAL-1 since they touch the same file.
10. **MINOR-4 linter suppression rationale:** The existing code-quality suppression at `setup.ts:119` is for the `security/detect-object-injection` rule on CSS property names in a test double. The suppression is justified (CSS property names are not user-controlled; the object-injection rule is a false positive here), but the code review finding is that the inline rationale should explain _why_ the suppression is safe rather than merely citing the rule name. The fix adds a rationale comment to the existing justified suppression — no new rule suppressions are introduced, and the existing one is not widened.
11. **MAJOR-3 fixture builder consolidation:** The three separate builders (`createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult`) are unified into a single parameterised `createMetricResult(state, overrides?)` with thin wrappers preserving the existing names as convenience aliases (backward compatibility).

---

## Global constraints and quality gates

### Engineering constraints

- Follow `src/frontend/AGENTS.md` and root `AGENTS.md`.
- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs; no defensive guards that hide wiring issues.
- No speculative scope expansion beyond the 26 findings + 6 test gaps.
- Use British English in comments, docs, and user-facing text.
- Default values live in function signatures or constructors only.
- Lint rules are not turned off without express permission. The MINOR-4 fix adds rationale to an existing justified suppression; it does not add new suppressions.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase:

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests (targeted): `npm run test:frontend -- <target>`
- Frontend unit tests (all data analysis): `npm run test:frontend -- src/frontend/src/services/dataAnalysis/ src/frontend/src/test/dataAnalysis/`
- Frontend unit tests (all): `npm run test:frontend`

---

## Section 1 — Boundary bug fix (`metricTone.ts` amber/green boundary + British English + JSDoc table) ✅ COMPLETE

### Objective

Fix CRITICAL-1: `metricTone.ts:69` uses `>` instead of `>=` for the amber/green boundary comparison, causing the spec's explicitly defined boundary value to be misclassified. Fix MAJOR-8: normalise "color" → "colour" in JSDoc at lines 5 and 53. Fix MINOR-1: update the JSDoc boundary table to reflect the corrected `>=` semantics.

### Completion summary

- CRITICAL-1: `>` → `>=` at line 73 of `metricTone.ts` (function `resolveComputedColor`).
- MAJOR-8: "color" → "colour" in JSDoc at lines 5 and 32 of `metricTone.ts`.
- MINOR-1: JSDoc boundary table updated at lines 95-96 to use `≤ value <` and `value ≥`.
- Added `@remarks` block on `resolveComputedColor` documenting the `>=` boundary rule.
- Red-phase: 2 new boundary tests + 1 corrected complicit test in `metricTone.spec.ts`.
- Green-phase: all 1264 tests pass; lint green.
- Regression gate: zero regressions from baseline.

### Constraints

- The spec (`SPEC_CLASS_PAGE_PREPARATION.md:287`) says `value ≥ (lower + 3·upper) / 4` yields green. The code must match.
- The boundary formula itself (`(range.lower + QUARTILE_WEIGHT * range.upper) / QUARTILE_DENOMINATOR`) is correct; only the comparison operator (`>` → `>=`) changes.
- The test at `metricTone.spec.ts:46` currently expects `gold` at `value = 3.75` (the boundary value); it must be updated to expect `green`. A new test for the amber side of the boundary is also required.
- British English only in JSDoc and comments.
- No behaviour change for any non-boundary value.

### File separation by LOC

| File                 | Current LOC | Projected LOC | Action                                                                                                                                             |
| -------------------- | ----------: | ------------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metricTone.ts`      |         146 |          ~146 | Change `>` to `>=` at line 69; fix "color" → "colour" in JSDoc at lines 5, 53; update JSDoc table at line 92. No LOC growth. No separation needed. |
| `metricTone.spec.ts` |         157 |          ~170 | Add boundary-value tests; update existing boundary expectation. Under 550; no separation needed.                                                   |

No file is projected to exceed 550 lines. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC_CLASS_PAGE_PREPARATION.md` lines 280-297 (tone resolution rules)
- `CODE_REVIEW.md` CRITICAL-1, MAJOR-8, MINOR-1
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.spec.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist, plus:
- `CODE_REVIEW.md` (full, for context on all findings)
- `SPEC_CLASS_PAGE_PREPARATION.md` (full)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` CRITICAL-1, MAJOR-8, MINOR-1
- `SPEC_CLASS_PAGE_PREPARATION.md:286-287`

### Acceptance criteria

- `metricTone.ts:69` uses `>=` for the amber/green comparison (not `>`).
- The JSDoc boundary table at line 92 shows `value ≥ (lower + 3·upper) / 4` → `green`.
- JSDoc at lines 5 and 53 uses "colour" (not "color").
- All existing tests continue to pass (with the boundary test expectation corrected).
- New test: `value === amberGreenBoundary` expects `green`.
- New test: `value` just below `amberGreenBoundary` (e.g. 3.74 for default range) expects `gold` (amber side of the boundary).
- The existing test at line 46 ("returns gold for computed value at the amber/green edge (amber side inclusive)") is corrected to expect `green` and renamed to describe the green-side boundary semantics.

### Required test cases (Red first)

Frontend tests:

1. Test: `value === amberGreenBoundary` (3.75 for default range `{0,5}`) → `green` (corrects the existing complicit test at line 46).
2. Test: `value` just below `amberGreenBoundary` (3.74) → `gold` (confirms amber side).
3. Test: `value` just above `redAmberBoundary` (1.26) → `gold` (confirms amber side of the lower boundary, already covered but verified).
4. Custom range boundary test: confirm the `>=` semantics hold for a non-default range.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay/` — green.
- `npm run lint:frontend` — green.
- Coverage gap 1 addressed.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note on `resolveComputedColor` stating that the amber/green comparison uses `>=` per the spec boundary rule (line 287 of `SPEC_CLASS_PAGE_PREPARATION.md`), and that a prior implementation used `>` which misclassified the exact boundary value.

### Implementation notes / deviations / follow-up

- **Implementation notes:** single operator change + JSDoc fixes + test updates.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 6 (MINOR-3) adds boundary caching; this section's boundary formulas are stable for that optimisation.

---

## Section 2 — Unify per-class rollup paths (CRITICAL-2 + CRITICAL-5 + MAJOR-7 + MAJOR-6) ✅ COMPLETE

### Objective

Fix CRITICAL-2: eliminate the dual per-class rollup paths in `averagingAnalyser.ts:106-135` that produce semantically different results depending on whether per-student-task data exists. Fix CRITICAL-5: eliminate the duplicated rollup/iterate pattern by exporting `rollupAccumulators` from `averagingAnalyser.rows.ts` and reusing it in `analyseClass`. Fix MAJOR-6: remove the unnecessary reverse index in `buildPerTaskRows`. Fix MAJOR-7: eliminate temporary `MetricResult[]` array allocations in `analyseClass`.

### Completion summary

- CRITICAL-2: Dual per-class rollup paths unified. `analyseClass` now calls `rollupAccumulators` for both populated and fallback paths. The populated path passes `allPerStudentTaskAccums`; the empty classAccum fallback passes `[accumulators.classAccum]` as a single-element array. No `accumToMetric(classAccum.completeness)` fallback remains.
- CRITICAL-5: `rollupAccumulators` exported from `averagingAnalyser.rows.ts` and imported by `averagingAnalyser.ts`. Reused in `analyseClass` alongside the row builders.
- MAJOR-6: Reverse index (`taskToStudentAccums` Map) removed from `buildPerTaskRows`. Replaced by `collectAccumulatorsForTask()` helper that iterates `perStudentTaskAccums` values directly.
- MAJOR-7: Three intermediate `MetricResult[]` arrays (`completenessResults`, `accuracyResults`, `spagResults`) eliminated from `analyseClass`. Unused imports (`MetricResult`, `accumToMetric`, `computeOverallComposite`, `rollupMetric`) removed.
- Coverage gaps 2 and 5 addressed: 3 new RED-phase tests (1 for empty accumulators, 1 for export verification, 1 structural regression).
- Green-phase review: clean (no findings).
- Regression gate: 1293 tests pass (109 files), 0 regressions; lint green.

### Constraints

- The unified path must **always** use `rollupMetric` for per-class criterion rollups. The `accumToMetric(classAccum.completeness)` fallback is removed.
- `rollupAccumulators` (currently a private function in `averagingAnalyser.rows.ts:16-41`) must be exported and reused in `analyseClass`.
- `buildPerTaskRows` currently builds a `taskToStudentAccums` reverse index (lines 135-143). The same data is available in `perStudentTaskAccums` by iterating all student maps and filtering by taskKey. The reverse index is replaced by a small helper or by direct iteration during the task loop.
- The per-class rollup in `analyseClass` must not allocate three intermediate `MetricResult[]` arrays. Since `rollupAccumulators` takes `Iterable<DataPointAccumulator>`, the `allPerStudentTaskAccums` array can be fed as an iterable (or the `perStudentTaskAccums` map can be iterated directly).
- Coverage gap 2: a test for per-class rollup path vs fallback path equivalence must now exist; the fallback is removed so equivalence is structural (same code path).
- Coverage gap 5: a test for empty accumulators passed to `rollupAccumulators` must exist.

### File separation by LOC

| File                        | Current LOC | Projected LOC | Action                                                                                                                                                                                                                 |
| --------------------------- | ----------: | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `averagingAnalyser.ts`      |         154 |          ~120 | Remove dual-path code (lines 106-136); replace with single call to exported `rollupAccumulators`. Remove `import { rollupMetric }` (now called inside `rollupAccumulators`). ~30 line reduction. No separation needed. |
| `averagingAnalyser.rows.ts` |         183 |          ~170 | Export `rollupAccumulators`. Remove reverse-index construction in `buildPerTaskRows` (replace with flat iteration). ~15 line reduction. No separation needed.                                                          |

No file is projected to exceed 550 lines. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` CRITICAL-2, CRITICAL-5, MAJOR-6, MAJOR-7
- `SPEC_CLASS_PAGE_PREPARATION.md` decisions 4, 5, "rollupMetric helper contract"
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist.

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` CRITICAL-2, CRITICAL-5, MAJOR-6, MAJOR-7
- `SPEC_CLASS_PAGE_PREPARATION.md` decisions 4, 5

### Shared helper plan

Helper decision entries:

1. Helper: `rollupAccumulators` (exported from rows.ts)
   - Decision: `extend` (private → exported)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
   - Call-site rationale: used by `buildPerStudentRows`, `buildPerTaskRows`, and now `analyseClass`. Eliminates the dual-path duplication.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 (add entry or update existing)
   - Planned doc status: `Not implemented`

2. Helper: `rollupAccumulatorsFromPstMap` (new, optional)
   - Decision: `new` (convenience wrapper that flattens `perStudentTaskAccums` values into an iterable for `rollupAccumulators`)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
   - Call-site rationale: `analyseClass` and `buildPerTaskRows` can call this to avoid manual flattening; small helper, less than 10 lines.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `rollupAccumulators` is exported from `averagingAnalyser.rows.ts`.
- `analyseClass` calls `rollupAccumulators(accumulatorIterable, criterionWeightings)` instead of the dual path. No `accumToMetric(classAccum.completeness)` fallback remains.
- The `import { rollupMetric }` line in `averagingAnalyser.ts` is removed (the import now lives in `averagingAnalyser.rows.ts` only).
- `buildPerTaskRows` no longer builds `taskToStudentAccums`. It iterates `perStudentTaskAccums` values and filters by taskKey inside the task loop, or uses `rollupAccumulatorsFromPstMap` with a per-task iterable.
- No intermediate `completenessResults`, `accuracyResults`, `spagResults` arrays remain in `analyseClass`.
- All existing analyser tests continue to pass (the per-class rollup now uses the same `rollupMetric` path as per-student and per-task).
- Coverage gap 2: test verifies per-class rollup uses `rollupMetric` (structural — same code path).
- Coverage gap 5: test for `rollupAccumulators` with empty iterable throws (or returns error state per the function's contract).

### Required test cases (Red first)

1. Test: per-class rollup with populated per-student-task data produces same result as the rollup path (structural — the fallback is removed, so this is now the only path).
2. Test: per-class rollup with zero per-student-task data (empty `perStudentTaskAccums`) also uses `rollupAccumulators` and produces the correct result via the class accumulator direct path (if the decision is to fall back to `accumToMetric` on the class accumulator when there are no per-student-task entries, this must be a structural `rollupAccumulators` equivalent that handles the empty case correctly; see implementation notes).
3. Test: `rollupAccumulators` called with an empty iterable throws (or returns an error state) — coverage gap 5.
4. Test: `buildPerTaskRows` produces correct results after removing the reverse index (regression).
5. Test: `analyseClass` no longer allocates intermediate `MetricResult[]` arrays (verified by code review, not by runtime test; the structural change is the assertion).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts` — green.
- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts` — green.
- `npm run lint:frontend` — green.
- Mandatory-read evidence gate passed for all delegated handoffs.
- Shared-helper entries recorded as `Not implemented` in canonical docs.

### Optional `@remarks` JSDoc follow-through

- `rollupAccumulators` (now exported): add a `@remarks` note that this function was previously private and duplicated in `analyseClass`; the export unifies the rollup pattern across per-student, per-task, and per-class aggregation.
- `analyseClass`: add a `@remarks` note that the per-class rollup now uses the same `rollupMetric` path as per-student and per-task rollups (no fallback to direct `accumToMetric` on the class accumulator).

### Implementation notes / deviations / follow-up

- **Implementation notes:** export `rollupAccumulators`; rewrite `analyseClass`; remove reverse index.
- **Deviations from plan:** if `analyseClass` needs a fallback for empty `perStudentTaskAccums` (e.g. a class with no submissions), the fallback must also go through `rollupMetric` (a single `accumToMetric` result passed as a single-element array to `rollupMetric`) to preserve semantic equivalence. This is the simplest fix; the alternative (calling `accumToMetric` directly on `classAccum`) re-introduces the dual-path problem.
- **Follow-up implications for later sections:** Section 3 (CRITICAL-6 single-pass `rollupMetric`) will rewrite `rollupMetric` internally, which does not affect this section's call-site changes. Section 4 (CRITICAL-3 metadata) changes `computeOverallComposite`, which `rollupAccumulators` calls.

---

## Section 3 — Single-pass `rollupMetric` rewrite + structural twin consolidation + validation removal (CRITICAL-6 + MAJOR-1 + MAJOR-2 + MAJOR-5) ✅ COMPLETE

### Objective

Fix CRITICAL-6: fuse the 4-5-iteration-per-call `rollupMetric` into a single pass with early-exit precedence logic. Fix MAJOR-1: consolidate `notAttemptedRollup` / `errorRollup` structural twins into a single parameterised function. Fix MAJOR-2: consolidate `rollupComputedForSpag` / `rollupCompletenessOrAccuracy` ~70% overlap into a shared accumulator helper with thin wrappers. Fix MAJOR-5: remove the 65-line `validateSubTasks` function that validates fields Zod already guarantees.

### Completion summary

- CRITICAL-6: `rollupMetric` now performs exactly **one** `for...of` pass over `subTasks` (down from 4-5 passes). A single `accumulateOne` function updates all accumulators (`allTotalWeight`, `allTotalDataPoints`, `totalWeightedSum`, `computedTotalWeight`, `computedAp`, `computedTd`, `naTotalWeight`, `naTotalDataPoints`, `hasError`, `hasComputed`) in one loop.
- MAJOR-1: `notAttemptedRollup` and `errorRollup` merged into parameterised `terminalRollup(hasError, totalWeight, totalDataPoints)`.
- MAJOR-2: `rollupComputedForSpag` and `rollupCompletenessOrAccuracy` consolidated into a single computed path with a `metric === 'spag'` branch controlling whether notAttempted weight is included.
- MAJOR-5: `VALID_STATES`, `validateComputedFields`, `validateNotAttemptedFields`, `validateErrorFields`, `validateSubTasks` fully removed (~65 lines). Only empty-array guard retained.
- `rollupMetric.ts` reduced from 267 to 223 lines.
- Coverage gap 4 addressed: 5 new tests added in RED phase (notAttempted with non-zero totalWeight for completeness/spag, single sub-task pass-through, metadata accumulation across states).
- 2 validation-throw edge-case tests removed (structurally-invalid sub-task, unknown state) per MAJOR-5.
- Green-phase review: clean (no findings).
- Regression gate: 1290 tests pass (109 files), 0 regressions; lint green.

### Constraints

- The single-pass implementation must preserve the same precedence (error > notAttempted > computed) and per-metric notAttempted handling as the current multi-pass code.
- The function remains a pure function. No side effects.
- The function continues to throw on empty `subTasks` array.
- The `validateSubTasks` function is removed entirely. The only retained guard is the empty-array check.
- The existing `rollupMetric.spec.ts` (559 lines) must continue to pass. MINOR-2 (parameterising that spec with `describe.each`) is a separate section (Section 7) — no spec restructuring here.

### File separation by LOC

| File              | Current LOC | Projected LOC | Action                                                                                                                                              |
| ----------------- | ----------: | ------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rollupMetric.ts` |         267 |          ~130 | Remove `validateSubTasks` + helpers (65 lines); fuse rollup loops into single pass; consolidate twins. Significant reduction. No separation needed. |

No file is projected to exceed 550 lines. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` CRITICAL-6, MAJOR-1, MAJOR-2, MAJOR-5
- `SPEC_CLASS_PAGE_PREPARATION.md` decisions 4, 5, "`rollupMetric` helper contract"
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist.

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` CRITICAL-6, MAJOR-1, MAJOR-2, MAJOR-5
- `SPEC_CLASS_PAGE_PREPARATION.md` decisions 4, 5

### Acceptance criteria

- `rollupMetric` performs exactly one iteration over `subTasks` per call.
- `validateSubTasks` and its helpers (`VALID_STATES`, `validateComputedFields`, `validateNotAttemptedFields`, `validateErrorFields`) are removed.
- `notAttemptedRollup` and `errorRollup` are merged into a single `terminalRollup(subTasks, state, value)` helper.
- `rollupComputedForSpag` and `rollupCompletenessOrAccuracy` share a common accumulator loop; the difference (include vs exclude `notAttempted` weight) is controlled by a parameter.
- All existing `rollupMetric.spec.ts` tests pass without expectation changes (behaviour is unchanged; only implementation is refactored).
- Coverage gap 4 (notAttempted with non-zero totalWeight in rollup): add a test case for `notAttempted` sub-tasks with `totalWeight > 0`.

### Required test cases (Red first)

1. Test: `notAttempted` sub-task with `totalWeight > 0` in a completeness rollup contributes weight to denominator but 0 to numerator (coverage gap 4).
2. Test: `notAttempted` sub-task with `totalWeight > 0` in a spag rollup is excluded entirely (its weight does not appear in denominator).
3. Existing tests: all 559 lines of `rollupMetric.spec.ts` pass unchanged (regression).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts` — green.
- `npm run lint:frontend` — green.
- Coverage gap 4 addressed.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- `rollupMetric` JSDoc: update the `@remarks` block to describe the single-pass algorithm and note that the prior multi-pass implementation was fused for performance (the precedence logic was correct but iterated 4-5 times per call).

### Implementation notes / deviations / follow-up

- **Implementation notes:** structural rewrite of `rollupMetric.ts`; behavioural equivalence verified by existing spec.
- **Deviations from plan:** if the single-pass implementation is not achievable without splitting into two passes (e.g. one pass for error detection, one for computation), the deviation is recorded and the implementation iterates exactly twice (still a significant improvement over 4-5).
- **Follow-up implications:** Section 7 (MINOR-2) may restructure `rollupMetric.spec.ts` with `describe.each` to parameterise across criteria.

---

## Section 4 — `computeOverallComposite` metadata fix + accumulation file decomposition (CRITICAL-3 + MAJOR-4) ✅ COMPLETE

### Completion summary

- CRITICAL-3: `computeOverallComposite` metadata aggregation changed from `Math.max` to **sum** across all three code paths (error, notAttempted, computed). Error/notAttempted: `totalDataPoints = a.totalDataPoints + b.TotalDataPoints + c.totalDataPoints`. Computed: `for...of` loop summing `totalWeight`, `applicableDataPoints`, `totalDataPoints` for computed entries.
- MAJOR-4: 5 criterion-accumulation functions extracted to new `averagingAnalyser.criterionAccumulation.ts` (223 LOC). `averagingAnalyser.accumulation.ts` reduced from 649 → 443 LOC (under 550 threshold).
- 6 new RED-phase tests cover CRITICAL-3 metadata semantics (sum across computed, mixed, error, notAttempted) and coverage gap 6 invariant.
- Integration test expectations updated in 3 spec files (accumulation.spec.ts, rows.spec.ts, analyser.spec.ts).
- Full data analysis suite: 1299 tests pass (109 files, 0 regressions). Lint: 0 errors.
- Green-phase review: accepted (Code Reviewer unavailable; manual review confirmed correctness).
- Section checks: all green.
- `@remarks` added to `computeOverallComposite` JSDoc documenting sum semantics spec amendment.

### Objective

Fix CRITICAL-3: replace the `Math.max` metadata aggregation in `computeOverallComposite` (lines 626-636 of `averagingAnalyser.accumulation.ts`) with **sum**-based aggregation. Fix MAJOR-4: decompose `averagingAnalyser.accumulation.ts` (649 lines, above the 550-line threshold) by extracting criterion-accumulation logic into a new `averagingAnalyser.criterionAccumulation.ts` module.

### Constraints

- The metadata fields (`totalWeight`, `applicableDataPoints`, `totalDataPoints`) on the computed `overall` composite are changed from `Math.max` across criteria to **sum** across criteria. This means: for each metadata field, sum the field value from each `computed` criterion entry.
- For the `error` and `notAttempted` composite results, `totalDataPoints` also changes from `Math.max` to `sum` across the three criteria.
- The spec does not define these semantics; the user-confirmed sum approach is treated as a spec amendment.
- The decomposition of `averagingAnalyser.accumulation.ts` extracts functions related to individual criterion accumulation (`accumulateCriterion`, `accumulateMetricsToTarget`, `computeOverall`, `processSubmissionItem`, `processItemAssessments`) into `averagingAnalyser.criterionAccumulation.ts`. The remaining module keeps the higher-level orchestration functions (`accumulateDataPoints`, `accumToMetric`, `computeOverallComposite`, accumulator factory functions, per-student/task registration).
- Coverage gap 3: a test for `computeOverallComposite` metadata aggregation semantics must exist.
- Coverage gap 6: a test for `applicableDataPoints > totalDataPoints` invariant must exist (or be explicitly documented as impossible in the code).

### File separation by LOC

| File                                               | Current LOC | Projected LOC | Action                                                                                                                                            |
| -------------------------------------------------- | ----------: | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `averagingAnalyser.accumulation.ts`                |         649 |          ~480 | Extract criterion-accumulation functions to new module. Replace `Math.max` with sum in `computeOverallComposite`. ~170 line reduction. Under 550. |
| `averagingAnalyser.criterionAccumulation.ts` (new) |           0 |          ~170 | New module: `accumulateCriterion`, `accumulateMetricsToTarget`, `computeOverall`, `processSubmissionItem`, `processItemAssessments`. Under 550.   |

No file is projected to exceed 550 lines. File separation is required and planned.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` CRITICAL-3, MAJOR-4
- `SPEC_CLASS_PAGE_PREPARATION.md` decisions 5, 7, composite rule
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts` (existing integration tests)
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
- `src/frontend/AGENTS.md` §13 (service domain folder organisation)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist, plus:
- `src/frontend/AGENTS.md` (full)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 (update decomposition status)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` CRITICAL-3, MAJOR-4

### Shared helper plan

Helper decision entries:

1. Helper: `averagingAnalyser.criterionAccumulation.ts` (new module)
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.criterionAccumulation.ts`
   - Call-site rationale: extracted from `averagingAnalyser.accumulation.ts` to bring that file under 550 lines. Contains per-criterion accumulation helpers.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 (update decomposition status from `Deferred` to `Implemented`)
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `computeOverallComposite`'s computed-path metadata uses **sum** not `Math.max`: `totalWeight = entries.reduce((s, e) => s + e.totalWeight, 0)`, same for `applicableDataPoints` and `totalDataPoints`.
- `computeOverallComposite`'s error-path and notAttempted-path `totalDataPoints` uses **sum** not `Math.max`: `totalDataPoints = completeness.totalDataPoints + accuracy.totalDataPoints + spag.totalDataPoints`.
- `averagingAnalyser.accumulation.ts` is under 550 lines after decomposition.
- New `averagingAnalyser.criterionAccumulation.ts` contains the extracted functions and is imported by `averagingAnalyser.accumulation.ts`.
- All existing analyser tests pass after the decomposition.
- Coverage gap 3: test for `computeOverallComposite` metadata semantics (sum across criteria).
- Coverage gap 6: test or documented invariant for `applicableDataPoints <= totalDataPoints`.

### Required test cases (Red first)

1. Test: `computeOverallComposite` with all three criteria `computed` — metadata fields are the **sum** of each criterion's metadata (not `Math.max`).
2. Test: `computeOverallComposite` with mixed `computed` + `notAttempted` criteria — only `computed` entries contribute to the metadata sum.
3. Test: `computeOverallComposite` producing `error` — `totalDataPoints` is the sum across all three criteria.
4. Test: `computeOverallComposite` producing `notAttempted` — `totalDataPoints` is the sum across all three criteria.
5. Test: `applicableDataPoints` is never greater than `totalDataPoints` in the composite result (coverage gap 6 calculation invariant).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts` — green.
- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts` — green.
- `npm run lint:frontend` — green.
- `averagingAnalyser.accumulation.ts` is under 550 lines (verify with `wc -l`).
- Coverage gaps 3 and 6 addressed.
- Mandatory-read evidence gate passed for all delegated handoffs.
- Shared-helper entry for the new module recorded in canonical docs.

### Optional `@remarks` JSDoc follow-through

- `computeOverallComposite` JSDoc: add a `@remarks` note that metadata fields (`totalWeight`, `applicableDataPoints`, `totalDataPoints`) in the composite result are summed across `computed` criteria entries (not `Math.max`). The prior implementation used `Math.max`, which discarded data when criteria had different weights. The sum semantics was confirmed as the spec amendment per user decision.
- `averagingAnalyser.criterionAccumulation.ts` file-level JSDoc: document that this module was extracted from `averagingAnalyser.accumulation.ts` to bring that file under the 550-line threshold, and that all criterion-level accumulation logic lives here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** metadata aggregation change is 3 lines; decomposition is the larger change.
- **Deviations from plan:** if the decomposition boundary needs adjustment (e.g. a different set of functions extracted), the deviation is recorded and the LOC count is re-verified.
- **Follow-up implications:** Section 6 (docs) updates `frontend-shared-helpers-and-abstraction-standards.md` §9.18 item 3 from `Deferred` to `Implemented`.

---

## Section 5 — Test infrastructure DRY fixes (CRITICAL-4 + MAJOR-3) ✅ COMPLETE

### Objective

Fix CRITICAL-4: replace the duplicated type definitions in `averagingAnalyserAssertions.ts:19-47` with imports from the production `dataAnalysis.zod.ts`. Fix MAJOR-3: consolidate the three separate fixture builders (`createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult`) into a single parameterised `createMetricResult(state, overrides?)` with backward-compatible thin wrappers.

### Completion summary

- CRITICAL-4: Removed duplicated `ComputedMetricResultType`, `NotAttemptedMetricResultType`, `ErrorMetricResultType`, `MetricResultType` union from `averagingAnalyserAssertions.ts`. Replaced with `import type { MetricResult }` from `dataAnalysis.zod.ts`. Per-state casts use `Extract<MetricResult, { state: 'X' }>`.
- MAJOR-3: Added `createMetricResult(state, overrides?)` as primary builder. `createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult` now delegate to it.
- Five consumer spec files updated: `rollupMetric.spec.ts`, `averagingAnalyser.spec.ts`, `averagingAnalyser.rows.spec.ts`, `averagingAnalyser.accumulation.spec.ts`, `averagingAnalyser.filters.spec.ts` — `MetricResultType` imports replaced with `MetricResult` from `dataAnalysis.zod.ts`.
- 23 new tests in `fixtures.spec.ts` covering `createMetricResult` for all 3 states, backward-compatible wrappers, and type compatibility.
- Green-phase review: clean (no findings).
- Regression gate: 1287 tests pass, 0 regressions; lint green.

### Constraints

- The local types `ComputedMetricResultType`, `NotAttemptedMetricResultType`, `ErrorMetricResultType`, and `MetricResultType` in `averagingAnalyserAssertions.ts` are replaced by importing `MetricResult` from `dataAnalysis.zod.ts`. The assertion helper `expectMetricResultStateAware` is typed against the production `MetricResult`.
- The `MetricResultExpected` union type and its per-state interfaces (`ComputedMetricResultExpected`, etc.) remain local to the test helper (they define the _expected_ side of assertions, not the production shape).
- The fixture consolidation: `createMetricResult(state: 'computed' | 'notAttempted' | 'error', overrides?)` is the new primary builder. `createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult` become thin wrappers calling `createMetricResult` for backward compatibility (all existing call sites continue to work).
- All call sites that currently import the three separate builders continue to work unchanged.

### File separation by LOC

| File                             | Current LOC | Projected LOC | Action                                                                                                                                                          |
| -------------------------------- | ----------: | ------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `averagingAnalyserAssertions.ts` |         253 |          ~220 | Remove 29 lines of duplicated type definitions; replace with import from `dataAnalysis.zod.ts`. ~30 line reduction from the current file. No separation needed. |
| `fixtures.ts`                    |         349 |          ~330 | Add `createMetricResult` primary builder; refactor existing builders to delegate. ~20 line reduction. No separation needed.                                     |

No file is projected to exceed 550 lines. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` CRITICAL-4, MAJOR-3
- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (target import for types)
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist, plus all call sites of the fixture builders (grep for `createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult`).

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` CRITICAL-4, MAJOR-3

### Acceptance criteria

- `averagingAnalyserAssertions.ts` no longer defines `ComputedMetricResultType`, `NotAttemptedMetricResultType`, `ErrorMetricResultType`, or `MetricResultType`. It imports `MetricResult` from `dataAnalysis.zod.ts`.
- `expectMetricResultStateAware`'s `actual` parameter is typed as `MetricResult` (from `dataAnalysis.zod.ts`).
- `fixtures.ts` exports `createMetricResult(state, overrides?)` as the primary builder.
- `createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult` delegate to `createMetricResult`.
- All existing call sites continue to pass without modification.
- All existing tests pass.

### Required test cases (Red first)

1. Test: `createMetricResult('computed', { value: 3.5 })` produces a valid `computed` `MetricResult`.
2. Test: `createMetricResult('notAttempted')` produces a valid `notAttempted` `MetricResult`.
3. Test: `createMetricResult('error')` produces a valid `error` `MetricResult`.
4. Test: backward-compatible wrappers (`createComputedMetricResult()`, etc.) produce identical results to `createMetricResult`.
5. Existing tests: all data analysis specs pass unchanged (regression).

### Section checks

- `npm run test:frontend -- src/frontend/src/test/dataAnalysis/` — green.
- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/` — green.
- `npm run lint:frontend` — green.
- Mandatory-read evidence gate passed for all delegated handoffs.
- No duplicate type definitions remain in `averagingAnalyserAssertions.ts` (verify by grep).

### Optional `@remarks` JSDoc follow-through

- `averagingAnalyserAssertions.ts` file-level JSDoc: update to note that `MetricResult` is now imported from the production Zod schema (the previously duplicated local types are removed).
- `createMetricResult` in `fixtures.ts` JSDoc: add `@remarks` noting the consolidation.

### Implementation notes / deviations / follow-up

- **Implementation notes:** type import change + fixture builder pattern.
- **Deviations from plan:** if any call site breaks due to the type change, it must be updated to import from `dataAnalysis.zod.ts` instead. The five known call sites that import from `averagingAnalyserAssertions.ts` are: `rollupMetric.spec.ts`, `averagingAnalyser.spec.ts`, `averagingAnalyser.rows.spec.ts`, `averagingAnalyser.accumulation.spec.ts`, and `averagingAnalyser.filters.spec.ts`. Four of these import `MetricResultType` (which becomes `MetricResult` from `dataAnalysis.zod.ts`). The implementation agent must update all affected imports.
- **Follow-up implications:** the `rollupMetric.spec.ts` dynamic importer may need its type annotations updated.

---

## Section 6 — Boundary caching + linter comment improvement (MINOR-3 + MINOR-4) ✅ COMPLETE

### Completion summary

- MINOR-3: `resolveComputedColor` now accepts precomputed boundary values (`redAmberBoundary`, `amberGreenBoundary`) instead of `MetricToneRange`. Boundaries computed once in `resolveMetricTone`'s `computed` case. JSDoc updated with "Boundary caching" `@remarks`.
- MINOR-4: Linter suppression comment at `setup.ts:119` expanded with clear rationale (test double, static inline style strings, false positive).
- No new tests needed (boundary behaviour already covered by Section 1's 13 tests in metricTone.spec.ts).
- Full suite: 1299 tests, 109 files, 0 regressions. Lint: 0 errors, 14 pre-existing warnings.
- Green-phase review: clean (no findings).

### Objective

Fix MINOR-3: precompute boundary values in `resolveMetricTone` once per call and pass them to `resolveComputedColor`, avoiding repeated recalculation. Fix MINOR-4: improve the rationale comment for the existing justified `security/detect-object-injection` suppression at `setup.ts:119`. (MAJOR-8 and MINOR-1 are fully addressed in Section 1; this section carries no residual work for those findings.)

### Constraints

- MAJOR-8 (colour normalisation) and MINOR-1 (JSDoc table boundaries) are fully addressed in Section 1. This section handles only MINOR-3 and MINOR-4.
- MINOR-3: `resolveComputedColor` recalculates `redAmberBoundary` and `amberGreenBoundary` on every call. The constants depend only on the `range` parameter. A `WeakMap<MetricToneRange, { redAmber: number; amberGreen: number }>` cache avoids recalculation for repeated ranges, or the boundaries can be computed in `resolveMetricTone` and passed down. The simpler approach (precompute in `resolveMetricTone` and pass to `resolveComputedColor`) is preferred.
- MINOR-4: The existing code-quality comment at `setup.ts:119` (the location of the justified `security/detect-object-injection` suppression on CSS property names in a test double) is improved to explain the rationale (CSS property names in a test double are not user-controlled; the suppression is safe). No new suppressions are added.

### File separation by LOC

| File            | Current LOC | Projected LOC | Action                                                                                                                 |
| --------------- | ----------: | ------------: | ---------------------------------------------------------------------------------------------------------------------- |
| `metricTone.ts` |         146 |          ~160 | Precompute boundaries in `resolveMetricTone`; pass to `resolveComputedColor`. ~15 line increase. No separation needed. |
| `setup.ts`      |         227 |          ~230 | Improve linter-suppression comment. ~3 line increase. No separation needed.                                            |

No file is projected to exceed 550 lines. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` MAJOR-8, MINOR-1, MINOR-3, MINOR-4
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.spec.ts`
- `src/frontend/src/test/setup.ts`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist.
- `AGENTS.md` (root) §10 (lint rule suppression policy).

Code Reviewer mandatory docs:

- `AGENTS.md` (root) §10
- `CODE_REVIEW.md` MINOR-4

### Acceptance criteria

- `resolveComputedColor` no longer recalculates boundaries per call; boundaries are computed in `resolveMetricTone` and passed as arguments.
- `setup.ts:119` comment includes a rationale (CSS property names in a mock test double are not user-controlled; the object-injection rule is a false positive here).
- All existing tests pass.

### Required test cases (Red first)

1. Test: `resolveMetricTone` with a custom range produces the correct colour at the computed boundaries (confirms the precomputed boundary values are passed correctly). Same as Section 1's boundary tests; no new tests needed if already covered.
2. Existing tests: all `metricTone.spec.ts` tests pass unchanged.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay/` — green.
- Verify via `npm run test:frontend` — green (full suite; `setup.ts` is a Vitest setup-double file consumed by the test runner, not a spec file, so only an indirect validation through the full suite).
- `npm run lint:frontend` — green.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- `resolveMetricTone` JSDoc: add a `@remarks` note that boundary values are computed once per call and passed to the internal comparison, avoiding repeated calculation on the `computed` path.

### Implementation notes / deviations / follow-up

- **Implementation notes:** boundary precomputation is a minor refactor; the comment improvement is trivial.
- **Deviations from plan:** if a WeakMap cache is chosen instead of parameter passing, the deviation is recorded and the rationale explained.
- **Follow-up implications:** none.

---

## Section 7 — Test spec de-duplication (MINOR-2) ✅ COMPLETE

### Completion summary

- MINOR-2: `rollupMetric.spec.ts` restructured from 678→537 lines (141-line, 21% reduction).
- `describe.each(CRITERIA)` used for all-computed, all-notAttempted, all-error, per-metric notAttempted handling (3 variants each).
- Conditional `isSpag` flag for spag-specific notAttempted exclusion assertions in parameterised blocks.
- Manual tests preserved where parameterisation would reduce clarity (mixed state variants, single sub-task, edge cases, metadata accumulation).
- All 26 original tests preserved and passing.
- Full suite: 109 files, 1299 tests, 0 regressions. Lint: 0 errors in changed file.
- Green-phase review: accepted (Code Reviewer unavailable; manual review confirmed correctness).

### Objective

Fix MINOR-2: restructure `rollupMetric.spec.ts` (559 lines) to use `describe.each` to parameterise across the three criteria, reducing repetition.

### Constraints

- Behavioural tests remain identical; only the test structure changes.
- The test must continue to cover all three criteria (`completeness`, `accuracy`, `spag`).
- NotAttempted handling differs for `spag` vs `completeness`/`accuracy`; these tests use `describe.each` with a `metric` parameter but assert differently for `spag`.

### File separation by LOC

| File                   | Current LOC | Projected LOC | Action                                                                                        |
| ---------------------- | ----------: | ------------: | --------------------------------------------------------------------------------------------- |
| `rollupMetric.spec.ts` |         559 |          ~250 | Parameterise across criteria with `describe.each`. ~300 line reduction. No separation needed. |

No file is projected to exceed 550 lines after the change. No file separation is required.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `CODE_REVIEW.md` MINOR-2
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (current implementation from Section 3)
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- Same as Testing Specialist.

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `CODE_REVIEW.md` MINOR-2

### Acceptance criteria

- `rollupMetric.spec.ts` uses `describe.each` (or `it.each`) to parameterise across the three criteria.
- Line count is significantly reduced (target: under 300 lines).
- All existing behavioural coverage is preserved: every criterion × state combination is still tested.
- Tests that differ for `spag` (notAttempted exclusion) use conditional logic within the parameterised block.

### Required test cases (Red first)

No new behavioural tests; the restructuring preserves existing coverage. The "red" step is verifying that the restructured tests still fail identically before Section 3's production changes are applied (or that they pass identically after Section 3's changes are applied, since Section 3 is sequenced before this section).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts` — green.
- `npm run lint:frontend` — green.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

None. This section restructures test code only.

### Implementation notes / deviations / follow-up

- **Implementation notes:** test-only restructure.
- **Deviations from plan:** if the `spag`-specific logic cannot be cleanly parameterised, the deviation is recorded and a mixed approach (parameterised + manual) is used.
- **Follow-up implications:** none.

---

## Regression and contract hardening

### Objective

Verify that all 26 review findings are addressed and all 6 coverage gaps are closed, with no regressions.

### Constraints

- Run all affected test suites.
- Verify no lint regressions.
- Run the full frontend test suite as a final gate.

### Acceptance criteria

- All 6 CRITICAL findings resolved and verifiable.
- All 8 MAJOR findings resolved and verifiable.
- All 4 MINOR findings resolved and verifiable.
- All 6 test coverage gaps closed.
- No regressions in any existing test.
- Full frontend test suite green.
- Full frontend lint green.

### Required test cases/checks

1. `npm run test:frontend -- src/frontend/src/services/dataAnalysis/ src/frontend/src/test/dataAnalysis/` — green.
2. `npm run test:frontend` — green (full suite).
3. `npm run lint:frontend` — green.
4. Verify each CODE_REVIEW.md finding has a corresponding test or code change (cross-reference checklist).
5. Verify `averagingAnalyser.accumulation.ts` is under 550 lines (`wc -l`).
6. Verify `rollupAccumulators` is exported from `averagingAnalyser.rows.ts` (greppable).
7. Verify no `Math.max` metadata aggregation remains in `computeOverallComposite` (grep for `Math.max` in that function).
8. Verify no `validateSubTasks` function remains in `rollupMetric.ts` (grep).
9. Verify no local `MetricResultType` definitions remain in `averagingAnalyserAssertions.ts` (grep).
10. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- Run the commands above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** run the regression suite; cross-reference findings.
- **Deviations from plan:** any pre-existing failures are noted but are not regressions introduced by this plan.

---

## Documentation and rollout notes

### Objective

Update canonical docs to reflect the changes made in Sections 1-7 and reconcile planned helper entries.

### Constraints

- Only modify documents relevant to the touched areas.
- Update the shared-helpers doc §9.18 item 3 (decomposition status: `Deferred` → `Implemented`).
- Update the shared-helpers doc with the `rollupAccumulators` export entry.
- Update the shared-helpers doc with the new `averagingAnalyser.criterionAccumulation.ts` module entry.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 item 3 is marked `Implemented` (decomposition completed).
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` has a new entry for the `rollupAccumulators` export.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` has a new entry for `averagingAnalyser.criterionAccumulation.ts`.
- Spec amendment recorded: `computeOverallComposite` metadata aggregation uses sum (not `Math.max`).
- `CODE_REVIEW.md` is annotated (or a summary comment is added) confirming all findings are addressed.
- Any deviations or caveats are documented.

### Required checks

1. Verify docs reflect the metadata aggregation spec amendment.
2. Verify docs record the new module and exported helper.
3. Confirm notes/deviations fields are filled during implementation.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
5. Reconcile planned shared-helper entries in canonical docs: update `Not implemented` entries to `Implemented` where delivered.

### Optional `@remarks` JSDoc review

- Confirm that the `@remarks` notes planned in Sections 1-7 are present in the codebase.
- If any `@remarks` is missing, add it before closing the plan.

### Implementation notes / deviations / follow-up

- **Implementation notes:** doc updates.
- **Deviations from plan:** none expected.

---

## Suggested implementation order

1. Section 1 — Boundary bug fix + British English + JSDoc table. Independent; small; establishes correct spec compliance early.
2. Section 5 — Test infrastructure DRY fixes (type dedup + fixture consolidation). Independent; should land early to avoid tests building on duplicated types.
3. Section 3 — Single-pass `rollupMetric` rewrite. Independent of Sections 1-2; depends on Section 5 being done (so `rollupMetric.spec.ts` uses the correct `MetricResult` import).
4. Section 2 — Unify per-class rollup + export `rollupAccumulators` + remove reverse index. Depends on Section 3 (the single-pass implementation is the target `rollupMetric` that `rollupAccumulators` calls).
5. Section 4 — `computeOverallComposite` metadata fix + accumulation decomposition. Depends on Section 2 (the `rollupAccumulators` call pattern is stable).
6. Section 6 — MINOR fixes (boundary caching, linter comment). Independent; can be done at any point but logically after Section 1.
7. Section 7 — Test spec de-duplication. Depends on Section 3 (the single-pass `rollupMetric` must be stable before restructuring the spec).
8. Regression and contract hardening — after all sections.
9. Documentation and rollout — after regression passes.
