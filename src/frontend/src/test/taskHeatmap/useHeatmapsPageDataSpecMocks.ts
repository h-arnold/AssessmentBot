/**
 * Typed handles and shared setup for the `useHeatmapsPageData` hook specs.
 *
 * @remarks
 * Import `./useHeatmapsPageData.mockSetup` before the production hook so the
 * doubles register first; this module only binds the handles and supplies the
 * per-spec harness, so it stays free of registration side effects.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { StartupWarmupDatasetKey } from '@/query/sharedQueries';
import { createTestWrapper } from '@/test/heatmapsPageDataFixtures';
import { createTestQueryClient } from '@/test/dataAnalysis/heatmapFixtures';
import { createReadyHeatmapsDatasetResult } from './hookMockFactories';
import {
  heatmapsPageDataMockHandles,
  type HeatmapsPageDataMockHandles,
} from './useHeatmapsPageDataMockHandles';

/**
 * Reads the hoisted doubles published by `useHeatmapsPageData.mockSetup`.
 *
 * @returns {HeatmapsPageDataMockHandles} The registered doubles.
 */
function getMockHandles(): HeatmapsPageDataMockHandles {
  const handles = heatmapsPageDataMockHandles.current;
  if (handles == null) {
    throw new Error(
      'useHeatmapsPageDataSpecMocks: import useHeatmapsPageData.mockSetup before this module.'
    );
  }
  return handles;
}

/** Typed handles onto the doubles registered by `useHeatmapsPageData.mockSetup`. */
export const heatmapsPageDataMocks = getMockHandles();

/**
 * Installs the dynamic query mock, including React Query's combine callback.
 *
 * @returns {void}
 */
export function installUseQueriesMock(): void {
  const { mockUseQueries: useQueriesMock, mockUseQuery: useQueryMock } = heatmapsPageDataMocks;
  useQueriesMock.mockImplementation(
    (options: {
      queries: ReadonlyArray<unknown>;
      combine?: (results: ReadonlyArray<unknown>) => unknown;
    }) => {
      const results = options.queries.map((query) => useQueryMock(query));
      return typeof options.combine === 'function' ? options.combine(results) : results;
    }
  );
}

/**
 * Creates a fresh query client and its `renderHook` wrapper, then installs the
 * dynamic query mock.
 *
 * @returns {object} The query client and its wrapper component.
 */
export function createHeatmapsPageDataHarness(): {
  queryClient: QueryClient;
  wrapper: ReturnType<typeof createTestWrapper>;
} {
  const queryClient = createTestQueryClient();
  installUseQueriesMock();
  return { queryClient, wrapper: createTestWrapper(queryClient) };
}

/**
 * Configures both selector datasets as trustworthily ready.
 *
 * @returns {void}
 */
export function mockWarmupDatasetsReady(): void {
  heatmapsPageDataMocks.mockUsePageDataset.mockImplementation(
    (datasetKey: StartupWarmupDatasetKey) => createReadyHeatmapsDatasetResult(datasetKey)
  );
}
