import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import {
  setGoogle,
  clearGoogle,
  loadApiQueue,
  loadCallApi,
  createGoogleScriptRunHarness,
  createSequentialHarness,
} from '@/test/api/apiServiceTransportTestHelpers';
import type { ApiSuccessEnvelope, ApiErrorEnvelope } from '@/test/api/apiServiceTestMocks';

const SEQUENTIAL_CALL_COUNT = 2;

describe('callApiQueued processing loop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('executes queued requests sequentially within the same jobName', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const dataA = { result: 'A' };
    const dataB = { result: 'B' };
    const envelopeA: ApiSuccessEnvelope<typeof dataA> = {
      ok: true,
      requestId: 'req-seq-a',
      data: dataA,
    };
    const envelopeB: ApiSuccessEnvelope<typeof dataB> = {
      ok: true,
      requestId: 'req-seq-b',
      data: dataB,
    };

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: envelopeA },
      { kind: 'success', payload: envelopeB },
    ]);

    setGoogle({ script: { run: runner } });

    const promiseA = callApiQueued!('methodA', { x: 1 }, 'job-x');
    const promiseB = callApiQueued!('methodB', { y: 2 }, 'job-x');

    await expect(promiseA).resolves.toEqual(dataA);
    await expect(promiseB).resolves.toEqual(dataB);

    expect(apiHandlerSpy).toHaveBeenCalledTimes(SEQUENTIAL_CALL_COUNT);
    // Verify A was dispatched before B
    expect(apiHandlerSpy.mock.calls[0][0]).toMatchObject({ method: 'methodA' });
    expect(apiHandlerSpy.mock.calls[1][0]).toMatchObject({ method: 'methodB' });
  });

  it('processes different jobNames independently and concurrently', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const dataX = { label: 'job-x-result' };
    const dataY = { label: 'job-y-result' };
    const envelopeX: ApiSuccessEnvelope<typeof dataX> = {
      ok: true,
      requestId: 'req-par-x',
      data: dataX,
    };
    const envelopeY: ApiSuccessEnvelope<typeof dataY> = {
      ok: true,
      requestId: 'req-par-y',
      data: dataY,
    };

    let releaseX: (() => void) | undefined;
    let releaseY: (() => void) | undefined;

    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      const method = (request as { method?: unknown })?.method;
      if (method === 'methodX') {
        releaseX = () => {
          callbacks.successHandler?.(envelopeX);
        };
        return;
      }
      if (method === 'methodY') {
        releaseY = () => {
          callbacks.successHandler?.(envelopeY);
        };
        return;
      }
      callbacks.failureHandler?.(new Error(`Unexpected method: ${String(method)}`));
    });

    setGoogle({ script: { run: runner } });

    const promiseX = callApiQueued!('methodX', { id: 1 }, 'job-x');
    const promiseY = callApiQueued!('methodY', { id: 2 }, 'job-y');

    // Both should have dispatched before either is released — independent queues
    expect(releaseX).toBeDefined();
    expect(releaseY).toBeDefined();

    // Release in opposite order to verify independence
    releaseY!();
    releaseX!();

    await expect(promiseX).resolves.toEqual(dataX);
    await expect(promiseY).resolves.toEqual(dataY);
  });

  it('resolves queued promise with data from callApi', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const expectedData = { authorised: true };
    const envelope: ApiSuccessEnvelope<typeof expectedData> = {
      ok: true,
      requestId: 'req-passthrough',
      data: expectedData,
    };

    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: envelope,
    });

    setGoogle({ script: { run: runner } });

    const result = await callApiQueued!('getStatus', undefined, 'passthrough-job');
    expect(result).toEqual(expectedData);
  });

  it('rejects queued promise with ApiTransportError when backend returns failure', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const errorEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-reject-1',
      error: { code: 'INVALID_REQUEST', message: 'Bad input.' },
    };

    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: errorEnvelope,
    });

    setGoogle({ script: { run: runner } });

    await expect(callApiQueued!('badMethod', { x: 1 }, 'reject-job')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Bad input.',
    });
  });

  it('dispatches a newly enqueued request immediately after previous queue drains', async () => {
    const { callApiQueued } = await loadApiQueue();
    expect(callApiQueued).toBeDefined();

    const dataA = { phase: 'first' };
    const dataB = { phase: 'second' };
    const envelopeA: ApiSuccessEnvelope<typeof dataA> = {
      ok: true,
      requestId: 'req-drain-a',
      data: dataA,
    };
    const envelopeB: ApiSuccessEnvelope<typeof dataB> = {
      ok: true,
      requestId: 'req-drain-b',
      data: dataB,
    };

    const spy = vi.fn();
    let callIndex = 0;
    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      spy(request);
      callIndex++;
      queueMicrotask(() => {
        if (callIndex === 1) {
          callbacks.successHandler?.(envelopeA);
        } else {
          callbacks.successHandler?.(envelopeB);
        }
      });
    });

    setGoogle({ script: { run: runner } });

    // First request: enqueue and await completion
    await callApiQueued!('firstMethod', { n: 1 }, 'drain-job');

    expect(spy).toHaveBeenCalledTimes(1);

    // Queue should be idle now — enqueue a second request
    const spyCallCountBeforeSecond = spy.mock.calls.length;
    const promiseB = callApiQueued!('secondMethod', { n: 2 }, 'drain-job');

    // Second request should dispatch immediately (no timer advancement needed)
    expect(spy.mock.calls.length).toBeGreaterThan(spyCallCountBeforeSecond);

    await expect(promiseB).resolves.toEqual(dataB);
  });

  it('allows direct callApi to dispatch immediately while queue is processing', async () => {
    const { callApiQueued } = await loadApiQueue();
    const callApi = await loadCallApi();
    expect(callApiQueued).toBeDefined();
    expect(callApi).toBeDefined();

    const queuedData = { source: 'queued' };
    const directData = { source: 'direct' };
    const queuedEnvelope: ApiSuccessEnvelope<typeof queuedData> = {
      ok: true,
      requestId: 'req-ni-q',
      data: queuedData,
    };
    const directEnvelope: ApiSuccessEnvelope<typeof directData> = {
      ok: true,
      requestId: 'req-ni-d',
      data: directData,
    };

    let releaseQueued: (() => void) | undefined;
    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      const method = (request as { method?: unknown })?.method;
      if (method === 'queuedMethod') {
        releaseQueued = () => {
          callbacks.successHandler?.(queuedEnvelope);
        };
        return;
      }
      // For any other method (direct callApi), resolve on next microtask
      queueMicrotask(() => {
        callbacks.successHandler?.(directEnvelope);
      });
    });

    setGoogle({ script: { run: runner } });

    // Enqueue a request — processing starts, releaseQueued captured
    const queuedPromise = callApiQueued!('queuedMethod', {}, 'nointerfere-job');
    expect(releaseQueued).toBeDefined();

    // Direct callApi should dispatch and resolve independently
    const directPromise = callApi('directMethod', { x: 1 });
    await expect(directPromise).resolves.toEqual(directData);

    // Now release the queued request
    releaseQueued!();
    await expect(queuedPromise).resolves.toEqual(queuedData);
  });
});
