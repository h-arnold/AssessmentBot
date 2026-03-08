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
    expect(Object.keys(pageRenderers).sort()).toEqual([
      'assignments',
      'classes',
      'dashboard',
      'settings',
    ]);

    for (const key of ['dashboard', 'classes', 'assignments', 'settings']) {
      expect(typeof pageRenderers[key]).toBe('function');
      expect(pageRenderers[key]()).toBeTruthy();
    }
  });
});
