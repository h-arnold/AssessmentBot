import type { YearGroup } from '../../services/referenceData/referenceData.zod';

/**
 * Compares year groups in their natural presentation order.
 *
 * Year groups are first ordered by a case-insensitive natural (`numeric`) name
 * comparison. When two distinct year groups share an identical name, the `key`
 * field provides a strict, deterministic tie-break: it uses the default ICU
 * collation (variant sensitivity), so any two distinct keys always yield a
 * non-zero result and the comparator remains a total order.
 *
 * @param {YearGroup} left Left-hand year group.
 * @param {YearGroup} right Right-hand year group.
 * @returns {number} A negative, zero, or positive number per standard comparator
 *   semantics. Zero is only returned when both the name and the key are equal.
 */
export function compareYearGroups(left: YearGroup, right: YearGroup): number {
  const nameComparison = left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (nameComparison !== 0) {
    return nameComparison;
  }
  return left.key.localeCompare(right.key);
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
