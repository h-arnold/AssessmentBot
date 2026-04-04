import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StartupWarmupStateProvider, type StartupWarmupStatus } from '../features/auth/startupWarmupState';
import { createAppQueryClient } from '../query/queryClient';

type FrontendProvidersOptions = Readonly<{
  queryClient?: QueryClient;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
  warmupState?: StartupWarmupStatus;
}>;

/**
 * Renders frontend UI with shared providers used by feature pages in tests.
 *
 * @param {ReactElement} ui UI to render.
 * @param {FrontendProvidersOptions} [options] Optional provider overrides.
 * @returns {ReturnType<typeof render> & { queryClient: QueryClient }} Render result and query client.
 */
export function renderWithFrontendProviders(
  ui: ReactElement,
  options: FrontendProvidersOptions = {}
) {
  const queryClient = options.queryClient ?? createAppQueryClient();
  const warmupState = options.warmupState ?? 'ready';

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <StartupWarmupStateProvider warmupState={warmupState}>{ui}</StartupWarmupStateProvider>
      </QueryClientProvider>,
      options.renderOptions
    ),
  };
}
