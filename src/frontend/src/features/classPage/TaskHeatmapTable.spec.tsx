/**
 * Tests for `TaskHeatmapTable`.
 *
 * These tests encode the planned API surface of the component. The heatmap's
 * metric columns use a continuous gradient for cell colouring and a numeric
 * score-range `filterDropdown` (via `buildMetricRangeFilter`) rather than the
 * fixed `METRIC_COLUMN_FILTERS` band list.
 *
 * @see ACTION_PLAN.md §4 — TaskHeatmapTable (grouped headers, score-range filters, sorters)
 * @see TASK_PREVIEW_CARD_LAYOUT.md — §"1. Popover trigger (metric sub-cell)", §"States", §"Accessibility and motion"
 * @see SPEC.md — §"Rendering rules", §"Sorting, filtering", §"Empty state", §"Accessibility"
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';

import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapCell,
  HeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Task column key used in the fixture. */
const TASK_1_ID = 'task_001';
/** Task column key used in the fixture. */
const TASK_2_ID = 'task_002';
/** Human-readable task title used in the fixture. */
const TASK_1_TITLE = 'Task 1';
/** Human-readable task title used in the fixture. */
const TASK_2_TITLE = 'Task 2';

/** Number of metric sub-columns per task group. */
const METRIC_COLUMNS_PER_TASK = 3;

/** Number of task groups in the default fixture. */
const TASK_GROUP_COUNT = 2;

/** Number of student rows in the default fixture. */
const STUDENT_ROW_COUNT = 3;

/** Number of slider handles in the metric range filter. */
const RANGE_SLIDER_HANDLE_COUNT = 2;

/** Shared task-column descriptors. */
const TASK_COLUMNS: HeatmapTaskColumn[] = [
  { taskKey: 'definitionKey::task_001', taskId: TASK_1_ID, taskTitle: TASK_1_TITLE },
  { taskKey: 'definitionKey::task_002', taskId: TASK_2_ID, taskTitle: TASK_2_TITLE },
];

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
function buildCell(perCellOverrides: CellOverrides = {}): HeatmapCell {
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
function buildHeatmapResult(overrides: Partial<HeatmapResult> = {}): HeatmapResult {
  const rows: HeatmapRow[] = [
    {
      studentId: 's-1',
      studentName: 'Student One',
      cells: [
        buildCell({ completenessValue: 5 }),           // Task 1: green
        buildCell({ accuracyValue: 'N' }),              // Task 2: notAttempted accuracy
      ],
    },
    {
      studentId: 's-2',
      studentName: 'Student Two',
      cells: [
        buildCell({ completenessValue: 3 }),            // Task 1: amber/gold
        buildCell({ completenessValue: 'E' }),          // Task 2: error
      ],
    },
    {
      studentId: 's-3',
      studentName: 'Student Three',
      cells: [
        buildCell({ completenessValue: 'N' }),          // Task 1: notAttempted
        buildCell({ completenessValue: 4 }),            // Task 2: green
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
function buildNoSubmissionsResult(): HeatmapResult {
  const rows: HeatmapRow[] = [
    {
      studentId: 's-1',
      studentName: 'Student One',
      cells: [
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
      ],
    },
    {
      studentId: 's-2',
      studentName: 'Student Two',
      cells: [
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
      ],
    },
    {
      studentId: 's-3',
      studentName: 'Student Three',
      cells: [
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
        buildCell({
          completenessValue: 'N',
          accuracyValue: 'N',
          spagValue: 'N',
        }),
      ],
    },
  ];

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
function buildZeroTasksResult(): HeatmapResult {
  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows: [],
    taskColumns: [],
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
function getRenderedRowKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr[data-row-key]')].map(
    (row) => (row as HTMLElement).dataset.rowKey ?? '',
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('TaskHeatmapTable', () => {
  // -------------------------------------------------------------------------
  // 1. Grouped header — renders one group per taskColumn and three metric
  //    sub-columns within each group.
  // -------------------------------------------------------------------------
  it('renders a grouped header with one group per taskColumn and Completeness / Accuracy / SPaG sub-columns', () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Assert Student Name top-level column header
    expect(
      screen.getByRole('columnheader', { name: /student name/i })
    ).toBeInTheDocument();

    // Assert task group headers
    expect(
      screen.getByRole('columnheader', { name: TASK_1_TITLE })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: TASK_2_TITLE })
    ).toBeInTheDocument();

    // Find the three metric sub-column headers by their text
    const completenessHeaders = screen.getAllByRole('columnheader', {
      name: /completeness/i,
    });
    const accuracyHeaders = screen.getAllByRole('columnheader', {
      name: /accuracy/i,
    });
    const spagHeaders = screen.getAllByRole('columnheader', {
      name: /spag/i,
    });

    // There should be exactly 2 of each (one per task group)
    expect(completenessHeaders).toHaveLength(TASK_GROUP_COUNT);
    expect(accuracyHeaders).toHaveLength(TASK_GROUP_COUNT);
    expect(spagHeaders).toHaveLength(TASK_GROUP_COUNT);
  });

  // -------------------------------------------------------------------------
  // 2. Score-range filter UI — the Task 1 > Completeness column exposes a
  //    numeric range filter (two-thumb Slider + Reset) instead of the old
  //    fixed band menu. The predicate itself is covered by the
  //    `metricInRange` unit tests and the averages-table onFilter integration.
  // -------------------------------------------------------------------------
  it('exposes a score-range filter dropdown (slider + reset) on Task 1 Completeness', async () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Locate the "Completeness" columnheader that belongs to Task 1.
    const completenessHeaders = screen.getAllByRole('columnheader', {
      name: /completeness/i,
    });
    expect(completenessHeaders.length).toBeGreaterThanOrEqual(1);

    // The first Completeness header belongs to Task 1 (Task 1 group renders
    // before Task 2, so its sub-header is first).
    const task1CompletenessHeader = completenessHeaders[0];

    // Ant Design renders a filter button inside the column header
    const filterButton = within(task1CompletenessHeader).getByRole('button');
    expect(filterButton).toBeInTheDocument();

    // Open the filter dropdown — it renders a two-thumb Slider (0–5) + Reset,
    // and must NOT contain the old fixed band menu items.
    await user.click(filterButton);

    const sliders = await screen.findAllByRole('slider');
    expect(sliders).toHaveLength(RANGE_SLIDER_HANDLE_COUNT);

    const lowerHandle = sliders.find(
      (handle): boolean => handle.getAttribute('aria-valuenow') === '0'
    )!;
    const upperHandle = sliders.find(
      (handle): boolean => handle.getAttribute('aria-valuenow') === '5'
    )!;
    expect(lowerHandle).toBeInTheDocument();
    expect(upperHandle).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    expect(screen.queryByText('Green (high)')).not.toBeInTheDocument();
    expect(screen.queryByText('Red (low)')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Student Name sort — click the Student Name column sorter and assert
  //    the row order changes to compareHeatmapStudentName order.
  // -------------------------------------------------------------------------
  it('clicking Student Name column sorter reorders rows via compareHeatmapStudentName', async () => {
    const result = buildHeatmapResult();
    const { container } = render(<TaskHeatmapTable heatmapResult={result} />);

    // Default sort should be ascending by student name.
    // Fixture students: Student One, Student Two, Student Three
    // compareHeatmapStudentName (locale-aware, case-insensitive):
    //   "Student One" < "Student Three" < "Student Two"
    // Expected initial order: s-1, s-3, s-2
    const initialRowKeys = getRenderedRowKeys(container);
    expect(initialRowKeys).toEqual(['s-1', 's-3', 's-2']);

    // Click the Student Name column header sorter
    const studentNameHeader = screen.getByRole('columnheader', {
      name: /student name/i,
    });
    const sorter = studentNameHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();

    // First click: descending (toggle from default 'ascend' to 'descend')
    await user.click(sorter!);

    // Expected descending order: Student Two, Student Three, Student One
    const descRowKeys = getRenderedRowKeys(container);
    expect(descRowKeys).toEqual(['s-2', 's-3', 's-1']);

    // Second click: back to ascending
    await user.click(sorter!);

    const ascRowKeys = getRenderedRowKeys(container);
    expect(ascRowKeys).toEqual(['s-1', 's-3', 's-2']);
  });

  // -------------------------------------------------------------------------
  // 4. Cell aria-label — assert the rendered cell has the exact expected
  //    aria-label for known student/task/metric combinations.
  // -------------------------------------------------------------------------
  it('renders per-cell aria-labels matching "[Student Name], [Task ID], [Metric]: [Score]"', () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Student One (s-1), Task 1 (task_001), Completeness: 5 (green / computed)
    // Expected aria-label: "Student One, task_001, Completeness: 5"
    const cellAriaComputed = screen.getByLabelText(
      'Student One, task_001, Completeness: 5'
    );
    expect(cellAriaComputed).toBeInTheDocument();

    // Student Three (s-3), Task 1 (task_001), Completeness: notAttempted ('N')
    // Expected aria-label: "Student Three, task_001, Completeness: N"
    const cellAriaNotAttempted = screen.getByLabelText(
      'Student Three, task_001, Completeness: N'
    );
    expect(cellAriaNotAttempted).toBeInTheDocument();

    // Student One (s-1), Task 1 (task_001), Accuracy: 3 (computed, default)
    // Expected aria-label: "Student One, task_001, Accuracy: 3"
    const cellAriaAccuracy = screen.getByLabelText(
      'Student One, task_001, Accuracy: 3'
    );
    expect(cellAriaAccuracy).toBeInTheDocument();

    // Student Two (s-2), Task 2 (task_002), Completeness: E (error)
    // Expected aria-label: "Student Two, task_002, Completeness: E"
    const cellAriaError = screen.getByLabelText(
      'Student Two, task_002, Completeness: E'
    );
    expect(cellAriaError).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 5. Empty-state — two sub-fixtures:
  //    (a) "no submissions": all cells = notAttempted
  //    (b) "zero tasks": taskColumns: []
  // -------------------------------------------------------------------------
  describe('empty state', () => {
    it('renders all rows with N cells and a "No submissions yet" caption when every cell is notAttempted', () => {
      const result = buildNoSubmissionsResult();
      render(<TaskHeatmapTable heatmapResult={result} />);

      // Assert "No submissions yet" caption is present above the table
      expect(screen.getByText('No submissions yet')).toBeInTheDocument();

      // Assert every student row still renders
      expect(screen.getByText('Student One')).toBeInTheDocument();
      expect(screen.getByText('Student Two')).toBeInTheDocument();
      expect(screen.getByText('Student Three')).toBeInTheDocument();

      // Assert every task column renders with the expected group headers
      expect(
        screen.getByRole('columnheader', { name: TASK_1_TITLE })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: TASK_2_TITLE })
      ).toBeInTheDocument();

      // Each cell should show 'N' (rendered by MetricPill compact)
      // Count N occurrences — there are 3 students × 2 tasks × 3 metrics = 18 'N's
      const nCells = screen.getAllByText('N');
      expect(nCells.length).toBeGreaterThanOrEqual(
        METRIC_COLUMNS_PER_TASK * TASK_GROUP_COUNT * STUDENT_ROW_COUNT
      );
    });

    it('renders only the Student Name column header when taskColumns is empty', () => {
      const result = buildZeroTasksResult();
      render(<TaskHeatmapTable heatmapResult={result} />);

      // Student Name column should render
      expect(
        screen.getByRole('columnheader', { name: /student name/i })
      ).toBeInTheDocument();

      // No task group headers
      expect(
        screen.queryByRole('columnheader', { name: TASK_1_ID })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('columnheader', { name: TASK_2_ID })
      ).not.toBeInTheDocument();

      // No metric sub-column headers
      expect(screen.queryByRole('columnheader', { name: /completeness/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /accuracy/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /spag/i })).not.toBeInTheDocument();

      // No task-001 or task-002 references anywhere in the document
      expect(screen.queryByText(TASK_1_ID)).not.toBeInTheDocument();
      expect(screen.queryByText(TASK_2_ID)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Popover integration — metric sub-cells are wrapped in Popover with
  //    TaskPreviewCard content, while existing cell appearance is preserved.
  // -------------------------------------------------------------------------

  it('wraps each metric sub-cell render output in an Ant Design Popover', async () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Find a computed cell's score span via its aria-label
    const cell = screen.getByLabelText(
      'Student One, task_001, Completeness: 5'
    );
    const trigger = cell.querySelector('span');
    expect(trigger).toBeInTheDocument();

    // Hover the trigger — Popover should appear after mouseEnterDelay
    await user.hover(trigger!);

    // Assert the popover wrapper appears in the DOM
    await waitFor(() => {
      expect(document.querySelector('.ant-popover')).toBeInTheDocument();
    });
  });

  it('popover content renders the TaskPreviewCard with metric label, reasoning, and student response sections', async () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    const cell = screen.getByLabelText(
      'Student One, task_001, Completeness: 5'
    );
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    // Wait for popover to open and assert TaskPreviewCard sections
    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      expect(popover!.textContent).toContain('Completeness');
      expect(popover!.textContent).toContain('Reasoning');
      expect(popover!.textContent).toContain('Student Response');
    });
  });

  it('preserves the existing aria-label on metric sub-cells after popover integration', () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // The aria-label comes from onCell, not from render — Popover does not
    // change onCell, so the label should be unchanged.
    expect(
      screen.getByLabelText('Student One, task_001, Completeness: 5')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Student One, task_001, Accuracy: 3')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Student Two, task_002, Completeness: E')
    ).toBeInTheDocument();
  });

  it('preserves the existing cell tone style (background colour) after popover integration', () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Student One, Task 1, Completeness: 5 is a computed score at the ceiling
    // of the range — the cell should carry a green/gradient background colour.
    const cell = screen.getByLabelText(
      'Student One, task_001, Completeness: 5'
    );
    // resolveMetricTone sets backgroundColor (camelCase) on the <td> via onCell
    expect(cell.style.backgroundColor).toBeTruthy();
    expect(cell.style.backgroundColor).not.toBe('');
  });

  it('renders the heatmap with interactive metric sub-cells that open a popover on hover', async () => {
    const result = buildHeatmapResult();
    render(<TaskHeatmapTable heatmapResult={result} />);

    // Assert metric sub-cells are present and labelled
    expect(
      screen.getByLabelText('Student One, task_001, Completeness: 5')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Student Two, task_001, Completeness: 3')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Student Three, task_001, Completeness: N')
    ).toBeInTheDocument();

    // Hover a computed cell and assert the popover opens
    const cell = screen.getByLabelText(
      'Student One, task_001, Completeness: 5'
    );
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      expect(document.querySelector('.ant-popover')).toBeInTheDocument();
    });
  });
});