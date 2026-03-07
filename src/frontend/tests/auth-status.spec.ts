import { expect, test, type Page } from '@playwright/test';

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
 */
async function mockGoogleScriptRun(page: Page, scenario: AuthServiceMockScenario) {
  await page.addInitScript((mockScenario: AuthServiceMockScenario) => {
    const delayMs = mockScenario.delayMs ?? 0;

    const run = {
      successHandler: undefined as ((response: unknown) => void) | undefined,
      failureHandler: undefined as ((error: unknown) => void) | undefined,
      withSuccessHandler(handler: (response: unknown) => void) {
        this.successHandler = handler;
        return this;
      },
      withFailureHandler(handler: (error: unknown) => void) {
        this.failureHandler = handler;
        return this;
      },
      apiHandler() {
        setTimeout(() => {
          if (mockScenario.kind === 'success') {
            this.successHandler?.({
              ok: true,
              requestId: 'req-e2e-success',
              data: mockScenario.result,
            });
            return;
          }

          if (mockScenario.kind === 'apiFailure') {
            this.successHandler?.({
              ok: false,
              requestId: 'req-e2e-failure',
              error: {
                code: 'INTERNAL_ERROR',
                message: mockScenario.message,
              },
            });
            return;
          }

          this.failureHandler?.(new Error(mockScenario.message));
        }, delayMs);
      },
    };

    globalThis.google = {
      script: {
        run,
      },
    };
  }, scenario);
}

test.describe('auth status flow', () => {
  test('shows loading text initially', async ({ page }) => {
    await mockGoogleScriptRun(page, {
      kind: 'success',
      result: true,
      delayMs: 150,
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
    await expect(page.getByText('Backend authorisation check failed.')).toBeVisible();
  });

  test('shows runtime error when google.script.run is unavailable', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Unauthorised')).toBeVisible();
    await expect(page.getByText('google.script.run is unavailable in this runtime.')).toBeVisible();
  });
});
