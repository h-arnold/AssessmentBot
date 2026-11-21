import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { pageContent } from '../pages/pageContent';
import {
  defaultNavigationKey,
  getBreadcrumbItems,
  getNavigationLabel,
  type AppNavigationKey,
} from '../navigation/appNavigation';
import {
  collapseNavigationButtonLabel,
  installResolvedWarmupApiHandlerMock,
  primaryNavigationLabel,
  renderReadyApp,
} from '@/test/shell/appSpecHarness';

const expectedNavigationLabels = [
  'Dashboard',
  'Assignments',
  'Classes',
  'Heatmaps',
  'Settings',
] as const;
const noBreadcrumbLabelPosition = -1;
const breadcrumbNavigationName = 'Breadcrumb';

/**
 * Returns the rendered breadcrumb landmark.
 *
 * @returns {HTMLElement} The breadcrumb navigation landmark.
 */
function getBreadcrumbElement() {
  return screen.getByRole('navigation', { name: breadcrumbNavigationName });
}

/**
 * Asserts breadcrumb labels while keeping expectations scoped to the breadcrumb itself.
 *
 * @param {string[]} labels - The breadcrumb labels that should be visible.
 */
function expectBreadcrumbLabels(labels: string[]) {
  const breadcrumb = getBreadcrumbElement();
  const breadcrumbText = breadcrumb.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';

  for (const label of labels) {
    expect(breadcrumb).toHaveTextContent(label);
  }

  let previousPosition = noBreadcrumbLabelPosition;

  for (const label of labels) {
    const labelPosition = breadcrumbText.indexOf(label);

    expect(labelPosition).toBeGreaterThan(previousPosition);
    previousPosition = labelPosition;
  }
}

describe('App navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('../navigation/appNavigation');
  });

  it('menu renders all four entries in expanded mode with expected labels', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const label of expectedNavigationLabels) {
      expect(within(navigation).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('menu renders icon-only affordance in collapsed mode', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

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
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

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
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    expectBreadcrumbLabels([getNavigationLabel(defaultNavigationKey)]);
  });

  it('changing selected page updates breadcrumb text immediately', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const assignmentsLabel = getNavigationLabel('assignments');

    act(() => {
      fireEvent.click(within(navigation).getByRole('menuitem', { name: assignmentsLabel }));
    });

    expectBreadcrumbLabels([assignmentsLabel]);
  });

  it('breadcrumb labels are sourced from shared metadata (single source of truth)', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const label of expectedNavigationLabels) {
      act(() => {
        fireEvent.click(within(navigation).getByRole('menuitem', { name: label }));
      });

      expectBreadcrumbLabels([label]);
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

    const renderNavigationPageSpy = vi.fn(() => {
      // The marker stands in for the page the shared render contract selects.
      return <div data-testid="mock-render-contract-page">render contract page</div>;
    });

    vi.doMock('../navigation/appNavigation', () => {
      return {
        appBreadcrumbBaseLabel: 'AssessmentBot Frontend',
        defaultNavigationKey: 'dashboard',
        getBreadcrumbItems: () => [{ title: 'Dashboard' }],
        isAppNavigationKey: (key: string) => ['dashboard', 'assignments', 'settings'].includes(key),
        navigationItems: [
          {
            key: 'dashboard',
            label: 'Dashboard',
            icon: <span aria-hidden className="app-navigation-icon" />,
            children: [],
          },
        ],
        renderNavigationPage: renderNavigationPageSpy,
      };
    });

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
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const rapidSelectionKeys: AppNavigationKey[] = ['assignments', 'classes', 'settings'];

    act(() => {
      for (const key of rapidSelectionKeys) {
        const menuItem = within(navigation).getByRole('menuitem', {
          name: getNavigationLabel(key),
        });

        fireEvent.click(menuItem);
      }
    });

    const breadcrumb = getBreadcrumbElement();

    expectBreadcrumbLabels([getNavigationLabel('settings')]);
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('assignments'));
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('classes'));
  });

  it('prevents stale breadcrumb class-name crumb on non-class pages', () => {
    const testClassName = 'Year 9 Maths';

    // Non-class pages must not include the class name in the breadcrumb
    const assignmentsCrumb = getBreadcrumbItems('assignments', testClassName);

    expect(assignmentsCrumb).toHaveLength(1);
    expect(assignmentsCrumb[0]).not.toHaveProperty('title', testClassName);

    const settingsCrumb = getBreadcrumbItems('settings', testClassName);

    expect(settingsCrumb).toHaveLength(1);
    expect(settingsCrumb[0]).not.toHaveProperty('title', testClassName);

    // Classes page must still include the class name (guard against over-fixing)
    const classPageCrumbCount = 2;
    const classesCrumb = getBreadcrumbItems('classes', testClassName, () => {});

    expect(classesCrumb).toHaveLength(classPageCrumbCount);
    expect(classesCrumb[classPageCrumbCount - 1]).toHaveProperty('title', testClassName);
  });

  it('Dashboard default selection renders expected default page content', async () => {
    installResolvedWarmupApiHandlerMock();

    await renderReadyApp();

    const mainRegion = screen.getByRole('main');

    expect(
      within(mainRegion).getByRole('heading', { level: 2, name: pageContent.dashboard.heading })
    ).toBeInTheDocument();
    expect(within(mainRegion).getByText(pageContent.dashboard.summary)).toBeInTheDocument();
  });
});
