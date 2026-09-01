import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const migratedAssignmentRows = [
  {
    primaryTitle: 'Algebra foundations',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 1,
    definitionKey: 'alg-10-safe',
    tasks: [],
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    primaryTitle: 'Unsafe legacy row',
    primaryTopic: 'Legacy',
    primaryTopicKey: 'topic-legacy',
    yearGroupKey: 'year-group-unknown',
    yearGroupLabel: '—',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-2',
    templateDocumentId: 'tpl-2',
    assignmentWeighting: null,
    definitionKey: 'unsafe/legacy-key',
    tasks: [],
    createdAt: '2025-01-16T08:00:00.000Z',
    updatedAt: null,
  },
] as const;

/**
 * Installs mocked assignments runtime responses for the migration journey.
 *
 * @param {Page} page Playwright page instance.
 * @returns {Promise<void>} Resolves after init script registration.
 */
async function mockAssignmentsRuntime(page: Page) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const responseQueues = {
        getAuthorisationStatus: [{ kind: 'success', data: true }],
        getABClassPartials: [{ kind: 'success', data: [] }],
         getCohorts: [{ kind: 'success', data: [] }],
         getYearGroups: [{ kind: 'success', data: [] }],
         getAssignmentTopics: [{ kind: 'success', data: [] }],
        getAssignmentDefinitionPartials: [{ kind: 'success', data: ${JSON.stringify(migratedAssignmentRows)} }],
        deleteAssignmentDefinition: [],
      };
      const callCounts = {
        getAuthorisationStatus: 0,
        getABClassPartials: 0,
         getCohorts: 0,
         getYearGroups: 0,
         getAssignmentTopics: 0,
         getAssignmentDefinitionPartials: 0,
        deleteAssignmentDefinition: 0,
      };

      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-' + method + '-' + responseIndex,
          data,
        });
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (!(method in responseQueues)) {
              callbacks.failureHandler?.(new Error('Unexpected call to method: ' + String(method)));
              return;
            }

            const responseIndex = callCounts[method];
            const response = responseQueues[method][responseIndex];
            callCounts[method] += 1;

            if (response === undefined) {
              callbacks.failureHandler?.(
                new Error('Unexpected call index for method ' + method + ': ' + String(responseIndex))
              );
              return;
            }

            sendSuccess(callbacks, method, responseIndex, response.data);
          }),
        },
      };
    })();
  `);
}

/**
 * Applies one assignments table filter option.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} columnHeaderName Table column header label.
 * @param {string} optionLabel Filter option label.
 * @returns {Promise<void>} Resolves when the option is selected.
 */
async function applyAssignmentsFilterOption(
  page: Page,
  columnHeaderName: string,
  optionLabel: string
) {
  await page.getByRole('columnheader', { name: columnHeaderName }).getByRole('button').click();

  const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
  await expect(activeFilterPopup).toBeVisible();
  await activeFilterPopup.getByText(optionLabel, { exact: true }).click();

  await page.keyboard.press('Escape');
}

/**
 * Returns the assignments table row locator for one exact title.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} assignmentTitle Exact assignment title text.
 * @returns {import('@playwright/test').Locator} Matching row locator.
 */
function getAssignmentsRowByTitle(page: Page, assignmentTitle: string) {
  const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
  const titleCell = assignmentsTable
    .locator('tbody tr td:first-child')
    .getByText(assignmentTitle, { exact: true });

  return titleCell.locator('xpath=ancestor::tr');
}

test('assignments year-group label migration keeps delete, create, and update actions available', async ({
  page,
}) => {
  await mockAssignmentsRuntime(page);

  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();

  const row = getAssignmentsRowByTitle(page, 'Algebra foundations');
  await expect(row.getByRole('cell', { name: 'Year 10' })).toBeVisible();

  await applyAssignmentsFilterOption(page, 'Year group', 'Year 10');
  await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(1);
  await expect(getAssignmentsRowByTitle(page, 'Unsafe legacy row')).toHaveCount(0);

  await expect(row.getByRole('button', { name: /delete/i })).toBeEnabled();
  await expect(row.getByRole('button', { name: /update/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Create assignment' })).toBeEnabled();
});
