import { z } from 'zod';

const ApiRequestSchema = z.object({
    method: z.string().min(1),
    params: z.unknown().optional(),
});

const ApiSuccessResponseSchema = z.object({
    ok: z.literal(true),
    requestId: z.string(),
    data: z.unknown(),
    meta: z.record(z.string(), z.unknown()).optional(),
}).superRefine((response, ctx) => {
    if (!Object.prototype.hasOwnProperty.call(response, 'data')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
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

type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
type GoogleScriptRunApiHandler = {
    withSuccessHandler: (
        handler: (response: unknown) => void
    ) => GoogleScriptRunApiHandler;
    withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRunApiHandler;
    apiHandler: (request: unknown) => void;
};

/**
 * Transport error carrying details from an API error envelope.
 */
class ApiTransportError extends Error {
    public readonly requestId: string;
    public readonly code: string;
    public readonly retriable: boolean | undefined;
    public readonly meta: Record<string, unknown> | undefined;

    /**
     * Builds a transport error from an API error envelope.
     */
    public constructor(response: ApiErrorResponse) {
        super(response.error.message);
        this.name = 'ApiTransportError';
        this.requestId = response.requestId;
        this.code = response.error.code;
        this.retriable = response.error.retriable;
        this.meta = response.meta;
    }
}

/**
 * Returns the typed `google.script.run` runner for API calls.
 */
function getRunner(): GoogleScriptRunApiHandler {
    const runnerCandidate = (globalThis as { google?: { script?: { run?: unknown } } }).google?.script
        ?.run;

    if (!runnerCandidate) {
        throw new Error('google.script.run is unavailable in this runtime.');
    }

    if (
        typeof runnerCandidate !== 'object' ||
        runnerCandidate === null ||
        typeof (runnerCandidate as { apiHandler?: unknown }).apiHandler !== 'function'
    ) {
        throw new Error('google.script.run.apiHandler is unavailable in this runtime.');
    }

    return runnerCandidate as GoogleScriptRunApiHandler;
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const JITTER_MS = 500;
const UINT32_MAX = 4_294_967_295;
const EXPONENTIAL_BACKOFF_BASE = 2;

/**
 * Returns a cryptographically-safe random jitter value between 0 and JITTER_MS milliseconds.
 */
function randomJitterMs(): number {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] / UINT32_MAX) * JITTER_MS;
}

/**
 * Dispatches a single API attempt and returns the parsed response data,
 * or throws ApiTransportError if the backend returns a failure envelope.
 */
async function dispatchAttempt<TResponse>(requestPayload: unknown): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
        getRunner()
            .withSuccessHandler((response: unknown) => {
                try {
                    const parsedResponse = ApiResponseSchema.parse(response);
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
 */
function shouldRetry(error: unknown, attempt: number): boolean {
    return (
        error instanceof ApiTransportError &&
        error.code === 'RATE_LIMITED' &&
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
 */
export async function callApi<TResponse>(
    method: string,
    params?: unknown
): Promise<TResponse> {
    const requestPayload = ApiRequestSchema.parse({ method, params });
    let lastError: ApiTransportError | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
            const delay =
                BASE_DELAY_MS * EXPONENTIAL_BACKOFF_BASE ** (attempt - 1) + randomJitterMs();
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        try {
            return await dispatchAttempt<TResponse>(requestPayload);
        } catch (error: unknown) {
            if (shouldRetry(error, attempt)) {
                lastError = error as ApiTransportError;
                continue;
            }
            throw error;
        }
    }

    throw lastError!;
}
