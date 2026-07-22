import type {
  AssignmentFull,
  BaseTaskArtifactSchema,
} from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { HEATMAP_METRIC_KEYS } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { z } from 'zod';

/**
 * Discriminant values for a task artifact's type, derived from the
 * {@link BaseTaskArtifactSchema} discriminated union so the two cannot drift.
 */
type ArtifactType = z.infer<typeof BaseTaskArtifactSchema>['type'];

/**
 * Maps each `ArtifactType` to its corresponding `artifactContent` type.
 */
type ArtifactContentByType<T extends ArtifactType> = T extends 'SPREADSHEET'
  ? Array<Array<string | number | null>> | null
  : T extends 'base'
    ? unknown
    : string | null;

/**
 * Per-cell preview data extracted from a single (student, task) pair in
 * the AssignmentFull payload.
 *
 * Discriminated union keyed on `artifactType` so that `artifactContent`
 * narrows automatically when the type is checked.
 */
export type CellPreviewData = {
  [K in ArtifactType]: {
    readonly artifactType: K;
    readonly artifactContent: ArtifactContentByType<K>;
    /** Per-metric reasoning strings (null when assessment is absent for that metric). */
    readonly reasoning: Record<HeatmapMetricKey, string | null>;
  };
}[ArtifactType];

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
    // `assessments` is keyed by backend metric names (`completeness`,
    // `accuracy`, `spag`). `HEATMAP_METRIC_KEYS` provides the same three
    // keys used for lookup. If a metric key is absent, `reasoning` defaults
    // to `null`.
    reasoning: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null])
    ) as Record<HeatmapMetricKey, string | null>,
  } as CellPreviewData;
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
