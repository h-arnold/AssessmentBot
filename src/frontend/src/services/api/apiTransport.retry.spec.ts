import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  setGoogle,
  clearGoogle,
  loadCallApi,
  loadParseApiResponse,
  SECOND_ATTEMPT_CALL_COUNT,
  MAX_ATTEMPTS,
  makeRateLimitedEnvelope,
  createSequentialHarness,
  makeRateLimitedResponseEnvelope,
  makeDoneSuccessEnvelope,
} from '@/test/api/apiServiceTransportTestHelpers';
import type { ApiErrorEnvelope } from '@/test/api/apiServiceTestMocks';

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

  it('retries on RATE_LIMITED with isRetriable: true and resolves on second attempt', async () => {
    const callApi = await loadCallApi();

    const rateLimitedEnvelope = makeRateLimitedResponseEnvelope('req-retry-rl-1');
    const successEnvelope = makeDoneSuccessEnvelope('req-retry-ok-1');

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
      error: { code: 'RATE_LIMITED', message: 'Still rate limited.', isRetriable: true },
    };

    const { runner, apiHandlerSpy } = createSequentialHarness(
      Array.from({ length: MAX_ATTEMPTS }, () => {
        return {
          kind: 'success' as const,
          payload: rateLimitedEnvelope,
        };
      })
    );

    setGoogle({ script: { run: runner } });

    const resultPromise = callApi('someMethod');
    const assertion = expect(resultPromise).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    await vi.runAllTimersAsync();

    await assertion;
    expect(apiHandlerSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('does not retry when isRetriable is false', async () => {
    const callApi = await loadCallApi();

    const notRetriableEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-no-retry-retriable-false',
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limited but not retriable.',
        isRetriable: false,
      },
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
      error: { code: 'INVALID_REQUEST', message: 'Bad request.', isRetriable: true },
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

describe('apiService.parseApiResponse', () => {
  const context = 'services/apiService.parseApiResponse';
  const oversizedPaddingLength = 400;
  const truncatedPreviewMaxLength = 201;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed value and logs nothing for a valid response', async () => {
    const parseApiResponse = await loadParseApiResponse();
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const schema = z.object({ id: z.string() });
    const result = parseApiResponse(schema, 'getWidget', { id: 'w-1' });

    expect(result).toEqual({ id: 'w-1' });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs structured diagnostics (method, zodIssues, responsePreview) and re-throws on schema failure', async () => {
    const parseApiResponse = await loadParseApiResponse();
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const schema = z.object({ id: z.string() });

    expect(() => parseApiResponse(schema, 'getWidget', { id: 42 })).toThrow(z.ZodError);

    const errorEntry = consoleErrorSpy.mock.calls
      .map(([, entry]) => entry as Record<string, unknown>)
      .find((entry) => entry.context === context && entry.level === 'error');

    expect(errorEntry).toBeDefined();
    const metadata = errorEntry!.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({ method: 'getWidget' });
    expect(Array.isArray(metadata.zodIssues)).toBe(true);
    expect((metadata.zodIssues as unknown[]).length).toBeGreaterThan(0);
    expect(typeof metadata.responsePreview).toBe('string');
  });

  it('truncates the responsePreview with an ellipsis when the payload exceeds 200 characters', async () => {
    const parseApiResponse = await loadParseApiResponse();
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const schema = z.object({ id: z.string() });
    const oversized = { id: 42, padding: 'y'.repeat(oversizedPaddingLength) };

    expect(() => parseApiResponse(schema, 'getWidget', oversized)).toThrow(z.ZodError);

    const errorEntry = consoleErrorSpy.mock.calls
      .map(([, entry]) => entry as Record<string, unknown>)
      .find((entry) => entry.context === context && entry.level === 'error');

    const metadata = errorEntry!.metadata as Record<string, unknown>;
    const preview = metadata.responsePreview as string;
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(truncatedPreviewMaxLength);
  });
});
