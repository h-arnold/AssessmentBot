/**
 * Hook tests for `useBackendSettings` save-failure mapping: domain failures
 * become persistent inline error state, while transport and runtime failures
 * stay on the shared user-safe error path.
 */

import '@/test/settings/backendSettings.mockSetup';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '@/errors/apiTransportError';
import type { BackendConfigWriteResult } from '@/services/backendConfiguration/backendConfiguration.zod';
import {
  getBackendConfigMock,
  mapBackendConfigToBackendSettingsFormValuesMock,
  mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
  messageSuccessMock,
  setBackendConfigMock,
} from '@/test/settings/backendSettings.mockHandles';
import {
  baseBackendConfig,
  baseStoredKeyFormValues,
  baseWriteInputWithoutApiKey,
  renderBackendSettingsHook,
} from '@/test/settings/backendSettingsTestHelpers';

describe('useBackendSettings failure mapping', () => {
  afterEach(() => {
    getBackendConfigMock.mockReset();
    setBackendConfigMock.mockReset();
    mapBackendConfigToBackendSettingsFormValuesMock.mockReset();
    mapBackendSettingsFormValuesToBackendConfigWriteInputMock.mockReset();
    messageSuccessMock.mockReset();
    vi.resetModules();
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
          isRetriable: false,
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
});
