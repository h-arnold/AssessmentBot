/**
 * Hook tests for the `useBackendSettings` save lifecycle: concurrent-save
 * suppression, mapped write payloads with cache isolation, fail-closed refresh
 * after a confirmed save, success feedback and revision rebasing, and the API key
 * replacement/retention branches.
 */

import '@/test/settings/backendSettings.mockSetup';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackendConfigWriteResult } from '@/services/backendConfiguration/backendConfiguration.zod';
import {
  getBackendConfigMock,
  mapBackendConfigToBackendSettingsFormValuesMock,
  mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
  messageSuccessMock,
  setBackendConfigMock,
} from '@/test/settings/backendSettings.mockHandles';
import {
  backendConfigReloadCallCount,
  baseBackendConfig,
  baseNoKeyBackendConfig,
  baseNoKeyFormValues,
  baseReplacementFormValues,
  baseStoredKeyFormValues,
  baseWriteInputWithApiKey,
  baseWriteInputWithoutApiKey,
  blankApiKeyWriteInput,
  createDeferred,
  refreshedBackendConfig,
  refreshedFormValues,
  renderBackendSettingsHook,
  secondCallIndex,
} from '@/test/settings/backendSettingsTestHelpers';

describe('useBackendSettings save lifecycle', () => {
  afterEach(() => {
    getBackendConfigMock.mockReset();
    setBackendConfigMock.mockReset();
    mapBackendConfigToBackendSettingsFormValuesMock.mockReset();
    mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReset();
    messageSuccessMock.mockReset();
    vi.resetModules();
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
    expect(mapBackendSettingsFormValuesToBackendConfigWriteInputMock).toHaveBeenCalledTimes(1);

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
