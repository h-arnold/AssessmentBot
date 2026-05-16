import { expect, test, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  createWizardScenario,
  createFailedReferenceDataScenario,
  createFailedRefreshScenario,
  selectVisibleOption,
  mockFullDefinition,
  mockPartialRows,
  mockCreatedPartialRow,
} from './shared/endToEndRuntimeMocks';

// Local helpers to reduce duplication
const defaultTitle = 'New Assessment';
const defaultReferenceUrl = 'https://docs.google.com/presentation/d/test-ref';
const defaultTemplateUrl = 'https://docs.google.com/presentation/d/test-tpl';
const defaultTopic = 'Algebra';
const defaultYearGroup = 'Year 10';

/**
 * Fills the assignment create/update form with default or provided values.
 * @param {Page} page - Playwright page instance
 * @param {Object} options - Form fill options
 * @param {boolean} options.noYearGroup - Whether to skip filling the year group
 */
async function fillForm(page: Page, options: { noYearGroup?: boolean } = {}) {
  await page.getByRole('textbox', { name: 'Assignment Title' }).fill(defaultTitle);
  await page.getByRole('textbox', { name: 'Reference Document URL' }).fill(defaultReferenceUrl);
  await page.getByRole('textbox', { name: 'Template Document URL' }).fill(defaultTemplateUrl);
  await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
  await selectVisibleOption(page, defaultTopic);
  if (!options.noYearGroup) {
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, defaultYearGroup);
  }
}

/**
 * Opens the Create assignment modal.
 * @param {Page} page - Playwright page instance
 */
async function openCreateModal(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  await expect(page.getByText('Assignment definitions')).toBeVisible();
  await page.getByRole('button', { name: 'Create assignment' }).click();
  await expect(page.getByRole('dialog', { name: 'Create assignment' })).toBeVisible();
}

/**
 * Opens the Update modal for a specific assignment.
 * @param {Page} page - Playwright page instance
 * @param {string} title - Assignment title to update
 */
async function openUpdateModal(page: Page, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  await expect(page.getByText('Assignment definitions')).toBeVisible();
  const table = page.getByRole('table', { name: 'Assignment definitions table' });
  const row = table
    .locator('tbody tr td:first-child')
    .getByText(title, { exact: true })
    .locator('xpath=ancestor::tr');
  await row.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('dialog', { name: 'Update assignment' })).toBeVisible();
}

/**
 * Clicks Parse and continue, waits for tasks table.
 * @param {Page} page - Playwright page instance
 */
async function parseAndContinue(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Parse and continue' }).click();
  await expect(page.getByRole('table', { name: /task/i })).toBeVisible();
}

/**
 * Saves and waits for modal to close.
 * @param {Page} page - Playwright page instance
 */
async function saveAndClose(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog', { name: 'Create assignment' })).not.toBeVisible();
}

/**
 * Clicks Re-parse button.
 * @param {Page} page - Playwright page instance
 */
async function clickReparse(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Re-parse' }).click();
}

/**
 * Opens update modal and modifies reference document URL to trigger re-parse state.
 * @param {Page} page - Playwright page instance
 * @param {string} [title='Algebra Baseline'] - Assignment title to update
 */
async function triggerUpdateDocumentChange(page: Page, title = 'Algebra Baseline'): Promise<void> {
  await openUpdateModal(page, title);
  await page
    .getByRole('textbox', { name: 'Reference Document URL' })
    .fill('https://docs.google.com/presentation/d/new-ref');
}

/**
 * Verifies the re-parse prompt is visible.
 * @param {Page} page - Playwright page instance
 */
async function verifyReparsePrompt(page: Page): Promise<void> {
  await expect(page.getByText('Document changed. Re-parse to continue editing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-parse' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Cancel$/ }).last()).toBeVisible();
}

/**
 * Verifies discard confirmation dialog is visible.
 * @param {Page} page - Playwright page instance
 */
async function verifyDiscardConfirmation(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Discard changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Discard changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeVisible();
}

/**
 * Asserts a control is disabled.
 * @param {Page} page - Playwright page instance
 * @param {string} role - Role of the control
 * @param {string | RegExp} name - Name of the control
 */
async function assertDisabled(page: Page, role: string, name: string | RegExp): Promise<void> {
  await expect(page.getByRole(role, { name })).toBeDisabled();
}

/**
 * Asserts a control is enabled.
 * @param {Page} page - Playwright page instance
 * @param {string} role - Role of the control
 * @param {string | RegExp} name - Name of the control
 */
async function assertEnabled(page: Page, role: string, name: string | RegExp): Promise<void> {
  await expect(page.getByRole(role, { name })).toBeEnabled();
}

/**
 * Navigates to Assignments page.
 * @param {Page} page - Playwright page instance
 */
async function navigateToAssignments(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  await expect(page.getByText('Assignment definitions')).toBeVisible();
}

// Test data
const reParsedDefinition = {
  ...mockFullDefinition,
  referenceDocumentId: 'new-ref',
  templateDocumentId: 'new-tpl',
  tasks: [
    { taskId: 'task-1', taskTitle: 'Updated Task 1', taskWeighting: 2 },
    { taskId: 'task-2', taskTitle: 'Updated Task 2', taskWeighting: 1 },
    { taskId: 'task-3', taskTitle: 'New Task', taskWeighting: 1 },
  ],
} as const;

const standardWizardScenario = createWizardScenario({
  initialPartials: mockPartialRows,
  postMutationPartials: [
    [...mockPartialRows, mockCreatedPartialRow],
    [...mockPartialRows, mockCreatedPartialRow],
    [...mockPartialRows, mockCreatedPartialRow],
    [...mockPartialRows, mockCreatedPartialRow],
  ],
  assignmentDefinitions: [{ kind: 'success', data: mockFullDefinition }],
  upsertResponses: [
    { kind: 'success', data: mockFullDefinition },
    { kind: 'success', data: mockFullDefinition },
  ],
});

const reparseScenario = createWizardScenario({
  postMutationPartials: [mockPartialRows, mockPartialRows, mockPartialRows, mockPartialRows],
  assignmentDefinitions: [
    { kind: 'success', data: mockFullDefinition },
    { kind: 'success', data: reParsedDefinition },
    { kind: 'success', data: reParsedDefinition },
  ],
  upsertResponses: [{ kind: 'success', data: reParsedDefinition }],
});

test.describe('Assignment Definition Wizard - Shared edit surface, re-parse gating, and task weighting workflow', () => {
  test.beforeEach(async ({ page }) => {
    await installRuntimeMock(page, standardWizardScenario);
    await page.goto('/');
  });

  test('create flow: parse and continue, then save', async ({ page }) => {
    await openCreateModal(page);
    await fillForm(page);
    await parseAndContinue(page);
    await expect(page.locator('text="Solve quadratic equations"')).toBeVisible();
    await saveAndClose(page);
    await expect(page.locator('text="New Assessment"')).toBeVisible();
  });

  test('update flow: document change + cancel restores URLs and fields', async ({ page }) => {
    await triggerUpdateDocumentChange(page);
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toHaveValue(
      'Algebra Baseline'
    );
    await verifyReparsePrompt(page);
    await assertDisabled(page, 'textbox', 'Assignment Title');
    await page
      .getByRole('button', { name: /^Cancel$/ })
      .first()
      .click();
    await expect(page.getByRole('textbox', { name: 'Reference Document URL' })).toHaveValue(
      'https://docs.google.com/presentation/d/ref-doc-123/edit'
    );
    await assertEnabled(page, 'textbox', 'Assignment Title');
  });

  test('update flow: document change + successful re-parse refreshes task rows', async ({
    page,
  }) => {
    await installRuntimeMock(page, reparseScenario);
    await page.goto('/');
    await triggerUpdateDocumentChange(page);
    await clickReparse(page);
    await expect(page.locator('text="Updated Task 1"')).toBeVisible();
    await expect(page.locator('text="New Task"')).toBeVisible();
  });

  test('modal close with unsaved stage-two edits requires discard confirmation', async ({
    page,
  }) => {
    await openCreateModal(page);
    await fillForm(page);
    await parseAndContinue(page);
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment Updated');
    await page.click('button[aria-label="Close"]');
    await verifyDiscardConfirmation(page);
  });

  test('save blocked until valid year-group selection present', async ({ page }) => {
    await openCreateModal(page);
    await fillForm(page, { noYearGroup: true });
    await assertDisabled(page, 'button', 'Parse and continue');
  });

  test('create mode fails closed locally when required topic or year-group reference data cannot be trusted or loaded', async ({
    page,
  }) => {
    await installRuntimeMock(page, createFailedReferenceDataScenario());
    await page.goto('/');
    await navigateToAssignments(page);
    await expect(page.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
  });

  test('failed post-mutation refresh fails closed on affected surface', async ({ page }) => {
    await installRuntimeMock(page, createFailedRefreshScenario());
    await page.goto('/');
    await openCreateModal(page);
    await fillForm(page);
    await parseAndContinue(page);
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toBeVisible();
  });
});
