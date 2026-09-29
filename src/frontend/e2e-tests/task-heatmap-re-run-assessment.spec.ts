import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  getMethodCalls,
  installRuntimeMock,
  releaseNextDeferredSuccess,
} from './shared/endToEndRuntimeMocks';
import {
  createReRunHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_ASSIGNMENT_ID,
  HEATMAP_CLASS_ID,
  HEATMAP_DEFINITION_KEY,
  HEATMAP_UPDATED_CLASSROOM_TITLE,
  openHeatmapClass,
} from './helpers/task-heatmap-end-to-end-helpers';

const HEATMAP_TABLE_NAME = 'Task Heatmap';
const START_ASSESSMENT_RUN_METHOD = 'startAssessmentRun';
const RE_RUN_BUTTON_NAME = 'Re-run Assessment';
const ASSIGNMENT_SELECT_TEST_ID = 'assignment-select';
const RECORDING_GLOBAL_NAME = '__recordedApiRequests';
const ERROR_COPY =
  'An internal error occurred. Please try again or contact support if the issue persists.';
const LINKED_DEFINITION_COPY =
  'Using the assessment definition linked when this assignment was last assessed.';
const SUCCESS_COPY = `Assessment started for '${HEATMAP_UPDATED_CLASSROOM_TITLE}'.`;
const RE_RUN_BODY_COPY = `Re-run assessment for '${HEATMAP_UPDATED_CLASSROOM_TITLE}'`;

/** One recorded `google.script.run` request payload, as serialised by `callApi`. */
type RecordedRequest = Readonly<{ method?: unknown; params?: unknown }>;

/** The `google.script.run` runner chain shape the recorder wraps. */
type RecordedRunner = {
  withSuccessHandler: (handler: unknown) => RecordedRunner;
  withFailureHandler: (handler: unknown) => RecordedRunner;
  apiHandler: (request: unknown) => void;
};

/** The `globalThis.google` namespace shape installed by the runtime mock. */
type GoogleNamespace = {
  script: { run: RecordedRunner };
};

/**
 * Record every API request payload dispatched through `google.script.run`.
 *
 * Playwright does not define the evaluation order of multiple init scripts, so
 * this script tolerates either order: an accessor on `globalThis.google`
 * captures the runtime mock's runner when it is assigned and wraps it on every
 * read, recording the request just before the mock handles it. Install it
 * alongside `installRuntimeMock`.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once the recording accessor is installed.
 */
async function installRequestRecorder(page: Page): Promise<void> {
  await page.addInitScript((globalName: string) => {
    const recordedRequests: unknown[] = [];
    Reflect.set(globalThis, globalName, recordedRequests);

    /**
     * Return a runner that records each request before delegating to the mock.
     *
     * @param {RecordedRunner} runner - The underlying runner to delegate to.
     * @returns {RecordedRunner} The recording wrapper.
     */
    function wrapRunner(runner: RecordedRunner): RecordedRunner {
      return {
        withSuccessHandler(handler: unknown): RecordedRunner {
          return wrapRunner(runner.withSuccessHandler(handler));
        },
        withFailureHandler(handler: unknown): RecordedRunner {
          return wrapRunner(runner.withFailureHandler(handler));
        },
        apiHandler(request: unknown): void {
          recordedRequests.push(request);
          runner.apiHandler(request);
        },
      };
    }

    const existingGoogle = Reflect.get(globalThis, 'google') as GoogleNamespace | undefined;
    let mockRunner: RecordedRunner | undefined = existingGoogle?.script?.run;

    Object.defineProperty(globalThis, 'google', {
      configurable: true,
      get(): GoogleNamespace {
        if (mockRunner === undefined) {
          throw new Error(
            'google.script.run was not installed when the request recorder attached; install the runtime mock before the recorder.'
          );
        }
        return { script: { run: wrapRunner(mockRunner) } };
      },
      set(value: GoogleNamespace | undefined): void {
        mockRunner = value?.script?.run;
      },
    });
  }, RECORDING_GLOBAL_NAME);
}

/**
 * Read the request payloads recorded in the browser.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<ReadonlyArray<RecordedRequest>>} Recorded requests, oldest first.
 */
async function getRecordedRequests(page: Page): Promise<ReadonlyArray<RecordedRequest>> {
  return await page.evaluate((globalName: string) => {
    const recorded = Reflect.get(globalThis, globalName);
    return Array.isArray(recorded) ? recorded : [];
  }, RECORDING_GLOBAL_NAME);
}

/**
 * Count `startAssessmentRun` dispatches tracked by the runtime mock.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<number>} The number of dispatched assessment runs.
 */
async function countStartAssessmentRuns(page: Page): Promise<number> {
  const methodCalls = await getMethodCalls(page);
  return methodCalls.filter((method) => method === START_ASSESSMENT_RUN_METHOD).length;
}

/**
 * Read the recorded `startAssessmentRun` request payloads.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<ReadonlyArray<RecordedRequest>>} The recorded start requests.
 */
async function getStartAssessmentRequests(page: Page): Promise<ReadonlyArray<RecordedRequest>> {
  const requests = await getRecordedRequests(page);
  return requests.filter((request) => request.method === START_ASSESSMENT_RUN_METHOD);
}

/**
 * Build the single expected `startAssessmentRun` payload for the fixture.
 *
 * @returns {RecordedRequest} The expected request payload.
 */
function expectedStartRequest(): RecordedRequest {
  return {
    method: START_ASSESSMENT_RUN_METHOD,
    params: {
      definitionKey: HEATMAP_DEFINITION_KEY,
      assignmentId: HEATMAP_ASSIGNMENT_ID,
      courseId: HEATMAP_CLASS_ID,
    },
  };
}

/**
 * Locate one action button in the assess-task modal footer.
 *
 * @param {Locator} dialog - The open dialog locator.
 * @param {string} name - The accessible name of the footer button.
 * @returns {Locator} The footer button locator.
 */
function footerButton(dialog: Locator, name: string): Locator {
  return dialog.locator('.ant-modal-footer').getByRole('button', { name });
}

/**
 * Navigate from the shell to the fixture assignment's individual heatmap.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
async function openAssignmentHeatmap(page: Page): Promise<void> {
  await openHeatmapClass(page);
  await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
  await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();
}

/**
 * Assert the navigation-card action order: Back, Re-run, then Refresh.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once the ordering assertions pass.
 */
async function assertNavActionOrder(page: Page): Promise<void> {
  const backButton = page.getByRole('button', { name: 'Back to Class overview' });
  const reRunButton = page.getByRole('button', { name: RE_RUN_BUTTON_NAME });
  const refreshButton = page.getByRole('button', { name: 'Refresh' });
  await expect(reRunButton).toBeVisible();
  await expect(refreshButton).toBeVisible();

  const backButtonBox = await backButton.boundingBox();
  const reRunButtonBox = await reRunButton.boundingBox();
  const refreshButtonBox = await refreshButton.boundingBox();
  if (backButtonBox === null || reRunButtonBox === null || refreshButtonBox === null) {
    throw new Error('Expected the heatmap navigation actions to report a bounding box.');
  }

  expect(reRunButtonBox.x + reRunButtonBox.width).toBeLessThanOrEqual(refreshButtonBox.x);
  expect(backButtonBox.x + backButtonBox.width).toBeLessThanOrEqual(reRunButtonBox.x);
}

test.describe('Re-run Assessment from the assignment heatmap', () => {
  test('re-run skips selection and starts exactly one run with the persisted key', async ({
    page,
  }) => {
    const scenario = createReRunHeatmapScenario({
      startAssessmentRun: [{ kind: 'deferredSuccess', data: null }],
    });
    await installRuntimeMock(page, scenario);
    await installRequestRecorder(page);
    await openAssignmentHeatmap(page);

    await assertNavActionOrder(page);
    await page.getByRole('button', { name: RE_RUN_BUTTON_NAME }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The selection stage is skipped: no assignment picker and no manual start.
    await expect(dialog.getByTestId(ASSIGNMENT_SELECT_TEST_ID)).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toHaveCount(0);

    // The body names the assignment by its CURRENT Classroom title, which has
    // changed since assessment, and explains the persisted-key reuse.
    await expect(dialog.getByText(RE_RUN_BODY_COPY)).toHaveCount(1);
    await expect(dialog.getByText(LINKED_DEFINITION_COPY)).toHaveCount(1);

    // The automatic run is in flight, so the primary action follows the modal
    // confirm-loading pattern instead of offering a second confirmation click.
    await expect(footerButton(dialog, RE_RUN_BUTTON_NAME)).toBeDisabled();
    await expect.poll(() => countStartAssessmentRuns(page)).toBe(1);

    // Exactly one request, carrying the definition key persisted on the class
    // snapshot for this assignment id (not a re-match by title or topic).
    expect(await getStartAssessmentRequests(page)).toEqual([expectedStartRequest()]);

    await releaseNextDeferredSuccess(page);

    // Queued-success: the run was accepted for background processing, so the
    // success copy reports the start and the footer offers only Close.
    await expect(dialog.getByRole('alert')).toContainText(SUCCESS_COPY);
    await expect(footerButton(dialog, 'Close')).toBeVisible();
    await expect(dialog.getByTestId(ASSIGNMENT_SELECT_TEST_ID)).toHaveCount(0);
    expect(await countStartAssessmentRuns(page)).toBe(1);
  });

  test('a failed re-run surfaces Retry, and the retry queues the run', async ({ page }) => {
    const scenario = createReRunHeatmapScenario({
      startAssessmentRun: [
        { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: 'Assessment run rejected' },
        { kind: 'success', data: null },
      ],
    });
    await installRuntimeMock(page, scenario);
    await installRequestRecorder(page);
    await openAssignmentHeatmap(page);

    await page.getByRole('button', { name: RE_RUN_BUTTON_NAME }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The failure surfaces as a blocking error while the skipped selection
    // stage stays skipped, and the footer offers Cancel plus a Retry.
    await expect(dialog.getByRole('alert')).toContainText(ERROR_COPY);
    await expect(dialog.getByTestId(ASSIGNMENT_SELECT_TEST_ID)).toHaveCount(0);
    await expect(footerButton(dialog, 'Retry')).toBeVisible();
    await expect(footerButton(dialog, 'Cancel')).toBeVisible();
    expect(await countStartAssessmentRuns(page)).toBe(1);

    await footerButton(dialog, 'Retry').click();

    // The retry reuses the same persisted-key request and reaches the
    // queued-success state; the failure-only Retry action disappears.
    await expect(dialog.getByRole('alert')).toContainText(SUCCESS_COPY);
    await expect(footerButton(dialog, 'Close')).toBeVisible();
    await expect(footerButton(dialog, 'Retry')).toHaveCount(0);
    await expect(dialog.getByTestId(ASSIGNMENT_SELECT_TEST_ID)).toHaveCount(0);

    const startRequests = [expectedStartRequest(), expectedStartRequest()];
    expect(await getStartAssessmentRequests(page)).toEqual(startRequests);
    expect(await countStartAssessmentRuns(page)).toBe(startRequests.length);
  });
});
