import { expect, type Locator, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '@/test/googleScriptRunHarness';
import type { ResponseItem, RuntimeScenario } from './runtimeMockTypes';
export type { ResponseItem, RuntimeScenario } from './runtimeMockTypes';
export type {
  CreateAssignmentsScenarioOptions,
  CreateAuthenticationSettingsScenarioOptions,
  CreateAuthorisationScenarioOptions,
  CreateWizardScenarioOptions,
} from './runtimeMockScenarios';
export {
  AUTHORISATION_WARMUP_METHODS,
  mockCohorts,
  mockCreatedPartialRow,
  mockFullDefinition,
  mockPartialRows,
  mockTopics,
  mockYearGroups,
  createAssignmentsScenario,
  createAuthenticationSettingsScenario,
  createAuthorisationScenario,
  createBackendSettingsScenario,
  createFailedRefreshScenario,
  createShellNavigationScenario,
  createWizardScenario,
} from './runtimeMockScenarios';
// ============================================================================
// Runtime Mock Installation
// ============================================================================

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
 * Global tracking object name for releasing named response signals.
 */
const RELEASE_SIGNAL_FUNCTION = '__releaseRuntimeSignal' as const;

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
  const responseQueues: Record<string, ReadonlyArray<ResponseItem>> = {};
  const allMethods = [
    'hasScriptAuthorisation',
    'getApplicationAccess',
    'getAuthenticationSettings',
    'setAuthenticationSettings',
    'getBackendConfig',
    'setBackendConfig',
    'getABClassPartials',
    'getABClass',
    'upsertABClass',
    'updateABClass',
    'getCohorts',
    'getYearGroups',
    'getAssignmentTopics',
    'getGoogleClassroomAssignments',
    'getGoogleClassrooms',
    'startAssessmentRun',
    'getAssignmentDefinitionPartials',
    'getAssignmentDefinition',
    'getAssignment',
    'upsertAssignmentDefinition',
    'deleteAssignmentDefinition',
  ] as const;

  // Method names are from a known const array - safe to use as keys
  for (const method of allMethods) {
    responseQueues[method] = scenario[method] ?? [];
  }

  // AppAuthGate now performs application-access admission after OAuth. Preserve the
  // existing authorised fixtures by supplying the normal admitted response when a
  // scenario does not need to exercise access states explicitly.
  responseQueues.getApplicationAccess = scenario.getApplicationAccess ?? [
    {
      kind: 'success',
      data: {
        allowed: true,
        role: 'admin',
        email: 'owner@example.com',
        reason: 'ok',
      },
    },
    {
      kind: 'success',
      data: {
        allowed: true,
        role: 'admin',
        email: 'owner@example.com',
        reason: 'ok',
      },
    },
  ];

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

      // The backend apiHandler returns the envelope as a JSON string and real GAS
      // passes it through, so success and error envelopes are serialised here.
      // Handing the harness a raw object would let it drop null properties.
      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.(
          JSON.stringify({
            ok: true,
            requestId: 'req-' + method + '-' + responseIndex,
            data,
          })
        );
      }

      function sendFailureEnvelope(callbacks, method, responseIndex, response) {
        callbacks.successHandler?.(
          JSON.stringify({
            ok: false,
            requestId: 'req-' + method + '-' + responseIndex,
            error: {
              code: response.code ?? 'INTERNAL_ERROR',
              message: response.message,
              isRetriable: false,
            },
          })
        );
      }

      globalThis.${RELEASE_DEFERRED_FUNCTION} = () => {
        const nextDeferredSuccess = globalThis.${deferredQueueTrackerName}.shift();
        if (!nextDeferredSuccess) {
          throw new Error('No deferred success response available to release.');
        }
        nextDeferredSuccess();
      };

      const releasedSignals = new Set();
      const releaseResolvers = new Map();

      function waitForReleaseSignal(signal) {
        if (signal === undefined || releasedSignals.has(signal)) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          const resolvers = releaseResolvers.get(signal) ?? new Set();
          resolvers.add(resolve);
          releaseResolvers.set(signal, resolvers);
        });
      }

      // React StrictMode can register more than one waiter for the same signal,
      // so release every resolver registered for it.
      globalThis.${RELEASE_SIGNAL_FUNCTION} = (signal) => {
        releasedSignals.add(signal);
        const resolvers = releaseResolvers.get(signal);

        if (resolvers === undefined) {
          return;
        }

        releaseResolvers.delete(signal);
        for (const resolve of resolvers) {
          resolve();
        }
      };

      function deliverResponse(callbacks, method, responseIndex, response) {
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

        if (response.kind === 'deferredFailure') {
          globalThis.${deferredQueueTrackerName}.push(() => {
            sendFailureEnvelope(callbacks, method, responseIndex, response);
          });
          return;
        }

        sendSuccess(callbacks, method, responseIndex, response.data);
      }

      function deliverResponseAfterHold(callbacks, method, responseIndex, response) {
        if (response.delayMs === undefined && response.releaseSignal === undefined) {
          deliverResponse(callbacks, method, responseIndex, response);
          return;
        }

        void (async () => {
          await waitForReleaseSignal(response.releaseSignal);

          if (response.delayMs !== undefined) {
            await new Promise((resolve) => {
              setTimeout(resolve, response.delayMs);
            });
          }

          deliverResponse(callbacks, method, responseIndex, response);
        })();
      }

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

            deliverResponseAfterHold(callbacks, method, responseIndex, response);
          }),
        },
      };
    })();
  `);
}

/**
 * Releases the next deferred response in the queue, whatever its kind.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} releaseFunctionName Name for the release function (default: '__releaseNextDeferredSuccess').
 * @returns {Promise<void>} Resolves once the deferred response has been released.
 */
export async function releaseNextDeferredSuccess(
  page: Page,
  releaseFunctionName: string = RELEASE_DEFERRED_FUNCTION
): Promise<void> {
  await page.waitForFunction(
    (queueName) => {
      const queue = Reflect.get(globalThis, queueName);
      return Array.isArray(queue) && queue.length > 0;
    },
    DEFERRED_SUCCESS_QUEUE,
    { timeout: 5000 }
  );

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
 * Releases a named runtime response signal, including every waiter registered for it.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} signal The signal name to release.
 * @param {string} releaseFunctionName Name for the release function (default: '__releaseRuntimeSignal').
 * @returns {Promise<void>} Resolves once the signal has been released.
 */
export async function releaseRuntimeSignal(
  page: Page,
  signal: string,
  releaseFunctionName: string = RELEASE_SIGNAL_FUNCTION
): Promise<void> {
  await page.evaluate(
    (payload) => {
      const releaseFunction = Reflect.get(globalThis, payload.releaseFunctionName);

      if (typeof releaseFunction !== 'function') {
        throw new TypeError(
          'No release function named ' + payload.releaseFunctionName + ' is available.'
        );
      }

      releaseFunction(payload.signal);
    },
    { releaseFunctionName, signal }
  );
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

// ============================================================================
// Filter Interaction Helpers
// ============================================================================

/**
 * Applies one column filter option using visible controls only.
 *
 * @param {Page} page Playwright page instance.
 * @param {Locator | string | RegExp} columnHeader The column header to filter — a `Locator` (for scoped/anonymous-name headers) or a `string`/`RegExp` name.
 * @param {string | RegExp} optionLabel Visible filter option label.
 * @returns {Promise<void>} Resolves when the option is selected.
 */
export async function applyColumnFilterOption(
  page: Page,
  columnHeader: Locator | string | RegExp,
  optionLabel: string | RegExp
): Promise<void> {
  const headerLocator =
    typeof columnHeader === 'string' || columnHeader instanceof RegExp
      ? page.getByRole('columnheader', { name: columnHeader })
      : columnHeader;
  await headerLocator.getByRole('button').click();

  const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
  await expect(activeFilterPopup).toBeVisible();
  await activeFilterPopup.getByText(optionLabel, { exact: true }).click();

  await page.keyboard.press('Escape');
}

/**
 * Selects one visible Ant Design select option from the active dropdown overlay.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} optionName The visible option label to choose.
 * @param {number} occurrence Which matching option to select (default: 0).
 * @returns {Promise<void>} Resolves once the option is selected.
 */
export async function selectVisibleOption(
  page: Page,
  optionName: string,
  occurrence = 0
): Promise<void> {
  // antd v6 dropdown options render as `.ant-select-item-option-content` inside
  // the visible dropdown. Scope to the visible (non-hidden) dropdown so we
  // don't pick up stale closed dropdowns that may still be in the DOM.
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(optionName, { exact: true })
    .nth(occurrence)
    .click();
}

// ============================================================================
// Table Interaction Helpers
// ============================================================================

/**
 * Locates one assignments table row by exact title cell text.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} assignmentTitle Exact assignment title shown in the first column.
 * @returns {import('@playwright/test').Locator} Row locator scoped to the assignments table.
 */
export function getAssignmentsRowByTitle(
  page: Page,
  assignmentTitle: string
): ReturnType<typeof page.getByRole> {
  const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
  const titleCell = assignmentsTable
    .locator('tbody tr td:first-child')
    .getByText(assignmentTitle, { exact: true });

  return titleCell.locator('xpath=ancestor::tr');
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigates to the Assignments page from the root.
 *
 * @param {Page} page Playwright page instance.
 * @returns {Promise<void>} Resolves when navigation is complete.
 */
export async function navigateToAssignmentsPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
}

/**
 * Default timeout for waiting for page ready state in milliseconds.
 */
const DEFAULT_PAGE_READY_TIMEOUT = 10_000;

/**
 * Waits for the assignments page to be ready (blocking state cleared, loading finished).
 *
 * @param {Page} page Playwright page instance.
 * @param {object} options Wait options.
 * @param {number} options.timeout Timeout in milliseconds (default: DEFAULT_PAGE_READY_TIMEOUT).
 * @returns {Promise<void>} Resolves when page is ready.
 */
export async function waitForAssignmentsPageReady(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_PAGE_READY_TIMEOUT } = options;

  await expect(
    page.getByText('Assignment definitions could not be trusted or loaded.')
  ).toHaveCount(0, { timeout });
  await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);
}
