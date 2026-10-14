import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import { AssignmentDefinitionPartialSchema } from '../src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { ClassFullSchema } from '../src/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  buildAssignmentDefinitionPartial,
  buildClassFullDocument,
} from './helpers/task-heatmap-fixtures';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
  openHeatmapClass,
} from './helpers/task-heatmap-end-to-end-helpers';

const TASK_COUNT = 3;
const LARGE_TASK_COUNT = 30;
const INFORMATION_BUTTON_COUNT = 6;
const ALIGNMENT_TOLERANCE = 1;

/**
 * Check equal card heights and matching task-row positions on desktop.
 * @param {Page} page - Browser page showing both summary cards.
 * @returns {Promise<void>} Resolves after checking the visible layout.
 */
async function expectAlignedSummaryCards(page: Page): Promise<void> {
  const completeness = page.getByRole('region', { name: 'Completeness summary' });
  const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
  const completenessBox = await completeness.boundingBox();
  const accuracyBox = await accuracy.boundingBox();
  expect(Math.abs(completenessBox!.height - accuracyBox!.height)).toBeLessThanOrEqual(
    ALIGNMENT_TOLERANCE
  );
  for (let index = 0; index < TASK_COUNT; index += 1) {
    const left = await completeness.getByRole('listitem').nth(index).boundingBox();
    const right = await accuracy.getByRole('listitem').nth(index).boundingBox();
    expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(ALIGNMENT_TOLERANCE);
  }
}

/**
 * Open the standalone builder and select the fixture class without an assignment.
 * @param {Page} page - Browser page with the runtime scenario already installed.
 * @returns {Promise<void>} Resolves once the assignment selector is enabled.
 */
async function openStandaloneHeatmaps(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
  await page.getByRole('combobox', { name: 'Class', exact: true }).click();
  await selectVisibleOption(page, HEATMAP_CLASS_NAME);
  await expect(page.getByRole('combobox', { name: 'Assignments', exact: true })).toBeEnabled();
}

test.describe('Task Heatmap assignment summaries', () => {
  test('shows summaries above the standalone Heatmaps table for one selected assignment', async ({
    page,
  }, testInfo) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openStandaloneHeatmaps(page);
    await expect(page.getByRole('region', { name: 'Completeness summary' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Assignments', exact: true }).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await page.keyboard.press('Escape');
    const completeness = page.getByRole('region', { name: 'Completeness summary' });
    const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
    await expect(completeness.getByText('7 of 10', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('2.50/5', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('3.29/5', { exact: true })).toBeVisible();
    await expect(completeness.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await expect(accuracy.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await expectAlignedSummaryCards(page);
    const table = page.getByRole('table', { name: 'Task Heatmap' });
    await expect(table).toBeVisible();
    const cardsBox = await accuracy.boundingBox();
    const tableBox = await table.boundingBox();
    expect(cardsBox!.y + cardsBox!.height).toBeLessThan(tableBox!.y);
    await accuracy.getByRole('button', { name: 'About accuracy', exact: true }).click();
    await expect(page.getByRole('tooltip')).toContainText(
      'less than 3 points on a scale from 0 to 5'
    );
    await accuracy.getByRole('button', { name: 'About accuracy', exact: true }).click();
    await expect(page.getByRole('tooltip')).toBeHidden();
    await testInfo.attach('standalone-summary', {
      body: await page.screenshot({
        fullPage: true,
      }),
      contentType: 'image/png',
    });
    await page.getByRole('combobox', { name: 'Assignments', exact: true }).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await page.keyboard.press('Escape');
    await expect(completeness).toHaveCount(0);
    await expect(accuracy).toHaveCount(0);
    await expect(table).toHaveCount(0);
  });

  test('keeps both summary cards as notices for multiple assignments sharing one definition', async ({
    page,
  }, testInfo) => {
    await installRuntimeMock(page, createHeatmapScenario({ multipleAssignments: true }));
    await openStandaloneHeatmaps(page);
    const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
    await assignments.click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await page.keyboard.press('Escape');
    const completeness = page.getByRole('region', { name: 'Completeness summary' });
    const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
    await expect(completeness.getByText('7 of 10', { exact: true })).toBeVisible();
    await assignments.click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE, 1);
    await page.keyboard.press('Escape');
    const notice =
      'Multiple assignments are selected. Summaries are available for one assignment at a time. Select a single assignment to view its completeness and accuracy summaries.';
    for (const card of [completeness, accuracy]) {
      await expect(card.getByText(notice, { exact: true })).toBeVisible();
      await expect(card.getByRole('listitem')).toHaveCount(0);
      await expect(card.getByRole('button')).toHaveCount(0);
    }
    const table = page.getByRole('table', { name: 'Task Heatmap' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /shared definition/ })).toHaveCount(1);
    await expect(table.getByRole('columnheader', { name: 'Task 1', exact: true })).toHaveCount(1);
    await expect(
      table.getByRole('button', { name: 'Student Two, Task 1, Completeness: 5', exact: true })
    ).toHaveCount(1);
    await page.getByRole('heading', { name: HEATMAP_CLASS_NAME, exact: true }).click();
    await testInfo.attach('standalone-summary-notices', {
      body: await page.screenshot({
        fullPage: true,
      }),
      contentType: 'image/png',
    });
    await assignments.click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await page.keyboard.press('Escape');
    await expect(completeness.getByText(notice, { exact: true })).toHaveCount(0);
    await expect(completeness.getByText('7 of 10', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('2.50/5', { exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /shared definition/ })).toHaveCount(0);
  });

  test('shows whole-class task evidence above the heatmap in light and dark modes', async ({
    page,
  }, testInfo) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const completeness = page.getByRole('region', { name: 'Completeness summary' });
    const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
    await expect(completeness).toBeVisible();
    await expect(accuracy).toBeVisible();
    for (const card of [completeness, accuracy]) {
      await expect(card.getByText('0 assessment errors', { exact: true })).toHaveCount(0);
    }
    await expect(
      completeness.getByText('Completeness threshold: 4/5', { exact: true })
    ).toHaveCount(0);
    await expect(accuracy.getByText('Accuracy threshold: 3/5', { exact: true })).toHaveCount(0);
    await expect(completeness.getByText('7 of 10', { exact: true })).toBeVisible();
    await expect(completeness.getByText('0 of 10', { exact: true })).toBeVisible();
    await expect(completeness.getByText('at or above threshold', { exact: true })).toHaveCount(
      TASK_COUNT
    );
    await expect(
      completeness.getByText('Tasks requiring attention:', { exact: true })
    ).toBeVisible();
    await expect(accuracy.getByText('Most accurate:', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('Least accurate:', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('Task 1, Task 3', { exact: true })).toBeVisible();
    await expect(accuracy.getByText('2.50/5', { exact: true })).toBeVisible();
    await expect(completeness.getByRole('button', { name: /Show all/ })).toHaveCount(0);
    await expectAlignedSummaryCards(page);
    const taskOne = completeness.getByRole('listitem', { name: 'Task 1', exact: true });
    await taskOne.getByText('2 not attempted / not applicable', { exact: true }).focus();
    await expect(page.getByRole('tooltip')).toContainText(
      'N means not attempted or not applicable'
    );
    await taskOne.getByText('2 not attempted / not applicable', { exact: true }).blur();
    await expect(page.getByRole('tooltip')).toBeHidden();
    const cardsBox = await completeness.boundingBox();
    const tableBox = await page.getByRole('table', { name: 'Task Heatmap' }).boundingBox();
    expect(cardsBox!.y + cardsBox!.height).toBeLessThan(tableBox!.y);
    await testInfo.attach('summary-desktop-light', {
      body: await page.screenshot({
        fullPage: true,
      }),
      contentType: 'image/png',
    });
    await page.getByRole('switch').click();
    await expect(page.getByRole('switch')).toBeChecked();
    await expect(accuracy).toBeVisible();
    await testInfo.attach('summary-desktop-dark', {
      body: await page.screenshot({
        fullPage: true,
      }),
      contentType: 'image/png',
    });
  });

  test('opens and closes every summary information button and shows its explanation', async ({
    page,
  }, testInfo) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const explanations = [
      {
        name: 'About completeness',
        text: 'Students meet the completeness threshold when they score at least 4 points on a scale from 0 to 5. Scores below 4 points do not meet the threshold. Meeting the threshold does not necessarily mean the task is fully completed.',
      },
      {
        name: 'About tasks requiring attention',
        text: 'More than half the class scores below 4 points for completeness or is marked N (not attempted or not applicable). Assessment errors are not included.',
      },
      {
        name: 'About accuracy',
        text: 'A task requires attention when its average accuracy is less than 3 points on a scale from 0 to 5. An average of exactly 3 points meets the threshold. The average uses numeric scores only; N values and assessment errors are excluded.',
      },
      {
        name: 'About most accurate',
        text: 'The highest average accuracy among tasks with numeric assessments. Tied tasks are included.',
      },
      {
        name: 'About least accurate',
        text: 'The lowest average accuracy among tasks with numeric assessments. This does not necessarily mean it is below threshold. Tied tasks are included.',
      },
      {
        name: 'About below accuracy threshold',
        text: 'Tasks with average accuracy less than 3 points on a scale from 0 to 5. An average of 3 points or higher is not below the threshold. N values and assessment errors are excluded from the average.',
      },
    ];
    await expect(page.getByRole('button', { name: /^About / })).toHaveCount(
      INFORMATION_BUTTON_COUNT
    );
    for (const explanation of explanations) {
      await test.step(explanation.name, async () => {
        const button = page.getByRole('button', { name: explanation.name, exact: true });
        await button.click();
        await expect(page.getByRole('tooltip')).toHaveText(explanation.text);
        await testInfo.attach(explanation.name, {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
        await button.click();
        await expect(page.getByRole('tooltip')).toBeHidden();
      });
    }
    const completenessInformation = page.getByRole('button', {
      name: 'About completeness',
      exact: true,
    });
    await completenessInformation.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tooltip')).toHaveText(explanations[0].text);
    await page
      .getByRole('region', { name: 'Completeness summary' })
      .getByText('Completeness', { exact: true })
      .click();
    await expect(page.getByRole('tooltip')).toBeHidden();
  });

  test('does not fabricate accuracy when tasks have not been attempted', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario({ emptySubmissions: true }));
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
    await expect(accuracy.getByText('No numeric assessments', { exact: true })).toHaveCount(
      TASK_COUNT
    );
    await expect(accuracy.getByText('None', { exact: true })).toHaveCount(TASK_COUNT);
  });

  test('shows non-zero assessment errors in red with an explanation', async ({
    page,
  }, testInfo) => {
    const classDocument = ClassFullSchema.parse(buildClassFullDocument(false));
    classDocument.assignments[0].submissions[0].items.task_001.assessments = {};
    const scenario = createHeatmapScenario();
    scenario.getABClass = [
      { kind: 'success', data: classDocument },
      { kind: 'success', data: classDocument },
    ];
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    for (const name of ['Completeness summary', 'Accuracy summary']) {
      const card = page.getByRole('region', { name });
      const error = card
        .getByRole('listitem', { name: 'Task 1', exact: true })
        .getByText('1 assessment error', { exact: true });
      await expect(error).toBeVisible();
      await expect(error).toHaveClass(/ant-typography-danger/);
      await expect(card.getByText('0 assessment errors', { exact: true })).toHaveCount(0);
      await error.focus();
      await expect(page.getByRole('tooltip')).toHaveText(
        'An assessment error means the analyser could not produce a usable score.'
      );
      await error.blur();
      await expect(page.getByRole('tooltip')).toBeHidden();
    }
    await testInfo.attach('summary-assessment-errors', {
      body: await page.screenshot({
        fullPage: true,
      }),
      contentType: 'image/png',
    });
  });

  test('shows no-task states', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario({ zeroTasks: true }));
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    await expect(
      page.getByRole('region', { name: 'Completeness summary' }).getByText('No tasks to summarise.')
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Accuracy summary' }).getByText('No tasks to summarise.')
    ).toBeVisible();
  });

  test('retains zero-weight display evidence', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario({ zeroWeightAssignment: true }));
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const completeness = page.getByRole('region', { name: 'Completeness summary' });
    await expect(completeness.getByText('7 of 10', { exact: true })).toBeVisible();
    await expect(completeness.getByText('Zero weighting', { exact: true })).toHaveCount(TASK_COUNT);
  });

  test('keeps 30-task summaries compact and expands each card independently', async ({
    page,
  }, testInfo) => {
    const partial = AssignmentDefinitionPartialSchema.parse(
      buildAssignmentDefinitionPartial(false, false)
    );
    const additionalTasks = Array.from({ length: LARGE_TASK_COUNT - TASK_COUNT }, (_, index) => {
      return {
        taskId: `task_extra_${index + 1}`,
        taskTitle: `Task ${index + TASK_COUNT + 1}`,
        taskWeighting: 1,
      };
    });
    const scenario = createHeatmapScenario();
    scenario.getAssignmentDefinitionPartials = [
      { kind: 'success', data: [{ ...partial, tasks: [...partial.tasks, ...additionalTasks] }] },
    ];
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const completeness = page.getByRole('region', { name: 'Completeness summary' });
    const accuracy = page.getByRole('region', { name: 'Accuracy summary' });
    await expect(completeness.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await expect(accuracy.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await expect(completeness.getByRole('listitem').first()).toHaveAccessibleName('Task 2');
    await expect(accuracy.getByRole('listitem').first()).toHaveAccessibleName('Task 1');
    await expect(
      completeness.getByText('Task 2, Task 3, Task 4 (+26 more)', { exact: true })
    ).toBeVisible();
    await testInfo.attach('summary-30-tasks', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    const showCompleteness = completeness.getByRole('button', { name: 'Show all 30 tasks' });
    await expect(showCompleteness).toHaveAttribute('aria-expanded', 'false');
    await showCompleteness.focus();
    await page.keyboard.press('Enter');
    await expect(completeness.getByRole('listitem')).toHaveCount(LARGE_TASK_COUNT);
    await expect(
      completeness.getByRole('listitem', { name: 'Task 30', exact: true })
    ).toBeVisible();
    await expect(accuracy.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await expect(completeness.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await completeness.getByRole('button', { name: 'Show less' }).click();
    await expect(completeness.getByRole('listitem')).toHaveCount(TASK_COUNT);
    await accuracy.getByRole('button', { name: 'Show all 30 tasks' }).click();
    await expect(accuracy.getByRole('listitem')).toHaveCount(LARGE_TASK_COUNT);
    await expect(accuracy.getByRole('listitem', { name: 'Task 30', exact: true })).toContainText(
      'No numeric assessments'
    );
    await accuracy.getByRole('button', { name: 'Show less' }).click();
    await expect(accuracy.getByRole('listitem')).toHaveCount(TASK_COUNT);
  });
});
