/**
 * Cross-fetch parity test for `buildCellPreviewLookup`.
 *
 * Pins the inter-fetch invariant that the composite lookup inner keys produced
 * from a `getAssignment`-shaped `AssignmentFull` match the `taskKey`s that
 * `adaptMetricsToHeatmap` derives from a *separate* `getABClass`-shaped
 * `ClassFull` for the SAME assignment.
 *
 * The two fixtures are INDEPENDENT payloads (different shapes, different
 * endpoints) and must not be the same object — this exercises the real
 * cross-fetch contract (see SPEC.md §"Current data-shape constraints" and
 * ABClassResponseMapper.js:88), not a single-payload self-comparison.
 */

import { describe, it, expect } from 'vitest';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import { adaptMetricsToHeatmap } from '../../services/dataAnalysis/heatmapAdapter';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

const DEFINITION_KEY = 'def-xyz';
const ASSIGNMENT_ID = 'a-1';
const CLASS_ID = 'class-xyz';
const STUDENT_ID = 's-1';
const TASK_A = 't-a';
const TASK_B = 't-b';

const DEFAULT_DATE = '2026-01-01T00:00:00.000Z';

const BASE_ARTIFACT_FIELDS = {
  role: 'student',
  pageId: 'pg-1',
  documentId: 'doc-1',
  uid: 'uid-1',
  contentHash: null as string | null,
  metadata: {},
};

const COMPUTED_5 = createComputedMetricResult({ value: 5 });
const COMPUTED_4 = createComputedMetricResult({ value: 4 });
const COMPUTED_3 = createComputedMetricResult({ value: 3 });

// Independent fixture 1: a getABClass-shaped ClassFull for the same assignment.
const classFullFixture: ClassFull = {
  classId: CLASS_ID,
  className: 'Class XYZ',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: null,
  classOwner: null,
  teachers: [],
  students: [{ id: STUDENT_ID, name: 'Student One', email: 's1@test.com' }],
  assignments: [
    {
      assignmentId: ASSIGNMENT_ID,
      dueDate: null,
      updatedAt: null,
      createdAt: DEFAULT_DATE,
      documentType: 'assessment',
      submissions: [],
      assignmentDefinitionKey: DEFINITION_KEY,
    },
  ],
  active: null,
};

// Independent fixture 2: a getAssignment-shaped AssignmentFull for the SAME assignment.
const assignmentFullFixture: AssignmentFull = {
  courseId: CLASS_ID,
  assignmentId: ASSIGNMENT_ID,
  assignmentName: 'Assignment XYZ',
  dueDate: null,
  updatedAt: null,
  createdAt: DEFAULT_DATE,
  documentType: 'assessment',
  referenceDocumentId: null,
  templateDocumentId: null,
  tasks: null,
  submissions: [
    {
      studentId: STUDENT_ID,
      studentName: 'Student One',
      assignmentId: ASSIGNMENT_ID,
      documentId: null,
      items: {
        'item-a': {
          id: 'item-a',
          taskId: TASK_A,
          artifact: {
            ...BASE_ARTIFACT_FIELDS,
            type: 'TEXT' as const,
            content: 'Response A',
            taskId: TASK_A,
          },
          assessments: { completeness: { score: 5, reasoning: 'A reasoning' } },
          feedback: {},
        },
        'item-b': {
          id: 'item-b',
          taskId: TASK_B,
          artifact: {
            ...BASE_ARTIFACT_FIELDS,
            type: 'TEXT' as const,
            content: 'Response B',
            taskId: TASK_B,
          },
          assessments: { completeness: { score: 4, reasoning: 'B reasoning' } },
          feedback: {},
        },
      },
      createdAt: DEFAULT_DATE,
      updatedAt: DEFAULT_DATE,
    },
  ],
  assignmentDefinition: {
    primaryTitle: 'Assignment XYZ',
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
    definitionKey: DEFINITION_KEY,
    tasks: {},
    createdAt: DEFAULT_DATE,
    updatedAt: DEFAULT_DATE,
  },
};

// Warm-up partials consumed by adaptMetricsToHeatmap for column resolution.
const assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse = [
  {
    primaryTitle: 'Assignment XYZ',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'assignment',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    definitionKey: DEFINITION_KEY,
    tasks: [
      { taskId: TASK_A, taskWeighting: 1, taskTitle: 'Task A' },
      { taskId: TASK_B, taskWeighting: 1, taskTitle: 'Task B' },
    ],
    createdAt: DEFAULT_DATE,
    updatedAt: null,
  },
];

// Analyser result carrying per-(student, task) metrics keyed by composite taskKey.
const analyserResultFixture: AveragingResult = {
  classId: CLASS_ID,
  className: 'Class XYZ',
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
      classId: CLASS_ID,
      studentId: STUDENT_ID,
      taskKey: `${DEFINITION_KEY}::${TASK_A}`,
      completeness: COMPUTED_5,
      accuracy: COMPUTED_4,
      spag: COMPUTED_3,
      overall: COMPUTED_4,
    },
    {
      classId: CLASS_ID,
      studentId: STUDENT_ID,
      taskKey: `${DEFINITION_KEY}::${TASK_B}`,
      completeness: COMPUTED_5,
      accuracy: COMPUTED_4,
      spag: COMPUTED_3,
      overall: COMPUTED_4,
    },
  ],
};

describe('buildCellPreviewLookup cross-fetch parity', () => {
  it('produces lookup inner keys identical to the embedded heatmap column taskKeys for the same assignment', () => {
    const lookup = buildCellPreviewLookup(assignmentFullFixture);
    const heatmap = adaptMetricsToHeatmap(
      analyserResultFixture,
      classFullFixture,
      ASSIGNMENT_ID,
      assignmentDefinitionPartials
    );

    const expectedTaskKeys = new Set(heatmap.taskColumns.map((column) => column.taskKey));
    const actualTaskKeys = new Set(lookup.get(STUDENT_ID)?.keys());

    // The two independent fixtures must agree on the composite key set.
    expect(actualTaskKeys).toEqual(expectedTaskKeys);
    expect([...expectedTaskKeys]).toEqual([
      `${DEFINITION_KEY}::${TASK_A}`,
      `${DEFINITION_KEY}::${TASK_B}`,
    ]);
  });
});
