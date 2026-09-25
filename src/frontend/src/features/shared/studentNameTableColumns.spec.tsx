import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Table } from 'antd';

import { TaskHeatmapTable } from '../taskHeatmap/TaskHeatmapTable';
import { buildStudentAveragesTableColumns } from '../classPage/studentAveragesTableColumns';
import type { StudentAverageRowModel } from '../classPage/classPageAdapter.zod';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';
import { buildCell, buildHeatmapResult } from '../../test/taskHeatmapTableTestHelpers';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME } from '../../theme/spacing';

const EMPTY_FILTERS = {
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
} as const;
const COMPUTED_SCORE = 4;
const STUDENT_NAME_COLUMN_COUNT = 2;
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

describe('shared student-name table column presentation', () => {
  it('keeps split-name headers, widths, and rendered values aligned across Class and Heatmap tables', () => {
    render(
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

    const classTable = screen.getByRole('table', { name: 'Student averages table' });
    const heatmapTable = screen.getByRole('table', { name: 'Task Heatmap' });
    const classForename = within(classTable).getByRole('columnheader', { name: 'Forename' });
    const heatmapForename = within(heatmapTable).getByRole('columnheader', { name: 'Forename' });
    const classSurname = within(classTable).getByRole('columnheader', { name: 'Surname' });
    const heatmapSurname = within(heatmapTable).getByRole('columnheader', { name: 'Surname' });

    expect(classForename).toHaveTextContent('Forename');
    expect(heatmapForename).toHaveTextContent('Forename');
    expect(classSurname).toHaveTextContent('Surname');
    expect(heatmapSurname).toHaveTextContent('Surname');
    const classNameColumnWidths = [...classTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);
    const heatmapNameColumnWidths = [...heatmapTable.querySelectorAll('col')]
      .slice(0, STUDENT_NAME_COLUMN_COUNT)
      .map((column) => (column as HTMLElement).style.width);

    expect(classNameColumnWidths).toEqual([
      `${APP_COL_WIDTH_FORENAME}px`,
      `${APP_COL_WIDTH_SURNAME}px`,
    ]);
    expect(heatmapNameColumnWidths).toEqual(classNameColumnWidths);

    const classDataRow = classTable.querySelector('tbody tr[data-row-key]');
    const heatmapDataRow = heatmapTable.querySelector('tbody tr[data-row-key]');
    if (!(classDataRow instanceof HTMLElement) || !(heatmapDataRow instanceof HTMLElement)) {
      throw new TypeError('Expected both student-name tables to render a data row.');
    }
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
