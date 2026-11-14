/**
 * Browser journeys for explicit assessment errors in the standalone merged heatmap.
 *
 * @remarks
 * The merged surface differs from the embedded one in two ways that decide what
 * these journeys can prove. First, its preview lookup is built only from each
 * selected assignment's own full read (`assembleMergedPreviewData`), so a known
 * class-partial `E` is not consulted there. Second, two instances sharing a
 * definition collapse into one column set keyed by `definitionKey::taskId`, so
 * the merged cell and its preview are sourced from the first instance in
 * `classFull.assignments` order, never from the selection order.
 *
 * The canonical `medium` corpus gives exactly the pair the layout spec names:
 * `assignment-2-0` and `assignment-2-4` both map to `definition-0-slides`.
 * `assignment-2-4` carries five submissions including Taylor Yundt-Hermiston's
 * assessment `E`; `assignment-2-0` carries none. Selecting both therefore proves
 * that the `E` reasoning and content come only from the instance that has them,
 * and that a student with no submission in either instance keeps the legitimate
 * no-submission placeholder rather than inheriting the other instance's error.
 *
 * Every response is a route-controlled queue built from the committed canonical
 * records. No live Google or LLM call is made.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  selectVisibleOption,
  type ResponseItem,
} from './shared/endToEndRuntimeMocks';
import {
  ASSESSMENT_FAILED_REASONING,
  assignmentCardTitle,
  canonicalAssignment,
  createErrorPreviewScenario,
  ERROR_CLASS_NAME,
  previewPopover,
  responseRenderer,
  SHARED_FIRST_ASSIGNMENT_ID,
  SHARED_SECOND_ASSIGNMENT_ID,
  sourceAlert,
  UNAVAILABLE_TITLE,
  withClassPartialAssessmentError,
} from './helpers/assessment-error-preview-journeys';
import { stickyTableHeaderHolder, stickyTableWrapper } from './helpers/sticky-table-locators';
import { ASSIGNMENTS_CONTROL_INDEX } from './helpers/shell-controls';
import { readClosedPageOverflowWidth } from './helpers/task-preview-source-link-geometry';
import { pageContent } from '@/pages/pageContent';
import {
  SOURCE_ACTION_LABEL,
  SOURCE_UNAVAILABLE_DESCRIPTION,
} from '@/features/taskHeatmap/TaskPreviewCard';
import { PREVIEW_ERROR_TEXT } from '@/features/taskHeatmap/TaskMetricPreviewContent';

const REASONING_HEADING = 'Reasoning';
const RESPONSE_HEADING = 'Student Response';

/**
 * Rendered task title of the shared definition's first task.
 *
 * @remarks
 * The merged adapter takes a column's title from the warm-up definition partial,
 * not from the embedded `assignmentDefinition.tasks` entry the embedded journeys
 * read. The canonical partial renders `Synthetic Task 1.1` for `task-0-0`.
 */
const MERGED_TASK_TITLE = 'Synthetic Task 1.1';

/** Student whose submission carries the assessment `E` in the first instance. */
const ERROR_STUDENT_NAME = 'Taylor Yundt-Hermiston';

/** Healthy student in the first instance whose numeric preview must stay normal. */
const HEALTHY_STUDENT_NAME = 'Bryon Medhurst';

/**
 * Student whose canonical acquisition-stage `E` leaves the source unavailable:
 * the full record carries no usable source identifiers, so the merged preview
 * resolves to the inline Alert whose long copy the narrow-viewport journey
 * measures.
 */
const SOURCE_LESS_STUDENT_NAME = 'Lou Cronin';

/**
 * Student with no submission in either selected instance.
 *
 * @remarks
 * `assignment-2-0` has no submissions at all and `assignment-2-4` covers five
 * students, so this roster member is absent from both. The merged row still
 * renders because rows come from the class roster, which makes it the honest
 * leak check: nothing in the shared definition can supply this student a result,
 * so any reasoning or content appearing here would have come from the other
 * instance.
 */
const ABSENT_STUDENT_NAME = 'Cedrick Dickens';

/** Placeholder reasoning the preview shows when nothing is known for a cell. */
const NO_REASONING_COPY = 'No reasoning available';

/** Placeholder response copy for a confirmed no-submission cell. */
const NO_SUBMISSION_COPY = 'No submission available';

/** Selecting controls by index, in the builder's fixed order. */
const CLASS_CONTROL_INDEX = 0;

/**
 * Copies served for each selected assignment's full read.
 *
 * @remarks
 * The merged surface issues one `getAssignment` per selected assignment, so
 * each queue entry is consumed once per selection round. Extra copies let a
 * later refetch on the same key resolve; an exhausted queue fails the call, so
 * the tail is deliberately generous.
 */
const ASSIGNMENT_QUEUE_REPEATS = 6;

/**
 * The two selected instances of the shared definition whose reads alternate in
 * the `getAssignment` queue.
 */
const MERGED_INSTANCE_COUNT = 2;

/**
 * A wrapped second line doubles the description box height; this ratio demands
 * nearly twice the line height, which a single line cannot satisfy.
 */
const WRAPPED_LINE_RATIO = 1.9;

/**
 * Build a `getAssignment` queue serving the two instances in selection order.
 *
 * @remarks
 * The builder issues the reads in `selectedAssignmentIds` order, which for these
 * journeys is the order the options were clicked. The second instance is the
 * first one in `classFull.assignments` order, so it wins the shared column's
 * identity; the first instance is the one that carries the `E`.
 *
 * @param {ResponseItem} firstEntry - Entry served for the first selection.
 * @param {ResponseItem} secondEntry - Entry served for the second selection.
 * @returns {ResponseItem[]} The alternating queue.
 */
function alternatingQueue(firstEntry: ResponseItem, secondEntry: ResponseItem): ResponseItem[] {
  return Array.from({ length: ASSIGNMENT_QUEUE_REPEATS * MERGED_INSTANCE_COUNT }, (_, index) =>
    index % MERGED_INSTANCE_COUNT === 0 ? { ...firstEntry } : { ...secondEntry }
  );
}

/**
 * Repeat one payload into a `getABClass` success queue.
 * @param {unknown} data - The class payload.
 * @returns {ResponseItem[]} The success entries.
 */
function classQueue(data: unknown): ResponseItem[] {
  return Array.from({ length: ASSIGNMENT_QUEUE_REPEATS }, () => {
    return {
      kind: 'success' as const,
      data,
    };
  });
}

/**
 * Open the merged heatmap with both shared instances selected and their
 * canonical full reads settled: the empty instance is served first (it owns the
 * shared column), the E-carrying instance second.
 *
 * @param {Page} page - The page under test.
 * @returns {Promise<void>} Resolves once the merged table is visible.
 */
async function openSharedInstances(page: Page): Promise<void> {
  await openMergedSharedDefinition(
    page,
    alternatingQueue(
      { kind: 'success', data: canonicalAssignment(SHARED_SECOND_ASSIGNMENT_ID) },
      { kind: 'success', data: canonicalAssignment(SHARED_FIRST_ASSIGNMENT_ID) }
    )
  );
}

/**
 * Install the scenario and open the merged heatmap with both shared instances
 * selected.
 *
 * @remarks
 * `openMergedHeatmap` from the shared helper cannot be used here because both
 * options render the same label: selecting by label alone would toggle the
 * first choice off. The occurrence index disambiguates them, and the options
 * follow `classFull.assignments` order, so index 0 is `assignment-2-0` and
 * index 1 is `assignment-2-4`.
 *
 * @param {Page} page - The Playwright page.
 * @param {ReadonlyArray<ResponseItem>} assignmentQueue - The `getAssignment` queue.
 * @param {unknown} [classPayload] - Optional `getABClass` payload override.
 * @returns {Promise<void>} Resolves once the merged table is visible.
 */
async function openMergedSharedDefinition(
  page: Page,
  assignmentQueue: ReadonlyArray<ResponseItem>,
  classPayload?: unknown
): Promise<void> {
  const overrides: Parameters<typeof createErrorPreviewScenario>[0] =
    classPayload === undefined
      ? { getAssignment: assignmentQueue }
      : { getAssignment: assignmentQueue, getABClass: classQueue(classPayload) };
  await installRuntimeMock(page, createErrorPreviewScenario(overrides));
  await page.goto('/');
  await page.getByRole('menuitem', { name: pageContent.heatmaps.heading }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: pageContent.heatmaps.heading })
  ).toBeVisible();

  await page.getByRole('combobox').nth(CLASS_CONTROL_INDEX).click();
  await selectVisibleOption(page, ERROR_CLASS_NAME);

  const sharedTitle = assignmentCardTitle(SHARED_FIRST_ASSIGNMENT_ID);
  // Both instances share one definition, so both options carry the same label.
  // The occurrence index is the only honest way to choose each instance.
  await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
  await selectVisibleOption(page, sharedTitle, 0);
  await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
  await selectVisibleOption(page, sharedTitle, 1);

  await expect(stickyTableWrapper(page)).toBeVisible();
}

/**
 * Build the merged completeness cell's accessible label. Every journey in this
 * spec reads the shared definition's completeness column.
 * @param {string} studentName - Rendered student name.
 * @param {string} scoreText - Rendered score text.
 * @returns {string} The accessible label.
 */
function mergedCell(studentName: string, scoreText: string): string {
  return `${studentName}, ${MERGED_TASK_TITLE}, Completeness: ${scoreText}`;
}

/** Accessible labels of the merged cells these journeys open. */
const ERROR_CELL = mergedCell(ERROR_STUDENT_NAME, 'E');
const STALE_HEALTHY_CELL = mergedCell(HEALTHY_STUDENT_NAME, 'E');
const HEALTHY_CELL = mergedCell(HEALTHY_STUDENT_NAME, '3');
const SOURCE_LESS_CELL = mergedCell(SOURCE_LESS_STUDENT_NAME, 'E');
const ABSENT_CELL = mergedCell(ABSENT_STUDENT_NAME, 'N');

/**
 * Open one merged cell's preview from the keyboard.
 * @param {Page} page - The Playwright page.
 * @param {string} label - The cell's accessible label.
 * @returns {Promise<Locator>} The open popover.
 */
async function openMergedCell(page: Page, label: string): Promise<Locator> {
  const trigger = page.getByRole('button', { name: label });
  await expect(trigger).toHaveCount(1);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popover = previewPopover(page);
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Read where the document focus sits relative to the app root and any open
 * preview popover.
 * @param {Page} page - The Playwright page.
 * @returns {Promise<{insidePopover: boolean, inRoot: boolean}>} Focus location flags.
 */
async function readFocusLocation(page: Page): Promise<{
  insidePopover: boolean;
  inRoot: boolean;
}> {
  return page.evaluate(() => {
    const active = document.activeElement;
    const popover = document.querySelector('.ant-popover:not(.ant-popover-hidden)');
    return {
      insidePopover: popover !== null && active !== null && popover.contains(active),
      inRoot: document.querySelector('#root')?.contains(active) === true,
    };
  });
}

test.describe('Merged heatmap — explicit assessment errors', () => {
  test('keeps the shared-definition E on its own instance and leaks nothing to the other', async ({
    page,
  }) => {
    // The first selection is `assignment-2-0` (no submissions; first in
    // `classFull.assignments` order, so it owns the shared column); the second
    // is `assignment-2-4`, the instance carrying the assessment E. Both feed
    // one shared column, so the E must travel with the instance that owns it.
    await openSharedInstances(page);

    // The shared definition collapses to one column set, not two.
    const header = stickyTableHeaderHolder(page);
    await expect(header.getByRole('columnheader', { name: /shared definition/ })).toHaveCount(1);
    await expect(
      header.getByRole('columnheader', { name: MERGED_TASK_TITLE, exact: true })
    ).toHaveCount(1);

    // The E instance's reasoning and content are shown for its own student.
    const errorPopover = await openMergedCell(page, ERROR_CELL);
    await expect(errorPopover.getByRole('status', { name: 'Completeness score: E' })).toHaveCount(
      1
    );
    await expect(errorPopover.getByText(REASONING_HEADING, { exact: true })).toHaveCount(1);
    await expect(errorPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    await expect(errorPopover.getByText(RESPONSE_HEADING, { exact: true })).toHaveCount(1);
    // An assessment-stage E keeps its extracted source: no Alert, action available.
    await expect(sourceAlert(errorPopover)).toHaveCount(0);
    await expect(errorPopover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
    // Escape dismisses the preview and returns focus to the trigger. The pointer
    // must leave the grid first: the merged table renders beneath the dropdown
    // option's click position and cells open previews on hover, so a stationary
    // pointer holds the hover preview of whatever cell it rests on (the failure
    // snapshot showed "Rod Kerluke … Accuracy: N" open while the focused E
    // trigger had already closed). That preview is the pointer's, not a survivor
    // of this keyboard session.
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await expect(previewPopover(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: ERROR_CELL })).toBeFocused();

    // The student absent from both instances keeps the legitimate no-submission
    // placeholder: no E reasoning, no response content, no source Alert.
    const absentPopover = await openMergedCell(page, ABSENT_CELL);
    await expect(absentPopover.getByText(NO_REASONING_COPY)).toHaveCount(1);
    await expect(absentPopover.getByText(NO_SUBMISSION_COPY)).toHaveCount(1);
    await expect(absentPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(0);
    await expect(sourceAlert(absentPopover)).toHaveCount(0);
    await expect(responseRenderer(absentPopover)).toHaveCount(0);
    await expect(absentPopover.getByRole('img', { name: 'Student response image' })).toHaveCount(0);
  });

  test('keeps a healthy sibling preview normal beside the shared-definition E', async ({
    page,
  }) => {
    await openSharedInstances(page);

    // A numeric cell opens a normal preview: its own reasoning and content, no
    // source Alert, and the safe source action present.
    const healthyPopover = await openMergedCell(page, HEALTHY_CELL);
    await expect(healthyPopover.getByRole('status', { name: 'Completeness score: 3' })).toHaveCount(
      1
    );
    await expect(healthyPopover.getByText(REASONING_HEADING, { exact: true })).toHaveCount(1);
    await expect(
      healthyPopover.getByText('Synthetic completeness rationale for student index 3.')
    ).toHaveCount(1);
    await expect(sourceAlert(healthyPopover)).toHaveCount(0);
    await expect(healthyPopover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
    // The error instance's reasoning never appears on the healthy student.
    await expect(healthyPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(0);
  });

  test('lets the settled full read win over a stale class-partial E', async ({ page }) => {
    // The class snapshot is downgraded to an assessment E for every item of the
    // E-carrying instance while its full read stays current. The merged preview
    // reads only full reads, so the settled result must replace the stale E.
    const errorInstance = canonicalAssignment(SHARED_FIRST_ASSIGNMENT_ID);
    const emptyInstance = canonicalAssignment(SHARED_SECOND_ASSIGNMENT_ID);
    await openMergedSharedDefinition(
      page,
      alternatingQueue(
        { kind: 'success', data: emptyInstance },
        { kind: 'success', data: errorInstance }
      ),
      withClassPartialAssessmentError(SHARED_FIRST_ASSIGNMENT_ID)
    );

    // The class-derived cell keeps its stale E; only the preview is replaced.
    await expect(page.getByRole('button', { name: STALE_HEALTHY_CELL })).toHaveCount(1);

    const popover = await openMergedCell(page, STALE_HEALTHY_CELL);
    await expect(
      popover.getByText('Synthetic completeness rationale for student index 3.')
    ).toHaveCount(1);
    await expect(popover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(0);
    await expect(sourceAlert(popover)).toHaveCount(0);
    // The settled read supplies the TEXT response body rather than the
    // no-submission placeholder.
    await expect(
      popover.getByText(
        'Synthetic submission content for assignment-2-4-100000000020000000003-task-0-0'
      )
    ).toHaveCount(1);
    await expect(popover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);
  });

  test('keeps the known E preview usable when the shared full read fails', async ({ page }) => {
    // The shared column is owned by the first `classFull.assignments` instance
    // (assignment-2-0, no submissions). Serving that read as a terminal failure
    // leaves the column without its own full-read data while the class-derived
    // table keeps its values; the E instance's own read still succeeds, so the
    // known E stays readable with its source region settled unavailable.
    const errorInstance = canonicalAssignment(SHARED_FIRST_ASSIGNMENT_ID);
    await openMergedSharedDefinition(
      page,
      alternatingQueue(
        { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: 'Assignment read failed' },
        { kind: 'success', data: errorInstance }
      )
    );
    await page.mouse.move(0, 0);

    await expect(page.getByRole('button', { name: ERROR_CELL })).toHaveCount(1);

    const popover = await openMergedCell(page, ERROR_CELL);
    await expect(popover.getByRole('status', { name: 'Completeness score: E' })).toHaveCount(1);
    await expect(popover.getByText(REASONING_HEADING, { exact: true })).toHaveCount(1);
    await expect(popover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(UNAVAILABLE_TITLE);
    await expect(alert).toContainText(SOURCE_UNAVAILABLE_DESCRIPTION);
    await expect(responseRenderer(popover)).toHaveCount(0);
    await expect(popover.getByRole('img', { name: 'Student response image' })).toHaveCount(0);
    await expect(popover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(previewPopover(page)).toHaveCount(0);

    // The absent student shares the failed column: it renders the owned
    // whole-preview error, never the other instance's reasoning or content.
    const absentPopover = await openMergedCell(page, ABSENT_CELL);
    await expect(absentPopover.getByText(PREVIEW_ERROR_TEXT)).toHaveCount(1);
    await expect(absentPopover.getByText(ASSESSMENT_FAILED_REASONING)).toHaveCount(0);
    await expect(responseRenderer(absentPopover)).toHaveCount(0);
    await expect(absentPopover.getByRole('img', { name: 'Student response image' })).toHaveCount(0);
  });

  test('keeps Tab untrapped while a preview is open', async ({ page }) => {
    await openSharedInstances(page);
    await page.mouse.move(0, 0);

    const popover = await openMergedCell(page, ERROR_CELL);
    const action = popover.getByRole('link', { name: SOURCE_ACTION_LABEL });
    await expect(action).toBeFocused();

    // Forward Tab leaves the preview entirely — the portal is the document's
    // last tab stop — and the preview stays open.
    await page.keyboard.press('Tab');
    const escaped = await readFocusLocation(page);
    expect(escaped.insidePopover).toBe(false);
    await expect(popover).toBeVisible();

    // The next Tab wraps to the page's first tab stop: page content, never
    // re-captured by the preview, which stays open and unfocused.
    await page.keyboard.press('Tab');
    const wrapped = await readFocusLocation(page);
    expect(wrapped.inRoot).toBe(true);
    expect(wrapped.insidePopover).toBe(false);
    await expect(popover).toBeVisible();
  });

  test('wraps the unavailable-source copy at a narrow viewport without colour-only errors', async ({
    page,
  }) => {
    await openSharedInstances(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.mouse.move(0, 0);

    // The suite's narrow convention: populate at desktop width, then resize.
    // The shell already overflows slightly at 390px; opening a preview must not
    // widen that overflow.
    const closedOverflowWidth = await readClosedPageOverflowWidth(page, 'narrow merged preview');

    const trigger = page.getByRole('button', { name: SOURCE_LESS_CELL });
    await trigger.scrollIntoViewIfNeeded();
    const popover = await openMergedCell(page, SOURCE_LESS_CELL);

    // The error state is carried by accessible name and role, not by colour:
    // the trigger text, the score status and the alert role all state it.
    await expect(trigger).toHaveText('E');
    await expect(popover.getByRole('status', { name: 'Completeness score: E' })).toHaveCount(1);
    const alert = sourceAlert(popover);
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(UNAVAILABLE_TITLE);
    await expect(alert).toContainText(SOURCE_UNAVAILABLE_DESCRIPTION);
    await expect(responseRenderer(popover)).toHaveCount(0);
    await expect(popover.getByRole('img', { name: 'Student response image' })).toHaveCount(0);
    await expect(popover.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(0);

    // The long Alert description wraps: the box grows to a second line rather
    // than overflowing or clipping horizontally.
    const wrap = await alert.locator('.ant-alert-description').evaluate((el) => {
      return {
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight),
      };
    });
    expect(wrap.scrollWidth).toBeLessThanOrEqual(wrap.clientWidth);
    expect(wrap.clientHeight).toBeGreaterThanOrEqual(wrap.lineHeight * WRAPPED_LINE_RATIO);

    const openOverflowWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(openOverflowWidth).toBe(closedOverflowWidth);
  });
});
