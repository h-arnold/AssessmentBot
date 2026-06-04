import { expect, type Page } from '@playwright/test';
import type { RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import {
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  SINGLE_YEAR_GROUP,
  YEAR_GROUPS_WITH_EMPTY,
  toPlainClassPartials,
} from '../../src/test/classes/classesPageTestHelpers';

// ============================================================================
// Navigation and UI Constants
// ============================================================================

export const APP_BREADCRUMB_BASE_LABEL = 'AssessmentBot Frontend' as const;
export const BREADCRUMB_NAVIGATION_NAME = 'Breadcrumb' as const;
export const PRIMARY_NAVIGATION_LABEL = 'Primary navigation' as const;
export const CLASSES_LABEL = 'Classes' as const;
export const EXPECTED_MENU_ITEM_COUNT = 4;

// ============================================================================
// Backend Settings Fixture
// ============================================================================

/**
 * Standard backend settings fixture for E2E tests.
 */
export const backendSettingsFixture = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} as const;

// ============================================================================
// Viewport Constants
// ============================================================================

export const MOBILE_VIEWPORT_WIDTH = 375;
export const MOBILE_VIEWPORT_HEIGHT = 667;
export const TABLET_VIEWPORT_WIDTH = 768;
export const TABLET_VIEWPORT_HEIGHT = 1024;

export const MIN_CARD_WIDTH_MOBILE = 200;
export const MIN_CARD_WIDTH_TABLET = 250;

// Geometry assertion constants for lint compliance
export const NUMBER_OF_YEAR_GROUP_PANELS = 3;
export const HORIZONTAL_OVERFLOW_TOLERANCE_MULTIPLIER = 1.3;
export const MOBILE_CARD_WIDTH_TOLERANCE = 25;
export const TABLET_CARD_WIDTH_MARGIN = 50;

// ============================================================================
// Card Count Constants
// ============================================================================

export const EXPECTED_TOTAL_CARDS_COUNT = 4; // 2 in Year 10, 1 in Year 11, 1 in Year 9
export const EXPECTED_BUTTONS_PER_CARD = 2; // View and Assess Task
export const EXPECTED_ALPHABETICAL_CARDS_COUNT = 3;
export const EXPECTED_TIE_BREAK_CARDS_COUNT = 3;

// Card index constants for test readability
export const CARD_INDEX_FIRST = 0;
export const CARD_INDEX_SECOND = 1;
export const CARD_INDEX_THIRD = 2;

// ============================================================================
// Scenario Factory Helpers
// ============================================================================

/**
 * Options for creating a Classes page runtime scenario.
 */
export interface CreateClassesScenarioOptions {
  classPartials?: Array<Record<string, unknown>>;
  yearGroups?: Array<{ key: string; name: string }>;
}

/**
 * Creates a runtime scenario for Classes page tests.
 *
 * @param {CreateClassesScenarioOptions} options - Options for the scenario.
 * @returns {RuntimeScenario} Runtime scenario.
 */
export function createClassesScenario(options: CreateClassesScenarioOptions = {}): RuntimeScenario {
  const {
    classPartials = toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
    yearGroups = MIXED_ORDER_YEAR_GROUPS,
  } = options;

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: classPartials }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: yearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
}

/**
 * Creates a runtime scenario for empty panel test.
 *
 * @returns {RuntimeScenario} Runtime scenario.
 */
export function createClassesEmptyPanelScenario(): RuntimeScenario {
  return createClassesScenario({
    classPartials: toPlainClassPartials(CLASS_PARTIALS_FOR_EMPTY_PANEL),
    yearGroups: YEAR_GROUPS_WITH_EMPTY,
  });
}

/**
 * Creates a runtime scenario for class-card ordering tests
 * (alphabetical order or tie-break order).
 *
 * @param {Array<Record<string, unknown>>} classPartials - Plain class partials to use.
 * @returns {RuntimeScenario} Runtime scenario.
 */
export function createClassesOrderScenario(
  classPartials: Array<Record<string, unknown>>
): RuntimeScenario {
  return createClassesScenario({ classPartials, yearGroups: SINGLE_YEAR_GROUP });
}

// ============================================================================
// Navigation and Setup Helpers
// ============================================================================

/**
 * Returns the rendered breadcrumb locator.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {ReturnType<typeof page.getByRole>} The breadcrumb locator.
 */
export function getBreadcrumb(page: Page): ReturnType<typeof page.getByRole> {
  return page.getByRole('navigation', { name: BREADCRUMB_NAVIGATION_NAME });
}

/**
 * Asserts the visible breadcrumb labels.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string[]} labels - The expected breadcrumb labels.
 * @returns {Promise<void>}
 */
export async function expectBreadcrumbLabels(page: Page, labels: string[]): Promise<void> {
  const breadcrumb = getBreadcrumb(page);

  await expect(breadcrumb).toBeVisible();

  for (const label of labels) {
    await expect(breadcrumb).toContainText(label);
  }
}

// ============================================================================
// Button State Assertion Helpers
// ============================================================================

/**
 * Asserts that every card has View (disabled) and Assess Task (enabled) buttons.
 * Edit buttons must be absent.
 *
 * Replaces the earlier assertAllViewEditButtonsDisabled to reflect the
 * Edit → Assess Task button replacement in Section 4.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>}
 */
export async function assertCardButtonStates(page: Page): Promise<void> {
  // View buttons: exist, are disabled
  const allViewButtons = await page.getByRole('button', { name: /view/i }).all();
  for (const viewButton of allViewButtons) {
    await expect(viewButton).toBeVisible();
    await expect(viewButton).toBeDisabled();
  }

  // Assess Task buttons: exist, are enabled, have aria-label
  const allAssessTaskButtons = await page.getByRole('button', { name: 'Assess Task' }).all();
  for (const assessButton of allAssessTaskButtons) {
    await expect(assessButton).toBeVisible();
    await expect(assessButton).toBeEnabled();
    await expect(assessButton).toHaveAttribute('aria-label', 'Assess Task');
  }

  // Edit buttons: must be absent
  const allEditButtons = await page.getByRole('button', { name: /edit/i }).all();
  expect(allEditButtons).toHaveLength(0);
}

// ============================================================================
// Panel Interaction Helpers
// ============================================================================

/**
 * Expands all year group panels on the Classes page.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>}
 */
export async function expandAllYearGroupPanels(page: Page): Promise<void> {
  // Click Year 11 header
  await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
  // Click Year 9 header
  await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();
}

/**
 * Gets the panel content locator for a specific year group.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} yearGroupKey - The year group key (e.g., 'year-group-10').
 * @returns {ReturnType<typeof page.locator>} The panel content locator.
 */
export function getYearGroupPanelContent(
  page: Page,
  yearGroupKey: string
): ReturnType<typeof page.locator> {
  return page.locator(`#panel-content-${yearGroupKey}`);
}

/**
 * Gets the collapse header locator for a specific year group.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} yearGroupName - The year group name (e.g., 'Year 10').
 * @returns {ReturnType<typeof page.locator>} The collapse header locator.
 */
export function getYearGroupCollapseHeader(
  page: Page,
  yearGroupName: string
): ReturnType<typeof page.locator> {
  return page.locator('.ant-collapse-header').filter({ hasText: yearGroupName });
}

// ============================================================================
// Re-exports from canonical test helpers
// ============================================================================

export {
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  SINGLE_YEAR_GROUP,
  YEAR_GROUPS_WITH_EMPTY,
  toPlainClassPartials,
} from '../../src/test/classes/classesPageTestHelpers';
