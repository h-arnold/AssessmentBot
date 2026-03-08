import {
  AppstoreOutlined,
  BookOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BreadcrumbProps } from 'antd';
import { Space, Typography } from 'antd';
import type { ComponentType, ReactElement, ReactNode } from 'react';

const { Paragraph, Title } = Typography;

export type AppNavigationKey = 'dashboard' | 'classes' | 'assignments' | 'settings';

type AppNavigationPageRenderer = (contentSlot?: ReactNode) => ReactNode;

/**
 * Shared navigation item metadata stays tree-ready so later sections can add nested children
 * without introducing a second menu contract.
 */
export type AppNavigationItem = {
  key: AppNavigationKey;
  label: string;
  icon: ReactElement;
  children: AppNavigationItem[];
};

type AppNavigationDefinition = {
  key: AppNavigationKey;
  label: string;
  icon: ReactElement;
  description: string;
};

type AppBreadcrumbDefinition = NonNullable<BreadcrumbProps['items']>[number];

/**
 * Wraps Ant Design icons so menu items keep an icon role in collapsed mode without polluting
 * the menu item's accessible name.
 */
function renderNavigationIcon(Icon: ComponentType<{ 'aria-hidden'?: boolean }>) {
  return (
    <span role="img" className="app-navigation-icon">
      <Icon aria-hidden />
    </span>
  );
}

/**
 * Renders a minimal page section for the active navigation entry.
 */
function renderPageSection(
  label: string,
  description: string,
  contentSlot?: ReactNode
) {
  return (
    <section className="app-page" aria-label={`${label} page`}>
      <Space orientation="vertical" size="middle" className="app-page-content">
        <div>
          <Title level={2}>{label}</Title>
          <Paragraph>{description}</Paragraph>
        </div>
        {contentSlot}
      </Space>
    </section>
  );
}

const navigationDefinitions: readonly AppNavigationDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: renderNavigationIcon(HomeOutlined),
    description: 'View the current assessment overview.',
  },
  {
    key: 'classes',
    label: 'Classes',
    icon: renderNavigationIcon(BookOutlined),
    description: 'Review class-level assessment work.',
  },
  {
    key: 'assignments',
    label: 'Assignments',
    icon: renderNavigationIcon(AppstoreOutlined),
    description: 'Browse assignment activity and progress.',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: renderNavigationIcon(SettingOutlined),
    description: 'Manage application-level preferences.',
  },
] as const;

export const appBreadcrumbBaseLabel = 'AssessmentBot Frontend';

const navigationDefinitionByKey = new Map(
  navigationDefinitions.map((definition) => [definition.key, definition] as const)
);

export const navigationItems: AppNavigationItem[] = navigationDefinitions.map(
  ({ key, label, icon }) => ({
    key,
    label,
    icon,
    children: [],
  })
);

export const defaultNavigationKey: AppNavigationKey = navigationItems[0].key;

const pageRendererEntries = navigationDefinitions.map(
  ({ description, key, label }) =>
    [
      key,
      (contentSlot?: ReactNode) =>
        renderPageSection(
          label,
          description,
          key === defaultNavigationKey ? contentSlot : undefined
        ),
    ] as const
);

export const pageRenderers = Object.fromEntries(pageRendererEntries) as Record<
  AppNavigationKey,
  AppNavigationPageRenderer
>;

/**
 * Returns the shared label for a navigation key.
 */
export function getNavigationLabel(key: AppNavigationKey) {
  const navigationDefinition = navigationDefinitionByKey.get(key);

  if (navigationDefinition === undefined) {
    throw new TypeError(`Unknown navigation key: ${key}`);
  }

  return navigationDefinition.label;
}

/**
 * Builds the minimal breadcrumb trail for the active navigation entry.
 */
export function getBreadcrumbItems(
  key: AppNavigationKey
): NonNullable<BreadcrumbProps['items']> {
  return [
    { title: appBreadcrumbBaseLabel } satisfies AppBreadcrumbDefinition,
    { title: getNavigationLabel(key) } satisfies AppBreadcrumbDefinition,
  ];
}

/**
 * Guards menu click keys before they are applied to app state.
 */
export function isAppNavigationKey(value: string): value is AppNavigationKey {
  return navigationItems.some(({ key }) => key === value);
}
