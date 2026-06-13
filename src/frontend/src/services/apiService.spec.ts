import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
} from '../test/googleScriptRunHarness';

type ApiSuccessEnvelope<TData> = {
  ok: true;
  requestId: string;
  data: TData;
  meta?: Record<string, unknown>;
};

type ApiErrorEnvelope = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    retriable?: boolean;
  };
  meta?: Record<string, unknown>;
};

type GoogleScript = {
  script?: {
    run?: unknown;
  };
};

type GoogleScriptRunWithoutApiHandler = Omit<GoogleScriptRunApiHandler, 'apiHandler'> & {
  apiHandler: undefined;
};

type CallApi = <TResponse>(method: string, parameters?: unknown) => Promise<TResponse>;
type CallApiQueued = <TResponse>(
  method: string,
  parameters: unknown,
  jobName: string
) => Promise<TResponse>;

type QueueState = { pending: number; active: boolean };
type GetQueueState = (jobName: string) => QueueState;

/**
 * Sets a mock `google` runtime object for tests.
 *
 * @param {GoogleScript} value - The mock Google runtime to install.
 */
function setGoogle(value: GoogleScript): void {
  (globalThis as unknown as Record<string, unknown>).google = value;
}

/**
 * Removes the mock `google` runtime object after each test.
 *
 * @returns {void} Nothing.
 */
function clearGoogle(): void {
  delete (globalThis as Record<string, unknown>).google;
}

/**
 * Creates a mock runner shape that exposes handler registration but omits `apiHandler`.
 *
 * @returns {GoogleScriptRunWithoutApiHandler} The runner-like shape for missing-apiHandler tests.
 */
function createRunnerWithoutApiHandler(): GoogleScriptRunWithoutApiHandler {
  return {
    ...createGoogleScriptRunApiHandlerMock(() => {
      return;
    }),
    apiHandler: undefined,
  };
}

const apiServiceModulePath: string = './apiService';

/**
 * Loads a fresh `callApi` export from the module under test.
 *
 * @returns {Promise<CallApi>} The `callApi` function from the module under test.
 */
async function loadCallApi(): Promise<CallApi> {
  const apiServiceModule = (await import(apiServiceModulePath)) as {
    callApi: CallApi;
  };

  return apiServiceModule.callApi;
}

type RunnerHarnessResponse =
  | { kind: 'success'; payload: unknown }
  | { kind: 'failure'; payload: unknown };

const SECOND_ATTEMPT_CALL_COUNT = 2;
const MAX_ATTEMPTS = 4;
/**
 * Builds a retriable RATE_LIMITED envelope for retry-path tests.
 *
 * @param {string} requestId - The request identifier to include in the envelope.
 * @returns {ApiErrorEnvelope} The constructed error envelope.
 */
function makeRateLimitedEnvelope(requestId: string): ApiErrorEnvelope {
  return {
    ok: false,
    requestId,
    error: { code: 'RATE_LIMITED', message: `Attempt ${requestId} failed.`, retriable: true },
  };
}

/**
 * Creates a controllable `google.script.run` harness for unit tests.
 *
 * @param {RunnerHarnessResponse} response - The response shape to replay through the harness.
 * @returns {{ runner: GoogleScriptRunApiHandler; apiHandlerSpy: ReturnType<typeof vi.fn>; }} The runner harness and its spy.
 */
function createGoogleScriptRunHarness(response: RunnerHarnessResponse): {
  runner: GoogleScriptRunApiHandler;
  apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
  const apiHandlerSpy = vi.fn();

  const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
    apiHandlerSpy(request);

    queueMicrotask(() => {
      if (response.kind === 'success') {
        callbacks.successHandler?.(response.payload);
        return;
      }

      callbacks.failureHandler?.(response.payload);
    });
  });

  return {
    runner,
    apiHandlerSpy,
  };
}

describe('apiService.callApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('returns parsed data for a valid success envelope', async () => {
    const callApi = await loadCallApi();
    const expectedData = { authorised: true };
    const successEnvelope: ApiSuccessEnvelope<typeof expectedData> = {
      ok: true,
      requestId: 'req-success-1',
      data: expectedData,
    };

    const { runner, apiHandlerSpy } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: successEnvelope,
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    const data = await callApi<typeof expectedData>('getAuthorisationStatus', {
      cohortId: 'cohort-1',
    });

    expect(data).toEqual(expectedData);
    expect(apiHandlerSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects when google.script.run is unavailable', async () => {
    const callApi = await loadCallApi();

    await expect(callApi('getAuthorisationStatus')).rejects.toThrow(
      'google.script.run is unavailable in this runtime.'
    );
  });

  it('rejects when apiHandler is unavailable on google.script.run', async () => {
    const callApi = await loadCallApi();

    setGoogle({
      script: {
        run: createRunnerWithoutApiHandler(),
      },
    });

    await expect(callApi('getAuthorisationStatus')).rejects.toThrow(
      'google.script.run.apiHandler is unavailable in this runtime.'
    );
  });

  it('rejects when request payload fails schema validation before transport', async () => {
    const callApi = await loadCallApi();
    const { runner, apiHandlerSpy } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: {
        ok: true,
        requestId: 'req-transport-1',
        data: true,
      },
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    await expect(callApi('', { malformed: true })).rejects.toThrow();
    expect(apiHandlerSpy).not.toHaveBeenCalled();
  });

  it('rejects when backend returns a malformed success envelope', async () => {
    const callApi = await loadCallApi();
    const malformedSuccessEnvelope = {
      ok: true,
      requestId: 'req-malformed-success',
    };
    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: malformedSuccessEnvelope,
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    await expect(callApi('getAuthorisationStatus')).rejects.toThrow();
  });

  it('rejects when backend returns a malformed error envelope', async () => {
    const callApi = await loadCallApi();
    const malformedErrorEnvelope = {
      ok: false,
      requestId: 'req-malformed-error',
      error: {
        message: 'Missing code should fail envelope parsing.',
      },
    };
    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: malformedErrorEnvelope,
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    await expect(callApi('getAuthorisationStatus')).rejects.toThrow();
  });

  it('rejects with descriptive error when GAS returns non-JSON in successHandler', async () => {
    const callApi = await loadCallApi();

    // Simulate GAS returning an HTML error page (non-JSON string) to successHandler.
    // The standard harness always JSON.stringify()s the successHandler value, which
    // makes the JSON-parse failure path unreachable through it. A focused custom mock
    // exercises the edge case where GAS returns e.g. an HTML login page.
    let capturedSuccessHandler: ((response: unknown) => void) | undefined;

    const customMock = {
      withSuccessHandler(handler: (response: unknown) => void) {
        capturedSuccessHandler = handler;
        return customMock;
      },

      withFailureHandler() {
        return customMock;
      },

      apiHandler() {
        queueMicrotask(() => {
          capturedSuccessHandler?.('<html><body>Login Required</body></html>');
        });
      },
    };

    setGoogle({
      script: { run: customMock as unknown as GoogleScriptRunApiHandler },
    });

    await expect(callApi('getAuthorisationStatus')).rejects.toThrow(
      'Failed to parse API response as JSON.'
    );
  });

  it('preserves requestId and error metadata in thrown transport errors', async () => {
    const callApi = await loadCallApi();
    const errorEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-rate-limit-42',
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many concurrent requests.',
        retriable: true,
      },
      meta: {
        retryAfterMs: 1500,
        activeRequests: 25,
      },
    };
    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: errorEnvelope,
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    await expect(callApi('getAuthorisationStatus')).rejects.toMatchObject({
      requestId: 'req-rate-limit-42',
      code: 'RATE_LIMITED',
      message: 'Too many concurrent requests.',
      retriable: true,
      meta: {
        retryAfterMs: 1500,
        activeRequests: 25,
      },
    });
  });

  it('keeps concurrent responses bound to the correct request handlers', async () => {
    const callApi = await loadCallApi();

    const alphaEnvelope: ApiSuccessEnvelope<{ label: string }> = {
      ok: true,
      requestId: 'req-concurrent-alpha',
      data: { label: 'alpha' },
    };
    const betaEnvelope: ApiSuccessEnvelope<{ label: string }> = {
      ok: true,
      requestId: 'req-concurrent-beta',
      data: { label: 'beta' },
    };

    let releaseAlphaResponse: (() => void) | undefined;
    let releaseBetaResponse: (() => void) | undefined;

    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      const method = (request as { method?: unknown })?.method;

      if (method === 'loadAlpha') {
        releaseAlphaResponse = () => {
          callbacks.successHandler?.(alphaEnvelope);
        };
        return;
      }

      if (method === 'loadBeta') {
        releaseBetaResponse = () => {
          callbacks.successHandler?.(betaEnvelope);
        };
        return;
      }

      callbacks.failureHandler?.(new Error(`Unexpected method: ${String(method)}`));
    });

    setGoogle({
      script: {
        run: runner,
      },
    });

    const alphaPromise = callApi<{ label: string }>('loadAlpha');
    const betaPromise = callApi<{ label: string }>('loadBeta');

    if (releaseAlphaResponse === undefined || releaseBetaResponse === undefined) {
      throw new Error('Expected both concurrent responses to be registered before release.');
    }

    releaseBetaResponse();
    releaseAlphaResponse();

    await expect(Promise.all([alphaPromise, betaPromise])).resolves.toEqual([
      { label: 'alpha' },
      { label: 'beta' },
    ]);
  });
});

// ── Helpers for retry policy tests ───────────────────────────────────────────

/**
 * Creates a `google.script.run` harness that returns responses in sequence.
 * Each call to `apiHandler` consumes the next response; the last response is
 * repeated if the sequence is exhausted.
 *
 * @param {RunnerHarnessResponse[]} responses - The ordered responses to replay.
 * @returns {{ runner: GoogleScriptRunApiHandler; apiHandlerSpy: ReturnType<typeof vi.fn>; }} The sequential harness and its spy.
 */
function createSequentialHarness(responses: RunnerHarnessResponse[]): {
  runner: GoogleScriptRunApiHandler;
  apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
  let callCount = 0;

  const apiHandlerSpy = vi.fn();

  const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
    apiHandlerSpy(request);

    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount++;

    queueMicrotask(() => {
      if (response.kind === 'success') {
        callbacks.successHandler?.(response.payload);
        return;
      }
      callbacks.failureHandler?.(response.payload);
    });
  });

  return { runner, apiHandlerSpy };
}

// ── Retry policy ──────────────────────────────────────────────────────────────

describe('retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    clearGoogle();
  });

  it('retries on RATE_LIMITED with retriable: true and resolves on second attempt', async () => {
    const callApi = await loadCallApi();

    const rateLimitedEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-retry-rl-1',
      error: { code: 'RATE_LIMITED', message: 'Rate limited.', retriable: true },
    };
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-retry-ok-1',
      data: { done: true },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: rateLimitedEnvelope },
      { kind: 'success', payload: successEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi<{ done: boolean }>('someMethod');

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ done: true });
    expect(apiHandlerSpy).toHaveBeenCalledTimes(SECOND_ATTEMPT_CALL_COUNT);
  });

  it('stops retrying after max 4 attempts and rejects', async () => {
    const callApi = await loadCallApi();

    const rateLimitedEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-retry-max-1',
      error: { code: 'RATE_LIMITED', message: 'Still rate limited.', retriable: true },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness(
      Array.from({ length: MAX_ATTEMPTS }, () => ({
        kind: 'success' as const,
        payload: rateLimitedEnvelope,
      }))
    );

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi('someMethod');
    const assertion = expect(resultPromise).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    await vi.runAllTimersAsync();

    await assertion;
    expect(apiHandlerSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('does not retry when retriable is false', async () => {
    const callApi = await loadCallApi();

    const notRetriableEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-no-retry-retriable-false',
      error: { code: 'RATE_LIMITED', message: 'Rate limited but not retriable.', retriable: false },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: notRetriableEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi('someMethod');
    const assertion = expect(resultPromise).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    await vi.runAllTimersAsync();

    await assertion;
    expect(apiHandlerSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry when error code is not RATE_LIMITED', async () => {
    const callApi = await loadCallApi();

    const invalidRequestEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-no-retry-code',
      error: { code: 'INVALID_REQUEST', message: 'Bad request.', retriable: true },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness([
      { kind: 'success', payload: invalidRequestEnvelope },
    ]);

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi('someMethod');
    const assertion = expect(resultPromise).rejects.toMatchObject({ code: 'INVALID_REQUEST' });

    await vi.runAllTimersAsync();

    await assertion;
    expect(apiHandlerSpy).toHaveBeenCalledTimes(1);
  });

  it('final rejection after exhaustion carries the error from the last attempt', async () => {
    const callApi = await loadCallApi();

    const { runner } = createSequentialHarness([
      { kind: 'success', payload: makeRateLimitedEnvelope('req-exhaust-1') },
      { kind: 'success', payload: makeRateLimitedEnvelope('req-exhaust-2') },
      { kind: 'success', payload: makeRateLimitedEnvelope('req-exhaust-3') },
      { kind: 'success', payload: makeRateLimitedEnvelope('req-exhaust-4') },
    ]);

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi('someMethod');
    const assertion = expect(resultPromise).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      requestId: 'req-exhaust-4',
      message: 'Attempt req-exhaust-4 failed.',
    });

    await vi.runAllTimersAsync();

    await assertion;
  });
});

// ── callApiQueued and getQueueState validation ────────────────────────────────

describe('callApiQueued and getQueueState validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('callApiQueued throws when method is empty string', async () => {
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };

    expect(callApiQueued).toBeDefined();
    expect(() => callApiQueued!('', { x: 1 }, 'myJob')).toThrow();
  });

  it('callApiQueued throws when jobName is empty string', async () => {
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };

    expect(callApiQueued).toBeDefined();
    expect(() => callApiQueued!('myMethod', { x: 1 }, '')).toThrow();
  });

  it('getQueueState throws when jobName is empty string', async () => {
    const { getQueueState } = (await import(apiServiceModulePath)) as {
      getQueueState?: GetQueueState;
    };

    expect(getQueueState).toBeDefined();
    expect(() => getQueueState!('')).toThrow();
  });

  it('getQueueState returns zero-state for unknown job name', async () => {
    const { getQueueState } = (await import(apiServiceModulePath)) as {
      getQueueState?: GetQueueState;
    };

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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };

    expect(callApiQueued).toBeDefined();

    const promise = callApiQueued!('myMethod', { x: 1 }, 'job-a');

    // Assert it's a Promise — unreachable until GREEN implements enqueue
    expect(promise).toBeInstanceOf(Promise);

    // Verify it does NOT resolve within a tick (no dequeue loop yet)
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it('two enqueues with same jobName produce distinct pending Promises', async () => {
    const { callApiQueued, getQueueState } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      getQueueState?: GetQueueState;
    };
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
    const { callApiQueued, getQueueState } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      getQueueState?: GetQueueState;
    };
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
    expect(callApiQueued).toBeDefined();

    const promiseA = callApiQueued!('methodA', { id: 1 }, 'job-a');
    const promiseB = callApiQueued!('methodB', { id: 2 }, 'job-a');

    // Must be distinct objects
    expect(promiseA).not.toBe(promiseB);

    // Neither should resolve within a tick
    let resolvedA = false;
    let resolvedB = false;
    promiseA.then(() => {
      resolvedA = true;
    });
    promiseB.then(() => {
      resolvedB = true;
    });

    await Promise.resolve();
    expect(resolvedA).toBe(false);
    expect(resolvedB).toBe(false);
  });
});

// ── callApiQueued processing loop ─────────────────────────────────────────────

const SEQUENTIAL_CALL_COUNT = 2;

describe('callApiQueued processing loop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('executes queued requests sequentially within the same jobName', async () => {
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
    const { callApiQueued, callApi } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      callApi: CallApi;
    };
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

// ── getQueueState live snapshots ──────────────────────────────────────────────

describe('getQueueState live snapshots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('returns correct pending count excluding in-flight request during active processing', async () => {
    const { callApiQueued, getQueueState } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      getQueueState?: GetQueueState;
    };
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
    expect(releaseFns.length).toBe(1);

    // After enqueuing 3 requests for an idle queue: 1 in-flight, 2 pending.
    expect(getQueueState!('live-job')).toEqual({ pending: 2, active: true });

    // Release the first (in-flight) request — it resolves, processQueue shifts it,
    // and dispatches the next queued request.
    releaseFns[0]();
    await expect(promiseA).resolves.toEqual({ seq: 1 });

    // Second dispatch should have fired now. Queue has 1 pending, 1 active.
    expect(releaseFns.length).toBe(SECOND_DISPATCH_CALLBACK_COUNT);

    // After first resolve: 1 in-flight, 1 pending.
    expect(getQueueState!('live-job')).toEqual({ pending: 1, active: true });

    // Release the second request.
    releaseFns[1]();
    await expect(promiseB).resolves.toEqual({ seq: 2 });

    // Third dispatch should have fired. Queue has 0 pending, 1 active.
    expect(releaseFns.length).toBe(THIRD_DISPATCH_CALLBACK_COUNT);

    // After second resolve: 0 pending, 1 in-flight.
    expect(getQueueState!('live-job')).toEqual({ pending: 0, active: true });

    // Release the third request — queue drains.
    releaseFns[2]();
    await expect(promiseC).resolves.toEqual({ seq: 3 });

    // Queue is now idle.
    expect(getQueueState!('live-job')).toEqual({ pending: 0, active: false });
  });

  it('returns zero-state after queue drains', async () => {
    const { callApiQueued, getQueueState } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      getQueueState?: GetQueueState;
    };
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

// ── callApiQueued retry interaction and failure continuation ─────────────────

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

    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
    expect(callApiQueued).toBeDefined();

    const rateLimitedEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-rl-block-1',
      error: { code: 'RATE_LIMITED', message: 'Rate limited.', retriable: true },
    };
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-ok-block-1',
      data: { done: true },
    };

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

    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
    expect(callApiQueued).toBeDefined();

    const rateLimitedEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-exhaust-1',
      error: { code: 'RATE_LIMITED', message: 'Rate limited.', retriable: true },
    };
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-exhaust-ok-1',
      data: { done: true },
    };

    // 4 RATE_LIMITED responses (one per attempt, exhausting retries) + 1 success for B
    const responses: RunnerHarnessResponse[] = [
      ...Array.from({ length: MAX_ATTEMPTS }, () => ({
        kind: 'success' as const,
        payload: rateLimitedEnvelope,
      })),
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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
    expect(callApiQueued).toBeDefined();

    const invalidRequestEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-nonretry-1',
      error: { code: 'INVALID_REQUEST', message: 'Invalid request data.', retriable: false },
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

    const { callApiQueued, getQueueState } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
      getQueueState?: GetQueueState;
    };
    expect(callApiQueued).toBeDefined();
    expect(getQueueState).toBeDefined();

    const rateLimitedEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-active-rl-1',
      error: { code: 'RATE_LIMITED', message: 'Rate limited.', retriable: true },
    };
    const successEnvelope: ApiSuccessEnvelope<{ done: boolean }> = {
      ok: true,
      requestId: 'req-active-ok-1',
      data: { done: true },
    };

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
    const { callApiQueued } = (await import(apiServiceModulePath)) as {
      callApiQueued?: CallApiQueued;
    };
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
