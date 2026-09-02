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
import type { MergedHeatmapTaskColumn } from '../../services/dataAnalysis/heatmapAdapter.merged';

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

/** Assembly result: merged lookup plus the complete per-taskKey status map. */
export type MergedPreviewAssemblyResult = Readonly<{
  mergedLookup: CellPreviewLookup;
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
 * Derive the ordered, de-duplicated list of `assignmentId`s from `columnOrder`,
 * recording the first-occurrence order and the set of seen IDs.
 *
 * @param {ReadonlyArray<MergedHeatmapTaskColumn>} columnOrder - Stable merged column order.
 * @returns {{ ordered: string[]; seen: Set<string> }} The ordered IDs and the seen set.
 */
function deriveOrderedAssignmentIds(columnOrder: ReadonlyArray<MergedHeatmapTaskColumn>): {
  ordered: string[];
  seen: Set<string>;
} {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const column of columnOrder) {
    if (!seen.has(column.assignmentId)) {
      seen.add(column.assignmentId);
      ordered.push(column.assignmentId);
    }
  }
  return { ordered, seen };
}

/**
 * Merge per-assignment lookups in `columnOrder` order (first-wins per
 * (student, taskKey)), then apply a defensive secondary pass for any input whose
 * `assignmentId` is not represented in `columnOrder` so no cells are dropped.
 *
 * @param {ReadonlyArray<AssignmentPreviewInput>} inputs - Per-assignment lookups and query state.
 * @param {ReadonlyArray<MergedHeatmapTaskColumn>} columnOrder - Stable merged column order.
 * @param {ReadonlyMap<string, AssignmentPreviewInput>} inputById - Lookup of input by assignmentId.
 * @returns {Map<string, Map<string, CellPreviewData>>} The merged lookup.
 */
function mergeLookupsInColumnOrder(
  inputs: ReadonlyArray<AssignmentPreviewInput>,
  columnOrder: ReadonlyArray<MergedHeatmapTaskColumn>,
  inputById: ReadonlyMap<string, AssignmentPreviewInput>
): Map<string, Map<string, CellPreviewData>> {
  const { ordered, seen } = deriveOrderedAssignmentIds(columnOrder);
  const mergedLookup = new Map<string, Map<string, CellPreviewData>>();
  for (const assignmentId of ordered) {
    const input = inputById.get(assignmentId);
    if (input) {
      mergeLookupInto(mergedLookup, input.lookup);
    }
  }
  for (const input of inputs) {
    if (!seen.has(input.assignmentId)) {
      mergeLookupInto(mergedLookup, input.lookup);
    }
  }
  return mergedLookup;
}

/**
 * Build the per-taskKey preview-status map from `columnOrder` (every column
 * represented; first occurrence wins for a shared taskKey).
 *
 * @param {ReadonlyArray<MergedHeatmapTaskColumn>} columnOrder - Stable merged column order.
 * @param {ReadonlyMap<string, AssignmentPreviewInput>} inputById - Lookup of input by assignmentId.
 * @returns {Map<string, PreviewStatus>} The per-taskKey status map.
 */
function buildPreviewStatusByTaskKey(
  columnOrder: ReadonlyArray<MergedHeatmapTaskColumn>,
  inputById: ReadonlyMap<string, AssignmentPreviewInput>
): Map<string, PreviewStatus> {
  const statusByTaskKey = new Map<string, PreviewStatus>();
  for (const column of columnOrder) {
    if (statusByTaskKey.has(column.taskKey)) {
      continue;
    }
    const input = inputById.get(column.assignmentId);
    if (input === undefined) {
      throw new Error(
        `assembleMergedPreviewData: no preview input for assignmentId "${column.assignmentId}" (taskKey "${column.taskKey}")`
      );
    }
    statusByTaskKey.set(column.taskKey, {
      isLoading: input.isLoading,
      hasError: input.hasError,
    });
  }
  return statusByTaskKey;
}

/**
 * Merge per-selected-assignment cell-preview lookups into one
 * `studentId → taskKey → CellPreviewData` map (first-wins in `columnOrder` order)
 * and build `previewStatusByTaskKey` covering EVERY selected assignment's taskKeys
 * (including duplicates' first occurrences), with a shared taskKey taking the FIRST
 * occurrence's status in `columnOrder`.
 *
 * @remarks
 * Driving the lookup merge by `columnOrder` guarantees the merged cell and the
 * per-taskKey status are sourced from the SAME assignment instance (the first
 * occurrence in stable column order), matching the merged adapter's documented
 * merge-parity contract. A defensive secondary pass then merges any input whose
 * `assignmentId` is not represented in `columnOrder` so no cells are silently
 * dropped.
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
  const inputById = new Map(inputs.map((input) => [input.assignmentId, input]));

  // Merge lookups in columnOrder order (first occurrence wins) so the merged cell
  // and the per-taskKey status are sourced from the SAME assignment instance.
  const mergedLookup = mergeLookupsInColumnOrder(inputs, columnOrder, inputById);

  // Build the per-taskKey status map: every column represented, first occurrence wins.
  const previewStatusByTaskKey = buildPreviewStatusByTaskKey(columnOrder, inputById);

  return { mergedLookup, previewStatusByTaskKey };
}
