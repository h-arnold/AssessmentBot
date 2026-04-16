import { expect, test, type Locator, type Page } from '@playwright/test';
import type { BackendConfig } from '../src/services/backendConfiguration.zod';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const settingsMenuLabel = 'Settings';
const settingsPageHeading = 'Settings';
const backendSettingsTabLabel = 'Backend settings';
const backendSettingsPanelLabel = 'Backend settings panel';
const panelCentreTolerancePixels = 2;

const backendConfig = {
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

/**
 * Installs the browser-side transport mock for the Settings page width journey.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the init script is installed.
 */
async function mockSettingsPageRuntime(page: Page) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendConfig = ${JSON.stringify(backendConfig)};

      function sendSuccess(handler, data, requestId) {
        handler?.({
          ok: true,
          requestId,
          data,
        });
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (method === 'getAuthorisationStatus') {
              sendSuccess(callbacks.successHandler, true, 'req-auth-status');
              return;
            }

            if (method === 'getABClassPartials') {
              sendSuccess(callbacks.successHandler, [], 'req-class-partials');
              return;
            }

            if (method === 'getBackendConfig') {
              sendSuccess(callbacks.successHandler, backendConfig, 'req-backend-config');
              return;
            }

            callbacks.failureHandler?.(new Error('No mocked response configured for method: ' + String(method)));
          }),
        },
      };
    })();
  `);
}

/**
 * Returns a rounded bounding box for a visible locator.
 *
 * @param {Locator} locator The locator whose bounding box should be measured.
 * @returns {Promise<{ left: number; right: number; width: number }>} The rounded box metrics.
 */
async function getRoundedBox(locator: Locator) {
  const box = await locator.boundingBox();

  if (box === null) {
    throw new Error('Expected locator to have a visible bounding box.');
  }

  const left = Math.round(box.x);
  const width = Math.round(box.width);

  return {
    left,
    right: left + width,
    width,
  };
}

test.describe('settings page width contracts', () => {
  test('keeps the outer Settings frame stable while rendering a narrower centred backend panel inside it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSettingsPageRuntime(page);

    await page.goto('/');
    await page.getByRole('menuitem', { name: settingsMenuLabel }).click();
    await expect(page.getByRole('heading', { level: 2, name: settingsPageHeading })).toBeVisible();

    const settingsPageContent = page.locator('section[aria-label="Settings page"] .app-page-content').first();
    const classesFrameBox = await getRoundedBox(settingsPageContent);

    await page.getByRole('tab', { name: backendSettingsTabLabel }).click();

    const backendSettingsPanel = page.getByRole('region', { name: backendSettingsPanelLabel });
    await expect(backendSettingsPanel).toBeVisible();

    const backendFrameBox = await getRoundedBox(settingsPageContent);
    const backendPanelBox = await getRoundedBox(backendSettingsPanel);
    const leftInset = backendPanelBox.left - backendFrameBox.left;
    const rightInset = backendFrameBox.right - backendPanelBox.right;

    expect(backendFrameBox.width).toBe(classesFrameBox.width);
    expect(backendPanelBox.width).toBeLessThan(backendFrameBox.width);
    expect(leftInset).toBeGreaterThan(0);
    expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(panelCentreTolerancePixels);
  });
});
