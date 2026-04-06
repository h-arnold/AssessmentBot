import { expect, type Page, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const courseLengthEligibleClassPartials = [
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

const courseLengthEligibleGoogleClassrooms = [
  { classId: 'gc-active', className: 'Alpha Active' },
  { classId: 'gc-inactive', className: 'Beta Inactive' },
  { classId: 'gc-not-created', className: 'Gamma Not Created' },
] as const;

const courseLengthPartialsAfterPartialFailure = [
  {
    ...courseLengthEligibleClassPartials[0],
    courseLength: 40,
  },
  courseLengthEligibleClassPartials[1],
  courseLengthEligibleClassPartials[2],
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

test.describe('Classes CRUD bulk course-length flow', () => {
  test('opens the bulk course-length modal from active, inactive, and mixed eligible existing selections and validates values below 1', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: courseLengthEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: courseLengthEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await clearRowSelectionByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await selectRowByKey(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await page.getByRole('button', { name: 'Set course length' }).click();

    await expect(page.getByRole('dialog', { name: 'Set course length' })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Course length' }).fill('0');
    await page.getByRole('dialog', { name: 'Set course length' }).getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Course length must be an integer greater than or equal to 1.')).toBeVisible();
  });

  test('keeps the course-length modal open, refreshes successful rows, and reselects only failed rows after a partial failure', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: courseLengthEligibleClassPartials },
        { kind: 'success', data: courseLengthPartialsAfterPartialFailure },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: courseLengthEligibleGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectRowByKey(page, 'gc-active');
    await selectRowByKey(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set course length' }).click();
    await page.getByRole('spinbutton', { name: 'Course length' }).fill('40');
    await page.getByRole('dialog', { name: 'Set course length' }).getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('dialog', { name: 'Set course length' })).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getRow(page, 'gc-active')).toContainText('40');
    await expect(getRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps bulk course-length disabled for notCreated and orphaned selections', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: courseLengthEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: courseLengthEligibleGoogleClassrooms,
      }),
    );

    await selectRowByKey(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeDisabled();

    await clearRowSelectionByKey(page, 'gc-not-created');
    await selectRowByKey(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeDisabled();
  });
});
