import {
  mapRequiredClassPartialsRefreshFailureToUserMessage,
  type RequiredClassPartialsRefreshOutcome,
} from './queryInvalidation';
import type { RejectedRowResult, RowMutationResult } from './batchMutationEngine';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import type { ClassesManagementRow } from '../classesManagementViewModel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulkActionOutcomeAlert = Readonly<{
  description: string;
  title: string;
  type: 'error' | 'warning';
}>;

export type BulkFailureMessageCopy = Readonly<{
  allFailure: (totalCount: number) => string;
  partialFailure: (failedCount: number, totalCount: number) => string;
  partialRefreshFailure: (failedCount: number, totalCount: number) => string;
  singleFailure: string;
}>;

export type TopLevelBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseSurface: boolean;
  suppressStaleTableData: boolean;
}>;

export type MetadataBulkMutationResolution = Readonly<{
  alert: BulkActionOutcomeAlert | null;
  errorMessage: string | null;
  refreshRequiredMessage: string | null;
  selectedRowKeys: string[];
  shouldCloseModal: boolean;
  suppressStaleTableData: boolean;
}>;

export type TopLevelBulkMutationCopy = Readonly<{
  createFailureMessage: (
    failedCount: number,
    totalCount: number,
    hasRefreshFailure: boolean
  ) => string;
  fullFailureTitle: string;
  partialFailureTitle: string;
}>;

export type TopLevelBulkActionDescriptor = TopLevelBulkMutationCopy &
  Readonly<{
    closeSurface?: () => void;
    mutateRows: (
      rows: ClassesManagementRow[],
      onProgress?: (snapshot: BatchProgressSnapshot) => void
    ) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;
    setSubmitting: (value: boolean) => void;
    verb: string;
  }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the rejected row results from a settled batch.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassesManagementRow, TData>[]} results Settled batch results.
 * @returns {RejectedRowResult<ClassesManagementRow>[]} Rejected row results only.
 */
export function getRejectedRowResults<TData>(
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
export function hasAnyFulfilledRowResult<TData>(
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
export function getBulkOutcomeTitle(
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

// ---------------------------------------------------------------------------
// Cancellation helpers
// ---------------------------------------------------------------------------

/**
 * Returns the rejected row results whose error carries a CANCELLED reason.
 *
 * @param {RejectedRowResult<ClassesManagementRow>[]} rejectedResults
 *   Rejected row results from a batch.
 * @returns {RejectedRowResult<ClassesManagementRow>[]} Cancelled row results only.
 */
function getCancelledRowResults(
  rejectedResults: RejectedRowResult<ClassesManagementRow>[]
): RejectedRowResult<ClassesManagementRow>[] {
  return rejectedResults.filter(
    (result) =>
      result.error &&
      typeof result.error === 'object' &&
      (result.error as { reason?: string }).reason === 'CANCELLED'
  );
}

/**
 * Builds a cancellation suffix for alert descriptions.
 *
 * @param {number} cancelledCount Number of cancelled rows.
 * @returns {string} Cancellation message suffix.
 */
function createCancellationSuffix(cancelledCount: number): string {
  return cancelledCount === 1
    ? ' 1 class was cancelled before processing.'
    : ` ${cancelledCount} classes were cancelled before processing.`;
}

// ---------------------------------------------------------------------------
// Resolution builders
// ---------------------------------------------------------------------------

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
  const cancelledResults = getCancelledRowResults(rejectedResults);
  const cancelledCount = cancelledResults.length;

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
  const description = options.createFailureMessage(
    failedCount,
    outcome.mutationResult.length,
    hasRefreshFailure
  );
  const descriptionWithCancellation =
    cancelledCount > 0 ? description + createCancellationSuffix(cancelledCount) : description;

  return {
    alert: {
      description: descriptionWithCancellation,
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
  const cancelledResults = getCancelledRowResults(rejectedResults);
  const cancelledCount = cancelledResults.length;

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
  const description = createBulkMetadataFailureMessage(
    failedCount,
    outcome.mutationResult.length,
    hasRefreshFailure
  );
  const descriptionWithCancellation =
    cancelledCount > 0 ? description + createCancellationSuffix(cancelledCount) : description;

  // All-failure → panel-level alert, close modal (migrated from inline errorMessage)
  if (failedCount === outcome.mutationResult.length) {
    return {
      alert: {
        description: descriptionWithCancellation,
        title: 'Could not update selected classes.',
        type: 'error',
      },
      errorMessage: null,
      refreshRequiredMessage,
      selectedRowKeys,
      shouldCloseModal: true,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  return {
    alert: {
      description: descriptionWithCancellation,
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

// ---------------------------------------------------------------------------
// Failure message builders
// ---------------------------------------------------------------------------

/**
 * Builds user-facing failure copy for a bulk action.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {boolean} hasRefreshFailure Whether the refresh branch failed.
 * @param {BulkFailureMessageCopy} copy Action-specific failure copy.
 * @returns {string} User-facing failure copy.
 */
export function createBulkFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean,
  copy: BulkFailureMessageCopy
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
export function createBulkMetadataFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure:
      'Unable to update the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to update any of the ' +
      attemptedRowCount +
      ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be updated. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be updated. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
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
export function createBulkCreateFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure:
      'Unable to create the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to create any of the ' +
      attemptedRowCount +
      ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be created. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be created. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
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
export function createBulkDeleteFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure:
      'Unable to delete the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to delete any of the ' +
      attemptedRowCount +
      ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be deleted. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
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
export function createBulkSetActiveFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure:
      'Unable to set the selected class to active. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' +
      attemptedRowCount +
      ' selected classes to active. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be set to active. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
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
export function createBulkSetInactiveFailureMessage(
  failedCount: number,
  totalCount: number,
  hasRefreshFailure: boolean
): string {
  return createBulkFailureMessage(failedCount, totalCount, hasRefreshFailure, {
    singleFailure:
      'Unable to set the selected class to inactive. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' +
      attemptedRowCount +
      ' selected classes to inactive. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be set to inactive. Successful rows were refreshed. Please review the remaining selection and try again.',
    partialRefreshFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount +
      ' of ' +
      attemptedRowCount +
      ' selected classes could not be set to inactive. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
  });
}
