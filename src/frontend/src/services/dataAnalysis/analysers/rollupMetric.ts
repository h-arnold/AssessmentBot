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
  hasPositiveNotAttempted: boolean;
  hasObservedNonError: boolean;
  totalWeightedSum: number;
  computedTotalWeight: number;
  computedAp: number;
  computedTd: number;
  naTotalWeight: number;
  naTotalDataPoints: number;
  allTotalWeight: number;
  allTotalDataPoints: number;
  observedDataPoints: number;
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
    hasPositiveNotAttempted: false,
    hasObservedNonError: false,
    totalWeightedSum: 0,
    computedTotalWeight: 0,
    computedAp: 0,
    computedTd: 0,
    naTotalWeight: 0,
    naTotalDataPoints: 0,
    allTotalWeight: 0,
    allTotalDataPoints: 0,
    observedDataPoints: 0,
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
      accumulateComputed(accumulator, st);
      break;
    }
    case 'notAttempted': {
      accumulateNotAttempted(accumulator, st, metric);
      break;
    }
    case 'excluded': {
      accumulator.hasObservedNonError = true;
      accumulator.observedDataPoints += st.totalDataPoints;
      break;
    }
  }
}

/**
 * Accumulate a computed input.
 * @param {AccumulatedState} accumulator - Running state.
 * @param {Extract<MetricResult, { state: 'computed' }>} metric - Input metric.
 */
function accumulateComputed(
  accumulator: AccumulatedState,
  metric: Extract<MetricResult, { state: 'computed' }>
): void {
  accumulator.hasObservedNonError = true;
  accumulator.observedDataPoints += metric.totalDataPoints;
  if (metric.totalWeight <= 0) {
    return;
  }
  accumulator.hasComputed = true;
  accumulator.totalWeightedSum += metric.value * metric.totalWeight;
  accumulator.computedTotalWeight += metric.totalWeight;
  accumulator.computedAp += metric.applicableDataPoints;
  accumulator.computedTd += metric.totalDataPoints;
}

/**
 * Accumulate a raw not-attempted input.
 * @param {AccumulatedState} accumulator - Running state.
 * @param {Extract<MetricResult, { state: 'notAttempted' }>} metricResult - Input metric.
 * @param {RollupMetric} metric - Criterion being rolled up.
 */
function accumulateNotAttempted(
  accumulator: AccumulatedState,
  metricResult: Extract<MetricResult, { state: 'notAttempted' }>,
  metric: RollupMetric
): void {
  accumulator.hasObservedNonError = true;
  accumulator.observedDataPoints += metricResult.totalDataPoints;
  if (metricResult.totalWeight <= 0) return;
  accumulator.hasPositiveNotAttempted = true;
  if (metric !== 'spag') {
    accumulator.naTotalWeight += metricResult.totalWeight;
    accumulator.naTotalDataPoints += metricResult.totalDataPoints;
  }
}

/**
 * Resolve state in precedence order: all-error, positive-weight raw N without
 * a numeric contribution, positive-weight numeric contribution, then excluded.
 *
 * @param {AccumulatedState} accumulator - The accumulated state after one pass.
 * @returns {'error' | 'notAttempted' | 'computed' | 'excluded'} The rollup state.
 */
function determineRollupState(
  accumulator: AccumulatedState
): 'error' | 'notAttempted' | 'computed' | 'excluded' {
  if (accumulator.hasError && !accumulator.hasObservedNonError) return 'error';
  if (accumulator.hasComputed) return 'computed';
  if (accumulator.hasPositiveNotAttempted) return 'notAttempted';
  return accumulator.hasObservedNonError ? 'excluded' : 'error';
}

/**
 * Build the terminal error or not-attempted MetricResult.
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
 * This function makes exactly **one** iteration over `subTasks` per call. All
 * accumulators are updated in that single `for...of` loop via
 * {@link accumulateOne}:
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
 * - `hasPositiveNotAttempted` — set only for positive-weight raw `notAttempted`
 *   inputs.
 *
 * After the loop, the result state is determined by the following precedence:
 *
 * **Precedence:**
 * - `error` when every input is `error`.
 * - `computed` when a computed input has positive `totalWeight`.
 * - `notAttempted` when a raw `notAttempted` input has positive `totalWeight`
 *   and no numeric contribution exists.
 * - `excluded` when observations exist but none contributes. Zero-weight
 *   computed and raw `notAttempted` inputs remain observed evidence only.
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
 * - Zero-weight observations do not contribute to the computed path.
 * - Computed results report the maximum of contributing and all observed
 *   non-error data-point counts, so excluded display evidence remains counted.
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

  return resolveRollupResult(accumulator, metric);
}

/**
 * Resolve the accumulated rollup state and value.
 * @param {AccumulatedState} accumulator - Running state.
 * @param {RollupMetric} metric - Criterion being rolled up.
 * @returns {MetricResult} The resolved metric.
 */
function resolveRollupResult(accumulator: AccumulatedState, metric: RollupMetric): MetricResult {
  const rollupState = determineRollupState(accumulator);
  if (rollupState === 'error') {
    return terminalRollup(true, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
  }
  if (rollupState === 'notAttempted') {
    return terminalRollup(false, accumulator.allTotalWeight, accumulator.allTotalDataPoints);
  }
  if (rollupState === 'excluded') {
    return {
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: accumulator.allTotalDataPoints,
    };
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

  return {
    state: 'computed',
    value: accumulator.totalWeightedSum / finalTotalWeight,
    totalWeight: finalTotalWeight,
    applicableDataPoints: Math.min(accumulator.computedAp, finalTotalDataPoints),
    totalDataPoints: Math.max(finalTotalDataPoints, accumulator.observedDataPoints),
  };
}
