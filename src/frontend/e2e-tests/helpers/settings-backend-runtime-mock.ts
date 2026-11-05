import type { Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '@/test/googleScriptRunHarness';

/**
 * One queued response for a backend settings transport method.
 *
 * `delayMs` holds the response for a fixed time; `releaseSignal` holds it until
 * the journey releases the matching browser-side signal.
 */
export type BackendApiResponseScenario = Readonly<
  | {
      kind: 'success';
      data: unknown;
      delayMs?: number;
      releaseSignal?: string;
    }
  | {
      kind: 'transportFailure';
      message: string;
      delayMs?: number;
      releaseSignal?: string;
    }
  | {
      kind: 'failureEnvelope';
      code?: string;
      message: string;
      delayMs?: number;
      releaseSignal?: string;
    }
>;

/** Ordered read and write queues for the backend settings transport methods. */
export type BackendSettingsRuntimeScenario = Readonly<{
  getBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
  setBackendConfig: ReadonlyArray<BackendApiResponseScenario>;
}>;

/**
 * Installs a browser-side `google.script.run` mock for the backend settings feature.
 *
 * @param {Page} page The Playwright page under test.
 * @param {BackendSettingsRuntimeScenario} scenario The read and write scenarios to simulate.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
export async function mockBackendSettingsRuntime(
  page: Page,
  scenario: BackendSettingsRuntimeScenario
): Promise<void> {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const mockScenario = ${JSON.stringify(scenario)};
      const callCounts = {
        getBackendConfig: 0,
        setBackendConfig: 0,
      };
      const responseQueues = {
        getBackendConfig: mockScenario.getBackendConfig,
        setBackendConfig: mockScenario.setBackendConfig,
      };
      const releasedSignals = new Set();
      const releaseResolvers = new Map();

      function isBackendSettingsTransportRequest(request) {
        return (
          typeof request === 'object' &&
          request !== null &&
          typeof request.method === 'string'
        );
      }

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          // The backend apiHandler returns the envelope as a JSON string and real GAS
          // passes it through, so fixtures keep their explicit null properties.
          handler(JSON.stringify({ ok: true, requestId, data }));
        }
      }

      function sendFailureEnvelope(handler, requestId, code, message) {
        if (handler !== undefined) {
          handler(
            JSON.stringify({
              ok: false,
              requestId,
              error: {
                code,
                message,
                isRetriable: false,
              },
            })
          );
        }
      }

      function waitForReleaseSignal(signal) {
        if (signal === undefined || releasedSignals.has(signal)) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          releaseResolvers.set(signal, resolve);
        });
      }

      globalThis.__releaseBackendSettingsSignal = (signal) => {
        releasedSignals.add(signal);
        const resolve = releaseResolvers.get(signal);

        if (resolve !== undefined) {
          releaseResolvers.delete(signal);
          resolve();
        }
      };

      function handleStaticMethod(method, handler) {
        if (method === 'hasScriptAuthorisation') {
          sendSuccess(handler, true, 'req-auth-status');
          return true;
        }

        if (method === 'getApplicationAccess') {
          sendSuccess(
            handler,
            { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
            'req-application-access'
          );
          return true;
        }

        if (method === 'getABClassPartials') {
          sendSuccess(handler, [], 'req-class-partials');
          return true;
        }

        if (
          method === 'getCohorts' ||
          method === 'getYearGroups' ||
          method === 'getAssignmentTopics' ||
          method === 'getAssignmentDefinitionPartials'
        ) {
          sendSuccess(handler, [], 'req-' + method);
          return true;
        }

        return false;
      }

      function handleBackendSettingsResponse(method, responseIndex, callbacks) {
        const responseQueue = responseQueues[method];
        const response = responseQueue[responseIndex];

        if (response === undefined) {
          return;
        }

        void (async () => {
          await waitForReleaseSignal(response.releaseSignal);

          if (response.delayMs !== undefined) {
            await new Promise((resolve) => {
              setTimeout(resolve, response.delayMs);
            });
          }

          if (response.kind === 'transportFailure') {
            callbacks.failureHandler?.(new Error(response.message));
            return;
          }

          if (response.kind === 'failureEnvelope') {
            sendFailureEnvelope(
              callbacks.successHandler,
              \`req-\${method}-\${responseIndex}\`,
              response.code ?? 'INTERNAL_ERROR',
              response.message
            );
            return;
          }

          sendSuccess(callbacks.successHandler, response.data, \`req-\${method}-\${responseIndex}\`);
        })();
      }

      const run = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
        if (!isBackendSettingsTransportRequest(request)) {
          callbacks.failureHandler?.(new Error('Invalid transport request payload.'));
          return;
        }

        const method = request.method;

        if (handleStaticMethod(method, callbacks.successHandler)) {
          return;
        }

        if (method !== 'getBackendConfig' && method !== 'setBackendConfig') {
          return;
        }

        const responseIndex = callCounts[method];
        callCounts[method] = responseIndex + 1;
        handleBackendSettingsResponse(method, responseIndex, callbacks);
      });

      globalThis.google = {
        script: {
          run,
        },
      };
    })();
  `);
}
