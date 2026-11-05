import { expect, test } from '@playwright/test';
import { mockBackendSettingsRuntime } from './helpers/settings-backend-runtime-mock';
import {
  baseBackendConfig,
  refreshedBackendConfig,
  refreshedWriteResult,
} from './helpers/settings-backend-fixtures';
import {
  apiKeyLabel,
  backendAssessorBatchSizeLabel,
  backendSettingsPanelLabel,
  backendSettingsRefreshReleaseSignal,
  backendSettingsSaveDelayMs,
  backendSettingsSaveFailureCopy,
  backendSettingsSavedCopy,
  backendUrlLabel,
  editFieldViaKeyboard,
  getField,
  openBackendSettings,
  releaseBackendSettingsSignal,
  saveButtonLabel,
  storedApiKeyHelperCopy,
} from './helpers/settings-backend-journey';

test.describe('backend settings save journey', () => {
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

    await editFieldViaKeyboard(page, {
      fieldLabel: backendAssessorBatchSizeLabel,
      value: '45',
    });

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

    await editFieldViaKeyboard(page, {
      fieldLabel: backendAssessorBatchSizeLabel,
      value: '45',
    });

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

    await editFieldViaKeyboard(page, {
      fieldLabel: backendAssessorBatchSizeLabel,
      value: '46',
    });

    await page.getByRole('button', { name: saveButtonLabel }).click();

    await expect(page.getByRole('alert')).toContainText(backendSettingsSaveFailureCopy);
    await expect(getField(page, backendAssessorBatchSizeLabel)).toHaveValue('46');
  });
});
