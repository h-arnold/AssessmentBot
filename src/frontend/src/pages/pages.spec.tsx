import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { pageExpectations } from '../test/pageExpectations';

const pageComponentLoaders: Record<string, () => Promise<ComponentType>> = {
  dashboard: async () => (await import('./DashboardPage')).DashboardPage,
  classes: async () => (await import('./ClassesPage')).ClassesPage,
  assignments: async () => (await import('./AssignmentsPage')).AssignmentsPage,
  settings: async () => (await import('./SettingsPage')).SettingsPage,
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
