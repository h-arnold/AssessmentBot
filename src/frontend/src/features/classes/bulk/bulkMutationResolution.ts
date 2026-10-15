import {
  mapRequiredClassPartialsRefreshFailureToUserMessage,
  type RequiredClassPartialsRefreshOutcome,
} from './queryInvalidation';
import type { RejectedRowResult, RowMutationResult } from './batchMutationEngine';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { createBulkMetadataFailureMessage } from './bulkMutationFailureMessages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulkActionOutcomeAlert = Readonly<{
  description: string;
  title: string;
  type: 'error' | 'warning';
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
    setSubmitting: (isSubmitting: boolean) => void;
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
  return rejectedResults.filter((result) => {
    return (
      result.error &&
      typeof result.error === 'object' &&
      (result.error as { reason?: string }).reason === 'CANCELLED'
    );
  });
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
  if (rejectedResults.length === 0) {
    return {
      alert: null,
      refreshRequiredMessage,
      selectedRowKeys: [],
      shouldCloseSurface: true,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  const cancelledCount = cancelledResults.length;
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
  if (rejectedResults.length === 0) {
    return {
      alert: null,
      refreshRequiredMessage,
      selectedRowKeys: [],
      shouldCloseModal: true,
      suppressStaleTableData: hasRefreshFailure,
    };
  }

  const cancelledCount = cancelledResults.length;
  const failedCount = rejectedResults.length;
  const selectedRowKeys = rejectedResults.map((result) => result.row.classId);
  const description = createBulkMetadataFailureMessage(
    failedCount,
    outcome.mutationResult.length,
    hasRefreshFailure
  );
  const descriptionWithCancellation =
    cancelledCount > 0 ? description + createCancellationSuffix(cancelledCount) : description;

  // All-failure → panel-level alert, close modal
  if (failedCount === outcome.mutationResult.length) {
    return {
      alert: {
        description: descriptionWithCancellation,
        title: 'Could not update selected classes.',
        type: 'error',
      },
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
    refreshRequiredMessage,
    selectedRowKeys,
    shouldCloseModal: true,
    suppressStaleTableData: hasRefreshFailure,
  };
}

export {
  createBulkCreateFailureMessage,
  createBulkDeleteFailureMessage,
  createBulkFailureMessage,
  createBulkMetadataFailureMessage,
  createBulkSetActiveFailureMessage,
  createBulkSetInactiveFailureMessage,
} from './bulkMutationFailureMessages';
export type { BulkFailureMessageCopy } from './bulkMutationFailureMessages';
