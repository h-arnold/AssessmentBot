import { expect, test } from '@playwright/test';
import { installRuntimeMock } from '../shared/endToEndRuntimeMocks';
import {
  algebraHomeworkEntry,
  createAssessTaskScenario,
  createLinkableScenario,
} from '../helpers/classes-page-end-to-end-helpers';
import {
  LINK_PICKER_INFO_TEXT,
  ALGEBRA_HW_PARTIAL,
  POETRY_ANALYSIS_PARTIAL,
  openAssessTaskModal,
  pickLinkableDefinitionE2E,
  selectAssignmentAndStart,
  setupLinkableDialog,
  setupPickerSearch,
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
    test('link picker shows updated info text', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Assert the Alert description copy
      await expect(dialog.getByText(LINK_PICKER_INFO_TEXT)).toBeVisible();
    });

    test('link picker combobox spans full width', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Assert the picker Select fills the modal body's content width
      const FULL_WIDTH_TOLERANCE_PX = 5;
      const comboboxWidth = await dialog
        .getByTestId('linkable-definition-select')
        .evaluate((element: HTMLElement) => element.offsetWidth);
      const bodyWidth = await dialog
        .locator('.ant-modal-body')
        .evaluate((element: HTMLElement) => element.offsetWidth);
      expect(Math.abs(comboboxWidth - bodyWidth)).toBeLessThan(FULL_WIDTH_TOLERANCE_PX);
    });

    test('link picker search filters options by title', async ({ page }) => {
      await setupPickerSearch(page);
    });

    test('link picker search clearing restores all options', async ({ page }) => {
      const { searchInput } = await setupPickerSearch(page);

      // Clear the search input
      await searchInput.clear();

      // All three options reappear
      await expect(page.getByText('Algebra HW', { exact: true })).toBeVisible();
      await expect(page.getByText('Poetry Analysis', { exact: true })).toBeVisible();
      await expect(page.getByText('Algebra Homework Original', { exact: true })).toBeVisible();
    });

    test('link picker search is case-insensitive', async ({ page }) => {
      const POETRY_UPPER_PARTIAL = {
        ...POETRY_ANALYSIS_PARTIAL,
        primaryTitle: 'POETRY Analysis',
      };

      const TWO_PARTIALS_ENTRY = {
        kind: 'success' as const,
        data: [POETRY_UPPER_PARTIAL, ALGEBRA_HW_PARTIAL],
      };

      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
          linkablePartialsEntry: TWO_PARTIALS_ENTRY,
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();

      // Open the picker dropdown
      await dialog.getByTestId('linkable-definition-select').click();

      // Type lowercase "algebra" — should match "Algebra HW"
      const searchInput = page.getByTestId('linkable-definition-select').getByRole('combobox');
      await searchInput.fill('algebra');

      await expect(page.getByText('Algebra HW', { exact: true })).toBeVisible();
      // POETRY Analysis should be filtered out (no "algebra" match)
      await expect(page.getByText('POETRY Analysis', { exact: true })).toHaveCount(0);
    });

    test('link picker selected value shows title only', async ({ page }) => {
      const dialog = await setupLinkableDialog(
        page,
        createLinkableScenario({
          getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
        })
      );

      await selectAssignmentAndStart(dialog, page);
      await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
      await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');

      // The selected value renders the primaryTitle only (no topic/year subtitle).
      // Use the combobox text content directly — the selected value appears in
      // the combobox's accessible label, not in `.ant-select-selection-item`.
      const selectedValue = dialog.getByTestId('linkable-definition-select');
      await expect(selectedValue).toContainText('Algebra HW');
      await expect(selectedValue).not.toContainText('Algebra · Year 10');
    });

    test('assignment Select is searchable', async ({ page }) => {
      const scenario = createAssessTaskScenario();
      await installRuntimeMock(page, scenario);
      const dialog = await openAssessTaskModal(page);

      // Open the assignment Select dropdown and confirm both options are listed
      await dialog.getByTestId('assignment-select').click();
      await expect(page.getByText('Algebra Homework', { exact: true })).toBeVisible();
      await expect(page.getByText('Chapter 5 Review', { exact: true })).toBeVisible();

      // Type in the search input to filter by title. The combobox is the
      // input element (antd v6 puts role="combobox" on the void input), so
      // filling the combobox directly triggers showSearch filtering.
      const searchInput = page.getByTestId('assignment-select').getByRole('combobox');
      await searchInput.fill('Algebra');

      // Only Algebra Homework remains; Chapter 5 Review is filtered out
      await expect(page.getByText('Algebra Homework', { exact: true })).toBeVisible();
      await expect(page.getByText('Chapter 5 Review', { exact: true })).toHaveCount(0);
    });
  });
});
