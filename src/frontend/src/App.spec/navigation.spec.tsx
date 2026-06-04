/**
 * Navigation tests for App shell.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  expectedNavigationLabels,
  primaryNavigationLabel,
  collapseNavigationButtonLabel,
  expandNavigationButtonLabel,
  applicationTitleText,
  installPendingApiHandlerMock,
  renderPendingApp,
  defaultNavigationKey,
  getNavigationLabel,
  expectBreadcrumbLabels,
  appBreadcrumbBaseLabel,
  pageContent,
} from './shared-setup';

describe('App navigation', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('menu renders all four entries in expanded mode with expected labels', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const label of expectedNavigationLabels) {
      expect(within(navigation).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('menu renders icon-only affordance in collapsed mode', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: collapseNavigationButtonLabel }));
    });

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const menuItems = within(navigation).getAllByRole('menuitem');

    expect(menuItems).toHaveLength(expectedNavigationLabels.length);

    for (const item of menuItems) {
      expect(item.querySelector('.app-navigation-icon')).not.toBeNull();
    }
  });

  it('clicking each menu item updates selected key in component state', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    let previousLabel: string | undefined;

    for (const label of expectedNavigationLabels) {
      const menuItem = within(navigation).getByRole('menuitem', { name: label });

      act(() => {
        fireEvent.click(menuItem);
      });

      expect(menuItem).toHaveClass('ant-menu-item-selected');

      if (previousLabel !== undefined) {
        expect(within(navigation).getByRole('menuitem', { name: previousLabel })).not.toHaveClass(
          'ant-menu-item-selected'
        );
      }

      expect(navigation.querySelectorAll('.ant-menu-item-selected')).toHaveLength(1);
      previousLabel = label;
    }
  });

  it('breadcrumb renders the active page crumb on default load', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    expectBreadcrumbLabels([appBreadcrumbBaseLabel, getNavigationLabel(defaultNavigationKey)]);
  });

  it('changing selected page updates breadcrumb text immediately', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const assignmentsLabel = getNavigationLabel('assignments');

    act(() => {
      fireEvent.click(within(navigation).getByRole('menuitem', { name: assignmentsLabel }));
    });

    expectBreadcrumbLabels([appBreadcrumbBaseLabel, assignmentsLabel]);
  });

  it('breadcrumb labels are sourced from shared metadata (single source of truth)', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const label of expectedNavigationLabels) {
      act(() => {
        fireEvent.click(within(navigation).getByRole('menuitem', { name: label }));
      });

      expectBreadcrumbLabels([appBreadcrumbBaseLabel, label]);
    }
  });

  it('fails fast when the shell menu receives an unexpected raw navigation key', async () => {
    vi.resetModules();
    vi.doMock('antd', async () => {
      const actualAntd = (await vi.importActual('antd')) as Record<string, unknown>;

      return {
        ...actualAntd,
        Menu(properties: { onClick?: (payload: { key: string }) => void }) {
          properties.onClick?.({ key: 'reports' });
          return <div data-testid="mock-navigation-menu" />;
        },
      };
    });

    const { AppShell } = await import('../AppShell');

    expect(() =>
      render(
        <AppShell
          dashboardContent={<div />}
          isDarkMode={false}
          onThemeModeChange={() => {
            // Intentionally empty callback for shell contract tests.
          }}
        />
      )
    ).toThrow(/Unexpected navigation key: reports/);
  });

  it('uses the shared appNavigation render contract for selected page rendering', async () => {
    vi.resetModules();

    const renderNavigationPageSpy = vi.fn(() => (
      <div data-testid="mock-render-contract-page">render contract page</div>
    ));

    vi.doMock('../navigation/appNavigation', () => ({
      appBreadcrumbBaseLabel: 'AssessmentBot Frontend',
      defaultNavigationKey: 'dashboard',
      getBreadcrumbItems: () => [
        { title: 'AssessmentBot Frontend' },
        { title: 'Dashboard' },
      ],
      isAppNavigationKey: (key: string) =>
        key === 'dashboard' || key === 'assignments' || key === 'settings',
      navigationItems: [
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: <span aria-hidden className="app-navigation-icon" />,
          children: [],
        },
      ],
      renderNavigationPage: renderNavigationPageSpy,
    }));

    const { AppShell } = await import('../AppShell');
    const dashboardContent = <div data-testid="mock-dashboard-slot">dashboard slot</div>;

    render(
      <AppShell
        dashboardContent={dashboardContent}
        isDarkMode={false}
        onThemeModeChange={() => {
          // Intentionally empty callback for shell contract tests.
        }}
      />
    );

    expect(renderNavigationPageSpy).toHaveBeenCalledWith('dashboard', dashboardContent);
    expect(screen.getByTestId('mock-render-contract-page')).toBeInTheDocument();
  });

  it('no stale breadcrumb state after rapid page switching', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const rapidSelectionKeys: Array<'assignments' | 'classes' | 'settings'> = ['assignments', 'classes', 'settings'];

    act(() => {
      for (const key of rapidSelectionKeys) {
        const menuItem = within(navigation).getByRole('menuitem', {
          name: getNavigationLabel(key),
        });

        fireEvent.click(menuItem);
      }
    });

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

    expectBreadcrumbLabels([appBreadcrumbBaseLabel, getNavigationLabel('settings')]);
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('assignments'));
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('classes'));
  });

  it('Dashboard default selection renders expected default page content', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const mainRegion = screen.getByRole('main');

    expect(
      within(mainRegion).getByRole('heading', { level: 2, name: pageContent.dashboard.heading })
    ).toBeInTheDocument();
    expect(within(mainRegion).getByText(pageContent.dashboard.summary)).toBeInTheDocument();
  });

  it('renders shell landmarks', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    expect(screen.getByRole('banner')).toHaveTextContent(applicationTitleText);
    expect(screen.getByRole('navigation', { name: primaryNavigationLabel })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('toggles collapsed state via hamburger', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

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
    installPendingApiHandlerMock();

    await renderPendingApp();

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
});
