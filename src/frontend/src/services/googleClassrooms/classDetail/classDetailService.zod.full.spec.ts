/**
 * Class-full/class-assignment schema suite.
 *
 * Characterises `ClassFullSchema`, `ClassFullResponseSchema`,
 * `AssignmentPartialSchema`, `TeacherSummarySchema` and `StudentSummarySchema`.
 * Split verbatim from the original single `classDetailService.zod.spec.ts`
 * suite as a green responsibility-based refactor; every original assertion is
 * preserved. The submission/artifact and definition schema suites live in
 * sibling spec files and share these fixtures through the
 * `classDetailSchemaFixtures` selector module.
 */

import { describe, expect, it } from 'vitest';
import {
  AssignmentPartialSchema,
  ClassFullResponseSchema,
  ClassFullSchema,
  StudentSummarySchema,
  TeacherSummarySchema,
} from './classDetailService.zod';
import {
  validAssignmentPartial,
  validClassFull,
  validStudentSummary,
} from '@/test/abClass/classDetailSchemaFixtures';

describe('ClassFullSchema', () => {
  it('is exported from the zod module', () => {
    expect(ClassFullSchema).toBeDefined();
  });

  it('parses a representative full response with all fields populated', () => {
    const result = ClassFullSchema.parse(validClassFull);
    expect(result).toEqual(validClassFull);
  });

  it('rejects a response missing classId', () => {
    const missingClassId = { ...validClassFull };
    delete (missingClassId as Record<string, unknown>).classId;
    expect(() => ClassFullSchema.parse(missingClassId)).toThrow();
  });

  it('rejects a response where classOwner has wrong type (string instead of object)', () => {
    expect(() =>
      ClassFullSchema.parse({ ...validClassFull, classOwner: 'not-an-object' })
    ).toThrow();
  });
});

describe('ClassFullResponseSchema', () => {
  it('accepts null (the null-result contract)', () => {
    expect(ClassFullResponseSchema.parse(null)).toBeNull();
  });

  it('rejects undefined', () => {
    // The undefined argument is deliberate: this asserts the schema rejects undefined.
    expect(() => ClassFullResponseSchema.parse(undefined)).toThrow();
  });
});

describe('AssignmentPartialSchema', () => {
  it('parses a representative partial assignment with all expected fields', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result).toEqual(validAssignmentPartial);
  });

  it('accepts createdAt as ISO string and documentType as string', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result.createdAt).toBe('2025-05-01T08:00:00.000Z');
    expect(result.documentType).toBe('SLIDES');
  });

  it('accepts submissions with redacted artifacts', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result.submissions).toHaveLength(1);
    const item = result.submissions[0].items['task-1'];
    expect(item.artifact.taskId).toBe('task-1');
  });

  it('accepts assignmentDefinitionKey', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result.assignmentDefinitionKey).toBe('algebra-baseline');
  });

  it('omits courseId (not part of the partial assignment contract)', () => {
    const result = AssignmentPartialSchema.parse({
      ...validAssignmentPartial,
      courseId: 'course-1',
    });
    expect(result).not.toHaveProperty('courseId');
  });

  it('rejects a partial assignment missing assignmentId', () => {
    const missing = { ...validAssignmentPartial };
    delete (missing as Record<string, unknown>).assignmentId;
    expect(() => AssignmentPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a partial assignment missing createdAt', () => {
    const missing = { ...validAssignmentPartial };
    delete (missing as Record<string, unknown>).createdAt;
    expect(() => AssignmentPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a partial assignment with non-array submissions', () => {
    expect(() =>
      AssignmentPartialSchema.parse({ ...validAssignmentPartial, submissions: 'not-array' })
    ).toThrow();
  });

  it('rejects a partial assignment missing assignmentDefinitionKey', () => {
    const missing = { ...validAssignmentPartial };
    delete (missing as Record<string, unknown>).assignmentDefinitionKey;
    expect(() => AssignmentPartialSchema.parse(missing)).toThrow();
  });

  it('rejects lastUpdated in strict mode (old field name is forbidden)', () => {
    // Remove the renamed field and add back the old field name.
    // After the rename, the schema uses updatedAt instead of lastUpdated,
    // so strict mode must reject the legacy field name.
    const payload = { ...validAssignmentPartial } as Record<string, unknown>;
    delete payload.updatedAt;
    payload.lastUpdated = '2025-05-15T12:00:00.000Z';
    expect(() => AssignmentPartialSchema.strict().parse(payload)).toThrow();
  });

  it('accepts updatedAt set to null (cardinality preserved)', () => {
    const result = AssignmentPartialSchema.parse({
      ...validAssignmentPartial,
      updatedAt: null,
    });
    expect(result.updatedAt).toBeNull();
  });

  it('round-trips validAssignmentPartial with the renamed updatedAt field', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result).toEqual(validAssignmentPartial);
  });
});

describe('TeacherSummarySchema', () => {
  it('parses a valid teacher summary', () => {
    const result = TeacherSummarySchema.parse({
      userId: 'owner-1',
      email: 'owner-1@example.com',
      teacherName: 'Dr Smith',
    });
    expect(result).toEqual({
      userId: 'owner-1',
      email: 'owner-1@example.com',
      teacherName: 'Dr Smith',
    });
  });

  it('normalises omitted teacherName to null', () => {
    const result = TeacherSummarySchema.parse({
      userId: 'owner-1',
      email: 'owner-1@example.com',
    });
    expect(result.teacherName).toBeNull();
  });

  it('accepts all-null teacher summary', () => {
    const result = TeacherSummarySchema.parse({
      userId: null,
      email: null,
      teacherName: null,
    });
    expect(result).toEqual({
      userId: null,
      email: null,
      teacherName: null,
    });
  });
});

describe('StudentSummarySchema', () => {
  it('parses a valid student summary', () => {
    const result = StudentSummarySchema.parse(validStudentSummary);
    expect(result).toEqual(validStudentSummary);
  });

  it('rejects a student summary missing email', () => {
    const missingEmail = { ...validStudentSummary };
    delete (missingEmail as Record<string, unknown>).email;
    expect(() => StudentSummarySchema.parse(missingEmail)).toThrow();
  });

  it('rejects a student summary missing name', () => {
    const missingName = { email: 'alice@example.com', id: 'student-1' };
    expect(() => StudentSummarySchema.parse(missingName)).toThrow();
  });

  it('rejects a student summary missing id', () => {
    const missingId = { name: 'Alice', email: 'alice@example.com' };
    expect(() => StudentSummarySchema.parse(missingId)).toThrow();
  });
});
