import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassesTable } from './ClassesTable';
import { statusCoverageRows } from '../../test/classes/classesTestHelpers';

/**
 * Reads rendered table row keys in visual order.
 *
 * @param {HTMLElement} container Rendered table container.
 * @returns {string[]} Row keys in displayed order.
 */
function getRenderedRowKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr[data-row-key]')].map(
    (row) => (row as HTMLElement).dataset.rowKey ?? '',
  );
}

/**
 * Renders the table against the shared classes status-coverage rows.
 *
 * @param {string[]} [selectedRowKeys] Selected row identifiers.
 * @param {(selectedRowKeys: string[]) => void} [onSelectedRowKeysChange] Selection callback.
 * @returns {{ onSelectedRowKeysChange: typeof onSelectedRowKeysChange } & ReturnType<typeof render>} Render result plus selection spy.
 */
function renderClassesTable(
  selectedRowKeys: string[] = [],
  onSelectedRowKeysChange = vi.fn(),
) {
  return {
    onSelectedRowKeysChange,
    ...render(
      <ClassesTable
        rows={statusCoverageRows}
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
      />,
    ),
  };
}

describe('ClassesTable', () => {
  it('renders representative active/inactive/notCreated/orphaned rows as explicit contracts', () => {
    renderClassesTable();

    expect(screen.getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('notCreated')).toBeInTheDocument();
    expect(screen.getByText('orphaned')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('Echo')).toBeInTheDocument();
  });

  it('uses each row classId as the exact rowKey value and reset returns deterministic default ordering', async () => {
    const { container } = renderClassesTable();
    const expectedRowKeys = statusCoverageRows.map((row) => row.classId);

    expect(getRenderedRowKeys(container)).toEqual(expectedRowKeys);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

    await waitFor(() => {
      expect(getRenderedRowKeys(container)).toEqual(expectedRowKeys);
    });
  });

  it('notifies row selection changes and keeps deterministic order after sorter toggles', async () => {
    const { container, onSelectedRowKeysChange } = renderClassesTable();
    const table = screen.getByRole('table', { name: 'Classes table' });
    const expectedRowKeys = statusCoverageRows.map((row) => row.classId);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

    await waitFor(() => {
      expect(getRenderedRowKeys(container)).toEqual(expectedRowKeys);
    });

    fireEvent.click(within(table).getAllByRole('checkbox')[1]);

    expect(onSelectedRowKeysChange).toHaveBeenCalled();
  });
});
