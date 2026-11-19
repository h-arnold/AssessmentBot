import { expect, test } from '@playwright/test';
import {
  createAssignmentsScenario,
  getMethodCalls,
  installRuntimeMock,
  mockPartialRows,
  releaseNextDeferredSuccess,
  type ResponseItem,
} from './shared/endToEndRuntimeMocks';

/** Accessible name of the refresh action under test. */
const REFRESH_BUTTON_NAME = 'Refresh assignments data';

/** Backend method issued by the scoped refetch. */
const REFRESH_METHOD = 'getAssignmentDefinitionPartials';

/** Only the first refresh is expected after the repeat click. */
const EXPECTED_NEW_CALLS_AFTER_REPEAT_CLICK = 1;

/** The first refresh and the post-recovery refresh are expected after the final click. */
const EXPECTED_NEW_CALLS_AFTER_RECOVERY_CLICK = 2;

/**
 * Counts the scoped refetch calls recorded by the runtime mock.
 *
 * @param {ReadonlyArray<string>} calls Recorded backend method names.
 * @returns {number} Number of assignment-definition refetch calls.
 */
function countRefreshCalls(calls: ReadonlyArray<string>): number {
  return calls.filter((method) => method === REFRESH_METHOD).length;
}

test.describe('assignments refresh loading feedback', () => {
  test('refresh button shows the spinning icon and suppresses repeat clicks while the refetch is in flight', async ({
    page,
  }) => {
    const dataset = [mockPartialRows[0]];
    const deferredRefresh: ResponseItem = { kind: 'deferredSuccess', data: dataset };

    await installRuntimeMock(page, {
      ...createAssignmentsScenario({ initialPartials: dataset }),
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: dataset },
        deferredRefresh,
        { kind: 'success', data: dataset },
      ],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();
    await expect(
      page.getByText('Assignment definitions could not be trusted or loaded.')
    ).toHaveCount(0);
    await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Assignment definitions table' })).toBeVisible();

    const refreshButton = page.getByRole('button', { name: REFRESH_BUTTON_NAME });
    const customSpinner = refreshButton.locator('.anticon-spin svg.lucide-refresh-cw');

    // Idle baseline: no loading class and no custom spinner before any refresh.
    await expect(refreshButton).toBeEnabled();
    await expect(refreshButton).not.toHaveClass(/ant-btn-loading/);
    await expect(customSpinner).toHaveCount(0);

    const refreshCallsBefore = countRefreshCalls(await getMethodCalls(page));

    await refreshButton.click();

    // The deferred response holds the refetch open, so the button stays in its
    // loading presentation with the spinning RefreshCw supplied as loading.icon.
    await expect(refreshButton).toHaveClass(/ant-btn-loading/);
    await expect(customSpinner).toBeVisible();
    await expect(refreshButton).toHaveText(REFRESH_BUTTON_NAME);

    // Dispatch a click straight at the button so antd's loading guard is
    // exercised even where pointer events are suppressed on loading buttons.
    await refreshButton.dispatchEvent('click');
    await expect
      .poll(async () => countRefreshCalls(await getMethodCalls(page)))
      .toBe(refreshCallsBefore + EXPECTED_NEW_CALLS_AFTER_REPEAT_CLICK);

    // Releasing the held response clears the loading state.
    await releaseNextDeferredSuccess(page);
    await expect(refreshButton).not.toHaveClass(/ant-btn-loading/);
    await expect(customSpinner).toHaveCount(0);
    await expect(refreshButton).toBeEnabled();

    // The button is clickable again and issues a fresh scoped refetch.
    await refreshButton.click();
    await expect
      .poll(async () => countRefreshCalls(await getMethodCalls(page)))
      .toBe(refreshCallsBefore + EXPECTED_NEW_CALLS_AFTER_RECOVERY_CLICK);
  });
});
