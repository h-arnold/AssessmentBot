import { Alert, Card, Flex, Skeleton, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { callApi } from '../../services/apiService';
import { mapRequiredClassPartialsRefreshFailureToUserMessage, type RequiredClassPartialsRefreshOutcome } from './queryInvalidation';
import { runBulkMutationOrchestration } from './bulkMutationOrchestration';
import { ClassesAlertStack } from './ClassesAlertStack';
import { ClassesSummaryCard } from './ClassesSummaryCard';
import { ClassesTable } from './ClassesTable';
import { ClassesToolbar } from './ClassesToolbar';
import { BulkCreateModal } from './BulkCreateModal';
import { BulkDeleteModal } from './BulkDeleteModal';
import { BulkSetCourseLengthModal } from './BulkSetCourseLengthModal';
import { BulkSetSelectModal } from './BulkSetSelectModal';
import { ManageCohortsModal } from './ManageCohortsModal';
import { ManageYearGroupsModal } from './ManageYearGroupsModal';
import {
  bulkSetCohort,
  filterEligibleForBulkSetCohort,
  getActiveCohortOptions,
} from './bulkSetCohortFlow';
import {
  bulkSetCourseLength,
  filterEligibleForBulkSetCourseLength,
} from './bulkSetCourseLengthFlow';
import {
  bulkSetYearGroup,
  filterEligibleForBulkSetYearGroup,
  getYearGroupOptions,
} from './bulkSetYearGroupFlow';
import { bulkCreate, filterBulkCreateRows, type BulkCreateOptions } from './bulkCreateFlow';
import { filterEligibleForActiveState } from './bulkActiveStateFlow';
import {
  runBatchMutation,
  type RejectedRowResult,
  type RowMutationResult,
} from './batchMutationEngine';
import { useClassesManagement } from './useClassesManagement';
import type { ClassesManagementState } from './useClassesManagement';
import type { ClassesManagementRow } from './classesManagementViewModel';

export const classesManagementPanelRegionLabel = 'Classes management panel';

/**
 * Returns the rejected row results from a settled batch.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassesManagementRow, TData>[]} results Settled batch results.
 * @returns {RejectedRowResult<ClassesManagementRow>[]} Rejected row results only.
 */
function getRejectedRowResults<TData>(
  results: RowMutationResult<ClassesManagementRow, TData>[],
): RejectedRowResult<ClassesManagementRow>[] {
  return results.filter(
    (result): result is RejectedRowResult<ClassesManagementRow> => result.status === 'rejected',
  );
}

/**
 * Determines whether any mutation result fulfilled.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassesManagementRow, TData>[]} results Settled batch results.
 * @returns {boolean} True when at least one result fulfilled.
 */
function hasAnyFulfilledRowResult<TData>(results: RowMutationResult<ClassesManagementRow, TData>[]): boolean {
  return results.some((result) => result.status === 'fulfilled');
}

type BulkActionOutcomeAlert = Readonly<{
  description: string;
  title: string;
  type: 'error' | 'warning';
}>;

type BulkFailureMessageCopy = Readonly<{
  allFailure: (totalCount: number) => string;
  partialFailure: (failedCount: number, totalCount: number) => string;
  partialRefreshFailure: (failedCount: number, totalCount: number) => string;
  singleFailure: string;
}>;

/**
 * Chooses the alert title for a bulk outcome.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {string} fullFailureTitle Full-failure title.
 * @param {string} partialFailureTitle Partial-failure title.
 * @returns {string} Selected alert title.
 */
function getBulkOutcomeTitle(
  failedCount: number,
  totalCount: number,
  fullFailureTitle: string,
  partialFailureTitle: string,
): string {
  if (failedCount === totalCount) {
    return fullFailureTitle;
  }

  return partialFailureTitle;
}

type TopLevelBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseSurface: boolean;
  suppressStaleTableData: boolean;
}>;

type MetadataBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  errorMessage: string | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseModal: boolean;
  suppressStaleTableData: boolean;
}>;

/**
 * Resolves the UI outcome for a top-level bulk mutation.
 *
 * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
 *   Settled batch results and refresh outcome.
 * @param {Readonly<{
 *   createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
 *   fullFailureTitle: string;
 *   partialFailureTitle: string;
 * }>} options Action-specific copy.
 * @returns {TopLevelBulkMutationResolution} Derived UI state.
 */
function buildTopLevelBulkMutationResolution(
  outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
  options: Readonly<{
    createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
    fullFailureTitle: string;
    partialFailureTitle: string;
  }>,
): TopLevelBulkMutationResolution {
  const rejectedResults = getRejectedRowResults(outcome.mutationResult);
  const hasAnyFulfilledResults = hasAnyFulfilledRowResult(outcome.mutationResult);
  const hasRefreshFailure = hasAnyFulfilledResults && outcome.refreshStatus === 'failed';
  const refreshRequiredMessage = hasRefreshFailure
    ? mapRequiredClassPartialsRefreshFailureToUserMessage(outcome.refreshError)
    : null;

  if (rejectedResults.length === 0) {
    return {
      alert: null,
      refreshRequiredMessage,
      selectedRowKeys: [],
      shouldCloseSurface: true,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  const failedCount = rejectedResults.length;

  return {
    alert: {
      description: options.createFailureMessage(failedCount, outcome.mutationResult.length, hasRefreshFailure),
      title: getBulkOutcomeTitle(
        failedCount,
        outcome.mutationResult.length,
        options.fullFailureTitle,
        options.partialFailureTitle,
      ),
      type: failedCount === outcome.mutationResult.length ? 'error' : 'warning',
    },
    refreshRequiredMessage,
    selectedRowKeys: rejectedResults.map((result) => result.row.classId),
    shouldCloseSurface: true,
    suppressStaleTableData: hasRefreshFailure,
  };
}

/**
 * Resolves the UI outcome for a bulk metadata mutation.
 *
 * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
 *   Settled batch results and refresh outcome.
 * @returns {MetadataBulkMutationResolution} Derived UI state.
 */
function buildMetadataBulkMutationResolution(
  outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
): MetadataBulkMutationResolution {
  const rejectedResults = getRejectedRowResults(outcome.mutationResult);
  const hasAnyFulfilledResults = hasAnyFulfilledRowResult(outcome.mutationResult);
  const hasRefreshFailure = hasAnyFulfilledResults && outcome.refreshStatus === 'failed';
  const refreshRequiredMessage = hasRefreshFailure
    ? mapRequiredClassPartialsRefreshFailureToUserMessage(outcome.refreshError)
    : null;

  if (rejectedResults.length === 0) {
    return {
      alert: null,
      errorMessage: null,
      refreshRequiredMessage,
      selectedRowKeys: [],
      shouldCloseModal: true,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  const failedCount = rejectedResults.length;
  const selectedRowKeys = rejectedResults.map((result) => result.row.classId);

  if (failedCount === outcome.mutationResult.length) {
    return {
      alert: null,
      errorMessage: createBulkMetadataFailureMessage(failedCount, outcome.mutationResult.length, hasRefreshFailure),
      refreshRequiredMessage,
      selectedRowKeys,
      shouldCloseModal: false,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  return {
    alert: {
      description: createBulkMetadataFailureMessage(failedCount, outcome.mutationResult.length, hasRefreshFailure),
      title: 'Some selected classes were not updated.',
      type: 'warning',
    },
    errorMessage: null,
    refreshRequiredMessage,
    selectedRowKeys,
    shouldCloseModal: true,
    suppressStaleTableData: hasRefreshFailure,
  };
}


/**
 * Builds user-facing failure copy for a bulk action.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @param {BulkFailureMessageCopy} copy Action-specific failure copy.
 * @returns {string} User-facing failure copy.
 */
function createBulkFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
  copy: BulkFailureMessageCopy,
): string {
  if (failedCount === totalCount) {
    return totalCount === 1 ? copy.singleFailure : copy.allFailure(totalCount);
  }

  if (hasRefreshFailure) {
    return copy.partialRefreshFailure(failedCount, totalCount);
  }

  return copy.partialFailure(failedCount, totalCount);
}

/**
 * Builds user-facing inline error copy for bulk metadata failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @returns {string} User-facing failure copy.
 */
function createBulkMetadataFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure: 'Unable to update the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to update any of the ' + attemptedRowCount + ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be updated. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be updated. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}

/**
 * Builds user-facing failure copy for bulk-create failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @returns {string} User-facing failure copy.
 */
function createBulkCreateFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure: 'Unable to create the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to create any of the ' + attemptedRowCount + ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be created. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be created. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}

/**
 * Builds user-facing failure copy for bulk delete failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @returns {string} User-facing failure copy.
 */
function createBulkDeleteFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure: 'Unable to delete the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to delete any of the ' + attemptedRowCount + ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be deleted. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}

/**
 * Builds user-facing failure copy for bulk activation failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @returns {string} User-facing failure copy.
 */
function createBulkSetActiveFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure: 'Unable to set the selected class to active. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' + attemptedRowCount + ' selected classes to active. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to active. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}

/**
 * Builds user-facing failure copy for bulk deactivation failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @returns {string} User-facing failure copy.
 */
function createBulkSetInactiveFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure: 'Unable to set the selected class to inactive. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' + attemptedRowCount + ' selected classes to inactive. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to inactive. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to inactive. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}

/**
 * Renders a bulk-action outcome alert banner.
 *
 * @param {Readonly<{ alert: BulkActionOutcomeAlert | null }>} properties Alert state.
 * @returns {JSX.Element | null} Alert banner when available.
 */
function ClassesManagementPanelOutcomeAlert(properties: Readonly<{ alert: BulkActionOutcomeAlert | null }>) {
  if (properties.alert === null) {
    return null;
  }

  return (
    <Alert
      type={properties.alert.type}
      showIcon
      title={properties.alert.title}
      description={properties.alert.description}
      style={{ marginBottom: 16 }}
    />
  );
}

/**
 * Renders the initial blocking-load treatment for the classes panel.
 *
 * @returns {JSX.Element} Loading skeleton for the panel-owned content.
 */
function ClassesManagementPanelLoadingState() {
  return (
    <div aria-label="Loading classes" role="status">
      <Flex vertical gap={12}>
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '35%' }} />
        <Flex gap={8} wrap>
          <Skeleton.Button active />
          <Skeleton.Button active />
          <Skeleton.Button active />
        </Flex>
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: '20%' }} />
      </Flex>
    </div>
  );
}

type ClassesWorkflowMutationBoundaryState = Readonly<{
  createSubmitting: boolean;
  deleteSubmitting: boolean;
  setActiveSubmitting: boolean;
  setCohortSubmitting: boolean;
  setCourseLengthSubmitting: boolean;
  setInactiveSubmitting: boolean;
  setYearGroupSubmitting: boolean;
}>;

/**
 * Returns whether the classes data-workflow write boundary is currently active.
 *
 * @param {ClassesWorkflowMutationBoundaryState} state Mutation submission state.
 * @returns {boolean} True when conflicting workflow writes should stay disabled.
 */
function isClassesWorkflowMutationBoundaryActive(state: ClassesWorkflowMutationBoundaryState): boolean {
  return [
    state.createSubmitting,
    state.deleteSubmitting,
    state.setActiveSubmitting,
    state.setInactiveSubmitting,
    state.setCohortSubmitting,
    state.setYearGroupSubmitting,
    state.setCourseLengthSubmitting,
  ].some(Boolean);
}

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
  const shouldSuppressStaleTableData = suppressStaleTableData || classesManagement.refreshRequiredMessage !== null;
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

  /**
   * Resolves post-mutation UI state for a top-level bulk action.
   *
   * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
   *   Settled batch results and refresh outcome.
   * @param {Readonly<{
   *   createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
   *   fullFailureTitle: string;
   *   partialFailureTitle: string;
   *   closeSurface?: () => void;
   * }>} options Action-specific UI copy and close handler.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleTopLevelBulkMutationResult(
    outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
    options: Readonly<{
      createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
      fullFailureTitle: string;
      partialFailureTitle: string;
      closeSurface?: () => void;
    }>,
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
   * Calls deleteABClass for each selected row through the shared bulk-mutation
   * orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, {
        createFailureMessage: createBulkDeleteFailureMessage,
        fullFailureTitle: 'Could not delete selected classes.',
        partialFailureTitle: 'Some selected classes were not deleted.',
        closeSurface: () => setDeleteModalOpen(false),
      }),
      mutate: () => runBatchMutation(selectedRows, (row) =>
        callApi('deleteABClass', { classId: row.classId }),
      ),
      queryClient,
      setSubmitting: setDeleteSubmitting,
    });
  }

  /**
   * Calls upsertABClass for each selected notCreated row through the shared
   * bulk-mutation orchestration helper.
   *
   * @param {BulkCreateOptions} options Cohort/year-group/course-length selection.
   * @returns {Promise<void>} Resolves when all create calls have settled.
   */
  async function handleBulkCreate(options: BulkCreateOptions): Promise<void> {
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, {
        createFailureMessage: createBulkCreateFailureMessage,
        fullFailureTitle: 'Could not create selected classes.',
        partialFailureTitle: 'Some selected classes were not created.',
        closeSurface: () => setCreateModalOpen(false),
      }),
      mutate: () => bulkCreate(filterBulkCreateRows(selectedRows), options),
      queryClient,
      setSubmitting: setCreateSubmitting,
    });
  }

  /**
   * Calls updateABClass with active: true for each eligible selected row through
   * the shared bulk-mutation orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all activations have settled.
   */
  async function handleSetActive() {
    const eligible = filterEligibleForActiveState(selectedRows, true);

    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, {
        createFailureMessage: createBulkSetActiveFailureMessage,
        fullFailureTitle: 'Could not set selected classes to active.',
        partialFailureTitle: 'Some selected classes were not set to active.',
      }),
      mutate: () => runBatchMutation(eligible, (row) =>
        callApi('updateABClass', { classId: row.classId, active: true }),
      ),
      queryClient,
      setSubmitting: setSetActiveSubmitting,
    });
  }

  /**
   * Calls updateABClass with active: false for each eligible selected row through
   * the shared bulk-mutation orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all deactivations have settled.
   */
  async function handleSetInactive() {
    const eligible = filterEligibleForActiveState(selectedRows, false);

    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, {
        createFailureMessage: createBulkSetInactiveFailureMessage,
        fullFailureTitle: 'Could not set selected classes to inactive.',
        partialFailureTitle: 'Some selected classes were not set to inactive.',
      }),
      mutate: () => runBatchMutation(eligible, (row) =>
        callApi('updateABClass', { classId: row.classId, active: false }),
      ),
      queryClient,
      setSubmitting: setSetInactiveSubmitting,
    });
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
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleBulkMetadataMutationResult(outcome, () => setSetCohortModalOpen(false)),
      mutate: () => bulkSetCohort(
        filterEligibleForBulkSetCohort(selectedRows),
        cohortKey,
      ),
      queryClient,
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
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleBulkMetadataMutationResult(outcome, () => setSetYearGroupModalOpen(false)),
      mutate: () => bulkSetYearGroup(
        filterEligibleForBulkSetYearGroup(selectedRows),
        yearGroupKey,
      ),
      queryClient,
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
    await runBulkMutationOrchestration({
      clearFeedback: clearBulkActionFeedback,
      handleOutcome: (outcome) => handleBulkMetadataMutationResult(outcome, () => setSetCourseLengthModalOpen(false)),
      mutate: () => bulkSetCourseLength(
        filterEligibleForBulkSetCourseLength(selectedRows),
        courseLength,
      ),
      queryClient,
      setSubmitting: setSetCourseLengthSubmitting,
    });
  }

  return renderClassesManagementPanelContent({
    bulkActionOutcomeAlert,
    classesManagement,
    cohortOptions,
    createModalOpen,
    createSubmitting,
    deleteModalOpen,
    deleteSubmitting,
    effectiveRefreshRequiredMessage,
    handleBulkCreate,
    handleDeleteConfirm,
    handleSetActive,
    handleSetCohort,
    handleSetCourseLength,
    handleSetInactive,
    handleSetYearGroup,
    manageCohortsModalOpen,
    manageYearGroupsModalOpen,
    onBulkCreateCancel: () => setCreateModalOpen(false),
    onBulkCreateOpen: () => setCreateModalOpen(true),
    onBulkDeleteOpen: () => setDeleteModalOpen(true),
    onDeleteCancel: () => setDeleteModalOpen(false),
    onManageCohortsClose: () => setManageCohortsModalOpen(false),
    onManageCohortsOpen: () => setManageCohortsModalOpen(true),
    onManageYearGroupsClose: () => setManageYearGroupsModalOpen(false),
    onManageYearGroupsOpen: () => setManageYearGroupsModalOpen(true),
    onSetCohortCancel: () => setSetCohortModalOpen(false),
    onSetCohortOpen: () => setSetCohortModalOpen(true),
    onSetCourseLengthCancel: () => setSetCourseLengthModalOpen(false),
    onSetCourseLengthOpen: () => setSetCourseLengthModalOpen(true),
    onSetYearGroupCancel: () => setSetYearGroupModalOpen(false),
    onSetYearGroupOpen: () => setSetYearGroupModalOpen(true),
    selectedRows,
    setCohortModalOpen,
    setCohortSubmitting,
    setCourseLengthModalOpen,
    setCourseLengthSubmitting,
    setActiveSubmitting,
    setInactiveSubmitting,
    setYearGroupModalOpen,
    setYearGroupSubmitting,
    shouldSuppressStaleTableData,
    workflowMutationBoundaryActive,
    yearGroupOptions,
  });
}

/**
 * Renders the Classes management panel for the current state.
 *
 * @param {Readonly<object>} properties Panel properties.
 * @returns {JSX.Element} Panel content.
 */
function renderClassesManagementPanelContent(properties: Readonly<{
  bulkActionOutcomeAlert: BulkActionOutcomeAlert | null;
  classesManagement: ClassesManagementState;
  cohortOptions: ReturnType<typeof getActiveCohortOptions>;
  createModalOpen: boolean;
  createSubmitting: boolean;
  deleteModalOpen: boolean;
  deleteSubmitting: boolean;
  effectiveRefreshRequiredMessage: string | null;
  handleBulkCreate: (options: BulkCreateOptions) => Promise<void>;
  handleDeleteConfirm: () => void;
  handleSetActive: () => void;
  handleSetCohort: (cohortKey: string) => Promise<void>;
  handleSetCourseLength: (courseLength: number) => Promise<void>;
  handleSetInactive: () => void;
  handleSetYearGroup: (yearGroupKey: string) => Promise<void>;
  manageCohortsModalOpen: boolean;
  manageYearGroupsModalOpen: boolean;
  onBulkCreateCancel: () => void;
  onBulkCreateOpen: () => void;
  onBulkDeleteOpen: () => void;
  onDeleteCancel: () => void;
  onManageCohortsClose: () => void;
  onManageCohortsOpen: () => void;
  onManageYearGroupsClose: () => void;
  onManageYearGroupsOpen: () => void;
  onSetCohortCancel: () => void;
  onSetCohortOpen: () => void;
  onSetCourseLengthCancel: () => void;
  onSetCourseLengthOpen: () => void;
  onSetYearGroupCancel: () => void;
  onSetYearGroupOpen: () => void;
  selectedRows: ClassesManagementRow[];
  setCohortModalOpen: boolean;
  setCohortSubmitting: boolean;
  setCourseLengthModalOpen: boolean;
  setCourseLengthSubmitting: boolean;
  setActiveSubmitting: boolean;
  setInactiveSubmitting: boolean;
  setYearGroupModalOpen: boolean;
  setYearGroupSubmitting: boolean;
  shouldSuppressStaleTableData: boolean;
  workflowMutationBoundaryActive: boolean;
  yearGroupOptions: ReturnType<typeof getYearGroupOptions>;
}>) {
  if (properties.classesManagement.classesManagementViewState === 'loading') {
    return (
      <Card className="settings-tab-panel" role="region" aria-label={classesManagementPanelRegionLabel}>
        <ClassesManagementPanelLoadingState />
      </Card>
    );
  }

  if (properties.classesManagement.classesManagementViewState === 'error') {
    return (
      <Card className="settings-tab-panel" role="region" aria-label={classesManagementPanelRegionLabel}>
        <ClassesManagementPanelOutcomeAlert alert={properties.bulkActionOutcomeAlert} />
        <ClassesAlertStack
          blockingErrorMessage={properties.classesManagement.blockingErrorMessage}
          nonBlockingWarningMessage={properties.classesManagement.nonBlockingWarningMessage}
          refreshRequiredMessage={properties.effectiveRefreshRequiredMessage}
        />
        {properties.classesManagement.blockingErrorMessage === null ? (
          <Typography.Text>{properties.classesManagement.errorMessage}</Typography.Text>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="settings-tab-panel" role="region" aria-label={classesManagementPanelRegionLabel}>
      <ClassesManagementPanelOutcomeAlert alert={properties.bulkActionOutcomeAlert} />
      <ClassesAlertStack
        blockingErrorMessage={properties.classesManagement.blockingErrorMessage}
        nonBlockingWarningMessage={properties.classesManagement.nonBlockingWarningMessage}
        refreshRequiredMessage={properties.effectiveRefreshRequiredMessage}
      />
      {properties.shouldSuppressStaleTableData === false ? (
        <Flex vertical gap={12}>
          <div
            role="region"
            aria-label="Classes data workflow"
            aria-busy={properties.classesManagement.isRefreshing ? 'true' : undefined}
          >
            <Flex vertical gap={12}>
              <ClassesSummaryCard rows={properties.classesManagement.rows} selectedCount={properties.classesManagement.selectedRowKeys.length} />
              <ClassesToolbar
                rows={properties.classesManagement.rows}
                selectedRowKeys={properties.classesManagement.selectedRowKeys}
                onBulkCreate={properties.onBulkCreateOpen}
                onBulkDelete={properties.onBulkDeleteOpen}
                onSetActive={properties.handleSetActive}
                onSetInactive={properties.handleSetInactive}
                onSetCohort={properties.onSetCohortOpen}
                onSetYearGroup={properties.onSetYearGroupOpen}
                onSetCourseLength={properties.onSetCourseLengthOpen}
                onManageCohorts={properties.onManageCohortsOpen}
                onManageYearGroups={properties.onManageYearGroupsOpen}
                mutationInFlight={properties.workflowMutationBoundaryActive}
                setActiveLoading={properties.setActiveSubmitting}
                setInactiveLoading={properties.setInactiveSubmitting}
              />
              <ClassesTable
                rows={properties.classesManagement.rows}
                selectedRowKeys={properties.classesManagement.selectedRowKeys}
                onSelectedRowKeysChange={properties.classesManagement.onSelectedRowKeysChange}
                selectionFrozen={properties.workflowMutationBoundaryActive}
              />
            </Flex>
          </div>
          <BulkCreateModal
            open={properties.createModalOpen}
            cohortOptions={properties.cohortOptions}
            yearGroupOptions={properties.yearGroupOptions}
            confirmLoading={properties.createSubmitting}
            onConfirm={properties.handleBulkCreate}
            onCancel={properties.onBulkCreateCancel}
          />
          <BulkDeleteModal
            open={properties.deleteModalOpen}
            selectedRows={properties.selectedRows}
            onConfirm={properties.handleDeleteConfirm}
            onCancel={properties.onDeleteCancel}
            confirmLoading={properties.deleteSubmitting}
          />
          <BulkSetSelectModal
            open={properties.setCohortModalOpen}
            title="Set cohort"
            fieldLabel="Cohort"
            options={properties.cohortOptions}
            confirmLoading={properties.setCohortSubmitting}
            onConfirm={properties.handleSetCohort}
            onCancel={properties.onSetCohortCancel}
          />
          <BulkSetSelectModal
            open={properties.setYearGroupModalOpen}
            title="Set year group"
            fieldLabel="Year group"
            options={properties.yearGroupOptions}
            confirmLoading={properties.setYearGroupSubmitting}
            onConfirm={properties.handleSetYearGroup}
            onCancel={properties.onSetYearGroupCancel}
          />
          <BulkSetCourseLengthModal
            open={properties.setCourseLengthModalOpen}
            confirmLoading={properties.setCourseLengthSubmitting}
            onConfirm={properties.handleSetCourseLength}
            onCancel={properties.onSetCourseLengthCancel}
          />
          <ManageCohortsModal
            open={properties.manageCohortsModalOpen}
            onClose={properties.onManageCohortsClose}
          />
          <ManageYearGroupsModal
            open={properties.manageYearGroupsModalOpen}
            onClose={properties.onManageYearGroupsClose}
          />
        </Flex>
      ) : null}
    </Card>
  );
}
