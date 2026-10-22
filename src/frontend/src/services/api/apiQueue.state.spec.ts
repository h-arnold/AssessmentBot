import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import {
  setGoogle,
  clearGoogle,
  loadApiQueue,
  createGoogleScriptRunHarness,
} from '@/test/api/apiServiceTransportTestHelpers';
import type { ApiSuccessEnvelope } from '@/test/api/apiServiceTestMocks';

describe('getQueueState live snapshots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('returns correct pending count excluding in-flight request during active processing', async () => {
    const { callApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const envelopeA: ApiSuccessEnvelope<{ seq: number }> = {
      ok: true,
      requestId: 'req-live-a',
      data: { seq: 1 },
    };
    const envelopeB: ApiSuccessEnvelope<{ seq: number }> = {
      ok: true,
      requestId: 'req-live-b',
      data: { seq: 2 },
    };
    const envelopeC: ApiSuccessEnvelope<{ seq: number }> = {
      ok: true,
      requestId: 'req-live-c',
      data: { seq: 3 },
    };
    const envelopes = [envelopeA, envelopeB, envelopeC];

    const SECOND_DISPATCH_CALLBACK_COUNT = 2;
    const THIRD_DISPATCH_CALLBACK_COUNT = 3;

    // Deferred mock: capture a release function per dispatch but don't resolve
    // until the test explicitly calls it.
    const releaseFns: (() => void)[] = [];
    let invocationCount = 0;

    const runner = createGoogleScriptRunApiHandlerMock((_request, callbacks) => {
      const index = invocationCount;
      invocationCount++;
      const release = () => {
        callbacks.successHandler?.(envelopes[index]);
      };
      releaseFns.push(release);
    });

    setGoogle({ script: { run: runner } });

    // Enqueue three requests — the first dispatches synchronously via processQueue,
    // the other two remain pending.
    const promiseA = callApiQueued!('methodA', { id: 1 }, 'live-job');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'live-job');
    const promiseC = callApiQueued!('methodC', { id: 3 }, 'live-job');

    // One dispatch should have fired — release captured for the in-flight request.
    expect(releaseFns).toHaveLength(1);

    // After enqueuing 3 requests for an idle queue: 1 in-flight, 2 pending.
    expect(getQueueState!('live-job')).toEqual({ pending: 2, active: true });

    // Release the first (in-flight) request — it resolves, processQueue shifts it,
    // and dispatches the next queued request.
    releaseFns[0]();
    await expect(promiseA).resolves.toEqual({ seq: 1 });

    // Second dispatch should have fired now. Queue has 1 pending, 1 active.
    expect(releaseFns).toHaveLength(SECOND_DISPATCH_CALLBACK_COUNT);

    // After first resolve: 1 in-flight, 1 pending.
    expect(getQueueState!('live-job')).toEqual({ pending: 1, active: true });

    // Release the second request.
    releaseFns[1]();
    await expect(promiseB).resolves.toEqual({ seq: 2 });

    // Third dispatch should have fired. Queue has 0 pending, 1 active.
    expect(releaseFns).toHaveLength(THIRD_DISPATCH_CALLBACK_COUNT);

    // After second resolve: 0 pending, 1 in-flight.
    expect(getQueueState!('live-job')).toEqual({ pending: 0, active: true });

    // Release the third request — queue drains.
    releaseFns[2]();
    await expect(promiseC).resolves.toEqual({ seq: 3 });

    // Queue is now idle.
    expect(getQueueState!('live-job')).toEqual({ pending: 0, active: false });
  });

  it('returns zero-state after queue drains', async () => {
    const { callApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const envelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-drain-check',
      data: { done: true },
    };

    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: envelope,
    });

    setGoogle({ script: { run: runner } });

    // Enqueue and await completion — queue should drain fully.
    await callApiQueued!('someMethod', {}, 'drain-check-job');

    expect(getQueueState!('drain-check-job')).toEqual({ pending: 0, active: false });
  });
});
