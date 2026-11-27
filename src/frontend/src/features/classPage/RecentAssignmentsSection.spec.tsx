/**
 * Tests for the Assignments section's panel, six-column presentation,
 * disclosure and heatmap navigation.
 *
 * Control behaviour (sorting and filtering) lives in
 * `RecentAssignmentsSection.controls.spec.tsx`. Realistic history comes from
 * the committed synthetic corpus through the production Class page adapter;
 * local rows exercise display states the corpus does not guarantee.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisMode } from '@/services/dataAnalysis/dataAnalysis.zod';
import { METRIC_DISPLAY_META } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import {
  BASELINE_EXCLUDED_METRIC_ACCESSIBLE_LABEL,
  EXCLUDED_METRIC_ACCESSIBLE_LABEL,
  resolveMetricTone,
} from '@/services/dataAnalysis/metricDisplay/metricTone';
import {
  buildAllExcludedAssignment,
  buildMetricStateAssignment,
  canonicalAssignments,
  COLUMN_INDEX,
  COMPUTED_PROBE_TEXT,
  EXPECTED_HEADINGS,
  EXPECTED_NAVIGATION_CALLS,
  expectedHistory,
  getAssignmentsTable,
  getDataRows,
  getDisclosureButton,
  getDisclosureRegion,
  getMetricCell,
  getMetricPill,
  getRenderedAssignmentNames,
  getRowCells,
  INITIAL_VISIBLE_ASSIGNMENTS,
  METRIC_ICON_CLASSES,
  METRIC_KEYS,
  renderSection,
  SHOW_ALL_ASSIGNMENTS_LABEL,
  SHOW_FEWER_ASSIGNMENTS_LABEL,
  TABLE_NAME,
} from '@/test/classPage/recentAssignmentsSectionTestHelpers';

/** Analysis-mode cases for the aggregate-excluded accessible wording. */
const EXCLUDED_MODE_CASES = [
  {
    modeLabel: 'omitted analysis mode',
    analysisMode: undefined,
    expectedLabel: EXCLUDED_METRIC_ACCESSIBLE_LABEL,
  },
  {
    modeLabel: 'absolute analysis mode',
    analysisMode: 'absolute',
    expectedLabel: EXCLUDED_METRIC_ACCESSIBLE_LABEL,
  },
  {
    modeLabel: 'baseline analysis mode',
    analysisMode: 'topDecileBaseline',
    expectedLabel: BASELINE_EXCLUDED_METRIC_ACCESSIBLE_LABEL,
  },
] as const satisfies ReadonlyArray<{
  modeLabel: string;
  analysisMode: AnalysisMode | undefined;
  expectedLabel: string;
}>;

describe('RecentAssignmentsSection', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('preserves a titled empty state with the empty-class copy and Start New Assessment action', async () => {
    const onStartNewAssessment = vi.fn();
    renderSection({ recentAssignments: [], onStartNewAssessment });

    expect(screen.getByText(TABLE_NAME)).toBeInTheDocument();
    expect(screen.getByText('No assignments yet')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /start new assessment/i });
    expect(cta.querySelector('.anticon-plus')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /show (all|fewer) assignments/i })
    ).not.toBeInTheDocument();

    await user.click(cta);

    expect(onStartNewAssessment).toHaveBeenCalledTimes(1);
  });

  it('renders an accessible compact table with the exact six headings in order', () => {
    renderSection({
      recentAssignments: canonicalAssignments.slice(0, 1),
      onStartNewAssessment: vi.fn(),
    });

    expect(screen.getByText(TABLE_NAME)).toBeInTheDocument();

    const table = getAssignmentsTable();
    const headers = within(table).getAllByRole('columnheader');

    const antTable = table.closest('.ant-table');
    if (!(antTable instanceof HTMLElement)) {
      throw new TypeError('Expected an Ant Design table wrapper for the Assignments table.');
    }
    expect(antTable).toHaveClass('ant-table-small');
    expect(document.querySelector('.ant-pagination')).not.toBeInTheDocument();
    expect(headers).toHaveLength(EXPECTED_HEADINGS.length);
    headers.forEach((header, index) => {
      expect(header).toHaveAccessibleName(EXPECTED_HEADINGS[index]);
    });

    METRIC_KEYS.forEach((key) => {
      const meta = METRIC_DISPLAY_META.get(key)!;
      const icon = within(headers[COLUMN_INDEX[key]]).getByLabelText(meta.label);
      expect(icon.tagName.toLowerCase()).toBe('svg');
      expect(icon).toHaveClass(METRIC_ICON_CLASSES[key]);
      expect(icon).toHaveAttribute('width', '20');
      expect(icon).toHaveAttribute('height', '20');
      expect(icon).toHaveAttribute('stroke-width', '1.5');
    });
  });

  it('shows the three newest canonical assignments with formatted Last Assessed values', () => {
    renderSection({
      recentAssignments: canonicalAssignments,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const rows = getDataRows(table);
    const visibleHistory = expectedHistory.slice(0, INITIAL_VISIBLE_ASSIGNMENTS);

    expect(rows).toHaveLength(INITIAL_VISIBLE_ASSIGNMENTS);
    expect(getRenderedAssignmentNames(table)).toEqual(
      visibleHistory.map((assignment) => assignment.assignmentName)
    );
    rows.forEach((row, index) => {
      const assignment = canonicalAssignments[index];
      if (!assignment) {
        throw new TypeError('Expected a canonical assignment for every visible row.');
      }
      expect(
        within(row).getByRole('button', { name: assignment.assignmentName })
      ).toBeInTheDocument();
      expect(getRowCells(row)[COLUMN_INDEX.lastAssessed]).toHaveTextContent(
        assignment.lastAssessedAtLabel
      );
      expect(getRowCells(row)[COLUMN_INDEX.lastAssessed]).not.toHaveTextContent(
        assignment.lastAssessedAt
      );
    });
  });

  it('renders the disclosure as a compact text button with a 16px light-stroke icon', () => {
    renderSection({
      recentAssignments: canonicalAssignments,
      onStartNewAssessment: vi.fn(),
    });

    const button = getDisclosureButton();
    expect(button).toHaveClass('ant-btn-text');
    expect(button).toHaveClass('ant-btn-sm');

    const icon = button.querySelector('svg');
    if (!(icon instanceof SVGElement)) {
      throw new TypeError('Expected a Lucide disclosure icon inside the button.');
    }
    expect(icon).toHaveClass('lucide-chevrons-up-down');
    expect(icon).toHaveAttribute('width', '16');
    expect(icon).toHaveAttribute('height', '16');
    expect(icon).toHaveAttribute('stroke-width', '1.5');
  });

  it('expands to every canonical assignment and collapses back to three', async () => {
    renderSection({
      recentAssignments: canonicalAssignments,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const table = getAssignmentsTable();
    const showAll = getDisclosureButton();
    const controlsId = showAll.getAttribute('aria-controls');
    expect(showAll).toHaveAttribute('aria-expanded', 'false');
    expect(showAll).toHaveAccessibleName(SHOW_ALL_ASSIGNMENTS_LABEL);
    expect(showAll.closest('.ant-card-head')).not.toBeNull();
    expect(getDisclosureRegion(showAll)).toContainElement(table);
    expect(getDataRows(table)).toHaveLength(INITIAL_VISIBLE_ASSIGNMENTS);

    await user.click(showAll);

    const showFewer = getDisclosureButton();
    expect(showFewer).toHaveAttribute('aria-expanded', 'true');
    expect(showFewer).toHaveAccessibleName(SHOW_FEWER_ASSIGNMENTS_LABEL);
    expect(showFewer).toHaveAttribute('aria-controls', controlsId);
    expect(getDisclosureRegion(showFewer)).toContainElement(table);
    expect(getDataRows(table)).toHaveLength(expectedHistory.length);
    expect(getRenderedAssignmentNames(table)).toEqual(
      expectedHistory.map((assignment) => assignment.assignmentName)
    );

    await user.click(showFewer);

    const collapsed = getDisclosureButton();
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(collapsed).toHaveAttribute('aria-controls', controlsId);
    expect(getDataRows(table)).toHaveLength(INITIAL_VISIBLE_ASSIGNMENTS);
    expect(getRenderedAssignmentNames(table)).toEqual(
      expectedHistory
        .slice(0, INITIAL_VISIBLE_ASSIGNMENTS)
        .map((assignment) => assignment.assignmentName)
    );
  });

  it.each(Array.from({ length: INITIAL_VISIBLE_ASSIGNMENTS }, (_, index) => index + 1))(
    'shows all %i supplied assignments without an ineffective disclosure',
    (assignmentCount) => {
      renderSection({
        recentAssignments: canonicalAssignments.slice(0, assignmentCount),
        onStartNewAssessment: vi.fn(),
        onOpenHeatmap: vi.fn(),
      });

      const table = getAssignmentsTable();
      expect(getDataRows(table)).toHaveLength(assignmentCount);
      expect(getRenderedAssignmentNames(table)).toEqual(
        expectedHistory.slice(0, assignmentCount).map((assignment) => assignment.assignmentName)
      );
      expect(
        screen.queryByRole('button', { name: /show (all|fewer) assignments/i })
      ).not.toBeInTheDocument();
    }
  );

  it('retains shared precision, colours and every metric display state', () => {
    const assignment = buildMetricStateAssignment();
    renderSection({
      recentAssignments: [assignment],
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap: vi.fn(),
    });

    const row = getDataRows(getAssignmentsTable())[0];
    if (!row) {
      throw new TypeError('Expected the metric-state probe row.');
    }

    const completeness = getMetricPill(row, 'completeness');
    expect(completeness).toHaveTextContent(COMPUTED_PROBE_TEXT);
    expect(completeness).toHaveClass('ant-tag-filled');
    expect(completeness).toHaveAttribute(
      'style',
      expect.stringContaining(resolveMetricTone(assignment.metrics.completeness).color)
    );

    const accuracy = getMetricPill(row, 'accuracy');
    expect(accuracy).toHaveTextContent(/^N$/);
    expect(accuracy).toHaveClass('ant-tag-filled');
    expect(accuracy).toHaveAttribute(
      'style',
      expect.stringContaining(resolveMetricTone(assignment.metrics.accuracy).color)
    );
    expect(accuracy).toHaveStyle({ opacity: '0.55' });

    const spag = getMetricPill(row, 'spag');
    expect(spag).toHaveTextContent(/^E$/);
    expect(spag).toHaveClass('ant-tag-volcano');

    const average = getMetricPill(row, 'average');
    expect(average).toHaveTextContent(/^Excluded$/);
    expect(average).toHaveClass('ant-tag-default');
    expect(average).not.toHaveStyle({ opacity: '0.55' });
  });

  it.each(EXCLUDED_MODE_CASES)(
    'uses $modeLabel excluded wording in all four metric columns',
    ({ analysisMode, expectedLabel }) => {
      renderSection({
        recentAssignments: [buildAllExcludedAssignment()],
        onStartNewAssessment: vi.fn(),
        onOpenHeatmap: vi.fn(),
        analysisMode,
      });

      const row = getDataRows(getAssignmentsTable())[0];
      if (!row) {
        throw new TypeError('Expected the exclusion wording probe row.');
      }

      METRIC_KEYS.forEach((key) => {
        const pill = getMetricPill(row, key);
        expect(pill).toHaveTextContent(/^Excluded$/);
        expect(pill).toHaveClass('ant-tag-default');
        expect(within(getMetricCell(row, key)).getByRole('img', { name: expectedLabel })).toBe(
          pill
        );
      });
    }
  );

  it('opens heatmaps from assignment-name buttons but not from table rows', async () => {
    const onOpenHeatmap = vi.fn();
    renderSection({
      recentAssignments: canonicalAssignments,
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap,
    });

    const table = getAssignmentsTable();
    const first = expectedHistory[0];
    const second = expectedHistory[1];
    if (!first || !second) {
      throw new TypeError('Canonical fixture must supply two assignments for navigation.');
    }

    await user.click(within(table).getByRole('button', { name: first.assignmentName }));
    await user.click(within(table).getByRole('button', { name: second.assignmentName }));

    expect(onOpenHeatmap).toHaveBeenCalledTimes(EXPECTED_NAVIGATION_CALLS);
    expect(onOpenHeatmap).toHaveBeenNthCalledWith(1, first.assignmentId);
    expect(onOpenHeatmap).toHaveBeenNthCalledWith(EXPECTED_NAVIGATION_CALLS, second.assignmentId);

    const rows = getDataRows(table);
    rows.forEach((row) => {
      expect(row).not.toHaveAttribute('role', 'button');
      expect(row).not.toHaveAttribute('tabindex');
      expect(row).not.toHaveStyle({ cursor: 'pointer' });
    });
    await user.click(getRowCells(rows[0])[COLUMN_INDEX.lastAssessed]);
    expect(onOpenHeatmap).toHaveBeenCalledTimes(EXPECTED_NAVIGATION_CALLS);
  });

  it.each([
    { activation: 'Enter', key: '{Enter}' },
    { activation: 'Space', key: '[Space]' },
  ])('opens the heatmap with $activation on a focused assignment name', async ({ key }) => {
    const onOpenHeatmap = vi.fn();
    const assignment = expectedHistory[0];
    if (!assignment) {
      throw new TypeError('Canonical fixture must supply an assignment for keyboard navigation.');
    }
    renderSection({
      recentAssignments: canonicalAssignments.slice(0, 1),
      onStartNewAssessment: vi.fn(),
      onOpenHeatmap,
    });

    const assignmentButton = within(getAssignmentsTable()).getByRole('button', {
      name: assignment.assignmentName,
    });
    // Sortable column headers are focusable, so the first Tab no longer lands
    // on the name button. Focus the target explicitly before activating it.
    assignmentButton.focus();
    expect(assignmentButton).toHaveFocus();

    await user.keyboard(key);

    expect(onOpenHeatmap).toHaveBeenCalledTimes(1);
    expect(onOpenHeatmap).toHaveBeenCalledWith(assignment.assignmentId);
  });
});
