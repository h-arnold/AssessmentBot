import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { getCssRuleBlock } from '../../test/appStylesRaw';
import { AuthStatusCard } from './AuthStatusCard';

describe('AuthStatusCard', () => {
  it('renders the authorised surface only, leaving denial messaging to the gate', () => {
    renderWithFrontendProviders(<AuthStatusCard />);

    expect(screen.getByText('Authorised')).toBeInTheDocument();
    expect(
      screen.queryByText('You do not have access to this application.')
    ).not.toBeInTheDocument();
  });

  it('renders the standalone auth status card surface', () => {
    renderWithFrontendProviders(<AuthStatusCard />);

    expect(screen.getByText('Authorised')).toBeInTheDocument();
    expect(screen.getByText('Authorised').closest('.auth-card')).not.toBeNull();
  });

  it('uses the shared default panel width token for the standalone auth card surface', () => {
    const authCardRuleBlock = getCssRuleBlock('.auth-card');

    expect(authCardRuleBlock).toMatch(/width:\s*min\(100%,\s*var\(--app-panel-width-default\)\)/);
    expect(authCardRuleBlock).not.toMatch(/\b720px\b/);
  });
});
