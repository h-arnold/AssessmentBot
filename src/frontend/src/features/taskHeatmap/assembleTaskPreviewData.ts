import type { AssessmentError, CellPreviewData } from './buildCellPreviewLookup';
import type { TaskDisplayMetric } from '@/services/dataAnalysis/dataAnalysis.zod';
import { ERROR_METRIC, NOT_ATTEMPTED_METRIC } from '@/services/dataAnalysis/heatmapAdapter';
import type { HeatmapMetricKey } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { TaskPreviewData, TaskPreviewSourceState } from './TaskPreviewCard';
import { spreadsheetToMarkdownTable } from './spreadsheetToMarkdownTable';

/**
 * Whether a known `E` cause leaves a source region that can be rendered.
 *
 * @remarks
 * Only an assessment-stage failure means the source was extracted successfully,
 * so its response still renders. Acquisition, extraction and validation causes
 * all leave the source region unavailable, whatever content the cell carries.
 *
 * @param {AssessmentError | null} error - The selected criterion's cause.
 * @returns {boolean} `true` when the source region must show the error Alert.
 */
function isUnavailableSource(error: AssessmentError | null): boolean {
  return error !== null && error.stage !== 'assessment';
}

/**
 * Resolve the preview's source readiness from the selected cause.
 *
 * @param {AssessmentError | null} error - The selected criterion's cause.
 * @returns {TaskPreviewSourceState} The derived source state.
 */
function resolveSourceState(error: AssessmentError | null): TaskPreviewSourceState {
  return isUnavailableSource(error) ? 'unavailable' : 'available';
}

/**
 * Assembles a `TaskPreviewData` from a `CellPreviewData` (or `null`), the
 * analyser's `TaskDisplayMetric`, the metric key, and the task ID.
 *
 * @remarks
 * The analyser's metric is carried onto `TaskPreviewData` unchanged when the
 * cell records no cause for the criterion; a known cause overrides the preview's
 * metric with the shared error state (the table keeps its class-derived value).
 * The cell's derived `sourceUrl` is carried unchanged (never re-derived here).
 * A `null` `cellData` is
 * the one exception: no submission exists for the (student, task) pair, so the
 * metric is overridden with the shared `NOT_ATTEMPTED_METRIC` placeholder even
 * when the analyser reported `computed`, and `sourceUrl` is `null`.
 *
 * @param {CellPreviewData | null} cellData - The cell preview data from the
 *                   lookup, or `null` when no submission exists for the
 *                   (student, task) pair.
 * @param {TaskDisplayMetric} metricResult - The analyser's task-display metric for this cell.
 * @param {HeatmapMetricKey} metricKey - Which metric column this preview is for.
 * @param {string} taskId - The heatmap column's task ID (forwarded unchanged).
 * @returns {TaskPreviewData} A `TaskPreviewData` object ready for the `TaskPreviewCard`.
 */
export function assembleTaskPreviewData(
  cellData: CellPreviewData | null,
  metricResult: TaskDisplayMetric,
  metricKey: HeatmapMetricKey,
  taskId: string
): TaskPreviewData {
  // Null cellData: return empty defaults matching the no-submission contract.
  // Even if the metric result says 'computed', no submission means not attempted.
  if (cellData === null) {
    return {
      taskId,
      artifactType: 'TEXT',
      artifactContent: '',
      metricKey,
      metric: NOT_ATTEMPTED_METRIC,
      reasoning: '',
      // Type-satisfaction only: a confirmed no-submission is the ready N
      // placeholder with no known error.
      error: null,
      sourceState: 'available',
      sourceUrl: null,
    };
  }

  // Map the cell's artifact type into the TaskPreviewCard contract
  const artifactType = coerceArtifactType(cellData.artifactType);
  const error = cellData.errors[metricKey];
  // A known `E` whose full content is null (IMAGE/SPREADSHEET) is an
  // unavailable source, not a blank extraction: represent it as empty content
  // instead of invoking the throwing coercion. Any other null content still
  // fails loudly below.
  const hasKnownErrorWithoutContent = error !== null && cellData.artifactContent === null;
  const artifactContent = hasKnownErrorWithoutContent ? '' : coerceArtifactContent(cellData);

  return {
    taskId,
    artifactType,
    artifactContent,
    metricKey,
    // A known cause for the criterion overrides the class-derived numeric or
    // `N` score on the preview only; the table keeps its class-derived value.
    metric: error !== null && metricResult.state !== 'error' ? ERROR_METRIC : metricResult,
    reasoning: cellData.reasoning[metricKey] ?? '',
    error,
    sourceState: resolveSourceState(error),
    sourceUrl: cellData.sourceUrl,
  };
}

/**
 * Coerce a `CellPreviewData` artifact type to the narrower
 * `TaskPreviewData` artifact type set.
 *
 * @param {CellPreviewData['artifactType']} type - The artifact type discriminator
 *        from the backend.
 * @returns {TaskPreviewData['artifactType']} The mapped artifact type for the
 *          preview card.
 */
function coerceArtifactType(
  type: CellPreviewData['artifactType']
): TaskPreviewData['artifactType'] {
  switch (type) {
    case 'TEXT': {
      return 'TEXT';
    }
    case 'TABLE': {
      return 'TABLE';
    }
    case 'IMAGE': {
      return 'IMAGE';
    }
    case 'SPREADSHEET': {
      return 'TABLE';
    }
    case 'base': {
      return 'TEXT';
    }
    default: {
      // Exhaustiveness assertion: if a new artifact type is added to the
      // schema without a matching case, this line will fail at compile time.
      ((_exhaustive: never) => {
        throw new Error(`Unhandled artifact type: ${String(_exhaustive)}`);
      })(type);
    }
  }
}

/**
 * Validate and convert SPREADSHEET artifact content.
 *
 * @param {Array<Array<string | number | null>> | null} content - The spreadsheet content.
 * @returns {string} A GFM markdown table string.
 */
function coerceSpreadsheetContent(content: Array<Array<string | number | null>> | null): string {
  if (content === null) {
    throw new TypeError('SPREADSHEET artifact content is null');
  }
  return spreadsheetToMarkdownTable(content);
}

/**
 * Coerce the artifact content from a `CellPreviewData` to the `string` expected
 * by `TaskPreviewData`.
 *
 * - `SPREADSHEET` content is converted through `spreadsheetToMarkdownTable`.
 * - `base` content always yields `''`.
 * - `IMAGE` content that is `null` throws a `TypeError`.
 * - `TEXT`, `TABLE`, and `IMAGE` content is safely stringified.
 *
 * @param {CellPreviewData} cellData - The cell preview data (non-null; caller guards null).
 * @returns {string} A string representation of the artifact.
 */
function coerceArtifactContent(cellData: CellPreviewData): string {
  if (cellData.artifactType === 'SPREADSHEET') {
    return coerceSpreadsheetContent(cellData.artifactContent);
  }

  if (cellData.artifactType === 'base') {
    return '';
  }

  // IMAGE: null content would produce a broken <img src=""> — fail fast
  if (cellData.artifactType === 'IMAGE' && cellData.artifactContent === null) {
    throw new TypeError('IMAGE artifact content is null');
  }

  // TEXT, TABLE, IMAGE: coerce null to empty string, string pass-through
  return cellData.artifactContent ?? '';
}
