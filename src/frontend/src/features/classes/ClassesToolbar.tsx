import { Button, Card, Space, Typography } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesToolbarProps {
  rows: readonly ClassesManagementRow[];
  selectedRowKeys: readonly string[];
}

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
 * Renders bulk-action eligibility state for selected rows.
 *
 * @param {ClassesToolbarProps} props Toolbar inputs.
 * @returns {JSX.Element} Toolbar card.
 */
export function ClassesToolbar(props: ClassesToolbarProps) {
  const selectedRows = props.rows.filter((row) => props.selectedRowKeys.includes(row.classId));
  const hasSelection = selectedRows.length > 0;
  const includesOrphaned = selectedRows.some((row) => row.status === 'orphaned');

  const canDelete = hasSelection;
  const canCreate = hasSelection && !includesOrphaned && selectedRows.every((row) => row.status === 'notCreated');
  const canSetActive = hasSelection && !includesOrphaned && selectedRows.every((row) => row.status === 'inactive');
  const canSetInactive = hasSelection && !includesOrphaned && selectedRows.every((row) => row.status === 'active');

  return (
    <Card size="small" title="Bulk actions">
      <Space wrap>
        <Button disabled={!canCreate}>Create ABClass</Button>
        <Button disabled={!canSetActive}>Set active</Button>
        <Button disabled={!canSetInactive}>Set inactive</Button>
        <Button danger disabled={!canDelete}>Delete ABClass</Button>
      </Space>
      {getSelectionMessage(selectedRows) ? <Typography.Text>{getSelectionMessage(selectedRows)}</Typography.Text> : null}
    </Card>
  );
}
