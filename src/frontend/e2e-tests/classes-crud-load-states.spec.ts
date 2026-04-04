import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseCohorts,
  baseGoogleClassrooms,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

test.describe('Classes CRUD load states', () => {
  test('shows blocking classes error when startup warm-up datasets fail', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: baseGoogleClassrooms,
      }),
      getABClassPartials: [{ kind: 'transportFailure', message: 'class partials failed' }],
    });

    await expect(page.getByText('Classes feature is unavailable.')).toBeVisible();
    await expect(page.getByText('Unable to load active Google Classrooms right now.')).toBeVisible();
  });

  test('shows no-active-classrooms empty state when all datasets are empty', async ({
    page,
  }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: [],
        cohorts: [],
        yearGroups: [],
        googleClassrooms: [],
      })
    );

    await expect(page.getByText('No active Google Classrooms are available.')).toBeVisible();
  });

  test('keeps ready shell visible when all classes datasets load', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: baseGoogleClassrooms,
      })
    );

    await expect(page.getByText('Summary')).toBeVisible();
    await expect(page.getByText('Bulk actions')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Classes table' })).toBeVisible();
  });

  test('shows blocking classes error when Google Classrooms query fails', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: baseGoogleClassrooms,
      }),
      getGoogleClassrooms: [
        { kind: 'failureEnvelope', code: 'GOOGLE_API_ERROR', message: 'Google fetch failed.' },
      ],
    });
    await expect(page.getByText('Classes feature is unavailable.')).toBeVisible();
    await expect(page.getByText('Unable to load active Google Classrooms right now.')).toBeVisible();
  });
});
