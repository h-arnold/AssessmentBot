import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import {
  defaultNavigationKey,
  navigationItems,
  type AppNavigationKey,
} from './navigation/appNavigation';

const checkingAuthorisationStatusText = 'Checking authorisation status...';
const applicationTitleText = 'AssessmentBot Frontend';
const navigationLabels = navigationItems.map(({ label }) => label);

type ApiResponseEnvelope =
  | {
      ok: true;
      requestId: string;
      data: boolean;
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

/**
 * Installs a `google.script.run.apiHandler` mock for app-level tests.
 */
function installApiHandlerMock(response: ApiResponseEnvelope | { transportFailure: unknown }) {
  let successHandler: ((payload: unknown) => void) | undefined;
  let failureHandler: ((error: unknown) => void) | undefined;

  const runMock = {
    withSuccessHandler(handler: (payload: unknown) => void) {
      successHandler = handler;
      return runMock;
    },
    withFailureHandler(handler: (error: unknown) => void) {
      failureHandler = handler;
      return runMock;
    },
    apiHandler(request: unknown) {
      queueMicrotask(() => {
        if (typeof (request as { method?: unknown })?.method !== 'string') {
          failureHandler?.(new Error('Invalid transport request payload.'));
          return;
        }

        if ('transportFailure' in response) {
          failureHandler?.(response.transportFailure);
          return;
        }

        successHandler?.(response);
      });
    },
  };

  (globalThis as { google?: unknown }).google = {
    script: {
      run: runMock,
    },
  };
}

/**
 * Installs a `google.script.run.apiHandler` mock that leaves auth status pending.
 */
function installPendingApiHandlerMock() {
  const runMock = {
    withSuccessHandler() {
      return runMock;
    },
    withFailureHandler() {
      return runMock;
    },
    apiHandler() {},
  };

  (globalThis as { google?: unknown }).google = {
    script: {
      run: runMock,
    },
  };
}

/**
 * Renders the app while keeping the pending auth state stable for layout-only assertions.
 */
async function renderPendingApp() {
  await act(async () => {
    render(<App />);
  });
}

/**
 * Looks up the shared label for a navigation key.
 */
function getNavigationLabel(key: AppNavigationKey) {
  const navigationItem = navigationItems.find(
    ({ key: navigationKey }) => navigationKey === key
  );

  if (navigationItem === undefined) {
    throw new TypeError(`Unknown navigation key: ${key}`);
  }

  return navigationItem.label;
}

const breadcrumbNavigationName = 'Breadcrumb';

/**
 * Returns the rendered breadcrumb landmark.
 */
function getBreadcrumbElement() {
  return screen.getByRole('navigation', { name: breadcrumbNavigationName });
}

/**
 * Asserts breadcrumb labels while keeping expectations scoped to the breadcrumb itself.
 */
function expectBreadcrumbLabels(labels: string[]) {
  const breadcrumb = getBreadcrumbElement();
  const breadcrumbText = breadcrumb.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';

  for (const label of labels) {
    expect(breadcrumb).toHaveTextContent(label);
  }

  let previousPosition = -1;

  for (const label of labels) {
    const labelPosition = breadcrumbText.indexOf(label);

    expect(labelPosition).toBeGreaterThan(previousPosition);
    previousPosition = labelPosition;
  }
}

describe('App', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
  });

  it('menu renders all four entries in expanded mode with expected labels', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

    for (const label of navigationLabels) {
      expect(within(navigation).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('menu renders icon-only affordance in collapsed mode', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    });

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    const menuItems = within(navigation).getAllByRole('menuitem');

    expect(menuItems).toHaveLength(navigationLabels.length);

    for (const item of menuItems) {
      expect(within(item).getByRole('img')).toBeInTheDocument();
    }
  });

  it('clicking each menu item updates selected key in component state', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

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

    expectBreadcrumbLabels([getNavigationLabel(defaultNavigationKey)]);
  });

  it('changing selected page updates breadcrumb text immediately', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    const classesLabel = getNavigationLabel('classes');

    act(() => {
      fireEvent.click(within(navigation).getByRole('menuitem', { name: classesLabel }));
    });

    expectBreadcrumbLabels([classesLabel]);
  });

  it('breadcrumb labels are sourced from shared metadata (single source of truth)', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

    for (const { key } of navigationItems) {
      const label = getNavigationLabel(key);

      act(() => {
        fireEvent.click(within(navigation).getByRole('menuitem', { name: label }));
      });

      expectBreadcrumbLabels([label]);
    }
  });

  it('no stale breadcrumb state after rapid page switching', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
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

    expectBreadcrumbLabels([getNavigationLabel('settings')]);
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('classes'));
    expect(breadcrumb).not.toHaveTextContent(getNavigationLabel('assignments'));
  });

  it('renders shell landmarks', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    expect(screen.getByRole('banner')).toHaveTextContent(applicationTitleText);
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('toggles collapsed state via hamburger', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const toggleButton = screen.getByRole('button', { name: 'Collapse navigation' });

    act(() => {
      fireEvent.click(toggleButton);
    });
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    });
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
  });

  it('updates accessible control label and state when toggled', async () => {
    installPendingApiHandlerMock();

    await renderPendingApp();

    const toggleButton = screen.getByRole('button', { name: 'Collapse navigation' });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      fireEvent.click(toggleButton);
    });
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute(
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

  it('shows loading then authorised status when backend returns true', async () => {
    installApiHandlerMock({
      ok: true,
      requestId: 'req-1',
      data: true,
    });

    render(<App />);

    expect(screen.getByText('AssessmentBot Frontend')).toBeInTheDocument();
    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
  });

  it('shows unauthorised status when backend returns false', async () => {
    installApiHandlerMock({
      ok: true,
      requestId: 'req-2',
      data: false,
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
  });

  it('shows backend failure message when backend returns a failure envelope', async () => {
    installApiHandlerMock({
      ok: false,
      requestId: 'req-3',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Backend authorisation check failed.',
      },
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });

  it('shows string failure message when transport fails with a non-Error value', async () => {
    installApiHandlerMock({
      transportFailure: 'Backend call failed with a string.',
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });

  it('shows rate-limited message when backend returns retriable rate limit envelope', async () => {
    installApiHandlerMock({
      ok: false,
      requestId: 'req-rl-1',
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limited.',
        retriable: true,
      },
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('The service is busy. Please try again shortly.')
    ).toBeInTheDocument();
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });
});
