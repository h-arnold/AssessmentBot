# Plan — Exclude Per-Task Errors from Higher-Level Averages

## Read-First Context

This plan changes how scoring errors propagate through the Class page rollups in
`src/frontend/src/features/classPage/` and the underlying `dataAnalysis` averaging
pipeline. Before implementing, read:

- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (rollup precedence)
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
  (`computeOverallComposite`, `accumToMetric`)
- `src/frontend/src/features/classPage/classPageAdapter.ts` (`computeAverageMetric`)
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (`MetricResult` union)
- `docs/developer/frontend/frontend-testing.md` (Vitest conventions)

The user's intent (verified in conversation): keep the **per-(student, task) cell**
error detection exactly as-is, but stop errors from poisoning the **per-student**,
**per-assignment**, and **per-class** averages. At those higher levels, errored
entries/criteria must be _excluded_ from the weighted average rather than causing the
entire aggregation to collapse to `error`.

---

## Background — current error propagation

| Level                                            | Function                  | Current error behaviour                                                                              |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Leaf (per-student-task)                          | `accumToMetric`           | `error` when no numeric score and no `'N'` for a criterion. **Unchanged.**                           |
| Leaf overall                                     | `computeOverall`          | Computed independently from the three criteria; already handles partial availability. **Unchanged.** |
| Rollup (tasks→student, students→task, all→class) | `rollupMetric`            | If **any** sub-task is `error`, the whole result is `error`. **CHANGE.**                             |
| Composite (overall from 3 criteria)              | `computeOverallComposite` | If **any** criterion is `error`, overall is `error`. **CHANGE.**                                     |
| Per-assignment average (adapter)                 | `computeAverageMetric`    | Same escalation as `computeOverallComposite`. **CHANGE / UNIFY.**                                    |
| Heatmap                                          | `adaptMetricsToHeatmap`   | Uses leaf `perStudentTaskMetrics` directly. **Unchanged / unaffected.**                              |

The propagated `error` is what makes "a handful of errors in a handful of assignments"
wipe out an entire student's average and an entire assignment/class average.

---

## Objective

At every aggregation level **above** the per-(student, task) cell, an `error` entry or
criterion is **excluded** from the weighted-average calculation:

- A student with 5 tasks where 1 has a completeness `error` is averaged over the other 4.
- A class where some students have errors is still averaged over the non-errored data.
- The overall composite excludes error criteria the same way it already excludes
  `notAttempted` criteria.

The leaf cell still shows `error` when its own data is genuinely missing, and a fully
errored scope (every contributing entry/criterion is `error`) still reports `error`.

---

## Scope

### In scope

- `rollupMetric` — exclude error sub-tasks; escalate to `error` only when **all** inputs are error.
- `computeOverallComposite` — exclude error criteria; escalate to `error` only when **all three** criteria are error.
- `computeAverageMetric` (adapter) — replace with a call to the unified `computeOverallComposite` helper; retire the duplicated `buildErrorMetric` / `isAnyError` / `isAnyComputed` helpers that only exist to support the old escalation.
- JSDoc on the three functions above — rewritten to describe the new precedence.
- Test suites asserting the old escalation behaviour — updated.

### Out of scope

- Leaf-level error detection (`accumToMetric`), leaf overall (`computeOverall`) — unchanged.
- Heatmap rendering — unchanged.
- Backend changes — none.
- Any new metric states, new weighting model, or SPaG renormalisation changes.

---

## Design decisions

### 1. `rollupMetric` (`rollupMetric.ts`)

Add a `hasNotAttempted` flag to `AccumulatedState` (set in `accumulateOne` for the
`notAttempted` case). Replace the current `if (accumulator.hasError) return
terminalRollup(...)` with:

```
if (accumulator.hasError && !accumulator.hasComputed && !accumulator.hasNotAttempted) {
  return terminalRollup(true, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
}
if (!accumulator.hasComputed) {
  return terminalRollup(false, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
}
// ... existing computed path (already excludes error weights)
```

Consequences:

- Mix of computed + error → computed path, errors excluded (already true today).
- Mix of error + notAttempted only → `notAttempted` terminal (errors excluded).
- All error → `error` terminal (unchanged).
- Metadata (`totalWeight`, `totalDataPoints`) in the computed path already excludes
  error weights — no change needed there.

### 2. `computeOverallComposite` (`averagingAnalyser.accumulation.ts`)

Remove the leading `if (any criterion error) return error` block. Build the computed
entries list by **filtering out `error` and `notAttempted` criteria** (the existing
`toComputedEntry` filter already drops non-computed; extend it so callers need no change).
Add an explicit terminal branch:

```
const allError = criteria.every((c) => c.metric.state === 'error');
if (allError) return error-terminal(summed totalWeight + totalDataPoints);
if (!hasComputed) return notAttempted-terminal(summed totalWeight + totalDataPoints);
// ... weighted average of computed criteria only
```

**`totalWeight` convention (resolves the pre-existing inconsistency flagged in review):**
the old `computeOverallComposite` set `totalWeight: 0` on terminal results while the
adapter's `buildErrorMetric` summed it. Both terminal branches now **sum** the
criteria's `totalWeight` (consistent with the computed path and with `buildErrorMetric`).
This makes the unified helper behaviour coherent.

### 3. `computeAverageMetric` unification (`classPageAdapter.ts`)

`computeAverageMetric` is a near-duplicate of `computeOverallComposite`. Replace its body
with a delegation to `computeOverallComposite` (imported from
`averagingAnalyser.accumulation`). Retire `buildErrorMetric`, `isAnyError`, and
`isAnyComputed` if they become unused. `computeAverageMetric` becomes a thin adapter
wrapper so the adapter keeps its own named entry point.

### 4. Heatmap — no change

`adaptMetricsToHeatmap` consumes leaf `perStudentTaskMetrics` directly and never calls
`rollupMetric` / `computeOverallComposite`, so it is unaffected.

---

## Files to change

| File                                                                                 | Change                                                                                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`                   | `hasNotAttempted` flag; new precedence in `rollupMetric`; JSDoc rewrite.                                                                            |
| `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` | `computeOverallComposite` error-exclusion + summed `totalWeight` on terminal branches; JSDoc rewrite.                                               |
| `src/frontend/src/features/classPage/classPageAdapter.ts`                            | `computeAverageMetric` delegates to `computeOverallComposite`; remove `buildErrorMetric` / `isAnyError` / `isAnyComputed` if unused; JSDoc rewrite. |

---

## Test files to update

Trivial-but-required updates to reflect the new precedence (user accepts the churn):

- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts`
  - "returns error when any sub-task is error" → now `computed`/`notAttempted` (error excluded).
  - `ERROR_EXCLUSION` describe block (lines ~316-328) asserts `error` → must assert the
    non-error result (computed when a computed entry is present, else notAttempted).
  - "metadata accumulation across states — error wins" (lines ~507-531) → `error` no
    longer wins; assert the computed/notAttempted result and that `totalWeight` excludes
    error weights.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`
  - Any test asserting `computeOverallComposite` error escalation → assert error-exclusion.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
  - Integration tests asserting per-student / per-task / per-class rollups collapse to
    `error` on a single errored input → assert the average is now computed/excludes errors.
- `src/frontend/src/features/classPage/classPageAdapter.spec.ts`
  - Tests asserting `computeAverageMetric` / `buildRecentAssignment` escalation to `error`
    on a single criterion error → assert the average is now computed (error criterion excluded)
    or `error` only when all criteria are error.

Add explicit new coverage for the key behaviour:

- "error sub-task excluded from student rollup" (rollupMetric + rows).
- "all criteria error → overall still error" (computeOverallComposite).
- "one error criterion among two computed → overall excludes it" (computeOverallComposite).

---

## Acceptance criteria

1. A per-(student, task) cell with a genuinely missing criterion still reports `error`
   (leaf detection unchanged — verify via `accumToMetric` / existing leaf tests).
2. `rollupMetric` returns `error` **only** when every input is `error`; otherwise it
   returns `computed` (errors excluded) or `notAttempted` (no computed, errors + NAs only).
3. `computeOverallComposite` returns `error` **only** when all three criteria are `error`;
   otherwise it returns `computed` over the non-error criteria (errors excluded like `notAttempted`).
4. `computeAverageMetric` produces identical results to `computeOverallComposite` for the
   same three criteria (single source of truth); duplicated escalation helpers removed.
5. No change to heatmap output for valid or leaf-error inputs.
6. `lint:frontend` clean; `test:frontend` green for the touched suites and the full
   `dataAnalysis` + `classPage` trees.
7. JSDoc on all three functions documents the new error-exclusion precedence and the
   summed-`totalWeight` terminal convention.

---

## Review loop

1. **Implementation** — delegate to `Implementation` (code edits) and **Testing Specialist**
   (test updates) with the `Mandatory Reading` list above and this plan as the source of truth.
2. **Code Reviewer** — review the diff against the acceptance criteria and module standards;
   return findings to `Implementation` until clean.
3. **Docs** — JSDoc on the three functions was part of the code change. A follow-up audit
   found the canonical helper doc `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   (§9.17 item 4 `rollupMetric`, §9.18.1 `classPageAdapter`) still described the OLD error-escalation
   precedence and the inline per-assignment average; it was updated to the error-exclusion behaviour.
   The `MetricResult` schema comment in `dataAnalysis.zod.ts` was also clarified (the
   `error > notAttempted > computed` ordering is display/sort precedence only; rollups exclude errors).
   `docs/pedagogy/data-analysis-scoring.md` gained a teacher-facing note that a single `E` task does
   not invalidate a student's or class's average.
4. Regression baseline explicitly **skipped** by user request for this change.

No commit/push requested by the user; the orchestrator stops after a clean review.
