import { useQuery } from '@tanstack/react-query';
import { mapErrorToUserMessage } from '../../errors/map-error-to-ui';
import { getAuthorisationStatusQueryOptions } from '../../query/sharedQueries';

export type AuthorisationStatus = Readonly<{
  isAuthorised: boolean;
  isLoading: boolean;
  error: string | null;
}>;

/**
 * Resolves authorisation state for the auth status feature.
 *
 * Returns loading state immediately, then either authorised or unauthorised.
 * If the backend call fails, the hook returns the failure message.
 *
 * @remarks
 * The `error` field captures transport failures only and is derived by the central
 * `mapErrorToUserMessage` helper using `extractErrorCode` and `mapErrorCodeToUserMessage`
 * from `map-error-to-ui.ts`; no local mapping copy is maintained. It does not observe
 * `FORBIDDEN`, which is handled by the startup warm-up gate.
 *
 * @returns {AuthorisationStatus} The current authorisation status.
 */
export function useAuthorisationStatus(): AuthorisationStatus {
  const authQuery = useQuery(getAuthorisationStatusQueryOptions());

  if (authQuery.isPending) {
    return {
      isAuthorised: false,
      isLoading: true,
      error: null,
    };
  }

  if (authQuery.isError) {
    return {
      isAuthorised: false,
      isLoading: false,
      error: mapErrorToUserMessage(authQuery.error),
    };
  }

  const isAuthorised = authQuery.data === true;

  return {
    isAuthorised,
    isLoading: false,
    error: null,
  };
}
