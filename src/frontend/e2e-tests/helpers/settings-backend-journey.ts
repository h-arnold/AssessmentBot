import { expect, type Page } from '@playwright/test';

/** Menu label of the Settings page. */
export const settingsMenuLabel = 'Settings';
/** Level-2 heading of the Settings page. */
export const settingsPageHeading = 'Settings';
/** Maximum Tab presses used to reach a backend settings field. */
export const MAX_KEYBOARD_FOCUS_STEPS = 20;
/** Tab label that opens the backend settings panel. */
export const backendSettingsTabLabel = 'Backend settings';
/** Accessible name of the backend settings panel region. */
export const backendSettingsPanelLabel = 'Backend settings panel';
/** Accessible name of the backend settings loading indicator. */
export const loadingBackendSettingsLabel = 'Loading backend settings';
/** Label of the backend settings save button. */
export const saveButtonLabel = 'Save';
/** Label of the API key field. */
export const apiKeyLabel = 'API key';
/** Label of the backend URL field. */
export const backendUrlLabel = 'Backend URL';
/** Label of the backend assessor batch size field. */
export const backendAssessorBatchSizeLabel = 'Backend assessor batch size';
/** Helper copy shown when a stored API key already exists. */
export const storedApiKeyHelperCopy =
  'Stored API key already exists. Leave this field blank to keep it.';
/** Helper copy shown when no API key is stored. */
export const emptyApiKeyHelperCopy = 'Enter a new API key.';
/** Warning text carried by a partially loaded configuration payload. */
export const partialLoadWarning = 'apiKey: REDACTED';
/** Top-level alert copy for a hard backend settings load failure. */
export const backendSettingsLoadFailureCopy = 'Unable to load backend settings right now.';
/** Alert copy for a rejected backend settings save. */
export const backendSettingsSaveFailureCopy = 'Configuration save failed.';
/** Confirmation copy for a successful backend settings save. */
export const backendSettingsSavedCopy = 'Backend settings saved.';
/** Release signal that holds the initial backend settings read. */
export const backendSettingsLoadReleaseSignal = 'backend-settings-initial-load';
/** Delay applied to the queued save so the loading state is observable. */
export const backendSettingsSaveDelayMs = 150;
/** Release signal that holds the post-save backend settings refresh. */
export const backendSettingsRefreshReleaseSignal = 'backend-settings-post-save-refresh';

/**
 * Opens the settings page and activates the backend settings tab.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the tab is active.
 */
export async function openBackendSettings(page: Page): Promise<void> {
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
export async function releaseBackendSettingsSignal(page: Page, signal: string): Promise<void> {
  await page.evaluate((queuedSignal) => {
    (
      globalThis as typeof globalThis & {
        __releaseBackendSettingsSignal?: (signalName: string) => void;
      }
    ).__releaseBackendSettingsSignal?.(queuedSignal);
  }, signal);
}

/**
 * Uses keyboard navigation to reach and edit a backend settings field.
 *
 * @param {Page} page The Playwright page under test.
 * @param {object} options Keyboard navigation and field edit options.
 * @param {string} options.fieldLabel Accessible label of the field to edit.
 * @param {string} options.value Value to enter.
 * @returns {Promise<void>} A promise that resolves once the field is edited.
 */
export async function editFieldViaKeyboard(
  page: Page,
  options: { fieldLabel: string; value: string }
): Promise<void> {
  const field = getField(page, options.fieldLabel);
  let hasReachedField = false;

  for (let index = 0; index < MAX_KEYBOARD_FOCUS_STEPS; index += 1) {
    await page.keyboard.press('Tab');
    hasReachedField = await field.evaluate((element) => element === document.activeElement);
    if (hasReachedField) break;
  }

  expect(hasReachedField).toBe(true);
  await expect(field).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(options.value);
}
