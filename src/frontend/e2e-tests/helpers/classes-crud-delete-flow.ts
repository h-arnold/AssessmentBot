import { expect, type Locator, type Page } from '@playwright/test';

type ClassesCrudDeleteFlowBaseOptions = Readonly<{
  managementButtonName: string;
  managementDialogName: RegExp;
  rowName: RegExp;
  deleteDialogName: RegExp;
}>;

type ClassesCrudDeleteFlowSuccessOptions = ClassesCrudDeleteFlowBaseOptions &
  Readonly<{
    removedText: string;
    remainingText: string;
  }>;

/**
 * Opens the delete confirmation dialog for the requested row.
 *
 * @param {Page} page Playwright page.
 * @param {ClassesCrudDeleteFlowBaseOptions} options Target row and dialog locators.
 * @returns {Promise<Readonly<{ modal: Locator; confirmDialog: Locator }>>} Open dialog locators.
 */
async function openDeleteConfirmationDialog(
  page: Page,
  options: ClassesCrudDeleteFlowBaseOptions,
): Promise<Readonly<{ modal: Locator; confirmDialog: Locator }>> {
  await page.getByRole('button', { name: options.managementButtonName }).click();

  const modal = page.getByRole('dialog', { name: options.managementDialogName });
  await expect(modal).toBeVisible();

  const row = modal.getByRole('row', { name: options.rowName });
  await row.getByRole('button', { name: /delete/i }).click();

  const confirmDialog = page.getByRole('dialog', { name: options.deleteDialogName });
  await expect(confirmDialog).toBeVisible();

  return { modal, confirmDialog };
}

/**
 * Deletes the requested row and verifies that it disappears from the table.
 *
 * @param {Page} page Playwright page.
 * @param {ClassesCrudDeleteFlowSuccessOptions} options Target row and expected list labels.
 * @returns {Promise<void>} Resolves when the row has been deleted and the list updated.
 */
export async function deleteReferenceDataRowAndExpectRemoval(
  page: Page,
  options: ClassesCrudDeleteFlowSuccessOptions,
): Promise<void> {
  const { modal, confirmDialog } = await openDeleteConfirmationDialog(page, options);

  await confirmDialog.getByRole('button', { name: /delete|confirm|ok/i }).click();

  await expect(confirmDialog).toHaveCount(0);
  await expect(modal.getByText(options.removedText)).toHaveCount(0);
  await expect(modal.getByText(options.remainingText)).toBeVisible();
}

/**
 * Deletes the requested row and verifies that an IN_USE alert keeps the dialog open.
 *
 * @param {Page} page Playwright page.
 * @param {ClassesCrudDeleteFlowBaseOptions} options Target row and expected dialog labels.
 * @returns {Promise<void>} Resolves when the blocked delete state is visible.
 */
export async function deleteReferenceDataRowAndExpectBlocked(
  page: Page,
  options: ClassesCrudDeleteFlowBaseOptions,
): Promise<void> {
  const { confirmDialog } = await openDeleteConfirmationDialog(page, options);

  await confirmDialog.getByRole('button', { name: /delete|confirm|ok/i }).click();

  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByRole('alert')).toBeVisible();
  await expect(confirmDialog.getByRole('alert')).toContainText(/in use/i);
  await expect(confirmDialog.getByRole('button', { name: /delete|confirm|ok/i })).toBeDisabled();
}
