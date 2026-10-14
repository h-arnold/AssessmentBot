import { expect, test } from '@playwright/test';
import {
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';
import {
  bulkMetadataClassPartials,
  bulkMetadataGoogleClassrooms,
  clearClassesCrudRowSelection,
  getClassesCrudRow,
  selectClassesCrudRow,
} from './helpers/classes-crud-bulk-metadata';
import { openBulkMetadataDialog } from './helpers/classes-crud-bulk-eligibility-journey';

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
    ...bulkMetadataClassPartials[0],
    cohortKey: 'cohort-2025',
  },
  bulkMetadataClassPartials[1],
  bulkMetadataClassPartials[2],
] as const;

test.describe('Classes CRUD bulk cohort flow', () => {
  test('opens the bulk cohort modal from active, inactive, and mixed eligible existing selections and shows active cohorts only', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkMetadataClassPartials,
        cohorts: bulkCohortOptions,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await openBulkMetadataDialog(page, 'Set cohort', 'Set cohort');
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await expect(page.getByRole('option', { name: 'Cohort 2024' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cohort 2025' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cohort 2023' })).toHaveCount(0);
  });

  test('hands off partial cohort updates to the summary alert, refreshes successful rows, and reselects only failed rows', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      hasScriptAuthorisation: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: bulkMetadataClassPartials },
        { kind: 'success', data: cohortPartialsAfterPartialFailure },
      ],
      getCohorts: [{ kind: 'success', data: bulkCohortOptions }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set cohort' }).click();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2025' }).click();
    await page
      .getByRole('dialog', { name: 'Set cohort' })
      .getByRole('button', { name: 'OK' })
      .click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not updated.')).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getClassesCrudRow(page, 'gc-active')).toContainText('Cohort 2025');
    await expect(getClassesCrudRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getClassesCrudRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps the cohort modal open with inline feedback when all selected updates fail', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      hasScriptAuthorisation: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: bulkMetadataClassPartials }],
      getCohorts: [{ kind: 'success', data: bulkCohortOptions }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
      updateABClass: [
        { kind: 'failureEnvelope', message: 'First update failed.' },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set cohort' }).click();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2025' }).click();
    await page
      .getByRole('dialog', { name: 'Set cohort' })
      .getByRole('button', { name: 'OK' })
      .click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toBeVisible();
    await expect(
      page.getByText(
        'Unable to update any of the 2 selected classes. Please review the remaining selection and try again.'
      )
    ).toBeVisible();
    await expect(page.getByText('Some selected classes were not updated.')).toHaveCount(0);
  });

  test('keeps bulk cohort disabled for notCreated and orphaned selections', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkMetadataClassPartials,
        cohorts: bulkCohortOptions,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await selectClassesCrudRow(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeDisabled();

    await clearClassesCrudRowSelection(page, 'gc-not-created');
    await selectClassesCrudRow(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
  });
});
