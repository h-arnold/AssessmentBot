import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  matchedClassPartials,
  openClassesTabWithScenario,
} from './classes-crud.shared';
import type { GoogleClassroom } from '../src/services/googleClassrooms.zod';

const rowCountForAllStatuses = 4;
const extendedGoogleClassrooms: GoogleClassroom[] = [
  { classId: 'gc-class-201', className: 'English Year 7C' },
  { classId: 'gc-class-202', className: 'History Year 8D' },
  { classId: 'gc-class-303', className: 'Geography Year 7E' },
];

test.describe('Classes CRUD table interactions', () => {
  test('renders representative rows for active, inactive, notCreated, and orphaned statuses', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: matchedClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: extendedGoogleClassrooms,
      }),
      getABClassPartials: [
        {
          kind: 'success',
          data: [
            ...matchedClassPartials,
            {
              ...matchedClassPartials[0],
              classId: 'legacy-orphaned',
              className: 'Legacy Orphaned Class',
            },
          ],
        },
      ],
    });

    await expect(page.getByRole('table', { name: 'Classes table' })).toBeVisible();
    await expect(page.locator('tbody td').filter({ hasText: /^active$/ }).first()).toBeVisible();
    await expect(page.locator('tbody td').filter({ hasText: /^inactive$/ }).first()).toBeVisible();
    await expect(page.locator('tbody td').filter({ hasText: /^notCreated$/ }).first()).toBeVisible();
    await expect(page.locator('tbody td').filter({ hasText: /^orphaned$/ }).first()).toBeVisible();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(rowCountForAllStatuses);
  });

  test('preserves classId as row key and resets deterministic sort order after controls usage', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: matchedClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: extendedGoogleClassrooms,
      })
    );

    const initialRowKey = await page
      .locator('tbody tr[data-row-key]')
      .first()
      .getAttribute('data-row-key');
    expect(initialRowKey).not.toBeNull();

    await page.getByRole('button', { name: 'Class name' }).click();
    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(rowCountForAllStatuses - 1);
    await expect(page.locator('tbody tr[data-row-key]').first()).toHaveAttribute(
      'data-row-key',
      initialRowKey ?? ''
    );
  });
});
