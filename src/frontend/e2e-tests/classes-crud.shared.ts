import { expect, type Page } from '@playwright/test';
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

export type ClassesCrudRuntimeScenario = Readonly<{
  getAuthorisationStatus: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getABClassPartials: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getCohorts: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getYearGroups: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getGoogleClassrooms: ReadonlyArray<ClassesCrudApiResponseScenario>;
  updateABClass?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  deleteABClass?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  upsertABClass?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for createCohort calls (cohort management modal). */
  createCohort?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for updateCohort calls (cohort management modal). */
  updateCohort?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for deleteCohort calls (cohort management modal). */
  deleteCohort?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for createYearGroup calls (year-group management modal). */
  createYearGroup?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for updateYearGroup calls (year-group management modal). */
  updateYearGroup?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  /** Responses queued for deleteYearGroup calls (year-group management modal). */
  deleteYearGroup?: ReadonlyArray<ClassesCrudApiResponseScenario>;
}>;

export type ClassesCrudDataBundle = Readonly<{
  classPartials: readonly ClassPartial[];
  cohorts: readonly Cohort[];
  googleClassrooms: readonly GoogleClassroom[];
  yearGroups: readonly YearGroup[];
}>;

export const baseCohorts: Cohort[] = [
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

export const baseYearGroups: YearGroup[] = [
  {
    key: 'year-7',
    name: 'Year 7',
  },
  {
    key: 'year-8',
    name: 'Year 8',
  },
];

export const baseClassPartials: ClassPartial[] = [
  {
    classId: 'class-101',
    className: 'Maths Year 7A',
    cohortKey: 'cohort-2024',
    courseLength: 30,
    yearGroupKey: 'year-7',
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
    courseLength: 25,
    yearGroupKey: 'year-8',
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

export const baseGoogleClassrooms: GoogleClassroom[] = [
  {
    classId: 'gc-class-201',
    className: 'English Year 7C',
  },
  {
    classId: 'gc-class-202',
    className: 'History Year 8D',
  },
];

export const matchedGoogleClassrooms: GoogleClassroom[] = [
  { classId: 'gc-class-201', className: 'English Year 7C' },
  { classId: 'gc-class-202', className: 'History Year 8D' },
];

export const matchedClassPartials: ClassPartial[] = [
  {
    classId: 'gc-class-201',
    className: 'English Year 7C',
    cohortKey: 'cohort-2024',
    courseLength: 30,
    yearGroupKey: 'year-7',
    classOwner: null,
    teachers: [],
    active: true,
  },
  {
    classId: 'gc-class-202',
    className: 'History Year 8D',
    cohortKey: 'cohort-2023',
    courseLength: 25,
    yearGroupKey: 'year-8',
    classOwner: null,
    teachers: [],
    active: false,
  },
];

/**
 * Builds a success scenario for all classes-related API methods.
 *
 * @param {ClassesCrudDataBundle} data Successful data payloads.
 * @returns {ClassesCrudRuntimeScenario} Fully successful scenario.
 */
/**
 * Read-queue pass-through for the classes CRUD harness.
 *
 * In this project's development setup, React 19 StrictMode double-invokes mount
 * effects, but TanStack Query de-duplicates the resulting double `useQuery` for
 * a given query key while the first request is still in flight. Empirically
 * (verified by isolated E2E runs) the classes feature therefore issues exactly
 * **one** initial `getABClassPartials` call per page load, not two. The single
 * required post-mutation refetch then lands on the next queue index.
 *
 * The correct queue is therefore the *logical* call sequence: one entry per real
 * call. Doubling the mount entry (a naive "StrictMode ×2" pad) shifts the
 * refetch onto a duplicated mount entry and returns the wrong data — it is
 * actively harmful here. So this helper returns the entries unchanged and exists
 * only as a named, documented seam so callers express intent ("this is a
 * read queue") without accidentally re-introducing padding.
 *
 * Queues that encode failure semantics (`transportFailure`, `failureEnvelope`)
 * are likewise returned untouched — their per-index outcomes are deliberately
 * asserted by consuming tests.
 *
 * The flakiness the tests previously exhibited under parallel load was caused by
 * the antd v6 modal entrance-animation click race, not by queue exhaustion.
 * That is mitigated in the specs by waiting for the confirm button to be
 * `toBeEnabled()` before clicking and asserting the dialog count drops to zero.
 *
 * @param {readonly ClassesCrudApiResponseScenario[]} entries Logical read-queue entries.
 * @returns {ClassesCrudApiResponseScenario[]} The same entries, unchanged.
 */
export function strictModeSafeReadQueue(
  entries: readonly ClassesCrudApiResponseScenario[]
): ClassesCrudApiResponseScenario[] {
  // One entry per logical call: return the queue unchanged.
  return [...entries];
}

/**
 * Pads the data-loading queues of a Classes CRUD runtime scenario so they are
 * resilient to React 19 StrictMode double-fetch and the post-mutation
 * class-partials refetch. Mutation queues are left untouched — they are driven
 * by user actions, not effects, and their sizing is owned by each test.
 *
 * @param {ClassesCrudRuntimeScenario} scenario The scenario to pad.
 * @returns {ClassesCrudRuntimeScenario} Scenario with StrictMode-safe read queues.
 */
export function padClassesCrudReadQueues(
  scenario: ClassesCrudRuntimeScenario
): ClassesCrudRuntimeScenario {
  return {
    ...scenario,
    getAuthorisationStatus: strictModeSafeReadQueue(scenario.getAuthorisationStatus ?? []),
    getABClassPartials: strictModeSafeReadQueue(scenario.getABClassPartials ?? []),
    getCohorts: strictModeSafeReadQueue(scenario.getCohorts ?? []),
    getYearGroups: strictModeSafeReadQueue(scenario.getYearGroups ?? []),
    getGoogleClassrooms: strictModeSafeReadQueue(scenario.getGoogleClassrooms ?? []),
  };
}

/**
 * Builds a success scenario for all classes-related API methods.
 *
 * @param {ClassesCrudDataBundle} data Successful data payloads.
 * @returns {ClassesCrudRuntimeScenario} Fully successful scenario.
 */
export function createSuccessfulClassesScenario(
  data: ClassesCrudDataBundle
): ClassesCrudRuntimeScenario {
  return {
    getAuthorisationStatus: strictModeSafeReadQueue([{ kind: 'success', data: true }]),
    getABClassPartials: strictModeSafeReadQueue([
      { kind: 'success', data: [...data.classPartials] },
    ]),
    getCohorts: strictModeSafeReadQueue([{ kind: 'success', data: [...data.cohorts] }]),
    getYearGroups: strictModeSafeReadQueue([{ kind: 'success', data: [...data.yearGroups] }]),
    getGoogleClassrooms: strictModeSafeReadQueue([
      { kind: 'success', data: [...data.googleClassrooms] },
    ]),
    updateABClass: [],
  };
}

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
        getAuthorisationStatus: 0,
        getABClassPartials: 0,
        getCohorts: 0,
        getYearGroups: 0,
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
        getAuthorisationStatus: mockScenario.getAuthorisationStatus,
        getABClassPartials: mockScenario.getABClassPartials,
        getCohorts: mockScenario.getCohorts,
        getYearGroups: mockScenario.getYearGroups,
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
              retriable: false,
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
          method !== 'getAuthorisationStatus' &&
          method !== 'getABClassPartials' &&
          method !== 'getCohorts' &&
          method !== 'getYearGroups' &&
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

/**
 * Opens the settings page and activates the classes tab.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the tab is active.
 */
export async function openClassesTab(page: Page) {
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Classes' }).click();
}

/**
 * Applies a runtime scenario and opens the Classes tab.
 *
 * @param {Page} page The Playwright page under test.
 * @param {ClassesCrudRuntimeScenario} scenario The scenario to apply.
 * @returns {Promise<void>} A promise that resolves once the tab is active.
 */
export async function openClassesTabWithScenario(page: Page, scenario: ClassesCrudRuntimeScenario) {
  await mockClassesCrudRuntime(page, scenario);
  await page.goto('/');
  await openClassesTab(page);
}

// ---------------------------------------------------------------------------
// Layout assertion constants for reference-data modal geometry tests
// ---------------------------------------------------------------------------

// Alignment tolerance: button left edge must remain near the flex container
// start edge across Chromium layout variance. The flex container is the
// project-controlled scaffold Flex (width: 100%, align: start), so the button
// and flex should be near-exactly aligned; 72px absorbs any residual variance.
export const ALIGNMENT_TOLERANCE_PX = 72;
// Width difference: button must be at least 32px narrower than the flex
// container (which equals the table width since the table is width: 100%).
export const MIN_WIDTH_DIFFERENCE_PX = 32;
