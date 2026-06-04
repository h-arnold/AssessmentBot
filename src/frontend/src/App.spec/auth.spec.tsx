/**
 * Auth tests for App.
 */

import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  loadingAuthorisationStatusLabel,
  applicationTitleText,
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
  unableToCheckAuthorisationStatusMessage,
  expectUnauthorisedOutcome,
} from './shared-setup';

describe('App auth', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('does not regress existing auth card mounting path', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const mainRegion = screen.getByRole('main');

    expect(within(mainRegion).getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
  });

  it('shows loading then authorised status when backend returns true', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-1',
        data: true,
      },
      [classPartialsMethodName]: {
        ok: true,
        requestId: 'req-class-partials-1',
        data: [],
      },
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    renderApp();

    expect(screen.getByRole('banner')).toHaveTextContent(applicationTitleText);
    expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    await waitFor(() => {
      expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
    });
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
      expectedMessage: unableToCheckAuthorisationStatusMessage,
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
          retriable: true,
        },
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport, {
      expectedMessage: 'The service is busy. Please try again shortly.',
    });
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    renderApp();

    await expectUnauthorisedOutcome(null, {
      expectedMessage: unableToCheckAuthorisationStatusMessage,
    });
  });
});
