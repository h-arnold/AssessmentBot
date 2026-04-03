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
    useQueryMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 'class-1' }, { id: 'class-2' }],
    });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current).toEqual({
      classesManagementViewState: 'ready',
      classesCount: 2,
      errorMessage: null,
    });
  });

  it('maps transport failures to an error feature state boundary', () => {
    useQueryMock.mockReturnValue({
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
    });

    const { result } = renderHook(() => useClassesManagement());

    expect(result.current).toEqual({
      classesManagementViewState: 'error',
      classesCount: null,
      errorMessage: 'Unable to load classes right now.',
    });
  });
});
