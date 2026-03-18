import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { pageContent } from './pageContent';

describe('SettingsPage', () => {
  it('renders the shared settings heading and summary copy', () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: pageContent.settings.heading })
    ).toBeInTheDocument();
    expect(screen.getByText(pageContent.settings.summary)).toBeInTheDocument();
  });

  it('renders the settings tabs and switches between placeholder panels', () => {
    render(<SettingsPage />);

    const classesTab = screen.getByRole('tab', { name: 'Classes' });
    const backendSettingsTab = screen.getByRole('tab', { name: 'Backend settings' });

    expect(classesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Classes panel' })).toBeInTheDocument();

    fireEvent.click(backendSettingsTab);

    expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Backend settings panel' })).toBeInTheDocument();
  });
});
