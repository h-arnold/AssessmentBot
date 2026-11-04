/**
 * Error-state rendering tests for `TaskPreviewCard`.
 *
 * Pins what the card does with the derived `error` and `sourceState` carried by
 * `TaskPreviewData`: a known `E` still shows its recorded reasoning, an
 * unavailable source replaces the response renderer with a non-dismissible
 * inline Alert, a pending full fetch shows only a source-region skeleton behind
 * the known reasoning, and an assessment-only `E` whose content survived keeps
 * rendering the response. A genuine no-submission stays the ready `N`
 * placeholder with no Alert, and a legacy result gets the reassessment copy.
 *
 * Recorded reasoning comes from the Assessment error catalogue. Realistic
 * reasoning and content come from the canonical `small` ready cell, and the
 * error probes are local fixtures built around it.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';

import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { createComputedMetricResult, createErrorMetricResult } from '@/test/dataAnalysis/fixtures';
import { NOT_ATTEMPTED_METRIC } from '@/services/dataAnalysis/heatmapAdapter';
import { CANONICAL_READY_CELL } from '@/test/taskHeatmap/previewFixtures';
import {
  SOURCE_ACTION_LABEL,
  TaskPreviewCard,
  type TaskPreviewData,
  type TaskPreviewSourceState,
} from './TaskPreviewCard';
import type { AssessmentError } from './buildCellPreviewLookup';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

/** Alert title the layout spec fixes for an unavailable source. */
const SOURCE_UNAVAILABLE_TITLE = 'Source unavailable';
/** Alert description the layout spec fixes for an ordinary unavailable source. */
const SOURCE_UNAVAILABLE_DESCRIPTION =
  'The response cannot be shown. Reassess the assignment to try again.';
/** Alert description the layout spec fixes for a legacy reassessment result. */
const REASSESSMENT_DESCRIPTION =
  'Reassess this assignment to create results in the current format.';

/** Cause recorded for an assessment-stage failure with usable content. */
const ASSESSMENT_CAUSE: AssessmentError = { stage: 'assessment', code: 'ASSESSMENT_FAILED' };
/** Cause recorded for an extraction failure with no usable content. */
const EXTRACTION_CAUSE: AssessmentError = {
  stage: 'extraction',
  code: 'SOURCE_CONTENT_UNAVAILABLE',
};
/** Cause recorded for a legacy result requiring reassessment. */
const REASSESSMENT_CAUSE: AssessmentError = {
  stage: 'validation',
  code: 'REASSESSMENT_REQUIRED',
};

/** Reasoning recorded beside an assessment failure. */
const ASSESSMENT_REASONING = 'The extracted work could not be assessed.';
/** Reasoning recorded beside an extraction failure. */
const EXTRACTION_REASONING = 'No source content could be extracted for this task.';
/** Reasoning recorded beside a legacy reassessment result. */
const REASSESSMENT_REASONING = 'Reassessment required';

/** Derived editor source URL carried by the healthy fixture. */
const SOURCE_URL = 'https://docs.google.com/presentation/d/doc-error/edit#slide=id.4';

/**
 * Build a `TaskPreviewData` fixture from the canonical ready cell.
 *
 * @param {Partial<TaskPreviewData>} [overrides] - Fields to override on the default fixture.
 * @returns {TaskPreviewData} A fully-formed preview data object for rendering.
 */
function createPreviewData(overrides: Partial<TaskPreviewData> = {}): TaskPreviewData {
  const baseData = {
    taskId: CANONICAL_READY_CELL.taskId,
    artifactType: 'TEXT',
    artifactContent: CANONICAL_READY_CELL.artifactContent,
    metricKey: 'completeness',
    metric: createComputedMetricResult({ value: CANONICAL_READY_CELL.completenessScore }),
    reasoning: CANONICAL_READY_CELL.completenessReasoning,
    error: null,
    sourceState: 'available',
    sourceUrl: SOURCE_URL,
  } satisfies TaskPreviewData;

  return { ...baseData, ...overrides };
}

/**
 * Build the card data for a known `E` criterion.
 *
 * @param {Object} state - Error and source state for the probe.
 * @param {AssessmentError} state.error - Cause recorded for the selected criterion.
 * @param {string} state.reasoning - Teacher-readable reasoning recorded with it.
 * @param {TaskPreviewSourceState} state.sourceState - Derived source readiness.
 * @param {string|null} [state.sourceUrl] - Derived editor link, if any.
 * @param {string} [state.artifactContent] - Rendered response body.
 * @returns {TaskPreviewData} The error probe.
 */
function createErrorPreviewData(state: {
  error: AssessmentError;
  reasoning: string;
  sourceState: TaskPreviewSourceState;
  sourceUrl?: string | null;
  artifactContent?: string;
}): TaskPreviewData {
  return createPreviewData({
    metric: createErrorMetricResult(),
    error: state.error,
    reasoning: state.reasoning,
    sourceState: state.sourceState,
    sourceUrl: state.sourceUrl ?? null,
    artifactContent: state.artifactContent ?? '',
  });
}

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskPreviewCard known error presentation', () => {
  it('shows the known error reasoning rather than a whole-preview loading state', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: EXTRACTION_CAUSE,
          reasoning: EXTRACTION_REASONING,
          sourceState: 'unavailable',
        })}
      />
    );

    // The card is rendered, not a skeleton: the reasoning is available now.
    expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText(EXTRACTION_REASONING)).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('shows only a labelled source-region skeleton while the full fetch is pending behind a known error', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: EXTRACTION_CAUSE,
          reasoning: EXTRACTION_REASONING,
          sourceState: 'loading',
        })}
      />
    );

    // The known reasoning stays visible; only the source region is pending.
    expect(screen.getByText(EXTRACTION_REASONING)).toBeInTheDocument();
    expect(screen.getByText('Student Response')).toBeInTheDocument();

    const busyRegion = document.querySelector('output[aria-busy="true"]');
    expect(busyRegion).not.toBeNull();
    expect(busyRegion?.querySelector('.ant-skeleton')).toBeInTheDocument();
    // `<output>` already exposes `status`; restating it is the redundancy the
    // layout spec forbids, so the region is labelled busy output instead.
    expect(busyRegion).not.toHaveAttribute('role');
    expect(busyRegion?.getAttribute('aria-label')).toBeTruthy();

    // A pending source is not an error and not a renderer call.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(CANONICAL_READY_CELL.artifactContent)).not.toBeInTheDocument();
  });

  it('shows a non-dismissible source Alert instead of the response renderer when the source is unavailable', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: EXTRACTION_CAUSE,
          reasoning: EXTRACTION_REASONING,
          sourceState: 'unavailable',
          artifactContent: 'Locally supplied body that must not render',
        })}
      />
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(SOURCE_UNAVAILABLE_TITLE)).toBeInTheDocument();
    expect(within(alert).getByText(SOURCE_UNAVAILABLE_DESCRIPTION)).toBeInTheDocument();
    // Hiding an unresolved source error must never expose the normal renderer.
    expect(alert.querySelector('.ant-alert-close-icon')).toBeNull();
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();

    // The specific failure stays in Reasoning; the renderer is suppressed.
    expect(screen.getByText(EXTRACTION_REASONING)).toBeInTheDocument();
    expect(
      screen.queryByText('Locally supplied body that must not render')
    ).not.toBeInTheDocument();
  });

  it('renders the response normally for an assessment-only error whose content survived', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: ASSESSMENT_CAUSE,
          reasoning: ASSESSMENT_REASONING,
          sourceState: 'available',
          sourceUrl: SOURCE_URL,
          artifactContent: CANONICAL_READY_CELL.artifactContent,
        })}
      />
    );

    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
      'href',
      SOURCE_URL
    );
    // The E metric and its reasoning already explain the marking failure, so no
    // duplicate generic Alert sits above a valid response.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the safe source action for an unavailable source when a link is derivable', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: EXTRACTION_CAUSE,
          reasoning: EXTRACTION_REASONING,
          sourceState: 'unavailable',
          sourceUrl: SOURCE_URL,
        })}
      />
    );

    expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
      'href',
      SOURCE_URL
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('omits the source action when no safe link is derivable', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: EXTRACTION_CAUSE,
          reasoning: EXTRACTION_REASONING,
          sourceState: 'unavailable',
          sourceUrl: null,
        })}
      />
    );

    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(SOURCE_ACTION_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('TaskPreviewCard ready and legacy states', () => {
  it('renders a genuine no-submission as the ready N placeholder with no Alert', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createPreviewData({
          artifactType: 'TEXT',
          artifactContent: '',
          metric: NOT_ATTEMPTED_METRIC,
          reasoning: '',
          error: null,
          sourceState: 'available',
          sourceUrl: null,
        })}
      />
    );

    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('No submission available')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(document.querySelector('output[aria-busy="true"]')).toBeNull();
  });

  it('shows the reassessment copy in a local Alert for a legacy result', () => {
    renderWithFrontendProviders(
      <TaskPreviewCard
        data={createErrorPreviewData({
          error: REASSESSMENT_CAUSE,
          reasoning: REASSESSMENT_REASONING,
          sourceState: 'unavailable',
        })}
      />
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(REASSESSMENT_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(REASSESSMENT_REASONING)).toBeInTheDocument();
    // Historical content is not required to render for a legacy result.
    expect(screen.queryByText('No submission available')).not.toBeInTheDocument();
  });
});
