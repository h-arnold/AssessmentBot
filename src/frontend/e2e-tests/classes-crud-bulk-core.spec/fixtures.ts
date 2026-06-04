/**
 * Shared fixtures for classes CRUD bulk core E2E tests.
 */

import { expect, type Page } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
  type ClassesCrudRuntimeScenario,
} from '../classes-crud.shared';

// ---------------------------------------------------------------------------
// Label constants (WS3 button labels)
// ---------------------------------------------------------------------------
export const classesTableAriaLabel = 'Classes table';
export const bulkCreateButtonLabel = 'Create ABClass';
export const bulkDeleteButtonLabel = 'Delete ABClass';
export const bulkActivateButtonLabel = 'Set active';
export const bulkDeactivateButtonLabel = 'Set inactive';
export const TWO_DATA_ROWS_PLUS_HEADER = 3;
export const ONE_DATA_ROW_PLUS_HEADER = 2;
export const DEFAULT_MUTATION_QUEUE_LENGTH = 12;

// ---------------------------------------------------------------------------
// WS3-format fixtures (cohortKey/yearGroupKey string fields)
// ---------------------------------------------------------------------------

/** Google Classroom entries – all classes that appear in the GCR. */
export const linkedGCR = { classId: 'gcr-class-linked-001', className: 'Year 10 Maths' };
export const activeGCR = { classId: 'gcr-class-active-001', className: 'Year 9 English' };
export const notCreatedGCR = { classId: 'gcr-class-not-created-001', className: 'Year 11 History' };

/** Class partial for the inactive ("linked") class. */
export const linkedClassPartial = {
  classId: 'gcr-class-linked-001',
  className: 'Year 10 Maths',
  cohortKey: 'cohort-2025',
  courseLength: 2,
  yearGroupKey: 'year-10',
  classOwner: null,
  teachers: [],
  active: false,
};

/** Class partial for the active class. */
export const activeClassPartial = {
  classId: 'gcr-class-active-001',
  className: 'Year 9 English',
  cohortKey: 'cohort-2025',
  courseLength: 1,
  yearGroupKey: 'year-9',
  classOwner: null,
  teachers: [],
  active: true,
};

export const secondInactiveGCR = { classId: 'gcr-class-linked-002', className: 'Year 8 Science' };
export const secondInactiveClassPartial = {
  ...linkedClassPartial,
  classId: 'gcr-class-linked-002',
  className: 'Year 8 Science',
};
export const secondActiveGCR = { classId: 'gcr-class-active-002', className: 'Year 7 Art' };
export const secondActiveClassPartial = {
  ...activeClassPartial,
  classId: 'gcr-class-active-002',
  className: 'Year 7 Art',
};

// ---------------------------------------------------------------------------
// Shared harness adapter
// ---------------------------------------------------------------------------

export type BulkCoreMutationScenario = Readonly<
  | {
      kind: 'success';
      data?: unknown;
    }
  | {
      kind: 'transportFailure';
      message: string;
    }
  | {
      kind: 'failureEnvelope';
      code?: string;
      message: string;
    }
>;

export type BulkCoreScenario = Readonly<{
  /** Google Classrooms to return for all getGoogleClassrooms calls. */
  googleClassrooms: readonly unknown[];
  /** Initial class partials. */
  classPartials: readonly unknown[];
  /** Cohorts returned for getCohorts. */
  cohorts?: readonly unknown[];
  /** Year groups returned for getYearGroups. */
  yearGroups?: readonly unknown[];
  /**
   * Optional second class partials response, served on the second
   * getABClassPartials call (e.g. after a mutation + refetch).
   */
  classPartialsAfterMutation?: readonly unknown[];
  /** Optional queued delete responses. Defaults to success when omitted. */
  deleteABClass?: readonly BulkCoreMutationScenario[];
  /** Optional queued update responses. Defaults to success when omitted. */
  updateABClass?: readonly BulkCoreMutationScenario[];
  /** Optional queued upsert responses. Defaults to success when omitted. */
  upsertABClass?: readonly BulkCoreMutationScenario[];
}>;

/**
 * Builds a padded queue of successful mutation responses.
 *
 * @returns {ReadonlyArray<BulkCoreMutationScenario>} Default success queue.
 */
export function buildDefaultMutationQueue(): ReadonlyArray<BulkCoreMutationScenario> {
  return Array.from({ length: DEFAULT_MUTATION_QUEUE_LENGTH }, () => ({
    kind: 'success',
    data: { ok: true },
  }));
}

/**
 * Maps the bulk-core shorthand scenario onto the shared classes CRUD harness scenario.
 *
 * @param {BulkCoreScenario} scenario Bulk-core shorthand scenario.
 * @returns {ClassesCrudRuntimeScenario} Shared harness scenario.
 */
export function toClassesCrudScenario(scenario: BulkCoreScenario): ClassesCrudRuntimeScenario {
  const classPartialsQueue: ClassesCrudRuntimeScenario['getABClassPartials'] = [
    { kind: 'success', data: scenario.classPartials },
  ];

  if (scenario.classPartialsAfterMutation !== undefined) {
    classPartialsQueue.push({ kind: 'success', data: scenario.classPartialsAfterMutation });
  }

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: classPartialsQueue,
    getCohorts: [{ kind: 'success', data: scenario.cohorts ?? baseCohorts }],
    getYearGroups: [{ kind: 'success', data: scenario.yearGroups ?? baseYearGroups }],
    getGoogleClassrooms: [{ kind: 'success', data: scenario.googleClassrooms }],
    deleteABClass: scenario.deleteABClass ?? buildDefaultMutationQueue(),
    updateABClass: scenario.updateABClass ?? buildDefaultMutationQueue(),
    upsertABClass: scenario.upsertABClass ?? buildDefaultMutationQueue(),
  };
}

/**
 * Installs a complete `google.script.run` scenario using the shared classes CRUD harness.
 *
 * @param {Page} page Playwright page under test.
 * @param {BulkCoreScenario} scenario API scenario.
 * @returns {Promise<void>} Resolves when the init script is installed.
 */
export async function mockBulkCoreRuntime(page: Page, scenario: BulkCoreScenario): Promise<void> {
  await mockClassesCrudRuntime(page, toClassesCrudScenario(scenario));
}

/**
 * Navigates to the Settings page and activates the Classes tab.
 *
 * @param {Page} page Playwright page under test.
 * @returns {Promise<void>} Resolves once the Classes tab is active and the table is visible.
 */
export async function openClassesManagementTab(page: Page): Promise<void> {
  await openClassesTab(page);
  await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
}
