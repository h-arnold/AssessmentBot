import { describe, expect, it } from 'vitest';
import type { AveragingResult, AverageContribution } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { adaptMetricsToMergedHeatmap } from './heatmapAdapter.merged';
import {
  createComputedMetricResult,
  createDefinitionPartial,
  createTaskPartial,
} from '../../test/dataAnalysis/fixtures';

const DEFINITION = 'shared-definition';
const FIRST_ASSIGNMENT = 'assignment-first';
const SECOND_ASSIGNMENT = 'assignment-second';
const TASK = 'task-one';
const EXPECTED_ZERO_SCORE = 4;
const POSITIVE_ASSIGNMENT_WEIGHT = 0.5;
const POSITIVE_TASK_WEIGHT = 0.4;
const EXPECTED_POSITIVE_PRODUCT = 0.2;

/** Build the compact shared fixture used by merged contribution projections.
 * @returns {object} Fixture inputs for one class, two assignment instances, and one task.
 */
function fixtures() {
  const classFull: ClassFull = {
    classId: 'class-1',
    className: 'Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-10',
    classOwner: null,
    teachers: [],
    active: null,
    students: [{ id: 'student-1', name: 'Student', email: 'student@example.test' }],
    assignments: [FIRST_ASSIGNMENT, SECOND_ASSIGNMENT].map((assignmentId) => ({
      assignmentId,
      dueDate: null,
      updatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      documentType: 'assessment' as const,
      submissions: [],
      assignmentDefinitionKey: DEFINITION,
    })),
  };
  const partial = {
    ...createDefinitionPartial({
      definitionKey: DEFINITION,
      tasks: [createTaskPartial(TASK, 1, 'Task')],
    }),
    primaryTitle: 'Live title',
  };
  const partials: AssignmentDefinitionPartialsResponse = [partial];
  const metric = {
    classId: 'class-1',
    studentId: 'student-1',
    taskKey: `${DEFINITION}::${TASK}`,
    averageContribution: {
      effectiveWeight: 1,
      includedInAverage: true,
    } satisfies AverageContribution,
    completeness: createComputedMetricResult({ value: EXPECTED_ZERO_SCORE }),
    accuracy: createComputedMetricResult(),
    spag: createComputedMetricResult(),
    overall: createComputedMetricResult(),
  };
  const analyserResult = {
    classId: 'class-1',
    className: 'Class',
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: createComputedMetricResult(),
      accuracy: createComputedMetricResult(),
      spag: createComputedMetricResult(),
      overall: createComputedMetricResult(),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    perStudentTaskMetrics: [metric],
  } satisfies AveragingResult;
  return { classFull, partial, partials, analyserResult, metric };
}

describe('merged heatmap contribution projection', () => {
  it('resolves merged assignmentName from the partial primaryTitle and carries taskTitle', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [FIRST_ASSIGNMENT],
      partials
    );
    expect(result.taskColumns).toHaveLength(1);
    expect(result.taskColumns[0].assignmentName).toBe('Live title');
    expect(result.taskColumns[0].taskTitle).toBe('Task');
  });

  it('falls back to Class Overview when classFull.className is null', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const classWithNullName: ClassFull = { ...classFull, className: null };
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classWithNullName,
      [FIRST_ASSIGNMENT],
      partials
    );
    expect(result.className).toBe('Class Overview');
  });

  it('keeps one definition-scoped contribution from class order when selected order is reversed', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [SECOND_ASSIGNMENT, FIRST_ASSIGNMENT],
      partials
    );
    expect(result.taskColumns).toHaveLength(1);
    expect(result.taskColumns[0].assignmentId).toBe(FIRST_ASSIGNMENT);
    expect(result.taskColumns[0].averageContribution).toEqual({
      effectiveWeight: 1,
      includedInAverage: true,
    });
  });

  it.each([
    [
      'positive task product',
      POSITIVE_ASSIGNMENT_WEIGHT,
      POSITIVE_TASK_WEIGHT,
      EXPECTED_POSITIVE_PRODUCT,
      true,
    ],
    ['zero assignment weighting', 0, 1, 0, false],
    ['zero task weighting', 1, 0, 0, false],
  ])(
    'projects %s and leaves its numeric cell intact',
    (_label, assignmentWeighting, taskWeighting, effectiveWeight, includedInAverage) => {
      const { classFull, partial, partials, analyserResult } = fixtures();
      (partial as { assignmentWeighting: number }).assignmentWeighting =
        assignmentWeighting as number;
      (partial.tasks[0] as { taskWeighting: number }).taskWeighting = taskWeighting as number;
      const result = adaptMetricsToMergedHeatmap(
        analyserResult,
        classFull,
        [SECOND_ASSIGNMENT],
        partials
      );
      expect(result.taskColumns[0].averageContribution).toEqual({
        effectiveWeight,
        includedInAverage,
      });
      expect(result.rows[0].cells[0].completeness.value).toBe(EXPECTED_ZERO_SCORE);
    }
  );

  it('retains independent contribution metadata for distinct definition tier identities', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const secondPartial = {
      ...partials[0],
      definitionKey: 'another-definition',
      assignmentWeighting: 0,
    };
    (
      classFull.assignments as Array<{ assignmentId: string; assignmentDefinitionKey: string }>
    )[1].assignmentDefinitionKey = 'another-definition';
    partials.push(secondPartial);
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [FIRST_ASSIGNMENT, SECOND_ASSIGNMENT],
      partials
    );
    expect(result.taskColumns.map((column) => column.averageContribution)).toEqual([
      { effectiveWeight: 1, includedInAverage: true },
      { effectiveWeight: 0, includedInAverage: false },
    ]);
    expect(result.taskColumns.map((column) => column.definitionKey)).toEqual([
      DEFINITION,
      'another-definition',
    ]);
  });
});
