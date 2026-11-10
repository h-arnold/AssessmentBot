/**
 * Attempt-baseline analysis mode journeys for the Class page.
 *
 * Covers the user-visible behaviour of the "Averages basis" mode control
 * (attempt-baseline specification decisions 1, 6, 6a and 8): toggling between
 * "All tasks" and "Baseline tasks" recomputes the Class page's aggregates and
 * back again, the Segmented control keeps its radio keyboard semantics, an
 * empty derived baseline joins the existing blocking treatment while the
 * control stays reachable so switching back to "All tasks" recovers the page,
 * and the embedded heatmap marks task columns outside the baseline set with
 * the page-level caption.
 *
 * The fixture scenarios are built from the heatmap class fixtures' per-student
 * task-skip option: the default all-submit scenario is degenerately in-baseline
 * (its top-engaged pool attempted every task), so skips are what make changed
 * aggregates, baseline-off column markers and the empty-baseline failure
 * constructible in the browser.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  getMethodCalls,
  installRuntimeMock,
  type RuntimeScenario,
} from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  openHeatmapClass,
} from './helpers/task-heatmap-end-to-end-helpers';
import {
  buildClassFullDocument,
  type HeatmapSkippedTasksByStudentId,
} from './helpers/task-heatmap-class-fixtures';

// Visible control copy pinned by the attempt-baseline layout specification
// (copy home: `pageContent` under `classDetail`).
const MODE_CONTROL_LABEL = 'Averages basis';
const ABSOLUTE_OPTION_LABEL = 'All tasks';
const BASELINE_OPTION_LABEL = 'Baseline tasks';

const HEATMAP_TABLE_NAME = 'Task Heatmap';

// Heatmap-side copy from `taskHeatmapZeroWeightHeader.tsx` (constants
// BASELINE_CAPTION / BASELINE_OFF_EXPLANATION), restated so the browser
// assertions stay independent of the production module.
const BASELINE_CAPTION =
  '† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them.';
const BASELINE_OFF_EXPLANATION =
  'Task outside the baseline set — shown, but not included in baseline averages.';

// Roster ids of the heatmap fixture class (task-heatmap-class-fixtures
// HEATMAP_STUDENTS). The fixture builder rejects unknown ids, so a mistyped
// skip fails loudly instead of silently producing a degenerate scenario.
const STUDENT_TWO_ID = '100000000005';
const STUDENT_THREE_ID = '100000000006';
const STUDENT_FIVE_ID = '100000000008';
const STUDENT_SIX_ID = '100000000009';
const STUDENT_SEVEN_ID = '100000000010';
const STUDENT_EIGHT_ID = '100000000011';
const STUDENT_NINE_ID = '100000000012';
const STUDENT_TEN_ID = '100000000013';

const ALL_TASK_IDS = ['task_001', 'task_002', 'task_003'] as const;

/**
 * Students Six, Seven, Eight and Student Two skip the last task, leaving
 * Student Ten as the only three-task attempter. The ten-percent pool is the
 * top two candidates by attempted-task count — Student Ten (three attempts)
 * and Student Two (two attempts, lowest id among the tied group) — whose
 * common attempt set is Task 1 and Task 2. Task 3 therefore sits outside the
 * baseline while still carrying Student Ten's observations, so the card and
 * table aggregates change when the mode toggles and the heatmap column is
 * marked as baseline-off.
 */
const PARTIAL_ATTEMPT_SKIPS: HeatmapSkippedTasksByStudentId = {
  [STUDENT_TWO_ID]: ['task_003'],
  [STUDENT_SIX_ID]: ['task_003'],
  [STUDENT_SEVEN_ID]: ['task_003'],
  [STUDENT_EIGHT_ID]: ['task_003'],
};

/**
 * Only three students attempt anything — Student Two and Student Nine attempted
 * Task 1, Student Six attempted Task 2 — so the top-two pool (Students Two and
 * Six by ascending id) shares no attempted task key and the baseline derivation
 * fails fast with the empty-attempt-baseline blocking error.
 */
const DISJOINT_ATTEMPT_SKIPS: HeatmapSkippedTasksByStudentId = {
  [STUDENT_TWO_ID]: ['task_002', 'task_003'],
  [STUDENT_THREE_ID]: [...ALL_TASK_IDS],
  [STUDENT_FIVE_ID]: [...ALL_TASK_IDS],
  [STUDENT_SIX_ID]: ['task_001', 'task_003'],
  [STUDENT_SEVEN_ID]: [...ALL_TASK_IDS],
  [STUDENT_EIGHT_ID]: [...ALL_TASK_IDS],
  [STUDENT_NINE_ID]: ['task_002', 'task_003'],
  [STUDENT_TEN_ID]: [...ALL_TASK_IDS],
};

/** Absolute-mode card pill values for the partial-attempt scenario (verified against the landed analyser). */
const ABSOLUTE_COMPLETENESS_PILL = '2.69';
/** Baseline-mode card pill for the same scenario: Task 3 observations drop out. */
const BASELINE_COMPLETENESS_PILL = '4.04';

/**
 * Build a scenario whose class document carries the requested skips while
 * keeping the base scenario's equal-version metadata anchor: the skip mutation
 * changes only submission items, so the anchored metadata snapshot (which keeps
 * the background metadata task on its no-op write path) is reused verbatim.
 * @param {HeatmapSkippedTasksByStudentId} skippedTasksByStudentId - Per-student task skips.
 * @returns {RuntimeScenario} StrictMode-safe scenario with skips applied.
 */
function createBaselineModeScenario(
  skippedTasksByStudentId: HeatmapSkippedTasksByStudentId
): RuntimeScenario {
  const baseScenario = createHeatmapScenario();
  const [classEntry] = baseScenario.getABClass ?? [];
  if (classEntry?.kind !== 'success') {
    throw new Error('The heatmap scenario must open with a successful class response.');
  }
  const anchoredMetadata = ClassFullSchema.parse(classEntry.data).metadata;
  const classDocument = ClassFullSchema.parse(
    buildClassFullDocument(false, skippedTasksByStudentId)
  );
  classDocument.metadata = anchoredMetadata;
  return {
    ...baseScenario,
    getABClass: [
      { kind: 'success' as const, data: classDocument },
      { kind: 'success' as const, data: classDocument },
    ],
  };
}

/**
 * Locate the Class page's mode control.
 * @param {Page} page - Browser page showing the Class page.
 * @returns {Locator} The "Averages basis" radiogroup.
 */
function getModeControl(page: Page): Locator {
  return page.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
}

/**
 * Locate the recent-assignment card's completeness pill (the first metric pill).
 * @param {Page} page - Browser page showing the Class page overview.
 * @returns {Locator} The completeness pill inside the recent-assignment card.
 */
function getCardCompletenessPill(page: Page): Locator {
  const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });
  return card.locator('.ant-tag').first();
}

/**
 * Wait for the Segmented thumb motion to settle on the chosen option.
 *
 * The thumb element exists only while the slide animation runs; at rest the
 * selected item carries the selected class again. Asserting both keeps every
 * post-toggle assertion and capture on the settled state.
 * @param {Locator} control - The mode-control radiogroup.
 * @param {string} optionLabel - The option the thumb must settle on.
 * @returns {Promise<void>} Resolves once the motion has settled.
 */
async function expectModeSettled(control: Locator, optionLabel: string): Promise<void> {
  await expect(control.locator('.ant-segmented-thumb')).toHaveCount(0);
  await expect(
    control.locator('.ant-segmented-item-selected', { hasText: optionLabel })
  ).toHaveCount(1);
}

test.describe('Class page attempt-baseline mode', () => {
  test('toggles to baseline tasks, changes the card aggregates, and restores them on toggle back', async ({
    page,
  }) => {
    await installRuntimeMock(page, createBaselineModeScenario(PARTIAL_ATTEMPT_SKIPS));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    await expect(control).toBeVisible();
    const absoluteRadio = control.getByRole('radio', { name: ABSOLUTE_OPTION_LABEL });
    const baselineRadio = control.getByRole('radio', { name: BASELINE_OPTION_LABEL });
    await expect(absoluteRadio).toBeChecked();
    await expect(baselineRadio).not.toBeChecked();

    const completenessPill = getCardCompletenessPill(page);
    await expect(completenessPill).toHaveText(ABSOLUTE_COMPLETENESS_PILL);
    const callsBeforeToggling = await getMethodCalls(page);

    await control.getByText(BASELINE_OPTION_LABEL).click();
    await expectModeSettled(control, BASELINE_OPTION_LABEL);
    await expect(baselineRadio).toBeChecked();
    await expect(absoluteRadio).not.toBeChecked();
    await expect(completenessPill).toHaveText(BASELINE_COMPLETENESS_PILL);

    // Toggling re-runs the synchronous analysis without refetching (mode is
    // page state, not server state — no new backend calls may appear).
    expect(await getMethodCalls(page)).toEqual(callsBeforeToggling);

    await control.getByText(ABSOLUTE_OPTION_LABEL).click();
    await expectModeSettled(control, ABSOLUTE_OPTION_LABEL);
    await expect(absoluteRadio).toBeChecked();
    await expect(completenessPill).toHaveText(ABSOLUTE_COMPLETENESS_PILL);
  });

  test('changes the student averages with the mode and restores them on toggle back', async ({
    page,
  }) => {
    await installRuntimeMock(page, createBaselineModeScenario(PARTIAL_ATTEMPT_SKIPS));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    const studentTenRow = page.getByRole('row').filter({ hasText: 'Ten' });
    await expect(studentTenRow).toHaveCount(1);

    // Student Ten attempted all three tasks, so their averages drop the
    // outside-baseline Task 3 scores when the mode toggles.
    await expect(studentTenRow).toHaveText(/Student\s*Ten\s*2\.33\s*1\.67\s*1\.67\s*1\.93/);

    await control.getByText(BASELINE_OPTION_LABEL).click();
    await expectModeSettled(control, BASELINE_OPTION_LABEL);
    await expect(studentTenRow).toHaveText(/Student\s*Ten\s*3\.50\s*2\.50\s*2\.50\s*2\.90/);

    await control.getByText(ABSOLUTE_OPTION_LABEL).click();
    await expectModeSettled(control, ABSOLUTE_OPTION_LABEL);
    await expect(studentTenRow).toHaveText(/Student\s*Ten\s*2\.33\s*1\.67\s*1\.67\s*1\.93/);
  });

  test('selects the baseline option with the keyboard arrow keys', async ({ page }) => {
    await installRuntimeMock(page, createBaselineModeScenario(PARTIAL_ATTEMPT_SKIPS));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    const absoluteRadio = control.getByRole('radio', { name: ABSOLUTE_OPTION_LABEL });
    const baselineRadio = control.getByRole('radio', { name: BASELINE_OPTION_LABEL });
    await expect(absoluteRadio).toBeChecked();

    const completenessPill = getCardCompletenessPill(page);
    await expect(completenessPill).toHaveText(ABSOLUTE_COMPLETENESS_PILL);

    await absoluteRadio.focus();
    await expect(absoluteRadio).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(baselineRadio).toBeChecked();
    await expect(absoluteRadio).not.toBeChecked();
    await expectModeSettled(control, BASELINE_OPTION_LABEL);
    await expect(completenessPill).toHaveText(BASELINE_COMPLETENESS_PILL);

    await page.keyboard.press('ArrowLeft');
    await expect(absoluteRadio).toBeChecked();
    await expectModeSettled(control, ABSOLUTE_OPTION_LABEL);
    await expect(completenessPill).toHaveText(ABSOLUTE_COMPLETENESS_PILL);
  });

  test('recovers the page from a baseline blocking failure through the mode control', async ({
    page,
  }) => {
    await installRuntimeMock(page, createBaselineModeScenario(DISJOINT_ATTEMPT_SKIPS));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    await expect(control).toBeVisible();
    // Three attempt candidates keep the control enabled on arrival.
    await expect(control).not.toHaveClass(/ant-segmented-disabled/);
    const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });
    await expect(card).toBeVisible();

    await control.getByText(BASELINE_OPTION_LABEL).click();
    const blockingTitle = page.getByText("Couldn't compute averages");
    await expect(blockingTitle).toBeVisible();
    // The retained last-successful result keeps the control enabled and the
    // user's chosen mode selected while the failure is displayed.
    await expect(control).not.toHaveClass(/ant-segmented-disabled/);
    await expect(control.getByRole('radio', { name: BASELINE_OPTION_LABEL })).toBeChecked();

    await page.mouse.move(0, 0);
    await control.getByText(ABSOLUTE_OPTION_LABEL).click();
    await expectModeSettled(control, ABSOLUTE_OPTION_LABEL);
    await expect(card).toBeVisible();
    await expect(blockingTitle).toHaveCount(0);
    await expect(control.getByRole('radio', { name: ABSOLUTE_OPTION_LABEL })).toBeChecked();
  });

  test('marks baseline-off heatmap columns and shows the caption only in baseline mode', async ({
    page,
  }) => {
    await installRuntimeMock(page, createBaselineModeScenario(PARTIAL_ATTEMPT_SKIPS));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });

    // Absolute mode: plain task headers, no caption.
    await card.click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Task 3', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /†/ })).toHaveCount(0);
    await expect(page.getByText(BASELINE_CAPTION)).toHaveCount(0);

    // Baseline mode: Task 3 is marked, the in-baseline tasks are not.
    await control.getByText(BASELINE_OPTION_LABEL).click();
    await expectModeSettled(control, BASELINE_OPTION_LABEL);
    await page.mouse.move(0, 0);

    const markedHeader = table.getByRole('columnheader', {
      name: `Task 3† — ${BASELINE_OFF_EXPLANATION}`,
    });
    await expect(markedHeader).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Task 3', exact: true })).toHaveCount(0);
    await expect(table.getByRole('columnheader', { name: 'Task 1', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Task 2', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /†/ })).toHaveCount(1);
    await expect(page.getByText(BASELINE_CAPTION)).toBeVisible();

    // The marked heading explains itself through its tooltip on keyboard focus.
    const markedHeading = table.getByRole('group', {
      name: `Task 3† ${BASELINE_OFF_EXPLANATION}`,
    });
    await expect(markedHeading).toHaveCount(1);
    await markedHeading.focus();
    await expect(
      page.getByRole('tooltip', { name: new RegExp(BASELINE_OFF_EXPLANATION) })
    ).toHaveText(BASELINE_OFF_EXPLANATION);
    await markedHeading.blur();
    await expect(
      page.getByRole('tooltip', { name: new RegExp(BASELINE_OFF_EXPLANATION) })
    ).toBeHidden();

    // Toggling back removes the marking and the caption without leaving the view.
    await control.getByText(ABSOLUTE_OPTION_LABEL).click();
    await expectModeSettled(control, ABSOLUTE_OPTION_LABEL);
    await expect(table.getByRole('columnheader', { name: /†/ })).toHaveCount(0);
    await expect(page.getByText(BASELINE_CAPTION)).toHaveCount(0);
  });

  test('shows the mode control with a visible focus ring across both themes', async ({
    page,
  }, testInfo) => {
    await installRuntimeMock(page, createBaselineModeScenario({}));
    await openHeatmapClass(page);

    const control = getModeControl(page);
    await expect(control).toBeVisible();
    await expect(control.getByRole('radio', { name: ABSOLUTE_OPTION_LABEL })).toBeChecked();

    await testInfo.attach('mode-control-light', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    // Enter keyboard modality, then focus the control so its focus-visible
    // outline applies (the ring is keyboard-modality gated).
    await page.keyboard.press('Tab');
    await control.focus();
    await expect(control).toBeFocused();
    const focusStyle = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    });
    expect(focusStyle.outlineStyle).toBe('solid');
    expect(focusStyle.outlineWidth).not.toBe('0px');
    expect(focusStyle.outlineColor).not.toBe('transparent');
    expect(focusStyle.outlineColor).not.toBe('rgba(0, 0, 0, 0)');

    // Dark theme: the control stays visible and usable, and the thumb motion
    // settles on the chosen option before the capture.
    const themeSwitch = page.getByRole('switch', { name: 'Dark mode' });
    await themeSwitch.click();
    await expect(themeSwitch).toBeChecked();
    const darkControl = getModeControl(page);
    await expect(darkControl).toBeVisible();
    await darkControl.getByText(BASELINE_OPTION_LABEL).click();
    await expectModeSettled(darkControl, BASELINE_OPTION_LABEL);
    await expect(darkControl.getByRole('radio', { name: BASELINE_OPTION_LABEL })).toBeChecked();

    await testInfo.attach('mode-control-dark', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  });
});
