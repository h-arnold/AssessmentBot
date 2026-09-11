import { createContext, useContext } from 'react';
import type { ApplicationAccess } from '../../services/authService/authService.zod';

export type ApplicationAccessRole = ApplicationAccess['role'];

export type ApplicationAccessReason = ApplicationAccess['reason'];

export type ApplicationAccessContextValue = Readonly<{
  role: ApplicationAccessRole;
  reason: ApplicationAccessReason;
  allowed: boolean;
  email: string;
}>;

export const ApplicationAccessContext = createContext<ApplicationAccessContextValue | undefined>(
  undefined
);

/**
 * Reads the application access context delivered by the auth gate.
 *
 * @remarks
 * The gate mounts `ApplicationAccessContext.Provider` around its children subtree with the
 * resolved `{ role, reason, allowed, email }` access state, so descendant consumers
 * (for example the Settings page Authentication tab) can gate their own visibility on it.
 * Consuming this hook outside the provider fails loudly, matching the project's
 * fail-closed patterns.
 *
 * @returns {ApplicationAccessContextValue} The current application access context value.
 */
export function useApplicationAccessContext(): ApplicationAccessContextValue {
  const contextValue = useContext(ApplicationAccessContext);

  if (!contextValue) {
    throw new Error(
      'useApplicationAccessContext must be used within an ApplicationAccessContext.Provider.'
    );
  }

  return contextValue;
}
