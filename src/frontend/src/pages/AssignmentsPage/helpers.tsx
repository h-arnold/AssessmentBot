import type { FilterValue } from 'antd/es/table/interface';
import type { ReactElement } from 'react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import {
  computeDatasetRenderable,
  computePageSurfaceBlocking,
  computePageSurfaceBusy,
  type PageDatasetState,
} from '../../hooks/usePageDataset';
import { type AssignmentDefinitionPartial } from '../../services/assignmentDefinitionPartialsService';
import { DeleteAssignmentDefinitionRequestSchema } from '../../services/assignmentDefinitionPartials.zod';
import {
  AssignmentsFilterDropdown,
  AssignmentsFilterIcon,
} from './subcomponents';
import type {
  AssignmentsFilterColumnKey,
  AssignmentsFilterOption,
  AssignmentsFilterState,
  AssignmentsSurfaceState,
} from './types';
import { UNAVAILABLE_VALUE } from './types';

/**
 * Returns whether an assignment definition key is safe for deletion calls.
 *
 * @param {string} definitionKey Definition key to validate.
 * @returns {boolean} `true` when the key is safe.
 */
export function isSafeDefinitionKey(definitionKey: string): boolean {
  return DeleteAssignmentDefinitionRequestSchema.safeParse({ definitionKey }).success;
}

/**
 * Formats a year-group value for table display and filtering.
 *
 * @param {string} yearGroupLabel Year-group label value.
 * @returns {string} Display label.
 */
export function formatYearGroupLabel(yearGroupLabel: string): string {
  return yearGroupLabel.trim().length === 0 ? UNAVAILABLE_VALUE : yearGroupLabel;
}

/**
 * Formats an ISO timestamp for table display and filtering.
 *
 * @param {string | null} updatedAt Last-updated timestamp.
 * @returns {string} Display label.
 */
export function formatUpdatedAtLabel(updatedAt: string | null): string {
  if (updatedAt === null) {
    return UNAVAILABLE_VALUE;
  }

  const parsedDate = new Date(updatedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return UNAVAILABLE_VALUE;
  }

  return parsedDate.toLocaleDateString('en-GB', { timeZone: 'UTC' });
}

/**
 * Builds unique sorted filter options from raw labels.
 *
 * @param {readonly string[]} values Raw labels.
 * @returns {ReadonlyArray<{ text: string; value: string }>} Dropdown options.
 */
export function getUniqueSortedFilterOptions(values: readonly string[]) {
  const uniqueValues = [...new Set(values)].toSorted((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  );

  return uniqueValues.map((value) => ({ text: value, value }));
}

/**
 * Sorts assignment rows into the default display order.
 *
 * @param {readonly AssignmentDefinitionPartial[]} rows Assignment rows.
 * @returns {AssignmentDefinitionPartial[]} Sorted rows.
 */
export function getDefaultSortedRows(
  rows: readonly AssignmentDefinitionPartial[]
): AssignmentDefinitionPartial[] {
  return [...rows].toSorted((left, right) => {
    const leftUpdatedAt =
      left.updatedAt === null ? Number.NEGATIVE_INFINITY : new Date(left.updatedAt).getTime();
    const rightUpdatedAt =
      right.updatedAt === null ? Number.NEGATIVE_INFINITY : new Date(right.updatedAt).getTime();

    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    const titleComparison = left.primaryTitle.localeCompare(right.primaryTitle, undefined, {
      sensitivity: 'base',
    });

    if (titleComparison !== 0) {
      return titleComparison;
    }

    return left.definitionKey.localeCompare(right.definitionKey, undefined, {
      sensitivity: 'base',
    });
  });
}

/**
 * Matches one row value against one selected table-filter value.
 *
 * @param {FilterValue | null} selectedValues Selected table filter values.
 * @param {string} rowValue Row label.
 * @returns {boolean} `true` when the row should remain visible.
 */
export function matchesFilterSelection(selectedValues: FilterValue | null, rowValue: string): boolean {
  if (selectedValues === null || selectedValues.length === 0) {
    return true;
  }

  const [firstSelectedValue] = selectedValues;
  return String(firstSelectedValue) === rowValue;
}

/**
 * Returns a new filter state with only one column value changed.
 *
 * @param {AssignmentsFilterState} currentFilters Current filters.
 * @param {AssignmentsFilterColumnKey} columnKey Filter column key.
 * @param {FilterValue | null} selectedValues Next selected values.
 * @returns {AssignmentsFilterState} Updated filters.
 */
export function getNextFilters(
  currentFilters: AssignmentsFilterState,
  columnKey: AssignmentsFilterColumnKey,
  selectedValues: FilterValue | null
): AssignmentsFilterState {
  return { ...currentFilters, [columnKey]: selectedValues };
}

/**
 * Resolves whether assignments cards should show loading or blocking states.
 *
 * @param {PageDatasetState} datasetState Derived per-dataset state for assignment definition partials.
 * @param {boolean} isAssignmentsQueryPending Whether the assignments query is in a pending state.
 * @returns {AssignmentsSurfaceState} Surface-state booleans.
 */
export function getAssignmentsSurfaceState(
  datasetState: PageDatasetState,
  isAssignmentsQueryPending: boolean
): AssignmentsSurfaceState {
  const isBlocking = computePageSurfaceBlocking(datasetState);

  if (isBlocking) {
    return {
      shouldRenderActionLoadingState: false,
      shouldRenderBlockingState: true,
      shouldRenderTableLoadingState: false,
    };
  }

  const hasRenderableAssignmentsDataset = computeDatasetRenderable(datasetState);

  return {
    shouldRenderActionLoadingState: !hasRenderableAssignmentsDataset,
    shouldRenderBlockingState: false,
    shouldRenderTableLoadingState:
      !hasRenderableAssignmentsDataset ||
      (isAssignmentsQueryPending && !datasetState.hasQueryData),
  };
}

/**
 * Returns whether the assignments panel should expose busy state.
 *
 * @param {Readonly<{ surfaceState: AssignmentsSurfaceState; isQueryFetching: boolean; isDeletePending: boolean; }>} input Busy-state inputs.
 * @returns {boolean} `true` when the panel is busy.
 */
export function isAssignmentsSurfaceBusyState(
  input: Readonly<{
    surfaceState: AssignmentsSurfaceState;
    isQueryFetching: boolean;
    isDeletePending: boolean;
  }>
): boolean {
  return (
    input.surfaceState.shouldRenderTableLoadingState ||
    computePageSurfaceBusy([input.isQueryFetching], [input.isDeletePending])
  );
}

/**
 * Renders one table filter icon callback with stable accessible label.
 *
 * @param {string} label Accessible label for the filter trigger.
 * @returns {(isFiltered: boolean) => JSX.Element} Filter icon renderer.
 */
export function createFilterIconRenderer(label: string) {
  return (isFiltered: boolean) => <AssignmentsFilterIcon isFiltered={isFiltered} label={label} />;
}

/**
 * Creates one stable filter dropdown renderer for a table column.
 *
 * @param {Readonly<{ options: ReadonlyArray<AssignmentsFilterOption>; selectedValues: FilterValue | null; onSelectOption: (value: string) => void; }>} properties Renderer inputs.
 * @returns {(dropdownProperties: FilterDropdownProps) => ReactElement} Filter dropdown renderer.
 */
export function createFilterDropdownRenderer(
  properties: Readonly<{
    options: ReadonlyArray<AssignmentsFilterOption>;
    selectedValues: FilterValue | null;
    onSelectOption: (value: string) => void;
  }>
): (dropdownProperties: FilterDropdownProps) => ReactElement {
  return function renderFilterDropdown(dropdownProperties: FilterDropdownProps): ReactElement {
    return (
      <AssignmentsFilterDropdown
        dropdownProperties={dropdownProperties}
        onSelectOption={properties.onSelectOption}
        options={properties.options}
        selectedValues={properties.selectedValues}
      />
    );
  };
}
