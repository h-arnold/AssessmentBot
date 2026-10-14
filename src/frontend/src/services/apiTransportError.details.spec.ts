import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError, type ApiErrorEnvelope } from '../errors/apiTransportError';
import { createGoogleScriptRunApiHandlerMock } from '../test/googleScriptRunHarness';
import { callApi } from './apiService';

/**
 * Sets a mock `google` runtime object for transport tests.
 *
 * @param {unknown} value - The mock Google runtime to install.
 */
function setGoogle(value: unknown): void {
  vi.stubGlobal('google', value);
}

/**
 * Removes the mock `google` runtime object after each test.
 */
function clearGoogle(): void {
  vi.unstubAllGlobals();
}

/** Structured diagnostics carried by the documented stale error envelope. */
const staleDetails = {
  definitionKey: 'algebra-baseline',
  referenceStale: true,
  isTemplateStale: false,
  referenceLastModified: '2026-01-05T10:00:00.000Z',
  templateLastModified: null,
};

/**
 * Builds a `DEFINITION_STALE` envelope carrying the documented details block.
 *
 * @returns {unknown} The raw envelope payload handed to the mock runner.
 */
function makeStaleEnvelope(): unknown {
  return {
    ok: false,
    requestId: 'req-stale-details-1',
    error: {
      code: 'DEFINITION_STALE',
      message: 'Definition is stale.',
      isRetriable: false,
      details: staleDetails,
    },
  };
}

describe('ApiTransportError structured details', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearGoogle();
  });

  it('leaves details undefined when the envelope carries no details block', () => {
    const error = new ApiTransportError({
      requestId: 'req-no-details',
      error: { code: 'INVALID_REQUEST', message: 'Bad request.' },
    });

    expect(error.details).toBeUndefined();
  });

  it('exposes the typed details block from a stale error envelope', () => {
    const envelope = {
      requestId: 'req-stale-details-1',
      error: {
        code: 'DEFINITION_STALE',
        message: 'Definition is stale.',
        isRetriable: false,
        details: staleDetails,
      },
    } as unknown as ApiErrorEnvelope;

    const error = new ApiTransportError(envelope);

    expect(error.details).toEqual(staleDetails);
  });

  it('preserves envelope details through callApi instead of stripping them', async () => {
    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      expect((request as { method?: unknown }).method).toBe('getAssignmentDefinition');
      queueMicrotask(() => {
        callbacks.successHandler?.(makeStaleEnvelope());
      });
    });
    setGoogle({ script: { run: runner } });

    const expectedRejectionMessage = 'Expected callApi to reject for the stale envelope.';
    const result = await callApi('getAssignmentDefinition', {
      definitionKey: 'algebra-baseline',
    })
      .then(() => {
        throw new Error(expectedRejectionMessage);
      })
      .catch((error: unknown) => error);

    expect(result).toBeInstanceOf(ApiTransportError);
    if (!(result instanceof ApiTransportError)) {
      throw new Error(expectedRejectionMessage);
    }
    expect(result.details).toEqual(staleDetails);
  });
});
