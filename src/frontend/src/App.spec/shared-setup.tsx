/**
 * Shared setup and assertion helpers for App tests.
 */

/* eslint-disable react-refresh/only-export-components -- Test helper file, not a component file */
/* eslint-disable no-restricted-imports -- Shared setup for spec files */

import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppAuthGate } from '../features/auth/AppAuthGate';
import App from '../App';
import { createGoogleScriptRunApiHandlerMock } from '../test/googleScriptRunHarness';
import { createAppQueryClient } from '../query/queryClient';




// Re-export for use by individual spec files



export const loadingAuthorisationStatusLabel = 'Loading authorisation status';

export const expectedNavigationLabels = ['Dashboard', 'Assignments', 'Classes', 'Settings'] as const;
export const noBreadcrumbLabelPosition = -1;
export const primaryNavigationLabel = 'Primary navigation';
export const collapseNavigationButtonLabel = 'Collapse navigation';
export const expandNavigationButtonLabel = 'Expand navigation';
export const ariaCheckedAttribute = 'aria-checked';
export const unableToCheckAuthorisationStatusMessage = 'Unable to check authorisation status right now.';

const breadcrumbNavigationName = 'Breadcrumb';

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

export const authStatusMethodName = 'getAuthorisationStatus';
export const classPartialsMethodName = 'getABClassPartials';
export const assignmentTopicsMethodName = 'getAssignmentTopics';
export const assignmentDefinitionPartialsMethodName = 'getAssignmentDefinitionPartials';
export const cohortsMethodName = 'getCohorts';
export const yearGroupsMethodName = 'getYearGroups';
export const googleClassroomsMethodName = 'getGoogleClassrooms';

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
export function installApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
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
    // eslint-disable-next-line security/detect-object-injection -- Dynamic method access from a Map-based response config
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
 * Installs a `google.script.run.apiHandler` mock that leaves all startup warmup
 * queries pending, including auth status, class partials, assignment topics,
 * assignment definition partials, cohorts, year groups, and Google Classrooms.
 *
 * @returns {{ getCallCount(method: string): number }} A transport harness that exposes per-method call counts.
 */
export function installPendingApiHandlerMock() {
  return installApiHandlerMock({
    [authStatusMethodName]: 'pending',
    [classPartialsMethodName]: 'pending',
    [assignmentTopicsMethodName]: 'pending',
    [assignmentDefinitionPartialsMethodName]: 'pending',
    [cohortsMethodName]: 'pending',
    [yearGroupsMethodName]: 'pending',
    [googleClassroomsMethodName]: 'pending',
  });
}

/**
 * Renders the app through the auth gate with a supplied or fresh query client.
 *
 * @param {ReturnType<typeof createAppQueryClient>} queryClient - The query client to use for rendering.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
export function renderApp(queryClient = createAppQueryClient()) {
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
export async function renderPendingApp() {
  await act(async () => {
    renderApp();
  });
}

/**
 * Returns the rendered breadcrumb landmark.
 *
 * @returns {HTMLElement} The breadcrumb navigation landmark.
 */
export function getBreadcrumbElement() {
  return screen.getByRole('navigation', { name: breadcrumbNavigationName });
}

/**
 * Asserts breadcrumb labels while keeping expectations scoped to the breadcrumb itself.
 *
 * @param {string[]} labels - The breadcrumb labels that should be visible.
 */
export function expectBreadcrumbLabels(labels: string[]) {
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
export function getThemeModeSwitch() {
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
export async function expectUnauthorisedOutcome(
  transport: { getCallCount(method: string): number } | null,
  options: { expectedMessage?: string } = {}
) {
  expect(screen.getByRole('status', { name: loadingAuthorisationStatusLabel })).toBeInTheDocument();
  expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();

  if (options.expectedMessage !== undefined) {
    expect(await screen.findByText(options.expectedMessage)).toBeInTheDocument();
  }

  if (transport !== null) {
    expect(transport.getCallCount(classPartialsMethodName)).toBe(0);
  }
}

export {defaultNavigationKey, getNavigationLabel, type AppNavigationKey, appBreadcrumbBaseLabel, appBreadcrumbBaseLabel as applicationTitleText} from '../navigation/appNavigation';
export {pageContent} from '../pages/pageContent';