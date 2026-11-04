/**
 * Registers the shared module mocks for the `useHeatmapsPageData` hook specs.
 *
 * @remarks
 * Each spec imports this module before `./useHeatmapsPageData` so the doubles
 * are registered before the hook's first instantiation. The hoisted doubles are
 * published through `useHeatmapsPageDataMockHandles` for the spec harness to bind.
 */

import { vi } from 'vitest';
import { heatmapsPageDataMockHandles } from './useHeatmapsPageDataMockHandles';

const {
  mockUseQuery,
  mockUseQueries,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
} = vi.hoisted(() => {
  return {
    mockUseQuery: vi.fn(),
    mockUseQueries: vi.fn(),
    mockUsePageDataset: vi.fn(),
    mockGetABClassQueryOptions: vi.fn(),
    mockGetAssignmentQueryOptions: vi.fn(),
    mockAnalyse: vi.fn(),
    mockAdaptMergedHeatmap: vi.fn(),
    mockAssembleMergedPreviewData: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useQuery: mockUseQuery, useQueries: mockUseQueries };
});

vi.mock('@/hooks/usePageDataset', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, usePageDataset: mockUsePageDataset };
});

vi.mock('@/query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getABClassQueryOptions: mockGetABClassQueryOptions,
    getAssignmentQueryOptions: mockGetAssignmentQueryOptions,
  };
});

vi.mock('@/services/dataAnalysis/dataAnalysisService', () => {
  return {
    DataAnalysisService: vi.fn().mockImplementation(function () {
      return { analyse: mockAnalyse };
    }),
  };
});

vi.mock('@/services/dataAnalysis/heatmapAdapter.merged', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, adaptMetricsToMergedHeatmap: mockAdaptMergedHeatmap };
});

vi.mock('@/features/taskHeatmap/assembleMergedPreviewData', () => {
  return {
    assembleMergedPreviewData: mockAssembleMergedPreviewData,
  };
});

heatmapsPageDataMockHandles.current = {
  mockUseQuery,
  mockUseQueries,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
};
