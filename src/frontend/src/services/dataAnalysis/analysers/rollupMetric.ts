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
 * Roll up an array of per-sub-task `MetricResult` values into a single
 * `MetricResult` for the given criterion.
 *
 * @remarks
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
 * - `spag`: a `notAttempted` sub-task is **excluded entirely** — its `totalWeight`
 *   is not included in the denominator (SPaG cannot be assessed on unsubmitted
 *   work). When all sub-tasks are `notAttempted` (and excluded), the result is
 *   still `notAttempted`.
 *
 * **Error sub-tasks** are excluded from the calculation in all cases (no
 * contribution to numerator or denominator).
 *
 * **Contract:**
 * - Pure function. No side effects, no React / antd / I/O / state.
 * - Throws on empty `subTasks` array.
 * - Throws on structurally-invalid sub-tasks (unknown `state` or missing
 *   required fields).
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - The per-sub-task MetricResults
 *   to roll up.
 * @param {RollupMetric} metric - The criterion being rolled up.
 * @returns {MetricResult} The rolled-up MetricResult.
 */
/**
 * Validate all sub-tasks have recognised states and structurally-valid fields.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - The sub-tasks to validate.
 */
const VALID_STATES = ['computed', 'notAttempted', 'error'] as const;

/**
 * Validate required fields for a computed sub-task.
 *
 * @param {Record<string, unknown>} raw - The raw sub-task object to validate.
 */
function validateComputedFields(raw: Record<string, unknown>): void {
  if (typeof raw.value !== 'number') {
    throw new TypeError('rollupMetric: computed sub-task is missing required numeric value field');
  }
  if (
    typeof raw.totalWeight !== 'number' ||
    typeof raw.applicableDataPoints !== 'number' ||
    typeof raw.totalDataPoints !== 'number'
  ) {
    throw new TypeError(
      'rollupMetric: computed sub-task is missing required numeric fields (totalWeight, applicableDataPoints, totalDataPoints)'
    );
  }
}

/**
 * Validate required fields for a notAttempted sub-task.
 *
 * @param {Record<string, unknown>} raw - The raw sub-task object to validate.
 */
function validateNotAttemptedFields(raw: Record<string, unknown>): void {
  if (raw.value !== 'N') {
    throw new Error('rollupMetric: notAttempted sub-task has invalid value field');
  }
}

/**
 * Validate required fields for an error sub-task.
 *
 * @param {Record<string, unknown>} raw - The raw sub-task object to validate.
 */
function validateErrorFields(raw: Record<string, unknown>): void {
  if (raw.value !== 'E') {
    throw new Error('rollupMetric: error sub-task has invalid value field');
  }
}

/**
 * Validate all sub-tasks have recognised states and structurally-valid fields.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - The sub-tasks to validate.
 */
function validateSubTasks(subTasks: ReadonlyArray<MetricResult>): void {
  for (const st of subTasks) {
    const raw = st as Record<string, unknown>;
    if (!(VALID_STATES as readonly string[]).includes(st.state)) {
      throw new Error(`rollupMetric: invalid sub-task state: "${raw.state}"`);
    }
    if (st.state === 'computed') validateComputedFields(raw);
    if (st.state === 'notAttempted') validateNotAttemptedFields(raw);
    if (st.state === 'error') validateErrorFields(raw);
  }
}

/**
 * Roll up computed sub-tasks for the spag metric (where notAttempted is excluded).
 *
 * @param {ReadonlyArray<MetricResult>} computedSubTasks - Only computed sub-tasks.
 * @returns {MetricResult} The rolled-up computed MetricResult.
 */
function rollupComputedForSpag(computedSubTasks: ReadonlyArray<MetricResult>): MetricResult {
  let totalWeightedSum = 0;
  let computedTotalWeight = 0;
  let computedAp = 0;
  let computedTd = 0;

  for (const st of computedSubTasks) {
    const cs = st as {
      state: 'computed';
      value: number;
      totalWeight: number;
      applicableDataPoints: number;
      totalDataPoints: number;
    };
    totalWeightedSum += cs.value * cs.totalWeight;
    computedTotalWeight += cs.totalWeight;
    computedAp += cs.applicableDataPoints;
    computedTd += cs.totalDataPoints;
  }

  return {
    state: 'computed',
    value: totalWeightedSum / computedTotalWeight,
    totalWeight: computedTotalWeight,
    applicableDataPoints: Math.min(computedAp, computedTd),
    totalDataPoints: computedTd,
  };
}

/**
 * Compute the weighted mean for completeness/accuracy, including notAttempted
 * sub-tasks which contribute 0 with their weight in the denominator.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - All non-error sub-tasks.
 * @returns {MetricResult} The rolled-up computed MetricResult.
 */
function rollupCompletenessOrAccuracy(subTasks: ReadonlyArray<MetricResult>): MetricResult {
  let totalWeightedSum = 0;
  let totalWeight = 0;
  let sumComputedAp = 0;
  let totalDataPoints = 0;

  for (const st of subTasks) {
    if (st.state === 'computed') {
      const cs = st as {
        state: 'computed';
        value: number;
        totalWeight: number;
        applicableDataPoints: number;
        totalDataPoints: number;
      };
      totalWeightedSum += cs.value * cs.totalWeight;
      totalWeight += cs.totalWeight;
      sumComputedAp += cs.applicableDataPoints;
      totalDataPoints += cs.totalDataPoints;
    } else {
      // notAttempted contributes 0 with weight in denominator
      totalWeight += st.totalWeight;
      totalDataPoints += st.totalDataPoints;
    }
  }

  if (totalWeight === 0) {
    throw new Error('rollupMetric: all sub-task weights are zero');
  }

  return {
    state: 'computed',
    value: totalWeightedSum / totalWeight,
    totalWeight,
    applicableDataPoints: Math.min(sumComputedAp, totalDataPoints),
    totalDataPoints,
  };
}

/**
 * Create a notAttempted MetricResult for rollup output.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - All sub-tasks.
 * @returns {MetricResult} A notAttempted MetricResult.
 */
function notAttemptedRollup(subTasks: ReadonlyArray<MetricResult>): MetricResult {
  return {
    state: 'notAttempted',
    value: 'N',
    totalWeight: subTasks.reduce((s, t) => s + t.totalWeight, 0),
    applicableDataPoints: 0,
    totalDataPoints: subTasks.reduce((s, t) => s + t.totalDataPoints, 0),
  };
}

/**
 * Create an error MetricResult for rollup output.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - All sub-tasks.
 * @returns {MetricResult} An error MetricResult.
 */
function errorRollup(subTasks: ReadonlyArray<MetricResult>): MetricResult {
  return {
    state: 'error',
    value: 'E',
    totalWeight: subTasks.reduce((s, t) => s + t.totalWeight, 0),
    applicableDataPoints: 0,
    totalDataPoints: subTasks.reduce((s, t) => s + t.totalDataPoints, 0),
  };
}

/**
 * Roll up an array of per-sub-task `MetricResult` values into a single
 * `MetricResult` for the given criterion.
 *
 * See the file-level JSDoc for full contract details.
 *
 * @param {ReadonlyArray<MetricResult>} subTasks - The per-sub-task MetricResults.
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

  validateSubTasks(subTasks);

  // Precedence: error wins always
  if (subTasks.some((t) => t.state === 'error')) {
    return errorRollup(subTasks);
  }

  // For spag: notAttempted is excluded entirely
  if (metric === 'spag') {
    const computedSubTasks = subTasks.filter((t) => t.state === 'computed');
    if (computedSubTasks.length === 0) {
      return notAttemptedRollup(subTasks);
    }
    return rollupComputedForSpag(computedSubTasks);
  }

  // For completeness/accuracy: mixed computed + notAttempted → computed
  if (subTasks.some((t) => t.state === 'computed')) {
    return rollupCompletenessOrAccuracy(subTasks);
  }

  return notAttemptedRollup(subTasks);
}
