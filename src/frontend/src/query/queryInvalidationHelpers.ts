import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Invalidates a query without triggering the normal background refetch,
 * then explicitly refetches it.
 *
 * This pattern exists for queries that may be **disabled at the time of
 * invalidation** — for example, queries gated on warmup-dataset readiness
 * where `enabled: isDatasetReady || isDatasetFailed`.  Normal
 * `invalidateQueries` with a background refetch cannot retrigger a disabled
 * observer, so the explicit `refetchQueries` call is required to force a
 * fresh fetch after the invalidation.
 *
 * **This is NOT the general invalidation pattern.**  For normal mutation
 * flows where the target query is actively observed, use plain
 * `invalidateQueries` and let React Query's background refetch handle cache
 * updates (see `frontend-react-query-and-prefetch.md` §7).
 *
 * Errors from either call propagate to the caller — there is no internal
 * error handling.
 *
 * @param {QueryClient} queryClient - The React Query `QueryClient` instance.
 * @param {QueryKey} queryKey - The query key to invalidate and refetch.
 * @returns {Promise<void>} A promise that resolves when the refetch completes.
 */
export async function refetchAfterStaleInvalidate(
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
  await queryClient.refetchQueries({ queryKey }, { throwOnError: true });
}
