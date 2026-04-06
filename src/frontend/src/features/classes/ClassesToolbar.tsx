import { Button, Card, Space, Typography } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesToolbarProperties {
  rows: readonly ClassesManagementRow[];
  selectedRowKeys: readonly string[];
  onBulkCreate?: () => void;
  onBulkDelete?: () => void;
  onSetActive?: () => void;
  onSetInactive?: () => void;
}

type ClassesToolbarEligibility = Readonly<{
  canCreate: boolean;
  canDelete: boolean;
  canSetActive: boolean;
  canSetInactive: boolean;
  selectedRows: readonly ClassesManagementRow[];
}>;

/**
 * Returns user-facing guidance for mixed eligibility in the current selection.
 *
 * @param {readonly ClassesManagementRow[]} selectedRows Selected row records.
 * @returns {string | null} Guidance message when needed.
 */
function getSelectionMessage(selectedRows: readonly ClassesManagementRow[]): string | null {
  if (selectedRows.length === 0) {
    return null;
  }

  const orphanedCount = selectedRows.filter((row) => row.status === 'orphaned').length;

  if (orphanedCount === selectedRows.length) {
    return 'Orphaned rows are deletion-only.';
  }

  if (orphanedCount > 0) {
    return 'Mixed selection includes orphaned rows. Delete is the only allowed bulk action.';
  }

  return null;
}

/**
 * Evaluates bulk action eligibility from the selected rows.
 *
 * @param {readonly ClassesManagementRow[]} selectedRows Selected row records.
 * @returns {ClassesToolbarEligibility} Eligibility contract.
 */
function getBulkActionEligibility(
  selectedRows: readonly ClassesManagementRow[]
): ClassesToolbarEligibility {
  const hasSelection = selectedRows.length > 0;
  const includesOrphaned = selectedRows.some((row) => row.status === 'orphaned');
  const hasNotCreatedOnly =
    hasSelection && selectedRows.every((row) => row.status === 'notCreated');
  const hasInactiveOnly =
    hasSelection && selectedRows.every((row) => row.status === 'inactive');
  const hasActiveOnly =
    hasSelection && selectedRows.every((row) => row.status === 'active');

  return {
    canCreate: hasNotCreatedOnly && !includesOrphaned,
    canDelete: hasSelection,
    canSetActive: hasInactiveOnly && !includesOrphaned,
    canSetInactive: hasActiveOnly && !includesOrphaned,
    selectedRows,
  };
}

/**
 * Renders bulk-action eligibility state for selected rows.
 *
 * @param {Readonly<ClassesToolbarProperties>} properties Toolbar inputs.
 * @returns {JSX.Element} Toolbar card.
 */
export function ClassesToolbar(properties: Readonly<ClassesToolbarProperties>) {
  const selectedRows = properties.rows.filter((row) =>
    properties.selectedRowKeys.includes(row.classId)
  );
  const eligibility = getBulkActionEligibility(selectedRows);

  return (
    <Card size="small" title="Bulk actions">
      <Space wrap>
        <Button disabled={!eligibility.canCreate} onClick={properties.onBulkCreate}>Create ABClass</Button>
        <Button disabled={!eligibility.canSetActive} onClick={properties.onSetActive}>Set active</Button>
        <Button disabled={!eligibility.canSetInactive} onClick={properties.onSetInactive}>Set inactive</Button>
        <Button danger disabled={!eligibility.canDelete} onClick={properties.onBulkDelete}>Delete ABClass</Button>
      </Space>
      {getSelectionMessage(eligibility.selectedRows) ? (
        <Typography.Text>{getSelectionMessage(eligibility.selectedRows)}</Typography.Text>
      ) : null}
    </Card>
  );
}
