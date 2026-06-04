/**
 * callApi unit tests for apiService.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock, type GoogleScriptRunApiHandler } from '../../test/googleScriptRunHarness';
import {
    loadCallApi,
    setGoogle,
    clearGoogle,
} from './helpers';

type ApiSuccessEnvelope<TData> = {
    ok: true;
    requestId: string;
    data: TData;
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

type RunnerHarnessResponse =
    | { kind: 'success'; payload: unknown }
    | { kind: 'failure'; payload: unknown };

type GoogleScriptRunWithoutApiHandler = Omit<GoogleScriptRunApiHandler, 'apiHandler'> & {
    apiHandler: undefined;
};

/**
 * Creates a mock runner shape that exposes handler registration but omits `apiHandler`.
 *
 * @returns {GoogleScriptRunWithoutApiHandler} The runner-like shape for missing-apiHandler tests.
 */
function createRunnerWithoutApiHandler(): GoogleScriptRunWithoutApiHandler {
    return {
        ...createGoogleScriptRunApiHandlerMock(() => {
            return;
        }),
        apiHandler: undefined,
    };
}

/**
 * Creates a controllable `google.script.run` harness for unit tests.
 *
 * @param {RunnerHarnessResponse} response - The response shape to replay through the harness.
 * @returns {{ runner: GoogleScriptRunApiHandler; apiHandlerSpy: ReturnType<typeof vi.fn>; }} The runner harness and its spy.
 */
function createGoogleScriptRunHarness(response: RunnerHarnessResponse): {
    runner: GoogleScriptRunApiHandler;
    apiHandlerSpy: ReturnType<typeof vi.fn>;
} {
    const apiHandlerSpy = vi.fn();

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
                run: createRunnerWithoutApiHandler(),
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

        const { createGoogleScriptRunApiHandlerMock } = await import('../../test/googleScriptRunHarness');

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

        if (releaseAlphaResponse === undefined || releaseBetaResponse === undefined) {
            throw new Error('Expected both concurrent responses to be registered before release.');
        }

        releaseBetaResponse();
        releaseAlphaResponse();

        await expect(Promise.all([alphaPromise, betaPromise])).resolves.toEqual([
            { label: 'alpha' },
            { label: 'beta' },
        ]);
    });
});
