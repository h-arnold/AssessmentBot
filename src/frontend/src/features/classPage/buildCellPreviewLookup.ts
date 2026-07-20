import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { HEATMAP_METRIC_KEYS } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';

/**
 * Discriminant values for a task artifact's type, matching the discriminator
 * union in {@link BaseTaskArtifactSchema}.
 */
type ArtifactType = 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base';

/**
 * Per-cell preview data extracted from a single (student, task) pair in
 * the AssignmentFull payload.
 */
export interface CellPreviewData {
  /** The artifact type discriminator from the backend. */
  readonly artifactType: ArtifactType;
  /** The artifact content (varies by type: string for TEXT/TABLE/IMAGE, 2D array for SPREADSHEET). */
  readonly artifactContent: unknown;
  /** Per-metric reasoning strings (null when assessment is absent for that metric). */
  readonly reasoning: Record<HeatmapMetricKey, string | null>;
}

/**
 * Keyed lookup: outer key is studentId, inner key is taskId.
 *
 * A missing student entry or task entry means no submission exists for that
 * (student, task) pair. O(1) retrieval via two Map.get calls.
 */
export type CellPreviewLookup = ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>;

/**
 * Builds a `CellPreviewData` from a single submission item's artifact and assessments.
 *
 * @param {ArtifactType} artifactType - The artifact type discriminator.
 * @param {unknown} artifactContent - The artifact content.
 * @param {Record<string, { score: number; reasoning: string }>} assessments - The per-metric assessments.
 * @returns {CellPreviewData} The assembled cell preview data.
 */
function createCellPreviewData(
  artifactType: ArtifactType,
  artifactContent: unknown,
  assessments: Record<string, { score: number; reasoning: string }>
): CellPreviewData {
  return {
    artifactType,
    artifactContent,
    reasoning: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null])
    ) as Record<HeatmapMetricKey, string | null>,
  };
}

/**
 * Transforms an `AssignmentFull` payload into a `Map<studentId, Map<taskId, CellPreviewData>>`
 * for O(1) popover lookup.
 *
 * @param {AssignmentFull} assignment - The full assignment payload (must be non-null; caller guards null).
 * @returns {CellPreviewLookup} A read-only Map keyed by studentId → taskId → CellPreviewData.
 */
export function buildCellPreviewLookup(assignment: AssignmentFull): CellPreviewLookup {
  const outerMap = new Map<string, Map<string, CellPreviewData>>();

  for (const submission of assignment.submissions) {
    const innerMap = new Map<string, CellPreviewData>();

    for (const item of Object.values(submission.items)) {
      // First-wins: only set if this taskId has not been encountered yet
      if (!innerMap.has(item.taskId)) {
        innerMap.set(
          item.taskId,
          createCellPreviewData(item.artifact.type, item.artifact.content, item.assessments)
        );
      }
    }

    outerMap.set(submission.studentId, innerMap);
  }

  return outerMap;
}
