import type { AveragingResult } from '../services/dataAnalysis/dataAnalysis.zod';
import type { AssignmentFull } from '../services/assignmentAssessment/assignmentAssessment.zod';
import type { ClassFull } from '../services/googleClassrooms/classDetail/classDetailService.zod';
import { createAssignmentPartial, createComputedMetricResult } from './dataAnalysis/fixtures';
import {
  createHeatmapClassFull,
  createHeatmapDefinitionPartial,
} from './dataAnalysis/heatmapFixtures';

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
export const VALID_ASSIGNMENT_PARTIAL = createHeatmapDefinitionPartial({
  definitionKey: 'def-1',
  primaryTitle: 'Assignment One',
  taskId: 't-1',
  taskTitle: 'Task One',
});

/** A ClassFull fixture with one student and one assignment (definitionKey 'def-1'). */
export const classFullFixture: ClassFull = createHeatmapClassFull({
  classId: 'class-1',
  className: 'Class A',
  yearGroupKey: null,
  assignments: [
    createAssignmentPartial({
      assignmentId: 'a-1',
      definitionKey: 'def-1',
      submissions: [],
    }),
  ],
  active: null,
});

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
