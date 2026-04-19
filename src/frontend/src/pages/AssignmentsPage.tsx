import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilterFilled } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Modal,
  Skeleton,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import type { FilterDropdownProps, FilterValue } from 'antd/es/table/interface';
import {
  useCallback,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { logFrontendError } from '../logging/frontendLogger';
import { queryKeys } from '../query/queryKeys';
import { getAssignmentDefinitionPartialsQueryOptions } from '../query/sharedQueries';
import {
  deleteAssignmentDefinition,
  type AssignmentDefinitionPartial,
} from '../services/assignmentDefinitionPartialsService';
import { DeleteAssignmentDefinitionRequestSchema } from '../services/assignmentDefinitionPartials.zod';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

const { Text } = Typography;

const ASSIGNMENTS_PANEL_REGION_LABEL = 'Assignments management panel';
const BLOCKING_ERROR_MESSAGE = 'Assignment definitions could not be trusted or loaded.';
const DELETE_SUCCESS_MESSAGE = 'Assignment definition deleted.';
const DELETE_FAILURE_MESSAGE = 'Could not delete assignment definition. Please try again.';
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

type DeleteOutcome = Readonly<{
  type: 'success' | 'error';
  message: string;
}>;

type AssignmentsSurfaceState = Readonly<{
  shouldRenderActionLoadingState: boolean;
  shouldRenderBlockingState: boolean;
  shouldRenderTableLoadingState: boolean;
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
    getFilterValue: (row) => formatYearGroupLabel(row.yearGroup),
    key: 'yearGroup',
    renderCell: (row) => formatYearGroupLabel(row.yearGroup),
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

/**
 * Returns whether an assignment definition key is safe for deletion calls.
 *
 * @param {string} definitionKey Definition key to validate.
 * @returns {boolean} `true` when the key is safe.
 */
function isSafeDefinitionKey(definitionKey: string): boolean {
  return DeleteAssignmentDefinitionRequestSchema.safeParse({ definitionKey }).success;
}

/**
 * Formats a year-group value for table display and filtering.
 *
 * @param {number | null} yearGroup Year group value.
 * @returns {string} Display label.
 */
function formatYearGroupLabel(yearGroup: number | null): string {
  return yearGroup === null ? UNAVAILABLE_VALUE : String(yearGroup);
}

/**
 * Formats an ISO timestamp for table display and filtering.
 *
 * @param {string | null} updatedAt Last-updated timestamp.
 * @returns {string} Display label.
 */
function formatUpdatedAtLabel(updatedAt: string | null): string {
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
function getUniqueSortedFilterOptions(values: readonly string[]) {
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
function getDefaultSortedRows(rows: readonly AssignmentDefinitionPartial[]): AssignmentDefinitionPartial[] {
  return [...rows].toSorted((left, right) => {
    const leftUpdatedAt = left.updatedAt === null ? Number.NEGATIVE_INFINITY : new Date(left.updatedAt).getTime();
    const rightUpdatedAt = right.updatedAt === null ? Number.NEGATIVE_INFINITY : new Date(right.updatedAt).getTime();

    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    const titleComparison = left.primaryTitle.localeCompare(right.primaryTitle, undefined, {
      sensitivity: 'base',
    });

    if (titleComparison !== 0) {
      return titleComparison;
    }

    return left.definitionKey.localeCompare(right.definitionKey, undefined, { sensitivity: 'base' });
  });
}

/**
 * Matches one row value against one selected table-filter value.
 *
 * @param {FilterValue | null} selectedValues Selected table filter values.
 * @param {string} rowValue Row label.
 * @returns {boolean} `true` when the row should remain visible.
 */
function matchesFilterSelection(selectedValues: FilterValue | null, rowValue: string): boolean {
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
 * @param {'primaryTitle' | 'primaryTopic' | 'yearGroup' | 'documentType' | 'updatedAt'} columnKey Filter column key.
 * @param {FilterValue | null} selectedValues Next selected values.
 * @returns {AssignmentsFilterState} Updated filters.
 */
function getNextFilters(
  currentFilters: AssignmentsFilterState,
  columnKey: AssignmentsFilterColumnKey,
  selectedValues: FilterValue | null
): AssignmentsFilterState {
  return { ...currentFilters, [columnKey]: selectedValues };
}

/**
 * Returns whether assignments content should be blocked.
 *
 * @param {Readonly<{ isAssignmentsDatasetFailed: boolean; isAssignmentsDatasetReady: boolean; isAssignmentsDatasetTrustworthy: boolean; hasTrustworthyAssignmentsDataset: boolean; isAssignmentsQueryError: boolean; }>} input Dataset and query state.
 * @returns {boolean} `true` when the page should fail closed.
 */
function shouldRenderAssignmentsBlockingState(
  input: Readonly<{
    isAssignmentsDatasetFailed: boolean;
    isAssignmentsDatasetReady: boolean;
    isAssignmentsDatasetTrustworthy: boolean;
    hasTrustworthyAssignmentsDataset: boolean;
    isAssignmentsQueryError: boolean;
  }>
): boolean {
  if (input.isAssignmentsDatasetFailed) {
    return true;
  }

  if (input.isAssignmentsDatasetReady && !input.isAssignmentsDatasetTrustworthy) {
    return true;
  }

  return input.hasTrustworthyAssignmentsDataset && input.isAssignmentsQueryError;
}

/**
 * Resolves whether assignments cards should show loading or blocking states.
 *
 * @param {Readonly<{ isAssignmentsDatasetFailed: boolean; isAssignmentsDatasetReady: boolean; isAssignmentsDatasetTrustworthy: boolean; hasTrustworthyAssignmentsDataset: boolean; isAssignmentsQueryError: boolean; isAssignmentsQueryPending: boolean; hasAssignmentsQueryData: boolean; }>} input Dataset and query state.
 * @returns {AssignmentsSurfaceState} Surface-state booleans.
 */
function getAssignmentsSurfaceState(
  input: Readonly<{
    isAssignmentsDatasetFailed: boolean;
    isAssignmentsDatasetReady: boolean;
    isAssignmentsDatasetTrustworthy: boolean;
    hasTrustworthyAssignmentsDataset: boolean;
    isAssignmentsQueryError: boolean;
    isAssignmentsQueryPending: boolean;
    hasAssignmentsQueryData: boolean;
  }>
): AssignmentsSurfaceState {
  const isBlocking = shouldRenderAssignmentsBlockingState(input);

  if (isBlocking) {
    return {
      shouldRenderActionLoadingState: false,
      shouldRenderBlockingState: true,
      shouldRenderTableLoadingState: false,
    };
  }

  return {
    shouldRenderActionLoadingState: !input.hasTrustworthyAssignmentsDataset,
    shouldRenderBlockingState: false,
    shouldRenderTableLoadingState:
      !input.hasTrustworthyAssignmentsDataset
      || (input.isAssignmentsQueryPending && !input.hasAssignmentsQueryData),
  };
}

/**
 * Returns whether the assignments panel should expose busy state.
 *
 * @param {Readonly<{ surfaceState: AssignmentsSurfaceState; isQueryFetching: boolean; isDeleteSubmitting: boolean; isDeletePending: boolean; }>} input Busy-state inputs.
 * @returns {boolean} `true` when the panel is busy.
 */
function isAssignmentsSurfaceBusyState(
  input: Readonly<{
    surfaceState: AssignmentsSurfaceState;
    isQueryFetching: boolean;
    isDeleteSubmitting: boolean;
    isDeletePending: boolean;
  }>
): boolean {
  return (
    input.surfaceState.shouldRenderTableLoadingState
    || input.isQueryFetching
    || input.isDeleteSubmitting
    || input.isDeletePending
  );
}

/**
 * Renders one table filter dropdown with exact-match options.
 *
 * @param {Readonly<{ options: ReadonlyArray<{ text: string; value: string }>; selectedValues: FilterValue | null; onSelectOption: (value: string) => void; dropdownProperties: FilterDropdownProps; }>} properties Filter-dropdown properties.
 * @returns {JSX.Element} Dropdown content.
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

/**
 * Renders one table-column filter icon with an explicit accessible label.
 *
 * @param {Readonly<{ isFiltered: boolean; label: string; }>} properties Icon properties.
 * @returns {JSX.Element} Filter icon.
 */
function AssignmentsFilterIcon(properties: Readonly<{ isFiltered: boolean; label: string }>) {
  return (
    <FilterFilled
      aria-label={properties.label}
      style={{ color: properties.isFiltered ? 'var(--ant-color-primary)' : undefined }}
    />
  );
}

/**
 * Renders one table filter icon callback with stable accessible label.
 *
 * @param {string} label Accessible label for the filter trigger.
 * @returns {(isFiltered: boolean) => JSX.Element} Filter icon renderer.
 */
function createFilterIconRenderer(label: string) {
  return (isFiltered: boolean) => <AssignmentsFilterIcon isFiltered={isFiltered} label={label} />;
}

/**
 * Creates one stable filter dropdown renderer for a table column.
 *
 * @param {Readonly<{ options: ReadonlyArray<AssignmentsFilterOption>; selectedValues: FilterValue | null; onSelectOption: (value: string) => void; }>} properties Renderer inputs.
 * @returns {(dropdownProperties: FilterDropdownProps) => ReactElement} Filter dropdown renderer.
 */
function createFilterDropdownRenderer(
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

/**
 * Renders the status and action card for assignments management.
 *
 * @param {Readonly<{ shouldRenderBlockingState: boolean; deleteOutcome: DeleteOutcome | null; shouldRenderActionLoadingState: boolean; onRefreshAssignmentsData: () => void; }>} properties Card properties.
 * @returns {JSX.Element} Card content.
 */
function AssignmentsStatusAndActionsCard(
  properties: Readonly<{
    shouldRenderBlockingState: boolean;
    deleteOutcome: DeleteOutcome | null;
    shouldRenderActionLoadingState: boolean;
    onRefreshAssignmentsData: () => void;
  }>
) {
  return (
    <Card size="small" title="Status and actions">
      <Flex vertical gap={12}>
        {properties.shouldRenderBlockingState ? (
          <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
        ) : null}

        {properties.deleteOutcome === null ? null : (
          <Alert
            showIcon
            title={properties.deleteOutcome.message}
            type={properties.deleteOutcome.type === 'success' ? 'success' : 'error'}
          />
        )}

        {properties.shouldRenderActionLoadingState ? (
          <div aria-label="Assignments actions loading" aria-live="polite">
            <Space>
              <Skeleton.Button active />
              <Skeleton.Button active />
              <Skeleton.Button active />
            </Space>
          </div>
        ) : (
          <Flex gap={8} justify="space-between" wrap>
            <Text type="secondary">Create and update workflows are not available in v1.</Text>
            <Space wrap>
              <Button onClick={properties.onRefreshAssignmentsData}>Refresh assignments data</Button>
              <Button disabled>Create assignment</Button>
              <Button disabled>Update assignment</Button>
            </Space>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

/**
 * Renders the assignment definitions table card when the page is not blocked.
 *
 * @param {Readonly<{ shouldRenderBlockingState: boolean; shouldRenderTableLoadingState: boolean; onResetSortAndFilters: () => void; tableColumns: TableColumnsType<AssignmentDefinitionPartial>; visibleRows: readonly AssignmentDefinitionPartial[]; }>} properties Card properties.
 * @returns {JSX.Element | null} Card content, or null for blocking state.
 */
function renderAssignmentsDefinitionsCard(
  properties: Readonly<{
    shouldRenderBlockingState: boolean;
    shouldRenderTableLoadingState: boolean;
    onResetSortAndFilters: () => void;
    tableColumns: TableColumnsType<AssignmentDefinitionPartial>;
    visibleRows: readonly AssignmentDefinitionPartial[];
  }>
): ReactElement | null {
  if (properties.shouldRenderBlockingState) {
    return null;
  }

  return (
    <Card
      size="small"
      title="Assignment definitions"
      extra={
        properties.shouldRenderTableLoadingState ? null : (
          <Button onClick={properties.onResetSortAndFilters}>Reset sort and filters</Button>
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
          columns={properties.tableColumns}
          dataSource={properties.visibleRows}
          locale={{
            emptyText: <Empty description="No assignment definitions found." />,
          }}
          pagination={false}
          rowKey="definitionKey"
        />
      )}
    </Card>
  );
}

/**
 * Renders the delete-confirmation modal.
 *
 * @param {Readonly<{ deleteTarget: AssignmentDefinitionPartial | null; isDeleteSubmitting: boolean; isDeleteMutationPending: boolean; onCancel: () => void; onConfirm: () => void; }>} properties Modal properties.
 * @returns {JSX.Element} Delete modal.
 */
function AssignmentsDeleteModal(
  properties: Readonly<{
    deleteTarget: AssignmentDefinitionPartial | null;
    isDeleteSubmitting: boolean;
    isDeleteMutationPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }>
) {
  const isDeleteBusy = properties.isDeleteSubmitting || properties.isDeleteMutationPending;

  return (
    <Modal
      centered
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={isDeleteBusy} onClick={properties.onCancel}>
            Cancel
          </Button>
          <Button
            disabled={isDeleteBusy}
            loading={isDeleteBusy}
            onClick={properties.onConfirm}
            type="primary"
          >
            Delete definition
          </Button>
        </Space>
      }
      keyboard={!isDeleteBusy}
      onCancel={properties.onCancel}
      open={properties.deleteTarget !== null}
      title="Delete assignment definition"
      transitionName=""
    >
      <Space orientation="vertical" size="small">
        <Text>You are deleting this assignment definition.</Text>
        {properties.deleteTarget === null ? null : <Text strong>{properties.deleteTarget.primaryTitle}</Text>}
        <Text>This delete is permanent and cannot be undone.</Text>
      </Space>
    </Modal>
  );
}

/**
 * Renders the assignments management page.
 *
 * @returns {JSX.Element} Assignments page content.
 */
export function AssignmentsPage() {
  const startupWarmupState = useStartupWarmupState();
  const queryClient = useQueryClient();

  const assignmentDatasetSnapshot = startupWarmupState.snapshot.datasets.assignmentDefinitionPartials;
  const isAssignmentsDatasetReady = startupWarmupState.isDatasetReady('assignmentDefinitionPartials');
  const isAssignmentsDatasetFailed = startupWarmupState.isDatasetFailed('assignmentDefinitionPartials');
  const isAssignmentsDatasetTrustworthy = assignmentDatasetSnapshot.isTrustworthy;
  const hasTrustworthyAssignmentsDataset = isAssignmentsDatasetReady && isAssignmentsDatasetTrustworthy;

  const assignmentsQuery = useQuery({
    ...getAssignmentDefinitionPartialsQueryOptions(),
    enabled: hasTrustworthyAssignmentsDataset,
    refetchOnMount: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { definitionKey: string }) => deleteAssignmentDefinition(input),
  });

  const [filters, setFilters] = useState<AssignmentsFilterState>(EMPTY_FILTER_STATE);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentDefinitionPartial | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [deleteOutcome, setDeleteOutcome] = useState<DeleteOutcome | null>(null);

  const sortedRows = useMemo(() => getDefaultSortedRows(assignmentsQuery.data ?? []), [assignmentsQuery.data]);

  const filterOptions = useMemo(() => {
    const nextFilterOptions: Record<AssignmentsFilterColumnKey, ReadonlyArray<AssignmentsFilterOption>> = {
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

  const visibleRows = useMemo(
    () =>
      sortedRows.filter((row) =>
        ASSIGNMENTS_FILTER_DESCRIPTORS.every((descriptor) =>
          matchesFilterSelection(filters[descriptor.key], descriptor.getFilterValue(row))
        )
      ),
    [filters, sortedRows]
  );

  const handleSelectFilter = useCallback((columnKey: AssignmentsFilterColumnKey, value: string) => {
    setFilters((currentFilters) => getNextFilters(currentFilters, columnKey, [value]));
  }, []);

  const tableColumns: TableColumnsType<AssignmentDefinitionPartial> = useMemo(
    () => [
      ...ASSIGNMENTS_FILTER_DESCRIPTORS.map((descriptor) => ({
        title: descriptor.title,
        dataIndex: descriptor.key,
        key: descriptor.key,
        ...(descriptor.renderCell === undefined
          ? {}
          : {
              render: (_: unknown, row: AssignmentDefinitionPartial) => descriptor.renderCell!(row),
            }),
        filterDropdown: createFilterDropdownRenderer({
          onSelectOption: (value) => {
            handleSelectFilter(descriptor.key, value);
          },
          options: filterOptions[descriptor.key],
          selectedValues: filters[descriptor.key],
        }),
        filterDropdownProps: FILTER_DROPDOWN_PROPERTIES,
        filterIcon: createFilterIconRenderer(descriptor.filterLabel),
        filteredValue: filters[descriptor.key],
        onHeaderCell: () => ({ 'aria-label': descriptor.title }),
      })),
      {
        title: 'Actions',
        key: 'actions',
        onHeaderCell: () => ({ 'aria-label': 'Actions' }),
        render: (_, row) => (
          <Button
            danger
            disabled={isDeleteSubmitting || deleteMutation.isPending || !isSafeDefinitionKey(row.definitionKey)}
            onClick={() => {
              setDeleteOutcome(null);
              setDeleteTarget(row);
            }}
          >
            Delete
          </Button>
        ),
      },
    ],
    [deleteMutation.isPending, filterOptions, filters, handleSelectFilter, isDeleteSubmitting]
  );

  const assignmentsSurfaceState = getAssignmentsSurfaceState({
    hasAssignmentsQueryData: assignmentsQuery.data !== undefined,
    hasTrustworthyAssignmentsDataset,
    isAssignmentsDatasetFailed,
    isAssignmentsDatasetReady,
    isAssignmentsDatasetTrustworthy,
    isAssignmentsQueryError: assignmentsQuery.isError,
    isAssignmentsQueryPending: assignmentsQuery.isPending,
  });

  const isAssignmentsSurfaceBusy = isAssignmentsSurfaceBusyState({
    isDeletePending: deleteMutation.isPending,
    isDeleteSubmitting,
    isQueryFetching: assignmentsQuery.isFetching,
    surfaceState: assignmentsSurfaceState,
  });

  const refetchAssignmentDefinitions = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.assignmentDefinitionPartials(),
      refetchType: 'none',
    });

    return queryClient.fetchQuery(getAssignmentDefinitionPartialsQueryOptions());
  }, [queryClient]);

  const assignmentsDefinitionsCard = renderAssignmentsDefinitionsCard({
    onResetSortAndFilters: () => {
      setFilters(EMPTY_FILTER_STATE);
    },
    shouldRenderBlockingState: assignmentsSurfaceState.shouldRenderBlockingState,
    shouldRenderTableLoadingState: assignmentsSurfaceState.shouldRenderTableLoadingState,
    tableColumns,
    visibleRows,
  });


  /**
   * Refetches assignment definitions using the scoped query key only.
   *
   * @returns {void} No return value.
   */
  function handleRetryAssignmentsData() {
    setDeleteOutcome(null);
    refetchAssignmentDefinitions();
  }

  /**
   * Confirms and runs one assignment-definition delete.
   *
   * @returns {Promise<void>} Promise resolving once delete flow settles.
   */
  async function handleConfirmDelete(): Promise<void> {
    if (deleteTarget === null || isDeleteSubmitting || deleteMutation.isPending) {
      return;
    }

    setDeleteOutcome(null);
    setIsDeleteSubmitting(true);

    let deleteCompleted = false;

    try {
      await deleteMutation.mutateAsync({ definitionKey: deleteTarget.definitionKey });
      deleteCompleted = true;
      setDeleteTarget(null);

      await refetchAssignmentDefinitions();
      setDeleteOutcome({ type: 'success', message: DELETE_SUCCESS_MESSAGE });
    } catch (error: unknown) {
      logFrontendError('pages/AssignmentsPage.handleConfirmDelete', error, {
        definitionKey: deleteTarget.definitionKey,
        deleteCompleted,
      });

      if (!deleteCompleted) {
        setDeleteTarget(null);
        setDeleteOutcome({ type: 'error', message: DELETE_FAILURE_MESSAGE });
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  }

  /**
   * Closes the delete modal when the delete flow is idle.
   *
   * @returns {void} No return value.
   */
  function handleDeleteModalClose() {
    if (isDeleteSubmitting || deleteMutation.isPending) {
      return;
    }

    setDeleteTarget(null);
  }
  return (
    <PageSection heading={pageContent.assignments.heading} summary={pageContent.assignments.summary}>
      <section
        aria-label={ASSIGNMENTS_PANEL_REGION_LABEL}
        aria-busy={isAssignmentsSurfaceBusy ? 'true' : undefined}
      >
        <Flex vertical gap={16}>
          <AssignmentsStatusAndActionsCard
            deleteOutcome={deleteOutcome}
            onRefreshAssignmentsData={handleRetryAssignmentsData}
            shouldRenderActionLoadingState={assignmentsSurfaceState.shouldRenderActionLoadingState}
            shouldRenderBlockingState={assignmentsSurfaceState.shouldRenderBlockingState}
          />
          {assignmentsDefinitionsCard}
        </Flex>
      </section>

      <AssignmentsDeleteModal
        deleteTarget={deleteTarget}
        isDeleteMutationPending={deleteMutation.isPending}
        isDeleteSubmitting={isDeleteSubmitting}
        onCancel={handleDeleteModalClose}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </PageSection>
  );
}
