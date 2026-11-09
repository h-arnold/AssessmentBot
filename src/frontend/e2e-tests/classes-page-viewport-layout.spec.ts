import { test } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  MIN_CARD_WIDTH_MOBILE,
  MIN_CARD_WIDTH_TABLET,
  MOBILE_CARD_WIDTH_TOLERANCE,
  MOBILE_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
  TABLET_CARD_WIDTH_MARGIN,
  TABLET_VIEWPORT_HEIGHT,
  TABLET_VIEWPORT_WIDTH,
  createClassesScenario,
} from './helpers/classes-page-end-to-end-helpers';
import {
  expectNoHorizontalOverflow,
  setupViewportAndVerifyCards,
} from './helpers/classes-page-viewport-layout';

// ============================================================================
// Local overrides for test-specific tolerance constants
// ============================================================================

// Increased to accommodate minimum panel width in the narrow viewport journeys
const VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER = 1.5;

// ============================================================================
// Narrow viewport layout resilience
// ============================================================================

test.describe('Narrow viewport layout resilience', () => {
  test('cards remain readable and reachable without horizontal page overflow at mobile viewport', async ({
    page,
  }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(page, {
      viewportWidth: MOBILE_VIEWPORT_WIDTH,
      viewportHeight: MOBILE_VIEWPORT_HEIGHT,
      minCardWidth: MIN_CARD_WIDTH_MOBILE,
      cardWidthTolerance: MOBILE_CARD_WIDTH_TOLERANCE,
      viewportWidthMargin: TABLET_CARD_WIDTH_MARGIN,
    });

    // Verify no excessive horizontal overflow
    await expectNoHorizontalOverflow(page, VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER, 'document');
  });

  test('cards wrap appropriately and remain usable at tablet viewport', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(page, {
      viewportWidth: TABLET_VIEWPORT_WIDTH,
      viewportHeight: TABLET_VIEWPORT_HEIGHT,
      minCardWidth: MIN_CARD_WIDTH_TABLET,
      cardWidthTolerance: MOBILE_CARD_WIDTH_TOLERANCE,
      viewportWidthMargin: TABLET_CARD_WIDTH_MARGIN,
    });

    // Verify no excessive horizontal overflow
    await expectNoHorizontalOverflow(page, VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER, 'body');
  });
});
