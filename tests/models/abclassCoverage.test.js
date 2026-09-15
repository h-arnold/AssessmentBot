import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for the ABClass model: construction, owner
// handling, collection helpers, serialisation and rehydration.
const { ABClass } = require('../../src/backend/Models/ABClass.js');
const { Teacher } = require('../../src/backend/Models/Teacher.js');

describe('ABClass construction behaviour', () => {
  it('rejects missing or malformed constructor options', () => {
    expect(() => new ABClass()).toThrow(TypeError);
    expect(() => new ABClass(null)).toThrow(TypeError);
    expect(() => new ABClass([])).toThrow(TypeError);
    expect(() => new ABClass({})).toThrow('classId is required');
    expect(() => new ABClass({ classId: '' })).toThrow('classId is required');
  });

  it('applies defaults and coerces keys', () => {
    const instance = new ABClass({ classId: 'c-one' });
    expect(instance.classId).toBe('c-one');
    expect(instance.className).toBeNull();
    expect(instance.classOwner).toBeNull();
    expect(instance.cohortKey).toBeNull();
    expect(instance.courseLength).toBe(1);
    expect(instance.yearGroupKey).toBeNull();
    expect(instance.teachers).toEqual([]);
    expect(instance.students).toEqual([]);
    expect(instance.assignments).toEqual([]);
    expect(instance.active).toBeNull();
    expect(instance.getClassId()).toBe('c-one');
    expect(instance.getClassName()).toBeNull();
    expect(instance.getClassOwner()).toBeNull();
  });

  it('parses course length and stringifies keys', () => {
    const fromString = new ABClass({ classId: 'c-two', courseLength: '3', cohortKey: 7 });
    expect(fromString.courseLength).toBe(3);
    expect(fromString.cohortKey).toBe('7');

    const invalid = new ABClass({ classId: 'c-three', courseLength: 'not-a-number' });
    expect(invalid.courseLength).toBe(1);

    const integer = new ABClass({
      classId: 'c-four',
      courseLength: 2,
      yearGroupKey: 10,
      className: 'Year Ten',
    });
    expect(integer.courseLength).toBe(2);
    expect(integer.yearGroupKey).toBe('10');
    integer.setClassName('New Name');
    expect(integer.getClassName()).toBe('New Name');
    integer.setClassName(null);
    expect(integer.getClassName()).toBeNull();
  });

  it('copies supplied collections and tolerates non arrays', () => {
    const teachers = [{ email: 't@example.com' }];
    const instance = new ABClass({
      classId: 'c-five',
      teachers,
      students: 'not-an-array',
      assignments: null,
    });
    expect(instance.teachers).toEqual(teachers);
    expect(instance.teachers).not.toBe(teachers);
    expect(instance.students).toEqual([]);
    expect(instance.assignments).toEqual([]);
  });

  it('parses nullable integers with defaults', () => {
    expect(ABClass._parseNullableInt(null, 9)).toBe(9);
    expect(ABClass._parseNullableInt(undefined, 9)).toBe(9);
    expect(ABClass._parseNullableInt(4, 9)).toBe(4);
    expect(ABClass._parseNullableInt('6', 9)).toBe(6);
    expect(ABClass._parseNullableInt('bad', 9)).toBe(9);
  });
});

describe('ABClass owner behaviour', () => {
  let restoreGlobals;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { error: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      Teacher: () => Teacher,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
  });

  it('accepts teacher instances directly', () => {
    const instance = new ABClass({ classId: 'c-six' });
    const owner = new Teacher('owner@example.com', '123456', 'Owner Name');
    expect(instance.setClassOwner(owner)).toBe(owner);
    expect(instance.getClassOwner()).toBe(owner);
  });

  it('coerces plain owner objects through Teacher.fromJSON', () => {
    const instance = new ABClass({ classId: 'c-seven' });
    const owner = instance.setClassOwner({ email: 'plain@example.com', userId: '654321' });
    expect(owner).toBeInstanceOf(Teacher);
    expect(owner.email).toBe('plain@example.com');
    expect(instance.getClassOwner()).toBe(owner);
  });

  it('rejects values that cannot become a teacher', () => {
    const instance = new ABClass({ classId: 'c-eight' });
    expect(() => instance.setClassOwner(null)).toThrow('setClassOwner requires a Teacher instance');
    expect(() => instance.setClassOwner('not-an-object')).toThrow(
      'setClassOwner requires a Teacher instance'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('setClassOwner requires a Teacher instance');
  });
});

describe('ABClass collection behaviour', () => {
  it('adds, finds and removes teachers, students and assignments', () => {
    const instance = new ABClass({ classId: 'c-nine' });

    expect(instance.addTeacher(null)).toBeNull();
    const teacher = { email: 't@example.com' };
    expect(instance.addTeacher(teacher)).toBe(teacher);
    expect(instance.findTeacher((item) => item.email === 't@example.com')).toBe(teacher);
    expect(instance.findTeacher((item) => item.email === 'missing')).toBeNull();
    expect(instance.removeTeacher((item) => item.email === 'missing')).toBeNull();
    expect(instance.removeTeacher((item) => item.email === 't@example.com')).toBe(teacher);
    expect(instance.teachers).toEqual([]);

    expect(instance.addStudent(null)).toBeNull();
    const student = { id: 's-one' };
    instance.addStudent(student);
    expect(instance.findStudent((item) => item.id === 's-one')).toBe(student);
    expect(instance.removeStudent((item) => item.id === 's-one')).toBe(student);
    expect(instance.removeStudent(() => true)).toBeNull();

    expect(instance.addAssignment(null)).toBeNull();
    const assignment = { assignmentId: 'a-one' };
    instance.addAssignment(assignment);
    expect(instance.findAssignment((item) => item.assignmentId === 'a-one')).toBe(assignment);
    expect(instance.findAssignmentIndex((item) => item.assignmentId === 'a-one')).toBe(0);
    expect(instance.findAssignmentIndex(() => false)).toBe(-1);
    expect(instance.removeAssignment((item) => item.assignmentId === 'a-one')).toBe(assignment);
    expect(instance.removeAssignment(() => true)).toBeNull();
  });

  it('serialises owners with and without toJSON support', () => {
    const instance = new ABClass({ classId: 'c-ten' });
    expect(instance.serialiseOwner(null)).toBeNull();

    const plain = { email: 'plain@example.com' };
    expect(instance.serialiseOwner(plain)).toBe(plain);

    const withJson = { toJSON: () => ({ serialised: true }) };
    expect(instance.serialiseOwner(withJson)).toEqual({ serialised: true });
  });

  it('round trips full and partial JSON', () => {
    const owner = new Teacher('owner@example.com', '123456', 'Owner');
    const instance = new ABClass({
      classId: 'c-eleven',
      className: 'Class Eleven',
      cohortKey: 'cohort-a',
      courseLength: 2,
      yearGroupKey: 'year-ten',
      classOwner: owner,
      teachers: [owner],
      students: [{ id: 's-one', toJSON: () => ({ id: 's-one' }) }],
      assignments: [{ assignmentId: 'a-one', toJSON: () => ({ assignmentId: 'a-one' }) }],
      active: true,
    });

    const json = instance.toJSON();
    expect(json.classId).toBe('c-eleven');
    expect(json.classOwner.email).toBe('owner@example.com');
    expect(json.teachers).toHaveLength(1);
    expect(json.active).toBe(true);

    const partial = instance.toPartialJSON();
    expect(partial.classId).toBe('c-eleven');
    expect(partial).not.toHaveProperty('students');
    expect(partial).not.toHaveProperty('assignments');
    expect(partial.active).toBe(true);

    const unset = new ABClass({ classId: 'c-twelve' });
    expect(unset.toJSON().active).toBeNull();
    expect(unset.toPartialJSON().active).toBeNull();
  });

  it('rehydrates from JSON with owner, roster and assignment fallbacks', () => {
    expect(ABClass.fromJSON(null)).toBeNull();
    expect(ABClass.fromJSON('not-an-object')).toBeNull();

    const mockContext = withGlobalMocks({
      Teacher: () => Teacher,
      Assignment: () => ({
        fromJSON: (data) => ({ ...data, _hydrationLevel: 'full' }),
      }),
    });
    try {
      const restored = ABClass.fromJSON({
        classId: 'c-thirteen',
        className: 'Restored',
        cohortKey: 5,
        courseLength: '2',
        yearGroupKey: 9,
        classOwner: { email: 'owner@example.com', userId: '123456' },
        teachers: [{ email: 't@example.com' }],
        students: [{ id: 's-one' }],
        assignments: [{ assignmentId: 'a-one' }],
        active: false,
      });
      expect(restored.classId).toBe('c-thirteen');
      expect(restored.cohortKey).toBe('5');
      expect(restored.courseLength).toBe(2);
      expect(restored.yearGroupKey).toBe('9');
      expect(restored.classOwner).toBeInstanceOf(Teacher);
      expect(restored.assignments).toHaveLength(1);
      expect(restored.assignments[0]._hydrationLevel).toBe('partial');
      expect(restored.active).toBe(false);

      const withoutOwner = ABClass.fromJSON({ classId: 'c-fourteen' });
      expect(withoutOwner.classOwner).toBeNull();
      expect(withoutOwner.teachers).toEqual([]);
      expect(withoutOwner.active).toBeNull();
    } finally {
      mockContext.restore();
    }
  });

  it('falls back to the raw owner when coercion throws', () => {
    class ThrowingTeacher {
      static fromJSON() {
        throw new Error('coercion failed');
      }
    }
    const warnLogger = { debug: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => warnLogger }),
      Teacher: () => ThrowingTeacher,
      __TRACE_SINGLETON__: () => true,
      Assignment: () => globalThis.Assignment,
    });
    try {
      const restored = ABClass.fromJSON({
        classId: 'c-fifteen',
        classOwner: { email: 'raw@example.com' },
      });
      expect(restored.classOwner).toEqual({ email: 'raw@example.com' });
      expect(warnLogger.debug).toHaveBeenCalled();
    } finally {
      mockContext.restore();
    }
  });
});
