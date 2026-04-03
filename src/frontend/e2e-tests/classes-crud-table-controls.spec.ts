import { expect, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
} from './classes-crud.shared';
import type { ClassPartial } from '../src/services/classPartials.zod';
import type { GoogleClassroom } from '../src/services/googleClassrooms.zod';

const matchedGoogleClassrooms: GoogleClassroom[] = [
  { classId: 'gc-class-201', className: 'English Year 7C' },
  { classId: 'gc-class-202', className: 'History Year 8D' },
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

test.describe('Classes CRUD table controls', () => {
  test('filters to active rows and reset returns full deterministic row set', async ({
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

    await page.getByRole('button', { name: 'Class name' }).click();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(2);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(2);
  });

  test('toolbar remains delete-only for orphaned selection and mixed orphaned selection', async ({
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
              classId: 'orphaned-legacy-1',
              className: 'Legacy One',
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
