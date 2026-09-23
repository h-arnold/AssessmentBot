import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';
import { buildCell, buildHeatmapResult } from '../../test/taskHeatmapTableTestHelpers';

const ZERO_WEIGHT_EXPLANATION =
  'Zero weighting — scores are shown but do not contribute to averages.';
const ZERO_WEIGHT_GROUP_CLASS = 'task-heatmap-zero-weight-group';
const ZERO_WEIGHT_FIRST_CLASS = 'task-heatmap-zero-weight-first';
const ZERO_WEIGHT_LAST_CLASS = 'task-heatmap-zero-weight-last';
const MAX_ZERO_TITLE_TAB_STEPS = 20;

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
    taskColumns: base.taskColumns.map((column, index) =>
      index === 0
        ? {
            ...column,
            averageContribution: { effectiveWeight: 0, includedInAverage: false },
          }
        : { ...column }
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
        assignmentId: 'assignment-1',
        definitionKey: 'definition-1',
        assignmentName: 'Parent tier',
      },
      {
        taskKey: 'definition-2::positive-task',
        taskId: 'positive-task',
        taskTitle: 'Merged positive task',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
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
  it('shows the exact explanation on pointer hover and keyboard focus with one non-actionable tab stop', async () => {
    renderEmbeddedZeroWeightTable();

    const title = screen.getByLabelText(`Task 1 ${ZERO_WEIGHT_EXPLANATION}`);
    expect(title).toHaveAttribute('tabindex', '0');
    expect(title).not.toHaveAttribute('role');
    expect(screen.getAllByLabelText(`Task 1 ${ZERO_WEIGHT_EXPLANATION}`)).toHaveLength(1);

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
    expect(screen.getByRole('columnheader', { name: 'Task 1' })).toBeInTheDocument();
  });

  it('keeps positive task titles plain and marks only the independently zero-weight embedded group', () => {
    const { container } = renderEmbeddedZeroWeightTable();

    expect(screen.getByRole('columnheader', { name: 'Task 2' })).toBeInTheDocument();
    expect(screen.queryByLabelText(`Task 2 ${ZERO_WEIGHT_EXPLANATION}`)).not.toBeInTheDocument();
    expect(screen.queryByText(ZERO_WEIGHT_EXPLANATION)).not.toBeInTheDocument();

    const zeroHeader = screen.getByRole('columnheader', { name: 'Task 1' });
    expect(zeroHeader).toHaveClass(ZERO_WEIGHT_GROUP_CLASS);
    const metricHeaders = screen.getAllByRole('columnheader', {
      name: /completeness|accuracy|spag/i,
    });
    expect(metricHeaders[0]).toHaveClass(ZERO_WEIGHT_FIRST_CLASS);
    expect(metricHeaders[2]).toHaveClass(ZERO_WEIGHT_LAST_CLASS);
    expect(metricHeaders[3]).not.toHaveClass(ZERO_WEIGHT_FIRST_CLASS);

    const bodyCells = [...container.querySelectorAll('tbody tr[data-row-key="s-1"] td')];
    expect(bodyCells[2]).toHaveClass(ZERO_WEIGHT_FIRST_CLASS);
    expect(bodyCells[4]).toHaveClass(ZERO_WEIGHT_LAST_CLASS);
    expect(bodyCells[5]).not.toHaveClass(ZERO_WEIGHT_FIRST_CLASS);
    expect(
      screen.getAllByLabelText('Student One, task_001, Completeness: 5')[0]
    ).toBeInTheDocument();
  });

  it('preserves numeric zero-weight scores, genuine N and E as distinct rendered cell states', () => {
    const base = buildHeatmapResult();
    const result = {
      ...base,
      taskColumns: base.taskColumns.map((column, index) =>
        index === 0
          ? { ...column, averageContribution: { effectiveWeight: 0, includedInAverage: false } }
          : { ...column }
      ),
    };
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(
      screen.getAllByLabelText('Student One, task_001, Completeness: 5')[0]
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText('Student Three, task_001, Completeness: N')[0]
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText('Student Two, task_002, Completeness: E')[0]
    ).toBeInTheDocument();
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
      'Student One, task_001, Completeness: 5'
    )[0] as HTMLElement;
    const baselineBackground = baselineCell.style.backgroundColor;
    baselineRender.unmount();

    const excludedColumnResult = {
      ...baseline,
      taskColumns: baseline.taskColumns.map((column, index) =>
        index === 0
          ? { ...column, averageContribution: { effectiveWeight: 0, includedInAverage: false } }
          : { ...column }
      ),
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
      'Student One, task_001, Completeness: 5'
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

    const mergedHeader = screen.getByRole('columnheader', { name: 'Merged zero-weight task' });
    expect(mergedHeader).toHaveClass(ZERO_WEIGHT_GROUP_CLASS);
    expect(screen.getByRole('columnheader', { name: 'Parent tier' })).not.toHaveClass(
      ZERO_WEIGHT_GROUP_CLASS
    );
    expect(screen.getByRole('columnheader', { name: 'Forename' })).not.toHaveClass(
      ZERO_WEIGHT_GROUP_CLASS
    );
    expect(screen.getByRole('columnheader', { name: 'Surname' })).not.toHaveClass(
      ZERO_WEIGHT_GROUP_CLASS
    );

    const focusableTitle = screen.getByLabelText(
      `Merged zero-weight task ${ZERO_WEIGHT_EXPLANATION}`
    );
    expect(focusableTitle).toBeInTheDocument();
    const completeness = screen.getAllByRole('columnheader', { name: /completeness/i });
    expect(completeness[0]).toHaveClass(ZERO_WEIGHT_FIRST_CLASS);
    expect(completeness[1]).not.toHaveClass(ZERO_WEIGHT_FIRST_CLASS);

    const studentRow = container.querySelector('tbody tr[data-row-key="student-1"]');
    expect(studentRow).not.toBeNull();
    const scoreMatches = within(studentRow as HTMLElement).getAllByLabelText(
      'Student One, zero-task, Completeness: 4'
    );
    expect(scoreMatches[0]).toBeInTheDocument();
    expect(scoreMatches[0]).toHaveTextContent('4');
  });
});
