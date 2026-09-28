/**
 * Presentational component for the Task Preview Card popover content.
 *
 * Renders an Ant Design `Card` with metric header, LLM reasoning, and student
 * response sections inside a popover triggered from the heatmap table.
 *
 * @remarks
 * **Metric pass-through (local concern).** The component renders the analyser's
 * real `TaskDisplayMetric`, received on `data.metric`, and forwards it unchanged
 * to `MetricPill` and `formatMetricDisplayText`. Only `state` and `value` are
 * read, so the metric's weight and data-point fields are carried but inert for
 * display; `metric.state` is what selects the empty-content placeholder.
 */

import type { JSX } from 'react';
import { Card, Typography, Divider, Flex } from 'antd';
import { MetricPill } from '../../services/dataAnalysis/metricDisplay/MetricPill';
import { METRIC_DISPLAY_META } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { formatMetricDisplayText } from '../../services/dataAnalysis/metricDisplay/metricDisplayText';
import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import { ImageRenderer } from '../../components/ImageRenderer/ImageRenderer';
import { MarkdownRenderer } from '../../components/MarkdownRenderer/MarkdownRenderer';
import { APP_GAP_SM } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Discriminated props contract for the TaskPreviewCard component. */
export interface TaskPreviewData {
  readonly taskId: string;
  readonly artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  readonly artifactContent: string;
  readonly metricKey: 'completeness' | 'accuracy' | 'spag';
  readonly reasoning: string;
  /** The analyser's task-display metric for this cell, rendered as-is. */
  readonly metric: TaskDisplayMetric;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum height of the card body before scrolling.
 *
 * Exempt from the 8px grid as it is a max-height constraint, not a spacing
 * value.
 */
const CARD_BODY_MAX_HEIGHT = 480;

/**
 * Maximum width of the preview card.
 *
 * Exempt from the 8px grid as it is a max-width constraint, not a spacing
 * value. Exported so the heatmap table's loading skeleton can mirror the same
 * width token (the popover skeleton is sized to match the rendered card).
 */
export const CARD_MAX_WIDTH = 400;

/** Number of decimal places used for the task-preview metric score. */
const TASK_SCORE_PRECISION = 0;

// ---------------------------------------------------------------------------
// Artifact renderer
// ---------------------------------------------------------------------------

/**
 * Render the student response artifact based on its type and metric state.
 *
 * Displays a placeholder message when content is empty and the metric
 * is in a non-computed state; otherwise delegates to the appropriate
 * renderer component.
 *
 * @param {TaskPreviewData['artifactType']} artifactType - The type of artifact to render.
 * @param {string} artifactContent - The raw artifact string content.
 * @param {TaskDisplayMetric['state']} metricState - The state carried by the cell's metric,
 *        used for determining placeholder text.
 * @returns {JSX.Element} A React element for the artifact content.
 */
function renderArtifact(
  artifactType: TaskPreviewData['artifactType'],
  artifactContent: string,
  metricState: TaskDisplayMetric['state']
): JSX.Element {
  if (artifactContent === '') {
    if (metricState === 'notAttempted') {
      return <Typography.Text>No submission available</Typography.Text>;
    }
    if (metricState === 'error') {
      return <Typography.Text>Error loading response</Typography.Text>;
    }
    return <Typography.Text>No content available</Typography.Text>;
  }

  switch (artifactType) {
    case 'IMAGE': {
      return <ImageRenderer src={artifactContent} />;
    }
    case 'TABLE':
    case 'TEXT': {
      return <MarkdownRenderer>{artifactContent}</MarkdownRenderer>;
    }
  }
}

// ---------------------------------------------------------------------------
// TaskPreviewCard component
// ---------------------------------------------------------------------------

/**
 * Task Preview Card — popover content for the heatmap metric sub-cells.
 *
 * Renders a compact card (maxWidth 400) with:
 * - **Header**: centred metric label with colon + `MetricPill` score
 * - **Reasoning**: bold "Reasoning" label and the LLM reasoning text (or
 *   "No reasoning available" placeholder)
 * - **Student Response**: bold "Student Response" label and the artifact
 *   rendered by the appropriate renderer (ImageRenderer or MarkdownRenderer)
 *
 * @param {Object} props - Component properties.
 * @param {TaskPreviewData} props.data - Preview data to display.
 * @returns {JSX.Element} The rendered card.
 */
export function TaskPreviewCard({ data }: { readonly data: TaskPreviewData }): JSX.Element {
  const { artifactType, artifactContent, metric, metricKey, reasoning } = data;

  const meta = METRIC_DISPLAY_META.get(metricKey)!;
  const label = meta.label;

  const formattedScore = formatMetricDisplayText(metric, TASK_SCORE_PRECISION);

  return (
    <Card
      size="small"
      style={{ maxWidth: CARD_MAX_WIDTH }}
      title={
        <Flex
          gap={APP_GAP_SM}
          align="center"
          justify="center"
          role="status"
          aria-live="polite"
          aria-label={`${label} score: ${formattedScore}`}
        >
          <Typography.Text>{label}:</Typography.Text>
          <MetricPill metric={metric} precision={TASK_SCORE_PRECISION} compact />
        </Flex>
      }
    >
      <Flex vertical gap={APP_GAP_SM} style={{ maxHeight: CARD_BODY_MAX_HEIGHT, overflow: 'auto' }}>
        {/* Reasoning section */}
        <Flex vertical gap={APP_GAP_SM}>
          <Typography.Text strong>Reasoning</Typography.Text>
          <Typography.Text>{reasoning || 'No reasoning available'}</Typography.Text>
        </Flex>

        <Divider />

        {/* Student Response section */}
        <Flex vertical gap={APP_GAP_SM}>
          <Typography.Text strong>Student Response</Typography.Text>
          {renderArtifact(artifactType, artifactContent, metric.state)}
        </Flex>
      </Flex>
    </Card>
  );
}
