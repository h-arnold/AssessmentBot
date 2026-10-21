import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import { renderPostAnalysisOwner } from '@/test/abClass/postAnalysisHookTestSupport';
import type { PostAnalysisTaskDescriptor } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks committed task state', () => {
  it('does not start work for null context and starts only after successful context commits', async () => {
    const context = createMetadataRefreshFixture('small');
    const run = vi.fn(() => {
      expect(screen.getByTestId('post-analysis-owner')).toHaveTextContent(
        context.classFull.classId
      );
      return Promise.resolve({ status: 'succeeded' } as const);
    });
    const owner = renderPostAnalysisOwner(null, [{ id: 'probe', run }], false);
    expect(run).not.toHaveBeenCalled();
    expect(owner.read().outcomes).toEqual([]);
    await act(async () => owner.update(context));
    await waitFor(() => {
      expect(owner.read().outcomes).toEqual([
        { data: { taskId: 'probe', status: 'succeeded' }, error: null },
      ]);
    });
    expect(run).toHaveBeenCalledWith(context);
  });

  it('exposes pending work without replacing or narrowing the successful analysis context', async () => {
    const context = createMetadataRefreshFixture('small');
    const before = structuredClone(context);
    const gate = Promise.withResolvers<{ status: 'succeeded' }>();
    const run = vi.fn(() => gate.promise);
    const owner = renderPostAnalysisOwner(context, [{ id: 'probe', run }], false);
    await waitFor(() => {
      expect(owner.read().outcomes).toEqual([
        { data: { taskId: 'probe', status: 'pending' }, error: null },
      ]);
    });
    expect(run).toHaveBeenCalledWith(context);
    expect(context).toEqual(before);
    await act(async () => gate.resolve({ status: 'succeeded' }));
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('succeeded'));
    expect(context).toEqual(before);
  });

  it('owns individually failed and later succeeded outcomes in declared order', async () => {
    const context = createMetadataRefreshFixture('small');
    const error = new Error('local failure');
    const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
    const tasks: readonly PostAnalysisTaskDescriptor[] = [
      { id: 'broken', run: () => Promise.reject(error) },
      { id: 'independent', run: later },
    ];
    const owner = renderPostAnalysisOwner(context, tasks, false);
    await waitFor(() => {
      expect(owner.read().outcomes).toEqual([
        { data: { taskId: 'broken', status: 'failed' }, error },
        { data: { taskId: 'independent', status: 'succeeded' }, error: null },
      ]);
    });
    expect(later).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('post-analysis-owner')).toHaveTextContent(context.classFull.classId);
  });
});
