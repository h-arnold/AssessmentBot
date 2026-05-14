/**
 * Settings Topics CRUD — browser journey tests.
 *
 * Covers the visible browser interactions for the topics management modal:
 * - Manage Topics button visibility in the Settings > Reference Data tab
 * - Opening the management modal and viewing the topics list
 * - Mask close behavior (explicit coverage for skipped unit test)
 *
 * Note: This complements the unit tests in ManageTopicsModal.spec.tsx which skip
 * mask click tests due to JSDOM/HappyDOM limitations.
 */

import { expect, test } from '@playwright/test';
import { mockTopics } from '../src/test/assignmentDefinition/sharedTestFixtures';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';
import { baseYearGroups } from './classes-crud.shared';
import {
  assertTransientStateResetOnClose,
  topicsModalConfig,
} from './helpers/classes-crud-modal-layout';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const settingsMenuLabel = 'Settings';
const settingsPageHeading = 'Settings';
const referenceDataTabLabel = 'Reference Data';

// Topics for testing - using the shared fixtures
const baseTopics = mockTopics;

// ---------------------------------------------------------------------------
// Runtime Mock
// ---------------------------------------------------------------------------

/**
 * Installs a browser-side `google.script.run` mock for the topics management feature.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>} A promise that resolves once the init script is installed.
 */
async function mockTopicsCrudRuntime(page: Parameters<typeof mockTopicsCrudRuntime>[0]) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          handler({ ok: true, requestId, data });
        }
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
              sendSuccess(callbacks.successHandler, {}, 'req-backend-config');
              return;
            }

            if (method === 'getAssignmentTopics') {
              sendSuccess(callbacks.successHandler, ${JSON.stringify(baseTopics)}, 'req-assignment-topics');
              return;
            }

            if (method === 'getYearGroups') {
              sendSuccess(callbacks.successHandler, ${JSON.stringify(baseYearGroups)}, 'req-year-groups');
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
 * Opens the Settings page with topics management scenario.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>} A promise that resolves once the Settings > Reference Data tab is active.
 */
async function openSettingsTopicsTab(page: Parameters<typeof openSettingsTopicsTab>[0]) {
  await mockTopicsCrudRuntime(page);
  await page.goto('/');

  // Navigate to Settings
  await page.getByRole('menuitem', { name: settingsMenuLabel }).click();
  await expect(page.getByRole('heading', { level: 2, name: settingsPageHeading })).toBeVisible();

  // Navigate to Reference Data tab
  await page.getByRole('tab', { name: referenceDataTabLabel }).click();
  await expect(page.getByRole('region', { name: /reference data/i })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Opens the Manage Topics modal from the Settings > Reference Data tab.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>} A promise that resolves once the modal is open.
 */
async function openManageTopicsModal(page: Parameters<typeof openManageTopicsModal>[0]) {
  await page.getByRole('button', { name: topicsModalConfig.managementButtonName }).click();
  const modal = page.getByRole('dialog', topicsModalConfig.modalName);
  await expect(modal).toBeVisible();
  return modal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Settings Topics CRUD — Manage Topics', () => {
  test.beforeEach(async ({ page }) => {
    await openSettingsTopicsTab(page);
  });

  // Section 1: Basic modal visibility

  test('Manage Topics button is visible in Reference Data tab', async ({ page }) => {
    const manageTopicsButton = page.getByRole('button', {
      name: topicsModalConfig.managementButtonName,
    });
    await expect(manageTopicsButton).toBeVisible();
  });

  test('opens Manage Topics modal when button is clicked', async ({ page }) => {
    const modal = await openManageTopicsModal(page);
    await expect(modal).toBeVisible();
  });

  // Section 2: Mask close route

  test('Mask close dismisses modal and reopening starts from a clean ready state', async ({
    page,
  }) => {
    await assertTransientStateResetOnClose({
      page,
      setupScenario: openSettingsTopicsTab,
      closeMethod: 'mask',
      config: topicsModalConfig,
    });
  });

  // Section 3: Keyboard close route

  test('Keyboard Escape dismisses modal and reopening starts from a clean ready state', async ({
    page,
  }) => {
    await assertTransientStateResetOnClose({
      page,
      setupScenario: openSettingsTopicsTab,
      closeMethod: 'Escape',
      config: topicsModalConfig,
    });
  });
});
