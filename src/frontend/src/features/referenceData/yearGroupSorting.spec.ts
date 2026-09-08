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

describe('sortYearGroups', () => {
  it('naturally orders year-number labels', () => {
    expect(
      names(
        sortYearGroups([
          { key: '11', name: 'Year 11' },
          { key: '9', name: 'Year 9' },
          { key: '10', name: 'Year 10' },
        ])
      )
    ).toEqual(['Year 9', 'Year 10', 'Year 11']);
  });

  it('naturally orders labels beginning directly with numbers', () => {
    expect(
      names(
        sortYearGroups([
          { key: '10', name: '10 Senior' },
          { key: '2', name: '2 Junior' },
          { key: '1', name: '1 Foundation' },
        ])
      )
    ).toEqual(['1 Foundation', '2 Junior', '10 Senior']);
  });

  it('orders labels without numbers alphabetically', () => {
    expect(
      names(
        sortYearGroups([
          { key: 'z', name: 'Senior' },
          { key: 'a', name: 'Foundation' },
          { key: 'm', name: 'Middle' },
        ])
      )
    ).toEqual(['Foundation', 'Middle', 'Senior']);
  });

  it('orders mixed numeric and non-numeric labels using locale comparison', () => {
    expect(
      names(
        sortYearGroups([
          { key: 'y10', name: 'Year 10' },
          { key: 'sixth', name: 'Sixth Form' },
          { key: 'y9', name: 'Year 9' },
        ])
      )
    ).toEqual(['Sixth Form', 'Year 9', 'Year 10']);
  });

  it('compares labels case-insensitively', () => {
    expect(
      names(
        sortYearGroups([
          { key: 'b', name: 'beta' },
          { key: 'a', name: 'Alpha' },
        ])
      )
    ).toEqual(['Alpha', 'beta']);
  });

  it('uses the key as a case-insensitive deterministic tie-break for duplicate labels', () => {
    expect(
      sortYearGroups([
        { key: 'group-b', name: 'Year 10' },
        { key: 'GROUP-a', name: 'year 10' },
      ]).map((yearGroup) => yearGroup.key)
    ).toEqual(['GROUP-a', 'group-b']);
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
