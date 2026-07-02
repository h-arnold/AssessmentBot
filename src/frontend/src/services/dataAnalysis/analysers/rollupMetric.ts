import type { MetricResult } from '../dataAnalysis.zod';

/**
 * The three criteria that `rollupMetric` supports.
 *
 * @remarks
 * `'average'` is intentionally **not** included. The average is a composite
 * of the three per-criterion rollups at every aggregation level, not a fourth
 * independent weighted average. See spec decision 5.
 */
export type RollupMetric = 'completeness' | 'accuracy' | 'spag';

/**
 * Accumulated state from a single pass over sub-tasks.
 */
interface AccumulatedState {
  hasError: boolean;
  hasComputed: boolean;
  totalWeightedSum: number;
  computedTotalWeight: number;
  computedAp: number;
  computedTd: number;
  naTotalWeight: number;
  naTotalDataPoints: number;
  allTotalWeight: number;
  allTotalDataPoints: number;
}

/**
 * Create an initial empty AccumulatedState.
 *
 * @returns {AccumulatedState} A zeroed AccumulatedState.
 */
function createAccumulatedState(): AccumulatedState {
  return {
    hasError: false,
    hasComputed: false,
    totalWeightedSum: 0,
    computedTotalWeight: 0,
    computedAp: 0,
    computedTd: 0,
    naTotalWeight: 0,
    naTotalDataPoints: 0,
    allTotalWeight: 0,
    allTotalDataPoints: 0,
  };
}

/**
 * Accumulate one sub-task into the running accumulators.
 *
 * @param {AccumulatedState} accumulator - The running accumulators (mutated in place).
 * @param {MetricResult} st - The sub-task to accumulate.
 * @param {RollupMetric} metric - The criterion being rolled up.
 */
function accumulateOne(
  accumulator: AccumulatedState,
  st: MetricResult,
  metric: RollupMetric
): void {
  accumulator.allTotalWeight += st.totalWeight;
  accumulator.allTotalDataPoints += st.totalDataPoints;

  switch (st.state) {
    case 'error': {
      accumulator.hasError = true;
      break;
    }
    case 'computed': {
      accumulator.hasComputed = true;
      const cs = st as Extract<MetricResult, { state: 'computed' }>;
      accumulator.totalWeightedSum += cs.value * cs.totalWeight;
      accumulator.computedTotalWeight += cs.totalWeight;
      accumulator.computedAp += cs.applicableDataPoints;
      accumulator.computedTd += cs.totalDataPoints;
      break;
    }
    case 'notAttempted': {
      if (metric !== 'spag') {
        accumulator.naTotalWeight += st.totalWeight;
        accumulator.naTotalDataPoints += st.totalDataPoints;
      }
      break;
    }
  }
}

/**
 * Build a terminal (non-computed) MetricResult for either the `error` or
 * `notAttempted` state based on the `hasError` flag.
 *
 * @param {boolean} hasError - Whether the result should be in error state.
 * @param {number} totalWeight - Sum of totalWeight across all sub-tasks.
 * @param {number} totalDataPoints - Sum of totalDataPoints across all sub-tasks.
 * @returns {MetricResult} An error MetricResult if `hasError` is true,
 *   otherwise a notAttempted MetricResult.
 */
function terminalRollup(
  hasError: boolean,
  totalWeight: number,
  totalDataPoints: number
): MetricResult {
  if (hasError) {
    return {
      state: 'error',
      value: 'E',
      totalWeight,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  return {
    state: 'notAttempted',
    value: 'N',
    totalWeight,
    applicableDataPoints: 0,
    totalDataPoints,
  };
}

/**
 * Roll up an array of per-sub-task `MetricResult` values into a single
 * `MetricResult` for the given criterion.
 *
 * @remarks
 * **Single-pass algorithm:**
 * This function makes exactly **one** iteration over `subTasks` per call.
 * The prior implementation iterated 4–5 times (validation, error detection,
 * filtering, computation, reduce calls). All accumulators are updated in a
 * single `for...of` loop via {@link accumulateOne}:
 *
 * - `allTotalWeight` / `allTotalDataPoints` — summed from every sub-task
 *   (used for terminal rollup metadata).
 * - `totalWeightedSum` / `computedTotalWeight` / `computedAp` / `computedTd`
 *   — accumulated only from `computed` sub-tasks.
 * - `naTotalWeight` / `naTotalDataPoints` — accumulated only from
 *   `notAttempted` sub-tasks (and only for completeness/accuracy; spag
 *   excludes them entirely).
 * - `hasError` — set to `true` if any sub-task is in error state.
 * - `hasComputed` — set to `true` if any sub-task is in computed state.
 *
 * After the loop, the result state is determined by precedence:
 * `error` > `notAttempted` > `computed`.
 *
 * **Precedence** (spec decision 4):
 * - `error` always wins: if **any** sub-task is `error`, the result is `error`.
 * - `notAttempted`: If ALL sub-tasks are `notAttempted` (no `error`, no
 *   `computed`), result is `notAttempted`.
 * - `computed`: If at least one sub-task is `computed` and no `error`, result
 *   is `computed`.
 *
 * **Per-metric `notAttempted` handling** (spec decision 5):
 * - `completeness` / `accuracy`: a `notAttempted` sub-task contributes a score
 *   of `0` — its `totalWeight` is included in the denominator, but zero in the
 *   numerator.
 * - `spag`: a `notAttempted` sub-task is **excluded entirely** — its
 *   `totalWeight` is not included in the denominator (SPaG cannot be assessed
 *   on unsubmitted work). When all sub-tasks are `notAttempted` (and excluded),
 *   the result is still `notAttempted`.
 *
 * **Error sub-tasks** are excluded from the calculation in all cases (no
 * contribution to numerator or denominator).
 *
 * **Contract:**
 * - Pure function. No side effects, no React / antd / I/O / state.
 * - Throws on empty `subTasks` array.
 * - Throws if `finalTotalWeight` is zero in the computed path (all weights are
 *   zero).
 * - Input structural validation is assumed to have been performed by Zod at the
 *   analyser boundary; no runtime field validation is performed.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - The per-sub-task MetricResults
 *   to roll up.
 * @param {RollupMetric} metric - The criterion being rolled up.
 * @returns {MetricResult} The rolled-up MetricResult.
 */
export function rollupMetric(
  subTasks: ReadonlyArray<MetricResult>,
  metric: RollupMetric
): MetricResult {
  if (subTasks.length === 0) {
    throw new Error('rollupMetric: subTasks must not be empty');
  }

  const accumulator = createAccumulatedState();

  for (const st of subTasks) {
    accumulateOne(accumulator, st, metric);
  }

  // Precedence: error > notAttempted > computed
  if (accumulator.hasError) {
    return terminalRollup(true, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
  }

  if (!accumulator.hasComputed) {
    return terminalRollup(false, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
  }

  // Computed path: determine whether to include notAttempted weight
  let finalTotalWeight: number;
  let finalTotalDataPoints: number;

  if (metric === 'spag') {
    finalTotalWeight = accumulator.computedTotalWeight;
    finalTotalDataPoints = accumulator.computedTd;
  } else {
    finalTotalWeight = accumulator.computedTotalWeight + accumulator.naTotalWeight;
    finalTotalDataPoints = accumulator.computedTd + accumulator.naTotalDataPoints;
  }

  if (finalTotalWeight === 0) {
    throw new Error('rollupMetric: all sub-task weights are zero');
  }

  return {
    state: 'computed',
    value: accumulator.totalWeightedSum / finalTotalWeight,
    totalWeight: finalTotalWeight,
    applicableDataPoints: Math.min(accumulator.computedAp, finalTotalDataPoints),
    totalDataPoints: finalTotalDataPoints,
  };
}
