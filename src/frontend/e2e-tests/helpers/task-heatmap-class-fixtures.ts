/**
 * Class-snapshot fixtures for the Task Heatmap browser journey.
 *
 * Owns the roster/submission score evidence, the submission item builders, and
 * the `getABClass` class document and second-assignment mutation. The whole
 * nullable class metadata snapshot is served from the shared canonical-backed
 * helpers in `class-metadata-fixtures` rather than being derived from this
 * fixture's own score map. Split from `task-heatmap-fixtures.ts` when the
 * required metadata snapshot joined the class document, so each fixture
 * responsibility keeps a sub-500-line module. Assignment/classroom/definition
 * builders and the shared identifiers stay in `task-heatmap-fixtures.ts`.
 */

import type { ABClassMetadata } from '@/services/abClass/abClassMetadata.zod';
import { createCanonicalNumericClassMetadata } from './class-metadata-fixtures';
import {
  HEATMAP_ASSIGNMENT_ID,
  HEATMAP_ASSIGNMENT_NAME,
  HEATMAP_CLASS_ID,
  HEATMAP_CLASS_NAME,
  HEATMAP_DEFINITION_KEY,
  HEATMAP_TASK_IDS,
} from './task-heatmap-fixtures';

type HeatmapStudent = Readonly<{ id: string; name: string }>;
type HeatmapTaskMetric = {
  completeness: number | string;
  accuracy: number | string;
  spag: number | string;
};
type HeatmapStudentScores = Record<string, HeatmapTaskMetric>;

const HEATMAP_STUDENTS: ReadonlyArray<HeatmapStudent> = [
  { id: '100000000004', name: 'Student One' },
  { id: '100000000005', name: 'Student Two' },
  { id: '100000000006', name: 'Student Three' },
  { id: '100000000007', name: 'Student Four' },
  { id: '100000000008', name: 'Student Five' },
  { id: '100000000009', name: 'Student Six' },
  { id: '100000000010', name: 'Student Seven' },
  { id: '100000000011', name: 'Student Eight' },
  { id: '100000000012', name: 'Student Nine' },
  { id: '100000000013', name: 'Student Ten' },
];

const HEATMAP_SUBMISSION_SCORES: Record<string, HeatmapStudentScores> = {
  '100000000004': {
    task_001: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000005': {
    task_001: { completeness: 5, accuracy: 3, spag: 4 },
    task_002: { completeness: 5, accuracy: 4, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 5 },
  },
  '100000000006': {
    task_001: { completeness: 5, accuracy: 3, spag: 4 },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000007': {
    task_001: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000008': {
    task_001: { completeness: 5, accuracy: 4, spag: 4 },
    task_002: { completeness: 3, accuracy: 3, spag: 3 },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000009': {
    task_001: { completeness: 5, accuracy: 1, spag: 2 },
    task_002: { completeness: 3, accuracy: 4, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 5 },
  },
  '100000000010': {
    task_001: { completeness: 4, accuracy: 3, spag: 2 },
    task_002: { completeness: 3, accuracy: 3, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 4 },
  },
  '100000000011': {
    task_001: { completeness: 5, accuracy: 2, spag: 4 },
    task_002: { completeness: 5, accuracy: 4, spag: 3 },
    task_003: { completeness: 3, accuracy: 2, spag: 4 },
  },
  '100000000012': {
    task_001: { completeness: 3, accuracy: 2, spag: 2 },
    task_002: { completeness: 3, accuracy: 2, spag: 2 },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000013': {
    task_001: { completeness: 4, accuracy: 2, spag: 2 },
    task_002: { completeness: 3, accuracy: 3, spag: 3 },
    task_003: { completeness: 0, accuracy: 0, spag: 0 },
  },
};

/**
 * Builds the whole nullable class metadata snapshot served with the fixture
 * class document.
 *
 * The snapshot is a detached clone of the committed canonical corpus metadata
 * shared through `class-metadata-fixtures`, so scenarios keep read-contract
 * fidelity without the fixture independently deriving averages from its own
 * submission score map. No browser journey asserts on snapshot values.
 *
 * @returns {ABClassMetadata} Detached canonical metadata snapshot.
 */
export function buildClassMetadataSnapshot(): ABClassMetadata {
  return createCanonicalNumericClassMetadata();
}

/**
 * Build one submission item for the class snapshot.
 * @param {HeatmapStudent} student - Student owning the item.
 * @param {(typeof HEATMAP_TASK_IDS)[number]} taskId - Task identifier.
 * @param {boolean} isEmpty - Whether to use not-attempted scores.
 * @returns {Record<string, unknown>} Submission item payload.
 */
function buildItem(
  student: HeatmapStudent,
  taskId: (typeof HEATMAP_TASK_IDS)[number],
  isEmpty: boolean
) {
  const fallback = { completeness: 'N', accuracy: 'N', spag: 'N' };
  const metrics = isEmpty
    ? fallback
    : (HEATMAP_SUBMISSION_SCORES[student.id]?.[taskId] ?? fallback);
  return {
    taskId,
    artifact: {
      taskId,
      role: 'submission',
      uid: `uid-${student.id}-${taskId}`,
      type: 'TEXT',
      pageId: `page-${student.id}-${taskId}`,
      documentId: `doc-${student.id}`,
      content: null,
      contentHash: null,
      metadata: {},
    },
    assessments: {
      completeness: { score: metrics.completeness },
      accuracy: { score: metrics.accuracy },
      spag: { score: metrics.spag },
    },
    feedback: {},
    id: `ssi-${student.id}-${taskId}`,
  };
}

/**
 * Builds one submission's task-item dictionary.
 * @param {HeatmapStudent} student - Student owning the submission.
 * @param {boolean} hasEmptySubmissions - Whether to use not-attempted scores.
 * @returns {Record<string, unknown>} Items keyed by task identifier.
 */
function buildSubmissionItems(
  student: HeatmapStudent,
  hasEmptySubmissions: boolean
): Record<string, unknown> {
  return Object.fromEntries(
    HEATMAP_TASK_IDS.map((taskId) => [taskId, buildItem(student, taskId, hasEmptySubmissions)])
  );
}

/**
 * Build the class snapshot returned by `getABClass`.
 *
 * The transport shape reflects the embedded-assignmentDefinition removal:
 * assignment details are resolved from the warm-up
 * `AssignmentDefinitionPartials` registry by `assignmentDefinitionKey`.
 * The class snapshot therefore deliberately carries the registry key rather
 * than an embedded definition object.
 * @param {boolean} hasEmptySubmissions - Whether submissions should be empty.
 * @returns {Record<string, unknown>} Class payload.
 */
export function buildClassFullDocument(hasEmptySubmissions: boolean): Record<string, unknown> {
  return {
    classId: HEATMAP_CLASS_ID,
    className: HEATMAP_CLASS_NAME,
    cohortKey: '00000000-0000-0000-0000-000000000001',
    courseLength: 1,
    yearGroupKey: '00000000-0000-0000-0000-000000000002',
    classOwner: {
      userId: '100000000002',
      email: 'teacher1@example.com',
      teacherName: 'Teacher A',
    },
    teachers: [],
    students: HEATMAP_STUDENTS.map((student) => {
      return {
        ...student,
        email: `${student.id}@example.com`,
      };
    }),
    assignments: [
      {
        assessmentContractVersion: 1,
        courseId: HEATMAP_CLASS_ID,
        assignmentId: HEATMAP_ASSIGNMENT_ID,
        assignmentName: HEATMAP_ASSIGNMENT_NAME,
        dueDate: null,
        updatedAt: '2026-07-07T07:51:13.282Z',
        createdAt: '2026-06-29T09:40:37.069Z',
        documentType: 'SLIDES',
        assignmentDefinitionKey: HEATMAP_DEFINITION_KEY,
        submissions: HEATMAP_STUDENTS.map((student) => {
          return {
            studentId: student.id,
            assignmentId: HEATMAP_ASSIGNMENT_ID,
            documentId: `doc-${student.id}`,
            studentName: student.name,
            items: buildSubmissionItems(student, hasEmptySubmissions),
            createdAt: '2026-07-07T07:49:23.014Z',
            updatedAt: '2026-07-07T07:49:29.872Z',
            _updateCounter: 0,
          };
        }),
      },
    ],
    active: true,
    metadata: buildClassMetadataSnapshot(),
  };
}

/**
 * Add a second assignment sharing the fixture definition.
 * @param {Record<string, unknown>} classDocument - Class payload to mutate.
 */
export function addSecondAssignment(classDocument: Record<string, unknown>): void {
  const assignments = classDocument.assignments as Array<Record<string, unknown>>;
  const firstAssignment = assignments[0];
  if (!firstAssignment) {
    throw new Error('Expected the heatmap fixture to contain an assignment.');
  }
  const secondAssignmentId = `${HEATMAP_ASSIGNMENT_ID}-2`;
  assignments.push({
    ...firstAssignment,
    assignmentId: secondAssignmentId,
    submissions: (firstAssignment.submissions as Array<Record<string, unknown>>).map(
      (submission) => {
        return {
          ...submission,
          assignmentId: secondAssignmentId,
        };
      }
    ),
  });
}
