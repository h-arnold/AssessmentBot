/**
 * Hook tests for `useBackendSettings` load resolution: the initial read, a
 * blocking hard-load failure, an incomplete payload that exposes degraded-load
 * state, and retention of trustworthy settings when a later refetch fails.
 */

import '@/test/settings/backendSettings.mockSetup';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '@/errors/apiTransportError';
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
  baseStoredKeyFormValues,
  partialLoadBackendConfig,
  renderBackendSettingsHook,
} from '@/test/settings/backendSettingsTestHelpers';

describe('useBackendSettings load resolution', () => {
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
    expect(mapBackendConfigToBackendSettingsFormValuesMock).toHaveBeenCalledWith(baseBackendConfig);
  });

  it('surfaces a blocking hard-load failure and refuses save attempts', async () => {
    getBackendConfigMock.mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'req-hard-load-failure',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Backend exploded.',
          isRetriable: false,
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
});
