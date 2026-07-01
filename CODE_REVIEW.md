# Code Review Synthesis: `feat/ClassPage` Diff

**Review date:** 2026-07-01
**Spec reference:** `SPEC_CLASS_PAGE_PREPARATION.md`
**Diff:** current branch vs `feat/ClassPage` (57 files, +4683 / −1189)

---

## Executive Summary

**Verdict: NEEDS IMPROVEMENT — 3 Critical bugs, 2 Critical DRY violations, 1 Critical performance issue must be addressed before merge.**

The implementation is functionally complete and passes lint/type-check/test gates, but contains several spec-violating bugs, architectural duplication, and inefficient iteration patterns. The four parallel reviews (bugs-vs-spec, coding standards, performance, KISS/DRY) produced 26 distinct findings across 12 severity levels.

---

## Consolidated Findings (Priority Order)

### 🔴 MUST FIX BEFORE MERGE

#### CRITICAL-1: `metricTone.ts` — Amber/Green Boundary Misclassifies Boundary Value

- **File:** `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts:55`
- **Origin:** Bug review
- **Spec violation:** `SPEC_CLASS_PAGE_PREPARATION.md:286-287` — spec says `value >= (lower + 3*upper) / 4` yields green; code uses `>` so exact boundary falls through to gold
- **Example:** Default range `{0,5}` yields amberGreenBoundary = 3.75. Spec says green, code returns gold.
- **Test complicity:** `metricTone.spec.ts:78` expects `gold` at 3.75, matching the buggy code
- **Fix:** Change `>` to `>=` in `resolveComputedColor`; update test expectation
- **Severity:** CRITICAL (spec violation + test matches bug)

#### CRITICAL-2: `averagingAnalyser.ts` — Dual Per-Class Rollup Paths Semantic Divergence

- **File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts:106-135`
- **Origin:** Bug review, Performance review
- **Issue:** Two different aggregation paths exist: (1) rollup via `rollupMetric` when per-student-task data exists, (2) direct `accumToMetric` on `classAccum` when no per-student-task data. These paths produce semantically different results because `rollupMetric` applies per-metric notAttempted rules while `accumToMetric` does not.
- **Fix:** Unify paths — either remove the fallback or make it call the same `rollupMetric` logic
- **Severity:** CRITICAL (silently incorrect data)

#### CRITICAL-3: `computeOverallComposite` — Arbitrary `Math.max` Metadata Aggregation

- **File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:626-636`
- **Origin:** Bug review, Performance review
- **Issue:** `totalWeight`, `applicableDataPoints`, `totalDataPoints` aggregated via `Math.max` across criteria. Spec does not define this aggregation. Taking max of sums across criteria discards data (e.g. completeness 50 + accuracy 30 reports 50, losing 30).
- **Fix:** Define intended semantics in spec, then implement (sum or weighted-sum, not max)
- **Severity:** CRITICAL (undefined behaviour with misleading metadata)

#### CRITICAL-4: DRY — Type Duplication in Test Assertions

- **File:** `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts:19-47`
- **Origin:** KISS/DRY review
- **Issue:** Defines its own `ComputedMetricResultType`, `NotAttemptedMetricResultType`, `ErrorMetricResultType`, `MetricResultType` that duplicate production types from `dataAnalysis.zod.ts`
- **Fix:** Import from production schema; remove local type definitions
- **Severity:** CRITICAL (maintenance hazard — types will drift)

#### CRITICAL-5: DRY — Duplicated Rollup/Iterate Pattern in 3 Places

- **Files:** `averagingAnalyser.rows.ts:16-41`, `averagingAnalyser.ts:113-136`, future Class page adapter
- **Origin:** KISS/DRY review
- **Issue:** The "iterate accumulators then accumToMetric then rollupMetric then computeOverallComposite" pattern is implemented verbatim in two places
- **Fix:** Export `rollupAccumulators` from `rows.ts` and reuse in `analyseClass`
- **Severity:** CRITICAL (architectural duplication; future drift risk)

#### CRITICAL-6: Performance — `rollupMetric` Redundant Multiple Passes

- **File:** `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
- **Origin:** Performance review
- **Issue:** Each call performs 4-5 full iterations over `subTasks` (validate, .some(error), .filter(spag) or .some(computed), computation, .reduce in terminal rollups). Per-class rollup calls this 3x yielding 12-18 passes over per-student-task data.
- **Fix:** Fuse into single pass with early-exit precedence logic
- **Severity:** CRITICAL (O(n\*k) with k=12-18; fusible to O(n))

---

### 🟠 SHOULD FIX

#### MAJOR-1: `notAttemptedRollup` / `errorRollup` Structural Twins

- **File:** `rollupMetric.ts:201-225`
- **Origin:** KISS/DRY review
- **Fix:** Single parameterised function with `state`/`value` params; combine reduce calls into single loop

#### MAJOR-2: `rollupComputedForSpag` / `rollupCompletenessOrAccuracy` ~70% Overlap

- **File:** `rollupMetric.ts:120-193`
- **Origin:** KISS/DRY review
- **Fix:** Extract shared accumulator helper; two thin wrappers for notAttempted policy

#### MAJOR-3: Duplicated Fixture Builders

- **File:** `fixtures.ts:30-108`
- **Origin:** KISS/DRY review
- **Fix:** Single parameterised `createMetricResult(state, overrides?)`

#### MAJOR-4: `averagingAnalyser.accumulation.ts` Exceeds 550-Line Threshold

- **File:** `averagingAnalyser.accumulation.ts` (649 lines)
- **Origin:** KISS/DRY review
- **Issue:** Spec states decomposition deferred until 550 lines; file is 649 lines
- **Fix:** Either extract criterion accumulation to new module, or document the threshold was crossed

#### MAJOR-5: `rollupMetric` Validation is Redundant (65 lines)

- **File:** `rollupMetric.ts:48-112`
- **Origin:** KISS/DRY review
- **Issue:** Validates fields that Zod already guarantees at analyser boundary
- **Fix:** Remove, or reduce to single dev-only assertion

#### MAJOR-6: `buildPerTaskRows` Reverse Index Duplicates Data

- **File:** `averagingAnalyser.rows.ts:135-143`
- **Origin:** Performance review
- **Fix:** Iterate `perStudentTaskAccums` directly without building reverse index

#### MAJOR-7: `analyseClass` Temporary Array Allocations

- **File:** `averagingAnalyser.ts:106-121`
- **Origin:** Performance review
- **Fix:** Feed accumulators directly into single-pass rollup; avoid three intermediate MetricResult arrays

#### MAJOR-8: Inconsistent "color"/"colour" in `metricTone.ts`

- **File:** `metricTone.ts:5,53`
- **Origin:** Standards review
- **Issue:** Lines 5 and 53 use American "color" in JSDoc; rest of file uses British "colour" (violates British English mandate at AGENTS item 4)
- **Fix:** Normalise to "colour" throughout

---

### 🟡 CONSIDER FIXING

#### MINOR-1: `metricTone.ts` JSDoc Table Disagrees with Spec

- **File:** `metricTone.ts:87-93`
- **Fix:** Update table boundaries once CRITICAL-1 is resolved

#### MINOR-2: `rollupMetric.spec.ts` 559 Lines with Repeated Patterns

- **File:** `rollupMetric.spec.ts`
- **Fix:** Use `describe.each` to parameterise across 3 criteria

#### MINOR-3: `resolveComputedColor` Recalculates Boundaries Per Call

- **File:** `metricTone.ts:61-74`
- **Fix:** Cache boundaries via WeakMap or precompute in `resolveMetricTone`

#### MINOR-4: Linter Rule Suppression in `setup.ts`

- **File:** `src/frontend/src/test/setup.ts:173`
- **Issue:** Contains a comment that suppresses a linter rule — per AGENTS item 10, lint rules must not be turned off without express permission
- **Fix:** Obtain permission or refactor to avoid the suppression

---

## Spec Compliance Summary

| Spec Requirement                                            | Status  | Notes                                              |
| ----------------------------------------------------------- | ------- | -------------------------------------------------- |
| `lastUpdated` to `updatedAt` rename                         | PASS    | Full rename across schema, model, tests            |
| `MetricResult` discriminated union                          | PASS    | Zod schema, types, accumToMetric, fixtures         |
| `rollupMetric` precedence (error > notAttempted > computed) | PASS    | Correct logic                                      |
| Per-metric notAttempted (comp/acc=0, spag=excluded)         | PARTIAL | Logic correct; uncovered edge case                 |
| Overall composite 40/40/20 at consumer level                | PASS    | In `computeOverallComposite`                       |
| `accumToMetric` three-way check                             | PASS    | Correct branch order                               |
| `computeOverallComposite` error/notAttempted rules          | PASS    | Matches spec                                       |
| Assignment.js facade decomposition                          | PASS    | 7 sub-classes + index.js                           |
| `formatUpdatedAtLabel` en-GB/UTC/em-dash                    | PASS    | dateFormatting.ts                                  |
| Amber/green boundary at `>=`                                | FAIL    | `>` instead of `>=` (CRITICAL-1)                   |
| MetricResult metadata aggregation                           | FAIL    | Undefined in spec; Math.max arbitrary (CRITICAL-3) |

---

## Test Coverage Gaps

1. No test for `metricTone` boundary at `value === amberGreenBoundary` expecting green (test matches bug)
2. No test for per-class rollup path vs fallback path equivalence
3. No test for `computeOverallComposite` metadata aggregation semantics
4. No test for `notAttempted` with non-zero `totalWeight` in rollup
5. No test for empty accumulators passed to `rollupAccumulators`
6. No test for `applicableDataPoints > totalDataPoints` invariant

---

## Cross-Cutting Themes

### Spec compliance is strong but not complete

The implementation faithfully follows 9 of 11 spec requirements. The two failures (amber/green boundary, metadata aggregation) are well-circumscribed and easy to fix.

### Performance concerns are architectural, not hot-path

The 12-18 redundant iterations in `rollupMetric` are the biggest performance issue. For typical data volumes (50-1500 data points), this is tolerable but wasteful. The pattern will compound as the Class page adapter, future cohort analyses, and trend views call the same helper.

### DRY violations concentrate in test infrastructure

The type duplication in `averagingAnalyserAssertions.ts`, the three fixture builders, and the redundant validation in `rollupMetric` account for ~150 lines of preventable duplication. These are low-risk to fix and high-value for maintainability.

### British English is mostly consistent

One file (`metricTone.ts`) has two American spellings among ~20 British spellings. This is a minor oversight from copy-paste or initial scaffolding.

---

## Files Read During Review

- `SPEC_CLASS_PAGE_PREPARATION.md` (full spec)
- `src/frontend/AGENTS.md`
- All new/modified source files under `src/frontend/src/services/dataAnalysis/analysers/` (7 files)
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`, `MetricPill.tsx`
- `src/frontend/src/utils/dateFormatting.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`, `fixtures.ts`, `setup.ts`
- `src/backend/AssignmentProcessor/Assignment/index.js`, `00_*.js`..`06_*.js`
- All test spec files for the affected modules
- `git diff feat/ClassPage` (source and test output)
