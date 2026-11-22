import { expect, type Locator, type Page } from '@playwright/test';
import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import { installRuntimeMock, selectVisibleOption } from '../shared/endToEndRuntimeMocks';
import {
  algebraHomeworkEntry,
  CLASSES_LABEL,
  createLinkableScenario,
} from './classes-page-end-to-end-helpers';

// ============================================================================
// Assess Task dialog and link-picker journeys
// ============================================================================
//
// Shared interactions and fixtures for the Assess Task modal E2E suites.  The
// link-picker fixtures are defined once here and imported by both the link-flow
// and picker suites so their test data stays identical.

// ---------------------------------------------------------------------------
// Link-picker fixtures and shared search setup
// ---------------------------------------------------------------------------

export const LINK_PICKER_INFO_TEXT = 'Choose the Assignment you want to link this one to:' as const;

export const ALGEBRA_HW_PARTIAL = {
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

export const POETRY_ANALYSIS_PARTIAL = {
  ...ALGEBRA_HW_PARTIAL,
  definitionKey: 'poetry-key',
  primaryTitle: 'Poetry Analysis',
  primaryTopicKey: 'topic-poetry',
  primaryTopic: 'Poetry',
  updatedAt: '2025-04-01T00:00:00.000Z',
};

export const ALGEBRA_HOMEWORK_PARTIAL = {
  ...ALGEBRA_HW_PARTIAL,
  definitionKey: 'algebra-homework-key',
  primaryTitle: 'Algebra Homework Original',
  updatedAt: '2025-02-15T00:00:00.000Z',
};

const THREE_PARTIALS_ENTRY = {
  kind: 'success' as const,
  data: [POETRY_ANALYSIS_PARTIAL, ALGEBRA_HW_PARTIAL, ALGEBRA_HOMEWORK_PARTIAL],
};

/**
 * Opens the link picker dropdown with the three-partial entry and filters by
 * "Algebra". Shared setup for search-related tests — verifies initial all-three
 * visibility, the filter action, and the filtered state, then returns the
 * search input for further test-specific assertions.
 * @param {Page} page - Playwright page under test
 * @returns {{ searchInput: import('@playwright/test').Locator }} The search input locator for further test-specific interactions
 */
export async function setupPickerSearch(page: Page) {
  const { searchInput } = await openLinkPickerDropdown({
    page,
    linkablePartialsEntry: THREE_PARTIALS_ENTRY,
  });

  await expect(page.getByText('Algebra HW', { exact: true })).toBeVisible();
  await expect(page.getByText('Poetry Analysis', { exact: true })).toBeVisible();
  await expect(page.getByText('Algebra Homework Original', { exact: true })).toBeVisible();

  await searchInput.fill('Algebra');

  await expect(page.getByText('Algebra HW', { exact: true })).toBeVisible();
  await expect(page.getByText('Algebra Homework Original', { exact: true })).toBeVisible();
  await expect(page.getByText('Poetry Analysis', { exact: true })).toHaveCount(0);

  return { searchInput };
}

/**
 * Installs a linkable runtime scenario and opens the Assess Task modal.
 *
 * Convenience helper that combines {@link installRuntimeMock} and
 * {@link openAssessTaskModal} for the link-picker flow preamble.
 * The caller is responsible for calling `selectAssignmentAndStart`
 * after this function returns.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {RuntimeScenario} [scenario] - Optional scenario. Defaults to `createLinkableScenario()`.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible dialog locator.
 */
export async function setupLinkableDialog(
  page: Page,
  scenario?: RuntimeScenario
): Promise<ReturnType<typeof page.getByRole>> {
  await installRuntimeMock(page, scenario ?? createLinkableScenario());
  return openAssessTaskModal(page);
}

// ============================================================================
// Assess Task Modal Helpers
// ============================================================================

/**
 * Navigates to the Classes page and opens the first Assess Task modal.
 *
 * Handles the common test preamble: goto → menu click → panel visibility
 * check → Assess Task button click → dialog visibility check.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible dialog locator.
 */
export async function openAssessTaskModal(page: Page): Promise<ReturnType<typeof page.getByRole>> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();
  await expect(page.locator('#panel-content-year-group-9')).toBeVisible();
  await page.getByRole('heading', { level: 3, name: 'Year 10' }).click();
  await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
  await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();
  await expect(page.locator('#panel-content-year-group-9')).not.toBeVisible();

  await page
    .locator('#panel-content-year-group-10')
    .getByRole('button', { name: 'Assess Task' })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  return dialog;
}

/**
 * Selects an assignment from the combobox and clicks Start Assessment.
 *
 * @param {Locator} dialog - The modal dialog locator.
 * @param {Page} page - The Playwright page.
 * @param {string} [title] - The visible text of the assignment option to select.
 * @returns {Promise<void>}
 */
export async function selectAssignmentAndStart(
  dialog: Locator,
  page: Page,
  title: string = 'Algebra Homework'
): Promise<void> {
  await dialog.getByTestId('assignment-select').click();
  await selectVisibleOption(page, title);
  await dialog.getByRole('button', { name: 'Start Assessment' }).click();
}

/**
 * Opens the linkable-definition Select dropdown and selects the option matching
 * the given primary title.
 *
 * @param {Locator} dialog The Assess Task modal dialog locator.
 * @param {Page} page The Playwright page under test.
 * @param {string} title The primary title of the option to select.
 * @returns {Promise<void>}
 */
export async function pickLinkableDefinitionE2E(
  dialog: Locator,
  page: Page,
  title: string
): Promise<void> {
  await dialog.getByTestId('linkable-definition-select').click();
  await selectVisibleOption(page, title);
}

/**
 * Opens the assignment Select dropdown and selects the option matching
 * the given title.
 *
 * @param {Locator} dialog The Assess Task modal dialog locator.
 * @param {Page} page The Playwright page under test.
 * @param {string} [title] The visible text of the assignment option to select.
 * @returns {Promise<void>}
 */
export async function pickAssignmentE2E(
  dialog: Locator,
  page: Page,
  title: string = 'Algebra Homework'
): Promise<void> {
  await dialog.getByTestId('assignment-select').click();
  await selectVisibleOption(page, title);
}

/**
 * Sets up a linkable dialog with three linkable partials, opens the link picker
 * dropdown, and returns the search input locator.
 *
 * Replaces the common preamble shared by link-picker search tests.
 *
 * @param {{ page: Page; linkablePartialsEntry: ResponseItem }} options
 *   Page and the linkable partials entry containing the definitions to populate
 *   the picker.
 * @returns {Promise<{ searchInput: Locator }>} The combobox search input locator.
 */
async function openLinkPickerDropdown({
  page,
  linkablePartialsEntry,
}: {
  page: Page;
  linkablePartialsEntry: ResponseItem;
}): Promise<{ searchInput: Locator }> {
  const dialog = await setupLinkableDialog(
    page,
    createLinkableScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
      linkablePartialsEntry,
    })
  );

  await selectAssignmentAndStart(dialog, page);
  await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
  await dialog.getByTestId('linkable-definition-select').click();

  const searchInput = page.getByTestId('linkable-definition-select').getByRole('combobox');
  return { searchInput };
}
