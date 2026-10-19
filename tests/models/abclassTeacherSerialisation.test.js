import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const { Teacher } = require('#backend/Models/Teacher.js');

const clone = (value) => structuredClone(value);

function canonicalClass() {
  const row = Object.values(loadBackendModelInputs('small').classesById)[0];
  return withTemporaryGlobals({ Teacher: () => Teacher }, () => ABClass.fromJSON(clone(row)));
}

describe('ABClass Teacher serialisation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits null names for real owner and Teacher instances in full and partial JSON', () => {
    const abClass = canonicalClass();
    const owner = new Teacher(abClass.classOwner.email, abClass.classOwner.userId);
    owner.setTeacherName(null);
    abClass.classOwner = owner;
    abClass.teachers = abClass.teachers.map((teacher) =>
      Teacher.fromJSON({ email: teacher.email, userId: teacher.userId })
    );

    for (const output of [abClass.toJSON(), abClass.toPartialJSON()]) {
      expect(Object.hasOwn(output.classOwner, 'teacherName')).toBe(true);
      expect(output.classOwner.teacherName).toBeNull();
      expect(output.teachers).toHaveLength(abClass.teachers.length);
      for (const teacher of output.teachers) {
        expect(Object.hasOwn(teacher, 'teacherName')).toBe(true);
        expect(teacher.teacherName).toBeNull();
      }
    }
  });

  it('preserves named Teacher output and leaves legacy plain teacher rows untouched', () => {
    const abClass = canonicalClass();
    const named = new Teacher('named@example.test', 'canonical-user', 'Canonical Teacher');
    abClass.classOwner = named;
    const plainLegacyTeacher = { email: 'legacy@example.test', userId: 'legacy-user' };
    abClass.teachers = [plainLegacyTeacher];
    const full = abClass.toJSON();
    const partial = abClass.toPartialJSON();

    expect(full.classOwner).toEqual({
      email: 'named@example.test',
      userId: 'canonical-user',
      teacherName: 'Canonical Teacher',
    });
    expect(partial.classOwner).toEqual(full.classOwner);
    expect(full.teachers[0]).toBe(plainLegacyTeacher);
    expect(partial.teachers[0]).toBe(plainLegacyTeacher);
    expect(full.teachers[0]).not.toHaveProperty('teacherName');
    expect(partial.teachers[0]).not.toHaveProperty('teacherName');
  });
});
