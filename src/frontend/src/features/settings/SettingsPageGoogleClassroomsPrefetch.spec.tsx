import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { SettingsPageGoogleClassroomsPrefetch } from './SettingsPageGoogleClassroomsPrefetch';

/**
 * Renders the prefetch component with a supplied query client.
 *
 * @param {ReturnType<typeof createAppQueryClient>} queryClient Query client used for the render.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderPrefetchComponent(queryClient = createAppQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPageGoogleClassroomsPrefetch />
    </QueryClientProvider>
  );
}

type GoogleClassroomsQueryState = ReturnType<
  ReturnType<typeof createAppQueryClient>['getQueryState']
>;

/**
 * Sets up shared query and logging spies for a given query state.
 *
 * @param {GoogleClassroomsQueryState} queryState Query state returned after prefetch resolves.
 * @returns {{querySpy: ReturnType<typeof vi.spyOn>, consoleWarnSpy: ReturnType<typeof vi.spyOn>}} Shared spies.
 */
function setupPrefetchStateTest(queryState: GoogleClassroomsQueryState) {
  const queryClient = createAppQueryClient();
  const querySpy = vi.spyOn(queryClient, 'query').mockImplementation(() => Promise.resolve([]));
  vi.spyOn(queryClient, 'getQueryState').mockReturnValue(queryState);
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  renderPrefetchComponent(queryClient);

  return {
    querySpy,
    consoleWarnSpy,
  };
}

describe('SettingsPageGoogleClassroomsPrefetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a warning when the query resolves to an error state', async () => {
    const { querySpy, consoleWarnSpy } = setupPrefetchStateTest({
      status: 'error',
      error: new Error('Prefetch failed.'),
    } as GoogleClassroomsQueryState);

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      'features/settings/SettingsPageGoogleClassroomsPrefetch.prefetchGoogleClassrooms'
    );
  });

  it('does not log when the query resolves successfully', async () => {
    const { querySpy, consoleWarnSpy } = setupPrefetchStateTest({
      status: 'success',
    } as GoogleClassroomsQueryState);

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('does not log when the query completes without a stored query state', async () => {
    const { querySpy, consoleWarnSpy } = setupPrefetchStateTest(void 0);

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('logs transport metadata when the query resolves to an ApiTransportError', async () => {
    const transportError = new ApiTransportError({
      requestId: 'req-google-classrooms-1',
      error: {
        code: 'RATE_LIMITED',
        message: 'Google Classrooms prefetch failed.',
        isRetriable: true,
      },
    });
    const { querySpy, consoleWarnSpy } = setupPrefetchStateTest({
      status: 'error',
      error: transportError,
    } as GoogleClassroomsQueryState);

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    const logCall = consoleWarnSpy.mock.calls[0];

    expect(logCall?.[0]).toBe(
      'features/settings/SettingsPageGoogleClassroomsPrefetch.prefetchGoogleClassrooms'
    );
    expect(logCall?.[1]).toMatchObject({
      context: 'features/settings/SettingsPageGoogleClassroomsPrefetch.prefetchGoogleClassrooms',
      requestId: 'req-google-classrooms-1',
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Google Classrooms prefetch failed.',
      metadata: {
        dataset: 'googleClassrooms',
        queryKey: ['googleClassrooms'],
        page: 'settings',
      },
    });
    expect(logCall?.[1]).not.toHaveProperty('isRetriable');
  });

  it('logs a rejected query with its ApiTransportError metadata while mounted', async () => {
    const transportError = new ApiTransportError({
      requestId: 'req-google-classrooms-rejected',
      error: {
        code: 'RATE_LIMITED',
        message: 'Google Classrooms request rejected.',
        isRetriable: true,
      },
    });
    const queryClient = createAppQueryClient();
    const querySpy = vi.spyOn(queryClient, 'query').mockRejectedValue(transportError);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPrefetchComponent(queryClient);

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy.mock.calls[0]?.[1]).toMatchObject({
      requestId: 'req-google-classrooms-rejected',
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Google Classrooms request rejected.',
      metadata: {
        dataset: 'googleClassrooms',
        queryKey: ['googleClassrooms'],
        page: 'settings',
      },
    });
  });

  it('does not inspect query state after unmounting before prefetch resolves', async () => {
    const queryClient = createAppQueryClient();
    const { promise: prefetchPromise, resolve: resolvePrefetch } = Promise.withResolvers<[]>();

    vi.spyOn(queryClient, 'query').mockImplementation(() => prefetchPromise);
    const getQueryStateSpy = vi.spyOn(queryClient, 'getQueryState');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { unmount } = renderPrefetchComponent(queryClient);

    unmount();
    resolvePrefetch([]);
    await prefetchPromise;
    await Promise.resolve();

    expect(getQueryStateSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('does not inspect or log a rejected query after unmounting', async () => {
    const queryClient = createAppQueryClient();
    const transportError = new ApiTransportError({
      requestId: 'req-google-classrooms-unmounted',
      error: {
        code: 'RATE_LIMITED',
        message: 'Google Classrooms request rejected.',
        isRetriable: true,
      },
    });
    const { promise: queryPromise, reject: rejectQuery } = Promise.withResolvers<[]>();

    vi.spyOn(queryClient, 'query').mockImplementation(() => queryPromise);
    const getQueryStateSpy = vi.spyOn(queryClient, 'getQueryState');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderPrefetchComponent(queryClient);

    unmount();
    rejectQuery(transportError);
    await expect(queryPromise).rejects.toBe(transportError);
    await Promise.resolve();

    expect(getQueryStateSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
