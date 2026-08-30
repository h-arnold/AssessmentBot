import { HomeOutlined, SettingOutlined } from '@ant-design/icons';
import type { BreadcrumbProps } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { BookA, Flame, GraduationCap } from 'lucide-react';
import { AssignmentsPage } from '../pages/AssignmentsPage';
import { ClassesPage } from '../pages/ClassesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HeatmapsPage } from '../pages/HeatmapsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LucideIcon } from '../components/icons/LucideIcon';
import { pageContent } from '../pages/pageContent';

export type AppNavigationKey = 'dashboard' | 'assignments' | 'classes' | 'heatmaps' | 'settings';

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
 * Wraps a navigation icon element so menu items keep a visual icon in collapsed
 * mode while hiding decorative icon wrappers from assistive technology.
 *
 * @param {ReactElement} icon Icon element to wrap.
 * @returns {ReactElement} The wrapped navigation icon.
 */
function renderNavigationIcon(icon: ReactElement) {
  return (
    <span aria-hidden className="app-navigation-icon">
      {icon}
    </span>
  );
}

const navigationDefinitions: readonly AppNavigationDefinition[] = [
  {
    key: 'dashboard',
    label: pageContent.dashboard.heading,
    icon: renderNavigationIcon(<HomeOutlined aria-hidden />),
  },
    {
    key: 'classes',
    label: pageContent.classes.heading,
    icon: renderNavigationIcon(<LucideIcon icon={GraduationCap} />),
  },
  {
    key: 'assignments',
    label: pageContent.assignments.heading,
    icon: renderNavigationIcon(<LucideIcon icon={BookA} />),
  },
  {
    key: 'heatmaps',
    label: pageContent.heatmaps.heading,
    icon: renderNavigationIcon(<LucideIcon icon={Flame} />),
  },
  {
    key: 'settings',
    label: pageContent.settings.heading,
    icon: renderNavigationIcon(<SettingOutlined aria-hidden />),
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

const appNavigationKeys = new Set<AppNavigationKey>(navigationItems.map(({ key }) => key));

export const defaultNavigationKey: AppNavigationKey = 'dashboard';

/**
 * Builds a consistent fail-fast error for unexpected page-renderer access.
 *
 * @param {string} key Unknown navigation key.
 * @returns {TypeError} A fail-fast navigation error.
 */
function buildUnknownPageKeyError(key: string) {
  return new TypeError(`Unknown page key: ${key}`);
}

/**
 * Resolves and renders the selected page from the canonical navigation contract.
 *
 * @param {AppNavigationKey} key Active navigation key.
 * @param {ReactNode | undefined} contentSlot Optional dashboard content slot.
 * @returns {ReactNode} The selected page.
 *
 * @remarks
 * `AppShell` treats this as the single runtime source of truth for navigation-key-to-page rendering.
 * Do not reintroduce a second page-selection switch elsewhere in the shell.
 */
export function renderNavigationPage(key: AppNavigationKey, contentSlot?: ReactNode) {
  switch (key) {
    case 'dashboard': {
      return <DashboardPage contentSlot={contentSlot} />;
    }
    case 'assignments': {
      return <AssignmentsPage />;
    }
    case 'classes': {
      return <ClassesPage />;
    }
    case 'heatmaps': {
      return <HeatmapsPage />;
    }
    case 'settings': {
      return <SettingsPage />;
    }
    default: {
      throw buildUnknownPageKeyError(String(key));
    }
  }
}

/**
 * Returns the shared label for a navigation key.
 *
 * @param {AppNavigationKey} key Navigation key to resolve.
 * @returns {string} The shared label for the navigation key.
 */
export function getNavigationLabel(key: AppNavigationKey) {
  const navigationDefinition = navigationDefinitionByKey.get(key);

  if (navigationDefinition === undefined) {
    throw new TypeError(`Unknown navigation key: ${key}`);
  }

  return navigationDefinition.label;
}

/**
 * Builds the breadcrumb trail for the active navigation entry.
 *
 * @remarks
 * When a class detail is open (`className` is provided) and the active key is `classes`,
 * the second segment becomes a clickable link that navigates back to the class list.
 * A third segment showing the class name is appended.
 *
 * @param {AppNavigationKey} key Active navigation key.
 * @param {string | undefined} className The class name when a class detail is open.
 * @param {(() => void) | undefined} onNavigateToClasses Callback to return to the class list.
 * @returns {NonNullable<BreadcrumbProps['items']>} Breadcrumb items for the active navigation key.
 */
export function getBreadcrumbItems(
  key: AppNavigationKey,
  className?: string,
  onNavigateToClasses?: () => void
): NonNullable<BreadcrumbProps['items']> {
  const secondSegment =
    key === 'classes' && className !== undefined && onNavigateToClasses !== undefined
      ? {
          title: getNavigationLabel(key),
          onClick: onNavigateToClasses,
          className: 'app-breadcrumb-link',
        }
      : { title: getNavigationLabel(key) };

  const items: NonNullable<BreadcrumbProps['items']> = [
    secondSegment satisfies AppBreadcrumbDefinition,
  ];

  if (key === 'classes' && className !== undefined) {
    items.push({ title: className } satisfies AppBreadcrumbDefinition);
  }

  return items;
}

/**
 * Guards menu click keys before they are applied to app state.
 *
 * @param {string} value Candidate navigation key.
 * @returns {value is AppNavigationKey} Whether the value is a valid app navigation key.
 */
export function isAppNavigationKey(value: string): value is AppNavigationKey {
  return appNavigationKeys.has(value as AppNavigationKey);
}
