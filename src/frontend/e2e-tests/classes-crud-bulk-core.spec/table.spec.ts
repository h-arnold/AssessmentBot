/**
 * Classes table display tests — E2E.
 *
 * Covers visible browser behaviour for:
 * - Classes table display with row selection
 */

import { expect, test } from '@playwright/test';
import {
  classesTableAriaLabel,
  TWO_DATA_ROWS_PLUS_HEADER,
  linkedGCR,
  activeGCR,
  linkedClassPartial,
  activeClassPartial,
  mockBulkCoreRuntime,
  openClassesManagementTab,
} from './fixtures';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('classes table', () => {
  test('shows a classes table after navigating to the Settings Classes tab', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, activeGCR],
      classPartials: [linkedClassPartial, activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
  });

  test('renders one row per class returned by the backend', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, activeGCR],
      classPartials: [linkedClassPartial, activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await expect(table.getByRole('row')).toHaveCount(TWO_DATA_ROWS_PLUS_HEADER);
  });
});
