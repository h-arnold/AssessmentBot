import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { ApiTransportError } from '../../errors/apiTransportError';
import { normaliseUnknownError } from '../../errors/normaliseUnknownError';
import { logFrontendEvent } from '../../logging/frontendLogger';
import { queryKeys } from '../../query/queryKeys';
import { warmClassPartials } from '../../query/sharedQueries';
import { useAuthorisationStatus } from './useAuthorisationStatus';

/**
 * Tracks which query-client instances have already scheduled startup warm-up.
 *
 * This keeps startup orchestration idempotent for one frontend session,
 * including React StrictMode remounts that reuse the same query client.
 */
const warmedQueryClients = new WeakSet<QueryClient>();

/**
 * Logs startup warm-up failures with debug-only orchestration context.
 *
 * @param {unknown} error The warm-up failure to log.
 * @returns {void} Nothing.
 */
function logClassPartialsWarmupFailure(error: unknown) {
  const normalisedError = normaliseUnknownError(error);
  const apiTransportError = error instanceof ApiTransportError ? error : undefined;

  logFrontendEvent('debug', {
    context: 'features/auth/AppAuthGate.classPartialsWarmup',
    errorMessage: normalisedError.errorMessage,
    errorCode: apiTransportError?.code,
    requestId: apiTransportError?.requestId,
    stack: normalisedError.stack,
    metadata: {
      dataset: 'classPartials',
      queryKey: queryKeys.classPartials(),
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

  useEffect(() => {
    if (!isAuthResolved || !isAuthorised || warmedQueryClients.has(queryClient)) {
      return;
    }

    warmedQueryClients.add(queryClient);
    void warmClassPartials(queryClient).catch((error: unknown) => {
      logClassPartialsWarmupFailure(error);
    });
  }, [isAuthResolved, isAuthorised, queryClient]);

  return <>{children}</>;
}
