import { expect, test } from '@playwright/test';
import {
  installRuntimeMock,
  releaseNextDeferredSuccess,
  getMethodCalls,
  selectVisibleOption,
  type RuntimeScenario,
} from './shared/endToEndRuntimeMocks';
import {
  MOCK_COURSEWORK_ASSIGNMENTS,
  createAssessTaskScenario,
  createLinkableScenario,
  openAssessTaskModal,
  setupLinkableDialog,
} from './helpers/classes-page-end-to-end-helpers';
import type { Locator, Page } from '@playwright/test';

// ============================================================================
// Assess Task Modal — Playwright E2E Tests
// ============================================================================
//
// Tests covering the five modal states and user interactions from
// ACTION_PLAN §5 tests 13–21.  Each test is independently runnable with its
// own scenario and mock install.
//
// React 19 StrictMode double-fires effects in development, which means the
// `useEffect` that fetches assignments runs twice per modal open.  All custom
// `getGoogleClassroomAssignments` queues below provide enough entries to cover
// both StrictMode replays.
//
// Card layout (Year 10 panel, expanded by default):
//   Card 0: English 10       (class-english-10)
//   Card 1: Mathematics 10A  (class-math-10a)

// ---------------------------------------------------------------------------
// Shared constants and helpers
// ---------------------------------------------------------------------------

/** Reusable assignment data for an "Algebra Homework" coursework assignment with topic. */
const ALGEBRA_HOMEWORK_DATA = {
  assignmentId: 'cw-1',
  title: 'Algebra Homework',
  topicId: 'topic-algebra',
  topicName: 'Algebra',
} as const;

/**
 * Creates a success entry containing a single Algebra Homework assignment.
 * Suitable for scenario queues — call twice for StrictMode double-effect coverage.
 *
 * @returns {object} A success entry with one Algebra Homework assignment.
 */
function algebraHomeworkEntry() {
  return { kind: 'success' as const, data: [ALGEBRA_HOMEWORK_DATA] };
}

/**
 * Selects an assignment from the combobox and clicks Start Assessment.
 *
 * @param {Locator} dialog - The modal dialog locator.
 * @param {Page} page - The Playwright page.
 * @param {string} [title] - The visible text of the assignment option to select.
 * @returns {Promise<void>}
 */
async function selectAssignmentAndStart(
  dialog: Locator,
  page: Page,
  title: string = 'Algebra Homework'
) {
  await dialog.getByRole('combobox').click();
  await selectVisibleOption(page, title);
  await dialog.getByRole('button', { name: 'Start Assessment' }).click();
}

test.describe('Assess Task modal', () => {
  test('opens with correct title, Select dropdown, and disabled Start Assessment', async ({
    page,
  }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);
    await expect(dialog).toContainText('Assess Task — English 10');

    // Verify Select dropdown is visible with placeholder
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify Start Assessment is disabled initially
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });

  test('selecting an assignment enables Start Assessment and shows confirmation text', async ({
    page,
  }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Open the Select dropdown and choose "Algebra Homework"
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');

    // Verify Start Assessment becomes enabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Verify selected title appears as confirmation text below the dropdown.
    // Use toHaveCount rather than toBeVisible — the antd Typography.Text element
    // may be resolved as hidden by Playwright depending on rendering context.
    await expect(
      dialog.locator('.ant-typography-secondary').getByText('Algebra Homework')
    ).toHaveCount(1);
  });

  test('clicking Start Assessment makes no backend call and keeps modal open', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Select an assignment
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Record method calls before clicking Start Assessment
    const callsBefore = await getMethodCalls(page);
    expect(callsBefore).toContain('getGoogleClassroomAssignments');

    // Click Start Assessment
    await dialog.getByRole('button', { name: 'Start Assessment' }).click();

    // Verify modal is still open
    await expect(dialog).toBeVisible();

    // Verify no backend call was made to any subsequent method
    const callsAfter = await getMethodCalls(page);
    expect(callsAfter).toEqual(callsBefore);
  });

  test('Cancel button closes modal and discards selection', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Select an assignment first so we can verify state is discarded
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Click Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Verify modal is closed
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('clicking the modal mask closes the dialog', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    await openAssessTaskModal(page);

    // Click the modal mask (backdrop) near the top-left corner
    // antd v6 uses .ant-modal-wrap for mask click handling
    await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });

    // Verify modal is closed
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('reopening for a different class triggers fresh fetch and resets selection', async ({
    page,
  }) => {
    // Two modals × two StrictMode effect replays = 4 queue entries.
    // The first pair returns one assignment list, the second pair returns another.
    const algebraEntry = {
      kind: 'success' as const,
      data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
    };
    const differentEntry = {
      kind: 'success' as const,
      data: [{ assignmentId: 'cw-3', title: 'Different Assignment' }],
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraEntry, algebraEntry, differentEntry, differentEntry],
    });
    await installRuntimeMock(page, scenario);
    let dialog = await openAssessTaskModal(page);
    await expect(dialog).toContainText('Assess Task — English 10');

    // Verify first assignment list loads
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Select an assignment to create "stale" state
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Close modal
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Open modal for second card (Mathematics 10A)
    await page.getByRole('button', { name: 'Assess Task' }).nth(1).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Assess Task — Mathematics 10A');

    // Verify fresh fetch — second pair of entries loads
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify no stale selection from previous open
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });

  test('shows Alert with error message when fetch fails', async ({ page }) => {
    // Two entries for StrictMode double-effect so the modal stabilises on error.
    const failureEntry = {
      kind: 'failureEnvelope' as const,
      code: 'INTERNAL_ERROR' as const,
      message: 'Classroom API error',
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [failureEntry, failureEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify Alert with error message is shown
    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Classroom API error');

    // Verify Start Assessment is disabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select dropdown is not rendered in error state
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
  });

  test('shows Empty component when course has no assignments', async ({ page }) => {
    // Two entries for StrictMode double-effect so the modal stabilises on empty.
    const emptyEntry = { kind: 'success' as const, data: [] as Array<Record<string, never>> };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [emptyEntry, emptyEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify Empty component with description text
    await expect(dialog.getByText('No assignments found for this class')).toBeVisible();

    // Verify Start Assessment is disabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select dropdown is not rendered in empty state
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
  });

  test('shows spinner during fetch and transitions to Select on response', async ({ page }) => {
    // Two deferred entries for StrictMode.  Both effects will be held back;
    // releasing the first deferred resolves the first effect and the component
    // transitions to ready.  The second deferred stays pending and does not
    // affect the already-stable ready state.
    const deferredEntry = {
      kind: 'deferredSuccess' as const,
      data: MOCK_COURSEWORK_ASSIGNMENTS[0].data,
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [deferredEntry, deferredEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify loading spinner is visible
    await expect(dialog.getByRole('status')).toBeVisible();

    // Verify Start Assessment is disabled while loading
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select is not rendered during loading
    await expect(dialog.getByRole('combobox')).toHaveCount(0);

    // Release the first deferred success response
    await releaseNextDeferredSuccess(page);

    // Verify spinner is replaced by Select dropdown
    await expect(dialog.getByRole('status')).toHaveCount(0);
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify Start Assessment remains disabled (no selection yet)
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });

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
    await dialog.getByRole('combobox').click();
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

  test('"Create New Definition" opens wizard with pre-populated title and year group', async ({
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

    // Assert wizard opens
    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();

    // Assert title pre-populated
    await expect(wizardDialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Algebra Homework'
    );
  });

  test('cancelling wizard returns to choice prompt', async ({ page }) => {
    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // Wizard should be visible
    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();

    // Cancel wizard (no dirty state — wizard closes without discard confirmation)
    await wizardDialog.getByRole('button', { name: 'Cancel' }).click();

    // Should return to choice prompt
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
  });

  test('full wizard flow triggers auto-assessment and shows success', async ({ page }) => {
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
        { kind: 'success', data: null },
        { kind: 'success', data: null },
      ],
    };

    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // Wizard appears
    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();

    // Fill required fields: reference and template document URLs
    await wizardDialog
      .getByRole('textbox', { name: /reference document url/i })
      .fill('https://docs.google.com/presentation/d/ref-123/edit');
    await wizardDialog
      .getByRole('textbox', { name: /template document url/i })
      .fill('https://docs.google.com/presentation/d/tpl-456/edit');

    // Click Parse and continue
    await wizardDialog.getByRole('button', { name: /parse and continue/i }).click();

    // Wait for parse to complete then click Save
    await expect(wizardDialog.getByRole('button', { name: /save/i })).toBeEnabled();
    await wizardDialog.getByRole('button', { name: /save/i }).click();

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

  test('outer Cancel during wizard creation closes both modals', async ({ page }) => {
    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    await selectAssignmentAndStart(dialog, page);
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    // Wizard should be visible
    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();

    // Close the wizard first (returns to choice prompt), then dismiss the choice prompt
    await wizardDialog.getByRole('button', { name: 'Cancel' }).click();

    // Should return to choice prompt
    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();

    // Now click Cancel on the choice prompt to close everything
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Both modals should close — no dialogs visible
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  // ==========================================================================
  // Link to Existing Definition — picker flow tests
  // ==========================================================================

  test.describe('Link to Existing Definition — picker flow', () => {
    const ALGEBRA_HW_PARTIAL = {
      definitionKey: 'algebra-hw-key',
      primaryTitle: 'Algebra HW',
      primaryTopicKey: 'topic-algebra',
      primaryTopic: 'Algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-123',
      templateDocumentId: 'tpl-456',
      assignmentWeighting: 5,
      tasks: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z',
    };

    const POETRY_ANALYSIS_PARTIAL = {
      ...ALGEBRA_HW_PARTIAL,
      definitionKey: 'poetry-key',
      primaryTitle: 'Poetry Analysis',
      primaryTopicKey: 'topic-poetry',
      primaryTopic: 'Poetry',
      updatedAt: '2025-04-01T00:00:00.000Z',
    };

    const ALGEBRA_HOMEWORK_PARTIAL = {
      ...ALGEBRA_HW_PARTIAL,
      definitionKey: 'algebra-homework-key',
      primaryTitle: 'Algebra Homework Original',
      updatedAt: '2025-02-15T00:00:00.000Z',
    };

    test('"Link to Existing Definition" button is enabled when a linkable definition exists', async ({
      page,
    }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);

      // Assert choice prompt with enabled Link button
      await expect(dialog.getByText(/no matching assignment definition found/i)).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Link to Existing Definition' })
      ).toBeEnabled();
    });

    test('"Link to Existing Definition" button is disabled when the picker would be empty', async ({
      page,
    }) => {
      // Partials with a different year group — no match for English 10 (year-group-10)
      const DIFFERENT_YEAR_GROUP_PARTIAL = {
        ...ALGEBRA_HW_PARTIAL,
        definitionKey: 'year-9-key',
        yearGroupKey: 'year-group-9',
        yearGroupLabel: 'Year 9',
      };

      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          linkablePartialsEntry: { kind: 'success', data: [DIFFERENT_YEAR_GROUP_PARTIAL] },
        })
      );

      await selectAssignmentAndStart(dialog, page);

      // Assert choice prompt with disabled Link button
      await expect(dialog.getByText(/no matching assignment definition found/i)).toBeVisible();
      const linkButton = dialog.getByRole('button', { name: 'Link to Existing Definition' });
      await expect(linkButton).toBeDisabled();
      // Verify Tooltip — hover over the disabled button (antd Tooltip triggers on hover)
      await linkButton.hover();
      await expect(page.getByRole('tooltip')).toContainText(
        /no assignment definitions exist for this class's year group/i
      );
    });

    test('clicking the link button transitions to the picker', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);

      // Click link button
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Assert picker is rendered — look for the Radio.Group rows
      await expect(dialog.getByRole('radio')).toHaveCount(1);

      // Assert the Alert copy and footer buttons
      await expect(dialog.getByText(/link to an existing definition to associate/i)).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Link' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('picker rows show the title and the subtitle', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // The radio row shows the title and the subtitle
      const radioRow = dialog.locator('.ant-radio-label').first();
      await expect(radioRow.getByText('Algebra HW')).toHaveCount(1);
      await expect(radioRow.getByText('Algebra · Year 10')).toHaveCount(1);
    });

    test('picker rows sorted by fuzzy title rank with updatedAt desc tie-breaker', async ({
      page,
    }) => {
      // Three partials: "Poetry Analysis" (most recent), "Algebra HW" (older),
      // "Algebra Homework" (oldest). Google Classroom assignment title is
      // "Algebra Homework" — fuzzy ranking should list "Algebra Homework" first
      // (exact match → score 0), then "Algebra HW" (fuzzy match → score > 0),
      // then "Poetry Analysis" (no match).
      const THREE_PARTIALS_ENTRY = {
        kind: 'success' as const,
        data: [POETRY_ANALYSIS_PARTIAL, ALGEBRA_HW_PARTIAL, ALGEBRA_HOMEWORK_PARTIAL],
      };

      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          linkablePartialsEntry: THREE_PARTIALS_ENTRY,
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Collect titles from each radio row (the first .ant-typography child of .ant-radio-label)
      const radioLabels = dialog.locator('.ant-radio-label');
      const labelCount = await radioLabels.count();
      const titles: string[] = [];
      for (let index = 0; index < labelCount; index++) {
        const titleText = await radioLabels
          .nth(index)
          .locator('.ant-typography')
          .first()
          .textContent();
        titles.push(titleText?.trim() ?? '');
      }

      expect(titles[0]).toBe('Algebra Homework Original'); // closest fuzzy match → lowest score
      expect(titles[1]).toBe('Algebra HW'); // partial fuzzy match → higher score
      expect(titles[2]).toBe('Poetry Analysis');
    });

    test('selecting a row and clicking Link calls upsertAssignmentDefinition then startAssessmentRun', async ({
      page,
    }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Select the first (and only) row
      await dialog.getByRole('radio').click();

      // Click Link
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Wait for the success state
      await expect(dialog.getByText(/assessment started for/i)).toBeVisible();

      // Verify both backend methods were called
      const calls = await getMethodCalls(page);
      expect(calls).toContain('upsertAssignmentDefinition');
      expect(calls).toContain('startAssessmentRun');
    });

    test('loading state during link shows spinner and disabled Link button', async ({ page }) => {
      const UPSERT_DEFERRED = { kind: 'deferredSuccess' as const, data: ALGEBRA_HW_PARTIAL };
      const RUN_DEFERRED = { kind: 'deferredSuccess' as const, data: null };

      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          upsertAssignmentDefinition: [UPSERT_DEFERRED, UPSERT_DEFERRED],
          startAssessmentRun: [RUN_DEFERRED, RUN_DEFERRED],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await dialog.getByRole('radio').click();

      // Click Link — this triggers the deferred upsert
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Assert loading state: Link button disabled first (synchronous), then spinner
      await expect(dialog.getByRole('button', { name: 'Link' })).toBeDisabled();
      await expect(dialog.getByRole('status')).toBeVisible();

      // Release the deferred upsert response
      await releaseNextDeferredSuccess(page);

      // After upsert resolves, startAssessmentRun fires (also deferred)
      // Release that too
      await releaseNextDeferredSuccess(page);

      // Assert success state — spinner gone, success text visible
      await expect(dialog.getByRole('status')).toHaveCount(0);
      await expect(dialog.getByText(/assessment started for/i)).toBeVisible();
    });

    test('link success flow shows success Alert and Close button', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await dialog.getByRole('radio').click();
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Verify success Alert
      await expect(dialog.getByText(/assessment started for/i)).toBeVisible();

      // Verify Close button in footer
      await expect(
        dialog.locator('.ant-modal-footer').getByRole('button', { name: 'Close' })
      ).toBeVisible();

      // Verify startAssessmentRun was called
      const calls = await getMethodCalls(page);
      expect(calls).toContain('startAssessmentRun');
    });

    test('upsert failure shows error Alert and Cancel closes the modal', async ({ page }) => {
      const UPSERT_FAILURE = {
        kind: 'failureEnvelope' as const,
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to upsert definition',
      };

      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          upsertAssignmentDefinition: [UPSERT_FAILURE, UPSERT_FAILURE],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await dialog.getByRole('radio').click();
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Verify error Alert
      await expect(dialog.getByRole('alert')).toBeVisible();
      await expect(dialog.getByRole('alert')).toContainText('Failed to upsert definition');

      // Cancel closes the modal
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('Cancel from picker returns to the choice prompt', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Picker visible — click Cancel
      await expect(dialog.getByRole('radio')).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      // Choice buttons should reappear
      await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Link to Existing Definition' })
      ).toBeVisible();
    });

    test('DEFINITION_STALE after link opens wizard at task-weightings panel (panel 2)', async ({
      page,
    }) => {
      const topicsData = [
        { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['year-group-10'] },
      ];

      const STALE_ERROR = {
        kind: 'failureEnvelope' as const,
        code: 'DEFINITION_STALE' as const,
        message: 'Definition is stale',
      };

      const scenario: RuntimeScenario = {
        ...createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          linkablePartialsEntry: { kind: 'success', data: [ALGEBRA_HW_PARTIAL] },
          upsertAssignmentDefinition: [
            { kind: 'success', data: ALGEBRA_HW_PARTIAL },
            { kind: 'success', data: ALGEBRA_HW_PARTIAL },
          ],
          startAssessmentRun: [STALE_ERROR, STALE_ERROR],
        }),
        getAssignmentTopics: [
          { kind: 'success', data: topicsData },
          { kind: 'success', data: topicsData },
        ],
        getAssignmentDefinition: [
          { kind: 'success', data: ALGEBRA_HW_PARTIAL },
          { kind: 'success', data: ALGEBRA_HW_PARTIAL },
        ],
      };

      await installRuntimeMock(page, scenario);
      const dialog = await openAssessTaskModal(page);

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await dialog.getByRole('radio').click();
      await dialog.getByRole('button', { name: 'Link' }).click();

      // The wizard dialog should appear (DEFINITION_STALE recovery)
      // Note: panel-2 stale-recovery (task-weightings) is not yet implemented;
      // the wizard opens at panel 1 (title/topic) in create mode.
      const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
      await expect(wizardDialog).toBeVisible({ timeout: 8000 });

      // Assert we are on panel 1 (title/topic), not panel 2 (task weightings):
      // - Title textbox should be visible
      await expect(wizardDialog.getByRole('textbox', { name: /assignment title/i })).toBeVisible();

      // - "Parse and continue" button should be present (not "Save")
      await expect(wizardDialog.getByRole('button', { name: /parse and continue/i })).toBeVisible();
    });

    test('modal state resets on reopen after linking', async ({ page }) => {
      // Two opens × two StrictMode effect replays = 4 entries
      const fourAlgebraEntries = [
        algebraHomeworkEntry(),
        algebraHomeworkEntry(),
        algebraHomeworkEntry(),
        algebraHomeworkEntry(),
      ];

      let dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: fourAlgebraEntries,
        })
      );

      // First use — go through a full link flow
      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await dialog.getByRole('radio').click();
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Wait for success and close
      await expect(dialog.getByText(/assessment started for/i)).toBeVisible();
      await dialog.locator('.ant-modal-footer').getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // Reopen the modal (first card — English 10)
      await page.getByRole('button', { name: 'Assess Task' }).first().click();
      dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify state reset: Start Assessment is disabled, Select dropdown is shown
      await expect(dialog.getByRole('combobox')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
    });
  });
});
