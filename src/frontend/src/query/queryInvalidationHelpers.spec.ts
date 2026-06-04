import { describe, expect, it, vi } from 'vitest';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { refetchAfterStaleInvalidate } from './queryInvalidationHelpers';

/**
 * Creates a mock QueryClient with vi.fn() spies on invalidateQueries
 * and refetchQueries. The returned mocks can be configured per test
 * to resolve or reject as needed.
 *
 * @returns {{ queryClient: QueryClient; invalidateQueriesMock: ReturnType<typeof vi.fn>; refetchQueriesMock: ReturnType<typeof vi.fn> }} An object containing the mock QueryClient and its spy functions.
 */
function createMockQueryClient(): {
  queryClient: QueryClient;
  invalidateQueriesMock: ReturnType<typeof vi.fn>;
  refetchQueriesMock: ReturnType<typeof vi.fn>;
} {
  const invalidateQueriesMock = vi.fn();
  const refetchQueriesMock = vi.fn();

  const queryClient = {
    invalidateQueries: invalidateQueriesMock,
    refetchQueries: refetchQueriesMock,
  } as unknown as QueryClient;

  return { queryClient, invalidateQueriesMock, refetchQueriesMock };
}

const TEST_QUERY_KEY: QueryKey = ['testDataset'];

describe('refetchAfterStaleInvalidate', () => {
  it('calls invalidateQueries with refetchType "none" before calling refetchQueries', async () => {
    const { queryClient, invalidateQueriesMock, refetchQueriesMock } = createMockQueryClient();

    await refetchAfterStaleInvalidate(queryClient, TEST_QUERY_KEY);

    // Verify invalidateQueries was called with the expected arguments
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: TEST_QUERY_KEY,
      refetchType: 'none',
    });

    // Verify refetchQueries was called with the expected arguments, including throwOnError: true
    // per codebase convention (see manageReferenceDataHelpers.ts:157, queryInvalidation.ts:72).
    expect(refetchQueriesMock).toHaveBeenCalledWith(
      { queryKey: TEST_QUERY_KEY },
      { throwOnError: true }
    );

    // Verify call order: invalidateQueries before refetchQueries
    const invalidateCallOrder = invalidateQueriesMock.mock.invocationCallOrder[0];
    const refetchCallOrder = refetchQueriesMock.mock.invocationCallOrder[0];
    expect(invalidateCallOrder).toBeLessThan(refetchCallOrder);
  });

  it('passes the same queryKey to both invalidateQueries and refetchQueries', async () => {
    const { queryClient, invalidateQueriesMock, refetchQueriesMock } = createMockQueryClient();

    await refetchAfterStaleInvalidate(queryClient, TEST_QUERY_KEY);

    // Both calls should receive the identical queryKey reference
    expect(invalidateQueriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: TEST_QUERY_KEY })
    );
    expect(refetchQueriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: TEST_QUERY_KEY }),
      { throwOnError: true }
    );
  });

  it('propagates the error when invalidateQueries rejects and does not call refetchQueries', async () => {
    const { queryClient, invalidateQueriesMock, refetchQueriesMock } = createMockQueryClient();

    const invalidateError = new Error('invalidate failed');
    invalidateQueriesMock.mockRejectedValue(invalidateError);

    await expect(refetchAfterStaleInvalidate(queryClient, TEST_QUERY_KEY)).rejects.toThrow(
      'invalidate failed'
    );

    // refetchQueries must not be called when invalidateQueries fails
    expect(refetchQueriesMock).not.toHaveBeenCalled();
  });

  it('propagates the error when refetchQueries rejects', async () => {
    const { queryClient, invalidateQueriesMock, refetchQueriesMock } = createMockQueryClient();

    const refetchError = new Error('refetch failed');
    refetchQueriesMock.mockRejectedValue(refetchError);

    await expect(refetchAfterStaleInvalidate(queryClient, TEST_QUERY_KEY)).rejects.toThrow(
      'refetch failed'
    );

    // invalidateQueries must still have been called before refetchQueries failed
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: TEST_QUERY_KEY,
      refetchType: 'none',
    });
  });

  it('passes throwOnError: true to refetchQueries so errors propagate to the caller', async () => {
    const { queryClient, invalidateQueriesMock, refetchQueriesMock } = createMockQueryClient();

    await refetchAfterStaleInvalidate(queryClient, TEST_QUERY_KEY);

    // refetchQueries must receive throwOnError: true as its second argument
    // per codebase convention, so that rejected promises propagate to the caller.
    expect(refetchQueriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: TEST_QUERY_KEY }),
      { throwOnError: true }
    );

    // invalidateQueries must still be called with refetchType 'none'
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: TEST_QUERY_KEY,
      refetchType: 'none',
    });
  });
});
