import { expect, test } from '@playwright/test';
import {
  installRuntimeMock,
  releaseNextDeferredSuccess,
  getMethodCalls,
  type RuntimeScenario,
} from '../shared/endToEndRuntimeMocks';
import {
  algebraHomeworkEntry,
  createLinkableScenario,
} from '../helpers/classes-page-end-to-end-helpers';
import {
  LINK_PICKER_INFO_TEXT,
  ALGEBRA_HW_PARTIAL,
  POETRY_ANALYSIS_PARTIAL,
  ALGEBRA_HOMEWORK_PARTIAL,
  openAssessTaskModal,
  pickLinkableDefinitionE2E,
  selectAssignmentAndStart,
  setupLinkableDialog,
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

test.describe('Assess Task modal', () => {
  // ==========================================================================
  // Link to Existing Definition — picker flow tests
  // ==========================================================================

  test.describe('Link to Existing Definition — picker flow', () => {
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

      // Assert picker is rendered — look for the combobox
      await expect(dialog.getByTestId('linkable-definition-select')).toBeVisible();

      // Assert the Alert copy and footer buttons
      await expect(dialog.getByText(LINK_PICKER_INFO_TEXT)).toBeVisible();
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

      // Open the picker dropdown — the option shows the title and the subtitle
      await dialog.getByTestId('linkable-definition-select').click();
      const option = page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .first();
      await expect(option).toContainText('Algebra HW');
      await expect(option).toContainText('Algebra · Year 10');
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

      // Open the picker dropdown and collect titles from each option.
      // antd v6 renders options with role="option" inside a portal;
      // collect the primaryTitle text from each.
      await dialog.getByTestId('linkable-definition-select').click();
      const options = page.getByRole('listbox').getByRole('option');
      const optionCount = await options.count();
      const titles: string[] = [];
      for (let index = 0; index < optionCount; index++) {
        // Each option renders a Flex with two children: primaryTitle (first <span>)
        // and "Topic · Year" subtitle (second <span>).
        const titleText = await options.nth(index).locator('span').first().textContent();
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

      // Select the first (and only) option
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');

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
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');

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
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');
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
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Verify error Alert
      await expect(dialog.getByRole('alert')).toBeVisible();
      await expect(dialog.getByRole('alert')).toContainText(
        'An internal error occurred. Please try again or contact support if the issue persists.'
      );

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
      await expect(dialog.getByTestId('linkable-definition-select')).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      // Choice buttons should reappear
      await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Link to Existing Definition' })
      ).toBeVisible();
    });

    test('DEFINITION_STALE after link defers recovery — recovery prompt opens in-modal (panel 1)', async ({
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
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');
      await dialog.getByRole('button', { name: 'Link' }).click();

      // Stale-recovery contract: link-flow DEFINITION_STALE enters the in-modal
      // recovery prompt in the
      // single owning dialog and must NOT mount the stacked create wizard.
      // Settle on the committed link outcome first, so the recovery assertions
      // below cannot pass before the stale response has been processed.
      await expect
        .poll(
          async () => {
            const calls = await getMethodCalls(page);
            return calls.filter((call) => call === 'upsertAssignmentDefinition').length;
          },
          { timeout: 8000 }
        )
        .toBe(1);

      // No "Create assignment" dialog appears (bounded wait gives the old
      // stacked wizard a chance to mount incorrectly before asserting absence).
      await expect(page.getByRole('dialog', { name: /create assignment/i })).toHaveCount(0, {
        timeout: 8000,
      });

      // The owning AssessTaskModal remains the only dialog and renders the
      // recovery prompt in-modal: the stale warning alert replaces the link
      // picker, with a Cancel-then-Update action row.
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('alert')).toContainText(/out of date/i);
      await expect(dialog.getByTestId('linkable-definition-select')).toHaveCount(0);

      const actionNames = await dialog.locator('button').evaluateAll((buttons) => {
        return buttons
          .map((button) => button.textContent?.trim() ?? '')
          .filter((name) => name === 'Cancel' || name === 'Update');
      });
      expect(actionNames).toEqual(['Cancel', 'Update']);

      // Committed link outcome holds in idempotence-friendly form: the link
      // upsert ran exactly once and the assessment start was attempted once.
      const calls = await getMethodCalls(page);
      expect(calls.filter((call) => call === 'upsertAssignmentDefinition')).toHaveLength(1);
      expect(calls.filter((call) => call === 'startAssessmentRun')).toHaveLength(1);
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
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');
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
      await expect(dialog.getByTestId('assignment-select')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
    });
  });
});
