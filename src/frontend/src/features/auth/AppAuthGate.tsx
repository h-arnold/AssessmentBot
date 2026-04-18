import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { ApiTransportError } from '../../errors/apiTransportError';
import { normaliseUnknownError } from '../../errors/normaliseUnknownError';
import { logFrontendEvent } from '../../logging/frontendLogger';
import { queryKeys } from '../../query/queryKeys';
import { warmStartupQueries } from '../../query/sharedQueries';
import {
  StartupWarmupStateProvider,
  createStartupWarmupSnapshotForStatus,
  type StartupWarmupDatasetKey,
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
 * Returns the shared query key for a startup warm-up dataset.
 *
 * @param {StartupWarmupDatasetKey} datasetKey Dataset key.
 * @returns {readonly [string]} Corresponding query key.
 */
function getDatasetQueryKey(datasetKey: StartupWarmupDatasetKey) {
  switch (datasetKey) {
    case 'classPartials': {
      return queryKeys.classPartials();
    }
    case 'cohorts': {
      return queryKeys.cohorts();
    }
    case 'yearGroups': {
      return queryKeys.yearGroups();
    }
    case 'assignmentDefinitionPartials': {
      return queryKeys.assignmentDefinitionPartials();
    }
  }
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
  const queryState = queryClient.getQueryState(getDatasetQueryKey(datasetKey));

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
    datasets: {
      classPartials: getDatasetWarmupState(queryClient, 'classPartials'),
      cohorts: getDatasetWarmupState(queryClient, 'cohorts'),
      yearGroups: getDatasetWarmupState(queryClient, 'yearGroups'),
      assignmentDefinitionPartials: getDatasetWarmupState(queryClient, 'assignmentDefinitionPartials'),
    },
  };
}

/**
 * Derives scalar warm-up status from the dataset-level snapshot.
 *
 * @param {StartupWarmupSnapshot} snapshot Dataset-level startup snapshot.
 * @returns {StartupWarmupStatus} Derived scalar status.
 */
function deriveWarmupStatus(snapshot: StartupWarmupSnapshot): StartupWarmupStatus {
  const datasetStates = [
    snapshot.datasets.classPartials,
    snapshot.datasets.cohorts,
    snapshot.datasets.yearGroups,
    snapshot.datasets.assignmentDefinitionPartials,
  ];

  if (datasetStates.some((datasetState) => datasetState.status === 'failed')) {
    return 'failed';
  }

  if (datasetStates.every((datasetState) => datasetState.status === 'ready' && datasetState.isTrustworthy)) {
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
  const allDatasetsStillLoading =
    nextSnapshot.datasets.classPartials.status === 'loading'
    && nextSnapshot.datasets.cohorts.status === 'loading'
    && nextSnapshot.datasets.yearGroups.status === 'loading'
    && nextSnapshot.datasets.assignmentDefinitionPartials.status === 'loading';

  if (allDatasetsStillLoading) {
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

  logFrontendEvent('debug', {
    context: 'features/auth/AppAuthGate.startupWarmup',
    errorMessage: normalisedError.errorMessage,
    errorCode: apiTransportError?.code,
    requestId: apiTransportError?.requestId,
    stack: normalisedError.stack,
    metadata: {
      datasets: ['classPartials', 'cohorts', 'yearGroups', 'assignmentDefinitionPartials'],
      queryKeys: [
        queryKeys.classPartials(),
        queryKeys.cohorts(),
        queryKeys.yearGroups(),
        queryKeys.assignmentDefinitionPartials(),
      ],
    },
  });
}

/**
 * Provides an auth-aware boundary for startup warm-up orchestration.
 *
 * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
 * @returns {JSX.Element} The auth gate wrapper.
 */
export function AppAuthGate(properties: Readonly<PropsWithChildren>) {
  const { children } = properties;
  const queryClient = useQueryClient();
  const { isAuthResolved, isAuthorised } = useAuthorisationStatus();
  const [warmupCycleState, setWarmupCycleState] = useState<StartupWarmupCycle>(() =>
    getStoredWarmupCycle(queryClient)
  );

  useEffect(() => {
    setWarmupCycleState(getStoredWarmupCycle(queryClient));
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthResolved || !isAuthorised) {
      return;
    }

    const existingCycle = startupWarmupCycles.get(queryClient);
    let isMounted = true;

    if (existingCycle) {
      setWarmupCycleState(existingCycle);

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
    setWarmupCycleState(cycle);

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
  }, [isAuthResolved, isAuthorised, queryClient]);

  return (
    <StartupWarmupStateProvider
      warmupState={warmupCycleState.status}
      snapshot={warmupCycleState.snapshot}
    >
      {children}
    </StartupWarmupStateProvider>
  );
}
