import type { CellPreviewData } from './buildCellPreviewLookup';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { TaskPreviewData } from './TaskPreviewCard';
import { spreadsheetToMarkdownTable } from './spreadsheetToMarkdownTable';

/**
 * Assembles a `TaskPreviewData` from a `CellPreviewData` (or `null`), the
 * analyser's `MetricResult`, the metric key, and the task ID.
 *
 * @param {CellPreviewData | null} cellData - The cell preview data from the
 *                   lookup, or `null` when no submission exists for the
 *                   (student, task) pair.
 * @param {MetricResult} metricResult - The analyser's metric result for this cell.
 * @param {HeatmapMetricKey} metricKey - Which metric column this preview is for.
 * @param {string} taskId - The heatmap column's task ID (forwarded unchanged).
 * @returns {TaskPreviewData} A `TaskPreviewData` object ready for the `TaskPreviewCard`.
 */
export function assembleTaskPreviewData(
  cellData: CellPreviewData | null,
  metricResult: MetricResult,
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
      metricScore: 'N' as const,
      metricState: 'notAttempted' as const,
      reasoning: '',
    };
  }

  // Map the cell's artifact type into the TaskPreviewCard contract
  const artifactType = coerceArtifactType(cellData.artifactType);
  const artifactContent = coerceArtifactContent(cellData);

  return {
    taskId,
    artifactType,
    artifactContent,
    metricKey,
    metricScore: metricResult.value,
    metricState: metricResult.state,
    reasoning: cellData.reasoning[metricKey] ?? '',
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
  if (!Array.isArray(content)) {
    throw new TypeError('SPREADSHEET artifact content is not a 2D array');
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
