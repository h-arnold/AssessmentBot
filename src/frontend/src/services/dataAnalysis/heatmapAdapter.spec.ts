/**
 * RED-phase tests for `adaptMetricsToHeatmap` — the pure adapter that projects
 * an `AveragingResult` + `ClassFull` into a `HeatmapResult` view model.
 *
 * @remarks
 * These tests are expected to FAIL because `heatmapAdapter.ts` does not exist
 * yet. The failures should be module-resolution errors:
 *   "Cannot find module './heatmapAdapter'"
 * or similar, confirming the tests correctly express the intended behaviour
 * before implementation exists.
 *
 * See ACTION_PLAN.md §Section 2 — Required test cases (Red first).
 */

import { describe, expect, it } from 'vitest';
import type { AveragingResult } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import { adaptMetricsToHeatmap } from './heatmapAdapter';
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
 * @returns {Array<{id: string, taskWeighting: number}>} An array of task-partial objects.
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
    assignmentDefinition: buildDefinition(),
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

describe('adaptMetricsToHeatmap', () => {
  it('returns three taskColumns in task order and one row per student, each with three cells aligned by taskKey', () => {
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const aliceT2 = buildPerStudentTaskMetric('s_001', 'task_002');
    const aliceT3 = buildPerStudentTaskMetric('s_001', 'task_003');
    const bobT1 = buildPerStudentTaskMetric('s_002', 'task_001');
    const bobT2 = buildPerStudentTaskMetric('s_002', 'task_002');
    const bobT3 = buildPerStudentTaskMetric('s_002', 'task_003');

    const analyserResult = minimalAveragingResult([aliceT1, aliceT2, aliceT3, bobT1, bobT2, bobT3]);

    const classFull = buildClassFull();
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID);

    // taskColumns in task order
    expect(result.taskColumns).toHaveLength(expectedTaskColumnCount);
    expect(result.taskColumns[0]).toEqual({
      taskKey: taskKey('task_001'),
      taskId: 'task_001',
      taskTitle: null,
    });
    expect(result.taskColumns[1]).toEqual({
      taskKey: taskKey('task_002'),
      taskId: 'task_002',
      taskTitle: null,
    });
    expect(result.taskColumns[2]).toEqual({
      taskKey: taskKey('task_003'),
      taskId: 'task_003',
      taskTitle: null,
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
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID);

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
    // Override the assignment's tasks to be empty
    (classFull.assignments[0].assignmentDefinition as { tasks: unknown[] }).tasks = [];

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID);

    expect(result.taskColumns).toHaveLength(0);
    expect(result.rows).toHaveLength(expectedStudentCount);
    for (const row of result.rows) {
      expect(row.cells).toHaveLength(0);
    }
  });

  it('throws when assignmentId is not found in classFull.assignments', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const unknownId = 'nonexistent_assignment';

    expect(() => adaptMetricsToHeatmap(analyserResult, classFull, unknownId)).toThrow();
  });

  it('derives assignmentName from primaryTitle, className from classFull.className, and every taskTitle is null', () => {
    const aliceT1 = buildPerStudentTaskMetric('s_001', 'task_001');
    const bobT1 = buildPerStudentTaskMetric('s_002', 'task_001');

    const analyserResult = minimalAveragingResult([aliceT1, bobT1]);
    const classFull = buildClassFull();
    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID);

    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
    expect(result.assignmentName).toBe('Quadratics Assessment');
    expect(result.className).toBe(CLASS_NAME);

    for (const col of result.taskColumns) {
      expect(col.taskTitle).toBeNull();
    }
  });

  it('fallbacks className to "Class Overview" when classFull.className is null', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    classFull.className = null;

    const result = adaptMetricsToHeatmap(analyserResult, classFull, ASSIGNMENT_ID);

    expect(result.className).toBe('Class Overview');
  });
});
