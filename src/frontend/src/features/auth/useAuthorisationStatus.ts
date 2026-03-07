import { useEffect, useState } from 'react';
import { getAuthorisationStatus } from '../../services/authService';
import { toUserFacingErrorMessage } from '../../errors/normaliseUnknownError';
import { logFrontendError } from '../../logging/frontendLogger';

export type AuthViewState = 'loading' | 'authorised' | 'unauthorised';

/**
 * Resolves authorisation state for the auth status feature.
 *
 * Returns loading state immediately, then either authorised or unauthorised.
 * If the backend call fails, the hook returns the failure message.
 */
export function useAuthorisationStatus() {
  const [authViewState, setAuthViewState] = useState<AuthViewState>('loading');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getAuthorisationStatus()
      .then((isAuthorised) => {
        if (!isMounted) {
          return;
        }

        setAuthViewState(isAuthorised ? 'authorised' : 'unauthorised');
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        logFrontendError('features/auth/useAuthorisationStatus', error);
        setAuthError(toUserFacingErrorMessage(error));
        setAuthViewState('unauthorised');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    authViewState,
    authError,
  };
}
