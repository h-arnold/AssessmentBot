import { describe, expect, it } from 'vitest';
import { adaptAssignmentSummary } from './assignmentSummaryAdapter';
import { AssignmentSummarySchema } from './assignmentSummary.zod';
import type { HeatmapTaskColumn } from './heatmapAdapter';

const LAST_TASK_INDEX = -1;
const ABOVE_THRESHOLD_ACCURACY = 4;
const BELOW_THRESHOLD_ACCURACY = 2.5;

const SUMMARY = AssignmentSummarySchema.parse({
  classId: 'c_001',
  assignmentId: 'a_001',
  totalStudents: 2,
  thresholds: { completeness: 4, accuracy: 3, incompleteProportion: 0.5 },
  tasks: [
    {
      taskKey: 'key',
      completedCount: 1,
      belowThresholdCount: 0,
      notAttemptedCount: 1,
      completenessErrorCount: 0,
      incompleteAcrossMostStudents: false,
      accuracyAverage: 3.125,
      accuracyAssessedCount: 1,
      accuracyNotAttemptedCount: 1,
      accuracyErrorCount: 0,
      belowAccuracyThreshold: false,
    },
  ],
  mostAccurateTaskKeys: ['key'],
  leastAccurateTaskKeys: ['key'],
});
const COLUMNS: HeatmapTaskColumn[] = [
  {
    taskKey: 'key',
    taskId: 't_001',
    taskTitle: 'Task title',
    averageContribution: { effectiveWeight: 0, includedInAverage: false },
  },
];

describe('assignment summary adaptor', () => {
  it('resolves titles, preserves evidence counts and formats averages to two decimal places', () => {
    const view = adaptAssignmentSummary(SUMMARY, COLUMNS);
    expect(view.completeness.rows[0]).toMatchObject({
      title: 'Task title',
      primaryValue: '1 of 2',
      valueLabel: 'at or above threshold',
      zeroWeight: true,
    });
    expect(view.accuracy.rows[0].primaryValue).toBe('3.13/5');
    expect(view.accuracy.rows[0].valueLabel).toBe('1 of 2 assessed');
    for (const card of [view.completeness, view.accuracy]) {
      expect(card.rows[0].details.map((detail) => detail.text)).toEqual([
        '1 not attempted / not applicable',
      ]);
    }
    expect(view.accuracy.highlights[0].value).toBe('Task title');
    expect(view.completeness.highlights[0].value).toBe('None');
    expect(view.completeness.canExpand).toBe(false);
    expect(view.completenessExplanation).toContain('at least 4 points on a scale from 0 to 5');
    expect(view.completenessExplanation).toContain(
      'does not necessarily mean the task is fully completed'
    );
    expect(view.accuracyExplanation).toContain('less than 3 points on a scale from 0 to 5');
    expect(view.accuracyExplanation).toContain('exactly 3 points meets the threshold');
  });

  it('uses task identifiers when a title is null and names flagged tasks', () => {
    const summary = structuredClone(SUMMARY);
    summary.tasks[0].incompleteAcrossMostStudents = true;
    summary.tasks[0].belowAccuracyThreshold = true;
    const view = adaptAssignmentSummary(summary, [{ ...COLUMNS[0], taskTitle: null }]);
    expect(view.completeness.highlights[0].value).toBe('t_001');
    expect(view.accuracy.highlights[2].value).toBe('t_001');
  });

  it('does not invent averages and exposes empty states', () => {
    const summary = structuredClone(SUMMARY);
    summary.tasks[0].accuracyAverage = null;
    summary.mostAccurateTaskKeys = [];
    summary.leastAccurateTaskKeys = [];
    const view = adaptAssignmentSummary(summary, COLUMNS);
    expect(view.accuracy.rows[0].primaryValue).toBe('No numeric assessments');
    expect(view.accuracy.highlights[0]).toMatchObject({ value: 'None', colour: undefined });
    expect(adaptAssignmentSummary({ ...summary, totalStudents: 0 }, COLUMNS).emptyMessage).toBe(
      'No students to summarise.'
    );
    expect(adaptAssignmentSummary({ ...summary, tasks: [] }, COLUMNS).emptyMessage).toBe(
      'No tasks to summarise.'
    );
  });

  it('fails when a required column or ranked task is unknown', () => {
    expect(() => adaptAssignmentSummary(SUMMARY, [])).toThrow('Missing summary column');
    expect(() =>
      adaptAssignmentSummary({ ...SUMMARY, mostAccurateTaskKeys: ['missing'] }, COLUMNS)
    ).toThrow('Missing summary task title');
  });

  it('keeps errors separate from N values and below-threshold results', () => {
    const summary = structuredClone(SUMMARY);
    summary.totalStudents = 3;
    summary.tasks[0].completenessErrorCount = 1;
    summary.tasks[0].accuracyErrorCount = 1;
    const view = adaptAssignmentSummary(summary, COLUMNS);
    expect(view.completeness.rows[0]).toMatchObject({
      belowThreshold: '0 below threshold',
      belowThresholdColour: undefined,
      requiresAttention: false,
    });
    for (const card of [view.completeness, view.accuracy]) {
      expect(card.rows[0].details).toMatchObject([
        { text: '1 not attempted / not applicable', attention: false },
        { text: '1 assessment error', attention: true },
      ]);
      expect(card.rows[0].details[0].explanation).toContain('not attempted or not applicable');
    }
  });

  it('bounds large task lists and tied highlights without losing evidence or changing the input', () => {
    const taskCount = 30;
    const summary = structuredClone(SUMMARY);
    summary.tasks = Array.from({ length: taskCount }, (_, index) => ({
      ...SUMMARY.tasks[0],
      taskKey: `key-${index}`,
      incompleteAcrossMostStudents: index > 0,
      belowAccuracyThreshold: index > 0,
      completedCount: index === 0 ? 1 : 0,
      belowThresholdCount: index === 0 ? 0 : 1,
      accuracyAverage: index === 0 ? ABOVE_THRESHOLD_ACCURACY : BELOW_THRESHOLD_ACCURACY,
    }));
    summary.mostAccurateTaskKeys = [summary.tasks[0].taskKey];
    summary.leastAccurateTaskKeys = summary.tasks.slice(1).map((task) => task.taskKey);
    const columns = summary.tasks.map((task, index) => ({
      ...COLUMNS[0],
      taskKey: task.taskKey,
      taskTitle: `Task ${index + 1}`,
    }));
    const original = structuredClone(summary);
    const view = adaptAssignmentSummary(summary, columns);
    for (const card of [view.completeness, view.accuracy]) {
      expect(card.previewRows.map((row) => row.title)).toEqual(['Task 2', 'Task 3', 'Task 4']);
      expect(card.rows).toHaveLength(taskCount);
      expect(card.rows.at(LAST_TASK_INDEX)?.title).toBe('Task 1');
      expect(card.canExpand).toBe(true);
      expect(card.showAllLabel).toBe('Show all 30 tasks');
      const boundedHighlight = card.highlights.find((highlight) =>
        highlight.value.includes('Task 30')
      )!;
      expect(boundedHighlight.previewValue).toContain('more)');
      expect(boundedHighlight.previewValue).not.toContain('Task 30');
      expect(boundedHighlight.value).toContain('Task 30');
    }
    expect(summary).toEqual(original);
  });
});
