/**
 * Bulk active-state flow — unit tests.
 *
 * Covers: canonical row-contract eligibility for active/inactive transitions,
 * the ineligible row states that must stay excluded, and panel-level handler
 * integration with runQueuedBatchMutation.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterEligibleForActiveState } from './bulkActiveStateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '../../../test/classes/classesTestHelpers';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const classesManagementStateMock = vi.fn();
const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());
const runQueuedBulkActionMock = vi.fn(
  async ({ mutate, onComplete }: { mutate: (onProgress: (snapshot: BatchProgressSnapshot) => void) => Promise<unknown[]>; onComplete: (results: unknown[]) => Promise<void> }) => {
    const results = await mutate(vi.fn());
    await onComplete(results);
  },
);

vi.mock('../../services/apiService', () => {
  return {
    callApi: vi.fn(),
  };
});

vi.mock('../useClassesManagement', () => {
  return {
    useClassesManagement: classesManagementStateMock,
  };
});

vi.mock('./runQueuedBatchMutation', () => {
  return {
    runQueuedBatchMutation: runQueuedBatchMutationMock,
  };
});

vi.mock('../useClassesBulkMutationQueue', () => {
  return {
    useClassesBulkMutationQueue: () => {
      return {
        isQueueActive: false,
        progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
        isProgressModalOpen: false,
        onDismissProgressModal: vi.fn(),
        onCancelQueue: vi.fn(),
        runQueuedBulkAction: runQueuedBulkActionMock,
      };
    },
  };
});

vi.mock('./BulkCreateModal', () => {
  return {
    BulkCreateModal() { return null; },
  };
});

vi.mock('./BulkDeleteModal', () => {
  return {
    BulkDeleteModal() { return null; },
  };
});

vi.mock('./BulkSetSelectModal', () => {
  return {
    BulkSetSelectModal() { return null; },
  };
});

vi.mock('./BulkSetCourseLengthModal', () => {
  return {
    BulkSetCourseLengthModal() { return null; },
  };
});

vi.mock('../referenceData/ManageCohortsModal', () => {
  return {
    ManageCohortsModal() { return null; },
  };
});

vi.mock('../referenceData/ManageYearGroupsModal', () => {
  return {
    ManageYearGroupsModal() { return null; },
  };
});

/**
 * Builds a canonical classes-management row for active-state flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Year 10 Maths',
    status: 'active',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 1,
    active: true,
    ...overrides,
  };
}

describe('filterEligibleForActiveState', () => {
  it('keeps active and inactive rows eligible while excluding orphaned and notCreated rows', () => {
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'active-1', status: 'active', active: true }),
      makeRow({ classId: 'inactive-1', status: 'inactive', active: false }),
      makeRow({ classId: 'orphaned-1', status: 'orphaned', active: false }),
      makeRow({ classId: 'missing-1', status: 'notCreated', active: null, cohortKey: null, cohortLabel: null, yearGroupKey: null, yearGroupLabel: null, courseLength: null }),
    ];

    const eligibleForActivate = filterEligibleForActiveState(rows, true);
    const eligibleForDeactivate = filterEligibleForActiveState(rows, false);

    expect(eligibleForActivate.map((row) => row.classId)).toEqual(['inactive-1']);
    expect(eligibleForDeactivate.map((row) => row.classId)).toEqual(['active-1']);
  });
});

/**
 * Loads and renders the panel with shared frontend providers.
 *
 * @returns {Promise<void>} Completion signal.
 */
async function renderPanel() {
  const { ClassesManagementPanel } = await import('../ClassesManagementPanel');
  return renderWithFrontendProviders(<ClassesManagementPanel />);
}

describe('bulk active-state handler integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls runQueuedBatchMutation with correct items when setting active', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildClassesManagementState({
        onSelectedRowKeysChange,
        selectedRowKeys: ['inactive-1'],
      }),
    );
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('inactive-1'),
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set active' }));

    await waitFor(() => {
      expect(runQueuedBatchMutationMock).toHaveBeenCalled();
    });

    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    expect(items).toHaveLength(1);
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('updateABClass');
    expect(firstItem.verb).toBe('Activating');
  });

  it('calls runQueuedBatchMutation with correct items when setting inactive', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildClassesManagementState({
        onSelectedRowKeysChange,
        selectedRowKeys: ['active-1'],
      }),
    );
    runQueuedBatchMutationMock.mockResolvedValue([
      createRejectedClassResult('active-1'),
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Set inactive' }));

    await waitFor(() => {
      expect(runQueuedBatchMutationMock).toHaveBeenCalled();
    });

    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    expect(items).toHaveLength(1);
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('updateABClass');
    expect(firstItem.verb).toBe('Deactivating');
  });
});
