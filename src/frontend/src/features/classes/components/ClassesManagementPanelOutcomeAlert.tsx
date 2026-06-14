import { Alert } from 'antd';
import type { BulkActionOutcomeAlert } from '../bulk/bulkMutationResolution';

/**
 * Renders a bulk-action outcome alert banner.
 *
 * @param {Readonly<{ alert: BulkActionOutcomeAlert | null }>} properties Alert state.
 * @returns {JSX.Element | null} Alert banner when available.
 */
export function ClassesManagementPanelOutcomeAlert(properties: Readonly<{ alert: BulkActionOutcomeAlert | null }>) {
  if (properties.alert === null) {
    return null;
  }

  return (
    <Alert
      type={properties.alert.type}
      showIcon
      title={properties.alert.title}
      description={properties.alert.description}
      style={{ marginBottom: 16 }}
    />
  );
}
