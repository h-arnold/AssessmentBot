import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import App from './App';
import { AppAuthGate } from './features/auth/AppAuthGate';
import appStyles from './index.css?raw';
import { dashboardPageSummaryText } from './test/pageExpectations';
import { createAppQueryClient } from './query/queryClient';
import {
  appBreadcrumbBaseLabel,
  defaultNavigationKey,
  getNavigationLabel,
  navigationItems,
  type AppNavigationKey,
} from './navigation/appNavigation';
import { createGoogleScriptRunApiHandlerMock } from './test/googleScriptRunHarness';

const checkingAuthorisationStatusText = 'Checking authorisation status...';
const applicationTitleText = appBreadcrumbBaseLabel;
const navigationLabels = navigationItems.map(({ label }) => label);
const noBreadcrumbLabelPosition = -1;
const primaryNavigationLabel = 'Primary navigation';
const collapseNavigationButtonLabel = 'Collapse navigation';
const expandNavigationButtonLabel = 'Expand navigation';
const ariaCheckedAttribute = 'aria-checked';
const unableToCheckAuthorisationStatusMessage = 'Unable to check authorisation status right now.';

type ApiResponseEnvelope =
  | {
      ok: true;
      requestId: string;
      data: unknown;
    }
  | {
      ok: false;
      requestId: string;
      error: {
        code: string;
        message: string;
        retriable?: boolean;
      };
    };

type ApiMethodResponse = ApiResponseEnvelope | { transportFailure: unknown } | 'pending';
type ApiMethodResponseMap = Partial<Record<string, ApiMethodResponse>>;

const authStatusMethodName = 'getAuthorisationStatus';
const classPartialsMethodName = 'getABClassPartials';

/**
 * Dispatches a configured mock transport response asynchronously.
 *
 * @param {Exclude<ApiMethodResponse, 'pending'>} response - The mocked transport response to dispatch.
 * @param {((error: unknown) => void) | undefined} failureHandler - The registered failure callback.
 * @param {((payload: unknown) => void) | undefined} successHandler - The registered success callback.
 */
function dispatchMockTransportResponse(
  response: Exclude<ApiMethodResponse, 'pending'>,
  failureHandler: ((error: unknown) => void) | undefined,
  successHandler: ((payload: unknown) => void) | undefined
) {
  queueMicrotask(() => {
    if ('transportFailure' in response) {
      failureHandler?.(response.transportFailure);
      return;
    }

    successHandler?.(response);
  });
}

/**
 * Installs a `google.script.run.apiHandler` mock for app-level tests.
 *
 * @param {ApiMethodResponseMap} responsesByMethod - The mocked responses keyed by API method.
 * @returns {{ getCallCount(method: string): number }} A transport harness that exposes per-method call counts.
 */
function installApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
  const methodCallCounts = new Map<string, number>();

  const runMock = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
    const { failureHandler, successHandler } = callbacks;

    const method = (request as { method?: unknown })?.method;

    if (typeof method !== 'string') {
      dispatchMockTransportResponse(
        { transportFailure: new Error('Invalid transport request payload.') },
        failureHandler,
        successHandler
      );
      return;
    }

    methodCallCounts.set(method, (methodCallCounts.get(method) ?? 0) + 1);
    const response = responsesByMethod[method];

    if (response === undefined) {
      dispatchMockTransportResponse(
        { transportFailure: new Error(`No mocked response configured for method: ${method}`) },
        failureHandler,
        successHandler
      );
      return;
    }

    if (response === 'pending') {
      return;
    }

    dispatchMockTransportResponse(response, failureHandler, successHandler);
  });

  (globalThis as { google?: unknown }).google = {
    script: {
      run: runMock,
    },
  };

  return {
    getCallCount(method: string) {
      return methodCallCounts.get(method) ?? 0;
    },
  };
}

/**
 * Installs a `google.script.run.apiHandler` mock that leaves auth status pending.
 *
 * @returns {{ getCallCount(method: string): number }} A transport harness that exposes per-method call counts.
 */
function installPendingApiHandlerMock() {
  return installApiHandlerMock({
    [authStatusMethodName]: 'pending',
  });
}

/**
 * Renders the app through the auth gate with a supplied or fresh query client.
 *
 * @param {ReturnType<typeof createAppQueryClient>} queryClient - The query client to use for rendering.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderApp(queryClient = createAppQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppAuthGate>
        <App />
      </AppAuthGate>
    </QueryClientProvider>
  );
}

/**
 * Renders the app while keeping the pending auth state stable for layout-only assertions.
 *
 * @returns {Promise<void>} A promise that resolves after the pending render has settled.
 */
async function renderPendingApp() {
  await act(async () => {
    renderApp();
  });
}

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

/**
 * Returns the theme mode switch once it is rendered.
 *
 * @returns {HTMLElement} The theme mode switch locator.
 */
function getThemeModeSwitch() {
  return screen.getByRole('switch', { name: 'Dark mode' });
}

describe('App', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
  });

  it('menu renders all four entries in expanded mode with expected labels', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const label of navigationLabels) {
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

    expect(menuItems).toHaveLength(navigationLabels.length);

    for (const item of menuItems) {
      expect(item.querySelector('.app-navigation-icon')).not.toBeNull();
    }
  });

  it('clicking each menu item updates selected key in component state', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    let previousLabel: string | undefined;

    for (const label of navigationLabels) {
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
    const classesLabel = getNavigationLabel('classes');

    act(() => {
      fireEvent.click(within(navigation).getByRole('menuitem', { name: classesLabel }));
    });

    expectBreadcrumbLabels([appBreadcrumbBaseLabel, classesLabel]);
  });

  it('breadcrumb labels are sourced from shared metadata (single source of truth)', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    for (const { key } of navigationItems) {
      const label = getNavigationLabel(key);

      act(() => {
        fireEvent.click(within(navigation).getByRole('menuitem', { name: label }));
      });

      expectBreadcrumbLabels([appBreadcrumbBaseLabel, label]);
    }
  });

  it('no stale breadcrumb state after rapid page switching', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });
    const rapidSelectionKeys: AppNavigationKey[] = ['classes', 'assignments', 'settings'];

    act(() => {
      for (const key of rapidSelectionKeys) {
        const menuItem = within(navigation).getByRole('menuitem', {
          name: getNavigationLabel(key),
        });

        fireEvent.click(menuItem);
      }
    });

    const breadcrumb = getBreadcrumbElement();

    expectBreadcrumbLabels([appBreadcrumbBaseLabel, getNavigationLabel('settings')]);
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('classes'));
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('assignments'));
  });

  it('Dashboard default selection renders expected default page content', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const mainRegion = screen.getByRole('main');

    expect(
      within(mainRegion).getByRole('heading', { level: 2, name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(within(mainRegion).getByText(dashboardPageSummaryText)).toBeInTheDocument();
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

  it('does not regress existing auth card mounting path', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const mainRegion = screen.getByRole('main');

    expect(within(mainRegion).getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
  });

  it('toggle control renders with accessible label', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    expect(getThemeModeSwitch()).toBeInTheDocument();
  });

  it('toggle callback flips theme state between light and dark', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

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

  it('ConfigProvider receives expected algorithm when state changes', async () => {
    // Keep the auth hook pending so the entrypoint render stays focused on theme wiring.
    installPendingApiHandlerMock();

    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.append(rootElement);

    let renderedTree: ReactNode | undefined;

    vi.doMock('react-dom/client', () => ({
      createRoot: () => ({
        render(node: ReactNode) {
          renderedTree = node;
        },
      }),
    }));

    vi.doMock('antd', async () => {
      const actual = await vi.importActual('antd');
      const actualTheme = (actual as { theme: { darkAlgorithm: unknown } }).theme;

      return {
        ...(actual as Record<string, unknown>),
        ConfigProvider({
          children,
          theme: themeConfig,
        }: {
          children: ReactNode;
          theme?: {
            algorithm?: unknown;
          };
        }) {
          return (
            <div
              data-testid="config-provider"
              data-algorithm={
                themeConfig?.algorithm === actualTheme.darkAlgorithm ? 'dark' : 'light'
              }
            >
              {children}
            </div>
          );
        },
      };
    });

    await import('./main');

    if (renderedTree === undefined) {
      throw new Error('Expected main.tsx to render the application tree.');
    }

    render(<>{renderedTree}</>);

    expect(screen.getByTestId('config-provider')).toHaveAttribute('data-algorithm', 'light');

    act(() => {
      fireEvent.click(getThemeModeSwitch());
    });

    expect(screen.getByTestId('config-provider')).toHaveAttribute('data-algorithm', 'dark');
  });

  it('theme toggle state persists during in-app page navigation', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const themeModeSwitch = getThemeModeSwitch();
    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    act(() => {
      fireEvent.click(themeModeSwitch);
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('classes') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
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

  it('shows loading then authorised status when backend returns true', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-1',
        data: true,
      },
      [classPartialsMethodName]: {
        ok: true,
        requestId: 'req-class-partials-1',
        data: [],
      },
    });

    renderApp();

    expect(screen.getByRole('banner')).toHaveTextContent(applicationTitleText);
    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    await waitFor(() => {
      expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
    });
  });

  it('shows unauthorised status when backend returns false', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-2',
        data: false,
      },
    });

    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('shows backend failure message when backend returns a failure envelope', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: false,
        requestId: 'req-3',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Backend authorisation check failed.',
        },
      },
    });

    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByText(unableToCheckAuthorisationStatusMessage)).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('shows string failure message when transport fails with a non-Error value', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        transportFailure: 'Backend call failed with a string.',
      },
    });

    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByText(unableToCheckAuthorisationStatusMessage)).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('shows rate-limited message when backend returns retriable rate limit envelope', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: false,
        requestId: 'req-rl-1',
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited.',
          retriable: true,
        },
      },
    });

    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('The service is busy. Please try again shortly.')
    ).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByText(unableToCheckAuthorisationStatusMessage)).toBeInTheDocument();
  });

  it('does not start class-partials warm-up while auth is unresolved', async () => {
    const transport = installPendingApiHandlerMock();

    renderApp();

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('keeps navigation ready while startup warm-up runs in the background', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-1',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
    });

    renderApp();

    expect(screen.getByRole('navigation', { name: primaryNavigationLabel })).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('keeps startup warm-up idempotent across remounts with the same query client', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-3',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
    });
    const queryClient = createAppQueryClient();

    const firstRender = renderApp(queryClient);

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);

    firstRender.unmount();
    renderApp(queryClient);

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('does not trigger extra class-partials warm-up during in-app navigation', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-4',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
    });

    renderApp();

    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    act(() => {
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('classes') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
      );
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('settings') })
      );
    });

    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('logs one debug event when startup warm-up fails without breaking render', async () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-2',
        data: true,
      },
      [classPartialsMethodName]: {
        transportFailure: new Error('Class partial warm-up failed.'),
      },
    });

    renderApp();

    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    await waitFor(() => {
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
    expect(consoleDebugSpy.mock.calls[0]?.[0]).toBe(
      'features/auth/AppAuthGate.classPartialsWarmup'
    );
  });
});
