import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ABClass } from '../../src/backend/Models/ABClass.js';

describe('ABClass model – key-based metadata contract', () => {
  let origConfigMgr;

  beforeEach(() => {
    origConfigMgr = globalThis.ConfigurationManager;
  });

  afterEach(() => {
    globalThis.ConfigurationManager = origConfigMgr;
  });

  it('uses provided classId when present', () => {
    const c = new ABClass({
      classId: 'cid-1',
      className: 'Class Name',
      cohortKey: 'coh-uuid-001',
      courseLength: 1,
      yearGroupKey: 'yg-uuid-007',
    });
    expect(c.getClassId()).toBe('cid-1');
    expect(c.getClassName()).toBe('Class Name');
    expect(c.cohortKey).toBe('coh-uuid-001');
    expect(c.courseLength).toBe(1);
    expect(c.yearGroupKey).toBe('yg-uuid-007');
  });

  it('throws when classId is missing', () => {
    expect(() => new ABClass({})).toThrow(TypeError);
    expect(() => new ABClass({ classId: undefined })).toThrow(TypeError);
  });

  it('rejects the retired positional constructor signature', () => {
    expect(() => new ABClass('cid-positional', 'Legacy Class')).toThrow(TypeError);
  });

  it('toJSON() emits cohortKey and yearGroupKey (not legacy cohort/yearGroup)', () => {
    const c = new ABClass({
      classId: 'id-json',
      cohortKey: 'coh-uuid-002',
      yearGroupKey: 'yg-uuid-002',
      courseLength: 2,
      active: true,
    });

    const json = c.toJSON();

    expect(json).toHaveProperty('cohortKey', 'coh-uuid-002');
    expect(json).toHaveProperty('yearGroupKey', 'yg-uuid-002');
    expect(json).not.toHaveProperty('cohort');
    expect(json).not.toHaveProperty('yearGroup');
  });

  it('fromJSON() restores cohortKey and yearGroupKey', () => {
    const data = {
      classId: 'id-restore',
      className: 'Restored Class',
      cohortKey: 'coh-uuid-003',
      yearGroupKey: 'yg-uuid-003',
      courseLength: 1,
      active: false,
      teachers: [],
      students: [],
      assignments: [],
      classOwner: null,
    };

    const restored = ABClass.fromJSON(data);

    expect(restored.classId).toBe('id-restore');
    expect(restored.cohortKey).toBe('coh-uuid-003');
    expect(restored.yearGroupKey).toBe('yg-uuid-003');
    expect(restored.active).toBe(false);
  });

  it('add/remove/find for teachers, students and assignments and serialisation round-trip', () => {
    const c = new ABClass({ classId: 'id-3' });

    const teacher = { uid: 't-1' };
    c.addTeacher(teacher);
    expect(c.findTeacher((t) => t.uid === 't-1')).toBe(teacher);
    expect(c.removeTeacher((t) => t.uid === 't-1')).toBe(teacher);

    const student = { uid: 's-1' };
    c.addStudent(student);
    expect(c.findStudent((s) => s.uid === 's-1')).toBe(student);
    expect(c.removeStudent((s) => s.uid === 's-1')).toBe(student);

    const assignment = { uid: 'a-1' };
    c.addAssignment(assignment);
    expect(c.findAssignment((a) => a.uid === 'a-1')).toBe(assignment);
    expect(c.removeAssignment((a) => a.uid === 'a-1')).toBe(assignment);

    c.addStudent({ uid: 's-2' });
    c.addTeacher({ uid: 't-2' });

    const json = c.toJSON();
    const restored = ABClass.fromJSON(json);
    expect(restored.classId).toBe(c.classId);
    expect(restored.students.length).toBeGreaterThanOrEqual(1);
    expect(restored.teachers.length).toBeGreaterThanOrEqual(1);
  });

  it('toJSON() → fromJSON() round-trip preserves cohortKey and yearGroupKey', () => {
    const original = new ABClass({
      classId: 'id-roundtrip',
      cohortKey: 'coh-uuid-rt',
      yearGroupKey: 'yg-uuid-rt',
      courseLength: 3,
      active: true,
    });

    const restored = ABClass.fromJSON(original.toJSON());

    expect(restored.cohortKey).toBe('coh-uuid-rt');
    expect(restored.yearGroupKey).toBe('yg-uuid-rt');
  });
});
