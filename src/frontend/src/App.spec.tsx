import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { AppAuthGate } from './features/auth/AppAuthGate';
import appStyles from './index.css?raw';
import { pageContent } from './pages/pageContent';
import { createAppQueryClient } from './query/queryClient';
import {
  appBreadcrumbBaseLabel,
  defaultNavigationKey,
  getBreadcrumbItems,
  getNavigationLabel,
  type AppNavigationKey,
} from './navigation/appNavigation';
import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandlerCallbacks,
} from './test/googleScriptRunHarness';

const loadingAuthorisationStatusLabel = 'Loading authorisation status';
const applicationTitleText = appBreadcrumbBaseLabel;
const expectedNavigationLabels = ['Dashboard', 'Assignments', 'Classes', 'Settings'] as const;
const noBreadcrumbLabelPosition = -1;
const primaryNavigationLabel = 'Primary navigation';
const collapseNavigationButtonLabel = 'Collapse navigation';
const expandNavigationButtonLabel = 'Expand navigation';
const ariaCheckedAttribute = 'aria-checked';
const unableToCheckAuthorisationStatusMessage = 'An error occurred. Please try again.';

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
const assignmentTopicsMethodName = 'getAssignmentTopics';
const assignmentDefinitionPartialsMethodName = 'getAssignmentDefinitionPartials';
const cohortsMethodName = 'getCohorts';
const yearGroupsMethodName = 'getYearGroups';
const googleClassroomsMethodName = 'getGoogleClassrooms';

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
 * Installs the shared `google.script.run.apiHandler` mock core used by both the immediate and
 * deferred installers.
 *
 * The core performs method extraction, per-method call counting, invalid-payload handling,
 * unmocked-method handling, and response dispatch. The only behavioural difference between the
 * two installers is what happens when a configured response is `'pending'`: that is delegated to
 * `onPending` so the immediate installer can drop the request while the deferred installer can
 * stash the callbacks until `release` is invoked.
 *
 * @param {ApiMethodResponseMap} responsesByMethod - The mocked responses keyed by API method.
 * @param {(method: string, callbacks: GoogleScriptRunApiHandlerCallbacks) => void} onPending - Hook invoked when a configured response is `'pending'`.
 * @returns {{ methodCallCounts: Map<string, number>; pendingCallbacksByMethod: Map<string, GoogleScriptRunApiHandlerCallbacks> }} The shared harness state.
 */
function createApiHandlerInstaller(
  responsesByMethod: ApiMethodResponseMap,
  onPending: (method: string, callbacks: GoogleScriptRunApiHandlerCallbacks) => void
) {
  const methodCallCounts = new Map<string, number>();
  const pendingCallbacksByMethod = new Map<string, GoogleScriptRunApiHandlerCallbacks>();

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
      onPending(method, callbacks);
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
    methodCallCounts,
    pendingCallbacksByMethod,
  };
}

/**
 * Installs a `google.script.run.apiHandler` mock for app-level tests.
 *
 * @param {ApiMethodResponseMap} responsesByMethod - The mocked responses keyed by API method.
 * @returns {{ getCallCount(method: string): number }} A transport harness that exposes per-method call counts.
 */
function installApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
  const { methodCallCounts } = createApiHandlerInstaller(responsesByMethod, () => {
    // Pending responses never dispatch: the immediate installer drops them silently.
  });

  return {
    getCallCount(method: string) {
      return methodCallCounts.get(method) ?? 0;
    },
  };
}

/**
 * Builds the resolved warm-up response map used by the startup warm-up tests.
 *
 * Every warm-up dataset resolves with a valid, schema-shaped (empty-array) payload except
 * Google Classrooms, which is intentionally left pending because it is not part of the
 * fail-closed warm-up surface. The `requestId` suffixes mirror the production transport
 * contract so the assertions stay faithful to real responses.
 *
 * @param {string} requestIdSuffix - The suffix appended to every warm-up `requestId`.
 * @returns {ApiMethodResponseMap} The mocked warm-up responses keyed by API method.
 */
function buildResolvedWarmupResponses(requestIdSuffix: string): ApiMethodResponseMap {
  return {
    [authStatusMethodName]: {
      ok: true,
      requestId: `req-auth-${requestIdSuffix}`,
      data: true,
    },
    [classPartialsMethodName]: {
      ok: true,
      requestId: `req-class-partials-${requestIdSuffix}`,
      data: [],
    },
    [assignmentTopicsMethodName]: {
      ok: true,
      requestId: `req-topics-${requestIdSuffix}`,
      data: [],
    },
    [assignmentDefinitionPartialsMethodName]: {
      ok: true,
      requestId: `req-def-partials-${requestIdSuffix}`,
      data: [],
    },
    [cohortsMethodName]: {
      ok: true,
      requestId: `req-cohorts-${requestIdSuffix}`,
      data: [],
    },
    [yearGroupsMethodName]: {
      ok: true,
      requestId: `req-yeargroups-${requestIdSuffix}`,
      data: [],
    },
    [googleClassroomsMethodName]: 'pending',
  };
}

/**
 * Installs a `google.script.run.apiHandler` mock that resolves auth and completes the five
 * startup warm-up datasets with valid, schema-shaped (empty-array) payloads. Google Classrooms
 * is left pending because it is not part of the fail-closed warm-up surface.
 *
 * Under the fail-closed contract the protected shell only renders once every warm-up dataset
 * has succeeded, so the shared plumbing must let the warm-up settle before the children appear.
 *
 * @returns {{ getCallCount(method: string): number }} A transport harness that exposes per-method call counts.
 */
function installResolvedWarmupApiHandlerMock() {
  return installApiHandlerMock(buildResolvedWarmupResponses('resolved-warmup'));
}

/**
 * Installs a `google.script.run.apiHandler` mock that holds the supplied methods pending until
 * `release` is called, at which point the stored success/failure callbacks are invoked.
 *
 * Used to exercise the fail-closed render chain: OAuth authorisation resolves (so the gate is
 * authorised) while the warm-up datasets remain pending, then the warm-up is released so the
 * protected children appear. Pending methods never call their callbacks until released, which
 * keeps the warm-up in its loading phase for the duration of the assertion.
 *
 * @param {ApiMethodResponseMap} responsesByMethod The mocked responses keyed by API method.
 * @returns {{ getCallCount(method: string): number; release(method: string, response: Exclude<ApiMethodResponse, 'pending'>): void }} A transport harness with a release trigger.
 */
function installDeferredApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
  const { methodCallCounts, pendingCallbacksByMethod } = createApiHandlerInstaller(
    responsesByMethod,
    (method, callbacks) => {
      pendingCallbacksByMethod.set(method, callbacks);
    }
  );

  return {
    getCallCount(method: string) {
      return methodCallCounts.get(method) ?? 0;
    },
    release(method: string, response: Exclude<ApiMethodResponse, 'pending'>) {
      const callbacks = pendingCallbacksByMethod.get(method);
      pendingCallbacksByMethod.delete(method);

      if (callbacks) {
        dispatchMockTransportResponse(response, callbacks.failureHandler, callbacks.successHandler);
      }
    },
  };
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
 * Renders the app and waits for the shell to appear after the startup warm-up settles.
 *
 * Under the fail-closed contract the protected shell only renders once every warm-up dataset
 * has succeeded, so settling warm-up is a prerequisite for shell-layout assertions rather than
 * a change to their purpose.
 *
 * @returns {Promise<void>} A promise that resolves after the shell render has settled.
 */
async function renderReadyApp() {
  await act(async () => {
    renderApp();
  });
  await screen.findByRole('navigation', { name: primaryNavigationLabel });
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

/**
 * Asserts the unauthorised auth-gate outcome, including optional explanatory copy.
 *
 * @param {{ getCallCount(method: string): number } | null} transport Transport harness when one is installed.
 * @param {{ expectedMessage?: string }} [options] Optional assertion options.
 * @param {string} [options.expectedMessage] Optional message expected in the unauthorised state.
 * @returns {Promise<void>} Resolves once async auth-state assertions complete.
 */
async function expectUnauthorisedOutcome(
  transport: { getCallCount(method: string): number } | null,
  options: { expectedMessage?: string } = {}
) {
  expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
  if (options.expectedMessage === undefined) {
    expect(await screen.findByText('Permissions required', {}, { timeout: 10_000 })).toBeInTheDocument();
  } else {
    expect(await screen.findByText(options.expectedMessage, {}, { timeout: 10_000 })).toBeInTheDocument();
  }

  if (transport !== null) {
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  }
}

describe('App', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
    document.querySelector('#root')?.remove();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('antd');
    vi.doUnmock('react-dom/client');
    vi.doUnmock('./navigation/appNavigation');
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

    const { AppShell } = await import('./AppShell');

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

    vi.doMock('./navigation/appNavigation', () => ({
      appBreadcrumbBaseLabel: 'AssessmentBot Frontend',
      defaultNavigationKey: 'dashboard',
      getBreadcrumbItems: () => [
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

    const { AppShell } = await import('./AppShell');
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

    expect(within(mainRegion).queryByRole('status', { name: loadingAuthorisationStatusLabel })).not.toBeInTheDocument();
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
    const { AppThemeShell } = await import('./AppThemeShell');

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

  it('shows loading then authorised status when backend returns true', async () => {
    const transport = installDeferredApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-1',
        data: true,
      },
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    renderApp();

    // OAuth status is still resolving: the loading surface is shown.
    expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();

    // OAuth has resolved (authorised) but the warm-up datasets are still pending, so the gate
    // fails closed: the verifying surface is shown and the dashboard remains hidden.
    await screen.findByRole('status', { name: 'Verifying access' });
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();

    // Release every warm-up dataset so the startup warm-up settles to ready.
    await act(async () => {
      transport.release(classPartialsMethodName, {
        ok: true,
        requestId: 'req-class-partials-1',
        data: [],
      });
      transport.release(assignmentTopicsMethodName, {
        ok: true,
        requestId: 'req-topics-1',
        data: [],
      });
      transport.release(assignmentDefinitionPartialsMethodName, {
        ok: true,
        requestId: 'req-def-partials-1',
        data: [],
      });
      transport.release(cohortsMethodName, {
        ok: true,
        requestId: 'req-cohorts-1',
        data: [],
      });
      transport.release(yearGroupsMethodName, {
        ok: true,
        requestId: 'req-yeargroups-1',
        data: [],
      });
    });

    // Warm-up ready: the protected dashboard is revealed.
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
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

    await expectUnauthorisedOutcome(transport);
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
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

    await expectUnauthorisedOutcome(transport, {
      expectedMessage:
        'An internal error occurred. Please try again or contact support if the issue persists.',
    });
  });

  it('shows string failure message when transport fails with a non-Error value', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: {
        transportFailure: 'Backend call failed with a string.',
      },
    });

    renderApp();

    await expectUnauthorisedOutcome(transport, {
      expectedMessage: unableToCheckAuthorisationStatusMessage,
    });
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

    await expectUnauthorisedOutcome(transport, {
      expectedMessage: 'Too many requests. Please wait a moment and try again.',
    });
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    renderApp();

    await expectUnauthorisedOutcome(null, {
      expectedMessage: unableToCheckAuthorisationStatusMessage,
    });
  });

  it('does not start class-partials warm-up while auth is unresolved', async () => {
    const transport = installApiHandlerMock({
      [authStatusMethodName]: 'pending',
      [classPartialsMethodName]: 'pending',
      [assignmentTopicsMethodName]: 'pending',
      [assignmentDefinitionPartialsMethodName]: 'pending',
      [cohortsMethodName]: 'pending',
      [yearGroupsMethodName]: 'pending',
      [googleClassroomsMethodName]: 'pending',
    });

    await act(async () => {
      renderApp();
    });

    expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  });

  it('keeps navigation ready once startup warm-up has settled', async () => {
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('1'));

    renderApp();

    // The fail-closed gate only reveals the shell after the warm-up settles.
    expect(await screen.findByRole('navigation', { name: primaryNavigationLabel })).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
    expect(transport.getCallCount(authStatusMethodName)).toBe(1);
    expect(transport.getCallCount(classPartialsMethodName)).toBe(1);
  });

  it('keeps startup warm-up idempotent across remounts with the same query client', async () => {
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('3'));
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
    const transport = installApiHandlerMock(buildResolvedWarmupResponses('4'));

    renderApp();

    expect(await screen.findByText('Authorised')).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: primaryNavigationLabel });

    act(() => {
      fireEvent.click(
        within(navigation).getByRole('menuitem', { name: getNavigationLabel('assignments') })
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

  it('shows fail-closed error result when startup warm-up fails and logs the failure once', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    installApiHandlerMock({
      [authStatusMethodName]: {
        ok: true,
        requestId: 'req-auth-2',
        data: true,
      },
      [classPartialsMethodName]: {
        transportFailure: new Error('Class partial warm-up failed.'),
      },
      [assignmentTopicsMethodName]: {
        ok: true,
        requestId: 'req-topics-1',
        data: [],
      },
      [assignmentDefinitionPartialsMethodName]: {
        ok: true,
        requestId: 'req-def-partials-1',
        data: [],
      },
      [cohortsMethodName]: {
        ok: true,
        requestId: 'req-cohorts-1',
        data: [],
      },
      [yearGroupsMethodName]: {
        ok: true,
        requestId: 'req-yeargroups-1',
        data: [],
      },
      [googleClassroomsMethodName]: {
        ok: true,
        requestId: 'req-classrooms-1',
        data: [],
      },
    });

    renderApp();

    // A failed warm-up blocks the dashboard with a fail-closed error Result rather than flashing
    // the authorised surface. The failure carries no error code, so the generic copy is shown.
    expect(await screen.findByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Authorised')).not.toBeInTheDocument();

    // The startup warm-up failure is still logged exactly once.
    await waitFor(() => {
      expect(
        consoleErrorSpy.mock.calls.filter(
          (call) => call[0] === 'features/auth/AppAuthGate.startupWarmup'
        )
      ).toHaveLength(1);
    });
  });
});
