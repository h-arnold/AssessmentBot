import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import type { MergedHeatmapResult } from '@/services/dataAnalysis/heatmapAdapter.merged';
import { buildCell, buildHeatmapResult } from '@/test/taskHeatmapTableTestHelpers';
import {
  ZERO_WEIGHT_EXPLANATION,
  EXCLUDED_COLUMN_FIRST_CLASS,
  EXCLUDED_COLUMN_GROUP_CLASS,
  EXCLUDED_COLUMN_LAST_CLASS,
  buildTaskHeaderPresentation,
  getExcludedMetricEdgeClass,
} from './taskHeatmapColumnMarking';

const MAX_ZERO_TITLE_TAB_STEPS = 20;
const SINGLE_METRIC_INDEX = 0;
const SINGLE_METRIC_COUNT = 1;

// The layout spec pins this wording verbatim; the production copy constants
// live beside `taskHeatmapColumnMarking.tsx`.
const BASELINE_OFF_EXPLANATION =
  'Task outside the baseline set — shown, but not included in baseline averages.';
const BASELINE_CAPTION =
  '† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them.';
const BASELINE_MARKER = '†';

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  cleanup();
});

/**
 * Render a locally cloned embedded result with only its first task excluded.
 * @returns {ReturnType<typeof render>} The rendered table.
 */
function renderEmbeddedZeroWeightTable() {
  const base = buildHeatmapResult();
  const result = {
    ...base,
    taskColumns: base.taskColumns.map((column, index) => {
      return index === 0
        ? {
            ...column,
            averageContribution: { effectiveWeight: 0, includedInAverage: false },
          }
        : { ...column };
    }),
    rows: base.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  };

  return render(
    <TaskHeatmapTable
      heatmapResult={result}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

/**
 * Build a minimal merged adapter-shaped boundary model with one excluded task.
 * @returns {MergedHeatmapResult} The local merged boundary model.
 */
function buildMergedZeroWeightResult(): MergedHeatmapResult {
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      {
        assignmentId: 'assignment-1',
        definitionKey: 'definition-1',
        assignmentName: 'Parent tier',
      },
      { assignmentId: 'assignment-2', definitionKey: 'definition-2', assignmentName: 'Other tier' },
    ],
    taskColumns: [
      {
        taskKey: 'definition-1::zero-task',
        taskId: 'zero-task',
        taskTitle: 'Merged zero-weight task',
        averageContribution: { effectiveWeight: 0, includedInAverage: false },
        includedInAttemptBaseline: true,
        assignmentId: 'assignment-1',
        definitionKey: 'definition-1',
        assignmentName: 'Parent tier',
      },
      {
        taskKey: 'definition-2::positive-task',
        taskId: 'positive-task',
        taskTitle: 'Merged positive task',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
        includedInAttemptBaseline: true,
        assignmentId: 'assignment-2',
        definitionKey: 'definition-2',
        assignmentName: 'Other tier',
      },
    ],
    rows: [
      {
        studentId: 'student-1',
        studentName: 'Student One',
        cells: [buildCell({ completenessValue: 4 }), buildCell({ completenessValue: 3 })],
      },
    ],
  };
}

describe('TaskHeatmapTable zero-weight presentation', () => {
  it('marks a single zero-weight metric as both the first and last group edge', () => {
    const edgeClass = getExcludedMetricEdgeClass(
      SINGLE_METRIC_INDEX,
      SINGLE_METRIC_COUNT,
      { effectiveWeight: 0, includedInAverage: false },
      { includedInAttemptBaseline: true }
    );

    expect(edgeClass).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(edgeClass).toContain(EXCLUDED_COLUMN_LAST_CLASS);
  });

  it('shows the exact explanation on pointer hover and keyboard focus with one non-actionable tab stop', async () => {
    renderEmbeddedZeroWeightTable();

    const headerName = `Task 1 — ${ZERO_WEIGHT_EXPLANATION}`;
    const targetName = `Task 1 ${ZERO_WEIGHT_EXPLANATION}`;
    const title = screen.getByRole('group', { name: targetName });
    expect(screen.getByRole('columnheader', { name: headerName })).toHaveAttribute(
      'aria-label',
      headerName
    );
    expect(title).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByRole('group', { name: targetName })).toHaveLength(1);

    await user.hover(title);
    expect(await screen.findByText(ZERO_WEIGHT_EXPLANATION)).toBeInTheDocument();

    await user.unhover(title);
    screen.getByRole('columnheader', { name: 'Forename' }).focus();
    await user.tab();
    let tabSteps = 0;
    while (document.activeElement !== title && tabSteps < MAX_ZERO_TITLE_TAB_STEPS) {
      await user.tab();
      tabSteps += 1;
    }
    expect(title).toHaveFocus();
    expect(await screen.findByText(ZERO_WEIGHT_EXPLANATION)).toBeInTheDocument();

    await user.keyboard('{Enter}{Space}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: headerName })).toBeInTheDocument();
  });

  it('keeps positive task titles plain and marks only the independently zero-weight embedded group', () => {
    const { container } = renderEmbeddedZeroWeightTable();

    expect(screen.getByRole('columnheader', { name: 'Task 2' })).toBeInTheDocument();
    expect(screen.queryByLabelText(`Task 2 ${ZERO_WEIGHT_EXPLANATION}`)).not.toBeInTheDocument();
    expect(screen.queryByText(ZERO_WEIGHT_EXPLANATION)).not.toBeInTheDocument();

    const zeroHeader = screen.getByRole('columnheader', {
      name: `Task 1 — ${ZERO_WEIGHT_EXPLANATION}`,
    });
    expect(zeroHeader).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);
    const metricHeaders = screen.getAllByRole('columnheader', {
      name: /completeness|accuracy|spag/i,
    });
    expect(metricHeaders[0]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(metricHeaders[2]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(metricHeaders[3]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);

    const bodyCells = [...container.querySelectorAll(':scope tbody tr[data-row-key="s-1"] td')];
    expect(bodyCells[2]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(bodyCells[4]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(bodyCells[5]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(screen.getAllByLabelText('Student One, Task 1, Completeness: 5')[0]).toBeInTheDocument();

    // Zero-weight marking alone never introduces the baseline caption.
    expect(screen.queryByText(BASELINE_CAPTION)).not.toBeInTheDocument();
  });

  it('preserves numeric zero-weight scores, genuine N and E as distinct rendered cell states', () => {
    const base = buildHeatmapResult();
    const result = {
      ...base,
      taskColumns: base.taskColumns.map((column, index) => {
        return index === 0
          ? { ...column, averageContribution: { effectiveWeight: 0, includedInAverage: false } }
          : { ...column };
      }),
    };
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(screen.getAllByLabelText('Student One, Task 1, Completeness: 5')[0]).toBeInTheDocument();
    expect(
      screen.getAllByLabelText('Student Three, Task 1, Completeness: N')[0]
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Student Two, Task 2, Completeness: E')[0]).toBeInTheDocument();
    expect(screen.queryByText('Excluded')).not.toBeInTheDocument();
  });

  it('keeps the zero-weight score cell conditional-format background unchanged', () => {
    const baseline = buildHeatmapResult();
    const baselineRender = render(
      <TaskHeatmapTable
        heatmapResult={baseline}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );
    const baselineCell = screen.getAllByLabelText(
      'Student One, Task 1, Completeness: 5'
    )[0] as HTMLElement;
    const baselineBackground = baselineCell.style.backgroundColor;
    baselineRender.unmount();

    const excludedColumnResult = {
      ...baseline,
      taskColumns: baseline.taskColumns.map((column, index) => {
        return index === 0
          ? { ...column, averageContribution: { effectiveWeight: 0, includedInAverage: false } }
          : { ...column };
      }),
    };
    render(
      <TaskHeatmapTable
        heatmapResult={excludedColumnResult}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const excludedCell = screen.getAllByLabelText(
      'Student One, Task 1, Completeness: 5'
    )[0] as HTMLElement;
    expect(excludedCell.style.backgroundColor).toBe(baselineBackground);
    expect(excludedCell.textContent).toBe('5');
  });

  it('applies per-task markers inside merged assignment tiers without marking parent or sticky columns', () => {
    const { container } = render(
      <TaskHeatmapTable
        heatmapResult={buildMergedZeroWeightResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const mergedHeaderName = `Merged zero-weight task — ${ZERO_WEIGHT_EXPLANATION}`;
    const mergedHeader = screen.getByRole('columnheader', { name: mergedHeaderName });
    expect(mergedHeader).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);
    expect(screen.getByRole('columnheader', { name: 'Parent tier' })).not.toHaveClass(
      EXCLUDED_COLUMN_GROUP_CLASS
    );
    expect(screen.getByRole('columnheader', { name: 'Forename' })).not.toHaveClass(
      EXCLUDED_COLUMN_GROUP_CLASS
    );
    expect(screen.getByRole('columnheader', { name: 'Surname' })).not.toHaveClass(
      EXCLUDED_COLUMN_GROUP_CLASS
    );

    const focusableTitle = screen.getByRole('group', {
      name: `Merged zero-weight task ${ZERO_WEIGHT_EXPLANATION}`,
    });
    expect(focusableTitle).toBeInTheDocument();
    const completeness = screen.getAllByRole('columnheader', { name: /completeness/i });
    expect(completeness[0]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(completeness[1]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);

    const studentRow = container.querySelector(':scope tbody tr[data-row-key="student-1"]');
    expect(studentRow).not.toBeNull();
    const scoreMatches = within(studentRow as HTMLElement).getAllByLabelText(
      'Student One, Merged zero-weight task, Completeness: 4'
    );
    expect(scoreMatches[0]).toBeInTheDocument();
    expect(scoreMatches[0]).toHaveTextContent('4');
  });
});

/**
 * Render a locally cloned embedded result whose first task sits outside the
 * attempt baseline while keeping a positive weighting.
 * @returns {ReturnType<typeof render>} The rendered table.
 */
function renderEmbeddedBaselineOffTable() {
  const base = buildHeatmapResult();
  const result = {
    ...base,
    taskColumns: base.taskColumns.map((column, index) =>
      index === 0 ? { ...column, includedInAttemptBaseline: false } : { ...column }
    ),
    rows: base.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  };

  return render(
    <TaskHeatmapTable
      heatmapResult={result}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

/**
 * Render a locally cloned embedded result whose first task is both
 * zero-weight and outside the attempt baseline.
 * @returns {ReturnType<typeof render>} The rendered table.
 */
function renderEmbeddedCoOccurringTable() {
  const base = buildHeatmapResult();
  const result = {
    ...base,
    taskColumns: base.taskColumns.map((column, index) => {
      return index === 0
        ? {
            ...column,
            averageContribution: { effectiveWeight: 0, includedInAverage: false },
            includedInAttemptBaseline: false,
          }
        : { ...column };
    }),
    rows: base.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  };

  return render(
    <TaskHeatmapTable
      heatmapResult={result}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

describe('TaskHeatmapTable zero-weight and baseline-off shared visual language', () => {
  /** Weighting that contributes to averages (the baseline-off column default). */
  const POSITIVE_CONTRIBUTION = { effectiveWeight: 1, includedInAverage: true };
  /** Metric sub-column count of a full task group. */
  const THREE_METRICS = 3;
  /** Zero-based index of the last metric in a three-metric group. */
  const LAST_METRIC_INDEX = 2;
  /** Single-metric group count used for the both-edges case. */
  const SINGLE_METRIC_GROUP = 1;

  it('applies the zero-weight edge classes to a column outside the attempt baseline even when its weighting is positive', () => {
    const firstEdge = getExcludedMetricEdgeClass(0, THREE_METRICS, POSITIVE_CONTRIBUTION, {
      includedInAttemptBaseline: false,
    });
    expect(firstEdge).toBeDefined();
    expect(firstEdge).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(
      getExcludedMetricEdgeClass(1, THREE_METRICS, POSITIVE_CONTRIBUTION, {
        includedInAttemptBaseline: false,
      })
    ).toBeUndefined();
    expect(
      getExcludedMetricEdgeClass(LAST_METRIC_INDEX, THREE_METRICS, POSITIVE_CONTRIBUTION, {
        includedInAttemptBaseline: false,
      })
    ).toContain(EXCLUDED_COLUMN_LAST_CLASS);
    const singleMetricEdge = getExcludedMetricEdgeClass(
      0,
      SINGLE_METRIC_GROUP,
      POSITIVE_CONTRIBUTION,
      { includedInAttemptBaseline: false }
    );
    expect(singleMetricEdge).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(singleMetricEdge).toContain(EXCLUDED_COLUMN_LAST_CLASS);
  });

  it('applies the identical edge classes when zero weighting and baseline exclusion co-occur', () => {
    const zeroWeightContribution = { effectiveWeight: 0, includedInAverage: false };
    const zeroWeightOnly = getExcludedMetricEdgeClass(
      0,
      SINGLE_METRIC_GROUP,
      zeroWeightContribution,
      {
        includedInAttemptBaseline: true,
      }
    );
    const coOccurring = getExcludedMetricEdgeClass(0, SINGLE_METRIC_GROUP, zeroWeightContribution, {
      includedInAttemptBaseline: false,
    });

    // One visual language: the cause never changes the chrome.
    expect(coOccurring).toBe(zeroWeightOnly);
    expect(coOccurring).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(coOccurring).toContain(EXCLUDED_COLUMN_LAST_CLASS);
  });

  it('presents a baseline-only marked heading with the shared group chrome and the baseline explanation', () => {
    const presentation = buildTaskHeaderPresentation('Task X', POSITIVE_CONTRIBUTION, {
      includedInAttemptBaseline: false,
    });

    expect(presentation.className).toBe(EXCLUDED_COLUMN_GROUP_CLASS);
    expect(presentation.title).not.toBe('Task X');
    const headerCellProperties = presentation.onHeaderCell?.();
    expect(headerCellProperties?.['aria-label']).toContain('Task X');
    expect(headerCellProperties?.['aria-label']).toContain(BASELINE_OFF_EXPLANATION);
  });

  it('composes the co-occurring header aria-label with the baseline fact before the zero-weight fact', () => {
    const presentation = buildTaskHeaderPresentation(
      'Task X',
      { effectiveWeight: 0, includedInAverage: false },
      { includedInAttemptBaseline: false }
    );
    const label = presentation.onHeaderCell?.()['aria-label'] ?? '';
    const baselineIndex = label.indexOf(BASELINE_OFF_EXPLANATION);
    const zeroWeightIndex = label.indexOf(ZERO_WEIGHT_EXPLANATION);

    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(zeroWeightIndex).toBeGreaterThanOrEqual(0);
    expect(baselineIndex).toBeLessThan(zeroWeightIndex);
  });

  it('applies the shared edge classes to baseline-off metric headers and body cells', () => {
    const { container } = renderEmbeddedBaselineOffTable();

    const markedSpan = screen.getByRole('group');
    expect(markedSpan.textContent).toBe(`Task 1${BASELINE_MARKER}`);
    expect(markedSpan.closest('th')).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);

    const metricHeaders = screen.getAllByRole('columnheader', {
      name: /completeness|accuracy|spag/i,
    });
    expect(metricHeaders[0]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(metricHeaders[2]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(metricHeaders[3]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);

    const bodyCells = [...container.querySelectorAll(':scope tbody tr[data-row-key="s-1"] td')];
    expect(bodyCells[2]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(bodyCells[4]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(bodyCells[5]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
  });

  it('renders one composed tooltip with the baseline fact before the zero-weight fact when both causes co-occur', async () => {
    renderEmbeddedCoOccurringTable();

    const markedSpan = screen.getByRole('group');
    expect(markedSpan.textContent).toBe(`Task 1${BASELINE_MARKER}`);

    // The focusable target's aria-label carries both facts, baseline first.
    const spanLabel = markedSpan.getAttribute('aria-label') ?? '';
    expect(spanLabel).toContain(BASELINE_OFF_EXPLANATION);
    expect(spanLabel).toContain(ZERO_WEIGHT_EXPLANATION);
    expect(spanLabel.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      spanLabel.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // The header cell aria-label follows the same order.
    const headerLabel = markedSpan.closest('th')?.getAttribute('aria-label') ?? '';
    expect(headerLabel.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      headerLabel.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // One composed tooltip body — never two stacked tooltips.
    await user.hover(markedSpan);
    const tooltip = await screen.findByRole('tooltip');
    const tooltipText = tooltip.textContent ?? '';
    expect(tooltipText).toContain(BASELINE_OFF_EXPLANATION);
    expect(tooltipText).toContain(ZERO_WEIGHT_EXPLANATION);
    expect(tooltipText.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      tooltipText.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // The marked column also brings the caption in.
    expect(screen.getByText(BASELINE_CAPTION)).toBeInTheDocument();
  });
});
