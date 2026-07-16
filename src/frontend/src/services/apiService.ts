import { z } from 'zod';
import { ApiTransportError } from '../errors/apiTransportError';
import { logFrontendError, logFrontendEvent } from '../logging/frontendLogger';

const ApiRequestSchema = z.object({
  method: z.string().min(1),
  params: z.unknown().optional(),
});

const JobNameSchema = z.string().min(1);

const ApiSuccessResponseSchema = z
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

const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  requestId: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retriable: z.boolean().optional(),
  }),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const ApiResponseSchema = z.discriminatedUnion('ok', [
  ApiSuccessResponseSchema,
  ApiErrorResponseSchema,
]);

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
const ZOD_ERROR_PREVIEW_LENGTH = 200;

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
 * Deserialises the GAS raw response (string or object) into a usable value.
 * On JSON parse failure, attaches a `preview` string to the thrown error.
 *
 * @param {unknown} response Raw response from GAS successHandler.
 * @returns {unknown} Deserialised value ready for Zod validation.
 */
function deserialiseRawResponse(response: unknown): unknown {
  if (typeof response !== 'string') {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch (parseError: unknown) {
    const preview =
      response.length > JSON_PARSE_ERROR_PREVIEW_LENGTH
        ? response.slice(0, JSON_PARSE_ERROR_PREVIEW_LENGTH) + '…'
        : response;
    const jsonError = new Error(`Failed to parse API response as JSON. Preview: ${preview}`, {
      cause: parseError,
    });
    (jsonError as unknown as { preview: string }).preview = preview;
    throw jsonError;
  }
}

/**
 * Parses a deserialised response through the API response envelope schema.
 * On Zod validation failure, attaches a `preview` string (truncated raw value)
 * to the thrown error for enriched logging upstream.
 *
 * @param {unknown} deserialisedResponse Value to validate.
 * @returns {import('zod').infer<typeof ApiResponseSchema>} Validated envelope.
 */
function parseApiEnvelope(deserialisedResponse: unknown): z.infer<typeof ApiResponseSchema> {
  try {
    return ApiResponseSchema.parse(deserialisedResponse);
  } catch (schemaError: unknown) {
    if (schemaError instanceof z.ZodError && deserialisedResponse !== undefined) {
      const previewValue =
        typeof deserialisedResponse === 'string'
          ? deserialisedResponse
          : JSON.stringify(deserialisedResponse);
      (schemaError as unknown as { preview: string }).preview =
        previewValue.length > ZOD_ERROR_PREVIEW_LENGTH
          ? `${previewValue.slice(0, ZOD_ERROR_PREVIEW_LENGTH)}…`
          : previewValue;
    }
    throw schemaError;
  }
}

/**
 * Validates a received backend response against a caller-supplied schema and
 * returns the typed result.
 *
 * The transport layer (`callApi`) enriches only transport-level failures with
 * the backend `method`, structured `zodIssues`, and a `responsePreview`. Schema
 * validation of the inner payload runs after the envelope has been accepted, so
 * a rejection there would otherwise surface as a bare `ZodError` with no clue
 * which method or which field failed. This helper mirrors `callApi`'s
 * `buildFailureMetadata` contract: on a `ZodError` it logs the `method`,
 * structured `zodIssues`, and a truncated `responsePreview` before re-throwing
 * the original error so caller behaviour is unchanged.
 *
 * @template TResponse The expected parsed response type.
 * @param {z.ZodType<TResponse>} schema Schema to validate the response against.
 * @param {string} method Backend method name that produced the response.
 * @param {unknown} data Raw response returned from `callApi`.
 * @returns {TResponse} The validated response.
 */
export function parseApiResponse<TResponse>(
  schema: z.ZodType<TResponse>,
  method: string,
  data: unknown
): TResponse {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const previewSource = typeof data === 'string' ? data : JSON.stringify(data);
      const responsePreview =
        previewSource.length > ZOD_ERROR_PREVIEW_LENGTH
          ? `${previewSource.slice(0, ZOD_ERROR_PREVIEW_LENGTH)}…`
          : previewSource;

      logFrontendError('services/apiService.parseApiResponse', error, {
        method,
        zodIssues: error.issues,
        responsePreview,
      });
    }

    throw error;
  }
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
          const deserialisedResponse = deserialiseRawResponse(response);
          const parsedResponse = parseApiEnvelope(deserialisedResponse);
          if (parsedResponse.ok) {
            resolve(parsedResponse.data as TResponse);
            return;
          }
          reject(new ApiTransportError(parsedResponse));
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
 * Builds enriched failure metadata for a non-retryable `callApi` error.
 *
 * Derives structured diagnostics from the thrown error without branching inside
 * `callApi` (keeps the latter's complexity bounded): the backend `method`,
 * transport `requestId`/`errorCode` when present, structured Zod `zodIssues`
 * for schema failures, and a sanitised `responsePreview` for parse failures.
 *
 * @param {unknown} error Thrown error from the dispatch attempt.
 * @param {number} attempt Zero-based attempt index.
 * @param {string} method Backend method name that was dispatched.
 * @returns {Record<string, unknown>} Enriched failure metadata for logging.
 */
function buildFailureMetadata(
  error: unknown,
  attempt: number,
  method: string
): Record<string, unknown> {
  const failureMetadata: Record<string, unknown> = {
    attempt,
    method,
  };

  if (error instanceof ApiTransportError) {
    failureMetadata.requestId = error.requestId;
    failureMetadata.errorCode = error.code;
  }

  if (error instanceof z.ZodError) {
    failureMetadata.zodIssues = error.issues;
  }

  const preview = (error as Record<string, unknown>).preview;
  if (typeof preview === 'string') {
    failureMetadata.responsePreview = preview;
  }

  return failureMetadata;
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
      logFrontendEvent('debug', {
        context: 'services/apiService.callApi',
        errorMessage: `dispatch attempt ${attempt}`,
        metadata: { attempt, params: requestPayload.params, method: requestPayload.method },
      });

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

      logFrontendError(
        'services/apiService.callApi',
        error,
        buildFailureMetadata(error, attempt, requestPayload.method)
      );
      throw error;
    }
  }

  throw lastError!;
}

// ── Queue infrastructure ─────────────────────────────────────────────────

interface QueueEntry {
  method: string;
  parameters: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

interface QueueStateInternal {
  pending: QueueEntry[];
  active: boolean;
}

const queues = new Map<string, QueueStateInternal>();

export interface QueueState {
  pending: number;
  active: boolean;
}

/**
 * Enqueues an API call for sequential execution within a job-name queue.
 *
 * @template TResponse - The expected response data type.
 * @param {string} method - Backend method name (must be non-empty).
 * @param {unknown} parameters - Request parameters.
 * @param {string} jobName - Queue job name (must be non-empty).
 * @returns {Promise<TResponse>} A Promise that resolves when the queued request completes.
 *
 * @remarks
 * Input validation for `method` intentionally mirrors `callApi`'s `ApiRequestSchema`
 * (via {@link ApiRequestSchema.shape.method}) as defence-in-depth — early rejection at
 * the call site prevents malformed requests from entering the queue. The `parameters`
 * field is validated later by `callApi` during dispatch.
 */
export function callApiQueued<TResponse>(
  method: string,
  parameters: unknown,
  jobName: string
): Promise<TResponse> {
  ApiRequestSchema.shape.method.parse(method);
  JobNameSchema.parse(jobName);

  // Locate or create queue for this jobName
  let queue = queues.get(jobName);
  if (!queue) {
    queue = { pending: [], active: false };
    queues.set(jobName, queue);
  }
  const targetQueue = queue;

  const wasIdle = !targetQueue.active;

  // Enqueue — store method, parameters, resolve, and reject in the pending array
  return new Promise<TResponse>((resolve, reject) => {
    targetQueue.pending.push({
      method,
      parameters,
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    // Synchronously mark active before any await, preventing duplicate loops
    if (wasIdle) {
      targetQueue.active = true;
      void processQueue(targetQueue);
    }
  });
}

// ── Processing loop ────────────────────────────────────────────────────────────

/**
 * Processes queued requests for a given job name in FIFO order.
 *
 * Runs asynchronously (fire-and-forget from the enqueuer). Pops the first
 * pending item, dispatches it via `callApi`, and resolves or rejects the
 * stored promise. Repeats until the queue is empty, then marks the queue
 * as inactive.
 *
 * @param {QueueStateInternal} queue - The queue to process.
 * @returns {Promise<void>} A promise that resolves when the queue is drained.
 */
async function processQueue(queue: QueueStateInternal): Promise<void> {
  while (queue.pending.length > 0) {
    const entry = queue.pending.shift()!; // REMOVE immediately
    try {
      const data = await callApi<unknown>(entry.method, entry.parameters);
      entry.resolve(data);
    } catch (error: unknown) {
      entry.reject(error);
    }
  }
  queue.active = false;
}

/**
 * Returns a snapshot of the current queue state for a given job name.
 *
 * @param {string} jobName - Queue job name (must be non-empty).
 * @returns {QueueState} The current queue state.
 *
 * @remarks
 * This returns a point-in-time snapshot. Callers polling for progress should not
 * assume monotonicity between calls — the queue may advance between a read and
 * the caller's next statement.
 */
export function getQueueState(jobName: string): QueueState {
  JobNameSchema.parse(jobName);
  const queue = queues.get(jobName);
  if (!queue) {
    return { pending: 0, active: false };
  }
  return { pending: queue.pending.length, active: queue.active };
}

/**
 * Cancels all pending queued entries for a given job name.
 *
 * Removes every pending {@link QueueEntry} from the internal queue and rejects
 * each removed entry's Promise with `{ reason: 'CANCELLED' }`. The currently
 * active in-flight request, if any, is **not** affected — `google.script.run`
 * does not support transport-level abort.
 *
 * @param {string} jobName - Queue job name (must be non-empty). Validated by
 *   {@link JobNameSchema}.
 * @returns {number} The number of pending items removed (excludes the active
 *   in-flight request).
 *
 * @remarks
 * - For an unknown or idle job name, the function is a no-op and returns `0`.
 * - After cancellation the queue structure remains in the map so subsequent
 *   `getQueueState` calls return `{ pending: 0, active: <previous> }`.
 * - Repeat calls on the same job name after the first cancellation return `0`
 *   because there are no pending items left to cancel.
 *
 * @example
 * ```ts
 * const cancelled = cancelApiQueued('classesBulkMutation');
 * console.log(cancelled); // e.g. 5
 * ```
 */
export function cancelApiQueued(jobName: string): number {
  // 1. Validate jobName (throws synchronously on empty/invalid)
  JobNameSchema.parse(jobName);

  // 2. Look up the queue
  const queue = queues.get(jobName);

  // 3. Unknown/idle job → no-op
  if (!queue) {
    return 0;
  }

  // 4. Snapshot pending entries (processQueue may also be mutating via shift(),
  //    but we own the pending array and can drain it atomically)
  const pendingEntries = queue.pending.splice(0);

  // 5. Reject each pending entry
  for (const entry of pendingEntries) {
    entry.reject({ reason: 'CANCELLED' });
  }

  // 6. Return count of removed items
  return pendingEntries.length;
}
