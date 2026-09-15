import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for Teacher, Student and StudentSubmission
// models, exercising validation branches, serialisation and extraction merge
// paths without invoking GAS services.
const { Teacher } = require('../../src/backend/Models/Teacher.js');
const { Student } = require('../../src/backend/Models/Student.js');

describe('Teacher behaviour', () => {
  it('stores constructor values and exposes getters', () => {
    const teacher = new Teacher('teacher@example.com', '123456', 'Teacher Name');
    expect(teacher.getEmail()).toBe('teacher@example.com');
    expect(teacher.getUserId()).toBe('123456');
    expect(teacher.getTeacherName()).toBe('Teacher Name');

    const minimal = new Teacher('minimal@example.com');
    expect(minimal.userId).toBeNull();
    expect(minimal.teacherName).toBeNull();
  });

  it('clears names and emails when falsy values are supplied', () => {
    const teacher = new Teacher('teacher@example.com', '123456', 'Name');
    teacher.setTeacherName(null);
    expect(teacher.teacherName).toBeNull();
    teacher.setTeacherName('');
    expect(teacher.teacherName).toBeNull();
    teacher.setEmail(null);
    expect(teacher.email).toBeNull();
    teacher.setUserId(undefined);
    expect(teacher.userId).toBeNull();
  });

  it('accepts values when no injected validator is present', () => {
    const teacher = new Teacher('a@example.com');
    teacher.setTeacherName('Plain Name');
    teacher.setEmail('plain@example.com');
    teacher.setUserId('user-123');
    expect(teacher.teacherName).toBe('Plain Name');
    expect(teacher.email).toBe('plain@example.com');
    expect(teacher.userId).toBe('user-123');
  });

  it('validates through an injected validator when available', () => {
    const teacher = new Teacher('a@example.com');
    teacher._Validate = {
      isString: (value) => typeof value === 'string' && value !== 'bad-name',
      isEmail: (value) => value === 'good@example.com',
      isGoogleUserId: (value) => value === 'good-id',
    };

    teacher.setTeacherName('Good Name');
    expect(teacher.teacherName).toBe('Good Name');
    expect(() => teacher.setTeacherName('bad-name')).toThrow('Invalid teacherName');

    teacher.setEmail('good@example.com');
    expect(() => teacher.setEmail('bad@example.com')).toThrow('Invalid email');

    teacher.setUserId('good-id');
    expect(() => teacher.setUserId('bad-id')).toThrow('Invalid userId');
  });

  it('ignores validators without the expected methods', () => {
    const teacher = new Teacher('a@example.com');
    teacher._Validate = {};
    teacher.setTeacherName('Any Name');
    teacher.setEmail('any@example.com');
    teacher.setUserId('any-id');
    expect(teacher.teacherName).toBe('Any Name');
  });

  it('serialises with optional names and rehydrates', () => {
    expect(new Teacher('a@example.com').toJSON()).toEqual({
      email: 'a@example.com',
      userId: null,
    });
    expect(new Teacher('a@example.com', '123456', 'Named').toJSON()).toEqual({
      email: 'a@example.com',
      userId: '123456',
      teacherName: 'Named',
    });

    expect(Teacher.fromJSON(null)).toBeNull();
    expect(Teacher.fromJSON('not-an-object')).toBeNull();
    const withName = Teacher.fromJSON({
      email: 'a@example.com',
      userId: '1',
      teacherName: 'Named',
    });
    expect(withName).toBeInstanceOf(Teacher);
    expect(withName.teacherName).toBe('Named');
    const withoutName = Teacher.fromJSON({ email: 'b@example.com', userId: '2' });
    expect(withoutName.teacherName).toBeNull();
  });
});

describe('Student behaviour', () => {
  it('stores fields and round trips JSON', () => {
    const student = new Student('Student One', 'student@example.com', 's-one');
    expect(student.name).toBe('Student One');
    expect(student.toJSON()).toEqual({
      name: 'Student One',
      email: 'student@example.com',
      id: 's-one',
    });
    const restored = Student.fromJSON(student.toJSON());
    expect(restored).toBeInstanceOf(Student);
    expect(restored.name).toBe('Student One');
  });
});

describe('StudentSubmission behaviour', () => {
  let restoreGlobals;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('creates submission items with stable identifiers', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one', 'doc-one', 'Name');
    expect(submission.studentId).toBe('s-one');
    expect(submission.documentId).toBe('doc-one');
    expect(submission.getItem('missing')).toBeUndefined();
    expect(submission.createdAt).toBeTruthy();
    expect(submission.updatedAt).toBeTruthy();

    expect(() => new globalThis.StudentSubmission(null, 'a-one')).toThrow(
      'StudentSubmission requires studentId & assignmentId'
    );
  });

  it('monotonically touches the updated timestamp', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one');
    const first = submission.updatedAt;
    submission.touchUpdated();
    const second = submission.updatedAt;
    submission.touchUpdated();
    expect(second).not.toBe(first);
    expect(submission.updatedAt).not.toBe(second);
  });

  it('upserts new extraction payloads with inferred types', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one', 'parent-doc');
    const definition = {
      getId: () => 'task-one',
      pageId: 'ref-page',
      taskTitle: 'Task One',
      taskMetadata: null,
      getPrimaryReference: () => ({ getType: () => 'TEXT' }),
    };
    const item = submission.upsertItemFromExtraction(definition, {
      content: 'student answer',
      metadata: { source: 'slides' },
    });
    expect(item.taskId).toBe('task-one');
    expect(submission.getItem('task-one')).toBe(item);
    expect(item.artifact.content).toBe('student answer');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('warns when new non image content is empty', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one', null, 'Student One');
    const definition = {
      getId: () => 'task-two',
      pageId: null,
      taskTitle: 'Task Two',
      taskMetadata: { taskType: 'TABLE' },
      getPrimaryReference: () => null,
    };
    submission.upsertItemFromExtraction(definition, { content: null });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "No content found for Student One for task 'Task Two'."
    );
  });

  it('defaults inferred types to text and prefers extraction document ids', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one', 'parent-doc');
    const definition = {
      getId: () => 'task-three',
      pageId: null,
      taskTitle: 'Task Three',
      taskMetadata: null,
      getPrimaryReference: () => null,
    };
    const item = submission.upsertItemFromExtraction(definition, {
      content: 'answer',
      documentId: 'extracted-doc',
      metadata: null,
    });
    expect(item.artifact.getType()).toBe('TEXT');
    expect(item.artifact.documentId).toBe('extracted-doc');
  });

  it('merges follow up extractions into the existing artifact', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one');
    const definition = {
      getId: () => 'task-four',
      pageId: 'page-one',
      taskTitle: 'Task Four',
      getPrimaryReference: () => ({ getType: () => 'TEXT' }),
    };
    submission.upsertItemFromExtraction(definition, { content: 'first' });
    const updated = submission.upsertItemFromExtraction(definition, {
      content: 'second',
      metadata: { extra: true },
    });
    expect(updated.artifact.content).toBe('second');
    expect(updated.artifact.metadata).toMatchObject({ extra: true });

    submission.upsertItemFromExtraction(definition, {});
    expect(submission.getItem('task-four')).toBe(updated);
  });

  it('nulls hashes for empty merges and rehashes content', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one');
    const definition = {
      getId: () => 'task-five',
      pageId: 'page-one',
      taskTitle: 'Task Five',
      getPrimaryReference: () => ({ getType: () => 'TEXT' }),
    };
    const item = submission.upsertItemFromExtraction(definition, { content: 'value' });
    expect(item.artifact.contentHash).toBeTruthy();
    submission.upsertItemFromExtraction(definition, { content: null });
    expect(item.artifact.contentHash).toBeNull();
  });

  it('requires a task definition for upserts', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one');
    expect(() => submission.upsertItemFromExtraction(null)).toThrow(
      'upsertItemFromExtraction requires taskDefinition'
    );
  });

  it('serialises, redacts and rehydrates submissions', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one', 'doc-one', 'Name');
    const definition = {
      getId: () => 'task-six',
      pageId: 'page-six',
      taskTitle: 'Task Six',
      getPrimaryReference: () => ({ getType: () => 'TEXT' }),
    };
    const item = submission.upsertItemFromExtraction(definition, { content: 'answer' });
    item.addAssessment('criterion-one', { score: 2, reasoning: 'because' });
    item.addFeedback('comment', { text: 'well done' });

    const json = submission.toJSON();
    expect(json.studentId).toBe('s-one');
    expect(json.items['task-six'].assessments['criterion-one'].score).toBe(2);

    const partial = submission.toPartialJSON();
    expect(partial.items['task-six'].assessments['criterion-one'].reasoning).toBeUndefined();
    expect(partial.items['task-six'].assessments['criterion-one'].score).toBe(2);

    const restored = globalThis.StudentSubmission.fromJSON(json);
    expect(restored.studentId).toBe('s-one');
    expect(restored.getItem('task-six').artifact.content).toBe('answer');
    expect(restored.getItem('task-six').getAssessment('criterion-one').score).toBe(2);
    expect(restored.getItem('task-six').getFeedback('comment')).toEqual({ text: 'well done' });
    expect(item.getType()).toBe('TEXT');
    expect(item.getAssessment()).toBeTruthy();
    expect(item.getFeedback()).toBeTruthy();
  });

  it('handles assessment and feedback edge cases', () => {
    const submission = new globalThis.StudentSubmission('s-one', 'a-one');
    const definition = {
      getId: () => 'task-seven',
      pageId: 'page-seven',
      taskTitle: 'Task Seven',
      getPrimaryReference: () => ({ getType: () => 'TEXT' }),
    };
    const item = submission.upsertItemFromExtraction(definition, { content: 'answer' });
    expect(() => item.addAssessment(null, { score: 1 })).toThrow(
      'addAssessment requires criterion when recording assessment data'
    );
    item.addAssessment('criterion-one', null);
    expect(item.getAssessment('missing')).toBeNull();
    expect(() => item.addFeedback(null, {})).toThrow(
      'addFeedback requires a feedback type identifier'
    );
    item.addFeedback('type-one', null);
    expect(item.getFeedback('missing')).toBeNull();
  });
});
