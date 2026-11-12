/**
 * Tests for `adaptMetricsToHeatmap` and its live-partial task projection.
 *
 * @remarks
 * The adapter takes `assignmentDefinitionPartials` as its fourth argument and
 * sources task columns from the matching warm-up definition. It throws
 * `TaskTitlesUnavailableError` when that definition is absent and fails fast
 * when a task lacks its required weighting.
 *
 * The live task/assignment weighting projection cases live in the sibling
 * `heatmapAdapter.weighting.spec.ts`, sharing this file's former fixture
 * builders through `heatmapAdapterTestSetup`.
 *
 * The attempt-baseline cases pin the required second `buildTaskColumns`
 * parameter (baseline-membership set, or `null` for absolute mode) and the
 * adapter's fail-fast narrowing of the mode-bearing analyser result.
 */

import { describe, expect, it } from 'vitest';
import type { AveragingResult } from './dataAnalysis.zod';
import type { AssignmentDefinitionPartialsResponse } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import {
  adaptMetricsToHeatmap,
  buildTaskColumns,
  TaskTitlesUnavailableError,
} from './heatmapAdapter';
import {
  ASSIGNMENT_ID,
  CLASS_NAME,
  buildClassFull,
  buildNonMatchingPartials,
  buildPartials,
  buildPerStudentTaskMetric,
  minimalAveragingResult,
  taskKey,
} from '@/test/dataAnalysis/heatmapAdapterTestSetup';

const expectedStudentCount = 2;
const expectedTaskColumnCount = 3;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adaptMetricsToHeatmap — 4-parameter warm-up partial sourcing', () => {
  // ── Ported tests ────────────────────────────────────────────────────

  it('returns three taskColumns in task order and one row per student, each with three cells aligned by taskKey', () => {
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const aliceT2 = buildPerStudentTaskMetric('s_001', 'task_002');
    const aliceT3 = buildPerStudentTaskMetric('s_001', 'task_003');
    const bobT1 = buildPerStudentTaskMetric('s_002', 'task_001');
    const bobT2 = buildPerStudentTaskMetric('s_002', 'task_002');
    const bobT3 = buildPerStudentTaskMetric('s_002', 'task_003');

    const analyserResult = minimalAveragingResult([aliceT1, aliceT2, aliceT3, bobT1, bobT2, bobT3]);

    const classFull = buildClassFull();
    const partials = buildPartials();
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    // taskColumns in task order
    expect(result.taskColumns).toHaveLength(expectedTaskColumnCount);
    expect(result.taskColumns[0]).toEqual({
      taskKey: taskKey('task_001'),
      taskId: 'task_001',
      taskTitle: 'task_001',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: true,
    });
    expect(result.taskColumns[1]).toEqual({
      taskKey: taskKey('task_002'),
      taskId: 'task_002',
      taskTitle: 'task_002',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: true,
    });
    expect(result.taskColumns[2]).toEqual({
      taskKey: taskKey('task_003'),
      taskId: 'task_003',
      taskTitle: 'task_003',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: true,
    });

    // Rows — one per student in roster order
    expect(result.rows).toHaveLength(expectedStudentCount);

    // Alice
    const aliceRow = result.rows[0];
    expect(aliceRow.studentId).toBe('s_001');
    expect(aliceRow.studentName).toBe('Alice');
    expect(aliceRow.cells).toHaveLength(expectedTaskColumnCount);
    expect(aliceRow.cells[0].completeness).toEqual(aliceT1.completeness);
    expect(aliceRow.cells[0].accuracy).toEqual(aliceT1.accuracy);
    expect(aliceRow.cells[0].spag).toEqual(aliceT1.spag);
    expect(aliceRow.cells[1].completeness).toEqual(aliceT2.completeness);
    expect(aliceRow.cells[1].accuracy).toEqual(aliceT2.accuracy);
    expect(aliceRow.cells[1].spag).toEqual(aliceT2.spag);
    expect(aliceRow.cells[2].completeness).toEqual(aliceT3.completeness);
    expect(aliceRow.cells[2].accuracy).toEqual(aliceT3.accuracy);
    expect(aliceRow.cells[2].spag).toEqual(aliceT3.spag);

    // Bob
    const bobRow = result.rows[1];
    expect(bobRow.studentId).toBe('s_002');
    expect(bobRow.studentName).toBe('Bob');
    expect(bobRow.cells).toHaveLength(expectedTaskColumnCount);
    expect(bobRow.cells[0].completeness).toEqual(bobT1.completeness);
    expect(bobRow.cells[0].accuracy).toEqual(bobT1.accuracy);
    expect(bobRow.cells[0].spag).toEqual(bobT1.spag);
    expect(bobRow.cells[1].completeness).toEqual(bobT2.completeness);
    expect(bobRow.cells[1].accuracy).toEqual(bobT2.accuracy);
    expect(bobRow.cells[1].spag).toEqual(bobT2.spag);
    expect(bobRow.cells[2].completeness).toEqual(bobT3.completeness);
    expect(bobRow.cells[2].accuracy).toEqual(bobT3.accuracy);
    expect(bobRow.cells[2].spag).toEqual(bobT3.spag);
  });

  it('yields notAttempted cells for a student absent from perStudentTaskMetrics', () => {
    // Only Alice (s_001) has per-student-task metrics; Bob (s_002) is missing
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const aliceT2 = buildPerStudentTaskMetric('s_001', 'task_002');
    const aliceT3 = buildPerStudentTaskMetric('s_001', 'task_003');

    const analyserResult = minimalAveragingResult([aliceT1, aliceT2, aliceT3]);
    const classFull = buildClassFull();
    const partials = buildPartials();
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.rows).toHaveLength(expectedStudentCount);

    // Alice has computed metrics
    const aliceRow = result.rows[0];
    expect(aliceRow.studentId).toBe('s_001');

    // Bob has notAttempted cells for every metric
    const bobRow = result.rows[1];
    expect(bobRow.studentId).toBe('s_002');
    expect(bobRow.cells).toHaveLength(expectedTaskColumnCount);
    for (const cell of bobRow.cells) {
      expect(cell.completeness.state).toBe('notAttempted');
      expect(cell.completeness.value).toBe('N');
      expect(cell.accuracy.state).toBe('notAttempted');
      expect(cell.accuracy.value).toBe('N');
      expect(cell.spag.state).toBe('notAttempted');
      expect(cell.spag.value).toBe('N');
    }
  });

  it('yields empty taskColumns and empty cells when the assignment has zero tasks', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();
    // Override the located partial's tasks to be empty
    (partials[0] as { tasks: unknown[] }).tasks = [];

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.taskColumns).toHaveLength(0);
    expect(result.rows).toHaveLength(expectedStudentCount);
    for (const row of result.rows) {
      expect(row.cells).toHaveLength(0);
    }
  });

  it('throws when assignmentId is not found in classFull.assignments', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();
    const unknownId = 'nonexistent_assignment';

    expect(() => adaptMetricsToHeatmap(analyserResult, classFull, unknownId, partials)).toThrow();
  });

  it('derives assignmentName from primaryTitle, className from classFull.className', () => {
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const bobT1 = buildPerStudentTaskMetric('s_002', 'task_001');

    const analyserResult = minimalAveragingResult([aliceT1, bobT1]);
    const classFull = buildClassFull();
    const partials = buildPartials();
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
    expect(result.assignmentName).toBe('Quadratics Assessment');
    expect(result.className).toBe(CLASS_NAME);
  });

  it('fallbacks className to "Class Overview" when classFull.className is null', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    classFull.className = null;
    const partials = buildPartials();

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.className).toBe('Class Overview');
  });

  // ── New error-path tests ────────────────────────────────────────────

  it('throws TaskTitlesUnavailableError when partials has no entry for the assignment definitionKey', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildNonMatchingPartials();

    expect(() => adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials)).toThrow(
      TaskTitlesUnavailableError
    );
  });

  it('does NOT throw for null taskTitle in partial (schema-enforced non-null — dead branch removed in E3–F3)', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    // First task has null title, second has a valid title
    const partials = buildPartials([
      { taskTitle: null },
      { taskTitle: 'A valid task title' },
      { taskTitle: null },
    ]);

    // The null-title check was removed because AssignmentDefinitionPartialSchema
    // enforces non-nullable taskTitle — null titles are unreachable at runtime.
    // The function should succeed, carrying null in the column descriptors.
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    expect(result.taskColumns).toHaveLength(partials[0].tasks.length);
    // Columns carry whatever taskTitle the partial provides (schema guarantees non-null)
    expect(result.taskColumns[0].taskTitle).toBeNull();
    expect(result.taskColumns[1].taskTitle).toBe('A valid task title');
    expect(result.taskColumns[2].taskTitle).toBeNull();
  });

  it('does NOT throw when all tasks have non-null taskTitle, even if classFull embedded tasks are the weight-summary shape', () => {
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const analyserResult = minimalAveragingResult([aliceT1]);
    const classFull = buildClassFull();

    // The partial has non-null titles
    const partials = buildPartials([
      { taskTitle: 'Task One Title' },
      { taskTitle: 'Task Two Title' },
      { taskTitle: 'Task Three Title' },
    ]);

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, partials);

    // taskColumns carry the partial's titles
    expect(result.taskColumns).toHaveLength(expectedTaskColumnCount);
    expect(result.taskColumns[0].taskTitle).toBe('Task One Title');
    expect(result.taskColumns[1].taskTitle).toBe('Task Two Title');
    expect(result.taskColumns[2].taskTitle).toBe('Task Three Title');
  });

  it('throws TaskTitlesUnavailableError when assignmentDefinitionPartials is an empty array', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const emptyPartials = [] as unknown as AssignmentDefinitionPartialsResponse;

    expect(() =>
      adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID, emptyPartials)
    ).toThrow(TaskTitlesUnavailableError);
  });
});

describe('buildTaskColumns — attempt-baseline projection', () => {
  it('sets includedInAttemptBaseline from baseline-set membership for each task column', () => {
    const partial = buildPartials()[0];
    const baselineSet = new Set([taskKey('task_001'), taskKey('task_003')]);

    const columns = buildTaskColumns(partial, baselineSet);

    expect(columns.map((column) => column.includedInAttemptBaseline)).toEqual([true, false, true]);
  });

  it('marks every column included when the baseline set is null (absolute mode)', () => {
    const partial = buildPartials()[0];

    const columns = buildTaskColumns(partial, null);

    expect(columns.map((column) => column.includedInAttemptBaseline)).toEqual([true, true, true]);
  });
});

describe('adaptMetricsToHeatmap — attempt-baseline supplier narrowing', () => {
  it('derives the baseline set from the attemptBaseline block in baseline mode', () => {
    const analyserResult = minimalAveragingResult([]);
    analyserResult.appliedAnalysisMode = 'topDecileBaseline';
    analyserResult.attemptBaseline = {
      poolStudentIds: ['s_001', 's_002'],
      baselineTaskKeys: [taskKey('task_001'), taskKey('task_003')],
    };

    const result = adaptMetricsToHeatmap(
      analyserResult,
      buildClassFull(),
      ASSIGNMENT_ID,
      buildPartials()
    );

    expect(result.taskColumns.map((column) => column.includedInAttemptBaseline)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('marks every column included for an absolute-mode result (null baseline set)', () => {
    const result = adaptMetricsToHeatmap(
      minimalAveragingResult([]),
      buildClassFull(),
      ASSIGNMENT_ID,
      buildPartials()
    );

    expect(result.taskColumns.map((column) => column.includedInAttemptBaseline)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('fails fast when the analyser result is missing the appliedAnalysisMode echo', () => {
    const analyserResult = minimalAveragingResult([]);
    delete (analyserResult as Partial<AveragingResult>).appliedAnalysisMode;

    expect(() =>
      adaptMetricsToHeatmap(analyserResult, buildClassFull(), ASSIGNMENT_ID, buildPartials())
    ).toThrow(/appliedAnalysisMode/);
  });

  it('fails fast when a baseline-mode result omits the attemptBaseline block', () => {
    const analyserResult = minimalAveragingResult([]);
    analyserResult.appliedAnalysisMode = 'topDecileBaseline';

    expect(() =>
      adaptMetricsToHeatmap(analyserResult, buildClassFull(), ASSIGNMENT_ID, buildPartials())
    ).toThrow(/attemptBaseline/);
  });
});
