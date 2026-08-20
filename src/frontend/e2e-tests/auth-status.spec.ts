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
  test('shows a loading status region while authorisation is still loading', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: true,
      delayMs: 1000,
    });

    await page.goto('/');

    // §12: the loading surface is owned by AppAuthGate (the gate blocks children until
    // authorisation resolves), not by AuthStatusCard. The gate renders a status region with
    // an accessible name of "Loading authorisation status" and no skeleton.
    const loadingStatus = page.getByRole('status', { name: 'Loading authorisation status' });

    await expect(loadingStatus).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByText('Permissions required')).toHaveCount(0);

    await expect(loadingStatus).toHaveCount(0);
    // Once authorisation resolves to authorised, the gate renders its children and the
    // AuthStatusCard shows the authorised content.
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

  test('shows "Permissions required" when backend returns false', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: false,
    });

    await page.goto('/');

    // §12: a denied (OAuth) state is owned by AppAuthGate. The gate renders "Permissions required"
    // and does NOT render the AuthStatusCard children, so the card's content is absent.
    await expect(page.getByText('Permissions required')).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByText('You do not have access to this application.')).toHaveCount(0);
  });

  test('shows transport error with retry when backend returns a failure envelope', async ({
    page,
  }) => {
    await mockGoogleScriptRun(page, {
      kind: 'apiFailure',
      message: 'Backend authorisation check failed.',
    });

    await page.goto('/');

    // §12: transport errors are owned by AppAuthGate. The gate renders the derived user message
    // (an INTERNAL_ERROR envelope maps to the central map message) with a Retry affordance.
    await expect(
      page.getByText(
        'An internal error occurred. Please try again or contact support if the issue persists.'
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
  });

  test('shows transport error with retry when google.script.run is unavailable', async ({
    page,
  }) => {
    await page.goto('/');

    // §12: transport errors are owned by AppAuthGate. With google.script.run unavailable the
    // request throws before any envelope, so the hook derives the generic fallback message.
    await expect(page.getByText('An error occurred. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
