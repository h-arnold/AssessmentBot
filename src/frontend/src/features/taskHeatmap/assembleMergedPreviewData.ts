/**
 * Merged cell-preview lookup / status assembly for the standalone Heatmaps surface.
 *
 * @remarks
 * Merges per-selected-assignment `CellPreviewLookup`s into one
 * `studentId → taskKey → CellPreviewData` map and builds the complete
 * `previewStatusByTaskKey` status map consumed by `TaskHeatmapTable`'s merged mode.
 *
 * **First-wins in `columnOrder`.** Columns arrive in the merged adapter's stable
 * order (`classFull.assignments` order, deduplicated by `taskKey`). When two
 * assignment instances share a composite `taskKey`, the first occurrence in
 * `columnOrder` wins for both the merged lookup cell and the per-taskKey status,
 * preserving the analyser's accumulator-semantics merge (identical metrics for a
 * shared `taskKey`).
 *
 * **Status coverage.** Every selected assignment's taskKeys are represented in
 * `previewStatusByTaskKey`; a shared `taskKey` takes its first occurrence's status
 * (pending → `isLoading`; errored/null → `hasError`). This is what lets the merged
 * table flag only the affected columns when a single assignment full-read fails,
 * while still rendering every other column's scores.
 */

import type { CellPreviewData, CellPreviewLookup } from './buildCellPreviewLookup';
import type { MergedHeatmapTaskColumn } from '../../services/dataAnalysis/heatmapAdapter';

/** Per-assignment preview input: its built lookup plus its query state. */
export type AssignmentPreviewInput = Readonly<{
  /** The contributing assignment identifier. */
  assignmentId: string;
  /** Per-student → taskKey → cell-preview lookup for this assignment. */
  lookup: CellPreviewLookup;
  /** Whether this assignment's full-read query is still pending. */
  isLoading: boolean;
  /** Whether this assignment's full-read query errored. */
  hasError: boolean;
}>;

/** Per-task-key preview status. */
export type PreviewStatus = Readonly<{
  isLoading: boolean;
  hasError: boolean;
}>;

/** Merged per-student → taskKey → cell-preview lookup. */
export type MergedCellPreviewLookup = ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>;

/** Assembly result: merged lookup plus the complete per-taskKey status map. */
export type MergedPreviewAssemblyResult = Readonly<{
  mergedLookup: MergedCellPreviewLookup;
  previewStatusByTaskKey: ReadonlyMap<string, PreviewStatus>;
}>;

/**
 * Merge a single assignment's lookup into the accumulated merged lookup,
 * first-wins per (student, taskKey).
 *
 * @param {Map<string, Map<string, CellPreviewData>>} mergedLookup - The accumulated merged lookup.
 * @param {CellPreviewLookup} lookup - The per-assignment lookup to merge in.
 */
function mergeLookupInto(
  mergedLookup: Map<string, Map<string, CellPreviewData>>,
  lookup: CellPreviewLookup
): void {
  for (const [studentId, inner] of lookup) {
    let studentMap = mergedLookup.get(studentId);
    if (!studentMap) {
      studentMap = new Map<string, CellPreviewData>();
      mergedLookup.set(studentId, studentMap);
    }
    for (const [taskKey, cell] of inner) {
      if (!studentMap.has(taskKey)) {
        studentMap.set(taskKey, cell);
      }
    }
  }
}

/**
 * Merge per-selected-assignment cell-preview lookups into one
 * `studentId → taskKey → CellPreviewData` map (first-wins in input/selection order)
 * and build `previewStatusByTaskKey` covering EVERY selected assignment's taskKeys
 * (including duplicates' first occurrences), with a shared taskKey taking the FIRST
 * occurrence's status in `columnOrder`.
 *
 * @param {ReadonlyArray<AssignmentPreviewInput>} inputs - Per-assignment lookups and query state.
 * @param {ReadonlyArray<MergedHeatmapTaskColumn>} columnOrder - Stable merged column order
 *   (from `adaptMetricsToMergedHeatmap` output); carries `taskKey` + `assignmentId` so status
 *   maps onto the correct assignment's taskKeys.
 * @returns {MergedPreviewAssemblyResult} The merged lookup and status map.
 */
export function assembleMergedPreviewData(
  inputs: ReadonlyArray<AssignmentPreviewInput>,
  columnOrder: ReadonlyArray<MergedHeatmapTaskColumn>
): MergedPreviewAssemblyResult {
  // Merge each assignment's lookup into the combined map (first-wins per (student, taskKey)).
  const mergedLookup = new Map<string, Map<string, CellPreviewData>>();
  for (const input of inputs) {
    mergeLookupInto(mergedLookup, input.lookup);
  }

  // Build the per-taskKey status map: every column represented, first occurrence wins.
  const previewStatusByTaskKey = new Map<string, PreviewStatus>();
  const inputById = new Map(inputs.map((input) => [input.assignmentId, input]));
  for (const column of columnOrder) {
    if (previewStatusByTaskKey.has(column.taskKey)) {
      continue;
    }
    const input = inputById.get(column.assignmentId);
    previewStatusByTaskKey.set(column.taskKey, {
      isLoading: input ? input.isLoading : false,
      hasError: input ? input.hasError : false,
    });
  }

  return { mergedLookup, previewStatusByTaskKey };
}
