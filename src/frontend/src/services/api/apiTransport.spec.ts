import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import {
  setGoogle,
  clearGoogle,
  createRunnerWithoutApiHandler,
  loadCallApi,
  createGoogleScriptRunHarness,
  RAW_RESPONSE_PREVIEW_MAX_LENGTH,
  OVERSIZED_RAW_RESPONSE_PADDING_LENGTH,
  createRawSuccessResponseRunner,
} from '@/test/api/apiServiceTransportTestHelpers';
import type {
  ApiSuccessEnvelope,
  ApiErrorEnvelope,
  GoogleScript,
} from '@/test/api/apiServiceTestMocks';

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

    const data = await callApi<typeof expectedData>('hasScriptAuthorisation', {
      cohortId: 'cohort-1',
    });

    expect(data).toEqual(expectedData);
    expect(apiHandlerSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects when google.script.run is unavailable', async () => {
    vi.stubGlobal('google', undefined);
    const callApi = await loadCallApi();

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow(
      'google.script.run is unavailable in this runtime.'
    );
  });

  it('restores absent and pre-existing google descriptors after repeated stubs', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'google');
    const firstRuntime: GoogleScript = { script: { run: {} } };
    const secondRuntime: GoogleScript = { script: { run: {} } };
    const originalRuntime: GoogleScript = { script: { run: 'original' } };

    try {
      Reflect.deleteProperty(globalThis, 'google');
      setGoogle(firstRuntime);
      setGoogle(secondRuntime);
      expect((globalThis as unknown as Record<string, unknown>).google).toBe(secondRuntime);
      clearGoogle();
      expect(Object.hasOwn(globalThis, 'google')).toBe(false);

      Object.defineProperty(globalThis, 'google', {
        configurable: true,
        enumerable: false,
        value: originalRuntime,
        writable: false,
      });
      const preExistingDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'google');

      setGoogle(firstRuntime);
      setGoogle(secondRuntime);
      clearGoogle();

      expect(Object.getOwnPropertyDescriptor(globalThis, 'google')).toEqual(preExistingDescriptor);
      expect((globalThis as unknown as Record<string, unknown>).google).toBe(originalRuntime);
    } finally {
      clearGoogle();
      if (originalDescriptor === undefined) {
        Reflect.deleteProperty(globalThis, 'google');
      } else {
        Object.defineProperty(globalThis, 'google', originalDescriptor);
      }
    }
  });

  it('rejects when apiHandler is unavailable on google.script.run', async () => {
    const callApi = await loadCallApi();

    setGoogle({
      script: {
        run: createRunnerWithoutApiHandler(),
      },
    });

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow(
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

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow();
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

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow();
  });

  it('logs enriched error metadata with method and zodIssues for a malformed success envelope', async () => {
    const callApi = await loadCallApi();
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const malformedSuccessEnvelope = {
      ok: true,
      requestId: 'req-malformed-enriched',
    };
    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: malformedSuccessEnvelope,
    });

    setGoogle({
      script: { run: runner },
    });

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow();

    // Find error-level log entries from our context
    const errorEntries = consoleErrorSpy.mock.calls
      .filter(([context]) => context === 'services/apiService.callApi')
      .map(([, entry]) => entry as Record<string, unknown>)
      .filter((entry) => entry.level === 'error');

    expect(errorEntries.length).toBeGreaterThanOrEqual(1);
    const LAST_ENTRY_INDEX = -1;
    const lastErrorEntry = errorEntries.at(LAST_ENTRY_INDEX) as Record<string, unknown>;

    const metadata = lastErrorEntry.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({
      attempt: 0,
      method: 'hasScriptAuthorisation',
    });
    expect(metadata).toHaveProperty('zodIssues');
    const zodIssues = metadata.zodIssues as Array<unknown>;
    expect(Array.isArray(zodIssues)).toBe(true);
    expect(zodIssues.length).toBeGreaterThan(0);
  });

  it('logs debug event with method and attempt info before dispatch', async () => {
    const callApi = await loadCallApi();
    const consoleDebugSpy = vi.spyOn(console, 'debug');

    const successEnvelope = {
      ok: true,
      requestId: 'req-debug-assert',
      data: { authorised: true },
    };
    const { runner } = createGoogleScriptRunHarness({
      kind: 'success',
      payload: successEnvelope,
    });

    setGoogle({
      script: { run: runner },
    });

    await callApi('hasScriptAuthorisation', { cohortId: 'cohort-1' });

    // The debug log is written as console.debug(contextString, entryObject)
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      'services/apiService.callApi',
      expect.objectContaining({
        level: 'debug',
        context: 'services/apiService.callApi',
        metadata: expect.objectContaining({
          attempt: 0,
          params: { cohortId: 'cohort-1' },
          method: 'hasScriptAuthorisation',
        }),
      })
    );
  });

  it('rejects with descriptive error when GAS returns non-JSON in successHandler', async () => {
    const callApi = await loadCallApi();

    // Simulate GAS returning an HTML error page (non-JSON string) to successHandler.
    setGoogle({
      script: { run: createRawSuccessResponseRunner('<html><body>Login Required</body></html>') },
    });

    await expect(callApi('hasScriptAuthorisation')).rejects.toThrow(
      'Failed to parse API response as JSON.'
    );
  });

  it('attaches a truncated preview when the non-JSON success response exceeds the preview limit', async () => {
    const callApi = await loadCallApi();
    const oversizedRawResponse = `<html>${'x'.repeat(
      OVERSIZED_RAW_RESPONSE_PADDING_LENGTH
    )}</html>`;

    setGoogle({
      script: { run: createRawSuccessResponseRunner(oversizedRawResponse) },
    });

    let result: unknown;
    let didReject = false;
    try {
      result = await callApi('hasScriptAuthorisation');
    } catch (error: unknown) {
      didReject = true;
      result = error;
    }

    if (!didReject) {
      throw new Error('Expected callApi to reject for a non-JSON success response.');
    }
    assert.instanceOf(result, Error);
    const thrownError = result as Error & { preview?: string };

    expect(thrownError.message).toContain('Failed to parse API response as JSON.');
    expect(thrownError.preview?.endsWith('…')).toBe(true);
    expect(thrownError.preview?.length).toBeLessThanOrEqual(RAW_RESPONSE_PREVIEW_MAX_LENGTH + 1);
  });

  it('preserves requestId and error metadata in thrown transport errors', async () => {
    const callApi = await loadCallApi();
    const errorEnvelope: ApiErrorEnvelope = {
      ok: false,
      requestId: 'req-rate-limit-42',
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many concurrent requests.',
        isRetriable: true,
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

    await expect(callApi('hasScriptAuthorisation')).rejects.toMatchObject({
      requestId: 'req-rate-limit-42',
      code: 'RATE_LIMITED',
      message: 'Too many concurrent requests.',
      isRetriable: true,
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

    assert.isDefined(releaseAlphaResponse, 'Expected the alpha response handler to be registered.');
    assert.isDefined(releaseBetaResponse, 'Expected the beta response handler to be registered.');

    releaseBetaResponse();
    releaseAlphaResponse();

    await expect(Promise.all([alphaPromise, betaPromise])).resolves.toEqual([
      { label: 'alpha' },
      { label: 'beta' },
    ]);
  });
});
