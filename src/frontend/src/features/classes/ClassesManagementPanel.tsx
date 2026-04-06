import { Alert, Card, Flex, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { callApi } from '../../services/apiService';
import { queryKeys } from '../../query/queryKeys';
import { ClassesAlertStack } from './ClassesAlertStack';
import { ClassesSummaryCard } from './ClassesSummaryCard';
import { ClassesTable } from './ClassesTable';
import { ClassesToolbar } from './ClassesToolbar';
import { BulkDeleteModal } from './BulkDeleteModal';
import { BulkSetCourseLengthModal } from './BulkSetCourseLengthModal';
import { BulkSetSelectModal } from './BulkSetSelectModal';
import {
  bulkSetCohort,
  filterEligibleForBulkSetCohort,
  getActiveCohortOptions,
} from './bulkSetCohortFlow';
import {
  bulkSetCourseLength,
  filterEligibleForBulkSetCourseLength,
} from './bulkSetCourseLengthFlow';
import {
  bulkSetYearGroup,
  filterEligibleForBulkSetYearGroup,
  getYearGroupOptions,
} from './bulkSetYearGroupFlow';
import type { ClassTableRow } from './bulkCreateFlow';
import {
  runBatchMutation,
  type RejectedRowResult,
  type RowMutationResult,
} from './batchMutationEngine';
import { useClassesManagement } from './useClassesManagement';
import type { ClassesManagementRow } from './classesManagementViewModel';

export const classesManagementPanelRegionLabel = 'Classes management panel';

/**
 * Maps a WS3 ClassesManagementStatus to the WS4 ClassStatus used by bulk-flow helpers.
 *
 * @param {string} status WS3 row status.
 * @returns {'notCreated' | 'partial' | 'linked'} WS4 ClassStatus.
 */
function deriveClassTableRowStatus(status: string): 'notCreated' | 'partial' | 'linked' {
  if (status === 'notCreated') {
    return 'notCreated';
  }
  if (status === 'orphaned') {
    return 'partial';
  }
  return 'linked';
}

/**
 * Adapts a ClassesManagementRow to a ClassTableRow so bulk-flow helpers can be
 * reused against the WS3 row type.
 *
 * @param {ClassesManagementRow} row WS3 row record.
 * @returns {ClassTableRow} Adapted row for bulk-flow helpers.
 */
function toClassTableRow(row: ClassesManagementRow): ClassTableRow {
  return {
    rowKey: row.classId,
    classId: row.classId,
    className: row.className,
    status: deriveClassTableRowStatus(row.status),
    cohortKey: row.cohortKey ?? null,
    yearGroupKey: row.yearGroupKey ?? null,
    courseLength: row.courseLength ?? 1,
    active: row.active,
  };
}

/**
 * Returns the rejected row results from a settled batch.
 *
 * @template TData Mutation success payload type.
 * @param {RowMutationResult<ClassTableRow, TData>[]} results Settled batch results.
 * @returns {RejectedRowResult<ClassTableRow>[]} Rejected row results only.
 */
function getRejectedRowResults<TData>(
  results: RowMutationResult<ClassTableRow, TData>[],
): RejectedRowResult<ClassTableRow>[] {
  return results.filter(
    (result): result is RejectedRowResult<ClassTableRow> => result.status === 'rejected',
  );
}

type BulkActionOutcomeAlert = Readonly<{
  description: string;
  title: string;
  type: 'error' | 'warning';
}>;

type BulkFailureMessageCopy = Readonly<{
  allFailure: (totalCount: number) => string;
  partialFailure: (failedCount: number, totalCount: number) => string;
  singleFailure: string;
}>;

/**
 * Builds user-facing failure copy for a bulk action.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @param {BulkFailureMessageCopy} copy Action-specific failure copy.
 * @returns {string} User-facing failure copy.
 */
function createBulkFailureMessage(
  failedCount: number,
  totalCount: number,
  copy: BulkFailureMessageCopy,
): string {
  if (failedCount === totalCount) {
    return totalCount === 1 ? copy.singleFailure : copy.allFailure(totalCount);
  }

  return copy.partialFailure(failedCount, totalCount);
}

/**
 * Builds user-facing inline error copy for bulk metadata failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @returns {string} User-facing failure copy.
 */
function createBulkMetadataFailureMessage(failedCount: number, totalCount: number): string {
  return createBulkFailureMessage(failedCount, totalCount, {
    singleFailure: 'Unable to update the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to update any of the ' + attemptedRowCount + ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be updated. Successful rows were refreshed. Please review the remaining selection and try again.',
  });
}

/**
 * Builds user-facing failure copy for bulk delete failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @returns {string} User-facing failure copy.
 */
function createBulkDeleteFailureMessage(failedCount: number, totalCount: number): string {
  return createBulkFailureMessage(failedCount, totalCount, {
    singleFailure: 'Unable to delete the selected class. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to delete any of the ' + attemptedRowCount + ' selected classes. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.',
  });
}

/**
 * Builds user-facing failure copy for bulk activation failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @returns {string} User-facing failure copy.
 */
function createBulkSetActiveFailureMessage(failedCount: number, totalCount: number): string {
  return createBulkFailureMessage(failedCount, totalCount, {
    singleFailure: 'Unable to set the selected class to active. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' + attemptedRowCount + ' selected classes to active. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.',
  });
}

/**
 * Builds user-facing failure copy for bulk deactivation failures.
 *
 * @param {number} failedCount Failed row count.
 * @param {number} totalCount Total attempted row count.
 * @returns {string} User-facing failure copy.
 */
function createBulkSetInactiveFailureMessage(failedCount: number, totalCount: number): string {
  return createBulkFailureMessage(failedCount, totalCount, {
    singleFailure: 'Unable to set the selected class to inactive. Please review the remaining selection and try again.',
    allFailure: (attemptedRowCount) =>
      'Unable to set any of the ' + attemptedRowCount + ' selected classes to inactive. Please review the remaining selection and try again.',
    partialFailure: (rejectedRowCount, attemptedRowCount) =>
      rejectedRowCount + ' of ' + attemptedRowCount + ' selected classes could not be set to inactive. Successful rows were refreshed. Please review the remaining selection and try again.',
  });
}

/**
 * Renders the Classes feature entry shell.
 *
 * Wires bulk-action handlers via the shared batch mutation engine and invalidates
 * the classPartials query after each successful batch so the table reflects the
 * updated state.
 *
 * @returns {JSX.Element} The Classes feature panel shell.
 */
export function ClassesManagementPanel() {
  const classesManagement = useClassesManagement();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [setCohortModalOpen, setSetCohortModalOpen] = useState(false);
  const [setYearGroupModalOpen, setSetYearGroupModalOpen] = useState(false);
  const [setCourseLengthModalOpen, setSetCourseLengthModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [setCohortSubmitting, setSetCohortSubmitting] = useState(false);
  const [setYearGroupSubmitting, setSetYearGroupSubmitting] = useState(false);
  const [setCourseLengthSubmitting, setSetCourseLengthSubmitting] = useState(false);
  const [bulkActionOutcomeAlert, setBulkActionOutcomeAlert] = useState<BulkActionOutcomeAlert | null>(null);

  const selectedRows = useMemo(
    () => classesManagement.rows.filter((row) => classesManagement.selectedRowKeys.includes(row.classId)),
    [classesManagement.rows, classesManagement.selectedRowKeys],
  );
  const selectedTableRows = useMemo(
    () => selectedRows.map((row) => toClassTableRow(row)),
    [selectedRows],
  );
  const cohortOptions = useMemo(
    () => getActiveCohortOptions(classesManagement.cohorts ?? []),
    [classesManagement.cohorts],
  );
  const yearGroupOptions = useMemo(
    () => getYearGroupOptions(classesManagement.yearGroups ?? []),
    [classesManagement.yearGroups],
  );

  /**
   * Invalidates the shared class-partials query so table data refreshes after a mutation.
   *
   * @returns {Promise<void>} Completion signal.
   */
  async function invalidateClassPartialsQuery(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials() });
  }

  /**
   * Resolves post-mutation UI state for a top-level bulk action.
   *
   * @param {RowMutationResult<ClassTableRow, unknown>[]} results Settled batch results.
   * @param {Readonly<{
   *   createFailureMessage: (failedCount: number, totalCount: number) => string;
   *   fullFailureTitle: string;
   *   partialFailureTitle: string;
   *   closeSurface?: () => void;
   * }>} options Action-specific UI copy and close handler.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleTopLevelBulkMutationResult(
    results: RowMutationResult<ClassTableRow, unknown>[],
    options: Readonly<{
      createFailureMessage: (failedCount: number, totalCount: number) => string;
      fullFailureTitle: string;
      partialFailureTitle: string;
      closeSurface?: () => void;
    }>,
  ): Promise<void> {
    const rejectedResults = getRejectedRowResults(results);

    if (rejectedResults.length === 0) {
      setBulkActionOutcomeAlert(null);
      classesManagement.onSelectedRowKeysChange([]);
      options.closeSurface?.();
      await invalidateClassPartialsQuery();
      return;
    }

    options.closeSurface?.();
    await invalidateClassPartialsQuery();
    classesManagement.onSelectedRowKeysChange(
      rejectedResults.map((result) => result.row.classId),
    );

    const failedCount = rejectedResults.length;
    setBulkActionOutcomeAlert({
      description: options.createFailureMessage(failedCount, results.length),
      title: failedCount === results.length ? options.fullFailureTitle : options.partialFailureTitle,
      type: failedCount === results.length ? 'error' : 'warning',
    });
  }

  /**
   * Calls deleteABClass for each selected row then invalidates classPartials.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    setDeleteSubmitting(true);
    setBulkActionOutcomeAlert(null);

    try {
      const results = await runBatchMutation(selectedTableRows, (row) =>
        callApi('deleteABClass', { classId: row.classId }),
      );
      await handleTopLevelBulkMutationResult(results, {
        createFailureMessage: createBulkDeleteFailureMessage,
        fullFailureTitle: 'Could not delete selected classes.',
        partialFailureTitle: 'Some selected classes were not deleted.',
        closeSurface: () => setDeleteModalOpen(false),
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  /**
   * Calls updateABClass with active: true for each eligible selected row then
   * invalidates classPartials.
   *
   * @returns {Promise<void>} Resolves when all activations have settled.
   */
  async function handleSetActive() {
    const eligible = selectedTableRows.filter(
      (row) => row.status !== 'notCreated' && row.active !== null && row.active !== true
    );
    setBulkActionOutcomeAlert(null);

    const results = await runBatchMutation(eligible, (row) =>
      callApi('updateABClass', { classId: row.classId, active: true }),
    );
    await handleTopLevelBulkMutationResult(results, {
      createFailureMessage: createBulkSetActiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to active.',
      partialFailureTitle: 'Some selected classes were not set to active.',
    });
  }

  /**
   * Calls updateABClass with active: false for each eligible selected row then
   * invalidates classPartials.
   *
   * @returns {Promise<void>} Resolves when all deactivations have settled.
   */
  async function handleSetInactive() {
    const eligible = selectedTableRows.filter(
      (row) => row.status !== 'notCreated' && row.active !== null && row.active !== false
    );
    setBulkActionOutcomeAlert(null);

    const results = await runBatchMutation(eligible, (row) =>
      callApi('updateABClass', { classId: row.classId, active: false }),
    );
    await handleTopLevelBulkMutationResult(results, {
      createFailureMessage: createBulkSetInactiveFailureMessage,
      fullFailureTitle: 'Could not set selected classes to inactive.',
      partialFailureTitle: 'Some selected classes were not set to inactive.',
    });
  }

  /**
   * Resolves post-mutation UI state for a bulk metadata batch.
   *
   * @param {RowMutationResult<ClassTableRow, unknown>[]} results Settled batch results.
   * @param {() => void} closeModal Closes the active metadata modal on full success.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleBulkMetadataMutationResult(
    results: RowMutationResult<ClassTableRow, unknown>[],
    closeModal: () => void,
  ): Promise<void> {
    const rejectedResults = getRejectedRowResults(results);

    if (rejectedResults.length === 0) {
      classesManagement.onSelectedRowKeysChange([]);
      closeModal();
      await invalidateClassPartialsQuery();
      return;
    }

    await invalidateClassPartialsQuery();
    classesManagement.onSelectedRowKeysChange(
      rejectedResults.map((result) => result.row.classId),
    );
    throw new Error(createBulkMetadataFailureMessage(rejectedResults.length, results.length));
  }

  /**
   * Applies one cohort to the selected eligible rows.
   *
   * @param {string} cohortKey Selected cohort key.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetCohort(cohortKey: string): Promise<void> {
    setSetCohortSubmitting(true);
    setBulkActionOutcomeAlert(null);

    try {
      const results = await bulkSetCohort(
        filterEligibleForBulkSetCohort(selectedTableRows),
        cohortKey,
      );
      await handleBulkMetadataMutationResult(results, () => setSetCohortModalOpen(false));
    } finally {
      setSetCohortSubmitting(false);
    }
  }

  /**
   * Applies one year group to the selected eligible rows.
   *
   * @param {string} yearGroupKey Selected year-group key.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetYearGroup(yearGroupKey: string): Promise<void> {
    setSetYearGroupSubmitting(true);
    setBulkActionOutcomeAlert(null);

    try {
      const results = await bulkSetYearGroup(
        filterEligibleForBulkSetYearGroup(selectedTableRows),
        yearGroupKey,
      );
      await handleBulkMetadataMutationResult(results, () => setSetYearGroupModalOpen(false));
    } finally {
      setSetYearGroupSubmitting(false);
    }
  }

  /**
   * Applies one validated course length to the selected eligible rows.
   *
   * @param {number} courseLength Selected course length.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleSetCourseLength(courseLength: number): Promise<void> {
    setSetCourseLengthSubmitting(true);
    setBulkActionOutcomeAlert(null);

    try {
      const results = await bulkSetCourseLength(
        filterEligibleForBulkSetCourseLength(selectedTableRows),
        courseLength,
      );
      await handleBulkMetadataMutationResult(results, () => setSetCourseLengthModalOpen(false));
    } finally {
      setSetCourseLengthSubmitting(false);
    }
  }

  return (
    <Card className="settings-tab-panel" role="region" aria-label={classesManagementPanelRegionLabel}>
      {classesManagement.classesManagementViewState === 'loading' ? (
        <Typography.Text>Classes feature is loading.</Typography.Text>
      ) : null}
      {bulkActionOutcomeAlert === null ? null : (
        <Alert
          type={bulkActionOutcomeAlert.type}
          showIcon
          title={bulkActionOutcomeAlert.title}
          description={bulkActionOutcomeAlert.description}
          style={{ marginBottom: 16 }}
        />
      )}
      <ClassesAlertStack
        blockingErrorMessage={classesManagement.blockingErrorMessage}
        nonBlockingWarningMessage={classesManagement.nonBlockingWarningMessage}
        refreshRequiredMessage={classesManagement.refreshRequiredMessage}
      />
      {classesManagement.classesManagementViewState === 'error' &&
      classesManagement.blockingErrorMessage === null ? (
        <Typography.Text>{classesManagement.errorMessage}</Typography.Text>
      ) : null}
      {classesManagement.classesManagementViewState === 'ready' ? (
        <Flex vertical gap={12}>
          <ClassesSummaryCard rows={classesManagement.rows} selectedCount={classesManagement.selectedRowKeys.length} />
          <ClassesToolbar
            rows={classesManagement.rows}
            selectedRowKeys={classesManagement.selectedRowKeys}
            onBulkDelete={() => setDeleteModalOpen(true)}
            onSetActive={() => void handleSetActive()}
            onSetInactive={() => void handleSetInactive()}
            onSetCohort={() => setSetCohortModalOpen(true)}
            onSetYearGroup={() => setSetYearGroupModalOpen(true)}
            onSetCourseLength={() => setSetCourseLengthModalOpen(true)}
          />
          <ClassesTable
            rows={classesManagement.rows}
            selectedRowKeys={classesManagement.selectedRowKeys}
            onSelectedRowKeysChange={classesManagement.onSelectedRowKeysChange}
          />
          <BulkDeleteModal
            open={deleteModalOpen}
            selectedRows={selectedTableRows}
            onConfirm={() => void handleDeleteConfirm()}
            onCancel={() => setDeleteModalOpen(false)}
            confirmLoading={deleteSubmitting}
          />
          <BulkSetSelectModal
            open={setCohortModalOpen}
            title="Set cohort"
            fieldLabel="Cohort"
            options={cohortOptions}
            confirmLoading={setCohortSubmitting}
            onConfirm={handleSetCohort}
            onCancel={() => setSetCohortModalOpen(false)}
          />
          <BulkSetSelectModal
            open={setYearGroupModalOpen}
            title="Set year group"
            fieldLabel="Year group"
            options={yearGroupOptions}
            confirmLoading={setYearGroupSubmitting}
            onConfirm={handleSetYearGroup}
            onCancel={() => setSetYearGroupModalOpen(false)}
          />
          <BulkSetCourseLengthModal
            open={setCourseLengthModalOpen}
            confirmLoading={setCourseLengthSubmitting}
            onConfirm={handleSetCourseLength}
            onCancel={() => setSetCourseLengthModalOpen(false)}
          />
        </Flex>
      ) : null}
    </Card>
  );
}
