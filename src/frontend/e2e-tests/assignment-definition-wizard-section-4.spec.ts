import { expect, test, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  createWizardScenario,
  createFailedReferenceDataScenario,
  createFailedRefreshScenario,
  selectVisibleOption,
  type RuntimeScenario,
  mockFullDefinition,
  mockPartialRows,
  mockCreatedPartialRow,
} from './shared/endToEndRuntimeMocks';

// Re-export for backward compatibility
// Note: These types are now defined in the shared module
type WizardRuntimeScenario = RuntimeScenario;

/**
 * Installs a browser-side `google.script.run` mock for assignment-definition wizard journeys.
 *
 * @param {Page} page The Playwright page under test.
 * @param {WizardRuntimeScenario} scenario The per-method response queue scenario.
 * @returns {Promise<void>} Resolves once the init script is installed.
 */
async function mockWizardRuntime(page: Page, scenario: WizardRuntimeScenario) {
  await installRuntimeMock(page, scenario);
}

/**
 * Creates a standard success scenario for the wizard runtime.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with all required datasets.
 */
function createStandardWizardScenario() {
  return createWizardScenario({
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
}

/**
 * Creates a scenario for re-parse workflow.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with re-parse.
 */
function createReparseScenario() {
  const reParsedDefinition = {
    ...mockFullDefinition,
    referenceDocumentId: 'new-ref',
    templateDocumentId: 'new-tpl',
    tasks: [
      { taskId: 'task-1', taskTitle: 'Updated Task 1', taskWeighting: 2 },
      { taskId: 'task-2', taskTitle: 'Updated Task 2', taskWeighting: 1 },
      { taskId: 'task-3', taskTitle: 'New Task', taskWeighting: 1 },
    ],
  };

  return createWizardScenario({
    postMutationPartials: [
      mockPartialRows,
      mockPartialRows,
      mockPartialRows,
      mockPartialRows,
    ],
    assignmentDefinitions: [
      { kind: 'success', data: mockFullDefinition },
      { kind: 'success', data: reParsedDefinition },
      { kind: 'success', data: reParsedDefinition },
    ],
    upsertResponses: [
      { kind: 'success', data: reParsedDefinition },
    ],
  });
}


test.describe('Assignment Definition Wizard - Shared edit surface, re-parse gating, and task weighting workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardRuntime(page, createStandardWizardScenario());
    await page.goto('/');
  });

  test('create flow: parse and continue, then save', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');

    // Select topic
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');

    // Select year group
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    // Click Parse and continue
    await page.click('button:has-text("Parse and continue")');

    // Should show tasks after parse
    await page.waitForSelector('role=table[name*="task" i]');
    await expect(page.locator('text="Solve quadratic equations"')).toBeVisible();

    // Click Save
    await page.click('button:has-text("Save")');

    // Modal should close and table should refresh
    await expect(page.locator('role=dialog[name="Create assignment"]')).not.toBeVisible();
    await expect(page.locator('text="New Assessment"')).toBeVisible();
  });

  test('update flow: document change + cancel restores URLs and fields', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Update on the Algebra Baseline row
    const row = page.locator('role=row[name*="Algebra Baseline" i]');
    await row.locator('button:has-text("Update")').click();

    // Modal should open with pre-populated data
    await page.waitForSelector('role=dialog[name="Update assignment"]');
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toHaveValue('Algebra Baseline');

    // Change document URL
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill(
      'https://docs.google.com/presentation/d/new-ref'
    );

    // Should show re-parse prompt
    await expect(page.getByText('Document changed. Re-parse to continue editing.')).toBeVisible();
    await expect(page.locator('button:has-text("Re-parse")')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cancel$/ }).last()).toBeVisible();

    // Metadata should be disabled
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toBeDisabled();

    // Click Cancel
    await page.getByRole('button', { name: /^Cancel$/ }).first().click();

    // URLs should be restored and fields re-enabled
    await expect(page.getByRole('textbox', { name: 'Reference Document URL' })).toHaveValue(
      'https://docs.google.com/presentation/d/ref-doc-123/edit'
    );
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toBeEnabled();
  });

  test('update flow: document change + successful re-parse refreshes task rows', async ({ page }) => {
    await mockWizardRuntime(page, createReparseScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Update on the Algebra Baseline row
    const row = page.locator('role=row[name*="Algebra Baseline" i]');
    await row.locator('button:has-text("Update")').click();

    // Modal should open
    await page.waitForSelector('role=dialog[name="Update assignment"]');

    // Change document URL
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill(
      'https://docs.google.com/presentation/d/new-ref'
    );

    // Click Re-parse
    await page.click('button:has-text("Re-parse")');

    // Tasks should be refreshed
    await page.waitForSelector('text="Updated Task 1"');
    await expect(page.locator('text="New Task"')).toBeVisible();
  });

  test('modal close with unsaved stage-two edits requires discard confirmation', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form and parse
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await page.click('button:has-text("Parse and continue")');

    // Wait for tasks to appear
    await page.waitForSelector('role=table[name*="task" i]');

    // Edit task weighting
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment Updated');

    // Try to close modal
    await page.click('button[aria-label="Close"]');

    // Should show discard confirmation
    await expect(page.getByRole('dialog', { name: 'Discard changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep editing' })).toBeVisible();
  });

  test('save blocked until valid year-group selection present', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form without year group
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');

    // Save button should be disabled
    const saveButton = page.locator('button:has-text("Parse and continue")');
    await expect(saveButton).toBeDisabled();
  });

  test('create mode fails closed locally when required topic or year-group reference data cannot be trusted or loaded', async ({ page }) => {
    await mockWizardRuntime(page, createFailedReferenceDataScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Create button should be disabled since reference data (yearGroups, assignmentTopics) failed to load
    await expect(page.locator('button:has-text("Create assignment")')).toBeDisabled();
  });

  test('failed post-mutation refresh fails closed on affected surface', async ({ page }) => {
    await mockWizardRuntime(page, createFailedRefreshScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form and parse
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await page.click('button:has-text("Parse and continue")');

    await page.waitForSelector('role=table[name*="task" i]');
    await expect(page.getByText('Assignment definitions could not be trusted or loaded.')).toBeVisible();
  });
});
