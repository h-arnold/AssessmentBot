/**
 * Feature model for the Task Heatmap feature.
 *
 * @remarks
 * Hosts the heatmap-scoped student-name comparator wrapper consumed by
 * `TaskHeatmapTable`. The wrapper keeps `HeatmapRow` typing at the heatmap
 * call site while all ordering logic lives in the canonical services
 * comparator (`services/dataAnalysis/compareStudentNames`); this module
 * adds no comparison logic of its own.
 */

import type { HeatmapRow } from '../../services/dataAnalysis/heatmapAdapter';
import { compareStudentNames } from '../../services/dataAnalysis/compareStudentNames';

/**
 * Compare two `HeatmapRow`s by student name (locale-aware, case-insensitive)
 * with a deterministic `studentId` ascending tie-break.
 *
 * @remarks
 * Delegates directly to `services/dataAnalysis/compareStudentNames`, the
 * single source of truth for app-wide student-name ordering.
 *
 * @param {HeatmapRow} a - The first row.
 * @param {HeatmapRow} b - The second row.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareHeatmapStudentName(a: HeatmapRow, b: HeatmapRow): number {
  return compareStudentNames(a, b);
}
