/**
 * Shared student-name splitting helper.
 *
 * @remarks
 * Pure functions: no side effects, no React / antd / I/O / state.
 * Honourifics are never special-cased; the leading token is always the
 * forename. Fixtures contain no honourific-prefixed names.
 */

/**
 * Splits a stored single-string student display name into forename and surname.
 *
 * The first whitespace-separated token becomes the forename; any remaining
 * tokens are joined with single spaces to form the surname. Leading, trailing,
 * and repeated internal whitespace is collapsed. Empty or whitespace-only
 * input yields empty forename and surname.
 *
 * @param {string} studentName - The stored single-string student display name.
 * @returns {{ forename: string; surname: string }} The derived forename and surname parts.
 */
export function splitStudentName(studentName: string): {
  forename: string;
  surname: string;
} {
  const trimmedName = studentName.trim();

  if (trimmedName === '') {
    return { forename: '', surname: '' };
  }

  const [forename, ...remainingTokens] = trimmedName.split(/\s+/);

  return { forename, surname: remainingTokens.join(' ') };
}

/**
 * Compares two student rows by a selected derived name part.
 *
 * Selects the forename or surname of each stored single-string display name
 * via {@link splitStudentName}, then compares the selected parts
 * (locale-aware, case-insensitive) with a deterministic `studentId`
 * ascending tie-break. The comparison is direction-neutral ascending; call
 * sites apply direction inversion.
 *
 * @param {'forename' | 'surname'} part - The derived name part to compare by.
 * @param {Readonly<{ studentName: string; studentId: string }>} a - The first row to compare.
 * @param {Readonly<{ studentName: string; studentId: string }>} b - The second row to compare.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareStudentNamePart(
  part: 'forename' | 'surname',
  a: Readonly<{ studentName: string; studentId: string }>,
  b: Readonly<{ studentName: string; studentId: string }>
): number {
  const splitA = splitStudentName(a.studentName);
  const splitB = splitStudentName(b.studentName);
  const valueA = part === 'forename' ? splitA.forename : splitA.surname;
  const valueB = part === 'forename' ? splitB.forename : splitB.surname;
  const partCmp = valueA.localeCompare(valueB, undefined, { sensitivity: 'base' });
  if (partCmp !== 0) return partCmp;
  return a.studentId.localeCompare(b.studentId);
}
