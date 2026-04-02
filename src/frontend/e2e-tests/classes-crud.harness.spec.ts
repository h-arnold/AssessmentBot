import { expect, test, type Page } from '@playwright/test';
import type { ClassPartial } from '../src/services/classPartials.zod';
import type { Cohort, YearGroup } from '../src/services/referenceData.zod';
import type { GoogleClassroom } from '../src/services/googleClassrooms.zod';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

type ClassesCrudApiResponseScenario = Readonly<
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

type ClassesCrudRuntimeScenario = Readonly<{
  getAuthorisationStatus: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getABClassPartials: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getCohorts: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getYearGroups: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getGoogleClassrooms: ReadonlyArray<ClassesCrudApiResponseScenario>;
}>;

const settingsMenuLabel = 'Settings';
const settingsPageHeading = 'Settings';
const classesTabLabel = 'Classes';
const classesPanelLabel = 'Classes panel';
const unexpectedCallWaitTimeoutMs = 500;

const baseCohorts: Cohort[] = [
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: true,
    startYear: 2024,
    startMonth: 9,
  },
  {
    key: 'cohort-2023',
    name: 'Cohort 2023',
    active: false,
    startYear: 2023,
    startMonth: 9,
  },
];

const baseYearGroups: YearGroup[] = [
  {
    key: 'year-7',
    name: 'Year 7',
  },
  {
    key: 'year-8',
    name: 'Year 8',
  },
];

const baseClassPartials: ClassPartial[] = [
  {
    classId: 'class-101',
    className: 'Maths Year 7A',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    courseLength: 30,
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    classOwner: {
      userId: 'teacher-001',
      email: 'teacher1@example.com',
      teacherName: 'Ms Smith',
    },
    teachers: [],
    active: true,
  },
  {
    classId: 'class-102',
    className: 'Science Year 8B',
    cohortKey: 'cohort-2023',
    cohortLabel: 'Cohort 2023',
    courseLength: 25,
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    classOwner: null,
    teachers: [
      {
        userId: 'teacher-002',
        email: 'teacher2@example.com',
        teacherName: 'Mr Jones',
      },
    ],
    active: false,
  },
];

const baseGoogleClassrooms: GoogleClassroom[] = [
  {
    classId: 'gc-class-201',
    className: 'English Year 7C',
  },
  {
    classId: 'gc-class-202',
    className: 'History Year 8D',
  },
];

/**
 * Installs a browser-side `google.script.run` mock for the Classes CRUD feature.
 *
 * Uses a deterministic scenario queue: each backend method consumes responses sequentially.
 * Unexpected calls (no response queued) fail fast with a transport error.
 *
 * @param {Page} page The Playwright page under test.
 * @param {ClassesCrudRuntimeScenario} scenario The runtime scenario defining all backend responses.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
async function mockClassesCrudRuntime(page: Page, scenario: ClassesCrudRuntimeScenario) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const mockScenario = ${JSON.stringify(scenario)};
      const callCounts = {
        getAuthorisationStatus: 0,
        getABClassPartials: 0,
        getCohorts: 0,
        getYearGroups: 0,
        getGoogleClassrooms: 0,
      };
      const responseQueues = {
        getAuthorisationStatus: mockScenario.getAuthorisationStatus,
        getABClassPartials: mockScenario.getABClassPartials,
        getCohorts: mockScenario.getCohorts,
        getYearGroups: mockScenario.getYearGroups,
        getGoogleClassrooms: mockScenario.getGoogleClassrooms,
      };
      const releasedSignals = new Set();
      const releaseResolvers = new Map();

      function isClassesCrudTransportRequest(request) {
        return (
          typeof request === 'object' &&
          request !== null &&
          typeof request.method === 'string'
        );
      }

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          handler({
            ok: true,
            requestId,
            data,
          });
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
              retriable: false,
            },
          });
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

      globalThis.__releaseClassesCrudSignal = (signal) => {
        releasedSignals.add(signal);
        const resolve = releaseResolvers.get(signal);

        if (resolve !== undefined) {
          releaseResolvers.delete(signal);
          resolve();
        }
      };

      function handleClassesCrudResponse(method, responseIndex, callbacks) {
        const responseQueue = responseQueues[method];
        const response = responseQueue[responseIndex];

        if (response === undefined) {
          callbacks.failureHandler?.(
            new Error(\`Unexpected call to \${method} (call index \${responseIndex})\`)
          );
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
          method !== 'getAuthorisationStatus' &&
          method !== 'getABClassPartials' &&
          method !== 'getCohorts' &&
          method !== 'getYearGroups' &&
          method !== 'getGoogleClassrooms'
        ) {
          callbacks.failureHandler?.(
            new Error(\`Unsupported method: \${method}\`)
          );
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
 * Opens the settings page and activates the classes tab.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the tab is active.
 */
async function openClassesTab(page: Page) {
  await page.getByRole('menuitem', { name: settingsMenuLabel }).click();
  await expect(page.getByRole('heading', { level: 2, name: settingsPageHeading })).toBeVisible();
  await page.getByRole('tab', { name: classesTabLabel }).click();
}

/**
 * Asserts that the classes tab shows the placeholder panel (no content yet).
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves after assertions complete.
 */
async function assertClassesPlaceholderShown(page: Page) {
  await expect(page.getByRole('region', { name: classesPanelLabel })).toBeVisible();
  await expect(page.getByRole('region', { name: classesPanelLabel })).toBeEmpty();
}

/**
 * Asserts that the app shows the "Authorised" status (ready state).
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves after assertions complete.
 */
async function assertAuthorisedState(page: Page) {
  await expect(page.getByText('Authorised')).toBeVisible();
}

/**
 * Asserts that the app shows the "Unauthorised" status (no auth).
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves after assertions complete.
 */
async function assertUnauthorisedState(page: Page) {
  await expect(page.getByText('Unauthorised')).toBeVisible();
}

test.describe('Classes CRUD harness journey', () => {
  test('shows ready state when all startup warm-up queries succeed', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [
        {
          kind: 'success',
          data: baseClassPartials,
        },
      ],
      getCohorts: [
        {
          kind: 'success',
          data: baseCohorts,
        },
      ],
      getYearGroups: [
        {
          kind: 'success',
          data: baseYearGroups,
        },
      ],
      getGoogleClassrooms: [
        {
          kind: 'success',
          data: baseGoogleClassrooms,
        },
      ],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    await openClassesTab(page);
    await assertClassesPlaceholderShown(page);
  });

  test('shows unauthorised state when startup warm-up is blocked by auth failure', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: false,
        },
      ],
      getABClassPartials: [],
      getCohorts: [],
      getYearGroups: [],
      getGoogleClassrooms: [],
    });

    await page.goto('/');
    await assertUnauthorisedState(page);
  });

  test('treats startup warm-up failure as non-blocking and navigates to classes tab', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [
        {
          kind: 'transportFailure',
          message: 'Class partials fetch failed.',
        },
      ],
      getCohorts: [
        {
          kind: 'success',
          data: baseCohorts,
        },
      ],
      getYearGroups: [
        {
          kind: 'success',
          data: baseYearGroups,
        },
      ],
      getGoogleClassrooms: [
        {
          kind: 'success',
          data: baseGoogleClassrooms,
        },
      ],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    await openClassesTab(page);
    await assertClassesPlaceholderShown(page);
  });

  test('handles Google Classrooms prefetch failure gracefully without blocking navigation', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [
        {
          kind: 'success',
          data: baseClassPartials,
        },
      ],
      getCohorts: [
        {
          kind: 'success',
          data: baseCohorts,
        },
      ],
      getYearGroups: [
        {
          kind: 'success',
          data: baseYearGroups,
        },
      ],
      getGoogleClassrooms: [
        {
          kind: 'failureEnvelope',
          code: 'GOOGLE_API_ERROR',
          message: 'Google Classrooms fetch failed.',
        },
      ],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    await openClassesTab(page);
    await assertClassesPlaceholderShown(page);
  });

  test('supports empty datasets and navigates to classes tab successfully', async ({ page }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [
        {
          kind: 'success',
          data: [],
        },
      ],
      getCohorts: [
        {
          kind: 'success',
          data: [],
        },
      ],
      getYearGroups: [
        {
          kind: 'success',
          data: [],
        },
      ],
      getGoogleClassrooms: [
        {
          kind: 'success',
          data: [],
        },
      ],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    await openClassesTab(page);
    await assertClassesPlaceholderShown(page);
  });

  test('proves the representative partial-success transport sequence with deterministic call order', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [
        {
          kind: 'success',
          data: baseClassPartials.slice(0, 1),
        },
      ],
      getCohorts: [
        {
          kind: 'failureEnvelope',
          code: 'BACKEND_ERROR',
          message: 'Cohorts fetch failed.',
        },
      ],
      getYearGroups: [
        {
          kind: 'success',
          data: baseYearGroups,
        },
      ],
      getGoogleClassrooms: [
        {
          kind: 'success',
          data: baseGoogleClassrooms.slice(0, 1),
        },
      ],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    await openClassesTab(page);
    await assertClassesPlaceholderShown(page);
  });

  test('fails fast when an unexpected backend call is made outside the scenario queue', async ({
    page,
  }) => {
    await mockClassesCrudRuntime(page, {
      getAuthorisationStatus: [
        {
          kind: 'success',
          data: true,
        },
      ],
      getABClassPartials: [],
      getCohorts: [],
      getYearGroups: [],
      getGoogleClassrooms: [],
    });

    await page.goto('/');
    await assertAuthorisedState(page);

    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });

    await openClassesTab(page);

    await page.waitForTimeout(unexpectedCallWaitTimeoutMs);

    expect(consoleMessages.some((message) => message.includes('Unexpected call'))).toBe(true);
  });
});
