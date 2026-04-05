import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const workstreamThreeClassPartials = [
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
    cohortKey: 'cohort-2023',
    cohortLabel: 'Cohort 2023',
    courseLength: 25,
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

const expectedWorkstreamThreeRowCount = 4;

const workstreamThreeGoogleClassrooms = [
  { classId: 'gc-active', className: 'Alpha Active' },
  { classId: 'gc-inactive', className: 'Beta Inactive' },
  { classId: 'gc-not-created', className: 'Gamma Not Created' },
] as const;

/**
 * Reads visible table row keys in rendered order.
 *
 * @param {Page} page Playwright page.
 * @returns {Promise<string[]>} Row keys.
 */
async function getVisibleRowKeys(page: Page): Promise<string[]> {
  return page.locator('tbody tr[data-row-key]').evaluateAll((rows) =>
    rows
      .map((row) => row instanceof HTMLElement ? row.dataset.rowKey ?? null : null)
      .filter((key): key is string => key !== null),
  );
}

/**
 * Opens a column filter dropdown.
 *
 * @param {Page} page Playwright page.
 * @param {string} columnName Column header label.
 * @returns {Promise<Locator>} Visible dropdown locator.
 */
async function openColumnFilter(page: Page, columnName: string): Promise<Locator> {
  const column = page.getByRole('columnheader', { name: columnName });
  await column.locator('.ant-table-filter-trigger').click();
  return page.locator('.ant-dropdown:visible').last();
}

/**
 * Applies a single option filter for the given column.
 *
 * @param {Page} page Playwright page.
 * @param {string} columnName Column header label.
 * @param {string} optionLabel Filter option label.
 * @returns {Promise<void>} Completion signal.
 */
async function applyColumnFilter(
  page: Page,
  columnName: string,
  optionLabel: string,
): Promise<void> {
  const dropdown = await openColumnFilter(page, columnName);
  await dropdown.getByRole('menuitem', { name: optionLabel, exact: true }).click();
  await page.keyboard.press('Escape');
}

test.describe('Classes CRUD table controls', () => {
  test('supports deterministic filtering and sorting across workstream 3 columns with deterministic reset', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: workstreamThreeClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: workstreamThreeGoogleClassrooms,
      }),
    );

    await expect(page.locator('tbody tr[data-row-key]')).toHaveCount(expectedWorkstreamThreeRowCount);
    await expect(await getVisibleRowKeys(page)).toEqual([
      'gc-active',
      'gc-inactive',
      'gc-not-created',
      'orphaned-legacy',
    ]);

    await applyColumnFilter(page, 'Status', 'active');
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-active']);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await applyColumnFilter(page, 'Cohort', 'Cohort 2023');
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-inactive', 'orphaned-legacy']);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await applyColumnFilter(page, 'Course length', '30');
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-active']);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await applyColumnFilter(page, 'Year group', 'Year 8');
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-inactive', 'orphaned-legacy']);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await applyColumnFilter(page, 'Active', 'Yes');
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-active']);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await page.getByRole('columnheader', { name: 'Class name' }).click();
    await expect(await getVisibleRowKeys(page)).toEqual([
      'gc-active',
      'gc-inactive',
      'gc-not-created',
      'orphaned-legacy',
    ]);

    await page.getByRole('columnheader', { name: 'Class name' }).click();
    await expect(await getVisibleRowKeys(page)).toEqual([
      'orphaned-legacy',
      'gc-not-created',
      'gc-inactive',
      'gc-active',
    ]);

    await page.getByRole('button', { name: 'Reset sort and filters' }).click();
    await expect(await getVisibleRowKeys(page)).toEqual([
      'gc-active',
      'gc-inactive',
      'gc-not-created',
      'orphaned-legacy',
    ]);

    await applyColumnFilter(page, 'Status', 'inactive');
    await page.getByRole('columnheader', { name: 'Class name' }).click();
    await expect(await getVisibleRowKeys(page)).toEqual(['gc-inactive']);
  });

  test('toolbar remains delete-only for orphaned selection and mixed orphaned selection', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: workstreamThreeClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: workstreamThreeGoogleClassrooms,
      }),
      getABClassPartials: [
        {
          kind: 'success',
          data: [
            ...workstreamThreeClassPartials,
            {
              ...workstreamThreeClassPartials[0],
              classId: 'orphaned-legacy-2',
              className: 'Legacy Two',
            },
          ],
        },
      ],
    });

    await page
      .locator('tbody tr[data-row-key]')
      .filter({ hasText: 'orphaned' })
      .getByRole('checkbox')
      .first()
      .check();
    await page
      .locator('tbody tr[data-row-key]')
      .filter({ hasText: 'active' })
      .first()
      .getByRole('checkbox')
      .check();
    await expect(page.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    await expect(
      page.getByText('Mixed selection includes orphaned rows. Delete is the only allowed bulk action.'),
    ).toBeVisible();
  });
});
