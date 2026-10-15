import { expect, type Locator } from '@playwright/test';

/**
 * Assert the shared alert-only success body and Close-only footer.
 *
 * @param {Locator} dialog The owning assessment dialog.
 * @param {string} assignmentTitle The Classroom assignment title.
 * @returns {Promise<void>} Resolves when the shared success surface is present.
 */
export async function expectAssessmentSuccessSurface(
  dialog: Locator,
  assignmentTitle: string
): Promise<void> {
  const alert = dialog.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText(`Assessment started for '${assignmentTitle}'.`);
  await expect(dialog.getByTestId('assignment-select')).toHaveCount(0);
  await expect(dialog.getByText('Select assignment', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText(assignmentTitle, { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(dialog.getByRole('table')).toHaveCount(0);
  await expect(dialog.getByTestId('linkable-definition-select')).toHaveCount(0);
  await expect(dialog.getByText(/re-run assessment/i)).toHaveCount(0);

  const footerButtons = dialog.locator('.ant-modal-footer').getByRole('button');
  await expect(footerButtons).toHaveCount(1);
  await expect(
    dialog.locator('.ant-modal-footer').getByRole('button', { name: 'Close' })
  ).toBeVisible();
}
