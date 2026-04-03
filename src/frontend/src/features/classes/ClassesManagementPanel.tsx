import { Card, Flex, Typography } from 'antd';
import { ClassesAlertStack } from './ClassesAlertStack';
import { ClassesSummaryCard } from './ClassesSummaryCard';
import { ClassesTable } from './ClassesTable';
import { ClassesToolbar } from './ClassesToolbar';
import { useClassesManagement } from './useClassesManagement';

export const classesManagementPanelRegionLabel = 'Classes management panel';

/**
 * Renders the Classes feature entry shell.
 *
 * @returns {JSX.Element} The Classes feature panel shell.
 */
export function ClassesManagementPanel() {
  const classesManagement = useClassesManagement();

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
          <ClassesToolbar rows={classesManagement.rows} selectedRowKeys={classesManagement.selectedRowKeys} />
          <ClassesTable
            hideRowsForRefreshRequired={classesManagement.hideRowsForRefreshRequired}
            rows={classesManagement.rows}
            selectedRowKeys={classesManagement.selectedRowKeys}
            onSelectedRowKeysChange={classesManagement.onSelectedRowKeysChange}
          />
        </Flex>
      ) : null}
    </Card>
  );
}
