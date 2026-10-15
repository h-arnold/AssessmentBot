import { expect, type Page } from '@playwright/test';
import { clearClassesCrudRowSelection, selectClassesCrudRow } from './classes-crud-bulk-metadata';

/** Opens a bulk metadata dialog after proving active, inactive, and mixed selections enable it.
 * @param {Page} page Classes page under test.
 * @param {string} actionLabel Bulk action button label.
 * @param {string} dialogName Expected dialog label.
 */
export async function openBulkMetadataDialog(
  page: Page,
  actionLabel: string,
  dialogName: string
): Promise<void> {
  const actionButton = page.getByRole('button', { name: actionLabel });

  await selectClassesCrudRow(page, 'gc-active');
  await expect(actionButton).toBeEnabled();

  await clearClassesCrudRowSelection(page, 'gc-active');
  await selectClassesCrudRow(page, 'gc-inactive');
  await expect(actionButton).toBeEnabled();

  await selectClassesCrudRow(page, 'gc-active');
  await expect(actionButton).toBeEnabled();

  await actionButton.click();
  await expect(page.getByRole('dialog', { name: dialogName })).toBeVisible();
}
