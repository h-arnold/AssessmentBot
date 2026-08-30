/**
 * Feature model for the Task Heatmap feature.
 *
 * @remarks
 * Hosts the heatmap-scoped student-name comparator wrapper consumed by
 * `TaskHeatmapTable`. All ordering logic lives in the canonical services
 * comparator (`services/dataAnalysis/compareStudentNames`); this module
 * adds no comparison logic of its own.
 */

import { compareStudentNames } from '../../services/dataAnalysis/compareStudentNames';

/** Minimal structural row shape the comparator reads. */
type NamedRow = Readonly<{ studentName: string; studentId: string }>;

/**
 * Compare two rows by student name (locale-aware, case-insensitive) with a
 * deterministic `studentId` ascending tie-break.
 *
 * @remarks
 * Delegates directly to `services/dataAnalysis/compareStudentNames`, the
 * single source of truth for app-wide student-name ordering. The parameter
 * type is the structural subset both `HeatmapRow` (embedded) and the
 * table's structurally-narrowed row satisfy, so the table need not thread a
 * concrete adapter row type through.
 *
 * @param {NamedRow} a - The first row.
 * @param {NamedRow} b - The second row.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareHeatmapStudentName(a: NamedRow, b: NamedRow): number {
  return compareStudentNames(a, b);
}
