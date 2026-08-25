/**
 * Tests for `adaptMetricsToHeatmap` — the 4-parameter rewrite.
 *
 * @remarks
 * The adapter now takes a 4th parameter (`assignmentDefinitionPartials`) and
 * sources task columns from the warm-up partial located via
 * `getAssignmentDefinitionPartial`. It throws `TaskTitlesUnavailableError`
 * when the partial is missing or a task has null `taskTitle`.
 *
 * These tests are expected to FAIL because:
 *   - `TaskTitlesUnavailableError` does not exist yet
 *   - `getAssignmentDefinitionPartial` does not exist yet
 *   - `adaptMetricsToHeatmap` still has the old 3-arg signature
 *   - `taskPartial.zod.ts` still uses `id` not `taskId`
 */

import { describe, expect, it } from 'vitest';
import type { AveragingResult } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { adaptMetricsToHeatmap, TaskTitlesUnavailableError } from './heatmapAdapter';
import { createComputedMetricResult, createTaskPartial } from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const CLASS_ID = 'class_001';
const CLASS_NAME = 'Year 10 Mathematics';
const ASSIGNMENT_ID = 'assignment_001';
const DEFINITION_KEY = 'dk_quadratics';

const STUDENT_IDS = ['s_001', 's_002'];
const STUDENT_NAMES = ['Alice', 'Bob'];
const TASK_IDS = ['task_001', 'task_002', 'task_003'];

const expectedStudentCount = STUDENT_IDS.length;
const expectedTaskColumnCount = TASK_IDS.length;

/**
 * Build a taskKey in the canonical `${definitionKey}::${taskId}` format.
 *
 * @param {string} taskId - The stable task identifier.
 * @returns {string} The canonical task-key string.
 */
function taskKey(taskId: string): string {
  return `${DEFINITION_KEY}::${taskId}`;
}

/**
 * Build a student-summaries array from the shared STUDENT_IDS and STUDENT_NAMES constants.
 *
 * @returns {Array<{id: string, name: string, email: string}>} An array of student-summary objects.
 */
function buildStudentSummaries() {
  return STUDENT_IDS.map((id, index) => ({
    id,
    name: STUDENT_NAMES[index],
    email: `${id}@school.edu`,
  }));
}

/**
 * Build a task-partials array from the shared TASK_IDS constant.
 *
 * @returns {Array<{taskId: string, taskWeighting: number, taskTitle: string | null}>} An array of task-partial objects.
 */
function buildTasks() {
  return TASK_IDS.map((id) => createTaskPartial(id, 1));
}

/**
 * Build a minimal AssignmentDefinitionPartial fixture for the test assignment.
 *
 * @returns {Object} An assignment-definition-partial-shaped object with a
 *   `primaryTitle` of "Quadratics Assessment" and tasks from {@link buildTasks}.
 */
function buildDefinition() {
  return {
    primaryTitle: 'Quadratics Assessment',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [] as string[],
    alternateTopics: [] as string[],
    documentType: 'assignment',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    definitionKey: DEFINITION_KEY,
    tasks: buildTasks(),
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: null,
  };
}

/**
 * Build a minimal AssignmentPartial fixture wrapping the test definition.
 *
 * @returns {Object} An assignment-partial-shaped object containing the
 *   assignment ID, document type, and the nested definition from
 *   {@link buildDefinition}.
 */
function buildAssignmentPartial() {
  return {
    assignmentId: ASSIGNMENT_ID,
    dueDate: null,
    updatedAt: null,
    createdAt: '2026-01-15T09:00:00.000Z',
    documentType: 'assessment',
    submissions: [],
    assignmentDefinitionKey: DEFINITION_KEY,
  };
}

/**
 * Build a minimal ClassFull fixture for the test class.
 *
 * @returns {ClassFull} A fully typed ClassFull fixture with the test class ID,
 *   name, student summaries, and one assignment.
 */
function buildClassFull(): ClassFull {
  return {
    classId: CLASS_ID,
    className: CLASS_NAME,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-10',
    classOwner: null,
    teachers: [],
    students: buildStudentSummaries(),
    assignments: [buildAssignmentPartial()],
    active: null,
  };
}

/**
 * Build a minimal AssignmentDefinitionPartialsResponse (array) containing a
 * single partial matching DEFINITION_KEY with titles set to the task id.
 *
 * @param {Partial<{taskTitle: string | null}>[]} [titleOverrides] - Optional per-task title overrides.
 * @returns {AssignmentDefinitionPartialsResponse} The partials array.
 */
function buildPartials(
  titleOverrides?: Array<{ taskTitle?: string | null }>
): AssignmentDefinitionPartialsResponse {
  const titles = titleOverrides ?? TASK_IDS.map((id) => ({ taskTitle: id }));
  return [
    {
      ...buildDefinition(),
      tasks: TASK_IDS.map((id, index) => ({
        taskId: id,
        taskWeighting: 1,
        taskTitle: titles[index]?.taskTitle ?? null,
      })),
    },
  ] as AssignmentDefinitionPartialsResponse;
}

/**
 * Build part of the assignmentDefinitionPartials where the definitionKey does
 * NOT match DEFINITION_KEY (so getAssignmentDefinitionPartial returns null).
 *
 * @returns {AssignmentDefinitionPartialsResponse} A partials array with a non-matching partial.
 */
function buildNonMatchingPartials(): AssignmentDefinitionPartialsResponse {
  return [
    {
      ...buildDefinition(),
      definitionKey: 'dk_other',
      tasks: [{ taskId: 't_other', taskWeighting: 1, taskTitle: 'Other Task' }],
    },
  ] as AssignmentDefinitionPartialsResponse;
}

/**
 * Build a PerStudentTaskMetric fixture for a given student and task.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} taskId - The stable task identifier.
 * @returns {Object} A PerStudentTaskMetric-shaped object with sample computed
 *   metric results for all four criteria.
 */
function buildPerStudentTaskMetric(studentId: string, taskId: string) {
  return {
    classId: CLASS_ID,
    studentId,
    taskKey: taskKey(taskId),
    completeness: createComputedMetricResult({ value: 4 }),
    accuracy: createComputedMetricResult({ value: 3 }),
    spag: createComputedMetricResult({ value: 5 }),
    overall: createComputedMetricResult({ value: 4 }),
  };
}

/**
 * Build a minimal AveragingResult fixture with per-student-task metrics.
 *
 * @param {ReturnType<typeof buildPerStudentTaskMetric>[]} pstm - Array of
 *   per-student-task metric fixtures to include in the result.
 * @returns {AveragingResult} A structurally valid AveragingResult with default
 *   criterion weightings (40/40/20) and empty per-student/per-task arrays.
 */
function minimalAveragingResult(
  pstm: ReturnType<typeof buildPerStudentTaskMetric>[]
): AveragingResult {
  return {
    classId: CLASS_ID,
    className: CLASS_NAME,
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: createComputedMetricResult(),
      accuracy: createComputedMetricResult(),
      spag: createComputedMetricResult(),
      overall: createComputedMetricResult(),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    perStudentTaskMetrics: pstm,
  };
}

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
    });
    expect(result.taskColumns[1]).toEqual({
      taskKey: taskKey('task_002'),
      taskId: 'task_002',
      taskTitle: 'task_002',
    });
    expect(result.taskColumns[2]).toEqual({
      taskKey: taskKey('task_003'),
      taskId: 'task_003',
      taskTitle: 'task_003',
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
