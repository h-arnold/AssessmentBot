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

/**
 * Calls the backend API handler and returns parsed response data.
 */
export async function callApi<TResponse>(
    method: string,
    params?: unknown
): Promise<TResponse> {
    const requestPayload = ApiRequestSchema.parse({
        method,
        params,
    });

    const runner = getRunner();

    return await new Promise<TResponse>((resolve, reject) => {
        runner
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
