import { vi } from 'vitest';

export interface WizardServiceMocks {
  getAssignmentDefinitionMock: ReturnType<typeof vi.fn>;
  getAssignmentTopicsMock: ReturnType<typeof vi.fn>;
  getCohortsMock: ReturnType<typeof vi.fn>;
  getYearGroupsMock: ReturnType<typeof vi.fn>;
  upsertAssignmentDefinitionMock: ReturnType<typeof vi.fn>;
  useStartupWarmupStateMock: ReturnType<typeof vi.fn>;
}

export interface WizardServiceModuleMocks {
  assignmentDefinitionService: {
    getAssignmentDefinition: WizardServiceMocks['getAssignmentDefinitionMock'];
    upsertAssignmentDefinition: WizardServiceMocks['upsertAssignmentDefinitionMock'];
  };
  assignmentTopicsService: {
    getAssignmentTopics: WizardServiceMocks['getAssignmentTopicsMock'];
  };
  referenceDataService: {
    getCohorts: WizardServiceMocks['getCohortsMock'];
    getYearGroups: WizardServiceMocks['getYearGroupsMock'];
  };
}

/**
 * Creates a fresh set of service and startup-state mocks for one wizard spec.
 * @returns {WizardServiceMocks} Fresh wizard service mocks.
 */
export function createWizardServiceMocks(): WizardServiceMocks {
  return {
    getAssignmentDefinitionMock: vi.fn(),
    getAssignmentTopicsMock: vi.fn(),
    getCohortsMock: vi.fn(),
    getYearGroupsMock: vi.fn(),
    upsertAssignmentDefinitionMock: vi.fn(),
    useStartupWarmupStateMock: vi.fn(),
  };
}

/**
 * Builds service module shapes from a spec's own fresh mocks.
 * @param {WizardServiceMocks} mocks The spec-local service mocks.
 * @returns {WizardServiceModuleMocks} The service module mock shapes.
 */
export function createWizardServiceModuleMocks(
  mocks: WizardServiceMocks
): WizardServiceModuleMocks {
  return {
    assignmentDefinitionService: {
      getAssignmentDefinition: mocks.getAssignmentDefinitionMock,
      upsertAssignmentDefinition: mocks.upsertAssignmentDefinitionMock,
    },
    assignmentTopicsService: {
      getAssignmentTopics: mocks.getAssignmentTopicsMock,
    },
    referenceDataService: {
      getCohorts: mocks.getCohortsMock,
      getYearGroups: mocks.getYearGroupsMock,
    },
  };
}
