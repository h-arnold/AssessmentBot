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
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import {
  buildClassesManagementState,
  createFulfilledClassResult,
} from '../../../test/classes/classesTestHelpers';
import type { ClassesManagementRow } from '../classesManagementViewModel';
import { makeRow as sharedMakeRow } from '../../../test/classes/bulkFlowTestHelpers';

const TWO_SELECTED_ROWS = 2;

const { classesManagementStateMock, runQueuedBatchMutationMock, runQueuedBulkActionMock } = await vi.hoisted(async () => {
  const { createBulkPanelMocks } = await import('../../../test/classes/bulkFlowTestHelpers');
  return await createBulkPanelMocks();
});

vi.mock('../../services/apiService', () => ({ callApi: vi.fn() }));
vi.mock('../useClassesManagement', () => ({ useClassesManagement: classesManagementStateMock }));
vi.mock('./runQueuedBatchMutation', () => ({ runQueuedBatchMutation: runQueuedBatchMutationMock }));
vi.mock('../useClassesBulkMutationQueue', async () => {
  const { createBulkQueueModuleMock } = await import('../../../test/classes/bulkFlowTestHelpers');
  return createBulkQueueModuleMock(runQueuedBulkActionMock);
});
vi.mock('./BulkCreateModal', async () => {
  const { BULK_PANEL_COMPONENT_MOCKS } = await import('../../../test/classes/bulkFlowTestHelpers');
  return BULK_PANEL_COMPONENT_MOCKS.bulkCreate;
});
vi.mock('./BulkSetSelectModal', async () => {
  const { BULK_PANEL_COMPONENT_MOCKS } = await import('../../../test/classes/bulkFlowTestHelpers');
  return BULK_PANEL_COMPONENT_MOCKS.bulkSetSelect;
});
vi.mock('./BulkSetCourseLengthModal', async () => {
  const { BULK_PANEL_COMPONENT_MOCKS } = await import('../../../test/classes/bulkFlowTestHelpers');
  return BULK_PANEL_COMPONENT_MOCKS.bulkSetCourseLength;
});
vi.mock('../referenceData/ManageCohortsModal', async () => {
  const { BULK_PANEL_COMPONENT_MOCKS } = await import('../../../test/classes/bulkFlowTestHelpers');
  return BULK_PANEL_COMPONENT_MOCKS.manageCohorts;
});
vi.mock('../referenceData/ManageYearGroupsModal', async () => {
  const { BULK_PANEL_COMPONENT_MOCKS } = await import('../../../test/classes/bulkFlowTestHelpers');
  return BULK_PANEL_COMPONENT_MOCKS.manageYearGroups;
});

/**
 * Builds a test ClassesManagementRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassesManagementRow>} overrides Field overrides for the returned row.
 * @returns {ClassesManagementRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassesManagementRow> = {}): ClassesManagementRow {
  return sharedMakeRow({
    cohortKey: '2025',
    cohortLabel: 'Cohort 2025',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    courseLength: 1,
    ...overrides,
  });
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

/**
 * Loads and renders the panel with shared frontend providers.
 *
 * @returns {Promise<void>} Completion signal.
 */
async function renderPanel() {
  const { ClassesManagementPanel } = await import('../ClassesManagementPanel');
  return renderWithFrontendProviders(<ClassesManagementPanel />);
}

describe('bulk delete handler integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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
