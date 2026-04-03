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

/**
 * Resolves the rendered child component for a settings tab key.
 *
 * @param {string} key Settings tab key.
 * @returns {JSX.Element} The tab child component.
 */
function getSettingsTabChild(key: string): JSX.Element {
  switch (key) {
    case 'classes':
      return <ClassesManagementPanel />;
    case 'backend-settings':
      return <BackendSettingsPanel />;
    default:
      throw new Error(`Unsupported settings tab key: ${key}`);
  }
}

const settingsTabs = settingsTabDefinitions.map(({ key, label }) => ({
  key,
  label,
  children: getSettingsTabChild(key),
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
