import { FilterFilled } from '@ant-design/icons';
import { Button, Card, Empty, Skeleton, Space, Table, type TableColumnsType } from 'antd';
import type { FilterDropdownProps, FilterValue } from 'antd/es/table/interface';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { formatUpdatedAtLabel } from '../../utils/dateFormatting';
import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionPartialsService';
import { DeleteAssignmentDefinitionRequestSchema } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

const UNAVAILABLE_VALUE = '—';
const FILTER_DROPDOWN_PROPERTIES = { transitionName: '' } as const;

type AssignmentsFilterState = Readonly<{
  primaryTitle: FilterValue | null;
  primaryTopic: FilterValue | null;
  yearGroup: FilterValue | null;
  documentType: FilterValue | null;
  updatedAt: FilterValue | null;
}>;
type AssignmentsFilterColumnKey = keyof AssignmentsFilterState;
type AssignmentsFilterOption = Readonly<{ text: string; value: string }>;
type AssignmentsFilterDescriptor = Readonly<{
  key: AssignmentsFilterColumnKey;
  title: string;
  filterLabel: string;
  getFilterValue: (row: AssignmentDefinitionPartial) => string;
  renderCell?: (row: AssignmentDefinitionPartial) => string;
}>;

const EMPTY_FILTER_STATE: AssignmentsFilterState = {
  primaryTitle: null,
  primaryTopic: null,
  yearGroup: null,
  documentType: null,
  updatedAt: null,
};

const ASSIGNMENTS_FILTER_DESCRIPTORS: ReadonlyArray<AssignmentsFilterDescriptor> = [
  {
    filterLabel: 'Filter by title',
    getFilterValue: (row) => row.primaryTitle,
    key: 'primaryTitle',
    title: 'Title',
  },
  {
    filterLabel: 'Filter by topic',
    getFilterValue: (row) => row.primaryTopic,
    key: 'primaryTopic',
    title: 'Topic',
  },
  {
    filterLabel: 'Filter by year group',
    getFilterValue: (row) => formatYearGroupLabel(row.yearGroupLabel),
    key: 'yearGroup',
    renderCell: (row) => formatYearGroupLabel(row.yearGroupLabel),
    title: 'Year group',
  },
  {
    filterLabel: 'Filter by document type',
    getFilterValue: (row) => row.documentType,
    key: 'documentType',
    title: 'Document type',
  },
  {
    filterLabel: 'Filter by last updated',
    getFilterValue: (row) => formatUpdatedAtLabel(row.updatedAt),
    key: 'updatedAt',
    renderCell: (row) => formatUpdatedAtLabel(row.updatedAt),
    title: 'Last updated',
  },
];

/** Formats a year-group label for display and filtering.
 * @param {string} yearGroupLabel Year-group label.
 * @returns {string} Display label.
 */
function formatYearGroupLabel(yearGroupLabel: string): string {
  return yearGroupLabel.trim().length === 0 ? UNAVAILABLE_VALUE : yearGroupLabel;
}

/** Builds unique, naturally sorted filter options.
 * @param {readonly string[]} values Filter values.
 * @returns {Array<{text: string; value: string}>} Sorted options.
 */
function getUniqueSortedFilterOptions(values: readonly string[]) {
  return [...new Set(values)]
    .toSorted((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    )
    .map((value) => ({ text: value, value }));
}

/** Sorts assignment definitions into the default table order.
 * @param {readonly AssignmentDefinitionPartial[]} rows Assignment rows.
 * @returns {AssignmentDefinitionPartial[]} Sorted rows.
 */
function getDefaultSortedRows(
  rows: readonly AssignmentDefinitionPartial[]
): AssignmentDefinitionPartial[] {
  return [...rows].toSorted((left, right) => {
    const leftUpdatedAt = left.updatedAt === null ? -Infinity : new Date(left.updatedAt).getTime();
    const rightUpdatedAt =
      right.updatedAt === null ? -Infinity : new Date(right.updatedAt).getTime();
    if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt;
    const titleComparison = left.primaryTitle.localeCompare(right.primaryTitle, undefined, {
      sensitivity: 'base',
    });
    return titleComparison === 0
      ? left.definitionKey.localeCompare(right.definitionKey, undefined, { sensitivity: 'base' })
      : titleComparison;
  });
}

/** Checks whether a row matches its selected exact-value filter.
 * @param {FilterValue | null} selectedValues Selected values.
 * @param {string} rowValue Row value.
 * @returns {boolean} Whether the row matches.
 */
function isFilterSelectionMatch(selectedValues: FilterValue | null, rowValue: string): boolean {
  if (selectedValues === null || selectedValues.length === 0) return true;
  const [firstSelectedValue] = selectedValues;
  return String(firstSelectedValue) === rowValue;
}

/** Renders the exact-match options for a table filter.
 * @param {Readonly<object>} properties Dropdown properties.
 * @returns {JSX.Element} Filter option list.
 */
function AssignmentsFilterDropdown(
  properties: Readonly<{
    options: ReadonlyArray<AssignmentsFilterOption>;
    selectedValues: FilterValue | null;
    onSelectOption: (value: string) => void;
    dropdownProperties: FilterDropdownProps;
  }>
) {
  const selectedValues = new Set((properties.selectedValues ?? []).map(String));
  // size={0} is the intentional zero-gap filter-option list exception (see frontend-spacing-and-padding-standards.md §4.7).
  return (
    <Space orientation="vertical" size={0}>
      {properties.options.map((option) => {
        const isSelected = selectedValues.has(option.value);
        return (
          <button
            key={option.value}
            onClick={() => {
              properties.onSelectOption(option.value);
              properties.dropdownProperties.setSelectedKeys([option.value]);
              properties.dropdownProperties.confirm({ closeDropdown: true });
            }}
            style={{
              background: isSelected ? 'rgba(22, 119, 255, 0.1)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              textAlign: 'left',
            }}
            type="button"
          >
            {option.text}
          </button>
        );
      })}
    </Space>
  );
}

/** Creates an accessible filter icon renderer.
 * @param {string} label Accessible label.
 * @returns {(isFiltered: boolean) => JSX.Element} Filter icon renderer.
 */
function createFilterIconRenderer(label: string) {
  return (isFiltered: boolean) => {
    return (
      <FilterFilled
        aria-label={label}
        style={{ color: isFiltered ? 'var(--ant-color-primary)' : undefined }}
      />
    );
  };
}

/** Creates a filter dropdown renderer.
 * @param {Readonly<object>} properties Dropdown renderer inputs.
 * @returns {(dropdownProperties: FilterDropdownProps) => ReactElement} Dropdown renderer.
 */
function createFilterDropdownRenderer(
  properties: Readonly<{
    options: ReadonlyArray<AssignmentsFilterOption>;
    selectedValues: FilterValue | null;
    onSelectOption: (value: string) => void;
  }>
): (dropdownProperties: FilterDropdownProps) => ReactElement {
  return function renderFilterDropdown(dropdownProperties) {
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

/** Renders sorted and filterable assignment definitions.
 * @param {Readonly<object>} properties Table data, readiness and row actions.
 * @returns {JSX.Element | null} Assignment definitions card.
 */
export function AssignmentDefinitionsTable(
  properties: Readonly<{
    rows: readonly AssignmentDefinitionPartial[];
    shouldRenderBlockingState: boolean;
    shouldRenderTableLoadingState: boolean;
    isDeletePending: boolean;
    hasTrustworthyAssignmentsDataset: boolean;
    hasTrustworthyReferenceData: boolean;
    onUpdate: (row: AssignmentDefinitionPartial) => void;
    onDelete: (row: AssignmentDefinitionPartial) => void;
  }>
) {
  const [filters, setFilters] = useState<AssignmentsFilterState>(EMPTY_FILTER_STATE);
  const sortedRows = useMemo(() => getDefaultSortedRows(properties.rows), [properties.rows]);
  const filterOptions = useMemo(() => {
    const nextFilterOptions: Record<
      AssignmentsFilterColumnKey,
      ReadonlyArray<AssignmentsFilterOption>
    > = {
      primaryTitle: [],
      primaryTopic: [],
      yearGroup: [],
      documentType: [],
      updatedAt: [],
    };
    for (const descriptor of ASSIGNMENTS_FILTER_DESCRIPTORS) {
      nextFilterOptions[descriptor.key] = getUniqueSortedFilterOptions(
        sortedRows.map((row) => descriptor.getFilterValue(row))
      );
    }
    return nextFilterOptions;
  }, [sortedRows]);
  const visibleRows = useMemo(() => {
    return sortedRows.filter((row) => {
      return ASSIGNMENTS_FILTER_DESCRIPTORS.every((descriptor) =>
        isFilterSelectionMatch(filters[descriptor.key], descriptor.getFilterValue(row))
      );
    });
  }, [filters, sortedRows]);
  const handleSelectFilter = useCallback((columnKey: AssignmentsFilterColumnKey, value: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, [columnKey]: [value] }));
  }, []);
  const tableColumns: TableColumnsType<AssignmentDefinitionPartial> = useMemo(() => {
    return [
      ...ASSIGNMENTS_FILTER_DESCRIPTORS.map((descriptor) => {
        return {
          title: descriptor.title,
          dataIndex: descriptor.key,
          key: descriptor.key,
          ...(descriptor.renderCell !== undefined && {
            render: (_: unknown, row: AssignmentDefinitionPartial) => descriptor.renderCell!(row),
          }),
          filterDropdown: createFilterDropdownRenderer({
            onSelectOption: (value) => handleSelectFilter(descriptor.key, value),
            options: filterOptions[descriptor.key],
            selectedValues: filters[descriptor.key],
          }),
          filterDropdownProps: FILTER_DROPDOWN_PROPERTIES,
          filterIcon: createFilterIconRenderer(descriptor.filterLabel),
          filteredValue: filters[descriptor.key],
          onHeaderCell: () => ({ 'aria-label': descriptor.title }),
        };
      }),
      {
        title: 'Actions',
        key: 'actions',
        onHeaderCell: () => ({ 'aria-label': 'Actions' }),
        render: (_, row) => {
          return (
            <Space wrap>
              <Button
                disabled={
                  properties.isDeletePending ||
                  !properties.hasTrustworthyAssignmentsDataset ||
                  !properties.hasTrustworthyReferenceData
                }
                onClick={() => properties.onUpdate(row)}
              >
                Update
              </Button>
              <Button
                danger
                disabled={
                  properties.isDeletePending ||
                  !properties.hasTrustworthyAssignmentsDataset ||
                  !isSafeDefinitionKey(row.definitionKey)
                }
                onClick={() => properties.onDelete(row)}
              >
                Delete
              </Button>
            </Space>
          );
        },
      },
    ];
  }, [filterOptions, filters, handleSelectFilter, properties]);

  if (properties.shouldRenderBlockingState) return null;
  return (
    <Card
      size="small"
      classNames={{ header: 'app-card-header--controls' }}
      title="Assignment definitions"
      extra={
        properties.shouldRenderTableLoadingState ? null : (
          <Button onClick={() => setFilters(EMPTY_FILTER_STATE)}>Reset sort and filters</Button>
        )
      }
    >
      {properties.shouldRenderTableLoadingState ? (
        <div aria-label="Assignments table loading" aria-live="polite">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '30%' }} />
        </div>
      ) : (
        <Table<AssignmentDefinitionPartial>
          aria-label="Assignment definitions table"
          columns={tableColumns}
          dataSource={visibleRows}
          locale={{ emptyText: <Empty description="No assignment definitions found." /> }}
          pagination={false}
          rowKey="definitionKey"
        />
      )}
    </Card>
  );
}

/** Checks that an assignment definition key is safe for deletion.
 * @param {string} definitionKey Definition key.
 * @returns {boolean} Whether the key passes request validation.
 */
function isSafeDefinitionKey(definitionKey: string): boolean {
  return DeleteAssignmentDefinitionRequestSchema.safeParse({ definitionKey }).success;
}
