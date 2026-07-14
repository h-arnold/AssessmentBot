import { describe, expect, it } from 'vitest';
import {
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
  AssignmentFullSchema,
  AssignmentFullResponseSchema,
  GetAssignmentRequestSchema,
} from './assignmentAssessment.zod';

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

const validFullAssignment = {
  courseId: 'course-1',
  assignmentId: 'assign-1',
  assignmentName: 'Algebra Baseline',
  dueDate: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  documentType: 'QUIZ',
  referenceDocumentId: 'ref-1',
  templateDocumentId: 'tpl-1',
  tasks: {
    'task-1': {
      id: 'task-1',
      taskTitle: 'Task One',
      pageId: 'page-1',
      taskNotes: null,
      taskMetadata: null,
      taskWeighting: null,
      index: 0,
      artifacts: {
        reference: [
          {
            taskId: 'task-1',
            role: 'reference',
            pageId: 'page-1',
            documentId: 'doc-ref',
            content: null,
            contentHash: null,
            metadata: null,
            uid: 'uid-1',
            type: 'SLIDES',
          },
        ],
        template: [],
      },
    },
  },
  submissions: [
    {
      studentId: 'student-1',
      studentName: 'Student One',
      assignmentId: 'assign-1',
      documentId: 'doc-1',
      items: {
        'task-1': {
          id: 'item-1',
          taskId: 'task-1',
          artifact: {
            taskId: 'task-1',
            role: 'reference',
            pageId: 'page-1',
            documentId: 'doc-ref',
            content: null,
            contentHash: null,
            metadata: null,
            uid: 'uid-1',
            type: 'SLIDES',
          },
          assessments: {},
          feedback: {},
        },
      },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ],
  assignmentDefinition: {
    primaryTitle: 'Algebra',
    primaryTopic: 'algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-1',
    yearGroupLabel: 'Year 1',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'QUIZ',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    referenceLastModified: '2026-04-01T00:00:00.000Z',
    templateLastModified: '2026-04-01T00:00:00.000Z',
    assignmentWeighting: null,
    definitionKey: 'def-1',
    tasks: {
      'task-1': {
        id: 'task-1',
        taskTitle: 'Task One',
        pageId: 'page-1',
        taskNotes: null,
        taskMetadata: null,
        taskWeighting: null,
        index: 0,
        artifacts: {
          reference: [
            {
              taskId: 'task-1',
              role: 'reference',
              pageId: 'page-1',
              documentId: 'doc-ref',
              content: null,
              contentHash: null,
              metadata: null,
              uid: 'uid-1',
              type: 'SLIDES',
            },
          ],
          template: [],
        },
      },
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
};

describe('assignmentAssessment.zod schemas', () => {
  describe('StartAssessmentRunRequestSchema', () => {
    it('accepts a valid request with definitionKey, assignmentId, and courseId', () => {
      expect(StartAssessmentRunRequestSchema.parse(validStartAssessmentRunRequest)).toEqual(
        validStartAssessmentRunRequest
      );
    });

    it('rejects a request with missing definitionKey', () => {
      expect(() =>
        StartAssessmentRunRequestSchema.parse({
          assignmentId: 'assign-123',
          courseId: 'course-456',
        })
      ).toThrow();
    });

    it('rejects a request with non-string assignmentId', () => {
      expect(() =>
        StartAssessmentRunRequestSchema.parse({
          definitionKey: 'algebra-baseline',
          assignmentId: 123,
          courseId: 'course-456',
        })
      ).toThrow();
    });
  });

  describe('StartAssessmentRunResponseSchema', () => {
    it('accepts null data', () => {
      expect(StartAssessmentRunResponseSchema.parse(null)).toBeNull();
    });

    it('rejects non-null data', () => {
      expect(() => StartAssessmentRunResponseSchema.parse({ success: true })).toThrow();
      expect(() => StartAssessmentRunResponseSchema.parse('string')).toThrow();
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(() => StartAssessmentRunResponseSchema.parse(42)).toThrow();
    });
  });

  describe('AssignmentFullSchema', () => {
    it('accepts the canonical valid full assignment payload', () => {
      expect(AssignmentFullSchema.parse(validFullAssignment)).toEqual(validFullAssignment);
    });

    it('rejects a payload missing referenceDocumentId and templateDocumentId (partial-like shape)', () => {
      const incompletePayload = { ...validFullAssignment };
      delete (incompletePayload as Record<string, unknown>).referenceDocumentId;
      delete (incompletePayload as Record<string, unknown>).templateDocumentId;
      expect(() => AssignmentFullSchema.parse(incompletePayload)).toThrow();
    });

    it('rejects an array-valued tasks field', () => {
      const payloadWithArrayTasks = {
        ...validFullAssignment,
        tasks: [
          {
            id: 'task-1',
            taskTitle: 'Task One',
            pageId: 'page-1',
            taskNotes: null,
            taskMetadata: null,
            taskWeighting: null,
            index: 0,
            artifacts: { reference: [], template: [] },
          },
        ],
      };
      expect(() => AssignmentFullSchema.parse(payloadWithArrayTasks)).toThrow();
    });
  });

  describe('AssignmentFullResponseSchema', () => {
    it('accepts null', () => {
      expect(AssignmentFullResponseSchema.parse(null)).toBeNull();
    });
  });

  describe('GetAssignmentRequestSchema', () => {
    it('rejects a params object missing courseId', () => {
      expect(() => GetAssignmentRequestSchema.parse({ assignmentId: 'assign-1' })).toThrow();
    });

    it('rejects a params object missing assignmentId', () => {
      expect(() => GetAssignmentRequestSchema.parse({ courseId: 'course-1' })).toThrow();
    });

    it('rejects extra fields (strict mode)', () => {
      expect(() =>
        GetAssignmentRequestSchema.parse({
          courseId: 'course-1',
          assignmentId: 'assign-1',
          extraField: 'should-not-be-allowed',
        })
      ).toThrow();
    });
  });
});
