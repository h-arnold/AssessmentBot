import { vi } from 'vitest';
import type { Cohort, YearGroup } from '../../services/referenceData.zod';
import type { RowMutationResult } from '../../features/classes/batchMutationEngine';
import type { ClassesManagementRow } from '../../features/classes/classesManagementViewModel';
import type { ClassesManagementState } from '../../features/classes/useClassesManagement';

/**
 * Builds a canonical classes-management row for frontend tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides.
 * @returns {ClassesManagementRow} Composed row fixture.
 */
export function buildClassesManagementRow(
  overrides: Partial<ClassesManagementRow> = {},
): ClassesManagementRow {
  return {
    classId: 'active-1',
    className: 'Alpha',
    status: 'active',
    cohortKey: 'cohort-a',
    cohortLabel: 'Cohort A',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 2,
    active: true,
    ...overrides,
  };
}

export const statusCoverageRows: ClassesManagementRow[] = [
  buildClassesManagementRow({ classId: 'active-1', className: 'alpha' }),
  buildClassesManagementRow({
    classId: 'inactive-1',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    yearGroupKey: 'year-9',
    yearGroupLabel: 'Year 9',
    courseLength: 1,
    active: false,
  }),
  buildClassesManagementRow({
    classId: 'not-created-1',
    className: 'delta',
    status: 'notCreated',
    cohortKey: null,
    cohortLabel: null,
    yearGroupKey: null,
    yearGroupLabel: null,
    courseLength: null,
    active: null,
  }),
  buildClassesManagementRow({
    classId: 'orphaned-1',
    className: 'Echo',
    status: 'orphaned',
    cohortKey: 'cohort-c',
    cohortLabel: 'Legacy Cohort',
    yearGroupKey: 'year-12',
    yearGroupLabel: 'Year 12',
    courseLength: 3,
    active: false,
  }),
];

export const readyClassesRows: ClassesManagementRow[] = [
  buildClassesManagementRow({ classId: 'active-1', className: 'Alpha' }),
  buildClassesManagementRow({ classId: 'active-2', className: 'Atlas' }),
  buildClassesManagementRow({
    classId: 'inactive-1',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    yearGroupKey: 'year-9',
    yearGroupLabel: 'Year 9',
    courseLength: 1,
    active: false,
  }),
  buildClassesManagementRow({
    classId: 'inactive-2',
    className: 'Beta',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    yearGroupKey: 'year-9',
    yearGroupLabel: 'Year 9',
    courseLength: 1,
    active: false,
  }),
  buildClassesManagementRow({
    classId: 'not-created-1',
    className: 'Charlie',
    status: 'notCreated',
    cohortKey: null,
    cohortLabel: null,
    yearGroupKey: null,
    yearGroupLabel: null,
    courseLength: null,
    active: null,
  }),
  buildClassesManagementRow({
    classId: 'orphaned-1',
    className: 'Legacy',
    status: 'orphaned',
    cohortKey: 'cohort-c',
    cohortLabel: 'Cohort C',
    yearGroupKey: 'year-12',
    yearGroupLabel: 'Year 12',
    courseLength: 3,
    active: false,
  }),
];

export const activeCohortOptions: Cohort[] = [
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: true,
    startYear: 2024,
    startMonth: 9,
  },
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
];

export const yearGroupOptions: YearGroup[] = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
  { key: 'year-11', name: 'Year 11' },
];

/**
 * Builds a convenience classes-management hook state for panel-style tests.
 *
 * Default reference-data options are empty unless supplied explicitly so this
 * helper stays neutral across specs that use different cohort/year-group keys.
 *
 * @param {Partial<ClassesManagementState>} overrides State overrides.
 * @returns {ClassesManagementState} Complete mocked hook state.
 */
export function buildClassesManagementState(
  overrides: Partial<ClassesManagementState> = {},
): ClassesManagementState {
  const rows = overrides.rows ?? readyClassesRows;
  const cohorts = overrides.cohorts ?? [];
  const yearGroups = overrides.yearGroups ?? [];

  return {
    blockingErrorMessage: null,
    classesManagementViewState: 'ready',
    classesCount: overrides.classesCount ?? rows.length,
    cohorts: [...cohorts],
    errorMessage: null,
    isRefreshing: false,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: null,
    rows: [...rows],
    selectedRowKeys: [],
    yearGroups: [...yearGroups],
    onSelectedRowKeysChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Looks up one shared test row by class id.
 *
 * @param {string} classId Shared test row id.
 * @param {readonly ClassesManagementRow[]} [rows] Row lookup source.
 * @returns {ClassesManagementRow} Matching row fixture.
 */
function getRowByClassId(
  classId: string,
  rows: readonly ClassesManagementRow[] = readyClassesRows,
): ClassesManagementRow {
  const row = rows.find((candidate) => candidate.classId === classId);

  if (row === undefined) {
    throw new Error('Unknown test row: ' + classId);
  }

  return row;
}

/**
 * Builds one fulfilled batch result for a shared classes test row.
 *
 * @param {string} classId Shared test row id.
 * @param {readonly ClassesManagementRow[]} [rows] Row lookup source.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Fulfilled result.
 */
export function createFulfilledClassResult(
  classId: string,
  rows: readonly ClassesManagementRow[] = readyClassesRows,
): RowMutationResult<ClassesManagementRow, unknown> {
  return {
    status: 'fulfilled',
    row: getRowByClassId(classId, rows),
    data: undefined,
  };
}

/**
 * Builds one rejected batch result for a shared classes test row.
 *
 * @param {string} classId Shared test row id.
 * @param {readonly ClassesManagementRow[]} [rows] Row lookup source.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Rejected result.
 */
export function createRejectedClassResult(
  classId: string,
  rows: readonly ClassesManagementRow[] = readyClassesRows,
): RowMutationResult<ClassesManagementRow, unknown> {
  return {
    status: 'rejected',
    row: getRowByClassId(classId, rows),
    error: new Error('Mutation failed for ' + classId),
  };
}
