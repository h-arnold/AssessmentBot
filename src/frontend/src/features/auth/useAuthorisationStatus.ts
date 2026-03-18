import { useQuery } from '@tanstack/react-query';
import { ApiTransportError } from '../../errors/apiTransportError';
import { getAuthorisationStatusQueryOptions } from '../../query/sharedQueries';

export type AuthViewState = 'loading' | 'authorised' | 'unauthorised';

const genericAuthErrorMessage = 'Unable to check authorisation status right now.';
const rateLimitedAuthErrorMessage = 'The service is busy. Please try again shortly.';

/**
 * Maps auth feature errors to user-safe copy.
 *
 * @param {unknown} error Auth check failure to map.
 * @returns {string} User-safe error copy.
 */
function mapAuthorisationErrorToUserMessage(error: unknown): string {
  if (error instanceof ApiTransportError && error.code === 'RATE_LIMITED') {
    return rateLimitedAuthErrorMessage;
  }

  return genericAuthErrorMessage;
}

/**
 * Resolves authorisation state for the auth status feature.
 *
 * Returns loading state immediately, then either authorised or unauthorised.
 * If the backend call fails, the hook returns the failure message.
 *
 * @returns {Readonly<{
 *   authViewState: AuthViewState;
 *   authError: string | null;
 *   isAuthResolved: boolean;
 *   isAuthorised: boolean;
 * }>} The current authorisation view state.
 */
export function useAuthorisationStatus() {
  const authQuery = useQuery(getAuthorisationStatusQueryOptions());

  if (authQuery.isPending) {
    return {
      authViewState: 'loading' as const,
      authError: null,
      isAuthResolved: false,
      isAuthorised: false,
    };
  }

  if (authQuery.isError) {
    return {
      authViewState: 'unauthorised' as const,
      authError: mapAuthorisationErrorToUserMessage(authQuery.error),
      isAuthResolved: true,
      isAuthorised: false,
    };
  }

  const isAuthorised = authQuery.data === true;

  return {
    authViewState: isAuthorised ? ('authorised' as const) : ('unauthorised' as const),
    authError: null,
    isAuthResolved: true,
    isAuthorised,
  };
}
