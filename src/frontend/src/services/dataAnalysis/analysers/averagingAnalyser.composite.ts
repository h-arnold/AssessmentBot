import type { MetricResult } from '../dataAnalysis.zod';
import type { CriterionWeightings } from './averagingAnalyser';

interface WeightedCriterion {
  readonly metric: MetricResult;
  readonly weighting: number;
}

/**
 * Compute the `overall` MetricResult as a composite of the three per-criterion
 * rollups using the 40/40/20 weighting with SPaG-renormalisation.
 *
 * Resolution order: all-error criteria produce `error`; any computed criterion
 * with positive contribution and positive criterion weighting produces
 * `computed`; otherwise a positive-weight raw `N` produces `notAttempted`.
 * Observed evidence with no contribution produces `excluded`. With no observed
 * data points at all, the legacy no-data `notAttempted` result is retained for
 * presentation-only placeholders.
 *
 * Computed criteria are combined with the configured criterion weights,
 * renormalising over the included criteria (including SPaG exclusion). Errors,
 * not-attempted criteria and zero-weight computed criteria do not enter the
 * numeric composite.
 *
 * @remarks Metadata fields (`totalWeight`, `applicableDataPoints`,
 *   `totalDataPoints`) in the composite result are **summed** across the
 *   contributing criteria entries (not `Math.max`). The prior implementation
 *   used `Math.max`, which discarded data when criteria had different weights.
 *   The sum semantics was confirmed as a spec amendment per user decision.
 *   On terminal (`error` / `notAttempted`) branches, `totalWeight` is the sum
 *   of all three criteria's `totalWeight` (resolving a pre-existing
 *   inconsistency where terminal results used `totalWeight: 0`).
 *
 * @param {MetricResult} completeness - The completeness rollup MetricResult.
 * @param {MetricResult} accuracy - The accuracy rollup MetricResult.
 * @param {MetricResult} spag - The spag rollup MetricResult.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {MetricResult} The composite overall MetricResult.
 */
export function computeOverallComposite(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult,
  criterionWeightings: CriterionWeightings
): MetricResult {
  const criteriaByName = {
    completeness: { metric: completeness, weighting: criterionWeightings.completeness },
    accuracy: { metric: accuracy, weighting: criterionWeightings.accuracy },
    spag: { metric: spag, weighting: criterionWeightings.spag },
  } satisfies Record<keyof CriterionWeightings, WeightedCriterion>;
  const criteria = Object.values(criteriaByName);
  const terminal = resolveTerminalComposite(criteria);
  if (terminal) return terminal;

  // Only computed criteria with positive contribution and criterion weighting
  // participate in the renormalised composite.
  const toComputedEntry = (
    m: MetricResult,
    w: number
  ): {
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
    weighting: number;
  } | null => {
    if (m.state !== 'computed' || m.totalWeight <= 0 || w <= 0) return null;
    return {
      value: m.value,
      totalWeight: m.totalWeight,
      applicableDataPoints: m.applicableDataPoints,
      totalDataPoints: m.totalDataPoints,
      weighting: w,
    };
  };

  const entries = criteria
    .map(({ metric, weighting }) => toComputedEntry(metric, weighting))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  let numerator = 0;
  let denominator = 0;
  let totalWeight = 0;
  let applicableDataPoints = 0;
  let totalDataPoints = 0;

  for (const entry of entries) {
    numerator += entry.weighting * entry.value;
    denominator += entry.weighting;
    totalWeight += entry.totalWeight;
    applicableDataPoints += entry.applicableDataPoints;
    totalDataPoints += entry.totalDataPoints;
  }

  return {
    state: 'computed',
    value: numerator / denominator,
    totalWeight,
    applicableDataPoints,
    totalDataPoints,
  };
}

/**
 * Resolve terminal composite states before numeric composition.
 * @param {ReadonlyArray<WeightedCriterion>} criteria - Criterion results paired with their configured weights.
 * @returns {MetricResult | null} A terminal result, or null for numeric composition.
 */
function resolveTerminalComposite(criteria: ReadonlyArray<WeightedCriterion>): MetricResult | null {
  const totalWeight = criteria.reduce((sum, { metric }) => sum + metric.totalWeight, 0);
  const totalDataPoints = criteria.reduce((sum, { metric }) => sum + metric.totalDataPoints, 0);
  if (criteria.every(({ metric }) => metric.state === 'error')) {
    return {
      state: 'error',
      value: 'E',
      totalWeight,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  const hasComputed = criteria.some(
    ({ metric, weighting }) =>
      metric.state === 'computed' && metric.totalWeight > 0 && weighting > 0
  );
  const hasPositiveNotAttempted = criteria.some(
    ({ metric }) => metric.state === 'notAttempted' && metric.totalWeight > 0
  );
  if (!hasComputed && hasPositiveNotAttempted) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  if (!hasComputed && totalDataPoints === 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight,
      applicableDataPoints: 0,
      totalDataPoints: 0,
    };
  }
  if (!hasComputed) {
    return {
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  return null;
}
