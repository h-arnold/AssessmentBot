import { screen } from '@testing-library/react';

import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapCell,
  HeatmapTaskColumn,
} from '../services/dataAnalysis/heatmapAdapter';
import type {
  CellPreviewLookup,
  CellPreviewData,
} from '../features/taskHeatmap/buildCellPreviewLookup';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from './dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Task column key used in the fixture. */
export const TASK_1_ID = 'task_001';
/** Task column key used in the fixture. */
export const TASK_2_ID = 'task_002';
/** Human-readable task title used in the fixture. */
export const TASK_1_TITLE = 'Task 1';
/** Human-readable task title used in the fixture. */
export const TASK_2_TITLE = 'Task 2';

/** Number of metric sub-columns per task group. */
export const METRIC_COLUMNS_PER_TASK = 3;

/** Number of task groups in the default fixture. */
export const TASK_GROUP_COUNT = 2;

/** Number of student rows in the default fixture. */
export const STUDENT_ROW_COUNT = 3;

/** Number of slider handles in the metric range filter. */
export const RANGE_SLIDER_HANDLE_COUNT = 2;

/** Shared task-column descriptors. */
export const TASK_COLUMNS: HeatmapTaskColumn[] = [
  {
    taskKey: 'definitionKey::task_001',
    taskId: TASK_1_ID,
    taskTitle: TASK_1_TITLE,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
  },
  {
    taskKey: 'definitionKey::task_002',
    taskId: TASK_2_ID,
    taskTitle: TASK_2_TITLE,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
  },
];

// ---------------------------------------------------------------------------
// CellPreviewLookup fixtures for popover state tests
// ---------------------------------------------------------------------------

/** CellPreviewData fixture for the populated-lookup test (TEXT artifact). */
export const TEXT_CELL_PREVIEW_DATA: CellPreviewData = {
  artifactType: 'TEXT',
  artifactContent: 'Student answered the question correctly.',
  reasoning: {
    completeness: 'Good understanding of concepts',
    accuracy: null,
    spag: null,
  },
};

/** Inner map (composite taskKey → CellPreviewData) for the populated-lookup test. */
const TASK_INNER_LOOKUP: ReadonlyMap<string, CellPreviewData> = new Map([
  ['definitionKey::task_001', TEXT_CELL_PREVIEW_DATA],
]);

/** CellPreviewLookup that includes data for s-1 / task_001. */
export const POPULATED_LOOKUP: CellPreviewLookup = new Map([['s-1', TASK_INNER_LOOKUP]]);

/** Empty CellPreviewLookup — no entries at all (simulates absent lookup data). */
export const EMPTY_LOOKUP: CellPreviewLookup = new Map();

/**
 * A score value that may be a numeric score, not attempted, or error.
 */
type CellMetricValue = number | 'N' | 'E';

/**
 * Input overrides for building a `HeatmapCell` fixture.
 */
type CellOverrides = {
  completenessValue?: CellMetricValue;
  accuracyValue?: CellMetricValue;
  spagValue?: CellMetricValue;
};

/** Default fixture value for completeness. */
const DEFAULT_COMPLETENESS: number = 4;
/** Default fixture value for accuracy. */
const DEFAULT_ACCURACY: number = 3;
/** Default fixture value for SPaG. */
const DEFAULT_SPAG: number = 3.5;

/**
 * Build a single `HeatmapCell` fixture from three metric value overrides.
 *
 * @param {CellOverrides} perCellOverrides - Per-metric overrides.
 * @returns {HeatmapCell} A cell with the requested metric values.
 */
export function buildCell(perCellOverrides: CellOverrides = {}): HeatmapCell {
  const {
    completenessValue = DEFAULT_COMPLETENESS,
    accuracyValue = DEFAULT_ACCURACY,
    spagValue = DEFAULT_SPAG,
  } = perCellOverrides;

  return {
    completeness: buildMetricResult(completenessValue),
    accuracy: buildMetricResult(accuracyValue),
    spag: buildMetricResult(spagValue),
  };
}

/**
 * Build a single `MetricResult` from a score value.
 *
 * @param {CellMetricValue} value - The score to convert.
 * @returns {MetricResult} A metric result fixture.
 */
function buildMetricResult(value: CellMetricValue) {
  if (value === 'N') return createNotAttemptedMetricResult();
  if (value === 'E') return createErrorMetricResult();
  return createComputedMetricResult({ value: value as number });
}

/**
 * Build a `HeatmapResult` fixture with the given row data.
 *
 * The default fixture gives 3 students with metric values spread across bands:
 *   - Student One (s-1):  Task 1 Completeness = 5 (green), Task 2 Accuracy = 'N'
 *   - Student Two (s-2):  Task 1 Completeness = 3 (amber/gold), Task 2 Completeness = 'E'
 *   - Student Three (s-3): Task 1 Completeness = 'N', Task 2 Completeness = 4 (green)
 *
 * @param {Partial<HeatmapResult>} [overrides] - Overrides for the fixture.
 * @returns {HeatmapResult} A heatmap result fixture.
 */
export function buildHeatmapResult(overrides: Partial<HeatmapResult> = {}): HeatmapResult {
  const rows: HeatmapRow[] = [
    {
      studentId: 's-1',
      studentName: 'Student One',
      cells: [
        buildCell({ completenessValue: 5 }), // Task 1: green
        buildCell({ accuracyValue: 'N' }), // Task 2: notAttempted accuracy
      ],
    },
    {
      studentId: 's-2',
      studentName: 'Student Two',
      cells: [
        buildCell({ completenessValue: 3 }), // Task 1: amber/gold
        buildCell({ completenessValue: 'E' }), // Task 2: error
      ],
    },
    {
      studentId: 's-3',
      studentName: 'Student Three',
      cells: [
        buildCell({ completenessValue: 'N' }), // Task 1: notAttempted
        buildCell({ completenessValue: 4 }), // Task 2: green
      ],
    },
  ];

  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows,
    taskColumns: TASK_COLUMNS,
    ...overrides,
  };
}

/**
 * Build an all-not-attempted fixture ("no submissions" variant).
 *
 * @returns {HeatmapResult} A fixture where every cell is `notAttempted`.
 */
export function buildNoSubmissionsResult(): HeatmapResult {
  const notAttemptedCellOverrides: CellOverrides = {
    completenessValue: 'N',
    accuracyValue: 'N',
    spagValue: 'N',
  };
  const rows: HeatmapRow[] = [
    { studentId: 's-1', studentName: 'Student One' },
    { studentId: 's-2', studentName: 'Student Two' },
    { studentId: 's-3', studentName: 'Student Three' },
  ].map(({ studentId, studentName }) => ({
    studentId,
    studentName,
    cells: TASK_COLUMNS.map(() => buildCell(notAttemptedCellOverrides)),
  }));

  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows,
    taskColumns: TASK_COLUMNS,
  };
}

/**
 * Build a zero-tasks fixture (empty task columns).
 *
 * @returns {HeatmapResult} A fixture with no task columns.
 */
export function buildZeroTasksResult(): HeatmapResult {
  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows: [],
    taskColumns: [],
  };
}

/**
 * Build a one-token-student fixture (empty-surname variant).
 *
 * @returns {HeatmapResult} A fixture with a single one-token student row.
 */
export function buildOneTokenHeatmapResult(): HeatmapResult {
  return buildHeatmapResult({
    rows: [{ studentId: 's-1', studentName: 'Plato', cells: [buildCell({}), buildCell({})] }],
  });
}

/**
 * Build a heatmap result whose three orderings are pairwise distinct, so each
 * split-column sorter is uniquely distinguished from the default full-name
 * order and from the sibling column.
 *
 * Rows: Alice Smith (s-1), Alice Brown (s-2), Bob Jones (s-3).
 * Full-name ascending: Brown s-2, Smith s-1, Jones s-3.
 * Forename ascending (Alice tie broken by studentId, then Bob): s-1, s-2, s-3.
 * Surname ascending (Brown, Jones, Smith): s-2, s-3, s-1.
 *
 * @returns {HeatmapResult} A heatmap result with sorter-distinguishing rows.
 */
export function buildDistinctOrderHeatmapResult(): HeatmapResult {
  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows: [
      { studentId: 's-1', studentName: 'Alice Smith', cells: [buildCell({}), buildCell({})] },
      { studentId: 's-2', studentName: 'Alice Brown', cells: [buildCell({}), buildCell({})] },
      { studentId: 's-3', studentName: 'Bob Jones', cells: [buildCell({}), buildCell({})] },
    ],
    taskColumns: TASK_COLUMNS,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the `data-row-key` values from rendered table body rows in document order.
 *
 * @param {HTMLElement} container - The rendered container.
 * @returns {string[]} Row keys in visual order.
 */
export function getRenderedRowKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr[data-row-key]')].map(
    (row) => (row as HTMLElement).dataset.rowKey ?? ''
  );
}

/**
 * Find the table cell `<td>` by its aria-label.
 *
 * Since both the `<td>` (via `onCell`) and the popover `<span>` trigger (via
 * `aria-label`) share the same accessible label, use `getAllByLabelText` and
 * return the first match (the `<td>`, which comes first in DOM order).
 *
 * @param {string | RegExp} label - The aria-label value (or pattern) to search for.
 * @returns {HTMLElement} The first matching element (the table cell).
 */
export function getHeatmapCellByLabel(label: string | RegExp): HTMLElement {
  return screen.getAllByLabelText(label)[0];
}
