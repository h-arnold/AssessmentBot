import { expect, test, type Page } from '@playwright/test';

/**
 * Installs a deterministic `google.script.run` mock that keeps auth status pending.
 */
async function mockPendingGoogleScriptRun(page: Page) {
  await page.addInitScript(() => {
    const run = {
      withSuccessHandler() {
        return run;
      },
      withFailureHandler() {
        return run;
      },
      apiHandler() {},
    };

    (globalThis as { google?: unknown }).google = {
      script: {
        run,
      },
    };
  });
}

test.describe('app shell', () => {
  test('shows shell on initial load', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeVisible();
  });

  test('hamburger collapses and expands nav rail visually', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: 'Collapse navigation' });
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    const expandedBox = await navigation.boundingBox();

    expect(expandedBox).not.toBeNull();

    await collapseButton.click();

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: 'Expand navigation' });

    await expect(expandButton).toBeVisible();
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await expect(expandButton.getByRole('img')).toBeVisible();

    const collapsedBox = await navigation.boundingBox();

    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(expandedBox!.width);

    await expandButton.click();

    const reexpandedButton = page.getByRole('button', { name: 'Collapse navigation' });

    await expect(reexpandedButton).toBeVisible();
    await expect(reexpandedButton).toHaveAttribute('aria-expanded', 'true');

    const reexpandedBox = await navigation.boundingBox();

    expect(reexpandedBox).not.toBeNull();
    expect(reexpandedBox!.width).toBeGreaterThan(collapsedBox!.width);
    await expect(reexpandedButton).toBeVisible();
  });

  test('keyboard activation of hamburger works', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: 'Collapse navigation' });

    await collapseButton.focus();
    await page.keyboard.press('Enter');

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: 'Expand navigation' });

    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press(' ');

    const reexpandedButton = page.getByRole('button', { name: 'Collapse navigation' });

    await expect(reexpandedButton).toHaveAttribute('aria-expanded', 'true');
  });
});
