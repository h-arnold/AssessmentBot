import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiTransportError } from '../errors/apiTransportError';
import { normaliseUnknownError } from '../errors/normaliseUnknownError';
import { logFrontendEvent } from '../logging/frontendLogger';
import { queryKeys } from '../query/queryKeys';
import { getGoogleClassroomsQueryOptions } from '../query/sharedQueries';

/**
 * Logs Google Classrooms prefetch failures for background diagnostics.
 *
 * @param {unknown} error Prefetch failure.
 * @returns {void} Nothing.
 */
function logGoogleClassroomsPrefetchFailure(error: unknown) {
  const normalisedError = normaliseUnknownError(error);
  const apiTransportError = error instanceof ApiTransportError ? error : undefined;

  logFrontendEvent('warn', {
    context: 'pages/SettingsPageGoogleClassroomsPrefetch.prefetchGoogleClassrooms',
    errorMessage: normalisedError.errorMessage,
    errorCode: apiTransportError?.code,
    requestId: apiTransportError?.requestId,
    stack: normalisedError.stack,
    metadata: {
      dataset: 'googleClassrooms',
      queryKey: queryKeys.googleClassrooms(),
      page: 'settings',
    },
  });
}

/**
 * Triggers the non-blocking Google Classrooms prefetch for the Settings page.
 *
 * @returns {null} Nothing visible.
 */
export function SettingsPageGoogleClassroomsPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await queryClient.prefetchQuery(getGoogleClassroomsQueryOptions());

      if (isMounted) {
        const googleClassroomsQueryState = queryClient.getQueryState(
          queryKeys.googleClassrooms()
        );

        if (googleClassroomsQueryState?.status === 'error') {
          logGoogleClassroomsPrefetchFailure(googleClassroomsQueryState.error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [queryClient]);

  return null;
}
