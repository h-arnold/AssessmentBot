import {
  AppstoreOutlined,
  BookOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BreadcrumbProps } from 'antd';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { AssignmentsPage } from '../pages/AssignmentsPage';
import { ClassesPage } from '../pages/ClassesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { pageContent } from '../pages/pageContent';

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

const navigationDefinitions: readonly AppNavigationDefinition[] = [
  {
    key: 'dashboard',
    label: pageContent.dashboard.heading,
    icon: renderNavigationIcon(HomeOutlined),
  },
  {
    key: 'classes',
    label: pageContent.classes.heading,
    icon: renderNavigationIcon(BookOutlined),
  },
  {
    key: 'assignments',
    label: pageContent.assignments.heading,
    icon: renderNavigationIcon(AppstoreOutlined),
  },
  {
    key: 'settings',
    label: pageContent.settings.heading,
    icon: renderNavigationIcon(SettingOutlined),
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

export const defaultNavigationKey: AppNavigationKey = 'dashboard';

function buildUnknownPageKeyError(key: string) {
  return new TypeError(`Unknown page key: ${key}`);
}

const pageRendererMap: Record<AppNavigationKey, AppNavigationPageRenderer> = {
  dashboard: (contentSlot) => <DashboardPage contentSlot={contentSlot} />,
  classes: () => <ClassesPage />,
  assignments: () => <AssignmentsPage />,
  settings: () => <SettingsPage />,
};

export const pageRenderers = new Proxy(pageRendererMap, {
  get(target, property, receiver) {
    if (typeof property === 'string' && !isAppNavigationKey(property)) {
      return () => {
        throw buildUnknownPageKeyError(property);
      };
    }

    return Reflect.get(target, property, receiver);
  },
}) as Record<
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
