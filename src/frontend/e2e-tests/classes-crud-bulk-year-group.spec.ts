import { expect, type Page, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const yearGroupEligibleClassPartials = [
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
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
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

const yearGroupEligibleGoogleClassrooms = [
  { classId: 'gc-active', className: 'Alpha Active' },
  { classId: 'gc-inactive', className: 'Beta Inactive' },
  { classId: 'gc-not-created', className: 'Gamma Not Created' },
] as const;

const yearGroupPartialsAfterPartialFailure = [
  {
    ...yearGroupEligibleClassPartials[0],
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
  },
  yearGroupEligibleClassPartials[1],
  yearGroupEligibleClassPartials[2],
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

test.describe('Classes CRUD bulk year-group flow', () => {
  test('opens the bulk year-group modal from active, inactive, and mixed eligible existing selections', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: yearGroupEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: yearGroupEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeEnabled();

    await clearRowSelectionByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeEnabled();

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeEnabled();

    await page.getByRole('button', { name: 'Set year group' }).click();

    await expect(page.getByRole('dialog', { name: 'Set year group' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await expect(page.getByRole('option', { name: 'Year 7' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Year 8' })).toBeVisible();
  });

  test('keeps the year-group modal open, refreshes successful rows, and reselects only failed rows after a partial failure', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: yearGroupEligibleClassPartials },
        { kind: 'success', data: yearGroupPartialsAfterPartialFailure },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: yearGroupEligibleGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectRowByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set year group' }).click();
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await page.getByRole('option', { name: 'Year 8' }).click();
    await page.getByRole('dialog', { name: 'Set year group' }).getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('dialog', { name: 'Set year group' })).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getRow(page, 'gc-active')).toContainText('Year 8');
    await expect(getRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps bulk year-group disabled for notCreated and orphaned selections', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: yearGroupEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: yearGroupEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeDisabled();

    await clearRowSelectionByKey(page, 'gc-not-created');
    await selectRowByKey(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeDisabled();
  });
});
