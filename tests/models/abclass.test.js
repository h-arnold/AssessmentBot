import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ABClass } from '../../src/AdminSheet/Models/ABClass.js';

describe('ABClass model', () => {
  let origConfigMgr;

  beforeEach(() => {
    origConfigMgr = globalThis.ConfigurationManager;
  });

  afterEach(() => {
    // restore original global ConfigurationManager (may be undefined)
    globalThis.ConfigurationManager = origConfigMgr;
  });

  it('uses provided classId when present', () => {
    const c = new ABClass('cid-1', 'Class Name', 2025, 1, 7, ['t1'], ['s1'], ['a1']);
    expect(c.getClassId()).toBe('cid-1');
    expect(c.getClassName()).toBe('Class Name');
    expect(c.cohort).toBe('2025');
    expect(c.courseLength).toBe(1);
    expect(c.yearGroup).toBe(7);
  });

  it('falls back to ConfigurationManager when classId missing', () => {
    // Provide a fake constructor function with a getInstance static that returns the expected API
    function FakeConfigurationManager() {}
    FakeConfigurationManager.getInstance = () => ({
      getAssessmentRecordCourseId: () => 'cfg-course-123',
    });
    globalThis.ConfigurationManager = FakeConfigurationManager;

    const c = new ABClass(null, 'Fallback Class');
    expect(c.getClassId()).toBe('cfg-course-123');
    expect(c.getClassName()).toBe('Fallback Class');
  });

  it('throws when neither classId nor ConfigurationManager provide an id', () => {
    // Ensure no ConfigurationManager is present
    delete globalThis.ConfigurationManager;
    expect(() => new ABClass(undefined)).toThrow(TypeError);
  });

  it('cohort helpers and year ranges work as expected', () => {
    const c = new ABClass('id-2', null, 2023, 2);
    expect(c.getCohortStartYear()).toBe(2023);
    expect(c.getCohortYearRanges()).toEqual(['2023-2024', '2024-2025']);
  });

  it('add/remove/find for teachers, students and assignments and serialization', () => {
    const c = new ABClass('id-3');

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

    // Serialization roundtrip
    c.addStudent({ uid: 's-2' });
    c.addTeacher({ uid: 't-2' });
    const json = c.toJSON();
    const restored = ABClass.fromJSON(json);
    expect(restored.classId).toBe(c.classId);
    expect(restored.students.length).toBeGreaterThanOrEqual(1);
    expect(restored.teachers.length).toBeGreaterThanOrEqual(1);
  });
});
