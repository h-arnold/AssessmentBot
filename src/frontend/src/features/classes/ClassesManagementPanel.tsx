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
import { bulkSetCohort, getActiveCohortOptions } from './bulkSetCohortFlow';
import { bulkSetCourseLength } from './bulkSetCourseLengthFlow';
import { bulkSetYearGroup, getYearGroupOptions } from './bulkSetYearGroupFlow';
import { bulkCreate, filterBulkCreateRows, type BulkCreateOptions } from './bulkCreateFlow';
import { filterEligibleForBulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import { filterEligibleForActiveState } from './bulkActiveStateFlow';
import {
  runBatchMutation,
  type RejectedRowResult,
  type RowMutationResult,
} from './batchMutationEngine';
import { useClassesManagement } from './useClassesManagement';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Accessible label for the panel-owned classes management region.
 */
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
    <output aria-label="Loading classes">
      <Flex vertical gap={12}>
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '35%' }} />
        <Flex gap={8} wrap>
          <Skeleton.Button active />
          <Skeleton.Button active />
          <Skeleton.Button active />
        </Flex>
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: '20%' }} />
      </Flex>
    </output>
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
 * Returns whether stale rows should be hidden until classes are refreshed.
 *
 * @param {boolean} suppressStaleTableData Local suppress flag from mutation outcomes.
 * @param {string | null} refreshRequiredMessage Refresh-required message from the hook.
 * @returns {boolean} True when stale rows should stay hidden.
 */
function shouldSuppressClassesTableData(
  suppressStaleTableData: boolean,
  refreshRequiredMessage: string | null,
): boolean {
  return suppressStaleTableData || refreshRequiredMessage !== null;
}

/**
 * Returns the panel-level aria-busy token for the classes workflow region.
 *
 * @param {boolean} isRefreshing Whether the classes workflow is currently refreshing.
 * @returns {'true' | undefined} Busy token for aria-busy.
 */
function getClassesWorkflowBusyState(isRefreshing: boolean): 'true' | undefined {
  return isRefreshing ? 'true' : undefined;
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
   * @param {Readonly<{
   *   createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
   *   fullFailureTitle: string;
   *   partialFailureTitle: string;
   *   closeSurface?: () => void;
   *   mutate: () => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
   *   setSubmitting: (value: boolean) => void;
   * }>} options Top-level action descriptor.
   * @returns {Promise<void>} Completion signal.
   */
  async function runTopLevelBulkAction(options: Readonly<{
    createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) => string;
    fullFailureTitle: string;
    partialFailureTitle: string;
    closeSurface?: () => void;
    mutate: () => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    setSubmitting: (value: boolean) => void;
  }>): Promise<void> {
    await runPanelBulkMutation({
      handleOutcome: (outcome) => handleTopLevelBulkMutationResult(outcome, options),
      mutate: options.mutate,
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

  /**
   * Calls deleteABClass for each selected row through the shared bulk-mutation
   * orchestration helper.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    await runTopLevelBulkAction({
      createFailureMessage: createBulkDeleteFailureMessage,
      fullFailureTitle: 'Could not delete selected classes.',
      partialFailureTitle: 'Some selected classes were not deleted.',
      closeSurface: () => setDeleteModalOpen(false),
      mutate: () => runBatchMutation(selectedRows, (row) => callApi('deleteABClass', { classId: row.classId })),
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
    await runTopLevelBulkAction({
      createFailureMessage: createBulkCreateFailureMessage,
      fullFailureTitle: 'Could not create selected classes.',
      partialFailureTitle: 'Some selected classes were not created.',
      closeSurface: () => setCreateModalOpen(false),
      mutate: () => bulkCreate(filterBulkCreateRows(selectedRows), options),
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

    await runTopLevelBulkAction({
      createFailureMessage: createBulkSetActiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to active.',
      partialFailureTitle: 'Some selected classes were not set to active.',
      mutate: () => runBatchMutation(eligible, (row) => callApi('updateABClass', { classId: row.classId, active: true })),
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

    await runTopLevelBulkAction({
      createFailureMessage: createBulkSetInactiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to inactive.',
      partialFailureTitle: 'Some selected classes were not set to inactive.',
      mutate: () => runBatchMutation(eligible, (row) => callApi('updateABClass', { classId: row.classId, active: false })),
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
            />
            <BulkSetSelectModal
              open={setYearGroupModalOpen}
              title="Set year group"
              fieldLabel="Year group"
              options={yearGroupOptions}
              confirmLoading={setYearGroupSubmitting}
              onConfirm={handleSetYearGroup}
              onCancel={() => setSetYearGroupModalOpen(false)}
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
            />
            <ManageYearGroupsModal
              open={manageYearGroupsModalOpen}
              onClose={() => setManageYearGroupsModalOpen(false)}
            />
          </Flex>
        ) : null}
      </Card>
    </section>
  );
}

