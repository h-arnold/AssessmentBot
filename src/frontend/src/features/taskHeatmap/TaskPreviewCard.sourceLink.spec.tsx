/**
 * Acceptance tests for the task-preview card's source-document action.
 *
 * The card already owns the metric live status, the reasoning section and the
 * student response; this suite pins what the action adds on top of that
 * surface without changing any of it: a native anchor in the card header,
 * carrying the specified accessible name and tooltip text, linking the derived
 * editor URL in a new tab, rendered outside the metric's live region, with a
 * decorative icon, present for every ready metric state that has a source and
 * absent — with no disabled placeholder — when it does not.
 *
 * @remarks
 * **Red-first provenance.** These are the issue #19 acceptance criteria for
 * the card, authored before the action existed — the present-and-tooltip
 * cases failing on its absence — and they now pin the delivered contract.
 * The absent-action case passes both before and after; it pins the boundary
 * against over-reach during and after implementation.
 *
 * Geometry, whole-card metric centring and rendered icon sizing are measured in
 * the Playwright visual suite, not here: happy-dom performs no layout.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  createComputedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';
import { NOT_ATTEMPTED_METRIC } from '../../services/dataAnalysis/heatmapAdapter';
import { METRIC_DISPLAY_META } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import { CANONICAL_READY_CELL } from '../../test/taskHeatmap/previewFixtures';
import {
  CANONICAL_SOURCE_URL,
  SOURCE_ACTION_LABEL,
} from '../../test/taskHeatmap/previewSourceActionTestHelpers';
import { TaskPreviewCard, type TaskPreviewData } from './TaskPreviewCard';

// ---------------------------------------------------------------------------
// Fixture constants
// ---------------------------------------------------------------------------

/** Display label the canonical metric key resolves to, including its colon. */
const METRIC_LABEL_WITH_COLON = `${METRIC_DISPLAY_META.get('completeness')!.label}:`;

/** Score the canonical ready cell's completeness metric carries. */
const CANONICAL_SCORE = CANONICAL_READY_CELL.completenessScore;

/**
 * Budget for the Ant Design tooltip to mount.
 *
 * The tooltip opens on a short internal delay, so it cannot be observed in the
 * same tick as the interaction that triggered it.
 */
const TOOLTIP_WAIT_MS = 3000;

/**
 * Non-computed metric states that must still offer the action when the record
 * carries a source, because action visibility depends on source availability
 * rather than on the metric's computed state.
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
 * Build a `TaskPreviewData` fixture from the canonical ready cell.
 *
 * The canonical TEXT artefact, reasoning and derived source URL all come from
 * the selected `small` record, so the card suite asserts against real data
 * rather than restated literals.
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
    metric: createComputedMetricResult({ value: CANONICAL_SCORE }),
    reasoning: CANONICAL_READY_CELL.completenessReasoning,
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
    expect(action).toHaveAccessibleName(SOURCE_ACTION_LABEL);
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

  it('keeps the action outside the metric live status region and inside the card header', () => {
    renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData()} />);

    const status = screen.getByRole('status');
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });

    // The action is a static link, so announcing it as part of the metric's
    // score status would be wrong; it must be a sibling of that region.
    expect(status.contains(action)).toBe(false);
    expect(
      within(status).queryByRole('link', { name: SOURCE_ACTION_LABEL })
    ).not.toBeInTheDocument();
    expect(action.closest('.ant-card-head')).not.toBeNull();
    expect(document.querySelector('.ant-card-body')?.contains(action)).toBe(false);
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

  it.each(NON_COMPUTED_PREVIEW_METRICS)(
    'still offers the source action for a $state metric when a source exists',
    ({ metric }) => {
      renderWithFrontendProviders(<TaskPreviewCard data={createPreviewData({ metric })} />);

      // Visibility depends on source availability, not on the metric state, so
      // an unattempted cell with a stored source still gets the action.
      expect(screen.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveAttribute(
        'href',
        CANONICAL_SOURCE_URL
      );
    }
  );

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
    // because this programmatic focus is what opens the action's own
    // hover/focus tooltip, and ant Design mounts the overlay's Trigger, Portal
    // and CSSMotion updates outside any user interaction.
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    act(() => {
      action.focus();
    });
    expect(action).toHaveFocus();

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: TOOLTIP_WAIT_MS });
    expect(tooltip).toHaveTextContent(SOURCE_ACTION_LABEL);
  });

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
});
