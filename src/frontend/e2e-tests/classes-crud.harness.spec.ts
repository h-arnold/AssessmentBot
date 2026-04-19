import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseCohorts,
  baseGoogleClassrooms,
  baseYearGroups,
  matchedClassPartials,
  matchedGoogleClassrooms,
  mockClassesCrudRuntime,
  openClassesTab,
  releaseClassesCrudSignal,
} from './classes-crud.shared';

const backgroundRefreshReleaseSignal = 'classes-background-refresh';
const filterableColumnHeaderNames = ['Status', 'Cohort', 'Course length', 'Year group', 'Active'] as const;

/**
 * Boots the Classes page with a scenario that triggers a background refresh after "Set active".
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {typeof matchedClassPartials} refreshedClassPartials Refreshed class-partials payload.
 * @returns {Promise<void>} Resolves once the runtime scenario is installed.
 */
async function setUpBackgroundRefreshScenario(
  page: Parameters<typeof mockClassesCrudRuntime>[0],
  refreshedClassPartials: typeof matchedClassPartials,
) {
  await mockClassesCrudRuntime(page, {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [
      { kind: 'success', data: matchedClassPartials },
      {
        kind: 'success',
        data: refreshedClassPartials,
        releaseSignal: backgroundRefreshReleaseSignal,
      },
    ],
    getCohorts: [{ kind: 'success', data: baseCohorts }],
    getYearGroups: [{ kind: 'success', data: baseYearGroups }],
    getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
    updateABClass: [{ kind: 'success', data: { ok: true } }],
  });
}

/**
 * Opens the Classes tab, selects one class row, then starts the "Set active" workflow.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>} Resolves once the workflow request is started.
 */
async function startSetActiveRefreshWorkflow(page: Parameters<typeof mockClassesCrudRuntime>[0]) {
  await page.goto('/');
  await openClassesTab(page);
  await page.locator('tbody tr[data-row-key="gc-class-202"]').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Set active' }).click();
}

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

  test('keeps the visible classes workflow on screen while a background refresh is busy', async ({ page }) => {
    const refreshedClassPartials = [
      matchedClassPartials[0],
      {
        ...matchedClassPartials[1],
        active: true,
      },
    ];

    await setUpBackgroundRefreshScenario(page, refreshedClassPartials);

    try {
      await startSetActiveRefreshWorkflow(page);

      const panel = page.getByRole('region', { name: 'Classes management panel' });
      const workflow = page.getByRole('region', { name: 'Classes data workflow' });
      await expect(workflow).toHaveAttribute('aria-busy', 'true');
      await expect(panel).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('table', { name: 'Classes table' })).toBeVisible();
      await expect(page.getByText('Selected rows: 1')).toBeVisible();
    } finally {
      await releaseClassesCrudSignal(page, backgroundRefreshReleaseSignal);
    }
  });

  test('disables conflicting class write controls while keeping adjacent reference-data launchers available', async ({ page }) => {
    await setUpBackgroundRefreshScenario(page, matchedClassPartials);

    try {
      await startSetActiveRefreshWorkflow(page);

      await expect(page.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Set year group' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Set course length' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Delete ABClass' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Reset sort and filters' })).toBeEnabled();

      for (const columnHeaderName of filterableColumnHeaderNames) {
        await expect(
          page.getByRole('columnheader', { name: columnHeaderName }).getByRole('button')
        ).toBeEnabled();
      }

      await expect(page.getByRole('button', { name: 'Manage Cohorts' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Manage Year Groups' })).toBeEnabled();
      await expect(
        page.locator('tbody tr[data-row-key="gc-class-201"]').getByRole('checkbox')
      ).toBeDisabled();
    } finally {
      await releaseClassesCrudSignal(page, backgroundRefreshReleaseSignal);
    }
  });

  test('keeps metadata modal open with inline feedback when every selected row fails to update', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: matchedClassPartials }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
      updateABClass: [
        { kind: 'failureEnvelope', message: 'First update failed.' },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await page.goto('/');
    await openClassesTab(page);
    await page.locator('tbody tr[data-row-key="gc-class-201"]').getByRole('checkbox').check();
    await page.locator('tbody tr[data-row-key="gc-class-202"]').getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Set cohort' }).click();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2024' }).click();
    await page.getByRole('dialog', { name: 'Set cohort' }).getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toBeVisible();
    await expect(page.getByText('Unable to update any of the 2 selected classes. Please review the remaining selection and try again.')).toBeVisible();
    await expect(page.getByText('Some selected classes were not updated.')).toHaveCount(0);
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
    await expect
      .poll(
        () => consoleMessages.some((message) => message.includes('Unexpected call')),
        { message: 'Expected an unexpected backend call error in browser console.' }
      )
      .toBe(true);
  });
});
