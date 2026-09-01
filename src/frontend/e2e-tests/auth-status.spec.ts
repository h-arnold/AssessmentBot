import { expect, test } from '@playwright/test';
import {
  createAssignmentsScenario,
  installRuntimeMock,
  releaseNextDeferredSuccess,
  type ResponseItem,
  type RuntimeScenario,
} from './shared/endToEndRuntimeMocks';

const WARMUP_METHODS = [
  'getABClassPartials',
  'getAssignmentDefinitionPartials',
  'getAssignmentTopics',
  'getCohorts',
  'getYearGroups',
] as const;

type WarmupMethod = (typeof WARMUP_METHODS)[number];

/**
 * Creates queues for the five startup warm-up methods.
 *
 * @param {(data: unknown) => ResponseItem} responseFactory Response entry factory.
 * @returns {Pick<RuntimeScenario, WarmupMethod>} Warm-up method queues.
 */
function createWarmupScenario(
  responseFactory: (data: unknown) => ResponseItem
): Pick<RuntimeScenario, WarmupMethod> {
  const validScenario = createAssignmentsScenario();

  /**
   * Extracts the fixture data for one warm-up method.
   *
   * @param {WarmupMethod} method Warm-up method name.
   * @returns {unknown} Fixture data, or undefined when the queue has no data entry.
   */
  function getWarmupData(method: WarmupMethod): unknown {
    const response = validScenario[method]?.[0];
    return response && 'data' in response ? response.data : undefined;
  }

  return Object.fromEntries(
    WARMUP_METHODS.map((method) => [
      method,
      [responseFactory(getWarmupData(method)), responseFactory(getWarmupData(method))],
    ])
  ) as Pick<RuntimeScenario, WarmupMethod>;
}

/**
 * Creates an authorised runtime scenario with the supplied startup warm-up responses.
 *
 * @param {Pick<RuntimeScenario, WarmupMethod>} warmupResponses Warm-up method response queues.
 * @returns {RuntimeScenario} Authorised scenario with warm-up queues.
 */
function createAuthorisedScenario(warmupResponses: Pick<RuntimeScenario, WarmupMethod>) {
  return {
    getAuthorisationStatus: [
      { kind: 'success' as const, data: true },
      { kind: 'success' as const, data: true },
    ],
    ...warmupResponses,
  };
}

test.describe('auth status flow', () => {
  test('shows a loading status region while authorisation is still loading', async ({ page }) => {
    const warmupResponses = createWarmupScenario((data) => ({
      kind: 'deferredSuccess',
      data,
    }));
    await installRuntimeMock(page, {
      getAuthorisationStatus: [
        { kind: 'deferredSuccess', data: true },
        { kind: 'deferredSuccess', data: true },
      ],
      ...warmupResponses,
    });

    await page.goto('/');

    const loadingStatus = page.getByRole('status', { name: 'Loading authorisation status' });
    await expect(loadingStatus).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByText('Permissions required')).toHaveCount(0);

    await releaseNextDeferredSuccess(page);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);

    for (let index = 0; index < WARMUP_METHODS.length; index += 1) {
      await releaseNextDeferredSuccess(page);
    }

    await expect(loadingStatus).toHaveCount(0);
    await expect(page.getByText('Authorised')).toBeVisible();
  });

  test('shows Authorised when backend returns true', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAuthorisedScenario(
        createWarmupScenario((data) => ({
          kind: 'success',
          data,
        }))
      )
    );

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
      createAuthorisedScenario(createWarmupScenario((data) => ({ kind: 'deferredSuccess', data })))
    );

    await page.goto('/');

    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
  });

  test('a non-member only ever sees the blocking no-permission surface', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAuthorisedScenario(
        createWarmupScenario(() => ({
          kind: 'deferredFailure',
          code: 'FORBIDDEN',
          message: 'Group membership is required.',
        }))
      )
    );

    await page.goto('/');

    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();

    for (let index = 0; index < WARMUP_METHODS.length; index += 1) {
      await releaseNextDeferredSuccess(page);
    }

    await expect(
      page.getByText('You do not have permission to access this application')
    ).toBeVisible();
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByText('Permissions required')).toHaveCount(0);
  });

  test('a confirmed member reaches the dashboard only once warm-up is ready', async ({ page }) => {
    await installRuntimeMock(
      page,
      createAuthorisedScenario(createWarmupScenario((data) => ({ kind: 'deferredSuccess', data })))
    );

    await page.goto('/');

    await expect(page.getByRole('status', { name: 'Loading authorisation status' })).toHaveCount(0);
    await expect(page.getByText('Authorised')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Verifying access' })).toBeVisible();

    for (let index = 0; index < WARMUP_METHODS.length; index += 1) {
      await releaseNextDeferredSuccess(page);
    }

    await expect(page.getByRole('status', { name: 'Verifying access' })).toHaveCount(0);
    await expect(page.getByText('Authorised')).toBeVisible();
  });
});
