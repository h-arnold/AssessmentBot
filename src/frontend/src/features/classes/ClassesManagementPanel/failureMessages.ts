import type { BulkFailureMessageCopy } from './types';

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
