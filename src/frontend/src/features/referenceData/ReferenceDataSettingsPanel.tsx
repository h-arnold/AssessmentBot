import { Button, Card, Flex, Typography } from 'antd';
import { useState } from 'react';
import { ManageTopicsModal } from './ManageTopicsModal';

const { Title, Text } = Typography;

/**
 * Renders the Reference Data settings panel with Topics section.
 *
 * @returns {JSX.Element} The reference data settings panel.
 */
export function ReferenceDataSettingsPanel() {
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);

  return (
    <Card className="settings-tab-panel" role="region" aria-label="Reference Data panel">
      <Flex vertical gap="middle">
        <Flex align="flex-start" gap="middle" vertical>
          <Title level={3}>Topics</Title>
          <Text type="secondary">Manage assignment topics</Text>
          <Button type="primary" onClick={() => setIsTopicsModalOpen(true)}>
            Manage Topics
          </Button>
        </Flex>
      </Flex>
      <ManageTopicsModal
        open={isTopicsModalOpen}
        onClose={() => setIsTopicsModalOpen(false)}
      />
    </Card>
  );
}
