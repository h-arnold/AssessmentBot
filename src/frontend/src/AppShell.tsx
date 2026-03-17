import { BookOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Layout, Menu, Space, Switch, theme } from 'antd';
import type { MenuProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { useId, useMemo, useState } from 'react';
import {
  appBreadcrumbBaseLabel,
  defaultNavigationKey,
  getBreadcrumbItems,
  isAppNavigationKey,
  navigationItems,
  pageRenderers,
  type AppNavigationItem,
  type AppNavigationKey,
} from './navigation/appNavigation';

const { Header, Sider, Content } = Layout;

const darkModeLabel = 'Dark mode';

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
type AppShellProps = Readonly<{
  dashboardContent?: ReactNode;
  isDarkMode: boolean;
  onThemeModeChange: (checked: boolean) => void;
}>;

/**
 * Application shell layout with header, navigation, and content.
 */
export function AppShell({
  dashboardContent,
  isDarkMode,
  onThemeModeChange,
}: AppShellProps) {
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(false);
  const [selectedNavigationKey, setSelectedNavigationKey] =
    useState<AppNavigationKey>(defaultNavigationKey);
  const { token } = theme.useToken();
  const navigationId = useId();
  const navigationButtonLabel = isNavigationCollapsed
    ? 'Expand navigation'
    : 'Collapse navigation';
  const navigationToggleIcon = isNavigationCollapsed ? (
    <MenuUnfoldOutlined />
  ) : (
    <MenuFoldOutlined />
  );
  const navigationMenuItems = useMemo(() => toMenuItems(navigationItems), []);
  const shellStyle: CSSProperties = {
    backgroundColor: token.colorBgLayout,
    '--app-motion-duration-mid': token.motionDurationMid,
    '--app-motion-ease-in-out': token.motionEaseInOut,
  } as CSSProperties;
  const selectedPage = renderSelectedPage(selectedNavigationKey, dashboardContent);

  return (
    <Layout className="app-shell" style={shellStyle}>
      <Header
        className="app-header"
        style={{
          backgroundColor: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextHeading,
        }}
      >
        <div className="app-header-bar">
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
              <span>{appBreadcrumbBaseLabel}</span>
            </Space>
          </Space>
          <label className="app-header-theme-toggle">
            <span className="app-header-theme-label">{darkModeLabel}</span>
            <Switch
              aria-label={darkModeLabel}
              checked={isDarkMode}
              onChange={onThemeModeChange}
            />
          </label>
        </div>
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
          style={{
            backgroundColor: token.colorBgContainer,
            borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Menu
            mode="inline"
            inlineCollapsed={isNavigationCollapsed}
            selectedKeys={[selectedNavigationKey]}
            items={navigationMenuItems}
            className="app-navigation-menu"
            theme={isDarkMode ? 'dark' : 'light'}
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
        <Content className="app-content" style={{ backgroundColor: token.colorBgLayout }}>
          <Breadcrumb
            items={getBreadcrumbItems(selectedNavigationKey)}
            aria-label="Breadcrumb"
            className="app-breadcrumb"
          />
          {selectedPage}
        </Content>
      </Layout>
    </Layout>
  );
}

/**
 * Resolves the page renderer for the active navigation key without dynamic property access.
 */
function renderSelectedPage(key: AppNavigationKey, dashboardContent?: ReactNode) {
  switch (key) {
    case 'dashboard': {
      return pageRenderers.dashboard(dashboardContent);
    }
    case 'classes': {
      return pageRenderers.classes(dashboardContent);
    }
    case 'assignments': {
      return pageRenderers.assignments(dashboardContent);
    }
    case 'settings': {
      return pageRenderers.settings(dashboardContent);
    }
    default: {
      throw new TypeError(`Unknown navigation key: ${String(key)}`);
    }
  }
}
