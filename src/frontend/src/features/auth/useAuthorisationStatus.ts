import { useEffect, useState } from 'react';
import { getAuthorisationStatus } from '../../services/authService';
import { ApiTransportError } from '../../errors/apiTransportError';
import { logFrontendError } from '../../logging/frontendLogger';

export type AuthViewState = 'loading' | 'authorised' | 'unauthorised';

const genericAuthErrorMessage = 'Unable to check authorisation status right now.';
const rateLimitedAuthErrorMessage = 'The service is busy. Please try again shortly.';

/**
 * Maps auth feature errors to user-safe copy.
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
        setAuthError(mapAuthorisationErrorToUserMessage(error));
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
