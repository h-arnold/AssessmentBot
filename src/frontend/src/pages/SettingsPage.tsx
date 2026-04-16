import { useMemo, useState, type ReactElement } from 'react';
import type { TabsProps } from 'antd';
import { ClassesManagementPanel } from '../features/classes/ClassesManagementPanel';
import { BackendSettingsPanel } from '../features/settings/backend/BackendSettingsPanel';
import { SettingsPageGoogleClassroomsPrefetch } from './SettingsPageGoogleClassroomsPrefetch';
import { TabbedPageSection } from './TabbedPageSection';
import { pageContent } from './pageContent';

type SettingsTabKey = 'classes' | 'backend-settings';

type SettingsTabDefinition = Readonly<{
  key: SettingsTabKey;
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
 * @param {SettingsTabKey} key Settings tab key.
 * @param {number} classesPanelInstanceKey Remount token for the Classes panel.
 * @returns {JSX.Element} The tab child component.
 */
function getSettingsTabChild(key: SettingsTabKey, classesPanelInstanceKey: number): ReactElement {
  switch (key) {
    case 'classes': {
      return <ClassesManagementPanel key={`classes-management-panel-${classesPanelInstanceKey}`} />;
    }
    case 'backend-settings': {
      return <BackendSettingsPanel />;
    }
    default: {
      throw new Error(`Unsupported settings tab key: ${key}`);
    }
  }
}

/**
 * Builds the settings tab items, remounting the Classes panel only when required.
 *
 * @param {number} classesPanelInstanceKey Remount token for the Classes panel.
 * @returns {NonNullable<TabsProps['items']>} The tab items.
 */
function getSettingsTabs(classesPanelInstanceKey: number) {
  return settingsTabDefinitions.map(({ key, label }) => ({
    key,
    label,
    children: getSettingsTabChild(key, classesPanelInstanceKey),
  })) satisfies NonNullable<TabsProps['items']>;
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
  const [activeTabKey, setActiveTabKey] = useState<SettingsTabKey>('classes');
  const [classesPanelInstanceKey, setClassesPanelInstanceKey] = useState(0);

  const settingsTabs = useMemo(() => getSettingsTabs(classesPanelInstanceKey), [classesPanelInstanceKey]);

  const handleTabChange: NonNullable<TabsProps['onChange']> = (nextActiveKey) => {
    const nextSettingsTabKey = nextActiveKey as SettingsTabKey;

    if (activeTabKey === 'classes' && nextSettingsTabKey !== 'classes') {
      setClassesPanelInstanceKey((currentClassesPanelInstanceKey) => currentClassesPanelInstanceKey + 1);
    }

    setActiveTabKey(nextSettingsTabKey);
  };

  const settingsPageContentClassName =
    activeTabKey === 'classes'
      ? 'settings-page-content settings-page-content--classes'
      : 'settings-page-content';

  return (
    <>
      <SettingsPageGoogleClassroomsPrefetch />
      <TabbedPageSection
        activeKey={activeTabKey}
        contentClassName={settingsPageContentClassName}
        defaultActiveKey="classes"
        heading={pageContent.settings.heading}
        onChange={handleTabChange}
        summary={pageContent.settings.summary}
        tabs={settingsTabs}
      />
    </>
  );
}
