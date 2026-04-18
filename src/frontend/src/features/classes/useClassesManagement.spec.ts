import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { useClassesManagement } from './useClassesManagement';

const { useQueryMock, useStartupWarmupStateMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));
const readyClassesCount = 2;

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  queryOptions: <TOptions>(options: TOptions) => options,
}));

vi.mock('../auth/startupWarmupState', () => ({
  useStartupWarmupState: useStartupWarmupStateMock,
}));

/**
 * Creates a startup warmup state where all datasets are ready and trustworthy.
 *
 * @returns {object} Startup warmup state with trusted datasets marked ready.
 */
function createReadyStartupWarmupState() {
  return {
    isFailed: false,
    isLoading: false,
    isReady: true,
    warmupState: 'ready',
    isDatasetReady: () => true,
    isDatasetFailed: () => false,
    snapshot: {
      datasets: {
        classPartials: { status: 'ready', isTrustworthy: true },
        cohorts: { status: 'ready', isTrustworthy: true },
        yearGroups: { status: 'ready', isTrustworthy: true },
        assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
      },
    },
  };
}

describe('useClassesManagement', () => {
  beforeEach(() => {
    useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
  });

  it('maps successful classes data to a ready feature state with a visible count', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        data: [
          { classId: 'class-1', className: 'Alpha' },
          { classId: 'class-2', className: 'Beta' },
        ],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.blockingErrorMessage).toBeNull();
    expect(result.current.classesCount).toBe(readyClassesCount);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.nonBlockingWarningMessage).toBeNull();
    expect(result.current.refreshRequiredMessage).toBeNull();
    expect(result.current.rows).toEqual([
      expect.objectContaining({
        classId: 'class-1',
        className: 'Alpha',
        status: 'notCreated',
      }),
      expect.objectContaining({
        classId: 'class-2',
        className: 'Beta',
        status: 'notCreated',
      }),
    ]);
    expect(result.current.selectedRowKeys).toEqual([]);
    expect(result.current.onSelectedRowKeysChange).toBeTypeOf('function');
  });

  it('publishes a classes-only background refresh message when trusted class datasets refetch', () => {
    useQueryMock
      .mockReturnValueOnce({
        isFetching: true,
        isPending: false,
        data: [
          { classId: 'class-1', className: 'Alpha' },
        ],
      })
      .mockReturnValueOnce({
        isFetching: false,
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isFetching: false,
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isFetching: false,
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.nonBlockingWarningMessage).toBe('Classes data is refreshing in the background.');
  });

  it('does not publish the classes refresh message when only reference-data queries refetch', () => {
    useQueryMock
      .mockReturnValueOnce({
        isFetching: false,
        isPending: false,
        data: [
          { classId: 'class-1', className: 'Alpha' },
        ],
      })
      .mockReturnValueOnce({
        isFetching: false,
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isFetching: true,
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isFetching: true,
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.nonBlockingWarningMessage).toBeNull();
  });

  it('maps transport failures to an error feature state boundary', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        error: new ApiTransportError({
          requestId: 'request-classes',
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests.',
            retriable: true,
          },
        }),
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('error');
    expect(result.current.blockingErrorMessage).toBe('Unable to load active Google Classrooms right now.');
    expect(result.current.classesCount).toBeNull();
    expect(result.current.errorMessage).toBe('Unable to load classes right now.');
    expect(result.current.nonBlockingWarningMessage).toBeNull();
    expect(result.current.refreshRequiredMessage).toBeNull();
    expect(result.current.rows).toEqual([]);
    expect(result.current.selectedRowKeys).toEqual([]);
    expect(result.current.onSelectedRowKeysChange).toBeTypeOf('function');
  });

  it('treats query error as blocking classes state when active dataset cannot be trusted', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        data: undefined,
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('error');
    expect(result.current.blockingErrorMessage).toBe('Unable to load active Google Classrooms right now.');
    expect(result.current.nonBlockingWarningMessage).toBeNull();
    expect(result.current.rows).toHaveLength(0);
  });


  it('does not surface refresh guidance from a later class-partials query error when data is already available', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        error: new ApiTransportError({
          requestId: 'request-classes-refresh',
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Class partials refetch failed.',
            retriable: false,
          },
        }),
        data: [
          { classId: 'class-1', className: 'Alpha' },
        ],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.refreshRequiredMessage).toBeNull();
  });

  it('does not block classes when only assignmentDefinitionPartials startup dataset is failed', () => {
    useStartupWarmupStateMock.mockReturnValue({
      ...createReadyStartupWarmupState(),
      isFailed: true,
      isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentDefinitionPartials',
      isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
      snapshot: {
        datasets: {
          classPartials: { status: 'ready', isTrustworthy: true },
          cohorts: { status: 'ready', isTrustworthy: true },
          yearGroups: { status: 'ready', isTrustworthy: true },
          assignmentDefinitionPartials: { status: 'failed', isTrustworthy: false },
        },
      },
    });

    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        data: [{ classId: 'class-1', className: 'Alpha' }],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.blockingErrorMessage).toBeNull();
  });
});
