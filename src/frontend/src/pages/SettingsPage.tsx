import type { TabsProps } from 'antd';
import { ClassesManagementPanel } from '../features/classes/ClassesManagementPanel';
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
  children: key === 'backend-settings' ? <BackendSettingsPanel /> : <ClassesManagementPanel />,
})) satisfies NonNullable<TabsProps['items']>;

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
