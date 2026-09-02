/**
 * Tests for `TaskHeatmapTable`.
 *
 * These tests encode the planned API surface of the component. The heatmap's
 * metric columns use a continuous gradient for cell colouring and a numeric
 * score-range `filterDropdown` (via `buildMetricRangeFilter`) rather than the
 * fixed `METRIC_COLUMN_FILTERS` band list.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.18
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';

import type { ComponentProps } from 'react';

import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapCell,
  HeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter';
import type {
  MergedHeatmapResult,
  MergedHeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter.merged';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';

import type { CellPreviewLookup, CellPreviewData } from './buildCellPreviewLookup';
import type { PreviewStatus } from './assembleMergedPreviewData';

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

// ---------------------------------------------------------------------------
// CellPreviewLookup fixtures for popover state tests
// ---------------------------------------------------------------------------

/** CellPreviewData fixture for the populated-lookup test (TEXT artifact). */
const TEXT_CELL_PREVIEW_DATA: CellPreviewData = {
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
const POPULATED_LOOKUP: CellPreviewLookup = new Map([['s-1', TASK_INNER_LOOKUP]]);

/** Empty CellPreviewLookup — no entries at all (simulates absent lookup data). */
const EMPTY_LOOKUP: CellPreviewLookup = new Map();

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
    (row) => (row as HTMLElement).dataset.rowKey ?? ''
  );
}

/**
 * Find the table cell `<td>` by its aria-label.
 *
 * Since both the `<td>` (via `onCell`) and the popover `<span>` trigger (via
 * `aria-label` + `aria-haspopup`) share the same label, use `getAllByLabelText`
 * and return the first match (the `<td>`, which comes first in DOM order).
 *
 * @param {string | RegExp} label - The aria-label value (or pattern) to search for.
 * @returns {HTMLElement} The first matching element (the table cell).
 */
function getHeatmapCellByLabel(label: string | RegExp): HTMLElement {
  return screen.getAllByLabelText(label)[0];
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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Assert Student Name top-level column header
    expect(screen.getByRole('columnheader', { name: /student name/i })).toBeInTheDocument();

    // Assert task group headers
    expect(screen.getByRole('columnheader', { name: TASK_1_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: TASK_2_TITLE })).toBeInTheDocument();

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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

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
  //    the row order changes to compareStudentNames order.
  // -------------------------------------------------------------------------
  it('clicking Student Name column sorter reorders rows via compareStudentNames', async () => {
    const result = buildHeatmapResult();
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default sort should be ascending by student name.
    // Fixture students: Student One, Student Two, Student Three
    // compareStudentNames (locale-aware, case-insensitive):
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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Student One (s-1), Task 1 (task_001), Completeness: 5 (green / computed)
    // Expected aria-label: "Student One, task_001, Completeness: 5"
    const cellAriaComputed = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    expect(cellAriaComputed).toBeInTheDocument();

    // Student Three (s-3), Task 1 (task_001), Completeness: notAttempted ('N')
    // Expected aria-label: "Student Three, task_001, Completeness: N"
    const cellAriaNotAttempted = getHeatmapCellByLabel('Student Three, task_001, Completeness: N');
    expect(cellAriaNotAttempted).toBeInTheDocument();

    // Student One (s-1), Task 1 (task_001), Accuracy: 3 (computed, default)
    // Expected aria-label: "Student One, task_001, Accuracy: 3"
    const cellAriaAccuracy = getHeatmapCellByLabel('Student One, task_001, Accuracy: 3');
    expect(cellAriaAccuracy).toBeInTheDocument();

    // Student Two (s-2), Task 2 (task_002), Completeness: E (error)
    // Expected aria-label: "Student Two, task_002, Completeness: E"
    const cellAriaError = getHeatmapCellByLabel('Student Two, task_002, Completeness: E');
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
      render(
        <TaskHeatmapTable
          heatmapResult={result}
          cellPreviewLookup={null}
          isAssignmentLoading={false}
          showAssignmentError={false}
        />
      );

      // Assert "No submissions yet" caption is present above the table
      expect(screen.getByText('No submissions yet')).toBeInTheDocument();

      // Assert every student row still renders
      expect(screen.getByText('Student One')).toBeInTheDocument();
      expect(screen.getByText('Student Two')).toBeInTheDocument();
      expect(screen.getByText('Student Three')).toBeInTheDocument();

      // Assert every task column renders with the expected group headers
      expect(screen.getByRole('columnheader', { name: TASK_1_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: TASK_2_TITLE })).toBeInTheDocument();

      // Each cell should show 'N' (rendered by MetricPill compact)
      // Count N occurrences — there are 3 students × 2 tasks × 3 metrics = 18 'N's
      const nCells = screen.getAllByText('N');
      expect(nCells.length).toBeGreaterThanOrEqual(
        METRIC_COLUMNS_PER_TASK * TASK_GROUP_COUNT * STUDENT_ROW_COUNT
      );
    });

    it('renders only the Student Name column header when taskColumns is empty', () => {
      const result = buildZeroTasksResult();
      render(
        <TaskHeatmapTable
          heatmapResult={result}
          cellPreviewLookup={null}
          isAssignmentLoading={false}
          showAssignmentError={false}
        />
      );

      // Student Name column should render
      expect(screen.getByRole('columnheader', { name: /student name/i })).toBeInTheDocument();

      // No task group headers
      expect(screen.queryByRole('columnheader', { name: TASK_1_ID })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: TASK_2_ID })).not.toBeInTheDocument();

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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Find a computed cell's score span via its aria-label
    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
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
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // The aria-label comes from onCell, not from render — Popover does not
    // change onCell, so the label should be unchanged.
    expect(getHeatmapCellByLabel('Student One, task_001, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student One, task_001, Accuracy: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, task_002, Completeness: E')).toBeInTheDocument();
  });

  it('preserves the existing cell tone style (background colour) after popover integration', () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Student One, Task 1, Completeness: 5 is a computed score at the ceiling
    // of the range — the cell should carry a green/gradient background colour.
    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    // resolveMetricTone sets backgroundColor (camelCase) on the <td> via onCell
    expect(cell.style.backgroundColor).toBeTruthy();
    expect(cell.style.backgroundColor).not.toBe('');
  });

  it('renders the heatmap with interactive metric sub-cells that open a popover on hover', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Assert metric sub-cells are present and labelled
    expect(getHeatmapCellByLabel('Student One, task_001, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, task_001, Completeness: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Three, task_001, Completeness: N')).toBeInTheDocument();

    // Hover a computed cell and assert the popover opens
    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      expect(document.querySelector('.ant-popover')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // real-data wiring: skeleton, error, populated, empty popover states
  // and metric cell display invariance.
  // -------------------------------------------------------------------------

  it('renders a skeleton in the popover when isAssignmentLoading is true', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={true}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      // The skeleton must use an <output> element (implicit role="status") with aria-busy="true"
      const skeleton = popover!.querySelector('output[aria-busy="true"]');
      expect(skeleton).toBeInTheDocument();
    });
  });

  it('renders an error Alert in the popover when showAssignmentError is true', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={true}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      expect(popover!.textContent).toContain("Couldn't load task details");
    });
  });

  it('shows artifact content from cellPreviewLookup in the popover when the lookup has data', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={POPULATED_LOOKUP}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      // The lookup provides TEXT artifact content — assert the reasoning text
      expect(popover!.textContent).toContain('Student answered the question correctly.');
    });
  });

  it('shows empty artifact and No reasoning available in the popover when the lookup has no entry', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={EMPTY_LOOKUP}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, task_001, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      // GREEN behaviour: when the lookup has no entry for this student/task,
      // the popover shows "No reasoning available"
      expect(popover!.textContent).toContain('No reasoning available');
    });
  });

  it('keeps metric score cell display unchanged regardless of the three new props', () => {
    // Render with loading state — cell display must be unchanged
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={true}
        showAssignmentError={false}
      />
    );

    expect(getHeatmapCellByLabel('Student One, task_001, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student One, task_001, Accuracy: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, task_002, Completeness: E')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Metric column sorter — clicking a metric sub-column sorter reorders
  //    rows via the shared compareMetricsByStateRank comparator.
  // -------------------------------------------------------------------------

  it('clicking Task 1 Completeness column sorter changes row order from the default sort', async () => {
    const result = buildHeatmapResult();
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default sort: student name ascending → s-1, s-3, s-2
    const defaultRowKeys = getRenderedRowKeys(container);
    expect(defaultRowKeys).toEqual(['s-1', 's-3', 's-2']);

    // Find the first Completeness column header (Task 1)
    const completenessHeaders = screen.getAllByRole('columnheader', {
      name: /completeness/i,
    });
    const task1CompletenessHeader = completenessHeaders[0];

    // Click its sorter
    const sorter = task1CompletenessHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();
    await user.click(sorter!);

    // After clicking the metric column sorter, the row order should differ
    // from the default student-name sort.
    const sortedRowKeys = getRenderedRowKeys(container);
    expect(sortedRowKeys).not.toEqual(defaultRowKeys);
    // The first row should no longer be s-1 (Student One)
    expect(sortedRowKeys[0]).not.toBe('s-1');
  });
});

// ===========================================================================
// Preview-status resolution order, merged wiring, and adaptive assignment tiers
// ===========================================================================

/** Readonly per-taskKey preview-status map (matches the planned prop contract). */
type PreviewStatusMap = ReadonlyMap<string, PreviewStatus>;

let lastRenderProperties: ComponentProps<typeof TaskHeatmapTable> | null = null;

/**
 * Render `TaskHeatmapTable` with its narrowed structural props.
 *
 * @param {ComponentProps<typeof TaskHeatmapTable>} properties - Component props.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderTable(
  properties: ComponentProps<typeof TaskHeatmapTable>
): ReturnType<typeof render> {
  lastRenderProperties = properties;
  return render(<TaskHeatmapTable {...properties} />);
}

// ---------------------------------------------------------------------------
// Merged-shaped fixtures (mirror `MergedHeatmapResult` contract)
// ---------------------------------------------------------------------------

/** Definition key for the single-source and first two-source assignment. */
const MERGED_DEF_1 = 'def-1';
/** Definition key for the second two-source assignment. */
const MERGED_DEF_2 = 'def-2';
/** Shared definition key used by the collapsed-duplicate fixture. */
const MERGED_DEF_SHARED = 'def-shared';

/** First source assignment identifier. */
const A1_ID = 'a-1';
/** First source assignment name (used as the adaptive-tier parent title). */
const A1_NAME = 'Assignment One';
/** Second source assignment identifier. */
const A2_ID = 'a-2';
/** Second source assignment name (used as the adaptive-tier parent title). */
const A2_NAME = 'Assignment Two';

/** Completeness score for the first task column in merged fixtures. */
const MERGED_PRIMARY_TASK_SCORE = 5;
/** Completeness score for subsequent task columns in merged fixtures. */
const MERGED_SECONDARY_TASK_SCORE = 3;

/**
 * Build merged-shaped student rows with the given number of task cells.
 *
 * @param {number} taskCount - Number of task columns (cells per row).
 * @returns {MergedHeatmapResult['rows']} Three student rows.
 */
function buildMergedRows(taskCount: number): MergedHeatmapResult['rows'] {
  const studentNames = ['Student One', 'Student Two', 'Student Three'];
  const studentIds = ['s-1', 's-2', 's-3'];
  return studentIds.map((studentId, index) => ({
    studentId,
    studentName: studentNames[index]!,
    cells: Array.from({ length: taskCount }, (_, taskIndex) =>
      buildCell({
        completenessValue:
          taskIndex === 0 ? MERGED_PRIMARY_TASK_SCORE : MERGED_SECONDARY_TASK_SCORE,
      })
    ),
  }));
}

/**
 * Build a single-source merged result (one assignment, three task columns).
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model for one assignment.
 */
function buildSingleSourceMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_1}::t1`,
      taskId: 't1',
      taskTitle: 'A1 Task 1',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t2`,
      taskId: 't2',
      taskTitle: 'A1 Task 2',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t3`,
      taskId: 't3',
      taskTitle: 'A1 Task 3',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_1, assignmentName: A1_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Build a two-source merged result (two assignments, two task columns each).
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model spanning two assignments.
 */
function buildTwoSourceMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_1}::t1`,
      taskId: 't1',
      taskTitle: 'A1 Task 1',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t2`,
      taskId: 't2',
      taskTitle: 'A1 Task 2',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t3`,
      taskId: 't3',
      taskTitle: 'A2 Task 1',
      assignmentId: A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: A2_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t4`,
      taskId: 't4',
      taskTitle: 'A2 Task 2',
      assignmentId: A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: A2_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_1, assignmentName: A1_NAME },
      { assignmentId: A2_ID, definitionKey: MERGED_DEF_2, assignmentName: A2_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Build a collapsed-duplicate merged result: two source assignments share one
 * definition key, so the de-duplicated columns carry the FIRST instance's identity.
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model with a collapsed column set.
 */
function buildCollapsedMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_SHARED}::t1`,
      taskId: 't1',
      taskTitle: 'Shared Task 1',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_SHARED}::t2`,
      taskId: 't2',
      taskTitle: 'Shared Task 2',
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: A1_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    // Both instances share the definition key — the signal set for a collapsed group.
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_SHARED, assignmentName: A1_NAME },
      { assignmentId: A2_ID, definitionKey: MERGED_DEF_SHARED, assignmentName: A2_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Open a metric cell popover by hovering its trigger and return the popover node.
 *
 * @param {string} taskId - The task ID whose Completeness cell should be hovered.
 * @returns {Promise<HTMLElement>} The opened Ant Design popover element.
 */
async function openTaskPopover(taskId: string): Promise<HTMLElement> {
  // Locate by task id and metric only — the completeness score varies per
  // column in the merged fixtures, so the score component of the label is
  // intentionally not pinned here.
  //
  // antd v6 reuses a SINGLE popup node across every trigger instance and, under
  // jsdom (which provides no layout), never rebinds that node's content to a
  // second trigger once it has opened. To inspect a specific cell's popover
  // content deterministically, remount the table from the captured render props
  // so the popup is freshly bound to THIS cell (skeleton / alert / card). The
  // behavioural assertions below run against the returned `.ant-popover` node
  // and are unchanged.
  if (lastRenderProperties) {
    cleanup();
    renderTable(lastRenderProperties);
  }
  // The merged fixtures vary the completeness score per task, so match by the
  // stable "Student One, <taskId>, Completeness:" label prefix rather than a
  // non-literal RegExp (lint-forbidden) or a hard-coded score.
  const cell = screen.getAllByLabelText((content): boolean =>
    content.startsWith(`Student One, ${taskId}, Completeness:`)
  )[0];
  const trigger = cell.querySelector('span');
  expect(trigger).toBeInTheDocument();
  await user.hover(trigger!);
  await waitFor(() => {
    const popovers = document.querySelectorAll('.ant-popover');
    const last = [...popovers].pop() ?? null;
    // antd v6 renders popover content directly under `.ant-popover-content`
    // (no v5-style `.ant-popover-inner-content` wrapper), so assert on the
    // actual content node.
    const inner = last?.querySelector('.ant-popover-content');
    expect(inner).toBeTruthy();
    expect((inner as HTMLElement)?.childElementCount ?? 0).toBeGreaterThan(0);
  });
  const popovers = document.querySelectorAll('.ant-popover');
  return ([...popovers].pop() ?? null) as HTMLElement;
}

describe('TaskHeatmapTable preview-status resolution and adaptive assignment tiers', () => {
  // -------------------------------------------------------------------------
  // Status resolution order — map entry FIRST, else aggregate booleans.
  // -------------------------------------------------------------------------

  it('renders a skeleton when the per-taskKey map entry is loading, overriding the false aggregate booleans', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: true, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  it('treats the aggregate loading flag as inert when the map supplies a healthy entry (normal card, not a skeleton)', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    // A healthy map entry must win over the aggregate loading flag.
    expect(popover.querySelector('output[aria-busy="true"]')).not.toBeInTheDocument();
    expect(popover.textContent).toContain('Student Response');
  });

  it('renders an error Alert when the per-taskKey map entry has an error, overriding the false aggregate booleans', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: true }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.textContent).toContain("Couldn't load task details");
  });

  it('owns status entirely via the map when aggregates are passed as false (loading → skeleton, error → alert, healthy → card)', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: true, hasError: false }],
      [`${MERGED_DEF_1}::t2`, { isLoading: false, hasError: true }],
      [`${MERGED_DEF_1}::t3`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popoverT1 = await openTaskPopover('t1');
    expect(popoverT1.querySelector('output[aria-busy="true"]')).toBeInTheDocument();

    const popoverT2 = await openTaskPopover('t2');
    expect(popoverT2.textContent).toContain("Couldn't load task details");

    const popoverT3 = await openTaskPopover('t3');
    expect(popoverT3.textContent).toContain('Student Response');
  });

  it('falls back to the aggregate loading boolean when the preview-status map is undefined (embedded parity)', async () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  it('falls back to the aggregate error boolean when the preview-status map is undefined (embedded parity)', async () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: true,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.textContent).toContain("Couldn't load task details");
  });

  it('falls back to the aggregate booleans for a column with no map entry (not a default healthy state)', async () => {
    const result = buildSingleSourceMergedResult();
    // Map present but healthy for t1 only; t2 has NO map entry. Aggregate is loading.
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    // Present, healthy entry must win → normal card (NOT the aggregate skeleton).
    const popoverT1 = await openTaskPopover('t1');
    expect(popoverT1.querySelector('output[aria-busy="true"]')).not.toBeInTheDocument();
    expect(popoverT1.textContent).toContain('Student Response');

    // Missing entry falls back to the loading aggregate → skeleton (NOT a default healthy card).
    const popoverT2 = await openTaskPopover('t2');
    expect(popoverT2.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Adaptive assignment tiers — deeper nested `children` grouping.
  // -------------------------------------------------------------------------

  it('renders a two-tier header with no assignment parent group for a single source assignment', () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    // No assignment parent group header titled by the assignment name.
    expect(screen.queryByRole('columnheader', { name: A1_NAME })).not.toBeInTheDocument();

    // Task group headers are still present (two-tier as today).
    expect(screen.getByRole('columnheader', { name: 'A1 Task 1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'A1 Task 2' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'A1 Task 3' })).toBeInTheDocument();
  });

  it('wraps each source assignment under a parent group column titled by assignmentName for two or more sources', () => {
    const result = buildTwoSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    const parentOne = screen.getByRole('columnheader', { name: A1_NAME });
    const parentTwo = screen.getByRole('columnheader', { name: A2_NAME });
    expect(parentOne).toBeInTheDocument();
    expect(parentTwo).toBeInTheDocument();

    // Stable order: the first source assignment's parent precedes the second.
    const headers = [...document.querySelectorAll('thead .ant-table-cell')];
    const oneIndex = headers.findIndex((header) => header.textContent?.includes(A1_NAME));
    const twoIndex = headers.findIndex((header) => header.textContent?.includes(A2_NAME));
    expect(oneIndex).toBeGreaterThanOrEqual(0);
    expect(twoIndex).toBeGreaterThan(oneIndex);
  });

  it('collapses two source assignments sharing a definition key into one parent group labelled "<first assignmentName> (shared definition)"', () => {
    const result = buildCollapsedMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    // Exactly one collapsed parent group, suffixed with the shared-definition label.
    const collapsedParent = screen.getByRole('columnheader', {
      name: `${A1_NAME} (shared definition)`,
    });
    expect(collapsedParent).toBeInTheDocument();

    // No second parent group for the second (sharing) assignment instance.
    expect(screen.queryByRole('columnheader', { name: A2_NAME })).not.toBeInTheDocument();

    // The shared definition produces ONE collapsed column set.
    expect(screen.getAllByRole('columnheader', { name: 'Shared Task 1' })).toHaveLength(1);
  });
});
