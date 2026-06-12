import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import {
    createElement as createReactElement,
    createRef,
    forwardRef,
    useImperativeHandle,
} from 'react';
import type * as Antd from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { createAppQueryClient } from '../../../query/queryClient';
import type {
    BackendConfig,
    BackendConfigWriteInput,
    BackendConfigWriteResult,
} from '../../../services/backendConfiguration.zod';
import type { BackendSettingsForm } from './backendSettingsForm.zod';

const {
    getBackendConfigMock,
    setBackendConfigMock,
    mapBackendConfigToBackendSettingsFormValuesMock,
    mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
    messageSuccessMock,
} = vi.hoisted(() => ({
    getBackendConfigMock: vi.fn(),
    setBackendConfigMock: vi.fn(),
    mapBackendConfigToBackendSettingsFormValuesMock: vi.fn(),
    mapBackendSettingsFormValuesToBackendConfigWriteInputMock: vi.fn(),
    messageSuccessMock: vi.fn(),
}));

vi.mock('../../../services/backendConfigurationService', () => ({
    getBackendConfig: getBackendConfigMock,
    setBackendConfig: setBackendConfigMock,
}));

vi.mock('./backendSettingsFormMapper', () => ({
    mapBackendConfigToBackendSettingsFormValues: mapBackendConfigToBackendSettingsFormValuesMock,
    mapBackendSettingsFormValuesToBackendConfigWriteInput:
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
}));

vi.mock('antd', async () => {
    const actual = (await vi.importActual('antd')) as typeof Antd;

    return {
        ...actual,
        App: Object.assign(actual.App, {
            useApp: () => ({
                message: {
                    success: messageSuccessMock,
                },
                notification: {
                    open: vi.fn(),
                },
            }),
        }),
    };
});

const baseBackendConfig = {
    backendAssessorBatchSize: 30,
    apiKey: '****cdef',
    hasApiKey: true,
    backendUrl: 'https://backend.example.com',
    revokeAuthTriggerSet: false,
    daysUntilAuthRevoke: 60,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfig;

const baseStoredKeyFormValues = {
    hasApiKey: true,
    apiKey: '',
    backendUrl: 'https://backend.example.com',
    backendAssessorBatchSize: 30,
    slidesFetchBatchSize: 20,
    daysUntilAuthRevoke: 60,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
} satisfies BackendSettingsForm;

const baseReplacementFormValues = {
    ...baseStoredKeyFormValues,
    hasApiKey: true,
    apiKey: 'replacement-key-123',
} satisfies BackendSettingsForm;

const baseNoKeyBackendConfig = {
    ...baseBackendConfig,
    apiKey: '',
    hasApiKey: false,
} satisfies BackendConfig;

const baseNoKeyFormValues = {
    ...baseStoredKeyFormValues,
    hasApiKey: false,
    apiKey: '',
} satisfies BackendSettingsForm;

const baseWriteInputWithoutApiKey = {
    backendAssessorBatchSize: 30,
    backendUrl: 'https://backend.example.com',
    daysUntilAuthRevoke: 60,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfigWriteInput;

const baseWriteInputWithApiKey = {
    ...baseWriteInputWithoutApiKey,
    apiKey: 'replacement-key-123',
} satisfies BackendConfigWriteInput;

const partialLoadBackendConfig = {
    ...baseBackendConfig,
    backendUrl: '',
    loadError: 'apiKey: REDACTED',
} satisfies BackendConfig;

const refreshedBackendConfig = {
    ...baseBackendConfig,
    backendAssessorBatchSize: 45,
    slidesFetchBatchSize: 25,
    jsonDbMasterIndexKey: 'refreshed-master-index',
    jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

const refreshedFormValues = {
    hasApiKey: true,
    apiKey: '',
    backendUrl: 'https://backend.example.com',
    backendAssessorBatchSize: 45,
    slidesFetchBatchSize: 25,
    daysUntilAuthRevoke: 60,
    jsonDbMasterIndexKey: 'refreshed-master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-5678',
} satisfies BackendSettingsForm;

const blankApiKeyWriteInput = baseWriteInputWithoutApiKey;
const secondCallIndex = 2;
const backendConfigReloadCallCount = 2;

type BackendSettingsHookValue = {
    backendSettingsFormValues: BackendSettingsForm | null;
    hasApiKey: boolean;
    isInitialLoading: boolean;
    isSaveBlocked: boolean;
    isSaving: boolean;
    isRefreshing: boolean;
    loadError: string | null;
    saveBackendSettings: (formValues: BackendSettingsForm) => Promise<void>;
    saveError: string | null;
};

type BackendSettingsProbeHandle = {
    getCurrentState: () => BackendSettingsHookValue;
};

/**
 * Creates a deferred promise used to keep save mutations pending during assertions.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void }} Deferred promise controls.
 */
function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });

    return {
        promise,
        resolve,
        reject,
    };
}

/**
 * Imports the backend settings hook under test after the module mocks are registered.
 *
 * @returns {Promise<typeof import('./useBackendSettings')>} The hook module.
 */
async function loadUseBackendSettingsModule() {
    return import('./useBackendSettings');
}

/**
 * Renders the backend settings hook with a per-test query client.
 *
 * @returns {Promise<Readonly<{ getCurrentState: () => BackendSettingsHookValue; queryClient: ReturnType<typeof createAppQueryClient>; }>>} The rendered hook state accessor and query client.
 */
async function renderBackendSettingsHook() {
    const queryClient = createAppQueryClient();
    const { useBackendSettings } = await loadUseBackendSettingsModule();
    const probeReference = createRef<BackendSettingsProbeHandle>();

    /**
     * Captures the hook state on each render so the test can make assertions against it.
     *
     * @returns {null} Nothing.
     */
    const BackendSettingsProbe = forwardRef<BackendSettingsProbeHandle>(
        function BackendSettingsProbe(_properties, reference) {
            const currentState = useBackendSettings();

            useImperativeHandle(
                reference,
                () => ({
                    getCurrentState: () => currentState,
                }),
                [currentState]
            );

            return null;
        }
    );

    render(
        createReactElement(
            QueryClientProvider,
            { client: queryClient },
            createReactElement(BackendSettingsProbe, { ref: probeReference })
        )
    );

    await waitFor(() => {
        expect(probeReference.current).toBeDefined();
    });

    return {
        getCurrentState: () => {
            if (probeReference.current === null) {
                throw new Error('Backend settings hook state was not initialised.');
            }

            return probeReference.current.getCurrentState();
        },
        queryClient,
    };
}

describe('useBackendSettings', () => {
    afterEach(() => {
        getBackendConfigMock.mockReset();
        setBackendConfigMock.mockReset();
        mapBackendConfigToBackendSettingsFormValuesMock.mockReset();
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReset();
        messageSuccessMock.mockReset();
        vi.resetModules();
    });

    it('resolves the initial backend config into editable state after the first read', async () => {
        getBackendConfigMock.mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);

        const { getCurrentState } = await renderBackendSettingsHook();

        expect(getCurrentState().isInitialLoading).toBe(true);

        await waitFor(() => {
            expect(getCurrentState()).toMatchObject({
                isInitialLoading: false,
                loadError: null,
                isSaveBlocked: false,
                isSaving: false,
                isRefreshing: false,
                saveError: null,
                hasApiKey: true,
                backendSettingsFormValues: baseStoredKeyFormValues,
            });
        });

        expect(getBackendConfigMock).toHaveBeenCalledTimes(1);
        expect(mapBackendConfigToBackendSettingsFormValuesMock).toHaveBeenCalledWith(
            baseBackendConfig
        );
    });

    it('surfaces a blocking hard-load failure and refuses save attempts', async () => {
        getBackendConfigMock.mockRejectedValueOnce(
            new ApiTransportError({
                requestId: 'req-hard-load-failure',
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Backend exploded.',
                    retriable: false,
                },
            })
        );

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().loadError).toEqual(expect.any(String));
        });

        expect(getCurrentState()).toMatchObject({
            isInitialLoading: false,
            loadError: expect.not.stringContaining('Backend exploded.'),
            isSaveBlocked: true,
            backendSettingsFormValues: null,
        });

        getBackendConfigMock.mockRejectedValueOnce(new Error('Refresh failed.'));

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        expect(setBackendConfigMock).not.toHaveBeenCalled();
        expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).not.toHaveBeenCalled();
    });

    it('ignores additional save requests while the first save is still in flight', async () => {
        const pendingSaveResult = createDeferred<BackendConfigWriteResult>();

        getBackendConfigMock
            .mockResolvedValueOnce(baseBackendConfig)
            .mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock
            .mockReturnValueOnce(baseStoredKeyFormValues)
            .mockReturnValueOnce(baseStoredKeyFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
            baseWriteInputWithoutApiKey
        );
        setBackendConfigMock.mockReturnValueOnce(pendingSaveResult.promise);

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        let firstSavePromise!: Promise<void>;

        await act(async () => {
            firstSavePromise = getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(getCurrentState().isSaving).toBe(true);
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseReplacementFormValues);
        });

        expect(setBackendConfigMock).toHaveBeenCalledTimes(1);
        expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).toHaveBeenCalledTimes(
            1
        );

        await act(async () => {
            pendingSaveResult.resolve({ success: true });
            await firstSavePromise;
        });

        await waitFor(() => {
            expect(getBackendConfigMock).toHaveBeenCalledTimes(backendConfigReloadCallCount);
            expect(getCurrentState()).toMatchObject({
                isSaving: false,
                isRefreshing: false,
                saveError: null,
                backendSettingsFormValues: baseStoredKeyFormValues,
            });
        });
    });

    it('blocks save attempts when the backend config payload is incomplete and exposes degraded-load state', async () => {
        getBackendConfigMock.mockResolvedValueOnce(partialLoadBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState()).toMatchObject({
                isInitialLoading: false,
                loadError: partialLoadBackendConfig.loadError,
                isRefreshing: false,
                isSaveBlocked: true,
                hasApiKey: true,
                backendSettingsFormValues: null,
            });
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        expect(setBackendConfigMock).not.toHaveBeenCalled();
        expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).not.toHaveBeenCalled();
    });

    it('keeps trustworthy backend settings visible when a later refetch fails', async () => {
        getBackendConfigMock.mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);

        const { getCurrentState, queryClient } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        getBackendConfigMock.mockRejectedValueOnce(new Error('Background refresh failed.'));

        await act(async () => {
            await queryClient.refetchQueries();
        });

        await waitFor(() => {
            expect(getBackendConfigMock).toHaveBeenCalledTimes(backendConfigReloadCallCount);
            expect(getCurrentState()).toMatchObject({
                loadError: null,
                isRefreshing: false,
                isSaveBlocked: false,
                backendSettingsFormValues: baseStoredKeyFormValues,
            });
        });
    });

    it('sends mapped write payloads, clears stale save errors, and keeps query cache data separate from local edits', async () => {
        const failedSaveResult = {
            success: false,
            error: 'Configuration save failed.',
        } satisfies BackendConfigWriteResult;
        const initialSavePayload = baseWriteInputWithoutApiKey;
        const editedSavePayload = baseWriteInputWithApiKey;
        const saveResult = createDeferred<BackendConfigWriteResult>();

        getBackendConfigMock
            .mockResolvedValueOnce(baseBackendConfig)
            .mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock
            .mockReturnValueOnce(baseStoredKeyFormValues)
            .mockReturnValueOnce(baseStoredKeyFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock
            .mockReturnValueOnce(initialSavePayload)
            .mockReturnValueOnce(editedSavePayload);
        setBackendConfigMock.mockResolvedValueOnce(failedSaveResult);
        setBackendConfigMock.mockReturnValueOnce(saveResult.promise);

        const { getCurrentState, queryClient } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        getBackendConfigMock.mockRejectedValueOnce(new Error('Refresh failed.'));

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        await waitFor(() => {
            expect(getCurrentState().saveError).toBe(failedSaveResult.error);
        });

        let pendingSavePromise!: Promise<void>;

        await act(async () => {
            pendingSavePromise = getCurrentState().saveBackendSettings(baseReplacementFormValues);
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(getCurrentState().isSaving).toBe(true);
        });

        expect(getCurrentState().saveError).toBeNull();
        expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).toHaveBeenCalledWith(
            baseReplacementFormValues
        );
        expect(setBackendConfigMock).toHaveBeenCalledWith(editedSavePayload);

        const [firstQuery] = queryClient.getQueryCache().getAll();
        expect(firstQuery?.state.data).toEqual(baseBackendConfig);

        await act(async () => {
            saveResult.resolve({ success: true });
            await pendingSavePromise;
        });
    });

    it('fails closed when a successful save cannot refresh the now-invalid backend settings data', async () => {
        getBackendConfigMock
            .mockResolvedValueOnce(baseBackendConfig)
            .mockRejectedValueOnce(new Error('Invalid backend settings payload.'));
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
            blankApiKeyWriteInput
        );
        setBackendConfigMock.mockResolvedValueOnce({ success: true });

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        await waitFor(() => {
            expect(getCurrentState()).toMatchObject({
                loadError: 'Unable to load backend settings right now.',
                isRefreshing: false,
                isSaveBlocked: true,
                saveError: null,
                backendSettingsFormValues: null,
            });
        });
        expect(getBackendConfigMock).toHaveBeenCalledTimes(backendConfigReloadCallCount);
        expect(messageSuccessMock).not.toHaveBeenCalled();
    });

    it('announces a successful save, refetches backend config, and rebases fresh values', async () => {
        getBackendConfigMock
            .mockResolvedValueOnce(baseBackendConfig)
            .mockResolvedValueOnce(refreshedBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock
            .mockReturnValueOnce(baseStoredKeyFormValues)
            .mockReturnValueOnce(refreshedFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
            blankApiKeyWriteInput
        );
        setBackendConfigMock.mockResolvedValueOnce({ success: true });

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        await waitFor(() => {
            expect(messageSuccessMock).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(getBackendConfigMock).toHaveBeenCalledTimes(backendConfigReloadCallCount);
            expect(getCurrentState()).toMatchObject({
                isSaving: false,
                isRefreshing: false,
                loadError: null,
                isSaveBlocked: false,
                saveError: null,
                hasApiKey: true,
                backendSettingsFormValues: refreshedFormValues,
            });
        });

        expect(mapBackendConfigToBackendSettingsFormValuesMock).toHaveBeenNthCalledWith(
            1,
            baseBackendConfig
        );
        expect(mapBackendConfigToBackendSettingsFormValuesMock).toHaveBeenNthCalledWith(
            secondCallIndex,
            refreshedBackendConfig
        );
    });

    it('maps backend save failures into persistent inline error state', async () => {
        const domainFailure = {
            success: false,
            error: 'Configuration save failed.',
        } satisfies BackendConfigWriteResult;

        getBackendConfigMock.mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
            baseWriteInputWithoutApiKey
        );
        setBackendConfigMock.mockResolvedValueOnce(domainFailure);

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        await waitFor(() => {
            expect(getCurrentState().saveError).toBe(domainFailure.error);
        });

        expect(getCurrentState()).toMatchObject({
            isSaving: false,
            isRefreshing: false,
            saveError: domainFailure.error,
            backendSettingsFormValues: baseStoredKeyFormValues,
        });
    });

    it('keeps transport and runtime save failures on the shared user-safe path', async () => {
        getBackendConfigMock.mockResolvedValueOnce(baseBackendConfig);
        mapBackendConfigToBackendSettingsFormValuesMock.mockReturnValueOnce(baseStoredKeyFormValues);
        mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
            baseWriteInputWithoutApiKey
        );
        setBackendConfigMock.mockRejectedValueOnce(
            new ApiTransportError({
                requestId: 'req-save-failure',
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Transport exploded.',
                    retriable: false,
                },
            })
        );

        const { getCurrentState } = await renderBackendSettingsHook();

        await waitFor(() => {
            expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        });

        await act(async () => {
            await getCurrentState().saveBackendSettings(baseStoredKeyFormValues);
        });

        await waitFor(() => {
            expect(getCurrentState().saveError).toEqual(expect.any(String));
        });

        expect(getCurrentState().saveError).not.toContain('Transport exploded.');
        expect(getCurrentState().backendSettingsFormValues).toEqual(baseStoredKeyFormValues);
        expect(getCurrentState().isSaving).toBe(false);
    });

    it.each([
        {
            caseName: 'retains a stored API key when the field is left blank',
            initialBackendConfig: baseBackendConfig,
            initialFormValues: baseStoredKeyFormValues,
            submittedFormValues: baseStoredKeyFormValues,
            expectedWriteInput: baseWriteInputWithoutApiKey,
            expectedHasApiKey: true,
        },
        {
            caseName: 'sends a replacement API key when no stored key exists',
            initialBackendConfig: baseNoKeyBackendConfig,
            initialFormValues: baseNoKeyFormValues,
            submittedFormValues: baseReplacementFormValues,
            expectedWriteInput: baseWriteInputWithApiKey,
            expectedHasApiKey: false,
        },
    ])(
        'handles API key branches and save payloads when the user $caseName',
        async ({
            initialBackendConfig,
            initialFormValues,
            submittedFormValues,
            expectedWriteInput,
            expectedHasApiKey,
        }) => {
            getBackendConfigMock
                .mockResolvedValueOnce(initialBackendConfig)
                .mockResolvedValueOnce(initialBackendConfig);
            mapBackendConfigToBackendSettingsFormValuesMock
                .mockReturnValueOnce(initialFormValues)
                .mockReturnValueOnce(initialFormValues);
            mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReturnValueOnce(
                expectedWriteInput
            );
            setBackendConfigMock.mockResolvedValueOnce({ success: true });

            const { getCurrentState } = await renderBackendSettingsHook();

            await waitFor(() => {
                expect(getCurrentState().hasApiKey).toBe(expectedHasApiKey);
            });

            expect(getCurrentState().backendSettingsFormValues).toEqual(initialFormValues);

            await act(async () => {
                await getCurrentState().saveBackendSettings(submittedFormValues);
            });

            expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).toHaveBeenCalledWith(
                submittedFormValues
            );
            expect(setBackendConfigMock).toHaveBeenCalledWith(expectedWriteInput);
        }
    );
});
