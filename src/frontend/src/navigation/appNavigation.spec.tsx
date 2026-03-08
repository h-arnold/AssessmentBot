import type { AppNavigationKey } from './appNavigation';
import { navigationItems, pageRenderers } from './appNavigation';

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

    const keys: AppNavigationKey[] = ['dashboard', 'classes', 'assignments', 'settings'];

    for (const key of keys) {
      expect(typeof pageRenderers[key]).toBe('function');
      expect(pageRenderers[key]()).toBeTruthy();
    }
  });
});
