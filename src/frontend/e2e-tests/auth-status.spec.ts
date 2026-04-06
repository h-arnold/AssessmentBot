import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

type AuthServiceMockScenario =
  | {
      kind: 'success';
      result: boolean;
      delayMs?: number;
    }
  | {
      kind: 'apiFailure';
      message: string;
      delayMs?: number;
    }
  | {
      kind: 'transportFailure';
      message: string;
      delayMs?: number;
    };

/**
 * Installs a `google.script.run` mock before page scripts execute.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {AuthServiceMockScenario} scenario - The scenario that should be simulated.
 * @returns {Promise<void>} A promise that resolves once the init script is installed.
 */
async function mockGoogleScriptRun(page: Page, scenario: AuthServiceMockScenario) {
  await page.addInitScript(
    `
      (() => {
        const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
        const mockScenario = ${JSON.stringify(scenario)};
        const delayMs = mockScenario.delayMs ?? 0;

        function dispatchScenarioResponse(callbacks, activeScenario) {
          if (activeScenario.kind === 'success') {
            callbacks.successHandler?.({
              ok: true,
              requestId: 'req-e2e-success',
              data: activeScenario.result,
            });
            return;
          }

          if (activeScenario.kind === 'apiFailure') {
            callbacks.successHandler?.({
              ok: false,
              requestId: 'req-e2e-failure',
              error: {
                code: 'INTERNAL_ERROR',
                message: activeScenario.message,
              },
            });
            return;
          }

          callbacks.failureHandler?.(new Error(activeScenario.message));
        }

        globalThis.google = {
          script: {
            run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
              setTimeout(() => {
                if (typeof request?.method !== 'string') {
                  callbacks.failureHandler?.(new Error('Invalid transport request payload.'));
                  return;
                }

                dispatchScenarioResponse(callbacks, mockScenario);
              }, delayMs);
            }),
          },
        };
      })();
    `
  );
}

test.describe('auth status flow', () => {
  test('shows loading text initially', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: true,
      delayMs: 1000,
    });

    await page.goto('/');

    await expect(page.getByText('Checking authorisation status...')).toBeVisible();
    await expect(page.getByText('Authorised')).toBeVisible();
  });

  test('shows Authorised when backend returns true', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: true,
    });

    await page.goto('/');

    await expect(page.getByText('Authorised')).toBeVisible();
  });

  test('shows unauthorised when backend returns false', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: false,
    });

    await page.goto('/');

    await expect(page.getByText('Unauthorised')).toBeVisible();
  });

  test('shows backend error subtitle when backend returns a failure envelope', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'apiFailure',
      message: 'Backend authorisation check failed.',
    });

    await page.goto('/');

    await expect(page.getByText('Unauthorised')).toBeVisible();
    await expect(page.getByText('Unable to check authorisation status right now.')).toBeVisible();
  });

  test('shows runtime error when google.script.run is unavailable', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Unauthorised')).toBeVisible();
    await expect(page.getByText('Unable to check authorisation status right now.')).toBeVisible();
  });
});
