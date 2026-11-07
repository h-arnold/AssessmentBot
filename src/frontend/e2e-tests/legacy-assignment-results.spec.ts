/**
 * Browser journey for a legacy assignment's real results in the embedded heatmap.
 *
 * @remarks
 * The journeys serve marker-only legacy clones of the canonical `medium` class
 * graph: the selected assignment carries `'legacy'` in its class snapshot,
 * while every score, artefact and sibling assignment keeps its saved value. The
 * two journeys that also serve a legacy full read mark that read `'legacy'` too;
 * the corrupt-record journey serves a current-format full read. It proves the
 * read contract the feature targets:
 *
 * - a legacy assignment shows its numeric scores and source previews unchanged;
 * - a corrupt task shows E beside its healthy siblings;
 * - a current assignment whose saved items carry explicit
 *   `REASSESSMENT_REQUIRED` errors still shows the existing preview alert;
 * - current sibling assignments are unaffected by another assignment's marker.
 *
 * The task-heatmap status tag is a later milestone, so this journey asserts no
 * tag-specific behaviour beyond the absence of a resubmission alert on valid
 * legacy rows. No live Google or LLM call is made.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { expect, test } from '@playwright/test';
import { type ResponseItem } from './shared/endToEndRuntimeMocks';
import {
  canonicalAssignment,
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
  taskTitle,
  withLegacyAssignment,
  withLegacyClassAssignment,
  withMissingCriterion,
  withStoredReassessmentError,
} from './helpers/assessment-error-preview-journeys';
import { SOURCE_ACTION_LABEL } from '@/features/taskHeatmap/TaskPreviewCard';

const TABLE_NAME = 'Task Heatmap';
const BACK_LABEL = 'Back to Class overview';

/** Assignment the legacy journeys open. */
const LEGACY_ASSIGNMENT_ID = 'assignment-2-4';

/**
 * Current-version sibling opened beside the legacy assignment.
 *
 * @remarks
 * Recent Assignments only lists the three newest assignments, so the sibling
 * has to be one of them to have a card. `assignment-2-3` is the third of those
 * and its warmed full read is its own canonical record.
 */
const SIBLING_ASSIGNMENT_ID = 'assignment-2-3';
/** Task of the sibling assignment the journey reads. */
const SIBLING_TASK_ID = 'task-3-0';

const LEGACY_STUDENT_NAME = 'Taylor Yundt-Hermiston';
const HEALTHY_STUDENT_NAME = 'Bryon Medhurst';
/** Healthy legacy student whose source is a TEXT artefact. */
const HEALTHY_TEXT_STUDENT_NAME = 'Ressie Harber';

/**
 * Entries served for `getABClass` when the journey also overrides
 * `getAssignment`.
 */
const CLASS_READ_QUEUE_LENGTH = 6;

/**
 * Extra `getAssignment` copies served after the warm-up slots so later
 * refetches on the same query key still resolve.
 */
const TRAILING_REFETCH_READS = 3;

const JOURNEY_TITLE = taskTitle(LEGACY_ASSIGNMENT_ID, JOURNEY_TASK_ID);
const SIBLING_TITLE = taskTitle(SIBLING_ASSIGNMENT_ID, SIBLING_TASK_ID);

/**
 * Repeat one payload into a success queue.
 * @param {unknown} data - The payload to serve.
 * @returns {ResponseItem[]} The success entries.
 */
function successQueue(data: unknown): ResponseItem[] {
  const entry: ResponseItem = { kind: 'success', data };
  return Array.from({ length: CLASS_READ_QUEUE_LENGTH }, () => ({ ...entry }));
}

/**
 * Build the `getAssignment` queue in the Class page's warm-up order.
 *
 * @remarks
 * `useClassPageAssignmentPrefetch` warms `assignment-2-5`, `assignment-2-4` and
 * `assignment-2-3`, so the queue serves those slots in that order. The opened
 * assignment's prefetch read fills the same query key the embedded heatmap
 * reads, so its payload must sit in slot 2. The `medium` corpus has no full
 * record for `assignment-2-5`, so slot 1 is answered with another valid
 * canonical record; no journey reads that cache entry's content.
 *
 * @param {ResponseItem} openedAssignment - The entry for the opened assignment.
 * @returns {ResponseItem[]} The ordered `getAssignment` queue.
 */
function warmUpQueue(openedAssignment: ResponseItem): ResponseItem[] {
  const filler: ResponseItem = {
    kind: 'success',
    data: canonicalAssignment(SIBLING_ASSIGNMENT_ID),
  };
  return [
    filler,
    openedAssignment,
    filler,
    ...Array.from({ length: TRAILING_REFETCH_READS }, () => ({ ...openedAssignment })),
  ];
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
    const healthyCell = page.getByRole('button', {
      name: cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3'),
    });
    await expect(healthyCell).toHaveCount(1);
    await expect(healthyCell).toHaveText('3');

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
    await openErrorClass(page, {
      getABClass: successQueue(withLegacyClassAssignment(LEGACY_ASSIGNMENT_ID)),
      getAssignment: warmUpQueue({
        kind: 'success',
        data: withLegacyAssignment(LEGACY_ASSIGNMENT_ID),
      }),
    });
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);

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
    await openErrorClass(page, {
      getABClass: successQueue(withLegacyClassAssignment(LEGACY_ASSIGNMENT_ID)),
      getAssignment: warmUpQueue({
        kind: 'success',
        data: withLegacyAssignment(LEGACY_ASSIGNMENT_ID),
      }),
    });
    await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);
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
