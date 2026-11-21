import { Card, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/query/queryKeys';
import { type RequiredClassPartialsRefreshOutcome } from '../bulk/queryInvalidation';
import { runMutationWithRequiredClassPartialsRefresh } from '../bulk/queryInvalidation';
import {
  buildTopLevelBulkMutationResolution,
  buildMetadataBulkMutationResolution,
  type BulkActionOutcomeAlert,
  type TopLevelBulkActionDescriptor,
} from '../bulk/bulkMutationResolution';
import type { RowMutationResult } from '../bulk/batchMutationEngine';
import type { BatchProgressSnapshot } from '../bulk/runQueuedBatchMutation';
import { ClassesAlertStack } from '../components/ClassesAlertStack';
import { ClassesManagementPanelOutcomeAlert } from '../components/ClassesManagementPanelOutcomeAlert';
import { ClassesManagementPanelLoadingState } from '../components/ClassesManagementPanelLoadingState';
import {
  isClassesWorkflowMutationBoundaryActive,
  shouldSuppressClassesTableData,
} from '../components/classesManagementWorkflowBoundary';
import { getActiveCohortOptions, bulkSetCohort } from '../bulk/bulkSetCohortFlow';
import { bulkSetCourseLength } from '../bulk/bulkSetCourseLengthFlow';
import { getYearGroupOptions, bulkSetYearGroup } from '../bulk/bulkSetYearGroupFlow';
import { filterEligibleForBulkMetadataUpdate } from '../bulk/bulkMetadataUpdateFlow';
import type { BulkCreateOptions } from '../bulk/bulkCreateFlow';
import { useClassesManagement } from '../useClassesManagement';
import { useClassesBulkMutationQueue } from '../useClassesBulkMutationQueue';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import {
  createTopLevelBulkActionDescriptors,
  getCreateTopLevelBulkActionDescriptor,
  type TopLevelBulkActionKey,
} from './classesManagementBulkDescriptors';
import { ClassesManagementWorkflowContent } from './ClassesManagementWorkflowContent';
import { useClassesManagementAddNewWorkflow } from './useClassesManagementAddNewWorkflow';

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
  const addNewWorkflow = useClassesManagementAddNewWorkflow();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [setCohortModalOpen, setSetCohortModalOpen] = useState(false);
  const [setYearGroupModalOpen, setSetYearGroupModalOpen] = useState(false);
  const [setCourseLengthModalOpen, setSetCourseLengthModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [setActiveSubmitting, setSetActiveSubmitting] = useState(false);
  const [setInactiveSubmitting, setSetInactiveSubmitting] = useState(false);
  // Cohort, year-group, and course-length mutations keep submitting false
  // because they use the queued engine, which owns its own loading state.
  const [bulkActionOutcomeAlert, setBulkActionOutcomeAlert] =
    useState<BulkActionOutcomeAlert | null>(null);
  const [refreshRequiredMessage, setRefreshRequiredMessage] = useState<string | null>(null);
  const [suppressStaleTableData, setSuppressStaleTableData] = useState(false);
  const [currentBulkActionVerb, setCurrentBulkActionVerb] = useState<string>('');

  const selectedRows = useMemo(() => {
    return classesManagement.rows.filter((row) =>
      classesManagement.selectedRowKeys.includes(row.classId)
    );
  }, [classesManagement.rows, classesManagement.selectedRowKeys]);
  const cohortOptions = useMemo(
    () => getActiveCohortOptions(classesManagement.cohorts ?? []),
    [classesManagement.cohorts]
  );
  const yearGroupOptions = useMemo(
    () => getYearGroupOptions(classesManagement.yearGroups ?? []),
    [classesManagement.yearGroups]
  );

  const effectiveRefreshRequiredMessage =
    classesManagement.refreshRequiredMessage ?? refreshRequiredMessage;
  const shouldSuppressStaleTableData = shouldSuppressClassesTableData(
    suppressStaleTableData,
    classesManagement.refreshRequiredMessage
  );
  const isWorkflowMutationBoundaryActive =
    isClassesWorkflowMutationBoundaryActive({
      createSubmitting,
      deleteSubmitting,
      setActiveSubmitting,
      setCohortSubmitting: false,
      setCourseLengthSubmitting: false,
      setInactiveSubmitting,
      setYearGroupSubmitting: false,
    }) ||
    queue.isQueueActive ||
    classesManagement.isRefreshing;

  /**
   * Clears the transient bulk-action feedback before another mutation starts.
   *
   * @returns {void} No return value.
   */
  function clearBulkActionFeedback(): void {
    setBulkActionOutcomeAlert(null);
    setRefreshRequiredMessage(null);
  }

  /**
   * Resolves post-mutation UI state for a top-level bulk action.
   *
   * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
   *   Settled batch results and refresh outcome.
   * @param {TopLevelBulkActionDescriptor} options Action-specific UI copy and close handler.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleTopLevelBulkMutationResult(
    outcome: RequiredClassPartialsRefreshOutcome<
      RowMutationResult<ClassesManagementRow, unknown>[]
    >,
    options: TopLevelBulkActionDescriptor
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.classPartials(),
            refetchType: 'none',
          });
          await handleTopLevelBulkMutationResult(outcome, options);
        } finally {
          setCurrentBulkActionVerb('');
        }
      },
    });
  }

  const topLevelBulkActionDescriptors = createTopLevelBulkActionDescriptors({
    closeCreateSurface: () => setCreateModalOpen(false),
    closeDeleteSurface: () => setDeleteModalOpen(false),
    setCreateSubmitting,
    setDeleteSubmitting,
    setSetActiveSubmitting,
    setSetInactiveSubmitting,
  });

  /**
   * Runs one descriptor-driven top-level action.
   *
   * @param {TopLevelBulkActionKey} actionKey Descriptor key.
   * @returns {Promise<void>} Completion signal.
   */
  async function runTopLevelBulkActionByKey(actionKey: TopLevelBulkActionKey): Promise<void> {
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
    await runTopLevelBulkAction(
      getCreateTopLevelBulkActionDescriptor(options, {
        closeCreateSurface: () => setCreateModalOpen(false),
        setCreateSubmitting,
      })
    );
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
    outcome: RequiredClassPartialsRefreshOutcome<
      RowMutationResult<ClassesManagementRow, unknown>[]
    >,
    closeModal: () => void
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
  async function runMetadataBulkAction(
    options: Readonly<{
      closeModal: () => void;
      mutate: (
        onProgress?: (snapshot: BatchProgressSnapshot) => void
      ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
      verb: string;
    }>
  ): Promise<void> {
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.classPartials(),
            refetchType: 'none',
          });
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
      mutate: (onProgress) =>
        bulkSetCohort(filterEligibleForBulkMetadataUpdate(selectedRows), cohortKey, onProgress),
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
      mutate: (onProgress) => {
        return bulkSetYearGroup(
          filterEligibleForBulkMetadataUpdate(selectedRows),
          yearGroupKey,
          onProgress
        );
      },
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
      mutate: (onProgress) => {
        return bulkSetCourseLength(
          filterEligibleForBulkMetadataUpdate(selectedRows),
          courseLength,
          onProgress
        );
      },
      verb: 'Setting course length for',
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
        <ClassesManagementWorkflowContent
          shouldSuppressStaleTableData={shouldSuppressStaleTableData}
          data={{
            rows: classesManagement.rows,
            selectedRows,
            selectedRowKeys: classesManagement.selectedRowKeys,
            onSelectedRowKeysChange: classesManagement.onSelectedRowKeysChange,
            cohortOptions,
            yearGroupOptions,
            pendingCreatedCohortKey: addNewWorkflow.pendingCreatedCohortKey,
            pendingCreatedYearGroupKey: addNewWorkflow.pendingCreatedYearGroupKey,
          }}
          busy={{
            isRefreshing: classesManagement.isRefreshing,
            isMutationBoundaryActive: isWorkflowMutationBoundaryActive,
            createSubmitting,
            deleteSubmitting,
            setActiveSubmitting,
            setInactiveSubmitting,
          }}
          surfaces={{
            create: { isOpen: createModalOpen, setOpen: setCreateModalOpen },
            delete: { isOpen: deleteModalOpen, setOpen: setDeleteModalOpen },
            setCohort: { isOpen: setCohortModalOpen, setOpen: setSetCohortModalOpen },
            setYearGroup: { isOpen: setYearGroupModalOpen, setOpen: setSetYearGroupModalOpen },
            setCourseLength: {
              isOpen: setCourseLengthModalOpen,
              setOpen: setSetCourseLengthModalOpen,
            },
            manageCohorts: {
              isOpen: addNewWorkflow.manageCohortsModalOpen,
              setOpen: addNewWorkflow.setCohortManagerOpen,
            },
            manageYearGroups: {
              isOpen: addNewWorkflow.manageYearGroupsModalOpen,
              setOpen: addNewWorkflow.setYearGroupManagerOpen,
            },
          }}
          progress={{
            isProgressModalOpen: queue.isProgressModalOpen,
            progress: queue.progress,
            verb: currentBulkActionVerb,
            onCancelQueue: queue.onCancelQueue,
            onDismissProgressModal: queue.onDismissProgressModal,
          }}
          actions={{
            onBulkCreate: handleBulkCreate,
            onBulkDelete: handleDeleteConfirm,
            onSetActive: handleSetActive,
            onSetInactive: handleSetInactive,
            onSetCohort: handleSetCohort,
            onSetYearGroup: handleSetYearGroup,
            onSetCourseLength: handleSetCourseLength,
            onCohortAddNew: addNewWorkflow.onCohortAddNew,
            onYearGroupAddNew: addNewWorkflow.onYearGroupAddNew,
            onCohortEntityCreated: addNewWorkflow.onCohortEntityCreated,
            onYearGroupEntityCreated: addNewWorkflow.onYearGroupEntityCreated,
          }}
        />
      </Card>
    </section>
  );
}
