import { App } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiTransportError } from '../../../errors/apiTransportError';
import {
    getBlockingLoadErrorMessage,
    type BlockingLoadErrorState,
} from '../../../errors/blockingLoadError';
import { getBackendConfigQueryOptions } from '../../../query/sharedQueries';
import { setBackendConfig } from '../../../services/backendConfigurationService';
import {
    mapBackendConfigToBackendSettingsFormValues,
    mapBackendSettingsFormValuesToBackendConfigWriteInput,
} from './backendSettingsFormMapper';
import type { BackendSettingsForm } from './backendSettingsForm.zod';

const genericLoadErrorMessage = 'Unable to load backend settings right now.';
const genericSaveErrorMessage = 'Unable to save backend settings right now.';
const rateLimitedErrorMessage = 'The service is busy. Please try again shortly.';
const invalidRequestErrorMessage =
    'Unable to save backend settings. Please check the values and try again.';

type BackendSettingsHookValue = Readonly<{
    backendSettingsFormValues: BackendSettingsForm | null;
    hasApiKey: boolean;
    isInitialLoading: boolean;
    isSaveBlocked: boolean;
    isSaving: boolean;
    isRefreshing: boolean;
    loadError: string | null;
    saveBackendSettings: (formValues: BackendSettingsForm) => Promise<void>;
    saveError: string | null;
}>;

type BackendSettingsQueryOptions = ReturnType<typeof getBackendConfigQueryOptions>;

type BackendSettingsSaveDependencies = Readonly<{
    backendSettingsFormValues: BackendSettingsForm | null;
    isSaveBlocked: boolean;
    isSaving: boolean;
    message: ReturnType<typeof App.useApp>['message'];
    queryClient: ReturnType<typeof useQueryClient>;
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>;
    setIsSaving: Dispatch<SetStateAction<boolean>>;
    setSaveError: Dispatch<SetStateAction<string | null>>;
}>;

/**
 * Maps backend-settings read or write failures into user-safe copy.
 *
 * @param {unknown} error The failure to map.
 * @param {'load' | 'save'} operation The current backend settings operation.
 * @returns {string} User-safe error copy.
 */
function mapBackendSettingsErrorToUserMessage(error: unknown, operation: 'load' | 'save'): string {
    if (error instanceof ApiTransportError) {
        if (error.code === 'RATE_LIMITED') {
            return rateLimitedErrorMessage;
        }

        if (error.code === 'INVALID_REQUEST' && operation === 'save') {
            return invalidRequestErrorMessage;
        }
    }

    return operation === 'load' ? genericLoadErrorMessage : genericSaveErrorMessage;
}

/**
 * Maps a backend config query result into the user-safe load error state.
 *
 * @param {Readonly<{ error: unknown; isError: boolean; }>} backendConfigQuery Result of the backend config query.
 * @param {boolean} hasLoadedBackendConfig Whether a backend config payload has been loaded successfully.
 * @returns {string | null} The blocking load error copy.
 */
function getBackendSettingsLoadError(
    backendConfigQuery: Readonly<{
        error: unknown;
        isError: boolean;
    }>,
    hasLoadedBackendConfig: boolean
): string | null {
    if (hasLoadedBackendConfig || !backendConfigQuery.isError) {
        return null;
    }

    return mapBackendSettingsErrorToUserMessage(backendConfigQuery.error, 'load');
}

/**
 * Refetches the active backend-config query and returns a blocking load error message when the
 * refreshed dataset could not be trusted.
 *
 * @param {Readonly<{ backendConfigQueryOptions: BackendSettingsQueryOptions; queryClient: ReturnType<typeof useQueryClient>; }>} dependencies Refetch dependencies.
 * @returns {Promise<string | null>} Null when the required refresh succeeded, otherwise blocking load error copy.
 */
async function refetchRequiredBackendConfig(dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    queryClient: ReturnType<typeof useQueryClient>;
}>): Promise<string | null> {
    try {
        await dependencies.queryClient.refetchQueries({
            queryKey: dependencies.backendConfigQueryOptions.queryKey,
            exact: true,
            type: 'active',
        }, {
            throwOnError: true,
        });

        return null;
    } catch (error: unknown) {
        return mapBackendSettingsErrorToUserMessage(error, 'load');
    }
}

/**
 * Writes backend settings and performs the required active refresh.
 *
 * @param {Readonly<{ backendConfigQueryOptions: BackendSettingsQueryOptions; formValues: BackendSettingsForm; queryClient: ReturnType<typeof useQueryClient>; }>} dependencies Save transaction dependencies.
 * @returns {Promise<Readonly<{ status: 'success'; }> | Readonly<{ saveError: string; status: 'save-error'; }> | Readonly<{ loadError: string; status: 'refresh-failure'; }>>} Composite write and refresh outcome.
 */
async function runBackendSettingsSaveTransaction(dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    formValues: BackendSettingsForm;
    queryClient: ReturnType<typeof useQueryClient>;
}>): Promise<
    | Readonly<{ status: 'success'; }>
    | Readonly<{ saveError: string; status: 'save-error'; }>
    | Readonly<{ loadError: string; status: 'refresh-failure'; }>
> {
    const writeInput = mapBackendSettingsFormValuesToBackendConfigWriteInput(dependencies.formValues);
    const saveResult = await setBackendConfig(writeInput);

    if (!saveResult.success) {
        return {
            saveError: saveResult.error,
            status: 'save-error',
        };
    }

    const refreshFailureMessage = await refetchRequiredBackendConfig({
        backendConfigQueryOptions: dependencies.backendConfigQueryOptions,
        queryClient: dependencies.queryClient,
    });

    if (refreshFailureMessage !== null) {
        return {
            loadError: refreshFailureMessage,
            status: 'refresh-failure',
        };
    }

    return { status: 'success' };
}

type BackendSettingsSaveTransactionOutcome = Awaited<
    ReturnType<typeof runBackendSettingsSaveTransaction>
>;

/**
 * Maps backend-config query data into editable backend-settings form values.
 *
 * @param {Readonly<{ backendConfig: Parameters<typeof mapBackendConfigToBackendSettingsFormValues>[0] | undefined; blockingLoadError: string | null; partialLoadError: string | null; }>} dependencies Form value mapping dependencies.
 * @returns {BackendSettingsForm | null} Editable form values when the payload is trustworthy.
 */
function getBackendSettingsFormValues(dependencies: Readonly<{
    backendConfig: Parameters<typeof mapBackendConfigToBackendSettingsFormValues>[0] | undefined;
    blockingLoadError: string | null;
    partialLoadError: string | null;
}>): BackendSettingsForm | null {
    if (
        dependencies.backendConfig === undefined
        || dependencies.partialLoadError !== null
        || dependencies.blockingLoadError !== null
    ) {
        return null;
    }

    return mapBackendConfigToBackendSettingsFormValues(dependencies.backendConfig);
}

/**
 * Resolves the current backend settings load error with blocking precedence.
 *
 * @param {Readonly<{ backendConfigQuery: Readonly<{ error: unknown; isError: boolean; }>; blockingLoadError: string | null; hasLoadedBackendConfig: boolean; partialLoadError: string | null; }>} dependencies Load-error dependencies.
 * @returns {string | null} The current backend settings load error.
 */
function getCurrentBackendSettingsLoadError(dependencies: Readonly<{
    backendConfigQuery: Readonly<{
        error: unknown;
        isError: boolean;
    }>;
    blockingLoadError: string | null;
    hasLoadedBackendConfig: boolean;
    partialLoadError: string | null;
}>): string | null {
    return (
        dependencies.blockingLoadError
        ?? getBackendSettingsLoadError(dependencies.backendConfigQuery, dependencies.hasLoadedBackendConfig)
        ?? dependencies.partialLoadError
    );
}

/**
 * Persists backend settings, then refreshes the query-backed read model.
 *
 * @param {BackendSettingsForm} formValues The form values to save.
 * @param {BackendSettingsSaveDependencies} dependencies The save dependencies.
 * @returns {Promise<void>} A promise that settles when the save flow completes.
 */
async function persistBackendSettings(
    formValues: BackendSettingsForm,
    dependencies: BackendSettingsSaveDependencies
): Promise<void> {
    const {
        backendSettingsFormValues,
        isSaveBlocked,
        isSaving,
        message,
        queryClient,
        backendConfigQueryOptions,
        setBlockingLoadErrorState,
        setIsSaving,
        setSaveError,
    } = dependencies;

    if (isSaving || isSaveBlocked || backendSettingsFormValues === null) {
        return;
    }

    flushSync(() => {
        setIsSaving(true);
        setSaveError(null);
    });

    try {
        await Promise.resolve();
        const outcome = await runBackendSettingsSaveTransaction({
            backendConfigQueryOptions,
            formValues,
            queryClient,
        });

        const applyOutcomeByStatus = {
            success: (): void => {
                message.success('Backend settings saved.');
            },
            'save-error': (
                resolvedOutcome: Extract<
                    BackendSettingsSaveTransactionOutcome,
                    Readonly<{ status: 'save-error'; }>
                >
            ): void => {
                setSaveError(resolvedOutcome.saveError);
            },
            'refresh-failure': (
                resolvedOutcome: Extract<
                    BackendSettingsSaveTransactionOutcome,
                    Readonly<{ status: 'refresh-failure'; }>
                >
            ): void => {
                setBlockingLoadErrorState({
                    dataUpdatedAt: queryClient.getQueryState(backendConfigQueryOptions.queryKey)?.dataUpdatedAt ?? 0,
                    message: resolvedOutcome.loadError,
                });
            },
        } satisfies {
            [status in BackendSettingsSaveTransactionOutcome['status']]: (
                resolvedOutcome: Extract<BackendSettingsSaveTransactionOutcome, Readonly<{ status: status; }>>
            ) => void;
        };

        (applyOutcomeByStatus[outcome.status] as (resolvedOutcome: typeof outcome) => void)(outcome);
    } catch (error: unknown) {
        setSaveError(mapBackendSettingsErrorToUserMessage(error, 'save'));
    } finally {
        setIsSaving(false);
    }
}

/**
 * Orchestrates backend-settings reads, writes, and refreshes while keeping local form edits out of
 * React Query cache state.
 *
 * @remarks
 * This hook uses a hybrid model: React Query owns the backend configuration read and refresh
 * lifecycle, while the Ant Design form in the panel keeps local edit state. Fresh values are
 * published through this hook after load and after successful save so the panel can rebase its
 * `form.setFieldsValue(...)` state without moving user edits into shared cache. Incomplete config
 * payloads are treated as blocking degraded data, so the hook suppresses form values and surfaces
 * the backend warning through the blocking `loadError` contract instead.
 *
 * @returns {BackendSettingsHookValue} The current backend settings orchestration state.
 */
export function useBackendSettings(): BackendSettingsHookValue {
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const backendConfigQueryOptions = useMemo(() => getBackendConfigQueryOptions(), []);
    const backendConfigQuery = useQuery(backendConfigQueryOptions);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [blockingLoadErrorState, setBlockingLoadErrorState] = useState<BlockingLoadErrorState | null>(null);

    const backendConfig = backendConfigQuery.data;
    const partialLoadError = backendConfig?.loadError ?? null;
    const blockingLoadError = getBlockingLoadErrorMessage(
        blockingLoadErrorState,
        backendConfigQuery.dataUpdatedAt
    );
    const isRefreshing = backendConfigQuery.isFetching && !backendConfigQuery.isPending;
    const backendSettingsFormValues = useMemo(
        (): BackendSettingsForm | null =>
            getBackendSettingsFormValues({
                backendConfig,
                blockingLoadError,
                partialLoadError,
            }),
        [backendConfig, blockingLoadError, partialLoadError]
    );
    const hasApiKey = backendConfig?.hasApiKey ?? false;
    const loadError = getCurrentBackendSettingsLoadError({
        backendConfigQuery,
        blockingLoadError,
        hasLoadedBackendConfig: backendConfig !== undefined,
        partialLoadError,
    });
    const isSaveBlocked = loadError !== null;

    /**
     * Saves the current backend settings, then refreshes the read query so the panel can rebase.
     *
     * @remarks
     * The panel owns the live Ant Design `FormInstance`, so the hook publishes fresh mapped values
     * after a successful save instead of trying to reset `initialValues` or forcing a keyed remount.
     * That keeps in-progress edits local to the form while still ensuring the post-save refresh is
     * reflected via the next `backendSettingsFormValues` update.
     *
     * Incomplete payload warnings are treated as blocking degraded data, so the hook suppresses
     * form values until a trustworthy payload is available again.
     *
     * @param {BackendSettingsForm} formValues The current backend settings form values.
     * @returns {Promise<void>} A promise that settles when the save flow completes.
     */
    const saveBackendSettings = useCallback(
        async (formValues: BackendSettingsForm): Promise<void> => {
            await persistBackendSettings(formValues, {
                backendSettingsFormValues,
                isSaveBlocked,
                isSaving,
                message,
                queryClient,
                backendConfigQueryOptions,
                setBlockingLoadErrorState,
                setIsSaving,
                setSaveError,
            });
        },
        [
            backendSettingsFormValues,
            isSaveBlocked,
            isSaving,
            message,
            queryClient,
            backendConfigQueryOptions,
            setBlockingLoadErrorState,
            setIsSaving,
            setSaveError,
        ]
    );

    return {
        backendSettingsFormValues,
        hasApiKey,
        isInitialLoading: backendConfigQuery.isPending,
        isSaveBlocked,
        isSaving,
        isRefreshing,
        loadError,
        saveBackendSettings,
        saveError,
    };
}
