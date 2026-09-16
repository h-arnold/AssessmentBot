/**
 * Forename/Surname column contract for the Task Heatmap table.
 *
 * @remarks
 * Red phase: asserts split Forename/Surname columns with full-name metric
 * aria-labels, one-token surname emptiness, and per-column Forename/Surname
 * sorters built from the shared split helper. Header and split-cell
 * assertions fail against the current single Student Name column; the
 * sorter assertions fail at the missing Forename/Surname headers for the
 * same reason. The aria-label case pins the retained full-name behaviour
 * for the Green phase.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapCell,
  HeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Completeness score for the fixture cells. */
const FIXTURE_COMPLETENESS = 4;

/** Accuracy score for the fixture cells. */
const FIXTURE_ACCURACY = 3;

/** SPaG score for the fixture cells. */
const FIXTURE_SPAG = 3.5;

/** Single-token student name with an empty surname. */
const ONE_TOKEN_NAME = 'Plato';

/** Two-token student name used for split-cell assertions. */
const TWO_TOKEN_NAME = 'Alice Smith';

/** Second two-token student name used for ordering fixtures. */
const SECOND_TWO_TOKEN_NAME = 'Bob Jones';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Shared task-column descriptors for the fixture heatmap. */
const TASK_COLUMNS: HeatmapTaskColumn[] = [
  { taskKey: 'definitionKey::task_001', taskId: 'task_001', taskTitle: 'Task 1' },
];

/**
 * Build a single heatmap cell fixture with computed metric values.
 *
 * @returns {HeatmapCell} A cell with computed metric results.
 */
function buildCell(): HeatmapCell {
  return {
    completeness: createComputedMetricResult({ value: FIXTURE_COMPLETENESS }),
    accuracy: createComputedMetricResult({ value: FIXTURE_ACCURACY }),
    spag: createComputedMetricResult({ value: FIXTURE_SPAG }),
  };
}

/**
 * Build a heatmap row fixture for the given student identity.
 *
 * @param {string} studentId - The stable student identifier.
 * @param {string} studentName - The stored single-string display name.
 * @returns {HeatmapRow} A heatmap row with one task cell.
 */
function buildRow(studentId: string, studentName: string): HeatmapRow {
  return { studentId, studentName, cells: [buildCell()] };
}

/**
 * Build a heatmap result fixture with two-token and one-token students.
 *
 * @returns {HeatmapResult} A heatmap result with three student rows.
 */
function buildHeatmapResult(): HeatmapResult {
  const rows: HeatmapRow[] = [
    buildRow('s-1', TWO_TOKEN_NAME),
    buildRow('s-2', SECOND_TWO_TOKEN_NAME),
    buildRow('s-3', ONE_TOKEN_NAME),
  ];
  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows,
    taskColumns: TASK_COLUMNS,
  };
}

afterEach(() => {
  cleanup();
});

/**
 * Read the `data-row-key` values from rendered table body rows in order.
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
function buildSorterHeatmapResult(): HeatmapResult {
  return {
    assignmentId: 'assignment-1',
    assignmentName: 'Assignment One',
    className: 'Class A',
    rows: [
      buildRow('s-1', TWO_TOKEN_NAME),
      buildRow('s-2', 'Alice Brown'),
      buildRow('s-3', SECOND_TWO_TOKEN_NAME),
    ],
    taskColumns: TASK_COLUMNS,
  };
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('Task Heatmap Forename/Surname columns', () => {
  it('renders Forename and Surname headers replacing the single Student Name column', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Forename' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Surname' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Student Name' })).not.toBeInTheDocument();
  });

  it('renders split forename and surname values for the first row', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Smith')).toBeInTheDocument();
  });

  it('keeps metric-cell aria-labels on the full name', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(
      screen.getAllByLabelText('Alice Smith, task_001, Completeness: 4')[0]
    ).toBeInTheDocument();
  });

  it('renders a one-token student without crashing and keeps the forename visible', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(screen.getByText(ONE_TOKEN_NAME)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Forename' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Surname' })).toBeInTheDocument();
  });

  it('orders rows by forename via the Forename column sorter', async () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildSorterHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default full-name ascending: Brown s-2, Smith s-1, Jones s-3.
    expect(getRenderedRowKeys(container)).toEqual(['s-2', 's-1', 's-3']);

    const forenameHeader = screen.getByRole('columnheader', { name: 'Forename' });
    const sorter = forenameHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();
    await user.click(sorter!);

    // Forename ascending: Alice tie broken by studentId, then Bob.
    expect(getRenderedRowKeys(container)).toEqual(['s-1', 's-2', 's-3']);
  });

  it('orders rows by surname via the Surname column sorter', async () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildSorterHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default full-name ascending: Brown s-2, Smith s-1, Jones s-3.
    expect(getRenderedRowKeys(container)).toEqual(['s-2', 's-1', 's-3']);

    const surnameHeader = screen.getByRole('columnheader', { name: 'Surname' });
    const sorter = surnameHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();
    await user.click(sorter!);

    // Surname ascending: Brown, Jones, Smith.
    expect(getRenderedRowKeys(container)).toEqual(['s-2', 's-3', 's-1']);
  });
});
