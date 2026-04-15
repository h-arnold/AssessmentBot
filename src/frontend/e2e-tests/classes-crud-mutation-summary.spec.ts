import { expect, test, type Page } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  matchedClassPartials,
  matchedGoogleClassrooms,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const classNameUnderTest = 'English Year 7C';

/**
 * Selects a data row by class name rather than the table header checkbox.
 *
 * @param {import('@playwright/test').Page} page Browser page under test.
 * @param {string} className Visible class name.
 * @returns {Promise<void>} Resolves when the row is selected.
 */
async function selectDataRow(page: Page, className: string) {
  const row = page.getByRole('row').filter({ hasText: className });
  await expect(row).toHaveCount(1);
  await row.getByRole('checkbox').check();
}

test.describe('mutation summary and refresh failure', () => {
  test('hands off a partial cohort update to the persistent summary alert and closes the modal', async ({ page }) => {
    const refreshedClassPartials = matchedClassPartials.map((classPartial, index) =>
      index === 0
        ? {
            ...classPartial,
            cohortKey: 'cohort-2025',
          }
        : classPartial,
    );
    const cohortOptions = [
      ...baseCohorts,
      {
        key: 'cohort-2025',
        name: 'Cohort 2025',
        active: true,
        startYear: 2025,
        startMonth: 9,
      },
    ];

    await openClassesTabWithScenario(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: matchedClassPartials },
        { kind: 'success', data: refreshedClassPartials },
      ],
      getCohorts: [{ kind: 'success', data: cohortOptions }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
      updateABClass: [
        { kind: 'success', data: { ok: true } },
        { kind: 'failureEnvelope', message: 'Second update failed.' },
      ],
    });

    await selectDataRow(page, 'English Year 7C');
    await selectDataRow(page, 'History Year 8D');

    await page.getByRole('button', { name: 'Set cohort' }).click();
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2025' }).click();
    await page.getByRole('dialog', { name: 'Set cohort' }).getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('dialog', { name: 'Set cohort' })).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not updated.')).toBeVisible();
    await expect(page.getByText(/selected classes could not be updated/i)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'English Year 7C' })).toContainText('Cohort 2025');
    await expect(page.getByRole('row').filter({ hasText: 'History Year 8D' }).getByRole('checkbox')).toBeChecked();
  });
  test('suppresses stale classes after a delete refresh failure and keeps the summary visible', async ({ page }) => {
    await openClassesTabWithScenario(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: matchedClassPartials },
        { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: 'Class partials refresh failed after delete.' },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      // Only the initial Google Classroom load is queued; the post-mutation refresh path must not refetch it.
      getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
      deleteABClass: [{ kind: 'success', data: { ok: true } }],
    });

    await selectDataRow(page, classNameUnderTest);

    await page.getByRole('button', { name: 'Delete ABClass' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('row').filter({ hasText: classNameUnderTest })).toHaveCount(0);
    await expect(page.getByText('Update succeeded but refresh is required.')).toBeVisible();
    await expect(page.getByText('The classes could not be refreshed right now. Please reload the page and try again.')).toBeVisible();
  });
});
