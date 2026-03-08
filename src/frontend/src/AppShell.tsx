import { BookOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button, Layout, Space, Typography } from 'antd';
import { type PropsWithChildren, useId, useState } from 'react';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Renders the shared application shell with a collapsible navigation rail.
 */
export function AppShell({ children }: PropsWithChildren) {
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(false);
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
          <div className="app-navigation">
            <div className="app-navigation-marker" aria-hidden="true">
              <BookOutlined />
            </div>
            {isNavigationCollapsed ? null : <Text strong>Navigation</Text>}
          </div>
        </Sider>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
