/**
 * Legacy assessment analysis parity.
 *
 * One `'legacy'`-marked assignment inside an otherwise marker-1 class must
 * produce the same task heatmap and weighted class/student/task aggregates as
 * the equivalent all-current composition. The analyser reads only scores and
 * live weightings, so the read marker must never filter or reweight an
 * assignment. Expected numbers come from the standalone parity oracle, which
 * derives them from the canonical records.
 */

import { describe, expect, it } from 'vitest';
import { FLOAT_TOLERANCE } from '@/test/dataAnalysis/averagingAnalyserAssertions';
import {
  type AggregateExpectation,
  buildClassInput,
  canonicalItemScore,
  collectObservations,
  effectiveWeightFor,
  LEGACY_ASSIGNMENT_ID,
  LEGACY_DEFINITION_KEY,
  LEGACY_TASK_IDS,
  rosterSize,
  rosterStudentId,
} from '@/test/dataAnalysis/legacyAssessmentParityOracle';
import {
  expectedClassMetric,
  expectedStudentMetric,
  expectedTaskMetric,
} from '@/test/dataAnalysis/legacyAssessmentParityExpectations';
import {
  DataAnalysisResponseSchema,
  type AveragingResult,
  type MetricResult,
} from './dataAnalysis.zod';
import { AveragingAnalyser } from './analysers/averagingAnalyser';

/** Roster position selection: first, second and final rostered students. */
const ZERO_SCORE_STUDENT_ID = rosterStudentId(0);
const ALL_ERROR_STUDENT_ID = rosterStudentId(1);
const TOP_SCORE_STUDENT_ID = rosterStudentId(rosterSize() - 1);

/**
 * Runs the real analyser over the supplied input and validates the response.
 * @param {ReturnType<typeof buildClassInput>} input - Validated analyser input.
 * @returns {AveragingResult[]} Validated per-class results.
 */
function analyse(input: ReturnType<typeof buildClassInput>): AveragingResult[] {
  return DataAnalysisResponseSchema.parse(new AveragingAnalyser().analyse(input));
}

/**
 * Requires a computed metric so its numeric value can be asserted.
 * @param {MetricResult} metric - Metric result to inspect.
 * @returns {Extract<MetricResult, { state: 'computed' }>} The computed metric.
 */
function computed(metric: MetricResult): Extract<MetricResult, { state: 'computed' }> {
  if (metric.state !== 'computed') {
    throw new Error(`Expected a computed metric but received ${metric.state}`);
  }
  return metric;
}

/** Finds a per-student row by student identifier.
 * @param {AveragingResult} result - Analysis result to search.
 * @param {string} studentId - Student identifier.
 * @returns {AveragingResult['perStudent'][number]} The student's row.
 */
function studentRow(result: AveragingResult, studentId: string) {
  const row = result.perStudent.find((entry) => entry.studentId === studentId);
  if (!row) throw new Error(`Expected a row for ${studentId}`);
  return row;
}

/**
 * Asserts a computed metric against the oracle expectation.
 * @param {MetricResult} metric - Actual metric result.
 * @param {AggregateExpectation} expected - Oracle expectation.
 * @returns {void}
 */
function expectComputedMetric(metric: MetricResult, expected: AggregateExpectation): void {
  expect(metric.state).toBe('computed');
  expect(computed(metric).value).toBeCloseTo(expected.value as number, FLOAT_TOLERANCE);
  expect(metric.totalWeight).toBeCloseTo(expected.totalWeight, FLOAT_TOLERANCE);
  expect(metric).toMatchObject({
    applicableDataPoints: expected.applicableDataPoints,
    totalDataPoints: expected.totalDataPoints,
  });
}

/**
 * Asserts the legacy assignment's per-task rows keep their numeric means and
 * live contribution weights.
 * @param {AveragingResult} result - Actual analysis result.
 * @param {ReturnType<typeof buildClassInput>} input - Validated analyser input.
 * @returns {void}
 */
function expectLegacyTaskRows(
  result: AveragingResult,
  input: ReturnType<typeof buildClassInput>
): void {
  for (const taskId of LEGACY_TASK_IDS) {
    const task = result.perTask.find(
      (entry) => entry.definitionKey === LEGACY_DEFINITION_KEY && entry.taskId === taskId
    );
    if (!task) throw new Error(`Expected a per-task row for ${taskId}`);
    expect(task.averageContribution).toEqual({
      effectiveWeight: effectiveWeightFor(input, LEGACY_DEFINITION_KEY, taskId),
      includedInAverage: true,
    });
    expectComputedMetric(
      task.completeness,
      expectedTaskMetric(
        collectObservations(input, 'completeness', {
          assignmentId: LEGACY_ASSIGNMENT_ID,
          taskId,
        })
      )
    );
  }
}

/**
 * Asserts the top scorer's heatmap cells carry the legacy tasks' real recorded
 * scores and contribution weights.
 * @param {AveragingResult} result - Actual analysis result.
 * @param {ReturnType<typeof buildClassInput>} input - Validated analyser input.
 * @returns {void}
 */
function expectTopScorerCells(
  result: AveragingResult,
  input: ReturnType<typeof buildClassInput>
): void {
  const cells = result.perStudentTaskMetrics?.filter(
    (cell) => cell.studentId === TOP_SCORE_STUDENT_ID
  );
  if (!cells) throw new Error('Expected per-student task metrics');
  for (const taskId of LEGACY_TASK_IDS) {
    const cell = cells.find((entry) => entry.taskKey === `${LEGACY_DEFINITION_KEY}::${taskId}`);
    if (!cell) throw new Error(`Expected a heatmap cell for ${taskId}`);
    expect(computed(cell.completeness).value).toBe(
      canonicalItemScore(input, LEGACY_ASSIGNMENT_ID, taskId, TOP_SCORE_STUDENT_ID, 'completeness')
    );
    expect(cell.averageContribution.effectiveWeight).toBe(
      effectiveWeightFor(input, LEGACY_DEFINITION_KEY, taskId)
    );
  }
}

/**
 * Asserts error and not-attempted semantics stay unchanged for legacy data:
 * the all-error student keeps error rows; the zero-score student's SPaG stays
 * `notAttempted` with retained weight.
 * @param {AveragingResult} result - Actual analysis result.
 * @param {ReturnType<typeof buildClassInput>} input - Validated analyser input.
 * @returns {void}
 */
function expectErrorAndNotAttemptedSemantics(
  result: AveragingResult,
  input: ReturnType<typeof buildClassInput>
): void {
  const errorRow = studentRow(result, ALL_ERROR_STUDENT_ID);
  expect(errorRow.completeness.state).toBe('error');
  expect(errorRow.completeness.applicableDataPoints).toBe(0);
  const zeroSpag = studentRow(result, ZERO_SCORE_STUDENT_ID).spag;
  expect(zeroSpag.state).toBe('notAttempted');
  expect(zeroSpag.totalWeight).toBeCloseTo(
    expectedStudentMetric(input, 'spag', ZERO_SCORE_STUDENT_ID).totalWeight,
    FLOAT_TOLERANCE
  );
}

describe('legacy assessment analysis parity', () => {
  it('produces the same task heatmap and aggregates for one legacy assignment inside a marker-1 class', () => {
    const current = analyse(buildClassInput(false));
    const mixed = analyse(buildClassInput(true));
    expect(current[0]?.perStudentTaskMetrics?.length).toBeGreaterThan(0);
    expect(mixed).toEqual(current);
  });

  it('computes the expected weighted averages, contributions and heatmap cells from canonical records', () => {
    const input = buildClassInput(true);
    const [result] = analyse(input);
    if (!result) throw new Error('Expected a class result');

    // Class aggregates roll up the per-student weighted means.
    expectComputedMetric(result.perClass.completeness, expectedClassMetric(input, 'completeness'));
    expectComputedMetric(result.perClass.spag, expectedClassMetric(input, 'spag'));

    // Per-student rows aggregate the same evidence per student.
    expectComputedMetric(
      studentRow(result, TOP_SCORE_STUDENT_ID).completeness,
      expectedStudentMetric(input, 'completeness', TOP_SCORE_STUDENT_ID)
    );
    expectComputedMetric(
      studentRow(result, ZERO_SCORE_STUDENT_ID).completeness,
      expectedStudentMetric(input, 'completeness', ZERO_SCORE_STUDENT_ID)
    );

    expectErrorAndNotAttemptedSemantics(result, input);
    expectLegacyTaskRows(result, input);
    expectTopScorerCells(result, input);
  });

  it('keeps zero-weight legacy tasks excluded from averages like current ones', () => {
    const input = buildClassInput(true);
    const partial = input.assignmentDefinitionPartials.find(
      (entry) => entry.definitionKey === LEGACY_DEFINITION_KEY
    );
    if (!partial) throw new Error('Canonical definition partial is missing');
    const zeroWeightTask = partial.tasks[0];
    if (!zeroWeightTask) throw new Error('Canonical task is missing');
    zeroWeightTask.taskWeighting = 0;
    const [result] = analyse(input);
    if (!result) throw new Error('Expected a class result');
    const zeroTask = result.perTask.find(
      (entry) =>
        entry.definitionKey === LEGACY_DEFINITION_KEY && entry.taskId === zeroWeightTask.taskId
    );
    if (!zeroTask) throw new Error('Expected the zero-weight task row');
    expect(zeroTask.averageContribution).toEqual({
      effectiveWeight: 0,
      includedInAverage: false,
    });
    // The zero-weight task keeps its numeric score visible at task scope.
    expectComputedMetric(
      zeroTask.completeness,
      expectedTaskMetric(
        collectObservations(input, 'completeness', {
          assignmentId: LEGACY_ASSIGNMENT_ID,
          taskId: zeroWeightTask.taskId,
        })
      )
    );
    // Only positive-weight observations reach the class average.
    expectComputedMetric(result.perClass.completeness, expectedClassMetric(input, 'completeness'));
  });
});
