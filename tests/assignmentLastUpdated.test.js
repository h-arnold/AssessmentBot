// Tests for Assignment.lastUpdated behavior.
//
// Important: the `Assignment` constructor in this codebase attempts to access
// Google Apps Script globals (e.g., `Classroom`, `ProgressTracker`) which are
// not available in the Node/Vitest environment. To avoid these external
// dependencies during unit tests we create assignment instances via
// `Assignment.fromJSON({...})` which rehydrates an instance without invoking
// the constructor. This keeps tests hermetic and FAST.
//
// The tests below verify the public API for managing the `lastUpdated`
// timestamp (touchUpdated, setLastUpdated, serialization) and ensure the
// class stores a copy of the Date to prevent external mutation.
import { describe, it, expect } from 'vitest';
import Assignment from '../src/AdminSheet/AssignmentProcessor/Assignment.js';

describe('Assignment lastUpdated behavior', () => {
  // We call `touchUpdated()` on an instance created via `fromJSON()` to
  // avoid invoking the constructor which expects GAS/Sheet globals. This
  // test asserts that `touchUpdated()` sets `lastUpdated` to a Date near
  // the current time.
  it('touchUpdated sets lastUpdated to a recent Date', () => {
    const a = Assignment.fromJSON({ courseId: 'c1', assignmentId: 'as1' });
    expect(a.getLastUpdated()).toBeNull();
    const before = Date.now();
    const d = a.touchUpdated();
    expect(d).toBeInstanceOf(Date);
    expect(a.getLastUpdated()).toBeInstanceOf(Date);
    const after = Date.now();
    // within reasonable bounds
    expect(d.getTime()).toBeGreaterThanOrEqual(before - 5);
    expect(d.getTime()).toBeLessThanOrEqual(after + 5);
  });

  // setLastUpdated(date) should accept a valid JS Date, store a copy (so
  // external mutations of the original Date don't affect the stored value),
  // and accept `null` to clear the timestamp.
  it('setLastUpdated accepts a Date and stores a copy (immutable)', () => {
    const a = Assignment.fromJSON({ courseId: 'c2', assignmentId: 'as2' });
    const src = new Date(2020, 0, 2, 3, 4, 5);
    const ret = a.setLastUpdated(src);
    expect(ret).toBeInstanceOf(Date);
    expect(ret.getTime()).toBe(src.getTime());
    // mutate source should not change stored
    src.setFullYear(1999);
    expect(a.getLastUpdated().getFullYear()).not.toBe(1999);
    // clearing
    a.setLastUpdated(null);
    expect(a.getLastUpdated()).toBeNull();
  });

  // The method should validate inputs and throw for invalid types like
  // strings, numbers, or invalid Date objects.
  it('setLastUpdated rejects invalid values', () => {
    const a = Assignment.fromJSON({ courseId: 'c3', assignmentId: 'as3' });
    expect(() => a.setLastUpdated('2020-01-01')).toThrow();
    expect(() => a.setLastUpdated(12345)).toThrow();
    expect(() => a.setLastUpdated(new Date('invalid'))).toThrow();
  });

  // Ensure that lastUpdated is serialized to an ISO string by `toJSON()`
  // and restored to a Date object by `fromJSON()` (round-trip).
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
