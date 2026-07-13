/**
 * Tests for `RecentAssignmentCard` — a single card in the Recent Assignments
 * section showing assignment name, "Last Assessed" date, and four MetricPill
 * instances.
 *
 * @remarks
 * The card is fully static: no hover, no click, no `hoverable` prop in v1.
 * The card width is a feature-local constant (`RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320`).
 * The `Average` metric cell uses `MetricPill` with `emphasised={true}`.
 *
 * @see SPEC_CLASS_PAGE.md - "RecentAssignmentCard"
 * @see CLASS_PAGE_LAYOUT.md - "3a. RecentAssignmentCard"
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecentAssignmentCardModel } from './classPageAdapter.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';
import { RecentAssignmentCard } from './RecentAssignmentCard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A RecentAssignmentCard renders exactly four MetricPill instances. */
const EXPECTED_METRIC_PILL_COUNT = 4;

/** Bold font weight applied when `emphasised` is true on MetricPill. */
const EMPHASISED_FONT_WEIGHT = 600;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid `RecentAssignmentCardModel` for tests.
 *
 * @param {Partial<RecentAssignmentCardModel>} [overrides] - Optional field overrides.
 * @returns {RecentAssignmentCardModel} A RecentAssignmentCardModel fixture.
 */
function makeCard(
  overrides: Partial<RecentAssignmentCardModel> = {}
): RecentAssignmentCardModel {
  return {
    assignmentId: 'a-1',
    assignmentName: 'Algebra Baseline',
    lastAssessedAt: '2026-06-15T10:30:00.000Z',
    lastAssessedAtLabel: '15 Jun 2026',
    metrics: {
      completeness: createComputedMetricResult({ value: 4.2 }),
      accuracy: createComputedMetricResult({ value: 3.8 }),
      spag: createComputedMetricResult({ value: 3.5 }),
      average: createComputedMetricResult({ value: 3.9 }),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecentAssignmentCard', () => {
  it('renders the assignment name as the card title', () => {
    const card = makeCard();
    render(<RecentAssignmentCard card={card} />);

    expect(screen.getByText('Algebra Baseline')).toBeInTheDocument();
  });

  it('renders the Last Assessed date line', () => {
    const card = makeCard();
    render(<RecentAssignmentCard card={card} />);

    expect(screen.getByText(/last assessed:/i)).toBeInTheDocument();
  });

  it('renders four MetricPill instances', () => {
    const card = makeCard();
    const { container } = render(<RecentAssignmentCard card={card} />);

    // MetricPill renders as an Ant Design Tag, which has the `.ant-tag` class.
    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(EXPECTED_METRIC_PILL_COUNT);
  });

  it('renders metric labels for Completeness, Accuracy, SpAG, and Average', () => {
    const card = makeCard();
    render(<RecentAssignmentCard card={card} />);

    // Labels are now rendered as Lucide icons with aria-label via the title prop
    expect(screen.getByLabelText('Completeness')).toBeInTheDocument();
    expect(screen.getByLabelText('Accuracy')).toBeInTheDocument();
    expect(screen.getByLabelText('SpAG')).toBeInTheDocument();
    expect(screen.getByLabelText('Average')).toBeInTheDocument();
  });

  it('uses emphasised={true} on the Average pill', () => {
    const card = makeCard();
    const { container } = render(<RecentAssignmentCard card={card} />);

    // The fourth MetricPill (Average) is rendered with `emphasised={true}`,
    // which applies `fontWeight: 600` as an inline style.
    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(EXPECTED_METRIC_PILL_COUNT);

    const averageTag = tags[3];
    expect(averageTag).toHaveStyle({ fontWeight: EMPHASISED_FONT_WEIGHT });
  });

  it('renders Card with style width 320px', () => {
    const card = makeCard();
    const { container } = render(<RecentAssignmentCard card={card} />);

    // The Card component receives `style={{ width: RECENT_ASSIGNMENT_CARD_WIDTH_PX }}`
    // where RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320. The antd Card renders as an
    // element with the `.ant-card` class.
    const cardElement = container.querySelector('.ant-card');
    expect(cardElement).not.toBeNull();

    expect(cardElement).toHaveStyle({ width: '320px' });
  });

  it('renders notAttempted metrics showing N in the pill', () => {
    const card = makeCard({
      metrics: {
        completeness: createNotAttemptedMetricResult(),
        accuracy: createNotAttemptedMetricResult(),
        spag: createNotAttemptedMetricResult(),
        average: createNotAttemptedMetricResult(),
      },
    });
    const { container } = render(<RecentAssignmentCard card={card} />);

    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(EXPECTED_METRIC_PILL_COUNT);
    tags.forEach((tag) => {
      expect(tag).toHaveTextContent('N');
    });
  });

  it('renders error metrics showing E in the pill', () => {
    const card = makeCard({
      metrics: {
        completeness: createErrorMetricResult(),
        accuracy: createErrorMetricResult(),
        spag: createErrorMetricResult(),
        average: createErrorMetricResult(),
      },
    });
    const { container } = render(<RecentAssignmentCard card={card} />);

    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(EXPECTED_METRIC_PILL_COUNT);
    tags.forEach((tag) => {
      expect(tag).toHaveTextContent('E');
    });
  });

  it('invokes onOpenHeatmap with the card assignmentId when clicked', async () => {
    const user = userEvent.setup();
    const onOpenHeatmap = vi.fn();
    const card = makeCard({ assignmentId: 'a-1' });

    const { container } = render(
      <RecentAssignmentCard card={card} onOpenHeatmap={onOpenHeatmap} />
    );

    const cardElement = container.querySelector('.ant-card');
    expect(cardElement).not.toBeNull();
    await user.click(cardElement!);

    expect(onOpenHeatmap).toHaveBeenCalledTimes(1);
    expect(onOpenHeatmap).toHaveBeenCalledWith('a-1');
  });
});
