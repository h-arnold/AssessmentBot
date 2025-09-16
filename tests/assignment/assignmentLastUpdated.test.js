import { describe, it, expect } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';

describe('Assignment lastUpdated behavior', () => {
  it('touchUpdated sets lastUpdated to a recent Date', () => {
    const a = Assignment.fromJSON({ courseId: 'c1', assignmentId: 'as1' });
    expect(a.getLastUpdated()).toBeNull();
    const before = Date.now();
    const d = a.touchUpdated();
    expect(d).toBeInstanceOf(Date);
    expect(a.getLastUpdated()).toBeInstanceOf(Date);
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before - 5);
    expect(d.getTime()).toBeLessThanOrEqual(after + 5);
  });

  it('setLastUpdated accepts a Date and stores a copy (immutable)', () => {
    const a = Assignment.fromJSON({ courseId: 'c2', assignmentId: 'as2' });
    const src = new Date(2020, 0, 2, 3, 4, 5);
    const ret = a.setLastUpdated(src);
    expect(ret).toBeInstanceOf(Date);
    expect(ret.getTime()).toBe(src.getTime());
    src.setFullYear(1999);
    expect(a.getLastUpdated().getFullYear()).not.toBe(1999);
    a.setLastUpdated(null);
    expect(a.getLastUpdated()).toBeNull();
  });

  it('setLastUpdated rejects invalid values', () => {
    const a = Assignment.fromJSON({ courseId: 'c3', assignmentId: 'as3' });
    expect(() => a.setLastUpdated('2020-01-01')).toThrow();
    expect(() => a.setLastUpdated(12345)).toThrow();
    expect(() => a.setLastUpdated(new Date('invalid'))).toThrow();
  });

  it('toJSON and fromJSON preserve lastUpdated', () => {
    const a = Assignment.fromJSON({ courseId: 'c4', assignmentId: 'as4' });
    a.setLastUpdated(new Date(2021, 5, 6, 7, 8, 9));
    const json = a.toJSON();
    expect(json.lastUpdated).toBeTruthy();
    const restored = Assignment.fromJSON(json);
    expect(restored.getLastUpdated()).toBeInstanceOf(Date);
    expect(restored.getLastUpdated().getTime()).toBe(a.getLastUpdated().getTime());
  });
});
