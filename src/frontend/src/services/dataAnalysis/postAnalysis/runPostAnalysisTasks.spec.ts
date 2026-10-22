import { describe, expect, it, vi } from 'vitest';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import {
  runPostAnalysisTasks,
  type PostAnalysisTaskDescriptor,
  type PostAnalysisTaskResult,
} from './runPostAnalysisTasks';

const LAST_OUTCOME_OFFSET = -1;

describe('runPostAnalysisTasks ordered independent descriptors', () => {
  it('retains every failure in order and runs the final independent task after a long synchronous-failure chain', async () => {
    const failureCount = 20_000;
    const errors = Array.from(
      { length: failureCount },
      (_, index) => new Error(`failure-${index}`)
    );
    const finalTask = vi.fn(() => ({ status: 'succeeded' as const }));
    const tasks: readonly PostAnalysisTaskDescriptor[] = [
      ...errors.map((error, index) => {
        return {
          id: `failure-${index}`,
          run() {
            throw error;
          },
        };
      }),
      { id: 'final-success', run: finalTask },
    ];
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const outcomes = await runPostAnalysisTasks(createMetadataRefreshFixture('small'), tasks);
      expect(outcomes).toHaveLength(failureCount + 1);
      expect(outcomes.map(({ data }) => data.taskId)).toEqual([
        ...errors.map((_, index) => `failure-${index}`),
        'final-success',
      ]);
      expect(outcomes.slice(0, failureCount).every(({ data }) => data.status === 'failed')).toBe(
        true
      );
      outcomes.slice(0, failureCount).forEach(({ error }, index) => {
        expect(error).toBe(errors[index]);
      });
      expect(outcomes.at(LAST_OUTCOME_OFFSET)).toEqual({
        data: { taskId: 'final-success', status: 'succeeded' },
        error: null,
      });
      expect(finalTask).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledTimes(failureCount);
    } finally {
      logError.mockRestore();
    }
  });

  it('awaits each declared task before starting the next and preserves context and outcome order', async () => {
    const context = createMetadataRefreshFixture('small');
    const gate = Promise.withResolvers<{ status: 'succeeded' }>();
    const events: string[] = [];
    const first = vi.fn(() => {
      events.push('first');
      return gate.promise;
    });
    const second = vi.fn(() => {
      events.push('second');
      return Promise.resolve({ status: 'skipped', reason: 'unchanged' } as const);
    });
    const tasks: readonly PostAnalysisTaskDescriptor[] = [
      { id: 'first', run: first },
      { id: 'second', run: second },
    ];
    const completion = runPostAnalysisTasks(context, tasks);
    await Promise.resolve();
    expect(events).toEqual(['first']);
    expect(second).not.toHaveBeenCalled();
    gate.resolve({ status: 'succeeded' });
    await expect(completion).resolves.toEqual([
      { data: { taskId: 'first', status: 'succeeded' }, error: null },
      { data: { taskId: 'second', status: 'skipped', reason: 'unchanged' }, error: null },
    ]);
    expect(events).toEqual(['first', 'second']);
    expect(first).toHaveBeenCalledWith(context);
    expect(second).toHaveBeenCalledWith(context);
  });

  it.each(['synchronous', 'asynchronous'] as const)(
    'normalises a %s thrown value and still runs the later independent task',
    async (mode) => {
      const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
      const tasks: readonly PostAnalysisTaskDescriptor[] = [
        {
          id: 'broken',
          run() {
            if (mode === 'synchronous') throw 'scalar failure';
            return Promise.reject('scalar failure');
          },
        },
        { id: 'later', run: later },
      ];
      const outcomes = await runPostAnalysisTasks(createMetadataRefreshFixture('small'), tasks);
      expect(outcomes[0].data).toEqual({ taskId: 'broken', status: 'failed' });
      expect(outcomes[0].error).toBeInstanceOf(Error);
      expect(outcomes[0].error?.message).toBe('scalar failure');
      expect(outcomes[1]).toEqual({ data: { taskId: 'later', status: 'succeeded' }, error: null });
      expect(later).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['pending', 'failed'] as const)(
    'rejects a returned %s state with a local Error and continues the later independent task',
    async (status) => {
      const context = createMetadataRefreshFixture('small');
      const later = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
      const outcomes = await runPostAnalysisTasks(context, [
        {
          id: 'invalid-result',
          // Deliberate runtime contract violation: static types cannot guard this boundary.
          run: () => Promise.resolve({ status } as unknown as PostAnalysisTaskResult),
        },
        { id: 'later', run: later },
      ]);

      expect(later).toHaveBeenCalledExactlyOnceWith(context);
      expect(outcomes[1]).toEqual({ data: { taskId: 'later', status: 'succeeded' }, error: null });
      expect.soft(outcomes[0].data).toEqual({ taskId: 'invalid-result', status: 'failed' });
      expect(outcomes[0].error).toBeInstanceOf(Error);
      expect(outcomes[0].error?.message).toMatch(/\S/);
      expect(outcomes[0].data).not.toHaveProperty('error');
    }
  );

  it('preserves an existing Error identity separately from serialisable failed data', async () => {
    const error = new Error('write failed');
    const outcomes = await runPostAnalysisTasks(createMetadataRefreshFixture('small'), [
      { id: 'broken', run: () => Promise.reject(error) },
    ]);
    expect(outcomes[0]).toEqual({ data: { taskId: 'broken', status: 'failed' }, error });
    expect(outcomes[0].error).toBe(error);
    expect(outcomes[0].data).not.toHaveProperty('error');
  });

  it('rejects duplicate task IDs before executing any descriptor', async () => {
    const run = vi.fn(() => Promise.resolve({ status: 'succeeded' } as const));
    await expect(
      runPostAnalysisTasks(createMetadataRefreshFixture('small'), [
        { id: 'duplicate', run },
        { id: 'duplicate', run },
      ])
    ).rejects.toThrow(/duplicate/i);
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts an empty readonly registry without work', async () => {
    await expect(runPostAnalysisTasks(createMetadataRefreshFixture('small'), [])).resolves.toEqual(
      []
    );
  });
});
