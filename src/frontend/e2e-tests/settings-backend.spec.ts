import { expect, test } from '@playwright/test';
import { backendApiKeyValidationMessage } from '@/services/backendConfiguration/backendConfigurationValidation';
import {
  createBackendSettingsScenario,
  installRuntimeMock,
  releaseRuntimeSignal,
} from './shared/endToEndRuntimeMocks';
import {
  baseBackendConfig,
  noStoredKeyBackendConfig,
  partialLoadBackendConfig,
} from './helpers/settings-backend-fixtures';
import {
  apiKeyLabel,
  backendAssessorBatchSizeLabel,
  backendSettingsLoadFailureCopy,
  backendSettingsLoadReleaseSignal,
  backendSettingsPanelLabel,
  backendSettingsTabLabel,
  backendUrlLabel,
  editFieldViaKeyboard,
  emptyApiKeyHelperCopy,
  loadingBackendSettingsLabel,
  openBackendSettings,
  partialLoadWarning,
  saveButtonLabel,
} from './helpers/settings-backend-journey';

test.describe('backend settings journey', () => {
  test('navigates to the backend settings tab after showing the loading skeleton', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createBackendSettingsScenario({
        getBackendConfig: [
          {
            kind: 'success',
            data: baseBackendConfig,
            releaseSignal: backendSettingsLoadReleaseSignal,
          },
        ],
        setBackendConfig: [],
      })
    );

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('status', { name: loadingBackendSettingsLabel })).toBeVisible();
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);

    await releaseRuntimeSignal(page, backendSettingsLoadReleaseSignal);

    await expect(page.getByRole('region', { name: backendSettingsPanelLabel })).toBeVisible();
    await expect(page.getByLabel(apiKeyLabel)).toHaveValue('');
  });

  test('shows a top-level alert when loading backend settings fails hard', async ({ page }) => {
    await installRuntimeMock(
      page,
      createBackendSettingsScenario({
        getBackendConfig: [
          {
            kind: 'transportFailure',
            message: 'Backend configuration fetch failed.',
          },
        ],
        setBackendConfig: [],
      })
    );

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('alert')).toContainText(backendSettingsLoadFailureCopy);
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);
  });

  test('supports keyboard-only edits and focuses the first invalid field when API key is required', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createBackendSettingsScenario({
        getBackendConfig: [
          {
            kind: 'success',
            data: noStoredKeyBackendConfig,
          },
        ],
        setBackendConfig: [],
      })
    );

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByText(emptyApiKeyHelperCopy)).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('tabpanel', { name: backendSettingsTabLabel })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel(apiKeyLabel)).toBeFocused();

    await editFieldViaKeyboard(page, {
      fieldLabel: backendUrlLabel,
      value: 'https://backend-settings.example.com',
    });
    await editFieldViaKeyboard(page, {
      fieldLabel: backendAssessorBatchSizeLabel,
      value: '45',
    });

    await page.getByRole('button', { name: saveButtonLabel }).click();

    await expect(page.getByLabel(apiKeyLabel)).toBeFocused();
    await expect(page.getByText(backendApiKeyValidationMessage)).toBeVisible();
  });

  test('suppresses the backend settings form when the loaded configuration payload is incomplete', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createBackendSettingsScenario({
        getBackendConfig: [
          {
            kind: 'success',
            data: partialLoadBackendConfig,
          },
        ],
        setBackendConfig: [],
      })
    );

    await page.goto('/');
    await openBackendSettings(page);

    await expect(page.getByRole('alert')).toContainText(partialLoadWarning);
    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveCount(0);
    await expect(page.getByLabel(apiKeyLabel)).toHaveCount(0);
  });
});
