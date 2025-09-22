import { describe, it, expect } from 'vitest';
import { Teacher } from '../../src/AdminSheet/Models/Teacher.js';

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

  it('setEmail throws on invalid email when Validate is present', () => {
    const t = new Teacher(null, null);
    expect(() => t.setEmail('not-an-email')).toThrow(TypeError);
  });

  it('setUserId throws on invalid id when Validate is present', () => {
    const t = new Teacher(null, null);
    expect(() => t.setUserId('!@#')).toThrow(TypeError);
  });
});
