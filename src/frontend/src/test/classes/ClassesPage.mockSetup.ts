import { vi } from 'vitest';
import type * as WarmupModule from '@/features/auth/startupWarmupState';

vi.mock('@/features/auth/startupWarmupState', async (importOriginal) => {
  const actual = await importOriginal<typeof WarmupModule>();
  return { ...actual, useStartupWarmupState: vi.fn() };
});

vi.mock('@/services/googleClassrooms/classPartialsService', () => {
  return {
    getABClassPartials: vi.fn(),
  };
});

vi.mock('@/services/referenceData/referenceDataService', () => {
  return {
    getYearGroups: vi.fn(),
    getCohorts: vi.fn(),
  };
});

vi.mock('@/services/assignmentDefinition/assignmentDefinitionPartialsService', () => {
  return {
    getAssignmentDefinitionPartials: vi.fn(),
  };
});

vi.mock('@/services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: vi.fn(),
  };
});

vi.mock('@/features/classPage/ClassPage', () => ({ ClassPage: vi.fn(() => null) }));

vi.mock('@/ClassSelectionContext', () => ({ useClassSelection: vi.fn() }));
