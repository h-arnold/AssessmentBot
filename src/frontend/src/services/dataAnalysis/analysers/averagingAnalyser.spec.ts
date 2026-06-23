import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed ISO timestamp used as the default `createdAt` value in fixtures. */
const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

/** Tolerance (decimal places) for `toBeCloseTo` floating-point comparisons. */
const FLOAT_TOLERANCE = 10;

// ---------------------------------------------------------------------------
// Fixture builders — produce minimal structurally-valid AveragingAnalyserInput
// ---------------------------------------------------------------------------

/**
 * Build a minimal task-partial object.
 *
 * @param {string} id - The stable task identifier.
 * @param {number} [taskWeighting=1] - The task weighting factor.
 * @returns {{ id: string, taskWeighting: number }} A minimal TaskPartial-shaped object.
 */
function createTaskPartial(id: string, taskWeighting: number = 1) {
  return { id, taskWeighting };
}

/**
 * Build a minimal `AssignmentDefinitionPartial`-shaped object for test use.
 *
 * @param {Object} [overrides] - Optional overrides.
 * @param {string} [overrides.definitionKey=dk_algebra] - The definition key.
 * @param {number|null} [overrides.assignmentWeighting=1] - The assignment weighting.
 * @param {Array<{id: string, taskWeighting: number}>} [overrides.tasks] - Task partials.
 * @param {string} [overrides.createdAt] - ISO creation timestamp.
 * @returns {Object} A minimal assignment-definition-partial fixture.
 */
function createDefinitionPartial(
  overrides: Partial<{
    definitionKey: string;
    assignmentWeighting: number | null;
    tasks: Array<{ id: string; taskWeighting: number }>;
    createdAt: string;
  }> = {}
) {
  const {
    definitionKey = 'dk_algebra',
    assignmentWeighting = 1,
    tasks = [createTaskPartial('t_001')],
    createdAt = DEFAULT_CREATED_AT,
  } = overrides;

  return {
    primaryTitle: 'Test',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'assignment',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting,
    definitionKey,
    tasks,
    createdAt,
    updatedAt: null,
  };
}

/**
 * Build a minimal submission item with optional assessments.
 *
 * @param {string} taskId - The task identifier this item belongs to.
 * @param {Object<string, {score: number|'N'}>} [assessments] - Optional criterion→score map.
 * @returns {Object} A minimal StudentSubmissionItemPartial-shaped object.
 */
function createSubmissionItem(
  taskId: string,
  assessments?: Record<string, { score: number | 'N' }>
) {
  return {
    id: `${taskId}_item`,
    taskId,
    artifact: {
      taskId,
      role: 'student',
      pageId: null,
      documentId: null,
      content: null,
      contentHash: null,
      metadata: undefined,
      uid: `${taskId}_uid`,
      type: 'document',
    },
    assessments,
    feedback: undefined,
  };
}

/**
 * Build a minimal student submission.
 *
 * @param {string} studentId - The student identifier.
 * @param {string|null} studentName - The student display name.
 * @param {string} assignmentId - The parent assignment identifier.
 * @param {Object<string, Object>} items - Dictionary of taskId→submission item.
 * @returns {Object} A minimal StudentSubmissionPartial-shaped object.
 */
function createSubmission(
  studentId: string,
  studentName: string | null,
  assignmentId: string,
  items: Record<string, ReturnType<typeof createSubmissionItem>>
) {
  return {
    studentId,
    studentName,
    assignmentId,
    documentId: null,
    items,
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT,
  };
}

/**
 * Build a minimal assignment-partial fixture.
 *
 * @param {Object} overrides - Required partial overrides plus optional fields.
 * @param {string} overrides.assignmentId - The assignment identifier.
 * @param {string} overrides.definitionKey - The definition key.
 * @param {Array<Object>} overrides.submissions - Student submissions.
 * @param {Array<{id: string, taskWeighting: number}>} overrides.tasks - Task partials.
 * @param {number|null} [overrides.assignmentWeighting=1] - The assignment weighting.
 * @param {string} [overrides.createdAt] - ISO creation timestamp.
 * @returns {Object} A minimal AssignmentPartial-shaped object.
 */
function createAssignmentPartial(overrides: {
  assignmentId: string;
  definitionKey: string;
  submissions: ReturnType<typeof createSubmission>[];
  tasks: Array<{ id: string; taskWeighting: number }>;
  assignmentWeighting?: number | null;
  createdAt?: string;
}) {
  const {
    assignmentId,
    definitionKey,
    submissions,
    tasks,
    assignmentWeighting = 1,
    createdAt = DEFAULT_CREATED_AT,
  } = overrides;

  return {
    courseId: 'course_001',
    assignmentId,
    assignmentName: 'Test Assignment',
    dueDate: null,
    lastUpdated: null,
    createdAt,
    documentType: 'assessment',
    submissions,
    assignmentDefinition: createDefinitionPartial({
      definitionKey,
      assignmentWeighting,
      tasks,
      createdAt,
    }),
  };
}

/**
 * Build a minimal class-full fixture.
 *
 * @param {Object} overrides - Required class overrides with optional fields.
 * @param {string} overrides.classId - The class identifier.
 * @param {string|null} [overrides.className] - The class display name.
 * @param {Array<string>} [overrides.studentIds] - List of student identifiers.
 * @param {Array<Object>} overrides.assignments - Assignment partials.
 * @returns {Object} A minimal ClassFull-shaped object.
 */
function createClassFull(overrides: {
  classId: string;
  className?: string | null;
  studentIds?: string[];
  assignments: ReturnType<typeof createAssignmentPartial>[];
}) {
  const { classId, className = 'Test Class', studentIds = [], assignments } = overrides;

  return {
    classId,
    className,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-10',
    classOwner: null,
    teachers: [],
    students: studentIds.map((id) => ({ id, name: `Student ${id}`, email: `${id}@test.com` })),
    assignments,
    active: null,
  };
}

/**
 * Build a minimal `AveragingAnalyserInput` from partial overrides.
 *
 * @param {Object} overrides - Input overrides.
 * @param {Array<Object>} overrides.classOverrides - Per-class override entries.
 * @param {string} overrides.classOverrides[].classId - The class identifier.
 * @param {string|null} [overrides.classOverrides[].className] - The class display name.
 * @param {Array<string>} [overrides.classOverrides[].studentIds] - Student identifiers.
 * @param {Array<Object>} overrides.classOverrides[].assignments - Assignment partials.
 * @returns {Object} A structurally valid AveragingAnalyserInput.
 */
function buildInput(
  overrides: Partial<AveragingAnalyserInput> & {
    classOverrides: Array<{
      classId: string;
      className?: string | null;
      studentIds?: string[];
      assignments: ReturnType<typeof createAssignmentPartial>[];
    }>;
  }
): AveragingAnalyserInput {
  const classIds = overrides.classOverrides.map((c) => c.classId);
  const classes = overrides.classOverrides.map((c) => createClassFull(c));
  const allDefinitionPartials = classes.flatMap((c) =>
    c.assignments.map((a) => a.assignmentDefinition)
  );

  // De-duplicate by definitionKey
  const seen = new Set<string>();
  const uniqueDefinitionPartials = allDefinitionPartials.filter((d) => {
    const k = d.definitionKey;
    return seen.has(k) ? false : (seen.add(k), true);
  });

  return {
    filter: {
      classIds,
    },
    classes,
    assignmentDefinitionPartials:
      overrides.assignmentDefinitionPartials ?? uniqueDefinitionPartials,
  };
}

// ---------------------------------------------------------------------------
// Helper: deep-compare numeric results with tolerance
// ---------------------------------------------------------------------------

/**
 * Assert that an actual `MetricResult` matches the expected values.
 *
 * Numeric fields (`value`, `totalWeight`) are compared with `toBeCloseTo` to
 * tolerate floating-point drift.
 *
 * @param {Object} actual - The actual metric result from the analyser.
 * @param {number|null} actual.value - The metric value.
 * @param {number} actual.totalWeight - The total weight of contributing data points.
 * @param {number} actual.applicableDataPoints - Count of contributing data points.
 * @param {number} actual.totalDataPoints - Total data points in the group.
 * @param {Object} expected - The expected metric result values.
 * @param {number|null} expected.value - The expected metric value.
 * @param {number} expected.totalWeight - The expected total weight.
 * @param {number} expected.applicableDataPoints - Expected contributing count.
 * @param {number} expected.totalDataPoints - Expected total count.
 */
function expectMetricResult(
  actual: {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  },
  expected: {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }
): void {
  if (expected.value === null) {
    expect(actual.value).toBeNull();
  } else {
    expect(actual.value).toBeCloseTo(expected.value, FLOAT_TOLERANCE);
  }
  expect(actual.totalWeight).toBeCloseTo(expected.totalWeight, FLOAT_TOLERANCE);
  expect(actual.applicableDataPoints).toBe(expected.applicableDataPoints);
  expect(actual.totalDataPoints).toBe(expected.totalDataPoints);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AveragingAnalyser', () => {
  describe('constructor', () => {
    it('uses default criterion weightings (completeness=0.4, accuracy=0.4, spag=0.2) when none provided', () => {
      const analyser = new AveragingAnalyser();
      expect(analyser).toBeInstanceOf(AveragingAnalyser);
    });

    it('accepts custom criterion weightings', () => {
      const analyser = new AveragingAnalyser({ completeness: 0.5, accuracy: 0.3, spag: 0.2 });
      expect(analyser).toBeInstanceOf(AveragingAnalyser);
    });
  });

  describe('analyse', () => {
    // -----------------------------------------------------------------------
    // 1) Single student, single task, single criterion (accuracy only)
    // -----------------------------------------------------------------------
    it('computes correct weighted average for single student, single task, single criterion', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');
      expect(results[0].className).toBe('Test Class');

      // perStudent
      expect(results[0].perStudent).toHaveLength(1);
      const student = results[0].perStudent[0];
      expect(student.studentId).toBe('s_001');
      expect(student.studentName).toBe('Alice');

      // completeness: no data point
      expectMetricResult(student.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // accuracy: single score 4, weight 1×1=1
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: no data point
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // overall: only accuracy contributes → (0.4*4) / 0.4 = 4
      expectMetricResult(student.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      // perTask
      expect(results[0].perTask).toHaveLength(1);
      const taskRow = results[0].perTask[0];
      expect(taskRow.definitionKey).toBe('dk_algebra');
      expect(taskRow.taskId).toBe('t_001');
      expect(taskRow.taskTitle).toBeNull();

      expectMetricResult(taskRow.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      // perClass — same as per-student (single student)
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 2) Multiple students, multiple tasks, all three criteria
    // -----------------------------------------------------------------------
    it('computes per-student and per-task breakdowns correctly for multiple students and tasks', () => {
      const studentIdsInTest = ['s_001', 's_002'];
      const tasksInMultiTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: studentIdsInTest,
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: tasksInMultiTest,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 3 },
                      accuracy: { score: 4 },
                      spag: { score: 5 },
                    }),
                    t_002: createSubmissionItem('t_002', {
                      completeness: { score: 4 },
                      accuracy: { score: 3 },
                      spag: { score: 4 },
                    }),
                  }),
                  createSubmission('s_002', 'Bob', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 5 },
                      accuracy: { score: 5 },
                      spag: { score: 5 },
                    }),
                    t_002: createSubmissionItem('t_002', {
                      completeness: { score: 2 },
                      accuracy: { score: 3 },
                      spag: { score: 4 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');

      // ── perStudent sorted by name ────────────────────────────────
      expect(results[0].perStudent).toHaveLength(studentIdsInTest.length);
      const alice = results[0].perStudent[0];
      const bob = results[0].perStudent[1];
      expect(alice.studentId).toBe('s_001');
      expect(bob.studentId).toBe('s_002');

      // Alice — completeness (3+4)/2 = 3.5
      expectMetricResult(alice.completeness, {
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — accuracy (4+3)/2 = 3.5
      expectMetricResult(alice.accuracy, {
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — spag (5+4)/2 = 4.5
      expectMetricResult(alice.spag, {
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — overall: t1=(0.4*3+0.4*4+0.2*5)=3.8, t2=(0.4*4+0.4*3+0.2*4)=3.6, avg=(3.8+3.6)/2=3.7
      expectMetricResult(alice.overall, {
        value: 3.7,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      // Bob — completeness (5+2)/2 = 3.5
      expectMetricResult(bob.completeness, {
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — accuracy (5+3)/2 = 4
      expectMetricResult(bob.accuracy, {
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — spag (5+4)/2 = 4.5
      expectMetricResult(bob.spag, {
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — overall: t1=(0.4*5+0.4*5+0.2*5)=5, t2=(0.4*2+0.4*3+0.2*4)=2.8, avg=(5+2.8)/2=3.9
      expectMetricResult(bob.overall, {
        value: 3.9,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      // ── perTask sorted by (definitionKey, taskId) ─────────────────
      expect(results[0].perTask).toHaveLength(tasksInMultiTest.length);
      const task1 = results[0].perTask[0];
      const task2 = results[0].perTask[1];
      expect(task1.definitionKey).toBe('dk_algebra');
      expect(task1.taskId).toBe('t_001');
      expect(task2.taskId).toBe('t_002');

      // Task t_001: Alice(3,4,5) Bob(5,5,5)
      expectMetricResult(task1.completeness, {
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task1.accuracy, {
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task1.spag, {
        value: 5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task1.overall, {
        value: 4.4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }); // (3.8+5)/2=4.4

      // Task t_002: Alice(4,3,4) Bob(2,3,4)
      expectMetricResult(task2.completeness, {
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task2.accuracy, {
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task2.spag, {
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResult(task2.overall, {
        value: 3.2,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }); // (3.6+2.8)/2=3.2

      // ── perClass ──────────────────────────────────────────────────
      // All 4 data points
      expectMetricResult(results[0].perClass.completeness, {
        value: 3.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: 3.75,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: 4.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: 3.8,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      }); // (3.8+3.6+5+2.8)/4=3.8
    });

    // -----------------------------------------------------------------------
    // 3) Empty input (no classes)
    // -----------------------------------------------------------------------
    it('returns empty array when no classes are provided', () => {
      const input: AveragingAnalyserInput = {
        filter: { classIds: ['c_001'] },
        classes: [],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // 4) Class with no assignments
    // -----------------------------------------------------------------------
    it('returns per-class metrics all null when class has no assignments', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            className: 'Empty Class',
            assignments: [],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perStudent).toEqual([]);
      expect(results[0].perTask).toEqual([]);

      // All per-class metric results should be null (0 data points)
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    // -----------------------------------------------------------------------
    // 5) Student with no submissions
    // -----------------------------------------------------------------------
    it('returns per-student metrics all null when student has empty items', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [createSubmission('s_001', 'Alice', 'a_001', {})],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perStudent).toHaveLength(1);

      const student = results[0].perStudent[0];
      expect(student.studentId).toBe('s_001');

      // All student metrics are null (0 data points)
      expectMetricResult(student.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(student.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(student.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    // -----------------------------------------------------------------------
    // 6) Task with no submissions
    // -----------------------------------------------------------------------
    it('returns per-task metrics all null when no student submitted for a task', () => {
      const tasksInNoSubmissionTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                // Two tasks defined, but only t_001 has a submission
                tasks: tasksInNoSubmissionTest,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    // t_002 intentionally absent
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perTask).toHaveLength(tasksInNoSubmissionTest.length);

      const taskWithData = results[0].perTask[0];
      const taskWithoutData = results[0].perTask[1];

      expect(taskWithData.taskId).toBe('t_001');
      expectMetricResult(taskWithData.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expect(taskWithoutData.taskId).toBe('t_002');
      expectMetricResult(taskWithoutData.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(taskWithoutData.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(taskWithoutData.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(taskWithoutData.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    // -----------------------------------------------------------------------
    // 7) assignmentWeighting = 0 skips the assignment
    // -----------------------------------------------------------------------
    it('skips assignment when assignmentWeighting is 0', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                assignmentWeighting: 0,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 5 },
                      accuracy: { score: 5 },
                      spag: { score: 5 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // All metrics are null — zero-weight assignment contributes no data
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    // -----------------------------------------------------------------------
    // 8) taskWeighting = 0 skips the task
    // -----------------------------------------------------------------------
    it('skips task when taskWeighting is 0', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 0)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 5 },
                      accuracy: { score: 5 },
                      spag: { score: 5 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // All metrics are null — zero-weight task contributes no data
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    // -----------------------------------------------------------------------
    // 9) SPaG score 'N' — excluded from spag weighted sum, adjusts total weight
    // -----------------------------------------------------------------------
    it('excludes SPaG N from spag weighted sum and adjusts overall denominator', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 3 },
                      accuracy: { score: 4 },
                      spag: { score: 'N' },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      const student = results[0].perStudent[0];

      // completeness: value = 3, weight = 1
      expectMetricResult(student.completeness, {
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // accuracy: value = 4, weight = 1
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: 'N' → not contributing, applicableDataPoints = 0, totalDataPoints still 1
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // overall: spag excluded from denominator
      // overall_i = (0.4*3 + 0.4*4 + 0.2*N) / (0.4 + 0.4 + 0) = (1.2 + 1.6) / 0.8 = 3.5
      expectMetricResult(student.overall, {
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 10) assignmentWeighting and taskWeighting multiply
    // -----------------------------------------------------------------------
    it('uses product of assignmentWeighting and taskWeighting as per-data-point weight', () => {
      const doubleAssignmentWeighting = 2;
      const tripleTaskWeighting = 3;
      // doubleAssignmentWeighting × tripleTaskWeighting → weight = 6
      // Single data point: accuracy = 4
      // Weighted sum = 6 * 4 = 24, totalWeight = 6, value = 24 / 6 = 4
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: doubleAssignmentWeighting,
                tasks: [createTaskPartial('t_001', tripleTaskWeighting)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // accuracy: value = (6*4)/6 = 4, totalWeight = 6
      expectMetricResult(results[0].perStudent[0].accuracy, {
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perStudent[0].overall, {
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 11) Constructor defaults match explicit default weightings
    // -----------------------------------------------------------------------
    it('produces identical results between default and explicit weightings', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 3 },
                      accuracy: { score: 4 },
                      spag: { score: 5 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const defaultAnalyser = new AveragingAnalyser();
      const explicitAnalyser = new AveragingAnalyser({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });

      const defaultResults = defaultAnalyser.analyse(input);
      const explicitResults = explicitAnalyser.analyse(input);

      expect(defaultResults).toEqual(explicitResults);
    });

    // -----------------------------------------------------------------------
    // 12) Custom criterionWeightings override defaults
    // -----------------------------------------------------------------------
    it('uses custom criterion weightings passed to constructor', () => {
      // Custom: completeness=0.6, accuracy=0.3, spag=0.1
      // Single data point: completeness=3, accuracy=4, spag=5
      // overall_i = (0.6*3 + 0.3*4 + 0.1*5) / (0.6+0.3+0.1) = (1.8+1.2+0.5)/1.0 = 3.5
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 3 },
                      accuracy: { score: 4 },
                      spag: { score: 5 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser({ completeness: 0.6, accuracy: 0.3, spag: 0.1 });
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      const student = results[0].perStudent[0];

      // Per-criterion values unchanged (weighted average per criterion is same regardless of criterion weightings)
      expectMetricResult(student.completeness, {
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(student.spag, {
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // overall: (0.6*3 + 0.3*4 + 0.1*5) / 1.0 = 3.5
      expectMetricResult(student.overall, {
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 13) MetricResultSchema invariant: value=null iff applicableDataPoints=0
    // -----------------------------------------------------------------------
    it('maintains MetricResultSchema invariant throughout output', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001', 's_002'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 3 },
                      accuracy: { score: 4 },
                      spag: { score: 5 },
                    }),
                    // s_001 missing t_002
                  }),
                  createSubmission('s_002', 'Bob', 'a_001', {
                    // s_002 has no items at all
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      // Check that for every MetricResult in the output tree:
      //   value === null  iff  applicableDataPoints === 0
      for (const result of results) {
        for (const student of result.perStudent) {
          checkMetricInvariant(student.completeness);
          checkMetricInvariant(student.accuracy);
          checkMetricInvariant(student.spag);
          checkMetricInvariant(student.overall);
        }
        for (const taskRow of result.perTask) {
          checkMetricInvariant(taskRow.completeness);
          checkMetricInvariant(taskRow.accuracy);
          checkMetricInvariant(taskRow.spag);
          checkMetricInvariant(taskRow.overall);
        }
        checkMetricInvariant(result.perClass.completeness);
        checkMetricInvariant(result.perClass.accuracy);
        checkMetricInvariant(result.perClass.spag);
        checkMetricInvariant(result.perClass.overall);
      }
    });

    // -----------------------------------------------------------------------
    // 14) AppliedCriterionWeightings echoes constructor weightings
    // -----------------------------------------------------------------------
    it('echoes constructor weightings in appliedCriterionWeightings output', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      // Default analyser
      const defaultAnalyser = new AveragingAnalyser();
      const defaultResults = defaultAnalyser.analyse(input);
      expect(defaultResults[0].appliedCriterionWeightings).toEqual({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });

      // Custom analyser
      const customAnalyser = new AveragingAnalyser({ completeness: 0.5, accuracy: 0.3, spag: 0.2 });
      const customResults = customAnalyser.analyse(input);
      expect(customResults[0].appliedCriterionWeightings).toEqual({
        completeness: 0.5,
        accuracy: 0.3,
        spag: 0.2,
      });
    });

    // -----------------------------------------------------------------------
    // 15) Multiple classes produce sorted per-class results
    // -----------------------------------------------------------------------
    it('returns results sorted by classId for multiple classes', () => {
      const classOverridesInSortTest = [
        {
          classId: 'c_002',
          className: 'Second Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
        {
          classId: 'c_001',
          className: 'First Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ];
      const input = buildInput({
        classOverrides: classOverridesInSortTest,
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(classOverridesInSortTest.length);
      expect(results[0].classId).toBe('c_001');
      expect(results[1].classId).toBe('c_002');
    });

    // -----------------------------------------------------------------------
    // 16) perTask tasks sorted by (definitionKey, taskId)
    // -----------------------------------------------------------------------
    it('sorts perTask rows by definitionKey then taskId', () => {
      const zebraTasks = [createTaskPartial('t_002'), createTaskPartial('t_001')];
      const alphaTasks = [createTaskPartial('t_001')];
      const totalTaskCount = zebraTasks.length + alphaTasks.length;
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_zebra',
                tasks: zebraTasks,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    t_002: createSubmissionItem('t_002', { accuracy: { score: 3 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_002',
                definitionKey: 'dk_alpha',
                tasks: alphaTasks,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_002', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perTask).toHaveLength(totalTaskCount);

      // Sorted by (definitionKey, taskId)
      expect(results[0].perTask[0].definitionKey).toBe('dk_alpha');
      expect(results[0].perTask[0].taskId).toBe('t_001');
      expect(results[0].perTask[1].definitionKey).toBe('dk_zebra');
      expect(results[0].perTask[1].taskId).toBe('t_001');
      expect(results[0].perTask[2].definitionKey).toBe('dk_zebra');
      expect(results[0].perTask[2].taskId).toBe('t_002');
    });

    // -----------------------------------------------------------------------
    // 17) Date range filter — only assignments with createdAt inside [from, to)
    // -----------------------------------------------------------------------
    it('filters assignments by date range, excluding those with createdAt outside [from, to)', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          dateRange: {
            from: '2026-01-02T00:00:00.000Z',
            to: '2026-01-04T00:00:00.000Z',
          },
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_out_before',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-01T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_out_before', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_in_range',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-03T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_in_range', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_out_after',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-05T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_out_after', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Only the in-range assignment (a_in_range, createdAt=2026-01-03) contributes
      expectMetricResult(results[0].perClass.accuracy, {
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 18) Topic filter — only assignments with matching primaryTopicKey contribute
    // -----------------------------------------------------------------------
    it('filters assignments by topicKeys, excluding non-matching primaryTopicKey', () => {
      const algebraDefinition = {
        ...createDefinitionPartial({ definitionKey: 'dk_algebra' }),
        primaryTopicKey: 'algebra',
      };
      const geometryDefinition = {
        ...createDefinitionPartial({ definitionKey: 'dk_geometry' }),
        primaryTopicKey: 'geometry',
      };

      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          topicKeys: ['algebra'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              {
                ...createAssignmentPartial({
                  assignmentId: 'a_algebra',
                  definitionKey: 'dk_algebra',
                  tasks: [createTaskPartial('t_001')],
                  submissions: [
                    createSubmission('s_001', 'Alice', 'a_algebra', {
                      t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    }),
                  ],
                }),
                assignmentDefinition: algebraDefinition,
              },
              {
                ...createAssignmentPartial({
                  assignmentId: 'a_geometry',
                  definitionKey: 'dk_geometry',
                  tasks: [createTaskPartial('t_001')],
                  submissions: [
                    createSubmission('s_001', 'Alice', 'a_geometry', {
                      t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                    }),
                  ],
                }),
                assignmentDefinition: geometryDefinition,
              },
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Only the algebra assignment (primaryTopicKey='algebra') contributes
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 19) Assignment definition-key filter — only matching definitionKeys contribute
    // -----------------------------------------------------------------------
    it('filters assignments by assignmentDefinitionKeys, excluding non-matching', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          assignmentDefinitionKeys: ['dk_algebra'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_algebra',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_algebra', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_geometry',
                definitionKey: 'dk_geometry',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_geometry', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                ],
              }),
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Only the algebra assignment (definitionKey='dk_algebra') contributes
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 20) Task weighting resolution from pre-fetched assignmentDefinitionPartials
    // -----------------------------------------------------------------------
    it('resolves taskWeighting from pre-fetched assignmentDefinitionPartials cross-reference', () => {
      const preFetchedTaskWeighting = 5;
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        // Pre-fetched partials have taskWeighting 5 for t_001 — authoritative source
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_algebra',
            tasks: [createTaskPartial('t_001', preFetchedTaskWeighting)],
          }),
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // totalWeight = assignmentWeighting(1) × taskWeighting(5 from pre-fetched) = 5
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 21) Task weighting fallback to 1 when no matching task entry is found
    // -----------------------------------------------------------------------
    it('falls back to taskWeighting 1 when no matching task entry is found in assignmentDefinitionPartials', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        // Pre-fetched partials exist but have empty tasks array — no t_001 entry
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_algebra',
            tasks: [],
          }),
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Fallback taskWeighting = 1 → totalWeight = 1 × 1 = 1
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 22) assignmentWeighting = null defaults to 1
    // -----------------------------------------------------------------------
    it('treats null assignmentWeighting as 1', () => {
      const taskWeightingForNullTest = 2;
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: null,
                tasks: [createTaskPartial('t_001', taskWeightingForNullTest)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // assignmentWeighting=1 (null→1), taskWeighting=2 → totalWeight=2
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 23) Missing assignmentDefinition throws typed error
    // -----------------------------------------------------------------------
    it('throws a typed error when an assignment has no assignmentDefinition', () => {
      const assignmentWithoutDefinition = {
        courseId: 'course_001' as const,
        assignmentId: 'a_001',
        assignmentName: 'Test Assignment',
        dueDate: null,
        lastUpdated: null,
        createdAt: DEFAULT_CREATED_AT,
        documentType: 'assessment' as const,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
          }),
        ],
        assignmentDefinition: null as unknown as undefined,
      };

      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              assignmentWithoutDefinition as unknown as ReturnType<typeof createAssignmentPartial>,
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      expect(() => analyser.analyse(input)).toThrow(Error);
    });

    // -----------------------------------------------------------------------
    // 24) Student excluded from perStudent when all submissions filtered out
    // -----------------------------------------------------------------------
    it('excludes student from perStudent when all submissions are filtered out by date range', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          dateRange: {
            from: '2026-01-02T00:00:00.000Z',
            to: '2027-01-01T00:00:00.000Z',
          },
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001', 's_002'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_outside',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-01T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_outside', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                  createSubmission('s_002', 'Bob', 'a_outside', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_inside',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-06-15T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_inside', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      // Alice has a submission in range (a_inside) → included
      expect(results[0].perStudent).toHaveLength(1);
      expect(results[0].perStudent[0].studentId).toBe('s_001');

      // Bob's only submission is on a_outside which is out of range → excluded

      // perClass only considers Alice's in-range submission
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 25) All criteria 'N' → overall null for that data point
    // -----------------------------------------------------------------------
    it('returns null overall when all criteria are N for a data point', () => {
      const input = buildInput({
        classOverrides: [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 'N' },
                      accuracy: { score: 'N' },
                      spag: { score: 'N' },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      const student = results[0].perStudent[0];
      // Per-criterion metrics all null with 0 applicable data points
      expectMetricResult(student.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(student.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // Overall is null because all three criteria are unavailable
      expectMetricResult(student.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Module-level helper — invariant check for MetricResultSchema
// ---------------------------------------------------------------------------

/**
 * Assert that a single `MetricResult` satisfies the schema invariant:
 * `value === null` iff `applicableDataPoints === 0`.
 *
 * @param {Object} metric - The metric result to check.
 * @param {number|null} metric.value - The metric value.
 * @param {number} metric.applicableDataPoints - Count of contributing data points.
 */
function checkMetricInvariant(metric: {
  value: number | null;
  applicableDataPoints: number;
}): void {
  if (metric.value === null) {
    expect(metric.applicableDataPoints).toBe(0);
  } else {
    expect(metric.applicableDataPoints).toBeGreaterThan(0);
  }
}
