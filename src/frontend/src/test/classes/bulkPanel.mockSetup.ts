/**
 * Registers shared bulk-panel dependency mocks for the bulk-flow specs.
 * The hoisted factory loads reusable test doubles before Vitest evaluates the
 * registrations; importing this module registers those doubles for its specs.
 */
import { vi } from 'vitest';

const mocks = await vi.hoisted(async () => {
  const { createBulkPanelMocks, createBulkQueueModuleMock, BULK_PANEL_COMPONENT_MOCKS } =
    await import('./bulkFlowTestHelpers');
  return { ...createBulkPanelMocks(), createBulkQueueModuleMock, BULK_PANEL_COMPONENT_MOCKS };
});

vi.mock('../../services/apiService', () => ({ callApi: vi.fn() }));
vi.mock('../../features/classes/useClassesManagement', () => {
  return {
    useClassesManagement: mocks.classesManagementStateMock,
  };
});
vi.mock('../../features/classes/bulk/runQueuedBatchMutation', () => {
  return {
    runQueuedBatchMutation: mocks.runQueuedBatchMutationMock,
  };
});
vi.mock('../../features/classes/useClassesBulkMutationQueue', () =>
  mocks.createBulkQueueModuleMock(mocks.runQueuedBulkActionMock)
);
vi.mock(
  '../../features/classes/bulk/BulkCreateModal',
  () => mocks.BULK_PANEL_COMPONENT_MOCKS.bulkCreate
);
vi.mock(
  '../../features/classes/bulk/BulkSetSelectModal',
  () => mocks.BULK_PANEL_COMPONENT_MOCKS.bulkSetSelect
);
vi.mock(
  '../../features/classes/bulk/BulkSetCourseLengthModal',
  () => mocks.BULK_PANEL_COMPONENT_MOCKS.bulkSetCourseLength
);
vi.mock(
  '../../features/classes/referenceData/ManageCohortsModal',
  () => mocks.BULK_PANEL_COMPONENT_MOCKS.manageCohorts
);
vi.mock(
  '../../features/classes/referenceData/ManageYearGroupsModal',
  () => mocks.BULK_PANEL_COMPONENT_MOCKS.manageYearGroups
);
