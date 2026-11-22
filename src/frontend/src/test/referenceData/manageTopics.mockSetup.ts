/**
 * Registers shared dependency mocks for the ManageTopicsModal specs.
 *
 * The modal reads topics from the assignment-topics service and performs its
 * mutations against the reference-data service. Both module registrations are
 * identical across the three topics suites; keep them here so registration
 * precedes component and helper imports in every spec.
 *
 * Specs recover typed handles through `vi.mocked(...)` on the service imports
 * and seed their own implementations in `beforeEach`.
 */

import { vi } from 'vitest';

vi.mock('@/services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: vi.fn(),
  };
});

vi.mock('@/services/referenceData/referenceDataService', () => {
  return {
    getCohorts: vi.fn(),
    createCohort: vi.fn(),
    updateCohort: vi.fn(),
    deleteCohort: vi.fn(),
    getYearGroups: vi.fn(),
    createYearGroup: vi.fn(),
    updateYearGroup: vi.fn(),
    deleteYearGroup: vi.fn(),
    createAssignmentTopic: vi.fn(),
    updateAssignmentTopic: vi.fn(),
    deleteAssignmentTopic: vi.fn(),
  };
});
