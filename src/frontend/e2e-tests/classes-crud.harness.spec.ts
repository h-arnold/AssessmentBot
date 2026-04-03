import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseCohorts,
  baseGoogleClassrooms,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
} from './classes-crud.shared';

const unexpectedCallWaitTimeoutMs = 500;

test.describe('Classes CRUD harness journey', () => {
  test('shows ready state when all startup warm-up queries succeed', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: baseClassPartials }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: baseGoogleClassrooms }],
    });

    await page.goto('/');
    await openClassesTab(page);
    await expect(page.getByRole('table', { name: 'Classes table' })).toBeVisible();
    await expect(page.getByText('Summary')).toBeVisible();
    await expect(page.getByText('Bulk actions')).toBeVisible();
  });

  test('shows unauthorised state when startup warm-up is blocked by auth failure', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: false }],
      getABClassPartials: [],
      getCohorts: [],
      getYearGroups: [],
      getGoogleClassrooms: [],
    });

    await page.goto('/');
    await expect(page.getByText('Unauthorised')).toBeVisible();
  });

  test('shows blocking classes state when warm-up-required dataset fails', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'transportFailure', message: 'Class partials fetch failed.' }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: baseGoogleClassrooms }],
    });

    await page.goto('/');
    await openClassesTab(page);
    await expect(page.getByText('Classes feature is unavailable.')).toBeVisible();
  });

  test('shows blocking classes state when Google Classrooms fetch fails', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: baseClassPartials }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [
        { kind: 'failureEnvelope', code: 'GOOGLE_API_ERROR', message: 'Google Classrooms fetch failed.' },
      ],
    });

    await page.goto('/');
    await openClassesTab(page);
    await expect(page.getByText('Classes feature is unavailable.')).toBeVisible();
  });

  test('shows no-active-classrooms empty state for fully empty datasets', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: [] }],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [{ kind: 'success', data: [] }],
      getGoogleClassrooms: [{ kind: 'success', data: [] }],
    });

    await page.goto('/');
    await openClassesTab(page);
    await expect(page.getByText('No active Google Classrooms are available.')).toBeVisible();
  });

  test('fails fast when an unexpected backend call is made outside the scenario queue', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [],
      getCohorts: [],
      getYearGroups: [],
      getGoogleClassrooms: [],
    });

    await page.goto('/');
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });

    await openClassesTab(page);
    await page.waitForTimeout(unexpectedCallWaitTimeoutMs);
    expect(consoleMessages.some((message) => message.includes('Unexpected call'))).toBe(true);
  });
});
