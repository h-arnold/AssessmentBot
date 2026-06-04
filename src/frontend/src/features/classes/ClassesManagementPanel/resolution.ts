import { createBulkMetadataFailureMessage } from './failureMessages';
import type {
  ClassesWorkflowMutationBoundaryState,
  MetadataBulkMutationResolution,
  TopLevelBulkMutationCopy,
  TopLevelBulkMutationResolution,
} from './types';
import {
  mapRequiredClassPartialsRefreshFailureToUserMessage,
  type RequiredClassPartialsRefreshOutcome,
} from '../queryInvalidation';
import type { RejectedRowResult, RowMutationResult } from '../batchMutationEngine';
import type { ClassesManagementRow } from '../classesManagementViewModel';

/**
 * Returns the rejected row results from a settled batch.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassesManagementRow, TData>[]} results Settled batch results.
 * @returns {RejectedRowResult<ClassesManagementRow>[]} Rejected row results only.
 */
function getRejectedRowResults<TData>(
  results: RowMutationResult<ClassesManagementRow, TData>[]
): RejectedRowResult<ClassesManagementRow>[] {
  return results.filter(
    (result): result is RejectedRowResult<ClassesManagementRow> => result.status === 'rejected'
  );
}

/**
 * Determines whether any mutation result fulfilled.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassesManagementRow, TData>[]} results Settled batch results.
 * @returns {boolean} True when at least one result fulfilled.
 */
function hasAnyFulfilledRowResult<TData>(
  results: RowMutationResult<ClassesManagementRow, TData>[]
): boolean {
  return results.some((result) => result.status === 'fulfilled');
}

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
  partialFailureTitle: string
): string {
  if (failedCount === totalCount) {
    return fullFailureTitle;
  }

  return partialFailureTitle;
}

/**
 * Resolves the UI outcome for a top-level bulk mutation.
 *
 * @param {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>} outcome
 *   Settled batch results and refresh outcome.
 * @param {TopLevelBulkMutationCopy} options Action-specific copy.
 * @returns {TopLevelBulkMutationResolution} Derived UI state.
 */
export function buildTopLevelBulkMutationResolution(
  outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>,
  options: TopLevelBulkMutationCopy
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
      description: options.createFailureMessage(
        failedCount,
        outcome.mutationResult.length,
        hasRefreshFailure
      ),
      title: getBulkOutcomeTitle(
        failedCount,
        outcome.mutationResult.length,
        options.fullFailureTitle,
        options.partialFailureTitle
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
export function buildMetadataBulkMutationResolution(
  outcome: RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>
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
      errorMessage: createBulkMetadataFailureMessage(
        failedCount,
        outcome.mutationResult.length,
        hasRefreshFailure
      ),
      refreshRequiredMessage,
      selectedRowKeys,
      shouldCloseModal: false,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  return {
    alert: {
      description: createBulkMetadataFailureMessage(
        failedCount,
        outcome.mutationResult.length,
        hasRefreshFailure
      ),
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
 * Returns whether stale rows should be hidden until classes are refreshed.
 *
 * @param {boolean} suppressStaleTableData Local suppress flag from mutation outcomes.
 * @param {string | null} refreshRequiredMessage Refresh-required message from the hook.
 * @returns {boolean} True when stale rows should stay hidden.
 */
export function shouldSuppressClassesTableData(
  suppressStaleTableData: boolean,
  refreshRequiredMessage: string | null
): boolean {
  return suppressStaleTableData || refreshRequiredMessage !== null;
}

/**
 * Returns the panel-level aria-busy token for the classes workflow region.
 *
 * @param {boolean} isRefreshing Whether the classes workflow is currently refreshing.
 * @returns {'true' | undefined} Busy token for aria-busy.
 */
export function getClassesWorkflowBusyState(isRefreshing: boolean): 'true' | undefined {
  return isRefreshing ? 'true' : undefined;
}

/**
 * Returns whether the classes data-workflow write boundary is currently active.
 *
 * @param {ClassesWorkflowMutationBoundaryState} state Mutation submission state.
 * @returns {boolean} True when conflicting workflow writes should stay disabled.
 */
export function isClassesWorkflowMutationBoundaryActive(
  state: ClassesWorkflowMutationBoundaryState
): boolean {
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
