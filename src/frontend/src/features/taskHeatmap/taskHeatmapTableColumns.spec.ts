/**
 * Tests for the adaptive assignment-tier grouping helper
 * (`buildAdaptiveTierGroups` in `taskHeatmapTableColumns`).
 *
 * GREEN: the helper is fully implemented. These tests pin the degenerate
 * contract the review (T-N1) flagged as untested: a `sourceAssignments` entry
 * whose `definitionKey` matches NO `taskColumn` yields an empty `columnIndices`
 * group (handled without throwing), while a matching definition key resolves to
 * the correct column indices.
 */

import { describe, expect, it } from 'vitest';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
} from '../../test/dataAnalysis/fixtures';
import {
  TaskDisplayMetricSchema,
  type TaskDisplayMetric,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import { buildAdaptiveTierGroups, buildTaskMetricSubColumns } from './taskHeatmapTableColumns';
import type { TaskHeatmapColumn, TaskHeatmapRow } from './taskHeatmapTableColumns';

/**
 * Build a `TaskHeatmapColumn` fixture.
 *
 * @param {string} definitionKey - The definition key.
 * @param {string} taskId - The task id.
 * @returns {TaskHeatmapColumn} A task-column fixture.
 */
function column(definitionKey: string, taskId: string): TaskHeatmapColumn {
  return {
    taskKey: `${definitionKey}::${taskId}`,
    taskId,
    taskTitle: `Task ${taskId}`,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    assignmentId: `a-${definitionKey}`,
    assignmentName: `Assignment ${definitionKey}`,
    definitionKey,
  };
}

describe('buildAdaptiveTierGroups — degenerate definitionKey (T-N1)', () => {
  it('yields an empty columnIndices group (no throw) when a definitionKey matches no taskColumn', () => {
    const sourceAssignments = [
      { assignmentId: 'a-defX', definitionKey: 'defX', assignmentName: 'Assignment X' },
    ];
    const taskColumns = [column('defY', 't1'), column('defY', 't2')];

    const groups = buildAdaptiveTierGroups(sourceAssignments, taskColumns);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('defX');
    expect(groups[0]?.columnIndices).toEqual([]);
  });

  it('resolves column indices for a definitionKey that matches taskColumns', () => {
    const sourceAssignments = [
      { assignmentId: 'a-defY', definitionKey: 'defY', assignmentName: 'Assignment Y' },
    ];
    const taskColumns = [column('defY', 't1'), column('defY', 't2')];

    const groups = buildAdaptiveTierGroups(sourceAssignments, taskColumns);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('defY');
    expect(groups[0]?.columnIndices).toEqual([0, 1]);
  });

  it('collapses shared-definition source assignments into one group spanning all matching columns', () => {
    const sourceAssignments = [
      { assignmentId: 'a1', definitionKey: 'defShared', assignmentName: 'Assignment One' },
      { assignmentId: 'a2', definitionKey: 'defShared', assignmentName: 'Assignment Two' },
    ];
    const taskColumns = [column('defShared', 't1'), column('defShared', 't2')];

    const groups = buildAdaptiveTierGroups(sourceAssignments, taskColumns);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('defShared');
    expect(groups[0]?.title).toBe('Assignment One (shared definition)');
    expect(groups[0]?.columnIndices).toEqual([0, 1]);
  });
});

describe('task metric display text', () => {
  const taskStateTextCases: ReadonlyArray<{ metric: TaskDisplayMetric; expected: string }> = [
    { metric: createComputedMetricResult({ value: 4 }), expected: '4' },
    { metric: createNotAttemptedMetricResult(), expected: 'N' },
    { metric: createErrorMetricResult(), expected: 'E' },
  ];

  it.each(taskStateTextCases)('formats a $expected task score', ({ metric, expected }) => {
    const taskColumn = column('definition', 'task');
    const taskRow: TaskHeatmapRow = {
      studentId: 'student-1',
      studentName: 'Student One',
      cells: [{ completeness: metric, accuracy: metric, spag: metric }],
    };
    const columns = buildTaskMetricSubColumns(taskColumn, 0, {}, null, false, false);
    const cellProperties = columns[0]!.onCell!(taskRow, 0);

    expect(taskColumn.taskTitle).toBe('Task task');
    expect(cellProperties).toMatchObject({
      'aria-label': `Student One, ${taskColumn.taskTitle}, Completeness: ${expected}`,
    });
  });

  it('keeps task display metrics within the narrow three-state contract', () => {
    expect(TaskDisplayMetricSchema.safeParse(createExcludedMetricResult()).success).toBe(false);
  });
});
