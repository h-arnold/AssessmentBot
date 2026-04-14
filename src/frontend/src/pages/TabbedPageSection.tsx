import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { PageSection } from './PageSection';

type TabbedPageSectionProperties = Readonly<{
  activeKey?: string;
  contentClassName?: string;
  defaultActiveKey: string;
  heading: string;
  onChange?: TabsProps['onChange'];
  sectionClassName?: string;
  summary: string;
  tabs: NonNullable<TabsProps['items']>;
}>;

/**
 * Renders shared page chrome with an Ant Design tabset for sectioned settings views.
 *
 * @param {TabbedPageSectionProperties} properties Tabbed page configuration.
 * @returns {JSX.Element} The tabbed page section.
 */
export function TabbedPageSection(properties: TabbedPageSectionProperties) {
  const { activeKey, contentClassName, defaultActiveKey, heading, onChange, sectionClassName, summary, tabs } =
    properties;

  return (
    <PageSection
      heading={heading}
      summary={summary}
      sectionClassName={sectionClassName}
      contentClassName={contentClassName}
    >
      <Tabs
        className="app-tabbed-page"
        activeKey={activeKey}
        defaultActiveKey={defaultActiveKey}
        items={tabs}
        onChange={onChange}
      />
    </PageSection>
  );
}
