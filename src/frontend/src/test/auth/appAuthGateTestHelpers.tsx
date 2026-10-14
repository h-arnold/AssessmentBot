import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { createAppQueryClient } from '../../query/queryClient';
import type { ApplicationAccess } from '../../services/authService/authService.zod';

export type AppAuthGateMocks = Readonly<{
  getAuthorisationStatusMock: ReturnType<typeof vi.fn>;
  getApplicationAccessMock: ReturnType<typeof vi.fn>;
  warmStartupQueriesMock: ReturnType<typeof vi.fn>;
}>;

export type AppAuthGateServiceMockModule = Readonly<{
  hasScriptAuthorisation: AppAuthGateMocks['getAuthorisationStatusMock'];
  getApplicationAccess: AppAuthGateMocks['getApplicationAccessMock'];
}>;

/**
 * Creates the auth-service module shape used by each spec's local Vitest mock.
 *
 * @param {AppAuthGateMocks} mocks The spec-local service mocks.
 * @returns {AppAuthGateServiceMockModule} The mocked auth-service exports.
 */
export function createAppAuthGateServiceMockModule(
  mocks: AppAuthGateMocks
): AppAuthGateServiceMockModule {
  return {
    hasScriptAuthorisation: mocks.getAuthorisationStatusMock,
    getApplicationAccess: mocks.getApplicationAccessMock,
  };
}

/**
 * Adds the spec-local startup warm-up mock to the actual shared-query exports.
 *
 * @param {T} actual The real shared-query module exports.
 * @param {AppAuthGateMocks} mocks The spec-local auth-gate mocks.
 * @returns {T & Readonly<{ warmStartupQueries: AppAuthGateMocks['warmStartupQueriesMock'] }>} The shared-query exports with warm-up replaced by its mock.
 */
export function createAppAuthGateSharedQueriesMockModule<T extends object>(
  actual: T,
  mocks: AppAuthGateMocks
): T & Readonly<{ warmStartupQueries: AppAuthGateMocks['warmStartupQueriesMock'] }> {
  return {
    ...actual,
    warmStartupQueries: mocks.warmStartupQueriesMock,
  };
}

/**
 * Creates the shared service mocks consumed by the auth gate specs.
 *
 * Call this inside `vi.hoisted` so the returned mocks can be referenced by the
 * hoisted `vi.mock` factories for the auth service and shared queries.
 *
 * @returns {AppAuthGateMocks} The `hasScriptAuthorisation`, `getApplicationAccess`, and `warmStartupQueries` mocks.
 */
export function createAppAuthGateMocks(): AppAuthGateMocks {
  return {
    getAuthorisationStatusMock: vi.fn(),
    getApplicationAccessMock: vi.fn(),
    warmStartupQueriesMock: vi.fn(),
  };
}

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
