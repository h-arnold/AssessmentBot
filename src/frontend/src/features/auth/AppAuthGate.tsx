import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Button, Result, Spin } from 'antd';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiTransportError } from '../../errors/apiTransportError';
import { extractErrorCode, mapErrorCodeToUserMessage } from '../../errors/map-error-to-ui';
import { normaliseUnknownError } from '../../errors/normaliseUnknownError';
import { logFrontendError } from '../../logging/frontendLogger';
import {
  getStartupWarmupQueryKey,
  getAuthorisationStatusQueryOptions,
  startupWarmupDatasetKeys,
  startupWarmupQueryKeys,
  type StartupWarmupDatasetKey,
  warmStartupQueries,
} from '../../query/sharedQueries';
import {
  StartupWarmupStateProvider,
  createStartupWarmupSnapshotForStatus,
  type StartupWarmupSnapshot,
  type StartupWarmupStatus,
} from './startupWarmupState';
import { useAuthorisationStatus } from './useAuthorisationStatus';

type StartupWarmupCycle = {
  status: StartupWarmupStatus;
  snapshot: StartupWarmupSnapshot;
  promise?: Promise<unknown>;
};

/**
 * Tracks warm-up cycles per query client so StrictMode remounts do not reschedule them.
 */
const startupWarmupCycles = new WeakMap<QueryClient, StartupWarmupCycle>();

/**
 * Returns the current shared warm-up cycle for the provided query client.
 *
 * @param {QueryClient} queryClient Query client to inspect.
 * @returns {StartupWarmupCycle} Current warm-up cycle state.
 */
function getStoredWarmupCycle(queryClient: QueryClient): StartupWarmupCycle {
  const existingCycle = startupWarmupCycles.get(queryClient);

  if (existingCycle) {
    return existingCycle;
  }

  return {
    status: 'loading',
    snapshot: createStartupWarmupSnapshotForStatus('loading'),
  };
}

/**
 * Maps a query status to startup warm-up dataset status.
 *
 * @param {QueryClient} queryClient Query client holding the dataset query.
 * @param {StartupWarmupDatasetKey} datasetKey Dataset to read.
 * @returns {StartupWarmupSnapshot['datasets'][StartupWarmupDatasetKey]} Dataset snapshot.
 */
function getDatasetWarmupState(
  queryClient: QueryClient,
  datasetKey: StartupWarmupDatasetKey
): StartupWarmupSnapshot['datasets'][StartupWarmupDatasetKey] {
  const queryState = queryClient.getQueryState(getStartupWarmupQueryKey(datasetKey));

  if (!queryState || queryState.status === 'pending') {
    return { status: 'loading', isTrustworthy: false };
  }

  if (queryState.status === 'error') {
    return { status: 'failed', isTrustworthy: false };
  }

  return { status: 'ready', isTrustworthy: true };
}

/**
 * Builds the current dataset-level warm-up snapshot from shared query states.
 *
 * @param {QueryClient} queryClient Query client to inspect.
 * @returns {StartupWarmupSnapshot} Current dataset-level startup snapshot.
 */
function createWarmupSnapshotFromQueryClient(queryClient: QueryClient): StartupWarmupSnapshot {
  return {
    datasets: Object.fromEntries(
      startupWarmupDatasetKeys.map((datasetKey) => [
        datasetKey,
        getDatasetWarmupState(queryClient, datasetKey),
      ])
    ) as StartupWarmupSnapshot['datasets'],
  };
}

/**
 * Derives scalar warm-up status from the dataset-level snapshot.
 *
 * @param {StartupWarmupSnapshot} snapshot Dataset-level startup snapshot.
 * @returns {StartupWarmupStatus} Derived scalar status.
 */
function deriveWarmupStatus(snapshot: StartupWarmupSnapshot): StartupWarmupStatus {
  const datasetStates = Object.values(snapshot.datasets);

  if (datasetStates.some((datasetState) => datasetState.status === 'failed')) {
    return 'failed';
  }

  if (
    datasetStates.every(
      (datasetState) => datasetState.status === 'ready' && datasetState.isTrustworthy
    )
  ) {
    return 'ready';
  }

  return 'loading';
}

/**
 * Resolves the next warm-up snapshot from query cache, with a scalar-status fallback.
 *
 * @param {QueryClient} queryClient Query client to inspect.
 * @param {StartupWarmupStatus} fallbackStatus Fallback status for scalar-only warm-up cycles.
 * @returns {StartupWarmupSnapshot} Next dataset-level warm-up snapshot.
 */
function resolveNextWarmupSnapshot(
  queryClient: QueryClient,
  fallbackStatus: StartupWarmupStatus
): StartupWarmupSnapshot {
  const nextSnapshot = createWarmupSnapshotFromQueryClient(queryClient);

  if (
    Object.values(nextSnapshot.datasets).every((datasetState) => datasetState.status === 'loading')
  ) {
    return createStartupWarmupSnapshotForStatus(fallbackStatus);
  }

  return nextSnapshot;
}

/**
 * Logs startup warm-up failures with debug-only orchestration context.
 *
 * @param {unknown} error The warm-up failure to log.
 * @returns {void} Nothing.
 */
function logStartupWarmupFailure(error: unknown) {
  const normalisedError = normaliseUnknownError(error);
  const apiTransportError = error instanceof ApiTransportError ? error : undefined;

  logFrontendError('features/auth/AppAuthGate.startupWarmup', error, {
    errorMessage: normalisedError.errorMessage,
    errorCode: apiTransportError?.code,
    requestId: apiTransportError?.requestId,
    datasets: startupWarmupDatasetKeys,
    queryKeys: startupWarmupQueryKeys,
  });
}

/**
 * Finds a group-authorisation denial in the startup warm-up query states.
 *
 * @param {QueryClient} queryClient Query client holding the warm-up queries.
 * @returns {string | null} Access-denied copy, or null when no denial is present.
 */
function getWarmupForbiddenMessage(queryClient: QueryClient): string | null {
  const hasForbiddenError = startupWarmupDatasetKeys.some((datasetKey) => {
    const error = queryClient.getQueryState(getStartupWarmupQueryKey(datasetKey))?.error;
    return extractErrorCode(error) === 'FORBIDDEN';
  });

  return hasForbiddenError ? mapErrorCodeToUserMessage('FORBIDDEN') : null;
}

/**
 * Provides an auth-aware boundary for startup warm-up orchestration.
 *
 * @remarks
 * FORBIDDEN is detected by reading each startup warm-up query's error directly from the
 * React Query cache via `queryClient.getQueryState(getStartupWarmupQueryKey(dataset))?.error`
 * and `extractErrorCode`. An access-denied message is rendered for code `FORBIDDEN` with
 * highest precedence, before transport error, loading, or authorisation states.
 *
 * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
 * @returns {JSX.Element} The auth gate wrapper.
 */
export function AppAuthGate(properties: Readonly<PropsWithChildren>) {
  const { children } = properties;
  const queryClient = useQueryClient();
  const { isAuthorised, isLoading, error } = useAuthorisationStatus();
  const [warmupCycleState, setWarmupCycleState] = useState<StartupWarmupCycle>(() =>
    getStoredWarmupCycle(queryClient)
  );

  useEffect(() => {
    if (isLoading || !isAuthorised || error) {
      return;
    }

    const existingCycle = startupWarmupCycles.get(queryClient);
    let isMounted = true;

    if (existingCycle) {
      // The lazy state initialiser already adopted the existing cycle from the registry.
      // Subscribe to its promise so the provider updates when warm-up resolves.
      if (existingCycle.promise) {
        void existingCycle.promise.then(
          () => {
            const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'ready');
            const nextStatus = deriveWarmupStatus(nextSnapshot);
            existingCycle.status = nextStatus;
            existingCycle.snapshot = nextSnapshot;

            if (isMounted) {
              setWarmupCycleState({
                status: nextStatus,
                snapshot: nextSnapshot,
              });
            }
          },
          () => {
            const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'failed');
            const nextStatus = deriveWarmupStatus(nextSnapshot);
            existingCycle.status = nextStatus;
            existingCycle.snapshot = nextSnapshot;

            if (isMounted) {
              setWarmupCycleState({
                status: nextStatus,
                snapshot: nextSnapshot,
              });
            }
          }
        );
      }

      return () => {
        isMounted = false;
      };
    }

    const cyclePromise = warmStartupQueries(queryClient);
    const cycle: StartupWarmupCycle = {
      status: 'loading',
      snapshot: createStartupWarmupSnapshotForStatus('loading'),
      promise: cyclePromise,
    };
    startupWarmupCycles.set(queryClient, cycle);

    // The lazy state initialiser already published a matching 'loading' cycle, so the
    // provider shows the correct initial state. The promise handlers below republish on
    // resolution. Avoids a synchronous setState within the effect.
    void cyclePromise.then(
      () => {
        const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'ready');
        const nextStatus = deriveWarmupStatus(nextSnapshot);
        cycle.status = nextStatus;
        cycle.snapshot = nextSnapshot;
        cycle.promise = undefined;

        if (isMounted) {
          setWarmupCycleState({ status: nextStatus, snapshot: nextSnapshot });
        }
      },
      (error: unknown) => {
        const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'failed');
        const nextStatus = deriveWarmupStatus(nextSnapshot);
        cycle.status = nextStatus;
        cycle.snapshot = nextSnapshot;
        cycle.promise = undefined;
        logStartupWarmupFailure(error);

        if (isMounted) {
          setWarmupCycleState({ status: nextStatus, snapshot: nextSnapshot });
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [error, isAuthorised, isLoading, queryClient]);

  const warmupForbiddenMessage = useMemo(
    () => getWarmupForbiddenMessage(queryClient),
    [queryClient, warmupCycleState]
  );

  if (warmupForbiddenMessage) {
    return <Result status="error" title={warmupForbiddenMessage} />;
  }

  if (error) {
    return (
      <Result
        status="warning"
        title={error}
        extra={
          <Button
            type="primary"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: getAuthorisationStatusQueryOptions().queryKey,
              });
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading authorisation status">
        <Spin />
        Loading authorisation status
      </div>
    );
  }

  if (!isAuthorised) {
    return <Result status="warning" title="Permissions required" />;
  }

  return (
    <StartupWarmupStateProvider
      warmupState={warmupCycleState.status}
      snapshot={warmupCycleState.snapshot}
    >
      {children}
    </StartupWarmupStateProvider>
  );
}
