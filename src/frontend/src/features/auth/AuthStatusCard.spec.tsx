import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { getCssRuleBlock } from '../../test/appStylesRaw';
import { AuthStatusCard } from './AuthStatusCard';

const { useAuthorisationStatusMock } = vi.hoisted(() => ({
  useAuthorisationStatusMock: vi.fn(),
}));

vi.mock('./useAuthorisationStatus', () => ({
  useAuthorisationStatus: useAuthorisationStatusMock,
}));

describe('AuthStatusCard', () => {
  beforeEach(() => {
    useAuthorisationStatusMock.mockReturnValue({
      authViewState: 'authorised',
      authError: null,
      isAuthResolved: true,
      isAuthorised: true,
    });
  });

  afterEach(() => {
    useAuthorisationStatusMock.mockReset();
    vi.clearAllMocks();
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
