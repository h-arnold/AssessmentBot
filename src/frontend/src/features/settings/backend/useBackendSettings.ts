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
 * Maps backend-config query data into editable backend-settings form values.
 *
 * @param {Readonly<{ backendConfig: Parameters<typeof mapBackendConfigToBackendSettingsFormValues>[0] | undefined; blockingLoadError: string | null; partialLoadError: string | null; }>} dependencies Form value mapping dependencies.
 * @returns {BackendSettingsForm | null} Editable form values when the payload is trustworthy.
 */
function getBackendSettingsFormValues(
  dependencies: Readonly<{
    backendConfig: Parameters<typeof mapBackendConfigToBackendSettingsFormValues>[0] | undefined;
    blockingLoadError: string | null;
    partialLoadError: string | null;
  }>
): BackendSettingsForm | null {
  if (
    dependencies.backendConfig === undefined ||
    dependencies.partialLoadError !== null ||
    dependencies.blockingLoadError !== null
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
function getCurrentBackendSettingsLoadError(
  dependencies: Readonly<{
    backendConfigQuery: Readonly<{
      error: unknown;
      isError: boolean;
    }>;
    blockingLoadError: string | null;
    hasLoadedBackendConfig: boolean;
    partialLoadError: string | null;
  }>
): string | null {
  return (
    dependencies.blockingLoadError ??
    getBackendSettingsLoadError(
      dependencies.backendConfigQuery,
      dependencies.hasLoadedBackendConfig
    ) ??
    dependencies.partialLoadError
  );
}

type BackendSettingsSaveTransactionOutcome =
  | Readonly<{ status: 'success' }>
  | Readonly<{ saveError: string; status: 'save-error' }>
  | Readonly<{ loadError: string; status: 'refresh-failure' }>;

/**
 * Returns whether backend settings save work should be skipped for the current state.
 *
 * @param {Readonly<{ backendSettingsFormValues: BackendSettingsForm | null; isSaveBlocked: boolean; isSaving: boolean; }>} dependencies Save guard dependencies.
 * @returns {boolean} True when saving should be suppressed.
 */
function isBackendSettingsSaveSuppressed(
  dependencies: Readonly<{
    backendSettingsFormValues: BackendSettingsForm | null;
    isSaveBlocked: boolean;
    isSaving: boolean;
  }>
): boolean {
  return (
    dependencies.isSaving ||
    dependencies.isSaveBlocked ||
    dependencies.backendSettingsFormValues === null
  );
}

/**
 * Writes backend settings and performs the required active refresh.
 *
 * @param {Readonly<{ backendConfigQueryOptions: BackendSettingsQueryOptions; formValues: BackendSettingsForm; queryClient: ReturnType<typeof useQueryClient>; }>} dependencies Save transaction dependencies.
 * @returns {Promise<BackendSettingsSaveTransactionOutcome>} Composite write and refresh outcome.
 */
async function runBackendSettingsSaveTransaction(
  dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    formValues: BackendSettingsForm;
    queryClient: ReturnType<typeof useQueryClient>;
  }>
): Promise<BackendSettingsSaveTransactionOutcome> {
  const writeInput = mapBackendSettingsFormValuesToBackendConfigWriteInput(dependencies.formValues);
  const saveResult = await setBackendConfig(writeInput);

  if (!saveResult.success) {
    return {
      saveError: saveResult.error,
      status: 'save-error',
    };
  }

  try {
    await dependencies.queryClient.refetchQueries(
      {
        queryKey: dependencies.backendConfigQueryOptions.queryKey,
        exact: true,
        type: 'active',
      },
      {
        throwOnError: true,
      }
    );
  } catch (error: unknown) {
    return {
      loadError: mapBackendSettingsErrorToUserMessage(error, 'load'),
      status: 'refresh-failure',
    };
  }

  return { status: 'success' };
}

/**
 * Applies a backend settings save transaction outcome to UI state.
 *
 * @param {Readonly<{ backendConfigQueryOptions: BackendSettingsQueryOptions; message: ReturnType<typeof App.useApp>['message']; outcome: BackendSettingsSaveTransactionOutcome; queryClient: ReturnType<typeof useQueryClient>; setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>; setSaveError: Dispatch<SetStateAction<string | null>>; }>} dependencies Outcome-application dependencies.
 * @returns {void} Nothing.
 */
function applyBackendSettingsSaveTransactionOutcome(
  dependencies: Readonly<{
    backendConfigQueryOptions: BackendSettingsQueryOptions;
    message: ReturnType<typeof App.useApp>['message'];
    outcome: BackendSettingsSaveTransactionOutcome;
    queryClient: ReturnType<typeof useQueryClient>;
    setBlockingLoadErrorState: Dispatch<SetStateAction<BlockingLoadErrorState | null>>;
    setSaveError: Dispatch<SetStateAction<string | null>>;
  }>
): void {
  if (dependencies.outcome.status === 'success') {
    dependencies.message.success('Backend settings saved.');
    return;
  }

  if (dependencies.outcome.status === 'save-error') {
    dependencies.setSaveError(dependencies.outcome.saveError);
    return;
  }

  dependencies.setBlockingLoadErrorState({
    dataUpdatedAt:
      dependencies.queryClient.getQueryState(dependencies.backendConfigQueryOptions.queryKey)
        ?.dataUpdatedAt ?? 0,
    message: dependencies.outcome.loadError,
  });
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

  if (
    isBackendSettingsSaveSuppressed({
      backendSettingsFormValues,
      isSaveBlocked,
      isSaving,
    })
  ) {
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

    applyBackendSettingsSaveTransactionOutcome({
      backendConfigQueryOptions,
      message,
      outcome,
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
  const [blockingLoadErrorState, setBlockingLoadErrorState] =
    useState<BlockingLoadErrorState | null>(null);

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
