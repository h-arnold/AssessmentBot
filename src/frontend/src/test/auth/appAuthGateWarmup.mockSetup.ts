/**
 * Registers the auth-gate dependency mocks shared by the admission, failure and
 * warm-up specs. Each spec imports this module before the gate and binds the
 * hoisted doubles through `getAppAuthGateWarmupMocks`.
 */
import { vi } from 'vitest';
import { appAuthGateWarmupMockHandles } from './appAuthGateWarmupMockHandles';

const {
  getAuthorisationStatusMock,
  getApplicationAccessMock,
  warmStartupQueriesMock,
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  callApiMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getYearGroupsMock,
} = vi.hoisted(() => {
  return {
    getAuthorisationStatusMock: vi.fn(),
    getApplicationAccessMock: vi.fn(),
    warmStartupQueriesMock: vi.fn(),
    getABClassPartialsMock: vi.fn(),
    getAssignmentDefinitionPartialsMock: vi.fn(),
    callApiMock: vi.fn(),
    getCohortsMock: vi.fn(),
    getAssignmentTopicsMock: vi.fn(),
    getYearGroupsMock: vi.fn(),
  };
});

vi.mock('@/services/authService/authService', () => {
  return {
    hasScriptAuthorisation: getAuthorisationStatusMock,
    getApplicationAccess: getApplicationAccessMock,
  };
});

vi.mock('@/services/googleClassrooms/classPartialsService', () => {
  return {
    getABClassPartials: getABClassPartialsMock,
  };
});

vi.mock('@/services/assignmentDefinition/assignmentDefinitionPartialsService', () => {
  return {
    getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
  };
});

vi.mock('@/services/apiService', () => {
  return {
    callApi: callApiMock,
  };
});

vi.mock('@/services/referenceData/referenceDataService', () => {
  return {
    getCohorts: getCohortsMock,
    getYearGroups: getYearGroupsMock,
  };
});

vi.mock('@/services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: getAssignmentTopicsMock,
  };
});

vi.mock('@/query/sharedQueries', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, warmStartupQueries: warmStartupQueriesMock };
});

appAuthGateWarmupMockHandles.current = {
  getAuthorisationStatusMock,
  getApplicationAccessMock,
  warmStartupQueriesMock,
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  callApiMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getYearGroupsMock,
};
