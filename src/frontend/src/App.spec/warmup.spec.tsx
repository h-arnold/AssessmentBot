/**
 * Startup warmup tests for App.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  installApiHandlerMock,
  installPendingApiHandlerMock,
  renderApp,
  renderPendingApp,
  authStatusMethodName,
  classPartialsMethodName,
  assignmentTopicsMethodName,
  assignmentDefinitionPartialsMethodName,
  cohortsMethodName,
  yearGroupsMethodName,
  googleClassroomsMethodName,
  getNavigationLabel,
  primaryNavigationLabel,
} from './shared-setup';

describe('App warmup', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('does not start class-partials warm-up while auth is unresolved', async () => {
    const transport = installPendingApiHandlerMock();

    await renderPendingApp();

    expect(screen.getByRole('status', { name: 'Loading authorisation status' })).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('keeps navigation ready while startup warm-up runs in the background', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-1',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    renderApp();

    expect(screen.getByRole('navigation', { name: primaryNavigationLabel })).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('keeps startup warm-up idempotent across remounts with the same query client', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-3',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });
    const { createAppQueryClient } = await import('../query/queryClient');
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
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-4',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

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

  it('logs error events when startup warm-up fails without breaking render', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-2',
        data: true,
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

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    await waitFor(() => {
      // Both the API service error and the startup warmup error are logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Verify the startup warmup error context is present in at least one of the calls
      expect(consoleErrorSpy.mock.calls.some(
        (call) => call[0] === 'features/auth/AppAuthGate.startupWarmup'
      )).toBe(true);
    });
  });
});
