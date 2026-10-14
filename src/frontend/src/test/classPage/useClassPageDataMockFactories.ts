import { vi } from 'vitest';

export interface UseClassPageDataMocks {
  mockUseQuery: ReturnType<typeof vi.fn>;
  mockUsePageDataset: ReturnType<typeof vi.fn>;
  mockGetABClassQueryOptions: ReturnType<typeof vi.fn>;
  mockAnalyse: ReturnType<typeof vi.fn>;
  mockAdaptClassPageToViewModel: ReturnType<typeof vi.fn>;
}

/** Creates fresh hook, query, analysis, and adapter mocks for one spec.
 * @returns {UseClassPageDataMocks} Fresh mocks local to one spec.
 */
export function createUseClassPageDataMocks(): UseClassPageDataMocks {
  return {
    mockUseQuery: vi.fn(),
    mockUsePageDataset: vi.fn(),
    mockGetABClassQueryOptions: vi.fn(),
    mockAnalyse: vi.fn(),
    mockAdaptClassPageToViewModel: vi.fn(),
  };
}
