import '@/test/auth/appAuthGateWarmup.mockSetup';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '@/errors/apiTransportError';
import { createQueryWrapper, grantedAdminAccess } from '@/test/auth/appAuthGateTestHelpers';
import { getAppAuthGateWarmupMocks } from '@/test/auth/appAuthGateWarmupMockHandles';
import { StartupWarmupProbe } from '@/test/auth/appAuthGateWarmupProbe';
import { createDeferredPromise } from '@/test/shared/testDeferredPromise';
import { AuthStatusCard } from '../AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';

const { getAuthorisationStatusMock, getApplicationAccessMock, warmStartupQueriesMock } =
  getAppAuthGateWarmupMocks();

const GRANTED_ACCESS = grantedAdminAccess;

describe('AppAuthGate admission', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('blocks protected children until authorisation resolves, then verifies access and tracks warm-up state', async () => {
    const deferredAuth = createDeferredPromise<boolean>();
    const deferredAccess = createDeferredPromise<typeof GRANTED_ACCESS>();
    const deferredWarmup = createDeferredPromise<void>();
    const { QueryWrapper, queryClient } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(deferredAuth.promise);
    getApplicationAccessMock.mockReturnValueOnce(deferredAccess.promise);
    warmStartupQueriesMock.mockReturnValueOnce(deferredWarmup.promise);

    render(
      <AppAuthGate>
        <AuthStatusCard />
        <StartupWarmupProbe />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    // OAuth still pending: the OAuth authorisation status surface is shown and the
    // protected children are not yet rendered.
    expect(
      screen.getByRole('status', { name: 'Loading authorisation status' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

    // OAuth has resolved but application access is still loading: fail-closed "Verifying access"
    // surface is shown and the protected children remain hidden.
    deferredAuth.resolvePromise(true);
    const verifyingSurface = await screen.findByRole('status', { name: 'Verifying access' });
    expect(verifyingSurface).toBeInTheDocument();
    expect(verifyingSurface).toHaveTextContent('Verifying access');
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();
    expect(screen.queryByTestId('startup-warmup-probe')).not.toBeInTheDocument();

    // Access resolves granted: admission completes, the warm-up prefetch starts, and the
    // protected children render inside the warm-up provider with a loading warm-up state.
    deferredAccess.resolvePromise(GRANTED_ACCESS);

    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledWith(queryClient);
    });

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'loading',
        isLoading: true,
        isReady: false,
        isFailed: false,
      })
    );

    // Warm-up reaches ready: the warm-up state publishes `ready`.
    deferredWarmup.resolvePromise();

    await waitFor(() => {
      expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
        JSON.stringify({
          warmupState: 'ready',
          isLoading: false,
          isReady: true,
          isFailed: false,
        })
      );
    });

    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    expect(getApplicationAccessMock).toHaveBeenCalledTimes(1);
  });

  it('renders the permissions-required gate surface without starting application access or warm-up', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockResolvedValueOnce(false);

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(await screen.findByText('Permissions required')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorised')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Loading authorisation status' })
    ).not.toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
    expect(getApplicationAccessMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('does not block the shell on a FORBIDDEN warm-up failure because admission is access-based', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { QueryWrapper } = createQueryWrapper();
    const forbiddenError = new ApiTransportError({
      requestId: 'req-warmup-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', isRetriable: false },
    });
    getAuthorisationStatusMock.mockResolvedValueOnce(true);
    getApplicationAccessMock.mockResolvedValueOnce({ ...GRANTED_ACCESS });
    warmStartupQueriesMock.mockRejectedValueOnce(forbiddenError);

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'You do not have permission to access this application. Please contact your administrator.'
      )
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(warmStartupQueriesMock).toHaveBeenCalledTimes(1);
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it('renders a status region with a visible spinner while authorisation is pending', () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(new Promise<boolean>(() => {}));

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    const statusRegion = screen.getByRole('status', { name: 'Loading authorisation status' });
    expect(statusRegion).toBeInTheDocument();
    // The loading region must pair accessible status semantics with a visible spinner
    // (an Ant Design Spin that carries role="status", or a status element containing one).
    expect(
      statusRegion.classList.contains('ant-spin') ||
        statusRegion.querySelector('.ant-spin') !== null
    ).toBe(true);
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('marks the authorisation and access loading status regions busy for assistive technology', async () => {
    const deferredAuth = createDeferredPromise<boolean>();
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockReturnValueOnce(deferredAuth.promise);
    getApplicationAccessMock.mockImplementationOnce(() => new Promise(() => {}));
    // This test only observes the loading surfaces and does not assert warm-up gating.
    // The never-resolving double is a defensive stub so an unexpected warm-up start
    // cannot disturb those assertions; warm-up gating is covered by
    // AppAuthGate.applicationAccess.spec.tsx.
    warmStartupQueriesMock.mockReturnValueOnce(new Promise(() => {}));

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    const authorisationStatus = screen.getByRole('status', {
      name: 'Loading authorisation status',
    });
    expect(authorisationStatus).toHaveAttribute('aria-busy', 'true');

    deferredAuth.resolvePromise(true);

    const accessStatus = await screen.findByRole('status', { name: 'Verifying access' });
    expect(accessStatus).toHaveAttribute('aria-busy', 'true');
  });
});
