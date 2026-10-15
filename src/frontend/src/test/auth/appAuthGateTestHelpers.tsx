import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { createAppQueryClient } from '../../query/queryClient';
import type { ApplicationAccess } from '../../services/authService/authService.zod';
import type { StartupWarmupQueriesResult } from '../../query/sharedQueries';

/**
 * Contract-shaped empty warm-up result used as the startup-query mock response.
 */
export const EMPTY_STARTUP_WARMUP_RESULT: StartupWarmupQueriesResult = {
  classPartials: [],
  assignmentDefinitionPartials: [],
  assignmentTopics: [],
  cohorts: [],
  yearGroups: [],
};

/**
 * The admitted access result used by the shared auth gate specs.
 */
export const grantedAdminAccess: ApplicationAccess = {
  allowed: true,
  role: 'admin',
  email: 'owner@example.com',
  reason: 'ok',
};

/**
 * The non-claimable fresh-install access result rendered as a blocking state.
 */
export const freshInstallAccess: ApplicationAccess = {
  allowed: false,
  role: null,
  email: '',
  reason: 'freshInstall',
};

/**
 * The broken-configuration access result rendered as a blocking state.
 */
export const brokenConfigAccess: ApplicationAccess = {
  allowed: false,
  role: null,
  email: '',
  reason: 'brokenConfig',
};

/**
 * The access-denied result rendered as a blocking state.
 */
export const deniedAccess: ApplicationAccess = {
  allowed: false,
  role: null,
  email: '',
  reason: 'denied',
};

/**
 * Creates a React Query client wrapper for the auth gate specs.
 *
 * @returns {{ queryClient: ReturnType<typeof createAppQueryClient>; QueryWrapper(properties: Readonly<PropsWithChildren>): JSX.Element }} The query client and provider wrapper.
 */
export function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  /**
   * Wraps children in the shared test query client.
   *
   * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
   * @returns {JSX.Element} The wrapped children.
   */
  function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, QueryWrapper };
}
