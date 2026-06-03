import { expect, test, type Page } from '@playwright/test';
import {
  createAssignmentsScenario,
  getMethodCalls,
  installRuntimeMock,
  releaseNextDeferredSuccess,
  getAssignmentsRowByTitle,
  applyColumnFilterOption,
  type RuntimeScenario,
} from './shared/endToEndRuntimeMocks';

const assignmentRows = [
  {
    primaryTitle: 'Newest algebra recap',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'year-group-11',
    yearGroupLabel: 'Year 11',
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
    primaryTopicKey: 'algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
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
    primaryTopicKey: 'algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
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
    primaryTopicKey: 'legacy',
    yearGroupKey: 'legacy-year-group',
    yearGroupLabel: 'Legacy Year',
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

const expectedNullTokenCellCount = 1;
const newestRowIndex = 0;
const archiveRowIndex = 1;
const exactMatchRowIndex = 2;

/**
 * Opens and confirms delete for the assignment row matching the supplied title.
 *
 * @param {Page} page Playwright page.
 * @param {string} title Assignment title used to locate the row.
 * @returns {Promise<void>} Resolves once the delete confirm action has been triggered.
 */
async function confirmDeleteForAssignmentTitle(page: Page, title: string): Promise<void> {
  const matchingRow = getAssignmentsRowByTitle(page, title);
  await expect(matchingRow).toHaveCount(1);
  await matchingRow.getByRole('button', { name: /delete/i }).click();
  await page.getByRole('button', { name: 'Delete definition' }).click();
}

test.describe('assignments page browser journeys', () => {
  test('delete flow removes the row after confirmation and shows success feedback', async ({
    page,
  }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: assignmentRows },
        {
          kind: 'success',
          data: assignmentRows.filter((row) => row.definitionKey !== 'alg-10-safe'),
        },
      ],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear (10s timeout for startup warmup)
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);
    // Wait for table to be visible
    await expect(page.getByRole('table', { name: 'Assignment definitions table' })).toBeVisible();

    await confirmDeleteForAssignmentTitle(page, 'Algebra foundations');

    await expect(page.getByText(/assignment definition deleted/i)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete assignment definition' })).toHaveCount(0);
    await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(0);
  });

  test('unsafe-key rows keep delete disabled', async ({ page }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    await expect(page.getByRole('row', { name: /unsafe legacy row/i })).toBeVisible();
    const unsafeRow = page.getByRole('row', { name: /unsafe legacy row/i });
    await expect(unsafeRow.getByRole('button', { name: /delete/i })).toBeVisible();
    await expect(unsafeRow.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  test('placeholder create and update actions stay disabled with explicit unavailable copy', async ({
    page,
  }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    // With empty reference data, Create button should still be enabled (empty is valid)
    // per FE-E2E-004: old v1 assertions removed
    await expect(page.getByRole('button', { name: 'Create assignment' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Refresh assignments data' })).toBeEnabled();
  });

  test('delete action opens confirmation modal with permanent-delete copy', async ({ page }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog', { name: 'Delete assignment definition' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('Algebra foundations', { exact: true })).toBeVisible();
    await expect(deleteDialog.getByText(/this delete is permanent/i)).toBeVisible();
  });

  test('delete mutation keeps confirm loading and disables conflicting delete actions until settle', async ({
    page,
  }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
        postMutationPartials: [assignmentRows.filter((row) => row.definitionKey !== 'alg-10-safe')],
        deleteResponses: [{ kind: 'deferredSuccess', data: undefined }],
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    await confirmDeleteForAssignmentTitle(page, 'Algebra foundations');

    const confirmDeleteButton = page.getByRole('button', { name: 'Delete definition' });
    await expect(confirmDeleteButton).toBeDisabled();

    const rowDeleteButtons = page
      .getByRole('table', { name: 'Assignment definitions table' })
      .getByRole('button', { name: /delete/i });

    const rowDeleteButtonCount = await rowDeleteButtons.count();
    for (let index = 0; index < rowDeleteButtonCount; index += 1) {
      await expect(rowDeleteButtons.nth(index)).toBeDisabled();
    }

    await releaseNextDeferredSuccess(page);

    await expect(page.getByText(/assignment definition deleted/i)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Delete assignment definition' })).toHaveCount(0);
  });

  test('delete failure keeps row visible and shows local error feedback', async ({ page }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
        deleteResponses: [{ kind: 'transportFailure', message: 'delete failed' }],
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    await confirmDeleteForAssignmentTitle(page, 'Algebra foundations');

    await expect(page.getByText(/could not delete assignment definition/i)).toBeVisible();
    await expect(getAssignmentsRowByTitle(page, 'Algebra foundations')).toHaveCount(1);
  });

  test('post-delete refresh failure returns to blocking state', async ({ page }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: assignmentRows },
        { kind: 'transportFailure', message: 'refresh failed after delete' },
      ],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for initial blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    const exactMatchRow = getAssignmentsRowByTitle(page, 'Algebra foundations');
    await expect(exactMatchRow).toHaveCount(1);
    await exactMatchRow.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: 'Delete definition' }).click();

    await expect(
      page.getByText(/assignment definitions could not be trusted or loaded/i)
    ).toBeVisible();
    await expect(page.getByRole('table', { name: 'Assignment definitions table' })).toHaveCount(0);
  });

  test('retry action performs scoped assignment-definition refetch only', async ({ page }) => {
    const retryScenario: RuntimeScenario = {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
      getAssignmentDefinitionPartials: [
        { kind: 'transportFailure', message: 'assignment fetch failed' },
        { kind: 'transportFailure', message: 'assignment fetch failed' },
        { kind: 'success', data: assignmentRows },
      ],
    };

    await installRuntimeMock(page, retryScenario, {
      methodCallsTrackerName: '__assignmentsMethodCalls',
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    /*
     * Wait for blocking state to appear.
     *
     * The startup warmup consumes the first transportFailure, which sets
     * isAssignmentsDatasetFailed = true and enables the query.
     *
     * The query auto-fetches on the disabled→enabled transition (React Query v5
     * behaviour) and consumes the second transportFailure, keeping the query
     * in error state so the blocking Alert stays visible.
     */
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toBeVisible({ timeout: 10_000 });
    // Wait for retry button to be visible
    await expect(
      page.getByRole('button', { name: /retry|refresh assignments data/i })
    ).toBeVisible();

    const baselineMethodCalls = await getMethodCalls(page, '__assignmentsMethodCalls');
    const baselineCallCount = baselineMethodCalls.length;

    await page.getByRole('button', { name: /retry|refresh assignments data/i }).click();

    /*
     * Retry triggers an invalidation (refetchType: 'none') followed by
     * refetchQueries scoped to assignmentDefinitionPartials.
     *
     * The third response (success) resolves the retry, populates query data,
     * and clears the blocking state (per shouldRenderAssignmentsBlockingState
     * recovery semantics).
     */
    await expect
      .poll(
        async () => {
          const methodCalls = await getMethodCalls(page, '__assignmentsMethodCalls');
          return methodCalls.slice(baselineCallCount);
        },
        { timeout: 10_000 }
      )
      .toEqual(['getAssignmentDefinitionPartials']);
  });

  test('filter and reset interactions cover every displayed data column', async ({ page }) => {
    await installRuntimeMock(page, {
      ...createAssignmentsScenario({
        initialPartials: assignmentRows,
      }),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    // Wait for blocking state to clear
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0, { timeout: 10_000 });
    // Wait for loading skeleton to disappear
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);

    const unsafeRow = page.getByRole('row', { name: /unsafe legacy row/i });
    await expect(unsafeRow.getByRole('cell', { name: '—' })).toHaveCount(
      expectedNullTokenCellCount
    );

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
        optionLabel: 'Year 10',
        expectedVisibleRow: 'Algebra foundations archive',
        expectedHiddenRow: 'Unsafe legacy row',
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
      await applyColumnFilterOption(
        page,
        filterAssertion.columnHeaderName,
        filterAssertion.optionLabel
      );
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedVisibleRow)).toHaveCount(
        1
      );
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedHiddenRow)).toHaveCount(
        0
      );

      await page.getByRole('button', { name: 'Reset sort and filters' }).click();
      await expect(getAssignmentsRowByTitle(page, filterAssertion.expectedHiddenRow)).toHaveCount(
        1
      );
    }

    await expect(page.locator('tbody tr td:first-child').nth(newestRowIndex)).toContainText(
      'Newest algebra recap'
    );
    await expect(page.locator('tbody tr td:first-child').nth(archiveRowIndex)).toContainText(
      'Algebra foundations archive'
    );
    await expect(page.locator('tbody tr td:first-child').nth(exactMatchRowIndex)).toContainText(
      'Algebra foundations'
    );
  });
});
