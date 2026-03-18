import { Card } from 'antd';
import type { TabsProps } from 'antd';
import { TabbedPageSection } from './TabbedPageSection';
import { pageContent } from './pageContent';

const settingsTabs = [
  {
    key: 'classes',
    label: 'Classes',
    children: <SettingsPlaceholderPanel label="Classes" />,
  },
  {
    key: 'backend-settings',
    label: 'Backend settings',
    children: <SettingsPlaceholderPanel label="Backend settings" />,
  },
] satisfies NonNullable<TabsProps['items']>;

/**
 * Renders a blank placeholder panel for a settings section.
 *
 * @param {Readonly<{ label: string }>} properties Placeholder panel properties.
 * @returns {JSX.Element} The placeholder panel.
 */
function SettingsPlaceholderPanel(properties: Readonly<{ label: string }>) {
  const { label } = properties;

  return <Card className="settings-tab-panel" role="region" aria-label={`${label} panel`} />;
}

/**
 * Renders the settings page with reusable Ant Design tabs for each section.
 *
 * @returns {JSX.Element} The settings page.
 */
export function SettingsPage() {
  return (
    <TabbedPageSection
      defaultActiveKey="classes"
      heading={pageContent.settings.heading}
      summary={pageContent.settings.summary}
      tabs={settingsTabs}
    />
  );
}
