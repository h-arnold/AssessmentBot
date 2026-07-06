/**
 * Shared data-analysis test fixtures.
 *
 * Used by `averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts` to
 * build minimal structurally-valid data shapes for analysis tests.
 *
 * @module test/dataAnalysis/fixtures
 * @see docs/developer/frontend/frontend-testing.md §"Shared test helpers"
 */

import type {
  AveragingAnalyserInput,
  MetricResult,
} from '../../services/dataAnalysis/dataAnalysis.zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed ISO timestamp used as the default `createdAt` value in fixtures. */
export const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// MetricResult builders — produce discriminated-union MetricResult shapes
// ---------------------------------------------------------------------------

/**
 * Build a MetricResult fixture of the specified state.
 *
 * @remarks
 * This is the primary builder for MetricResult fixtures. The per-state
 * convenience wrappers (`createComputedMetricResult`, etc.) delegate to
 * this function for backward compatibility.
 *
 * @param {('computed' | 'notAttempted' | 'error')} state - The metric result state.
 * @param {Object} [overrides] - Optional field overrides (state-dependent).
 * @returns {MetricResult} A MetricResult fixture of the requested state.
 */
export function createMetricResult(
  state: 'computed' | 'notAttempted' | 'error',
  overrides?: Partial<{
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }>
): MetricResult {
  switch (state) {
    case 'computed': {
      return {
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'notAttempted': {
      return {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0 as const,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'error': {
      return {
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 0 as const,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    default: {
      throw new Error(`Unknown MetricResult state: ${state}`);
    }
  }
}

/**
 * Build a `computed` MetricResult fixture.
 *
 * Delegates to {@link createMetricResult}.
 *
 * @param {Partial<{ value: number; totalWeight: number; applicableDataPoints: number; totalDataPoints: number }>} [overrides] - Optional field overrides.
 * @returns {MetricResult} A computed MetricResult.
 */
export function createComputedMetricResult(
  overrides?: Partial<{
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }>
): MetricResult {
  return createMetricResult('computed', overrides);
}

/**
 * Build a `notAttempted` MetricResult fixture.
 *
 * Delegates to {@link createMetricResult}.
 *
 * @param {Partial<{ totalWeight: number; totalDataPoints: number }>} [overrides] - Optional field overrides.
 * @returns {MetricResult} A notAttempted MetricResult.
 */
export function createNotAttemptedMetricResult(
  overrides?: Partial<{
    totalWeight: number;
    totalDataPoints: number;
  }>
): MetricResult {
  return createMetricResult('notAttempted', overrides);
}

/**
 * Build an `error` MetricResult fixture.
 *
 * Delegates to {@link createMetricResult}.
 *
 * @param {Partial<{ totalWeight: number; totalDataPoints: number }>} [overrides] - Optional field overrides.
 * @returns {MetricResult} An error MetricResult.
 */
export function createErrorMetricResult(
  overrides?: Partial<{
    totalWeight: number;
    totalDataPoints: number;
  }>
): MetricResult {
  return createMetricResult('error', overrides);
}

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
export function createTaskPartial(id: string, taskWeighting: number = 1) {
  return { id, taskWeighting };
}

/**
 * Build a minimal `AssignmentDefinitionPartial`-shaped object for test use.
 *
 * @param {Object} [overrides] - Optional overrides.
 * @param {string} [overrides.definitionKey='dk_algebra'] - The definition key.
 * @param {number|null} [overrides.assignmentWeighting=1] - The assignment weighting.
 * @param {Array<{id: string, taskWeighting: number}>} [overrides.tasks] - Task partials.
 * @param {string} [overrides.createdAt] - ISO creation timestamp.
 * @param {string} [overrides.primaryTopicKey='algebra'] - The primary topic key.
 * @returns {Object} A minimal assignment-definition-partial fixture.
 */
export function createDefinitionPartial(
  overrides: Partial<{
    definitionKey: string;
    assignmentWeighting: number | null;
    tasks: Array<{ id: string; taskWeighting: number }>;
    createdAt: string;
    primaryTopicKey: string;
  }> = {}
) {
  const {
    definitionKey = 'dk_algebra',
    assignmentWeighting = 1,
    tasks = [createTaskPartial('t_001')],
    createdAt = DEFAULT_CREATED_AT,
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
export function createSubmissionItem(
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
export function createSubmission(
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
export function createAssignmentPartial(overrides: {
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
    updatedAt: null,
    createdAt,
    documentType: 'assessment',
    submissions,
    assignmentDefinition: createDefinitionPartial({
      definitionKey,
      assignmentWeighting,
      tasks,
      createdAt,
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
export function createClassFull(overrides: {
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
 * @param {Array<Object>} classOverrides - Per-class override entries.
 * @param {Object} [additionalOverrides] - Additional AveragingAnalyserInput overrides.
 * @returns {Object} A structurally valid AveragingAnalyserInput.
 */
export function buildInput(
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
      additionalOverrides?.assignmentDefinitionPartials ?? uniqueDefinitionPartials,
    ...additionalOverrides,
  };
}
