import { act, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as frontendLogger from '@/logging/frontendLogger';
import * as metadataTask from '@/services/dataAnalysis/postAnalysis/refreshABClassMetadata';
import { createPostAnalysisTaskDescriptors } from '@/services/dataAnalysis/postAnalysis/postAnalysisTasks';
import type {
  PostAnalysisTaskDescriptor,
  PostAnalysisTaskOutcome,
} from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import {
  createMetadataRefreshFixture,
  NEW_SOURCE_TIME,
  SUMMARY_TIME,
  newestAssignment,
} from '@/test/abClass/metadataRefreshFixtures';
import { renderPostAnalysisOwner } from '@/test/abClass/postAnalysisHookTestSupport';

const TWO_ATTEMPTS = 2;
const THREE_ATTEMPTS = 3;
const TWO_COMPLETIONS = 2;
const FIRST_ASSIGNMENT_INDEX = 0;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks task-local attempt deduplication', () => {
  it.each([
    { kind: 'Error', thrown: new Error('attempt key failed') },
    { kind: 'scalar', thrown: 'attempt key failed' },
  ])(
    'isolates a $kind attempt-key failure and remembers it through replay and original-input reattachment',
    async ({ thrown }) => {
      const context = createMetadataRefreshFixture('small');
      const diagnostic = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(() => {});
      const run = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
      const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
      const tasks: readonly PostAnalysisTaskDescriptor[] = [
        {
          id: 'broken-key',
          getAttemptKey() {
            throw thrown;
          },
          run,
        },
        { id: 'independent', run: later },
      ];
      const owner = renderPostAnalysisOwner(context, tasks, true);
      await waitFor(() => {
        expect(owner.read().outcomes.map((outcome) => outcome.data)).toEqual([
          { taskId: 'broken-key', status: 'failed' },
          { taskId: 'independent', status: 'succeeded' },
        ]);
      });
      const error = owner.read().outcomes[0].error;
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('attempt key failed');
      if (thrown instanceof Error) expect(error).toBe(thrown);
      expect(owner.read().outcomes[0].data).not.toHaveProperty('error');
      expect(owner.read().outcomes[1].error).toBeNull();
      expect(diagnostic).toHaveBeenCalledExactlyOnceWith('runPostAnalysisTasks', error, {
        taskId: 'broken-key',
        classId: context.classFull.classId,
      });
      expect(run).not.toHaveBeenCalled();
      expect(later).toHaveBeenCalledExactlyOnceWith(context);

      await act(async () => owner.update(context));
      // Null forces effect reattachment with the same original input identity.
      await act(async () => owner.update(null));
      expect(owner.read().outcomes).toEqual([]);
      await act(async () => owner.update(context));
      await waitFor(() => expect(owner.read().outcomes[1].data.status).toBe('succeeded'));
      expect(owner.read().outcomes[0]).toEqual({
        data: { taskId: 'broken-key', status: 'failed' },
        error,
      });
      expect(owner.read().outcomes[0].error).toBe(error);
      // Key reevaluation is allowed; cached failed execution/diagnostics must not repeat.
      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(run).not.toHaveBeenCalled();
      expect(later).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['skipped', 'failed'] as const)(
    'does not repeat %s metadata on replay, equal rerenders or metadata-only cache changes',
    async (terminal) => {
      const context = createMetadataRefreshFixture('small');
      const refresh = vi.spyOn(metadataTask, 'refreshABClassMetadata').mockImplementation(() => {
        return terminal === 'failed'
          ? Promise.reject(new Error('write failed'))
          : Promise.resolve({ status: 'skipped', reason: 'unchanged' });
      });
      const tasks = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME);
      const owner = renderPostAnalysisOwner(context, tasks, true);
      const status = terminal === 'failed' ? 'failed' : 'skipped';
      await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe(status));
      await act(async () => owner.update(structuredClone(context)));
      const cacheRefresh = structuredClone(context);
      cacheRefresh.classFull.metadata = null;
      await act(async () => owner.update(cacheRefresh));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(owner.read().outcomes[0].data.status).toBe(status);
    }
  );

  it('permits another attempt only for a newer version or a genuinely remounted owner after failure', async () => {
    const context = createMetadataRefreshFixture('small');
    const refresh = vi
      .spyOn(metadataTask, 'refreshABClassMetadata')
      .mockImplementation(() => Promise.reject(new Error('save failed')));
    const tasks = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME);
    const owner = renderPostAnalysisOwner(context, tasks, false);
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('failed'));
    const next = structuredClone(context);
    newestAssignment(next.classFull).updatedAt = NEW_SOURCE_TIME;
    await act(async () => owner.update(next));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(TWO_ATTEMPTS));
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('failed'));
    owner.unmount();
    const remounted = renderPostAnalysisOwner(next, tasks, false);
    await waitFor(() => expect(remounted.read().outcomes[0].data.status).toBe('failed'));
    expect(refresh).toHaveBeenCalledTimes(THREE_ATTEMPTS);
  });

  it('remembers an attempted version across class navigation within the same mount', async () => {
    const original = createMetadataRefreshFixture('small');
    const refresh = vi
      .spyOn(metadataTask, 'refreshABClassMetadata')
      .mockImplementation(() => Promise.reject(new Error('save failed')));
    const tasks = createPostAnalysisTaskDescriptors(() => SUMMARY_TIME);
    const owner = renderPostAnalysisOwner(original, tasks, false);
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('failed'));
    await act(async () => owner.update(createMetadataRefreshFixture('medium')));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(TWO_ATTEMPTS));
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('failed'));
    await act(async () => owner.update(structuredClone(original)));
    await waitFor(() => expect(owner.read().outcomes[0].data.status).toBe('failed'));
    expect(refresh).toHaveBeenCalledTimes(TWO_ATTEMPTS);
  });

  it('runs a later unkeyed task for new successful context even when metadata was already attempted', async () => {
    const context = createMetadataRefreshFixture('small');
    const events: string[] = [];
    const refresh = vi.spyOn(metadataTask, 'refreshABClassMetadata').mockImplementation(() => {
      events.push('metadata');
      return Promise.reject(new Error('metadata failed'));
    });
    const future = vi.fn(() => {
      events.push('future');
      return Promise.resolve({ status: 'succeeded' } as const);
    });
    const tasks: readonly PostAnalysisTaskDescriptor[] = [
      ...createPostAnalysisTaskDescriptors(() => SUMMARY_TIME),
      { id: 'future-local-probe', run: future },
    ];
    const owner = renderPostAnalysisOwner(context, tasks, true);
    await waitFor(() => {
      expect(
        owner.read().outcomes.map((outcome: PostAnalysisTaskOutcome) => outcome.data.status)
      ).toEqual(['failed', 'succeeded']);
    });
    expect(events).toEqual(['metadata', 'future']);
    const newDisplayContext = structuredClone(context);
    newDisplayContext.averagingResult.perTask = [];
    await act(async () => owner.update(newDisplayContext));
    await waitFor(() => expect(future).toHaveBeenCalledTimes(TWO_ATTEMPTS));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['metadata', 'future', 'future']);
    expect(future).toHaveBeenLastCalledWith(newDisplayContext);
    expect(
      owner.read().outcomes.map((outcome: PostAnalysisTaskOutcome) => outcome.data.taskId)
    ).toEqual(['refreshABClassMetadata', 'future-local-probe']);
  });

  it('does not use the metadata unchanged decision as a global eligibility gate', async () => {
    const context = createMetadataRefreshFixture('small');
    vi.spyOn(metadataTask, 'refreshABClassMetadata').mockImplementation(() =>
      Promise.resolve({ status: 'skipped', reason: 'unchanged' })
    );
    const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
    const owner = renderPostAnalysisOwner(
      context,
      [...createPostAnalysisTaskDescriptors(() => SUMMARY_TIME), { id: 'independent', run: later }],
      false
    );
    await waitFor(() => {
      expect(
        owner.read().outcomes.map((outcome: PostAnalysisTaskOutcome) => outcome.data.status)
      ).toEqual(['skipped', 'succeeded']);
    });
    expect(later).toHaveBeenCalledWith(context);
  });

  it.each([FIRST_ASSIGNMENT_INDEX, FIRST_ASSIGNMENT_INDEX + 1])(
    'deduplicates failed metadata work with a null timestamp at position %i and continues later tasks',
    async (nullIndex) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.assignments[nullIndex].updatedAt = null;
      const diagnostic = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(() => {});
      const refresh = vi
        .spyOn(metadataTask, 'refreshABClassMetadata')
        .mockImplementation(() => Promise.reject(new Error('invalid source timestamp')));
      const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
      const tasks: readonly PostAnalysisTaskDescriptor[] = [
        ...createPostAnalysisTaskDescriptors(() => SUMMARY_TIME),
        { id: 'independent-after-invalid-source', run: later },
      ];
      const owner = renderPostAnalysisOwner(context, tasks, false);
      await waitFor(() => {
        return expect(owner.read().outcomes.map(({ data }) => data.status)).toEqual([
          'failed',
          'succeeded',
        ]);
      });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(later).toHaveBeenCalledExactlyOnceWith(context);
      const equalSource = structuredClone(context);
      await act(async () => owner.update(equalSource));
      await waitFor(() => expect(later).toHaveBeenCalledTimes(TWO_COMPLETIONS));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledTimes(1);
    }
  );
});
