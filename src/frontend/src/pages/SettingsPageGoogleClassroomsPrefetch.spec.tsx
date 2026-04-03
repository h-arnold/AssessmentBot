import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
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

describe('SettingsPageGoogleClassroomsPrefetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a warning when the prefetched query resolves to an error state', async () => {
    const queryClient = createAppQueryClient();
    const prefetchQuerySpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockImplementation(() => Promise.resolve());
    vi.spyOn(queryClient, 'getQueryState').mockReturnValue({
      status: 'error',
      error: new Error('Prefetch failed.'),
    } as ReturnType<typeof queryClient.getQueryState>);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderPrefetchComponent(queryClient);

    await waitFor(() => {
      expect(prefetchQuerySpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      'pages/SettingsPageGoogleClassroomsPrefetch.prefetchGoogleClassrooms'
    );
  });

  it('does not log when the prefetched query resolves successfully', async () => {
    const queryClient = createAppQueryClient();
    const prefetchQuerySpy = vi
      .spyOn(queryClient, 'prefetchQuery')
      .mockImplementation(() => Promise.resolve());
    vi.spyOn(queryClient, 'getQueryState').mockReturnValue({
      status: 'success',
    } as ReturnType<typeof queryClient.getQueryState>);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderPrefetchComponent(queryClient);

    await waitFor(() => {
      expect(prefetchQuerySpy).toHaveBeenCalledTimes(1);
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('does not inspect query state after unmounting before prefetch resolves', async () => {
    const queryClient = createAppQueryClient();
    let resolvePrefetch: (() => void) | undefined;
    const prefetchPromise = new Promise<void>((resolve) => {
      resolvePrefetch = resolve;
    });

    vi.spyOn(queryClient, 'prefetchQuery').mockImplementation(() => prefetchPromise);
    const getQueryStateSpy = vi.spyOn(queryClient, 'getQueryState');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { unmount } = renderPrefetchComponent(queryClient);

    unmount();
    resolvePrefetch?.();
    await prefetchPromise;
    await Promise.resolve();

    expect(getQueryStateSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
