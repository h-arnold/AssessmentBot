import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  AssignmentDefinitionSchema,
  AssignmentFullSchema,
  AssignmentFullResponseSchema,
  GetAssignmentRequestSchema,
  GetProgressResponseSchema,
  ProgressRecordSchema,
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
  StudentSubmissionItemSchema,
  StudentSubmissionSchema,
} from './assignmentAssessment.zod';
import {
  UNSUPPORTED_MARKERS,
  validBaseArtifact,
  validFullAssignment,
} from '@/test/assignmentAssessment/assignmentAssessment.zod.fixtures';

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

const validProgressRecord = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  step: 1,
  message: 'Marking task one',
  completed: false,
  error: null,
  timestamp: '2026-11-25T10:00:00.000Z',
};

describe('assignmentAssessment.zod schemas', () => {
  describe('StartAssessmentRunRequestSchema', () => {
    it('accepts a valid request with definitionKey, assignmentId, and courseId', () => {
      expect(StartAssessmentRunRequestSchema.parse(validStartAssessmentRunRequest)).toEqual(
        validStartAssessmentRunRequest
      );
    });

    it('rejects a request with missing definitionKey', () => {
      expect(() => {
        return StartAssessmentRunRequestSchema.parse({
          assignmentId: 'assign-123',
          courseId: 'course-456',
        });
      }).toThrow();
    });

    it('rejects a request with non-string assignmentId', () => {
      expect(() => {
        return StartAssessmentRunRequestSchema.parse({
          definitionKey: 'algebra-baseline',
          assignmentId: 123,
          courseId: 'course-456',
        });
      }).toThrow();
    });
  });

  describe('StartAssessmentRunResponseSchema', () => {
    const validResponse = { requestId: '550e8400-e29b-41d4-a716-446655440000' };

    it('accepts a response carrying a non-empty requestId', () => {
      expect(StartAssessmentRunResponseSchema.parse(validResponse)).toEqual(validResponse);
    });

    it('rejects null and other non-requestId data', () => {
      expect(() => StartAssessmentRunResponseSchema.parse(null)).toThrow();
      expect(() => StartAssessmentRunResponseSchema.parse({ success: true })).toThrow();
      expect(() => StartAssessmentRunResponseSchema.parse('string')).toThrow();
      expect(() => StartAssessmentRunResponseSchema.parse(Number.MAX_SAFE_INTEGER)).toThrow();
    });

    it('rejects an empty requestId', () => {
      expect(() => StartAssessmentRunResponseSchema.parse({ requestId: '' })).toThrow();
    });
  });

  describe('ProgressRecordSchema', () => {
    it('accepts a record with a canonical UTC ISO timestamp', () => {
      expect(ProgressRecordSchema.parse(validProgressRecord)).toEqual(validProgressRecord);
    });

    it('rejects a record with a malformed timestamp', () => {
      expect(() =>
        ProgressRecordSchema.parse({ ...validProgressRecord, timestamp: 'not-a-date' })
      ).toThrow(ZodError);
    });

    it('rejects a record with an empty requestId', () => {
      expect(() => ProgressRecordSchema.parse({ ...validProgressRecord, requestId: '' })).toThrow(
        ZodError
      );
    });

    it('rejects a record with a non-finite step', () => {
      expect(() => ProgressRecordSchema.parse({ ...validProgressRecord, step: Infinity })).toThrow(
        ZodError
      );
    });

    it('accepts a terminal record with an error message', () => {
      const failedRecord = { ...validProgressRecord, error: 'Assessment service unavailable' };
      expect(ProgressRecordSchema.parse(failedRecord)).toEqual(failedRecord);
    });
  });

  describe('GetProgressResponseSchema', () => {
    it('accepts an empty tasks array', () => {
      expect(GetProgressResponseSchema.parse({ tasks: [] })).toEqual({ tasks: [] });
    });

    it('accepts populated progress records', () => {
      const response = { tasks: [validProgressRecord] };
      expect(GetProgressResponseSchema.parse(response)).toEqual(response);
    });

    it('rejects a response without tasks', () => {
      expect(GetProgressResponseSchema.safeParse({}).success).toBe(false);
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

    it.each([1, 'legacy'] as const)('accepts the read version marker %s', (marker) => {
      const candidate = { ...validFullAssignment, assessmentContractVersion: marker };
      expect(AssignmentFullSchema.parse(candidate).assessmentContractVersion).toBe(marker);
    });

    it.each([null, ...UNSUPPORTED_MARKERS])('rejects the read version marker %s', (marker) => {
      expect(
        AssignmentFullSchema.safeParse({
          ...validFullAssignment,
          assessmentContractVersion: marker,
        }).success
      ).toBe(false);
    });

    it('rejects an absent read version marker', () => {
      const markerless = { ...validFullAssignment };
      delete (markerless as Record<string, unknown>).assessmentContractVersion;
      expect(AssignmentFullSchema.safeParse(markerless).success).toBe(false);
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
      expect(() => {
        return GetAssignmentRequestSchema.parse({
          courseId: 'course-1',
          assignmentId: 'assign-1',
          extraField: 'should-not-be-allowed',
        });
      }).toThrow();
    });
  });

  describe('StudentSubmissionItemSchema', () => {
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
      expect(() => {
        return StudentSubmissionItemSchema.parse({
          id: 123,
          taskId: 'task-1',
          artifact: validBaseArtifact,
          assessments: {},
          feedback: {},
        });
      }).toThrow();
    });

    it('rejects an item with numeric taskId', () => {
      expect(() => {
        return StudentSubmissionItemSchema.parse({
          id: 'item-1',
          taskId: 456,
          artifact: validBaseArtifact,
          assessments: {},
          feedback: {},
        });
      }).toThrow();
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
      expect(() => {
        return StudentSubmissionSchema.parse({
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
        });
      }).toThrow();
    });

    it('rejects a submission with createdAt: null', () => {
      expect(() => {
        return StudentSubmissionSchema.parse({
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
        });
      }).toThrow();
    });

    it('rejects a submission with numeric documentId', () => {
      expect(() => {
        return StudentSubmissionSchema.parse({
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
        });
      }).toThrow();
    });
  });

  describe('AssignmentDefinitionSchema', () => {
    it('accepts a valid definition with primaryTopic: null, assignmentWeighting: 0, alternateTitles: [], alternateTopics: []', () => {
      const validDefinition = {
        primaryTitle: 'Algebra',
        primaryTopic: null,
        primaryTopicKey: null,
        yearGroupKey: 'yg-1',
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
      expect(() => {
        return AssignmentDefinitionSchema.parse({
          primaryTitle: 42,
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: 'yg-1',
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
        });
      }).toThrow();
    });

    it('rejects a definition with assignmentWeighting as a string', () => {
      expect(() => {
        return AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: 'yg-1',
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
        });
      }).toThrow();
    });

    it('rejects a definition with alternateTitles as a string', () => {
      expect(() => {
        return AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: 'yg-1',
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
        });
      }).toThrow();
    });

    it('rejects a definition with alternateTitles containing numbers', () => {
      expect(() => {
        return AssignmentDefinitionSchema.parse({
          primaryTitle: 'Algebra',
          primaryTopic: null,
          primaryTopicKey: null,
          yearGroupKey: 'yg-1',
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
        });
      }).toThrow();
    });
  });
});
