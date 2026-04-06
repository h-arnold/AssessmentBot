/**
 * Bulk delete flow — unit tests.
 *
 * Covers: confirmation copy explicitly naming both full and partial record removal,
 * and the modal confirm/cancel callback wiring.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkDeleteModal, type BulkDeleteModalProperties } from './BulkDeleteModal';
import type { ClassTableRow } from './bulkCreateFlow';

const TWO_SELECTED_ROWS = 2;

/**
 * Builds a test ClassTableRow with sensible defaults and optional overrides.
 *
 * @param {Partial<ClassTableRow>} overrides Field overrides for the returned row.
 * @returns {ClassTableRow} The composed test row.
 */
function makeRow(overrides: Partial<ClassTableRow> = {}): ClassTableRow {
  return {
    rowKey: 'row-001',
    status: 'partial',
    classId: 'class-001',
    cohortKey: '2025',
    yearGroupKey: 10,
    courseLength: 1,
    active: null,
    className: 'Year 10 Maths',
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
      selectedRows: [makeRow({ rowKey: 'r1' }), makeRow({ rowKey: 'r2' })],
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
