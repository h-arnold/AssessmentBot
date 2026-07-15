import { describe, expect, it } from 'vitest';
import {
  AssignmentDefinitionSchema,
  AssignmentFullSchema,
  AssignmentFullResponseSchema,
  BaseTaskArtifactSchema,
  GetAssignmentRequestSchema,
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
  StudentSubmissionItemSchema,
  StudentSubmissionSchema,
  TaskDefinitionSchema,
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
      taskMetadata: {},
      taskWeighting: 1,
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
            metadata: {},
            uid: 'uid-1',
            type: 'TEXT',
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
            metadata: {},
            uid: 'uid-1',
            type: 'TEXT',
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
    assignmentWeighting: 1,
    definitionKey: 'def-1',
    tasks: {
      'task-1': {
        id: 'task-1',
        taskTitle: 'Task One',
        pageId: 'page-1',
        taskNotes: null,
        taskMetadata: {},
        taskWeighting: 1,
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
              metadata: {},
              uid: 'uid-1',
              type: 'TEXT',
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
            taskMetadata: {},
            taskWeighting: 1,
            index: 0,
            artifacts: { reference: [], template: [] },
          },
        ],
      };
      expect(() => AssignmentFullSchema.parse(payloadWithArrayTasks)).toThrow();
    });

    it('accepts a payload with documentId: null in submissions', () => {
      const payloadWithNullDocumentId = {
        ...validFullAssignment,
        submissions: [
          {
            ...validFullAssignment.submissions[0],
            documentId: null,
          },
        ],
      };
      expect(AssignmentFullSchema.parse(payloadWithNullDocumentId)).toEqual(
        payloadWithNullDocumentId
      );
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

  describe('BaseTaskArtifactSchema', () => {
    it('accepts a valid artifact with all string fields and contentHash: null', () => {
      const validArtifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'TEXT',
        content: null,
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(validArtifact)).toEqual(validArtifact);
    });

    it('rejects an artifact missing taskId', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });

    it('rejects an artifact with contentHash as a number', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'TEXT',
          content: null,
          contentHash: 123,
          metadata: {},
        })
      ).toThrow();
    });

    it('accepts a TEXT artifact with string content', () => {
      const artifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'TEXT',
        content: 'some text content',
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a TEXT artifact with null content', () => {
      const artifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'TEXT',
        content: null,
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a SPREADSHEET artifact with 2D array content', () => {
      const artifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'SPREADSHEET',
        content: [
          ['a', 1, null],
          ['b', 1, null],
        ],
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a SPREADSHEET artifact with null content', () => {
      const artifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'SPREADSHEET',
        content: null,
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('accepts a base artifact with unknown content', () => {
      const artifact = {
        taskId: 'task-1',
        role: 'reference',
        pageId: 'page-1',
        documentId: 'doc-ref',
        uid: 'uid-1',
        type: 'base',
        content: { arbitrary: 'object' },
        contentHash: null,
        metadata: {},
      };
      expect(BaseTaskArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it('rejects a SPREADSHEET artifact with string content', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'SPREADSHEET',
          content: 'string instead of 2D array',
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });

    it('rejects an artifact with an unrecognised type', () => {
      expect(() =>
        BaseTaskArtifactSchema.parse({
          taskId: 'task-1',
          role: 'reference',
          pageId: 'page-1',
          documentId: 'doc-ref',
          uid: 'uid-1',
          type: 'BOGUS',
          content: null,
          contentHash: null,
          metadata: {},
        })
      ).toThrow();
    });
  });

  describe('TaskDefinitionSchema', () => {
    it('accepts a valid definition with taskWeighting: 1, index: null, taskNotes: null', () => {
      const validDefinition = {
        id: 'task-1',
        taskTitle: 'Task One',
        pageId: 'page-1',
        taskNotes: null,
        taskMetadata: {},
        taskWeighting: 1,
        index: null,
        artifacts: {
          reference: [],
          template: [],
        },
      };
      expect(TaskDefinitionSchema.parse(validDefinition)).toEqual(validDefinition);
    });

    it('rejects a definition with taskWeighting as a string', () => {
      expect(() =>
        TaskDefinitionSchema.parse({
          id: 'task-1',
          taskTitle: 'Task One',
          pageId: 'page-1',
          taskNotes: null,
          taskMetadata: {},
          taskWeighting: 'heavy',
          index: null,
          artifacts: { reference: [], template: [] },
        })
      ).toThrow();
    });

    it('rejects a definition with index as a string', () => {
      expect(() =>
        TaskDefinitionSchema.parse({
          id: 'task-1',
          taskTitle: 'Task One',
          pageId: 'page-1',
          taskNotes: null,
          taskMetadata: {},
          taskWeighting: 1,
          index: 'first',
          artifacts: { reference: [], template: [] },
        })
      ).toThrow();
    });
  });

  describe('StudentSubmissionItemSchema', () => {
    const validBaseArtifact = {
      taskId: 'task-1',
      role: 'reference',
      pageId: 'page-1',
      documentId: 'doc-ref',
      uid: 'uid-1',
      type: 'TEXT',
      content: null,
      contentHash: null,
      metadata: {},
    };

    it('accepts a valid item with id and taskId as strings', () => {
      const validItem = {
        id: 'item-1',
        taskId: 'task-1',
        artifact: validBaseArtifact,
        assessments: {},
        feedback: {},
      };
      expect(StudentSubmissionItemSchema.parse(validItem)).toEqual(validItem);
    });

    it('rejects an item with numeric id', () => {
      expect(() =>
        StudentSubmissionItemSchema.parse({
          id: 123,
          taskId: 'task-1',
          artifact: validBaseArtifact,
          assessments: {},
          feedback: {},
        })
      ).toThrow();
    });

    it('rejects an item with numeric taskId', () => {
      expect(() =>
        StudentSubmissionItemSchema.parse({
          id: 'item-1',
          taskId: 456,
          artifact: validBaseArtifact,
          assessments: {},
          feedback: {},
        })
      ).toThrow();
    });

    it('accepts an item with valid assessments', () => {
      const item = {
        id: 'item-1',
        taskId: 'task-1',
        artifact: validBaseArtifact,
        assessments: { clarity: { score: 3, reasoning: 'good' } },
        feedback: {},
      };
      expect(StudentSubmissionItemSchema.parse(item)).toEqual(item);
    });

    it('rejects an item with assessments where score is a string instead of number', () => {
      expect(() =>
        StudentSubmissionItemSchema.parse({
          id: 'item-1',
          taskId: 'task-1',
          artifact: validBaseArtifact,
          assessments: { clarity: { score: '3', reasoning: 'good' } },
          feedback: {},
        })
      ).toThrow();
    });

    it('accepts an item with valid feedback', () => {
      const item = {
        id: 'item-1',
        taskId: 'task-1',
        artifact: validBaseArtifact,
        assessments: {},
        feedback: {
          cellReference: {
            type: 'cellReference',
            createdAt: '2026-01-01T00:00:00.000Z',
            items: [],
          },
        },
      };
      expect(StudentSubmissionItemSchema.parse(item)).toEqual(item);
    });
  });

  describe('StudentSubmissionSchema', () => {
    const validBaseArtifact = {
      taskId: 'task-1',
      role: 'reference',
      pageId: 'page-1',
      documentId: 'doc-ref',
      uid: 'uid-1',
      type: 'TEXT',
      content: null,
      contentHash: null,
      metadata: {},
    };

    it('accepts a valid submission with documentId: null, createdAt and updatedAt as ISO strings', () => {
      const validSubmission = {
        studentId: 'student-1',
        studentName: 'Student One',
        assignmentId: 'assign-1',
        documentId: null,
        items: {
          'task-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: validBaseArtifact,
            assessments: {},
            feedback: {},
          },
        },
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      };
      expect(StudentSubmissionSchema.parse(validSubmission)).toEqual(validSubmission);
    });

    it('rejects a submission with numeric studentId', () => {
      expect(() =>
        StudentSubmissionSchema.parse({
          studentId: 456,
          studentName: 'Student One',
          assignmentId: 'assign-1',
          documentId: null,
          items: {
            'task-1': {
              id: 'item-1',
              taskId: 'task-1',
              artifact: validBaseArtifact,
              assessments: {},
              feedback: {},
            },
          },
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('rejects a submission with createdAt: null', () => {
      expect(() =>
        StudentSubmissionSchema.parse({
          studentId: 'student-1',
          studentName: 'Student One',
          assignmentId: 'assign-1',
          documentId: null,
          items: {
            'task-1': {
              id: 'item-1',
              taskId: 'task-1',
              artifact: validBaseArtifact,
              assessments: {},
              feedback: {},
            },
          },
          createdAt: null,
          updatedAt: '2026-05-02T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('rejects a submission with numeric documentId', () => {
      expect(() =>
        StudentSubmissionSchema.parse({
          studentId: 'student-1',
          studentName: 'Student One',
          assignmentId: 'assign-1',
          documentId: 123,
          items: {
            'task-1': {
              id: 'item-1',
              taskId: 'task-1',
              artifact: validBaseArtifact,
              assessments: {},
              feedback: {},
            },
          },
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        })
      ).toThrow();
    });
  });

  describe('AssignmentDefinitionSchema', () => {
    it('accepts a valid definition with primaryTopic: null, assignmentWeighting: 0, alternateTitles: [], alternateTopics: []', () => {
      const validDefinition = {
        primaryTitle: 'Algebra',
        primaryTopic: null,
        primaryTopicKey: null,
        yearGroupKey: null,
        yearGroupLabel: null,
        alternateTitles: [],
        alternateTopics: [],
        documentType: null,
        referenceDocumentId: null,
        templateDocumentId: null,
        referenceLastModified: null,
        templateLastModified: null,
        assignmentWeighting: 0,
        definitionKey: 'def-1',
        tasks: {},
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      };
      expect(AssignmentDefinitionSchema.parse(validDefinition)).toEqual(validDefinition);
    });

    it('rejects a definition with primaryTitle as a number', () => {
      expect(() =>
        AssignmentDefinitionSchema.parse({
          primaryTitle: 42,
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: null,
          yearGroupLabel: null,
          alternateTitles: [],
          alternateTopics: [],
          documentType: null,
          referenceDocumentId: null,
          templateDocumentId: null,
          referenceLastModified: null,
          templateLastModified: null,
          assignmentWeighting: 0,
          definitionKey: 'def-1',
          tasks: {},
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('rejects a definition with assignmentWeighting as a string', () => {
      expect(() =>
        AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: null,
          yearGroupLabel: null,
          alternateTitles: [],
          alternateTopics: [],
          documentType: null,
          referenceDocumentId: null,
          templateDocumentId: null,
          referenceLastModified: null,
          templateLastModified: null,
          assignmentWeighting: 'high',
          definitionKey: 'def-1',
          tasks: {},
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('rejects a definition with alternateTitles as a string', () => {
      expect(() =>
        AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: null,
          yearGroupLabel: null,
          alternateTitles: 'not-an-array',
          alternateTopics: [],
          documentType: null,
          referenceDocumentId: null,
          templateDocumentId: null,
          referenceLastModified: null,
          templateLastModified: null,
          assignmentWeighting: 0,
          definitionKey: 'def-1',
          tasks: {},
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('rejects a definition with alternateTitles containing numbers', () => {
      expect(() =>
        AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: null,
          yearGroupLabel: null,
          alternateTitles: [1, Number('2'), Number('3')],
          alternateTopics: [],
          documentType: null,
          referenceDocumentId: null,
          templateDocumentId: null,
          referenceLastModified: null,
          templateLastModified: null,
          assignmentWeighting: 0,
          definitionKey: 'def-1',
          tasks: {},
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        })
      ).toThrow();
    });
  });
});
