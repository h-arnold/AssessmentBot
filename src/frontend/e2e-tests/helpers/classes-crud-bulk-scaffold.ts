import { expect, type Page } from '@playwright/test';
import { openClassesTab } from '../classes-crud.shared';

export const classesTableAriaLabel = 'Classes table';
const CONFIRM_CLICK_RETRY_ATTEMPTS = 3;

/** Opens the Settings Classes tab and waits for its table.
 * @param {Page} page The page under test.
 */
export async function openClassesManagementTab(page: Page): Promise<void> {
  await openClassesTab(page);
  await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
}

/**
 * Confirms a modal without losing the click to antd v6's rc-dialog entrance transition.
 * During that transition, a click can be swallowed while the dialog remains fully open;
 * the bounded retry is safe only after confirming it has not started closing. A dialog
 * that is merely mid-close must not be clicked again, so each attempt waits for complete
 * dismissal and the final assertion uses Playwright auto-wait rather than a fixed sleep.
 *
 * @param {ReturnType<Page['getByRole']>} dialog Dialog expected to dismiss.
 * @param {ReturnType<Page['getByRole']>} confirmButton Confirm button.
 */
export async function clickModalConfirmAndDismiss(
  dialog: ReturnType<Page['getByRole']>,
  confirmButton: ReturnType<Page['getByRole']>
): Promise<void> {
  await expect(confirmButton).toBeEnabled();
  for (let attempt = 0; attempt < CONFIRM_CLICK_RETRY_ATTEMPTS; attempt++) {
    await confirmButton.click();
    try {
      await expect(dialog).toHaveCount(0);
      return;
    } catch {
      // The click may be swallowed by the entrance animation; retry remains bounded.
    }
  }
  await expect(dialog).toHaveCount(0);
}

/** Builds success entries for row mutations that complete on explicit signals.
 * @param {number} count Number of row mutations.
 * @param {string} prefix Release-signal prefix.
 * @returns {ReadonlyArray<object>} Queued response entries.
 */
export function buildDeferredMutationEntries(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => {
    return {
      kind: 'success' as const,
      data: null,
      releaseSignal: `${prefix}${index}`,
    };
  });
}

/** Builds success entries for unrelated mutation methods used as queue safety nets.
 * @param {number} count Number of responses.
 * @returns {ReadonlyArray<object>} Queued response entries.
 */
export function buildMutationSuccessEntries(count: number) {
  return Array.from({ length: count }, () => ({ kind: 'success' as const, data: null }));
}
