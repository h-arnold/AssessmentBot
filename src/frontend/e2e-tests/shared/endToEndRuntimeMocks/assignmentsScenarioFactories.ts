import {
  mockTopics,
  mockYearGroups,
  mockCohorts,
  mockFullDefinition,
} from '../../../src/test/assignmentDefinition/sharedTestFixtures';
import type { ResponseItem, RuntimeScenario } from './types';

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
  initialPartials?: ReadonlyArray<unknown>;
  /** Partial data after mutations. */
  postMutationPartials?: ReadonlyArray<unknown>;
  /** Delete responses. */
  deleteResponses?: ReadonlyArray<ResponseItem>;
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
function addYearGroupsToScenario(scenario: RuntimeScenario, includeYearGroups: boolean): void {
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
  initialPartials?: ReadonlyArray<unknown>;
  /** Partial data after mutations. */
  postMutationPartials?: ReadonlyArray<ReadonlyArray<unknown>>;
  /** Assignment definition responses. */
  assignmentDefinitions?: ReadonlyArray<ResponseItem>;
  /** Upsert responses. */
  upsertResponses?: ReadonlyArray<ResponseItem>;
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
export function createWizardScenario(options: CreateWizardScenarioOptions = {}): RuntimeScenario {
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
    getYearGroups: [{ kind: 'failureEnvelope', code: yearGroupsCode, message: yearGroupsMessage }],
    getAssignmentTopics: [{ kind: 'failureEnvelope', code: topicsCode, message: topicsMessage }],
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
