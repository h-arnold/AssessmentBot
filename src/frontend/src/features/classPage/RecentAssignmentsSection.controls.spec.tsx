/**
 * Tests for the Assignments table's sort and filter controls.
 *
 * Sorting and filtering apply to the full adapter history before the three-row
 * preview is taken. Controlled fixture builders live in the shared test
 * helpers; this file owns the Ant Design control interactions and assertions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildDistinctDateHistory,
  buildKnownMetricHistory,
  buildMetricStateHistory,
  buildMetricTieHistory,
  buildNameTieHistory,
  canonicalAssignments,
  computedValue,
  EXPECTED_HEADINGS,
  expectedHistory,
  expectedMetricNames,
  getAssignmentsTable,
  getColumnHeader,
  getRenderedAssignmentNames,
  INITIAL_VISIBLE_ASSIGNMENTS,
  METRIC_KEYS,
  renderSection,
} from '@/test/classPage/recentAssignmentsSectionTestHelpers';
import {
  expectedAdapterOrderNames,
  expectedTextSortNames,
  expectedTextSortRows,
  getRenderedAssignmentIds,
  TEXT_SORT_CASES,
} from '@/test/classPage/recentAssignmentsSectionControlsSupport';

const NAME_HEADING = EXPECTED_HEADINGS[0];
const LAST_ASSESSED_HEADING = EXPECTED_HEADINGS[5];
const SORTER_SELECTOR = '.ant-table-column-sorters';
const FILTER_TRIGGER_SELECTOR = '.ant-table-filter-trigger';
/** Accessible name exposed by Ant Design's standard FilterFilled icon. */
const FILTER_ICON_NAME = 'filter';
const FILTER_DROPDOWN_SELECTOR = '.ant-table-filter-dropdown';
const DROPDOWN_WRAPPER_SELECTOR = '.ant-dropdown';
const HIDDEN_DROPDOWN_CLASS = 'ant-dropdown-hidden';
/** rc-motion appends `-leave`, `-leave-active` and `-leave-end` during a close animation. */
const TRANSITION_LEAVE_CLASS_PATTERN = /-leave(?:-active|-end)?$/;
const MENU_ITEM_SELECTOR = '.ant-dropdown-menu-item';
const FILTER_SEARCH_PLACEHOLDER = 'Search in filters';
const CONFIRM_LABEL = 'OK';
const INCLUDE_N_LABEL = 'Include Not Attempted (N)';
const INCLUDE_E_LABEL = 'Include Error (E)';
const INCLUDE_EXCLUDED_LABEL = 'Include Excluded';
const NO_FILTER_RESULTS_LABEL = 'No assignments match your filters';
const EXPECTED_RANGE_TEXT = /Showing 0 – 5/;
const SLIDER_HANDLE_COUNT = 2;
const LAST_INDEX = -1;
const SHOW_ALL_PATTERN = /show all assignments/i;
const SHOW_FEWER_PATTERN = /show fewer assignments/i;
const FIRST_CLICK = 1;
const SECOND_CLICK = 2;
const CLEAR_CLICK = 3;

/**
 * Require a component-scoped element, throwing a labelled TypeError otherwise.
 *
 * @param {Element | null} element - The queried element.
 * @param {string} label - Diagnostic label.
 * @returns {HTMLElement} The narrowed element.
 */
function requireHTMLElement(element: Element | null, label: string): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError(`Expected ${label}.`);
  }
  return element;
}

/**
 * Click a column's Ant Design sorter a given number of times.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - The user-event controller.
 * @param {HTMLElement} header - The column header.
 * @param {number} clicks - Number of sorter clicks.
 * @returns {Promise<void>} Resolves once the final sort state has settled.
 */
async function clickColumnSorter(
  user: ReturnType<typeof userEvent.setup>,
  header: HTMLElement,
  clicks: number
): Promise<void> {
  const sorter = requireHTMLElement(
    header.querySelector(SORTER_SELECTOR),
    'an Ant Design sorter control in the column header'
  );
  for (let click = 0; click < clicks; click += 1) {
    await user.click(sorter);
  }
}

/**
 * Open a column's Ant Design filter dropdown.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - The user-event controller.
 * @param {HTMLElement} header - The column header.
 * @returns {Promise<void>} Resolves once the dropdown is open.
 */
async function openColumnFilter(
  user: ReturnType<typeof userEvent.setup>,
  header: HTMLElement
): Promise<void> {
  const trigger = requireHTMLElement(
    header.querySelector(FILTER_TRIGGER_SELECTOR),
    'an Ant Design filter trigger in the column header'
  );
  await user.click(trigger);
}

/**
 * Find the visible filter dropdown hosting an element.
 *
 * @param {Element} element - An element inside the dropdown.
 * @returns {HTMLElement} The filter dropdown.
 */
function getFilterDropdown(element: Element): HTMLElement {
  return requireHTMLElement(
    element.closest(FILTER_DROPDOWN_SELECTOR),
    'an Ant Design filter dropdown'
  );
}

/**
 * Decide whether a filter dropdown belongs to a genuinely open popup.
 *
 * Ant Design keeps closed dropdowns in the DOM. A fully closed popup carries
 * `ant-dropdown-hidden` on its wrapper, while a popup that is still leaving may
 * already have lost that class but still carries rc-motion's transition leave
 * class (for example `ant-slide-up-leave`). Exclude both so only the current
 * popup can be resolved.
 *
 * @param {Element} candidate - An Ant Design filter dropdown element.
 * @returns {boolean} `true` when the dropdown's wrapper is neither hidden nor leaving.
 */
function isOpenFilterDropdown(candidate: Element): boolean {
  const wrapper = candidate.closest(DROPDOWN_WRAPPER_SELECTOR);
  if (!wrapper) {
    return true;
  }
  return (
    !wrapper.classList.contains(HIDDEN_DROPDOWN_CLASS) &&
    [...wrapper.classList].every((className) => !TRANSITION_LEAVE_CLASS_PATTERN.test(className))
  );
}

/**
 * Wait for the filter dropdown that is currently open.
 *
 * A document-wide `Search in filters` query also matches stale inputs from a
 * previously used column, so restrict the lookup to the single dropdown whose
 * wrapper is neither hidden nor leaving.
 *
 * @returns {Promise<HTMLElement>} The open filter dropdown.
 */
async function getOpenFilterDropdown(): Promise<HTMLElement> {
  let open: HTMLElement | undefined;
  await waitFor(() => {
    const candidates = [...document.querySelectorAll(FILTER_DROPDOWN_SELECTOR)].filter(
      (candidate) => isOpenFilterDropdown(candidate)
    );
    if (candidates.length !== 1) {
      throw new Error(`Expected exactly one open filter dropdown, found ${candidates.length}.`);
    }
    open = requireHTMLElement(candidates[0], 'the open Ant Design filter dropdown');
  });
  return requireHTMLElement(open ?? null, 'the open Ant Design filter dropdown');
}

/**
 * Apply an exact-value filter through a searchable dropdown.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - The user-event controller.
 * @param {HTMLElement} header - The column header.
 * @param {string} searchText - Text typed into the filter search box.
 * @param {string} value - Exact filter option to select.
 * @returns {Promise<void>} Resolves once the filter is confirmed.
 */
async function applyExactValueFilter(
  user: ReturnType<typeof userEvent.setup>,
  header: HTMLElement,
  searchText: string,
  value: string
): Promise<void> {
  await openColumnFilter(user, header);
  const dropdown = await getOpenFilterDropdown();
  const search = await within(dropdown).findByPlaceholderText(FILTER_SEARCH_PLACEHOLDER);
  await user.type(search, searchText);
  const optionText = within(dropdown).getByText(value);
  const option = requireHTMLElement(
    optionText.closest(MENU_ITEM_SELECTOR),
    `a filter menu item for ${value}`
  );
  await user.click(option);
  await user.click(within(dropdown).getByRole('button', { name: CONFIRM_LABEL }));
}

/**
 * Resolve the currently open metric range-filter dropdown.
 *
 * @returns {Promise<HTMLElement>} The metric range-filter dropdown.
 */
async function getMetricFilterDropdown(): Promise<HTMLElement> {
  const showing = await screen.findByText(EXPECTED_RANGE_TEXT);
  return getFilterDropdown(showing);
}

/**
 * Toggle one named state in the metric range filter.
 *
 * @param {ReturnType<typeof userEvent.setup>} user - The user-event controller.
 * @param {string} label - Checkbox accessible name.
 * @returns {Promise<void>} Resolves once the filter is applied.
 */
async function toggleMetricState(
  user: ReturnType<typeof userEvent.setup>,
  label: string
): Promise<void> {
  const dropdown = await getMetricFilterDropdown();
  await user.click(within(dropdown).getByRole('checkbox', { name: label }));
}

/**
 * Count rendered data rows, excluding Ant Design's empty placeholder row.
 *
 * @param {HTMLTableElement} table - The Assignments table.
 * @returns {number} The number of data rows.
 */
function getDataRowCount(table: HTMLTableElement): number {
  return table.querySelectorAll(':scope tbody tr.ant-table-row').length;
}

describe('RecentAssignmentsSection controls', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('exposes sort and filter controls on every column', () => {
    renderSection({
      recentAssignments: canonicalAssignments.slice(0, 1),
      onStartNewAssessment: vi.fn(),
    });

    const table = getAssignmentsTable();
    EXPECTED_HEADINGS.forEach((heading) => {
      const header = getColumnHeader(table, heading);
      expect(header.querySelector(SORTER_SELECTOR)).not.toBeNull();
      expect(header.querySelector(FILTER_TRIGGER_SELECTOR)).not.toBeNull();
      expect(within(header).getByRole('button', { name: FILTER_ICON_NAME })).toBeInTheDocument();
    });
  });

  it.each(TEXT_SORT_CASES)(
    'sorts $heading across the full history and clears back to adapter order',
    async ({ heading, rows, valueOf }) => {
      renderSection({
        recentAssignments: rows,
        onStartNewAssessment: vi.fn(),
        onOpenHeatmap: vi.fn(),
      });

      const table = getAssignmentsTable();
      const header = getColumnHeader(table, heading);
      const adapterOrder = expectedAdapterOrderNames(rows);
      const ascending = expectedTextSortNames(rows, valueOf, 'asc');
      const descending = expectedTextSortNames(rows, valueOf, 'desc');

      expect(getRenderedAssignmentNames(table)).toEqual(adapterOrder);

      await clickColumnSorter(user, header, FIRST_CLICK);
      expect(getRenderedAssignmentNames(table)).toEqual(ascending);

      await clickColumnSorter(user, header, SECOND_CLICK - FIRST_CLICK);
      expect(getRenderedAssignmentNames(table)).toEqual(descending);

      await clickColumnSorter(user, header, CLEAR_CLICK - SECOND_CLICK);
      expect(getRenderedAssignmentNames(table)).toEqual(adapterOrder);
    }
  );

  it.each(METRIC_KEYS)(
    'sorts the %s column across the full history before the preview',
    async (key) => {
      const rows = buildKnownMetricHistory();
      renderSection({
        recentAssignments: rows,
        onStartNewAssessment: vi.fn(),
        onOpenHeatmap: vi.fn(),
      });

      const table = getAssignmentsTable();
      const metaLabel = key === 'spag' ? 'SPaG' : key.charAt(0).toUpperCase() + key.slice(1);
      const header = getColumnHeader(table, metaLabel);

      await clickColumnSorter(user, header, FIRST_CLICK);
      expect(getRenderedAssignmentNames(table)).toEqual(expectedMetricNames(rows, key, 'asc'));

      await clickColumnSorter(user, header, SECOND_CLICK - FIRST_CLICK);
      expect(getRenderedAssignmentNames(table)).toEqual(expectedMetricNames(rows, key, 'desc'));
    }
  );

  it('breaks a Name sort tie by ascending assignmentId', async () => {
    const rows = buildNameTieHistory();
    renderSection({
      recentAssignments: rows,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const sorted = expectedTextSortRows(rows, (row) => row.assignmentName, 'asc');

    await clickColumnSorter(user, getColumnHeader(table, NAME_HEADING), FIRST_CLICK);

    expect(getRenderedAssignmentNames(table)).toEqual(sorted.map((row) => row.assignmentName));
    expect(getRenderedAssignmentIds(table)).toEqual(sorted.map((row) => row.assignmentId));
  });

  it('breaks a metric sort tie by ascending assignmentId', async () => {
    const rows = buildMetricTieHistory();
    renderSection({
      recentAssignments: rows,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const expected = [...rows]
      .toSorted((left, right) => {
        return (
          computedValue(left.metrics.completeness) - computedValue(right.metrics.completeness) ||
          left.assignmentId.localeCompare(right.assignmentId)
        );
      })
      .slice(0, INITIAL_VISIBLE_ASSIGNMENTS)
      .map((row) => row.assignmentName);

    await clickColumnSorter(user, getColumnHeader(table, EXPECTED_HEADINGS[1]), FIRST_CLICK);

    expect(getRenderedAssignmentNames(table)).toEqual(expected);
  });

  it('filters Name through a searchable exact-value dropdown covering the full history', async () => {
    renderSection({
      recentAssignments: canonicalAssignments,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const hidden = expectedHistory.at(LAST_INDEX);
    if (!hidden) {
      throw new TypeError('Canonical fixture must supply an assignment outside the preview.');
    }
    expect(getRenderedAssignmentNames(table)).not.toContain(hidden.assignmentName);

    await applyExactValueFilter(
      user,
      getColumnHeader(table, NAME_HEADING),
      hidden.assignmentName,
      hidden.assignmentName
    );

    expect(getRenderedAssignmentNames(table)).toEqual([hidden.assignmentName]);
    expect(screen.queryByRole('button', { name: SHOW_ALL_PATTERN })).toBeNull();
  });

  it('filters Last Assessed through a searchable exact-value dropdown covering the full history', async () => {
    const rows = buildDistinctDateHistory();
    renderSection({
      recentAssignments: rows,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const hidden = rows.at(LAST_INDEX);
    if (!hidden) {
      throw new TypeError('Canonical fixture must supply an assignment outside the preview.');
    }
    const uniqueLabels = new Set(rows.map((row) => row.lastAssessedAtLabel));
    if (uniqueLabels.size !== rows.length) {
      throw new Error('Controlled date fixture must supply distinct Last Assessed labels.');
    }
    expect(getRenderedAssignmentNames(table)).not.toContain(hidden.assignmentName);

    await applyExactValueFilter(
      user,
      getColumnHeader(table, LAST_ASSESSED_HEADING),
      hidden.lastAssessedAtLabel,
      hidden.lastAssessedAtLabel
    );

    expect(getRenderedAssignmentNames(table)).toEqual([hidden.assignmentName]);
    expect(screen.queryByRole('button', { name: SHOW_ALL_PATTERN })).toBeNull();
  });

  it('shows the empty-filter copy when two exact filters intersect to no rows', async () => {
    const rows = buildDistinctDateHistory();
    renderSection({
      recentAssignments: rows,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const hidden = rows.at(LAST_INDEX);
    const other = rows[0];
    if (!hidden || !other || hidden.lastAssessedAtLabel === other.lastAssessedAtLabel) {
      throw new Error(
        'Controlled date fixture needs two rows with different Last Assessed labels.'
      );
    }

    await applyExactValueFilter(
      user,
      getColumnHeader(table, NAME_HEADING),
      hidden.assignmentName,
      hidden.assignmentName
    );
    await applyExactValueFilter(
      user,
      getColumnHeader(table, LAST_ASSESSED_HEADING),
      other.lastAssessedAtLabel,
      other.lastAssessedAtLabel
    );

    expect(screen.getByText(NO_FILTER_RESULTS_LABEL)).toBeInTheDocument();
    expect(getDataRowCount(table)).toBe(0);
  });

  it('applies the shared metric range filter with working N, E and Excluded toggles', async () => {
    const rows = buildMetricStateHistory();
    renderSection({
      recentAssignments: rows,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const names = rows.map((row) => row.assignmentName);
    expect(getRenderedAssignmentNames(table)).toEqual(names.slice(0, INITIAL_VISIBLE_ASSIGNMENTS));

    await openColumnFilter(user, getColumnHeader(table, EXPECTED_HEADINGS[1]));

    const dropdown = await getMetricFilterDropdown();
    expect(within(dropdown).getAllByRole('slider')).toHaveLength(SLIDER_HANDLE_COUNT);
    expect(within(dropdown).getByText(EXPECTED_RANGE_TEXT)).toBeInTheDocument();
    expect(within(dropdown).getByRole('checkbox', { name: INCLUDE_N_LABEL })).not.toBeChecked();
    expect(within(dropdown).getByRole('checkbox', { name: INCLUDE_E_LABEL })).not.toBeChecked();
    expect(
      within(dropdown).getByRole('checkbox', { name: INCLUDE_EXCLUDED_LABEL })
    ).not.toBeChecked();

    // Including N keeps only the computed and not-attempted rows.
    await toggleMetricState(user, INCLUDE_N_LABEL);
    expect(getRenderedAssignmentNames(table)).toEqual([names[0], names[1]]);
    expect(screen.queryByRole('button', { name: SHOW_ALL_PATTERN })).toBeNull();

    // Including E restores the error row; the excluded row is still hidden.
    await toggleMetricState(user, INCLUDE_E_LABEL);
    expect(getRenderedAssignmentNames(table)).toEqual([names[0], names[1], names[2]]);

    // Including Excluded restores all four matches, but filtering happens
    // before the preview, so only three rows render until the disclosure is
    // activated.
    await toggleMetricState(user, INCLUDE_EXCLUDED_LABEL);
    const preview = names.slice(0, INITIAL_VISIBLE_ASSIGNMENTS);
    expect(getRenderedAssignmentNames(table)).toEqual(preview);
    expect(screen.getByRole('button', { name: SHOW_ALL_PATTERN })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: SHOW_ALL_PATTERN }));
    expect(getRenderedAssignmentNames(table)).toEqual(names);
    expect(screen.queryByRole('button', { name: SHOW_ALL_PATTERN })).toBeNull();
    expect(screen.getByRole('button', { name: SHOW_FEWER_PATTERN })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: SHOW_FEWER_PATTERN }));
    expect(getRenderedAssignmentNames(table)).toEqual(preview);
    expect(screen.getByRole('button', { name: SHOW_ALL_PATTERN })).toBeInTheDocument();
  });
});
