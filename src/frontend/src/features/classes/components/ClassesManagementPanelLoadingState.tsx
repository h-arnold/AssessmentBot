import { Flex, Skeleton } from 'antd';
import { APP_GAP_COMPACT, APP_GAP_SM } from '../../../theme/spacing';

/**
 * Renders the initial blocking-load treatment for the classes panel.
 *
 * @returns {JSX.Element} Loading skeleton for the panel-owned content.
 */
export function ClassesManagementPanelLoadingState() {
  return (
    <output aria-label="Loading classes">
      <Flex vertical gap={APP_GAP_COMPACT}>
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '35%' }} />
        <Flex gap={APP_GAP_SM} wrap>
          <Skeleton.Button active />
          <Skeleton.Button active />
          <Skeleton.Button active />
        </Flex>
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: '20%' }} />
      </Flex>
    </output>
  );
}
