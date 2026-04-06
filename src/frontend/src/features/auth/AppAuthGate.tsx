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
  type StartupWarmupStatus,
} from './startupWarmupState';
import { useAuthorisationStatus } from './useAuthorisationStatus';

type StartupWarmupCycle = {
  status: StartupWarmupStatus;
  promise?: Promise<unknown>;
};

/**
 * Tracks warm-up cycles per query client so StrictMode remounts do not reschedule them.
 */
const startupWarmupCycles = new WeakMap<QueryClient, StartupWarmupCycle>();

/**
 * Returns the current shared warm-up state for the provided query client.
 *
 * @param {QueryClient} queryClient Query client to inspect.
 * @returns {StartupWarmupStatus} Current warm-up state.
 */
function getStoredWarmupState(queryClient: QueryClient): StartupWarmupStatus {
  return startupWarmupCycles.get(queryClient)?.status ?? 'loading';
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
      datasets: ['classPartials', 'cohorts', 'yearGroups'],
      queryKeys: [
        queryKeys.classPartials(),
        queryKeys.cohorts(),
        queryKeys.yearGroups(),
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
  const [warmupState, setWarmupState] = useState<StartupWarmupStatus>(() =>
    getStoredWarmupState(queryClient)
  );

  useEffect(() => {
    setWarmupState(getStoredWarmupState(queryClient));
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthResolved || !isAuthorised) {
      return;
    }

    const existingCycle = startupWarmupCycles.get(queryClient);
    let isMounted = true;

    if (existingCycle) {
      setWarmupState(existingCycle.status);

      if (existingCycle.promise) {
        void existingCycle.promise.then(
          () => {
            if (isMounted) {
              setWarmupState('ready');
            }
          },
          () => {
            if (isMounted) {
              setWarmupState('failed');
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
      promise: cyclePromise,
    };
    startupWarmupCycles.set(queryClient, cycle);
    setWarmupState('loading');

    void cyclePromise.then(
      () => {
        cycle.status = 'ready';
        cycle.promise = undefined;

        if (isMounted) {
          setWarmupState('ready');
        }
      },
      (error: unknown) => {
        cycle.status = 'failed';
        cycle.promise = undefined;
        logStartupWarmupFailure(error);

        if (isMounted) {
          setWarmupState('failed');
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [isAuthResolved, isAuthorised, queryClient]);

  return (
    <StartupWarmupStateProvider warmupState={warmupState}>
      {children}
    </StartupWarmupStateProvider>
  );
}
