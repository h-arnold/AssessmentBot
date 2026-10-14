/**
 * Registers the shared dependency mocks for AssignmentDefinitionWizardModal specs.
 *
 * This module owns registrations only. Each spec obtains handles from its mocked
 * module imports and configures them independently, preserving Vitest isolation.
 * Import it before the wizard or test harness so registration precedes use.
 */
import { vi } from 'vitest';

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;
  return { ...actualModule, useStartupWarmupState: vi.fn() };
});

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => {
  return {
    getAssignmentDefinition: vi.fn(),
    upsertAssignmentDefinition: vi.fn(),
  };
});

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: vi.fn(),
  };
});

vi.mock('../../services/referenceData/referenceDataService', () => {
  return {
    getCohorts: vi.fn(),
    getYearGroups: vi.fn(),
  };
});
