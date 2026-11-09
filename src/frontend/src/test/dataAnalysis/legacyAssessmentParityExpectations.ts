/**
 * Expected-aggregation half of the legacy-analysis parity oracle.
 *
 * Computes expected analysis numbers from oracle observations so the legacy
 * parity suites assert independently derived values instead of restated
 * literals or analyser outputs. It mirrors the documented averaging
 * semantics: student scope is a weighted mean over numeric observations
 * (`N` retains weight without a value, `E` contributes nothing); class scope
 * rolls up student metrics (SPaG `N` weight is excluded); task scope uses the
 * display mean of numeric scores. Zero-weight numeric and `N` observations
 * stay observed-but-non-contributing display evidence: they count toward
 * `totalDataPoints` without changing value or weight.
 */

import type { AveragingAnalyserInput } from '@/services/dataAnalysis/dataAnalysis.zod';
import {
  type AggregateExpectation,
  collectObservations,
  type Criterion,
  type Observation,
} from './legacyAssessmentParityOracle';

/**
 * Task-scope expectation: the display mean of the task's numeric scores, with
 * `N` retaining weight and `E` excluded. Every observation of one task shares
 * the same effective weight.
 * @param {Observation[]} observations - The task's observations.
 * @returns {AggregateExpectation} Expected task metric.
 */
export function expectedTaskMetric(observations: Observation[]): AggregateExpectation {
  const numeric = observations.filter((entry) => typeof entry.score === 'number');
  if (numeric.length === 0) throw new Error('Oracle expected a numeric task observation');
  const contributing = observations.filter(
    (entry) => entry.score !== 'E' && entry.effectiveWeight > 0
  );
  return {
    state: 'computed',
    value: numeric.reduce((total, entry) => total + (entry.score as number), 0) / numeric.length,
    totalWeight: contributing.reduce((total, entry) => total + entry.effectiveWeight, 0),
    applicableDataPoints: numeric.length,
    totalDataPoints: observations.filter((entry) => entry.score !== 'E').length,
  };
}

/**
 * Student-scope expectation: the weighted mean of the student's numeric
 * observations; `N` retains weight without a value; `E` contributes nothing.
 * Zero-weight numeric and `N` observations remain display evidence: they count
 * toward `totalDataPoints` but contribute no value, weight or applicable
 * points, matching the analyser's display counters.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {Criterion} criterion - Criterion to aggregate.
 * @param {string} studentId - Student identifier.
 * @returns {AggregateExpectation} Expected student metric.
 */
export function expectedStudentMetric(
  input: AveragingAnalyserInput,
  criterion: Criterion,
  studentId: string
): AggregateExpectation {
  let weightedSum = 0;
  let totalWeight = 0;
  let applicableDataPoints = 0;
  let totalDataPoints = 0;
  const observations = collectObservations(input, criterion, { studentId });
  for (const { score, effectiveWeight } of observations) {
    if (score === 'E') continue;
    if (effectiveWeight > 0) {
      if (typeof score === 'number') {
        weightedSum += score * effectiveWeight;
        totalWeight += effectiveWeight;
        applicableDataPoints += 1;
      } else {
        totalWeight += effectiveWeight;
      }
    }
    // Zero-weight numeric and N scores stay observed-but-non-contributing
    // display evidence, matching the analyser's display counters.
    totalDataPoints += 1;
  }
  if (applicableDataPoints > 0) {
    return {
      state: 'computed',
      value: weightedSum / totalWeight,
      totalWeight,
      applicableDataPoints,
      totalDataPoints,
    };
  }
  if (totalDataPoints > 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  return {
    state: 'error',
    value: 'E',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };
}

/** Accumulator for the class-scope rollup. */
interface ClassAccumulator {
  weightedSum: number;
  computedWeight: number;
  computedApplicable: number;
  computedDataPoints: number;
  notAttemptedWeight: number;
  notAttemptedDataPoints: number;
  observedDataPoints: number;
}

/**
 * Folds one student metric into the class rollup accumulator.
 * @param {ClassAccumulator} accumulator - Running class rollup (mutated).
 * @param {AggregateExpectation} metric - The student's expected metric.
 * @param {Criterion} criterion - Criterion being rolled up.
 * @returns {void}
 */
function accumulateStudentMetric(
  accumulator: ClassAccumulator,
  metric: AggregateExpectation,
  criterion: Criterion
): void {
  if (metric.state === 'error') return;
  accumulator.observedDataPoints += metric.totalDataPoints;
  if (metric.state === 'computed') {
    accumulator.weightedSum += (metric.value as number) * metric.totalWeight;
    accumulator.computedWeight += metric.totalWeight;
    accumulator.computedApplicable += metric.applicableDataPoints;
    accumulator.computedDataPoints += metric.totalDataPoints;
    return;
  }
  // SPaG cannot be assessed on unsubmitted work, so its N weight is excluded.
  if (criterion === 'spag') return;
  accumulator.notAttemptedWeight += metric.totalWeight;
  accumulator.notAttemptedDataPoints += metric.totalDataPoints;
}

/**
 * Class-scope expectation: the rollup of every submitting student's metric.
 * Computed students contribute `value × totalWeight`; completeness/accuracy
 * `N` students count as zero-scored weight; SPaG `N` students and error
 * students are excluded.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {Criterion} criterion - Criterion to aggregate.
 * @returns {AggregateExpectation} Expected class metric.
 */
export function expectedClassMetric(
  input: AveragingAnalyserInput,
  criterion: Criterion
): AggregateExpectation {
  const cls = input.classes[0];
  if (!cls) throw new Error('Expected the canonical class');
  const studentIds = [
    ...new Set(
      cls.assignments.flatMap((assignment) => assignment.submissions.map((s) => s.studentId))
    ),
  ];
  const accumulator: ClassAccumulator = {
    weightedSum: 0,
    computedWeight: 0,
    computedApplicable: 0,
    computedDataPoints: 0,
    notAttemptedWeight: 0,
    notAttemptedDataPoints: 0,
    observedDataPoints: 0,
  };
  for (const studentId of studentIds) {
    accumulateStudentMetric(
      accumulator,
      expectedStudentMetric(input, criterion, studentId),
      criterion
    );
  }
  if (accumulator.computedWeight === 0) {
    throw new Error('Oracle expected a positive-weight student metric');
  }
  const isSpag = criterion === 'spag';
  const finalWeight = isSpag
    ? accumulator.computedWeight
    : accumulator.computedWeight + accumulator.notAttemptedWeight;
  const finalDataPoints = isSpag
    ? accumulator.computedDataPoints
    : accumulator.computedDataPoints + accumulator.notAttemptedDataPoints;
  return {
    state: 'computed',
    value: accumulator.weightedSum / finalWeight,
    totalWeight: finalWeight,
    applicableDataPoints: Math.min(accumulator.computedApplicable, finalDataPoints),
    totalDataPoints: Math.max(finalDataPoints, accumulator.observedDataPoints),
  };
}
