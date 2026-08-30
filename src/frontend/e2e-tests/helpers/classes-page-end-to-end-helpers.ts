import { expect, type Locator, type Page } from '@playwright/test';
import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import { installRuntimeMock, selectVisibleOption } from '../shared/endToEndRuntimeMocks';
import {
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  SINGLE_YEAR_GROUP,
  YEAR_GROUPS_WITH_EMPTY,
  toPlainClassPartials,
} from '../../src/test/classes/classesPageTestHelpers';

// ============================================================================
// Assignment Fixture Data
// ============================================================================

/** Reusable assignment data for an "Algebra Homework" coursework assignment with topic. */
export const ALGEBRA_HOMEWORK_DATA = {
  assignmentId: 'cw-1',
  title: 'Algebra Homework',
  topicId: 'topic-algebra',
  topicName: 'Algebra',
} as const;

/**
 * Creates a success entry containing a single Algebra Homework assignment.
 * Suitable for scenario queues — call twice for StrictMode double-effect coverage.
 *
 * @returns {ResponseItem} A success entry with one Algebra Homework assignment.
 */
export function algebraHomeworkEntry(): ResponseItem {
  return { kind: 'success' as const, data: [ALGEBRA_HOMEWORK_DATA] };
}

// ============================================================================
// Navigation and UI Constants
// ============================================================================

export const BREADCRUMB_NAVIGATION_NAME = 'Breadcrumb' as const;
export const PRIMARY_NAVIGATION_LABEL = 'Primary navigation' as const;
export const CLASSES_LABEL = 'Classes' as const;
export const EXPECTED_MENU_ITEM_COUNT = 5;

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
// Mock Assignment Fixture Data
// ============================================================================

/**
 * Standard mock coursework assignments for Assess Task modal E2E tests.
 *
 * Two entries are provided to cover React 19 StrictMode double-effect firing
 * in development. Each entry returns the same assignment data so the modal
 * stabilises to the ready state regardless of effect replay count.
 */
export const MOCK_COURSEWORK_ASSIGNMENTS: ReadonlyArray<ResponseItem> = [
  {
    kind: 'success',
    data: [
      { assignmentId: 'cw-1', title: 'Algebra Homework' },
      { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
    ],
  },
  {
    kind: 'success',
    data: [
      { assignmentId: 'cw-1', title: 'Algebra Homework' },
      { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
    ],
  },
];

// ============================================================================
// Scenario Factory Helpers
// ============================================================================

/**
 * Options for creating a Classes page runtime scenario.
 */
export interface CreateClassesScenarioOptions {
  classPartials?: Array<Record<string, unknown>>;
  yearGroups?: Array<{ key: string; name: string }>;
  getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>;
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
    getGoogleClassroomAssignments,
  } = options;

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: classPartials }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: yearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
    ...(getGoogleClassroomAssignments === undefined ? {} : { getGoogleClassroomAssignments }),
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

/**
 * Options for creating an Assess Task modal runtime scenario.
 *
 * Extends {@link CreateClassesScenarioOptions} with fields specific to
 * the Assess Task workflow: `startAssessmentRun` and `upsertAssignmentDefinition`.
 */
export interface CreateAssessTaskScenarioOptions extends CreateClassesScenarioOptions {
  startAssessmentRun?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
}

/**
 * Creates a runtime scenario for Assess Task modal E2E tests.
 *
 * Extends the standard Classes page scenario with `getGoogleClassroomAssignments`
 * mock responses. Defaults to `MOCK_COURSEWORK_ASSIGNMENTS` if no assignment
 * responses are provided.
 *
 * @param {CreateAssessTaskScenarioOptions} options - Scenario customisation options.
 * @returns {RuntimeScenario} Runtime scenario with assignment mock data.
 */
export function createAssessTaskScenario(
  options: CreateAssessTaskScenarioOptions = {}
): RuntimeScenario {
  const { startAssessmentRun, upsertAssignmentDefinition, ...classesOptions } = options;
  const scenario = createClassesScenario({
    ...classesOptions,
    getGoogleClassroomAssignments:
      options.getGoogleClassroomAssignments ?? MOCK_COURSEWORK_ASSIGNMENTS,
  });
  return {
    ...scenario,
    ...(startAssessmentRun !== undefined && { startAssessmentRun }),
    ...(upsertAssignmentDefinition !== undefined && { upsertAssignmentDefinition }),
  };
}

// ============================================================================
// Linkable Scenario Helpers
// ============================================================================

/**
 * Default linkable partial fixture for link-picker E2E tests.
 *
 * Represents an assignment definition partial that can be linked to
 * when the user clicks "Link to Existing Definition" in the choice prompt.
 */
const DEFAULT_LINKABLE_PARTIAL = {
  definitionKey: 'default-linkable-key',
  primaryTitle: 'Algebra HW',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-123',
  templateDocumentId: 'tpl-456',
  assignmentWeighting: 5,
  tasks: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-03-01T00:00:00.000Z',
};

const DEFAULT_LINKABLE_PARTIALS_ENTRY: ResponseItem = {
  kind: 'success',
  data: [DEFAULT_LINKABLE_PARTIAL],
};

const DEFAULT_UPSERT_SUCCESS_ENTRY: ResponseItem = {
  kind: 'success',
  data: DEFAULT_LINKABLE_PARTIAL,
};

const DEFAULT_START_RUN_SUCCESS_ENTRY: ResponseItem = {
  kind: 'success',
  data: null,
};

/**
 * Creates a runtime scenario configured for link-to-existing-definition flow tests.
 *
 * Builds on {@link createAssessTaskScenario} and adds a `getAssignmentDefinitionPartials`
 * queue for the link picker. When `useDefaults` is true (default), standard
 * `upsertAssignmentDefinition` and `startAssessmentRun` success entries are included.
 *
 * @param {Partial<CreateAssessTaskScenarioOptions> & {linkablePartialsEntry?: ResponseItem; useDefaults?: boolean}} overrides - Scenario customisation options.
 * @param {ResponseItem} [overrides.linkablePartialsEntry] - Override the default partials entry for the link picker.
 * @param {boolean} [overrides.useDefaults] - When true (default), include default upsert and startRun entries.
 *   When false, only include those explicitly provided via `CreateAssessTaskScenarioOptions`.
 * @returns {RuntimeScenario} RuntimeScenario with linkable partials.
 */
// eslint-disable-next-line complexity -- Test helper with many optional parameters
export function createLinkableScenario(
  overrides: Partial<CreateAssessTaskScenarioOptions> & {
    linkablePartialsEntry?: ResponseItem;
    useDefaults?: boolean;
  } = {}
): RuntimeScenario {
  const {
    classPartials,
    yearGroups,
    getGoogleClassroomAssignments,
    upsertAssignmentDefinition,
    startAssessmentRun,
    linkablePartialsEntry,
    useDefaults = true,
  } = overrides;

  const scenarioOptions: Partial<CreateAssessTaskScenarioOptions> = {
    classPartials,
    yearGroups,
    getGoogleClassroomAssignments,
    upsertAssignmentDefinition,
    startAssessmentRun,
  };

  const scenario = createAssessTaskScenario(scenarioOptions);
  const entry = linkablePartialsEntry ?? DEFAULT_LINKABLE_PARTIALS_ENTRY;

  const upsertEntry =
    useDefaults && !scenarioOptions.upsertAssignmentDefinition
      ? [DEFAULT_UPSERT_SUCCESS_ENTRY, DEFAULT_UPSERT_SUCCESS_ENTRY]
      : undefined;

  const runEntry =
    useDefaults && !scenarioOptions.startAssessmentRun
      ? [DEFAULT_START_RUN_SUCCESS_ENTRY, DEFAULT_START_RUN_SUCCESS_ENTRY]
      : undefined;

  return {
    ...scenario,
    getAssignmentDefinitionPartials: [entry, entry],
    ...(upsertEntry === undefined ? {} : { upsertAssignmentDefinition: upsertEntry }),
    ...(runEntry === undefined ? {} : { startAssessmentRun: runEntry }),
  };
}

/**
 * Installs a linkable runtime scenario and opens the Assess Task modal.
 *
 * Convenience helper that combines {@link installRuntimeMock} and
 * {@link openAssessTaskModal} for the link-picker flow preamble.
 * The caller is responsible for calling `selectAssignmentAndStart`
 * after this function returns.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {RuntimeScenario} [scenario] - Optional scenario. Defaults to `createLinkableScenario()`.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible dialog locator.
 */
export async function setupLinkableDialog(
  page: Page,
  scenario?: RuntimeScenario
): Promise<ReturnType<typeof page.getByRole>> {
  await installRuntimeMock(page, scenario ?? createLinkableScenario());
  return openAssessTaskModal(page);
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
// Assess Task Modal Helpers
// ============================================================================

/**
 * Navigates to the Classes page and opens the first Assess Task modal.
 *
 * Handles the common test preamble: goto → menu click → panel visibility
 * check → Assess Task button click → dialog visibility check.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible dialog locator.
 */
export async function openAssessTaskModal(page: Page): Promise<ReturnType<typeof page.getByRole>> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();
  await expect(page.locator('#panel-content-year-group-10')).toBeVisible();

  await page.getByRole('button', { name: 'Assess Task' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  return dialog;
}

/**
 * Selects an assignment from the combobox and clicks Start Assessment.
 *
 * @param {Locator} dialog - The modal dialog locator.
 * @param {Page} page - The Playwright page.
 * @param {string} [title] - The visible text of the assignment option to select.
 * @returns {Promise<void>}
 */
export async function selectAssignmentAndStart(
  dialog: Locator,
  page: Page,
  title: string = 'Algebra Homework'
): Promise<void> {
  await dialog.getByTestId('assignment-select').click();
  await selectVisibleOption(page, title);
  await dialog.getByRole('button', { name: 'Start Assessment' }).click();
}

/**
 * Selects the default assignment, starts the assessment, clicks
 * "Create New Definition" in the choice prompt, then asserts the
 * wizard dialog is visible.  Returns the wizard dialog locator.
 *
 * Callers must already have installed a runtime mock and opened the
 * Assess Task modal before calling this helper.
 *
 * @param {Locator} dialog - The Assess Task modal dialog locator.
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible wizard dialog locator.
 */

/**
 * Opens the linkable-definition Select dropdown and selects the option matching
 * the given primary title.
 *
 * @param {Locator} dialog The Assess Task modal dialog locator.
 * @param {Page} page The Playwright page under test.
 * @param {string} title The primary title of the option to select.
 * @returns {Promise<void>}
 */
export async function pickLinkableDefinitionE2E(
  dialog: Locator,
  page: Page,
  title: string
): Promise<void> {
  await dialog.getByTestId('linkable-definition-select').click();
  await selectVisibleOption(page, title);
}

/**
 * Opens the assignment Select dropdown and selects the option matching
 * the given title.
 *
 * @param {Locator} dialog The Assess Task modal dialog locator.
 * @param {Page} page The Playwright page under test.
 * @param {string} [title] The visible text of the assignment option to select.
 * @returns {Promise<void>}
 */
export async function pickAssignmentE2E(
  dialog: Locator,
  page: Page,
  title: string = 'Algebra Homework'
): Promise<void> {
  await dialog.getByTestId('assignment-select').click();
  await selectVisibleOption(page, title);
}

/**
 * Selects the default assignment, starts the assessment, clicks
 * "Create New Definition" in the choice prompt, then asserts the
 * wizard dialog is visible.
 *
 * @param {Locator} dialog The Assess Task modal dialog locator.
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<ReturnType<typeof page.getByRole>>} The visible wizard dialog locator.
 */
export async function openWizardFromChoicePrompt(
  dialog: Locator,
  page: Page
): Promise<ReturnType<typeof page.getByRole>> {
  await selectAssignmentAndStart(dialog, page);
  await dialog.getByRole('button', { name: 'Create New Definition' }).click();

  const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
  await expect(wizardDialog).toBeVisible();

  return wizardDialog;
}

/**
 * Sets up the Assess Task modal with an Algebra Homework scenario, opens the
 * wizard from the choice prompt, and returns both dialog locators.
 *
 * Replaces the common preamble shared by wizard cancellation tests.
 *
 * @param {{ page: Page; getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem> }} options
 *   Page and optional assignment queue override (defaults to two algebra entries).
 * @returns {Promise<{ dialog: Locator; wizardDialog: Locator }>} The Assess Task
 *   dialog and the wizard dialog locators.
 */
export async function setupWizardDialog({
  page,
  getGoogleClassroomAssignments,
}: {
  page: Page;
  getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>;
}): Promise<{ dialog: Locator; wizardDialog: Locator }> {
  const scenario = createAssessTaskScenario({
    getGoogleClassroomAssignments: getGoogleClassroomAssignments ?? [
      algebraHomeworkEntry(),
      algebraHomeworkEntry(),
    ],
  });
  await installRuntimeMock(page, scenario);
  const dialog = await openAssessTaskModal(page);
  const wizardDialog = await openWizardFromChoicePrompt(dialog, page);
  return { dialog, wizardDialog };
}

/**
 * Sets up a linkable dialog with three linkable partials, opens the link picker
 * dropdown, and returns the search input locator.
 *
 * Replaces the common preamble shared by link-picker search tests.
 *
 * @param {{ page: Page; linkablePartialsEntry: ResponseItem }} options
 *   Page and the linkable partials entry containing the definitions to populate
 *   the picker.
 * @returns {Promise<{ searchInput: Locator }>} The combobox search input locator.
 */
export async function openLinkPickerDropdown({
  page,
  linkablePartialsEntry,
}: {
  page: Page;
  linkablePartialsEntry: ResponseItem;
}): Promise<{ searchInput: Locator }> {
  const dialog = await setupLinkableDialog(
    page,
    createLinkableScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
      linkablePartialsEntry,
    })
  );

  await selectAssignmentAndStart(dialog, page);
  await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
  await dialog.getByTestId('linkable-definition-select').click();

  const searchInput = page.getByTestId('linkable-definition-select').getByRole('combobox');
  return { searchInput };
}

// ============================================================================
// Button State Assertion Helpers
// ============================================================================

/**
 * Asserts that every card has View (enabled) and Assess Task (enabled) buttons.
 * Edit buttons must be absent.
 *
 * Replaces the earlier assertAllViewEditButtonsDisabled to reflect the
 * Edit → Assess Task button replacement in Section 4, and the View button
 * enablement in Section 8 (Shell integration).
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>}
 */
export async function assertCardButtonStates(page: Page): Promise<void> {
  // View buttons: exist, are enabled
  const allViewButtons = await page.getByRole('button', { name: /view/i }).all();
  for (const viewButton of allViewButtons) {
    await expect(viewButton).toBeVisible();
    await expect(viewButton).toBeEnabled();
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
