import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
  padClassesCrudReadQueues,
} from './classes-crud.shared';
import {
  bulkMetadataClassPartials,
  bulkMetadataGoogleClassrooms,
  clearClassesCrudRowSelection,
  getClassesCrudRow,
  selectClassesCrudRow,
} from './helpers/classes-crud-bulk-metadata';

const courseLengthPartialsAfterPartialFailure = [
  {
    ...bulkMetadataClassPartials[0],
    courseLength: 40,
  },
  bulkMetadataClassPartials[1],
  bulkMetadataClassPartials[2],
] as const;

test.describe('Classes CRUD bulk course-length flow', () => {
  test('opens the bulk course-length modal from active, inactive, and mixed eligible existing selections and validates values below 1', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkMetadataClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await selectClassesCrudRow(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await clearClassesCrudRowSelection(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await selectClassesCrudRow(page, 'gc-active');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeEnabled();

    await page.getByRole('button', { name: 'Set course length' }).click();

    await expect(page.getByRole('dialog', { name: 'Set course length' })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Course length' }).fill('0');
    const courseLengthOkButton = page
      .getByRole('dialog', { name: 'Set course length' })
      .getByRole('button', { name: 'OK' });
    await expect(courseLengthOkButton).toBeEnabled();
    await courseLengthOkButton.click();
    await expect(
      page.getByText('Course length must be an integer greater than or equal to 1.')
    ).toBeVisible();
  });

  test('hands off partial course-length updates to the summary alert, refreshes successful rows, and reselects only failed rows', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      padClassesCrudReadQueues({
        hasScriptAuthorisation: [{ kind: 'success', data: true }],
        getABClassPartials: [
          { kind: 'success', data: bulkMetadataClassPartials },
          { kind: 'success', data: courseLengthPartialsAfterPartialFailure },
        ],
        getCohorts: [{ kind: 'success', data: baseCohorts }],
        getYearGroups: [{ kind: 'success', data: baseYearGroups }],
        getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
        updateABClass: [
          { kind: 'success', data: { ok: true } },
          { kind: 'failureEnvelope', message: 'Second update failed.' },
        ],
      })
    );

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set course length' }).click();
    await page.getByRole('spinbutton', { name: 'Course length' }).fill('40');
    const courseLengthOkButton = page
      .getByRole('dialog', { name: 'Set course length' })
      .getByRole('button', { name: 'OK' });
    await expect(courseLengthOkButton).toBeEnabled();
    await courseLengthOkButton.click();

    await expect(page.getByRole('dialog', { name: 'Set course length' })).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not updated.')).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(getClassesCrudRow(page, 'gc-active')).toContainText('40');
    await expect(getClassesCrudRow(page, 'gc-active').getByRole('checkbox')).not.toBeChecked();
    await expect(getClassesCrudRow(page, 'gc-inactive').getByRole('checkbox')).toBeChecked();
  });

  test('keeps the course-length modal open with inline feedback when all selected updates fail', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      padClassesCrudReadQueues({
        hasScriptAuthorisation: [{ kind: 'success', data: true }],
        getABClassPartials: [{ kind: 'success', data: bulkMetadataClassPartials }],
        getCohorts: [{ kind: 'success', data: baseCohorts }],
        getYearGroups: [{ kind: 'success', data: baseYearGroups }],
        getGoogleClassrooms: [{ kind: 'success', data: bulkMetadataGoogleClassrooms }],
        updateABClass: [
          { kind: 'failureEnvelope', message: 'First update failed.' },
          { kind: 'failureEnvelope', message: 'Second update failed.' },
        ],
      })
    );

    await selectClassesCrudRow(page, 'gc-active');
    await selectClassesCrudRow(page, 'gc-inactive');
    await page.getByRole('button', { name: 'Set course length' }).click();
    await page.getByRole('spinbutton', { name: 'Course length' }).fill('40');
    const courseLengthOkButton = page
      .getByRole('dialog', { name: 'Set course length' })
      .getByRole('button', { name: 'OK' });
    await expect(courseLengthOkButton).toBeEnabled();
    await courseLengthOkButton.click();

    await expect(page.getByRole('dialog', { name: 'Set course length' })).toBeVisible();
    await expect(
      page.getByText(
        'Unable to update any of the 2 selected classes. Please review the remaining selection and try again.'
      )
    ).toBeVisible();
    await expect(page.getByText('Some selected classes were not updated.')).toHaveCount(0);
  });

  test('keeps bulk course-length disabled for notCreated and orphaned selections', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: bulkMetadataClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: bulkMetadataGoogleClassrooms,
      })
    );

    await selectClassesCrudRow(page, 'gc-not-created');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeDisabled();

    await clearClassesCrudRowSelection(page, 'gc-not-created');
    await selectClassesCrudRow(page, 'orphaned-legacy');
    await expect(page.getByRole('button', { name: 'Set course length' })).toBeDisabled();
  });
});
