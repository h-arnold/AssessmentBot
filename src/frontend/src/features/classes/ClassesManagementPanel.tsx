import { Card, Flex, Typography } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { callApi } from '../../services/apiService';
import { queryKeys } from '../../query/queryKeys';
import { ClassesAlertStack } from './ClassesAlertStack';
import { ClassesSummaryCard } from './ClassesSummaryCard';
import { ClassesTable } from './ClassesTable';
import { ClassesToolbar } from './ClassesToolbar';
import { BulkDeleteModal } from './BulkDeleteModal';
import type { ClassTableRow } from './bulkCreateFlow';
import { runBatchMutation } from './batchMutationEngine';
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
    // Map WS3 statuses: active/inactive → linked, notCreated → notCreated, orphaned → partial
    status: deriveClassTableRowStatus(row.status),
    cohortKey: null,
    yearGroupKey: null,
    courseLength: row.courseLength ?? 1,
    active: row.active,
  };
}

/**
 * Renders the Classes feature entry shell.
 *
 * Wires bulk-action handlers (delete, set-active, set-inactive) via the shared
 * batch mutation engine and invalidates the classPartials query after each
 * successful batch so the table reflects the updated state.
 *
 * @returns {JSX.Element} The Classes feature panel shell.
 */
export function ClassesManagementPanel() {
  const classesManagement = useClassesManagement();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const selectedRows = classesManagement.rows.filter((row) =>
    classesManagement.selectedRowKeys.includes(row.classId)
  );
  const selectedTableRows: ClassTableRow[] = selectedRows.map((row) => toClassTableRow(row));

  /**
   * Calls deleteABClass for each selected row then invalidates classPartials.
   *
   * @returns {Promise<void>} Resolves when all deletions have settled.
   */
  async function handleDeleteConfirm() {
    await runBatchMutation(selectedTableRows, (row) =>
      callApi('deleteABClass', { classId: row.classId }),
    );
    classesManagement.onSelectedRowKeysChange([]);
    setDeleteModalOpen(false);
    await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials() });
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
    await runBatchMutation(eligible, (row) =>
      callApi('updateABClass', { classId: row.classId, active: true }),
    );
    classesManagement.onSelectedRowKeysChange([]);
    await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials() });
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
    await runBatchMutation(eligible, (row) =>
      callApi('updateABClass', { classId: row.classId, active: false }),
    );
    classesManagement.onSelectedRowKeysChange([]);
    await queryClient.invalidateQueries({ queryKey: queryKeys.classPartials() });
  }

  return (
    <Card className="settings-tab-panel" role="region" aria-label={classesManagementPanelRegionLabel}>
      {classesManagement.classesManagementViewState === 'loading' ? (
        <Typography.Text>Classes feature is loading.</Typography.Text>
      ) : null}
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
          />
        </Flex>
      ) : null}
    </Card>
  );
}
