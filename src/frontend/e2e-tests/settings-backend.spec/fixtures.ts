import { expect, type Page } from '@playwright/test';
import type {
  BackendConfig,
  BackendConfigWriteResult,
} from '../../src/services/backendConfiguration.zod';
import { googleScriptRunApiHandlerFactorySource } from '../../src/test/googleScriptRunHarness';

export type BackendApiResponseScenario = Readonly<
  | {
      kind: 'success';
      data: unknown;
      delayMs?: number;
      releaseSignal?: string;
    }
  | {
      kind: 'transportFailure';
      message: string;
      delayMs?: number;
      releaseSignal?: string;
    }
  | {
      kind: 'failureEnvelope';
      code?: string;
      message: string;
      delayMs?: number;
      releaseSignal?: string;
    }
>;

export type BackendSettingsRuntimeScenario = Readonly<{
  getBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
  setBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
}>;

export const settingsMenuLabel = 'Settings';
export const settingsPageHeading = 'Settings';
export const backendSettingsTabLabel = 'Backend settings';
export const backendSettingsPanelLabel = 'Backend settings panel';
export const loadingBackendSettingsLabel = 'Loading backend settings';
export const saveButtonLabel = 'Save';
export const apiKeyLabel = 'API key';
export const backendUrlLabel = 'Backend URL';
export const backendAssessorBatchSizeLabel = 'Backend assessor batch size';
export const storedApiKeyHelperCopy =
  'Stored API key already exists. Leave this field blank to keep it.';
export const emptyApiKeyHelperCopy = 'Enter a new API key.';
export const partialLoadWarning = 'apiKey: REDACTED';
export const backendSettingsLoadFailureCopy = 'Unable to load backend settings right now.';
export const backendSettingsSaveFailureCopy = 'Configuration save failed.';
export const backendSettingsSavedCopy = 'Backend settings saved.';
export const backendSettingsLoadReleaseSignal = 'backend-settings-initial-load';
export const backendSettingsSaveDelayMs = 150;
export const backendSettingsRefreshReleaseSignal = 'backend-settings-post-save-refresh';
export const apiKeyValidationMessage =
  'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.';

export const baseBackendConfig = {
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

export const refreshedBackendConfig = {
  ...baseBackendConfig,
  backendAssessorBatchSize: 48,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

export const partialLoadBackendConfig = {
  ...baseBackendConfig,
  backendUrl: '',
  loadError: partialLoadWarning,
} satisfies BackendConfig;

export const noStoredKeyBackendConfig = {
  ...baseBackendConfig,
  apiKey: '',
  hasApiKey: false,
} satisfies BackendConfig;

export const refreshedWriteResult = {
  success: true,
} satisfies BackendConfigWriteResult;

/**
 * Installs a browser-side `google.script.run` mock for the backend settings feature.
 *
 * @param {Page} page The Playwright page under test.
 * @param {BackendSettingsRuntimeScenario} scenario The read and write scenarios to simulate.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
export async function mockBackendSettingsRuntime(
  page: Page,
  scenario: BackendSettingsRuntimeScenario
) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const mockScenario = ${JSON.stringify(scenario)};
      const callCounts = {
        getBackendConfig: 0,
        setBackendConfig: 0,
      };
      const responseQueues = {
        getBackendConfig: mockScenario.getBackendConfig,
        setBackendConfig: mockScenario.setBackendConfig,
      };
      const releasedSignals = new Set();
      const releaseResolvers = new Map();

      function isBackendSettingsTransportRequest(request) {
        return (
          typeof request === 'object' &&
          request !== null &&
          typeof request.method === 'string'
        );
      }

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          handler({
            ok: true,
            requestId,
            data,
          });
        }
      }

      function sendFailureEnvelope(handler, requestId, code, message) {
        if (handler !== undefined) {
          handler({
            ok: false,
            requestId,
            error: {
              code,
              message,
              retriable: false,
            },
          });
        }
      }

      function waitForReleaseSignal(signal) {
        if (signal === undefined || releasedSignals.has(signal)) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          releaseResolvers.set(signal, resolve);
        });
      }

      globalThis.__releaseBackendSettingsSignal = (signal) => {
        releasedSignals.add(signal);
        const resolve = releaseResolvers.get(signal);

        if (resolve !== undefined) {
          releaseResolvers.delete(signal);
          resolve();
        }
      };

      function handleStaticMethod(method, handler) {
        if (method === 'getAuthorisationStatus') {
          sendSuccess(handler, true, 'req-auth-status');
          return true;
        }

        if (method === 'getABClassPartials') {
          sendSuccess(handler, [], 'req-class-partials');
          return true;
        }

        return false;
      }

      function handleBackendSettingsResponse(method, responseIndex, callbacks) {
        const responseQueue = responseQueues[method];
        const response = responseQueue[responseIndex];

        if (response === undefined) {
          return;
        }

        void (async () => {
          await waitForReleaseSignal(response.releaseSignal);

          if (response.delayMs !== undefined) {
            await new Promise((resolve) => {
              setTimeout(resolve, response.delayMs);
            });
          }

          if (response.kind === 'transportFailure') {
            callbacks.failureHandler?.(new Error(response.message));
            return;
          }

          if (response.kind === 'failureEnvelope') {
            sendFailureEnvelope(
              callbacks.successHandler,
              \`req-\${method}-\${responseIndex}\`,
              response.code ?? 'INTERNAL_ERROR',
              response.message
            );
            return;
          }

          sendSuccess(callbacks.successHandler, response.data, \`req-\${method}-\${responseIndex}\`);
        })();
      }

      const run = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
        if (!isBackendSettingsTransportRequest(request)) {
          callbacks.failureHandler?.(new Error('Invalid transport request payload.'));
          return;
        }

        const method = request.method;

        if (handleStaticMethod(method, callbacks.successHandler)) {
          return;
        }

        if (method !== 'getBackendConfig' && method !== 'setBackendConfig') {
          return;
        }

        const responseIndex = callCounts[method];
        callCounts[method] = responseIndex + 1;
        handleBackendSettingsResponse(method, responseIndex, callbacks);
      });

      globalThis.google = {
        script: {
          run,
        },
      };
    })();
  `);
}

/**
 * Opens the settings page and activates the backend settings tab.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the tab is active.
 */
export async function openBackendSettings(page: Page) {
  await page.getByRole('menuitem', { name: settingsMenuLabel }).click();
  await expect(page.getByRole('heading', { level: 2, name: settingsPageHeading })).toBeVisible();
  await page.getByRole('tab', { name: backendSettingsTabLabel }).click();
}

/**
 * Returns a labelled backend-settings field locator.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} label The field label.
 * @returns {ReturnType<Page['getByLabel']>} The labelled field locator.
 */
export function getField(page: Page, label: string) {
  return page.getByLabel(label);
}

/**
 * Releases one queued backend-settings response waiting on a browser-side signal.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} signal Release signal name.
 * @returns {Promise<void>} Completion signal.
 */
export async function releaseBackendSettingsSignal(page: Page, signal: string) {
  await page.evaluate((queuedSignal) => {
    (
      globalThis as {
        __releaseBackendSettingsSignal: (signalName: string) => void;
      }
    ).__releaseBackendSettingsSignal(queuedSignal);
  }, signal);
}
