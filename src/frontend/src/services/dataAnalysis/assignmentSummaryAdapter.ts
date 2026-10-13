import type { AssignmentSummary } from './assignmentSummary.zod';
import type { HeatmapTaskColumn } from './heatmapAdapter';
import { formatMetricDisplayText } from './metricDisplay/metricDisplayText';

const AVERAGE_PRECISION = 2;
const INITIAL_TASK_COUNT = 3;

export interface SummaryHighlightView {
  label: string;
  value: string;
  previewValue: string;
  colour: 'success' | 'warning' | undefined;
  explanation: string;
}

export interface SummaryDetailView {
  text: string;
  explanation: string;
  attention: boolean;
}

export interface SummaryTaskView {
  key: string;
  title: string;
  zeroWeight: boolean;
  primaryValue: string;
  valueLabel: string;
  requiresAttention: boolean;
  belowThreshold: string | null;
  belowThresholdColour: 'warning' | undefined;
  details: SummaryDetailView[];
}

export interface SummaryCardView {
  rows: SummaryTaskView[];
  previewRows: SummaryTaskView[];
  highlights: SummaryHighlightView[];
  canExpand: boolean;
  showAllLabel: string;
}

export interface AssignmentSummaryView {
  emptyMessage: string | null;
  completenessExplanation: string;
  accuracyExplanation: string;
  completeness: SummaryCardView;
  accuracy: SummaryCardView;
}

export type SummaryCardsView =
  { summary: AssignmentSummaryView; message?: never } | { message: string; summary?: never };

const N_EXPLANATION =
  'N means not attempted or not applicable. Missing heatmap results are also shown as N. Assessment errors are counted separately.';

/**
 * Prepare a compact, attention-first view without changing analytical results.
 * @param {SummaryTaskView[]} rows - Formatted task results.
 * @param {SummaryHighlightView[]} highlights - Formatted summary groups.
 * @returns {SummaryCardView} Complete and initial presentation data.
 */
function cardView(rows: SummaryTaskView[], highlights: SummaryHighlightView[]): SummaryCardView {
  const orderedRows = [
    ...rows.filter((row) => row.requiresAttention),
    ...rows.filter((row) => !row.requiresAttention),
  ];
  return {
    rows: orderedRows,
    previewRows: orderedRows.slice(0, INITIAL_TASK_COUNT),
    highlights,
    canExpand: rows.length > INITIAL_TASK_COUNT,
    showAllLabel: `Show all ${rows.length} tasks`,
  };
}

/**
 * Format secondary evidence while preserving distinct metric states.
 * @param {number} nCount - Analysis-owned N count.
 * @param {number} errorCount - Analysis-owned error count.
 * @returns {SummaryDetailView[]} Display-ready evidence labels.
 */
function evidenceDetails(nCount: number, errorCount: number): SummaryDetailView[] {
  const details: SummaryDetailView[] = [
    {
      text: `${nCount} not attempted / not applicable`,
      explanation: N_EXPLANATION,
      attention: false,
    },
  ];
  if (errorCount > 0) {
    details.push({
      text: `${errorCount} assessment ${errorCount === 1 ? 'error' : 'errors'}`,
      explanation: 'An assessment error means the analyser could not produce a usable score.',
      attention: true,
    });
  }
  return details;
}

/**
 * Format an existing accuracy average without manufacturing a numeric result.
 * @param {number | null} average - Analysis-owned average.
 * @returns {string} Rounded score or explicit unavailable label.
 */
function accuracyValue(average: number | null): string {
  return average === null
    ? 'No numeric assessments'
    : `${formatMetricDisplayText({ state: 'computed', value: average }, AVERAGE_PRECISION)}/5`;
}

/**
 * Project UI-independent summaries into display-ready task labels and text.
 * @param {AssignmentSummary} summary - Validated assignment summary.
 * @param {readonly HeatmapTaskColumn[]} columns - Authoritative heatmap titles and weight metadata.
 * @returns {AssignmentSummaryView} Presentation model without analysis calculations.
 */
export function adaptAssignmentSummary(
  summary: AssignmentSummary,
  columns: readonly HeatmapTaskColumn[]
): AssignmentSummaryView {
  const columnsByKey = new Map(columns.map((column) => [column.taskKey, column]));
  const titles = new Map(
    columns.map((column) => [column.taskKey, column.taskTitle ?? column.taskId])
  );
  /**
   * Resolve the task names for a ranked or flagged group.
   * @param {readonly string[]} keys - Analysis-owned task identifiers.
   * @returns {string} Names or an explicit empty-group label.
   */
  function taskNames(keys: readonly string[]): string {
    return keys.length > 0
      ? keys
          .map((key) => {
            const title = titles.get(key);
            if (title === undefined) throw new Error(`Missing summary task title: ${key}`);
            return title;
          })
          .join(', ')
      : 'None';
  }
  const completenessRows: SummaryTaskView[] = [];
  /**
   * Format full and compact task groups for the summary heading.
   * @param {string} label - Teacher-facing heading.
   * @param {readonly string[]} keys - Analysis-owned task identifiers.
   * @param {'success' | 'warning'} colour - Semantic presentation colour.
   * @param {string} explanation - Meaning of the summary group.
   * @returns {SummaryHighlightView} Display-ready group.
   */
  function highlight(
    label: string,
    keys: readonly string[],
    colour: 'success' | 'warning',
    explanation: string
  ): SummaryHighlightView {
    let previewValue = taskNames(keys.slice(0, INITIAL_TASK_COUNT));
    if (keys.length > INITIAL_TASK_COUNT)
      previewValue += ` (+${keys.length - INITIAL_TASK_COUNT} more)`;
    return {
      label,
      value: taskNames(keys),
      previewValue,
      colour: keys.length > 0 ? colour : undefined,
      explanation,
    };
  }
  const accuracyRows: SummaryTaskView[] = [];
  for (const task of summary.tasks) {
    const column = columnsByKey.get(task.taskKey);
    if (!column) throw new Error(`Missing summary column: ${task.taskKey}`);
    const shared = {
      key: task.taskKey,
      title: column.taskTitle ?? column.taskId,
      zeroWeight: !column.averageContribution.includedInAverage,
    };
    completenessRows.push({
      ...shared,
      primaryValue: `${task.completedCount} of ${summary.totalStudents}`,
      valueLabel: 'at or above threshold',
      requiresAttention: task.incompleteAcrossMostStudents,
      belowThreshold: `${task.belowThresholdCount} below threshold`,
      belowThresholdColour: task.belowThresholdCount > 0 ? 'warning' : undefined,
      details: evidenceDetails(task.notAttemptedCount, task.completenessErrorCount),
    });
    accuracyRows.push({
      ...shared,
      primaryValue: accuracyValue(task.accuracyAverage),
      valueLabel: `${task.accuracyAssessedCount} of ${summary.totalStudents} assessed`,
      requiresAttention: task.belowAccuracyThreshold,
      belowThreshold: null,
      belowThresholdColour: undefined,
      details: evidenceDetails(task.accuracyNotAttemptedCount, task.accuracyErrorCount),
    });
  }
  let emptyMessage: string | null = null;
  if (summary.tasks.length === 0) emptyMessage = 'No tasks to summarise.';
  else if (summary.totalStudents === 0) emptyMessage = 'No students to summarise.';
  return {
    emptyMessage,
    completenessExplanation: `Students meet the completeness threshold when they score at least ${summary.thresholds.completeness} points on a scale from 0 to 5. Scores below ${summary.thresholds.completeness} points do not meet the threshold. Meeting the threshold does not necessarily mean the task is fully completed.`,
    accuracyExplanation: `A task requires attention when its average accuracy is less than ${summary.thresholds.accuracy} points on a scale from 0 to 5. An average of exactly ${summary.thresholds.accuracy} points meets the threshold. The average uses numeric scores only; N values and assessment errors are excluded.`,
    completeness: cardView(completenessRows, [
      highlight(
        'Tasks requiring attention',
        summary.tasks
          .filter((task) => task.incompleteAcrossMostStudents)
          .map((task) => task.taskKey),
        'warning',
        `More than half the class scores below ${summary.thresholds.completeness} points for completeness or is marked N (not attempted or not applicable). Assessment errors are not included.`
      ),
    ]),
    accuracy: cardView(accuracyRows, [
      highlight(
        'Most accurate',
        summary.mostAccurateTaskKeys,
        'success',
        'The highest average accuracy among tasks with numeric assessments. Tied tasks are included.'
      ),
      highlight(
        'Least accurate',
        summary.leastAccurateTaskKeys,
        'warning',
        'The lowest average accuracy among tasks with numeric assessments. This does not necessarily mean it is below threshold. Tied tasks are included.'
      ),
      highlight(
        'Below accuracy threshold',
        summary.tasks.filter((task) => task.belowAccuracyThreshold).map((task) => task.taskKey),
        'warning',
        `Tasks with average accuracy less than ${summary.thresholds.accuracy} points on a scale from 0 to 5. An average of ${summary.thresholds.accuracy} points or higher is not below the threshold. N values and assessment errors are excluded from the average.`
      ),
    ]),
  };
}
