import { describe, it, expect } from 'vitest';
import { ABClass } from '../../src/backend/Models/ABClass.js';

/**
 * ABClass partial data contract – key-based metadata.
 *
 * Encodes the Part 1 contract: ABClass stores cohortKey/yearGroupKey and
 * toPartialJSON() emits keys plus resolved labels (cohortLabel, yearGroupLabel).
 */
describe('ABClass – partial data contract (key-based)', () => {
  /** Minimal plain-object owner stub; avoids Teacher global dependency in tests. */
  const stubOwner = { uid: 'owner-1', teacherName: 'Ms Owner', email: 'owner@school.example' };

  function makeClass(overrides = {}) {
    const inst = new ABClass({
      classId: overrides.classId ?? 'cls-test-1',
      className: overrides.className ?? 'Test Class',
      cohortKey: overrides.cohortKey ?? 'coh-uuid-test',
      courseLength: overrides.courseLength ?? 2,
      yearGroupKey: overrides.yearGroupKey ?? 'yg-uuid-test',
      classOwner: overrides.classOwner ?? stubOwner,
      cohortLabel: overrides.cohortLabel ?? '2024-2025',
      yearGroupLabel: overrides.yearGroupLabel ?? 'Year 10',
    });
    if (Object.prototype.hasOwnProperty.call(overrides, 'active')) {
      inst.active = overrides.active;
    }
    return inst;
  }

  // ─── toJSON contract ────────────────────────────────────────────────────────

  describe('toJSON()', () => {
    it('includes `active` in serialised output when active is true', () => {
      const inst = makeClass({ active: true });
      expect(inst.toJSON()).toHaveProperty('active', true);
    });

    it('includes `active` in serialised output when active is false', () => {
      const inst = makeClass({ active: false });
      expect(inst.toJSON()).toHaveProperty('active', false);
    });

    it('includes `classOwner` in serialised output', () => {
      const inst = makeClass();
      const json = inst.toJSON();
      expect(json).toHaveProperty('classOwner');
      expect(json.classOwner).toEqual(stubOwner);
    });

    it('emits cohortKey and yearGroupKey instead of legacy cohort/yearGroup', () => {
      const inst = makeClass({ cohortKey: 'coh-uuid-001', yearGroupKey: 'yg-uuid-001' });
      const json = inst.toJSON();

      expect(json).toHaveProperty('cohortKey', 'coh-uuid-001');
      expect(json).toHaveProperty('yearGroupKey', 'yg-uuid-001');
      expect(json).not.toHaveProperty('cohort');
      expect(json).not.toHaveProperty('yearGroup');
    });
  });

  // ─── fromJSON round-trip contract ──────────────────────────────────────────

  describe('fromJSON()', () => {
    it('restores `active: false` from a round-tripped JSON payload', () => {
      const inst = makeClass({ active: false });
      const restored = ABClass.fromJSON(inst.toJSON());
      expect(restored.active).toBe(false);
    });

    it('restores `active: true` from a round-tripped JSON payload', () => {
      const inst = makeClass({ active: true });
      const restored = ABClass.fromJSON(inst.toJSON());
      expect(restored.active).toBe(true);
    });

    it('restores `classOwner` via a full toJSON → fromJSON round-trip', () => {
      const inst = makeClass();
      const restored = ABClass.fromJSON(inst.toJSON());
      expect(restored.classOwner).not.toBeNull();
      expect(restored.classOwner).toEqual(stubOwner);
    });

    it('restores cohortKey and yearGroupKey from round-tripped JSON', () => {
      const inst = makeClass({ cohortKey: 'coh-uuid-rt', yearGroupKey: 'yg-uuid-rt' });
      const restored = ABClass.fromJSON(inst.toJSON());
      expect(restored.cohortKey).toBe('coh-uuid-rt');
      expect(restored.yearGroupKey).toBe('yg-uuid-rt');
    });
  });

  // ─── toPartialJSON contract ─────────────────────────────────────────────────

  describe('toPartialJSON()', () => {
    it('exists as a method on ABClass instances', () => {
      expect(typeof makeClass({ active: true }).toPartialJSON).toBe('function');
    });

    it('returns cohortKey and yearGroupKey in partial output', () => {
      const inst = makeClass({ cohortKey: 'coh-uuid-p', yearGroupKey: 'yg-uuid-p', active: true });
      const partial = inst.toPartialJSON();

      expect(partial).toHaveProperty('cohortKey', 'coh-uuid-p');
      expect(partial).toHaveProperty('yearGroupKey', 'yg-uuid-p');
    });

    it('returns cohortLabel and yearGroupLabel in partial output', () => {
      const inst = makeClass({
        cohortLabel: '2024-2025',
        yearGroupLabel: 'Year 10',
        active: true,
      });
      const partial = inst.toPartialJSON();

      expect(partial).toHaveProperty('cohortLabel', '2024-2025');
      expect(partial).toHaveProperty('yearGroupLabel', 'Year 10');
    });

    it('does not include legacy cohort or yearGroup fields in partial output', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();

      expect(partial).not.toHaveProperty('cohort');
      expect(partial).not.toHaveProperty('yearGroup');
    });

    it('returns the expected keys: classId, className, cohortKey, yearGroupKey, cohortLabel, yearGroupLabel, courseLength, classOwner, teachers, active', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();
      const expectedKeys = [
        'classId',
        'className',
        'cohortKey',
        'yearGroupKey',
        'cohortLabel',
        'yearGroupLabel',
        'courseLength',
        'classOwner',
        'teachers',
        'active',
      ];
      for (const key of expectedKeys) {
        expect(partial, `expected key "${key}" to be present`).toHaveProperty(key);
      }
    });

    it('omits `students` from partial output', () => {
      const inst = makeClass({ active: true });
      inst.addStudent({ uid: 's-1' });
      expect(inst.toPartialJSON()).not.toHaveProperty('students');
    });

    it('omits `assignments` from partial output', () => {
      expect(makeClass({ active: true }).toPartialJSON()).not.toHaveProperty('assignments');
    });

    it('is stable when optional key fields (cohortKey, yearGroupKey, cohortLabel, yearGroupLabel, classOwner) are null', () => {
      const inst = new ABClass({ classId: 'cls-minimal' });
      inst.active = false;

      expect(() => inst.toPartialJSON()).not.toThrow();
      const partial = inst.toPartialJSON();
      expect(partial.classId).toBe('cls-minimal');
      expect(partial.cohortKey).toBeNull();
      expect(partial.yearGroupKey).toBeNull();
      expect(partial.classOwner).toBeNull();
      expect(partial.active).toBe(false);
    });

    it('returns correct values for all expected keys', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();

      expect(partial.classId).toBe('cls-test-1');
      expect(partial.className).toBe('Test Class');
      expect(partial.cohortKey).toBe('coh-uuid-test');
      expect(partial.yearGroupKey).toBe('yg-uuid-test');
      expect(partial.cohortLabel).toBe('2024-2025');
      expect(partial.yearGroupLabel).toBe('Year 10');
      expect(partial.courseLength).toBe(2);
      expect(partial.classOwner).toEqual(stubOwner);
      expect(partial.active).toBe(true);
      expect(Array.isArray(partial.teachers)).toBe(true);
    });
  });
});
