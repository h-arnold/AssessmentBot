/**
 * Browser-side `google.script.run` mock installation for the Classes CRUD
 * harness.
 *
 * Owns the transport-mock responsibilities that were extracted verbatim from
 * `classes-crud.shared.ts` when the required class-partial metadata fields
 * joined the fixture bundle: building the init-script transport mock from a
 * `ClassesCrudRuntimeScenario` and releasing queued browser-side signals.
 * Scenario authoring, fixture data, queue padding and navigation remain in
 * `classes-crud.shared.ts`.
 */

import type { Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '@/test/googleScriptRunHarness';
import type { ClassesCrudRuntimeScenario } from '../classes-crud.shared';

/**
 * Installs a browser-side `google.script.run` mock for the Classes CRUD feature.
 *
 * @param {Page} page The Playwright page under test.
 * @param {ClassesCrudRuntimeScenario} scenario The runtime scenario defining backend responses.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
export async function mockClassesCrudRuntime(page: Page, scenario: ClassesCrudRuntimeScenario) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const mockScenario = ${JSON.stringify(scenario)};
      const callCounts = {
      hasScriptAuthorisation: 0,
        getApplicationAccess: 0,
        getABClassPartials: 0,
        getCohorts: 0,
        getYearGroups: 0,
        getAssignmentTopics: 0,
        getAssignmentDefinitionPartials: 0,
        getGoogleClassrooms: 0,
        updateABClass: 0,
        deleteABClass: 0,
        upsertABClass: 0,
        createCohort: 0,
        updateCohort: 0,
        deleteCohort: 0,
        createYearGroup: 0,
        updateYearGroup: 0,
        deleteYearGroup: 0,
      };
      const responseQueues = {
          hasScriptAuthorisation: mockScenario.hasScriptAuthorisation,
         getApplicationAccess: mockScenario.getApplicationAccess ?? [
           { kind: 'success', data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' } },
         ],
        getABClassPartials: mockScenario.getABClassPartials,
        getCohorts: mockScenario.getCohorts,
        getYearGroups: mockScenario.getYearGroups,
        getAssignmentTopics: mockScenario.getAssignmentTopics ?? [{ kind: 'success', data: [] }],
        getAssignmentDefinitionPartials: mockScenario.getAssignmentDefinitionPartials ?? [
          { kind: 'success', data: [] },
        ],
        getGoogleClassrooms: mockScenario.getGoogleClassrooms,
        updateABClass: mockScenario.updateABClass ?? [],
        deleteABClass: mockScenario.deleteABClass ?? [],
        upsertABClass: mockScenario.upsertABClass ?? [],
        createCohort: mockScenario.createCohort ?? [],
        updateCohort: mockScenario.updateCohort ?? [],
        deleteCohort: mockScenario.deleteCohort ?? [],
        createYearGroup: mockScenario.createYearGroup ?? [],
        updateYearGroup: mockScenario.updateYearGroup ?? [],
        deleteYearGroup: mockScenario.deleteYearGroup ?? [],
      };

      function isClassesCrudTransportRequest(request) {
        return typeof request === 'object' && request !== null && typeof request.method === 'string';
      }

      const releasedSignals = new Set();
      const releaseResolvers = new Map();

      function waitForReleaseSignal(signal) {
        if (signal === undefined) {
          return Promise.resolve();
        }

        if (releasedSignals.has(signal)) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          releaseResolvers.set(signal, resolve);
        });
      }

      globalThis.__releaseClassesCrudSignal = (signal) => {
        releasedSignals.add(signal);
        const resolve = releaseResolvers.get(signal);

        if (resolve !== undefined) {
          releaseResolvers.delete(signal);
          resolve();
        }
      };

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          handler({ ok: true, requestId, data });
        }
      }

      function sendFailureEnvelope(handler, requestId, code, message) {
        if (handler !== undefined) {
          handler({
            ok: false,
            requestId,
            error: {
              code,
              message,
               isRetriable: false,
            },
          });
        }
      }

      function handleClassesCrudResponse(method, responseIndex, callbacks) {
        const responseQueue = responseQueues[method];
        const response = responseQueue[responseIndex];

        if (response === undefined) {
          callbacks.failureHandler?.(new Error(\`Unexpected call to \${method} (call index \${responseIndex})\`));
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
        if (!isClassesCrudTransportRequest(request)) {
          callbacks.failureHandler?.(new Error('Invalid transport request payload.'));
          return;
        }

        const method = request.method;

        if (
            method !== 'hasScriptAuthorisation' &&
           method !== 'getApplicationAccess' &&
          method !== 'getABClassPartials' &&
           method !== 'getCohorts' &&
           method !== 'getYearGroups' &&
           method !== 'getAssignmentTopics' &&
           method !== 'getAssignmentDefinitionPartials' &&
           method !== "getGoogleClassrooms" &&
          method !== "updateABClass" &&
          method !== "deleteABClass" &&
          method !== "upsertABClass" &&
          method !== "createCohort" &&
          method !== "updateCohort" &&
          method !== "deleteCohort" &&
          method !== "createYearGroup" &&
          method !== "updateYearGroup" &&
          method !== "deleteYearGroup"
        ) {
          callbacks.failureHandler?.(new Error(\`Unsupported method: \${method}\`));
          return;
        }

        const responseIndex = callCounts[method];
        callCounts[method] = responseIndex + 1;
        handleClassesCrudResponse(method, responseIndex, callbacks);
      });

      globalThis.google = {
        script: {
          run,
        },
      };
    })();
  `);
}

/**
 * Releases one queued classes CRUD response waiting on a browser-side signal.
 *
 * @param {Page} page Playwright page under test.
 * @param {string} signal Release signal name.
 * @returns {Promise<void>} Completion signal.
 */
export async function releaseClassesCrudSignal(page: Page, signal: string) {
  await page.evaluate((queuedSignal) => {
    (
      globalThis as {
        __releaseClassesCrudSignal?: (signalName: string) => void;
      }
    ).__releaseClassesCrudSignal?.(queuedSignal);
  }, signal);
}
