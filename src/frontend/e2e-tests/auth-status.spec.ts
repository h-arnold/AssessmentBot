import { expect, test } from '@playwright/test';
import {
  AUTHORISATION_WARMUP_METHODS,
  createAuthorisationScenario,
  installRuntimeMock,
  releaseNextDeferredSuccess,
} from './shared/endToEndRuntimeMocks';

test.describe('auth status flow', () => {
  test('shows a loading status region while authorisation is still loading', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAuthorisationScenario({
        authorisationStatus: { kind: 'deferredSuccess', data: true },
        applicationAccess: {
          kind: 'deferredSuccess',
          data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
        },
        warmupResponseFactory: (data) => ({ kind: 'deferredSuccess', data }),
      })
    );

    await page.goto('/');

    const loadingStatus = page.getByRole('status', { name: 'Loading authorisation status' });
    await expect(loadingStatus).toBeVisible();
    await expect(page.getByText('Authorised', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Permissions required')).toHaveCount(0);

    await releaseNextDeferredSuccess(page);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);

    await releaseNextDeferredSuccess(page);
    await expect(page.getByText('Authorised')).toBeVisible();

    for (let index = 0; index < AUTHORISATION_WARMUP_METHODS.length; index += 1) {
      await releaseNextDeferredSuccess(page);
    }

    await expect(loadingStatus).toHaveCount(0);
    await expect(page.getByText('Authorised')).toBeVisible();
  });

  test('shows Authorised when backend returns true', async ({ page }) => {
    await installRuntimeMock(page, createAuthorisationScenario());

    await page.goto('/');

    await expect(page.getByText('Authorised')).toBeVisible();
  });

  test('shows "Permissions required" when backend returns false', async ({ page }) => {
    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: false }],
    });

    await page.goto('/');

    await expect(page.getByText('Permissions required')).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByText('You do not have access to this application.')).toHaveCount(0);
  });

  test('shows transport error with retry when backend returns a failure envelope', async ({
    page,
  }) => {
    await installRuntimeMock(page, {
      getAuthorisationStatus: [
        {
          kind: 'failureEnvelope',
          code: 'INTERNAL_ERROR',
          message: 'Backend authorisation check failed.',
        },
      ],
    });

    await page.goto('/');

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

    await expect(page.getByText('An error occurred. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});

test.describe('fail-closed authorisation rendering', () => {
  test('keeps OAuth loading separate from the access-verification prerequisite', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createAuthorisationScenario({
        warmupResponseFactory: (data) => ({ kind: 'deferredSuccess', data }),
        applicationAccess: {
          kind: 'deferredSuccess',
          data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
        },
      })
    );

    await page.goto('/');

    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
  });

  test('a non-member only ever sees the blocking no-permission surface', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAuthorisationScenario({
        warmupResponseFactory: (data) => ({ kind: 'deferredSuccess', data }),
        applicationAccess: {
          kind: 'success',
          data: { allowed: false, role: null, email: 'member@example.com', reason: 'denied' },
        },
      })
    );

    await page.goto('/');

    await expect(page.getByText('Authorised', { exact: true })).toHaveCount(0);

    await expect(page.getByText('Access denied')).toBeVisible();
    await expect(page.getByText('You are not authorised to use this application.')).toBeVisible();
    await expect(page.getByText('Authorised', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Permissions required')).toHaveCount(0);
  });

  test('a confirmed member reaches the dashboard once application access is ready', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createAuthorisationScenario({
        warmupResponseFactory: (data) => ({ kind: 'deferredSuccess', data }),
        applicationAccess: {
          kind: 'deferredSuccess',
          data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
        },
      })
    );

    await page.goto('/');

    await expect(page.getByRole('status', { name: 'Loading authorisation status' })).toHaveCount(0);
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();

    await releaseNextDeferredSuccess(page);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toHaveCount(0);
    await expect(page.getByText('Authorised')).toBeVisible();

    for (let index = 0; index < AUTHORISATION_WARMUP_METHODS.length; index += 1) {
      await releaseNextDeferredSuccess(page);
    }

    await expect(page.getByText('Authorised')).toBeVisible();
  });
});
