import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  matchedClassPartials,
  matchedGoogleClassrooms,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const deterministicRowCount = 2;

test.describe('Classes CRUD table controls', () => {
  test('filters to active rows and reset returns full deterministic row set', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: matchedClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: matchedGoogleClassrooms,
      })
    );

    await page.getByRole('button', { name: 'Class name' }).click();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(deterministicRowCount);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(deterministicRowCount);
  });

  test('toolbar remains delete-only for orphaned selection and mixed orphaned selection', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: matchedClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: matchedGoogleClassrooms,
      }),
      getABClassPartials: [
        {
          kind: 'success',
          data: [
            ...matchedClassPartials,
            {
              ...matchedClassPartials[0],
              classId: 'orphaned-legacy-1',
              className: 'Legacy One',
            },
          ],
        },
      ],
    });

    await page
      .locator('tbody tr[data-row-key]')
      .filter({ hasText: 'orphaned' })
      .getByRole('checkbox')
      .check();
    await page
      .locator('tbody tr[data-row-key]')
      .filter({ hasText: 'active' })
      .first()
      .getByRole('checkbox')
      .check();
    await expect(page.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    await expect(page.getByText('Mixed selection includes orphaned rows. Delete is the only allowed bulk action.')).toBeVisible();
  });
});
