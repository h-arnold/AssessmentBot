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
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';

import {
  METRIC_COLUMNS_PER_TASK,
  RANGE_SLIDER_HANDLE_COUNT,
  STUDENT_ROW_COUNT,
  TASK_1_ID,
  TASK_1_TITLE,
  TASK_2_ID,
  TASK_2_TITLE,
  TASK_GROUP_COUNT,
  buildDistinctOrderHeatmapResult,
  buildHeatmapResult,
  buildNoSubmissionsResult,
  buildOneTokenHeatmapResult,
  buildZeroTasksResult,
  getHeatmapCellByLabel,
  getRenderedRowKeys,
} from '../../test/taskHeatmapTableTestHelpers';

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

    // Assert Forename/Surname top-level column headers (no single Student Name)
    expect(screen.getByRole('columnheader', { name: 'Forename' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Surname' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: /student name/i })
    ).not.toBeInTheDocument();

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

  it('does not show the aggregate Include Excluded toggle in a task metric filter', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const task1CompletenessHeader = screen.getAllByRole('columnheader', {
      name: /completeness/i,
    })[0];
    const filterButton = within(task1CompletenessHeader).getByRole('button');

    await user.click(filterButton);
    await screen.findAllByRole('slider');

    expect(screen.getByRole('checkbox', { name: /include not attempted/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /include error/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include Excluded' })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Forename/Surname sort — click each split column sorter and assert
  //    the row order follows that column's derived value.
  // -------------------------------------------------------------------------
  it('clicking the Forename column sorter reorders rows by derived forename', async () => {
    const result = buildHeatmapResult();
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default sort is full-name ascending via the pre-sort.
    // Fixture students: Student One, Student Two, Student Three
    // compareStudentNames (locale-aware, case-insensitive):
    //   "Student One" < "Student Three" < "Student Two"
    // Expected initial order: s-1, s-3, s-2
    const initialRowKeys = getRenderedRowKeys(container);
    expect(initialRowKeys).toEqual(['s-1', 's-3', 's-2']);

    // Click the Forename column header sorter. Every fixture forename is
    // "Student", so the derived forename ties and the studentId tie-break
    // applies: s-1, s-2, s-3.
    const forenameHeader = screen.getByRole('columnheader', { name: 'Forename' });
    const sorter = forenameHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();

    // First click: ascending forename order (studentId tie-break).
    await user.click(sorter!);

    const ascRowKeys = getRenderedRowKeys(container);
    expect(ascRowKeys).toEqual(['s-1', 's-2', 's-3']);
  });

  it('clicking the Surname column sorter reorders rows by derived surname', async () => {
    const result = buildHeatmapResult();
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Default sort is full-name ascending: s-1, s-3, s-2 (as above).
    const initialRowKeys = getRenderedRowKeys(container);
    expect(initialRowKeys).toEqual(['s-1', 's-3', 's-2']);

    // Click the Surname column header sorter twice: ascending surname order
    // (One < Three < Two) matches the default, so descend to observe the
    // derived order: Two, Three, One.
    const surnameHeader = screen.getByRole('columnheader', { name: 'Surname' });
    const sorter = surnameHeader.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeInTheDocument();

    // First click: ascending (matches the default full-name order here).
    await user.click(sorter!);
    expect(getRenderedRowKeys(container)).toEqual(['s-1', 's-3', 's-2']);

    // Second click: descending surname order.
    await user.click(sorter!);
    expect(getRenderedRowKeys(container)).toEqual(['s-2', 's-3', 's-1']);
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

      // Assert every student row still renders (split forename/surname cells).
      // All three forenames are "Student"; surnames are unique.
      expect(screen.getAllByText('Student')).toHaveLength(STUDENT_ROW_COUNT);
      expect(screen.getByText('One')).toBeInTheDocument();
      expect(screen.getByText('Two')).toBeInTheDocument();
      expect(screen.getByText('Three')).toBeInTheDocument();

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

    it('renders only the Forename/Surname column headers when taskColumns is empty', () => {
      const result = buildZeroTasksResult();
      render(
        <TaskHeatmapTable
          heatmapResult={result}
          cellPreviewLookup={null}
          isAssignmentLoading={false}
          showAssignmentError={false}
        />
      );

      // Forename/Surname columns should render, with no single Student Name column
      expect(screen.getByRole('columnheader', { name: 'Forename' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Surname' })).toBeInTheDocument();
      expect(
        screen.queryByRole('columnheader', { name: /student name/i })
      ).not.toBeInTheDocument();

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

  // -------------------------------------------------------------------------
  // 8. Split-cell rendering — two-token names split across the Forename and
  //    Surname cells, while one-token students show the whole name in the
  //    forename cell and an empty surname cell without crashing.
  // -------------------------------------------------------------------------

  it('renders a two-token student forename and surname in the split cells', () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildDistinctOrderHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const row = container.querySelector('tbody tr[data-row-key="s-1"]');
    expect(row).not.toBeNull();
    const cells = row!.querySelectorAll('td');
    // Forename then Surname are the first two body columns.
    expect(cells[0]?.textContent).toBe('Alice');
    expect(cells[1]?.textContent).toBe('Smith');
  });

  it('renders a one-token student forename with an empty surname cell', () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildOneTokenHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const row = container.querySelector('tbody tr[data-row-key="s-1"]');
    expect(row).not.toBeNull();
    const cells = row!.querySelectorAll('td');
    // Forename then Surname are the first two body columns.
    expect(cells[0]?.textContent).toBe('Plato');
    expect(cells[1]?.textContent).toBe('');
  });

  // -------------------------------------------------------------------------
  // 9. Split-column sorting with pairwise-distinct orderings — each derived
  //    sorter is uniquely distinguished from the default full-name order and
  //    from its sibling column.
  // -------------------------------------------------------------------------

  it('orders rows by forename via the Forename column sorter under distinct orderings', async () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildDistinctOrderHeatmapResult()}
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

  it('orders rows by surname via the Surname column sorter under distinct orderings', async () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildDistinctOrderHeatmapResult()}
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
