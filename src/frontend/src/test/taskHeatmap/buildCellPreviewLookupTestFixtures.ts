/**
 * Shared fixture primitives for the `buildCellPreviewLookup` spec family.
 *
 * Co-located with the other task-heatmap preview fixtures under
 * `src/test/taskHeatmap/`, and kept in a non-spec module so
 * `buildCellPreviewLookup.spec.ts`,
 * `buildCellPreviewLookup.content.spec.ts` and
 * `buildCellPreviewLookup.indexing.spec.ts` can import them without vitest
 * double-collecting the test files, and without each split suite growing its
 * own competing copy of the same assignment payload.
 */

import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';

export const DEFAULT_DATE = '2024-01-01T00:00:00.000Z';

/**
 * Base artifact fields shared by all artifact types (BaseTaskArtifactFields).
 * `taskId` is intentionally excluded here because it varies per item and is
 * always supplied inline.
 */
export const BASE_ARTIFACT_FIELDS = {
  role: 'student',
  pageId: 'pg-1',
  documentId: 'doc-1',
  uid: 'uid-1',
  contentHash: null as string | null,
  metadata: {},
};

/**
 * Minimal AssignmentDefinition that satisfies the Zod-mandated required
 * fields.  Most optional / nullable fields are set to `null` or default
 * values.
 */
const MINIMAL_ASSIGNMENT_DEFINITION = {
  primaryTitle: 'Test Assignment',
  primaryTopic: null,
  primaryTopicKey: null,
  yearGroupKey: 'yg-10',
  yearGroupLabel: null,
  alternateTitles: [],
  alternateTopics: [],
  documentType: null,
  referenceDocumentId: null,
  templateDocumentId: null,
  referenceLastModified: null,
  templateLastModified: null,
  assignmentWeighting: 1,
  definitionKey: 'test-def',
  tasks: {},
  createdAt: DEFAULT_DATE,
  updatedAt: DEFAULT_DATE,
};

/**
 * Build a minimal `AssignmentFull` with the given submissions.
 * All other fields get sensible defaults so each test only
 * specifies the data it cares about.
 *
 * @param {AssignmentFull['submissions']} submissions - The submissions to include in the assignment.
 * @returns {AssignmentFull} A minimal AssignmentFull object.
 */
export function createAssignment(submissions: AssignmentFull['submissions']): AssignmentFull {
  return {
    courseId: 'course-1',
    assignmentId: 'assignment-1',
    assignmentName: 'Test Assignment',
    dueDate: null,
    updatedAt: null,
    createdAt: DEFAULT_DATE,
    documentType: null,
    referenceDocumentId: null,
    templateDocumentId: null,
    tasks: null,
    submissions,
    assignmentDefinition: MINIMAL_ASSIGNMENT_DEFINITION,
  } as AssignmentFull;
}
