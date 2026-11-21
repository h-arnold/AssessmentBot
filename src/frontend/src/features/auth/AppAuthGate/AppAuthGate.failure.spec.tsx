import '@/test/auth/appAuthGateWarmup.mockSetup';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '@/errors/apiTransportError';
import { createQueryWrapper } from '@/test/auth/appAuthGateTestHelpers';
import { getAppAuthGateWarmupMocks } from '@/test/auth/appAuthGateWarmupMockHandles';
import { AuthStatusCard } from '../AuthStatusCard';
import { AppAuthGate } from './AppAuthGate';

const { getAuthorisationStatusMock, getApplicationAccessMock, warmStartupQueriesMock } =
  getAppAuthGateWarmupMocks();

describe('AppAuthGate failure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('renders the transport error and retry surface without protected children', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-auth-gate-surface',
        error: { code: 'RATE_LIMITED', message: 'Rate limited.', isRetriable: true },
      })
    );

    render(
      <AppAuthGate>
        <output>Protected content</output>
      </AppAuthGate>,
      { wrapper: QueryWrapper }
    );

    expect(
      await screen.findByText('Too many requests. Please wait a moment and try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('preserves the failure auth UI behaviour without starting application access or warm-up', async () => {
    const { QueryWrapper } = createQueryWrapper();
    getAuthorisationStatusMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-auth-gate',
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited.',
          isRetriable: true,
        },
      })
    );

    render(
      <AppAuthGate>
        <AuthStatusCard />
      </AppAuthGate>,
      {
        wrapper: QueryWrapper,
      }
    );

    expect(
      await screen.findByText('Too many requests. Please wait a moment and try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Unauthorised')).not.toBeInTheDocument();
    expect(warmStartupQueriesMock).not.toHaveBeenCalled();
    expect(getApplicationAccessMock).not.toHaveBeenCalled();
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });
});
