/**
 * A single card in the Recent Assignments section.
 *
 * Renders the assignment name, a "Last Assessed" date line, and four
 * `MetricPill` instances (Completeness, Accuracy, SpAG, Average). The
 * Average cell uses `emphasised={true}` for visual prominence.
 *
 * @remarks
 * **Card width rationale.** The card width (`RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320`)
 * is a feature-local constant because the Class page's `RecentAssignmentCard` is
 * the sole v1 consumer. Per `docs/developer/frontend/frontend-loading-and-width-standards.md`
 * §7, promotion to a shared width token is deferred until a second consumer
 * emerges. The 320px width is wider than the existing ClassesPage class cards
 * (268px) because the card must fit four MetricPill cells side-by-side without
 * wrapping the Average cell's emphasised content.
 *
 * **Conditional interactivity.** When `onOpenHeatmap` is supplied the card
 * becomes an activatable button (role, keyboard, mouse); when absent it
 * remains a static display card with no click or keyboard handler.
 *
 * **Fail loud for null `updatedAt`.** The "Last Assessed" line never renders
 * a `—` fallback. A null `updatedAt` is a data bug that the adapter surfaces
 * as a blocking state before the model is built.
 *
 * @see SPEC_CLASS_PAGE.md — "RecentAssignmentCard"
 * @see CLASS_PAGE_LAYOUT.md — "3a. RecentAssignmentCard"
 */

import type { JSX, KeyboardEvent } from 'react';
import { Card, Flex, Typography } from 'antd';
import type { RecentAssignmentCardModel } from './classPageAdapter.zod';
import { getStudentMetric } from './classPageAdapter.zod';
import { MetricPill } from '../../services/dataAnalysis/metricDisplay/MetricPill';

/** Width constant for a single Recent Assignment card.
 *
 * @remarks
 * Feature-local constant. The Class page's RecentAssignmentCard is the sole
 * v1 consumer; promotion to a shared width token is deferred until a second
 * consumer emerges. The 320px width is wider than the existing ClassesPage
 * class cards (268px) because the card must fit four MetricPill cells
 * (Completeness, Accuracy, SpAG, Average) side-by-side without wrapping.
 */
const RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320;

/**
 * Descriptor array for the four metric pills rendered in the card.
 *
 * Each entry defines the metric key, display label, alignment, and emphasis
 * flag. The Average cell uses `align="center"` and `emphasised={true}` for
 * visual prominence; the other three cells use `align="start"` and no emphasis.
 */
const METRIC_ENTRIES = [
  { key: 'completeness' as const, label: 'Completeness', align: 'start' as const, emphasised: false },
  { key: 'accuracy' as const, label: 'Accuracy', align: 'start' as const, emphasised: false },
  { key: 'spag' as const, label: 'SpAG', align: 'start' as const, emphasised: false },
  { key: 'average' as const, label: 'Average', align: 'center' as const, emphasised: true },
] as const;

type RecentAssignmentCardProperties = Readonly<{
  /** The fully-built recent assignment card model. */
  card: RecentAssignmentCardModel;
  /** Optional callback invoked when the card is clicked to open the heatmap view. */
  onOpenHeatmap?: (assignmentId: string) => void;
}>;

/**
 * Render a single Recent Assignment card.
 *
 * Displays the assignment name as the card title, a "Last Assessed" date
 * line, and four `MetricPill` instances (Completeness, Accuracy, SpAG,
 * Average). The Average cell uses `emphasised` for visual prominence.
 *
 * When `onOpenHeatmap` is provided the card root becomes interactive (button
 * role, pointer cursor, accessible keyboard activation); when absent the card
 * remains fully static.
 *
 * @param {Readonly<RecentAssignmentCardProperties>} root0 - Component properties.
 * @param {RecentAssignmentCardModel} root0.card - The fully-built recent assignment card model.
 * @param {(assignmentId: string) => void} [root0.onOpenHeatmap] - Optional callback invoked when the card is clicked.
 * @returns {JSX.Element} The assignment card.
 */
export function RecentAssignmentCard({
  card,
  onOpenHeatmap,
}: RecentAssignmentCardProperties): JSX.Element {
  const clickable = onOpenHeatmap !== undefined;
  const handleActivate = () => { onOpenHeatmap!(card.assignmentId); };
  return (
    <Card
      size="small"
      title={card.assignmentName}
      style={{ width: RECENT_ASSIGNMENT_CARD_WIDTH_PX, cursor: clickable ? 'pointer' : undefined }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={
        clickable
          ? (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
    >
      <Typography.Text type="secondary">
        Last Assessed: {card.lastAssessedAtLabel}
      </Typography.Text>
      <Flex justify="space-around" style={{ marginTop: 12 }}>
        {METRIC_ENTRIES.map(({ key, label, align, emphasised }) => (
          <Flex key={key} vertical align={align}>
            <Typography.Text>{label}</Typography.Text>
            <MetricPill metric={getStudentMetric(card.metrics, key)} emphasised={emphasised} />
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}
