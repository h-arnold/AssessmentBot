import { screen, within } from '@testing-library/react';
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

  it('renders a skeleton status region while the auth status is loading', () => {
    useAuthorisationStatusMock.mockReturnValue({
      authViewState: 'loading',
      authError: null,
      isAuthResolved: false,
      isAuthorised: false,
    });

    renderWithFrontendProviders(<AuthStatusCard />);

    const loadingStatus = screen.getByRole('status', { name: 'Loading authorisation status' });
    const authCard = loadingStatus.closest('.auth-card');

    expect(authCard).not.toBeNull();
    expect(within(authCard as HTMLElement).getByRole('status', { name: 'Loading authorisation status' })).toBeInTheDocument();
    expect(authCard?.querySelector('.ant-skeleton')).not.toBeNull();
    expect(within(authCard as HTMLElement).queryByText('Checking authorisation status...')).not.toBeInTheDocument();
    expect(within(authCard as HTMLElement).queryByText('Authorised')).not.toBeInTheDocument();
    expect(within(authCard as HTMLElement).queryByText('Unauthorised')).not.toBeInTheDocument();
    expect(within(authCard as HTMLElement).queryByRole('progressbar')).not.toBeInTheDocument();
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
