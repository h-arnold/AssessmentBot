import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { StartupWarmupDatasetKey } from '../query/sharedQueries';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { getStartupWarmupQueryOptions } from '../query/sharedQueries';

/**
 * Per-dataset derived state with six boolean flags computed from a query result
 * and the startup warm-up state.
 */
export type PageDatasetState = Readonly<{
  hasQueryData: boolean;
  isQueryError: boolean;
  isDatasetFailed: boolean;
  isDatasetReady: boolean;
  isDatasetTrustworthy: boolean;
  hasTrustworthyDataset: boolean;
}>;

/** Hook return type for a single warm-up-backed page dataset. */
type PageDatasetResult<TData> = Readonly<{
  query: UseQueryResult<TData>;
  datasetState: PageDatasetState;
}>;

/**
 * Derives {@link PageDatasetState} from a query result and startup warm-up state.
 *
 * Pure function; no side effects or hook dependencies.
 *
 * @param {StartupWarmupDatasetKey} datasetKey - The warm-up dataset key.
 * @param {{ data: unknown; isError: boolean }} queryResult - Query state from React Query.
 * @param {unknown} queryResult.data - Query data payload, or undefined.
 * @param {boolean} queryResult.isError - Whether the query is errored.
 * @param {object} startupWarmupState - Warm-up context snapshot.
 * @param {Function} startupWarmupState.isDatasetReady - Readiness check.
 * @param {Function} startupWarmupState.isDatasetFailed - Failure check.
 * @param {object} startupWarmupState.snapshot - Dataset snapshots keyed by dataset key.
 * @param {Record<StartupWarmupDatasetKey, { isTrustworthy: boolean }>} startupWarmupState.snapshot.datasets - Trustworthiness map.
 * @returns {PageDatasetState} Derived per-dataset state.
 */
export function computePageDatasetState(
  datasetKey: StartupWarmupDatasetKey,
  queryResult: { data: unknown; isError: boolean },
  startupWarmupState: {
    isDatasetReady: (key: StartupWarmupDatasetKey) => boolean;
    isDatasetFailed: (key: StartupWarmupDatasetKey) => boolean;
    snapshot: { datasets: Record<StartupWarmupDatasetKey, { isTrustworthy: boolean }> };
  }
): PageDatasetState {
  const hasQueryData = queryResult.data !== undefined;
  const isQueryError = queryResult.isError;
  const isDatasetFailed = startupWarmupState.isDatasetFailed(datasetKey);
  const isDatasetReady = startupWarmupState.isDatasetReady(datasetKey);
  const isDatasetTrustworthy = startupWarmupState.snapshot.datasets[datasetKey].isTrustworthy; // eslint-disable-line security/detect-object-injection -- datasetKey is a union of known string-literals
  const hasTrustworthyDataset = isDatasetReady && isDatasetTrustworthy;

  return {
    hasQueryData,
    isQueryError,
    isDatasetFailed,
    isDatasetReady,
    isDatasetTrustworthy,
    hasTrustworthyDataset,
  };
}

/**
 * Decides whether a single dataset should block the page surface.
 *
 * Blocks when: (1) dataset failed with no data or query error; (2) dataset is
 * untrustworthy but marked ready by warm-up; (3) dataset is ready with a query
 * error.  Loading datasets (neither ready nor failed) do not block.
 *
 * @param {PageDatasetState} datasetState - Per-dataset state from {@link computePageDatasetState}.
 * @returns {boolean} `true` if the dataset should block.
 */
export function computePageSurfaceBlocking(datasetState: PageDatasetState): boolean {
  const { hasQueryData, isQueryError, isDatasetFailed, isDatasetReady, isDatasetTrustworthy } =
    datasetState;

  if (isDatasetFailed && (!hasQueryData || isQueryError)) {
    return true;
  }

  if (!isDatasetTrustworthy && isDatasetReady) {
    return true;
  }

  return isDatasetReady && isQueryError;
}

/**
 * Decides whether a dataset is renderable.
 *
 * Renderable when: (a) `hasTrustworthyDataset` is true, OR (b) recovered after
 * warm-up failure (`isDatasetFailed && hasQueryData && !isQueryError`).
 *
 * @param {PageDatasetState} datasetState - Per-dataset state.
 * @returns {boolean} `true` if the dataset data can be rendered.
 */
export function computeDatasetRenderable(datasetState: PageDatasetState): boolean {
  const { hasQueryData, isQueryError, isDatasetFailed, hasTrustworthyDataset } = datasetState;

  if (hasTrustworthyDataset) {
    return true;
  }

  if (isDatasetFailed && hasQueryData && !isQueryError) {
    return true;
  }

  return false;
}

/**
 * Returns `true` when any flag in `fetchFlags` or `mutationFlags` is truthy.
 *
 * @param {readonly boolean[]} fetchFlags - Fetching flags from dataset queries.
 * @param {readonly boolean[]} mutationFlags - Pending flags from page mutations.
 * @returns {boolean} `true` if any fetch or mutation is active.
 */
export function computePageSurfaceBusy(
  fetchFlags: readonly boolean[],
  mutationFlags: readonly boolean[]
): boolean {
  return fetchFlags.some(Boolean) || mutationFlags.some(Boolean);
}

/**
 * Hook returning a typed query result and derived dataset state for a startup
 * warm-up dataset.
 *
 * The query is enabled when the dataset is ready OR has failed.  Enabling on
 * failure is required so `refetchQueries()` can retry after a warmup failure —
 * disabled queries cannot be refetched in React Query v5.  The blocking state
 * still protects the UI while the dataset is untrustworthy.
 *
 * @template TData Type of the query data payload.
 * @param {StartupWarmupDatasetKey} datasetKey - The startup warm-up dataset key.
 * @returns {PageDatasetResult<TData>} Query result and derived {@link PageDatasetState}.
 */
export function usePageDataset<TData>(
  datasetKey: StartupWarmupDatasetKey
): PageDatasetResult<TData> {
  const startupWarmupState = useStartupWarmupState();
  const queryOptions = getStartupWarmupQueryOptions(datasetKey);
  const isDatasetReady = startupWarmupState.isDatasetReady(datasetKey);
  const isDatasetFailed = startupWarmupState.isDatasetFailed(datasetKey);
  const query = useQuery<TData>({
    ...queryOptions,
    enabled: isDatasetReady || isDatasetFailed,
    refetchOnMount: false,
  } as UseQueryOptions<TData>);
  const datasetState = computePageDatasetState(datasetKey, query, startupWarmupState);

  return { query, datasetState };
}
