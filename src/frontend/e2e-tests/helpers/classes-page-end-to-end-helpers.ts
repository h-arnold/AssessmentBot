import type { Page } from '@playwright/test';
import type { RuntimeScenario } from '../shared/endToEndRuntimeMocks';

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
// Viewport Constants (Section 6)
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
// Card Count Constants (Section 5 and 6)
// ============================================================================

export const EXPECTED_TOTAL_CARDS_COUNT = 4; // 2 in Year 10, 1 in Year 11, 1 in Year 9
export const EXPECTED_BUTTONS_PER_CARD = 2; // View and Edit
export const EXPECTED_ALPHABETICAL_CARDS_COUNT = 3;
export const EXPECTED_TIE_BREAK_CARDS_COUNT = 3;

// Card index constants for test readability
export const CARD_INDEX_FIRST = 0;
export const CARD_INDEX_SECOND = 1;
export const CARD_INDEX_THIRD = 2;

// ============================================================================
// Year Group Fixtures
// ============================================================================

/**
 * Year groups in mixed order (will be sorted alphabetically: Year 10, Year 11, Year 9).
 */
export const MIXED_ORDER_YEAR_GROUPS = [
  { key: 'year-group-11', name: 'Year 11' },
  { key: 'year-group-9', name: 'Year 9' },
  { key: 'year-group-10', name: 'Year 10' },
] as const;

/**
 * Class partials belonging to each year group (matching MIXED_ORDER_YEAR_GROUPS).
 */
export const MIXED_ORDER_CLASS_PARTIALS = [
  {
    classId: 'class-math-11a',
    className: 'Mathematics 11A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-11',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-science-9',
    className: 'Science 9',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-9',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-english-10',
    className: 'English 10',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

/**
 * Year groups with empty one (Year 9 has no classes).
 */
export const YEAR_GROUPS_WITH_EMPTY = [
  { key: 'year-group-9', name: 'Year 9' },
  { key: 'year-group-10', name: 'Year 10' },
] as const;

/**
 * Class partials for empty panel test (only classes for Year 10).
 */
export const CLASS_PARTIALS_FOR_EMPTY_PANEL = [
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

// ============================================================================
// Section 5 Fixtures (Card sorting and rendering)
// ============================================================================

/**
 * Classes with names that need alphabetical ordering.
 */
export const ALPHABETICAL_ORDER_CLASSES = [
  {
    classId: 'class-math-10b',
    className: 'Mathematics 10B',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-english-10',
    className: 'English 10',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

/**
 * Classes with same name but different IDs for tie-break testing.
 */
export const TIE_BREAK_CLASSES = [
  {
    classId: 'class-b-z',
    className: 'Z Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-a-z',
    className: 'Z Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-b-a',
    className: 'A Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

/**
 * Single year group for focused tests.
 */
export const SINGLE_YEAR_GROUP = [{ key: 'year-group-10', name: 'Year 10' }] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns plain JavaScript objects without TypeScript type annotations for JSON serialization.
 *
 * @param {typeof MIXED_ORDER_CLASS_PARTIALS} classPartials - Class partials to convert.
 * @returns {Array<Record<string, unknown>>} Plain objects.
 */
export function getPlainClassPartials(
  classPartials: typeof MIXED_ORDER_CLASS_PARTIALS
): Array<Record<string, unknown>> {
  return classPartials.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));
}

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
    classPartials = getPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
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
    classPartials: getPlainClassPartials(CLASS_PARTIALS_FOR_EMPTY_PANEL),
    yearGroups: YEAR_GROUPS_WITH_EMPTY,
  });
}

/**
 * Creates a runtime scenario for alphabetical order test.
 *
 * @returns {RuntimeScenario} Runtime scenario.
 */
export function createClassesAlphabeticalOrderScenario(): RuntimeScenario {
  const plainClasses = ALPHABETICAL_ORDER_CLASSES.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: plainClasses }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: SINGLE_YEAR_GROUP }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
}

/**
 * Creates a runtime scenario for tie-break order test.
 *
 * @returns {RuntimeScenario} Runtime scenario.
 */
export function createClassesTieBreakOrderScenario(): RuntimeScenario {
  const plainClasses = TIE_BREAK_CLASSES.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: plainClasses }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: SINGLE_YEAR_GROUP }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
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
