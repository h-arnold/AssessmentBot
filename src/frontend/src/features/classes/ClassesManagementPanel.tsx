import { Card, Flex, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { APP_GAP_COMPACT } from '../../theme/spacing';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryKeys';
import { type RequiredClassPartialsRefreshOutcome } from './bulk/queryInvalidation';
import { runMutationWithRequiredClassPartialsRefresh } from './bulk/queryInvalidation';
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
import { runQueuedBatchMutation, type QueuedBatchItem, type BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';
import type { RowMutationResult } from './bulk/batchMutationEngine';
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
import { useClassesManagement } from './useClassesManagement';
import { useClassesBulkMutationQueue } from './useClassesBulkMutationQueue';
import { ClassesBulkProgressModal } from './bulk/ClassesBulkProgressModal';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Accessible label for the panel-owned classes management region.
 */
export const classesManagementPanelRegionLabel = 'Classes management panel';

/**
 * Renders the Classes feature entry shell.
 *
 * Wires bulk-action handlers via the queued bulk-mutation engine and
 * the `useClassesBulkMutationQueue` hook. Input modals close synchronously
 * before the progress modal opens to avoid two modals stacking.
 *
 * @returns {JSX.Element} The Classes feature panel shell.
 */
export function ClassesManagementPanel() {
  const classesManagement = useClassesManagement();
  const queryClient = useQueryClient();
  const queue = useClassesBulkMutationQueue();
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
  // Cohort, year-group, and course-length mutations keep submitting false
  // because they use the queued engine, which owns its own loading state.
  const [bulkActionOutcomeAlert, setBulkActionOutcomeAlert] = useState<BulkActionOutcomeAlert | null>(null);
  const [refreshRequiredMessage, setRefreshRequiredMessage] = useState<string | null>(null);
  const [suppressStaleTableData, setSuppressStaleTableData] = useState(false);
  const [pendingCreatedCohortKey, setPendingCreatedCohortKey] = useState<string | undefined>();
  const [pendingCreatedYearGroupKey, setPendingCreatedYearGroupKey] = useState<string | undefined>();
  const [currentBulkActionVerb, setCurrentBulkActionVerb] = useState<string>('');

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
    setCohortSubmitting: false,
    setCourseLengthSubmitting: false,
    setInactiveSubmitting,
    setYearGroupSubmitting: false,
  }) || queue.isQueueActive || classesManagement.isRefreshing;

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
   * Runs one top-level bulk action through the queued bulk action boundary.
   *
   * Closes the input/confirmation modal synchronously before enqueuing to
   * prevent two modals stacking.
   *
   * @param {TopLevelBulkActionDescriptor} options Top-level action descriptor.
   * @returns {Promise<void>} Completion signal.
   */
  async function runTopLevelBulkAction(options: TopLevelBulkActionDescriptor): Promise<void> {
    // Close the input/confirmation modal FIRST
    options.closeSurface?.();
    setCurrentBulkActionVerb(options.verb);

    await queue.runQueuedBulkAction({
      mutate: (onProgress) => options.mutateRows(selectedRows, onProgress),
      onComplete: async (results) => {
        try {
          clearBulkActionFeedback();
          const outcome = await runMutationWithRequiredClassPartialsRefresh({
            mutate: () => Promise.resolve(results),
            queryClient,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials(), refetchType: 'none' });
          await handleTopLevelBulkMutationResult(outcome, options);
        } finally {
          setCurrentBulkActionVerb('');
        }
      },
    });
  }

  const topLevelBulkActionDescriptors = {
    delete: {
      createFailureMessage: createBulkDeleteFailureMessage,
      fullFailureTitle: 'Could not delete selected classes.',
      partialFailureTitle: 'Some selected classes were not deleted.',
      closeSurface: () => setDeleteModalOpen(false),
      mutateRows: (rows: ClassesManagementRow[], onProgress?: (snapshot: BatchProgressSnapshot) => void) => {
        const items: QueuedBatchItem[] = rows.map((row) => ({
          row,
          method: 'deleteABClass' as const,
          parameters: { classId: row.classId },
          verb: 'Deleting',
          className: row.className,
        }));
        return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
      },
      setSubmitting: setDeleteSubmitting,
      verb: 'Deleting',
    },
    setActive: {
      createFailureMessage: createBulkSetActiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to active.',
      partialFailureTitle: 'Some selected classes were not set to active.',
      mutateRows: (rows: ClassesManagementRow[], onProgress?: (snapshot: BatchProgressSnapshot) => void) => {
        const eligibleRows = filterEligibleForActiveState(rows, true);
        const items: QueuedBatchItem[] = eligibleRows.map((row) => ({
          row,
          method: 'updateABClass' as const,
          parameters: { classId: row.classId, active: true },
          verb: 'Activating',
          className: row.className,
        }));
        return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
      },
      setSubmitting: setSetActiveSubmitting,
      verb: 'Activating',
    },
    setInactive: {
      createFailureMessage: createBulkSetInactiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to inactive.',
      partialFailureTitle: 'Some selected classes were not set to inactive.',
      mutateRows: (rows: ClassesManagementRow[], onProgress?: (snapshot: BatchProgressSnapshot) => void) => {
        const eligibleRows = filterEligibleForActiveState(rows, false);
        const items: QueuedBatchItem[] = eligibleRows.map((row) => ({
          row,
          method: 'updateABClass' as const,
          parameters: { classId: row.classId, active: false },
          verb: 'Deactivating',
          className: row.className,
        }));
        return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
      },
      setSubmitting: setSetInactiveSubmitting,
      verb: 'Deactivating',
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
      mutateRows: (rows: ClassesManagementRow[], onProgress?: (snapshot: BatchProgressSnapshot) => void) =>
        bulkCreate(filterBulkCreateRows(rows), options, onProgress),
      setSubmitting: setCreateSubmitting,
      verb: 'Creating',
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
   * Calls deleteABClass for each selected row through the queued bulk-mutation engine.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    await runTopLevelBulkActionByKey('delete');
  }

  /**
   * Calls upsertABClass for each selected notCreated row through the queued
   * bulk-mutation engine.
   *
   * @param {BulkCreateOptions} options Cohort/year-group/course-length selection.
   * @returns {Promise<void>} Resolves when all create calls have settled.
   */
  async function handleBulkCreate(options: BulkCreateOptions): Promise<void> {
    await runTopLevelBulkAction(getCreateTopLevelBulkActionDescriptor(options));
  }

  /**
   * Calls updateABClass with active: true for each eligible selected row through
   * the queued bulk-mutation engine.
   *
   * @returns {Promise<void>} Resolves when all activations have settled.
   */
  async function handleSetActive() {
    await runTopLevelBulkActionByKey('setActive');
  }

  /**
   * Calls updateABClass with active: false for each eligible selected row through
   * the queued bulk-mutation engine.
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
  }

  /**
   * Runs one metadata modal action through the queued bulk action boundary.
   *
   * Closes the metadata modal synchronously before enqueuing to prevent
   * two modals stacking.
   *
   * @param {Readonly<{
   *   closeModal: () => void;
   *   mutate: (onProgress?: (snapshot: BatchProgressSnapshot) => void) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
   *   verb: string;
   * }>} options Metadata action descriptor.
   * @returns {Promise<void>} Completion signal.
   */
  async function runMetadataBulkAction(options: Readonly<{
    closeModal: () => void;
    mutate: (onProgress?: (snapshot: BatchProgressSnapshot) => void) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    verb: string;
  }>): Promise<void> {
    // Close the metadata modal FIRST
    options.closeModal();
    setCurrentBulkActionVerb(options.verb);

    await queue.runQueuedBulkAction({
      mutate: (onProgress) => options.mutate(onProgress),
      onComplete: async (results) => {
        try {
          clearBulkActionFeedback();
          const outcome = await runMutationWithRequiredClassPartialsRefresh({
            mutate: () => Promise.resolve(results),
            queryClient,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials(), refetchType: 'none' });
          await handleBulkMetadataMutationResult(outcome, options.closeModal);
        } finally {
          setCurrentBulkActionVerb('');
        }
      },
    });
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
      mutate: (onProgress) => bulkSetCohort(filterEligibleForBulkMetadataUpdate(selectedRows), cohortKey, onProgress),
      verb: 'Setting cohort for',
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
      mutate: (onProgress) => bulkSetYearGroup(filterEligibleForBulkMetadataUpdate(selectedRows), yearGroupKey, onProgress),
      verb: 'Setting year group for',
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
      mutate: (onProgress) => bulkSetCourseLength(filterEligibleForBulkMetadataUpdate(selectedRows), courseLength, onProgress),
      verb: 'Setting course length for',
    });
  }

  /**
   * Renders the classes workflow content (summary, toolbar, table, modals, progress).
   *
   * @returns {JSX.Element | null} The workflow content or null when suppressed.
   */
  function renderClassesWorkflowContent() {
    if (shouldSuppressStaleTableData) {
      return null;
    }

    return (
      <Flex vertical gap={APP_GAP_COMPACT}>
        <section aria-label="Classes data workflow" aria-busy={getClassesWorkflowBusyState(classesManagement.isRefreshing)}>
          <Flex vertical gap={APP_GAP_COMPACT}>
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
          confirmLoading={false}
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
          confirmLoading={false}
          onConfirm={handleSetYearGroup}
          onCancel={() => setSetYearGroupModalOpen(false)}
          onAddNew={handleYearGroupAddNew}
          pendingCreatedKey={pendingCreatedYearGroupKey}
        />
        <BulkSetCourseLengthModal
          open={setCourseLengthModalOpen}
          confirmLoading={false}
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
        <ClassesBulkProgressModal
          open={queue.isProgressModalOpen}
          progress={queue.progress}
          verb={currentBulkActionVerb}
          onCancel={queue.onCancelQueue}
          onDismiss={queue.onDismissProgressModal}
        />
      </Flex>
    );
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
        {renderClassesWorkflowContent()}
      </Card>
    </section>
  );
}
