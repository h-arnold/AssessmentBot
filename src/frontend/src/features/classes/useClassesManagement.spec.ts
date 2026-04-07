import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { useClassesManagement } from './useClassesManagement';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));
const readyClassesCount = 2;

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  queryOptions: <TOptions>(options: TOptions) => options,
}));

vi.mock('../auth/startupWarmupState', () => ({
  useStartupWarmupState: () => ({
    isFailed: false,
    isLoading: false,
    isReady: true,
    warmupState: 'ready',
  }),
}));

describe('useClassesManagement', () => {
  it('maps successful classes data to a ready feature state with a visible count', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [
          { classId: 'class-1', className: 'Alpha' },
          { classId: 'class-2', className: 'Beta' },
        ],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
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

  it('maps transport failures to an error feature state boundary', () => {
    useQueryMock
      .mockReturnValueOnce({
        isPending: false,
        isError: true,
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
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
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
        isError: true,
        data: undefined,
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
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
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: true,
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
        isError: false,
        data: [],
      })
      .mockReturnValueOnce({
        isPending: false,
        isError: false,
        data: [],
      });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current.classesManagementViewState).toBe('ready');
    expect(result.current.refreshRequiredMessage).toBeNull();
  });
});
