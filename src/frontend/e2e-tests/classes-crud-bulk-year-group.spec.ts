import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';
import {
  bulkYearGroupEligibleClassPartials,
  bulkMetadataGoogleClassrooms,
  clearClassesCrudRowSelection,
  getClassesCrudRow,
  selectClassesCrudRow,
} from './helpers/classes-crud-bulk-metadata';
import { openBulkMetadataDialog } from './helpers/classes-crud-bulk-eligibility-journey';

const yearGroupPartialsAfterPartialFailure = [
  {
    ...bulkYearGroupEligibleClassPartials[0],
    yearGroupKey: 'year-8',
  },
  bulkYearGroupEligibleClassPartials[1],
  bulkYearGroupEligibleClassPartials[2],
] as const;

test.describe('Classes CRUD bulk year-group flow', () => {
  test('opens the bulk year-group modal from active, inactive, and mixed eligible existing selections', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkYearGroupEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await openBulkMetadataDialog(page, 'Set year group', 'Set year group');
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await expect(page.getByRole('option', { name: 'Year 7' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Year 8' })).toBeVisible();
  });

  test('hands off partial year-group updates to the summary alert, refreshes successful rows, and reselects only failed rows', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      hasScriptAuthorisation: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: bulkYearGroupEligibleClassPartials },
        { kind: 'success', data: yearGroupPartialsAfterPartialFailure },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set year group' }).click();
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await page.getByRole('option', { name: 'Year 8' }).click();
    await page
      .getByRole('dialog', { name: 'Set year group' })
      .getByRole('button', { name: 'OK' })
      .click();

    await expect(page.getByRole('dialog', { name: 'Set year group' })).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not updated.')).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getClassesCrudRow(page, 'gc-active')).toContainText('Year 8');
    await expect(getClassesCrudRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getClassesCrudRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps the year-group modal open with inline feedback when all selected updates fail', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      hasScriptAuthorisation: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: bulkYearGroupEligibleClassPartials }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
      updateABClass: [
        { kind: 'failureEnvelope', message: 'First update failed.' },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set year group' }).click();
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await page.getByRole('option', { name: 'Year 8' }).click();
    await page
      .getByRole('dialog', { name: 'Set year group' })
      .getByRole('button', { name: 'OK' })
      .click();

    await expect(page.getByRole('dialog', { name: 'Set year group' })).toBeVisible();
    await expect(
      page.getByText(
        'Unable to update any of the 2 selected classes. Please review the remaining selection and try again.'
      )
    ).toBeVisible();
    await expect(page.getByText('Some selected classes were not updated.')).toHaveCount(0);
  });

  test('keeps bulk year-group disabled for notCreated and orphaned selections', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkYearGroupEligibleClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await selectClassesCrudRow(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeDisabled();

    await clearClassesCrudRowSelection(page, 'gc-not-created');
    await selectClassesCrudRow(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set year group' })).toBeDisabled();
  });
});
