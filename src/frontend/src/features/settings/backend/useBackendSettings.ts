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
    loadError: string | null;
    partialLoadError: string | null;
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

        if (error.code === 'INVALID_REQUEST') {
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
        setIsSaving,
        setSaveError,
    } = dependencies;

    if (isSaving || isSaveBlocked || backendSettingsFormValues === null) {
        return;
    }

    const writeInput = mapBackendSettingsFormValuesToBackendConfigWriteInput(formValues);

    flushSync(() => {
        setIsSaving(true);
        setSaveError(null);
    });

    try {
        await Promise.resolve();
        const saveResult = await setBackendConfig(writeInput);

        if (!saveResult.success) {
            setSaveError(saveResult.error);
            return;
        }

        await queryClient.refetchQueries({
            queryKey: backendConfigQueryOptions.queryKey,
            exact: true,
            type: 'active',
        });
        message.success('Backend settings saved.');
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
 * `form.setFieldsValue(...)` state without moving user edits into shared cache. Partial-load
 * warnings stay visible as `partialLoadError` so the form remains on screen, but save stays blocked
 * because the backend has already reported an incomplete configuration payload.
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

    const backendConfig = backendConfigQuery.data;
    const backendSettingsFormValues = useMemo(
        (): BackendSettingsForm | null =>
            backendConfig === undefined
                ? null
                : mapBackendConfigToBackendSettingsFormValues(backendConfig),
        [backendConfig]
    );
    const hasApiKey = backendSettingsFormValues?.hasApiKey ?? false;
    const partialLoadError = backendConfig?.loadError ?? null;
    const loadError = getBackendSettingsLoadError(backendConfigQuery, backendConfig !== undefined);
    const isSaveBlocked = loadError !== null || partialLoadError !== null;

    /**
     * Saves the current backend settings, then refreshes the read query so the panel can rebase.
     *
     * @remarks
     * The panel owns the live Ant Design `FormInstance`, so the hook publishes fresh mapped values
     * after a successful save instead of trying to reset `initialValues` or forcing a keyed remount.
     * That keeps in-progress edits local to the form while still ensuring the post-save refresh is
     * reflected via the next `backendSettingsFormValues` update.
     *
     * Partial-load warnings disable save while leaving the existing form values visible because the
     * backend has already told us the loaded payload is incomplete. This preserves user context
     * without introducing a bespoke recovery workflow in the hook.
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
        loadError,
        partialLoadError,
        saveBackendSettings,
        saveError,
    };
}
