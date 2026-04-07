import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassesTable } from './ClassesTable';
import type { ClassesManagementRow } from './classesManagementViewModel';

const representativeRows: ClassesManagementRow[] = [
  {
    classId: 'class-001',
    className: 'alpha',
    status: 'active',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'class-002',
    className: 'Bravo',
    status: 'active',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupLabel: 'Year 11',
    active: false,
  },
  {
    classId: 'class-003',
    className: 'Charlie',
    status: 'inactive',
    cohortLabel: 'Cohort C',
    courseLength: 3,
    yearGroupLabel: 'Year 12',
    active: false,
  },
  {
    classId: 'gc/not-created:2024',
    className: 'delta',
    status: 'notCreated',
    cohortLabel: null,
    courseLength: null,
    yearGroupLabel: null,
    active: null,
  },
  {
    classId: 'orphaned::legacy',
    className: 'Echo',
    status: 'orphaned',
    cohortLabel: 'Legacy Cohort',
    courseLength: 4,
    yearGroupLabel: 'Year 13',
    active: false,
  },
];

/**
 * Reads rendered table row keys in visual order.
 *
 * @param {HTMLElement} container Rendered table container.
 * @returns {string[]} Row keys.
 */
function getRenderedRowKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tbody tr[data-row-key]')].map(
    (row) => (row as HTMLElement).dataset.rowKey ?? ''
  );
}

/**
 * Renders the classes table for one selection scenario.
 *
 * @param {string[]} selectedRowKeys Selected row identifiers.
 * @param {(selectedRowKeys: string[]) => void} [onSelectedRowKeysChange] Selection callback.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderClassesTable(
  selectedRowKeys: string[] = [],
  onSelectedRowKeysChange = vi.fn()
) {
  return {
    onSelectedRowKeysChange,
    ...render(
      <ClassesTable
        rows={representativeRows}
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
      />
    ),
  };
}

describe('ClassesTable', () => {
  it('renders representative active/inactive/notCreated/orphaned rows as explicit contracts', () => {
    renderClassesTable();

    expect(screen.getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('notCreated')).toBeInTheDocument();
    expect(screen.getByText('orphaned')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('Echo')).toBeInTheDocument();
  });

  it('uses each row classId as the exact rowKey value and reset returns deterministic default ordering', async () => {
    const { container } = renderClassesTable();

    const renderedKeys = getRenderedRowKeys(container);

    expect(renderedKeys).toEqual(representativeRows.map((row) => row.classId));

    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

    await waitFor(() => {
      expect(getRenderedRowKeys(container)).toEqual(representativeRows.map((row) => row.classId));
    });
  });

  it('notifies row selection changes and keeps deterministic order after sorter toggles', async () => {
    const { container, onSelectedRowKeysChange } = renderClassesTable();
    const table = screen.getByRole('table', { name: 'Classes table' });

    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

    await waitFor(() => {
      expect(getRenderedRowKeys(container)).toEqual(representativeRows.map((row) => row.classId));
    });

    fireEvent.click(within(table).getAllByRole('checkbox')[1]);

    expect(onSelectedRowKeysChange).toHaveBeenCalled();
  });
});
