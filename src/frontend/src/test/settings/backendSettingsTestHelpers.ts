/**
 * Shared fixtures and render helpers for the `useBackendSettings` hook specs.
 *
 * The suites mount the real hook with mocked configuration services and a
 * per-test query client. Keep the config/form/write fixtures, the deferred
 * promise helper and the probe harness here so each suite configures only its
 * own scenarios and assertions.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import {
  createElement as createReactElement,
  createRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { expect } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import type {
  BackendConfig,
  BackendConfigWriteInput,
} from '@/services/backendConfiguration/backendConfiguration.zod';
import type { BackendSettingsForm } from '@/features/settings/backend/backendSettingsForm.zod';

/** Config with a stored API key used by the load, save and failure-mapping suites. */
export const baseBackendConfig = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfig;

/** Editable form values mapped from `baseBackendConfig` with a blank key field. */
export const baseStoredKeyFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: 'https://backend.example.com',
  backendAssessorBatchSize: 30,
  slidesFetchBatchSize: 20,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendSettingsForm;

/** Editable form values that replace the stored API key with a new one. */
export const baseReplacementFormValues = {
  ...baseStoredKeyFormValues,
  hasApiKey: true,
  apiKey: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
} satisfies BackendSettingsForm;

/** Config without a stored API key, for the replacement-key branch. */
export const baseNoKeyBackendConfig = {
  ...baseBackendConfig,
  apiKey: '',
  hasApiKey: false,
} satisfies BackendConfig;

/** Editable form values for a config without a stored API key. */
export const baseNoKeyFormValues = {
  ...baseStoredKeyFormValues,
  hasApiKey: false,
  apiKey: '',
} satisfies BackendSettingsForm;

/** Write payload that keeps a stored API key by omitting it. */
export const baseWriteInputWithoutApiKey = {
  backendAssessorBatchSize: 30,
  backendUrl: 'https://backend.example.com',
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfigWriteInput;

/** Write payload that sends a replacement API key. */
export const baseWriteInputWithApiKey = {
  ...baseWriteInputWithoutApiKey,
  apiKey: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
} satisfies BackendConfigWriteInput;

/** Config with an incomplete payload that blocks editing and exposes a partial error. */
export const partialLoadBackendConfig = {
  ...baseBackendConfig,
  backendUrl: '',
  loadError: 'apiKey: REDACTED',
} satisfies BackendConfig;

/** Config returned by the refetch after a confirmed save. */
export const refreshedBackendConfig = {
  ...baseBackendConfig,
  backendAssessorBatchSize: 45,
  slidesFetchBatchSize: 25,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

/** Form values mapped from `refreshedBackendConfig`. */
export const refreshedFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: 'https://backend.example.com',
  backendAssessorBatchSize: 45,
  slidesFetchBatchSize: 25,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendSettingsForm;

/** Write payload used when the API key field is left blank. */
export const blankApiKeyWriteInput = baseWriteInputWithoutApiKey;

/** Call index of the second mapper invocation in the rebase assertion. */
export const secondCallIndex = 2;

/** Number of config reads after a confirmed save triggers a refresh. */
export const backendConfigReloadCallCount = 2;

/** Snapshot of the state returned by `useBackendSettings`. */
export type BackendSettingsHookValue = {
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

/** Imperative handle used by the probe to read the latest hook state. */
type BackendSettingsProbeHandle = {
  getCurrentState: () => BackendSettingsHookValue;
};

/**
 * Creates a deferred promise used to keep save mutations pending during assertions.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void }} Deferred promise controls.
 */
export function createDeferred<T>() {
  const { promise, resolve, reject } = Promise.withResolvers<T>();

  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Imports the backend settings hook under test after the module mocks are registered.
 *
 * @returns {Promise<typeof import('@/features/settings/backend/useBackendSettings/useBackendSettings')>} The hook module.
 */
async function loadUseBackendSettingsModule() {
  return import('@/features/settings/backend/useBackendSettings/useBackendSettings');
}

/**
 * Renders the backend settings hook with a per-test query client.
 *
 * @returns {Promise<Readonly<{ getCurrentState: () => BackendSettingsHookValue; queryClient: ReturnType<typeof createAppQueryClient>; }>>} The rendered hook state accessor and query client.
 */
export async function renderBackendSettingsHook() {
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

      useImperativeHandle(reference, () => {
        return {
          getCurrentState: () => currentState,
        };
      }, [currentState]);

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
