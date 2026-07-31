/**
 * Tests for `encodeMetricFilter` and `decodeMetricFilter` — range filter key
 * encoding/decoding helpers.
 *
 * @see metricRangeKey.ts
 */

import { describe, it, expect } from 'vitest';
import { encodeMetricFilter, decodeMetricFilter, decodeFilterToRange } from './metricRangeKey';

describe('encodeMetricFilter', () => {
  it('encodes both flags as 0 when false', () => {
    const result = encodeMetricFilter({
      min: 0,
      max: 5,
      includeNotAttempted: false,
      includeError: false,
    });
    expect(result).toBe('0|5|0|0');
  });

  it('encodes both flags as 1 when true', () => {
    const result = encodeMetricFilter({
      min: 1,
      max: 4,
      includeNotAttempted: true,
      includeError: true,
    });
    expect(result).toBe('1|4|1|1');
  });

  it('encodes includeNotAttempted as 1 and includeError as 0', () => {
    const result = encodeMetricFilter({
      min: 0,
      max: 5,
      includeNotAttempted: true,
      includeError: false,
    });
    expect(result).toBe('0|5|1|0');
  });

  it('encodes includeNotAttempted as 0 and includeError as 1', () => {
    const result = encodeMetricFilter({
      min: 0,
      max: 5,
      includeNotAttempted: false,
      includeError: true,
    });
    expect(result).toBe('0|5|0|1');
  });
});

describe('decodeMetricFilter', () => {
  // -------------------------------------------------------------------------
  // Valid keys
  // -------------------------------------------------------------------------

  it('decodes a valid 4-part key with both flags false', () => {
    expect(decodeMetricFilter('0|5|0|0')).toEqual({
      min: 0,
      max: 5,
      includeNotAttempted: false,
      includeError: false,
    });
  });

  it('decodes a valid 4-part key with both flags true', () => {
    expect(decodeMetricFilter('1|4|1|1')).toEqual({
      min: 1,
      max: 4,
      includeNotAttempted: true,
      includeError: true,
    });
  });

  it('decodes a 2-part key (no flags) with both flags defaulting to false', () => {
    // A 2-part key has parts.length === RANGE_KEY_PART_COUNT (2), so it passes
    // the length check, then parseFlag(undefined) returns false for both flags.
    const result = decodeMetricFilter('0|5');
    expect(result).toEqual({
      min: 0,
      max: 5,
      includeNotAttempted: false,
      includeError: false,
    });
  });

  // -------------------------------------------------------------------------
  // Invalid inputs — non-string
  // -------------------------------------------------------------------------

  it('returns null for null input', () => {
    expect(decodeMetricFilter(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(decodeMetricFilter()).toBeNull();
  });

  /** Arbitrary number used to test that non-string inputs return null. */
  const NON_STRING_NUMBER = 42;

  it('returns null for a number input', () => {
    expect(decodeMetricFilter(NON_STRING_NUMBER)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Invalid inputs — string without the separator
  // -------------------------------------------------------------------------

  it('returns null for an empty string', () => {
    expect(decodeMetricFilter('')).toBeNull();
  });

  it('returns null for a string without the separator', () => {
    expect(decodeMetricFilter('05')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Invalid inputs — NaN range values
  // -------------------------------------------------------------------------

  it('returns null when min part is not a number', () => {
    expect(decodeMetricFilter('abc|5|0|0')).toBeNull();
  });

  it('returns null when max part is not a number', () => {
    expect(decodeMetricFilter('0|abc|0|0')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Round-trip
  // -------------------------------------------------------------------------

  it('round-trips encode then decode', () => {
    const state = {
      min: 2.5,
      max: 4,
      includeNotAttempted: true,
      includeError: false,
    };
    const encoded = encodeMetricFilter(state);
    const decoded = decodeMetricFilter(encoded);
    expect(decoded).toEqual(state);
  });
});

describe('decodeFilterToRange', () => {
  it('returns an empty array when the filter value is null', () => {
    expect(decodeFilterToRange(null)).toEqual([]);
  });

  it('returns an empty array when the filter value is empty', () => {
    expect(decodeFilterToRange([])).toEqual([]);
  });

  it('returns the decoded [min, max] for a valid key', () => {
    expect(decodeFilterToRange(['0|5|0|0'])).toEqual([0, 5]);
  });

  it('returns an empty array when the key cannot be decoded', () => {
    expect(decodeFilterToRange(['not-a-valid-key'])).toEqual([]);
  });
});
