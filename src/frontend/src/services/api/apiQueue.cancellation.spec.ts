import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import { setGoogle, clearGoogle, loadApiQueue } from '@/test/api/apiServiceTransportTestHelpers';
import type { ApiSuccessEnvelope } from '@/test/api/apiServiceTestMocks';

const PENDING_ITEMS_AFTER_DISPATCH = 2;

// ── cancelApiQueued ────────────────────────────────────────────────────────────

describe('cancelApiQueued', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('throws when jobName is empty string', async () => {
    const { cancelApiQueued } = await loadApiQueue();
    expect(cancelApiQueued).toBeDefined();
    expect(() => cancelApiQueued!('')).toThrow();
  });

  it('returns 0 for unknown or idle job name', async () => {
    const { cancelApiQueued, getQueueState } = await loadApiQueue();
    expect(cancelApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const result = cancelApiQueued!('unknown-idle-job');
    expect(result).toBe(0);

    // getQueueState remains zero-state for the unknown job
    expect(getQueueState!('unknown-idle-job')).toEqual({ pending: 0, active: false });
  });

  it('cancels pending items and rejects each with { reason: "CANCELLED" }', async () => {
    setGoogle({
      script: {
        run: createGoogleScriptRunApiHandlerMock(() => {
          /* never settle — keep promises pending */
        }),
      },
    });

    const { callApiQueued, cancelApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(cancelApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    // Enqueue 3 items for the same job — first dispatches, 2 remain pending.
    // Do not capture the first promise (it never settles with the never-settle mock).
    callApiQueued!('methodA', { id: 1 }, 'cancel-job');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'cancel-job');
    const promiseC = callApiQueued!('methodC', { id: 3 }, 'cancel-job');

    // 3 items enqueued: 1 in-flight (dispatched by processQueue), 2 pending
    expect(getQueueState!('cancel-job')).toEqual({
      pending: PENDING_ITEMS_AFTER_DISPATCH,
      active: true,
    });

    const cancelledCount = cancelApiQueued!('cancel-job');

    // Should return the number of pending items removed
    expect(cancelledCount).toBe(PENDING_ITEMS_AFTER_DISPATCH);

    // After cancellation: 0 pending, in-flight still active
    expect(getQueueState!('cancel-job')).toEqual({ pending: 0, active: true });

    // Pending promises should reject with { reason: 'CANCELLED' }
    await expect(promiseB).rejects.toEqual({ reason: 'CANCELLED' });
    await expect(promiseC).rejects.toEqual({ reason: 'CANCELLED' });
  });

  it('leaves active in-flight request running after cancellation', async () => {
    const envelopeA: ApiSuccessEnvelope<{ seq: number }> = {
      ok: true,
      requestId: 'req-cancel-active-a',
      data: { seq: 1 },
    };

    let releaseA: (() => void) | undefined;

    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      const method = (request as { method?: unknown })?.method;
      if (method === 'methodA') {
        releaseA = () => {
          callbacks.successHandler?.(envelopeA);
        };
        // No early return needed — the function naturally falls through to
        // the closing brace. All other methods never settle (they should be
        // cancelled before resolution).
      }
      // Other methods never settle — they should be cancelled before resolution
    });

    setGoogle({ script: { run: runner } });

    const { callApiQueued, cancelApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(cancelApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    // Enqueue 3 items — first one dispatches immediately
    const promiseA = callApiQueued!('methodA', {}, 'active-job');
    expect(releaseA).toBeDefined();

    const promiseB = callApiQueued!('methodB', {}, 'active-job');
    const promiseC = callApiQueued!('methodC', {}, 'active-job');

    // 1 in-flight, 2 pending
    expect(getQueueState!('active-job')).toEqual({ pending: 2, active: true });

    // Cancel — clears pending items B and C
    const cancelledCount = cancelApiQueued!('active-job');
    expect(cancelledCount).toBe(PENDING_ITEMS_AFTER_DISPATCH);

    // Release the active request A — it should settle normally
    releaseA!();
    await expect(promiseA).resolves.toEqual({ seq: 1 });

    // Pending B and C should have been rejected with CANCELLED
    await expect(promiseB).rejects.toEqual({ reason: 'CANCELLED' });
    await expect(promiseC).rejects.toEqual({ reason: 'CANCELLED' });

    // Queue should now be idle (active request completed, pending cleared)
    expect(getQueueState!('active-job')).toEqual({ pending: 0, active: false });
  });

  it('after cancellation getQueueState shows pending 0', async () => {
    setGoogle({
      script: {
        run: createGoogleScriptRunApiHandlerMock(() => {
          /* never settle — keep promises pending */
        }),
      },
    });

    const { callApiQueued, getQueueState, cancelApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();
    expect(cancelApiQueued).toBeDefined();

    // Enqueue 3 items — first in-flight, 2 pending
    callApiQueued!('methodA', {}, 'state-job');
    const promiseB = callApiQueued!('methodB', {}, 'state-job');
    const promiseC = callApiQueued!('methodC', {}, 'state-job');

    // Before cancellation
    expect(getQueueState!('state-job')).toEqual({ pending: 2, active: true });

    cancelApiQueued!('state-job');

    // After cancellation: pending cleared, in-flight still active
    expect(getQueueState!('state-job')).toEqual({ pending: 0, active: true });

    // Suppress unhandled rejections from cancelled pending entries
    await expect(promiseB).rejects.toEqual({ reason: 'CANCELLED' });
    await expect(promiseC).rejects.toEqual({ reason: 'CANCELLED' });
  });
});
