import { App } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiTransportError } from '../../../errors/apiTransportError';
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
    partialLoadError: string | null;
    saveBackendSettings: (formValues: BackendSettingsForm) => Promise<void>;
    saveError: string | null;
}>;

type BackendSettingsQueryOptions = ReturnType<typeof getBackendConfigQueryOptions>;

type BlockingLoadErrorState = Readonly<{
    dataUpdatedAt: number;
    message: string;
}>;

type PersistBackendSettingsOutcome =
    | Readonly<{
        status: 'success';
    }>
    | Readonly<{
        saveError: string;
        status: 'save-error';
    }>
    | Readonly<{
        loadError: string;
        status: 'refresh-failure';
    }>;

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
 * Returns the blocking load error while the currently cached backend settings remain
 * refresh-invalidated.
 *
 * @param {BlockingLoadErrorState | null} blockingLoadError Current blocking load-error state.
 * @param {number} dataUpdatedAt Timestamp of the currently cached backend config payload.
 * @returns {string | null} Blocking load error message while the cached payload remains invalidated.
 */
function getBlockingLoadErrorMessage(
    blockingLoadError: BlockingLoadErrorState | null,
    dataUpdatedAt: number
): string | null {
    if (blockingLoadError === null) {
        return null;
    }

    if (dataUpdatedAt > blockingLoadError.dataUpdatedAt) {
        return null;
    }

    return blockingLoadError.message;
}

type BackendSettingsRefreshQueryState = Readonly<{
    isFetching: boolean;
    isPending: boolean;
}>;

/**
 * Returns whether backend settings are refreshing after a usable payload is already visible.
 *
 * @param {BackendSettingsRefreshQueryState} queryState Backend-config query fetch state.
 * @returns {boolean} True when the panel should publish refresh busy state.
 */
function isBackendSettingsRefreshing(queryState: BackendSettingsRefreshQueryState): boolean {
    return queryState.isFetching && !queryState.isPending;
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
 * @returns {Promise<PersistBackendSettingsOutcome>} Composite write and refresh outcome.
 */
async function runBackendSettingsSaveTransaction(dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    formValues: BackendSettingsForm;
    queryClient: ReturnType<typeof useQueryClient>;
}>): Promise<PersistBackendSettingsOutcome> {
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

/**
 * Returns whether the current backend-settings save request should be ignored.
 *
 * @param {Readonly<{ backendSettingsFormValues: BackendSettingsForm | null; isSaveBlocked: boolean; isSaving: boolean; }>} dependencies Save guard dependencies.
 * @returns {boolean} True when saving should be ignored.
 */
function shouldSkipBackendSettingsSave(dependencies: Readonly<{
    backendSettingsFormValues: BackendSettingsForm | null;
    isSaveBlocked: boolean;
    isSaving: boolean;
}>): boolean {
    return (
        dependencies.isSaving
        || dependencies.isSaveBlocked
        || dependencies.backendSettingsFormValues === null
    );
}

/**
 * Applies the completed save transaction outcome to hook state.
 *
 * @param {PersistBackendSettingsOutcome} outcome Completed save transaction outcome.
 * @param {Readonly<{ backendConfigQueryOptions: BackendSettingsQueryOptions; message: ReturnType<typeof App.useApp>['message']; queryClient: ReturnType<typeof useQueryClient>; setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>; setSaveError: Dispatch<SetStateAction<string | null>>; }>} dependencies Outcome application dependencies.
 * @returns {void} Nothing.
 */
function applyPersistBackendSettingsOutcome(
    outcome: PersistBackendSettingsOutcome,
    dependencies: Readonly<{
        backendConfigQueryOptions: BackendSettingsQueryOptions;
        message: ReturnType<typeof App.useApp>['message'];
        queryClient: ReturnType<typeof useQueryClient>;
        setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>;
        setSaveError: Dispatch<SetStateAction<string | null>>;
    }>
): void {
    if (outcome.status === 'save-error') {
        dependencies.setSaveError(outcome.saveError);
        return;
    }

    if (outcome.status === 'refresh-failure') {
        dependencies.setBlockingLoadErrorState({
            dataUpdatedAt: dependencies.queryClient.getQueryState(dependencies.backendConfigQueryOptions.queryKey)?.dataUpdatedAt ?? 0,
            message: outcome.loadError,
        });
        return;
    }

    dependencies.message.success('Backend settings saved.');
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

    if (shouldSkipBackendSettingsSave({ backendSettingsFormValues, isSaveBlocked, isSaving })) {
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

        applyPersistBackendSettingsOutcome(outcome, {
            backendConfigQueryOptions,
            message,
            queryClient,
            setBlockingLoadErrorState,
            setSaveError,
        });
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
    const isRefreshing = isBackendSettingsRefreshing(backendConfigQuery);
    const backendSettingsFormValues = useMemo(
        (): BackendSettingsForm | null =>
            backendConfig === undefined || partialLoadError !== null || blockingLoadError !== null
                ? null
                : mapBackendConfigToBackendSettingsFormValues(backendConfig),
        [backendConfig, blockingLoadError, partialLoadError]
    );
    const hasApiKey = backendConfig?.hasApiKey ?? false;
    const loadError =
        blockingLoadError
        ?? getBackendSettingsLoadError(backendConfigQuery, backendConfig !== undefined)
        ?? partialLoadError;
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
        partialLoadError,
        saveBackendSettings,
        saveError,
    };
}
