import { expect, type Locator, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Button Positioning Assertions
// ---------------------------------------------------------------------------

/**
 * Asserts create button positioning relative to table.
 *
 * @param {object} options Test options.
 * @param {Locator} options.modal The modal locator.
 * @param {'left edge' | 'width'} options.assertionType What to assert.
 * @param {string} options.createButtonName The create button name pattern.
 * @param {string} options.tableName The table name pattern.
 * @param {number} options.tolerance Tolerance in pixels (for left edge).
 * @param {number} options.minDiff Minimum difference in pixels (for width).
 * @returns {Promise<void>}
 */
export async function assertCreateButtonPositioning(options: {
  modal: Locator;
  assertionType: 'left edge' | 'width';
  createButtonName: string;
  tableName: string;
  tolerance: number;
  minDiff: number;
}): Promise<void> {
  const createButton = options.modal.getByRole('button', { name: options.createButtonName });
  const table = options.modal.getByRole('table', { name: options.tableName });

  await expect(createButton).toBeVisible();
  await expect(table).toBeVisible();

  const buttonBox = await createButton.boundingBox();
  const tableBox = await table.boundingBox();

  // Null check for bounding boxes
  if (buttonBox === null || tableBox === null) {
    throw new Error(
      `Failed to get bounding boxes for Create button (${options.createButtonName}) and Table (${options.tableName})`
    );
  }

  if (options.assertionType === 'left edge') {
    const leftEdgeDifference = Math.abs(buttonBox.x - tableBox.x);
    expect(leftEdgeDifference).toBeLessThanOrEqual(options.tolerance);
  } else {
    const widthDifference = tableBox.width - buttonBox.width;
    expect(widthDifference).toBeGreaterThanOrEqual(options.minDiff);
  }
}

// ---------------------------------------------------------------------------
// Transient State Reset Assertions
// ---------------------------------------------------------------------------

/**
 * Tests that transient inline-dialog state is reset when modal closes and reopens.
 *
 * @param {object} options Test options.
 * @param {Page} options.page Playwright page.
 * @param {Function} options.setupScenario Function to set up the test scenario (e.g., openClassesTabWithCohortManagementScenario).
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} options.closeMethod How to close the modal.
 * @param {string} options.managementButtonName The name of the button to open the management modal.
 * @param {RegExp} options.modalName The modal name pattern as a RegExp.
 * @param {RegExp} options.createFormName The create form name pattern as a RegExp.
 * @param {RegExp} options.tableName The table name pattern as a RegExp.
 * @param {RegExp} options.createButtonName The create button name pattern as a RegExp.
 * @returns {Promise<void>}
 */
export async function assertTransientStateResetOnClose(options: {
  page: Page;
  setupScenario: () => Promise<void>;
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape';
  managementButtonName: string;
  modalName: RegExp;
  createFormName: RegExp;
  tableName: RegExp;
  createButtonName: RegExp;
}): Promise<void> {
  // Set up the scenario
  await options.setupScenario();

  // Open the modal
  await options.page.getByRole('button', { name: options.managementButtonName }).click();
  const modal = options.page.getByRole('dialog', { name: options.modalName });
  await expect(modal).toBeVisible();

  // Open the create form to establish transient state
  await modal.getByRole('button', { name: options.createButtonName }).click();
  const form = options.page.getByRole('dialog', { name: options.createFormName });
  await expect(form).toBeVisible();

  // Close via the specified method
  switch (options.closeMethod) {
    case 'Cancel': {
      // Close the create form first, then close via Cancel footer button in the management modal
      await form.getByRole('button', { name: 'Cancel' }).click();
      await expect(form).toHaveCount(0);
      await modal.getByRole('button', { name: 'Cancel' }).click();
      break;
    }
    case 'close icon': {
      await modal.getByRole('button', { name: /close/i }).click();
      break;
    }
    case 'mask': {
      // Use the scaffold wrapper to find the mask in the same modal root, click at corner
      const mask = options.page.locator(
        '.ant-modal-root:has(.reference-data-modal-scaffold-wrapper) .ant-modal-mask'
      );
      await mask.click({ position: { x: 10, y: 10 }, force: true });
      break;
    }
    case 'Escape': {
      await options.page.keyboard.press('Escape');
      break;
    }
  }

  await expect(modal).toHaveCount(0);

  // Reopen the modal
  await options.page.getByRole('button', { name: options.managementButtonName }).click();
  const reopenedModal = options.page.getByRole('dialog', { name: options.modalName });
  await expect(reopenedModal).toBeVisible();

  // Assert clean ready state: create form should not be visible, table should be visible
  await expect(reopenedModal.getByRole('dialog', { name: options.createFormName })).toHaveCount(0);
  await expect(reopenedModal.getByRole('table', { name: options.tableName })).toBeVisible();
  await expect(reopenedModal.getByRole('button', { name: options.createButtonName })).toBeVisible();
}
