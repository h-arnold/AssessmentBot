import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Table } from 'antd';

import { TaskHeatmapTable } from '../taskHeatmap/TaskHeatmapTable';
import { buildStudentAveragesTableColumns } from '../classPage/studentAveragesTableColumns';
import type { StudentAverageRowModel } from '../classPage/classPageAdapter.zod';
import { buildStudentNameColumns } from './studentNameTableColumns';
import { createComputedMetricResult } from '@/test/dataAnalysis/fixtures';
import { requireElement, requireTableElement } from '@/test/shared/domGuards';
import { buildCell, buildHeatmapResult } from '@/test/taskHeatmapTableTestHelpers';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME } from '@/theme/spacing';

const EMPTY_FILTERS = {
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
} as const;
const COMPUTED_SCORE = 4;
const STUDENT_NAME_COLUMN_COUNT = 2;
const STUDENT_TABLE_COUNT = 2;
/** Index of the final element when reading from the end. */
const LAST_ELEMENT_INDEX = -1;
const CLASS_AVERAGE_ROW = {
  studentId: 'student-alice',
  studentName: 'Alice Smith',
  metrics: {
    completeness: createComputedMetricResult({ value: COMPUTED_SCORE }),
    accuracy: createComputedMetricResult({ value: COMPUTED_SCORE }),
    spag: createComputedMetricResult({ value: COMPUTED_SCORE }),
    average: createComputedMetricResult({ value: COMPUTED_SCORE }),
  },
} satisfies StudentAverageRowModel;

afterEach(() => {
  cleanup();
});

/**
 * Resolve the sticky Task Heatmap header and body tables from the rendered
 * wrapper, avoiding the duplicated accessible name on both halves.
 *
 * @param {HTMLElement} container - The container returned by `render`.
 * @returns {Readonly<{ headerTable: HTMLTableElement; bodyTable: HTMLTableElement }>} The split tables.
 */
function resolveStickyHeatmapTables(container: HTMLElement): {
  headerTable: HTMLTableElement;
  bodyTable: HTMLTableElement;
} {
  const tableWrappers = container.querySelectorAll('.ant-table-wrapper');

  if (tableWrappers.length !== STUDENT_TABLE_COUNT) {
    throw new TypeError('Expected exactly two rendered table wrappers.');
  }

  const heatmapWrapper = requireElement(
    [...tableWrappers].at(LAST_ELEMENT_INDEX) ?? null,
    'Expected exactly two rendered table wrappers.'
  );
  const headerHolder = requireElement(
    heatmapWrapper.querySelector('.ant-table-header.ant-table-sticky-holder'),
    'Expected the sticky Task Heatmap header holder.'
  );
  const body = requireElement(
    heatmapWrapper.querySelector('.ant-table-body'),
    'Expected the sticky Task Heatmap body.'
  );
  const headerTable = requireTableElement(
    headerHolder.querySelector('table'),
    'Expected the sticky Task Heatmap header table.'
  );
  const bodyTable = requireTableElement(
    body.querySelector('table'),
    'Expected the sticky Task Heatmap body table.'
  );

  return { headerTable, bodyTable };
}

describe('shared student-name table column presentation', () => {
  it('keeps split-name headers, widths, and rendered values aligned across Class and Heatmap tables', () => {
    const { container } = render(
      <>
        <Table<StudentAverageRowModel>
          aria-label="Student averages table"
          columns={buildStudentAveragesTableColumns(EMPTY_FILTERS)}
          dataSource={[CLASS_AVERAGE_ROW]}
          rowKey="studentId"
          pagination={false}
          size="small"
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

    // The Class-side table is rendered without `sticky` or `scroll`, so it
    // stays a single named table. The Task Heatmap is sticky and splits into a
    // header table and a body table; never resolve it by accessible name,
    // because Ant Design copies `aria-label="Task Heatmap"` onto both halves.
    const classTable = screen.getByRole('table', { name: 'Student averages table' });
    const { headerTable: heatmapHeaderTable, bodyTable: heatmapBodyTable } =
      resolveStickyHeatmapTables(container);

    const classForename = within(classTable).getByRole('columnheader', { name: 'Forename' });
    const heatmapForename = within(heatmapHeaderTable).getByRole('columnheader', {
      name: 'Forename',
    });
    const classSurname = within(classTable).getByRole('columnheader', { name: 'Surname' });
    const heatmapSurname = within(heatmapHeaderTable).getByRole('columnheader', {
      name: 'Surname',
    });

    expect(classForename).toHaveTextContent('Forename');
    expect(heatmapForename).toHaveTextContent('Forename');
    expect(classSurname).toHaveTextContent('Surname');
    expect(heatmapSurname).toHaveTextContent('Surname');
    const classNameColumnWidths = [...classTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);
    // Anchor the width probe to the body table so the header colgroup is not
    // measured by mistake.
    const heatmapNameColumnWidths = [...heatmapBodyTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);

    expect(classNameColumnWidths).toEqual([
      `${APP_COL_WIDTH_FORENAME}px`,
      `${APP_COL_WIDTH_SURNAME}px`,
    ]);
    expect(heatmapNameColumnWidths).toEqual(classNameColumnWidths);

    const classDataRow = requireElement(
      classTable.querySelector(':scope tbody tr[data-row-key]'),
      'Expected both student-name tables to render a data row.'
    );
    // Data rows live in the body table, not the header table.
    const heatmapDataRow = requireElement(
      heatmapBodyTable.querySelector(':scope tbody tr[data-row-key]'),
      'Expected both student-name tables to render a data row.'
    );
    const classNameValues = within(classDataRow)
      .getAllByRole('cell')
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((cell) => cell.textContent);
    const heatmapNameValues = within(heatmapDataRow)
      .getAllByRole('cell')
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((cell) => cell.textContent);

    expect(classNameValues).toEqual(['Alice', 'Smith']);
    expect(heatmapNameValues).toEqual(classNameValues);
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
