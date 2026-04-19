import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

type AssignmentsResponseScenario = Readonly<
  | {
      kind: 'success';
      data: unknown;
    }
  | {
      kind: 'transportFailure';
      message: string;
    }
  | {
      kind: 'failureEnvelope';
      code?: string;
      message: string;
    }
  | {
      kind: 'deferredSuccess';
      data: unknown;
    }
>;

type AssignmentsRuntimeScenario = Readonly<{
  getAssignmentDefinitionPartials: ReadonlyArray<AssignmentsResponseScenario>;
  deleteAssignmentDefinition?: ReadonlyArray<AssignmentsResponseScenario>;
}>;

const assignmentRows = [
  {
    primaryTitle: 'Newest algebra recap',
    primaryTopic: 'Algebra',
    courseId: 'course-1',
    yearGroup: 11,
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 20,
    definitionKey: 'newest-safe',
    tasks: null,
    createdAt: '2025-02-01T08:00:00.000Z',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
  {
    primaryTitle: 'Algebra foundations',
    primaryTopic: 'Algebra',
    courseId: 'course-2',
    yearGroup: 10,
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-2',
    templateDocumentId: 'tpl-2',
    assignmentWeighting: 30,
    definitionKey: 'alg-10-safe',
    tasks: null,
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    primaryTitle: 'Algebra foundations archive',
    primaryTopic: 'Algebra',
    courseId: 'course-3',
    yearGroup: 10,
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-3',
    templateDocumentId: 'tpl-3',
    assignmentWeighting: 10,
    definitionKey: 'archive-safe',
    tasks: null,
    createdAt: '2025-01-17T08:00:00.000Z',
    updatedAt: '2025-01-17T08:00:00.000Z',
  },
  {
    primaryTitle: 'Unsafe legacy row',
    primaryTopic: 'Legacy',
    courseId: 'course-4',
    yearGroup: null,
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-4',
    templateDocumentId: 'tpl-4',
    assignmentWeighting: null,
    definitionKey: 'unsafe/legacy-key',
    tasks: null,
    createdAt: '2025-01-18T08:00:00.000Z',
    updatedAt: null,
  },
] as const;

const expectedNullTokenCellCount = 2;
const newestRowIndex = 0;
const archiveRowIndex = 1;
const exactMatchRowIndex = 2;

/**
 * Installs a browser-side `google.script.run` mock for assignments journeys.
 *
 * @param {Page} page The Playwright page under test.
 * @param {AssignmentsRuntimeScenario} scenario The per-method response queue scenario.
 * @returns {Promise<void>} Resolves once the init script is installed.
 */
async function mockAssignmentsRuntime(page: Page, scenario: AssignmentsRuntimeScenario) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};
      const responseQueues = {
        getAuthorisationStatus: [{ kind: 'success', data: true }],
        getABClassPartials: [{ kind: 'success', data: [] }],
        getCohorts: [{ kind: 'success', data: [] }],
        getYearGroups: [{ kind: 'success', data: [] }],
        getAssignmentDefinitionPartials: scenario.getAssignmentDefinitionPartials,
        deleteAssignmentDefinition: scenario.deleteAssignmentDefinition ?? [],
      };
      const callCounts = {
        getAuthorisationStatus: 0,
        getABClassPartials: 0,
        getCohorts: 0,
        getYearGroups: 0,
        getAssignmentDefinitionPartials: 0,
        deleteAssignmentDefinition: 0,
      };
      globalThis.__assignmentsMethodCalls = [];
      globalThis.__assignmentDeferredSuccessQueue = [];
      globalThis.__releaseNextAssignmentsDeferredSuccess = () => {
        const nextDeferredSuccess = globalThis.__assignmentDeferredSuccessQueue.shift();

        if (!nextDeferredSuccess) {
          throw new Error('No deferred success response available to release.');
        }

        nextDeferredSuccess();
      };

      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-' + method + '-' + responseIndex,
          data,
        });
      }

      function sendFailureEnvelope(callbacks, method, responseIndex, response) {
        callbacks.successHandler?.({
          ok: false,
          requestId: 'req-' + method + '-' + responseIndex,
          error: {
            code: response.code ?? 'INTERNAL_ERROR',
            message: response.message,
            retriable: false,
          },
        });
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;
            globalThis.__assignmentsMethodCalls.push(String(method));

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

            if (response.kind === 'transportFailure') {
              callbacks.failureHandler?.(new Error(response.message));
              return;
            }

            if (response.kind === 'failureEnvelope') {
              sendFailureEnvelope(callbacks, method, responseIndex, response);
              return;
            }

            if (response.kind === 'deferredSuccess') {
              globalThis.__assignmentDeferredSuccessQueue.push(() => {
                sendSuccess(callbacks, method, responseIndex, response.data);
              });
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
 * Applies one assignments table filter option using visible controls only.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} columnHeaderName Column header label.
 * @param {string} optionLabel Visible filter option label.
 * @returns {Promise<void>} Resolves when the option is selected.
 */
async function applyAssignmentsFilterOption(page: Page, columnHeaderName: string, optionLabel: string) {
  await page.getByRole('columnheader', { name: columnHeaderName }).getByRole('button').click();

  const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
  await expect(activeFilterPopup).toBeVisible();
  await activeFilterPopup.getByText(optionLabel, { exact: true }).click();

  await page.keyboard.press('Escape');
}

/**
 * Releases the next deferred assignments API success response.
 *
 * @param {Page} page Playwright page instance.
 * @returns {Promise<void>} Resolves once the deferred response has been released.
 */
async function releaseNextDeferredAssignmentsSuccess(page: Page) {
  await page.evaluate(() => {
    (globalThis as { __releaseNextAssignmentsDeferredSuccess: () => void }).__releaseNextAssignmentsDeferredSuccess();
  });
}

/**
 * Locates one assignments table row by exact title cell text.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} assignmentTitle Exact assignment title shown in the first column.
 * @returns {import('@playwright/test').Locator} Row locator scoped to the assignments table.
 */
function getAssignmentsRowByTitle(page: Page, assignmentTitle: string) {
  const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
  const titleCell = assignmentsTable
    .locator('tbody tr td:first-child')
    .getByText(assignmentTitle, { exact: true });

  return titleCell.locator('xpath=ancestor::tr');
}

test.describe('assignments page browser journeys', () => {
  test('delete flow removes the row after confirmation and shows success feedback', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: assignmentRows },
        { kind: 'success', data: assignmentRows.filter((row) => row.definitionKey !== 'alg-10-safe') },
      ],
      deleteAssignmentDefinition: [{ kind: 'success', data: undefined }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete definition' }).click();

    await expect(page.getByText(/assignment definition deleted/i)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete assignment definition' })).toHaveCount(0);
    await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(0);
  });

  test('unsafe-key rows keep delete disabled', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [{ kind: 'success', data: assignmentRows }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    await expect(
      page.getByRole('row', { name: /unsafe legacy row/i }).getByRole('button', { name: /delete/i })
    ).toBeDisabled();
  });


  test('placeholder create and update actions stay disabled with explicit unavailable copy', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [{ kind: 'success', data: assignmentRows }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Update assignment' })).toBeDisabled();
    await expect(page.getByText(/not available in v1/i)).toBeVisible();
  });


  test('delete action opens confirmation modal with permanent-delete copy', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [{ kind: 'success', data: assignmentRows }],
      deleteAssignmentDefinition: [{ kind: 'success', data: undefined }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog', { name: 'Delete assignment definition' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('Algebra foundations', { exact: true })).toBeVisible();
    await expect(deleteDialog.getByText(/this delete is permanent/i)).toBeVisible();
  });

  test('delete mutation keeps confirm loading and disables conflicting delete actions until settle', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: assignmentRows },
        { kind: 'success', data: assignmentRows.filter((row) => row.definitionKey !== 'alg-10-safe') },
      ],
      deleteAssignmentDefinition: [{ kind: 'deferredSuccess', data: undefined }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete definition' }).click();

    const confirmDeleteButton = page.getByRole('button', { name: 'Delete definition' });
    await expect(confirmDeleteButton).toBeDisabled();

    const rowDeleteButtons = page
      .getByRole('table', { name: 'Assignment definitions table' })
      .getByRole('button', { name: /delete/i });

    const rowDeleteButtonCount = await rowDeleteButtons.count();
    for (let index = 0; index < rowDeleteButtonCount; index += 1) {
      await expect(rowDeleteButtons.nth(index)).toBeDisabled();
    }

    await releaseNextDeferredAssignmentsSuccess(page);

    await expect(page.getByText(/assignment definition deleted/i)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete assignment definition' })).toHaveCount(0);
  });

  test('delete failure keeps row visible and shows local error feedback', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [{ kind: 'success', data: assignmentRows }],
      deleteAssignmentDefinition: [{ kind: 'transportFailure', message: 'delete failed' }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete definition' }).click();

    await expect(page.getByText(/could not delete assignment definition/i)).toBeVisible();
    await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(1);
  });

  test('post-delete refresh failure returns to blocking state', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: assignmentRows },
        { kind: 'transportFailure', message: 'refresh failed after delete' },
      ],
      deleteAssignmentDefinition: [{ kind: 'success', data: undefined }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete definition' }).click();

    await expect(page.getByText(/assignment definitions could not be trusted or loaded/i)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Assignment definitions table' })).toHaveCount(0);
  });

  test('retry action performs scoped assignment-definition refetch only', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [
        { kind: 'transportFailure', message: 'assignment fetch failed' },
        { kind: 'success', data: assignmentRows },
      ],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();
    await expect(page.getByRole('button', { name: /retry|refresh assignments data/i })).toBeVisible();

    const baselineCallCount = await page.evaluate(() => {
      const methodCalls = (globalThis as { __assignmentsMethodCalls: string[] }).__assignmentsMethodCalls;
      return methodCalls.length;
    });

    await page.getByRole('button', { name: /retry|refresh assignments data/i }).click();

    await expect
      .poll(async () => {
        return page.evaluate((startIndex) => {
          const methodCalls = (globalThis as { __assignmentsMethodCalls: string[] }).__assignmentsMethodCalls;
          return methodCalls.slice(startIndex);
        }, baselineCallCount);
      })
      .toEqual(['getAssignmentDefinitionPartials']);
  });

  test('filter and reset interactions cover every displayed data column', async ({ page }) => {
    await mockAssignmentsRuntime(page, {
      getAssignmentDefinitionPartials: [{ kind: 'success', data: assignmentRows }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const unsafeRow = page.getByRole('row', { name: /unsafe legacy row/i });
    await expect(unsafeRow.getByRole('cell', { name: '—' })).toHaveCount(expectedNullTokenCellCount);

    const filterAssertions = [
      {
        columnHeaderName: 'Title',
        optionLabel: 'Algebra foundations',
        expectedVisibleRow: 'Algebra foundations',
        expectedHiddenRow: 'Newest algebra recap',
      },
      {
        columnHeaderName: 'Topic',
        optionLabel: 'Legacy',
        expectedVisibleRow: 'Unsafe legacy row',
        expectedHiddenRow: 'Algebra foundations archive',
      },
      {
        columnHeaderName: 'Year group',
        optionLabel: '10',
        expectedVisibleRow: 'Algebra foundations archive',
        expectedHiddenRow: 'Unsafe legacy row',
      },
      {
        columnHeaderName: 'Year group',
        optionLabel: '—',
        expectedVisibleRow: 'Unsafe legacy row',
        expectedHiddenRow: 'Newest algebra recap',
      },
      {
        columnHeaderName: 'Document type',
        optionLabel: 'SLIDES',
        expectedVisibleRow: 'Newest algebra recap',
        expectedHiddenRow: 'Unsafe legacy row',
      },
      {
        columnHeaderName: 'Last updated',
        optionLabel: '16/01/2025',
        expectedVisibleRow: 'Algebra foundations',
        expectedHiddenRow: 'Unsafe legacy row',
      },
      {
        columnHeaderName: 'Last updated',
        optionLabel: '—',
        expectedVisibleRow: 'Unsafe legacy row',
        expectedHiddenRow: 'Newest algebra recap',
      },
    ] as const;

    for (const filterAssertion of filterAssertions) {
      await applyAssignmentsFilterOption(page, filterAssertion.columnHeaderName, filterAssertion.optionLabel);
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedVisibleRow)).toHaveCount(1);
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedHiddenRow)).toHaveCount(0);

      await page.getByRole('button', { name: 'Reset sort and filters' }).click();
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedHiddenRow)).toHaveCount(1);
    }

    await expect(page.locator('tbody tr td:first-child').nth(newestRowIndex)).toContainText('Newest algebra recap');
    await expect(page.locator('tbody tr td:first-child').nth(archiveRowIndex)).toContainText('Algebra foundations archive');
    await expect(page.locator('tbody tr td:first-child').nth(exactMatchRowIndex)).toContainText('Algebra foundations');
  });
});
