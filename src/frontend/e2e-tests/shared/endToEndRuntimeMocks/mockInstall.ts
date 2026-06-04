import { type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../../../src/test/googleScriptRunHarness';
import type { ResponseItem, RuntimeScenario } from './types';

/**
 * Global tracking object name for method calls.
 */
const METHOD_CALLS_TRACKER = '__methodCalls' as const;

/**
 * Global tracking object name for deferred success queues.
 */
const DEFERRED_SUCCESS_QUEUE = '__deferredSuccessQueue' as const;

/**
 * Global tracking object name for releasing deferred success.
 */
const RELEASE_DEFERRED_FUNCTION = '__releaseNextDeferredSuccess' as const;

/**
 * Installs a browser-side `google.script.run` mock for E2E tests.
 *
 * @param {Page} page The Playwright page under test.
 * @param {RuntimeScenario} scenario The per-method response queue scenario.
 * @param {object} options Installation options.
 * @param {string} options.methodCallsTrackerName Name for the method calls tracker (default: '__methodCalls').
 * @param {string} options.deferredQueueTrackerName Name for the deferred queue tracker (default: '__deferredSuccessQueue').
 * @returns {Promise<void>} Resolves once the init script is installed.
 */
export async function installRuntimeMock(
  page: Page,
  scenario: RuntimeScenario,
  options: {
    methodCallsTrackerName?: string;
    deferredQueueTrackerName?: string;
  } = {}
): Promise<void> {
  const {
    methodCallsTrackerName = METHOD_CALLS_TRACKER,
    deferredQueueTrackerName = DEFERRED_SUCCESS_QUEUE,
  } = options;

  // Build the response queues from the scenario
  const responseQueues: Record<string, ResponseItem[]> = {};
  const allMethods = [
    'getAuthorisationStatus',
    'getABClassPartials',
    'getCohorts',
    'getYearGroups',
    'getAssignmentTopics',
    'getGoogleClassroomAssignments',
    'getGoogleClassrooms',
    'getAssignmentDefinitionPartials',
    'getAssignmentDefinition',
    'upsertAssignmentDefinition',
    'deleteAssignmentDefinition',
  ] as const;

  // Method names are from a known const array - safe to use as keys
  for (const method of allMethods) {
    // eslint-disable-next-line security/detect-object-injection
    responseQueues[method] = scenario[method] ?? [];
  }

  // Build the call counts object
  const callCountsEntries = allMethods.map((method) => `${method}: 0`).join(', ');

  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};
      const responseQueues = ${JSON.stringify(responseQueues)};
      const callCounts = { ${callCountsEntries} };
      
      globalThis.${methodCallsTrackerName} = [];
      globalThis.${deferredQueueTrackerName} = [];

      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-' + method + '-' + responseIndex,
          data,
        });
      }

      function sendFailureEnvelope(callbacks, method, responseIndex, response) {
        callbacks.successHandler?.({
          ok: false,
          requestId: 'req-' + method + '-' + responseIndex,
          error: {
            code: response.code ?? 'INTERNAL_ERROR',
            message: response.message,
            retriable: false,
          },
        });
      }

      globalThis.${RELEASE_DEFERRED_FUNCTION} = () => {
        const nextDeferredSuccess = globalThis.${deferredQueueTrackerName}.shift();
        if (!nextDeferredSuccess) {
          throw new Error('No deferred success response available to release.');
        }
        nextDeferredSuccess();
      };

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;
            globalThis.${methodCallsTrackerName}.push(String(method));

            if (!(method in responseQueues)) {
              callbacks.failureHandler?.(new Error('Unexpected call to method: ' + String(method)));
              return;
            }

            const responseIndex = callCounts[method];
            const response = responseQueues[method][responseIndex];
            callCounts[method] += 1;

            if (response === undefined) {
              callbacks.failureHandler?.(
                new Error('Unexpected call index for method ' + method + ': ' + String(responseIndex))
              );
              return;
            }

            if (response.kind === 'transportFailure') {
              callbacks.failureHandler?.(new Error(response.message));
              return;
            }

            if (response.kind === 'failureEnvelope') {
              sendFailureEnvelope(callbacks, method, responseIndex, response);
              return;
            }

            if (response.kind === 'deferredSuccess') {
              globalThis.${deferredQueueTrackerName}.push(() => {
                sendSuccess(callbacks, method, responseIndex, response.data);
              });
              return;
            }

            sendSuccess(callbacks, method, responseIndex, response.data);
          }),
        },
      };
    })();
  `);
}

/**
 * Releases the next deferred success response in the queue.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} releaseFunctionName Name for the release function (default: '__releaseNextDeferredSuccess').
 * @returns {Promise<void>} Resolves once the deferred response has been released.
 */
export async function releaseNextDeferredSuccess(
  page: Page,
  releaseFunctionName: string = RELEASE_DEFERRED_FUNCTION
): Promise<void> {
  await page.evaluate((currentReleaseFunctionName) => {
    const releaseFunction = Reflect.get(globalThis, currentReleaseFunctionName);

    if (typeof releaseFunction !== 'function') {
      throw new TypeError(
        'No release function named ' + currentReleaseFunctionName + ' is available.'
      );
    }

    releaseFunction();
  }, releaseFunctionName);
}

/**
 * Gets the method calls made during the test.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} trackerName Name for the method calls tracker (default: '__methodCalls').
 * @returns {Promise<string[]>} Array of method call names.
 */
export async function getMethodCalls(
  page: Page,
  trackerName: string = METHOD_CALLS_TRACKER
): Promise<string[]> {
  return await page.evaluate((currentTrackerName) => {
    const methodCalls = Reflect.get(globalThis, currentTrackerName);

    return Array.isArray(methodCalls) ? methodCalls : [];
  }, trackerName);
}
