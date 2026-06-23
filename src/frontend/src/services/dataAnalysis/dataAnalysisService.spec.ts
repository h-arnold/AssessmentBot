import { describe, it, expect } from 'vitest';
import { DataAnalysisService } from './dataAnalysisService';
import {
  DataAnalysisResponseSchema,
  type AveragingAnalyserInput,
  type DataAnalysisResponse,
} from './dataAnalysis.zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed ISO timestamp used as the default `createdAt` value in fixtures. */
const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Fixture builders — produce minimal structurally-valid data shapes
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
 * @param {string} [overrides.definitionKey='dk_algebra'] - The definition key.
 * @param {number|null} [overrides.assignmentWeighting=1] - The assignment weighting.
 * @param {Array<{id: string, taskWeighting: number}>} [overrides.tasks] - Task partials.
 * @param {string} [overrides.primaryTopicKey='algebra'] - The primary topic key.
 * @returns {Object} A minimal assignment-definition-partial fixture.
 */
function createDefinitionPartial(
  overrides: Partial<{
    definitionKey: string;
    assignmentWeighting: number | null;
    tasks: Array<{ id: string; taskWeighting: number }>;
    primaryTopicKey: string;
  }> = {}
) {
  const {
    definitionKey = 'dk_algebra',
    assignmentWeighting = 1,
    tasks = [createTaskPartial('t_001')],
    primaryTopicKey = 'algebra',
  } = overrides;

  return {
    primaryTitle: 'Test',
    primaryTopic: 'Algebra',
    primaryTopicKey,
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
    createdAt: DEFAULT_CREATED_AT,
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
 * @param {string} [overrides.primaryTopicKey='algebra'] - The primary topic key.
 * @returns {Object} A minimal AssignmentPartial-shaped object.
 */
function createAssignmentPartial(overrides: {
  assignmentId: string;
  definitionKey: string;
  submissions: ReturnType<typeof createSubmission>[];
  tasks: Array<{ id: string; taskWeighting: number }>;
  assignmentWeighting?: number | null;
  createdAt?: string;
  primaryTopicKey?: string;
}) {
  const {
    assignmentId,
    definitionKey,
    submissions,
    tasks,
    assignmentWeighting = 1,
    createdAt = DEFAULT_CREATED_AT,
    primaryTopicKey = 'algebra',
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
      primaryTopicKey,
    }),
  };
}

/**
 * Build a minimal class-full fixture.
 *
 * @param {Object} overrides - Required class overrides with optional fields.
 * @param {string} overrides.classId - The class identifier.
 * @param {string|null} [overrides.className='Test Class'] - The class display name.
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
    students: studentIds.map((id) => ({
      id,
      name: `Student ${id}`,
      email: `${id}@test.com`,
    })),
    assignments,
    active: null,
  };
}

/**
 * Build a minimal `AveragingAnalyserInput` from partial overrides.
 *
 * @param {Array<Object>} classOverrides - Per-class override entries.
 * @param {Object} classOverrides[].classId - The class identifier.
 * @param {string|null} [classOverrides[].className] - The class display name.
 * @param {Array<string>} [classOverrides[].studentIds] - Student identifiers.
 * @param {Array<Object>} classOverrides[].assignments - Assignment partials.
 * @param {Object} [additionalOverrides] - Additional AveragingAnalyserInput overrides.
 * @returns {Object} A structurally valid AveragingAnalyserInput.
 */
function buildInput(
  classOverrides: Array<{
    classId: string;
    className?: string | null;
    studentIds?: string[];
    assignments: ReturnType<typeof createAssignmentPartial>[];
  }>,
  additionalOverrides?: Partial<AveragingAnalyserInput>
): AveragingAnalyserInput {
  const classIds = classOverrides.map((c) => c.classId);
  const classes = classOverrides.map((c) => createClassFull(c));
  const allDefinitionPartials = classes.flatMap((c) =>
    c.assignments.map((a) => a.assignmentDefinition)
  );

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
      additionalOverrides?.assignmentDefinitionPartials ?? uniqueDefinitionPartials,
    ...additionalOverrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataAnalysisService', () => {
  describe('analyse', () => {
    // -----------------------------------------------------------------------
    // 1) Valid input returns a non-null array of AveragingResult
    // -----------------------------------------------------------------------
    it('returns a non-null array of AveragingResult for valid input', () => {
      const input = buildInput([
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
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results).not.toBeNull();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].classId).toBe('c_001');
    });

    // -----------------------------------------------------------------------
    // 2) Result passes DataAnalysisResponseSchema.parse() round-trip
    // -----------------------------------------------------------------------
    it('result passes DataAnalysisResponseSchema.parse() round-trip', () => {
      const input = buildInput([
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
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      // Should not throw
      const parsed = DataAnalysisResponseSchema.parse(results) as DataAnalysisResponse;
      expect(parsed).toEqual(results);
    });

    // -----------------------------------------------------------------------
    // 3) Invalid input (missing filter) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when input is missing the filter field', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          assignments: [],
        },
      ]);
      const invalidInput = {
        ...input,
        filter: undefined as unknown as AveragingAnalyserInput['filter'],
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 4) appliedCriterionWeightings echoes constructor defaults
    // -----------------------------------------------------------------------
    it('appliedCriterionWeightings echoes defaults (0.4, 0.4, 0.2) when no custom filtering', () => {
      const input = buildInput([
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
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results[0].appliedCriterionWeightings).toEqual({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });
    });

    // -----------------------------------------------------------------------
    // 5) Invalid filter (empty classIds) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.classIds is an empty array', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = { ...input, filter: { classIds: [] } };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 6) Invalid filter (dateRange.from > to) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.dateRange.from is after to', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = {
        ...input,
        filter: {
          classIds: ['c_001'],
          dateRange: { from: '2026-06-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
        },
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 7) Invalid filter (criterionWeightings not summing to 1.0) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.criterionWeightings do not sum to 1.0', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = {
        ...input,
        filter: {
          classIds: ['c_001'],
          criterionWeightings: { completeness: 1, accuracy: 1, spag: 1 },
        },
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 8) Unregistered analyser key throws typed Error
    // -----------------------------------------------------------------------
    it('throws a typed Error when an unregistered analyser key is requested', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          assignments: [],
        },
      ]);

      const service = new DataAnalysisService();

      expect(() => service.analyse(input, 'bogusAnalyser')).toThrow(
        'Unknown analyser key: bogusAnalyser'
      );
    });

    // -----------------------------------------------------------------------
    // 9) Result array is sorted by classId
    // -----------------------------------------------------------------------
    it('returns results sorted by classId ascending', () => {
      const CLASS_COUNT = 2;

      const input = buildInput([
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
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
        {
          classId: 'c_001',
          className: 'First Class',
          studentIds: ['s_002'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_002',
              definitionKey: 'dk_geometry',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_002', 'Bob', 'a_002', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results).toHaveLength(CLASS_COUNT);
      expect(results[0].classId).toBe('c_001');
      expect(results[1].classId).toBe('c_002');
    });
  });
});
