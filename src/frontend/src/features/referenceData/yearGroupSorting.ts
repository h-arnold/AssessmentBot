import type { YearGroup } from '../../services/referenceData/referenceData.zod';

/**
 * Compares year groups in their natural presentation order.
 *
 * @param {YearGroup} left Left-hand year group.
 * @param {YearGroup} right Right-hand year group.
 * @returns {number} A locale comparison result.
 */
export function compareYearGroups(left: YearGroup, right: YearGroup): number {
  const nameComparison = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (nameComparison !== 0) {
    return nameComparison;
  }
  return left.key.localeCompare(right.key, undefined, { sensitivity: 'base' });
}

/**
 * Returns a naturally ordered copy of the supplied year groups.
 *
 * @param {YearGroup[]} yearGroups Year groups to order.
 * @returns {YearGroup[]} A new array in presentation order.
 */
export function sortYearGroups(yearGroups: YearGroup[]): YearGroup[] {
  return yearGroups.toSorted(compareYearGroups);
}
