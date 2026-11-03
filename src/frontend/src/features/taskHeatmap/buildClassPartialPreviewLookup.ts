/**
 * Class-partial cell-preview lookup for the embedded heatmap.
 *
 * @remarks
 * The embedded heatmap's full read is the primary preview source, but it is
 * pending or failed for a while on every visit. The class snapshot already
 * carries each assignment's partial submissions, so a known explicit `E` can be
 * shown immediately instead of falling back to the whole-preview placeholder.
 *
 * This is not a second read contract: the partial items are the class read's own
 * validated entries, and only the fields a preview needs are projected. Content
 * is redacted in the partial representation, so an entry without a known `E`
 * carries no usable preview and is omitted rather than presented as a blank
 * source.
 */

import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { HEATMAP_METRIC_KEYS } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
import type { AssessmentError, CellPreviewData, CellPreviewLookup } from './buildCellPreviewLookup';

/**
 * Build the embedded preview lookup from an assignment's class-partial entry.
 *
 * @param {ClassFull} classFull - The class snapshot the heatmap is rendered from.
 * @param {string} assignmentId - The opened assignment instance.
 * @returns {CellPreviewLookup} Preview cells for the partial entries with a known `E`;
 *   empty when the assignment is absent or carries no known error.
 *
 * @remarks
 * The inner key is the composite `taskKey`, matching
 * {@link buildCellPreviewLookup} so both lookups address the same columns. A
 * partial item's artifact has no content, so `artifactType` is `base` (which the
 * preview assembly renders as `TEXT`) and `artifactContent` is `null`. The
 * derived `sourceUrl` is always `null`: the partial representation carries no
 * page identifier that could safely anchor an editor link.
 */
export function buildClassPartialPreviewLookup(
  classFull: ClassFull,
  assignmentId: string
): CellPreviewLookup {
  const assignment = classFull.assignments.find((row) => row.assignmentId === assignmentId);
  if (assignment === undefined) {
    return new Map();
  }

  const definitionKey = assignment.assignmentDefinitionKey;
  const outerMap = new Map<string, Map<string, CellPreviewData>>();

  for (const submission of assignment.submissions) {
    const innerMap = new Map<string, CellPreviewData>();

    for (const item of Object.values(submission.items)) {
      const cell = createClassPartialCell(item.assessments);
      if (cell === null) {
        continue;
      }
      innerMap.set(buildTaskKey(definitionKey, item.taskId), cell);
    }

    if (innerMap.size > 0) {
      outerMap.set(submission.studentId, innerMap);
    }
  }

  return outerMap;
}

/**
 * Project one class-partial item's assessments into preview cell data.
 *
 * @param {Record<string, unknown> | undefined} assessments - The item's partial assessments.
 * @returns {CellPreviewData | null} The preview cell, or `null` when no criterion carries a known `E`.
 */
function createClassPartialCell(
  assessments: Record<string, unknown> | undefined
): CellPreviewData | null {
  const keys = HEATMAP_METRIC_KEYS.filter((key) => readKnownError(assessments, key) !== null);
  if (keys.length === 0) {
    return null;
  }

  return {
    artifactType: 'base',
    artifactContent: null,
    reasoning: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, readKnownError(assessments, key)?.reasoning ?? null])
    ) as Record<HeatmapMetricKey, string | null>,
    errors: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, readKnownError(assessments, key)?.error ?? null])
    ) as Record<HeatmapMetricKey, AssessmentError | null>,
    sourceUrl: null,
  };
}

/**
 * Read one criterion's known error entry from a partial item's assessments.
 *
 * @param {Record<string, unknown> | undefined} assessments - The item's partial assessments.
 * @param {HeatmapMetricKey} key - The criterion to read.
 * @returns {{ reasoning: string; error: AssessmentError } | null} The known error, or `null` when the criterion is not an `E`.
 */
function readKnownError(
  assessments: Record<string, unknown> | undefined,
  key: HeatmapMetricKey
): { reasoning: string; error: AssessmentError } | null {
  const assessment = assessments?.[key] as
    { score: number | 'N' } | { score: 'E'; reasoning: string; error: AssessmentError } | undefined;
  return assessment?.score === 'E'
    ? { reasoning: assessment.reasoning, error: assessment.error }
    : null;
}
