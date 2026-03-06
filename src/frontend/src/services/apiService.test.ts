import { afterEach, describe, expect, it, vi } from 'vitest';

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

/**
 * Creates a controllable `google.script.run` harness for unit tests.
 */
function createGoogleScriptRunHarness(response: RunnerHarnessResponse): {
    runner: GoogleScriptRunWithApiHandler;
    apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
    let successHandler: ((value: unknown) => void) | undefined;
    let failureHandler: ((error: unknown) => void) | undefined;

    const apiHandlerSpy = vi.fn((request: unknown) => {
        Object.is(request, request);

        queueMicrotask(() => {
            if (response.kind === 'success') {
                successHandler?.(response.payload);
                return;
            }

            failureHandler?.(response.payload);
        });
    });

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
