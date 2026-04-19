import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { useMemo, useState } from 'react';
import { ClassesManagementPanel } from '../features/classes/ClassesManagementPanel';
import { BackendSettingsPanel } from '../features/settings/backend/BackendSettingsPanel';
import { PageSection } from './PageSection';
import { SettingsPageGoogleClassroomsPrefetch } from './SettingsPageGoogleClassroomsPrefetch';
import { pageContent } from './pageContent';

type SettingsTabKey = 'classes' | 'backend-settings';

/**
 * Renders the settings page with fixed tabs for classes and backend settings.
 *
 * @returns {JSX.Element} The settings page.
 */
export function SettingsPage() {
  const [activeTabKey, setActiveTabKey] = useState<SettingsTabKey>('classes');
  const [classesPanelInstanceKey, setClassesPanelInstanceKey] = useState(0);

  const settingsTabs = useMemo<NonNullable<TabsProps['items']>>(
    () => [
      {
        key: 'classes',
        label: 'Classes',
        children: <ClassesManagementPanel key={`classes-management-panel-${classesPanelInstanceKey}`} />,
      },
      {
        key: 'backend-settings',
        label: 'Backend settings',
        children: <BackendSettingsPanel />,
      },
    ],
    [classesPanelInstanceKey]
  );

  const handleTabChange: NonNullable<TabsProps['onChange']> = (nextActiveKey) => {
    const nextSettingsTabKey = nextActiveKey as SettingsTabKey;

    if (activeTabKey === 'classes' && nextSettingsTabKey !== 'classes') {
      setClassesPanelInstanceKey((currentClassesPanelInstanceKey) => currentClassesPanelInstanceKey + 1);
    }

    setActiveTabKey(nextSettingsTabKey);
  };

  return (
    <>
      <SettingsPageGoogleClassroomsPrefetch />
      <PageSection
        contentClassName="settings-page-content"
        heading={pageContent.settings.heading}
        summary={pageContent.settings.summary}
      >
        <Tabs
          className="app-tabbed-page"
          activeKey={activeTabKey}
          defaultActiveKey="classes"
          items={settingsTabs}
          onChange={handleTabChange}
        />
      </PageSection>
    </>
  );
}
