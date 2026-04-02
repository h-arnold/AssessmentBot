import { Card } from 'antd';
import type { TabsProps } from 'antd';
import { BackendSettingsPanel } from '../features/settings/backend/BackendSettingsPanel';
import { SettingsPageGoogleClassroomsPrefetch } from './SettingsPageGoogleClassroomsPrefetch';
import { TabbedPageSection } from './TabbedPageSection';
import { pageContent } from './pageContent';

type SettingsTabDefinition = Readonly<{
  key: string;
  label: string;
}>;

const settingsTabDefinitions: SettingsTabDefinition[] = [
  {
    key: 'classes',
    label: 'Classes',
  },
  {
    key: 'backend-settings',
    label: 'Backend settings',
  },
];

const settingsTabs = settingsTabDefinitions.map(({ key, label }) => ({
  key,
  label,
  children: key === 'backend-settings' ? (
    <BackendSettingsPanel />
  ) : (
    <SettingsPlaceholderPanel label={label} />
  ),
})) satisfies NonNullable<TabsProps['items']>;

/**
 * Renders a blank placeholder panel for a settings section.
 *
 * @param {Readonly<{ label: string }>} properties Placeholder panel properties.
 * @returns {JSX.Element} The placeholder panel.
 */
function SettingsPlaceholderPanel({ label }: Readonly<{ label: string }>) {
  return <Card className="settings-tab-panel" role="region" aria-label={`${label} panel`} />;
}

/**
 * Renders the settings page with reusable Ant Design tabs for each section.
 *
 * @remarks
 * `SettingsPage.tsx` is intentionally kept as a composition layer and wires the backend tab
 * directly to `BackendSettingsPanel` without introducing backend orchestration here.
 *
 * @returns {JSX.Element} The settings page.
 */
export function SettingsPage() {
  return (
    <>
      <SettingsPageGoogleClassroomsPrefetch />
      <TabbedPageSection
        defaultActiveKey="classes"
        heading={pageContent.settings.heading}
        summary={pageContent.settings.summary}
        tabs={settingsTabs}
      />
    </>
  );
}
