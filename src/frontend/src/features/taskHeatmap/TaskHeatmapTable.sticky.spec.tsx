/**
 * Sticky split-render structure for the Task Heatmap table.
 *
 * Ant Design 6.6.7 renders a sticky table as a header table inside
 * `.ant-table-header.ant-table-sticky-holder` plus a body table inside
 * `.ant-table-body`. It copies the source `aria-label` onto both tables, so
 * the heatmap's accessible name resolves to two table elements. That
 * duplication is accepted (SPEC decision 8) and must not be "fixed"; the
 * structural assertions below locate the tables from the wrapper rather than
 * resolving either one by accessible name.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import { requireElement, requireTableElement } from '@/test/shared/domGuards';
import { buildHeatmapResult } from '@/test/taskHeatmapTableTestHelpers';

/** Ant Design splits a sticky table into a header table and a body table. */
const STICKY_TABLE_COUNT = 2;

afterEach(() => {
  cleanup();
});

describe('TaskHeatmapTable sticky render', () => {
  it('renders the split header and body tables, copying the aria-label onto both', () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const wrapper = requireElement(
      container.querySelector('.ant-table-wrapper'),
      'Expected the Task Heatmap table wrapper.'
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

    // Ant Design copies the source label onto both halves; the duplicated
    // accessible name is accepted and must not be "fixed".
    expect(headerTable.getAttribute('aria-label')).toBe('Task Heatmap');
    expect(bodyTable.getAttribute('aria-label')).toBe('Task Heatmap');
    expect(wrapper.querySelectorAll('table[aria-label="Task Heatmap"]')).toHaveLength(
      STICKY_TABLE_COUNT
    );

    // Rows live in the body table; header cells live in the header table.
    expect(bodyTable.querySelector(':scope tbody tr[data-row-key]')).not.toBeNull();
    expect(headerTable.querySelectorAll(':scope thead th').length).toBeGreaterThan(0);
  });
});
