/**
 * Contract tests for the task-preview card's source-document action.
 *
 * The card already owns the metric live status, the reasoning section and the
 * student response; this suite pins what the action adds on top of that
 * surface without changing any of it: a native anchor in the card header,
 * carrying the specified accessible name and tooltip text, linking the derived
 * editor URL in a new tab, rendered outside the metric's live region, with a
 * decorative icon, present for every ready metric state that has a source and
 * absent — with no disabled placeholder — when it does not.
 *
 * Geometry, whole-card metric centring and rendered icon sizing are measured in
 * the Playwright visual suite, not here: happy-dom performs no layout.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { createComputedMetricResult, createErrorMetricResult } from '@/test/dataAnalysis/fixtures';
import { NOT_ATTEMPTED_METRIC } from '@/services/dataAnalysis/heatmapAdapter';
import { METRIC_DISPLAY_META } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { TaskDisplayMetric } from '@/services/dataAnalysis/dataAnalysis.zod';
import { CANONICAL_READY_CELL } from '@/test/taskHeatmap/previewFixtures';
import { CANONICAL_SOURCE_URL } from '@/test/taskHeatmap/previewSourceActionTestHelpers';
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

/** Display label the canonical metric key resolves to, including its colon. */
const METRIC_LABEL_WITH_COLON = `${METRIC_DISPLAY_META.get('completeness')!.label}:`;

/** Score the canonical ready cell's completeness metric carries. */
const CANONICAL_SCORE = CANONICAL_READY_CELL.completenessScore;

/** Budget for the Ant Design tooltip to mount: it opens on a short internal delay. */
const TOOLTIP_WAIT_MS = 3000;

/**
 * Non-computed metric states that must still offer the action when the record
 * carries a source: visibility depends on source availability, not metric state.
 */
const NON_COMPUTED_PREVIEW_METRICS: ReadonlyArray<{
  readonly state: TaskDisplayMetric['state'];
  readonly metric: TaskDisplayMetric;
}> = [
  { state: 'notAttempted', metric: NOT_ATTEMPTED_METRIC },
  { state: 'error', metric: createErrorMetricResult() },
];

// ---------------------------------------------------------------------------
// Helper factory for test data
// ---------------------------------------------------------------------------

/**
 * Build a `TaskPreviewData` fixture from the canonical ready cell, so the suite
 * asserts against real record data rather than restated literals.
 *
 * @param {Partial<TaskPreviewData>} [overrides] - Fields to override.
 * @returns {TaskPreviewData} A fully-formed preview data object for rendering.
 */
function createPreviewData(overrides: Partial<TaskPreviewData> = {}): TaskPreviewData {
  const baseData = {
    taskId: CANONICAL_READY_CELL.taskId,
    artifactType: 'TEXT',
    artifactContent: CANONICAL_READY_CELL.artifactContent,
    metricKey: 'completeness',
    metric: createComputedMetricResult({ value: CANONICAL_SCORE }),
    reasoning: CANONICAL_READY_CELL.completenessReasoning,
    error: null,
    sourceState: 'available',
    sourceUrl: CANONICAL_SOURCE_URL,
  } satisfies TaskPreviewData;

  return { ...baseData, ...overrides };
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskPreviewCard source action', () => {
  it('renders the source action as a native anchor named for the source document', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });

    // A native anchor, so the browser owns both activation and new-tab
    // navigation instead of the component orchestrating a click.
    expect(action.tagName).toBe('A');
    // Deliberate verbatim pin of the spec-fixed contract name; every other
    // consumer imports `SOURCE_ACTION_LABEL`.
    expect(action).toHaveAccessibleName('Open source document (opens in a new tab)');
    // Keyboard focus must remain reachable and visible on the action.
    expect(action).toHaveAttribute('tabindex', '0');
  });

  it('states the action name on the action itself rather than only in its tooltip', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    // The tooltip is a visible affordance, never the sole accessible-name
    // mechanism, so the name must survive with no tooltip mounted.
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });

    expect(action).toHaveAttribute('aria-label', SOURCE_ACTION_LABEL);
  });

  it('links the derived editor URL in a new tab without leaking the opener', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    const relationship = action.getAttribute('rel') ?? '';

    expect(action).toHaveAttribute('href', CANONICAL_SOURCE_URL);
    expect(action).toHaveAttribute('target', '_blank');
    expect(relationship).toContain('noopener');
    expect(relationship).toContain('noreferrer');
  });
  it('renders the action icon decoratively rather than as a labelled image', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    const icon = action.querySelector('svg');

    expect(icon).toBeInTheDocument();
    // The icon carries no title of its own, so it must be hidden from assistive
    // technology rather than announced alongside the action's name.
    expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(within(action).queryByRole('img')).not.toBeInTheDocument();
  });

  it('leaves the metric status, reasoning and student response unchanged when the action renders', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const status = screen.getByRole('status');

    expect(within(status).getByText(METRIC_LABEL_WITH_COLON)).toBeInTheDocument();
    expect(within(status).getByText(String(CANONICAL_SCORE))).toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText(CANONICAL_READY_CELL.completenessReasoning)).toBeInTheDocument();
    expect(screen.getByText('Student Response')).toBeInTheDocument();
    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
  });

  it('keeps the action outside the metric live status region and inside the card header', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const status = screen.getByRole('status');
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });

    // A static link announced inside the metric's score status would be wrong.
    expect(status.contains(action)).toBe(false);
    expect(within(status).queryByRole('link', { name: SOURCE_ACTION_LABEL })).toBeNull();
    expect(action.closest('.ant-card-head')).not.toBeNull();
    expect(document.querySelector('.ant-card-body')?.contains(action)).toBe(false);
  });

  it.each(NON_COMPUTED_PREVIEW_METRICS)(
    'still offers the source action for a $state metric when a source exists',
    ({ metric }) => {
      renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData({ metric })} />);

      // Visibility depends on source availability, not on the metric state, so
      // an unattempted or errored cell with a stored source still gets the action.
      expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
        'href',
        CANONICAL_SOURCE_URL
      );
    }
  );

  it('renders no action and no disabled placeholder when the record offers no source', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData({ sourceUrl: null })} />);

    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    // No inert placeholder may carry the action's name either.
    expect(screen.queryByLabelText(SOURCE_ACTION_LABEL)).not.toBeInTheDocument();
    // The existing empty-content treatment and the rest of the card stand.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Student Response')).toBeInTheDocument();
    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
  });

  it('shows the action name as a tooltip on pointer hover', async () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    await user.hover(action);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: TOOLTIP_WAIT_MS });
    expect(tooltip).toHaveTextContent(SOURCE_ACTION_LABEL);
  });

  it('shows the action name as a tooltip when the action takes keyboard focus', async () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    // Focus is set directly, with no pointer interaction, so the tooltip can
    // only be the focus trigger answering a keyboard user. Wrapped in `act`
    // because that focus opens the action's own hover/focus tooltip, whose
    // Trigger, Portal and CSSMotion updates happen outside any interaction.
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    act(() => {
      action.focus();
    });
    expect(action).toHaveFocus();

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: TOOLTIP_WAIT_MS });
    expect(tooltip).toHaveTextContent(SOURCE_ACTION_LABEL);
  });
});

// ---------------------------------------------------------------------------
// Known-error source states
// ---------------------------------------------------------------------------

/** Cause recorded for an extraction failure with no usable source. */
const EXTRACTION_CAUSE: AssessmentError = {
  stage: 'extraction',
  code: 'SOURCE_CONTENT_UNAVAILABLE',
};

/**
 * Build a known-`E` preview fixture.
 *
 * @param {TaskPreviewSourceState} sourceState - Derived source readiness.
 * @param {string|null} [sourceUrl] - Derived editor link, if any.
 * @returns {TaskPreviewData} The error probe.
 */
function createErrorPreviewData(
  sourceState: TaskPreviewSourceState,
  sourceUrl: string | null = null
): TaskPreviewData {
  return createPreviewData({
    metric: createErrorMetricResult(),
    error: EXTRACTION_CAUSE,
    reasoning: 'No source content could be extracted for this task.',
    sourceState,
    sourceUrl,
    artifactContent: '',
  });
}

describe('TaskPreviewCard known-error source action', () => {
  it.each(['unavailable', 'loading'] as const)(
    'keeps the action for a known error while the source is %s',
    (sourceState) => {
      renderWithFrontendProviders(
        <TaskPreviewCard data={createErrorPreviewData(sourceState, CANONICAL_SOURCE_URL)} />
      );

      // The link survives the failed extraction: it is derived from validated
      // source identifiers, not from usable content.
      expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
        'href',
        CANONICAL_SOURCE_URL
      );
    }
  );

  it('omits the action and its balancing space when no safe link is derivable', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createErrorPreviewData('unavailable')} />);
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-preview-header-balance')).not.toBeInTheDocument();
  });

  it('never steals focus when source content arrives after the card is open', async () => {
    // A null URL stands in for the moment before content arrives, while
    // something else on the page owns focus.
    const { rerender } = renderWithFrontendProviders(
      <TaskPreviewCard data={createPreviewData({ sourceUrl: null })} />
    );
    const outsideControl = document.createElement('button');
    document.body.append(outsideControl);
    act(() => {
      outsideControl.focus();
    });
    await act(async () => {
      rerender(<TaskPreviewCard data={createPreviewData()} />);
    });

    expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toBeInTheDocument();
    expect(outsideControl).toHaveFocus();
  });
});
