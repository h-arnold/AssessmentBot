/**
 * Shared helpers for the Manage Cohorts and Manage Year Groups modal workflows.
 *
 * Extracted here to avoid duplicating identical logic across both modal modules.
 * Keep this file local to the classes feature.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { ApiTransportError } from '../../errors/apiTransportError';
import type { BlockingLoadErrorState } from '../../errors/blockingLoadError';

type ReferenceDataTrustBoundary = 'cohorts' | 'yearGroups';

export { getBlockingLoadErrorMessage, type BlockingLoadErrorState } from '../../errors/blockingLoadError';

/**
 * Synchronises the outer reference-data modal busy attribute with the current refresh state.
 *
 * @param {string} modalSelector Selector for the rendered Ant Design modal dialog element.
 * @param {boolean} isBusy Whether the modal should expose busy state.
 * @returns {void} Nothing.
 */
export function syncReferenceDataModalBusyState(modalSelector: string, isBusy: boolean): void {
  const dialog = document.querySelector(modalSelector);

  if (!(dialog instanceof HTMLElement)) {
    return;
  }

  if (isBusy) {
    dialog.setAttribute('aria-busy', 'true');
    return;
  }

  dialog.removeAttribute('aria-busy');
}

/**
 * Returns the query-cache key used to persist a fail-closed reference-data trust boundary.
 *
 * @param {ReferenceDataTrustBoundary} entity Reference-data entity whose trust boundary is tracked.
 * @returns {readonly ['referenceDataBlockingLoadError', ReferenceDataTrustBoundary]} Query key for the blocking state.
 */
export function getReferenceDataBlockingLoadErrorQueryKey(entity: ReferenceDataTrustBoundary) {
  return ['referenceDataBlockingLoadError', entity] as const;
}

/**
 * Reads the persisted fail-closed reference-data trust boundary from the shared query cache.
 *
 * @param {QueryClient} queryClient Shared query client.
 * @param {ReferenceDataTrustBoundary} entity Reference-data entity whose trust boundary is tracked.
 * @returns {BlockingLoadErrorState | null} Persisted blocking state, when present.
 */
export function getPersistedBlockingLoadError(
  queryClient: QueryClient,
  entity: ReferenceDataTrustBoundary
): BlockingLoadErrorState | null {
  return queryClient.getQueryData<BlockingLoadErrorState>(
    getReferenceDataBlockingLoadErrorQueryKey(entity)
  ) ?? null;
}

/**
 * Persists a fail-closed reference-data trust boundary in the shared query cache.
 *
 * @param {QueryClient} queryClient Shared query client.
 * @param {ReferenceDataTrustBoundary} entity Reference-data entity whose trust boundary is tracked.
 * @param {BlockingLoadErrorState} blockingLoadError Blocking state to persist.
 * @returns {void} Nothing.
 */
export function setPersistedBlockingLoadError(
  queryClient: QueryClient,
  entity: ReferenceDataTrustBoundary,
  blockingLoadError: BlockingLoadErrorState
): void {
  queryClient.setQueryData(
    getReferenceDataBlockingLoadErrorQueryKey(entity),
    blockingLoadError
  );
}

/**
 * Clears the persisted fail-closed reference-data trust boundary once trustworthy data is available.
 *
 * @param {QueryClient} queryClient Shared query client.
 * @param {ReferenceDataTrustBoundary} entity Reference-data entity whose trust boundary is tracked.
 * @returns {void} Nothing.
 */
export function clearPersistedBlockingLoadError(
  queryClient: QueryClient,
  entity: ReferenceDataTrustBoundary
): void {
  queryClient.removeQueries({
    exact: true,
    queryKey: getReferenceDataBlockingLoadErrorQueryKey(entity),
  });
}

/**
 * Returns true when the API transport error signals that a record is in use.
 *
 * @param {unknown} error Error caught from a service call.
 * @returns {boolean} True when the error code is IN_USE.
 */
export function isInUseError(error: unknown): boolean {
  return error instanceof ApiTransportError && error.code === 'IN_USE';
}

/**
 * Derives a user-facing delete error message from the thrown error.
 *
 * @param {unknown} error Error caught from the delete service call.
 * @param {boolean} blocked Whether the error was an IN_USE block.
 * @param {string} entityLabel Singular lower-case label for the entity (e.g. 'cohort', 'year group').
 * @returns {string} User-facing error message.
 */
export function getDeleteErrorMessage(error: unknown, blocked: boolean, entityLabel: string): string {
  if (blocked) {
    return `This ${entityLabel} is in use by one or more classes and cannot be deleted.`;
  }

  return error instanceof Error ? error.message : `Unable to delete the ${entityLabel}.`;
}

/**
 * Refetches an active required reference-data query and reports whether the visible dataset is
 * trustworthy afterwards.
 *
 * @param {QueryClient} queryClient Shared query client.
 * @param {QueryKey} queryKey Exact query key to refetch.
 * @returns {Promise<boolean>} True when the refetch succeeded.
 */
export async function refetchRequiredReferenceDataQuery(
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<boolean> {
  try {
    await queryClient.refetchQueries({
      exact: true,
      queryKey,
      type: 'active',
    }, {
      throwOnError: true,
    });

    return true;
  } catch {
    return false;
  }
}
