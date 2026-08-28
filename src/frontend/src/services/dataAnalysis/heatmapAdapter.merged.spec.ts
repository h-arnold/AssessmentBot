/**
 * Green-phase contract tests for `adaptMetricsToMergedHeatmap` (Section 2 — merged adapter).
 *
 * @remarks
 * This suite pins the merged-adapter contract for the exported
 * `adaptMetricsToMergedHeatmap(analyserResult, classFull, selectedAssignmentIds,
 * assignmentDefinitionPartials)` function in `./heatmapAdapter`. The function is imported
 * statically and every behavioural assertion below passes against the implemented behaviour.
 *
 * The merged-adapter contract covered by this suite:
 * - Column identity: every merged column carries the full identity
 *   `{ taskKey, taskId, taskTitle, assignmentId, definitionKey, assignmentName }`.
 * - Dedupe-by-taskKey: columns sharing a composite `taskKey` collapse to a single column set
 *   whose identity (`assignmentId`, `assignmentName`) is taken from the FIRST occurrence in
 *   `classFull.assignments` order; cells are identical whether one or both instances are selected.
 * - Ordering: `taskColumns` follow `classFull.assignments` order (restricted to selected IDs),
 *   tasks per assignment follow the partial's task order, and `sourceAssignments` preserve the
 *   caller's `selectedAssignmentIds` order.
 * - Roster completeness: rows cover every class student; students without metrics still produce
 *   rows.
 * - notAttempted fallback: missing `(studentId, taskKey)` pairs fall back to the frozen
 *   not-attempted metric.
 * - Error paths: an unknown `selectedAssignmentId` throws a generic `Error`, and a selected
 *   assignment whose `definitionKey` has no matching partial throws `TaskTitlesUnavailableError`.
 */

import { describe, expect, it } from 'vitest';
import type { AveragingResult } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { adaptMetricsToMergedHeatmap, TaskTitlesUnavailableError } from './heatmapAdapter';
import { createComputedMetricResult, createTaskPartial } from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

const CLASS_ID = 'class_m_001';
const CLASS_NAME = 'Year 10 Mathematics';
const QUADRATICS_DEFINITION_KEY = 'dk_quadratics';
const LINEAR_DEFINITION_KEY = 'dk_linear';
const MISSING_DEFINITION_KEY = 'dk_missing';

const ASSIGNMENT_ID_ONE = 'assignment_a1'; // dk_quadratics
const ASSIGNMENT_ID_TWO = 'assignment_a2'; // dk_quadratics (duplicate of a1)
const ASSIGNMENT_ID_THREE = 'assignment_a3'; // dk_linear
const ASSIGNMENT_ID_MISSING = 'assignment_a4'; // dk_missing (no partial)

const STUDENT_IDS = ['s_001', 's_002', 's_003'];
const STUDENT_NAMES = ['Alice', 'Bob', 'Carol'];

const QUAD_TASK_IDS = ['task_q1', 'task_q2'];
const LINEAR_TASK_IDS = ['task_l1', 'task_l2'];

const QUADRATICS_TITLE = 'Quadratics Assessment';
const LINEAR_TITLE = 'Linear Equations Assessment';

/** Default base metric value used when building fixture per-student-task metrics. */
const DEFAULT_METRIC_BASE_VALUE = 4;
/** Offset added to the base value for the spag criterion in fixture metrics. */
const SPAG_OFFSET = 2;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a canonical `${definitionKey}::${taskId}` task key.
 *
 * @param {string} definitionKey - The definition key.
 * @param {string} taskId - The stable task identifier.
 * @returns {string} The composite task key.
 */
function taskKeyFor(definitionKey: string, taskId: string): string {
  return `${definitionKey}::${taskId}`;
}

/**
 * Build the student-summary array for the fixture class.
 *
 * @returns {Array<{id: string, name: string, email: string}>} Student summaries.
 */
function buildStudentSummaries() {
  return STUDENT_IDS.map((id, index) => ({
    id,
    name: STUDENT_NAMES[index],
    email: `${id}@school.edu`,
  }));
}

/**
 * Build a minimal assignment-partial fixture for one assignment instance.
 *
 * @param {string} assignmentId - The assignment identifier.
 * @param {string} definitionKey - The assignment's definition key.
 * @returns {Object} An AssignmentPartial-shaped object with an empty submissions array.
 */
function buildAssignmentPartial(assignmentId: string, definitionKey: string) {
  return {
    assignmentId,
    dueDate: null,
    updatedAt: null,
    createdAt: '2026-01-15T09:00:00.000Z',
    documentType: 'assessment',
    submissions: [],
    assignmentDefinitionKey: definitionKey,
  };
}

/**
 * Build a minimal AssignmentDefinitionPartial fixture.
 *
 * @param {string} definitionKey - The definition key.
 * @param {string} primaryTitle - The resolved primary title.
 * @param {Array<string>} taskIds - The ordered task identifiers for this definition.
 * @returns {Object} An AssignmentDefinitionPartial-shaped object with titles set per task.
 */
function buildDefinitionPartial(
  definitionKey: string,
  primaryTitle: string,
  taskIds: Array<string>
) {
  return {
    primaryTitle,
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
    definitionKey,
    tasks: taskIds.map((id) => createTaskPartial(id, 1, `${id} title`)),
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: null,
  };
}

/**
 * Build the assignment-definition partials registry used by the merged adapter.
 *
 * @returns {AssignmentDefinitionPartialsResponse} Partials for quadratics and linear keys.
 */
function buildPartials(): AssignmentDefinitionPartialsResponse {
  return [
    buildDefinitionPartial(QUADRATICS_DEFINITION_KEY, QUADRATICS_TITLE, QUAD_TASK_IDS),
    buildDefinitionPartial(LINEAR_DEFINITION_KEY, LINEAR_TITLE, LINEAR_TASK_IDS),
  ] as AssignmentDefinitionPartialsResponse;
}

/**
 * Build a ClassFull fixture with the four fixture assignment instances.
 *
 * @param {string | null} [className] - Optional class name override (default CLASS_NAME).
 * @returns {ClassFull} A fully typed ClassFull fixture.
 */
function buildClassFull(className: string | null = CLASS_NAME): ClassFull {
  return {
    classId: CLASS_ID,
    className,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-10',
    classOwner: null,
    teachers: [],
    students: buildStudentSummaries(),
    assignments: [
      buildAssignmentPartial(ASSIGNMENT_ID_ONE, QUADRATICS_DEFINITION_KEY),
      buildAssignmentPartial(ASSIGNMENT_ID_TWO, QUADRATICS_DEFINITION_KEY),
      buildAssignmentPartial(ASSIGNMENT_ID_THREE, LINEAR_DEFINITION_KEY),
      buildAssignmentPartial(ASSIGNMENT_ID_MISSING, MISSING_DEFINITION_KEY),
    ],
    active: null,
  };
}

/**
 * Build a PerStudentTaskMetric fixture for a given student, definition, and task.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} definitionKey - The definition key.
 * @param {string} taskId - The stable task identifier.
 * @param {number} [value] - Base metric value (completeness=value, accuracy=value+1, spag=value+2).
 * @returns {Object} A PerStudentTaskMetric-shaped object with computed metric results.
 */
function buildPerStudentTaskMetric(
  studentId: string,
  definitionKey: string,
  taskId: string,
  value: number = DEFAULT_METRIC_BASE_VALUE
) {
  return {
    classId: CLASS_ID,
    studentId,
    taskKey: taskKeyFor(definitionKey, taskId),
    completeness: createComputedMetricResult({ value }),
    accuracy: createComputedMetricResult({ value: value + 1 }),
    spag: createComputedMetricResult({ value: value + SPAG_OFFSET }),
    overall: createComputedMetricResult({ value: value + 1 }),
  };
}

/**
 * Build a minimal AveragingResult fixture with optional per-student-task metrics.
 *
 * @param {Array<ReturnType<typeof buildPerStudentTaskMetric>>} pstm - Per-student-task metrics.
 * @returns {AveragingResult} A structurally valid AveragingResult.
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

describe('adaptMetricsToMergedHeatmap — merged column construction and identity', () => {
  it('produces a union of task columns across distinct selected assignments, in classFull order with full identity fields', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    // Select a1 (quadratics) and a3 (linear) — distinct definition keys.
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE, ASSIGNMENT_ID_THREE],
      partials
    );

    // 2 quadratics tasks + 2 linear tasks = 4 columns.
    expect(result.taskColumns).toHaveLength(QUAD_TASK_IDS.length + LINEAR_TASK_IDS.length);

    // Columns follow classFull.assignments order (a1 before a3): quadratics first, then linear.
    expect(result.taskColumns[0].taskKey).toBe(
      taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[0])
    );
    expect(result.taskColumns[1].taskKey).toBe(
      taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[1])
    );
    expect(result.taskColumns[2].taskKey).toBe(
      taskKeyFor(LINEAR_DEFINITION_KEY, LINEAR_TASK_IDS[0])
    );
    expect(result.taskColumns[3].taskKey).toBe(
      taskKeyFor(LINEAR_DEFINITION_KEY, LINEAR_TASK_IDS[1])
    );

    // Every column carries full identity; the first selected assignment's identity wins per group.
    for (const column of result.taskColumns.slice(0, QUAD_TASK_IDS.length)) {
      expect(column.assignmentId).toBe(ASSIGNMENT_ID_ONE);
      expect(column.definitionKey).toBe(QUADRATICS_DEFINITION_KEY);
      expect(column.assignmentName).toBe(QUADRATICS_TITLE);
    }
    for (const column of result.taskColumns.slice(QUAD_TASK_IDS.length)) {
      expect(column.assignmentId).toBe(ASSIGNMENT_ID_THREE);
      expect(column.definitionKey).toBe(LINEAR_DEFINITION_KEY);
      expect(column.assignmentName).toBe(LINEAR_TITLE);
    }

    // taskId and taskTitle come straight from the partial.
    expect(result.taskColumns[0].taskId).toBe(QUAD_TASK_IDS[0]);
    expect(result.taskColumns[0].taskTitle).toBe(`${QUAD_TASK_IDS[0]} title`);
  });

  it('resolves sourceAssignments in stable selected order, distinct from task-column order', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    // Select a3 first, then a1 — selection order should drive sourceAssignments order.
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_THREE, ASSIGNMENT_ID_ONE],
      partials
    );

    expect(result.sourceAssignments).toEqual([
      {
        assignmentId: ASSIGNMENT_ID_THREE,
        definitionKey: LINEAR_DEFINITION_KEY,
        assignmentName: LINEAR_TITLE,
      },
      {
        assignmentId: ASSIGNMENT_ID_ONE,
        definitionKey: QUADRATICS_DEFINITION_KEY,
        assignmentName: QUADRATICS_TITLE,
      },
    ]);

    // classId and className metadata are carried through.
    expect(result.classId).toBe(CLASS_ID);
    expect(result.className).toBe(CLASS_NAME);
  });
});

describe('adaptMetricsToMergedHeatmap — dedupe-by-taskKey', () => {
  it('collapses two instances sharing a definition key into one column set, taking identity from the FIRST classFull occurrence', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    // Select a2 then a1 (both quadratics); classFull order is a1, a2 — first occurrence is a1.
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_TWO, ASSIGNMENT_ID_ONE],
      partials
    );

    // Only one column set (the quadratics tasks), not two.
    expect(result.taskColumns).toHaveLength(QUAD_TASK_IDS.length);
    expect(result.taskColumns[0].taskKey).toBe(
      taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[0])
    );

    // Identity comes from the FIRST classFull occurrence (a1), not the selection order (a2).
    expect(result.taskColumns[0].assignmentId).toBe(ASSIGNMENT_ID_ONE);
    expect(result.taskColumns[0].definitionKey).toBe(QUADRATICS_DEFINITION_KEY);
    expect(result.taskColumns[0].assignmentName).toBe(QUADRATICS_TITLE);

    // Both selected assignments still appear in sourceAssignments in selection order.
    expect(result.sourceAssignments).toEqual([
      {
        assignmentId: ASSIGNMENT_ID_TWO,
        definitionKey: QUADRATICS_DEFINITION_KEY,
        assignmentName: QUADRATICS_TITLE,
      },
      {
        assignmentId: ASSIGNMENT_ID_ONE,
        definitionKey: QUADRATICS_DEFINITION_KEY,
        assignmentName: QUADRATICS_TITLE,
      },
    ]);
  });

  it('feeds merged (accumulated) metrics into the single collapsed column for a shared taskKey', () => {
    // One analyser metric for the shared quadratics taskKey; both instances selected.
    const metric = buildPerStudentTaskMetric('s_001', QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[0]);
    const analyserResult = minimalAveragingResult([metric]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE, ASSIGNMENT_ID_TWO],
      partials
    );

    // A single column for the shared taskKey; the merged metric shows for the student.
    const sharedColumn = result.taskColumns.find(
      (c) => c.taskKey === taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[0])
    );
    expect(sharedColumn).toBeDefined();

    const aliceRow = result.rows.find((r) => r.studentId === 's_001');
    expect(aliceRow).toBeDefined();
    const columnIndex = result.taskColumns.indexOf(sharedColumn!);
    expect(aliceRow!.cells[columnIndex].completeness).toEqual(metric.completeness);
    expect(aliceRow!.cells[columnIndex].accuracy).toEqual(metric.accuracy);
    expect(aliceRow!.cells[columnIndex].spag).toEqual(metric.spag);
  });

  it('yields identical cells for a shared taskKey whether one or both instances are selected (merge parity)', () => {
    const metric = buildPerStudentTaskMetric('s_001', QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[1]);
    const analyserResult = minimalAveragingResult([metric]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    const single = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE],
      partials
    );
    const both = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE, ASSIGNMENT_ID_TWO],
      partials
    );

    const indexSingle = single.taskColumns.findIndex(
      (c) => c.taskKey === taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[1])
    );
    const indexBoth = both.taskColumns.findIndex(
      (c) => c.taskKey === taskKeyFor(QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[1])
    );

    const aliceSingle = single.rows.find((r) => r.studentId === 's_001')!;
    const aliceBoth = both.rows.find((r) => r.studentId === 's_001')!;

    expect(aliceBoth.cells[indexBoth]).toEqual(aliceSingle.cells[indexSingle]);
  });
});

describe('adaptMetricsToMergedHeatmap — cell mapping and roster completeness', () => {
  it('maps computed metrics and falls back to notAttempted for missing (student, taskKey) pairs, covering all students', () => {
    // Only Alice (s_001) has metrics, on both quadratics tasks; Bob and Carol have none.
    const aliceQ1 = buildPerStudentTaskMetric('s_001', QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[0]);
    const aliceQ2 = buildPerStudentTaskMetric('s_001', QUADRATICS_DEFINITION_KEY, QUAD_TASK_IDS[1]);
    const analyserResult = minimalAveragingResult([aliceQ1, aliceQ2]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE],
      partials
    );

    // Rows cover ALL class students, even those without metrics.
    expect(result.rows).toHaveLength(STUDENT_IDS.length);
    expect(result.rows.map((r) => r.studentId)).toEqual(STUDENT_IDS);

    const aliceRow = result.rows[0];
    expect(aliceRow.studentName).toBe('Alice');
    expect(aliceRow.cells).toHaveLength(QUAD_TASK_IDS.length);
    expect(aliceRow.cells[0].completeness).toEqual(aliceQ1.completeness);
    expect(aliceRow.cells[1].completeness).toEqual(aliceQ2.completeness);

    // Students without metrics still produce rows with frozen notAttempted cells.
    for (const row of result.rows.slice(1)) {
      expect(row.cells).toHaveLength(QUAD_TASK_IDS.length);
      for (const cell of row.cells) {
        expect(cell.completeness.state).toBe('notAttempted');
        expect(cell.completeness.value).toBe('N');
        expect(cell.accuracy.state).toBe('notAttempted');
        expect(cell.accuracy.value).toBe('N');
        expect(cell.spag.state).toBe('notAttempted');
        expect(cell.spag.value).toBe('N');
      }
    }
  });
});

describe('adaptMetricsToMergedHeatmap — error paths', () => {
  it('throws when a selected assignmentId is not present in classFull.assignments', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    expect(() =>
      adaptMetricsToMergedHeatmap(analyserResult, classFull, ['nonexistent_assignment'], partials)
    ).toThrow(/not found in classFull\.assignments/);
  });

  it('throws TaskTitlesUnavailableError when a selected assignment definitionKey has no matching partial', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials(); // no entry for MISSING_DEFINITION_KEY

    expect(() =>
      adaptMetricsToMergedHeatmap(analyserResult, classFull, [ASSIGNMENT_ID_MISSING], partials)
    ).toThrow(TaskTitlesUnavailableError);
  });
});

describe('adaptMetricsToMergedHeatmap — title resolution and className fallback parity', () => {
  it('resolves assignmentName from the partial primaryTitle and carries taskTitle', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull();
    const partials = buildPartials();

    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_THREE],
      partials
    );

    expect(result.taskColumns).toHaveLength(LINEAR_TASK_IDS.length);
    expect(result.taskColumns[0].assignmentName).toBe(LINEAR_TITLE);
    expect(result.taskColumns[0].taskTitle).toBe(`${LINEAR_TASK_IDS[0]} title`);
  });

  it('falls back className to "Class Overview" when classFull.className is null, matching the existing adapter', () => {
    const analyserResult = minimalAveragingResult([]);
    const classFull = buildClassFull(null);
    const partials = buildPartials();

    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      [ASSIGNMENT_ID_ONE],
      partials
    );

    expect(result.className).toBe('Class Overview');
  });
});
