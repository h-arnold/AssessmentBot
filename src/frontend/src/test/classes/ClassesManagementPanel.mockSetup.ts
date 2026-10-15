/**
 * Registers dependency mocks for the ClassesManagementPanel specs.
 * Specs recover mock handles from mocked module imports and configure them independently.
 */
import { vi } from 'vitest';

const panelMocks = vi.hoisted(async () => {
  const { createClassesManagementPanelMocks } =
    await import('./classesManagementPanelMockFactories');
  return createClassesManagementPanelMocks();
});

vi.mock('../../features/classes/useClassesManagement', async () => {
  const mocks = await panelMocks;
  return mocks.useClassesManagementModule;
});
vi.mock('../../features/classes/bulk/runQueuedBatchMutation', async () => {
  const mocks = await panelMocks;
  return mocks.batchMutationModule;
});
vi.mock('../../features/classes/useClassesBulkMutationQueue', async () => {
  const mocks = await panelMocks;
  return mocks.queueModule;
});
vi.mock('../../features/classes/bulk/ClassesBulkProgressModal', async () => {
  const mocks = await panelMocks;
  return mocks.progressModalModule;
});
vi.mock('../../features/classes/bulk/BulkCreateModal', async () => {
  const mocks = await panelMocks;
  return mocks.bulkCreateModule;
});
vi.mock('../../features/classes/bulk/BulkDeleteModal', async () => {
  const mocks = await panelMocks;
  return mocks.bulkDeleteModule;
});
