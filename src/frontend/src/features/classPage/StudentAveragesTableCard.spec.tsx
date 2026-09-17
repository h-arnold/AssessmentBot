/**
 * Tests for `StudentAveragesTableCard` — the Card wrapping the
 * control row (search + label) and the Student Averages Table.
 *
 * @see SPEC_CLASS_PAGE.md — "StudentAveragesTableCard"
 * @see CLASS_PAGE_LAYOUT.md — "4. Student Averages Table Card"
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentAveragesTableCard } from './StudentAveragesTableCard';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import type { ClassPageViewModel } from './classPageModel';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
} from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const { mockBuildColumns, mockBuildViewModel } = vi.hoisted(() => ({
  mockBuildColumns: vi.fn(),
  mockBuildViewModel: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock internal dependencies so the component under test is isolated
// ---------------------------------------------------------------------------

vi.mock('./studentAveragesTableColumns', () => ({
  buildStudentAveragesTableColumns: mockBuildColumns,
}));

vi.mock('./classPageModel', () => ({
  buildClassPageViewModel: mockBuildViewModel,
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal column shape for mocked column definitions.
 *
 * @remarks
 * Mirrors the Ant Design `ColumnType` subset needed by the Table component
 * for sort and filter interactions tested here.
 */
interface MockColumn {
  key: string;
  title: string;
  dataIndex?: string;
  sorter?: boolean | ((a: StudentAverageRowModel, b: StudentAverageRowModel) => number);
  filters?: ReadonlyArray<{ text: string; value: string }>;
  onFilter?: (value: string, record: StudentAverageRowModel) => boolean;
  render?: (value: unknown, record: StudentAverageRowModel, index: number) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The six column keys in order. */
const COLUMN_KEYS = ['forename', 'surname', 'completeness', 'accuracy', 'spag', 'average'] as const;

/** Forename-ascending sort state emitted on the first Forename header click. */
const FORENAME_ASC_SORT = { column: 'forename', direction: 'asc' } as const;

/** Sentinel for accessing the last element of an array. */
const LAST_CALL_INDEX = -1;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid StudentAverageRowModel fixture for tests.
 *
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional overrides.
 * @returns {StudentAverageRowModel} A StudentAverageRowModel fixture.
 */
function buildRow(overrides: Partial<StudentAverageRowModel> = {}): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Alice',
    metrics: {
      completeness: createComputedMetricResult({ value: 4 }),
      accuracy: createComputedMetricResult({ value: 3 }),
      spag: createComputedMetricResult({ value: 3.5 }),
      average: createComputedMetricResult({ value: 3.7 }),
    },
    ...overrides,
  };
}

/**
 * Build a minimal ClassPageAdapterResult fixture for tests.
 *
 * @param {Partial<ClassPageAdapterResult>} [overrides] - Optional overrides.
 * @returns {ClassPageAdapterResult} A ClassPageAdapterResult fixture.
 */
function buildAdapterResult(
  overrides: Partial<ClassPageAdapterResult> = {}
): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [buildRow()],
    classMetrics: {
      completeness: createComputedMetricResult({ value: 4.2 }),
      accuracy: createComputedMetricResult({ value: 3.5 }),
      spag: createNotAttemptedMetricResult(),
      overall: createComputedMetricResult({ value: 3.8 }),
    },
    ...overrides,
  };
}

/**
 * Build a valid ClassPageViewModel for the mocked `buildClassPageViewModel`.
 *
 * @param {Partial<ClassPageViewModel>} [overrides] - Optional overrides.
 * @returns {ClassPageViewModel} A ClassPageViewModel fixture.
 */
function buildViewModel(overrides: Partial<ClassPageViewModel> = {}): ClassPageViewModel {
  return {
    recentAssignments: [],
    studentAverages: [],
    classMetrics: {
      completeness: createComputedMetricResult({ value: 4.2 }),
      accuracy: createComputedMetricResult({ value: 3.5 }),
      spag: createNotAttemptedMetricResult(),
      overall: createComputedMetricResult({ value: 3.8 }),
    },
    ...overrides,
  };
}

/** Map from column key to display title. */
const COLUMN_TITLE_BY_KEY: Record<string, string> = {
  forename: 'Forename',
  surname: 'Surname',
  completeness: 'Completeness',
  accuracy: 'Accuracy',
  spag: 'SpAG',
  average: 'Average',
};

/**
 * Build a minimal set of mocked column definitions for the table.
 *
 * Each column is sortable (`sorter: true`) so that Ant Design renders the
 * sort trigger on the column header and fires `onChange` when clicked.
 *
 * @returns {MockColumn[]} An array of mock column definitions.
 */
function buildMockColumns(): MockColumn[] {
  return COLUMN_KEYS.map((key: string) => ({
    key,
    title: COLUMN_TITLE_BY_KEY[key] ?? key,
    sorter: true,
  }));
}

// ---------------------------------------------------------------------------
// Default mock return values
// ---------------------------------------------------------------------------

/** Default view model returned by mockBuildViewModel. */
const DEFAULT_VIEW_MODEL = buildViewModel({
  studentAverages: [buildRow({ studentId: 's-1', studentName: 'Alice' })],
});

/** Default columns returned by mockBuildColumns. */
const DEFAULT_MOCK_COLUMNS = buildMockColumns();

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();

  // Reset mock call history and set default return values
  vi.resetAllMocks();

  mockBuildColumns.mockReturnValue(DEFAULT_MOCK_COLUMNS);
  mockBuildViewModel.mockReturnValue(DEFAULT_VIEW_MODEL);
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render the StudentAveragesTableCard with the given overrides.
 *
 * @param {object} [options] - Render options.
 * @param {Partial<ClassPageAdapterResult>} [options.adapterResult] - Adapter result overrides.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderCard(options: {
  adapterResult?: Partial<ClassPageAdapterResult>;
} = {}): ReturnType<typeof render> {
  const adapterResult = buildAdapterResult(options.adapterResult);

  return render(
    <StudentAveragesTableCard
      adapterResult={adapterResult}
    />
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('StudentAveragesTableCard', () => {
  // -----------------------------------------------------------------------
  // Card rendering
  // -----------------------------------------------------------------------
  it('renders the Card with title="Student Averages"', () => {
    renderCard();

    expect(screen.getByText('Student Averages')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Input / Space.Compact rendering
  // -----------------------------------------------------------------------
  it('renders the Input / Space.Compact with placeholder "Search by name"', () => {
    renderCard();

    const searchInput = screen.getByPlaceholderText('Search by name');
    expect(searchInput).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Static label rendering
  // -----------------------------------------------------------------------
  it('renders the static "Viewing: Overall Class Averages" label', () => {
    renderCard();

    expect(screen.getByText('Viewing: Overall Class Averages')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Table rendering
  // -----------------------------------------------------------------------
  it('renders the Table with pagination={false} and size="small"', () => {
    const { container } = renderCard();

    // Verify the ant-table class is present (Table renders)
    const table = container.querySelector('.ant-table');
    expect(table).toBeInTheDocument();

    // pagination={false} means no pagination controls
    const pagination = container.querySelector('.ant-pagination');
    expect(pagination).not.toBeInTheDocument();

    // size="small" adds the ant-table-small CSS class
    expect(table).toHaveClass('ant-table-small');
  });

  // -----------------------------------------------------------------------
  // Search term update
  // -----------------------------------------------------------------------
  it('updates searchTerm on Input change and rebuilds the view model', async () => {
    renderCard();

    const searchInput = screen.getByPlaceholderText('Search by name');
    await user.type(searchInput, 'Alice');

    // After typing, buildClassPageViewModel should have been called with
    // searchTerm: 'Alice' (the model filters by case-insensitive substring match)
    const lastCallArguments = mockBuildViewModel.mock.calls.at(LAST_CALL_INDEX)?.[0];
    expect(lastCallArguments).toBeDefined();
    expect(lastCallArguments.filters.searchTerm).toBe('Alice');
  });

  // -----------------------------------------------------------------------
  // Sort mapping — sorts forename column
  // -----------------------------------------------------------------------
  it('maps Table.onChange sorter event to the model sort state', async () => {
    renderCard();

    // Click the "Forename" column header to trigger sort.
    // Ant Design renders sort triggers inside .ant-table-column-sorters elements.
    const columnHeaders = screen.getAllByRole('columnheader');
    const forenameHeader = columnHeaders.find((header) =>
      header.textContent?.includes('Forename')
    );
    expect(forenameHeader).toBeDefined();

    // Click the sorter area inside the column header
    const sorter = forenameHeader!.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeDefined();

    await user.click(sorter!);

    // After the click, buildClassPageViewModel should have been called with
    // sort: { column: 'forename', direction: 'asc' } (ascending on first click)
    const lastCallArguments = mockBuildViewModel.mock.calls.at(LAST_CALL_INDEX)?.[0];
    expect(lastCallArguments).toBeDefined();
    expect(lastCallArguments.sort).toMatchObject(FORENAME_ASC_SORT);
  });

  // -----------------------------------------------------------------------
  // Initial render passes no explicit sort (model default: full-name ascending)
  // -----------------------------------------------------------------------
  it('passes a null sort to the model on initial render', () => {
    renderCard();

    // Initial render carries no explicit sort, so the model applies its
    // default full-name ascending order via `compareStudentNames`.
    const firstCallArguments = mockBuildViewModel.mock.calls.at(0)?.[0];
    expect(firstCallArguments).toBeDefined();
    expect(firstCallArguments.sort).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Clear sort (third click) resets to the cleared sort (model: full-name ascending)
  // -----------------------------------------------------------------------
  it('resets to a null sort when sorter.order is null (clear-sort on third click)', async () => {
    renderCard();

    // Find the Forename column header and its sorter area
    const columnHeaders = screen.getAllByRole('columnheader');
    const forenameHeader = columnHeaders.find((header) =>
      header.textContent?.includes('Forename')
    );
    expect(forenameHeader).toBeDefined();

    const sorter = forenameHeader!.querySelector('.ant-table-column-sorters');
    expect(sorter).toBeDefined();

    // Click once to sort ascending
    await user.click(sorter!);

    // Click twice to sort descending
    await user.click(sorter!);

    // Click three times to clear sort -> should reset to the cleared sort
    await user.click(sorter!);

    // After the clear-sort third click, buildClassPageViewModel should have
    // been called with sort: null. The model resolves a null sort to
    // full-name ascending via the unchanged `compareStudentNames` ordering.
    const lastCallArguments = mockBuildViewModel.mock.calls.at(LAST_CALL_INDEX)?.[0];
    expect(lastCallArguments).toBeDefined();
    expect(lastCallArguments.sort).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Empty dataSource renders Empty component
  // -----------------------------------------------------------------------
  it('renders Empty with "No students match your search" when dataSource is empty', () => {
    // Override the default view model to have an empty studentAverages array
    mockBuildViewModel.mockReturnValue(
      buildViewModel({ studentAverages: [] })
    );

    renderCard();

    expect(screen.getByText('No students match your search')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Input / Space.Compact does not render enterButton
  // -----------------------------------------------------------------------
  it('Input / Space.Compact does not render enterButton (filters apply on keystroke)', () => {
    const { container } = renderCard();

    // Space.Compact with plain Input renders with class .ant-input-search (applied
    // via the Space.Compact className). Unlike Input.Search, plain Input never
    // renders a submit button, so there is no button inside the wrapper.
    const searchInput = container.querySelector('.ant-input-search');
    expect(searchInput).toBeInTheDocument();

    // There should be no button inside the search input wrapper
    const searchButtons = searchInput!.querySelectorAll('button');
    expect(searchButtons).toHaveLength(0);

    // The search input should be an <input> element
    const inputElement = searchInput!.querySelector('input');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveAttribute('type', 'search');
  });
});
