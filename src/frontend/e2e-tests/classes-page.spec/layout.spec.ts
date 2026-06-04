import { expect, test } from '@playwright/test';
import { installRuntimeMock } from '../shared/endToEndRuntimeMocks';
import { createClassesScenario } from '../helpers/classes-page-end-to-end-helpers';
import { VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER, setupViewportAndVerifyCards } from './fixtures';
import {
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  TABLET_VIEWPORT_WIDTH,
  TABLET_VIEWPORT_HEIGHT,
  MIN_CARD_WIDTH_MOBILE,
  MIN_CARD_WIDTH_TABLET,
  MOBILE_CARD_WIDTH_TOLERANCE,
  TABLET_CARD_WIDTH_MARGIN,
} from '../helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Narrow viewport layout resilience
// ============================================================================

test.describe('Narrow viewport layout resilience', () => {
  test('cards remain readable and reachable without horizontal page overflow at mobile viewport', async ({
    page,
  }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(
      page,
      MOBILE_VIEWPORT_WIDTH,
      MOBILE_VIEWPORT_HEIGHT,
      MIN_CARD_WIDTH_MOBILE,
      MOBILE_CARD_WIDTH_TOLERANCE,
      TABLET_CARD_WIDTH_MARGIN
    );

    // Verify no excessive horizontal overflow
    const htmlElement = page.locator('html');
    const pageScrollWidth = await htmlElement.evaluate((element) => element.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(pageScrollWidth).toBeLessThanOrEqual(
      bodyClientWidth * VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER
    );
  });

  test('cards wrap appropriately and remain usable at tablet viewport', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(
      page,
      TABLET_VIEWPORT_WIDTH,
      TABLET_VIEWPORT_HEIGHT,
      MIN_CARD_WIDTH_TABLET,
      MOBILE_CARD_WIDTH_TOLERANCE,
      TABLET_CARD_WIDTH_MARGIN
    );

    // Verify no excessive horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(bodyScrollWidth).toBeLessThanOrEqual(
      bodyClientWidth * VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER
    );
  });
});
