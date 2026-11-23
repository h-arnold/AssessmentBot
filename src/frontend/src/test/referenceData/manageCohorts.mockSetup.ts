/**
 * Registers shared dependency mocks for the ManageCohortsModal specs.
 *
 * The modal reads and mutates cohorts through the reference-data service. The
 * registration is identical across the three cohorts suites; keep it here so
 * it precedes component and helper imports in every spec.
 *
 * Specs recover typed handles through `vi.mocked(...)` on the service imports
 * and seed their own implementations in `beforeEach`.
 */

import { vi } from 'vitest';

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
  };
});
