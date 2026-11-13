/**
 * Sticky split-render structure for the Student Averages table.
 *
 * A sticky Ant Design table renders a header table inside
 * `.ant-table-header.ant-table-sticky-holder` and the body table inside
 * `.ant-table-body`. The table supplies no `aria-label`, so both halves stay
 * unnamed. The document remains the scroll container: `sticky` alone must not
 * introduce a fixed-height body region.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { StudentAveragesTableCard } from './StudentAveragesTableCard';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
} from '@/test/dataAnalysis/fixtures';
import { requireElement, requireTableElement } from '@/test/shared/domGuards';

const COMPUTED_SCORE = 4;

/**
 * Build a StudentAverageRowModel fixture for the rendered table.
 *
 * @returns {StudentAverageRowModel} A one-student row fixture.
 */
function buildStudentRow(): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Alice Smith',
    metrics: {
      completeness: createComputedMetricResult({ value: COMPUTED_SCORE }),
      accuracy: createComputedMetricResult({ value: COMPUTED_SCORE }),
      spag: createComputedMetricResult({ value: COMPUTED_SCORE }),
      average: createComputedMetricResult({ value: COMPUTED_SCORE }),
    },
  };
}

/**
 * Build a minimal ClassPageAdapterResult fixture for the card.
 *
 * @returns {ClassPageAdapterResult} An adapter result with one student.
 */
function buildAdapterResult(): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [buildStudentRow()],
    classMetrics: {
      completeness: createComputedMetricResult({ value: COMPUTED_SCORE }),
      accuracy: createComputedMetricResult({ value: COMPUTED_SCORE }),
      spag: createNotAttemptedMetricResult(),
      overall: createComputedMetricResult({ value: COMPUTED_SCORE }),
    },
  };
}

afterEach(() => {
  cleanup();
});

describe('StudentAveragesTableCard sticky render', () => {
  it('renders the sticky header holder and body while leaving the table unnamed', () => {
    const { container } = render(<StudentAveragesTableCard adapterResult={buildAdapterResult()} />);

    const wrapper = requireElement(
      container.querySelector('.ant-table-wrapper'),
      'Expected the Student Averages table wrapper.'
    );
    const headerHolder = requireElement(
      wrapper.querySelector('.ant-table-header.ant-table-sticky-holder'),
      'Expected the sticky header holder and body elements.'
    );
    const body = requireElement(
      wrapper.querySelector('.ant-table-body'),
      'Expected the sticky header holder and body elements.'
    );
    const headerTable = requireTableElement(
      headerHolder.querySelector('table'),
      'Expected a header table and a body table.'
    );
    const bodyTable = requireTableElement(
      body.querySelector('table'),
      'Expected a header table and a body table.'
    );

    // The table supplies no aria-label, so the split leaves both halves unnamed.
    expect(headerTable.getAttribute('aria-label')).toBeNull();
    expect(bodyTable.getAttribute('aria-label')).toBeNull();

    // `sticky` must not introduce a fixed-height body region (no `scroll.y`).
    expect(body.style.maxHeight).toBe('');
    expect(body.style.height).toBe('');
  });
});
