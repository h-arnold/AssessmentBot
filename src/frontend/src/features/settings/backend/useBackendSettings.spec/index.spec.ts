import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Antd from 'antd';
import { ApiTransportError } from '../../../../errors/apiTransportError';
import type {
    BackendConfigWriteResult,
} from '../../../../services/backendConfiguration.zod';
import {
    baseBackendConfig,
    baseNoKeyBackendConfig,
    baseNoKeyFormValues,
    baseReplacementFormValues,
    baseStoredKeyFormValues,
    baseWriteInputWithApiKey,
    baseWriteInputWithoutApiKey,
    blankApiKeyWriteInput,
    partialLoadBackendConfig,
    refreshedBackendConfig,
    refreshedFormValues,
    backendConfigReloadCallCount,
    secondCallIndex,
} from './fixtures';
import { createDeferred, renderBackendSettingsHook } from './helpers';

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

vi.mock('../../../../services/backendConfigurationService', () => ({
    getBackendConfig: getBackendConfigMock,
    setBackendConfig: setBackendConfigMock,
}));

vi.mock('../backendSettingsFormMapper', () => ({
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
