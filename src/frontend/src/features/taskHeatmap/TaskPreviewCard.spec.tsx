/**
 * Tests for the `TaskPreviewCard` presentational component.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  TaskPreviewCard,
  type TaskPreviewData,
  type TaskPreviewMetric,
} from './TaskPreviewCard';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

const IMAGE_CONTENT = 'data:image/png;base64,iVBORw0KGgo=';
const TABLE_CONTENT = '| A | B |\n|---|---|\n| 1 | 2 |';
const TEXT_CONTENT = 'Hello world';
const REASONING_TEXT =
  'The student demonstrates a solid understanding of the core concepts.';

/** Valid task-display state and score pairs that must remain renderable. */
const VALID_PREVIEW_METRIC_PAIRS = [
  { metricState: 'computed', metricScore: 0 },
  { metricState: 'notAttempted', metricScore: 'N' },
  { metricState: 'error', metricScore: 'E' },
] as const;

// ---------------------------------------------------------------------------
// Helper factory for test data
// ---------------------------------------------------------------------------

type TaskPreviewDataOverrides =
  | Partial<Omit<TaskPreviewData, keyof TaskPreviewMetric>>
  | (Partial<Omit<TaskPreviewData, keyof TaskPreviewMetric>> & TaskPreviewMetric);

/**
 * Build a `TaskPreviewData` fixture for tests with sensible defaults.
 *
 * Metric state and score may only be overridden together as one valid
 * discriminated pair; widening both fields independently would make invalid
 * pairings such as `computed` with `null` legal in this test helper.
 *
 * @param {TaskPreviewDataOverrides} overrides - Fields to override on the default fixture.
 * @returns {TaskPreviewData} A fully-formed preview data object for rendering.
 */
function createPreviewData(overrides: TaskPreviewDataOverrides = {}): TaskPreviewData {
  const baseData = {
    taskId: 'test-task-1',
    artifactType: 'IMAGE',
    artifactContent: IMAGE_CONTENT,
    metricKey: 'completeness',
    metricScore: 5,
    metricState: 'computed',
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
          metricScore: 5,
          metricState: 'computed',
        })}
      />,
    );

    // Metric label text with colon from Typography.Text
    expect(screen.getByText('Completeness:')).toBeInTheDocument();
    // MetricPill score value
    expect(screen.getByText('5')).toBeInTheDocument();
    // MetricIconLabel must not be rendered (icon removed in favour of text-only header)
    expect(screen.queryByLabelText('Completeness')).not.toBeInTheDocument();
  });

  // --- Header: notAttempted ---
  it('renders header with "N" for a notAttempted metric', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metricState: 'notAttempted',
          metricScore: 'N',
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
          metricState: 'error',
          metricScore: 'E',
          reasoning: '',
        })}
      />,
    );

    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it.each(VALID_PREVIEW_METRIC_PAIRS)(
    'renders the valid $metricState state and $metricScore score pair',
    (metric) => {
      const data = { ...createPreviewData(), ...metric } satisfies TaskPreviewData;

      renderWithFrontendProviders(<TaskPreviewCard data={data} />);

      expect(screen.getByText(String(metric.metricScore))).toBeInTheDocument();
    }
  );

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
      metricState: 'notAttempted',
      metricScore: 'N',
      artifactContent: '',
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('No submission available')).toBeInTheDocument();
  });

  // --- Empty content: error ---
  it('renders "Error loading response" when artifact content is empty (error)', () => {
    const data = createPreviewData({
      metricState: 'error',
      metricScore: 'E',
      artifactContent: '',
      reasoning: '',
    });
    renderWithFrontendProviders(<TaskPreviewCard data={data} />);

    expect(screen.getByText('Error loading response')).toBeInTheDocument();
  });

  // --- Integer score precision ---
  it('renders the computed score as an integer (e.g. "5", not "5.00")', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          metricKey: 'accuracy',
          metricScore: 3,
          metricState: 'computed',
          reasoning: 'No decimal scores appear in this test.',
        })}
      />,
    );

    const pillText = screen.getByText('3');
    expect(pillText).toBeInTheDocument();
    // Ensure there is no decimal point (toFixed(0) should produce integer)
    expect(pillText.textContent).not.toContain('.');
  });
});
