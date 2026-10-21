import { vi } from 'vitest';
import type * as ApiQueue from '@/services/api/apiQueue';
import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
} from '../googleScriptRunHarness';
import {
  createApiServiceMockScaffold,
  type ApiSuccessEnvelope,
  type ApiErrorEnvelope,
  type GoogleScript,
  type GoogleScriptRunWithoutApiHandler,
  type CallApi,
} from './apiServiceTestMocks';

/**
 * Sets a mock `google` runtime object for tests.
 *
 * @param {GoogleScript} value - The mock Google runtime to install.
 */
export function setGoogle(value: GoogleScript): void {
  vi.stubGlobal('google', value);
}

/**
 * Restores the `google` runtime object that preceded the test stub.
 *
 * @returns {void} Nothing.
 */
export function clearGoogle(): void {
  vi.unstubAllGlobals();
}

/**
 * Creates a mock runner shape that exposes handler registration but omits `apiHandler`.
 *
 * @returns {GoogleScriptRunWithoutApiHandler} The runner-like shape for missing-apiHandler tests.
 */
export function createRunnerWithoutApiHandler(): GoogleScriptRunWithoutApiHandler {
  return {
    ...createGoogleScriptRunApiHandlerMock(() => {
      return;
    }),
    apiHandler: undefined,
  };
}

export const apiServiceModulePath: string = '@/services/apiService';

/**
 * Loads the queue owner after the caller's module reset, isolating its job registry.
 *
 * @returns {Promise<typeof import('@/services/api/apiQueue')>} The queue exports.
 */
export async function loadApiQueue(): Promise<typeof ApiQueue> {
  return import('@/services/api/apiQueue');
}

/**
 * Loads a fresh `callApi` export from the module under test.
 *
 * @returns {Promise<CallApi>} The `callApi` function from the module under test.
 */
export async function loadCallApi(): Promise<CallApi> {
  const apiServiceModule = (await import(apiServiceModulePath)) as {
    callApi: CallApi;
  };

  return apiServiceModule.callApi;
}

/**
 * Loads a fresh `parseApiResponse` export from the module under test.
 *
 * @returns {Promise<typeof import('@/services/apiService')['parseApiResponse']>} The helper under test.
 */
export async function loadParseApiResponse() {
  const apiServiceModule = (await import(apiServiceModulePath)) as {
    parseApiResponse: <T>(schema: unknown, method: string, data: unknown) => T;
  };

  return apiServiceModule.parseApiResponse;
}

export type RunnerHarnessResponse =
  { kind: 'success'; payload: unknown } | { kind: 'failure'; payload: unknown };

export const SECOND_ATTEMPT_CALL_COUNT = 2;
export const MAX_ATTEMPTS = 4;
/**
 * Builds a retriable RATE_LIMITED envelope for retry-path tests.
 *
 * @param {string} requestId - The request identifier to include in the envelope.
 * @returns {ApiErrorEnvelope} The constructed error envelope.
 */
export function makeRateLimitedEnvelope(requestId: string): ApiErrorEnvelope {
  return {
    ok: false,
    requestId,
    error: { code: 'RATE_LIMITED', message: `Attempt ${requestId} failed.`, isRetriable: true },
  };
}

/**
 * Creates a controllable `google.script.run` harness for unit tests.
 *
 * @param {RunnerHarnessResponse} response - The response shape to replay through the harness.
 * @returns {{ runner: GoogleScriptRunApiHandler; apiHandlerSpy: ReturnType<typeof vi.fn>; }} The runner harness and its spy.
 */
export function createGoogleScriptRunHarness(response: RunnerHarnessResponse): {
  runner: GoogleScriptRunApiHandler;
  apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
  const { callApiMock: apiHandlerSpy } = createApiServiceMockScaffold();

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

export const RAW_RESPONSE_PREVIEW_MAX_LENGTH = 120;
export const OVERSIZED_RAW_RESPONSE_PADDING_LENGTH = 200;

/**
 * Delivers a raw success response to `callApi` without the shared harness factory's
 * automatic `JSON.stringify` wrapper.
 *
 * @remarks
 * The shared harness factory faithfully mimics `google.script.run`'s automatic JSON
 * stringification, so `apiService`'s JSON-parser error branch is unreachable through
 * it. This focused seam is the project-approved exception for parser-edge coverage: it
 * mirrors the GAS fallback to non-JSON string output (for example, when a prohibited
 * return type forces `Object.toString()` serialisation). Ordinary transport tests must
 * keep using `createGoogleScriptRunApiHandlerMock`.
 *
 * @param {unknown} rawResponse - The raw success value delivered to `dispatchAttempt`.
 * @returns {GoogleScriptRunApiHandler} A runner that replays the raw value once.
 */
export function createRawSuccessResponseRunner(rawResponse: unknown): GoogleScriptRunApiHandler {
  let capturedSuccessHandler: ((response: unknown) => void) | undefined;

  const rawRunner = {
    withSuccessHandler(handler: (response: unknown) => void) {
      capturedSuccessHandler = handler;
      return rawRunner;
    },
    withFailureHandler() {
      return rawRunner;
    },
    apiHandler() {
      queueMicrotask(() => {
        capturedSuccessHandler?.(rawResponse);
      });
    },
  };

  return rawRunner as unknown as GoogleScriptRunApiHandler;
}

// ── Helpers for retry policy tests ───────────────────────────────────────────

/**
 * Creates a `google.script.run` harness that returns responses in sequence.
 * Each call to `apiHandler` consumes the next response; the last response is
 * repeated if the sequence is exhausted.
 *
 * @param {RunnerHarnessResponse[]} responses - The ordered responses to replay.
 * @returns {{ runner: GoogleScriptRunApiHandler; apiHandlerSpy: ReturnType<typeof vi.fn>; }} The sequential harness and its spy.
 */
export function createSequentialHarness(responses: RunnerHarnessResponse[]): {
  runner: GoogleScriptRunApiHandler;
  apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
  let callCount = 0;

  const { callApiMock: apiHandlerSpy } = createApiServiceMockScaffold();

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
 * Creates a RATE_LIMITED error envelope with "Rate limited." message.
 *
 * @param {string} requestId - The request identifier to include in the envelope.
 * @returns {ApiErrorEnvelope} The constructed error envelope.
 */
export function makeRateLimitedResponseEnvelope(requestId: string): ApiErrorEnvelope {
  return {
    ok: false,
    requestId,
    error: { code: 'RATE_LIMITED', message: 'Rate limited.', isRetriable: true },
  };
}

/**
 * Creates a success envelope with `{ done: true }` data.
 *
 * @param {string} requestId - The request identifier to include in the envelope.
 * @returns {ApiSuccessEnvelope<{ done: boolean }>} The constructed success envelope.
 */
export function makeDoneSuccessEnvelope(requestId: string): ApiSuccessEnvelope<{ done: boolean }> {
  return {
    ok: true,
    requestId,
    data: { done: true },
  };
}
