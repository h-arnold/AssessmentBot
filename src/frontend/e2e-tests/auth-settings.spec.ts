import { expect, test, type Page } from '@playwright/test';
import {
  createAuthenticationSettingsScenario,
  installRuntimeMock,
  getMethodCalls,
} from './shared/endToEndRuntimeMocks';

const settingsMenuLabel = 'Settings';
const authenticationTabLabel = 'Authentication';
const initialSettings = {
  authMode: 'scriptProperties' as const,
  authGroupEmail: '',
  authUsers: [{ email: 'admin@example.com', role: 'admin' as const }],
  authRevision: '1',
};
const settingsAfterFirstSave = {
  ...initialSettings,
  authUsers: [
    { email: 'admin@example.com', role: 'admin' as const },
    { email: 'teacher@example.com', role: 'user' as const },
  ],
  authRevision: '2',
};

/**
 * Opens Settings and selects the admin-only Authentication tab.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} Resolves once the Authentication tab is selected.
 */
async function openAuthenticationSettings(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: settingsMenuLabel }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: authenticationTabLabel }).click();
}

test.describe('Authentication settings journeys', () => {
  test('admin adds a user, saves, and sees the persisted authorised-user row', async ({ page }) => {
    const scenario = createAuthenticationSettingsScenario({
      authenticationSettings: [
        { kind: 'success', data: initialSettings },
        { kind: 'success', data: initialSettings },
        { kind: 'success', data: settingsAfterFirstSave },
        { kind: 'success', data: settingsAfterFirstSave },
      ],
    });
    await installRuntimeMock(page, scenario);
    await page.goto('/');

    await openAuthenticationSettings(page);
    await expect(page.getByRole('columnheader', { name: /email/i })).toBeVisible();

    await page.getByLabel(/email/i).fill('Teacher@Example.com');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('teacher@example.com', { exact: true })).toHaveCount(1);

    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Authentication settings saved.', { exact: true })).toBeVisible();
    await expect(page.getByText('teacher@example.com', { exact: true })).toHaveCount(1);
    await expect(page.getByText('teacher@example.com', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();

    const methodCalls = await getMethodCalls(page);
    expect(methodCalls).toContain('getAuthenticationSettings');
    expect(methodCalls).toContain('setAuthenticationSettings');
  });

  test('renders a persistent warning when the second save has a stale revision', async ({
    page,
  }) => {
    const scenario = createAuthenticationSettingsScenario({
      authenticationSettings: [
        { kind: 'success', data: initialSettings },
        { kind: 'success', data: initialSettings },
        { kind: 'success', data: settingsAfterFirstSave },
        { kind: 'success', data: settingsAfterFirstSave },
      ],
      saveResponses: [
        { kind: 'success', data: { success: true, authRevision: '2' } },
        {
          kind: 'failureEnvelope',
          code: 'AUTH_SETTINGS_STALE_REVISION',
          message: 'Stale auth revision: the stored settings changed since this save was prepared.',
        },
      ],
    });
    await installRuntimeMock(page, scenario);
    await page.goto('/');

    await openAuthenticationSettings(page);
    await page.getByLabel(/email/i).fill('Teacher@Example.com');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Authentication settings saved.', { exact: true })).toBeVisible();

    await page.getByLabel(/email/i).fill('SecondTeacher@Example.com');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByRole('alert')).toContainText(
      /another administrator saved first|stale revision/i
    );
    await expect(page.getByText('secondteacher@example.com', { exact: true })).toHaveCount(1);
    await expect(page.getByText('teacher@example.com', { exact: true })).toHaveCount(1);
  });
});
