import type { Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '@/test/googleScriptRunHarness';
import { backendSettingsFixture } from './classes-page-end-to-end-helpers';

/**
 * Empty class-partial fixture used by the pending-state navigation mock.
 *
 * The navigation journeys only assert shell chrome, so the Classes page must
 * render its empty state rather than a populated card list.
 */
const classPartialsFixture: Array<Record<string, unknown>> = [];

/** Empty year-group fixture used by the pending-state navigation mock. */
const yearGroupsFixture: Array<Record<string, unknown>> = [];

/**
 * Installs a deterministic `google.script.run` mock with authorisation resolved
 * and returns empty datasets for class partials, year groups, and other warmup data.
 *
 * The mock also counts every dispatched method under
 * `globalThis.__methodCallTracker__` so journeys can assert that a page never
 * issued a particular backend call.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the init script is installed.
 */
export async function mockAuthenticatedGoogleScriptRun(page: Page): Promise<void> {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendSettingsFixture = ${JSON.stringify(backendSettingsFixture)};
      const classPartialsFixture = ${JSON.stringify(classPartialsFixture)};
      const yearGroupsFixture = ${JSON.stringify(yearGroupsFixture)};

      let methodCallTracker = {};

      /**
       * Delivers a success envelope as the backend apiHandler does: a JSON string
       * that real GAS passes through, so explicit null properties survive.
       *
       * @param {*} handler The registered success handler.
       * @param {string} requestId Request correlation identifier.
       * @param {*} data Successful payload.
       */
      function sendSuccess(handler, requestId, data) {
        handler?.(JSON.stringify({ ok: true, requestId, data }));
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = (request?.method);

            if (method) {
              methodCallTracker[method] = (methodCallTracker[method] || 0) + 1;
            }

            if (request?.method === 'getBackendConfig') {
              sendSuccess(callbacks.successHandler, 'req-backend-config', backendSettingsFixture);
              return;
            }

            if (request?.method === 'hasScriptAuthorisation') {
              sendSuccess(callbacks.successHandler, 'req-auth-status', true);
              return;
            }

            if (request?.method === 'getApplicationAccess') {
              sendSuccess(callbacks.successHandler, 'req-application-access', {
                allowed: true,
                role: 'admin',
                email: 'owner@example.com',
                reason: 'ok',
              });
              return;
            }

            if (request?.method === 'getABClassPartials') {
              sendSuccess(callbacks.successHandler, 'req-class-partials', classPartialsFixture);
              return;
            }

            if (request?.method === 'getYearGroups') {
              sendSuccess(callbacks.successHandler, 'req-yeargroups', yearGroupsFixture);
              return;
            }

            if (
              request?.method === 'getCohorts' ||
              request?.method === 'getAssignmentTopics' ||
              request?.method === 'getAssignmentDefinitionPartials'
            ) {
              sendSuccess(callbacks.successHandler, 'req-' + request.method, []);
              return;
            }

            if (request?.method === 'getGoogleClassrooms') {
              sendSuccess(callbacks.successHandler, 'req-google-classrooms', []);
              return;
            }

          }),
        },
      };

      // Expose the tracker to global scope so tests can inspect it
      globalThis.__methodCallTracker__ = methodCallTracker;
    })();
  `);
}
