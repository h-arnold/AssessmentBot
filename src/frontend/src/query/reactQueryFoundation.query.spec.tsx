import packageJsonText from '../../package.json?raw';
import { StrictMode, type ComponentType, type PropsWithChildren } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

type QueryModule = {
  createAppQueryClient: () => {
    getDefaultOptions: () => {
      queries?: {
        staleTime?: number;
        gcTime?: number;
        retry?: boolean | number | ((failureCount: number, error: Error) => boolean);
        refetchOnWindowFocus?: boolean | 'always';
        refetchOnReconnect?: boolean | 'always';
        refetchOnMount?: boolean | 'always';
      };
    };
  };
  queryClient: {
    getDefaultOptions: () => {
      queries?: {
        staleTime?: number;
        gcTime?: number;
        retry?: boolean | number | ((failureCount: number, error: Error) => boolean);
        refetchOnWindowFocus?: boolean | 'always';
        refetchOnReconnect?: boolean | 'always';
        refetchOnMount?: boolean | 'always';
      };
    };
  };
};

type QueryProviderModule = {
  AppQueryProvider: ComponentType<PropsWithChildren>;
};

type QueryKeysModule = {
  queryKeys: {
    classPartials: () => readonly ['classPartials'];
    cohorts: () => readonly ['cohorts'];
    yearGroups: () => readonly ['yearGroups'];
  };
};

const reactQueryModuleId = '@tanstack/react-query';

/**
 * Imports a required module and fails with a clear message if it is missing.
 *
 * @param {string} relativePath - The module path relative to this spec file.
 * @returns {Promise<TModule>} The imported module.
 */
async function importRequiredModule<TModule>(relativePath: string): Promise<TModule> {
  try {
    return (await import(new URL(relativePath, import.meta.url).href)) as TModule;
  } catch (error) {
    throw new Error(`${relativePath} should exist.`, { cause: error });
  }
}

afterEach(() => {
  cleanup();
});

describe('React Query foundation', () => {
  it('pins @tanstack/react-query to 5.90.21 in the frontend package', () => {
    const packageJson = JSON.parse(packageJsonText) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.['@tanstack/react-query']).toBe('5.90.21');
  });

  it('renders children inside QueryClientProvider via the dedicated app query provider', async () => {
    const { AppQueryProvider } =
      await importRequiredModule<QueryProviderModule>('./AppQueryProvider.tsx');
    const { queryClient } = await importRequiredModule<QueryModule>('./queryClient.ts');
    const { useQueryClient } = await import(reactQueryModuleId);

    /**
     * Confirms the React Query client is available from provider context.
      *
      * @returns {JSX.Element} The query client probe element.
     */
    function QueryClientProbe() {
      const isExpectedQueryClient = useQueryClient() === queryClient;

      return <div data-testid="query-client-present">{String(isExpectedQueryClient)}</div>;
    }

    render(
      <AppQueryProvider>
        <QueryClientProbe />
      </AppQueryProvider>
    );

    expect(screen.getByTestId('query-client-present')).toHaveTextContent('true');
    expect(queryClient).toBeTruthy();
  });

  it('exposes shared query-key helpers for classPartials, cohorts, and yearGroups', async () => {
    const { queryKeys } = await importRequiredModule<QueryKeysModule>('./queryKeys.ts');

    expect(queryKeys.classPartials()).toEqual(['classPartials']);
    expect(queryKeys.cohorts()).toEqual(['cohorts']);
    expect(queryKeys.yearGroups()).toEqual(['yearGroups']);
  });

  it('defines the shared query client factory and baseline defaults explicitly', async () => {
    const { createAppQueryClient, queryClient } =
      await importRequiredModule<QueryModule>('./queryClient.ts');

    expect(typeof createAppQueryClient).toBe('function');
    expect(queryClient).toBeTruthy();
    expect(createAppQueryClient()).toBeTruthy();

    const singletonDefaultOptions = queryClient.getDefaultOptions().queries;
    const factoryDefaultOptions = createAppQueryClient().getDefaultOptions().queries;

    expect(singletonDefaultOptions).toEqual(factoryDefaultOptions);
    expect(singletonDefaultOptions?.staleTime).toBeGreaterThan(0);
    expect(singletonDefaultOptions?.gcTime).toBe(Infinity);
    expect(singletonDefaultOptions?.retry).toBe(false);
    expect(singletonDefaultOptions?.refetchOnWindowFocus).toBe(false);
    expect(singletonDefaultOptions?.refetchOnReconnect).toBe(false);
    expect(singletonDefaultOptions?.refetchOnMount).toBe(true);
  });

  it('reuses one stable query client instance across provider rerenders and StrictMode remounts', async () => {
    const { AppQueryProvider } =
      await importRequiredModule<QueryProviderModule>('./AppQueryProvider.tsx');
    const { useQueryClient } = await import(reactQueryModuleId);
    const seenClients: unknown[] = [];

    /**
     * Captures each query client reference observed across renders.
      *
      * @returns {JSX.Element} The stable query client probe element.
     */
    function QueryClientProbe() {
      seenClients.push(useQueryClient());

      return <div data-testid="stable-query-client">stable query client</div>;
    }

    const firstRender = render(
      <StrictMode>
        <AppQueryProvider>
          <QueryClientProbe />
        </AppQueryProvider>
      </StrictMode>
    );

    expect(screen.getByTestId('stable-query-client')).toBeInTheDocument();

    firstRender.rerender(
      <StrictMode>
        <AppQueryProvider>
          <QueryClientProbe />
        </AppQueryProvider>
      </StrictMode>
    );

    firstRender.unmount();

    render(
      <StrictMode>
        <AppQueryProvider>
          <QueryClientProbe />
        </AppQueryProvider>
      </StrictMode>
    );

    expect(new Set(seenClients).size).toBe(1);
  });

  it('resolves the same singleton query client instance across multiple imports', async () => {
    const firstImport = await importRequiredModule<QueryModule>('./queryClient.ts');
    const secondImport = await importRequiredModule<QueryModule>('./queryClient.ts');

    expect(firstImport.queryClient).toBe(secondImport.queryClient);
  });
});
