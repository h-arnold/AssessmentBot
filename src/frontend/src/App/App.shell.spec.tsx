import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import appStyles from '../index.css?raw';
import { appBreadcrumbBaseLabel, getNavigationLabel } from '../navigation/appNavigation';
import {
  collapseNavigationButtonLabel,
  expandNavigationButtonLabel,
  installResolvedWarmupApiHandlerMock,
  loadingAuthorisationStatusLabel,
  primaryNavigationLabel,
  renderReadyApp,
} from '@/test/shell/appSpecHarness';

const applicationTitleText = appBreadcrumbBaseLabel;
const ariaCheckedAttribute = 'aria-checked';

/**
 * Returns the theme mode switch once it is rendered.
 *
 * @returns {HTMLElement} The theme mode switch locator.
 */
function getThemeModeSwitch() {
  return screen.getByRole('switch', { name: 'Dark mode' });
}

describe('App shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('renders shell landmarks', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    expect(screen.getByRole('banner')).toHaveTextContent(applicationTitleText);
    expect(screen.getByRole('navigation', { name: primaryNavigationLabel })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('toggles collapsed state via hamburger', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const toggleButton = screen.getByRole('button', { name: collapseNavigationButtonLabel });

    act(() => {
      fireEvent.click(toggleButton);
    });
    expect(screen.getByRole('button', { name: expandNavigationButtonLabel })).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: expandNavigationButtonLabel }));
    });
    expect(screen.getByRole('button', { name: collapseNavigationButtonLabel })).toBeInTheDocument();
  });

  it('updates accessible control label and state when toggled', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const toggleButton = screen.getByRole('button', { name: collapseNavigationButtonLabel });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      fireEvent.click(toggleButton);
    });
    expect(screen.getByRole('button', { name: expandNavigationButtonLabel })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('does not regress existing auth card mounting path', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const mainRegion = screen.getByRole('main');

    expect(
      within(mainRegion).queryByRole('status', { name: loadingAuthorisationStatusLabel })
    ).not.toBeInTheDocument();
  });

  it('toggle control renders with accessible label', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    expect(getThemeModeSwitch()).toBeInTheDocument();
  });

  it('toggle callback flips theme state between light and dark', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const themeModeSwitch = getThemeModeSwitch();

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'false');

    act(() => {
      fireEvent.click(themeModeSwitch);
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'true');

    act(() => {
      fireEvent.click(themeModeSwitch);
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'false');
  });

  it('theme toggle updates the Ant Design shell styling', async () => {
    const { AppThemeShell } = await import('../AppThemeShell');

    await act(async () => {
      render(<AppThemeShell />);
    });

    const header = document.querySelector('.app-header');

    if (!(header instanceof HTMLElement)) {
      throw new TypeError('Expected the themed app header to be rendered.');
    }

    const initialHeaderBackground = header.style.backgroundColor;

    act(() => {
      fireEvent.click(getThemeModeSwitch());
    });

    await waitFor(() => {
      expect(header.style.backgroundColor).not.toBe(initialHeaderBackground);
    });
  });

  it('theme toggle state persists during in-app page navigation', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const themeModeSwitch = getThemeModeSwitch();
    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    act(() => {
      fireEvent.click(themeModeSwitch);
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('classes') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('settings') })
      );
    });

    expect(themeModeSwitch).toHaveAttribute(ariaCheckedAttribute, 'true');
  });

  it('theme-compatible styles are applied', () => {
    expect(appStyles).not.toMatch(/body\s*{[^}]*background:\s*#[\da-f]{3,8}/i);
    expect(appStyles).not.toMatch(/\.app-header\s*{[^}]*color:\s*#[\da-f]{3,8}/i);
  });
});
