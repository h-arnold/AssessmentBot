/**
 * Behaviour-preserving characterisation spec for `TaskMetricPreviewContent`.
 *
 * This suite renders the popover-content module directly and pins its content
 * contract as consumed by `TaskMetricPreviewCell`: loading wins over an error,
 * the error alert appears only when nothing is pending, and ready content
 * assembles the cell data into `TaskPreviewCard` — including the explicit
 * no-submission case where `cellData` is null.
 *
 * Pointer/keyboard activation and closed-overlay deferral are characterised in
 * `TaskMetricPreviewCell.spec.tsx`.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { TaskMetricPreviewContent } from './TaskMetricPreviewContent';
import { CARD_MAX_WIDTH, SOURCE_ACTION_LABEL } from './TaskPreviewCard';
import {
  CANONICAL_READY_CELL,
  buildCanonicalReadyCellData,
} from '../../test/taskHeatmap/previewFixtures';
import {
  CANONICAL_SOURCE_URL,
  buildCanonicalCellWithoutSourceUrl,
} from '../../test/taskHeatmap/previewSourceActionTestHelpers';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';
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
/** Bare task ID passed to the preview content by the cell. */
const TASK_ID = CANONICAL_READY_CELL.taskId;

beforeEach(() => {
  assembleTaskPreviewDataSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

type ContentProperties = ComponentProps<typeof TaskMetricPreviewContent>;

/**
 * Render `TaskMetricPreviewContent` with the inputs the cell supplies.
 *
 * @param {Partial<ContentProperties>} [overrides] - Per-test prop overrides.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderContent(overrides: Partial<ContentProperties> = {}): ReturnType<typeof render> {
  return render(
    <TaskMetricPreviewContent
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

describe('TaskMetricPreviewContent', () => {
  it('shows the loading skeleton instead of the error alert when both are set', () => {
    const { container } = renderContent({ isLoading: true, hasError: true });

    const status = container.querySelector('output[aria-busy="true"]');
    expect(status).toBeInTheDocument();
    // Deliberate verbatim pin of the spec-fixed loading label; every other
    // consumer imports `LOADING_PREVIEW_LABEL`.
    expect(status).toHaveAttribute('aria-label', 'Loading task preview');
    // The skeleton mirrors CARD_MAX_WIDTH so it does not resize when the
    // ready card arrives.
    expect(status).toHaveStyle({ display: 'block', width: `${CARD_MAX_WIDTH}px` });
    expect(status?.querySelector('.ant-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error alert only when nothing is pending', () => {
    const { container } = renderContent({ isLoading: false, hasError: true });

    // Deliberate verbatim pin of the spec-fixed error text; every other
    // consumer imports `PREVIEW_ERROR_TEXT`.
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load task details");
    expect(container.querySelector('output[aria-busy="true"]')).not.toBeInTheDocument();
  });

  it('assembles the cell data into the ready preview card', () => {
    renderContent({ isLoading: false, hasError: false });

    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledTimes(1);
    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledWith(
      CELL_DATA,
      METRIC_RESULT,
      'completeness',
      TASK_ID
    );

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      `Completeness score: ${CANONICAL_READY_CELL.completenessScore}`
    );
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText(CANONICAL_READY_CELL.completenessReasoning)).toBeInTheDocument();
    expect(screen.getByText('Student Response')).toBeInTheDocument();
    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reuses assembled preview data for unchanged ready inputs and invalidates it when an input changes', () => {
    const { rerender } = renderContent();
    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledTimes(1);

    rerender(
      <TaskMetricPreviewContent
        cellData={CELL_DATA}
        metricResult={METRIC_RESULT}
        metricKey="completeness"
        taskId={TASK_ID}
        isLoading={false}
        hasError={false}
      />
    );
    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledTimes(1);

    assembleTaskPreviewDataSpy.mockClear();
    rerender(
      <TaskMetricPreviewContent
        cellData={CELL_DATA}
        metricResult={METRIC_RESULT}
        metricKey="accuracy"
        taskId={TASK_ID}
        isLoading={false}
        hasError={false}
      />
    );
    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'loading', isLoading: true, hasError: false },
    { label: 'error', isLoading: false, hasError: true },
  ])('skips ready-data assembly for the $label state', ({ isLoading, hasError }) => {
    renderContent({ isLoading, hasError });
    expect(assembleTaskPreviewDataSpy).not.toHaveBeenCalled();
  });

  it('renders the empty-content card when no cell data exists', () => {
    renderContent({ cellData: null });

    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledWith(
      null,
      METRIC_RESULT,
      'completeness',
      TASK_ID
    );
    expect(screen.getByText('No reasoning available')).toBeInTheDocument();
  });
});

describe('TaskMetricPreviewContent source action availability', () => {
  it('offers the source action on the ready card when the cell carries a derived URL', () => {
    renderContent({ isLoading: false, hasError: false });

    expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
      'href',
      CANONICAL_SOURCE_URL
    );
  });

  it('offers no source action when the cell carries no derived URL', () => {
    renderContent({ cellData: buildCanonicalCellWithoutSourceUrl() });

    // The ready card still renders its content; only the action is absent, and
    // no disabled placeholder may stand in for it.
    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(SOURCE_ACTION_LABEL)).not.toBeInTheDocument();
  });

  it('offers no source action while the preview is loading', () => {
    renderContent({ isLoading: true });

    // A full-data loading state must not invent a link to a source it has not
    // loaded yet.
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
  });

  it('offers no source action for a failed preview', () => {
    renderContent({ hasError: true });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
  });
});
