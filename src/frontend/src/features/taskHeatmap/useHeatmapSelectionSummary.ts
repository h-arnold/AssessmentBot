import { useMemo } from 'react';
import { useLogOnce } from '../../hooks/useLogOnce';
import { logFrontendError } from '../../logging/frontendLogger';
import { toError } from '../../errors/normaliseUnknownError';
import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
import {
  adaptAssignmentSummary,
  type SummaryCardsView,
} from '../../services/dataAnalysis/assignmentSummaryAdapter';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

export interface HeatmapSelectionSummaryResult {
  view: SummaryCardsView | null;
  error: Error | null;
}

/**
 * Reuse single-assignment analysis, or explain why a merged selection has no summary.
 * @param {ClassFull | null} classFull - Loaded class and roster.
 * @param {AssignmentDefinitionPartialsResponse | null} partials - Loaded task definitions.
 * @param {MergedHeatmapResult | null} heatmap - Ready heatmap with selected assignment identities.
 * @returns {HeatmapSelectionSummaryResult} Adapted card data or an explicit failure.
 */
function buildSelectionSummary(
  classFull: ClassFull | null,
  partials: AssignmentDefinitionPartialsResponse | null,
  heatmap: MergedHeatmapResult | null
): HeatmapSelectionSummaryResult {
  if (heatmap === null || classFull === null || partials === null)
    return { view: null, error: null };
  if (heatmap.sourceAssignments.length > 1) {
    return {
      view: {
        message:
          'Multiple assignments are selected. Summaries are available for one assignment at a time. Select a single assignment to view its completeness and accuracy summaries.',
      },
      error: null,
    };
  }
  if (heatmap.sourceAssignments.length === 0) return { view: null, error: null };
  const assignment = heatmap.sourceAssignments[0];
  try {
    const summary = new DataAnalysisService().analyseAssignmentSummary(
      {
        filter: { classIds: [classFull.classId] },
        classes: [classFull],
        assignmentDefinitionPartials: partials,
      },
      classFull.classId,
      assignment.assignmentId
    );
    return { view: { summary: adaptAssignmentSummary(summary, heatmap.taskColumns) }, error: null };
  } catch (error: unknown) {
    return { view: null, error: toError(error) };
  }
}

/**
 * Prepare selection-scoped summaries and log failures once, as on TaskHeatmapPage.
 * @param {ClassFull | null} classFull - Loaded class and roster.
 * @param {AssignmentDefinitionPartialsResponse | null} partials - Loaded task definitions.
 * @param {MergedHeatmapResult | null} heatmap - Ready selected heatmap.
 * @param {boolean} isReady - Whether the owning surface can display usable data.
 * @returns {HeatmapSelectionSummaryResult} Memoised presentation data and error state.
 */
export function useHeatmapSelectionSummary(
  classFull: ClassFull | null,
  partials: AssignmentDefinitionPartialsResponse | null,
  heatmap: MergedHeatmapResult | null,
  isReady: boolean
): HeatmapSelectionSummaryResult {
  const result = useMemo(
    () =>
      isReady ? buildSelectionSummary(classFull, partials, heatmap) : { view: null, error: null },
    [classFull, partials, heatmap, isReady]
  );
  useLogOnce(result.error !== null, () => {
    logFrontendError('useHeatmapSelectionSummary', result.error, { classId: classFull?.classId });
  });
  return result;
}
