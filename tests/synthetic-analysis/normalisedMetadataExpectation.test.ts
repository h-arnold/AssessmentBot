import { describe, expect, it } from 'vitest';

import { normalisedMetadataExpectation } from '@synthetic/normalisedMetadataExpectation';

const PLACEHOLDER_FIELDS = ['baselineAverages', 'allTaskStandings', 'baselineStandings'] as const;
const FIVE_FIELDS = [
  'allTaskStandings',
  'baselineAverages',
  'baselineStandings',
  'classAverages',
  'recentAssignments',
] as const;

/**
 * Builds a legacy two-field snapshot with values known by construction. The corpus deliberately
 * supplies only null or five-field metadata, so these boundary inputs stay local.
 * @returns A detached two-field raw snapshot.
 */
function legacySnapshot(): Record<string, unknown> {
  return {
    classAverages: { score: 1 },
    recentAssignments: [{ assignmentId: 'assignment-0' }],
  };
}

/**
 * Builds a current five-field snapshot with distinct supplied values known by construction.
 * @returns A detached five-field raw snapshot.
 */
function fiveFieldSnapshot(): Record<string, unknown> {
  return {
    ...legacySnapshot(),
    baselineAverages: { baselineScore: 2 },
    allTaskStandings: { top: ['student-0'] },
    baselineStandings: { top: ['student-1'] },
  };
}

describe('normalisedMetadataExpectation boundary contract', () => {
  it('keeps a whole-metadata null as null', () => {
    expect(normalisedMetadataExpectation(null)).toBeNull();
  });

  it('gains enumerable null placeholders for a legacy two-field snapshot and stays detached', () => {
    const input = legacySnapshot();
    const result = normalisedMetadataExpectation(input) as Record<string, unknown>;

    expect(result).not.toBe(input);
    expect(Object.keys(result).sort()).toEqual([...FIVE_FIELDS].sort());
    for (const field of PLACEHOLDER_FIELDS) {
      expect(result[field]).toBeNull();
      expect(Object.prototype.propertyIsEnumerable.call(result, field)).toBe(true);
    }
    expect(result.classAverages).toEqual(input.classAverages);
    expect(result.recentAssignments).toEqual(input.recentAssignments);

    result.baselineAverages = { injected: true };
    expect(input).not.toHaveProperty('baselineAverages');
    (result.classAverages as Record<string, unknown>).score = 99;
    expect((input.classAverages as Record<string, unknown>).score).toBe(1);
  });

  it('preserves supplied five-field values and stays detached', () => {
    const input = fiveFieldSnapshot();
    const result = normalisedMetadataExpectation(input) as Record<string, unknown>;

    expect(result).not.toBe(input);
    for (const field of FIVE_FIELDS) {
      expect(result[field]).toEqual(input[field]);
    }
  });

  it('normalises a null-prototype snapshot to a detached five-field object', () => {
    const input = Object.assign(Object.create(null) as Record<string, unknown>, legacySnapshot());
    const result = normalisedMetadataExpectation(input) as Record<string, unknown>;

    expect(result).not.toBe(input);
    expect(Object.keys(result).sort()).toEqual([...FIVE_FIELDS].sort());
    for (const field of PLACEHOLDER_FIELDS) {
      expect(result[field]).toBeNull();
    }
    expect(result.classAverages).toEqual(input.classAverages);
  });

  it('rejects an array with a received-array diagnostic', () => {
    expect(() => normalisedMetadataExpectation([])).toThrow(TypeError);
    expect(() => normalisedMetadataExpectation([])).toThrow(/received array/u);
  });

  it.each([
    { label: 'number', value: 42, diagnostic: /received number/u },
    { label: 'string', value: 'metadata', diagnostic: /received string/u },
    { label: 'undefined', value: undefined, diagnostic: /received undefined/u },
  ])('rejects a $label with its received-type diagnostic', ({ value, diagnostic }) => {
    expect(() => normalisedMetadataExpectation(value)).toThrow(TypeError);
    expect(() => normalisedMetadataExpectation(value)).toThrow(diagnostic);
  });
});
