import { Alert, Space } from 'antd';

export interface ClassesAlertStackProperties {
  blockingErrorMessage: string | null;
  nonBlockingWarningMessage: string | null;
  refreshRequiredMessage: string | null;
}

/**
 * Renders stacked classes alerts in severity order.
 *
 * @param {Readonly<ClassesAlertStackProperties>} properties Alert messages.
 * @returns {JSX.Element | null} Alert stack when at least one alert is present.
 */
export function ClassesAlertStack(properties: Readonly<ClassesAlertStackProperties>) {
  const hasAnyAlert =
    properties.blockingErrorMessage != null ||
    properties.nonBlockingWarningMessage != null ||
    properties.refreshRequiredMessage != null;

  if (hasAnyAlert === false) {
    return null;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {properties.blockingErrorMessage === null ? null : (
        <Alert
          type="error"
          showIcon
          title="Classes feature is unavailable."
          description={properties.blockingErrorMessage}
        />
      )}
      {properties.nonBlockingWarningMessage === null ? null : (
        <Alert
          type="warning"
          showIcon
          title="Some classes data may be stale."
          description={properties.nonBlockingWarningMessage}
        />
      )}
      {properties.refreshRequiredMessage === null ? null : (
        <Alert
          type="success"
          showIcon
          title="Update succeeded but refresh is required."
          description={properties.refreshRequiredMessage}
        />
      )}
    </Space>
  );
}
