/**
 * Task Heatmap table component.
 *
 * Renders a grouped-header Ant Design Table from a structurally-narrowed
 * heatmap view model (`TaskHeatmapData`). The first column (Student Name) is
 * sticky with locale-aware sorting and default ascending order. Each task
 * column groups three metric sub-columns (Completeness, Accuracy, SPaG) with
 * score-range filters and a SPEC-ordered metric comparator.
 *
 * Column construction, popover content, per-column preview-status resolution,
 * and the adaptive assignment-tier grouping live in the co-located
 * `taskHeatmapTableColumns.tsx` helper module (extracted when this component
 * breached the 500-line split gate). The component owns local filter state
 * (keyed by column key), row sorting, the no-submissions caption, and the
 * memoised column tree.
 *
 * @see SPEC.md
 * @see ACTION_PLAN.md §Section 3
 */

import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { FilterValue } from 'antd/es/table/interface';

import { compareHeatmapStudentName } from './taskHeatmapModel';
import {
  buildAdaptiveTierGroups,
  buildTaskMetricSubColumns,
  resolveColumnPreviewStatus,
  type TaskHeatmapColumn,
  type TaskHeatmapData,
  type TaskHeatmapRow,
} from './taskHeatmapTableColumns';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import { APP_COL_WIDTH_STUDENT_NAME } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render a heatmap table from a structurally-narrowed heatmap view model.
 *
 * @remarks
 * **Structural-subset typing (why not generics).** The prop type is a plain
 * structural contract (`TaskHeatmapData`) rather than a generic over the two
 * adapter output types. Both `HeatmapResult` (embedded) and
 * `MergedHeatmapResult` (merged) satisfy it structurally with no casts: the
 * column element requires only `{ taskKey; taskId; taskTitle }` plus optional
 * assignment-identity fields, and the result requires only `rows` /
 * `taskColumns` plus an optional `sourceAssignments` signal. A generic would
 * force callers to thread the adapter type through every render path for no
 * behavioural gain — the table reads only the subset it needs and branches on
 * the optional `sourceAssignments` count, never on surface identity.
 *
 * **Two-mode preview-status contract.** Preview status resolves per
 * `taskKey` via the optional `previewStatusByTaskKey` map when supplied
 * (present entry wins; missing entry falls back to the aggregate booleans),
 * and falls back entirely to the aggregate `isAssignmentLoading` /
 * `showAssignmentError` booleans when the map is absent — keeping the embedded
 * render byte-identical.
 *
 * @param {Readonly<{ heatmapResult: TaskHeatmapData; cellPreviewLookup: CellPreviewLookup | null; isAssignmentLoading: boolean; showAssignmentError: boolean; previewStatusByTaskKey?: ReadonlyMap<string, { isLoading: boolean; hasError: boolean }> }>} props - Component properties.
 * @returns {JSX.Element} The rendered table.
 */
export function TaskHeatmapTable({
  heatmapResult,
  cellPreviewLookup,
  isAssignmentLoading,
  showAssignmentError,
  previewStatusByTaskKey,
}: Readonly<{
  heatmapResult: TaskHeatmapData;
  cellPreviewLookup: CellPreviewLookup | null;
  isAssignmentLoading: boolean;
  showAssignmentError: boolean;
  previewStatusByTaskKey?: ReadonlyMap<string, { isLoading: boolean; hasError: boolean }>;
}>): JSX.Element {
  const { taskColumns, rows, sourceAssignments } = heatmapResult;

  // ── Table-level filter state lifted from the onChange callback ──────────
  const [tableFilters, setTableFilters] = useState<Record<string, FilterValue | null>>({});

  // ── Memoised derived values ─────────────────────────────────────────────

  // Pre-sort by student name ascending so the default sort order is applied
  // to the initial render. Ant Design Table applies subsequent sorter changes
  // over the dataSource prop.
  const sortedRows = useMemo(
    () => rows.toSorted(compareHeatmapStudentName),
    [rows],
  );

  // Determine whether every cell across every row is not-attempted (the "no
  // submissions" empty-state variant). The guard includes `taskColumns.length > 0`
  // to prevent a false caption when the assignment has zero tasks.
  const hasNoSubmissions = useMemo(
    () =>
      taskColumns.length > 0 &&
      rows.length > 0 &&
      rows.every((row) =>
        row.cells.every(
          (cell) =>
            cell.completeness.state === 'notAttempted' &&
            cell.accuracy.state === 'notAttempted' &&
            cell.spag.state === 'notAttempted',
        ),
      ),
    [rows, taskColumns],
  );

  const columns: TableColumnsType<TaskHeatmapRow> = useMemo(() => {
    // ── Student Name (top-level column, no children) ──────────────
    const studentNameColumn = {
      key: 'studentName',
      title: 'Student Name',
      fixed: 'start' as const,
      width: APP_COL_WIDTH_STUDENT_NAME,
      sorter: { compare: compareHeatmapStudentName, multiple: 1 },
      defaultSortOrder: 'ascend' as const,
      render: (_: unknown, record: TaskHeatmapRow): JSX.Element => (
        <Typography.Text>{record.studentName}</Typography.Text>
      ),
    };

    // ── Per-task group columns (built once, indexed by task position) ─
    const groupedTaskColumns = taskColumns.map((taskColumn: TaskHeatmapColumn, taskIndex) => {
      const status = resolveColumnPreviewStatus(
        taskColumn.taskKey,
        previewStatusByTaskKey,
        isAssignmentLoading,
        showAssignmentError,
      );
      return {
        key: taskColumn.taskKey,
        title: taskColumn.taskTitle ?? taskColumn.taskId,
        children: buildTaskMetricSubColumns(
          taskColumn,
          taskIndex,
          tableFilters,
          cellPreviewLookup,
          status.isLoading,
          status.hasError,
        ),
      };
    });

    // ── Adaptive assignment tier (merged mode, ≥2 sources) ────────
    // Single source (including the embedded path, where `sourceAssignments`
    // is absent) renders the same two-tier DOM as today: no parent group.
    if (sourceAssignments && sourceAssignments.length > 1) {
      const tierGroups = buildAdaptiveTierGroups(sourceAssignments, taskColumns);
      const taskTierColumns = tierGroups.map((group) => ({
        key: group.key,
        title: group.title,
        children: group.columnIndices.map((index) => groupedTaskColumns[index]!),
      }));
      return [studentNameColumn, ...taskTierColumns];
    }

    return [studentNameColumn, ...groupedTaskColumns];
  }, [
    taskColumns,
    tableFilters,
    cellPreviewLookup,
    isAssignmentLoading,
    showAssignmentError,
    previewStatusByTaskKey,
    sourceAssignments,
  ]);

  return (
    <>
      {hasNoSubmissions && (
        <Typography.Paragraph>No submissions yet</Typography.Paragraph>
      )}
      <Table<TaskHeatmapRow>
        rowKey="studentId"
        columns={columns}
        dataSource={sortedRows}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        aria-label="Task Heatmap"
        onChange={(_pagination, filters): void => {
          setTableFilters(filters as Record<string, FilterValue | null>);
        }}
      />
    </>
  );
}
