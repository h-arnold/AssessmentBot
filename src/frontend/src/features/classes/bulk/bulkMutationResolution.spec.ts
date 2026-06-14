/**
 * Bulk mutation resolution helpers — unit tests.
 *
 * These tests validate the extracted resolution and copy-building functions
 * that will be moved from ClassesManagementPanel.tsx into
 * bulkMutationResolution.ts. They should fail (RED) until that module exists.
 */

import { describe, expect, it } from 'vitest';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import type { RowMutationResult } from './batchMutationEngine';
import type { RequiredClassPartialsRefreshOutcome } from './queryInvalidation';
import {
  buildTopLevelBulkMutationResolution,
  buildMetadataBulkMutationResolution,
  createBulkCreateFailureMessage,
  createBulkDeleteFailureMessage,
  createBulkFailureMessage,
  createBulkMetadataFailureMessage,
  createBulkSetActiveFailureMessage,
  createBulkSetInactiveFailureMessage,
  getBulkOutcomeTitle,
  getRejectedRowResults,
  hasAnyFulfilledRowResult,
} from './bulkMutationResolution';

// ---------------------------------------------------------------------------
// Local fixture types (mirror the exported types from bulkMutationResolution)
// ---------------------------------------------------------------------------

type FixtureFailureCopy = Readonly<{
  allFailure: (totalCount: number) => string;
  partialFailure: (failedCount: number, totalCount: number) => string;
  partialRefreshFailure: (failedCount: number, totalCount: number) => string;
  singleFailure: string;
}>;

type FixtureTopLevelCopy = Readonly<{
  createFailureMessage: (
    failedCount: number,
    totalCount: number,
    hasRefreshFailure: boolean
  ) => string;
  fullFailureTitle: string;
  partialFailureTitle: string;
}>;

// ---------------------------------------------------------------------------
// Named constants used to avoid magic-number lint warnings
// ---------------------------------------------------------------------------

const COUNT_ALL_TWO = 2;
const COUNT_ALL_THREE = 3;
const COUNT_ALL_FOUR = 4;
const COUNT_PARTIAL_TWO = 2;
const TOTAL_FIVE = 5;
const TOTAL_THREE = 3;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const rowA: ClassesManagementRow = {
  classId: 'class-a',
  className: 'Alpha',
  status: 'active',
  cohortKey: 'cohort-1',
  cohortLabel: 'Cohort 1',
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  courseLength: 2,
  active: true,
};

const rowB: ClassesManagementRow = {
  classId: 'class-b',
  className: 'Bravo',
  status: 'inactive',
  cohortKey: 'cohort-2',
  cohortLabel: 'Cohort 2',
  yearGroupKey: 'year-9',
  yearGroupLabel: 'Year 9',
  courseLength: 1,
  active: false,
};

/**
 * Builds a fulfilled row result for a test fixture row.
 *
 * @param {ClassesManagementRow} row Test fixture row.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Fulfilled result object.
 */
function fulfilledResult(
  row: ClassesManagementRow
): RowMutationResult<ClassesManagementRow, unknown> {
  return { status: 'fulfilled', row, data: { ok: true } };
}

/**
 * Builds a rejected row result for a test fixture row.
 *
 * @param {ClassesManagementRow} row Test fixture row.
 * @returns {RowMutationResult<ClassesManagementRow, unknown>} Rejected result object.
 */
function rejectedResult(
  row: ClassesManagementRow
): RowMutationResult<ClassesManagementRow, unknown> {
  return { status: 'rejected', row, error: new Error('Mutation failed for ' + row.classId) };
}

const fulfilledA = fulfilledResult(rowA);
const fulfilledB = fulfilledResult(rowB);
const rejectedA = rejectedResult(rowA);
const rejectedB = rejectedResult(rowB);

const testFailureCopy: FixtureFailureCopy = {
  singleFailure: 'Single failure message.',
  allFailure: (totalCount: number) => `All ${totalCount} failed.`,
  partialFailure: (failedCount: number, totalCount: number) =>
    `${failedCount} of ${totalCount} failed.`,
  partialRefreshFailure: (failedCount: number, totalCount: number) =>
    `${failedCount} of ${totalCount} failed and refresh failed.`,
};

const testTopLevelCopy: FixtureTopLevelCopy = {
  createFailureMessage: (failedCount: number, totalCount: number, hasRefreshFailure: boolean) =>
    `Top-level: ${failedCount}/${totalCount}${hasRefreshFailure ? ' (refresh)' : ''}`,
  fullFailureTitle: 'Everything failed',
  partialFailureTitle: 'Some things failed',
};

/**
 * Builds a success refresh outcome for test assertions.
 *
 * @param {RowMutationResult<ClassesManagementRow, unknown>[]} results Batch results.
 * @returns {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>}
 *   Success refresh outcome with the given results.
 */
function successOutcome(
  results: RowMutationResult<ClassesManagementRow, unknown>[]
): RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return {
    mutationResult: results,
    mutationStatus: 'success' as const,
    refreshStatus: 'success' as const,
  };
}

/**
 * Builds a refresh-failure outcome for test assertions.
 *
 * @param {RowMutationResult<ClassesManagementRow, unknown>[]} results Batch results.
 * @returns {RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]>}
 *   Refresh-failure outcome with the given results and RATE_LIMITED error.
 */
function refreshFailureOutcome(
  results: RowMutationResult<ClassesManagementRow, unknown>[]
): RequiredClassPartialsRefreshOutcome<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return {
    mutationResult: results,
    mutationStatus: 'success' as const,
    refreshError: { code: 'RATE_LIMITED' },
    refreshStatus: 'failed' as const,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getRejectedRowResults', () => {
  it('returns only rejected results from a mixed array', () => {
    const mixed: RowMutationResult<ClassesManagementRow, unknown>[] = [
      fulfilledA,
      rejectedA,
      fulfilledB,
      rejectedB,
    ];

    const result = getRejectedRowResults(mixed);

    expect(result).toHaveLength(COUNT_ALL_TWO);
    expect(result[0]).toMatchObject({ status: 'rejected', row: rowA });
    expect(result[1]).toMatchObject({ status: 'rejected', row: rowB });
  });
});

describe('hasAnyFulfilledRowResult', () => {
  it('returns true when at least one fulfilled result exists', () => {
    const mixed: RowMutationResult<ClassesManagementRow, unknown>[] = [fulfilledA, rejectedA];

    expect(hasAnyFulfilledRowResult(mixed)).toBe(true);
  });

  it('returns false when all results are rejected', () => {
    const allRejected: RowMutationResult<ClassesManagementRow, unknown>[] = [rejectedA, rejectedB];

    expect(hasAnyFulfilledRowResult(allRejected)).toBe(false);
  });
});

describe('getBulkOutcomeTitle', () => {
  it('returns the full-failure title when failed count equals total', () => {
    const title = getBulkOutcomeTitle(
      COUNT_ALL_THREE,
      COUNT_ALL_THREE,
      'Full failure title',
      'Partial failure title'
    );

    expect(title).toBe('Full failure title');
  });

  it('returns the partial-failure title when failed count is less than total', () => {
    const title = getBulkOutcomeTitle(
      COUNT_PARTIAL_TWO,
      TOTAL_FIVE,
      'Full failure title',
      'Partial failure title'
    );

    expect(title).toBe('Partial failure title');
  });
});

describe('createBulkFailureMessage', () => {
  it('returns the all-failure copy when all rows failed and total > 1', () => {
    const message = createBulkFailureMessage(
      COUNT_ALL_THREE,
      COUNT_ALL_THREE,
      false,
      testFailureCopy
    );

    expect(message).toBe('All 3 failed.');
  });

  it('returns the single-failure copy when exactly one row failed', () => {
    const message = createBulkFailureMessage(1, 1, false, testFailureCopy);

    expect(message).toBe('Single failure message.');
  });

  it('returns the partial-failure copy when some rows failed and no refresh failure', () => {
    const message = createBulkFailureMessage(COUNT_PARTIAL_TWO, TOTAL_FIVE, false, testFailureCopy);

    expect(message).toBe('2 of 5 failed.');
  });

  it('returns the partial-refresh-failure copy when a refresh failure exists alongside failures', () => {
    const message = createBulkFailureMessage(COUNT_PARTIAL_TWO, TOTAL_FIVE, true, testFailureCopy);

    expect(message).toBe('2 of 5 failed and refresh failed.');
  });
});

describe('createBulkCreateFailureMessage', () => {
  it('returns action-specific copy for create failures', () => {
    const message = createBulkCreateFailureMessage(COUNT_PARTIAL_TWO, TOTAL_THREE, false);

    expect(message).toBe(
      '2 of 3 selected classes could not be created. Successful rows were refreshed. Please review the remaining selection and try again.'
    );
  });
});

describe('createBulkDeleteFailureMessage', () => {
  it('returns action-specific copy for delete failures', () => {
    const message = createBulkDeleteFailureMessage(1, COUNT_ALL_FOUR, false);

    expect(message).toBe(
      '1 of 4 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.'
    );
  });
});

describe('createBulkSetActiveFailureMessage', () => {
  it('returns action-specific copy for set-active failures with partial failure and refresh failure', () => {
    const message = createBulkSetActiveFailureMessage(COUNT_PARTIAL_TWO, TOTAL_FIVE, true);

    expect(message).toBe(
      '2 of 5 selected classes could not be set to active. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.'
    );
  });
});

describe('createBulkSetInactiveFailureMessage', () => {
  it('returns action-specific copy for set-inactive failures', () => {
    const message = createBulkSetInactiveFailureMessage(1, 1, false);

    expect(message).toBe(
      'Unable to set the selected class to inactive. Please review the remaining selection and try again.'
    );
  });
});

// Note: createBulkSetCohortFailureMessage, createBulkSetYearGroupFailureMessage, and
// createBulkSetCourseLengthFailureMessage are not extracted as standalone functions.
// All metadata bulk actions (cohort, year group, course length) use the generic
// createBulkMetadataFailureMessage instead.

describe('createBulkMetadataFailureMessage', () => {
  it('delegates to createBulkFailureMessage with metadata-specific copy', () => {
    const message = createBulkMetadataFailureMessage(1, 1, false);

    expect(message).toBe(
      'Unable to update the selected class. Please review the remaining selection and try again.'
    );
  });

  it('returns all-failure metadata copy for multiple failed rows', () => {
    const message = createBulkMetadataFailureMessage(COUNT_ALL_THREE, COUNT_ALL_THREE, false);

    expect(message).toBe(
      'Unable to update any of the 3 selected classes. Please review the remaining selection and try again.'
    );
  });

  it('returns partial-failure metadata copy with refresh-failure suffix', () => {
    const message = createBulkMetadataFailureMessage(COUNT_PARTIAL_TWO, TOTAL_THREE, true);

    expect(message).toBe(
      '2 of 3 selected classes could not be updated. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.'
    );
  });
});

describe('buildTopLevelBulkMutationResolution', () => {
  it('returns a full-failure alert when all rows failed', () => {
    const result = buildTopLevelBulkMutationResolution(
      successOutcome([rejectedA, rejectedB]),
      testTopLevelCopy
    );

    expect(result.alert).not.toBeNull();
    expect(result.alert!.type).toBe('error');
    expect(result.alert!.title).toBe('Everything failed');
    expect(result.refreshRequiredMessage).toBeNull();
    expect(result.shouldCloseSurface).toBe(true);
  });

  it('returns a partial-failure warning when some rows failed', () => {
    const result = buildTopLevelBulkMutationResolution(
      successOutcome([fulfilledA, rejectedA]),
      testTopLevelCopy
    );

    expect(result.alert).not.toBeNull();
    expect(result.alert!.type).toBe('warning');
    expect(result.alert!.title).toBe('Some things failed');
    expect(result.refreshRequiredMessage).toBeNull();
    expect(result.shouldCloseSurface).toBe(true);
  });

  it('returns no alert and clears selection when all rows succeeded', () => {
    const result = buildTopLevelBulkMutationResolution(
      successOutcome([fulfilledA, fulfilledB]),
      testTopLevelCopy
    );

    expect(result.alert).toBeNull();
    expect(result.selectedRowKeys).toEqual([]);
    expect(result.suppressStaleTableData).toBe(false);
    expect(result.shouldCloseSurface).toBe(true);
  });

  it('returns the refresh-required message and suppresses stale data on refresh failure', () => {
    const result = buildTopLevelBulkMutationResolution(
      refreshFailureOutcome([fulfilledA, rejectedA]),
      testTopLevelCopy
    );

    expect(result.alert).not.toBeNull();
    expect(result.alert!.type).toBe('warning');
    expect(result.refreshRequiredMessage).toBe(
      'The classes are busy updating right now. Please try again shortly.'
    );
    expect(result.suppressStaleTableData).toBe(true);
  });

  it('preserves selectedRowKeys from rejected rows', () => {
    const result = buildTopLevelBulkMutationResolution(
      successOutcome([fulfilledA, rejectedA, fulfilledB, rejectedB]),
      testTopLevelCopy
    );

    expect(result.selectedRowKeys).toEqual(['class-a', 'class-b']);
  });
});

describe('buildMetadataBulkMutationResolution', () => {
  it('returns all-failure outcome with panel-level alert and shouldCloseModal true', () => {
    const result = buildMetadataBulkMutationResolution(successOutcome([rejectedA, rejectedB]));

    expect(result.alert).not.toBeNull();
    expect(result.alert!.type).toBe('error');
    expect(result.alert!.title).toBe('Could not update selected classes.');
    expect(result.alert!.description).toContain('Unable to update any of the 2 selected classes');
    expect(result).not.toHaveProperty('errorMessage');
    expect(result.shouldCloseModal).toBe(true);
    expect(result.selectedRowKeys).toEqual(['class-a', 'class-b']);
  });

  it('returns partial-failure outcome with alert set and shouldCloseModal true', () => {
    const result = buildMetadataBulkMutationResolution(successOutcome([fulfilledA, rejectedA]));

    expect(result.alert).not.toBeNull();
    expect(result.alert!.type).toBe('warning');
    expect(result.alert!.title).toBe('Some selected classes were not updated.');
    expect(result).not.toHaveProperty('errorMessage');
    expect(result.shouldCloseModal).toBe(true);
    expect(result.selectedRowKeys).toEqual(['class-a']);
  });
});
