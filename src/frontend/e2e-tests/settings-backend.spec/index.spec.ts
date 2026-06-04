import { expect, test } from '@playwright/test';
import {
  mockBackendSettingsRuntime,
  openBackendSettings,
  getField,
  releaseBackendSettingsSignal,
  baseBackendConfig,
  refreshedBackendConfig,
  partialLoadBackendConfig,
  noStoredKeyBackendConfig,
  refreshedWriteResult,
  backendSettingsLoadReleaseSignal,
  backendSettingsRefreshReleaseSignal,
  backendSettingsSaveDelayMs,
  backendSettingsTabLabel,
  backendSettingsPanelLabel,
  loadingBackendSettingsLabel,
  saveButtonLabel,
  apiKeyLabel,
  backendUrlLabel,
  backendAssessorBatchSizeLabel,
  storedApiKeyHelperCopy,
  emptyApiKeyHelperCopy,
  partialLoadWarning,
  backendSettingsLoadFailureCopy,
  backendSettingsSaveFailureCopy,
  backendSettingsSavedCopy,
  apiKeyValidationMessage,
} from './fixtures';

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

  test('suppresses the backend settings form when the loaded configuration payload is incomplete', async ({
    page,
  }) => {
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

    await expect(page.getByRole('button', { name: saveButtonLabel })).toHaveClass(
      /ant-btn-loading/
    );
    await expect(page.getByRole('button', { name: saveButtonLabel })).toBeDisabled();
    await expect(page.getByText(backendSettingsSavedCopy)).toBeVisible();

    await expect(page.getByRole('region', { name: backendSettingsPanelLabel })).toBeVisible();
    await expect(getField(page, backendAssessorBatchSizeLabel)).toHaveValue('48');
    await expect(getField(page, apiKeyLabel)).toHaveValue('');
    await expect(page.getByText(storedApiKeyHelperCopy)).toBeVisible();
  });

  test('keeps populated settings visible while publishing panel busy state during a post-save refresh', async ({
    page,
  }) => {
    await mockBackendSettingsRuntime(page, {
      getBackendConfig: [
        {
          kind: 'success',
          data: baseBackendConfig,
        },
        {
          kind: 'success',
          data: refreshedBackendConfig,
          releaseSignal: backendSettingsRefreshReleaseSignal,
        },
      ],
      setBackendConfig: [
        {
          kind: 'success',
          data: refreshedWriteResult,
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

    try {
      await page.getByRole('button', { name: saveButtonLabel }).click();

      const panel = page.getByRole('region', { name: backendSettingsPanelLabel });
      const saveButton = panel.getByRole('button', { name: saveButtonLabel });

      await expect(panel).toHaveAttribute('aria-busy', 'true');
      await expect(saveButton).not.toHaveClass(/ant-btn-loading/);
      await expect(panel.getByRole('heading', { level: 3, name: 'Backend' })).toBeVisible();
      await expect(getField(page, backendUrlLabel)).toHaveValue('https://backend.example.com');
      await expect(getField(page, backendAssessorBatchSizeLabel)).toHaveValue('45');
    } finally {
      await releaseBackendSettingsSignal(page, backendSettingsRefreshReleaseSignal);
    }
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
