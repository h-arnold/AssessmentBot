/**
 * Retry policy tests for apiService.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
} from '../../test/googleScriptRunHarness';
import {
  loadCallApi,
  setGoogle,
  clearGoogle,
  SECOND_ATTEMPT_CALL_COUNT,
  MAX_ATTEMPTS,
} from './helpers';

type ApiSuccessEnvelope<TData> = {
  ok: true;
  requestId: string;
  data: TData;
};

type ApiErrorEnvelope = {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    retriable?: boolean;
  };
};

type RunnerHarnessResponse =
  | { kind: 'success'; payload: unknown }
  | { kind: 'failure'; payload: unknown };

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
