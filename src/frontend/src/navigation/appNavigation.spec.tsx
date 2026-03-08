import { render, screen } from '@testing-library/react';
import type { AppNavigationKey } from './appNavigation';
import { navigationItems, pageRenderers } from './appNavigation';
import { pageExpectations } from '../test/pageExpectations';

describe('app navigation config', () => {
  it('contains exact four page entries with stable keys', () => {
    expect(
      navigationItems.map(({ key, label, children }) => ({
        key,
        label,
        children,
      }))
    ).toEqual([
      { key: 'dashboard', label: 'Dashboard', children: [] },
      { key: 'classes', label: 'Classes', children: [] },
      { key: 'assignments', label: 'Assignments', children: [] },
      { key: 'settings', label: 'Settings', children: [] },
    ]);
  });

  it('selected key drives active page renderer mapping deterministically', () => {
    expect(Object.keys(pageRenderers).toSorted()).toEqual([
      'assignments',
      'classes',
      'dashboard',
      'settings',
    ]);

    const keys: AppNavigationKey[] = navigationItems.map(({ key }) => key);

    for (const key of keys) {
      expect(typeof pageRenderers[key]).toBe('function');
      expect(pageRenderers[key]()).toBeTruthy();
    }
  });

  it('page switch map resolves keys to correct component', () => {
    for (const { heading, key, summary } of pageExpectations) {
      const { unmount } = render(<>{pageRenderers[key]()}</>);

      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();

      unmount();
    }
  });

  it('invalid key handling fails fast in development', () => {
    expect(() => pageRenderers['reports' as AppNavigationKey]).toThrowError('Unknown page key: reports');
  });
});
