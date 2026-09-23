import { describe, expect, it } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import { accumToMetric, createAccumulator } from './averagingAnalyser.accumulation';
import { accumulateMetricsToTarget } from './averagingAnalyser.criterionAccumulation';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

/**
 * Analyse a minimal single-task fixture with the requested live weights.
 *
 * @param {Object} options - Task-analysis fixture options.
 * @param {number} [options.assignmentWeighting=1] - Live assignment weighting.
 * @param {number} [options.taskWeighting=1] - Live task weighting.
 * @param {Array<number | 'N'>} options.scores - Assessment scores to analyse.
 * @returns {ReturnType<AveragingAnalyser['analyse']>[number]} The analysed class result.
 */
function analyseSingleTask(options: {
  assignmentWeighting?: number;
  taskWeighting?: number;
  scores: Array<number | 'N'>;
}) {
  const { assignmentWeighting = 1, taskWeighting = 1, scores } = options;
  const submissions = scores.map((score, index) =>
    createSubmission(`s_${index}`, `Student ${index}`, 'a_001', {
      t_001: createSubmissionItem('t_001', {
        completeness: { score },
        accuracy: { score },
        spag: { score },
      }),
    })
  );
  return new AveragingAnalyser().analyse(
    buildInput(
      [
        {
          classId: 'c_001',
          studentIds: scores.map((_, index) => `s_${index}`),
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_zero_weight',
              assignmentWeighting,
              tasks: [createTaskPartial('t_001', taskWeighting)],
              submissions,
            }),
          ],
        },
      ],
      {
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_zero_weight',
            assignmentWeighting,
            tasks: [createTaskPartial('t_001', taskWeighting)],
          }),
        ],
      }
    )
  )[0];
}

describe('accumToMetric', () => {
  it('returns computed for an applicable numeric accumulation', () => {
    const accumulator = createAccumulator();
    accumulator.weightedSum = 5;
    accumulator.totalWeight = 1;
    accumulator.applicableDataPoints = 1;
    accumulator.totalDataPoints = 1;

    expectMetricResultStateAware(accumToMetric(accumulator), {
      state: 'computed',
      value: 5,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });
  });

  it('returns notAttempted when nCount is positive without numeric data', () => {
    const accumulator = createAccumulator();
    accumulator.nCount = 1;
    accumulator.totalWeight = 1;
    accumulator.totalDataPoints = 1;

    expectMetricResultStateAware(accumToMetric(accumulator), {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
  });

  it('returns error when there is no numeric or not-attempted evidence', () => {
    expectMetricResultStateAware(accumToMetric(createAccumulator()), {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
  });

  it('prefers computed when numeric and not-attempted evidence are mixed', () => {
    const accumulator = createAccumulator();
    accumulator.weightedSum = 3;
    accumulator.totalWeight = 1;
    accumulator.applicableDataPoints = 1;
    accumulator.totalDataPoints = 2;
    accumulator.nCount = 1;

    expectMetricResultStateAware(accumToMetric(accumulator), {
      state: 'computed',
      value: 3,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 2,
    });
  });
});

describe('accumulateMetricsToTarget nCount tracking', () => {
  it('tracks nCount for a raw N in each criterion and overall metric', () => {
    const target = {
      completeness: createAccumulator(),
      accuracy: createAccumulator(),
      spag: createAccumulator(),
      overall: createAccumulator(),
    };
    accumulateMetricsToTarget(target, 'N', 'N', 'N', null, 1);

    expectMetricResultStateAware(accumToMetric(target.completeness), {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(accumToMetric(target.accuracy), {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(accumToMetric(target.spag), {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(accumToMetric(target.overall), {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });
  });

  it('retains numeric evidence while tracking N in the other criteria', () => {
    const target = {
      completeness: createAccumulator(),
      accuracy: createAccumulator(),
      spag: createAccumulator(),
      overall: createAccumulator(),
    };
    accumulateMetricsToTarget(target, 4, 'N', 'N', null, 1);

    expectMetricResultStateAware(accumToMetric(target.completeness), {
      state: 'computed',
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(accumToMetric(target.accuracy), {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(accumToMetric(target.overall), {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });
  });
});

describe('AveragingAnalyser zero-weight display and contribution boundaries', () => {
  it('retains numeric task display while excluding a zero-weight assignment from aggregates', () => {
    const result = analyseSingleTask({ assignmentWeighting: 0, scores: [5] });

    expect(result.perStudentTaskMetrics![0].completeness).toMatchObject({
      state: 'computed',
      value: 5,
      totalWeight: 0,
    });
    expect(result.perStudentTaskMetrics![0].averageContribution).toEqual({
      effectiveWeight: 0,
      includedInAverage: false,
    });
    expect(result.perClass.completeness).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      totalDataPoints: 1,
    });
  });

  it('retains numeric task display while excluding a zero-weight task from aggregates', () => {
    const result = analyseSingleTask({ taskWeighting: 0, scores: [4] });

    expect(result.perTask[0].accuracy).toMatchObject({ state: 'computed', value: 4 });
    expect(result.perClass.accuracy).toMatchObject({ state: 'excluded', value: null });
  });

  it('keeps a raw N as notAttempted at zero weight without creating an aggregate penalty', () => {
    const result = analyseSingleTask({ taskWeighting: 0, scores: ['N'] });

    expect(result.perStudentTaskMetrics![0].completeness).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
    });
    expect(result.perClass.completeness).toMatchObject({ state: 'excluded', value: null });
  });

  it('preserves the positive-weight raw N control case', () => {
    const result = analyseSingleTask({ scores: ['N'] });

    expect(result.perStudentTaskMetrics![0].completeness).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 1,
    });
    expect(result.perClass.completeness).toMatchObject({ state: 'notAttempted', value: 'N' });
  });

  it('excludes zero-weight numeric observations from the mixed numerator and denominator', () => {
    const input = buildInput(
      [
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_mixed',
              tasks: [createTaskPartial('positive'), createTaskPartial('zero', 0)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  positive: createSubmissionItem('positive', { completeness: { score: 2 } }),
                  zero: createSubmissionItem('zero', { completeness: { score: 10 } }),
                }),
              ],
            }),
          ],
        },
      ],
      {
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_mixed',
            tasks: [createTaskPartial('positive'), createTaskPartial('zero', 0)],
          }),
        ],
      }
    );
    const result = new AveragingAnalyser().analyse(input)[0];

    expect(result.perClass.completeness).toMatchObject({
      state: 'computed',
      value: 2,
      totalWeight: 1,
      totalDataPoints: 2,
    });
    // The zero-weight score must remain visible at display scope.
    expect(result.perTask.find((task) => task.taskId === 'zero')?.completeness).toMatchObject({
      state: 'computed',
      value: 10,
    });
  });

  it('uses an unweighted mean for multiple zero-weight numeric display observations', () => {
    const result = analyseSingleTask({ taskWeighting: 0, scores: [2, 8] });

    expect(result.perStudentTaskMetrics).toHaveLength(2);
    expect(result.perTask[0].completeness).toMatchObject({ state: 'computed', value: 5 });
    expect(result.perClass.completeness).toMatchObject({ state: 'excluded', totalDataPoints: 2 });
  });
});
