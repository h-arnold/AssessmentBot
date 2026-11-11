/**
 * Tests for `TaskHeatmapTable` attempt-baseline column marking.
 *
 * These tests encode the presentation contract for task columns outside the
 * analysed class's attempt-baseline task set: the marked heading (visible "†"
 * marker, tooltip and header `aria-label` reusing the zero-weight visual
 * language, plus the shared edge classes on the marked column's metric
 * sub-columns and body cells), the once-per-table live caption beside the
 * existing notice, the merged-column flag inheritance, and the absolute-mode
 * invariance (no baseline presentation when every column is inside the
 * baseline).
 *
 * The column fixtures are hand-built local literals typed on the adapter's
 * `HeatmapTaskColumn` / `MergedHeatmapTaskColumn`, which already require
 * `includedInAttemptBaseline`. The table-level flag requirement and its
 * presentation are the behaviour under test here.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §3.7
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import type { HeatmapResult } from '@/services/dataAnalysis/heatmapAdapter';
import type {
  MergedHeatmapResult,
  MergedHeatmapTaskColumn,
} from '@/services/dataAnalysis/heatmapAdapter.merged';
import {
  buildCell,
  buildHeatmapResult,
  buildNoSubmissionsResult,
  buildZeroTasksResult,
  TASK_1_TITLE,
  TASK_2_TITLE,
} from '@/test/taskHeatmapTableTestHelpers';
import { EXCLUDED_COLUMN_GROUP_CLASS } from './taskHeatmapColumnMarking';

// ---------------------------------------------------------------------------
// Copy under test
// ---------------------------------------------------------------------------

// The layout spec pins this wording verbatim; the production copy constants
// live beside `taskHeatmapColumnMarking.tsx`.
const BASELINE_OFF_EXPLANATION =
  'Task outside the baseline set — shown, but not included in baseline averages.';
const BASELINE_CAPTION =
  '† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them.';
const BASELINE_MARKER = '†';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Embedded fixtures
// ---------------------------------------------------------------------------

/**
 * Clone an embedded result with per-column attempt-baseline flags.
 * @param {HeatmapResult} result - Source result (cloned, never mutated).
 * @param {boolean[]} flags - One flag per task column, in column order.
 * @returns {HeatmapResult} The cloned result carrying the requested flags.
 */
function withBaselineFlags(result: HeatmapResult, flags: boolean[]): HeatmapResult {
  return {
    ...result,
    taskColumns: result.taskColumns.map((column, index) => {
      return {
        ...column,
        includedInAttemptBaseline: flags[index]!,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Merged fixtures
// ---------------------------------------------------------------------------

/** Definition key for the first merged source assignment. */
const MERGED_DEF_1 = 'def-1';
/** Definition key for the second merged source assignment. */
const MERGED_DEF_2 = 'def-2';
/** Shared definition key used by the collapsed-duplicate fixture. */
const MERGED_DEF_SHARED = 'def-shared';

/** First source assignment identifier. */
const MERGED_A1_ID = 'a-1';
/** First source assignment name (used as the adaptive-tier parent title). */
const MERGED_A1_NAME = 'Assignment One';
/** Second source assignment identifier. */
const MERGED_A2_ID = 'a-2';
/** Second source assignment name (used as the adaptive-tier parent title). */
const MERGED_A2_NAME = 'Assignment Two';

/**
 * Build a two-source merged result with per-column attempt-baseline flags.
 *
 * @param {boolean[]} flags - One flag per task column, in column order.
 * @returns {MergedHeatmapResult} Two assignments under separate tier parents,
 *   each contributing two task columns.
 */
function buildMergedResultWithBaselineFlags(flags: boolean[]): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_1}::t1`,
      taskId: 't1',
      taskTitle: 'A1 Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[0]!,
      assignmentId: MERGED_A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: MERGED_A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t2`,
      taskId: 't2',
      taskTitle: 'A1 Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[1]!,
      assignmentId: MERGED_A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: MERGED_A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t3`,
      taskId: 't3',
      taskTitle: 'A2 Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[2]!,
      assignmentId: MERGED_A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: MERGED_A2_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t4`,
      taskId: 't4',
      taskTitle: 'A2 Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[3]!,
      assignmentId: MERGED_A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: MERGED_A2_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      { assignmentId: MERGED_A1_ID, definitionKey: MERGED_DEF_1, assignmentName: MERGED_A1_NAME },
      { assignmentId: MERGED_A2_ID, definitionKey: MERGED_DEF_2, assignmentName: MERGED_A2_NAME },
    ],
    taskColumns,
    rows: [
      {
        studentId: 'student-1',
        studentName: 'Student One',
        cells: taskColumns.map(() => buildCell()),
      },
    ],
  };
}

/**
 * Build a collapsed-duplicate merged result (two source assignments share one
 * definition key) with per-column attempt-baseline flags.
 *
 * @param {boolean[]} flags - One flag per de-duplicated task column.
 * @returns {MergedHeatmapResult} A collapsed column set under one shared tier parent.
 */
function buildCollapsedMergedResultWithBaselineFlags(flags: boolean[]): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_SHARED}::t1`,
      taskId: 't1',
      taskTitle: 'Shared Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[0]!,
      assignmentId: MERGED_A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: MERGED_A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_SHARED}::t2`,
      taskId: 't2',
      taskTitle: 'Shared Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      includedInAttemptBaseline: flags[1]!,
      assignmentId: MERGED_A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: MERGED_A1_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      {
        assignmentId: MERGED_A1_ID,
        definitionKey: MERGED_DEF_SHARED,
        assignmentName: MERGED_A1_NAME,
      },
      {
        assignmentId: MERGED_A2_ID,
        definitionKey: MERGED_DEF_SHARED,
        assignmentName: MERGED_A2_NAME,
      },
    ],
    taskColumns,
    rows: [
      {
        studentId: 'student-1',
        studentName: 'Student One',
        cells: taskColumns.map(() => buildCell()),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * Render `TaskHeatmapTable` from an embedded or merged adapter result.
 * @param {HeatmapResult | MergedHeatmapResult} heatmapResult - The adapter result.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderHeatmapTable(heatmapResult: HeatmapResult | MergedHeatmapResult) {
  return render(
    <TaskHeatmapTable
      heatmapResult={heatmapResult}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('TaskHeatmapTable attempt-baseline column marking', () => {
  // -------------------------------------------------------------------------
  // Marked task headings — visible marker, tooltip, header aria-label, and
  // the shared zero-weight group chrome.
  // -------------------------------------------------------------------------
  describe('marked task headings', () => {
    it('suffixes the baseline-off heading with the marker and exposes the explanation through hover, focus and the header cell', async () => {
      renderHeatmapTable(withBaselineFlags(buildHeatmapResult(), [true, false]));

      // Exactly one marked heading: the focusable tooltip target span.
      const markedSpan = screen.getByRole('group');
      expect(markedSpan.textContent).toBe(`${TASK_2_TITLE}${BASELINE_MARKER}`);
      expect(markedSpan).toHaveAttribute('tabindex', '0');
      expect(markedSpan).toHaveAttribute(
        'aria-label',
        expect.stringContaining(BASELINE_OFF_EXPLANATION)
      );

      // The header cell carries the same explanation and the shared
      // zero-weight group chrome (one visual language); the accessible label
      // leads with the marked title.
      const headerCell = markedSpan.closest('th');
      expect(headerCell).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);
      expect(headerCell).toHaveAttribute('aria-label', expect.stringContaining(TASK_2_TITLE));
      expect(headerCell).toHaveAttribute(
        'aria-label',
        expect.stringContaining(BASELINE_OFF_EXPLANATION)
      );

      // Hover reveals the explanation; keyboard focus reveals it too.
      await user.hover(markedSpan);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(BASELINE_OFF_EXPLANATION);

      await user.unhover(markedSpan);
      markedSpan.focus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent(BASELINE_OFF_EXPLANATION);

      // The in-baseline sibling heading stays plain.
      expect(screen.getByRole('columnheader', { name: TASK_1_TITLE })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Baseline caption — rendered once above the table when at least one
  // marked column exists, with live-region semantics beside the existing
  // notice.
  // -------------------------------------------------------------------------
  describe('baseline caption', () => {
    it('renders the caption above the table with polite live semantics and the secondary tone when a marked column exists', () => {
      const { container } = renderHeatmapTable(
        withBaselineFlags(buildHeatmapResult(), [true, false])
      );

      const caption = screen.getByText(BASELINE_CAPTION);
      const statusRegion = caption.closest('[role="status"]');
      if (!(statusRegion instanceof HTMLElement)) {
        throw new TypeError('Expected the baseline caption to expose a status region.');
      }
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(caption).toHaveClass('ant-typography', 'ant-typography-secondary');

      // The caption sits above the table — outside it, in the component's
      // own element stack.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table!.contains(caption)).toBe(false);
      expect(caption.parentElement!.contains(table!)).toBe(true);
      expect(
        caption.compareDocumentPosition(table!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('renders the caption after the existing no-submissions notice when both apply', () => {
      renderHeatmapTable(withBaselineFlags(buildNoSubmissionsResult(), [false, true]));

      const notice = screen.getByText('No submissions yet');
      const caption = screen.getByText(BASELINE_CAPTION);

      const noticeStatus = notice.closest('[role="status"]');
      if (!(noticeStatus instanceof HTMLElement)) {
        throw new TypeError('Expected the no-submissions notice to expose a status region.');
      }
      const captionStatus = caption.closest('[role="status"]');
      if (!(captionStatus instanceof HTMLElement)) {
        throw new TypeError('Expected the baseline caption to expose a status region.');
      }
      expect(noticeStatus).toHaveAttribute('aria-live', 'polite');
      expect(captionStatus).toHaveAttribute('aria-live', 'polite');

      // The caption follows the notice in the same element stack.
      expect(notice.parentElement).toBe(caption.parentElement);
      expect(
        notice.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('renders no baseline presentation when every column is inside the baseline (absolute-mode invariance)', () => {
      const { container } = renderHeatmapTable(
        withBaselineFlags(buildHeatmapResult(), [true, true])
      );

      expect(screen.queryByText(BASELINE_CAPTION)).not.toBeInTheDocument();
      expect(screen.queryByText(BASELINE_OFF_EXPLANATION)).not.toBeInTheDocument();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain(BASELINE_MARKER);

      // Headers keep their plain accessible names.
      expect(screen.getByRole('columnheader', { name: TASK_1_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: TASK_2_TITLE })).toBeInTheDocument();
    });

    it('renders no caption when the heatmap has no task columns', () => {
      renderHeatmapTable(buildZeroTasksResult());

      expect(screen.queryByText(BASELINE_CAPTION)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Merged attempt-baseline inheritance — a merged column is marked exactly
  // when the flag it inherited from the base projection is `false`.
  // -------------------------------------------------------------------------
  describe('merged attempt-baseline inheritance', () => {
    it('marks a merged task column outside the attempt baseline under its assignment tier', () => {
      renderHeatmapTable(buildMergedResultWithBaselineFlags([true, false, true, true]));

      const markedSpan = screen.getByRole('group');
      expect(markedSpan.textContent).toBe(`A1 Task 2${BASELINE_MARKER}`);
      const headerCell = markedSpan.closest('th');
      expect(headerCell).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);
      expect(headerCell).toHaveAttribute(
        'aria-label',
        expect.stringContaining(BASELINE_OFF_EXPLANATION)
      );

      // The caption renders once for the merged table.
      expect(screen.getByText(BASELINE_CAPTION)).toBeInTheDocument();

      // Tier parents and sticky columns carry no marking chrome.
      expect(screen.getByRole('columnheader', { name: MERGED_A1_NAME })).not.toHaveClass(
        EXCLUDED_COLUMN_GROUP_CLASS
      );
      expect(screen.getByRole('columnheader', { name: MERGED_A2_NAME })).not.toHaveClass(
        EXCLUDED_COLUMN_GROUP_CLASS
      );
      expect(screen.getByRole('columnheader', { name: 'Forename' })).not.toHaveClass(
        EXCLUDED_COLUMN_GROUP_CLASS
      );
      expect(screen.getByRole('columnheader', { name: 'Surname' })).not.toHaveClass(
        EXCLUDED_COLUMN_GROUP_CLASS
      );

      // In-baseline sibling headings stay plain; cell values are unchanged.
      expect(screen.getByRole('columnheader', { name: 'A1 Task 1' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'A2 Task 1' })).toBeInTheDocument();
      expect(
        screen.getAllByLabelText('Student One, A1 Task 2, Completeness: 4')[0]
      ).toBeInTheDocument();
    });

    it('marks a collapsed shared-definition merged column outside the attempt baseline', () => {
      renderHeatmapTable(buildCollapsedMergedResultWithBaselineFlags([false, true]));

      const markedSpan = screen.getByRole('group');
      expect(markedSpan.textContent).toBe(`Shared Task 1${BASELINE_MARKER}`);
      expect(screen.getByText(BASELINE_CAPTION)).toBeInTheDocument();

      // The collapsed tier parent itself carries no marking chrome.
      expect(
        screen.getByRole('columnheader', { name: `${MERGED_A1_NAME} (shared definition)` })
      ).not.toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);
    });
  });
});
