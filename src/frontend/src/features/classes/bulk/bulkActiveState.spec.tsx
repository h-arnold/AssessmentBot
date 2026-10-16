/**
 * Bulk active-state flow — unit tests.
 *
 * Covers: canonical row-contract eligibility for active/inactive transitions,
 * the ineligible row states that must stay excluded, and panel-level handler
 * integration with runQueuedBatchMutation.
 */

import '@/test/classes/bulkPanel.mockSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterEligibleForActiveState } from './bulkActiveStateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
  createRejectedClassResult,
} from '@/test/classes/classesTestHelpers';
import { makeRow as sharedMakeRow } from '@/test/classes/bulkFlowTestHelpers';
import { useClassesManagement } from '../useClassesManagement';
import { runQueuedBatchMutation } from './runQueuedBatchMutation';

const classesManagementStateMock = vi.mocked(useClassesManagement);
const runQueuedBatchMutationMock = vi.mocked(runQueuedBatchMutation);

/**
 * Builds a canonical classes-management row for active-state flow tests.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return sharedMakeRow({
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    courseLength: 1,
    ...overrides,
  });
}

describe('filterEligibleForActiveState', () => {
  it('keeps active and inactive rows eligible while excluding orphaned and notCreated rows', () => {
    const rows: ClassesManagementRow[] = [
      makeRow({ classId: 'active-1', status: 'active', active: true }),
      makeRow({ classId: 'inactive-1', status: 'inactive', active: false }),
      makeRow({ classId: 'orphaned-1', status: 'orphaned', active: false }),
      makeRow({
        classId: 'missing-1',
        status: 'notCreated',
        active: null,
        cohortKey: null,
        cohortLabel: null,
        yearGroupKey: null,
        yearGroupLabel: null,
        courseLength: null,
      }),
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
    vi.resetAllMocks();
  });

  it.each([
    {
      action: 'active',
      selectedRow: 'inactive-1',
      method: 'updateABClass',
      verb: 'Activating',
      button: 'Set active',
    },
    {
      action: 'inactive',
      selectedRow: 'active-1',
      method: 'updateABClass',
      verb: 'Deactivating',
      button: 'Set inactive',
    },
  ])(
    'calls runQueuedBatchMutation with correct items when setting $action',
    async ({ action, selectedRow, method, verb, button }) => {
      const onSelectedRowKeysChange = vi.fn();
      classesManagementStateMock.mockReturnValue(
        buildClassesManagementState({
          onSelectedRowKeysChange,
          selectedRowKeys: [selectedRow],
        })
      );
      runQueuedBatchMutationMock.mockResolvedValue([
        action === 'active'
          ? createFulfilledClassResult(selectedRow)
          : createRejectedClassResult(selectedRow),
      ]);

      const { queryClient } = await renderPanel();
      vi.spyOn(queryClient, 'invalidateQueries');

      fireEvent.click(screen.getByRole('button', { name: button }));

      await waitFor(() => {
        expect(runQueuedBatchMutationMock).toHaveBeenCalled();
      });

      const [items] = runQueuedBatchMutationMock.mock.calls[0];
      expect(items).toHaveLength(1);
      const firstItem = items[0];
      expect(firstItem.method).toBe(method);
      expect(firstItem.verb).toBe(verb);
    }
  );
});
