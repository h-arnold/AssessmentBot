/**
 * Browser journeys for a legacy assignment's real results and its
 * task-heatmap status tag.
 *
 * @remarks
 * The journeys serve marker-only legacy clones of the canonical `medium` class
 * graph: the selected assignment carries `'legacy'` in its class snapshot,
 * while every score, artefact and sibling assignment keeps its saved value. Nine
 * journeys also serve a legacy full read and mark that read `'legacy'`
 * too; the corrupt-record and stored-error journeys serve current-format full
 * reads. They prove the read contract the feature targets:
 *
 * - a legacy assignment shows its numeric scores and source previews unchanged;
 * - a corrupt task shows E beside its healthy siblings;
 * - a current assignment whose saved items carry explicit
 *   `REASSESSMENT_REQUIRED` errors still shows the existing preview alert;
 * - current sibling assignments are unaffected by another assignment's marker.
 *
 * The status-tag journeys prove the layout contract in
 * `LEGACY_ASSIGNMENT_READ_LAYOUT.md`: the tag comes from the selected
 * assignment's `'legacy'` marker in the loaded class, sits immediately before
 * Re-run Assessment, never captures focus, and is neither removed optimistically
 * nor dropped by a failed rerun. No live Google or LLM call is made.
 *
 * The scenario plumbing (queues, overrides, shared navigation helpers) lives in
 * `helpers/legacy-assignment-results-journeys.ts`.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { expect, test, type Page } from '@playwright/test';
import { SOURCE_ACTION_LABEL } from '@/features/taskHeatmap/TaskPreviewCard';
import { releaseNextDeferredSuccess } from './shared/endToEndRuntimeMocks';
import {
  cellLabel,
  CORRUPT_RECORD_REASONING,
  CORRUPTION_DESCRIPTION,
  JOURNEY_TASK_ID,
  LEGACY_ASSESSMENT_REASONING,
  MIXED_STUDENT_ID,
  openCell,
  openEmbeddedHeatmap,
  openErrorClass,
  previewPopover,
  REASSESSMENT_COPY,
  responseRenderer,
  sourceAlert,
  withLegacyClassAssignment,
  withMissingCriterion,
  withStoredReassessmentError,
} from './helpers/assessment-error-preview-journeys';
import {
  HEALTHY_STUDENT_NAME,
  HEALTHY_TEXT_STUDENT_NAME,
  healthyCell,
  JOURNEY_TITLE,
  LEGACY_ASSIGNMENT_ID,
  LEGACY_STUDENT_NAME,
  legacyOverrides,
  openLegacyHeatmap,
  rerunClassQueue,
  SIBLING_ASSIGNMENT_ID,
  SIBLING_TITLE,
  successQueue,
  warmUpQueue,
} from './helpers/legacy-assignment-results-journeys';
import {
  expectNavActionOrder,
  expectTagNotClippedOrOverlapped,
  readPageOverflowWidth,
  readTagComputedColour,
  REASSESSMENT_TAG_TEXT,
  reassessmentTag,
} from './helpers/legacy-reassessment-tag-layout';

const TABLE_NAME = 'Task Heatmap';
const BACK_LABEL = 'Back to Class overview';
const RE_RUN_LABEL = 'Re-run Assessment';
const REFRESH_LABEL = 'Refresh';
const CLOSE_LABEL = 'Close';
const INTERNAL_ERROR_COPY =
  'An internal error occurred. Please try again or contact support if the issue persists.';

/**
 * Baseline the page overflow on a surface without the tag, then open the
 * legacy heatmap and assert the tag's layout.
 *
 * @remarks
 * The tag renders with the legacy heatmap, so the before reading is taken on
 * the current sibling's heatmap: the same surface without the tag, so the
 * comparison isolates the tag's width.
 *
 * @param {Page} page - The Playwright page.
 * @param {'same-row' | 'wrapped'} orderMode - Expected navigation row topology.
 * @returns {Promise<void>} Resolves once the layout assertions pass.
 */
async function expectTagLayoutAtViewport(page: Page, orderMode: 'same-row' | 'wrapped') {
  await openErrorClass(page, legacyOverrides());
  await openEmbeddedHeatmap(page, SIBLING_ASSIGNMENT_ID);
  const overflowWidthBeforeTag = await readPageOverflowWidth(page);
  await page.getByRole('button', { name: BACK_LABEL }).click();
  await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);

  await expect(reassessmentTag(page)).toHaveCount(1);
  await expectNavActionOrder(page, orderMode);
  await expectTagNotClippedOrOverlapped(page, overflowWidthBeforeTag, orderMode);
}

test.describe('Embedded heatmap — legacy assignment results', () => {
  test('shows real legacy scores and source previews beside a corrupt task E', async ({ page }) => {
    // Only the class snapshot is legacy-marked here: the full read keeps the
    // canonical marker `1`, so this is a current-format record holding a corrupt
    // item. That item is a preview-only stored record whose criterion map is
    // short one key, which the read normaliser isolates as a validation E, and
    // the corrupt-E coverage is exercised through the legacy-marked class
    // snapshot.
    const corrupt = withMissingCriterion(
      LEGACY_ASSIGNMENT_ID,
      MIXED_STUDENT_ID,
      JOURNEY_TASK_ID,
      'accuracy'
    );
    await openErrorClass(page, {
      getABClass: successQueue(withLegacyClassAssignment(LEGACY_ASSIGNMENT_ID)),
      getAssignment: warmUpQueue({ kind: 'success', data: corrupt }),
    });
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);
    await expect(page.getByRole('table', { name: TABLE_NAME })).toBeVisible();

    // The legacy numeric result renders as a score, not as a blanket E.
    const healthy = healthyCell(page);
    await expect(healthy).toHaveCount(1);
    await expect(healthy).toHaveText('3');

    // The corrupt task keeps its E and its corruption reasoning, and the source
    // region states why the preview is unavailable.
    const corruptCell = page.getByRole('button', {
      name: cellLabel(LEGACY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E'),
    });
    await expect(corruptCell).toHaveCount(1);
    await expect(corruptCell).toHaveText('E');
    const corruptPopover = await openCell(
      page,
      cellLabel(LEGACY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E')
    );
    await expect(corruptPopover.getByText(CORRUPT_RECORD_REASONING)).toHaveCount(1);
    await expect(sourceAlert(corruptPopover)).toContainText(CORRUPTION_DESCRIPTION);
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);

    // A healthy legacy row keeps its saved score, reasoning and source action.
    const healthyPopover = await openCell(
      page,
      cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3')
    );
    await expect(healthyPopover.getByRole('status', { name: 'Completeness score: 3' })).toHaveCount(
      1
    );
    await expect(
      healthyPopover.getByText('Synthetic completeness rationale for student index 3.')
    ).toHaveCount(1);
    // A valid legacy row is not a resubmission: no reassessment alert appears.
    await expect(sourceAlert(healthyPopover)).toHaveCount(0);
    await expect(healthyPopover.getByText(LEGACY_ASSESSMENT_REASONING)).toHaveCount(0);
    await expect(healthyPopover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
    await expect(responseRenderer(healthyPopover)).toHaveCount(1);
  });

  test('keeps a legacy TEXT source preview readable', async ({ page }) => {
    await openLegacyHeatmap(page);

    // Ressie Harber's canonical completeness result is 0 with a TEXT artefact,
    // so the preview renders the saved Markdown body rather than an error.
    const popover = await openCell(
      page,
      cellLabel(HEALTHY_TEXT_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '0')
    );
    await expect(popover.getByRole('status', { name: 'Completeness score: 0' })).toHaveCount(1);
    await expect(popover.getByText(LEGACY_ASSESSMENT_REASONING)).toHaveCount(0);
    await expect(sourceAlert(popover)).toHaveCount(0);
    await expect(responseRenderer(popover)).toHaveCount(1);
    await expect(popover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
  });

  test('shows the stored reassessment alert on a current assignment', async ({ page }) => {
    // The stored-error journey is the supported preview branch for records that
    // were written with explicit `REASSESSMENT_REQUIRED` items. The assignment
    // marker stays `1`, so this is not a legacy-status journey.
    await openErrorClass(page, {
      getAssignment: warmUpQueue({
        kind: 'success',
        data: withStoredReassessmentError(LEGACY_ASSIGNMENT_ID),
      }),
    });
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);

    const popover = await openCell(
      page,
      cellLabel(LEGACY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E')
    );
    await expect(popover.getByText(LEGACY_ASSESSMENT_REASONING)).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(REASSESSMENT_COPY);
  });

  test('leaves a current sibling assignment unaffected', async ({ page }) => {
    await openLegacyHeatmap(page);
    // Open and close the legacy preview so the sibling read starts from a
    // settled surface rather than mid-navigation.
    await openCell(page, cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3'));
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);

    // Recent Assignments only lists the three newest assignments, so the
    // sibling has to be one of them to have a clickable card.
    await page.getByRole('button', { name: BACK_LABEL }).click();
    await openEmbeddedHeatmap(page, SIBLING_ASSIGNMENT_ID);

    // The sibling is current (`1`) and keeps its numeric result and preview.
    const siblingPopover = await openCell(
      page,
      cellLabel(HEALTHY_STUDENT_NAME, SIBLING_TITLE, 'completeness', '3')
    );
    await expect(sourceAlert(siblingPopover)).toHaveCount(0);
    await expect(siblingPopover.getByRole('status', { name: 'Completeness score: 3' })).toHaveCount(
      1
    );
    await expect(responseRenderer(siblingPopover)).toHaveCount(1);
  });
});

test.describe('Embedded heatmap — legacy reassessment tag', () => {
  test('marks only the legacy assignment and keeps its real results visible', async ({ page }) => {
    await openLegacyHeatmap(page);

    // The tag sits in the navigation card, before the rerun and refresh actions,
    // and does not replace the legacy scores or previews.
    await expect(reassessmentTag(page)).toHaveCount(1);
    await expect(reassessmentTag(page)).toHaveText(REASSESSMENT_TAG_TEXT);
    await expectNavActionOrder(page);
    await expect(healthyCell(page)).toHaveCount(1);
    const popover = await openCell(
      page,
      cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3')
    );
    await expect(responseRenderer(popover)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);

    // Recent assignment cards carry no status tag.
    await page.getByRole('button', { name: BACK_LABEL }).click();
    await expect(page.getByText('Recent Assignments')).toBeVisible();
    await expect(page.getByText(REASSESSMENT_TAG_TEXT, { exact: true })).toHaveCount(0);

    // A current sibling assignment has no tag either.
    await openEmbeddedHeatmap(page, SIBLING_ASSIGNMENT_ID);
    await expect(page.getByRole('button', { name: BACK_LABEL })).toHaveCount(1);
    await expect(reassessmentTag(page)).toHaveCount(0);
  });

  test('keeps the tag unclipped and unoverlapped at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectTagLayoutAtViewport(page, 'same-row');
  });

  test('keeps the tag unclipped and unoverlapped at narrow width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expectTagLayoutAtViewport(page, 'wrapped');
  });

  test('keeps the tag readable across the light and dark themes', async ({ page }) => {
    await openErrorClass(page, legacyOverrides());
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);

    await expect(reassessmentTag(page)).toHaveCount(1);
    const lightColour = await readTagComputedColour(page);
    await expectNavActionOrder(page);

    await page.getByRole('button', { name: BACK_LABEL }).click();
    await page.getByRole('switch', { name: 'Dark mode' }).click();
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);

    const darkColour = await readTagComputedColour(page);
    await expectNavActionOrder(page);

    // The tag reads Ant Design's theme tokens rather than hardcoded colours:
    // toggling the theme changes its computed colour.
    expect(darkColour).not.toBe(lightColour);
  });

  test('leaves the tag out of the keyboard tab order', async ({ page }) => {
    await openLegacyHeatmap(page);
    const tag = reassessmentTag(page);
    await expect(tag).toHaveCount(1);

    // The tag is static text: no role, no focus stop, no tabindex.
    await expect(tag).not.toHaveAttribute('tabindex', /.*/);
    await expect(tag).not.toHaveAttribute('role', /.*/);

    // Tabbing from Back reaches the two actions in order without stopping on the tag.
    await page.getByRole('button', { name: BACK_LABEL }).focus();
    await expect(page.getByRole('button', { name: BACK_LABEL })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: RE_RUN_LABEL })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: REFRESH_LABEL })).toBeFocused();
    await expect(tag).not.toBeFocused();
  });
});

test.describe('Embedded heatmap — legacy reassessment rerun', () => {
  test('keeps the tag while a rerun is in flight and after a failed rerun', async ({ page }) => {
    await openLegacyHeatmap(page, [
      { kind: 'deferredFailure', code: 'INTERNAL_ERROR', message: 'Assessment run rejected' },
    ]);
    await expect(reassessmentTag(page)).toHaveCount(1);

    await page.getByRole('button', { name: RE_RUN_LABEL }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // No optimistic removal while the automatic start is held in flight: the
    // tag is still on the loaded class response and the modal footer holds its
    // confirm-loading state.
    await expect(reassessmentTag(page)).toHaveCount(1);
    await expect(
      dialog.locator('.ant-modal-footer').getByRole('button', { name: RE_RUN_LABEL })
    ).toBeDisabled();
    await expect(healthyCell(page)).toHaveCount(1);

    // Release the held start so it fails: the failed rerun leaves the tag and
    // the saved results intact.
    await releaseNextDeferredSuccess(page);
    await expect(dialog.getByRole('alert')).toContainText(INTERNAL_ERROR_COPY);
    await expect(reassessmentTag(page)).toHaveCount(1);
    await expect(healthyCell(page)).toHaveCount(1);
  });

  test('removes the tag only after a successful rerun and the class refresh', async ({ page }) => {
    await openLegacyHeatmap(page, [{ kind: 'success', data: null }], rerunClassQueue());
    await expect(reassessmentTag(page)).toHaveCount(1);

    await page.getByRole('button', { name: RE_RUN_LABEL }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // A successful rerun starts a background run; the tag stays because the
    // loaded class response has not been refreshed.
    await expect(dialog.getByRole('alert')).toContainText('Assessment started for');
    await expect(reassessmentTag(page)).toHaveCount(1);

    await dialog.locator('.ant-modal-footer').getByRole('button', { name: CLOSE_LABEL }).click();
    await expect(dialog).toHaveCount(0);

    // The existing Refresh action refetches the class; the refreshed class read
    // is served the marker-1 snapshot, so the tag disappears.
    await page.getByRole('button', { name: REFRESH_LABEL }).click();
    await expect(reassessmentTag(page)).toHaveCount(0);
  });
});
