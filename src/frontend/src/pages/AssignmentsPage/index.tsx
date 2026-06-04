import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Flex, Space } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useStartupWarmupState } from '../../features/auth/startupWarmupState';
import {
  usePageDataset,
} from '../../hooks/usePageDataset';
import { logFrontendError } from '../../logging/frontendLogger';
import { queryKeys } from '../../query/queryKeys';
import { refetchAfterStaleInvalidate } from '../../query/queryInvalidationHelpers';
import {
  deleteAssignmentDefinition,
  type AssignmentDefinitionPartial,
} from '../../services/assignmentDefinitionPartialsService';
import { AssignmentDefinitionWizardModal } from '../AssignmentDefinitionWizardModal';
import { PageSection } from '../PageSection';
import { pageContent } from '../pageContent';
import {
  createFilterDropdownRenderer,
  createFilterIconRenderer,
  formatUpdatedAtLabel,
  formatYearGroupLabel,
  getAssignmentsSurfaceState,
  getDefaultSortedRows,
  getNextFilters,
  getUniqueSortedFilterOptions,
  isAssignmentsSurfaceBusyState,
  isSafeDefinitionKey,
  matchesFilterSelection,
} from './helpers';
import {
  AssignmentsDeleteModal,
  AssignmentsStatusAndActionsCard,
  renderAssignmentsDefinitionsCard,
} from './subcomponents';
import type {
  AssignmentsFilterColumnKey,
  AssignmentsFilterDescriptor,
  AssignmentsFilterOption,
  DeleteOutcome,
} from './types';
import {
  ASSIGNMENTS_PANEL_REGION_LABEL,
  DELETE_FAILURE_MESSAGE,
  DELETE_SUCCESS_MESSAGE,
  EMPTY_FILTER_STATE,
  FILTER_DROPDOWN_PROPERTIES,
} from './types';

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

/**
 * Renders the assignments management page.
 *
 * @returns {JSX.Element} Assignments page content.
 */
export function AssignmentsPage() {
  const startupWarmupState = useStartupWarmupState();
  const queryClient = useQueryClient();

  const { query: assignmentsQuery, datasetState: assignmentsDatasetState } =
    usePageDataset<AssignmentDefinitionPartial[]>('assignmentDefinitionPartials');

  const hasTrustworthyAssignmentsDataset = assignmentsDatasetState.hasTrustworthyDataset;
  const hasTrustworthyReferenceData =
    startupWarmupState.isDatasetReady('assignmentTopics') &&
    startupWarmupState.isDatasetReady('yearGroups');

  const deleteMutation = useMutation({
    mutationFn: async (input: { definitionKey: string }) => deleteAssignmentDefinition(input),
  });

  const [filters, setFilters] = useState(EMPTY_FILTER_STATE);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentDefinitionPartial | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteOutcome, setDeleteOutcome] = useState<DeleteOutcome | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'update'>('create');
  const [wizardDefinitionKey, setWizardDefinitionKey] = useState<string | null>(null);

  const sortedRows = useMemo(
    () => getDefaultSortedRows(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

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

  const tableColumns = useMemo(
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
        render: (_: unknown, row: AssignmentDefinitionPartial) => (
          <Space wrap>
            <Button
              disabled={
                deleteMutation.isPending ||
                !hasTrustworthyAssignmentsDataset ||
                !hasTrustworthyReferenceData
              }
              onClick={() => {
                setWizardMode('update');
                setWizardDefinitionKey(row.definitionKey);
                setWizardOpen(true);
              }}
            >
              Update
            </Button>
            <Button
              danger
              disabled={
                deleteMutation.isPending ||
                !hasTrustworthyAssignmentsDataset ||
                !isSafeDefinitionKey(row.definitionKey)
              }
              onClick={() => {
                setDeleteError(null);
                setDeleteOutcome(null);
                setDeleteTarget(row);
              }}
            >
              Delete
            </Button>
          </Space>
        ),
      },
    ],
    [
      deleteMutation.isPending,
      filterOptions,
      filters,
      handleSelectFilter,
      hasTrustworthyAssignmentsDataset,
      hasTrustworthyReferenceData,
      setDeleteError,
      setDeleteOutcome,
      setDeleteTarget,
      setWizardDefinitionKey,
      setWizardMode,
      setWizardOpen,
    ]
  );

  const assignmentsSurfaceState = getAssignmentsSurfaceState(
    assignmentsDatasetState,
    assignmentsQuery.isPending
  );

  const isAssignmentsSurfaceBusy = isAssignmentsSurfaceBusyState({
    isDeletePending: deleteMutation.isPending,
    isQueryFetching: assignmentsQuery.isFetching,
    surfaceState: assignmentsSurfaceState,
  });

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
   * Opens the create assignment definition modal.
   *
   * @returns {void} No return value.
   */
  function handleCreateAssignment() {
    setWizardMode('create');
    setWizardDefinitionKey(null);
    setWizardOpen(true);
  }

  /**
   * Handles closing the wizard modal.
   *
   * @returns {void} No return value.
   */
  function handleWizardClose() {
    setWizardOpen(false);
    setWizardDefinitionKey(null);
  }

  /**
   * Refetches assignment definitions using the scoped query key only.
   *
   * @returns {Promise<void>} Promise resolving once invalidate-then-refetch completes.
   */
  async function handleRetryAssignmentsData() {
    setDeleteOutcome(null);
    await refetchAfterStaleInvalidate(queryClient, queryKeys.assignmentDefinitionPartials());
  }

  /**
   * Confirms and runs one assignment-definition delete.
   *
   * @returns {Promise<void>} Promise resolving once delete flow settles.
   */
  async function handleConfirmDelete(): Promise<void> {
    if (deleteTarget === null || deleteMutation.isPending) {
      return;
    }

    setDeleteError(null);
    setDeleteOutcome(null);

    let deleteCompleted = false;

    try {
      await deleteMutation.mutateAsync({ definitionKey: deleteTarget.definitionKey });
      deleteCompleted = true;
      setDeleteTarget(null);

      await refetchAfterStaleInvalidate(queryClient, queryKeys.assignmentDefinitionPartials());
      setDeleteOutcome({ type: 'success', message: DELETE_SUCCESS_MESSAGE });
    } catch (error: unknown) {
      logFrontendError('pages/AssignmentsPage.handleConfirmDelete', error, {
        definitionKey: deleteTarget.definitionKey,
        deleteCompleted,
      });

      if (!deleteCompleted) {
        setDeleteError(DELETE_FAILURE_MESSAGE);
      }
    }
  }

  /**
   * Closes the delete modal when the delete flow is idle.
   *
   * @returns {void} No return value.
   */
  function handleDeleteModalClose() {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteError(null);
    setDeleteTarget(null);
  }

  return (
    <PageSection
      heading={pageContent.assignments.heading}
      summary={pageContent.assignments.summary}
    >
      <section
        aria-label={ASSIGNMENTS_PANEL_REGION_LABEL}
        aria-busy={isAssignmentsSurfaceBusy ? 'true' : undefined}
      >
        <Flex vertical gap={16}>
          <AssignmentsStatusAndActionsCard
            deleteOutcome={deleteOutcome}
            hasTrustworthyData={hasTrustworthyAssignmentsDataset && hasTrustworthyReferenceData}
            onCreateAssignment={handleCreateAssignment}
            onRefreshAssignmentsData={handleRetryAssignmentsData}
            shouldRenderActionLoadingState={assignmentsSurfaceState.shouldRenderActionLoadingState}
            shouldRenderBlockingState={assignmentsSurfaceState.shouldRenderBlockingState}
          />
          {assignmentsDefinitionsCard}
        </Flex>
      </section>

      <AssignmentDefinitionWizardModal
        definitionKey={wizardDefinitionKey}
        mode={wizardMode}
        onClose={handleWizardClose}
        open={wizardOpen}
      />

      <AssignmentsDeleteModal
        deleteTarget={deleteTarget}
        error={deleteError}
        isDeleteMutationPending={deleteMutation.isPending}
        onCancel={handleDeleteModalClose}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </PageSection>
  );
}
