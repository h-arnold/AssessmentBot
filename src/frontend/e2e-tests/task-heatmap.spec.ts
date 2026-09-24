import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock, releaseNextDeferredSuccess } from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_CLASS_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_LABEL = 'Classes';
const HEATMAP_TABLE_NAME = 'Task Heatmap';
const EXCLUDED_METRIC_ACCESSIBLE_NAME = 'Excluded from average: displayed work had zero weighting.';
/** Number of metric sub-columns per task group (Completeness, Accuracy, SPaG). */
const METRIC_SUBCOLUMN_COUNT = 3;
const EXCLUDED_AGGREGATE_COUNT = 4;
const EXPECTED_EXCLUDED_COLUMN_WIDTH = 72;
const MAX_ZERO_WEIGHT_TAB_PRESSES = 40;
/** Number of keyboard steps to nudge the lower band-filter handle up past zero. */
const LOWER_HANDLE_NUDGE_STEPS = 3;
/** Human-readable task titles sourced from the warm-up partial (taskColumn.taskTitle). */
const HEATMAP_TASK_TITLES = ['Task 1', 'Task 2', 'Task 3'];

/**
 * Navigate from the root shell to the heatmap class overview (ready state).
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>}
 */
async function openHeatmapClass(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // The class appears under a year-group panel; click its "View" button.
  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  // Wait for the ready-state Recent Assignments section (an antd Card title div).
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

test.describe('Task Heatmap E2E journey', () => {
  test('opens heatmap from recent assignment card', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    // Click the recent assignment card to open the heatmap (uses primaryTitle display).
    const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });
    await card.click();

    // Header: assignment display title (primaryTitle) + class name.
    await expect(
      page.getByRole('heading', { name: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: HEATMAP_CLASS_NAME })).toBeVisible();

    // Grouped header: split student name columns + Task 1/2/3 with Completeness/Accuracy/SPaG.
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Forename' })).toHaveCount(1);
    await expect(table.getByRole('columnheader', { name: 'Surname' })).toHaveCount(1);
    const studentTwoRow = table
      .locator('tbody tr.ant-table-row')
      .filter({ has: page.locator('[aria-label^="Student Two,"]') });
    await expect(studentTwoRow.locator('td').nth(0)).toHaveText('Student');
    await expect(studentTwoRow.locator('td').nth(1)).toHaveText('Two');
    for (const taskTitle of HEATMAP_TASK_TITLES) {
      await expect(table.getByRole('columnheader', { name: taskTitle })).toHaveCount(1);
    }
    await expect(table.getByRole('columnheader', { name: 'Completeness' })).toHaveCount(
      METRIC_SUBCOLUMN_COUNT
    );

    // Student Two's Task 1 Completeness cell shows green band + aria-label (integer, 0 dp).
    // The aria-label is applied to BOTH the `<td role="cell">` (via onCell) and the nested
    // popover trigger, so a bare `[aria-label=...]` selector matches two elements.
    const cell = page.locator(`[role="button"][aria-label="Student Two, Task 1, Completeness: 5"]`);
    await expect(cell).toHaveCount(1);
  });

  test('preserves zero-weight scores while excluding assignment aggregates', async ({ page }) => {
    const scenario = createHeatmapScenario({ zeroWeightAssignment: true });
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    const assignmentCard = page
      .getByRole('button')
      .filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
      .first();
    const excludedMetrics = assignmentCard.locator(
      `[aria-label="${EXCLUDED_METRIC_ACCESSIBLE_NAME}"]:visible`
    );
    // The card exposes the three criteria and the overall aggregate; each
    // aggregate carries the same explicit accessible excluded state.
    await expect(excludedMetrics).toHaveCount(EXCLUDED_AGGREGATE_COUNT);
    await excludedMetrics.first().focus();
    await expect(excludedMetrics.first()).toHaveAttribute(
      'aria-label',
      EXCLUDED_METRIC_ACCESSIBLE_NAME
    );

    await assignmentCard.click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    const zeroWeightLabel =
      'Task 1 Zero weighting — scores are shown but do not contribute to averages.';
    const taskHeaderLabel = table.getByRole('group', {
      name: zeroWeightLabel,
      exact: true,
    });
    await expect(taskHeaderLabel).toHaveCount(1);
    const zeroWeightHeader = table.locator('th.task-heatmap-zero-weight-group').first();
    await expect(zeroWeightHeader).toHaveClass(/task-heatmap-zero-weight-group/);
    const headerBoxShadow = await zeroWeightHeader.evaluate(
      (element) => getComputedStyle(element).boxShadow
    );
    expect(headerBoxShadow).toMatch(/2(?:px 0){3}px inset/);
    expect(headerBoxShadow).toMatch(/-2(?:px 0){3}px inset/);
    await taskHeaderLabel.hover();
    await expect(page.getByRole('tooltip')).toHaveText(
      'Zero weighting — scores are shown but do not contribute to averages.'
    );
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const focusStart = page.getByRole('button', { name: 'Back to Class overview' });
    await focusStart.focus();
    for (let tabPress = 0; tabPress < MAX_ZERO_WEIGHT_TAB_PRESSES; tabPress += 1) {
      await page.keyboard.press('Tab');
      if (await taskHeaderLabel.evaluate((element) => element === document.activeElement)) {
        break;
      }
    }
    await expect(taskHeaderLabel).toBeFocused();
    const focusStyle = await taskHeaderLabel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(focusStyle.outlineStyle).toBe('solid');
    expect(focusStyle.outlineWidth).toBe('2px');
    expect(focusStyle.outlineOffset).toBe('2px');
    expect(focusStyle.outlineColor).not.toBe('transparent');
    await expect(page.getByRole('tooltip')).toHaveText(
      'Zero weighting — scores are shown but do not contribute to averages.'
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const studentTwoScore = table.locator(
      '[role="button"][aria-label="Student Two, Task 1, Completeness: 5"]'
    );
    await expect(studentTwoScore).toHaveCount(1);
    await expect(
      table.locator('[role="button"][aria-label="Student One, Task 1, Completeness: N"]')
    ).toHaveCount(1);

    const scoreBackground = await studentTwoScore.evaluate((element) => {
      const cell = element.closest('td');
      return cell ? getComputedStyle(cell).backgroundColor : '';
    });
    expect(scoreBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(scoreBackground).not.toBe('transparent');

    await expect(table.locator('.task-heatmap-zero-weight-group')).toHaveCount(
      METRIC_SUBCOLUMN_COUNT
    );
    await expect(table.locator('.task-heatmap-zero-weight-first').first()).toHaveCount(1);
    await expect(table.locator('.task-heatmap-zero-weight-last').first()).toHaveCount(1);
    const firstMetricCell = table.locator('.task-heatmap-zero-weight-first').first();
    const lastMetricCell = table.locator('.task-heatmap-zero-weight-last').first();
    const [firstBoxShadow, lastBoxShadow] = await Promise.all([
      firstMetricCell.evaluate((element) => getComputedStyle(element).boxShadow),
      lastMetricCell.evaluate((element) => getComputedStyle(element).boxShadow),
    ]);
    expect(firstBoxShadow).toMatch(/2(?:px 0){3}px inset/);
    expect(lastBoxShadow).toMatch(/-2(?:px 0){3}px inset/);
    await expect(table.getByRole('columnheader', { name: 'Forename' })).not.toHaveClass(
      /task-heatmap-zero-weight/
    );
    await expect(table.getByRole('columnheader', { name: 'Surname' })).not.toHaveClass(
      /task-heatmap-zero-weight/
    );
  });

  test('resolves excluded aggregate cell colours in light and dark themes', async ({ page }) => {
    const scenario = createHeatmapScenario({ zeroWeightAssignment: true });
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await expect(page.getByText('Student Averages')).toBeVisible();
    const averagesTable = page.getByRole('table').last();
    await expect(averagesTable).toBeVisible();

    const excludedCell = averagesTable
      .locator(`[aria-label*="${EXCLUDED_METRIC_ACCESSIBLE_NAME}"]`)
      .first();
    await expect(excludedCell).toHaveCount(1);
    await expect(excludedCell).toHaveAttribute(
      'aria-label',
      new RegExp(
        `^Student .+, (Completeness|Accuracy|SPaG|Average): ${EXCLUDED_METRIC_ACCESSIBLE_NAME}$`
      )
    );
    const excludedText = excludedCell.getByText('Excluded', { exact: true });
    await expect(excludedText).toHaveCount(1);
    const excludedGeometry = await excludedCell.evaluate(
      (cell, text) => {
        const cellElement = cell as HTMLElement;
        const textElement = text as HTMLElement;
        const cellRect = cellElement.getBoundingClientRect();
        const textRect = textElement.getBoundingClientRect();
        return {
          cellClientHeight: cellElement.clientHeight,
          cellClientWidth: cellElement.clientWidth,
          cellOffsetWidth: cellElement.offsetWidth,
          cellScrollHeight: cellElement.scrollHeight,
          cellScrollWidth: cellElement.scrollWidth,
          cellTop: cellRect.top,
          textBottom: textRect.bottom,
          textHeight: textRect.height,
          textTop: textRect.top,
          textRight: textRect.right,
          cellBottom: cellRect.bottom,
          cellRight: cellRect.right,
        };
      },
      await excludedText.elementHandle()
    );
    expect(excludedGeometry.cellOffsetWidth).toBeGreaterThanOrEqual(EXPECTED_EXCLUDED_COLUMN_WIDTH);
    expect(excludedGeometry.cellScrollWidth).toBeLessThanOrEqual(excludedGeometry.cellClientWidth);
    expect(excludedGeometry.cellScrollHeight).toBeLessThanOrEqual(
      excludedGeometry.cellClientHeight
    );
    expect(excludedGeometry.textHeight).toBeLessThanOrEqual(excludedGeometry.cellClientHeight);
    expect(excludedGeometry.textTop).toBeGreaterThanOrEqual(excludedGeometry.cellTop - 1);
    expect(excludedGeometry.textBottom).toBeLessThanOrEqual(excludedGeometry.cellBottom + 1);
    expect(excludedGeometry.textRight).toBeLessThanOrEqual(excludedGeometry.cellRight + 1);
    const readResolvedColours = async (cell: typeof excludedCell) =>
      cell.evaluate((element) => {
        const style = getComputedStyle(element);
        const originalComputedBackground = style.backgroundColor;
        const originalComputedText = style.color;
        const originalBackground = element.style.backgroundColor;
        const originalText = element.style.color;
        element.style.backgroundColor = 'var(--ant-color-fill-quaternary)';
        element.style.color = 'var(--ant-color-text-secondary)';
        const tokenStyle = getComputedStyle(element);
        const colours = {
          background: originalComputedBackground,
          text: originalComputedText,
          tokenBackground: tokenStyle.backgroundColor,
          tokenText: tokenStyle.color,
          tokenBackgroundValue: style.getPropertyValue('--ant-color-fill-quaternary').trim(),
          tokenTextValue: style.getPropertyValue('--ant-color-text-secondary').trim(),
        };
        element.style.backgroundColor = originalBackground;
        element.style.color = originalText;
        return colours;
      });

    const lightColours = await readResolvedColours(excludedCell);
    expect(lightColours.tokenBackgroundValue).not.toBe('');
    expect(lightColours.tokenTextValue).not.toBe('');
    expect(lightColours.background).toBe(lightColours.tokenBackground);
    expect(lightColours.text).toBe(lightColours.tokenText);
    const themeSwitch = page.getByRole('switch', { name: 'Dark mode' });
    await themeSwitch.click();
    await expect(themeSwitch).toBeChecked();

    await expect
      .poll(async () => {
        const colours = await readResolvedColours(excludedCell);
        return colours.background !== lightColours.background && colours.text !== lightColours.text;
      })
      .toBe(true);
    const darkColours = await readResolvedColours(excludedCell);
    expect(darkColours.tokenBackgroundValue).not.toBe('');
    expect(darkColours.tokenTextValue).not.toBe('');
    expect(darkColours.background).toBe(darkColours.tokenBackground);
    expect(darkColours.text).toBe(darkColours.tokenText);
    expect(darkColours.background).not.toBe(lightColours.background);
    expect(darkColours.text).not.toBe(lightColours.text);
  });

  test('band filter hides non-matching rows', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Open the numeric range (band) filter on the first Completeness column header.
    const completenessHeader = table.getByRole('columnheader', { name: 'Completeness' }).first();
    await completenessHeader.getByRole('button').click();

    // The metric band filter renders an Ant Design range Slider inside the
    // antd dropdown overlay (not a text menu), per MetricRangeFilterDropdown.
    const filterPopup = page.locator('.ant-dropdown:visible').last();
    await expect(filterPopup).toBeVisible();

    // Move the lower (min) slider handle up via the keyboard to activate a numeric
    // range that excludes Not-Attempted (N) rows. The default `includeNotAttempted`
    // is false, so any active numeric range hides N rows while keeping scored rows
    // (e.g. Student Two, score 5) visible.
    //
    // Keyboard interaction is used deliberately instead of a pixel-positioned
    // `mouse.click` on the rail: the rail click was position-sensitive and flaked
    // under parallel `--ci` execution when layout settled late.
    const slider = filterPopup.locator('.ant-slider').first();
    await expect(slider).toBeVisible();
    const lowerHandle = slider.locator('.ant-slider-handle').first();
    await expect(lowerHandle).toBeVisible();
    await lowerHandle.focus();
    // Step the lower bound up past zero so N (which sits below the numeric range)
    // is excluded. A few steps guarantee we clear the threshold regardless of the
    // metric's exact step size.
    for (let step = 0; step < LOWER_HANDLE_NUDGE_STEPS; step += 1) {
      await page.keyboard.press('ArrowUp');
    }

    // Student One (N) should disappear; a scored (green-band) student should remain.
    await expect(table.locator('tbody tr').filter({ hasText: 'One' })).toHaveCount(0);
    await expect(table.locator('tbody tr').filter({ hasText: 'Two' })).toHaveCount(1);
  });

  test('surname sort reverses pre-sorted order', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Capture the first data-row surname before any interaction.
    const defaultFirstSurnameCell = table
      .locator('tbody tr.ant-table-row')
      .first()
      .locator('td')
      .nth(1);
    const defaultFirstSurnameRaw = await defaultFirstSurnameCell.textContent();
    const defaultFirstSurname = defaultFirstSurnameRaw?.trim();
    expect(defaultFirstSurname).toBeTruthy();

    // Click Surname twice to reverse the derived surname sort order.
    await table.getByRole('columnheader', { name: 'Surname' }).click();
    await table.getByRole('columnheader', { name: 'Surname' }).click();

    // Direction-agnostic: after the toggle the order must differ from the default.
    const afterFirstSurnameCell = table
      .locator('tbody tr.ant-table-row')
      .first()
      .locator('td')
      .nth(1);
    const afterFirstSurnameRaw = await afterFirstSurnameCell.textContent();
    const afterFirstSurname = afterFirstSurnameRaw?.trim();
    expect(afterFirstSurname?.trim()).not.toBe(defaultFirstSurname?.trim());
  });

  test('back returns to overview', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Class overview' }).click();

    // Overview content visible again (antd Card title divs, not headings).
    await expect(page.getByText('Recent Assignments')).toBeVisible();
    await expect(page.getByText('Student Averages')).toBeVisible();
  });

  test('loading skeleton then ready', async ({ page }) => {
    const scenario = createHeatmapScenario({ deferredClass: true });
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
    await classCard.getByRole('button', { name: 'View' }).click();

    // Loading skeleton present while the heatmap table is NOT yet rendered.
    const heatmapTable = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(heatmapTable).toHaveCount(0);
    await expect(page.locator('.ant-skeleton').first()).toBeVisible();

    // Release deferred class and expect the class overview to reach ready.
    await releaseNextDeferredSuccess(page);
    await expect(page.getByText('Recent Assignments')).toBeVisible();

    // Open the heatmap from the recent assignment card and expect the table.
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    await expect(heatmapTable).toBeVisible();
    await expect(page.locator('.ant-skeleton')).toHaveCount(0);
  });

  test('empty-state: no submissions', async ({ page }) => {
    // No submissions → full roster with N cells + "No submissions yet" caption.
    const noSubScenario = createHeatmapScenario({ emptySubmissions: true });
    await installRuntimeMock(page, noSubScenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr').filter({ hasText: 'One' })).toHaveCount(1);
    await expect(page.getByText('No submissions yet')).toBeVisible();
  });

  test('empty-state: zero tasks', async ({ page }) => {
    // Zero tasks → no task columns render.
    const zeroTaskScenario = createHeatmapScenario({ zeroTasks: true });
    await installRuntimeMock(page, zeroTaskScenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

    const zeroTable = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(zeroTable).toBeVisible();
    await expect(zeroTable.getByRole('columnheader', { name: /task_\d/ })).toHaveCount(0);
  });

  test('metric icons visible and themed in light and dark modes', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // The three metric icons render in the grouped column headers.
    const completenessIcon = table.locator('[aria-label="Completeness"]').first();
    const accuracyIcon = table.locator('[aria-label="Accuracy"]').first();
    const spagIcon = table.locator('[aria-label="SPaG"]').first();

    // Light mode: every metric icon is visible.
    await expect(completenessIcon).toBeVisible();
    await expect(accuracyIcon).toBeVisible();
    await expect(spagIcon).toBeVisible();

    // Capture the themed colour in light mode (driven by theme.useToken().colorText).
    const lightColor = await completenessIcon.evaluate(
      (element) => getComputedStyle(element).color
    );

    // Toggle dark mode via the header switch.
    const themeSwitch = page.getByRole('switch', { name: 'Dark mode' });
    await expect(themeSwitch).toBeVisible();
    await themeSwitch.click();
    await expect(themeSwitch).toBeChecked();

    // Dark mode: icons remain visible and their themed colour adapts to the dark algorithm.
    await expect(completenessIcon).toBeVisible();
    await expect(accuracyIcon).toBeVisible();
    await expect(spagIcon).toBeVisible();

    const darkColor = await completenessIcon.evaluate((element) => getComputedStyle(element).color);
    expect(darkColor).not.toBe(lightColor);
  });

  test('metric icons expose aria-labels and themed stroke in header cells', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Each metric renders one icon per task group inside the grouped header row
    // (the body cells render their own per-cell metric icons, so scope to `thead`).
    const expectedLabels = ['Completeness', 'Accuracy', 'SPaG'];
    for (const label of expectedLabels) {
      // The aria-label is on the SVG element itself (direct createElement rendering).
      const headerIcons = table.locator(`thead svg[aria-label="${label}"]`);

      // One icon per task group column, all visible in the header cells.
      await expect(headerIcons).toHaveCount(METRIC_SUBCOLUMN_COUNT);
      await expect(headerIcons.first()).toBeVisible();

      // The Lucide SVG carries stroke attributes; the colour resolves from the
      // wrapping span's `token.colorText` (theme token) via `currentColor`.
      const strokeWidth = await headerIcons.first().getAttribute('stroke-width');
      expect(strokeWidth).toBeTruthy();
    }
  });
});
