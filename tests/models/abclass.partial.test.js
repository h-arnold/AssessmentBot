import { describe, it, expect } from 'vitest';
import { ABClass } from '../../src/backend/Models/ABClass.js';

/**
 * RED tests for Section 1 of ACTION_PLAN.md:
 * "Define and lock class-partial data contract"
 *
 * These tests will fail until the following is implemented in ABClass.js:
 *   - toJSON() includes `active` and `classOwner`
 *   - fromJSON() restores `active`
 *   - toPartialJSON() method is added
 */
describe('ABClass – partial data contract (RED)', () => {
  /** Minimal plain-object owner stub; avoids Teacher global dependency in tests. */
  const stubOwner = { uid: 'owner-1', teacherName: 'Ms Owner', email: 'owner@school.example' };

  /**
   * Factory that constructs a fully-populated ABClass without relying on
   * ConfigurationManager (classId is supplied directly).
   *
   * Direct construction is safe here because classId is always truthy, so the
   * branch inside ABClass that delegates to ConfigurationManager for a GAS-derived
   * classId is never reached.
   */
  function makeClass(overrides = {}) {
    const inst = new ABClass(
      overrides.classId ?? 'cls-test-1',
      overrides.className ?? 'Test Class',
      overrides.cohort ?? 2024,
      overrides.courseLength ?? 2,
      overrides.yearGroup ?? 10,
      overrides.classOwner ?? stubOwner
    );
    if (Object.prototype.hasOwnProperty.call(overrides, 'active')) {
      inst.active = overrides.active;
    }
    return inst;
  }

  // ─── toJSON contract ────────────────────────────────────────────────────────

  describe('toJSON()', () => {
    it('includes `active` in serialised output when active is true', () => {
      const inst = makeClass({ active: true });
      const json = inst.toJSON();
      expect(json).toHaveProperty('active', true);
    });

    it('includes `active` in serialised output when active is false', () => {
      const inst = makeClass({ active: false });
      const json = inst.toJSON();
      expect(json).toHaveProperty('active', false);
    });

    it('includes `classOwner` in serialised output', () => {
      const inst = makeClass();
      const json = inst.toJSON();
      expect(json).toHaveProperty('classOwner');
      expect(json.classOwner).toEqual(stubOwner);
    });
  });

  // ─── fromJSON round-trip contract ──────────────────────────────────────────

  describe('fromJSON()', () => {
    it('restores `active: false` from a round-tripped JSON payload', () => {
      const inst = makeClass({ active: false });
      const json = inst.toJSON();
      const restored = ABClass.fromJSON(json);
      expect(restored.active).toBe(false);
    });

    it('restores `active: true` from a round-tripped JSON payload', () => {
      const inst = makeClass({ active: true });
      const json = inst.toJSON();
      const restored = ABClass.fromJSON(json);
      expect(restored.active).toBe(true);
    });

    it('restores `classOwner` via a full toJSON → fromJSON round-trip', () => {
      const inst = makeClass();
      const json = inst.toJSON();
      // toJSON must include classOwner for fromJSON to restore it.
      // Note: stubOwner is a plain object, not a Teacher instance. This test
      // assumes Teacher is NOT registered as a global in setupGlobals.js; if it
      // ever is, fromJSON may reconstruct a Teacher instance and this assertion
      // may need revisiting.
      const restored = ABClass.fromJSON(json);
      expect(restored.classOwner).not.toBeNull();
      expect(restored.classOwner).toEqual(stubOwner);
    });
  });

  // ─── toPartialJSON contract ─────────────────────────────────────────────────

  describe('toPartialJSON()', () => {
    it('exists as a method on ABClass instances', () => {
      const inst = makeClass({ active: true });
      expect(typeof inst.toPartialJSON).toBe('function');
    });

    it('returns the expected keys: classId, className, cohort, courseLength, yearGroup, classOwner, teachers, active', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();
      const expectedKeys = [
        'classId',
        'className',
        'cohort',
        'courseLength',
        'yearGroup',
        'classOwner',
        'teachers',
        'active',
      ];
      expectedKeys.forEach((key) => {
        expect(partial, `expected key "${key}" to be present`).toHaveProperty(key);
      });
    });

    it('omits `students` from partial output', () => {
      const inst = makeClass({ active: true });
      inst.addStudent({ uid: 's-1' });
      const partial = inst.toPartialJSON();
      expect(partial).not.toHaveProperty('students');
    });

    it('omits `assignments` from partial output', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();
      expect(partial).not.toHaveProperty('assignments');
    });

    it('is stable when optional fields (className, cohort, yearGroup, classOwner) are null', () => {
      const inst = new ABClass('cls-minimal');
      inst.active = false;
      // All optional fields default to null — should not throw
      expect(() => inst.toPartialJSON()).not.toThrow();
      const partial = inst.toPartialJSON();
      expect(partial.classId).toBe('cls-minimal');
      expect(partial.className).toBeNull();
      expect(partial.cohort).toBeNull();
      expect(partial.yearGroup).toBeNull();
      expect(partial.classOwner).toBeNull();
      expect(partial.active).toBe(false);
    });

    it('returns correct values for all expected keys', () => {
      const inst = makeClass({ active: true });
      const partial = inst.toPartialJSON();
      expect(partial.classId).toBe('cls-test-1');
      expect(partial.className).toBe('Test Class');
      expect(partial.cohort).toBe('2024');
      expect(partial.courseLength).toBe(2);
      expect(partial.yearGroup).toBe(10);
      expect(partial.classOwner).toEqual(stubOwner);
      expect(partial.active).toBe(true);
      expect(Array.isArray(partial.teachers)).toBe(true);
    });
  });
});
