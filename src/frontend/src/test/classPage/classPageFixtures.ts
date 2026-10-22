import { vi } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPageData, ClassPageSurfaceState } from '@/features/classPage/useClassPageData';
import type { ClassPageAdapterResult } from '@/features/classPage/classPageAdapter.zod';
import { createCanonicalMetadataFixture } from '@/test/abClass/abClassMetadataFixtures';

export const DEFAULT_CLASS_ID = 'class-abc-123';
export const CLASS_NAME = '7A1 Digital Technology 2025-2026';
export const DEFAULT_CLASS_FULL: Partial<ClassFull> = {
  classId: DEFAULT_CLASS_ID,
  className: CLASS_NAME,
  metadata: createCanonicalMetadataFixture(),
};

/** Creates the adapter result used by the default ready class-page fixture.
 *
 * @returns {ClassPageAdapterResult} A representative adapter result with empty
 * assignment and student collections and computed class metrics.
 */
export function createClassPageAdapterResult(): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [],
    classMetrics: {
      completeness: {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
      accuracy: {
        state: 'computed',
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
      spag: {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      },
      overall: {
        state: 'computed',
        value: 3.8,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
    },
  };
}

/** Creates ready class-page data, applying any supplied top-level overrides.
 *
 * @param {Partial<ClassPageData>} [overrides] - Values that replace the ready
 * fixture defaults.
 * @returns {ClassPageData} A complete ready class-page data fixture.
 */
export function createReadyClassPageData(overrides?: Partial<ClassPageData>): ClassPageData {
  return {
    classFull: DEFAULT_CLASS_FULL as ClassFull,
    classFullQuery: {
      data: DEFAULT_CLASS_FULL,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      promise: Promise.resolve(DEFAULT_CLASS_FULL),
      refetch: vi.fn(),
      status: 'success',
    } as unknown as UseQueryResult<ClassFull | null, Error>,
    assignmentDefinitionPartials: [],
    analyserResult: null,
    adapterResult: createClassPageAdapterResult(),
    error: null,
    surfaceState: { status: 'ready' } as ClassPageSurfaceState,
    refetch: vi.fn(),
    ...overrides,
  };
}
