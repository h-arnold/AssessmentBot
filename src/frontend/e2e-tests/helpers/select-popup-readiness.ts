import { expect, type Locator } from '@playwright/test';

/**
 * Waits for a real, non-virtual Select option's entrance motion and placement.
 *
 * Visibility alone includes intermediate entrance frames. Clicking then can
 * advance Playwright's stability retries to native document scrolling, after
 * which the body-portalled popup can realign between pointerdown and pointerup.
 * Observe actual Web Animations and rc-motion's current lifecycle classes, then
 * require unchanged popup and option rectangles over four animation frames so
 * motion-end alignment also settles. The caller still performs a normal click.
 *
 * Each bounded assertion poll resolves the locator afresh; detached/replaced
 * nodes restart readiness rather than lending their geometry to a new option.
 * Cancelled animations are re-observed, not awaited via a rejected finished
 * promise. No animation is disabled, finished or otherwise modified.
 *
 * @param {Locator} option The intended option row or its visible content locator.
 * @returns {Promise<void>} Resolves when the option is ready for a normal click.
 */
export async function waitForSelectPopupReady(option: Locator): Promise<void> {
  await expect(option).toBeVisible();
  await expect(option).toBeEnabled();
  await expect
    .poll(
      async () => {
        return await option.evaluateAll(async (elements) => {
          if (elements.length !== 1) return `Expected one option, found ${elements.length}`;
          const target = elements[0];
          const row = target.closest('.ant-select-item-option');
          const popup = target.closest('.ant-select-dropdown');
          if (!row || !popup) return 'Option is not inside a real Select popup';
          const regions = [popup, row, target];

          /**
           * Checks the installed rc-motion lifecycle and actual browser motion.
           * @returns {boolean} Whether entrance or other motion remains active.
           */
          function isMoving(): boolean {
            const element = regions[0];
            // Current rc-motion emits these stages even before animation starts.
            if (
              /(?:^|\s)\S+-(?:appear|enter|leave)(?:-(?:prepare|start|active))?(?:\s|$)/u.test(
                element.className
              )
            ) {
              return true;
            }
            const animations = element.getAnimations({ subtree: true });
            for (
              let ancestor = element.parentElement;
              ancestor;
              ancestor = ancestor.parentElement
            ) {
              animations.push(...ancestor.getAnimations());
            }
            return animations.some(
              (animation) => animation.pending || animation.playState === 'running'
            );
          }

          /**
           * Rejects detached, hidden or zero-sized rendered regions.
           * @returns {boolean} Whether the region can be measured visibly.
           */
          function areRegionsVisible(): boolean {
            return regions.every((element) => {
              const { width, height } = element.getBoundingClientRect();
              return element.isConnected && element.checkVisibility() && width > 0 && height > 0;
            });
          }

          /**
           * Checks current option availability without changing its state.
           * @returns {boolean} Whether the option is disabled.
           */
          function isDisabledOption(): boolean {
            const element = regions[1];
            return (
              element.getAttribute('aria-disabled') === 'true' ||
              element.classList.contains('ant-select-item-option-disabled')
            );
          }

          const stableFrameCount = 4;
          let previous: number[] = [];
          for (let frame = 0; frame < stableFrameCount; frame += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const issues = [
              [!areRegionsVisible(), 'Option or popup is detached, hidden or empty'],
              [popup.classList.contains('ant-select-dropdown-hidden'), 'Popup is closed'],
              [isDisabledOption(), 'Option is disabled'],
              [isMoving(), `Popup motion is active: ${popup.className}`],
            ] as const;
            const issue = issues.find(([present]) => present);
            if (issue) return issue[1];

            const rectangles = regions.flatMap((element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return [x, y, width, height];
            });
            if (previous.some((value, index) => value !== rectangles[index])) {
              return 'Popup or option placement is still changing';
            }
            previous = rectangles;
          }
          return 'ready';
        });
      },
      { message: `Select popup entrance and option placement must settle: ${option}` }
    )
    .toBe('ready');
}
