import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  getMethodCalls,
  installRuntimeMock,
  createWizardScenario,
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

// Update-wizard fixtures derived from `mockFullDefinition` / `mockPartialRows`.
const updateTitle = 'Algebra Baseline';
const canonicalReferenceUrl = 'https://docs.google.com/presentation/d/ref-doc-123/edit';
const canonicalTemplateUrl = 'https://docs.google.com/presentation/d/tpl-doc-456/edit';
const changedReferenceUrl = 'https://docs.google.com/presentation/d/new-ref';
const changedTemplateUrl = 'https://docs.google.com/presentation/d/new-tpl';
const taskWeightingInputCount = 3;
const reparsePromptCopy = 'Document changed. Re-parse to continue editing.';

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
 * @returns {Promise<Locator>} The visible Update assignment dialog
 */
async function openUpdateModal(page: Page, title: string): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  await expect(page.getByText('Assignment definitions')).toBeVisible();
  const table = page.getByRole('table', { name: 'Assignment definitions table' });
  const row = table
    .locator('tbody tr td:first-child')
    .getByText(title, { exact: true })
    .locator('xpath=ancestor::tr');
  await row.getByRole('button', { name: 'Update' }).click();
  const dialog = page.getByRole('dialog', { name: 'Update assignment' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Parses and continue clicks Parse and continue, waits for tasks table.
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
 * Locates the re-parse prompt's own Cancel action, which restores the persisted
 * document URLs rather than dismissing the modal.
 *
 * @remarks
 * A pending document change renders two visible Cancel buttons: this body-level
 * one beside Re-parse, and the footer one that dismisses the modal. Both are
 * scoped so neither locator resolves ambiguously.
 *
 * @param {Locator} dialog - The Update assignment dialog
 * @returns {Locator} The re-parse prompt Cancel button
 */
function getReparsePromptCancel(dialog: Locator): Locator {
  return dialog.locator('.ant-modal-body').getByRole('button', { name: /^Cancel$/ });
}

/**
 * Locates the modal footer's Cancel action.
 * @param {Locator} dialog - The Update assignment dialog
 * @returns {Locator} The footer Cancel button
 */
function getFooterCancel(dialog: Locator): Locator {
  return dialog.locator('.ant-modal-footer').getByRole('button', { name: /^Cancel$/ });
}

/**
 * Locates the modal footer's primary action.
 * @param {Locator} dialog - The Update assignment dialog
 * @returns {Locator} The footer Save button
 */
function getFooterSave(dialog: Locator): Locator {
  return dialog.locator('.ant-modal-footer').getByRole('button', { name: 'Save' });
}

/**
 * Waits for and returns every task weighting input in the wizard.
 * @param {Locator} dialog - The Update assignment dialog
 * @returns {Promise<Locator[]>} The task weighting inputs
 */
async function getTaskWeightingInputs(dialog: Locator): Promise<Locator[]> {
  const inputs = dialog.getByRole('table', { name: 'Task weightings' }).getByRole('spinbutton');
  await expect(inputs).toHaveCount(taskWeightingInputCount);
  return await inputs.all();
}

/**
 * Verifies the re-parse prompt is visible.
 * @param {Locator} dialog - The Update assignment dialog
 */
async function verifyReparsePrompt(dialog: Locator): Promise<void> {
  await expect(dialog.getByText(reparsePromptCopy)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Re-parse' })).toBeVisible();
  await expect(getReparsePromptCancel(dialog)).toBeVisible();
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
 * @param {Locator} control - The control locator
 */
async function assertDisabled(control: Locator): Promise<void> {
  await expect(control).toBeDisabled();
}

/**
 * Asserts a control is enabled.
 * @param {Locator} control - The control locator
 */
async function assertEnabled(control: Locator): Promise<void> {
  await expect(control).toBeEnabled();
}

/**
 * Opens the Update assignment modal and edits one document URL, producing the
 * visible re-parse prompt for a URL-only pending change.
 *
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Locator>} The Update assignment dialog with a pending URL change
 */
async function openUpdateModalWithPendingUrlChange(page: Page): Promise<Locator> {
  const dialog = await openUpdateModal(page, updateTitle);
  await dialog.getByRole('textbox', { name: 'Reference Document URL' }).fill(changedReferenceUrl);
  await verifyReparsePrompt(dialog);
  return dialog;
}

/**
 * Asserts every metadata and weighting control is locked and Save is
 * unavailable while a document change is pending.
 *
 * @param {Locator} dialog - The Update assignment dialog
 */
async function assertLockedWhileUrlChangePending(dialog: Locator): Promise<void> {
  await assertDisabled(dialog.getByRole('textbox', { name: 'Assignment Title' }));
  await assertDisabled(dialog.getByRole('combobox', { name: 'Assignment Topic' }));
  await assertDisabled(dialog.getByRole('combobox', { name: 'Assignment Year Group' }));
  await assertDisabled(dialog.getByRole('spinbutton', { name: /assignment weighting/i }));
  for (const taskWeightingInput of await getTaskWeightingInputs(dialog)) {
    await assertDisabled(taskWeightingInput);
  }
  await assertDisabled(getFooterSave(dialog));
}

/**
 * Asserts every metadata and weighting control is unlocked and Save is
 * available again.
 *
 * @param {Locator} dialog - The Update assignment dialog
 */
async function assertUnlocked(dialog: Locator): Promise<void> {
  await assertEnabled(dialog.getByRole('textbox', { name: 'Assignment Title' }));
  await assertEnabled(dialog.getByRole('combobox', { name: 'Assignment Topic' }));
  await assertEnabled(dialog.getByRole('combobox', { name: 'Assignment Year Group' }));
  await assertEnabled(dialog.getByRole('spinbutton', { name: /assignment weighting/i }));
  for (const taskWeightingInput of await getTaskWeightingInputs(dialog)) {
    await assertEnabled(taskWeightingInput);
  }
  await assertEnabled(getFooterSave(dialog));
}

/**
 * Asserts both document URL inputs stay usable while a document change is
 * pending, by editing the URL that has not been changed yet.
 *
 * @param {Locator} dialog - The Update assignment dialog
 */
async function assertDocumentUrlInputsStillEditable(dialog: Locator): Promise<void> {
  const referenceUrlInput = dialog.getByRole('textbox', { name: 'Reference Document URL' });
  const templateUrlInput = dialog.getByRole('textbox', { name: 'Template Document URL' });

  await assertEnabled(referenceUrlInput);
  await assertEnabled(templateUrlInput);
  // Prove real editability rather than just the enabled attribute: the untouched
  // URL still accepts a new value while the other one awaits a re-parse.
  await templateUrlInput.fill(changedTemplateUrl);
  await expect(templateUrlInput).toHaveValue(changedTemplateUrl);
  await expect(referenceUrlInput).toHaveValue(changedReferenceUrl);
}

/** Visible dismissal affordance exercised by the update-wizard dismissal matrix. */
type UpdateWizardDismissal = 'close control' | 'Escape' | 'mask' | 'footer Cancel';

/**
 * Dismisses the open Update assignment modal through one visible affordance
 * and asserts it closes with no discard confirmation and no save.
 *
 * @param {Page} page - Playwright page instance
 * @param {UpdateWizardDismissal} dismissal - The dismissal affordance to use
 */
async function assertPendingUrlChangeDismissesWithoutConfirmation(
  page: Page,
  dismissal: UpdateWizardDismissal
): Promise<void> {
  const dialog = await openUpdateModalWithPendingUrlChange(page);
  await assertLockedWhileUrlChangePending(dialog);
  const callsBeforeDismissal = await getMethodCalls(page);

  switch (dismissal) {
    case 'close control': {
      await dialog.getByRole('button', { name: 'Close' }).click();
      break;
    }
    case 'Escape': {
      await page.keyboard.press('Escape');
      break;
    }
    case 'mask': {
      // antd v6 handles mask clicks on the wrap element, not the mask sibling.
      await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });
      break;
    }
    case 'footer Cancel': {
      await getFooterCancel(dialog).click();
      break;
    }
  }

  // A URL-only pending change is discarded outright: no confirmation step, and
  // no mutation is issued on the way out.
  await expect(page.getByRole('dialog', { name: 'Discard changes' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Update assignment' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await getMethodCalls(page)).toEqual(callsBeforeDismissal);
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
    await assertEnabled(page.getByRole('button', { name: 'Parse and continue' }));
    await parseAndContinue(page);
    await expect(page.locator('text="Solve quadratic equations"')).toBeVisible();
    await saveAndClose(page);
    await expect(page.locator('text="New Assessment"')).toBeVisible();
  });

  test('update flow: changing one document URL keeps both URL inputs editable and locks everything else', async ({
    page,
  }) => {
    const dialog = await openUpdateModalWithPendingUrlChange(page);

    await expect(dialog.getByRole('textbox', { name: 'Assignment Title' })).toHaveValue(
      updateTitle
    );
    await assertDocumentUrlInputsStillEditable(dialog);
    await assertLockedWhileUrlChangePending(dialog);
  });

  test('update flow: document change + cancel restores both URLs and unlocks the other controls', async ({
    page,
  }) => {
    const dialog = await openUpdateModalWithPendingUrlChange(page);
    await assertLockedWhileUrlChangePending(dialog);

    await getReparsePromptCancel(dialog).click();

    await expect(dialog.getByRole('textbox', { name: 'Reference Document URL' })).toHaveValue(
      canonicalReferenceUrl
    );
    await expect(dialog.getByRole('textbox', { name: 'Template Document URL' })).toHaveValue(
      canonicalTemplateUrl
    );
    await expect(dialog.getByText(reparsePromptCopy)).toHaveCount(0);
    await expect(getReparsePromptCancel(dialog)).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await assertUnlocked(dialog);
  });

  test('update flow: top-right close control dismisses a URL-only pending change without a discard confirmation', async ({
    page,
  }) => {
    await assertPendingUrlChangeDismissesWithoutConfirmation(page, 'close control');
  });

  test('update flow: Escape dismisses a URL-only pending change without a discard confirmation', async ({
    page,
  }) => {
    await assertPendingUrlChangeDismissesWithoutConfirmation(page, 'Escape');
  });

  test('update flow: mask click dismisses a URL-only pending change without a discard confirmation', async ({
    page,
  }) => {
    await assertPendingUrlChangeDismissesWithoutConfirmation(page, 'mask');
  });

  test('update flow: footer Cancel dismisses a URL-only pending change without a discard confirmation', async ({
    page,
  }) => {
    await assertPendingUrlChangeDismissesWithoutConfirmation(page, 'footer Cancel');
  });

  test('update flow: document change + successful re-parse refreshes task rows', async ({
    page,
  }) => {
    await installRuntimeMock(page, reparseScenario);
    await page.goto('/');
    const dialog = await openUpdateModalWithPendingUrlChange(page);
    await clickReparse(page);
    await expect(dialog.getByText('Updated Task 1')).toBeVisible();
    await expect(dialog.getByText('New Task')).toBeVisible();
  });

  test('modal close with unsaved stage-two edits requires discard confirmation', async ({
    page,
  }) => {
    await openCreateModal(page);
    await fillForm(page);
    await parseAndContinue(page);
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment Updated');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await verifyDiscardConfirmation(page);
  });

  test('save blocked until valid year-group selection present', async ({ page }) => {
    await openCreateModal(page);
    await fillForm(page, { noYearGroup: true });
    await assertDisabled(page.getByRole('button', { name: 'Parse and continue' }));
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
