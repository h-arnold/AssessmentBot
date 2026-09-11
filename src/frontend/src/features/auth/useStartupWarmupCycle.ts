import { type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiTransportError } from '../../errors/apiTransportError';
import { normaliseUnknownError } from '../../errors/normaliseUnknownError';
import { logFrontendError } from '../../logging/frontendLogger';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
  startupWarmupQueryKeys,
  type StartupWarmupDatasetKey,
  warmStartupQueries,
} from '../../query/sharedQueries';
import {
  createStartupWarmupSnapshotForStatus,
  type StartupWarmupSnapshot,
  type StartupWarmupStatus,
} from './startupWarmupState';

type StartupWarmupCycle = {
  status: StartupWarmupStatus;
  snapshot: StartupWarmupSnapshot;
  promise?: Promise<unknown>;
  failureError?: unknown;
};

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

  logFrontendError('features/auth/useStartupWarmupCycle', error, {
    errorMessage: normalisedError.errorMessage,
    errorCode: apiTransportError?.code,
    requestId: apiTransportError?.requestId,
    datasets: startupWarmupDatasetKeys,
    queryKeys: startupWarmupQueryKeys,
  });
}

type AdoptWarmupCycleOutcomeOptions = Readonly<{
  cycle: StartupWarmupCycle;
  promise: Promise<unknown>;
  queryClient: QueryClient;
  getIsMounted: () => boolean;
  setWarmupCycleState: (state: StartupWarmupCycle) => void;
  clearPromise: boolean;
  logFailure: boolean;
}>;

/**
 * Adopts the resolve/reject outcome of a warm-up cycle promise onto the cycle object and
 * republishes the result to React state while the subscriber remains mounted.
 *
 * @param {AdoptWarmupCycleOutcomeOptions} options Named outcome-handling options.
 * @returns {void} Nothing.
 */
function adoptWarmupCycleOutcome(options: AdoptWarmupCycleOutcomeOptions): void {
  const {
    cycle,
    promise,
    queryClient,
    getIsMounted,
    setWarmupCycleState,
    clearPromise,
    logFailure,
  } = options;

  void promise.then(
    () => {
      const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'ready');
      const nextStatus = deriveWarmupStatus(nextSnapshot);
      cycle.status = nextStatus;
      cycle.snapshot = nextSnapshot;

      if (clearPromise) {
        cycle.promise = undefined;
      }

      if (getIsMounted()) {
        setWarmupCycleState({ status: nextStatus, snapshot: nextSnapshot });
      }
    },
    (error: unknown) => {
      const nextSnapshot = resolveNextWarmupSnapshot(queryClient, 'failed');
      const nextStatus = deriveWarmupStatus(nextSnapshot);
      cycle.status = nextStatus;
      cycle.snapshot = nextSnapshot;
      cycle.failureError = error;

      if (clearPromise) {
        cycle.promise = undefined;
      }

      if (logFailure) {
        logStartupWarmupFailure(error);
      }

      if (getIsMounted()) {
        setWarmupCycleState({
          status: nextStatus,
          snapshot: nextSnapshot,
          failureError: error,
        });
      }
    }
  );
}

/**
 * Owns the startup warm-up cycle for a given query client and publishes its current state.
 *
 * @remarks
 * The warm-up runs only once OAuth admission is confirmed; an in-flight cycle is reused
 * across remounts via the module-scoped `startupWarmupCycles` registry so StrictMode
 * double-invocation does not reschedule it. A failed warm-up is logged and its failure
 * status published; it does not fail the shell closed.
 *
 * @param {QueryClient} queryClient The active query client.
 * @param {boolean} isAuthorised Whether OAuth authorisation resolved as authorised.
 * @param {string | null} oauthError The OAuth transport error, or null when healthy.
 * @param {boolean} isAuthorising Whether OAuth authorisation is still resolving.
 * @returns {StartupWarmupCycle} The current warm-up cycle state.
 */
export function useStartupWarmupCycle(
  queryClient: QueryClient,
  isAuthorised: boolean,
  oauthError: string | null,
  isAuthorising: boolean
): StartupWarmupCycle {
  const [warmupCycleState, setWarmupCycleState] = useState<StartupWarmupCycle>(() =>
    getStoredWarmupCycle(queryClient)
  );

  useEffect(() => {
    if (!isAuthorised || oauthError || isAuthorising) {
      return;
    }

    const existingCycle = startupWarmupCycles.get(queryClient);
    let isMounted = true;

    if (existingCycle) {
      // The lazy state initialiser already adopted the existing cycle from the registry.
      // Subscribe to its promise so the provider updates when warm-up resolves.
      if (existingCycle.promise) {
        adoptWarmupCycleOutcome({
          cycle: existingCycle,
          promise: existingCycle.promise,
          queryClient,
          getIsMounted: () => isMounted,
          setWarmupCycleState,
          clearPromise: false,
          logFailure: false,
        });
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
    // provider shows the correct initial state. The promise handler below republishes on
    // resolution. Avoids a synchronous setState within the effect.
    adoptWarmupCycleOutcome({
      cycle,
      promise: cyclePromise,
      queryClient,
      getIsMounted: () => isMounted,
      setWarmupCycleState,
      clearPromise: true,
      logFailure: true,
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthorised, oauthError, isAuthorising, queryClient]);

  return warmupCycleState;
}
