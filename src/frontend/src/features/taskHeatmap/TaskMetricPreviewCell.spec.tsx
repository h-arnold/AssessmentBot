/**
 * Contract tests for the trigger and preview behaviour owned by `TaskMetricPreviewCell`.
 *
 * This suite renders the metric-cell module directly — the trigger/Popover
 * responsibility delegated by `taskHeatmapTableColumns.tsx` — and pins its
 * module contract: the shared accessible label and
 * score text on a native button trigger that carries no background
 * tone of its own, hover and click activation, explicit Enter/Space handling,
 * right placement, and content assembly deferred until the overlay actually
 * opens.
 *
 * Controlled focus ownership and Escape restoration are out of scope for this
 * characterisation and are deliberately not asserted here.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import { TaskMetricPreviewCell } from './TaskMetricPreviewCell';
import { buildMetricCellAccessibleLabel } from './taskHeatmapTableColumns';
import {
  CANONICAL_READY_CELL,
  buildCanonicalReadyCellData,
} from '../../test/taskHeatmap/previewFixtures';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';
import { formatMetricDisplayText } from '../../services/dataAnalysis/metricDisplay/metricDisplayText';
import { APP_GAP_XS } from '../../theme/spacing';
import type * as TaskPreviewDataModule from './assembleTaskPreviewData';

const { assembleTaskPreviewDataSpy } = vi.hoisted(() => ({
  assembleTaskPreviewDataSpy: vi.fn(),
}));

vi.mock('./assembleTaskPreviewData', async (importOriginal) => {
  const actual = await importOriginal<typeof TaskPreviewDataModule>();
  assembleTaskPreviewDataSpy.mockImplementation(actual.assembleTaskPreviewData);
  return { ...actual, assembleTaskPreviewData: assembleTaskPreviewDataSpy };
});

/** Ready cell data derived from the canonical Slides submission item. */
const CELL_DATA = buildCanonicalReadyCellData();
/** Analyser metric result for the characterised cell. */
const METRIC_RESULT = createComputedMetricResult({ value: CANONICAL_READY_CELL.completenessScore });
/** Score text rendered inside the trigger, formatted as the column builder formats it. */
const SCORE_TEXT = formatMetricDisplayText(METRIC_RESULT, 0);
/** Accessible label shared by the table cell and the popover trigger. */
const ACCESSIBLE_LABEL = buildMetricCellAccessibleLabel(
  CANONICAL_READY_CELL.studentName,
  CANONICAL_READY_CELL.taskTitle,
  'completeness',
  SCORE_TEXT
);
/** Bare task ID passed to the preview content by the column builder. */
const TASK_ID = CANONICAL_READY_CELL.taskId;

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  assembleTaskPreviewDataSpy.mockClear();
  user = userEvent.setup();
});

afterEach(() => {
  cleanup();
});

type CellProperties = ComponentProps<typeof TaskMetricPreviewCell>;

/**
 * Render `TaskMetricPreviewCell` with the inputs the column builder supplies.
 *
 * @param {Partial<CellProperties>} [overrides] - Per-test prop overrides.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderCell(overrides: Partial<CellProperties> = {}): ReturnType<typeof render> {
  return render(
    <TaskMetricPreviewCell
      accessibleLabel={ACCESSIBLE_LABEL}
      scoreText={SCORE_TEXT}
      cellData={CELL_DATA}
      metricResult={METRIC_RESULT}
      metricKey="completeness"
      taskId={TASK_ID}
      isLoading={false}
      hasError={false}
      {...overrides}
    />
  );
}

/**
 * Wait until the popover overlay has mounted its content in the document.
 *
 * @returns {Promise<void>} Resolves once the overlay content is present.
 */
async function waitForPopoverContent(): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector('.ant-popover-content')).toBeInTheDocument();
  });
}

describe('TaskMetricPreviewCell', () => {
  it('renders the score as a focusable button trigger carrying the shared accessible label', () => {
    renderCell();

    const trigger = screen.getByRole('button', { name: ACCESSIBLE_LABEL });

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).not.toHaveAttribute('role');
    expect(trigger).not.toHaveAttribute('tabindex');
    expect(trigger).toHaveTextContent(SCORE_TEXT);
    // Documented 4px half-unit exception: the padding widens the hover/click
    // target around the score without covering the whole table cell.
    expect(trigger).toHaveStyle({ padding: `${APP_GAP_XS}px`, display: 'inline-block' });
    // Tone mapping stays a `<td>` responsibility (`onCell` in the columns
    // module), so the extracted trigger paints no background of its own.
    expect(trigger.style.backgroundColor).toBe('');
  });

  it('opens the popover on hover, placed to the right of the trigger', async () => {
    renderCell();

    await user.hover(screen.getByRole('button', { name: ACCESSIBLE_LABEL }));
    await waitForPopoverContent();

    expect(document.querySelector('.ant-popover')).toHaveClass('ant-popover-placement-right');
  });

  it('opens the popover on click', async () => {
    renderCell();

    await user.click(screen.getByRole('button', { name: ACCESSIBLE_LABEL }));
    await waitForPopoverContent();
  });

  it('opens the popover when Enter is pressed on the focused trigger', async () => {
    renderCell();
    const trigger = screen.getByRole('button', { name: ACCESSIBLE_LABEL });

    trigger.focus();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitForPopoverContent();
  });

  it('opens the popover when Space is pressed on the focused trigger', async () => {
    renderCell();
    const trigger = screen.getByRole('button', { name: ACCESSIBLE_LABEL });

    trigger.focus();
    expect(trigger).toHaveFocus();
    // `{ }` resolves to the Space key (`key === ' '`), which is the value the
    // trigger's keydown handler matches.
    await user.keyboard('{ }');

    await waitForPopoverContent();
  });

  it('defers preview assembly until the overlay is opened', async () => {
    renderCell();

    expect(assembleTaskPreviewDataSpy).not.toHaveBeenCalled();

    await user.hover(screen.getByRole('button', { name: ACCESSIBLE_LABEL }));
    await waitForPopoverContent();

    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledTimes(1);
    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledWith(
      CELL_DATA,
      METRIC_RESULT,
      'completeness',
      TASK_ID
    );
  });
});
