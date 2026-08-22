/**
 * Shared student-name comparator for data-analysis views.
 *
 * @remarks
 * This module hosts the canonical locale-aware ordering of students by name,
 * structurally typed onto `{ studentName, studentId }` so neither feature owns
 * it. Its consumers are the Class page (adapter, view-model builder, and
 * overview table columns) and the Task Heatmap table; keep it flat here in
 * the shared services layer so the ordering semantics are not duplicated into
 * a feature folder.
 */

/**
 * Compare two student rows by student name (locale-aware, case-insensitive)
 * with a deterministic `studentId` ascending tie-break.
 *
 * @remarks
 * This is the single source of truth for student-name ordering across the
 * app. Call sites that need direction apply `direction === 'asc' ? cmp : -cmp`.
 *
 * @param {Readonly<{ studentName: string; studentId: string }>} a - The first row to compare.
 * @param {Readonly<{ studentName: string; studentId: string }>} b - The second row to compare.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareStudentNames(
  a: Readonly<{ studentName: string; studentId: string }>,
  b: Readonly<{ studentName: string; studentId: string }>
): number {
  const nameCmp = a.studentName.localeCompare(b.studentName, undefined, {
    sensitivity: 'base',
  });
  if (nameCmp !== 0) return nameCmp;
  return a.studentId.localeCompare(b.studentId);
}
