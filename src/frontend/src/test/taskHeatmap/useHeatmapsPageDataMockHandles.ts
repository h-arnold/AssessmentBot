/**
 * Holds the hoisted doubles registered by `useHeatmapsPageData.mockSetup`.
 *
 * @remarks
 * The analysis service is mocked as a class whose instances expose `analyse`,
 * so that double cannot be reached through `vi.mocked(DataAnalysisService)`.
 * The setup module publishes every hoisted factory here and the spec harness
 * binds them, keeping the original `vi.fn()` signatures. This module has no
 * side effects.
 */

import type { Mock } from 'vitest';

/** The hoisted doubles published by `useHeatmapsPageData.mockSetup`. */
export type HeatmapsPageDataMockHandles = {
  mockUseQuery: Mock;
  mockUseQueries: Mock;
  mockUsePageDataset: Mock;
  mockGetABClassQueryOptions: Mock;
  mockGetAssignmentQueryOptions: Mock;
  mockAnalyse: Mock;
  mockAdaptMergedHeatmap: Mock;
  mockAssembleMergedPreviewData: Mock;
};

/** Registration-time slot filled by `useHeatmapsPageData.mockSetup`. */
export const heatmapsPageDataMockHandles: { current: HeatmapsPageDataMockHandles | undefined } = {
  current: undefined,
};
