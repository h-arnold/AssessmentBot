/**
 * Bulk delete flow — unit tests.
 *
 * Covers: confirmation copy explicitly naming both full and partial record removal,
 * the modal confirm/cancel callback wiring, and panel-level delete handler
 * integration with runQueuedBatchMutation.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BulkDeleteModal, type BulkDeleteModalProperties } from './BulkDeleteModal';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
} from '../../../test/classes/classesTestHelpers';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

const TWO_SELECTED_ROWS = 2;

const classesManagementStateMock = vi.fn();
const runQueuedBatchMutationMock = vi.hoisted(() => vi.fn());
const runQueuedBulkActionMock = vi.fn(
  async ({ mutate, onComplete }: { mutate: (onProgress: (snapshot: BatchProgressSnapshot) => void) => Promise<unknown[]>; onComplete: (results: unknown[]) => Promise<void> }) => {
    const results = await mutate(vi.fn());
    await onComplete(results);
  },
);

vi.mock('../../services/apiService', () => ({
  callApi: vi.fn(),
}));

vi.mock('../useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./runQueuedBatchMutation', () => ({
  runQueuedBatchMutation: runQueuedBatchMutationMock,
}));

vi.mock('../useClassesBulkMutationQueue', () => ({
  useClassesBulkMutationQueue: () => ({
    isQueueActive: false,
    progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
    isProgressModalOpen: false,
    onDismissProgressModal: vi.fn(),
    onCancelQueue: vi.fn(),
    runQueuedBulkAction: runQueuedBulkActionMock,
  }),
}));

vi.mock('./BulkCreateModal', () => ({
  BulkCreateModal() { return null; },
}));

vi.mock('./BulkSetSelectModal', () => ({
  BulkSetSelectModal() { return null; },
}));

vi.mock('./BulkSetCourseLengthModal', () => ({
  BulkSetCourseLengthModal() { return null; },
}));

vi.mock('../referenceData/ManageCohortsModal', () => ({
  ManageCohortsModal() { return null; },
}));

vi.mock('../referenceData/ManageYearGroupsModal', () => ({
  ManageYearGroupsModal() { return null; },
}));

/**
 * Builds a test ClassesManagementRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return {
    classId: 'class-001',
    className: 'Year 10 Maths',
    status: 'active',
    cohortKey: '2025',
    cohortLabel: 'Cohort 2025',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    courseLength: 1,
    active: true,
    ...overrides,
  };
}

/**
 * Renders the BulkDeleteModal within a test environment with sensible default props.
 *
 * @param {Partial<BulkDeleteModalProperties>} properties Optional property overrides.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderBulkDeleteModal(properties: Partial<BulkDeleteModalProperties> = {}) {
  const defaultProperties: BulkDeleteModalProperties = {
    open: true,
    selectedRows: [makeRow()],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...properties,
  };

  return render(<BulkDeleteModal {...defaultProperties} />);
}

describe('BulkDeleteModal', () => {
  it('renders confirmation copy that explicitly mentions full records being removed', () => {
    renderBulkDeleteModal();

    expect(screen.getByRole('dialog')).toHaveTextContent(/full/i);
  });

  it('renders confirmation copy that explicitly mentions partial records being removed', () => {
    renderBulkDeleteModal();

    expect(screen.getByRole('dialog')).toHaveTextContent(/partial/i);
  });

  it('shows the count of selected rows to be deleted', () => {
    renderBulkDeleteModal({
      selectedRows: [makeRow({ classId: 'class-001' }), makeRow({ classId: 'class-002' })],
    });

    expect(screen.getByRole('dialog')).toHaveTextContent(String(TWO_SELECTED_ROWS));
  });

  it('calls onConfirm when the confirm action is triggered', () => {
    const onConfirm = vi.fn();
    renderBulkDeleteModal({ onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel action is triggered', () => {
    const onCancel = vi.fn();
    renderBulkDeleteModal({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render the dialog when open is false', () => {
    renderBulkDeleteModal({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('bulk delete handler integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
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

  it('calls runQueuedBatchMutation with correct items when deleting', async () => {
    const onSelectedRowKeysChange = vi.fn();
    classesManagementStateMock.mockReturnValue(
      buildClassesManagementState({
        onSelectedRowKeysChange,
        selectedRowKeys: ['active-1', 'orphaned-1'],
      }),
    );
    runQueuedBatchMutationMock.mockResolvedValue([
      createFulfilledClassResult('active-1'),
      createFulfilledClassResult('orphaned-1'),
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Delete ABClass' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(runQueuedBatchMutationMock).toHaveBeenCalled();
    });

    const [items] = runQueuedBatchMutationMock.mock.calls[0] as [unknown[]];
    expect(items).toHaveLength(TWO_SELECTED_ROWS);
    const firstItem = items[0] as Record<string, unknown>;
    expect(firstItem.method).toBe('deleteABClass');
    expect(firstItem.verb).toBe('Deleting');
  });
});
