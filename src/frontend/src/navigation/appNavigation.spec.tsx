import type { ReactElement } from 'react';
import { screen } from '@testing-library/react';
import type { AppNavigationKey } from './appNavigation';
import {
  getBreadcrumbItems,
  getNavigationLabel,
  isAppNavigationKey,
  navigationItems,
  renderNavigationPage,
} from './appNavigation';
import { pageContent } from '../pages/pageContent';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

type NavigationIconShape = {
  wrapperClassName: string | undefined;
  ariaHidden: boolean | undefined;
};

const NAVIGATION_ICON_WRAPPER_SHAPE: NavigationIconShape = {
  wrapperClassName: 'app-navigation-icon',
  ariaHidden: true,
};

/**
 * Reduces a navigation icon element to its wrapper-shape contract so the exhaustive
 * entry test can assert the shared aria-hidden icon wrapper without deep-equalling
 * React element internals.
 *
 * @param {ReactElement | undefined} icon The navigation icon element.
 * @returns {NavigationIconShape | null} The wrapper shape or null when absent.
 */
function describeNavigationIconShape(icon: ReactElement | undefined): NavigationIconShape | null {
  if (icon == null) {
    return null;
  }

  const properties = icon.props as { className?: string; 'aria-hidden'?: boolean };

  return {
    wrapperClassName: properties.className,
    ariaHidden: properties['aria-hidden'],
  };
}

/**
 * Returns the shared navigation render contract under test.
 *
 * @returns {(key: AppNavigationKey, contentSlot?: ReactNode) => ReactNode} The shared renderNavigationPage contract.
 */
function getRenderNavigationPageContract() {
  expect(renderNavigationPage).toEqual(expect.any(Function));

  return renderNavigationPage;
}

describe('app navigation config', () => {
  it('contains exact page entries with stable keys', () => {
    // pageContent.heatmaps is the canonical copy source for the heatmaps navigation entry.
    const heatmapsCopy = (pageContent as { heatmaps?: { heading: string } }).heatmaps;

    expect(
      navigationItems.map(({ key, label, children, icon }) => ({
        key,
        label,
        children,
        icon: describeNavigationIconShape(icon),
      }))
    ).toEqual([
      { key: 'dashboard', label: pageContent.dashboard.heading, children: [], icon: NAVIGATION_ICON_WRAPPER_SHAPE },
      { key: 'classes', label: pageContent.classes.heading, children: [], icon: NAVIGATION_ICON_WRAPPER_SHAPE },
      { key: 'assignments', label: pageContent.assignments.heading, children: [], icon: NAVIGATION_ICON_WRAPPER_SHAPE },
      { key: 'heatmaps', label: heatmapsCopy?.heading, children: [], icon: NAVIGATION_ICON_WRAPPER_SHAPE },
      { key: 'settings', label: pageContent.settings.heading, children: [], icon: NAVIGATION_ICON_WRAPPER_SHAPE },
    ]);
  });

  it('exports one authoritative page render contract for validated shell keys', () => {
    getRenderNavigationPageContract();
  });

  it('page render contract resolves keys to the expected page heading and summary', () => {
    const renderNavigationPage = getRenderNavigationPageContract();
    const pageExpectations = [
      { key: 'dashboard', heading: pageContent.dashboard.heading, summary: pageContent.dashboard.summary },
      { key: 'classes', heading: pageContent.classes.heading, summary: pageContent.classes.summary },
      {
        key: 'assignments',
        heading: pageContent.assignments.heading,
        summary: pageContent.assignments.summary,
      },
      { key: 'settings', heading: pageContent.settings.heading, summary: pageContent.settings.summary },
    ] satisfies Array<{ key: AppNavigationKey; heading: string; summary: string }>;

    for (const { heading, key, summary } of pageExpectations) {
      const { unmount } = renderWithFrontendProviders(<>{renderNavigationPage(key)}</>);

      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();

      unmount();
    }
  });

  it('invalid key handling fails fast in development', () => {
    const renderNavigationPage = getRenderNavigationPageContract();

    expect(() => renderNavigationPage('reports' as AppNavigationKey)).toThrow(
      'Unknown page key: reports'
    );
  });

  it('fails fast when a navigation label is requested for an unknown key', () => {
    expect(() => getNavigationLabel('reports' as AppNavigationKey)).toThrow(
      'Unknown navigation key: reports'
    );
  });

  it('passes dashboard slot content through the navigation page contract', () => {
    const renderNavigationPage = getRenderNavigationPageContract();

    renderWithFrontendProviders(
      <>
        {renderNavigationPage(
          'dashboard',
          <div data-testid="dashboard-slot">Dashboard slot content from shell</div>
        )}
      </>
    );

    expect(screen.getByTestId('dashboard-slot')).toHaveTextContent('Dashboard slot content from shell');
  });

  it('rejects invalid raw navigation keys before they reach the shell state', () => {
    expect(isAppNavigationKey('reports')).toBe(false);
  });

  // The 'heatmaps' key is now part of AppNavigationKey; these tests pin the
  // navigation contract (valid key, ordering, label/icon, page mapping, breadcrumb).

  it('treats the heatmaps key as a valid app navigation key', () => {
    expect(isAppNavigationKey('heatmaps')).toBe(true);
  });

  it('includes the heatmaps navigation entry ordered between assignments and settings', () => {
    const keys = navigationItems.map((item) => item.key as string); // established idiom: compare keys as strings
    const heatmapsIndex = keys.indexOf('heatmaps');
    const assignmentsIndex = keys.indexOf('assignments');
    const settingsIndex = keys.indexOf('settings');

    expect(heatmapsIndex).toBeGreaterThan(assignmentsIndex);
    expect(heatmapsIndex).toBeLessThan(settingsIndex);
  });

  it('exposes the heatmaps navigation label and a decorative aria-hidden icon wrapper', () => {
    const heatmapsItem = navigationItems.find((item) => (item.key as string) === 'heatmaps'); // established idiom

    expect(heatmapsItem?.label).toBe('Heatmaps');

    const iconElement = heatmapsItem?.icon;
    expect(iconElement).toBeDefined();

    const { container } = renderWithFrontendProviders(<>{iconElement}</>);
    const iconWrapper = container.querySelector('span.app-navigation-icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper).toHaveAttribute('aria-hidden', 'true');
  });

  it('maps the heatmaps navigation key to the HeatmapsPage thin root', () => {
    // The argument-level cast encodes the new-key contract without casting the whole function.
    renderWithFrontendProviders(<>{renderNavigationPage('heatmaps' as AppNavigationKey)}</>);

    expect(screen.getByRole('heading', { level: 2, name: 'Heatmaps' })).toBeInTheDocument();
  });

  it('derives a single static breadcrumb segment for the heatmaps key', () => {
    const items = getBreadcrumbItems('heatmaps' as AppNavigationKey);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Heatmaps');
  });
});
