import { act, screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  applicationAccessMethodName,
  assignmentDefinitionPartialsMethodName,
  assignmentTopicsMethodName,
  authStatusMethodName,
  classPartialsMethodName,
  cohortsMethodName,
  googleClassroomsMethodName,
  installApiHandlerMock,
  installDeferredApiHandlerMock,
  loadingAuthorisationStatusLabel,
  renderApp,
  yearGroupsMethodName,
} from '@/test/shell/appSpecHarness';

const unableToCheckAuthorisationStatusMessage = 'An error occurred. Please try again.';

/**
 * Asserts the unauthorised auth-gate outcome, including optional explanatory copy.
 *
 * @param {{ getCallCount(method: string): number } | null} transport Transport harness when one is installed.
 * @param {{ expectedMessage?: string }} [options] Optional assertion options.
 * @param {string} [options.expectedMessage] Optional message expected in the unauthorised state.
 * @returns {Promise<void>} Resolves once async auth-state assertions complete.
 */
async function expectUnauthorisedOutcome(
  transport: { getCallCount(method: string): number } | null,
  options: { expectedMessage?: string } = {}
) {
  expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
  if (options.expectedMessage === undefined) {
    expect(
      await screen.findByText('Permissions required', {}, { timeout: 10_000 })
    ).toBeInTheDocument();
  } else {
    expect(
      await screen.findByText(options.expectedMessage, {}, { timeout: 10_000 })
    ).toBeInTheDocument();
  }

  if (transport !== null) {
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  }
}

describe('App authorisation status', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('shows loading then authorised status when backend returns true', async () => {
    const transport = installDeferredApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-1',
        data: true,
      },
      [applicationAccessMethodName]: {
        ok: true,
        requestId: 'req-app-access-1',
        data: {
          allowed: true,
          role: 'admin',
          email: 'owner@example.com',
          reason: 'ok',
        },
      },
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    renderApp();

    // OAuth status is still resolving: the loading surface is shown.
    expect(
      screen.getByRole('status', { name: loadingAuthorisationStatusLabel })
    ).toBeInTheDocument();

    // OAuth resolves authorised and application access is granted, so the gate admits the shell.
    // The warm-up prefetch runs after admission, so the dashboard is revealed while warm-up is
    // still pending rather than being held behind it.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    // Release every warm-up dataset so the startup warm-up settles to ready.
    await act(async () => {
      transport.release(classPartialsMethodName, {
        ok: true,
        requestId: 'req-class-partials-1',
        data: [],
      });
      transport.release(assignmentTopicsMethodName, {
        ok: true,
        requestId: 'req-topics-1',
        data: [],
      });
      transport.release(assignmentDefinitionPartialsMethodName, {
        ok: true,
        requestId: 'req-def-partials-1',
        data: [],
      });
      transport.release(cohortsMethodName, {
        ok: true,
        requestId: 'req-cohorts-1',
        data: [],
      });
      transport.release(yearGroupsMethodName, {
        ok: true,
        requestId: 'req-yeargroups-1',
        data: [],
      });
    });

    // Warm-up ready: the shell remains revealed.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(applicationAccessMethodName)).toBe(1);
  });

  it('shows unauthorised status when backend returns false', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-2',
        data: false,
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport);
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
  });

  it('shows backend failure message when backend returns a failure envelope', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: false,
        requestId: 'req-3',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Backend authorisation check failed.',
        },
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport, {
      expectedMessage:
        'An internal error occurred. Please try again or contact support if the issue persists.',
    });
  });

  it('shows string failure message when transport fails with a non-Error value', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        transportFailure: 'Backend call failed with a string.',
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport, {
      expectedMessage: unableToCheckAuthorisationStatusMessage,
    });
  });

  it('shows rate-limited message when backend returns retriable rate limit envelope', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: false,
        requestId: 'req-rl-1',
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited.',
          isRetriable: true,
        },
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport, {
      expectedMessage: 'Too many requests. Please wait a moment and try again.',
    });
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    vi.stubGlobal('google', undefined);
    renderApp();

    await expectUnauthorisedOutcome(null, {
      expectedMessage: unableToCheckAuthorisationStatusMessage,
    });
  });
});
