import { describe, expect, it } from 'vitest';
import {
  AssignmentDefinitionPartialSchema,
  AssignmentPartialSchema,
  BaseTaskArtifactPartialSchema,
  ClassFullResponseSchema,
  ClassFullSchema,
  StudentSubmissionItemPartialSchema,
  StudentSubmissionPartialSchema,
  StudentSummarySchema,
  TeacherSummarySchema,
} from './classDetailService.zod';

const validStudentSummary = {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  id: 'student-1',
};

const validBaseTaskArtifactPartial = {
  taskId: 'task-1',
  role: 'student',
  pageId: 'slide-5',
  documentId: 'doc-abc',
  content: null,
  contentHash: null,
  metadata: { slideOrder: 3 },
  uid: 'uid-artifact-1',
  type: 'slides',
};

const validStudentSubmissionItemPartial = {
  id: 'sub-1',
  taskId: 'task-1',
  artifact: validBaseTaskArtifactPartial,
  assessments: {
    accuracy: { score: 4, feedback: 'Good work' },
    completeness: { score: 5 },
  },
  feedback: { comment: 'Great effort' },
};

const validStudentSubmissionPartial = {
  studentId: 'student-1',
  studentName: 'Alice Johnson',
  assignmentId: 'assign-1',
  documentId: 'doc-abc',
  items: { 'task-1': validStudentSubmissionItemPartial },
  createdAt: '2025-05-01T08:00:00.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
};

const validAssignmentDefinitionPartial = {
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
  tasks: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-05-01T00:00:00.000Z',
};

const validAssignmentPartial = {
  courseId: 'course-1',
  assignmentId: 'assign-1',
  assignmentName: 'Algebra Basics',
  dueDate: '2025-06-01T23:59:59.000Z',
  lastUpdated: '2025-05-15T12:00:00.000Z',
  createdAt: '2025-05-01T08:00:00.000Z',
  documentType: 'SLIDES',
  submissions: [validStudentSubmissionPartial], // Uses the new nested-dictionary shape
  assignmentDefinition: validAssignmentDefinitionPartial,
};

const validClassFull = {
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
};

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
    // eslint-disable-next-line unicorn/no-useless-undefined -- value matters for parse() test
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

  it('accepts submissions with redacted artifacts (content/contentHash set to null)', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result.submissions).toHaveLength(1);
    const item = result.submissions[0].items['task-1'];
    expect(item.artifact.content).toBeNull();
    expect(item.artifact.contentHash).toBeNull();
    expect(item.artifact.taskId).toBe('task-1');
  });

  it('accepts assignmentDefinition with tasks set to null', () => {
    const result = AssignmentPartialSchema.parse(validAssignmentPartial);
    expect(result.assignmentDefinition.tasks).toBeNull();
    expect(result.assignmentDefinition.primaryTitle).toBe('Algebra Baseline');
  });

  it('rejects a partial assignment missing courseId', () => {
    const missing = { ...validAssignmentPartial };
    delete (missing as Record<string, unknown>).courseId;
    expect(() => AssignmentPartialSchema.parse(missing)).toThrow();
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

  it('rejects a partial assignment missing assignmentDefinition', () => {
    const missing = { ...validAssignmentPartial };
    delete (missing as Record<string, unknown>).assignmentDefinition;
    expect(() => AssignmentPartialSchema.parse(missing)).toThrow();
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

describe('StudentSubmissionItemPartialSchema', () => {
  it('parses a valid submission item partial with redacted artifact', () => {
    const result = StudentSubmissionItemPartialSchema.parse(validStudentSubmissionItemPartial);
    expect(result.artifact.content).toBeNull();
    expect(result.artifact.contentHash).toBeNull();
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
});

describe('BaseTaskArtifactPartialSchema', () => {
  it('parses a valid base task artifact partial with content and contentHash set to null', () => {
    const result = BaseTaskArtifactPartialSchema.parse(validBaseTaskArtifactPartial);
    expect(result.content).toBeNull();
    expect(result.contentHash).toBeNull();
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

  it('rejects an artifact with non-null content', () => {
    expect(() =>
      BaseTaskArtifactPartialSchema.parse({ ...validBaseTaskArtifactPartial, content: 'data' })
    ).toThrow();
  });
});

describe('AssignmentDefinitionPartialSchema', () => {
  it('parses a valid assignment definition partial with tasks set to null', () => {
    const result = AssignmentDefinitionPartialSchema.parse(validAssignmentDefinitionPartial);
    expect(result.tasks).toBeNull();
    expect(result.definitionKey).toBe('algebra-baseline');
    expect(result.documentType).toBe('SLIDES');
    expect(result.primaryTitle).toBe('Algebra Baseline');
    expect(result.yearGroupLabel).toBe('Year 10');
    expect(result.referenceDocumentId).toBe('ref-doc-123');
    expect(result.templateDocumentId).toBe('template-doc-456');
    expect(result.assignmentWeighting).toBe(1);
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updatedAt).toBe('2025-05-01T00:00:00.000Z');
  });

  it('rejects a definition missing primaryTitle', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).primaryTitle;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a definition missing definitionKey', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).definitionKey;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a definition with tasks not null', () => {
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({ ...validAssignmentDefinitionPartial, tasks: [] })
    ).toThrow();
  });

  // REGRESSION: getABClass can return null for referenceDocumentId,
  // templateDocumentId, and assignmentWeighting (AssignmentDefinition.toPartialJSON
  // passes them through from the instance, where they can be null). Previously the
  // schema declared these as non-nullable, which caused Zod validation crashes on
  // legitimate backend responses. The convention in assignmentDefinition.zod.ts
  // (WeightingSchema.nullable()) and assignmentDefinitionPartials.zod.ts
  // (z.number().nullable()) already marks assignmentWeighting as nullable.
  it('accepts null for referenceDocumentId, templateDocumentId, and assignmentWeighting', () => {
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        referenceDocumentId: null,
        templateDocumentId: null,
        assignmentWeighting: null,
      })
    ).not.toThrow();
  });

  it('rejects undefined for referenceDocumentId, templateDocumentId, and assignmentWeighting', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).referenceDocumentId;
    delete (missing as Record<string, unknown>).templateDocumentId;
    delete (missing as Record<string, unknown>).assignmentWeighting;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('still rejects non-null, non-string values for referenceDocumentId and templateDocumentId', () => {
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        referenceDocumentId: 42,
      })
    ).toThrow();
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        templateDocumentId: { id: 'oops' },
      })
    ).toThrow();
  });

  it('still rejects non-null, non-number values for assignmentWeighting', () => {
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        assignmentWeighting: 'not-a-number',
      })
    ).toThrow();
  });
});
