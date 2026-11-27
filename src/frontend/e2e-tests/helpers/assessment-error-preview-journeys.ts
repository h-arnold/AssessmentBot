/**
 * Scenario, navigation and locator helpers for the assessment-error preview
 * browser journeys.
 *
 * @remarks
 * Queues reuse `shared/endToEndRuntimeMocks.ts` rather than a competing mock.
 * Startup warm-up datasets are sized generously because extra entries are never
 * consumed while a missing entry fails the call; each journey's own queues are
 * supplied by the caller because their order is the behaviour under test.
 *
 * Canonical record selection and the boundary variants live in the sibling
 * `assessment-error-preview-fixtures.ts`. This module re-exports that public
 * surface so a journey spec has a single import site.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { buildMetricCellAccessibleLabel } from '@/features/taskHeatmap/taskHeatmapTableColumns';
import { assignmentNameButton, assignmentsTable } from './assignments-table-locators';
import {
  installRuntimeMock,
  type ResponseItem,
  type RuntimeScenario,
} from '../shared/endToEndRuntimeMocks';
import {
  assignmentCardTitle,
  CANONICAL_CLASS,
  CANONICAL_CLASS_PARTIAL,
  CANONICAL_DEFINITION_PARTIALS,
  CANONICAL_YEAR_GROUPS,
  canonicalAssignment,
  CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS,
  ERROR_CLASS_NAME,
  UNAVAILABLE_TITLE,
} from './assessment-error-preview-fixtures';
import { stickyTableWrapper } from './sticky-table-locators';

// ---------------------------------------------------------------------------
// Copy re-exports
// ---------------------------------------------------------------------------

export {
  ASSESSMENT_FAILED_REASONING,
  assignmentCardTitle,
  canonicalAssignment,
  CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS,
  CORRUPTION_DESCRIPTION,
  CORRUPT_RECORD_REASONING,
  ERROR_CLASS_NAME,
  JOURNEY_TASK_ID,
  LEGACY_ASSESSMENT_REASONING,
  MIXED_STUDENT_ID,
  REASSESSMENT_COPY,
  SHARED_FIRST_ASSIGNMENT_ID,
  SHARED_SECOND_ASSIGNMENT_ID,
  SOURCE_UNREADABLE_REASONING,
  UNAVAILABLE_TITLE,
  withClassPartialAssessmentError,
  withLegacyAssignment,
  withLegacyClassAssignment,
  withMissingCriterion,
  withStoredReassessmentError,
} from './assessment-error-preview-fixtures';

// ---------------------------------------------------------------------------
// Queue sizes
// ---------------------------------------------------------------------------

// Startup and reference-data queue sizes. Extra entries are never consumed;
// a missing entry fails the call, so these are sized generously.
const AUTHORISATION_QUEUE_REPEATS = 4;
const REFERENCE_DATA_QUEUE_REPEATS = 8;
const DEFINITION_PARTIALS_QUEUE_REPEATS = 12;
const CLASS_QUEUE_REPEATS = 6;

/** Prefetch slot whose full record is only used as a content-agnostic filler. */
const FILLER_PREFETCH_SLOT = 2;

export { ASSIGNMENTS_TABLE_NAME } from './assignments-table-locators';

// ---------------------------------------------------------------------------
// Scenario and navigation
// ---------------------------------------------------------------------------

/** Per-method queue overrides for one journey. */
export type ErrorPreviewOverrides = Readonly<{
  /** Replaces the `getAssignment` queue. */
  getAssignment?: ReadonlyArray<ResponseItem>;
  /** Replaces the `getABClass` queue. */
  getABClass?: ReadonlyArray<ResponseItem>;
}>;

/**
 * Build one success response entry.
 * @param {unknown} data - The response payload.
 * @returns {ResponseItem} The success entry.
 */
function success(data: unknown): ResponseItem {
  return { kind: 'success', data };
}

/**
 * Repeat one response entry into a fresh array.
 * @param {ResponseItem} entry - Entry to repeat.
 * @param {number} count - Number of copies.
 * @returns {ResponseItem[]} The repeated entries.
 */
function repeat(entry: ResponseItem, count: number): ResponseItem[] {
  return Array.from({ length: count }, () => ({ ...entry }));
}

/**
 * Build the runtime scenario for one journey.
 *
 * @remarks
 * Startup warm-up datasets are sized generously; the journey queues are
 * supplied by the caller because their order is the behaviour under test.
 *
 * @param {ErrorPreviewOverrides} [overrides] - Per-method queue overrides.
 * @returns {RuntimeScenario} The configured runtime scenario.
 */
export function createErrorPreviewScenario(overrides: ErrorPreviewOverrides = {}): RuntimeScenario {
  return {
    hasScriptAuthorisation: repeat(success(true), AUTHORISATION_QUEUE_REPEATS),
    getABClassPartials: repeat(success([CANONICAL_CLASS_PARTIAL]), REFERENCE_DATA_QUEUE_REPEATS),
    getCohorts: repeat(success([]), REFERENCE_DATA_QUEUE_REPEATS),
    getYearGroups: repeat(success(CANONICAL_YEAR_GROUPS), REFERENCE_DATA_QUEUE_REPEATS),
    getAssignmentTopics: repeat(success([]), REFERENCE_DATA_QUEUE_REPEATS),
    getAssignmentDefinitionPartials: repeat(
      success(CANONICAL_DEFINITION_PARTIALS),
      DEFINITION_PARTIALS_QUEUE_REPEATS
    ),
    getABClass: repeat(success(CANONICAL_CLASS), CLASS_QUEUE_REPEATS),
    ...overrides,
  };
}

/**
 * Build the Class page's `getAssignment` queue in the order the prefetch warms it.
 *
 * @remarks
 * `useClassPageAssignmentPrefetch` warms `assignment-2-5`, `assignment-2-4` and
 * `assignment-2-3`; the opened assignment's slot carries its own canonical full
 * record so the heatmap joins that query key. The first slot has no full record
 * in the committed corpus and is served another valid canonical record whose
 * content no journey reads. Trailing copies cover later refetches on the same
 * key. Extra entries are never consumed; a missing entry fails loudly.
 * @returns {ResponseItem[]} The ordered, StrictMode-safe queue.
 */
export function classPageAssignmentQueue(): ResponseItem[] {
  const fillerAssignmentId = CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS.at(FILLER_PREFETCH_SLOT);
  const openedAssignmentId = CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS.at(1);
  if (fillerAssignmentId === undefined || openedAssignmentId === undefined) {
    throw new Error('Canonical prefetch list must carry three assignments.');
  }
  const filler: ResponseItem = { kind: 'success', data: canonicalAssignment(fillerAssignmentId) };
  const opened: ResponseItem = { kind: 'success', data: canonicalAssignment(openedAssignmentId) };
  return [{ ...filler }, { ...opened }, { ...filler }, { ...opened }, { ...opened }, { ...opened }];
}

/**
 * Install the scenario and open the canonical class overview.
 * @param {Page} page - The Playwright page.
 * @param {ErrorPreviewOverrides} [overrides] - Per-method queue overrides.
 * @returns {Promise<void>} Resolves once the Assignments table is visible.
 */
export async function openErrorClass(
  page: Page,
  overrides: ErrorPreviewOverrides = {}
): Promise<void> {
  await installRuntimeMock(page, createErrorPreviewScenario(overrides));
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  const classCard = page.getByRole('article').filter({ hasText: ERROR_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();
  await expect(assignmentsTable(page)).toBeVisible();
}

/**
 * Open one assignment's embedded heatmap from the class overview.
 * @param {Page} page - The Playwright page.
 * @param {string} assignmentId - Assignment instance to open.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
export async function openEmbeddedHeatmap(page: Page, assignmentId: string): Promise<void> {
  const assignmentName = assignmentNameButton(page, assignmentCardTitle(assignmentId));
  await expect(assignmentName).toHaveCount(1);
  await assignmentName.click();
  await expect(stickyTableWrapper(page)).toBeVisible();
}

// ---------------------------------------------------------------------------
// Locators and expectations
// ---------------------------------------------------------------------------

/**
 * Read the rendered task title of one task from a canonical record.
 * @param {string} assignmentId - Canonical assignment identity.
 * @param {string} taskId - Task identity.
 * @returns {string} The embedded definition's task title.
 */
export function taskTitle(assignmentId: string, taskId: string): string {
  const { tasks } = canonicalAssignment(assignmentId).assignmentDefinition;
  if (!Object.hasOwn(tasks, taskId)) {
    throw new Error(`assessment-error-preview-journeys: ${assignmentId} has no ${taskId}.`);
  }
  return tasks[taskId].taskTitle;
}

/**
 * Build the shared cell/trigger accessible label for one criterion.
 * @param {string} studentName - Rendered student name.
 * @param {string} taskTitle - Rendered task title.
 * @param {'completeness' | 'accuracy' | 'spag'} metric - Criterion.
 * @param {string} scoreText - Rendered score text.
 * @returns {string} The accessible label.
 */
export function cellLabel(
  studentName: string,
  taskTitle: string,
  metric: 'completeness' | 'accuracy' | 'spag',
  scoreText: string
): string {
  return buildMetricCellAccessibleLabel(studentName, taskTitle, metric, scoreText);
}

/**
 * The single open preview popover.
 * @param {Page} page - The Playwright page.
 * @returns {Locator} The visible popover.
 */
export function previewPopover(page: Page): Locator {
  return page.locator('.ant-popover:not(.ant-popover-hidden)').last();
}

/**
 * Open a metric cell's preview from the keyboard and return the popover.
 * @param {Page} page - The Playwright page.
 * @param {string} label - The cell's accessible label.
 * @returns {Promise<Locator>} The open popover.
 */
async function openPreviewByKeyboard(page: Page, label: string): Promise<Locator> {
  const trigger = page.getByRole('button', { name: label });
  await expect(trigger).toHaveCount(1);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popover = previewPopover(page);
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Open one cell's preview from the keyboard and assert its reasoning and source
 * headings.
 * @param {Page} page - The Playwright page.
 * @param {string} label - The cell's accessible label.
 * @returns {Promise<Locator>} The open popover.
 */
export async function openCell(page: Page, label: string): Promise<Locator> {
  const popover = await openPreviewByKeyboard(page, label);
  await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
  await expect(popover.getByText('Student Response', { exact: true })).toHaveCount(1);
  return popover;
}

/**
 * The source-region Alert inside a preview.
 * @param {Locator} popover - The open popover.
 * @returns {Locator} The Alert locator.
 */
export function sourceAlert(popover: Locator): Locator {
  return popover.getByRole('alert').filter({ hasText: UNAVAILABLE_TITLE });
}

/**
 * The rendered response renderer (image or Markdown) inside a preview.
 * @param {Locator} popover - The open popover.
 * @returns {Locator} The renderer locator.
 */
export function responseRenderer(popover: Locator): Locator {
  // CSS modules hash the token (`_markdown_<hash>_<line>`), so match by substring.
  return popover
    .locator('[class*="markdown"]')
    .or(popover.getByRole('img', { name: 'Student response image' }));
}
