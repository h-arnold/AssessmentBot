import { BookOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Space } from 'antd';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import {
  defaultNavigationKey,
  isAppNavigationKey,
  navigationItems,
  pageRenderers,
  type AppNavigationItem,
  type AppNavigationKey,
} from './navigation/appNavigation';

const { Header, Sider, Content } = Layout;

/**
 * Converts typed navigation metadata into Ant Design menu items.
 */
function toMenuItems(items: AppNavigationItem[]): Required<MenuProps>['items'] {
  return items.map(({ children, icon, key, label }) => ({
    key,
    icon,
    label,
    children: children.length > 0 ? toMenuItems(children) : undefined,
  }));
}

/**
 * Renders the shared application shell with a collapsible navigation rail.
 */
export function AppShell({ dashboardContent }: { dashboardContent?: ReactNode }) {
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(false);
  const [selectedNavigationKey, setSelectedNavigationKey] =
    useState<AppNavigationKey>(defaultNavigationKey);
  const navigationId = useId();
  const navigationButtonLabel = isNavigationCollapsed
    ? 'Expand navigation'
    : 'Collapse navigation';
  const navigationToggleIcon = isNavigationCollapsed ? (
    <MenuUnfoldOutlined />
  ) : (
    <MenuFoldOutlined />
  );

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Space size="middle">
          <Button
            type="text"
            size="large"
            className="app-header-toggle"
            icon={navigationToggleIcon}
            aria-controls={navigationId}
            aria-expanded={!isNavigationCollapsed}
            aria-label={navigationButtonLabel}
            title={navigationButtonLabel}
            onClick={() => {
              setIsNavigationCollapsed((currentState) => !currentState);
            }}
          />
          <Space>
            <BookOutlined aria-hidden="true" />
            <span>AssessmentBot Frontend</span>
          </Space>
        </Space>
      </Header>
      <Layout>
        <Sider
          collapsible
          trigger={null}
          collapsed={isNavigationCollapsed}
          width={220}
          collapsedWidth={80}
          id={navigationId}
          role="navigation"
          aria-label="Primary navigation"
          className="app-sider"
        >
          <Menu
            mode="inline"
            inlineCollapsed={isNavigationCollapsed}
            selectedKeys={[selectedNavigationKey]}
            items={toMenuItems(navigationItems)}
            className="app-navigation-menu"
            onClick={({ key }) => {
              if (!isAppNavigationKey(key)) {
                throw new TypeError(
                  `Unexpected navigation key: ${String(key)}. Valid keys are: '${navigationItems
                    .map(({ key: navigationKey }) => navigationKey)
                    .join("', '")}'`
                );
              }

              setSelectedNavigationKey(key);
            }}
          />
        </Sider>
        <Content className="app-content">
          {pageRenderers[selectedNavigationKey](dashboardContent)}
        </Content>
      </Layout>
    </Layout>
  );
}
