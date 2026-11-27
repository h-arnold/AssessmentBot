import { expect, test, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  getMethodCalls,
  selectVisibleOption,
  type RuntimeScenario,
} from '../shared/endToEndRuntimeMocks';
import {
  ALGEBRA_HOMEWORK_DATA,
  algebraHomeworkEntry,
  createAssessTaskScenario,
} from '../helpers/classes-page-end-to-end-helpers';
import {
  openAssessTaskModal,
  selectAssignmentAndStart,
} from '../helpers/classes-assess-task-journeys';

// ============================================================================
// Assess Task Modal — Playwright E2E Tests
// ============================================================================
//
// Tests covering the five modal states and user interactions.  Each test is
// independently runnable with its own scenario and mock install.
//
// React 19 StrictMode double-fires effects in development, which means the
// `useEffect` that fetches assignments runs twice per modal open.  All custom
// `getGoogleClassroomAssignments` queues below provide enough entries to cover
// both StrictMode replays.
//
// Card layout (Year 10 panel is expanded by the shared modal setup helper):
//   Card 0: English 10       (class-english-10)
//   Card 1: Mathematics 10A  (class-math-10a)

// ---------------------------------------------------------------------------
// Shared constants and helpers
// ---------------------------------------------------------------------------

/**
 * Opens the in-modal create review and changes its title so the wizard is dirty.
 *
 * @param {Page} page - Playwright page under test.
 * @returns {Promise<import('@playwright/test').Locator>} The owning modal dialog.
 */
async function openDirtyCreateReview(page: Page) {
  const scenario = createAssessTaskScenario({
    getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
  });
  await installRuntimeMock(page, scenario);
  const dialog = await openAssessTaskModal(page);

  await selectAssignmentAndStart(dialog, page);
  await dialog.getByRole('button', { name: 'Create New Definition' }).click();
  const title = dialog.getByRole('textbox', { name: /assignment title/i });
  await title.fill('Edited Algebra Homework');
  return page.getByRole('dialog', { name: /Assess Task —/ });
}

/**
 * Locates the nested discard confirmation without matching the owning modal.
 *
 * @param {Page} page - Playwright page under test.
 * @returns {import('@playwright/test').Locator} The discard confirmation dialog.
 */
function getDiscardConfirmationDialog(page: Page) {
  return page.locator('[role="dialog"][aria-labelledby="assignment-discard-confirm-title"]');
}

test.describe('Assess Task modal', () => {
  // ==========================================================================
  // Choice prompt and wizard tests
  // ==========================================================================

  test('shows choice prompt with Create New Definition and disabled Link to Existing button on no-match', async ({
    page,
  }) => {
    // Assignment must have topicId set for choice prompt to appear
    const assignmentEntry = {
      kind: 'success' as const,
      data: [
        ALGEBRA_HOMEWORK_DATA,
        {
          assignmentId: 'cw-2',
          title: 'Chapter 5 Review',
          topicId: null,
          topicName: null,
        },
      ],
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [assignmentEntry, assignmentEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Select assignment
    await dialog.getByTestId('assignment-select').click();
    await selectVisibleOption(page, 'Algebra Homework');

    // Click Start Assessment
    await dialog.getByRole('button', { name: 'Start Assessment' }).click();

    // Assert choice prompt
    await expect(dialog.getByText(/no matching assignment definition found/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeEnabled();
    await expect(
      dialog.getByRole('button', { name: 'Link to Existing Definition' })
    ).toBeDisabled();

    // Assert footer: only Cancel (no Start Assessment)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toHaveCount(0);
  });

  test('choice prompt Cancel button closes the modal', async ({ page }) => {
    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);

    // Verify choice prompt appeared
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();

    // Click Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Modal should close
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('"Create New Definition" opens in-modal create content with pre-populated title and year group', async ({
    page,
  }) => {
    // Mock data for topics
    const topicsData = [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['year-group-10'] },
    ];

    const scenario: RuntimeScenario = {
      ...createAssessTaskScenario({
        getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
      }),
      getAssignmentTopics: [
        { kind: 'success', data: topicsData },
        { kind: 'success', data: topicsData },
      ],
    };

    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);

    // Click Create New Definition
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // In-modal composition: the create content renders inside the single owning
    // dialog, so no stacked "Create assignment" modal appears.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: /create assignment/i })).toHaveCount(0);

    // Stage-one create content renders in the owning dialog with the assignment
    // title, topic and year group pre-populated from the selected assignment.
    await expect(dialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Algebra Homework'
    );
    await expect(dialog.getByRole('combobox', { name: /assignment topic/i })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: /assignment year group/i })).toBeVisible();
    // The selected values render as the option labels in the form region.
    await expect(dialog.getByText('Year 10', { exact: true })).toHaveCount(1);
    await expect(dialog.getByText('Algebra', { exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('textbox', { name: /reference document url/i })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /template document url/i })).toBeVisible();

    // The owning modal adopts the wide-data width token while create content is active.
    await expect(dialog).toHaveAttribute('style', /--app-modal-width-wide-data/);
  });

  test('cancelling in-modal create returns to the choice prompt', async ({ page }) => {
    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // Stage-one create content is active inside the owning dialog.
    await expect(dialog.getByRole('textbox', { name: /reference document url/i })).toBeVisible();

    // Cancel the in-modal create content. No dirty state exists before parsing, so
    // the wizard closes without a discard confirmation.
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Semantics changed with SPEC decision 9: cancelling the in-modal create content
    // returns to the choice prompt and leaves the owning modal open.
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Link to Existing Definition' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('full in-modal create flow triggers auto-assessment and shows success', async ({ page }) => {
    const topicsData = [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['year-group-10'] },
    ];

    // Parsed definition returned by getAssignmentDefinition after document parse
    const parsedDefinition = {
      definitionKey: 'new-def-key',
      primaryTitle: 'Algebra Homework',
      primaryTopicKey: 'topic-algebra',
      primaryTopic: 'Algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES' as const,
      referenceDocumentId: 'ref-123',
      templateDocumentId: 'tpl-456',
      assignmentWeighting: 5,
      tasks: [{ taskId: 'task-1', taskTitle: 'Solve equations', taskWeighting: 1 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    const scenario: RuntimeScenario = {
      ...createAssessTaskScenario({
        getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
      }),
      getAssignmentTopics: [
        { kind: 'success', data: topicsData },
        { kind: 'success', data: topicsData },
      ],
      getAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
      upsertAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
      startAssessmentRun: [
        { kind: 'success', data: { requestId: 'e2e-run-id' } },
        { kind: 'success', data: { requestId: 'e2e-run-id' } },
      ],
    };

    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // In-modal composition: create content renders inside the single owning dialog,
    // so no stacked "Create assignment" modal appears.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: /create assignment/i })).toHaveCount(0);

    // Fill required fields: reference and template document URLs
    await dialog
      .getByRole('textbox', { name: /reference document url/i })
      .fill('https://docs.google.com/presentation/d/ref-123/edit');
    await dialog
      .getByRole('textbox', { name: /template document url/i })
      .fill('https://docs.google.com/presentation/d/tpl-456/edit');

    // Click Parse and continue
    await dialog.getByRole('button', { name: /parse and continue/i }).click();

    // Stage two renders in-modal: the task table and assignment weighting field.
    await expect(dialog.getByRole('table', { name: 'Task weightings' })).toBeVisible();
    await expect(dialog.getByRole('spinbutton', { name: /assignment weighting/i })).toBeVisible();

    // Wait for parse to complete then click Save
    await expect(dialog.getByRole('button', { name: /save/i })).toBeEnabled();
    await dialog.getByRole('button', { name: /save/i }).click();

    // Verify startAssessmentRun was called
    const calls = await getMethodCalls(page);
    expect(calls).toContain('startAssessmentRun');

    // Success alert should appear
    await expect(dialog.getByText(/assessment started for/i)).toBeVisible();

    // Footer should show Close button (scope to footer to disambiguate from modal X close)
    await expect(
      dialog.locator('.ant-modal-footer').getByRole('button', { name: 'Close' })
    ).toBeVisible();
  });

  test('review-content Cancel during in-modal creation returns to the choice prompt', async ({
    page,
  }) => {
    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // Stage-one create content is active inside the owning dialog.
    await expect(dialog.getByRole('textbox', { name: /reference document url/i })).toBeVisible();

    // The owning footer is suppressed while create content is active: no footer
    // buttons render, so the outer actions are absent and the review content's
    // own footer carries the only Cancel action.
    await expect(dialog.locator('.ant-modal-footer').getByRole('button')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(1);

    // Semantics changed with SPEC decision 9: cancelling the in-modal create content
    // returns to the choice prompt and leaves the owning modal open (the previous
    // stacked composition closed both modals through the outer Cancel).
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('owning-modal close button confirms before dismissing dirty in-modal create edits', async ({
    page,
  }) => {
    const dialog = await openDirtyCreateReview(page);

    await dialog.getByRole('button', { name: 'Close' }).click();

    const discardDialog = getDiscardConfirmationDialog(page);
    await expect(discardDialog).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Edited Algebra Homework'
    );

    await discardDialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(discardDialog).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Edited Algebra Homework'
    );

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(getDiscardConfirmationDialog(page)).toBeVisible();
    await getDiscardConfirmationDialog(page)
      .getByRole('button', { name: 'Discard changes' })
      .click();
    await expect(getDiscardConfirmationDialog(page)).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('Escape confirms before dismissing dirty in-modal create edits', async ({ page }) => {
    const dialog = await openDirtyCreateReview(page);

    await page.keyboard.press('Escape');

    const discardDialog = getDiscardConfirmationDialog(page);
    await expect(discardDialog).toBeVisible();
    await expect(dialog).toBeVisible();

    await discardDialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(discardDialog).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Edited Algebra Homework'
    );
  });

  test('owning-modal mask click confirms before dismissing dirty in-modal create edits', async ({
    page,
  }) => {
    const dialog = await openDirtyCreateReview(page);

    await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });

    const discardDialog = getDiscardConfirmationDialog(page);
    await expect(discardDialog).toBeVisible();
    await expect(dialog).toBeVisible();

    await discardDialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(discardDialog).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});
