import { describe, it, expect } from 'vitest';
import { Teacher } from '../../src/backend/Models/Teacher.js';
import { Validate } from '../../src/backend/Utils/Validate.js';

// Ensure model validation hooks are present for tests that assert validation behavior
Teacher.prototype._Validate = Validate;

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
    const t = new Teacher('me@you.org', 'u-abc');
    const json = t.toJSON();
    expect(json).toEqual({ email: 'me@you.org', userId: 'u-abc' });
    const restored = Teacher.fromJSON(json);
    expect(restored).toBeInstanceOf(Teacher);
    expect(restored.getEmail()).toBe('me@you.org');
    expect(restored.getUserId()).toBe('u-abc');
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

    it('throws TypeError for non-string name when Validate is present', () => {
      const t = new Teacher(null, null);
      expect(() => t.setTeacherName(123)).toThrow(TypeError);
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

    it('throws TypeError for invalid email when Validate is present', () => {
      const t = new Teacher(null, null);
      expect(() => t.setEmail('not-an-email')).toThrow(TypeError);
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

    it('throws TypeError for invalid userId when Validate is present', () => {
      const t = new Teacher(null, null);
      expect(() => t.setUserId('!@#')).toThrow(TypeError);
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

    it('omits teacherName when not set', () => {
      const t = new Teacher('a@b.com', 'u1');
      const json = t.toJSON();
      expect(json.email).toBe('a@b.com');
      expect(json.userId).toBe('u1');
      expect(json.teacherName).toBeUndefined();
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
