import { logFrontendEvent } from '../../../logging/frontendLogger';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import type { CriterionWeightings } from './averagingAnalyser';
import type {
  AssessmentScore,
  DataPointAccumulator,
  MetricAccumulator,
} from './averagingAnalyser.types';

/**
 * Criterion-level accumulation logic extracted from
 * `averagingAnalyser.accumulation.ts` so assignment orchestration and
 * criterion-level score handling have separate responsibilities.
 *
 * All criterion-level accumulation helpers live here:
 * `accumulateCriterion`, `accumulateMetricsToTarget`, `computeOverall`,
 * `processSubmissionItem`, and `processItemAssessments`.
 */

/**
 * Narrow a raw criterion score to the analyser's assessment-score contract.
 * @param {unknown} score - Raw score value from a submission item.
 * @returns {AssessmentScore} The supported score, or undefined when invalid.
 */
function toAssessmentScore(score: unknown): AssessmentScore {
  if (typeof score === 'number' || score === 'N') return score;
  return undefined;
}

/**
 * Accumulate a single criterion score into its metric accumulator.
 *
 * @param {MetricAccumulator} accum - The metric accumulator to update.
 * @param {AssessmentScore} score - The criterion score.
 * @param {number} weight - The per-data-point weight.
 */
export function accumulateCriterion(
  accum: MetricAccumulator,
  score: AssessmentScore,
  weight: number
): void {
  if (typeof score === 'number') {
    accum.displaySum += score;
    accum.displayCount++;
    accum.displayTotalDataPoints++;
    if (weight > 0) {
      accum.totalDataPoints++;
      accum.weightedSum += score * weight;
      accum.totalWeight += weight;
      accum.applicableDataPoints++;
    }
  } else if (score === 'N') {
    accum.displayNCount++;
    accum.displayTotalDataPoints++;
    if (weight > 0) {
      accum.totalDataPoints++;
      accum.totalWeight += weight;
      accum.nCount++;
    }
  }
}

/**
 * Accumulate all four metrics into a single target accumulator for one
 * data point.
 *
 * @param {DataPointAccumulator} target - The accumulator to update.
 * @param {AssessmentScore} completenessScore - Completeness score.
 * @param {AssessmentScore} accuracyScore - Accuracy score.
 * @param {AssessmentScore} spagScore - SPaG score.
 * @param {number | null} overallValue - Pre-computed overall.
 * @param {number} weight - Per-data-point weight.
 */
export function accumulateMetricsToTarget(
  target: DataPointAccumulator,
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore,
  overallValue: number | null,
  weight: number
): void {
  accumulateCriterion(target.completeness, completenessScore, weight);
  accumulateCriterion(target.accuracy, accuracyScore, weight);
  accumulateCriterion(target.spag, spagScore, weight);

  if (overallValue !== null) {
    target.overall.displaySum += overallValue;
    target.overall.displayCount++;
    target.overall.displayTotalDataPoints++;
    if (weight > 0) {
      target.overall.totalDataPoints++;
      target.overall.weightedSum += overallValue * weight;
      target.overall.totalWeight += weight;
      target.overall.applicableDataPoints++;
    }
  } else if (completenessScore === 'N' || accuracyScore === 'N' || spagScore === 'N') {
    target.overall.displayNCount++;
    target.overall.displayTotalDataPoints++;
    if (weight > 0) {
      target.overall.totalDataPoints++;
      target.overall.nCount++;
    }
  }
}

/**
 * Compute the overall value for a single data point, renormalising when
 * criteria are 'N' (not applicable).
 *
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {AssessmentScore} completenessScore - The completeness score.
 * @param {AssessmentScore} accuracyScore - The accuracy score.
 * @param {AssessmentScore} spagScore - The SPaG score.
 * @returns {number | null} The weighted overall, or null if all criteria
 *   are unavailable.
 */
export function computeOverall(
  criterionWeightings: CriterionWeightings,
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore
): number | null {
  const cw = criterionWeightings;
  let numerator = 0;
  let denominator = 0;

  if (typeof completenessScore === 'number') {
    numerator += cw.completeness * completenessScore;
    denominator += cw.completeness;
  }
  if (typeof accuracyScore === 'number') {
    numerator += cw.accuracy * accuracyScore;
    denominator += cw.accuracy;
  }
  if (typeof spagScore === 'number') {
    numerator += cw.spag * spagScore;
    denominator += cw.spag;
  }

  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Process one submission item, accumulating metrics into all scopes.
 *
 * @param {AssessmentScore} completenessScore - The completeness score.
 * @param {AssessmentScore} accuracyScore - The accuracy score.
 * @param {AssessmentScore} spagScore - The SPaG score.
 * @param {number} weight - The per-data-point weight.
 * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
 * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {DataPointAccumulator} [perStudentTaskAccum] - Optional per-(student, task)
 *   accumulator for rollup input building.
 */
export function processSubmissionItem(
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore,
  weight: number,
  studentAccum: DataPointAccumulator,
  taskAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings,
  perStudentTaskAccum?: DataPointAccumulator
): void {
  const overallValue = computeOverall(
    criterionWeightings,
    completenessScore,
    accuracyScore,
    spagScore
  );

  accumulateMetricsToTarget(
    studentAccum,
    completenessScore,
    accuracyScore,
    spagScore,
    overallValue,
    weight
  );
  accumulateMetricsToTarget(
    taskAccum,
    completenessScore,
    accuracyScore,
    spagScore,
    overallValue,
    weight
  );

  if (perStudentTaskAccum) {
    accumulateMetricsToTarget(
      perStudentTaskAccum,
      completenessScore,
      accuracyScore,
      spagScore,
      overallValue,
      weight
    );
  }
}

/**
 * Extract assessment scores from a submission item and apply them to all
 * accumulator scopes.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string]}
 *   item - The submission item.
 * @param {number} weight - The per-data-point weight.
 * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
 * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {DataPointAccumulator} [perStudentTaskAccum] - Optional per-(student, task)
 *   accumulator for rollup input building.
 */
export function processItemAssessments(
  item: AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string],
  weight: number,
  studentAccum: DataPointAccumulator,
  taskAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings,
  perStudentTaskAccum?: DataPointAccumulator
): void {
  const { assessments, taskId } = item;
  const assessmentsOrEmpty = assessments ?? {};
  const rawCriterionScores = [
    ['completeness', assessmentsOrEmpty.completeness?.score],
    ['accuracy', assessmentsOrEmpty.accuracy?.score],
    ['spag', assessmentsOrEmpty.spag?.score],
  ] as const;
  const criterionScores = rawCriterionScores.map(([criterion, score]) => ({
    criterion,
    score: toAssessmentScore(score),
    scoreType: typeof score,
  }));

  for (const { criterion, score, scoreType } of criterionScores) {
    if (score !== undefined) continue;

    logFrontendEvent('warn', {
      context: 'processItemAssessments',
      errorMessage: `Invalid ${criterion} score for task '${taskId}'; dropping the score`,
      metadata: { criterion, taskId, scoreType },
    });
  }

  const completenessScore = criterionScores[0].score;
  const accuracyScore = criterionScores[1].score;
  const spagScore = criterionScores[2].score;

  processSubmissionItem(
    completenessScore,
    accuracyScore,
    spagScore,
    weight,
    studentAccum,
    taskAccum,
    criterionWeightings,
    perStudentTaskAccum
  );
}
