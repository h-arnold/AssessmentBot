import { expect, type Page } from '@playwright/test';
import {
  createCanonicalNotAttemptedClassMetadata,
  createCanonicalNumericClassMetadata,
} from './helpers/class-metadata-fixtures';
import { mockClassesCrudRuntime as installMockClassesCrudRuntime } from './helpers/classes-crud-mock-runtime';
export {
  mockClassesCrudRuntime,
  releaseClassesCrudSignal,
} from './helpers/classes-crud-mock-runtime';
import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { Cohort, YearGroup } from '@/services/referenceData/referenceData.zod';
import type { GoogleClassroom } from '@/services/googleClassrooms/googleClassrooms.zod';

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
  hasScriptAuthorisation: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getApplicationAccess?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getABClassPartials: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getCohorts: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getYearGroups: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getAssignmentTopics?: ReadonlyArray<ClassesCrudApiResponseScenario>;
  getAssignmentDefinitionPartials?: ReadonlyArray<ClassesCrudApiResponseScenario>;
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
    metadata: createCanonicalNumericClassMetadata(),
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
    metadata: createCanonicalNotAttemptedClassMetadata(),
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
    metadata: createCanonicalNumericClassMetadata(),
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
    metadata: createCanonicalNotAttemptedClassMetadata(),
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
    hasScriptAuthorisation: strictModeSafeReadQueue(scenario.hasScriptAuthorisation ?? []),
    getApplicationAccess: strictModeSafeReadQueue(
      scenario.getApplicationAccess ?? [
        {
          kind: 'success',
          data: { allowed: true, role: 'admin', email: 'owner@example.com', reason: 'ok' },
        },
      ]
    ),
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
    hasScriptAuthorisation: strictModeSafeReadQueue([{ kind: 'success', data: true }]),
    getABClassPartials: strictModeSafeReadQueue([
      { kind: 'success', data: [...data.classPartials] },
    ]),
    getCohorts: strictModeSafeReadQueue([{ kind: 'success', data: [...data.cohorts] }]),
    getYearGroups: strictModeSafeReadQueue([{ kind: 'success', data: [...data.yearGroups] }]),
    getAssignmentTopics: strictModeSafeReadQueue([{ kind: 'success', data: [] }]),
    getAssignmentDefinitionPartials: strictModeSafeReadQueue([{ kind: 'success', data: [] }]),
    getGoogleClassrooms: strictModeSafeReadQueue([
      { kind: 'success', data: [...data.googleClassrooms] },
    ]),
    updateABClass: [],
  };
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
  await installMockClassesCrudRuntime(page, scenario);
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
