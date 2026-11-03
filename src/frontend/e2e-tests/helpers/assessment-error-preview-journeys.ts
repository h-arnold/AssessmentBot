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
  ERROR_CLASS_NAME,
  UNAVAILABLE_TITLE,
} from './assessment-error-preview-fixtures';

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
  withLegacyClassAssignment,
  withLegacyReassessment,
  withMissingCriterion,
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
 * Install the scenario and open the canonical class overview.
 * @param {Page} page - The Playwright page.
 * @param {ErrorPreviewOverrides} [overrides] - Per-method queue overrides.
 * @returns {Promise<void>} Resolves once Recent Assignments is visible.
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
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

/**
 * Open one assignment's embedded heatmap from the class overview.
 * @param {Page} page - The Playwright page.
 * @param {string} assignmentId - Assignment instance to open.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
export async function openEmbeddedHeatmap(page: Page, assignmentId: string): Promise<void> {
  await page
    .getByRole('button')
    .filter({ hasText: assignmentCardTitle(assignmentId) })
    .click();
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Locators and expectations
// ---------------------------------------------------------------------------

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
export async function openPreviewByKeyboard(page: Page, label: string): Promise<Locator> {
  const trigger = page.getByRole('button', { name: label });
  await expect(trigger).toHaveCount(1);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popover = previewPopover(page);
  await expect(popover).toBeVisible();
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
  return popover
    .locator('.markdown')
    .or(popover.getByRole('img', { name: 'Student response image' }));
}
