import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { buildStudentAveragesTableColumns } from './studentAveragesTableColumns';
import { createComputedMetricResult, createNotAttemptedMetricResult, createErrorMetricResult, createMetricResult } from '../../test/dataAnalysis/fixtures';
import type { StudentAverageRowModel } from './classPageAdapter.zod';

const EMPTY_FILTERS = { completeness: [], accuracy: [], spag: [], average: [] } as const;
const EXCLUDED_ACCESSIBLE_TEXT = 'Excluded from average: displayed work had zero weighting.';

/**
 * Make a table row with the supplied average result.
 * @param {StudentAverageRowModel['metrics']['average']} average - Average metric state.
 * @returns {StudentAverageRowModel} Complete student average row.
 */
function rowWithAverage(average: StudentAverageRowModel['metrics']['average']): StudentAverageRowModel {
  return {
    studentId: 's-1', studentName: 'Alice', metrics: {
      completeness: createComputedMetricResult({ value: 4 }),
      accuracy: createNotAttemptedMetricResult(),
      spag: createErrorMetricResult(),
      average,
    },
  };
}

describe('student averages excluded metric display and filtering', () => {
  it('renders Excluded with its agreed accessible label, distinct from N, E and numeric values', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const average = columns.find((column) => column.key === 'average')!;
    const excludedRow = rowWithAverage(createMetricResult('excluded'));
    const nRow = rowWithAverage(createNotAttemptedMetricResult());
    const errorRow = rowWithAverage(createErrorMetricResult());
    const computedRow = rowWithAverage(createComputedMetricResult({ value: 4 }));

    render(<>{average.render!(null, excludedRow, 0)}</>);
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    expect(screen.queryByText('E')).not.toBeInTheDocument();
    expect(screen.queryByText('N')).not.toBeInTheDocument();
    expect(screen.queryByText('4.00')).not.toBeInTheDocument();
    expect(average.onCell!(excludedRow)).toHaveProperty(
      'aria-label',
      `Alice, Average: ${EXCLUDED_ACCESSIBLE_TEXT}`
    );
    expect(average.render!(null, nRow, 0)).toHaveProperty('props.children', 'N');
    expect(average.render!(null, errorRow, 0)).toHaveProperty('props.children', 'E');
    expect(average.render!(null, computedRow, 0)).toHaveProperty('props.children', '4.00');
  });

  it('includes excluded only when the fifth encoded filter flag is selected', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const average = columns.find((column) => column.key === 'average')!;
    const excluded = rowWithAverage(createMetricResult('excluded'));
    const notAttempted = rowWithAverage(createNotAttemptedMetricResult());
    const error = rowWithAverage(createErrorMetricResult());
    const oldKey = '2|4|0|0';
    const includeExcludedKey = '2|4|0|0|1';

    expect(average.onFilter!(oldKey, excluded)).toBe(false);
    expect(average.onFilter!(includeExcludedKey, excluded)).toBe(true);
    expect(average.onFilter!(includeExcludedKey, notAttempted)).toBe(false);
    expect(average.onFilter!(includeExcludedKey, error)).toBe(false);
  });

  it('preserves a five-part excluded filter key on the aggregate column', () => {
    const includeExcludedKey = '2|4|0|0|1';
    const columns = buildStudentAveragesTableColumns({
      ...EMPTY_FILTERS,
      average: [includeExcludedKey],
    });
    const average = columns.find((column) => column.key === 'average')!;

    expect(average.filteredValue).toEqual([includeExcludedKey]);
  });

  it('keeps the Include Excluded checkbox on aggregate metric filters', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const average = columns.find((column) => column.key === 'average')!;
    const filterDropdown = average.filterDropdown;

    expect(filterDropdown).toBeDefined();
    if (typeof filterDropdown !== 'function') {
      throw new TypeError('Expected a filterDropdown callback for the aggregate metric column');
    }

    render(
      <>
        {filterDropdown({
          selectedKeys: ['2|4|0|0|1'],
          setSelectedKeys: vi.fn(),
          confirm: vi.fn(),
          clearFilters: vi.fn(),
          filters: undefined,
          visible: true,
        } as unknown as FilterDropdownProps)}
      </>
    );

    expect(screen.getByRole('checkbox', { name: 'Include Excluded' })).toBeChecked();
  });
});
