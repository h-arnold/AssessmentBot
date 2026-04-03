import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { useClassesManagement } from './useClassesManagement';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  queryOptions: <TOptions>(options: TOptions) => options,
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
    expect(result.current.classesCount).toBe(2);
    expect(result.current.errorMessage).toBeNull();
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
    expect(result.current.classesCount).toBeNull();
    expect(result.current.errorMessage).toBe('Unable to load classes right now.');
    expect(result.current.rows).toEqual([]);
    expect(result.current.selectedRowKeys).toEqual([]);
    expect(result.current.onSelectedRowKeysChange).toBeTypeOf('function');
  });
});
