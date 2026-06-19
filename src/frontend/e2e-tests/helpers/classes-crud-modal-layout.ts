import { expect, type Locator, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Button Positioning Assertions
// ---------------------------------------------------------------------------

/**
 * Options for asserting create button positioning relative to the modal content
 * flex container.
 */
export type AssertCreateButtonPositioningOptions =
  | {
      modal: Locator;
      assertionType: 'left edge';
      createButtonName: string | RegExp;
      tableName: string | RegExp;
      tolerance: number;
      minDiff?: never;
    }
  | {
      modal: Locator;
      assertionType: 'width';
      createButtonName: string | RegExp;
      tableName: string | RegExp;
      tolerance?: never;
      minDiff: number;
    };

/**
 * Asserts create button positioning relative to the modal content flex container.
 *
 * Measures against the stable project-controlled scaffold `Flex` container (the
 * direct parent of both the create button and the table) rather than antd's
 * internal `ant-table-wrapper`. The flex container has an explicit
 * `width: 100%` and `align="start"`, so its geometry is deterministic across
 * Chromium builds and antd versions. The `ant-table-wrapper` bounding box can
 * vary between headless CI rendering and local headed Chromium due to font
 * substitution and antd internal CSS changes.
 *
 * The flex container is located via a CSS descendant selector that finds the
 * `.ant-flex` element that is a direct child of `.ant-modal-body` within the
 * dialog. In the scaffold markup, the `Flex` is the only `ant-flex` element
 * rendered as a direct child of the antd Modal body, so this uniquely
 * identifies the scaffold Flex. This avoids the ambiguity of `ant-flex`
 * ancestor searches (which can match nested flex containers inside antd Table
 * internals) and `ant-table-wrapper` parent navigation (which can resolve to
 * intermediate wrappers depending on render state).
 *
 * Layout metrics are obtained via `offsetLeft` and `offsetWidth` (walked up
 * the `offsetParent` chain for absolute positioning) rather than
 * `boundingBox()`. This is critical because antd Modal's entrance zoom
 * animation applies a CSS `transform: scale(...)` that makes `boundingBox()`
 * return intermediate visual sizes during the animation. `offsetLeft` and
 * `offsetWidth` are layout properties unaffected by CSS transforms, so they
 * return the final layout dimensions immediately without waiting for the
 * animation to settle.
 *
 * @param {AssertCreateButtonPositioningOptions} options Test options.
 * @returns {Promise<void>}
 */
export async function assertCreateButtonPositioning(
  options: AssertCreateButtonPositioningOptions
): Promise<void> {
  const createButton = options.modal.getByRole('button', { name: options.createButtonName });
  const table = options.modal.getByRole('table', { name: options.tableName });
  // Locate the scaffold Flex: the only .ant-flex that is a direct child of
  // .ant-modal-body within the dialog. This is the project-controlled Flex
  // container that owns both the create button and the table.
  const flexContainer = options.modal.locator('.ant-modal-body > .ant-flex');

  await expect(createButton).toBeVisible();
  await expect(table).toBeVisible();
  await expect(flexContainer).toBeVisible();

  // Use offsetLeft/offsetWidth (layout properties) instead of boundingBox()
  // (visual properties) to avoid interference from the antd Modal entrance
  // zoom animation's CSS transform. offsetLeft is relative to the offsetParent,
  // so we walk up the chain to compute an absolute left position.
  const buttonBox = await createButton.evaluate((element) => {
    let left = 0;
    let current: Element | null = element;
    while (current) {
      left += (current as HTMLElement).offsetLeft;
      current = (current as HTMLElement).offsetParent;
    }
    return { left, width: (element as HTMLElement).offsetWidth };
  });
  const flexBox = await flexContainer.evaluate((element) => {
    let left = 0;
    let current: Element | null = element;
    while (current) {
      left += (current as HTMLElement).offsetLeft;
      current = (current as HTMLElement).offsetParent;
    }
    return { left, width: (element as HTMLElement).offsetWidth };
  });

  if (options.assertionType === 'left edge') {
    const leftEdgeDifference = Math.abs(buttonBox.left - flexBox.left);
    expect(leftEdgeDifference).toBeLessThanOrEqual(options.tolerance);
  } else {
    const widthDifference = flexBox.width - buttonBox.width;
    expect(widthDifference).toBeGreaterThanOrEqual(options.minDiff);
  }
}

// ---------------------------------------------------------------------------
// Transient State Reset Assertions
// ---------------------------------------------------------------------------

/**
 * Configuration preset for cohort management modal tests.
 */
export const cohortModalConfig = {
  managementButtonName: 'Manage Cohorts',
  modalName: /manage cohorts/i,
  createFormName: /create cohort/i,
  tableName: /cohorts/i,
  createButtonName: /create cohort/i,
} as const;

/**
 * Configuration preset for year group management modal tests.
 */
export const yearGroupModalConfig = {
  managementButtonName: 'Manage Year Groups',
  modalName: /manage year groups/i,
  createFormName: /create year group/i,
  tableName: /year groups/i,
  createButtonName: /create year group/i,
} as const;

/**
 * Configuration preset for topics management modal tests.
 */
export const topicsModalConfig = {
  managementButtonName: 'Manage Topics',
  modalName: /manage topics/i,
  createFormName: /create topic/i,
  tableName: /topics/i,
  createButtonName: /create topic/i,
} as const;

/**
 * Type for transient state reset modal configuration.
 */
export type TransientStateResetConfig = {
  managementButtonName: string;
  modalName: RegExp;
  createFormName: RegExp;
  tableName: RegExp;
  createButtonName: RegExp;
};

/**
 * Tests that transient inline-dialog state is reset when modal closes and reopens.
 *
 * @param {object} options Test options.
 * @param {Page} options.page Playwright page.
 * @param {Function} options.setupScenario Function to set up the test scenario (e.g., openClassesTabWithCohortManagementScenario).
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} options.closeMethod How to close the modal.
 * @param {TransientStateResetConfig} [options.config] Modal configuration (defaults to cohortModalConfig).
 * @returns {Promise<void>}
 */
export async function assertTransientStateResetOnClose(options: {
  page: Page;
  setupScenario: () => Promise<void>;
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape';
  config?: TransientStateResetConfig;
}): Promise<void> {
  const config = options.config ?? cohortModalConfig;

  // Set up the scenario
  await options.setupScenario();

  // Open the modal
  await options.page.getByRole('button', { name: config.managementButtonName }).click();
  const modal = options.page.getByRole('dialog', { name: config.modalName });
  await expect(modal).toBeVisible();

  // Open the create form to establish transient state
  await modal.getByRole('button', { name: config.createButtonName }).click();
  const form = options.page.getByRole('dialog', { name: config.createFormName });
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
  await options.page.getByRole('button', { name: config.managementButtonName }).click();
  const reopenedModal = options.page.getByRole('dialog', { name: config.modalName });
  await expect(reopenedModal).toBeVisible();

  // Assert clean ready state: create form should not be visible, table should be visible
  await expect(reopenedModal.getByRole('dialog', { name: config.createFormName })).toHaveCount(0);
  await expect(reopenedModal.getByRole('table', { name: config.tableName })).toBeVisible();
  await expect(reopenedModal.getByRole('button', { name: config.createButtonName })).toBeVisible();
}
