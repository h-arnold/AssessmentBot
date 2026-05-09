import { googleScriptRunApiHandlerFactorySource } from '../../src/test/googleScriptRunHarness';
import type { Page } from '@playwright/test';
import {
  mockTopics,
  mockYearGroups,
  mockCohorts,
  mockFullDefinition,
} from '../../src/test/assignmentDefinition/sharedTestFixtures';

/**
 * Shared Playwright E2E runtime mocks for AssignmentBot.
 * 
 * This module provides reusable mock factories and helpers for Playwright E2E tests,
 * reducing duplication across test files that need to mock google.script.run API calls.
 */

// ============================================================================
// Response Types
// ============================================================================

/**
 * Base response item type for API scenarios.
 */
export type ResponseItem = Readonly<
  | {
      kind: 'success';
      data: unknown;
    }
  | {
      kind: 'failureEnvelope';
      data?: unknown;
      message?: string;
      code?: string;
    }
  | {
      kind: 'transportFailure';
      data?: unknown;
      message?: string;
      code?: string;
    }
  | {
      kind: 'deferredSuccess';
      data: unknown;
    }
>;

/**
 * Runtime scenario type for API method queues.
 */
export type RuntimeScenario = Readonly<{
  getAuthorisationStatus?: ReadonlyArray<ResponseItem>;
  getABClassPartials?: ReadonlyArray<ResponseItem>;
  getCohorts?: ReadonlyArray<ResponseItem>;
  getYearGroups?: ReadonlyArray<ResponseItem>;
  getAssignmentTopics?: ReadonlyArray<ResponseItem>;
  getGoogleClassrooms?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinitionPartials?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  deleteAssignmentDefinition?: ReadonlyArray<ResponseItem>;
}>;

// ============================================================================
// Mock Data Fixtures
// ============================================================================

// eslint-disable unicorn/prefer-export-from -- Re-export causes runtime issues with Playwright
export {
  // eslint-disable-next-line unicorn/prefer-export-from
  mockTopics,
  // eslint-disable-next-line unicorn/prefer-export-from
  mockYearGroups,
  // eslint-disable-next-line unicorn/prefer-export-from
  mockCohorts,
  // eslint-disable-next-line unicorn/prefer-export-from
  mockFullDefinition,
};
// eslint-enable unicorn/prefer-export-from


/**
 * Standard mock partial rows for E2E tests.
 */
export const mockPartialRows = [
  {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-123',
    templateDocumentId: 'tpl-doc-456',
    assignmentWeighting: 5,
    definitionKey: 'algebra-baseline',
    tasks: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
] as const;

/**
 * Standard mock created partial row for E2E tests.
 */
export const mockCreatedPartialRow = {
  primaryTitle: 'New Assessment',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'test-ref',
  templateDocumentId: 'test-tpl',
  assignmentWeighting: 5,
  definitionKey: 'new-assessment',
  tasks: null,
  createdAt: '2025-01-03T00:00:00.000Z',
  updatedAt: '2025-01-03T00:00:00.000Z',
} as const;

// ============================================================================
// Scenario Factories
// ============================================================================

/**
 * Options for creating a standard assignments runtime scenario.
 */
export interface CreateAssignmentsScenarioOptions {
  /** Initial partials data. */
  initialPartials?: unknown[];
  /** Partial data after mutations. */
  postMutationPartials?: unknown[];
  /** Delete responses. */
  deleteResponses?: ResponseItem[];
  /** Whether to include standard auth response. */
  includeAuth?: boolean;
  /** Whether to include standard class partials response. */
  includeClassPartials?: boolean;
  /** Whether to include standard cohorts response. */
  includeCohorts?: boolean;
  /** Whether to include standard year groups response. */
  includeYearGroups?: boolean;
  /** Whether to include standard assignment topics response. */
  includeAssignmentTopics?: boolean;
}

/**
 * Add auth response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} includeAuth Whether to include auth response.
 * @returns {void}
 */
function addAuthToScenario(scenario: RuntimeScenario, includeAuth: boolean): void {
  if (includeAuth) {
    scenario.getAuthorisationStatus = [{ kind: 'success', data: true }];
  }
}

/**
 * Add class partials response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} includeClassPartials Whether to include class partials response.
 * @returns {void}
 */
function addClassPartialsToScenario(
  scenario: RuntimeScenario,
  includeClassPartials: boolean
): void {
  if (includeClassPartials) {
    scenario.getABClassPartials = [{ kind: 'success', data: [] }];
  }
}

/**
 * Add cohorts response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} includeCohorts Whether to include cohorts response.
 * @returns {void}
 */
function addCohortsToScenario(scenario: RuntimeScenario, includeCohorts: boolean): void {
  if (includeCohorts) {
    scenario.getCohorts = [{ kind: 'success', data: mockCohorts }];
  }
}

/**
 * Add year groups response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} includeYearGroups Whether to include year groups response.
 * @returns {void}
 */
function addYearGroupsToScenario(
  scenario: RuntimeScenario,
  includeYearGroups: boolean
): void {
  if (includeYearGroups) {
    scenario.getYearGroups = [{ kind: 'success', data: mockYearGroups }];
  }
}

/**
 * Add assignment topics response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} includeAssignmentTopics Whether to include assignment topics response.
 * @returns {void}
 */
function addAssignmentTopicsToScenario(
  scenario: RuntimeScenario,
  includeAssignmentTopics: boolean
): void {
  if (includeAssignmentTopics) {
    scenario.getAssignmentTopics = [{ kind: 'success', data: mockTopics }];
  }
}

/**
 * Adds standard reference data responses to a scenario based on include flags.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {object} options Include flags for reference data.
 * @param {boolean} options.includeAuth Whether to include auth response.
 * @param {boolean} options.includeClassPartials Whether to include class partials response.
 * @param {boolean} options.includeCohorts Whether to include cohorts response.
 * @param {boolean} options.includeYearGroups Whether to include year groups response.
 * @param {boolean} options.includeAssignmentTopics Whether to include assignment topics response.
 * @returns {void}
 */
function addReferenceDataToScenario(
  scenario: RuntimeScenario,
  options: {
    includeAuth?: boolean;
    includeClassPartials?: boolean;
    includeCohorts?: boolean;
    includeYearGroups?: boolean;
    includeAssignmentTopics?: boolean;
  }
): void {
  const {
    includeAuth = true,
    includeClassPartials = true,
    includeCohorts = true,
    includeYearGroups = true,
    includeAssignmentTopics = true,
  } = options;

  addAuthToScenario(scenario, includeAuth);
  addClassPartialsToScenario(scenario, includeClassPartials);
  addCohortsToScenario(scenario, includeCohorts);
  addYearGroupsToScenario(scenario, includeYearGroups);
  addAssignmentTopicsToScenario(scenario, includeAssignmentTopics);
}

/**
 * Creates a standard runtime scenario for assignments page tests.
 *
 * @param {CreateAssignmentsScenarioOptions} options Scenario customization options.
 * @returns {RuntimeScenario} Configured runtime scenario.
 */
export function createAssignmentsScenario(
  options: CreateAssignmentsScenarioOptions = {}
): RuntimeScenario {
  const {
    initialPartials = [mockPartialRows[0]],
    postMutationPartials,
    deleteResponses = [{ kind: 'success', data: undefined }],
    includeAuth,
    includeClassPartials,
    includeCohorts,
    includeYearGroups,
    includeAssignmentTopics,
  } = options;

  const scenario: RuntimeScenario = {};

  addReferenceDataToScenario(scenario, {
    includeAuth,
    includeClassPartials,
    includeCohorts,
    includeYearGroups,
    includeAssignmentTopics,
  });

  scenario.getAssignmentDefinitionPartials = [
    { kind: 'success', data: initialPartials },
    ...(postMutationPartials ? [{ kind: 'success', data: postMutationPartials }] : []),
  ];

  scenario.deleteAssignmentDefinition = deleteResponses;

  return scenario;
}

/**
 * Options for creating a standard wizard runtime scenario.
 */
export interface CreateWizardScenarioOptions {
  /** Initial partials data. */
  initialPartials?: unknown[];
  /** Partial data after mutations. */
  postMutationPartials?: unknown[][];
  /** Assignment definition responses. */
  assignmentDefinitions?: ResponseItem[];
  /** Upsert responses. */
  upsertResponses?: ResponseItem[];
  /** Whether to include standard auth response. */
  includeAuth?: boolean;
  /** Whether to include standard class partials response. */
  includeClassPartials?: boolean;
  /** Whether to include standard cohorts response. */
  includeCohorts?: boolean;
  /** Whether to include standard year groups response. */
  includeYearGroups?: boolean;
  /** Whether to include standard assignment topics response. */
  includeAssignmentTopics?: boolean;
}

/**
 * Creates a standard runtime scenario for assignment definition wizard tests.
 *
 * @param {CreateWizardScenarioOptions} options Scenario customization options.
 * @returns {RuntimeScenario} Configured runtime scenario.
 */
export function createWizardScenario(
  options: CreateWizardScenarioOptions = {}
): RuntimeScenario {
  const {
    initialPartials = [mockPartialRows[0]],
    postMutationPartials,
    assignmentDefinitions = [{ kind: 'success', data: mockFullDefinition }],
    upsertResponses = [{ kind: 'success', data: mockFullDefinition }],
    includeAuth,
    includeClassPartials,
    includeCohorts,
    includeYearGroups,
    includeAssignmentTopics,
  } = options;

  const scenario: RuntimeScenario = {};

  addReferenceDataToScenario(scenario, {
    includeAuth,
    includeClassPartials,
    includeCohorts,
    includeYearGroups,
    includeAssignmentTopics,
  });

  scenario.getAssignmentDefinitionPartials = [
    { kind: 'success', data: initialPartials },
    ...(postMutationPartials?.map((data) => ({ kind: 'success', data })) || []),
  ];

  scenario.getAssignmentDefinition = assignmentDefinitions;
  scenario.upsertAssignmentDefinition = upsertResponses;

  return scenario;
}

/**
 * Creates a failed reference data scenario.
 *
 * @param {object} options Failure customization options.
 * @param {string} options.yearGroupsMessage Year groups failure message.
 * @param {string} options.topicsMessage Topics failure message.
 * @param {string} options.yearGroupsCode Year groups failure code.
 * @param {string} options.topicsCode Topics failure code.
 * @returns {RuntimeScenario} Runtime scenario with failed reference data.
 */
export function createFailedReferenceDataScenario(
  options: {
    yearGroupsMessage?: string;
    topicsMessage?: string;
    yearGroupsCode?: string;
    topicsCode?: string;
  } = {}
): RuntimeScenario {
  const {
    yearGroupsMessage = 'Could not load year groups',
    topicsMessage = 'Could not load topics',
    yearGroupsCode = 'LOAD_FAILED',
    topicsCode = 'LOAD_FAILED',
  } = options;

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [
      { kind: 'failureEnvelope', code: yearGroupsCode, message: yearGroupsMessage },
    ],
    getAssignmentTopics: [
      { kind: 'failureEnvelope', code: topicsCode, message: topicsMessage },
    ],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: mockPartialRows }],
  };
}

/**
 * Creates a failed refresh scenario.
 *
 * @param {object} options Failure customization options.
 * @param {string} options.message Refresh failure message.
 * @param {string} options.code Refresh failure code.
 * @returns {RuntimeScenario} Runtime scenario with failed refresh.
 */
export function createFailedRefreshScenario(
  options: {
    message?: string;
    code?: string;
  } = {}
): RuntimeScenario {
  const { message = 'Could not refresh after mutation', code = 'REFRESH_FAILED' } = options;

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: mockYearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: mockTopics }],
    getAssignmentDefinitionPartials: [
      { kind: 'success', data: mockPartialRows },
      { kind: 'failureEnvelope', code, message },
      { kind: 'failureEnvelope', code, message },
    ],
    upsertAssignmentDefinition: [{ kind: 'success', data: mockFullDefinition }],
  };
}

// ============================================================================
// Runtime Mock Installation
// ============================================================================

/**
 * Global tracking object name for method calls.
 */
const METHOD_CALLS_TRACKER = '__methodCalls' as const;

/**
 * Global tracking object name for deferred success queues.
 */
const DEFERRED_SUCCESS_QUEUE = '__deferredSuccessQueue' as const;

/**
 * Global tracking object name for releasing deferred success.
 */
const RELEASE_DEFERRED_FUNCTION = '__releaseNextDeferredSuccess' as const;

/**
 * Installs a browser-side `google.script.run` mock for E2E tests.
 *
 * @param {Page} page The Playwright page under test.
 * @param {RuntimeScenario} scenario The per-method response queue scenario.
 * @param {object} options Installation options.
 * @param {string} options.methodCallsTrackerName Name for the method calls tracker (default: '__methodCalls').
 * @param {string} options.deferredQueueTrackerName Name for the deferred queue tracker (default: '__deferredSuccessQueue').
 * @returns {Promise<void>} Resolves once the init script is installed.
 */
export async function installRuntimeMock(
  page: Page,
  scenario: RuntimeScenario,
  options: {
    methodCallsTrackerName?: string;
    deferredQueueTrackerName?: string;
  } = {}
): Promise<void> {
  const {
    methodCallsTrackerName = METHOD_CALLS_TRACKER,
    deferredQueueTrackerName = DEFERRED_SUCCESS_QUEUE,
  } = options;

  // Build the response queues from the scenario
  const responseQueues: Record<string, ResponseItem[]> = {};
  const allMethods = [
    'getAuthorisationStatus',
    'getABClassPartials',
    'getCohorts',
    'getYearGroups',
    'getAssignmentTopics',
    'getGoogleClassrooms',
    'getAssignmentDefinitionPartials',
    'getAssignmentDefinition',
    'upsertAssignmentDefinition',
    'deleteAssignmentDefinition',
  ] as const;

  // Method names are from a known const array - safe to use as keys
  for (const method of allMethods) {
    // eslint-disable-next-line security/detect-object-injection
    responseQueues[method] = scenario[method] ?? [];
  }

  // Build the call counts object
  const callCountsEntries = allMethods.map((method) => `${method}: 0`).join(', ');

  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};
      const responseQueues = ${JSON.stringify(responseQueues)};
      const callCounts = { ${callCountsEntries} };
      
      globalThis.${methodCallsTrackerName} = [];
      globalThis.${deferredQueueTrackerName} = [];

      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-' + method + '-' + responseIndex,
          data,
        });
      }

      function sendFailureEnvelope(callbacks, method, responseIndex, response) {
        callbacks.successHandler?.({
          ok: false,
          requestId: 'req-' + method + '-' + responseIndex,
          error: {
            code: response.code ?? 'INTERNAL_ERROR',
            message: response.message,
            retriable: false,
          },
        });
      }

      globalThis.${RELEASE_DEFERRED_FUNCTION} = () => {
        const nextDeferredSuccess = globalThis.${deferredQueueTrackerName}.shift();
        if (!nextDeferredSuccess) {
          throw new Error('No deferred success response available to release.');
        }
        nextDeferredSuccess();
      };

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;
            globalThis.${methodCallsTrackerName}.push(String(method));

            if (!(method in responseQueues)) {
              callbacks.failureHandler?.(new Error('Unexpected call to method: ' + String(method)));
              return;
            }

            const responseIndex = callCounts[method];
            const response = responseQueues[method][responseIndex];
            callCounts[method] += 1;

            if (response === undefined) {
              callbacks.failureHandler?.(
                new Error('Unexpected call index for method ' + method + ': ' + String(responseIndex))
              );
              return;
            }

            if (response.kind === 'transportFailure') {
              callbacks.failureHandler?.(new Error(response.message));
              return;
            }

            if (response.kind === 'failureEnvelope') {
              sendFailureEnvelope(callbacks, method, responseIndex, response);
              return;
            }

            if (response.kind === 'deferredSuccess') {
              globalThis.${deferredQueueTrackerName}.push(() => {
                sendSuccess(callbacks, method, responseIndex, response.data);
              });
              return;
            }

            sendSuccess(callbacks, method, responseIndex, response.data);
          }),
        },
      };
    })();
  `);
}

/**
 * Releases the next deferred success response in the queue.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} releaseFunctionName Name for the release function (default: '__releaseNextDeferredSuccess').
 * @returns {Promise<void>} Resolves once the deferred response has been released.
 */
export async function releaseNextDeferredSuccess(
  page: Page,
  releaseFunctionName: string = RELEASE_DEFERRED_FUNCTION
): Promise<void> {
  await page.evaluate(`
    (() => {
      (globalThis as { ${releaseFunctionName}: () => void }).${releaseFunctionName}();
    })();
  `);
}

/**
 * Gets the method calls made during the test.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} trackerName Name for the method calls tracker (default: '__methodCalls').
 * @returns {Promise<string[]>} Array of method call names.
 */
export async function getMethodCalls(
  page: Page,
  trackerName: string = METHOD_CALLS_TRACKER
): Promise<string[]> {
  return await page.evaluate(`
    (() => {
      return (globalThis as { ${trackerName}: string[] }).${trackerName} || [];
    })();
  `);
}

// ============================================================================
// Filter Interaction Helpers
// ============================================================================

/**
 * Applies one column filter option using visible controls only.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} columnHeaderName Column header label.
 * @param {string} optionLabel Visible filter option label.
 * @returns {Promise<void>} Resolves when the option is selected.
 */
export async function applyColumnFilterOption(
  page: Page,
  columnHeaderName: string | RegExp,
  optionLabel: string | RegExp
): Promise<void> {
  await page.getByRole('columnheader', { name: columnHeaderName }).getByRole('button').click();

  const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
  await expect(activeFilterPopup).toBeVisible();
  await activeFilterPopup.getByText(optionLabel, { exact: true }).click();

  await page.keyboard.press('Escape');
}

/**
 * Selects one visible Ant Design select option from the active dropdown overlay.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} optionName The visible option label to choose.
 * @returns {Promise<void>} Resolves once the option is selected.
 */
export async function selectVisibleOption(
  page: Page,
  optionName: string
): Promise<void> {
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(optionName, { exact: true })
    .click();
}

// ============================================================================
// Table Interaction Helpers
// ============================================================================

/**
 * Locates one assignments table row by exact title cell text.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} assignmentTitle Exact assignment title shown in the first column.
 * @returns {import('@playwright/test').Locator} Row locator scoped to the assignments table.
 */
export function getAssignmentsRowByTitle(
  page: Page,
  assignmentTitle: string
): ReturnType<typeof page.getByRole> {
  const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
  const titleCell = assignmentsTable
    .locator('tbody tr td:first-child')
    .getByText(assignmentTitle, { exact: true });

  return titleCell.locator('xpath=ancestor::tr');
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigates to the Assignments page from the root.
 *
 * @param {Page} page Playwright page instance.
 * @returns {Promise<void>} Resolves when navigation is complete.
 */
export async function navigateToAssignmentsPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
}

/**
 * Default timeout for waiting for page ready state in milliseconds.
 */
const DEFAULT_PAGE_READY_TIMEOUT = 10_000;

/**
 * Waits for the assignments page to be ready (blocking state cleared, loading finished).
 *
 * @param {Page} page Playwright page instance.
 * @param {object} options Wait options.
 * @param {number} options.timeout Timeout in milliseconds (default: DEFAULT_PAGE_READY_TIMEOUT).
 * @returns {Promise<void>} Resolves when page is ready.
 */
export async function waitForAssignmentsPageReady(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_PAGE_READY_TIMEOUT } = options;

  await expect(
    page.getByText('Assignment definitions could not be trusted or loaded.')
  ).toHaveCount(0, { timeout });
  await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);
}
