import { expect, test } from '@playwright/test';

test('shows the frontend title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('AssessmentBot Frontend')).toBeVisible();
  await expect(page.getByText('Unauthroised')).toBeVisible();
  await expect(page.getByText('google.script.run is unavailable in this runtime.')).toBeVisible();
});
