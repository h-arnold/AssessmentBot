import { expect, test, type Page } from '@playwright/test';
import type { BackendConfig, BackendConfigWriteResult } from '../src/services/backendConfiguration.zod';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

type BackendApiResponseScenario = Readonly<
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

type BackendSettingsRuntimeScenario = Readonly<{
  getBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
  setBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
}>;

const settingsMenuLabel = 'Settings';
const settingsPageHeading = 'Settings';
const backendSettingsTabLabel = 'Backend settings';
const backendSettingsPanelLabel = 'Backend settings panel';
const loadingBackendSettingsLabel = 'Loading backend settings';
const saveButtonLabel = 'Save';
const apiKeyLabel = 'API key';
const backendUrlLabel = 'Backend URL';
const backendAssessorBatchSizeLabel = 'Backend assessor batch size';
const storedApiKeyHelperCopy = 'Stored API key already exists. Leave this field blank to keep it.';
const emptyApiKeyHelperCopy = 'Enter a new API key.';
const partialLoadWarning = 'apiKey: REDACTED';
const backendSettingsLoadFailureCopy = 'Unable to load backend settings right now.';
const backendSettingsSaveFailureCopy = 'Configuration save failed.';
const backendSettingsSavedCopy = 'Backend settings saved.';
const backendSettingsLoadReleaseSignal = 'backend-settings-initial-load';
const backendSettingsSaveDelayMs = 150;
const apiKeyValidationMessage =
  'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.';

const baseBackendConfig = {
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

const refreshedBackendConfig = {
  ...baseBackendConfig,
  backendAssessorBatchSize: 48,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

const partialLoadBackendConfig = {
  ...baseBackendConfig,
  backendUrl: '',
  loadError: partialLoadWarning,
} satisfies BackendConfig;

const noStoredKeyBackendConfig = {
  ...baseBackendConfig,
  apiKey: '',
  hasApiKey: false,
} satisfies BackendConfig;

const refreshedWriteResult = {
  success: true,
} satisfies BackendConfigWriteResult;

/**
 * Installs a browser-side `google.script.run` mock for the backend settings feature.
 *
 * @param {Page} page The Playwright page under test.
 * @param {BackendSettingsRuntimeScenario} scenario The read and write scenarios to simulate.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
async function mockBackendSettingsRuntime(page: Page, scenario: BackendSettingsRuntimeScenario) {
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
async function openBackendSettings(page: Page) {
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
function getField(page: Page, label: string) {
  return page.getByLabel(label);
}

test.describe('backend settings journey', () => {
  test('navigates to the backend settings tab after showing the loading skeleton', async ({
    page,
  }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: baseBackendConfig,
          releaseSignal: backendSettingsLoadReleaseSignal,
        },
      ],
      setBackendConfig: [],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('status', { name: loadingBackendSettingsLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);

    await page.evaluate((signal) => {
      globalThis.__releaseBackendSettingsSignal(signal);
    }, backendSettingsLoadReleaseSignal);

    await expect(page.getByRole('region', { name: backendSettingsPanelLabel })).toBeVisible();
    await expect(getField(page, apiKeyLabel)).toHaveValue('');
  });

  test('shows a top-level alert when loading backend settings fails hard', async ({ page }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'transportFailure',
          message: 'Backend configuration fetch failed.',
        },
      ],
      setBackendConfig: [],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('alert')).toContainText(backendSettingsLoadFailureCopy);
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);
  });

  test('supports keyboard-only edits and focuses the first invalid field when API key is required', async ({
    page,
  }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: noStoredKeyBackendConfig,
        },
      ],
      setBackendConfig: [],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByText(emptyApiKeyHelperCopy)).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('tabpanel', { name: backendSettingsTabLabel })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(getField(page, apiKeyLabel)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(getField(page, backendUrlLabel)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('https://backend-settings.example.com');

    await page.keyboard.press('Tab');
    await expect(getField(page, backendAssessorBatchSizeLabel)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('45');

    await page.getByRole('button', { name: saveButtonLabel }).click();

    await expect(getField(page, apiKeyLabel)).toBeFocused();
    await expect(page.getByText(apiKeyValidationMessage)).toBeVisible();
  });

  test('suppresses the backend settings form when the loaded configuration payload is incomplete', async ({ page }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: partialLoadBackendConfig,
        },
      ],
      setBackendConfig: [],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('alert')).toContainText(partialLoadWarning);
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);
    await expect(getField(page, apiKeyLabel)).toHaveCount(0);
  });

  test('retains the stored API key when saving refreshed backend data', async ({ page }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: baseBackendConfig,
        },
        {
          kind: 'success',
          data: refreshedBackendConfig,
        },
      ],
      setBackendConfig: [
        {
          kind: 'success',
          data: refreshedWriteResult,
          delayMs: backendSettingsSaveDelayMs,
        },
      ],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByText(storedApiKeyHelperCopy)).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(getField(page, backendAssessorBatchSizeLabel)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('45');

    await page.getByRole('button', { name: saveButtonLabel }).click();

    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveClass(/ant-btn-loading/);
    await expect(page.getByRole('button', { name: saveButtonLabel })).toBeDisabled();
    await expect(page.getByText(backendSettingsSavedCopy)).toBeVisible();

    await expect(page.getByRole('region', { name: backendSettingsPanelLabel })).toBeVisible();
    await expect(getField(page, backendAssessorBatchSizeLabel)).toHaveValue('48');
    await expect(getField(page, apiKeyLabel)).toHaveValue('');
    await expect(page.getByText(storedApiKeyHelperCopy)).toBeVisible();
  });

  test('shows save failure feedback when the backend rejects an update', async ({ page }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: baseBackendConfig,
        },
      ],
      setBackendConfig: [
        {
          kind: 'success',
          data: {
            success: false,
            error: backendSettingsSaveFailureCopy,
          },
        },
      ],
    });

    await page.goto('/');
    await openBackendSettings(page);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(getField(page, backendAssessorBatchSizeLabel)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('46');

    await page.getByRole('button', { name: saveButtonLabel }).click();

    await expect(page.getByRole('alert')).toContainText(backendSettingsSaveFailureCopy);
    await expect(getField(page, backendAssessorBatchSizeLabel)).toHaveValue('46');
  });
});
