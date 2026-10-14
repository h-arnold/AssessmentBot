import { vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { usePageDataset } from '../../hooks/usePageDataset';
import { getABClassQueryOptions } from '../../query/sharedQueries';
import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
import { adaptClassPageToViewModel } from '../../features/classPage/classPageAdapter';

/**
 * Binds the mocked module exports for an individual useClassPageData spec.
 * @returns {object} Typed handles for the hook's mocked dependencies.
 */
export function createUseClassPageDataMockHandles() {
  return {
    mockUseQuery: vi.mocked(useQuery),
    mockUsePageDataset: vi.mocked(usePageDataset),
    mockGetABClassQueryOptions: vi.mocked(getABClassQueryOptions),
    mockAnalyse: vi.mocked(
      DataAnalysisService as unknown as { analyse: typeof DataAnalysisService.prototype.analyse }
    ).analyse,
    mockAdaptClassPageToViewModel: vi.mocked(adaptClassPageToViewModel),
  };
}
