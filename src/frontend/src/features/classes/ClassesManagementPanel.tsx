import { Alert, Card, Typography } from 'antd';
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
      {classesManagement.classesManagementViewState === 'error' ? (
        <Alert
          title="Classes feature is unavailable."
          description={classesManagement.errorMessage}
          type="error"
          showIcon
        />
      ) : null}
      {classesManagement.classesManagementViewState === 'ready' ? (
        <Typography.Text>{`Classes ready: ${classesManagement.classesCount}`}</Typography.Text>
      ) : null}
    </Card>
  );
}
