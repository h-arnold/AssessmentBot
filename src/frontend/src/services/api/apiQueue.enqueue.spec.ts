import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import { setGoogle, clearGoogle, loadApiQueue } from '@/test/api/apiServiceTransportTestHelpers';

describe('callApiQueued and getQueueState validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('callApiQueued throws when method is empty string', async () => {
    const { callApiQueued } = await loadApiQueue();

    expect(callApiQueued).toBeDefined();
    expect(() => callApiQueued!('', { x: 1 }, 'myJob')).toThrow();
  });

  it('callApiQueued throws when jobName is empty string', async () => {
    const { callApiQueued } = await loadApiQueue();

    expect(callApiQueued).toBeDefined();
    expect(() => callApiQueued!('myMethod', { x: 1 }, '')).toThrow();
  });

  it('getQueueState throws when jobName is empty string', async () => {
    const { getQueueState } = await loadApiQueue();

    expect(getQueueState).toBeDefined();
    expect(() => getQueueState!('')).toThrow();
  });

  it('getQueueState returns zero-state for unknown job name', async () => {
    const { getQueueState } = await loadApiQueue();

    expect(getQueueState).toBeDefined();
    const state = getQueueState!('unknown-job');
    expect(state).toEqual({ pending: 0, active: false });
  });
});

// ── callApiQueued enqueue behaviour ─────────────────────────────────────────

describe('callApiQueued enqueue', () => {
  beforeEach(() => {
    // Install a google mock that never settles (prevents processQueue from
    // rejecting promises due to missing google.script.run in enqueue-only tests)
    setGoogle({
      script: {
        run: createGoogleScriptRunApiHandlerMock(() => {
          /* never settle — keep promises pending */
        }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('enqueue returns a pending Promise when given valid inputs', async () => {
    const { callApiQueued } = await loadApiQueue();

    expect(callApiQueued).toBeDefined();

    const promise = callApiQueued!('myMethod', { x: 1 }, 'job-a');

    // Assert it's a Promise — unreachable until GREEN implements enqueue
    expect(promise).toBeInstanceOf(Promise);

    // Verify it does NOT resolve within a tick (no dequeue loop yet)
    let hasResolved = false;
    promise.then(() => {
      hasResolved = true;
    });
    await Promise.resolve();
    expect(hasResolved).toBe(false);
  });

  it('two enqueues with same jobName produce distinct pending Promises', async () => {
    const { callApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const promiseA = callApiQueued!('myMethod', { id: 1 }, 'job-a');
    const promiseB = callApiQueued!('myMethod', { id: 2 }, 'job-a');

    // Both must be distinct Promise objects
    expect(promiseA).toBeInstanceOf(Promise);
    expect(promiseB).toBeInstanceOf(Promise);
    expect(promiseA).not.toBe(promiseB);

    // getQueueState('job-a') returns { pending: 1, active: true } — one item
    // remaining after processQueue shifted the first entry.
    expect(getQueueState!('job-a')).toEqual({ pending: 1, active: true });
  });

  it('different jobNames create separate queues', async () => {
    const { callApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    // Before enqueue: both queues should have zero-state (not yet created)
    expect(getQueueState!('job-a')).toEqual({ pending: 0, active: false });
    expect(getQueueState!('job-b')).toEqual({ pending: 0, active: false });

    const promiseA = callApiQueued!('methodA', { x: 1 }, 'job-a');
    const promiseB = callApiQueued!('methodB', { y: 2 }, 'job-b');

    expect(promiseA).toBeInstanceOf(Promise);
    expect(promiseB).toBeInstanceOf(Promise);
    expect(promiseA).not.toBe(promiseB);

    // After enqueue: each queue is active, confirming separate queues were created
    expect(getQueueState!('job-a').active).toBe(true);
    expect(getQueueState!('job-b').active).toBe(true);
  });

  it('enqueued Promises are independent of each other', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-a');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-a');

    // Must be distinct objects
    expect(promiseA).not.toBe(promiseB);

    // Neither should resolve within a tick
    let hasResolvedA = false;
    let hasResolvedB = false;
    promiseA.then(() => {
      hasResolvedA = true;
    });
    promiseB.then(() => {
      hasResolvedB = true;
    });

    await Promise.resolve();
    expect(hasResolvedA).toBe(false);
    expect(hasResolvedB).toBe(false);
  });
});
