/** Registers the shared module mocks for useClassPageData spec files. */
import { vi } from 'vitest';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/hooks/usePageDataset', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, usePageDataset: vi.fn() };
});

vi.mock('@/query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getABClassQueryOptions: vi.fn() };
});

vi.mock('@/services/dataAnalysis/dataAnalysisService', () => {
  /** Mock analysis service with a shared method handle. */
  class MockDataAnalysisService {
    /** Shared analysis mock used by the specs. */
    public static readonly analyse = vi.fn();

    /** Shared analysis mock exposed on hook-created service instances. */
    public readonly analyse = MockDataAnalysisService.analyse;
  }
  return { DataAnalysisService: MockDataAnalysisService };
});

vi.mock('@/features/classPage/classPageAdapter', () => {
  return {
    adaptClassPageToViewModel: vi.fn(),
  };
});
