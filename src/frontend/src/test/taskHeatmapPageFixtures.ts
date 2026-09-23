import { QueryClient } from '@tanstack/react-query';
import type { AveragingResult } from '../services/dataAnalysis/dataAnalysis.zod';
import type { AssignmentFull } from '../services/assignmentAssessment/assignmentAssessment.zod';
import type { ClassFull } from '../services/googleClassrooms/classDetail/classDetailService.zod';
import { createComputedMetricResult } from './dataAnalysis/fixtures';

/**
 * Creates a fresh QueryClient for TaskHeatmapPage test isolation.
 *
 * @returns {QueryClient} A test QueryClient with retries disabled.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Builds a minimal schema-valid `AssignmentFull` fixture for the default mock value.
 *
 * @returns {AssignmentFull} A valid assignment with no submissions.
 */
export function buildDefaultAssignmentFixture(): AssignmentFull {
  return {
    courseId: 'class-1',
    assignmentId: 'a-1',
    assignmentName: 'Assignment One',
    dueDate: null,
    updatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    documentType: 'assessment',
    referenceDocumentId: null,
    templateDocumentId: null,
    tasks: null,
    submissions: [],
    assignmentDefinition: {
      primaryTitle: 'Assignment One',
      primaryTopic: null,
      primaryTopicKey: null,
      yearGroupKey: 'yg-10',
      yearGroupLabel: null,
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'assessment',
      referenceDocumentId: null,
      templateDocumentId: null,
      referenceLastModified: null,
      templateLastModified: null,
      assignmentWeighting: 1,
      definitionKey: 'def-1',
      tasks: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

/** Shared computed MetricResults used by the student's per-task criteria. */
export const COMPUTED_5 = createComputedMetricResult({ value: 5 });
export const COMPUTED_4 = createComputedMetricResult({ value: 4 });
export const COMPUTED_3 = createComputedMetricResult({ value: 3 });

/**
 * A valid assignment-definition partial matching 'def-1' for heatmap task titles.
 */
export const VALID_ASSIGNMENT_PARTIAL = {
  primaryTitle: 'Assignment One',
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
  definitionKey: 'def-1',
  tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task One' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};

/** A ClassFull fixture with one student and one assignment (definitionKey 'def-1'). */
export const classFullFixture: ClassFull = {
  classId: 'class-1',
  className: 'Class A',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: null,
  classOwner: null,
  teachers: [],
  students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
  assignments: [
    {
      assignmentId: 'a-1',
      dueDate: null,
      updatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      documentType: 'assessment',
      submissions: [],
      assignmentDefinitionKey: 'def-1',
    },
  ],
  active: null,
};

/** An AveragingResult fixture with one perStudentTaskMetric. */
export const analyserResultFixture: AveragingResult = {
  classId: 'class-1',
  className: 'Class A',
  perStudent: [],
  perTask: [],
  perClass: {
    completeness: COMPUTED_5,
    accuracy: COMPUTED_4,
    spag: COMPUTED_3,
    overall: COMPUTED_4,
  },
  appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  perStudentTaskMetrics: [
    {
      classId: 'class-1',
      studentId: 's-1',
      taskKey: 'def-1::t-1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      completeness: COMPUTED_5,
      accuracy: COMPUTED_4,
      spag: COMPUTED_3,
      overall: COMPUTED_4,
    },
  ],
};
