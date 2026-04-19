import type { ReactNode } from 'react';
import { screen } from '@testing-library/react';
import * as appNavigationModule from './appNavigation';
import type { AppNavigationKey } from './appNavigation';
import { isAppNavigationKey, navigationItems } from './appNavigation';
import { pageContent } from '../pages/pageContent';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

type RenderNavigationPage = (key: AppNavigationKey, contentSlot?: ReactNode) => ReactNode;

/**
 * Returns the shared navigation render contract under test.
 *
 * @returns {RenderNavigationPage} The shared renderNavigationPage contract.
 */
function getRenderNavigationPageContract() {
  const renderNavigationPage = (
    appNavigationModule as { renderNavigationPage?: RenderNavigationPage }
  ).renderNavigationPage;

  expect(renderNavigationPage).toEqual(expect.any(Function));

  return renderNavigationPage as RenderNavigationPage;
}

describe('app navigation config', () => {
  it('contains exact page entries with stable keys', () => {
    expect(
      navigationItems.map(({ key, label, children }) => ({
        key,
        label,
        children,
      }))
    ).toEqual([
      { key: 'dashboard', label: 'Dashboard', children: [] },
      { key: 'assignments', label: 'Assignments', children: [] },
      { key: 'settings', label: 'Settings', children: [] },
    ]);
  });

  it('exports one authoritative page render contract for validated shell keys', () => {
    getRenderNavigationPageContract();
  });

  it('page render contract resolves keys to the expected page heading and summary', () => {
    const renderNavigationPage = getRenderNavigationPageContract();
    const pageExpectations = [
      { key: 'dashboard', heading: pageContent.dashboard.heading, summary: pageContent.dashboard.summary },
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
});
