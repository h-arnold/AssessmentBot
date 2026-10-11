/**
 * Column-construction helpers for `TaskHeatmapTable`.
 *
 * Co-located sibling of `TaskHeatmapTable.tsx`. Extracted from the table
 * component when the component breached the 500-LOC module-size gate: these pure
 * helpers own the metric sub-column shape, the
 * per-column preview-status resolution, and the adaptive assignment-tier
 * grouping. They carry no React state and no side effects.
 *
 * The per-cell Popover trigger and its preview body live in the sibling
 * `TaskMetricPreviewCell.tsx` / `TaskMetricPreviewContent.tsx` modules; this
 * module supplies each cell's inputs (metric result, lookup entry, resolved
 * status, accessible label and score text) and keeps the `<td>` tone and label
 * mapping.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §3.7
 */

import type { CSSProperties, JSX } from 'react';
import type { TableColumnsType } from 'antd';
import type { FilterValue } from 'antd/es/table/interface';

import type {
  AverageContribution,
  TaskDisplayMetric,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import { compareMetricsByStateRank } from '../../services/dataAnalysis/metricDisplay/metricComparator';
import {
  METRIC_DISPLAY_META,
  HEATMAP_METRIC_KEYS,
} from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import {
  resolveMetricTone,
  DEFAULT_TONE_RANGE,
} from '../../services/dataAnalysis/metricDisplay/metricTone';
import { formatMetricDisplayText } from '../../services/dataAnalysis/metricDisplay/metricDisplayText';
import { buildMetricRangeFilter } from '../../services/dataAnalysis/metricDisplay/metricRangeFilter';
import { decodeFilterToRange } from '../../services/dataAnalysis/metricDisplay/metricRangeKey';
import { MetricIconLabel } from '../../components/MetricIconLabel/MetricIconLabel';
import { TaskMetricPreviewCell } from './TaskMetricPreviewCell';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import type { PreviewStatus } from './assembleMergedPreviewData';
import { APP_COL_WIDTH_METRIC } from '../../theme/spacing';
import { getZeroWeightMetricEdgeClass } from './taskHeatmapZeroWeightHeader';

// ---------------------------------------------------------------------------
// Structural view-model contract (read, never asserted)
// ---------------------------------------------------------------------------

/**
 * Structural column contract read by the table.
 *
 * Both `HeatmapTaskColumn` (embedded) and `MergedHeatmapTaskColumn` (merged)
 * satisfy this shape structurally with no casts: the embedded column carries
 * only the three required fields, while the merged column additionally carries
 * the optional assignment-identity fields used solely when building the
 * adaptive assignment tier.
 */
export interface TaskHeatmapColumn {
  taskKey: string;
  taskId: string;
  taskTitle: string | null;
  averageContribution: AverageContribution;
  assignmentId?: string;
  assignmentName?: string;
  definitionKey?: string;
}

/**
 * Structural row contract read by the table. `ReadonlyArray` is used so both
 * the mutable `HeatmapRow` (embedded) and the frozen `MergedHeatmapResult`
 * row arrays assign to this type without casts.
 */
export interface TaskHeatmapRow {
  studentId: string;
  studentName: string;
  cells: ReadonlyArray<{
    completeness: TaskDisplayMetric;
    accuracy: TaskDisplayMetric;
    spag: TaskDisplayMetric;
  }>;
}

/**
 * Structural result contract read by the table.
 *
 * The table reads only `rows`, `taskColumns`, and the optional
 * `sourceAssignments` (absent on the embedded `HeatmapResult`, present on the
 * merged result). Because `sourceAssignments` is optional, both adapter
 * outputs satisfy this contract unchanged.
 */
export interface TaskHeatmapData {
  rows: ReadonlyArray<TaskHeatmapRow>;
  taskColumns: ReadonlyArray<TaskHeatmapColumn>;
  sourceAssignments?: ReadonlyArray<{
    assignmentId: string;
    definitionKey: string;
    assignmentName: string;
  }>;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Number of decimal places for individual student task scores. Individual
 * task scores are always integers, so they are rendered without decimals.
 */
const INDIVIDUAL_SCORE_PRECISION = 0;

/** Suffix applied to a collapsed shared-definition assignment-tier parent. */
const SHARED_DEFINITION_SUFFIX = ' (shared definition)';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the display label for a heatmap metric key.
 *
 * @param {HeatmapMetricKey} key - The metric key.
 * @returns {string} The display title.
 */
function getDisplayTitle(key: HeatmapMetricKey): string {
  return METRIC_DISPLAY_META.get(key)!.label;
}

/**
 * Build the accessible label shared by a metric cell and its Popover trigger.
 *
 * @param {string} studentName - The student's displayed name.
 * @param {string} taskTitle - The human-readable task title or ID fallback.
 * @param {HeatmapMetricKey} metric - The metric key.
 * @param {string} score - The formatted metric display text.
 * @returns {string} The contextual accessible label.
 */
export function buildMetricCellAccessibleLabel(
  studentName: string,
  taskTitle: string,
  metric: HeatmapMetricKey,
  score: string
): string {
  return `${studentName}, ${taskTitle}, ${getDisplayTitle(metric)}: ${score}`;
}

/**
 * Extract a single cell metric by key via direct property access.
 *
 * @param {object} cell - The heatmap cell containing three metric results.
 * @param {TaskDisplayMetric} cell.completeness - The completeness metric result.
 * @param {TaskDisplayMetric} cell.accuracy - The accuracy metric result.
 * @param {TaskDisplayMetric} cell.spag - The SPaG metric result.
 * @param {HeatmapMetricKey} key - The metric key to extract.
 * @returns {TaskDisplayMetric} The matching metric result.
 */
function getCellMetric(
  cell: { completeness: TaskDisplayMetric; accuracy: TaskDisplayMetric; spag: TaskDisplayMetric },
  key: HeatmapMetricKey
): TaskDisplayMetric {
  switch (key) {
    case 'completeness': {
      return cell.completeness;
    }
    case 'accuracy': {
      return cell.accuracy;
    }
    case 'spag': {
      return cell.spag;
    }
  }
}

/**
 * Build a compare function for a single metric sub-column at the given task
 * index.
 *
 * @remarks
 * Delegates the ordering composition (state rank → numeric value → ascending
 * `studentId` tie-break) to the shared services-layer comparator
 * (`compareMetricsByStateRank`); the heatmap always sorts ascending.
 *
 * @param {number} taskIndex - The index of the task column.
 * @param {HeatmapMetricKey} metric - The metric key.
 * @returns {(a: TaskHeatmapRow, b: TaskHeatmapRow) => number} A compare function.
 */
function buildMetricSorter(
  taskIndex: number,
  metric: HeatmapMetricKey
): (a: TaskHeatmapRow, b: TaskHeatmapRow) => number {
  return (a: TaskHeatmapRow, b: TaskHeatmapRow): number =>
    compareMetricsByStateRank(
      getCellMetric(a.cells[taskIndex], metric),
      getCellMetric(b.cells[taskIndex], metric),
      a.studentId,
      b.studentId,
      'asc'
    );
}

/**
 * Per-column preview-status resolution for a single task column.
 *
 * @remarks
 * **Two-mode status contract.** When a `previewStatusByTaskKey` map is
 * supplied, status is owned per task key: a present map entry wins and drives
 * the popover (loading → skeleton, error → alert, else card). A column with no
 * map entry falls back to the aggregate booleans (it is NOT treated as a
 * healthy default). When the map is absent entirely, the aggregate
 * `isAssignmentLoading` / `showAssignmentError` booleans are used verbatim —
 * byte-identical to the embedded behaviour.
 *
 * @param {string} taskKey - The task column's composite task key.
 * @param {ReadonlyMap<string, PreviewStatus> | undefined} previewStatusByTaskKey - Per-task-key status map (optional).
 * @param {boolean} aggregateLoading - Aggregate loading boolean (embedded path).
 * @param {boolean} aggregateError - Aggregate error boolean (embedded path).
 * @returns {PreviewStatus} The resolved per-column status.
 */
export function resolveColumnPreviewStatus(
  taskKey: string,
  previewStatusByTaskKey: ReadonlyMap<string, PreviewStatus> | undefined,
  aggregateLoading: boolean,
  aggregateError: boolean
): PreviewStatus {
  const entry = previewStatusByTaskKey?.get(taskKey);
  if (entry) {
    return entry;
  }
  return { isLoading: aggregateLoading, hasError: aggregateError };
}

/**
 * Build the three metric sub-columns (Completeness, Accuracy, SPaG) for a
 * single task group.
 *
 * Extracted to avoid excessive function nesting inside `useMemo`.
 *
 * @remarks
 * Each rendered cell delegates to `TaskMetricPreviewCell`, which owns the
 * trigger/Popover pair and the deferred preview body; this builder keeps the
 * column contract (shape, filtering, sorting, `<td>` tone and accessible
 * label) and supplies the delegated inputs.
 *
 * @param {TaskHeatmapColumn} taskColumn - The task column descriptor.
 * @param {number} taskIndex - The index of the task within the heatmap.
 * @param {Record<string, FilterValue | null>} tableFilters - Current filter state.
 * @param {CellPreviewLookup | null} cellPreviewLookup - Assignment lookup keyed by studentId × taskKey.
 * @param {boolean} columnIsLoading - Per-column resolved loading status.
 * @param {boolean} columnHasError - Per-column resolved error status.
 * @returns {TableColumnsType<TaskHeatmapRow>} Three metric sub-column definitions.
 */
export function buildTaskMetricSubColumns(
  taskColumn: TaskHeatmapColumn,
  taskIndex: number,
  tableFilters: Record<string, FilterValue | null>,
  cellPreviewLookup: CellPreviewLookup | null,
  columnIsLoading: boolean,
  columnHasError: boolean
): TableColumnsType<TaskHeatmapRow> {
  const taskTitle = taskColumn.taskTitle ?? taskColumn.taskId;

  return HEATMAP_METRIC_KEYS.map((metric, metricIndex) => {
    const meta = METRIC_DISPLAY_META.get(metric)!;
    const columnKey = `${taskColumn.taskKey}::${metric}`;
    const filterValue = tableFilters[columnKey];
    const rangeFilter = buildMetricRangeFilter<TaskHeatmapRow>({
      range: DEFAULT_TONE_RANGE,
      getMetric: (record): TaskDisplayMetric => getCellMetric(record.cells[taskIndex], metric),
      activeRange: decodeFilterToRange(filterValue),
      activeFilterKey:
        filterValue && filterValue.length > 0 && typeof filterValue[0] === 'string'
          ? filterValue[0]
          : undefined,
      showExcludedToggle: false,
    });
    return {
      key: columnKey,
      className: getZeroWeightMetricEdgeClass(
        metricIndex,
        HEATMAP_METRIC_KEYS.length,
        taskColumn.averageContribution
      ),
      title: <MetricIconLabel icon={meta.icon} label={meta.label} />,
      align: 'center' as const,
      width: APP_COL_WIDTH_METRIC,
      ...rangeFilter,
      sorter: {
        compare: buildMetricSorter(taskIndex, metric),
        multiple: 2,
      },
      onCell: (record: TaskHeatmapRow): { style: CSSProperties; 'aria-label': string } => {
        const m = getCellMetric(record.cells[taskIndex], metric);
        const { cellStyle } = resolveMetricTone(m);
        const score = formatMetricDisplayText(m, INDIVIDUAL_SCORE_PRECISION);
        const ariaLabel = buildMetricCellAccessibleLabel(
          record.studentName,
          taskTitle,
          metric,
          score
        );
        return {
          style: cellStyle,
          'aria-label': ariaLabel,
        };
      },
      render: (_: unknown, record: TaskHeatmapRow): JSX.Element => {
        const m = getCellMetric(record.cells[taskIndex], metric);
        const cellData = cellPreviewLookup?.get(record.studentId)?.get(taskColumn.taskKey) ?? null;
        const score = formatMetricDisplayText(m, INDIVIDUAL_SCORE_PRECISION);
        const ariaLabel = buildMetricCellAccessibleLabel(
          record.studentName,
          taskTitle,
          metric,
          score
        );

        return (
          <TaskMetricPreviewCell
            accessibleLabel={ariaLabel}
            scoreText={score}
            cellData={cellData}
            metricResult={m}
            metricKey={metric}
            taskId={taskColumn.taskId}
            isLoading={columnIsLoading}
            hasError={columnHasError}
          />
        );
      },
    };
  });
}

/**
 * Build the adaptive assignment-tier grouping for merged results.
 *
 * @remarks
 * Groups the result's `sourceAssignments` by `definitionKey`, preserving the
 * first-appearance order. Source assignments that share a definition key
 * collapse into a single parent group (their de-duplicated column set shares
 * one `taskKey` space, so only the first instance's identity survives in the
 * column list). The parent is labelled with the first instance's
 * `assignmentName`, suffixed with `" (shared definition)"` when the group
 * spans more than one source assignment. Column membership is resolved purely
 * by `definitionKey`, never by surface identity.
 *
 * @param {ReadonlyArray<{ assignmentId: string; definitionKey: string; assignmentName: string }>} sourceAssignments - The merged result's source assignments.
 * @param {ReadonlyArray<TaskHeatmapColumn>} taskColumns - The merged result's task columns.
 * @returns {ReadonlyArray<{ key: string; title: string; columnIndices: number[] }>} The tier groups.
 */
export function buildAdaptiveTierGroups(
  sourceAssignments: ReadonlyArray<{
    assignmentId: string;
    definitionKey: string;
    assignmentName: string;
  }>,
  taskColumns: ReadonlyArray<TaskHeatmapColumn>
): ReadonlyArray<{ key: string; title: string; columnIndices: number[] }> {
  const groups: { definitionKey: string; firstName: string; count: number }[] = [];
  const indexByDefinitionKey = new Map<string, number>();

  for (const assignment of sourceAssignments) {
    const existingIndex = indexByDefinitionKey.get(assignment.definitionKey);
    if (existingIndex === undefined) {
      indexByDefinitionKey.set(assignment.definitionKey, groups.length);
      groups.push({
        definitionKey: assignment.definitionKey,
        firstName: assignment.assignmentName,
        count: 1,
      });
    } else {
      groups[existingIndex]!.count += 1;
    }
  }

  // Single pass over the columns, bucketing each column index under its
  // definition key in ascending index order. Columns carrying no
  // `definitionKey` belong to no group, because group keys are always
  // non-empty strings.
  const columnIndicesByDefinitionKey = new Map<string, number[]>();
  for (const [index, column] of taskColumns.entries()) {
    const { definitionKey } = column;
    if (definitionKey === undefined) {
      continue;
    }
    const existingIndices = columnIndicesByDefinitionKey.get(definitionKey);
    if (existingIndices === undefined) {
      columnIndicesByDefinitionKey.set(definitionKey, [index]);
    } else {
      existingIndices.push(index);
    }
  }

  return groups.map((group) => ({
    key: group.definitionKey,
    title: group.count > 1 ? `${group.firstName}${SHARED_DEFINITION_SUFFIX}` : group.firstName,
    columnIndices: columnIndicesByDefinitionKey.get(group.definitionKey) ?? [],
  }));
}
