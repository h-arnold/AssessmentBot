/**
 * Tests for the live task/assignment weighting projection of
 * `adaptMetricsToHeatmap`.
 *
 * @remarks
 * The heat-map task-column weighting boundary cases (rejection of negative and
 * overflowed effective weights) share this file with the live partial
 * projection cases extracted verbatim from the original single
 * `heatmapAdapter.spec.ts`; every original assertion is preserved. The warm-up
 * partial sourcing cases live in the sibling `heatmapAdapter.spec.ts`, and both
 * suites share the fixture builders in `heatmapAdapterTestSetup`.
 */

import { describe, expect, it } from 'vitest';
import { adaptMetricsToHeatmap, buildTaskColumns } from './heatmapAdapter';
import { createDefinitionPartial, createTaskPartial } from '@/test/dataAnalysis/fixtures';
import {
  ASSIGNMENT_ID,
  buildClassFull,
  buildPartials,
  buildPerStudentTaskMetric,
  minimalAveragingResult,
} from '@/test/dataAnalysis/heatmapAdapterTestSetup';

/** Sample computed cell score asserted to survive zero-weight projection unchanged. */
const EXPECTED_ZERO_WEIGHT_SCORE = 4;
const NEGATIVE_TASK_WEIGHTING = -1;
const LARGE_FINITE_WEIGHTING = Number.MAX_VALUE;

describe('heatmap task-column weighting boundaries', () => {
  it('rejects a negative effective weight before projecting task-column metadata', () => {
    const partial = createDefinitionPartial({
      tasks: [createTaskPartial('task-001', NEGATIVE_TASK_WEIGHTING)],
    });

    expect(() => buildTaskColumns(partial)).toThrow();
  });

  it('rejects an overflowed effective product from finite live weightings', () => {
    const partial = createDefinitionPartial({
      assignmentWeighting: LARGE_FINITE_WEIGHTING,
      tasks: [createTaskPartial('task-001', LARGE_FINITE_WEIGHTING)],
    });

    expect(() => buildTaskColumns(partial)).toThrow();
  });
});

describe('adaptMetricsToHeatmap — live task and assignment weighting projection', () => {
  it('projects live task weights and defaults a null assignment weighting to full weight', () => {
    const classFull = buildClassFull();
    const analyserResult = minimalAveragingResult([buildPerStudentTaskMetric('s_001', 'task_001')]);
    const partials = buildPartials();
    const livePartial = partials[0];
    livePartial.assignmentWeighting = null;
    livePartial.tasks[0].taskWeighting = 0.4;
    livePartial.tasks[1].taskWeighting = 0;

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.taskColumns.map((column) => column.averageContribution)).toEqual([
      { effectiveWeight: 0.4, includedInAverage: true },
      { effectiveWeight: 0, includedInAverage: false },
      { effectiveWeight: 1, includedInAverage: true },
    ]);
    expect(result.rows[0].cells[0].completeness).toEqual(
      analyserResult.perStudentTaskMetrics![0].completeness
    );
  });

  it('fails fast instead of defaulting when a live task omits required taskWeighting', () => {
    const partials = buildPartials();
    const invalidTask = partials[0].tasks[0] as {
      taskId: string;
      taskWeighting?: number;
      taskTitle: string | null;
    };
    delete invalidTask.taskWeighting;

    expect(() =>
      adaptMetricsToHeatmap(minimalAveragingResult([]), buildClassFull(), ASSIGNMENT_ID, partials)
    ).toThrow("buildTaskColumns: task 'task_001' is missing from partial 'dk_quadratics'");
  });

  it('uses the live partial assignment weighting of zero without inferring metadata from scores', () => {
    const partials = buildPartials();
    partials[0].assignmentWeighting = 0;
    const result = adaptMetricsToHeatmap(
      minimalAveragingResult([buildPerStudentTaskMetric('s_001', 'task_001')]),
      buildClassFull(),
      ASSIGNMENT_ID,
      partials
    );

    expect(result.taskColumns[0].averageContribution).toEqual({
      effectiveWeight: 0,
      includedInAverage: false,
    });
    expect(result.rows[0].cells[0].completeness.value).toBe(EXPECTED_ZERO_WEIGHT_SCORE);
  });
});
