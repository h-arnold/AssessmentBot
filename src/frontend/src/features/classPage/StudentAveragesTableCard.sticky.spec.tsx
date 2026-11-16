/**
 * Sticky split-render structure for the Student Averages table.
 *
 * A sticky Ant Design table renders a header table inside
 * `.ant-table-header.ant-table-sticky-holder` and the body table inside
 * `.ant-table-body`. Ant Design copies the source `aria-label="Student
 * Averages"` onto both tables, so the accessible name resolves to two table
 * elements. That duplication is accepted (SPEC decision 8) and must not be
 * "fixed"; the structural assertions below locate the tables from the wrapper
 * rather than resolving either one by accessible name. The document remains
 * the scroll container: `sticky` alone must not introduce a fixed-height body
 * region.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { StudentAveragesTableCard } from './StudentAveragesTableCard';
import {
  buildStudentAverageRow,
  createClassPageAdapterResult,
} from '@/test/classPage/classPageFixtures';
import { requireElement, resolveStickyTables } from '@/test/shared/domGuards';

afterEach(() => {
  cleanup();
});

describe('StudentAveragesTableCard sticky render', () => {
  it('splits the header and body tables while copying the aria-label onto both', () => {
    const { container } = render(
      <StudentAveragesTableCard
        adapterResult={createClassPageAdapterResult({
          studentAverages: [buildStudentAverageRow()],
        })}
      />
    );

    const wrapper = requireElement(
      container.querySelector('.ant-table-wrapper'),
      'Expected the Student Averages table wrapper.'
    );
    const { body, headerTable, bodyTable } = resolveStickyTables(wrapper, 'Student Averages');

    // Ant Design copies the source label onto both halves; the duplicated
    // accessible name is accepted and must not be "fixed".
    expect(headerTable.getAttribute('aria-label')).toBe('Student Averages');
    expect(bodyTable.getAttribute('aria-label')).toBe('Student Averages');

    // Rows live in the body table; header cells live in the header table.
    expect(bodyTable.querySelector(':scope tbody tr[data-row-key]')).not.toBeNull();
    expect(headerTable.querySelectorAll(':scope thead th').length).toBeGreaterThan(0);

    // `sticky` must not introduce a fixed-height body region (no `scroll.y`).
    expect(body.style.maxHeight).toBe('');
  });
});
