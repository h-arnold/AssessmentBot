import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AveragingResult, PerStudentTaskMetric } from './dataAnalysis.zod';
import { adaptMetricsToHeatmap } from './heatmapAdapter';
import { buildTaskKey } from './taskKey';
import {
  createAssignmentPartial,
  createComputedMetricResult,
  createTaskPartial,
} from '../../test/dataAnalysis/fixtures';
import {
  createHeatmapClassFull,
  createHeatmapDefinitionPartial,
} from '../../test/dataAnalysis/heatmapFixtures';

const CLASS_ID = 'class-abc-123';
const DEFINITION_KEY = 'def-gap';
const ASSIGNMENT_ID = 'assignment-gap';
const FIRST_TASK_ID = 'task-present';
const SECOND_TASK_ID = 'task-first-gap';
const THIRD_TASK_ID = 'task-second-gap';
const EXPECTED_WARNING_COUNT = 2;
const EXPECTED_SCORE = 4;

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Build the ClassFull fixture used by adapter diagnostics tests.
 *
 * @param {string[]} studentIds - Students present in the class roster.
 * @returns {ReturnType<typeof createHeatmapClassFull>} The class fixture.
 */
function buildClassFull(studentIds: string[] = ['student-1']) {
  return createHeatmapClassFull({
    classId: CLASS_ID,
    students: studentIds.map((id) => ({
      id,
      name: `Student ${id}`,
      email: `${id}@test.com`,
    })),
    assignments: [
      createAssignmentPartial({
        assignmentId: ASSIGNMENT_ID,
        definitionKey: DEFINITION_KEY,
        submissions: [],
      }),
    ],
  });
}

/**
 * Build a live definition partial containing the ordered fixture task IDs.
 *
 * @param {string[]} taskIds - The ordered task identifiers.
 * @returns {ReturnType<typeof createHeatmapDefinitionPartial>} The definition partial.
 */
function buildDefinitionPartial(taskIds: string[]) {
  return {
    ...createHeatmapDefinitionPartial({
      definitionKey: DEFINITION_KEY,
      primaryTitle: 'Gap diagnostics',
      taskId: taskIds[0] ?? FIRST_TASK_ID,
    }),
    tasks: taskIds.map((taskId) => createTaskPartial(taskId, 1, `${taskId} title`)),
  };
}

/**
 * Build one analyser metric for a task column.
 *
 * @param {string} taskId - The task identifier.
 * @param {string} studentId - The student identifier.
 * @returns {PerStudentTaskMetric} A computed task metric.
 */
function buildTaskMetric(taskId: string, studentId = 'student-1'): PerStudentTaskMetric {
  return {
    classId: CLASS_ID,
    studentId,
    taskKey: buildTaskKey(DEFINITION_KEY, taskId),
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    completeness: createComputedMetricResult({ value: EXPECTED_SCORE }),
    accuracy: createComputedMetricResult({ value: 3 }),
    spag: createComputedMetricResult({ value: 2 }),
    overall: createComputedMetricResult({ value: 3 }),
  };
}

/**
 * Build an analyser result, optionally omitting perStudentTaskMetrics entirely.
 *
 * @param {PerStudentTaskMetric[]} [perStudentTaskMetrics] - Metrics to include.
 * @returns {AveragingResult} The analyser-result fixture.
 */
function buildAnalyserResult(perStudentTaskMetrics?: PerStudentTaskMetric[]): AveragingResult {
  const base: AveragingResult = {
    classId: CLASS_ID,
    className: 'Test Class 7A',
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: createComputedMetricResult(),
      accuracy: createComputedMetricResult(),
      spag: createComputedMetricResult(),
      overall: createComputedMetricResult(),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  };
  return perStudentTaskMetrics === undefined ? base : { ...base, perStudentTaskMetrics };
}

describe('heatmap adapter diagnostics', () => {
  it('warns once per column with no metric for any student and keeps schema-valid notAttempted placeholders', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = adaptMetricsToHeatmap(
      buildAnalyserResult([buildTaskMetric(FIRST_TASK_ID)]),
      buildClassFull(),
      ASSIGNMENT_ID,
      [buildDefinitionPartial([FIRST_TASK_ID, SECOND_TASK_ID, THIRD_TASK_ID])]
    );

    expect(warnSpy).toHaveBeenCalledTimes(EXPECTED_WARNING_COUNT);
    const warningEntries = warnSpy.mock.calls.map(([context, rawEntry]) => ({
      context,
      entry: rawEntry as {
        errorMessage?: unknown;
        level?: unknown;
        metadata?: Record<string, unknown>;
      },
    }));
    expect(warningEntries.map(({ context }) => context)).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    for (const { context } of warningEntries) {
      expect(context).not.toBe('');
    }
    expect(warningEntries.map(({ entry }) => entry.metadata?.taskKey)).toEqual([
      buildTaskKey(DEFINITION_KEY, SECOND_TASK_ID),
      buildTaskKey(DEFINITION_KEY, THIRD_TASK_ID),
    ]);
    for (const { entry } of warningEntries) {
      expect(entry).toMatchObject({
        level: 'warn',
        metadata: { classId: CLASS_ID },
      });
      const message = String(entry.errorMessage);
      expect(message).toMatch(/metric/i);
      expect(message).toMatch(/student/i);
    }
    expect(result.rows[0].cells[1]).toEqual({
      completeness: {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      },
      accuracy: {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      },
      spag: {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      },
    });
  });

  it('does not warn for a genuine per-student gap when another student has the column metric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = adaptMetricsToHeatmap(
      buildAnalyserResult([buildTaskMetric(FIRST_TASK_ID, 'student-1')]),
      buildClassFull(['student-1', 'student-2']),
      ASSIGNMENT_ID,
      [buildDefinitionPartial([FIRST_TASK_ID])]
    );

    expect(warnSpy).not.toHaveBeenCalled();
    expect(result.rows[0].cells[0].completeness.value).toBe(EXPECTED_SCORE);
    expect(result.rows[1].cells[0].completeness).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalDataPoints: 1,
    });
  });

  it('warns once when perStudentTaskMetrics is absent instead of silently fabricating the grid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = adaptMetricsToHeatmap(buildAnalyserResult(), buildClassFull(), ASSIGNMENT_ID, [
      buildDefinitionPartial([FIRST_TASK_ID]),
    ]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [context, rawEntry] = warnSpy.mock.calls[0]!;
    const entry = rawEntry as {
      context?: unknown;
      errorMessage?: unknown;
      level?: unknown;
      metadata?: Record<string, unknown>;
    };
    expect(context).toEqual(expect.any(String));
    expect(context).not.toBe('');
    expect(entry).toMatchObject({
      level: 'warn',
      metadata: { classId: CLASS_ID },
    });
    expect(entry.errorMessage).toContain('perStudentTaskMetrics');
    expect(result.rows[0].cells[0].completeness.totalDataPoints).toBe(1);
  });
});
