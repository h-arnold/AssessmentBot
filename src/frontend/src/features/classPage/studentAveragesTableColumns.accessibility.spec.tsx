import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { buildStudentAveragesTableColumns } from './studentAveragesTableColumns';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import {
  createComputedMetricResult,
  createExcludedMetricResult,
} from '../../test/dataAnalysis/fixtures';

const EMPTY_FILTERS = {
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
} as const;
const EXCLUDED_ACCESSIBLE_TEXT = 'Excluded from average: displayed work had zero weighting.';
const COMPUTED_SCORE = 4;
const MIN_EXCLUDED_COLUMN_WIDTH = 72;
const WIDTH_GRID_INCREMENT = 8;
const EXCLUDED_ROW = {
  studentId: 'student-alice',
  studentName: 'Alice Smith',
  metrics: {
    completeness: createComputedMetricResult({ value: COMPUTED_SCORE }),
    accuracy: createComputedMetricResult({ value: COMPUTED_SCORE }),
    spag: createComputedMetricResult({ value: COMPUTED_SCORE }),
    average: createExcludedMetricResult(),
  },
} satisfies StudentAverageRowModel;

describe('student averages excluded metric presentation', () => {
  it('includes the student and metric context in the excluded accessible name', () => {
    const averageColumn = buildStudentAveragesTableColumns(EMPTY_FILTERS).find(
      (column) => column.key === 'average'
    );
    expect(averageColumn).toBeDefined();
    if (!averageColumn) {
      throw new TypeError('Expected the Student Averages table to define an average column.');
    }

    expect(averageColumn.onCell?.(EXCLUDED_ROW)).toHaveProperty(
      'aria-label',
      `Alice Smith, Average: ${EXCLUDED_ACCESSIBLE_TEXT}`
    );
    render(<>{averageColumn.render?.(null, EXCLUDED_ROW, 0)}</>);
    expect(screen.getByText('Excluded')).toBeInTheDocument();
  });

  it('allocates a grid-aligned metric column wide enough for the visible Excluded label', () => {
    const averageColumn = buildStudentAveragesTableColumns(EMPTY_FILTERS).find(
      (column) => column.key === 'average'
    );
    expect(averageColumn).toBeDefined();
    if (!averageColumn) {
      throw new TypeError('Expected the Student Averages table to define an average column.');
    }

    expect(typeof averageColumn.width).toBe('number');
    expect(averageColumn.width).toBeGreaterThanOrEqual(MIN_EXCLUDED_COLUMN_WIDTH);
    expect(Number(averageColumn.width) % WIDTH_GRID_INCREMENT).toBe(0);
  });
});
