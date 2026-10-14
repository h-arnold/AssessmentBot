import {
  mockTopics,
  mockYearGroups,
  mockCohorts,
  mockFullDefinition,
} from '../../src/test/assignmentDefinition/sharedTestFixtures';
import type { ResponseItem, RuntimeScenario } from './runtimeMockTypes';

type MutableRuntimeScenario = { -readonly [Key in keyof RuntimeScenario]?: RuntimeScenario[Key] };

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
    tasks: [],
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
  tasks: [],
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
 * Creates the ordered partials responses used by assignments and wizard scenarios.
 *
 * @param {ReadonlyArray<unknown>} initialPartials Initial response data.
 * @param {ReadonlyArray<unknown>} [postMutationPartials] Later refresh response data.
 * @returns {ResponseItem[]} Success responses in request order.
 */
function createDefinitionPartialsQueue(
  initialPartials: ReadonlyArray<unknown>,
  postMutationPartials?: ReadonlyArray<unknown>
): ResponseItem[] {
  return [
    { kind: 'success', data: initialPartials },
    ...(postMutationPartials?.map((data) => ({ kind: 'success' as const, data })) || []),
  ];
}

/**
 * Options for creating a runtime scenario for the Authentication settings tab.
 */
export interface CreateAuthenticationSettingsScenarioOptions {
  /** Authentication settings responses, including any post-save refreshes. */
  authenticationSettings?: ReadonlyArray<ResponseItem>;
  /** Authentication settings save responses. */
  saveResponses?: ReadonlyArray<ResponseItem>;
}

/** Startup methods used by the authorisation gate before the application is ready. */
export const AUTHORISATION_WARMUP_METHODS = [
  'getABClassPartials',
  'getAssignmentDefinitionPartials',
  'getAssignmentTopics',
  'getCohorts',
  'getYearGroups',
] as const;

type AuthorisationWarmupMethod = (typeof AUTHORISATION_WARMUP_METHODS)[number];

/** Options for creating an authorised application-access scenario. */
export interface CreateAuthorisationScenarioOptions {
  /** Response returned by the authorisation status check. */
  authorisationStatus?: ResponseItem;
  /** Response returned by the application-access check. */
  applicationAccess?: ResponseItem;
  /** Factory for each startup warm-up response. */
  warmupResponseFactory?: (data: unknown) => ResponseItem;
}

/**
 * Default `getAuthenticationSettings` response for admin authentication scenarios.
 *
 * The dev server runs under React 19 StrictMode, which double-fires effects, so the
 * response queue deliberately carries two identical entries to satisfy both replays.
 * Callers that need different pre/post-save responses should override `authenticationSettings`.
 */
const defaultAuthenticationSettingsResponse: ResponseItem = {
  kind: 'success',
  data: {
    authMode: 'scriptProperties',
    authGroupEmail: '',
    authUsers: [{ email: 'admin@example.com', role: 'admin' }],
    authRevision: '1',
  },
};

/**
 * Creates a standard admin runtime scenario for Authentication settings journeys.
 *
 * @param {CreateAuthenticationSettingsScenarioOptions} options Scenario customisation.
 * @returns {RuntimeScenario} Configured runtime scenario.
 */
export function createAuthenticationSettingsScenario(
  options: CreateAuthenticationSettingsScenarioOptions = {}
): RuntimeScenario {
  const {
    authenticationSettings = [
      defaultAuthenticationSettingsResponse,
      defaultAuthenticationSettingsResponse,
    ],
    saveResponses = [{ kind: 'success', data: { success: true, authRevision: '2' } }],
  } = options;

  const scenario = createAssignmentsScenario({
    initialPartials: [],
    includeAuth: true,
    includeClassPartials: true,
    includeCohorts: true,
    includeYearGroups: true,
    includeAssignmentTopics: true,
  });

  return {
    ...scenario,
    hasScriptAuthorisation: [
      { kind: 'success', data: true },
      { kind: 'success', data: true },
    ],
    getGoogleClassrooms: [
      { kind: 'success', data: [] },
      { kind: 'success', data: [] },
    ],
    getAuthenticationSettings: authenticationSettings,
    setAuthenticationSettings: saveResponses,
  };
}

/**
 * Creates a StrictMode-safe authorised scenario, including startup warm-up queues.
 *
 * @param {CreateAuthorisationScenarioOptions} options Scenario customisation.
 * @returns {RuntimeScenario} Authorised scenario with warm-up and access queues.
 */
export function createAuthorisationScenario(
  options: CreateAuthorisationScenarioOptions = {}
): RuntimeScenario {
  const {
    authorisationStatus = { kind: 'success', data: true },
    applicationAccess = {
      kind: 'success',
      data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
    },
    warmupResponseFactory = (data) => ({ kind: 'success', data }),
  } = options;
  const assignmentsScenario = createAssignmentsScenario();
  const warmupResponses = Object.fromEntries(
    AUTHORISATION_WARMUP_METHODS.map((method: AuthorisationWarmupMethod) => {
      const response = assignmentsScenario[method]?.[0];
      const data = response && 'data' in response ? response.data : undefined;
      return [method, [warmupResponseFactory(data), warmupResponseFactory(data)]];
    })
  ) as Pick<RuntimeScenario, AuthorisationWarmupMethod>;

  return {
    hasScriptAuthorisation: [authorisationStatus, authorisationStatus],
    getApplicationAccess: [applicationAccess, applicationAccess],
    ...warmupResponses,
  };
}

/**
 * Add auth response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} shouldIncludeAuth Whether to include auth response.
 * @returns {void}
 */
function addAuthToScenario(scenario: MutableRuntimeScenario, shouldIncludeAuth: boolean): void {
  if (shouldIncludeAuth) {
    scenario.hasScriptAuthorisation = [{ kind: 'success', data: true }];
  }
}

/**
 * Add class partials response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} shouldIncludeClassPartials Whether to include class partials response.
 * @returns {void}
 */
function addClassPartialsToScenario(
  scenario: MutableRuntimeScenario,
  shouldIncludeClassPartials: boolean
): void {
  if (shouldIncludeClassPartials) {
    scenario.getABClassPartials = [{ kind: 'success', data: [] }];
  }
}

/**
 * Add cohorts response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} shouldIncludeCohorts Whether to include cohorts response.
 * @returns {void}
 */
function addCohortsToScenario(
  scenario: MutableRuntimeScenario,
  shouldIncludeCohorts: boolean
): void {
  if (shouldIncludeCohorts) {
    scenario.getCohorts = [{ kind: 'success', data: mockCohorts }];
  }
}

/**
 * Add year groups response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} shouldIncludeYearGroups Whether to include year groups response.
 * @returns {void}
 */
function addYearGroupsToScenario(
  scenario: MutableRuntimeScenario,
  shouldIncludeYearGroups: boolean
): void {
  if (shouldIncludeYearGroups) {
    scenario.getYearGroups = [{ kind: 'success', data: mockYearGroups }];
  }
}

/**
 * Add assignment topics response to scenario if requested.
 *
 * @param {RuntimeScenario} scenario The scenario to populate.
 * @param {boolean} shouldIncludeAssignmentTopics Whether to include assignment topics response.
 * @returns {void}
 */
function addAssignmentTopicsToScenario(
  scenario: MutableRuntimeScenario,
  shouldIncludeAssignmentTopics: boolean
): void {
  if (shouldIncludeAssignmentTopics) {
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
  scenario: MutableRuntimeScenario,
  options: {
    includeAuth?: boolean;
    includeClassPartials?: boolean;
    includeCohorts?: boolean;
    includeYearGroups?: boolean;
    includeAssignmentTopics?: boolean;
  }
): void {
  const {
    includeAuth: shouldIncludeAuth = true,
    includeClassPartials: shouldIncludeClassPartials = true,
    includeCohorts: shouldIncludeCohorts = true,
    includeYearGroups: shouldIncludeYearGroups = true,
    includeAssignmentTopics: shouldIncludeAssignmentTopics = true,
  } = options;

  addAuthToScenario(scenario, shouldIncludeAuth);
  addClassPartialsToScenario(scenario, shouldIncludeClassPartials);
  addCohortsToScenario(scenario, shouldIncludeCohorts);
  addYearGroupsToScenario(scenario, shouldIncludeYearGroups);
  addAssignmentTopicsToScenario(scenario, shouldIncludeAssignmentTopics);
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
    // Backend _success() converts undefined → null; must match here to survive JSON.stringify
    deleteResponses = [{ kind: 'success', data: null }],
  } = options;

  const scenario: MutableRuntimeScenario = {};

  addReferenceDataToScenario(scenario, options);

  scenario.getAssignmentDefinitionPartials = createDefinitionPartialsQueue(
    initialPartials,
    postMutationPartials
  );

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
  } = options;

  const scenario: MutableRuntimeScenario = {};

  addReferenceDataToScenario(scenario, options);

  scenario.getAssignmentDefinitionPartials = createDefinitionPartialsQueue(
    initialPartials,
    postMutationPartials
  );

  scenario.getAssignmentDefinition = assignmentDefinitions;
  scenario.upsertAssignmentDefinition = upsertResponses;

  return scenario;
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
    hasScriptAuthorisation: [{ kind: 'success', data: true }],
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
