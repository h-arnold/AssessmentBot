import { describe, expect, it } from 'vitest';
import type { YearGroup } from '../../services/referenceData/referenceData.zod';
import { sortYearGroups } from './yearGroupSorting';

/**
 * Extracts year-group names in their current order.
 *
 * @param {YearGroup[]} yearGroups Year groups to inspect.
 * @returns {string[]} Year-group names.
 */
function names(yearGroups: YearGroup[]): string[] {
  return yearGroups.map((yearGroup) => yearGroup.name);
}

/**
 * Sorts the supplied year groups and returns their names in presentation order.
 *
 * Wraps `names(sortYearGroups(...))` so the repeated token stream collapses into one
 * call site.
 *
 * @param {YearGroup[]} yearGroups Year groups to order.
 * @returns {string[]} Sorted year-group names.
 */
function sortedNames(yearGroups: YearGroup[]): string[] {
  return names(sortYearGroups(yearGroups));
}

describe('sortYearGroups', () => {
  it('orders mixed labels in natural presentation order with alphabetical fallback', () => {
    // One canonical presentation-order scenario covering every ordering facet of
    // the comparator: numeric-aware ordering for number-led ('1 Foundation' <
    // '2 Junior' < '10 Senior') and embedded-number ('Year 9' < 'Year 10' <
    // 'Year 11') labels, alphabetical fallback for non-numeric labels, ordering
    // across numeric and non-numeric families, and case-insensitive comparison
    // ('Alpha' before 'beta'). The input is deliberately scrambled.
    expect(
      sortedNames([
        { key: 'z', name: 'Senior' },
        { key: 'y10', name: 'Year 10' },
        { key: '10', name: '10 Senior' },
        { key: '11', name: 'Year 11' },
        { key: '2', name: '2 Junior' },
        { key: 'b', name: 'beta' },
        { key: 'a', name: 'Alpha' },
        { key: '9', name: 'Year 9' },
        { key: '1', name: '1 Foundation' },
        { key: 'sixth', name: 'Sixth Form' },
      ])
    ).toEqual([
      '1 Foundation',
      '2 Junior',
      '10 Senior',
      'Alpha',
      'beta',
      'Senior',
      'Sixth Form',
      'Year 9',
      'Year 10',
      'Year 11',
    ]);
  });

  it('uses the key as a strict deterministic tie-break for duplicate labels', () => {
    expect(
      sortYearGroups([
        { key: 'group-b', name: 'Year 10' },
        { key: 'GROUP-a', name: 'year 10' },
      ]).map((yearGroup) => yearGroup.key)
    ).toEqual(['GROUP-a', 'group-b']);
  });

  it('orders year groups whose keys differ only by letter case', () => {
    // The name comparison is case-insensitive, so the key tie-break applies. The
    // default ICU collation is case-sensitive (tertiary strength); Node's ICU root
    // collation places the lowercase 'y' key before the uppercase 'Y' key, so the
    // ordering is deterministic regardless of input order.
    const sortedKeys = sortYearGroups([
      { key: 'YEAR-10', name: 'Year 10' },
      { key: 'year-10', name: 'Year 10' },
    ]).map((yearGroup) => yearGroup.key);
    expect(sortedKeys).toEqual(['year-10', 'YEAR-10']);
  });

  it('orders year groups whose keys differ only by diacritics', () => {
    // The name comparison is case-insensitive, so the key tie-break applies. The
    // default ICU collation is variant-sensitive, so diacritically distinct keys
    // yield a deterministic, non-zero ordering rather than collapsing together.
    const sortedKeys = sortYearGroups([
      { key: 'yéar-10', name: 'Year 10' },
      { key: 'year-10', name: 'Year 10' },
    ]).map((yearGroup) => yearGroup.key);
    expect(sortedKeys).toEqual(['year-10', 'yéar-10']);
  });

  it('does not mutate the source array', () => {
    const source = [
      { key: '10', name: 'Year 10' },
      { key: '9', name: 'Year 9' },
    ];
    const snapshot = [...source];
    const sorted = sortYearGroups(source);
    expect(source).toEqual(snapshot);
    expect(sorted).not.toBe(source);
  });
});
