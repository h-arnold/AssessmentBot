import { expect, test, type Page } from '@playwright/test';
import type { BackendConfig } from '../src/services/backendConfiguration.zod';
import { createAssignmentsScenario, installRuntimeMock, mockPartialRows } from './shared/endToEndRuntimeMocks';
import {
  baseClassPartials,
  baseCohorts,
  baseGoogleClassrooms,
  baseYearGroups,
} from './classes-crud.shared';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const dashboardPageHeading = 'Dashboard';
const assignmentsPageHeading = 'Assignments';
const settingsPageHeading = 'Settings';
const backendSettingsTabLabel = 'Backend settings';

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

test.use({
  viewport: { width: 1440, height: 900 },
});

/**
 * Installs a browser runtime mock that serves the Settings page backend config.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} Resolves once the runtime mock is installed.
 */
async function mockSettingsRuntime(page: Page): Promise<void> {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendConfig = ${JSON.stringify(backendConfig)};
      const baseClassPartials = ${JSON.stringify(baseClassPartials)};
      const baseGoogleClassrooms = ${JSON.stringify(baseGoogleClassrooms)};
      const baseCohorts = ${JSON.stringify(baseCohorts)};
      const baseYearGroups = ${JSON.stringify(baseYearGroups)};

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (method === 'getAuthorisationStatus') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-auth-status',
                data: true,
              });
              return;
            }

            if (method === 'getABClassPartials') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-class-partials',
                data: baseClassPartials,
              });
              return;
            }

            if (method === 'getGoogleClassrooms') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-google-classrooms',
                data: baseGoogleClassrooms,
              });
              return;
            }

            if (method === 'getCohorts') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-cohorts',
                data: baseCohorts,
              });
              return;
            }

            if (method === 'getYearGroups') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-year-groups',
                data: baseYearGroups,
              });
              return;
            }

            if (method === 'getBackendConfig') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-backend-config',
                data: backendConfig,
              });
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
 * Waits for the visible page heading used by the screenshot snapshot.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} heading The page heading to wait for.
 * @returns {Promise<void>} Resolves once the heading is visible.
 */
async function waitForPageHeading(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
}

test.describe('page width screenshots', () => {
  test('captures the wide dashboard page shell', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAssignmentsScenario({
        includeAuth: true,
        includeAssignmentTopics: true,
        includeClassPartials: true,
        includeCohorts: true,
        includeYearGroups: true,
        initialPartials: [mockPartialRows[0]],
      })
    );

    await page.goto('/');
    await waitForPageHeading(page, dashboardPageHeading);

    await expect(page).toHaveScreenshot('dashboard-page.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
    });
  });

  test('captures the wide assignments page shell', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAssignmentsScenario({
        includeAuth: true,
        includeAssignmentTopics: true,
        includeClassPartials: true,
        includeCohorts: true,
        includeYearGroups: true,
        initialPartials: [mockPartialRows[0]],
      })
    );

    await page.goto('/');
    await page.getByRole('menuitem', { name: assignmentsPageHeading }).click();
    await waitForPageHeading(page, assignmentsPageHeading);

    await expect(page).toHaveScreenshot('assignments-page.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
    });
  });

  test('captures the wide settings frame and the narrow backend panel exception', async ({ page }) => {
    await mockSettingsRuntime(page);

    await page.goto('/');
    await page.getByRole('menuitem', { name: settingsPageHeading }).click();
    await waitForPageHeading(page, settingsPageHeading);

    await page.getByRole('tab', { name: backendSettingsTabLabel }).click();
    await expect(page.getByRole('region', { name: 'Backend settings panel' })).toBeVisible();

    await expect(page).toHaveScreenshot('settings-page-backend-tab.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
    });
  });
});
