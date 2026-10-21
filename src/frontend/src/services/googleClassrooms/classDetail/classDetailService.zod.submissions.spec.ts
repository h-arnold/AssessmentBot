/**
 * Submission and artifact schema suite.
 *
 * Characterises `StudentSubmissionItemPartialSchema`,
 * `StudentSubmissionPartialSchema`, the documentId regression behaviour
 * observed through `ClassFullSchema`, and `BaseTaskArtifactPartialSchema`.
 * Split verbatim from the original single `classDetailService.zod.spec.ts`
 * suite as a green responsibility-based refactor; every original assertion is
 * preserved. The full/assignment/teacher and definition schema suites live in
 * sibling spec files and share these fixtures through the
 * `classDetailSchemaFixtures` selector module.
 */

import { describe, expect, it } from 'vitest';
import {
  BaseTaskArtifactPartialSchema,
  ClassFullSchema,
  StudentSubmissionItemPartialSchema,
  StudentSubmissionPartialSchema,
} from './classDetailService.zod';
import {
  validAssignmentPartial,
  validBaseTaskArtifactPartial,
  validClassFull,
  validStudentSubmissionItemPartial,
  validStudentSubmissionPartial,
} from '@/test/abClass/classDetailSchemaFixtures';

describe('StudentSubmissionItemPartialSchema', () => {
  it('parses a valid submission item partial with redacted artifact', () => {
    const result = StudentSubmissionItemPartialSchema.parse(validStudentSubmissionItemPartial);
    expect(result.id).toBe('sub-1');
    expect(result.taskId).toBe('task-1');
  });

  it('rejects a submission item missing id', () => {
    const missing = { ...validStudentSubmissionItemPartial };
    delete (missing as Record<string, unknown>).id;
    expect(() => StudentSubmissionItemPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a submission item missing artifact', () => {
    const missing = { ...validStudentSubmissionItemPartial };
    delete (missing as Record<string, unknown>).artifact;
    expect(() => StudentSubmissionItemPartialSchema.parse(missing)).toThrow();
  });
});

describe('StudentSubmissionPartialSchema', () => {
  it('parses a valid nested submission with items dictionary', () => {
    const result = StudentSubmissionPartialSchema.parse(validStudentSubmissionPartial);
    expect(result.studentId).toBe('student-1');
    expect(result.studentName).toBe('Alice Johnson');
    expect(result.assignmentId).toBe('assign-1');
    expect(result.documentId).toBe('doc-abc');
    expect(result.items).toBeDefined();
    expect(result.items['task-1']).toBeDefined();
    expect(result.items['task-1'].id).toBe('sub-1');
  });

  it('rejects a submission missing the items field', () => {
    const missing = { ...validStudentSubmissionPartial };
    delete (missing as Record<string, unknown>).items;
    expect(() => StudentSubmissionPartialSchema.parse(missing)).toThrow();
  });

  it('rejects the old flat shape (single item, not nested submission)', () => {
    expect(() => StudentSubmissionPartialSchema.parse(validStudentSubmissionItemPartial)).toThrow();
  });

  it('rejects a submission missing studentId', () => {
    const missing = { ...validStudentSubmissionPartial };
    delete (missing as Record<string, unknown>).studentId;
    expect(() => StudentSubmissionPartialSchema.parse(missing)).toThrow();
  });

  it('accepts null studentName and documentId', () => {
    const result = StudentSubmissionPartialSchema.parse({
      ...validStudentSubmissionPartial,
      studentName: null,
      documentId: null,
    });
    expect(result.studentName).toBeNull();
    expect(result.documentId).toBeNull();
  });

  // REGRESSION: Google Classroom does not create a Drive document for students
  // who never opened an assignment, so the `documentId` key may be entirely
  // absent (undefined). The schema was changed from .nullable() to
  // .nullable().optional() to accept this.
  it('accepts omitted documentId key (undefined)', () => {
    const payload = { ...validStudentSubmissionPartial };
    delete (payload as Record<string, unknown>).documentId;
    const result = StudentSubmissionPartialSchema.parse(payload);
    expect(result.documentId).toBeUndefined();
  });

  // REGRESSION guard: the .optional() loosening must NOT also accept types
  // that were previously rejected (e.g. a number instead of string).
  it('rejects non-string, non-null documentId (number)', () => {
    expect(() => {
      return StudentSubmissionPartialSchema.parse({
        ...validStudentSubmissionPartial,
        documentId: 42,
      });
    }).toThrow();
  });
});

describe('StudentSubmissionPartialSchema — documentId regression via ClassFullSchema', () => {
  it('accepts a full class payload where a submission has documentId: null', () => {
    const classWithNullDocumentId = {
      ...validClassFull,
      assignments: [
        {
          ...validAssignmentPartial,
          submissions: [
            {
              ...validStudentSubmissionPartial,
              documentId: null,
            },
          ],
        },
      ],
    };
    const result = ClassFullSchema.parse(classWithNullDocumentId);
    expect(result.assignments[0].submissions[0].documentId).toBeNull();
  });

  it('accepts a full class payload where a submission has no documentId key', () => {
    const submissionWithoutDocumentId = { ...validStudentSubmissionPartial };
    delete (submissionWithoutDocumentId as Record<string, unknown>).documentId;
    const classWithoutDocumentId = {
      ...validClassFull,
      assignments: [
        {
          ...validAssignmentPartial,
          submissions: [submissionWithoutDocumentId],
        },
      ],
    };
    const result = ClassFullSchema.parse(classWithoutDocumentId);
    expect(result.assignments[0].submissions[0].documentId).toBeUndefined();
  });
});

describe('BaseTaskArtifactPartialSchema', () => {
  it('parses a valid base task artifact partial', () => {
    const result = BaseTaskArtifactPartialSchema.parse(validBaseTaskArtifactPartial);
    expect(result.type).toBe('slides');
    expect(result.taskId).toBe('task-1');
    expect(result.role).toBe('student');
    expect(result.uid).toBe('uid-artifact-1');
  });

  it('rejects an artifact missing taskId', () => {
    const missing = { ...validBaseTaskArtifactPartial };
    delete (missing as Record<string, unknown>).taskId;
    expect(() => BaseTaskArtifactPartialSchema.parse(missing)).toThrow();
  });

  it('rejects an artifact missing type', () => {
    const missing = { ...validBaseTaskArtifactPartial };
    delete (missing as Record<string, unknown>).type;
    expect(() => BaseTaskArtifactPartialSchema.parse(missing)).toThrow();
  });
});
