import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { getNavigationLabel } from '../navigation/appNavigation';
import { createAppQueryClient } from '../query/queryClient';
import {
  applicationAccessMethodName,
  assignmentDefinitionPartialsMethodName,
  assignmentTopicsMethodName,
  authStatusMethodName,
  buildResolvedWarmupResponses,
  classPartialsMethodName,
  cohortsMethodName,
  googleClassroomsMethodName,
  installApiHandlerMock,
  loadingAuthorisationStatusLabel,
  primaryNavigationLabel,
  renderApp,
  yearGroupsMethodName,
} from '@/test/shell/appSpecHarness';

describe('App startup warm-up', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('does not start class-partials warm-up while auth is unresolved', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: 'pending',
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    await act(async () => {
      renderApp();
    });

    expect(
      screen.getByRole('status', { name: loadingAuthorisationStatusLabel })
    ).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('keeps navigation ready once startup warm-up has settled', async () => {
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('1'));

    renderApp();

    // The fail-closed gate only reveals the shell after the warm-up settles.
    expect(
      await screen.findByRole('navigation', { name: primaryNavigationLabel })
    ).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('keeps startup warm-up idempotent across remounts with the same query client', async () => {
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('3'));
    const queryClient = createAppQueryClient();

    const firstRender = renderApp(queryClient);

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);

    firstRender.unmount();
    renderApp(queryClient);

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('does not trigger extra class-partials warm-up during in-app navigation', async () => {
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('4'));

    renderApp();

    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    act(() => {
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('settings') })
      );
    });

    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('logs one warm-up failure and still reveals the shell when startup warm-up fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-2',
        data: true,
      },
      [applicationAccessMethodName]: {
        ok: true,
        requestId: 'req-app-access-2',
        data: {
          allowed: true,
          role: 'admin',
          email: 'owner@example.com',
          reason: 'ok',
        },
      },
      [classPartialsMethodName]: {
        transportFailure: new Error('Class partial warm-up failed.'),
      },
      [assignmentTopicsMethodName]: {
        ok: true,
        requestId: 'req-topics-1',
        data: [],
      },
      [assignmentDefinitionPartialsMethodName]: {
        ok: true,
        requestId: 'req-def-partials-1',
        data: [],
      },
      [cohortsMethodName]: {
        ok: true,
        requestId: 'req-cohorts-1',
        data: [],
      },
      [yearGroupsMethodName]: {
        ok: true,
        requestId: 'req-yeargroups-1',
        data: [],
      },
      [googleClassroomsMethodName]: {
        ok: true,
        requestId: 'req-classrooms-1',
        data: [],
      },
    });

    renderApp();

    // A failed warm-up no longer blocks the shell: admission is based on application access, so
    // the dashboard is revealed and the failure is logged for operator visibility.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(screen.queryByText('An error occurred. Please try again.')).not.toBeInTheDocument();

    // The startup warm-up failure is still logged exactly once.
    await waitFor(() => {
      expect(
        consoleErrorSpy.mock.calls.filter(
          (call) => call[0] === 'features/auth/useStartupWarmupCycle'
        )
      ).toHaveLength(1);
    });
  });
});
