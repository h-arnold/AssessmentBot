import { Button, Card, Space, Typography } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesToolbarProperties {
  rows: readonly ClassesManagementRow[];
  selectedRowKeys: readonly string[];
  onBulkCreate?: () => void;
  onBulkDelete?: () => void;
  onSetActive?: () => void;
  onSetInactive?: () => void;
  onSetCohort?: () => void;
  onSetYearGroup?: () => void;
  onSetCourseLength?: () => void;
}

type ClassesToolbarEligibility = Readonly<{
  canCreate: boolean;
  canDelete: boolean;
  canSetActive: boolean;
  canSetInactive: boolean;
  canSetCohort: boolean;
  canSetYearGroup: boolean;
  canSetCourseLength: boolean;
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
 * Returns true when every selected row has one of the supplied statuses.
 *
 * @param {readonly ClassesManagementRow[]} selectedRows Selected row records.
 * @param {readonly ClassesManagementRow['status'][]} statuses Allowed statuses.
 * @returns {boolean} True when the selection matches the allowed statuses only.
 */
function hasOnlyStatuses(
  selectedRows: readonly ClassesManagementRow[],
  statuses: readonly ClassesManagementRow['status'][],
): boolean {
  return selectedRows.length > 0 && selectedRows.every((row) => statuses.includes(row.status));
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
  const canCreate = hasOnlyStatuses(selectedRows, ['notCreated']);
  const canSetActive = hasOnlyStatuses(selectedRows, ['inactive']);
  const canSetInactive = hasOnlyStatuses(selectedRows, ['active']);
  const canEditExisting = hasOnlyStatuses(selectedRows, ['active', 'inactive']);

  return {
    canCreate,
    canDelete: selectedRows.length > 0,
    canSetActive,
    canSetInactive,
    canSetCohort: canEditExisting,
    canSetYearGroup: canEditExisting,
    canSetCourseLength: canEditExisting,
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
  const selectionMessage = getSelectionMessage(eligibility.selectedRows);

  return (
    <Card size="small" title="Bulk actions">
      <Space wrap>
        <Button disabled={!eligibility.canCreate} onClick={properties.onBulkCreate}>Create ABClass</Button>
        <Button disabled={!eligibility.canSetActive} onClick={properties.onSetActive}>Set active</Button>
        <Button disabled={!eligibility.canSetInactive} onClick={properties.onSetInactive}>Set inactive</Button>
        <Button disabled={!eligibility.canSetCohort} onClick={properties.onSetCohort}>Set cohort</Button>
        <Button disabled={!eligibility.canSetYearGroup} onClick={properties.onSetYearGroup}>Set year group</Button>
        <Button disabled={!eligibility.canSetCourseLength} onClick={properties.onSetCourseLength}>Set course length</Button>
        <Button danger disabled={!eligibility.canDelete} onClick={properties.onBulkDelete}>Delete ABClass</Button>
      </Space>
      {selectionMessage ? (
        <Typography.Text>{selectionMessage}</Typography.Text>
      ) : null}
    </Card>
  );
}
