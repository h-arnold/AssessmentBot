/**
 * Tests for `RecentAssignmentsSection` — the section `Card` wrapping the
 * recent assignment card row (or the empty state).
 *
 * @remarks
 * The section is pure presentational: it owns no state and receives
 * `recentAssignments` (an array of `RecentAssignmentCardModel`) and
 * `onStartNewAssessment` as props. The card row renders up to three
 * `RecentAssignmentCard` components, centre-aligned via `Flex`. When
 * the array is empty, an `Empty` component with a CTA button is shown
 * inside the card body. The `Card` `title` ("Recent Assignments") is
 * always rendered.
 *
 * @see SPEC_CLASS_PAGE.md - "RecentAssignmentsSection"
 * @see CLASS_PAGE_LAYOUT.md - "3. Recent Assignments Section"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecentAssignmentCardModel } from './classPageAdapter.zod';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';
import { pageContent } from '../../pages/pageContent';
import { RecentAssignmentsSection } from './RecentAssignmentsSection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** One card × four MetricPill instances. */
const TAGS_FOR_ONE_CARD = 4;

/** Two cards × four MetricPill instances each. */
const TAGS_FOR_TWO_CARDS = 8;

/** Three cards × four MetricPill instances each. */
const TAGS_FOR_THREE_CARDS = 12;

/** Two cards rendered with onOpenHeatmap forwarding. */
const EXPECTED_HEATMAP_CALLS = 2;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid `RecentAssignmentCardModel` fixture.
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

describe('RecentAssignmentsSection', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the section Card with title Recent Assignments', () => {
    render(
      <RecentAssignmentsSection
        recentAssignments={[]}
        onStartNewAssessment={vi.fn()}
      />
    );

    expect(screen.getByText('Recent Assignments')).toBeInTheDocument();
  });

  it('renders up to 3 RecentAssignmentCard components inside the card body', () => {
    const threeCards: RecentAssignmentCardModel[] = [
      makeCard({ assignmentId: 'a-1', assignmentName: 'Algebra Baseline' }),
      makeCard({ assignmentId: 'a-2', assignmentName: 'Geometry Quiz' }),
      makeCard({ assignmentId: 'a-3', assignmentName: 'Statistics Test' }),
    ];

    const { container } = render(
      <RecentAssignmentsSection
        recentAssignments={threeCards}
        onStartNewAssessment={vi.fn()}
      />
    );

    // Each card renders 4 MetricPill instances (one .ant-tag per pill),
    // so 3 cards = 12 tags.
    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(TAGS_FOR_THREE_CARDS);
  });

  it('renders 1 card correctly with 4 MetricPill elements', () => {
    const oneCard: RecentAssignmentCardModel[] = [
      makeCard({ assignmentId: 'a-1', assignmentName: 'Algebra Baseline' }),
    ];

    const { container } = render(
      <RecentAssignmentsSection
        recentAssignments={oneCard}
        onStartNewAssessment={vi.fn()}
      />
    );

    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(TAGS_FOR_ONE_CARD);
  });

  it('renders 2 cards correctly with 8 MetricPill elements', () => {
    const twoCards: RecentAssignmentCardModel[] = [
      makeCard({ assignmentId: 'a-1', assignmentName: 'Algebra Baseline' }),
      makeCard({ assignmentId: 'a-2', assignmentName: 'Geometry Quiz' }),
    ];

    const { container } = render(
      <RecentAssignmentsSection
        recentAssignments={twoCards}
        onStartNewAssessment={vi.fn()}
      />
    );

    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(TAGS_FOR_TWO_CARDS);
  });

  it('renders the empty state with Empty and CTA button when recentAssignments is empty', () => {
    render(
      <RecentAssignmentsSection
        recentAssignments={[]}
        onStartNewAssessment={vi.fn()}
      />
    );

    // The empty state uses pageContent.classDetail.recentAssignmentsEmpty
    // as the Empty description.
    expect(
      screen.getByText(pageContent.classDetail.recentAssignmentsEmpty)
    ).toBeInTheDocument();

    // A primary "Start New Assessment" button is rendered as the Empty
    // children slot.
    const ctaButton = screen.getByRole('button', {
      name: /start new assessment/i,
    });
    expect(ctaButton).toBeInTheDocument();

    // The CTA button contains a PlusOutlined icon.
    expect(ctaButton.querySelector('.anticon-plus')).toBeInTheDocument();
  });

  it('calls onStartNewAssessment when the empty-state CTA button is clicked', async () => {
    const onStartNewAssessment = vi.fn();

    render(
      <RecentAssignmentsSection
        recentAssignments={[]}
        onStartNewAssessment={onStartNewAssessment}
      />
    );

    const ctaButton = screen.getByRole('button', {
      name: /start new assessment/i,
    });
    await user.click(ctaButton);

    expect(onStartNewAssessment).toHaveBeenCalledTimes(1);
  });

  it('forwards onOpenHeatmap to each RecentAssignmentCard', async () => {
    const onOpenHeatmap = vi.fn();
    const cards: RecentAssignmentCardModel[] = [
      makeCard({ assignmentId: 'a-1', assignmentName: 'Algebra Baseline' }),
      makeCard({ assignmentId: 'a-2', assignmentName: 'Geometry Quiz' }),
    ];

    render(
      <RecentAssignmentsSection
        recentAssignments={cards}
        onStartNewAssessment={vi.fn()}
        onOpenHeatmap={onOpenHeatmap}
      />
    );

    await user.click(screen.getByText('Algebra Baseline'));
    await user.click(screen.getByText('Geometry Quiz'));

    expect(onOpenHeatmap).toHaveBeenCalledTimes(EXPECTED_HEATMAP_CALLS);
    expect(onOpenHeatmap).toHaveBeenCalledWith('a-1');
    expect(onOpenHeatmap).toHaveBeenCalledWith('a-2');
  });
});
