import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';

const backendSettingsFeatureEntryText = 'Backend settings feature entry';
const backendSettingsFeatureEntryRegionLabel = 'Backend settings feature entry';

vi.mock(
  '../features/settings/backend/BackendSettingsPanel',
  () => ({
    BackendSettingsPanel() {
      return (
        <div role="region" aria-label={backendSettingsFeatureEntryRegionLabel}>
          {backendSettingsFeatureEntryText}
        </div>
      );
    },
  }),
);

describe('SettingsPage', () => {
  it('renders the shared settings heading and summary copy', () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: pageContent.settings.heading })
    ).toBeInTheDocument();
    expect(screen.getByText(pageContent.settings.summary)).toBeInTheDocument();
  });

  it('renders the backend settings feature entry when the tab is selected', () => {
    render(<SettingsPage />);

    const classesTab = screen.getByRole('tab', { name: 'Classes' });
    const backendSettingsTab = screen.getByRole('tab', { name: 'Backend settings' });

    expect(classesTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(backendSettingsTab);

    expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: backendSettingsFeatureEntryRegionLabel })).toBeInTheDocument();
    expect(screen.getByText(backendSettingsFeatureEntryText)).toBeInTheDocument();
  });
});
