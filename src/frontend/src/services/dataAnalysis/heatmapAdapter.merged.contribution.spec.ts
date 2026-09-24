import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AveragingResult, AverageContribution } from './dataAnalysis.zod';
import type { AssignmentDefinitionPartialsResponse } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { adaptMetricsToMergedHeatmap } from './heatmapAdapter.merged';
import { buildTaskKey } from './taskKey';
import {
  createAssignmentPartial,
  createComputedMetricResult,
  createNotAttemptedMetricResult,
} from '../../test/dataAnalysis/fixtures';
import {
  createHeatmapClassFull,
  createHeatmapDefinitionPartial,
} from '../../test/dataAnalysis/heatmapFixtures';

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
  const classFull = createHeatmapClassFull({
    classId: 'class-1',
    className: 'Class',
    yearGroupKey: 'year-10',
    active: null,
    students: [{ id: 'student-1', name: 'Student', email: 'student@example.test' }],
    assignments: [FIRST_ASSIGNMENT, SECOND_ASSIGNMENT].map((assignmentId) =>
      createAssignmentPartial({
        assignmentId,
        definitionKey: DEFINITION,
        submissions: [],
      })
    ),
  });
  const partial = createHeatmapDefinitionPartial({
    definitionKey: DEFINITION,
    primaryTitle: 'Live title',
    taskId: TASK,
    taskTitle: 'Task',
  });
  const partials: AssignmentDefinitionPartialsResponse = [partial];
  const metric = {
    classId: 'class-1',
    studentId: 'student-1',
    taskKey: buildTaskKey(DEFINITION, TASK),
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

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const classWithNullName = { ...classFull, className: null };
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classWithNullName,
      [FIRST_ASSIGNMENT],
      partials
    );
    expect(result.className).toBe('Class Overview');
  });

  it('warns for a merged column with no metric for any student and returns the notAttempted placeholder', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { classFull, partials, analyserResult } = fixtures();
    const taskKey = buildTaskKey(DEFINITION, TASK);
    const result = adaptMetricsToMergedHeatmap(
      { ...analyserResult, perStudentTaskMetrics: [] },
      classFull,
      [FIRST_ASSIGNMENT],
      partials
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'adaptMetricsToMergedHeatmap',
      expect.objectContaining({
        context: 'adaptMetricsToMergedHeatmap',
        errorMessage: `No analyser metric exists for any student for heatmap column '${taskKey}'`,
        level: 'warn',
        metadata: { classId: 'class-1', taskKey },
      })
    );
    expect(result.rows[0].cells[0]).toEqual({
      completeness: createNotAttemptedMetricResult(),
      accuracy: createNotAttemptedMetricResult(),
      spag: createNotAttemptedMetricResult(),
    });
  });

  it('collapses duplicate definition instances to the first classFull assignment identity', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [SECOND_ASSIGNMENT, FIRST_ASSIGNMENT],
      partials
    );

    expect(result.taskColumns).toEqual([
      {
        taskKey: buildTaskKey(DEFINITION, TASK),
        taskId: TASK,
        taskTitle: 'Task',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
        assignmentId: FIRST_ASSIGNMENT,
        definitionKey: DEFINITION,
        assignmentName: 'Live title',
      },
    ]);
    expect(result.sourceAssignments).toEqual([
      {
        assignmentId: SECOND_ASSIGNMENT,
        definitionKey: DEFINITION,
        assignmentName: 'Live title',
      },
      {
        assignmentId: FIRST_ASSIGNMENT,
        definitionKey: DEFINITION,
        assignmentName: 'Live title',
      },
    ]);
  });

  it('feeds accumulated analyser metrics into the single collapsed column for a shared taskKey', () => {
    const { classFull, partials, analyserResult, metric } = fixtures();
    const accumulatedMetric = {
      ...metric,
      completeness: createComputedMetricResult({
        value: EXPECTED_ZERO_SCORE,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
    };
    const result = adaptMetricsToMergedHeatmap(
      { ...analyserResult, perStudentTaskMetrics: [accumulatedMetric] },
      classFull,
      [FIRST_ASSIGNMENT, SECOND_ASSIGNMENT],
      partials
    );

    expect(result.taskColumns).toHaveLength(1);
    expect(result.rows[0].cells[0]).toEqual({
      completeness: accumulatedMetric.completeness,
      accuracy: accumulatedMetric.accuracy,
      spag: accumulatedMetric.spag,
    });
  });

  it('keeps shared-task cells identical whether one or both duplicate instances are selected', () => {
    const { classFull, partials, analyserResult } = fixtures();
    const single = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [FIRST_ASSIGNMENT],
      partials
    );
    const both = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [FIRST_ASSIGNMENT, SECOND_ASSIGNMENT],
      partials
    );

    expect(both.taskColumns).toEqual(single.taskColumns);
    expect(both.rows).toEqual(single.rows);
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
