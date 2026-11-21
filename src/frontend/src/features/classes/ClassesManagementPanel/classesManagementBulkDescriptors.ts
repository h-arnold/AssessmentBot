import {
  createBulkCreateFailureMessage,
  createBulkDeleteFailureMessage,
  createBulkSetActiveFailureMessage,
  createBulkSetInactiveFailureMessage,
  type TopLevelBulkActionDescriptor,
} from '../bulk/bulkMutationResolution';
import {
  runQueuedBatchMutation,
  type BatchProgressSnapshot,
  type QueuedBatchItem,
} from '../bulk/runQueuedBatchMutation';
import type { RowMutationResult } from '../bulk/batchMutationEngine';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { filterEligibleForActiveState } from '../bulk/bulkActiveStateFlow';
import { bulkCreate, filterBulkCreateRows, type BulkCreateOptions } from '../bulk/bulkCreateFlow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TopLevelBulkActionKey = 'delete' | 'setActive' | 'setInactive';

/** State callbacks the panel supplies so descriptors stay free of panel state. */
export interface TopLevelBulkActionDescriptorDependencies {
  closeCreateSurface: () => void;
  closeDeleteSurface: () => void;
  setCreateSubmitting: (isSubmitting: boolean) => void;
  setDeleteSubmitting: (isSubmitting: boolean) => void;
  setSetActiveSubmitting: (isSubmitting: boolean) => void;
  setSetInactiveSubmitting: (isSubmitting: boolean) => void;
}

/** Dependencies needed to build the create action descriptor. */
export type CreateBulkActionDescriptorDependencies = Pick<
  TopLevelBulkActionDescriptorDependencies,
  'closeCreateSurface' | 'setCreateSubmitting'
>;

type MutateRows = (
  rows: ClassesManagementRow[],
  onProgress?: (snapshot: BatchProgressSnapshot) => void
) => Promise<RowMutationResult<ClassesManagementRow, unknown>[]>;

// ---------------------------------------------------------------------------
// Queued-item builders
// ---------------------------------------------------------------------------

/**
 * Builds one delete request per supplied row.
 *
 * @param {ClassesManagementRow[]} rows Rows to delete.
 * @returns {QueuedBatchItem[]} Queued delete items.
 */
export function buildDeleteQueuedItems(rows: ClassesManagementRow[]): QueuedBatchItem[] {
  return rows.map((row) => {
    return {
      row,
      method: 'deleteABClass' as const,
      parameters: { classId: row.classId },
      verb: 'Deleting',
      className: row.className,
    };
  });
}

/**
 * Builds one activation request per eligible row.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {QueuedBatchItem[]} Queued activation items.
 */
export function buildSetActiveQueuedItems(rows: ClassesManagementRow[]): QueuedBatchItem[] {
  const eligibleRows = filterEligibleForActiveState(rows, true);
  return eligibleRows.map((row) => {
    return {
      row,
      method: 'updateABClass' as const,
      parameters: { classId: row.classId, active: true },
      verb: 'Activating',
      className: row.className,
    };
  });
}

/**
 * Builds one deactivation request per eligible row.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {QueuedBatchItem[]} Queued deactivation items.
 */
export function buildSetInactiveQueuedItems(rows: ClassesManagementRow[]): QueuedBatchItem[] {
  const eligibleRows = filterEligibleForActiveState(rows, false);
  return eligibleRows.map((row) => {
    return {
      row,
      method: 'updateABClass' as const,
      parameters: { classId: row.classId, active: false },
      verb: 'Deactivating',
      className: row.className,
    };
  });
}

/**
 * Enqueues and runs one set of queued items.
 *
 * @param {QueuedBatchItem[]} items Items to enqueue.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
function runQueuedItems(
  items: QueuedBatchItem[],
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
}

/**
 * Deletes each supplied row through the queued engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to delete.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
function runDeleteRows(
  rows: ClassesManagementRow[],
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return runQueuedItems(buildDeleteQueuedItems(rows), onProgress);
}

/**
 * Activates each eligible supplied row through the queued engine.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
function runSetActiveRows(
  rows: ClassesManagementRow[],
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return runQueuedItems(buildSetActiveQueuedItems(rows), onProgress);
}

/**
 * Deactivates each eligible supplied row through the queued engine.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
function runSetInactiveRows(
  rows: ClassesManagementRow[],
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return runQueuedItems(buildSetInactiveQueuedItems(rows), onProgress);
}

// ---------------------------------------------------------------------------
// Descriptor factories
// ---------------------------------------------------------------------------

/**
 * Builds the top-level bulk-action descriptors for delete and active-state changes.
 *
 * @param {TopLevelBulkActionDescriptorDependencies} dependencies Panel state callbacks.
 * @returns {Readonly<Record<TopLevelBulkActionKey, TopLevelBulkActionDescriptor>>} Action descriptors.
 */
export function createTopLevelBulkActionDescriptors(
  dependencies: TopLevelBulkActionDescriptorDependencies
): Readonly<Record<TopLevelBulkActionKey, TopLevelBulkActionDescriptor>> {
  return {
    delete: {
      createFailureMessage: createBulkDeleteFailureMessage,
      fullFailureTitle: 'Could not delete selected classes.',
      partialFailureTitle: 'Some selected classes were not deleted.',
      closeSurface: dependencies.closeDeleteSurface,
      mutateRows: runDeleteRows,
      setSubmitting: dependencies.setDeleteSubmitting,
      verb: 'Deleting',
    },
    setActive: {
      createFailureMessage: createBulkSetActiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to active.',
      partialFailureTitle: 'Some selected classes were not set to active.',
      mutateRows: runSetActiveRows,
      setSubmitting: dependencies.setSetActiveSubmitting,
      verb: 'Activating',
    },
    setInactive: {
      createFailureMessage: createBulkSetInactiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to inactive.',
      partialFailureTitle: 'Some selected classes were not set to inactive.',
      mutateRows: runSetInactiveRows,
      setSubmitting: dependencies.setSetInactiveSubmitting,
      verb: 'Deactivating',
    },
  };
}

/**
 * Builds the create action descriptor for the currently selected metadata input.
 *
 * @param {BulkCreateOptions} options Cohort/year-group/course-length selection.
 * @param {CreateBulkActionDescriptorDependencies} dependencies Panel state callbacks.
 * @returns {TopLevelBulkActionDescriptor} Descriptor for the create action.
 */
export function getCreateTopLevelBulkActionDescriptor(
  options: BulkCreateOptions,
  dependencies: CreateBulkActionDescriptorDependencies
): TopLevelBulkActionDescriptor {
  const mutateRows: MutateRows = (rows, onProgress) =>
    bulkCreate(filterBulkCreateRows(rows), options, onProgress);

  return {
    createFailureMessage: createBulkCreateFailureMessage,
    fullFailureTitle: 'Could not create selected classes.',
    partialFailureTitle: 'Some selected classes were not created.',
    closeSurface: dependencies.closeCreateSurface,
    mutateRows,
    setSubmitting: dependencies.setCreateSubmitting,
    verb: 'Creating',
  };
}
