import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { vi } from 'vitest';
import App from '@/App/App';
import { AppAuthGate } from '@/features/auth/AppAuthGate/AppAuthGate';
import { createAppQueryClient } from '@/query/queryClient';
import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandlerCallbacks,
} from '../googleScriptRunHarness';

export const loadingAuthorisationStatusLabel = 'Loading authorisation status';
export const primaryNavigationLabel = 'Primary navigation';
export const collapseNavigationButtonLabel = 'Collapse navigation';
export const expandNavigationButtonLabel = 'Expand navigation';

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
        isRetriable?: boolean;
      };
    };

type ApiMethodResponse = ApiResponseEnvelope | 'pending' | { transportFailure: unknown };
type ApiMethodResponseMap = Partial<Record<string, ApiMethodResponse>>;

export const authStatusMethodName = 'hasScriptAuthorisation';
export const applicationAccessMethodName = 'getApplicationAccess';
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

  vi.stubGlobal('google', {
    script: {
      run: runMock,
    },
  });

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
export function installApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
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
export function buildResolvedWarmupResponses(requestIdSuffix: string): ApiMethodResponseMap {
  return {
    [authStatusMethodName]: {
      ok: true,
      requestId: `req-auth-${requestIdSuffix}`,
      data: true,
    },
    [applicationAccessMethodName]: {
      ok: true,
      requestId: `req-app-access-${requestIdSuffix}`,
      data: {
        allowed: true,
        role: 'admin',
        email: 'owner@example.com',
        reason: 'ok',
      },
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
export function installResolvedWarmupApiHandlerMock() {
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
export function installDeferredApiHandlerMock(responsesByMethod: ApiMethodResponseMap) {
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
export function renderApp(queryClient = createAppQueryClient()) {
  const gatedApp = createElement(AppAuthGate, null, createElement(App));
  return render(createElement(QueryClientProvider, { client: queryClient }, gatedApp));
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
export async function renderReadyApp() {
  await act(() => {
    renderApp();
  });
  await screen.findByRole('navigation', { name: primaryNavigationLabel });
}
