import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createChangedMetadataScenario,
  POST_ANALYSIS_ASSIGNMENT_TITLE,
  POST_ANALYSIS_CLASS_NAME,
} from './helpers/post-analysis-metadata-scenarios';
import {
  getMethodCalls,
  installRuntimeMock,
  releaseNextDeferredSuccess,
} from './shared/endToEndRuntimeMocks';

const SAVE_TITLE = 'Class summary not saved';
const SAVE_DESCRIPTION =
  'Analysis is ready, but the class summary could not be saved. Reload the page to try again.';
const REFRESH_TITLE = 'Class summary refresh failed';
const REFRESH_DESCRIPTION =
  'The class summary was saved, but refreshed data could not be loaded. Reload the page to refresh it.';
const BACKEND_MESSAGE = 'secret backend diagnostic';
const INITIAL_CLASS_READ_COUNT = 2;
const REFRESH_CLASS_READ_COUNT = 3;
const CLASS_PARTIAL_REFRESH_COUNT = 2;
const NOTICE_GEOMETRY_SAMPLE_COUNT = 3;
const NARROW_VIEWPORT_WIDTH = 390;

/**
 * Selects the active exact match through the keyboard on the builder control.
 * @param {Page} page - Browser page under test.
 * @param {Locator} control - Enabled combobox to focus.
 * @param {string} label - Exact visible option label.
 * @returns {Promise<void>} Resolves after selection.
 */
async function chooseOptionWithKeyboard(
  page: Page,
  control: Locator,
  label: string
): Promise<void> {
  await expect(control).toBeEnabled();
  await control.focus();
  await expect(control).toBeFocused();
  await page.keyboard.type(label);
  await expect(
    page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .locator('.ant-select-item', { has: page.getByText(label, { exact: true }) })
      .first()
  ).toHaveClass(/ant-select-item-option-active/);
  await page.keyboard.press('Enter');
}

/**
 * Selects the canonical class and assignment in standalone Heatmaps.
 * @param {Page} page - Browser page under test.
 * @returns {Promise<void>} Resolves when the inputs are selected.
 */
async function selectHeatmapInputs(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
  const classControl = page.getByRole('combobox', { name: 'Class', exact: true });
  await chooseOptionWithKeyboard(page, classControl, POST_ANALYSIS_CLASS_NAME);
  const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
  await chooseOptionWithKeyboard(page, assignments, POST_ANALYSIS_ASSIGNMENT_TITLE);
}

/**
 * Opens the standalone Heatmaps surface with the canonical analysis selected.
 * @param {Page} page - Browser page under test.
 * @returns {Promise<void>} Resolves when the heatmap is ready.
 */
async function openHeatmaps(page: Page): Promise<void> {
  await selectHeatmapInputs(page);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
}

/**
 * Overrides the canonical metadata write with a non-retriable backend failure.
 * @param {'class' | 'heatmaps'} surface - Consumer determining assignment-read queue.
 * @returns {ReturnType<typeof createChangedMetadataScenario>} Runtime mock scenario.
 */
function saveFailureScenario(surface: 'class' | 'heatmaps') {
  return {
    ...createChangedMetadataScenario(surface),
    updateABClass: [
      { kind: 'failureEnvelope' as const, code: 'INTERNAL_ERROR', message: BACKEND_MESSAGE },
    ],
  };
}

test('shows and dismisses persistent safe save-failure feedback on standalone Heatmaps', async ({
  page,
}) => {
  await installRuntimeMock(page, saveFailureScenario('heatmaps'));
  await openHeatmaps(page);
  const callsBefore = await getMethodCalls(page);
  const notice = page
    .getByRole('status')
    .filter({ has: page.getByText(SAVE_TITLE, { exact: true }) });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(SAVE_DESCRIPTION, { exact: true })).toHaveCount(1);
  await expect(notice).not.toContainText(BACKEND_MESSAGE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Assignments', exact: true })).toBeFocused();
  const close = notice.getByRole('button', { name: /close/i });
  await expect(close).toBeVisible();
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notice).toHaveCount(0);
  await expect(getMethodCalls(page)).resolves.toEqual(callsBefore);
  const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
  await chooseOptionWithKeyboard(page, assignments, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toHaveCount(0);
  await chooseOptionWithKeyboard(page, assignments, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
  await expect(notice).toHaveCount(0);
  const callsAfterReselection = await getMethodCalls(page);
  expect(callsAfterReselection.filter((method) => method === 'updateABClass')).toEqual(
    callsBefore.filter((method) => method === 'updateABClass')
  );
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  await expect(page.getByRole('status').filter({ hasText: SAVE_TITLE })).toHaveCount(0);
});

test('shows persistent save-failure feedback on the Class page without replacing analysis', async ({
  page,
}) => {
  await installRuntimeMock(page, saveFailureScenario('class'));
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  const card = page.getByRole('article').filter({ hasText: 'Synthetic Class 3' });
  await card.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('Recent Assignments')).toBeVisible();
  const recentAssignment = page.getByRole('button', { name: POST_ANALYSIS_ASSIGNMENT_TITLE });
  await expect(recentAssignment).toBeVisible();
  await recentAssignment.click();
  const notice = page
    .getByRole('status')
    .filter({ has: page.getByText(SAVE_TITLE, { exact: true }) });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(SAVE_DESCRIPTION, { exact: true })).toHaveCount(1);
  await expect(notice).not.toContainText(BACKEND_MESSAGE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: SAVE_TITLE })).toHaveCount(0);
});

test('distinguishes confirmed-save refresh failure from save failure', async ({ page }) => {
  const scenario = createChangedMetadataScenario('heatmaps');
  await installRuntimeMock(page, {
    ...scenario,
    getABClass: [
      ...(scenario.getABClass ?? []).slice(0, INITIAL_CLASS_READ_COUNT),
      { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: BACKEND_MESSAGE },
    ],
  });
  await selectHeatmapInputs(page);
  const notice = page
    .getByRole('status')
    .filter({ has: page.getByText(REFRESH_TITLE, { exact: true }) });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(REFRESH_DESCRIPTION, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: SAVE_TITLE })).toHaveCount(0);
  await expect(notice).not.toContainText(BACKEND_MESSAGE);
  const calls = await getMethodCalls(page);
  expect(calls.filter((method) => method === 'updateABClass')).toHaveLength(1);
  expect(calls.filter((method) => method === 'getABClass')).toHaveLength(REFRESH_CLASS_READ_COUNT);
});

test('retains confirmed-save refresh feedback when Class-page readiness blocks during list refresh', async ({
  page,
}) => {
  const scenario = createChangedMetadataScenario('class');
  const classPartialResponse = scenario.getABClassPartials?.[1];
  if (classPartialResponse?.kind !== 'success') {
    throw new Error('Expected the Class-page scenario post-save class partial response.');
  }
  await installRuntimeMock(page, {
    ...scenario,
    getABClass: [
      ...scenario.getABClass!.slice(0, INITIAL_CLASS_READ_COUNT),
      { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: BACKEND_MESSAGE },
    ],
    getABClassPartials: [
      scenario.getABClassPartials![0],
      {
        kind: 'deferredSuccess',
        data: classPartialResponse.data,
      },
    ],
  });
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  const card = page.getByRole('article').filter({ hasText: POST_ANALYSIS_CLASS_NAME });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'View' }).click();

  // The metadata write succeeds; the detail refresh fails while list refresh remains pending.
  await expect
    .poll(async () => {
      const calls = await getMethodCalls(page);
      return calls.filter((method) => method === 'updateABClass');
    })
    .toHaveLength(1);
  await expect
    .poll(async () => {
      const calls = await getMethodCalls(page);
      return calls.filter((method) => method === 'getABClassPartials');
    })
    .toHaveLength(CLASS_PARTIAL_REFRESH_COUNT);
  await expect(page.getByText("Couldn't load class", { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: REFRESH_TITLE })).toHaveCount(0);
  const callsBeforeListRefresh = await getMethodCalls(page);
  expect(callsBeforeListRefresh.filter((method) => method === 'getABClass')).toHaveLength(
    REFRESH_CLASS_READ_COUNT
  );
  await releaseNextDeferredSuccess(page);

  const notice = page
    .getByRole('status')
    .filter({ has: page.getByText(REFRESH_TITLE, { exact: true }) });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(REFRESH_DESCRIPTION, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: SAVE_TITLE })).toHaveCount(0);
  await expect(notice).not.toContainText(BACKEND_MESSAGE);
  const calls = await getMethodCalls(page);
  expect(calls.filter((method) => method === 'getABClassPartials')).toHaveLength(
    CLASS_PARTIAL_REFRESH_COUNT
  );
  expect(calls.filter((method) => method === 'updateABClass')).toHaveLength(1);
});

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop', theme: 'light' },
  { width: 1440, height: 900, label: 'desktop', theme: 'dark' },
  { width: NARROW_VIEWPORT_WIDTH, height: 844, label: 'narrow', theme: 'light' },
  { width: NARROW_VIEWPORT_WIDTH, height: 844, label: 'narrow', theme: 'dark' },
]) {
  test(`contains save-failure feedback at ${viewport.label} in ${viewport.theme} theme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installRuntimeMock(page, saveFailureScenario('heatmaps'));
    await page.goto('/');
    if (viewport.theme === 'dark') {
      await page.getByRole('switch', { name: 'Dark mode' }).click();
    }
    await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
    const classControl = page.getByRole('combobox', { name: 'Class', exact: true });
    await chooseOptionWithKeyboard(page, classControl, POST_ANALYSIS_CLASS_NAME);
    const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
    await chooseOptionWithKeyboard(page, assignments, POST_ANALYSIS_ASSIGNMENT_TITLE);
    await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
    const notice = page
      .getByRole('status')
      .filter({ has: page.getByText(SAVE_TITLE, { exact: true }) });
    await expect(notice).toBeVisible();
    let geometrySamples: string[] = [];
    await expect
      .poll(async () => {
        const geometry = await notice.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          };
        });
        const sample = JSON.stringify(geometry);
        geometrySamples = [...geometrySamples, sample].slice(-NOTICE_GEOMETRY_SAMPLE_COUNT);
        return (
          geometry.left >= 0 &&
          geometry.right <= geometry.innerWidth &&
          geometry.scrollWidth <= geometry.innerWidth &&
          geometry.width > 0 &&
          geometrySamples.length === NOTICE_GEOMETRY_SAMPLE_COUNT &&
          geometrySamples.every((entry) => entry === sample)
        );
      })
      .toBe(true);
    const close = notice.getByRole('button', { name: /close/i });
    await close.focus();
    await expect(close).toBeFocused();
    await expect(notice).not.toContainText(BACKEND_MESSAGE);
    await page.screenshot({
      path: new URL(
        `../../../.opencode/scratchpad/metadata-feedback-${viewport.theme}-${viewport.label}.png`,
        import.meta.url
      ).pathname,
      fullPage: true,
    });
  });
}
