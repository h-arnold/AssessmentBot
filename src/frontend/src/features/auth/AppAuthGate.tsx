import { useQueryClient } from '@tanstack/react-query';
import { Button, Result, Spin } from 'antd';
import type { PropsWithChildren } from 'react';
import { mapErrorToUserMessage } from '../../errors/map-error-to-ui';
import { getAuthorisationStatusQueryOptions } from '../../query/sharedQueries';
import { StartupWarmupStateProvider } from './startupWarmupState';
import { useAuthorisationStatus } from './useAuthorisationStatus';
import { useApplicationAccess } from './useApplicationAccess';
import { useStartupWarmupCycle } from './useStartupWarmupCycle';
import { ApplicationAccessContext } from './ApplicationAccessContext';
import {
  ApplicationAccessBlockingResult,
  OAuthTransportErrorResult,
  PermissionsRequiredResult,
} from './AuthGateStates';

/**
 * Derives whether the application-access query should run from the OAuth admission state.
 *
 * @param {boolean} isAuthorised Whether OAuth authorisation resolved as authorised.
 * @param {string | null} oauthError The OAuth transport error, or null when healthy.
 * @returns {boolean} True only when OAuth is authorised without an outstanding error.
 */
function isApplicationAccessEnabled(isAuthorised: boolean, oauthError: string | null): boolean {
  return isAuthorised && !oauthError;
}

/**
 * Provides an auth-aware, fail-closed boundary that resolves application access and
 * then prefetches the startup warm-up datasets.
 *
 * @remarks
 * OAuth gating (`useAuthorisationStatus`) runs first and unchanged. Once OAuth resolves
 * authorised, the gate resolves the caller's application access via `getApplicationAccess`
 * and mounts `ApplicationAccessContext.Provider` around its children subtree with the
 * resolved `{ role, reason, allowed, email }` contract; `SettingsPage` consumes that
 * context to gate the Authentication tab without issuing a second query. Admission is
 * based solely on `getApplicationAccess` `reason === 'ok'`; `freshInstall` (non-claimable
 * callers), `brokenConfig`, and `denied` each render a blocking `Result` surface.
 *
 * The startup warm-up datasets are a post-admission prefetch: the gate fires them after
 * admission and publishes their state through `StartupWarmupStateProvider`, but they no
 * longer determine admission or block the protected children. A warm-up failure is logged
 * and the failure status is published to the provider; it does not fail closed the shell.
 *
 * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
 * @returns {JSX.Element} The auth gate wrapper.
 */
export function AppAuthGate(properties: Readonly<PropsWithChildren>) {
  const { children } = properties;
  const queryClient = useQueryClient();
  const { isAuthorised, isLoading: isAuthorising, error: oauthError } = useAuthorisationStatus();
  const accessQuery = useApplicationAccess(isApplicationAccessEnabled(isAuthorised, oauthError));
  const warmupCycleState = useStartupWarmupCycle(queryClient, isAuthorised, oauthError, isAuthorising);

  // OAuth gating runs first and unchanged.
  if (isAuthorising) {
    return (
      <output aria-busy="true" aria-label="Loading authorisation status">
        <Spin />
        <span aria-hidden="true">Loading authorisation status</span>
      </output>
    );
  }

  if (oauthError) {
    return (
      <OAuthTransportErrorResult
        title={oauthError}
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: getAuthorisationStatusQueryOptions().queryKey,
          });
        }}
      />
    );
  }

  if (!isAuthorised) {
    return <PermissionsRequiredResult />;
  }

  // Application-access gating: admission is based solely on the resolved access reason.
  if (accessQuery.isPending) {
    return (
      <output aria-busy="true" aria-label="Verifying access">
        <Spin />
        <span aria-hidden="true">Verifying access</span>
      </output>
    );
  }

  if (accessQuery.isError) {
    return (
      <Result
        status="error"
        title={mapErrorToUserMessage(accessQuery.error)}
        extra={
          <Button type="primary" onClick={() => void accessQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const access = accessQuery.data;

  if (access.reason !== 'ok') {
    return <ApplicationAccessBlockingResult reason={access.reason} />;
  }

  // Admitted: deliver the access contract to descendants and prefetch warm-up data.
  return (
    <ApplicationAccessContext.Provider
      value={{
        allowed: access.allowed,
        role: access.role,
        email: access.email,
        reason: access.reason,
      }}
    >
      <StartupWarmupStateProvider
        warmupState={warmupCycleState.status}
        snapshot={warmupCycleState.snapshot}
      >
        {children}
      </StartupWarmupStateProvider>
    </ApplicationAccessContext.Provider>
  );
}
