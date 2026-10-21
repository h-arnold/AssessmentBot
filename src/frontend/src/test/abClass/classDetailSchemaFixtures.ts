/**
 * Shared wire-schema fixtures for the class-detail and class-partial Zod suites.
 *
 * These are the characterised fixtures from the original single
 * `classDetailService.zod.spec.ts` file, moved verbatim into a shared test
 * selector module so the split schema suites (full/assignment/teacher,
 * submission/artifact and definition suites) parse identical wire data.
 *
 * These focused wire-shape fixtures carry the required class metadata as a
 * detached canonical snapshot. Deliberately invalid or boundary payloads stay
 * local to the suites that clone these objects.
 *
 * Callers that need to mutate a fixture must spread/clone it as the suites
 * already do; the shared objects must never be mutated in place.
 */

import { CANONICAL_NON_NULL_METADATA } from '@/test/abClass/abClassMetadataFixtures';

export const validStudentSummary = {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  id: 'student-1',
};

export const validBaseTaskArtifactPartial = {
  taskId: 'task-1',
  role: 'student',
  pageId: 'slide-5',
  documentId: 'doc-abc',
  metadata: { slideOrder: 3 },
  uid: 'uid-artifact-1',
  type: 'slides',
};

export const validStudentSubmissionItemPartial = {
  id: 'sub-1',
  taskId: 'task-1',
  artifact: validBaseTaskArtifactPartial,
  assessments: {
    accuracy: { score: 4 },
    completeness: { score: 5 },
  },
  feedback: { comment: 'Great effort' },
};

export const validStudentSubmissionPartial = {
  studentId: 'student-1',
  studentName: 'Alice Johnson',
  assignmentId: 'assign-1',
  documentId: 'doc-abc',
  items: { 'task-1': validStudentSubmissionItemPartial },
  createdAt: '2025-05-01T08:00:00.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
};

export const validAssignmentDefinitionPartial = {
  primaryTitle: 'Algebra Baseline',
  primaryTopic: 'Algebra',
  primaryTopicKey: 'algebra',
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: ['Algebra Basics v2'],
  alternateTopics: ['Linear Equations'],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-doc-123',
  templateDocumentId: 'template-doc-456',
  assignmentWeighting: 1,
  definitionKey: 'algebra-baseline',
  tasks: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-05-01T00:00:00.000Z',
};

export const validAssignmentPartial = {
  assignmentId: 'assign-1',
  dueDate: '2025-06-01T23:59:59.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
  createdAt: '2025-05-01T08:00:00.000Z',
  documentType: 'SLIDES',
  submissions: [validStudentSubmissionPartial], // Uses the new nested-dictionary shape
  assignmentDefinitionKey: 'algebra-baseline',
};

export const validClassFull = {
  classId: 'class-1',
  className: 'Mathematics 10A',
  cohortKey: 'cohort-2025',
  courseLength: 2,
  yearGroupKey: 'year-10',
  classOwner: {
    userId: 'owner-1',
    email: 'owner-1@example.com',
    teacherName: 'Dr Smith',
  },
  teachers: [
    {
      userId: 'teacher-1',
      email: 'teacher-1@example.com',
      teacherName: 'Ms Example',
    },
  ],
  students: [validStudentSummary],
  assignments: [validAssignmentPartial],
  active: true,
  // Required class metadata carried as a detached clone of the canonical
  // realistic snapshot, so this wire fixture reflects the adopted read contract.
  metadata: structuredClone(CANONICAL_NON_NULL_METADATA),
};
