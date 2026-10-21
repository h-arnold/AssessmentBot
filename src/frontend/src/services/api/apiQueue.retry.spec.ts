import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  setGoogle,
  clearGoogle,
  loadApiQueue,
  type RunnerHarnessResponse,
  MAX_ATTEMPTS,
  createGoogleScriptRunHarness,
  createSequentialHarness,
  makeRateLimitedResponseEnvelope,
  makeDoneSuccessEnvelope,
} from '@/test/api/apiServiceTransportTestHelpers';
import type { ApiSuccessEnvelope, ApiErrorEnvelope } from '@/test/api/apiServiceTestMocks';

describe('callApiQueued retry interaction and failure continuation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    clearGoogle();
  });

  const RETRY_BLOCK_TOTAL_CALL_COUNT = 3; // A attempt 0, A retry, B dispatch
  const NON_RETRY_TOTAL_CALL_COUNT = 2; // A (single attempt) + B (single dispatch)

  it('retry delays block the next request in the queue', async () => {
    vi.useFakeTimers();

    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const rateLimitedEnvelope = makeRateLimitedResponseEnvelope('req-rl-block-1');
    const successEnvelope = makeDoneSuccessEnvelope('req-ok-block-1');

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: rateLimitedEnvelope },
      { kind: 'success', payload: successEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    // Enqueue A then B for the same job
    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-x');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-x');

    // A's first attempt should have dispatched; B must NOT have dispatched yet
    // because A is still retrying (processQueue awaits callApi).
    expect(apiHandlerSpy).toHaveBeenCalledTimes(1);
    expect(apiHandlerSpy.mock.calls[0][0]).toMatchObject({ method: 'methodA' });

    // Advance timers — A's retry completes, then B dispatches and resolves
    await vi.runAllTimersAsync();

    await expect(promiseA).resolves.toEqual({ done: true });
    await expect(promiseB).resolves.toEqual({ done: true });

    // Call count: A attempt 0, A attempt 1 (retry), B dispatch
    expect(apiHandlerSpy).toHaveBeenCalledTimes(RETRY_BLOCK_TOTAL_CALL_COUNT);
    expect(apiHandlerSpy.mock.calls[1][0]).toMatchObject({ method: 'methodA' });
    expect(apiHandlerSpy.mock.calls[2][0]).toMatchObject({ method: 'methodB' });
  });

  it('retry exhaustion rejects first request and queue continues to next', async () => {
    vi.useFakeTimers();

    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const rateLimitedEnvelope = makeRateLimitedResponseEnvelope('req-exhaust-1');
    const successEnvelope = makeDoneSuccessEnvelope('req-exhaust-ok-1');

    // 4 RATE_LIMITED responses (one per attempt, exhausting retries) + 1 success for B
    const responses: RunnerHarnessResponse[] = [
      ...Array.from({ length: MAX_ATTEMPTS }, () => {
        return {
          kind: 'success' as const,
          payload: rateLimitedEnvelope,
        };
      }),
      { kind: 'success', payload: successEnvelope },
    ];

    const { runner, apiHandlerSpy } = createSequentialHarness(responses);

    setGoogle({ script: { run: runner } });

    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-x');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-x');

    // Pre-register rejection assertion before advancing timers so the handler
    // is in place when A is rejected during timer processing.
    const aAssertion = expect(promiseA).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    await vi.runAllTimersAsync();

    await aAssertion;

    // B should still dispatch and resolve after A's rejection
    await expect(promiseB).resolves.toEqual({ done: true });

    // 4 attempts for A + 1 dispatch for B
    expect(apiHandlerSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
  });

  it('non-retriable failure rejects and queue continues to next request', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const invalidRequestEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-nonretry-1',
      error: { code: 'INVALID_REQUEST', message: 'Invalid request data.', isRetriable: false },
    };
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-nonretry-ok-1',
      data: { done: true },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: invalidRequestEnvelope },
      { kind: 'success', payload: successEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-x');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-x');

    // A should reject with INVALID_REQUEST — no retry for non-retriable errors
    await expect(promiseA).rejects.toMatchObject({ code: 'INVALID_REQUEST' });

    // B should still dispatch and resolve
    await expect(promiseB).resolves.toEqual({ done: true });

    // Only A (1 attempt, no retry) + B (1 dispatch)
    expect(apiHandlerSpy).toHaveBeenCalledTimes(NON_RETRY_TOTAL_CALL_COUNT);
    expect(apiHandlerSpy.mock.calls[0][0]).toMatchObject({ method: 'methodA' });
    expect(apiHandlerSpy.mock.calls[1][0]).toMatchObject({ method: 'methodB' });
  });

  it('active flag remains true during retry delay', async () => {
    vi.useFakeTimers();

    const { callApiQueued, getQueueState } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const rateLimitedEnvelope = makeRateLimitedResponseEnvelope('req-active-rl-1');
    const successEnvelope = makeDoneSuccessEnvelope('req-active-ok-1');

    const { runner } = createSequentialHarness([
      { kind: 'success', payload: rateLimitedEnvelope },
      { kind: 'success', payload: successEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    const promiseA = callApiQueued!('someMethod', {}, 'active-job');

    // A was shifted from pending; callApi is retrying (first attempt received
    // RATE_LIMITED, retry timer is pending). The queue should be active with
    // no additional pending requests.
    expect(getQueueState!('active-job')).toEqual({ pending: 0, active: true });

    // Advance timers through retry — A resolves
    await vi.runAllTimersAsync();

    await expect(promiseA).resolves.toEqual({ done: true });

    // After completion, queue is idle
    expect(getQueueState!('active-job')).toEqual({ pending: 0, active: false });
  });

  it('synchronous callApi failure rejects and queue continues to next request', async () => {
    vi.stubGlobal('google', undefined);
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    // Enqueue A without google.script.run — A's processing will fail synchronously
    // because getRunner() throws in dispatchAttempt.
    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-x');

    // Now set up google.script.run with a success mock for B
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-syncfail-ok-1',
      data: { done: true },
    };
    const { runner: runnerB, apiHandlerSpy: spyB } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: successEnvelope,
    });

    setGoogle({ script: { run: runnerB } });

    // Enqueue B — should process after A's queue entry is drained
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-x');

    // A should reject with the missing-runner error
    await expect(promiseA).rejects.toThrow('google.script.run is unavailable in this runtime.');

    // B should dispatch and resolve using the newly installed harness
    await expect(promiseB).resolves.toEqual({ done: true });

    // Only B's dispatch should have reached the spy (A failed before transport)
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyB.mock.calls[0][0]).toMatchObject({ method: 'methodB' });
  });
});
