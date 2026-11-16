/**
 * Browser journeys for explicit assessment errors in the embedded heatmap.
 *
 * @remarks
 * Each journey serves controlled `getAssignment`/`getABClass` queues built from
 * the canonical `medium` class graph, so the preview states the feature renders
 * are proven end to end: a healthy sibling beside an assessment `E` with valid
 * source, an `E` whose source is unavailable, a known class-partial `E` while
 * the full read is pending or has failed, a preview-only corrupt record, and a
 * refresh that replaces `E` with a current result. The legacy read journey lives
 * in `legacy-assignment-results.spec.ts`. No live Google or LLM call is made.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { expect, test } from '@playwright/test';
import {
  getMethodCalls,
  releaseNextDeferredSuccess,
  type ResponseItem,
} from './shared/endToEndRuntimeMocks';
import {
  ASSESSMENT_FAILED_REASONING,
  canonicalAssignment,
  cellLabel,
  CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS,
  CORRUPT_RECORD_REASONING,
  CORRUPTION_DESCRIPTION,
  JOURNEY_TASK_ID,
  openCell,
  openEmbeddedHeatmap,
  openErrorClass,
  previewPopover,
  responseRenderer,
  MIXED_STUDENT_ID,
  SOURCE_UNREADABLE_REASONING,
  sourceAlert,
  taskTitle,
  UNAVAILABLE_TITLE,
  withClassPartialAssessmentError,
  withMissingCriterion,
} from './helpers/assessment-error-preview-journeys';
import { stickyTableWrapper } from './helpers/sticky-table-locators';
import {
  SOURCE_ACTION_LABEL,
  SOURCE_LOADING_LABEL,
  SOURCE_UNAVAILABLE_DESCRIPTION,
} from '@/features/taskHeatmap/TaskPreviewCard';
import { LOADING_PREVIEW_LABEL as WHOLE_PREVIEW_LOADING_LABEL } from '@/features/taskHeatmap/TaskMetricPreviewContent';

const MIXED_ASSIGNMENT_ID = 'assignment-2-4';
const MIXED_STUDENT_NAME = 'Taylor Yundt-Hermiston';
const SOURCE_LESS_STUDENT_NAME = 'Lou Cronin';
const HEALTHY_STUDENT_NAME = 'Bryon Medhurst';
const PREVIEW_FAILURE_TEXT = "Couldn't load task details";

/**
 * Default entries in a repeated success queue.
 *
 * @remarks
 * Enough copies to cover the Class page's prefetch reads plus the later
 * refetches on the same query key.
 */
const DEFAULT_SUCCESS_QUEUE_LENGTH = 4;

/** `getABClass` copies served when the journey also overrides `getAssignment`. */
const CLASS_READ_QUEUE_LENGTH = 6;

const JOURNEY_TITLE = taskTitle(MIXED_ASSIGNMENT_ID, JOURNEY_TASK_ID);

/** Accessible label of the mixed submission's completeness cell. */
const MIXED_CELL = cellLabel(MIXED_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E');

/** Accessible label of the healthy submission's completeness cell. */
const HEALTHY_CELL = cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3');

/**
 * Accessible label of the healthy submission's class-partial completeness cell.
 *
 * @remarks
 * While the assignment's full read is unavailable the table renders the
 * class-partial analysis, and the canonical class partial carries `E` for this
 * student, so the cell's accessible label names `E` rather than a numeric score.
 */
const HEALTHY_PARTIAL_CELL = cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E');

/**
 * Repeat one payload into a success queue.
 * @param {unknown} data - The payload to serve.
 * @param {number} [count] - Number of entries.
 * @returns {ResponseItem[]} The success entries.
 */
function successQueue(data: unknown, count = DEFAULT_SUCCESS_QUEUE_LENGTH): ResponseItem[] {
  return Array.from({ length: count }, () => ({ kind: 'success' as const, data }));
}

/**
 * Number of `getAssignment` reads the Class page issues before the heatmap opens.
 *
 * @remarks
 * `useClassPageAssignmentPrefetch` warms the three newest assignments once the
 * class surface is ready, so those reads consume the head of the `getAssignment`
 * queue in recency order.
 */
const CLASS_PAGE_PREFETCH_READS = CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS.length;

/**
 * Extra `getAssignment` copies served after the warm-up slots so later
 * refetches on the same query key still resolve.
 */
const TRAILING_REFETCH_READS = 3;

/**
 * Build the `getAssignment` queue in the Class page's actual warm-up order.
 *
 * @remarks
 * The prefetch warms `assignment-2-5`, `assignment-2-4` and `assignment-2-3`, so
 * the queue must serve those slots in that order. The opened assignment is
 * `assignment-2-4` (slot 2), and its prefetch read fills the same query key the
 * embedded heatmap reads, so the scenario payload must sit in that slot: the
 * heatmap joins the cached/queued read rather than issuing a fourth request.
 * Trailing copies serve later refetches on the same key.
 *
 * The `medium` corpus has no full record for `assignment-2-5` (the class
 * references it, but `assignmentsByKey` stops at `assignment-2-4`), so slot 1 is
 * answered with another valid canonical full record. The prefetch is
 * fire-and-forget and no journey reads that cache entry's content, so only a
 * schema-valid payload matters there; the record is not relabelled, and no
 * synthetic record is invented.
 *
 * @param {ResponseItem} scenarioForMixed - The entry for the opened assignment.
 * @returns {ResponseItem[]} The ordered `getAssignment` queue.
 */
function warmUpQueue(scenarioForMixed: ResponseItem): ResponseItem[] {
  return [
    { kind: 'success', data: canonicalAssignment(CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS[2]) },
    scenarioForMixed,
    { kind: 'success', data: canonicalAssignment(CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS[2]) },
    ...Array.from({ length: TRAILING_REFETCH_READS }, () => ({ ...scenarioForMixed })),
  ];
}

test.describe('Embedded heatmap — explicit assessment errors', () => {
  test('keeps a healthy sibling usable beside an assessment E with valid source', async ({
    page,
  }) => {
    await openErrorClass(page, {
      getAssignment: successQueue(canonicalAssignment(MIXED_ASSIGNMENT_ID)),
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);
    await expect(stickyTableWrapper(page)).toBeVisible();

    const errorPopover = await openCell(page, MIXED_CELL);
    await expect(errorPopover.getByRole('status', { name: 'Completeness score: E' })).toHaveCount(
      1
    );
    await expect(errorPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    // An assessment-stage E keeps its extracted source, so the response renders
    // and the safe source action stays available.
    await expect(sourceAlert(errorPopover)).toHaveCount(0);
    await expect(responseRenderer(errorPopover)).toHaveCount(1);
    const action = errorPopover.getByRole('link', { name: SOURCE_ACTION_LABEL });
    await expect(action).toHaveCount(1);
    await expect(action).toHaveAttribute('target', '_blank');
    await expect(action).toHaveAttribute('rel', /noopener/);
    await expect(action).toHaveAttribute('rel', /noreferrer/);
    // The keyboard opening hands focus to the action once, and no app unmount
    // occurred: the table and the trigger are still mounted.
    await expect(action).toBeFocused();
    await expect(stickyTableWrapper(page)).toBeVisible();
    await expect(page.getByRole('button', { name: MIXED_CELL })).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: MIXED_CELL })).toBeFocused();

    const healthyPopover = await openCell(page, HEALTHY_CELL);
    await expect(healthyPopover.getByRole('status', { name: 'Completeness score: 3' })).toHaveCount(
      1
    );
    await expect(sourceAlert(healthyPopover)).toHaveCount(0);
    await expect(healthyPopover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
  });

  test('shows an inline source Alert for an E whose source is unavailable', async ({ page }) => {
    await openErrorClass(page, {
      getAssignment: successQueue(canonicalAssignment(MIXED_ASSIGNMENT_ID)),
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);

    const label = cellLabel(SOURCE_LESS_STUDENT_NAME, JOURNEY_TITLE, 'completeness', 'E');
    const popover = await openCell(page, label);
    await expect(popover.getByText(SOURCE_UNREADABLE_REASONING)).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(UNAVAILABLE_TITLE);
    await expect(alert).toContainText(SOURCE_UNAVAILABLE_DESCRIPTION);
    // No source identifiers exist, so no action and no renderer are offered.
    await expect(popover.getByRole('link')).toHaveCount(0);
    await expect(responseRenderer(popover)).toHaveCount(0);
    await expect(popover.getByRole('img', { name: 'Student response image' })).toHaveCount(0);
  });

  test('keeps the table usable while the full read is pending, then shows the preview', async ({
    page,
  }) => {
    // The Class page's prefetch warms the opened assignment's full read, and the
    // embedded preview joins that same query key. Holding that slot open leaves
    // the preview pending while the class-partial E is already known.
    const classWithError = withClassPartialAssessmentError(MIXED_ASSIGNMENT_ID);
    const deferred: ResponseItem = {
      kind: 'deferredSuccess',
      data: canonicalAssignment(MIXED_ASSIGNMENT_ID),
    };
    await openErrorClass(page, {
      getABClass: successQueue(classWithError, CLASS_READ_QUEUE_LENGTH),
      getAssignment: warmUpQueue(deferred),
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);

    // A known class-partial E is usable card data even while its full read is
    // pending: the reasoning renders immediately and only the source region
    // stays busy. The whole-preview skeleton is reserved for nothing-known.
    const trigger = page.getByRole('button', { name: MIXED_CELL });
    await expect(trigger).toHaveText('E');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popover = previewPopover(page);
    await expect(popover).toBeVisible();
    await expect(popover.getByLabel(WHOLE_PREVIEW_LOADING_LABEL)).toHaveCount(0);
    await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
    await expect(popover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    const sourceLoading = popover.getByLabel(SOURCE_LOADING_LABEL);
    await expect(sourceLoading).toHaveCount(1);
    await expect(sourceLoading).toHaveAttribute('aria-busy', 'true');
    await expect(sourceAlert(popover)).toHaveCount(0);

    await releaseNextDeferredSuccess(page);
    // The settled full read is current, so the source region renders the valid
    // response and the source skeleton is gone.
    await expect(popover.getByLabel(SOURCE_LOADING_LABEL)).toHaveCount(0);
    await expect(popover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    await expect(sourceAlert(popover)).toHaveCount(0);
    await expect(responseRenderer(popover)).toHaveCount(1);
  });

  test('keeps the known reasoning with a source-unavailable Alert when the full read fails', async ({
    page,
  }) => {
    // The Class page's prefetch warms the opened assignment's full read, so the
    // failure payload has to occupy that slot: the embedded preview joins the
    // same query key and never issues a request of its own.
    const failure: ResponseItem = {
      kind: 'failureEnvelope',
      code: 'INTERNAL_ERROR',
      message: 'Assignment read failed',
    };
    await openErrorClass(page, {
      getABClass: successQueue(
        withClassPartialAssessmentError(MIXED_ASSIGNMENT_ID),
        CLASS_READ_QUEUE_LENGTH
      ),
      getAssignment: warmUpQueue(failure),
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);

    // A settled failed read must not replace the known class-partial E with
    // generic fetch copy: the E and its reasoning stay, and only the source
    // region falls back to the inline unavailable Alert.
    const trigger = page.getByRole('button', { name: MIXED_CELL });
    await expect(trigger).toHaveText('E');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popover = previewPopover(page);
    await expect(popover).toBeVisible();
    await expect(popover.getByText(PREVIEW_FAILURE_TEXT)).toHaveCount(0);
    await expect(popover.getByLabel(WHOLE_PREVIEW_LOADING_LABEL)).toHaveCount(0);
    await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
    await expect(popover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    await expect(popover.getByRole('status', { name: 'Completeness score: E' })).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(UNAVAILABLE_TITLE);
    await expect(alert).toContainText(SOURCE_UNAVAILABLE_DESCRIPTION);
    await expect(responseRenderer(popover)).toHaveCount(0);

    // The class-derived table is untouched by the failed preview read.
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: MIXED_CELL })).toHaveText('E');
    // While the full read has failed the table renders the class-partial
    // analysis, so every cell shows its partial-derived value. The canonical
    // class partial carries E for this student, so the sibling cell shows that
    // partial E rather than a settled numeric result; the settled numeric
    // sibling is covered by journeys whose full read succeeds.
    await expect(stickyTableWrapper(page)).toBeVisible();
    const partialSibling = page.getByRole('button', { name: HEALTHY_PARTIAL_CELL });
    await expect(partialSibling).toHaveCount(1);
    await expect(partialSibling).toHaveText('E');
    // The table stays usable: the partial sibling still opens its own preview.
    await partialSibling.focus();
    await page.keyboard.press('Enter');
    const siblingPopover = previewPopover(page);
    await expect(siblingPopover).toBeVisible();
    await expect(siblingPopover.getByText('Reasoning', { exact: true })).toHaveCount(1);
    await expect(siblingPopover.getByText('Student Response', { exact: true })).toHaveCount(1);
  });

  test('shows the corruption notice without changing class cell values', async ({ page }) => {
    const corrupt = withMissingCriterion(
      MIXED_ASSIGNMENT_ID,
      MIXED_STUDENT_ID,
      JOURNEY_TASK_ID,
      'accuracy'
    );
    // Every read serves the corrupt record, including the Class page's prefetch
    // reads, so the heatmap's own read is the corrupt payload.
    await openErrorClass(page, {
      getAssignment: successQueue(
        corrupt,
        CLASS_PAGE_PREFETCH_READS + DEFAULT_SUCCESS_QUEUE_LENGTH
      ),
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);

    // Baseline: the class-derived cells keep their own values.
    await expect(page.getByRole('button', { name: MIXED_CELL })).toHaveText('E');
    const healthyCell = page.getByRole('button', { name: HEALTHY_CELL });
    await expect(healthyCell).toHaveText('3');

    const popover = await openCell(page, MIXED_CELL);
    await expect(popover.getByText(CORRUPT_RECORD_REASONING)).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(CORRUPTION_DESCRIPTION);

    // Preview-only: closing the preview leaves the table values untouched.
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: MIXED_CELL })).toHaveText('E');
    await expect(healthyCell).toHaveText('3');
  });

  test('refresh replaces E with newly valid content under the current query owner', async ({
    page,
  }) => {
    const corrupt = withMissingCriterion(
      MIXED_ASSIGNMENT_ID,
      MIXED_STUDENT_ID,
      JOURNEY_TASK_ID,
      'accuracy'
    );
    const current = canonicalAssignment(MIXED_ASSIGNMENT_ID);
    // The prefetch warms the opened assignment's full read first, so the corrupt
    // payload has to occupy that slot. Every later read of the same key — the
    // refresh refetch included — then serves the current record.
    await openErrorClass(page, {
      getAssignment: [
        { kind: 'success', data: canonicalAssignment(CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS[2]) },
        { kind: 'success', data: corrupt },
        { kind: 'success', data: canonicalAssignment(CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS[2]) },
        ...successQueue(current, DEFAULT_SUCCESS_QUEUE_LENGTH),
      ],
    });
    await openEmbeddedHeatmap(page, MIXED_ASSIGNMENT_ID);

    const popover = await openCell(page, MIXED_CELL);
    await expect(sourceAlert(popover)).toContainText(CORRUPTION_DESCRIPTION);
    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);

    const callsBeforeRefresh = await getMethodCalls(page);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect
      .poll(async () => {
        const callsAfterRefresh = await getMethodCalls(page);
        return callsAfterRefresh.length;
      })
      .toBeGreaterThan(callsBeforeRefresh.length);

    // The refreshed read is current, so the preview shows the valid response
    // instead of the corruption notice.
    await expect(stickyTableWrapper(page)).toBeVisible();
    const refreshedPopover = await openCell(page, MIXED_CELL);
    await expect(sourceAlert(refreshedPopover)).toHaveCount(0);
    await expect(refreshedPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    await expect(responseRenderer(refreshedPopover)).toHaveCount(1);
  });
});
