/**
 * Tests for the `TaskPreviewCard` presentational component.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  createComputedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';
import { NOT_ATTEMPTED_METRIC } from '../../services/dataAnalysis/heatmapAdapter';
import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import { TaskPreviewCard, type TaskPreviewData } from './TaskPreviewCard';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

const IMAGE_CONTENT = 'data:image/png;base64,iVBORw0KGgo=';
const TABLE_CONTENT = '| A | B |\n|---|---|\n| 1 | 2 |';
const TEXT_CONTENT = 'Hello world';
const REASONING_TEXT =
  'The student demonstrates a solid understanding of the core concepts.';

/** Score carried by the default computed fixture. */
const COMPUTED_SCORE = 5;
/** Score carried by the accuracy zero-decimal fixture. */
const ACCURACY_SCORE = 3;

/** A schema-valid error task-display metric. */
const ERROR_METRIC: TaskDisplayMetric = createErrorMetricResult();

/**
 * One schema-valid task-display metric per state that must remain renderable,
 * with a human-readable label because Vitest formats the numeric computed value
 * as a signed literal in interpolated test titles.
 */
const VALID_PREVIEW_METRICS: ReadonlyArray<{
  readonly label: string;
  readonly metric: TaskDisplayMetric;
}> = [
  { label: 'computed 0', metric: createComputedMetricResult({ value: 0 }) },
  { label: 'notAttempted N', metric: NOT_ATTEMPTED_METRIC },
  { label: 'error E', metric: ERROR_METRIC },
];

// ---------------------------------------------------------------------------
// Helper factory for test data
// ---------------------------------------------------------------------------

/**
 * Build a `TaskPreviewData` fixture for tests with sensible defaults.
 *
 * Overrides are a plain `Partial<TaskPreviewData>` because the metric is a
 * single discriminated `TaskDisplayMetric`, in which each state carries its own
 * real value shape, so state and value cannot be widened independently into
 * incoherent combinations.
 *
 * @param {Partial<TaskPreviewData>} [overrides] - Fields to override on the default fixture.
 * @returns {TaskPreviewData} A fully-formed preview data object for rendering.
 */
function createPreviewData(overrides: Partial<TaskPreviewData> = {}): TaskPreviewData {
  const baseData = {
    taskId: 'test-task-1',
    artifactType: 'IMAGE',
    artifactContent: IMAGE_CONTENT,
    metricKey: 'completeness',
    metric: createComputedMetricResult({ value: COMPUTED_SCORE }),
    reasoning: REASONING_TEXT,
  } satisfies TaskPreviewData;

  return { ...baseData, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskPreviewCard', () => {
  // --- Header: computed metric ---
  it('renders header with correct metric label and score for a computed metric', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metricKey: 'completeness',
          metric: createComputedMetricResult({ value: COMPUTED_SCORE }),
        })}
      />,
    );

    // Metric label text with colon from Typography.Text
    expect(screen.getByText('Completeness:')).toBeInTheDocument();
    // MetricPill score value
    expect(screen.getByText(String(COMPUTED_SCORE))).toBeInTheDocument();
    // MetricIconLabel must not be rendered (icon removed in favour of text-only header)
    expect(screen.queryByLabelText('Completeness')).not.toBeInTheDocument();
  });

  // --- Header: notAttempted ---
  it('renders header with "N" for a notAttempted metric', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metric: NOT_ATTEMPTED_METRIC,
        })}
      />,
    );

    expect(screen.getByText('N')).toBeInTheDocument();
  });

  // --- Header: error ---
  it('renders header with "E" for an error metric', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metric: ERROR_METRIC,
          reasoning: '',
        })}
      />,
    );

    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it.each(VALID_PREVIEW_METRICS)('renders a valid metric pair: $label', ({ metric }) => {
    const data = { ...createPreviewData(), metric } satisfies TaskPreviewData;

    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText(String(metric.value))).toBeInTheDocument();
  });

  // --- Reasoning: provided text ---
  it('renders reasoning section with the provided reasoning text', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard data={createPreviewData()} />,
    );

    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText(REASONING_TEXT)).toBeInTheDocument();
  });

  // --- Reasoning: empty ---
  it('renders "No reasoning available" when reasoning is empty', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard data={createPreviewData({ reasoning: '' })} />,
    );

    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText('No reasoning available')).toBeInTheDocument();
  });

  // --- Artifact: IMAGE ---
  it('renders an IMAGE artifact using ImageRenderer', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard data={createPreviewData()} />,
    );

    const img = document.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', IMAGE_CONTENT);
  });

  // --- Artifact: TABLE ---
  it('renders a TABLE artifact using MarkdownRenderer', () => {
    const data = createPreviewData({
      artifactType: 'TABLE',
      artifactContent: TABLE_CONTENT,
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  // --- Artifact: TEXT ---
  it('renders a TEXT artifact using MarkdownRenderer', () => {
    const data = createPreviewData({
      artifactType: 'TEXT',
      artifactContent: TEXT_CONTENT,
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  // --- Empty content: notAttempted ---
  it('renders "No submission available" when artifact content is empty (notAttempted)', () => {
    const data = createPreviewData({
      metric: NOT_ATTEMPTED_METRIC,
      artifactContent: '',
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('No submission available')).toBeInTheDocument();
  });

  // --- Empty content: error ---
  it('renders "Error loading response" when artifact content is empty (error)', () => {
    const data = createPreviewData({
      metric: ERROR_METRIC,
      artifactContent: '',
      reasoning: '',
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('Error loading response')).toBeInTheDocument();
  });

  // --- Empty content: computed ---
  it('renders "No content available" when artifact content is empty (computed)', () => {
    const data = createPreviewData({
      metric: createComputedMetricResult({ value: COMPUTED_SCORE }),
      artifactContent: '',
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('No content available')).toBeInTheDocument();
  });

  // --- Integer score precision ---
  it('renders the computed score as an integer (e.g. "5", not "5.00")', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metricKey: 'accuracy',
          metric: createComputedMetricResult({ value: ACCURACY_SCORE }),
          reasoning: 'No decimal scores appear in this test.',
        })}
      />,
    );

    const pillText = screen.getByText(String(ACCURACY_SCORE));
    expect(pillText).toBeInTheDocument();
    // Ensure there is no decimal point (toFixed(0) should produce integer)
    expect(pillText.textContent).not.toContain('.');
  });
});
