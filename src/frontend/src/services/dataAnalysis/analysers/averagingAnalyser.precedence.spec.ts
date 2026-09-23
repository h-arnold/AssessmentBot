import { describe, expect, it } from 'vitest';
import { rollupMetric } from './rollupMetric';
import { resolveAssignmentDefinitionData } from './resolveAssignmentDefinition';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createNotAttemptedMetricResult,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
  createComputedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
describe('contribution-aware parent precedence', () => {
  it('keeps positive-weight raw N ahead of an excluded zero-weight observation', () => {
    const result = rollupMetric(
      [
        createNotAttemptedMetricResult({ totalWeight: 1 }),
        createNotAttemptedMetricResult({ totalWeight: 0 }),
      ],
      'completeness'
    );

    expect(result).toMatchObject({ state: 'notAttempted', value: 'N', totalWeight: 1 });
  });

  it('resolves a lone zero-weight raw N as excluded rather than notAttempted', () => {
    const result = rollupMetric(
      [createNotAttemptedMetricResult({ totalWeight: 0 })],
      'completeness'
    );

    expect(result).toMatchObject({ state: 'excluded', value: null, totalWeight: 0 });
  });

  it('keeps positive-weight raw N ahead of a zero-weight computed observation', () => {
    const result = rollupMetric(
      [
        createNotAttemptedMetricResult({ totalWeight: 1 }),
        createComputedMetricResult({ totalWeight: 0 }),
      ],
      'completeness'
    );

    expect(result).toMatchObject({ state: 'notAttempted', value: 'N', totalWeight: 1 });
  });

  it('reports zero and positive task contributions on both task-level outputs', () => {
    const input = buildInput(
      [
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_contributions',
              tasks: [createTaskPartial('zero', 0), createTaskPartial('positive', 1)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  zero: createSubmissionItem('zero', { completeness: { score: 2 } }),
                  positive: createSubmissionItem('positive', { completeness: { score: 8 } }),
                }),
              ],
            }),
          ],
        },
      ],
      {
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_contributions',
            tasks: [createTaskPartial('zero', 0), createTaskPartial('positive', 1)],
          }),
        ],
      }
    );

    const result = new AveragingAnalyser().analyse(input)[0];
    const expected = new Map([
      ['dk_contributions::positive', { effectiveWeight: 1, includedInAverage: true }],
      ['dk_contributions::zero', { effectiveWeight: 0, includedInAverage: false }],
    ]);

    expect(
      result.perTask.map((task) => [
        `${task.definitionKey}::${task.taskId}`,
        task.averageContribution,
      ])
    ).toEqual([...expected]);
    expect(
      result.perStudentTaskMetrics?.map((task) => [task.taskKey, task.averageContribution])
    ).toEqual([...expected]);
  });
});

describe('live assignment-definition weight resolution boundaries', () => {
  it('defaults a null live assignment weighting and missing task weighting', () => {
    const definition = createDefinitionPartial({
      definitionKey: 'dk_live',
      assignmentWeighting: null,
      tasks: [],
    });

    expect(resolveAssignmentDefinitionData('dk_live', new Map([['dk_live', definition]]))).toEqual({
      assignmentWeighting: 1,
      tasks: [],
    });
  });

  it('returns null when the live definition is missing', () => {
    expect(resolveAssignmentDefinitionData('missing', new Map())).toBeNull();
  });
});
