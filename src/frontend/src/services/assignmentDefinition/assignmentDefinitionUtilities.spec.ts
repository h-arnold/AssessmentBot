import { describe, expect, it } from 'vitest';
import { computeEffectiveWeight, type TaskWeightingIndex } from './assignmentDefinitionUtilities';

const LARGE_FINITE_WEIGHTING = Number.MAX_VALUE;

describe('computeEffectiveWeight', () => {
  it.each([
    {
      caseName: 'positive assignment and task weights',
      assignmentWeighting: 2,
      taskWeighting: 3,
      expected: 6,
    },
    {
      caseName: 'a zero assignment weight',
      assignmentWeighting: 0,
      taskWeighting: 3,
      expected: 0,
    },
    {
      caseName: 'a zero task weight',
      assignmentWeighting: 2,
      taskWeighting: 0,
      expected: 0,
    },
    {
      caseName: 'a null assignment weight using its full-weight meaning',
      assignmentWeighting: null,
      taskWeighting: 3,
      expected: 3,
    },
  ])('preserves $caseName', ({ assignmentWeighting, taskWeighting, expected }) => {
    const weightingIndex: TaskWeightingIndex = {
      assignmentWeighting,
      taskWeightingById: new Map([['task-001', taskWeighting]]),
    };

    expect(computeEffectiveWeight(weightingIndex, 'task-001')).toBe(expected);
  });

  it.each([
    {
      caseName: 'a negative assignment weight',
      assignmentWeighting: -2,
      taskWeighting: 3,
    },
    {
      caseName: 'a negative task weight',
      assignmentWeighting: 2,
      taskWeighting: -3,
    },
  ])(
    'rejects a negative effective product from $caseName',
    ({ assignmentWeighting, taskWeighting }) => {
      const weightingIndex: TaskWeightingIndex = {
        assignmentWeighting,
        taskWeightingById: new Map([['task-001', taskWeighting]]),
      };

      expect(() => computeEffectiveWeight(weightingIndex, 'task-001')).toThrow();
    }
  );

  it('rejects an overflowed product from two finite weighting factors', () => {
    const weightingIndex: TaskWeightingIndex = {
      assignmentWeighting: LARGE_FINITE_WEIGHTING,
      taskWeightingById: new Map([['task-001', LARGE_FINITE_WEIGHTING]]),
    };

    expect(() => computeEffectiveWeight(weightingIndex, 'task-001')).toThrow();
  });
});
