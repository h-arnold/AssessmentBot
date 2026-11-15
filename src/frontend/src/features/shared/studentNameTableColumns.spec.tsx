import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';

import { StudentAveragesTableCard } from '../classPage/StudentAveragesTableCard';
import { TaskHeatmapTable } from '../taskHeatmap/TaskHeatmapTable';
import type { StudentAverageRowModel } from '../classPage/classPageAdapter.zod';
import { buildStudentNameColumns } from './studentNameTableColumns';
import { requireElement, resolveStickyTables } from '@/test/shared/domGuards';
import {
  buildStudentAverageRow,
  createClassPageAdapterResult,
} from '@/test/classPage/classPageFixtures';
import { buildCell, buildHeatmapResult } from '@/test/taskHeatmapTableTestHelpers';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME } from '@/theme/spacing';

const STUDENT_NAME_COLUMN_COUNT = 2;
const CLASS_AVERAGE_ROW = buildStudentAverageRow({
  studentId: 'student-alice',
  studentName: 'Alice Smith',
});

afterEach(() => {
  cleanup();
});

/**
 * Resolve the Student Averages and Task Heatmap table wrappers from a render
 * that contains both tables.
 *
 * The Student Averages table is the one inside the card; the Task Heatmap
 * table is rendered outside any card. Resolving the wrappers this way keeps
 * each half attributable without counting wrappers.
 *
 * @param {HTMLElement} container - The container returned by `render`.
 * @returns {Readonly<{ studentAveragesWrapper: HTMLElement; heatmapWrapper: HTMLElement }>} The two table wrappers.
 */
function resolveTableWrappers(container: HTMLElement): {
  studentAveragesWrapper: HTMLElement;
  heatmapWrapper: HTMLElement;
} {
  const tableWrappers = [...container.querySelectorAll('.ant-table-wrapper')];
  const studentAveragesWrapper = requireElement(
    tableWrappers.find((wrapper) => wrapper.closest('.ant-card')) ?? null,
    'Expected the Student Averages table wrapper inside its card.'
  );
  const heatmapWrapper = requireElement(
    tableWrappers.find((wrapper) => !wrapper.closest('.ant-card')) ?? null,
    'Expected the Task Heatmap table wrapper outside the card.'
  );

  return { studentAveragesWrapper, heatmapWrapper };
}

describe('shared student-name table column presentation', () => {
  it('keeps split-name headers, widths, and rendered values aligned across the Student Averages and Task Heatmap tables', () => {
    const { container } = render(
      <>
        <StudentAveragesTableCard
          adapterResult={createClassPageAdapterResult({ studentAverages: [CLASS_AVERAGE_ROW] })}
        />
        <TaskHeatmapTable
          heatmapResult={buildHeatmapResult({
            rows: [
              {
                studentId: CLASS_AVERAGE_ROW.studentId,
                studentName: CLASS_AVERAGE_ROW.studentName,
                cells: [buildCell(), buildCell()],
              },
            ],
          })}
          cellPreviewLookup={null}
          isAssignmentLoading={false}
          showAssignmentError={false}
        />
      </>
    );

    // Both tables render sticky, so each splits into a header table and a body
    // table. Never resolve either by accessible name: Ant Design copies each
    // source label onto both halves, and the Student Averages label is also the
    // card title.
    const { studentAveragesWrapper, heatmapWrapper } = resolveTableWrappers(container);
    const studentAverages = resolveStickyTables(studentAveragesWrapper, 'Student Averages');
    const heatmap = resolveStickyTables(heatmapWrapper, 'Task Heatmap');

    const studentForename = within(studentAverages.headerTable).getByRole('columnheader', {
      name: 'Forename',
    });
    const heatmapForename = within(heatmap.headerTable).getByRole('columnheader', {
      name: 'Forename',
    });
    const studentSurname = within(studentAverages.headerTable).getByRole('columnheader', {
      name: 'Surname',
    });
    const heatmapSurname = within(heatmap.headerTable).getByRole('columnheader', {
      name: 'Surname',
    });

    expect(studentForename).toHaveTextContent('Forename');
    expect(heatmapForename).toHaveTextContent('Forename');
    expect(studentSurname).toHaveTextContent('Surname');
    expect(heatmapSurname).toHaveTextContent('Surname');

    // Anchor the width probe to each body table so the header colgroup is not
    // measured by mistake.
    const studentNameColumnWidths = [...studentAverages.bodyTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);
    const heatmapNameColumnWidths = [...heatmap.bodyTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);

    expect(studentNameColumnWidths).toEqual([
      `${APP_COL_WIDTH_FORENAME}px`,
      `${APP_COL_WIDTH_SURNAME}px`,
    ]);
    expect(heatmapNameColumnWidths).toEqual(studentNameColumnWidths);

    // Data rows live in the body table, not the header table.
    const studentDataRow = requireElement(
      studentAverages.bodyTable.querySelector(':scope tbody tr[data-row-key]'),
      'Expected both student-name tables to render a data row.'
    );
    const heatmapDataRow = requireElement(
      heatmap.bodyTable.querySelector(':scope tbody tr[data-row-key]'),
      'Expected both student-name tables to render a data row.'
    );
    const studentNameValues = within(studentDataRow)
      .getAllByRole('cell')
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((cell) => cell.textContent);
    const heatmapNameValues = within(heatmapDataRow)
      .getAllByRole('cell')
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((cell) => cell.textContent);

    expect(studentNameValues).toEqual(['Alice', 'Smith']);
    expect(heatmapNameValues).toEqual(studentNameValues);
  });
});

describe('shared student-name column builder', () => {
  it('always marks Forename and Surname as fixed start columns without changing their contract', () => {
    const columns = buildStudentNameColumns<StudentAverageRowModel>();

    expect(columns).toHaveLength(STUDENT_NAME_COLUMN_COUNT);
    expect(columns.map((column) => column.key)).toEqual(['forename', 'surname']);

    const forenameColumn = columns.find((column) => column.key === 'forename');
    const surnameColumn = columns.find((column) => column.key === 'surname');
    if (!forenameColumn || !surnameColumn) {
      throw new TypeError('Expected the shared builder to return Forename and Surname columns.');
    }

    expect(forenameColumn).toMatchObject({
      key: 'forename',
      title: 'Forename',
      fixed: 'start',
      width: APP_COL_WIDTH_FORENAME,
    });
    expect(surnameColumn).toMatchObject({
      key: 'surname',
      title: 'Surname',
      fixed: 'start',
      width: APP_COL_WIDTH_SURNAME,
    });
    expect(forenameColumn.defaultSortOrder).toBeUndefined();
    expect(surnameColumn.defaultSortOrder).toBeUndefined();
  });
});
