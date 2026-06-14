import { Card, Flex, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryKeys';
import { callApi } from '../../services/apiService';
import { type RequiredClassPartialsRefreshOutcome } from './bulk/queryInvalidation';
import { runBulkMutationOrchestration } from './bulk/bulkMutationOrchestration';
import {
  buildTopLevelBulkMutationResolution,
  buildMetadataBulkMutationResolution,
  createBulkCreateFailureMessage,
  createBulkDeleteFailureMessage,
  createBulkSetActiveFailureMessage,
  createBulkSetInactiveFailureMessage,
  type BulkActionOutcomeAlert,
  type TopLevelBulkActionDescriptor,
} from './bulk/bulkMutationResolution';
import { ClassesAlertStack } from './components/ClassesAlertStack';
import { ClassesManagementPanelOutcomeAlert } from './components/ClassesManagementPanelOutcomeAlert';
import { ClassesManagementPanelLoadingState } from './components/ClassesManagementPanelLoadingState';
import { ClassesSummaryCard } from './components/ClassesSummaryCard';
import {
  isClassesWorkflowMutationBoundaryActive,
  shouldSuppressClassesTableData,
  getClassesWorkflowBusyState,
} from './components/classesManagementWorkflowBoundary';
import { ClassesTable } from './table/ClassesTable';
import { ClassesToolbar } from './table/ClassesToolbar';
import { BulkCreateModal } from './bulk/BulkCreateModal';
import { BulkDeleteModal } from './bulk/BulkDeleteModal';
import { BulkSetCourseLengthModal } from './bulk/BulkSetCourseLengthModal';
import { BulkSetSelectModal } from './bulk/BulkSetSelectModal';
import { ManageCohortsModal } from '../referenceData/ManageCohortsModal';
import { ManageYearGroupsModal } from '../referenceData/ManageYearGroupsModal';
import { bulkSetCohort, getActiveCohortOptions } from './bulk/bulkSetCohortFlow';
import { bulkSetCourseLength } from './bulk/bulkSetCourseLengthFlow';
import { bulkSetYearGroup, getYearGroupOptions } from './bulk/bulkSetYearGroupFlow';
import { bulkCreate, filterBulkCreateRows, type BulkCreateOptions } from './bulk/bulkCreateFlow';
import { filterEligibleForBulkMetadataUpdate } from './bulk/bulkMetadataUpdateFlow';
import { filterEligibleForActiveState } from './bulk/bulkActiveStateFlow';
import {
  runBatchMutation,
  type RowMutationResult,
} from './bulk/batchMutationEngine';
import { useClassesManagement } from './useClassesManagement';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Accessible label for the panel-owned classes management region.
 */
export const classesManagementPanelRegionLabel = 'Classes management panel';

/**
 * Renders the Classes feature entry shell.
 *
 * Wires bulk-action handlers via the shared bulk-mutation orchestration helper.
 * Successful mutation paths perform the required class-partials refresh and then
 * mark `classPartials` stale so the table can reconcile with the updated state.
 *
 * @returns {JSX.Element} The Classes feature panel shell.
 */
export function ClassesManagementPanel() {
  const classesManagement = useClassesManagement();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [setCohortModalOpen, setSetCohortModalOpen] = useState(false);
  const [setYearGroupModalOpen, setSetYearGroupModalOpen] = useState(false);
  const [setCourseLengthModalOpen, setSetCourseLengthModalOpen] = useState(false);
  const [manageCohortsModalOpen, setManageCohortsModalOpen] = useState(false);
  const [manageYearGroupsModalOpen, setManageYearGroupsModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [setActiveSubmitting, setSetActiveSubmitting] = useState(false);
  const [setInactiveSubmitting, setSetInactiveSubmitting] = useState(false);
  const [setCohortSubmitting, setSetCohortSubmitting] = useState(false);
  const [setYearGroupSubmitting, setSetYearGroupSubmitting] = useState(false);
  const [setCourseLengthSubmitting, setSetCourseLengthSubmitting] = useState(false);
  const [bulkActionOutcomeAlert, setBulkActionOutcomeAlert] = useState<BulkActionOutcomeAlert | null>(null);
  const [refreshRequiredMessage, setRefreshRequiredMessage] = useState<string | null>(null);
  const [suppressStaleTableData, setSuppressStaleTableData] = useState(false);
  const [pendingCreatedCohortKey, setPendingCreatedCohortKey] = useState<string | undefined>();
  const [pendingCreatedYearGroupKey, setPendingCreatedYearGroupKey] = useState<string | undefined>();

  const selectedRows = useMemo(
    () => classesManagement.rows.filter((row) => classesManagement.selectedRowKeys.includes(row.classId)),
    [classesManagement.rows, classesManagement.selectedRowKeys],
  );
  const cohortOptions = useMemo(
    () => getActiveCohortOptions(classesManagement.cohorts ?? []),
    [classesManagement.cohorts],
  );
  const yearGroupOptions = useMemo(
    () => getYearGroupOptions(classesManagement.yearGroups ?? []),
    [classesManagement.yearGroups],
  );

  const effectiveRefreshRequiredMessage = classesManagement.refreshRequiredMessage ?? refreshRequiredMessage;
  const shouldSuppressStaleTableData = shouldSuppressClassesTableData(
    suppressStaleTableData,
    classesManagement.refreshRequiredMessage,
  );
  const workflowMutationBoundaryActive = isClassesWorkflowMutationBoundaryActive({
    createSubmitting,
    deleteSubmitting,
    setActiveSubmitting,
    setCohortSubmitting,
    setCourseLengthSubmitting,
    setInactiveSubmitting,
    setYearGroupSubmitting,
  });

  /**
   * Clears the transient bulk-action feedback before another mutation starts.
   *
   * @returns {void} No return value.
   */
  function clearBulkActionFeedback(): void {
    setBulkActionOutcomeAlert(null);
    setRefreshRequiredMessage(null);
  }

  // Handlers for 'Add new' cohort/year group workflow
  const handleCohortAddNew = useCallback(() => {
    setManageCohortsModalOpen(true);
  }, []);

  const handleYearGroupAddNew = useCallback(() => {
    setManageYearGroupsModalOpen(true);
  }, []);

  const handleCohortEntityCreated = useCallback(
    (entity: { key: string; name: string }) => {
      setPendingCreatedCohortKey(entity.key);
      // Invalidate cohorts query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
    },
    [queryClient]
  );

  const handleYearGroupEntityCreated = useCallback(
    (entity: { key: string; name: string }) => {
      setPendingCreatedYearGroupKey(entity.key);
      // Invalidate yearGroups query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
    },
    [queryClient]
  );

  /**
   * Resolves post-mutation UI state for a top-level bulk action.
   *
   * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
   *   Settled batch results and refresh outcome.
   * @param {TopLevelBulkActionDescriptor} options Action-specific UI copy and close handler.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleTopLevelBulkMutationResult(
    outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
    options: TopLevelBulkActionDescriptor,
  ): Promise<void> {
    const resolution = buildTopLevelBulkMutationResolution(outcome, options);

    setRefreshRequiredMessage(resolution.refreshRequiredMessage);
    setSuppressStaleTableData(resolution.suppressStaleTableData);
    setBulkActionOutcomeAlert(resolution.alert);
    classesManagement.onSelectedRowKeysChange(resolution.selectedRowKeys);

    if (resolution.shouldCloseSurface) {
      options.closeSurface?.();
    }
  }

  /**
   * Runs the shared panel bulk-mutation orchestration wiring.
   *
   * @template TResult Mutation result payload type.
   * @param {Readonly<{
   *   handleOutcome: (outcome: RequiredClassPartialsRefreshOutcome<TResult>) => Promise<void>;
   *   mutate: () => Promise<TResult>;
   *   setSubmitting: (value: boolean) => void;
   * }>} options Per-action mutation contract.
   * @returns {Promise<void>} Completion signal.
   */
  async function runPanelBulkMutation<TResult>(options: Readonly<{
    handleOutcome: (outcome: RequiredClassPartialsRefreshOutcome<TResult>) => Promise<void>;
    mutate: () => Promise<TResult>;
    setSubmitting: (value: boolean) => void;
  }>): Promise<void> {
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: options.handleOutcome,
      mutate: options.mutate,
      queryClient,
      setSubmitting: options.setSubmitting,
    });
  }

  /**
   * Runs one top-level bulk action through the shared orchestration boundary.
   *
   * @param {TopLevelBulkActionDescriptor} options Top-level action descriptor.
   * @returns {Promise<void>} Completion signal.
   */
  async function runTopLevelBulkAction(options: TopLevelBulkActionDescriptor): Promise<void> {
    await runPanelBulkMutation({
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, options),
      mutate: () => options.mutateRows(selectedRows),
      setSubmitting: options.setSubmitting,
    });
  }

  /**
   * Runs one metadata modal action through the shared orchestration boundary.
   *
   * @param {Readonly<{
   *   closeModal: () => void;
   *   mutate: () => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
   *   setSubmitting: (value: boolean) => void;
   * }>} options Metadata action descriptor.
   * @returns {Promise<void>} Completion signal.
   */
  async function runMetadataBulkAction(options: Readonly<{
    closeModal: () => void;
    mutate: () => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    setSubmitting: (value: boolean) => void;
  }>): Promise<void> {
    await runPanelBulkMutation({
      handleOutcome: (outcome) => handleBulkMetadataMutationResult(outcome, options.closeModal),
      mutate: options.mutate,
      setSubmitting: options.setSubmitting,
    });
  }

  const topLevelBulkActionDescriptors = {
    delete: {
      createFailureMessage: createBulkDeleteFailureMessage,
      fullFailureTitle: 'Could not delete selected classes.',
      partialFailureTitle: 'Some selected classes were not deleted.',
      closeSurface: () => setDeleteModalOpen(false),
      mutateRows: (rows: ClassesManagementRow[]) =>
        runBatchMutation(rows, (row) => callApi('deleteABClass', { classId: row.classId })),
      setSubmitting: setDeleteSubmitting,
    },
    setActive: {
      createFailureMessage: createBulkSetActiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to active.',
      partialFailureTitle: 'Some selected classes were not set to active.',
      mutateRows: (rows: ClassesManagementRow[]) => {
        const eligibleRows = filterEligibleForActiveState(rows, true);
        return runBatchMutation(eligibleRows, (row) => callApi('updateABClass', { classId: row.classId, active: true }));
      },
      setSubmitting: setSetActiveSubmitting,
    },
    setInactive: {
      createFailureMessage: createBulkSetInactiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to inactive.',
      partialFailureTitle: 'Some selected classes were not set to inactive.',
      mutateRows: (rows: ClassesManagementRow[]) => {
        const eligibleRows = filterEligibleForActiveState(rows, false);
        return runBatchMutation(eligibleRows, (row) => callApi('updateABClass', { classId: row.classId, active: false }));
      },
      setSubmitting: setSetInactiveSubmitting,
    },
  } satisfies Readonly<Record<'delete' | 'setActive' | 'setInactive', TopLevelBulkActionDescriptor>>;

  /**
   * Builds the create action descriptor with the currently selected metadata input.
   *
   * @param {BulkCreateOptions} options Cohort/year-group/course-length selection.
   * @returns {TopLevelBulkActionDescriptor} Descriptor for the create action.
   */
  function getCreateTopLevelBulkActionDescriptor(options: BulkCreateOptions): TopLevelBulkActionDescriptor {
    return {
      createFailureMessage: createBulkCreateFailureMessage,
      fullFailureTitle: 'Could not create selected classes.',
      partialFailureTitle: 'Some selected classes were not created.',
      closeSurface: () => setCreateModalOpen(false),
      mutateRows: (rows: ClassesManagementRow[]) => bulkCreate(filterBulkCreateRows(rows), options),
      setSubmitting: setCreateSubmitting,
    };
  }

  /**
   * Runs one descriptor-driven top-level action.
   *
   * @param {'delete' | 'setActive' | 'setInactive'} actionKey Descriptor key.
   * @returns {Promise<void>} Completion signal.
   */
  async function runTopLevelBulkActionByKey(actionKey: 'delete' | 'setActive' | 'setInactive'): Promise<void> {
    switch (actionKey) {
      case 'delete': {
        await runTopLevelBulkAction(topLevelBulkActionDescriptors.delete);
        return;
      }
      case 'setActive': {
        await runTopLevelBulkAction(topLevelBulkActionDescriptors.setActive);
        return;
      }
      case 'setInactive': {
        await runTopLevelBulkAction(topLevelBulkActionDescriptors.setInactive);
        return;
      }
    }
  }

  /**
   * Calls deleteABClass for each selected row through the shared bulk-mutation
   * orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    await runTopLevelBulkActionByKey('delete');
  }

  /**
   * Calls upsertABClass for each selected notCreated row through the shared
   * bulk-mutation orchestration helper.
   *
   * @param {BulkCreateOptions} options Cohort/year-group/course-length selection.
   * @returns {Promise<void>} Resolves when all create calls have settled.
   */
  async function handleBulkCreate(options: BulkCreateOptions): Promise<void> {
    await runTopLevelBulkAction(getCreateTopLevelBulkActionDescriptor(options));
  }

  /**
   * Calls updateABClass with active: true for each eligible selected row through
   * the shared bulk-mutation orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all activations have settled.
   */
  async function handleSetActive() {
    await runTopLevelBulkActionByKey('setActive');
  }

  /**
   * Calls updateABClass with active: false for each eligible selected row through
   * the shared bulk-mutation orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all deactivations have settled.
   */
  async function handleSetInactive() {
    await runTopLevelBulkActionByKey('setInactive');
  }

  /**
   * Resolves post-mutation UI state for a bulk metadata batch.
   *
   * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
   *   Settled batch results and refresh outcome.
   * @param {() => void} closeModal Closes the active metadata modal when the batch can hand off.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleBulkMetadataMutationResult(
    outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
    closeModal: () => void,
  ): Promise<void> {
    const resolution = buildMetadataBulkMutationResolution(outcome);

    setRefreshRequiredMessage(resolution.refreshRequiredMessage);
    setSuppressStaleTableData(resolution.suppressStaleTableData);
    setBulkActionOutcomeAlert(resolution.alert);
    classesManagement.onSelectedRowKeysChange(resolution.selectedRowKeys);

    if (resolution.shouldCloseModal) {
      closeModal();
    }

    if (resolution.errorMessage !== null) {
      throw new Error(resolution.errorMessage);
    }
  }

  /**
   * Applies one cohort to the selected eligible rows.
   *
   * @param {string} cohortKey Selected cohort key.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetCohort(cohortKey: string): Promise<void> {
    await runMetadataBulkAction({
      closeModal: () => setSetCohortModalOpen(false),
      mutate: () => bulkSetCohort(filterEligibleForBulkMetadataUpdate(selectedRows), cohortKey),
      setSubmitting: setSetCohortSubmitting,
    });
  }

  /**
   * Applies one year group to the selected eligible rows.
   *
   * @param {string} yearGroupKey Selected year-group key.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetYearGroup(yearGroupKey: string): Promise<void> {
    await runMetadataBulkAction({
      closeModal: () => setSetYearGroupModalOpen(false),
      mutate: () => bulkSetYearGroup(filterEligibleForBulkMetadataUpdate(selectedRows), yearGroupKey),
      setSubmitting: setSetYearGroupSubmitting,
    });
  }

  /**
   * Applies one validated course length to the selected eligible rows.
   *
   * @param {number} courseLength Selected course length.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetCourseLength(courseLength: number): Promise<void> {
    await runMetadataBulkAction({
      closeModal: () => setSetCourseLengthModalOpen(false),
      mutate: () => bulkSetCourseLength(filterEligibleForBulkMetadataUpdate(selectedRows), courseLength),
      setSubmitting: setSetCourseLengthSubmitting,
    });
  }

  if (classesManagement.classesManagementViewState === 'loading') {
    return (
      <section aria-label={classesManagementPanelRegionLabel}>
        <Card className="settings-tab-panel">
          <ClassesManagementPanelLoadingState />
        </Card>
      </section>
    );
  }

  if (classesManagement.classesManagementViewState === 'error') {
    return (
      <section aria-label={classesManagementPanelRegionLabel}>
        <Card className="settings-tab-panel">
          <ClassesManagementPanelOutcomeAlert alert={bulkActionOutcomeAlert} />
          <ClassesAlertStack
            blockingErrorMessage={classesManagement.blockingErrorMessage}
            nonBlockingWarningMessage={classesManagement.nonBlockingWarningMessage}
            refreshRequiredMessage={effectiveRefreshRequiredMessage}
          />
          {classesManagement.blockingErrorMessage === null ? (
            <Typography.Text>{classesManagement.errorMessage}</Typography.Text>
          ) : null}
        </Card>
      </section>
    );
  }

  return (
    <section aria-label={classesManagementPanelRegionLabel}>
      <Card className="settings-tab-panel">
        <ClassesManagementPanelOutcomeAlert alert={bulkActionOutcomeAlert} />
        <ClassesAlertStack
          blockingErrorMessage={classesManagement.blockingErrorMessage}
          nonBlockingWarningMessage={classesManagement.nonBlockingWarningMessage}
          refreshRequiredMessage={effectiveRefreshRequiredMessage}
        />
        {shouldSuppressStaleTableData === false ? (
          <Flex vertical gap={12}>
            <section aria-label="Classes data workflow" aria-busy={getClassesWorkflowBusyState(classesManagement.isRefreshing)}>
              <Flex vertical gap={12}>
                <ClassesSummaryCard rows={classesManagement.rows} selectedCount={classesManagement.selectedRowKeys.length} />
                <ClassesToolbar
                  selectedRows={selectedRows}
                  onBulkCreate={() => setCreateModalOpen(true)}
                  onBulkDelete={() => setDeleteModalOpen(true)}
                  onSetActive={handleSetActive}
                  onSetInactive={handleSetInactive}
                  onSetCohort={() => setSetCohortModalOpen(true)}
                  onSetYearGroup={() => setSetYearGroupModalOpen(true)}
                  onSetCourseLength={() => setSetCourseLengthModalOpen(true)}
                  onManageCohorts={() => setManageCohortsModalOpen(true)}
                  onManageYearGroups={() => setManageYearGroupsModalOpen(true)}
                  mutationInFlight={workflowMutationBoundaryActive}
                  setActiveLoading={setActiveSubmitting}
                  setInactiveLoading={setInactiveSubmitting}
                />
                <ClassesTable
                  rows={classesManagement.rows}
                  selectedRowKeys={classesManagement.selectedRowKeys}
                  onSelectedRowKeysChange={classesManagement.onSelectedRowKeysChange}
                  selectionFrozen={workflowMutationBoundaryActive}
                />
              </Flex>
            </section>
            <BulkCreateModal
              open={createModalOpen}
              cohortOptions={cohortOptions}
              yearGroupOptions={yearGroupOptions}
              confirmLoading={createSubmitting}
              onConfirm={handleBulkCreate}
              onCancel={() => setCreateModalOpen(false)}
              onCohortAddNew={handleCohortAddNew}
              onYearGroupAddNew={handleYearGroupAddNew}
              pendingCreatedCohortKey={pendingCreatedCohortKey}
              pendingCreatedYearGroupKey={pendingCreatedYearGroupKey}
            />
            <BulkDeleteModal
              open={deleteModalOpen}
              selectedRows={selectedRows}
              onConfirm={handleDeleteConfirm}
              onCancel={() => setDeleteModalOpen(false)}
              confirmLoading={deleteSubmitting}
            />
            <BulkSetSelectModal
              open={setCohortModalOpen}
              title="Set cohort"
              fieldLabel="Cohort"
              options={cohortOptions}
              confirmLoading={setCohortSubmitting}
              onConfirm={handleSetCohort}
              onCancel={() => setSetCohortModalOpen(false)}
              onAddNew={handleCohortAddNew}
              pendingCreatedKey={pendingCreatedCohortKey}
            />
            <BulkSetSelectModal
              open={setYearGroupModalOpen}
              title="Set year group"
              fieldLabel="Year group"
              options={yearGroupOptions}
              confirmLoading={setYearGroupSubmitting}
              onConfirm={handleSetYearGroup}
              onCancel={() => setSetYearGroupModalOpen(false)}
              onAddNew={handleYearGroupAddNew}
              pendingCreatedKey={pendingCreatedYearGroupKey}
            />
            <BulkSetCourseLengthModal
              open={setCourseLengthModalOpen}
              confirmLoading={setCourseLengthSubmitting}
              onConfirm={handleSetCourseLength}
              onCancel={() => setSetCourseLengthModalOpen(false)}
            />
            <ManageCohortsModal
              open={manageCohortsModalOpen}
              onClose={() => setManageCohortsModalOpen(false)}
              onEntityCreated={handleCohortEntityCreated}
            />
            <ManageYearGroupsModal
              open={manageYearGroupsModalOpen}
              onClose={() => setManageYearGroupsModalOpen(false)}
              onEntityCreated={handleYearGroupEntityCreated}
            />
          </Flex>
        ) : null}
      </Card>
    </section>
  );
}

