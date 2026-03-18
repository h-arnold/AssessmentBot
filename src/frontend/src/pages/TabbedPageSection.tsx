import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { PageSection } from './PageSection';

type TabbedPageSectionProperties = Readonly<{
  defaultActiveKey: string;
  heading: string;
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
  const { defaultActiveKey, heading, summary, tabs } = properties;

  return (
    <PageSection heading={heading} summary={summary}>
      <Tabs className="app-tabbed-page" defaultActiveKey={defaultActiveKey} items={tabs} />
    </PageSection>
  );
}
