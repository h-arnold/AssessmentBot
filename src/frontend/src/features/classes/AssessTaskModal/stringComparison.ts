/**
 * Feature-local pure helper for case-insensitive trimmed string equality.
 *
 * @remarks
 * This helper is feature-local (not exported from the modal feature directory)
 * and is shared between the matcher (`findMatchingDefinition`) and the picker
 * derivation helper (`getLinkableDefinitionsForModal`). It has exactly two
 * in-scope callers per
 * `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
 * §3.4.
 *
 * The normalisation is `a.trim().toLowerCase() === b.trim().toLowerCase()` and
 * is consistent with the backend
 * `AssignmentDefinitionValidation.normaliseTitleForDuplicate`.
 *
 * The matcher relaxation is a strict superset of the previous behaviour:
 * case-matching inputs still match; new cases match case-insensitively.
 *
 * @param {string} a - First string to compare.
 * @param {string} b - Second string to compare.
 * @returns {boolean} `true` when both strings are equal after trimming whitespace and
 *   lowercasing.
 */
export function caseInsensitiveTrimmedEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
