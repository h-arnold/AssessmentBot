import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
} from './classes-crud.shared';
import type { ClassPartial } from '../src/services/classPartials.zod';
import type { GoogleClassroom } from '../src/services/googleClassrooms.zod';

const rowCountForAllStatuses = 4;
const matchedGoogleClassrooms: GoogleClassroom[] = [
  { classId: 'gc-class-201', className: 'English Year 7C' },
  { classId: 'gc-class-202', className: 'History Year 8D' },
  { classId: 'gc-class-303', className: 'Geography Year 7E' },
];
const matchedClassPartials: ClassPartial[] = [
  {
    classId: 'gc-class-201',
    className: 'English Year 7C',
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
    classId: 'gc-class-202',
    className: 'History Year 8D',
    cohortKey: 'cohort-2023',
    cohortLabel: 'Cohort 2023',
    courseLength: 25,
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    classOwner: null,
    teachers: [],
    active: false,
  },
];

test.describe('Classes CRUD table interactions', () => {
  test('renders representative rows for active, inactive, notCreated, and orphaned statuses', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
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
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
    });

    await page.goto('/');
    await openClassesTab(page);

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
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: matchedClassPartials }],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: matchedGoogleClassrooms }],
    });

    await page.goto('/');
    await openClassesTab(page);

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
