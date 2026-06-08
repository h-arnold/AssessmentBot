import { z } from 'zod';
import { ApiTransportError } from '../errors/apiTransportError';
import { logFrontendError, logFrontendEvent } from '../logging/frontendLogger';

const ApiRequestSchema = z.object({
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export const ApiSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    requestId: z.string(),
    data: z.unknown(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((response, context) => {
    if (!Object.prototype.hasOwnProperty.call(response, 'data')) {
      context.addIssue({
        // Use explicit string code to avoid deprecated enum reference
        code: 'custom',
        message: 'Success response envelope must include a data field.',
        path: ['data'],
      });
    }
  });

export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  requestId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retriable: z.boolean().optional(),
  }),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// TEMPORARY: ApiResponseSchema disabled for debug
// const ApiResponseSchema = z.discriminatedUnion('ok', [
//   ApiSuccessResponseSchema,
//   ApiErrorResponseSchema,
// ]);

type GoogleScriptRunApiHandler = {
  withSuccessHandler: (handler: (response: unknown) => void) => GoogleScriptRunApiHandler;
  withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRunApiHandler;
  apiHandler: (request: unknown) => void;
};

/**
 * Returns the typed `google.script.run` runner for API calls.
 *
 * @returns {GoogleScriptRunApiHandler} The API runner.
 */
function getRunner(): GoogleScriptRunApiHandler {
  const runnerCandidate = (globalThis as { google?: { script?: { run?: unknown } } }).google?.script
    ?.run;

  if (!runnerCandidate) {
    throw new Error('google.script.run is unavailable in this runtime.');
  }

  if (
    typeof runnerCandidate !== 'object' ||
    typeof (runnerCandidate as { apiHandler?: unknown }).apiHandler !== 'function'
  ) {
    throw new TypeError('google.script.run.apiHandler is unavailable in this runtime.');
  }

  return runnerCandidate as GoogleScriptRunApiHandler;
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const JITTER_MS = 500;
const UINT32_MAX = 4_294_967_295;
const EXPONENTIAL_BACKOFF_BASE = 2;
const JSON_PARSE_ERROR_PREVIEW_LENGTH = 120;

/**
 * Returns a cryptographically-safe random jitter value between 0 and JITTER_MS milliseconds.
 *
 * @returns {number} A jitter value in milliseconds.
 */
function randomJitterMs(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return (buf[0] / UINT32_MAX) * JITTER_MS;
}

/**
 * Dispatches a single API attempt and returns the parsed response data,
 * or throws ApiTransportError if the backend returns a failure envelope.
 *
 * @template TResponse
 * @param {unknown} requestPayload API request payload.
 * @returns {Promise<TResponse>} Parsed backend response data.
 */
async function dispatchAttempt<TResponse>(requestPayload: unknown): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    getRunner()
      .withSuccessHandler((response: unknown) => {
        try {
          // DEBUG: Log the raw response exactly as GAS delivers it,
          // stringifying objects so structure is visible in console.
          console.log('[DEBUG apiService] raw GAS response type:', typeof response);
          if (typeof response === 'string') {
            console.log(
              '[DEBUG apiService] raw GAS response (first 500 chars):',
              response.length > 500 ? response.slice(0, 500) + '…' : response
            );
          } else if (response === null) {
            console.log('[DEBUG apiService] raw GAS response: null');
          } else if (response === undefined) {
            console.log('[DEBUG apiService] raw GAS response: undefined');
          } else {
            // Object of some kind — try to stringify for inspection
            try {
              console.log(
                '[DEBUG apiService] raw GAS response (stringified):',
                JSON.stringify(response)
              );
            } catch {
              console.log('[DEBUG apiService] raw GAS response (non-stringifiable):', response);
            }
          }

          // GAS google.script.run auto-stringifies return values.
          // Parse the JSON string back to an object before Zod validation.
          // Wrap in a dedicated try-catch so non-JSON responses (e.g. HTML
          // error pages or login redirects) produce a descriptive error that
          // includes a preview of the raw payload for production debugging.
          let deserialisedResponse: unknown;
          if (typeof response === 'string') {
            try {
              deserialisedResponse = JSON.parse(response);
            } catch (parseError: unknown) {
              const preview =
                response.length > JSON_PARSE_ERROR_PREVIEW_LENGTH
                  ? response.slice(0, JSON_PARSE_ERROR_PREVIEW_LENGTH) + '…'
                  : response;
              throw new Error(`Failed to parse API response as JSON. Preview: ${preview}`, {
                cause: parseError,
              });
            }
          } else {
            deserialisedResponse = response;
          }

          // DEBUG: Log deserialised state with stringification for objects
          console.log(
            '[DEBUG apiService] typeof deserialisedResponse:',
            typeof deserialisedResponse
          );
          if (deserialisedResponse === null) {
            console.log('[DEBUG apiService] deserialisedResponse: null');
          } else if (deserialisedResponse === undefined) {
            console.log('[DEBUG apiService] deserialisedResponse: undefined');
          } else if (typeof deserialisedResponse === 'object') {
            try {
              console.log(
                '[DEBUG apiService] deserialisedResponse (stringified):',
                JSON.stringify(deserialisedResponse)
              );
            } catch {
              console.log(
                '[DEBUG apiService] deserialisedResponse (non-stringifiable):',
                deserialisedResponse
              );
            }
            const raw = deserialisedResponse as Record<string, unknown>;
            console.log('[DEBUG apiService] keys:', Object.keys(raw));
            console.log('[DEBUG apiService] ok:', raw.ok);
            console.log('[DEBUG apiService] typeof data:', typeof raw.data);
            if (raw.data === null) {
              console.log('[DEBUG apiService] data: null');
            } else if (raw.data === undefined) {
              console.log('[DEBUG apiService] data: undefined');
            } else if (typeof raw.data === 'object') {
              try {
                console.log('[DEBUG apiService] data (stringified):', JSON.stringify(raw.data));
              } catch {
                console.log('[DEBUG apiService] data (non-stringifiable):', raw.data);
              }
            } else {
              console.log('[DEBUG apiService] data:', raw.data);
            }
          } else {
            console.log('[DEBUG apiService] deserialisedResponse:', deserialisedResponse);
          }

          // TEMPORARY: resolve with raw data, skipping all Zod validation
          if (typeof deserialisedResponse === 'object' && deserialisedResponse !== null) {
            const raw = deserialisedResponse as Record<string, unknown>;
            resolve(raw.data as TResponse);
          } else {
            // null, undefined, string, etc. – resolve as-is to see what it is
            resolve(deserialisedResponse as TResponse);
          }
          return;

          // const parsedResponse = ApiResponseSchema.parse(deserialisedResponse);
          // if (parsedResponse.ok) {
          //   resolve(parsedResponse.data as TResponse);
          //   return;
          // }
          // reject(new ApiTransportError(parsedResponse));
        } catch (error: unknown) {
          reject(error);
        }
      })
      .withFailureHandler((error: unknown) => {
        reject(error);
      })
      .apiHandler(requestPayload);
  });
}

/**
 * Returns true when the given error should trigger a retry attempt.
 *
 * @param {unknown} error Error to inspect.
 * @param {number} attempt Zero-based attempt index.
 * @returns {boolean} Whether the call should retry.
 */
function shouldRetry(error: unknown, attempt: number): boolean {
  return (
    error instanceof ApiTransportError &&
    String(error.code) === 'RATE_LIMITED' &&
    error.retriable === true &&
    attempt < MAX_ATTEMPTS - 1
  );
}

/**
 * Calls the backend API handler and returns parsed response data.
 *
 * Automatically retries up to MAX_ATTEMPTS total attempts when the backend
 * responds with a RATE_LIMITED error that is marked as retriable.
 * Each retry waits for a bounded exponential backoff with jitter.
 *
 * @template TResponse
 * @param {string} method Backend method name.
 * @param {unknown} parameters Optional request parameters.
 * @returns {Promise<TResponse>} Parsed backend response data.
 */
export async function callApi<TResponse>(method: string, parameters?: unknown): Promise<TResponse> {
  const requestPayload = ApiRequestSchema.parse({ method, params: parameters });
  let lastError: ApiTransportError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * EXPONENTIAL_BACKOFF_BASE ** (attempt - 1) + randomJitterMs();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      return await dispatchAttempt<TResponse>(requestPayload);
    } catch (error: unknown) {
      if (shouldRetry(error, attempt)) {
        lastError = error as ApiTransportError;
        logFrontendEvent('warn', {
          context: 'services/apiService.callApi',
          errorMessage: lastError.message,
          requestId: lastError.requestId,
          errorCode: lastError.code,
          stack: lastError.stack,
          metadata: { attempt },
        });
        continue;
      }

      logFrontendError('services/apiService.callApi', error, { attempt });
      throw error;
    }
  }

  throw lastError!;
}
