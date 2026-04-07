import { expect, type Page, test } from '@playwright/test';
import {
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const cohortEligibleClassPartials = [
  {
    classId: 'gc-active',
    className: 'Alpha Active',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    courseLength: 30,
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    classOwner: null,
    teachers: [],
    active: true,
  },
  {
    classId: 'gc-inactive',
    className: 'Beta Inactive',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    courseLength: 20,
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    classOwner: null,
    teachers: [],
    active: false,
  },
  {
    classId: 'orphaned-legacy',
    className: 'Legacy Orphaned',
    cohortKey: 'cohort-2023',
    cohortLabel: 'Cohort 2023',
    courseLength: 25,
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    classOwner: null,
    teachers: [],
    active: false,
  },
] as const;

const cohortEligibleGoogleClassrooms = [
  { classId: 'gc-active', className: 'Alpha Active' },
  { classId: 'gc-inactive', className: 'Beta Inactive' },
  { classId: 'gc-not-created', className: 'Gamma Not Created' },
] as const;

const bulkCohortOptions = [
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: true,
    startYear: 2024,
    startMonth: 9,
  },
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  {
    key: 'cohort-2023',
    name: 'Cohort 2023',
    active: false,
    startYear: 2023,
    startMonth: 9,
  },
] as const;

const cohortPartialsAfterPartialFailure = [
  {
    ...cohortEligibleClassPartials[0],
    cohortKey: 'cohort-2025',
    cohortLabel: 'Cohort 2025',
  },
  cohortEligibleClassPartials[1],
  cohortEligibleClassPartials[2],
] as const;

/**
 * Returns the table row locator for one classes row.
 *
 * @param {Page} page Playwright page.
 * @param {string} rowKey Row identifier.
 * @returns {ReturnType<Page['locator']>} Row locator.
 */
function getRow(page: Page, rowKey: string) {
  return page.locator("tbody tr[data-row-key=\"" + rowKey + "\"]");
}

/**
 * Selects a classes-table row by row key.
 *
 * @param {Page} page Playwright page.
 * @param {string} rowKey Row identifier.
 * @returns {Promise<void>} Completion signal.
 */
async function selectRowByKey(page: Page, rowKey: string): Promise<void> {
  await getRow(page, rowKey).getByRole('checkbox').check();
}

/**
 * Clears a selected classes-table row by row key.
 *
 * @param {Page} page Playwright page.
 * @param {string} rowKey Row identifier.
 * @returns {Promise<void>} Completion signal.
 */
async function clearRowSelectionByKey(page: Page, rowKey: string): Promise<void> {
  await getRow(page, rowKey).getByRole('checkbox').uncheck();
}

test.describe('Classes CRUD bulk cohort flow', () => {
  test('opens the bulk cohort modal from active, inactive, and mixed eligible existing selections and shows active cohorts only', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: cohortEligibleClassPartials,
        cohorts: bulkCohortOptions,
        yearGroups: baseYearGroups,
        googleClassrooms: cohortEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeEnabled();

    await clearRowSelectionByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeEnabled();

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeEnabled();

    await page.getByRole('button', { name: 'Set cohort' }).click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await expect(page.getByRole('option', { name: 'Cohort 2024' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cohort 2025' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cohort 2023' })).toHaveCount(0);
  });

  test('hands off partial cohort updates to the summary alert, refreshes successful rows, and reselects only failed rows', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: cohortEligibleClassPartials },
        { kind: 'success', data: cohortPartialsAfterPartialFailure },
      ],
      getCohorts: [{ kind: 'success', data: bulkCohortOptions }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: cohortEligibleGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectRowByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set cohort' }).click();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2025' }).click();
    await page.getByRole('dialog', { name: 'Set cohort' }).getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not updated.')).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getRow(page, 'gc-active')).toContainText('Cohort 2025');
    await expect(getRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps bulk cohort disabled for notCreated and orphaned selections', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: cohortEligibleClassPartials,
        cohorts: bulkCohortOptions,
        yearGroups: baseYearGroups,
        googleClassrooms: cohortEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeDisabled();

    await clearRowSelectionByKey(page, 'gc-not-created');
    await selectRowByKey(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
  });
});
