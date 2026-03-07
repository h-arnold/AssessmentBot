import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type GoogleScriptRunWithApiHandler = {
    withSuccessHandler: (handler: (response: unknown) => void) => GoogleScriptRunWithApiHandler;
    withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRunWithApiHandler;
    apiHandler: (request: unknown) => void;
};

type GoogleScript = {
    script?: {
        run?: GoogleScriptRunWithApiHandler;
    };
};

type CallApi = <TResponse>(method: string, params?: unknown) => Promise<TResponse>;

/**
 * Sets a mock `google` runtime object for tests.
 */
function setGoogle(value: GoogleScript): void {
    (globalThis as unknown as Record<string, unknown>).google = value;
}

/**
 * Removes the mock `google` runtime object after each test.
 */
function clearGoogle(): void {
    delete (globalThis as Record<string, unknown>).google;
}

const apiServiceModulePath: string = './apiService';

/**
 * Loads a fresh `callApi` export from the module under test.
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
 */
function createGoogleScriptRunHarness(response: RunnerHarnessResponse): {
    runner: GoogleScriptRunWithApiHandler;
    apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
    let successHandler: ((value: unknown) => void) | undefined;
    let failureHandler: ((error: unknown) => void) | undefined;

    const apiHandlerSpy = vi.fn();

    const runner: GoogleScriptRunWithApiHandler = {
        /**
         * Registers the success callback for the harness.
         */
        withSuccessHandler(handler: (responseValue: unknown) => void) {
            successHandler = handler;
            return runner;
        },
        /**
         * Registers the failure callback for the harness.
         */
        withFailureHandler(handler: (error: unknown) => void) {
            failureHandler = handler;
            return runner;
        },
        /**
         * Dispatches the request into the harness spy.
         */
        apiHandler(request: unknown) {
            apiHandlerSpy(request);

            queueMicrotask(() => {
                if (response.kind === 'success') {
                    successHandler?.(response.payload);
                    return;
                }

                failureHandler?.(response.payload);
            });
        },
    };
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
                run: {
                    withSuccessHandler() {
                        return this as GoogleScriptRunWithApiHandler;
                    },
                    withFailureHandler() {
                        return this as GoogleScriptRunWithApiHandler;
                    },
                    apiHandler: undefined as unknown as (request: unknown) => void,
                },
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
});

// ── Helpers for retry policy tests ───────────────────────────────────────────

/**
 * Creates a `google.script.run` harness that returns responses in sequence.
 * Each call to `apiHandler` consumes the next response; the last response is
 * repeated if the sequence is exhausted.
 */
function createSequentialHarness(responses: RunnerHarnessResponse[]): {
    runner: GoogleScriptRunWithApiHandler;
    apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
    let callCount = 0;
    let successHandler: ((value: unknown) => void) | undefined;
    let failureHandler: ((error: unknown) => void) | undefined;

    const apiHandlerSpy = vi.fn();

    const runner: GoogleScriptRunWithApiHandler = {
        withSuccessHandler(handler: (responseValue: unknown) => void) {
            successHandler = handler;
            return runner;
        },
        withFailureHandler(handler: (error: unknown) => void) {
            failureHandler = handler;
            return runner;
        },
        apiHandler(request: unknown) {
            apiHandlerSpy(request);

            const response = responses[Math.min(callCount, responses.length - 1)];
            callCount++;

            queueMicrotask(() => {
                if (response.kind === 'success') {
                    successHandler?.(response.payload);
                    return;
                }
                failureHandler?.(response.payload);
            });
        },
    };

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
