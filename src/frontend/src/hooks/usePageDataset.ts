import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { StartupWarmupDatasetKey } from '../query/sharedQueries';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { getStartupWarmupQueryOptions } from '../query/sharedQueries';

/**
 * Per-dataset derived state used by page surface-state helpers.
 *
 * All fields are boolean flags computed from a React Query result and
 * the startup warm-up state for a single dataset key.
 */
export type PageDatasetState = Readonly<{
  /** Whether the query has returned data (query.data is not undefined). */
  hasQueryData: boolean;
  /** Whether the query is in an error state. */
  isQueryError: boolean;
  /** Whether the warm-up dataset has failed (as reported by startup warm-up state). */
  isDatasetFailed: boolean;
  /** Whether the warm-up dataset is ready (as reported by startup warm-up state). */
  isDatasetReady: boolean;
  /** Whether the warm-up dataset snapshot is trustworthy. */
  isDatasetTrustworthy: boolean;
  /** Convenience flag: the dataset is both ready and trustworthy. */
  hasTrustworthyDataset: boolean;
}>;

/**
 * Hook return type for a single warm-up-backed page dataset.
 *
 * @template TData The type of the query data payload.
 */
type PageDatasetResult<TData> = Readonly<{
  query: UseQueryResult<TData>;
  datasetState: PageDatasetState;
}>;

/**
 * Derives a {@link PageDatasetState} from a query result and the startup warm-up
 * state for a single dataset key.
 *
 * This is a pure function with no side effects or hook dependencies.
 *
 * @param {StartupWarmupDatasetKey} datasetKey - The warm-up dataset key.
 * @param {object} queryResult - The query result (data and error flag).
 * @param {unknown} queryResult.data - Query data, or `undefined` before the first successful load.
 * @param {boolean} queryResult.isError - Whether the query is in an error state.
 * @param {object} startupWarmupState - Startup warm-up state values.
 * @param {Function} startupWarmupState.isDatasetReady - Returns true when the dataset is ready.
 * @param {Function} startupWarmupState.isDatasetFailed - Returns true when the dataset has failed.
 * @param {object} startupWarmupState.snapshot - Warm-up dataset snapshot.
 * @param {Record<StartupWarmupDatasetKey, {isTrustworthy: boolean}>} startupWarmupState.snapshot.datasets - Map of dataset keys to trustworthiness snapshots.
 * @returns {PageDatasetState} The derived per-dataset state.
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
 * Decision tree (from SPEC.md, including the recovered-path carve-out):
 *
 * 1. **Failed and cannot display**: the dataset has failed AND there is no query
 *    data OR the query itself is errored → **block**.
 * 2. **Untrustworthy without recovery**: the dataset is not trustworthy AND it is
 *    not the recovered case (failed but has data and no query error) → **block**.
 * 3. **Ready but errored**: the dataset is ready but the query is in an error
 *    state → **block**.
 * 4. Otherwise → **do not block** (the surface can render with usable data).
 *
 * @param {PageDatasetState} datasetState - Per-dataset state from
 *   {@link computePageDatasetState}.
 * @returns {boolean} `true` if the dataset should block the page surface.
 */
export function computePageSurfaceBlocking(datasetState: PageDatasetState): boolean {
  const { hasQueryData, isQueryError, isDatasetFailed, isDatasetReady, isDatasetTrustworthy } =
    datasetState;

  // 1. Dataset failed and (no query data OR query errored) → block
  const failedAndCannotDisplay = isDatasetFailed && (!hasQueryData || isQueryError);

  // 2. Untrustworthy AND NOT the recovered case (failed + has data + no error) → block
  const isRecovered = isDatasetFailed && hasQueryData && !isQueryError;
  const untrustworthyWithoutRecovery = !isDatasetTrustworthy && !isRecovered;

  // 3. Ready and the query is errored → block
  const readyButErrored = isDatasetReady && isQueryError;

  // 4. Otherwise → do not block
  return [failedAndCannotDisplay, untrustworthyWithoutRecovery, readyButErrored].includes(true);
}

/**
 * Decides whether a dataset is renderable on the page.
 *
 * A dataset is renderable when:
 *
 * - It has a trustworthy dataset (`hasTrustworthyDataset` is `true`), OR
 * - It has recovered after a warm-up failure: the dataset has failed but the
 *   query successfully returned data with no error
 *   (`isDatasetFailed && hasQueryData && !isQueryError`).
 *
 * @param {PageDatasetState} datasetState - Per-dataset state from
 *   {@link computePageDatasetState}.
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
 * Computes whether the page surface is busy due to any query fetching or
 * mutation being in flight.
 *
 * Returns `true` when at least one flag in `fetchFlags` or `mutationFlags` is
 * truthy.  Pages that need additional busy triggers (for example, including a
 * table-loading state) layer those on top of this shared helper.
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
 * React Query hook that provides a typed query result and derived dataset state
 * for a startup warm-up dataset.
 *
 * The query is enabled when the dataset is ready OR has failed. Enabling on
 * failure is required so refetchQueries() can retry after a warmup failure —
 * disabled queries cannot be refetched in React Query v5. The blocking state
 * still protects the UI while the dataset is untrustworthy.
 *
 * @template TData Type of the query data payload.
 * @param {StartupWarmupDatasetKey} datasetKey The startup warm-up dataset key.
 * @returns {PageDatasetResult<TData>} Query result and derived dataset state.
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
