/**
 * Shared service-mock registration for `AssessTaskModal` specs.
 *
 * The modal's dependency surfaces (assignments, assessment runs, definition
 * services, reference data, matcher) are module-level `vi.mock` registrations;
 * listing them once here keeps the per-spec mock blocks identical without
 * duplicating the declarations across four spec files.
 *
 * The registered mocks are bare `vi.fn()` doubles: specs obtain typed handles
 * through `vi.mocked(<service import>)` and seed their own implementations in
 * `beforeEach`, exactly as with inline module factories.
 *
 * Import this module before any production or test-harness import so the mock
 * factories are registered before the mocked modules are first instantiated.
 */

import { vi } from 'vitest';

vi.mock('../../features/classes/AssessTaskModal/matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

vi.mock('../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: vi.fn(),
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: vi.fn(),
}));

vi.mock('../../services/referenceData/referenceDataService', () => ({
  getCohorts: vi.fn(),
  getYearGroups: vi.fn(),
}));
