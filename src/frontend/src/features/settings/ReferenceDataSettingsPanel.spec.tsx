import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ReferenceDataSettingsPanel } from './ReferenceDataSettingsPanel';

// RED phase: ReferenceDataSettingsPanel doesn't exist yet
// These tests are expected to fail until the actual component is implemented

describe('ReferenceDataSettingsPanel', () => {
  /**
   * Renders the ReferenceDataSettingsPanel component for testing.
   *
   * @returns {ReturnType<typeof renderWithFrontendProviders>} The render result.
   */
  function renderReferenceDataSettingsPanel() {
    return renderWithFrontendProviders(<ReferenceDataSettingsPanel />);
  }

  // Section 4 - ReferenceDataSettingsPanel tests - RED phase
  // These tests are expected to fail until the implementation is complete

  it('renders Topics section', () => {
    renderReferenceDataSettingsPanel();

    expect(screen.getByRole('heading', { name: 'Topics' })).toBeInTheDocument();
  });

  it('Topics section shows title Topics', () => {
    renderReferenceDataSettingsPanel();

    const topicsHeading = screen.getByRole('heading', { name: 'Topics' });
    expect(topicsHeading).toHaveTextContent('Topics');
  });

  it('Topics section shows button Manage Topics', () => {
    renderReferenceDataSettingsPanel();

    expect(screen.getByRole('button', { name: 'Manage Topics' })).toBeInTheDocument();
  });

  it('Topics section includes a primary Manage Topics button', () => {
    renderReferenceDataSettingsPanel();

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    expect(manageTopicsButton).toHaveClass('ant-btn-primary');
  });
});
