import { act, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  newestAssignment,
} from '@/test/abClass/metadataRefreshFixtures';
import { renderPostAnalysisOwner } from '@/test/abClass/postAnalysisHookTestSupport';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks replay and owner lifetime', () => {
  it('reattaches to a pending attempt after StrictMode cleanup so completion is not lost', async () => {
    const context = createMetadataRefreshFixture('small');
    const gate = Promise.withResolvers<{ status: 'succeeded' }>();
    const run = vi.fn(() => gate.promise);
    const owner = renderPostAnalysisOwner(
      context,
      [
        {
          id: 'metadata-probe',
          getAttemptKey: () => 'same-source',
          run,
        },
      ],
      true
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(owner.read().outcomes[0].data.status).toBe('pending');
    await act(async () => gate.resolve({ status: 'succeeded' }));
    await waitFor(() => {
      expect(owner.read().outcomes).toEqual([
        { data: { taskId: 'metadata-probe', status: 'succeeded' }, error: null },
      ]);
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(['classChange', 'contextNull', 'unmount'] as const)(
    'lets active work finish without publishing old-owner outcomes after %s',
    async (transition) => {
      const context = createMetadataRefreshFixture('small');
      const oldGate = Promise.withResolvers<{ status: 'succeeded' }>();
      const newGate = Promise.withResolvers<{ status: 'skipped'; reason: 'unchanged' }>();
      const completed = vi.fn();
      const run = vi.fn((input: typeof context) => {
        if (input.classFull.classId !== context.classFull.classId) return newGate.promise;
        return oldGate.promise.then((value) => {
          completed();
          return value;
        });
      });
      const owner = renderPostAnalysisOwner(
        context,
        [
          {
            id: 'probe',
            getAttemptKey: (input: PostAnalysisContext) => input.classFull.classId,
            run,
          },
        ],
        false
      );
      await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
      const next = createMetadataRefreshFixture('medium');
      await act(async () => {
        if (transition === 'unmount') owner.unmount();
        else owner.update(transition === 'contextNull' ? null : next);
      });
      const previousSnapshot = owner.read();
      if (transition === 'contextNull') expect(previousSnapshot.outcomes).toEqual([]);
      await act(async () => oldGate.resolve({ status: 'succeeded' }));
      expect(completed).toHaveBeenCalledTimes(1);
      expect(owner.read()).toBe(previousSnapshot);
      if (transition !== 'classChange') return;
      await act(async () => newGate.resolve({ status: 'skipped', reason: 'unchanged' }));
      await waitFor(() => {
        expect(owner.read().outcomes).toEqual([
          { data: { taskId: 'probe', status: 'skipped', reason: 'unchanged' }, error: null },
        ]);
      });
    }
  );

  it('suppresses an older source completion when a newer version finishes first', async () => {
    const context = createMetadataRefreshFixture('small');
    const oldGate = Promise.withResolvers<{ status: 'succeeded' }>();
    const run = vi
      .fn()
      .mockImplementationOnce(() => oldGate.promise)
      .mockImplementation(() =>
        Promise.resolve({ status: 'skipped', reason: 'unchanged' } as const)
      );
    const owner = renderPostAnalysisOwner(
      context,
      [
        {
          id: 'probe',
          getAttemptKey: (input: PostAnalysisContext) =>
            newestAssignment(input.classFull).updatedAt!,
          run,
        },
      ],
      false
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const next = structuredClone(context);
    newestAssignment(next.classFull).updatedAt = NEW_SOURCE_TIME;
    await act(async () => owner.update(next));
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('skipped'));
    await act(async () => oldGate.resolve({ status: 'succeeded' }));
    expect(owner.read().outcomes[0].data).toEqual({
      taskId: 'probe',
      status: 'skipped',
      reason: 'unchanged',
    });
  });
});
