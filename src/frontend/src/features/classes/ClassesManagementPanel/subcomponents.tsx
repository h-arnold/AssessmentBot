import { Alert, Flex, Skeleton } from 'antd';
import type { BulkActionOutcomeAlert } from './types';

/**
 * Renders a bulk-action outcome alert banner.
 *
 * @param {Readonly<{ alert: BulkActionOutcomeAlert | null }>} properties Alert state.
 * @returns {JSX.Element | null} Alert banner when available.
 */
export function ClassesManagementPanelOutcomeAlert(
  properties: Readonly<{ alert: BulkActionOutcomeAlert | null }>,
) {
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

/**
 * Renders the initial blocking-load treatment for the classes panel.
 *
 * @returns {JSX.Element} Loading skeleton for the panel-owned content.
 */
export function ClassesManagementPanelLoadingState() {
  return (
    <output aria-label="Loading classes">
      <Flex vertical gap={12}>
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '35%' }} />
        <Flex gap={8} wrap>
          <Skeleton.Button active />
          <Skeleton.Button active />
          <Skeleton.Button active />
        </Flex>
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: '20%' }} />
      </Flex>
    </output>
  );
}
