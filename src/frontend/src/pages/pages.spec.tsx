import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { pageExpectations } from '../test/pageExpectations';

type AppNavigationKey = (typeof pageExpectations)[number]['key'];

const pageComponentLoaders: Record<AppNavigationKey, () => Promise<ComponentType>> = {
  dashboard: async () => {
    const module = await import('./DashboardPage');
    return module.DashboardPage;
  },
  classes: async () => {
    const module = await import('./ClassesPage');
    return module.ClassesPage;
  },
  assignments: async () => {
    const module = await import('./AssignmentsPage');
    return module.AssignmentsPage;
  },
  settings: async () => {
    const module = await import('./SettingsPage');
    return module.SettingsPage;
  },
};

describe('section 5 page components', () => {
  it.each(pageExpectations)(
    'renders the expected heading and summary text for $heading',
    async ({ heading, key, summary }) => {
      const PageComponent = await pageComponentLoaders[key]();

      render(<PageComponent />);

      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    }
  );
});
