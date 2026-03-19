import { Card, Typography } from 'antd';

const { Paragraph } = Typography;

/**
 * Renders the backend settings feature entry point for the Settings page.
 *
 * @returns {JSX.Element} The backend settings panel.
 */
export function BackendSettingsPanel() {
  return (
    <Card className="settings-tab-panel" role="region" aria-label="Backend settings panel">
      <Paragraph>Backend settings feature entry</Paragraph>
    </Card>
  );
}
