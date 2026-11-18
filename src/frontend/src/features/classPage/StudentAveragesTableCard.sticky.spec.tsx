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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StudentAveragesTableCard } from './StudentAveragesTableCard';
import type { BaselineAvailability } from '@/features/shared/baselineAvailability';
import {
  buildStudentAverageRow,
  createClassPageAdapterResult,
} from '@/test/classPage/classPageFixtures';
import { requireElement, resolveStickyTables } from '@/test/shared/domGuards';

/** Accessible name of the shared mode control hosted in the card head. */
const MODE_CONTROL_LABEL = 'Averages basis';

/** Minimal ready availability for the supplied-mode-props render. */
const READY_AVAILABILITY: BaselineAvailability = { status: 'ready', reason: null };

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

  it('keeps narrow-width containment when the card head hosts the mode control', () => {
    const { container } = render(
      <StudentAveragesTableCard
        adapterResult={createClassPageAdapterResult({
          studentAverages: [buildStudentAverageRow()],
        })}
        analysisMode="absolute"
        onAnalysisModeChange={vi.fn()}
        baselineAvailability={READY_AVAILABILITY}
      />
    );

    // The head control stays outside the table's horizontal scroll region and
    // keeps the standard compact-card padding, so it cannot consume the width
    // available to the sticky table. Real geometry is owned by Playwright;
    // Vitest pins the structural contract that makes that containment possible.
    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    const card = requireElement(
      control.closest('.ant-card'),
      'Expected the Student Averages card.'
    );
    const cardHead = requireElement(
      card.querySelector('.ant-card-head'),
      'Expected the Student Averages card head.'
    );
    expect(cardHead).toHaveClass('app-card-header--controls');
    const extra = requireElement(
      cardHead.querySelector('.ant-card-extra'),
      'Expected the Student Averages card head extra.'
    );
    expect(extra).toContainElement(control);

    // The split render and page-level scroll policy are unchanged.
    const wrapper = requireElement(
      container.querySelector('.ant-table-wrapper'),
      'Expected the Student Averages table wrapper.'
    );
    const { body, headerTable, bodyTable } = resolveStickyTables(wrapper, 'Student Averages');
    expect(bodyTable.querySelector(':scope tbody tr[data-row-key]')).not.toBeNull();
    expect(headerTable.querySelectorAll(':scope thead th').length).toBeGreaterThan(0);
    expect(body.style.maxHeight).toBe('');
  });
});
