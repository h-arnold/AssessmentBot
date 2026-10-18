import { describe, it, expect } from 'vitest';
import { Teacher } from '#backend/Models/Teacher.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

describe('Teacher model', () => {
  it('constructor sets email and userId', () => {
    const t = new Teacher('teach@example.com', '12345');
    expect(t.email).toBe('teach@example.com');
    expect(t.userId).toBe('12345');
  });

  it('getters return values', () => {
    const t = new Teacher('a@b.com', 'u1');
    expect(t.getEmail()).toBe('a@b.com');
    expect(t.getUserId()).toBe('u1');
  });

  it('setters update values', () => {
    const t = new Teacher(null, null);
    expect(t.getEmail()).toBeNull();
    t.setEmail('x@y.com');
    expect(t.getEmail()).toBe('x@y.com');
    t.setUserId('999999');
    expect(t.getUserId()).toBe('999999');
    // setting falsy value clears to null
    t.setEmail('');
    t.setUserId(null);
    expect(t.getEmail()).toBeNull();
    expect(t.getUserId()).toBeNull();
  });

  it('toJSON and fromJSON roundtrip', () => {
    const row = loadSyntheticAnalysisProfile('small', 'classPartials')[0].teachers[0];
    const t = Teacher.fromJSON(structuredClone(row));
    const json = t.toJSON();
    expect(json).toEqual(row);
    expect(Object.hasOwn(json, 'teacherName')).toBe(true);
    const restored = Teacher.fromJSON(json);
    expect(restored).toBeInstanceOf(Teacher);
    expect(restored.getEmail()).toBe(row.email);
    expect(restored.getUserId()).toBe(row.userId);
  });

  it('fromJSON returns null for invalid input', () => {
    expect(Teacher.fromJSON(null)).toBeNull();
    expect(Teacher.fromJSON(undefined)).toBeNull();
    expect(Teacher.fromJSON('string')).toBeNull();
  });

  describe('setTeacherName', () => {
    it('sets teacherName for a valid string name', () => {
      const t = new Teacher(null, null);
      t.setTeacherName('Jane Doe');
      expect(t.getTeacherName()).toBe('Jane Doe');
    });

    it('clears teacherName when called with null', () => {
      const t = new Teacher('a@b.com', 'u1');
      t.setTeacherName('Jane Doe');
      t.setTeacherName(null);
      expect(t.getTeacherName()).toBeNull();
    });

    it('clears teacherName when called with empty string', () => {
      const t = new Teacher('a@b.com', 'u1');
      t.setTeacherName('Jane Doe');
      t.setTeacherName('');
      expect(t.getTeacherName()).toBeNull();
    });

    it('always throws TypeError for a non-string name without changing teacherName', () => {
      const t = new Teacher(null, null, 'Jane Doe');
      expect(() => t.setTeacherName(123)).toThrow(TypeError);
      expect(t.getTeacherName()).toBe('Jane Doe');
    });
  });

  describe('setEmail', () => {
    it('sets email for a valid email address', () => {
      const t = new Teacher(null, null);
      t.setEmail('teacher@school.edu');
      expect(t.getEmail()).toBe('teacher@school.edu');
    });

    it('clears email when called with null', () => {
      const t = new Teacher('old@school.edu', 'u1');
      t.setEmail(null);
      expect(t.getEmail()).toBeNull();
    });

    it('always throws TypeError for an invalid email without changing email', () => {
      const t = new Teacher('teacher@school.edu', null);
      expect(() => t.setEmail('not-an-email')).toThrow(TypeError);
      expect(t.getEmail()).toBe('teacher@school.edu');
    });
  });

  describe('setUserId', () => {
    it('sets userId for a valid id', () => {
      const t = new Teacher(null, null);
      t.setUserId('12345678901234567890');
      expect(t.getUserId()).toBe('12345678901234567890');
    });

    it('clears userId when called with null', () => {
      const t = new Teacher('a@b.com', 'u1');
      t.setUserId(null);
      expect(t.getUserId()).toBeNull();
    });

    it('always throws TypeError for an invalid userId without changing userId', () => {
      const t = new Teacher(null, '12345678901234567890');
      expect(() => t.setUserId('!@#')).toThrow(TypeError);
      expect(t.getUserId()).toBe('12345678901234567890');
    });
  });

  describe('fromJSON', () => {
    it('creates a Teacher from full data including teacherName', () => {
      const t = Teacher.fromJSON({
        email: 'teacher@school.edu',
        userId: 'u123',
        teacherName: 'John Smith',
      });
      expect(t).toBeInstanceOf(Teacher);
      expect(t.getEmail()).toBe('teacher@school.edu');
      expect(t.getUserId()).toBe('u123');
      expect(t.getTeacherName()).toBe('John Smith');
    });

    it('creates a Teacher from data without teacherName', () => {
      const t = Teacher.fromJSON({
        email: 'teacher@school.edu',
        userId: 'u123',
      });
      expect(t).toBeInstanceOf(Teacher);
      expect(t.getEmail()).toBe('teacher@school.edu');
      expect(t.getUserId()).toBe('u123');
      expect(t.getTeacherName()).toBeNull();
    });

    it('returns null for null input', () => {
      expect(Teacher.fromJSON(null)).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(Teacher.fromJSON('string')).toBeNull();
      expect(Teacher.fromJSON(42)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(Teacher.fromJSON(undefined)).toBeNull();
    });
  });

  describe('toJSON', () => {
    it('includes teacherName when set', () => {
      const t = new Teacher('a@b.com', 'u1', 'Jane');
      expect(t.toJSON()).toEqual({
        email: 'a@b.com',
        userId: 'u1',
        teacherName: 'Jane',
      });
    });

    it('emits an own null teacherName when not set', () => {
      const t = new Teacher('a@b.com', 'u1');
      const json = t.toJSON();
      expect(json.email).toBe('a@b.com');
      expect(json.userId).toBe('u1');
      expect(json).toHaveProperty('teacherName', null);
      expect(Object.hasOwn(json, 'teacherName')).toBe(true);
    });

    it.each(['unset', 'explicit null', 'cleared'])('emits null when name is %s', (state) => {
      const teacher = new Teacher('a@b.com', 'u1', state === 'cleared' ? 'Jane' : null);
      if (state === 'cleared') teacher.setTeacherName(null);
      const json = teacher.toJSON();
      expect(Object.hasOwn(json, 'teacherName')).toBe(true);
      expect(json.teacherName).toBeNull();
      expect(json.email).toBe('a@b.com');
      expect(json.userId).toBe('u1');
    });

    it('restores a legacy canonical teacher row without a name and emits null', () => {
      const row = structuredClone(
        loadSyntheticAnalysisProfile('small', 'classPartials')[0].teachers[0]
      );
      delete row.teacherName;
      const json = Teacher.fromJSON(row).toJSON();
      expect(Object.hasOwn(json, 'teacherName')).toBe(true);
      expect(json.teacherName).toBeNull();
      expect(json.email).toBe(row.email);
      expect(json.userId).toBe(row.userId);
    });

    it('roundtrips with fromJSON', () => {
      const original = new Teacher('x@y.com', 'id123', 'Alice');
      const json = original.toJSON();
      const restored = Teacher.fromJSON(json);
      expect(restored.getEmail()).toBe('x@y.com');
      expect(restored.getUserId()).toBe('id123');
      expect(restored.getTeacherName()).toBe('Alice');
    });
  });
});
