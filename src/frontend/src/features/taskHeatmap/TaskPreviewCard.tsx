/**
 * Presentational component for the Task Preview Card popover content.
 *
 * Renders an Ant Design `Card` with metric header, LLM reasoning, and student
 * response sections inside a popover triggered from the heatmap table.
 *
 * @remarks
 * **MetricResult reassembly (local concern).** The component reassembles a
 * schema-valid `MetricResult` from the flat `metricState` + `metricScore`
 * props to reuse the existing `MetricPill` component. The reassembly values
 * are:
 * - `computed` → `{ state: 'computed', value: Number(metricScore),
 *   totalWeight: 0, applicableDataPoints: 1, totalDataPoints: 1 }`
 * - `notAttempted` → `{ state: 'notAttempted', value: 'N', totalWeight: 0,
 *   applicableDataPoints: 0, totalDataPoints: 1 }`
 * - `error` → `{ state: 'error', value: 'E', totalWeight: 0,
 *   applicableDataPoints: 0, totalDataPoints: 0 }`
 *
 * These weight/data-point fields are inert for display (`MetricPill` ignores
 * them) but must satisfy the `MetricResult` discriminated-union constraints
 * per SPEC §"MetricPill reuse".
 */

import type { JSX } from 'react';
import { Card, Typography, Divider, Flex } from 'antd';
import { MetricPill } from '../../services/dataAnalysis/metricDisplay/MetricPill';
import { METRIC_DISPLAY_META } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { ImageRenderer } from '../../components/ImageRenderer/ImageRenderer';
import { MarkdownRenderer } from '../../components/MarkdownRenderer/MarkdownRenderer';
import { APP_GAP_SM } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Flat props contract for the TaskPreviewCard component. */
export interface TaskPreviewData {
  readonly taskId: string;
  readonly artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  readonly artifactContent: string;
  readonly metricKey: 'completeness' | 'accuracy' | 'spag';
  readonly metricScore: number | 'N' | 'E';
  readonly metricState: 'computed' | 'notAttempted' | 'error';
  readonly reasoning: string;
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

// ---------------------------------------------------------------------------
// MetricResult reassembly (local concern)
// ---------------------------------------------------------------------------

/**
 * Build a schema-valid `MetricResult` from flat metricState + metricScore.
 *
 * @param {TaskPreviewData['metricState']} state - The metric state discriminator.
 * @param {TaskPreviewData['metricScore']} score - The raw score value (number for computed, 'N' or 'E').
 * @returns {MetricResult} A schema-valid MetricResult matching the discriminated union in
 * `dataAnalysis.zod.ts`.
 */
function buildMetricResult(
  state: TaskPreviewData['metricState'],
  score: TaskPreviewData['metricScore']
): MetricResult {
  switch (state) {
    case 'computed': {
      return {
        state: 'computed' as const,
        value: Number(score),
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      };
    }
    case 'notAttempted': {
      return {
        state: 'notAttempted' as const,
        value: 'N' as const,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      };
    }
    case 'error': {
      return {
        state: 'error' as const,
        value: 'E' as const,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      };
    }
  }
}

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
 * @param {TaskPreviewData['metricState']} metricState - The metric state for determining placeholder text.
 * @returns {JSX.Element} A React element for the artifact content.
 */
function renderArtifact(
  artifactType: TaskPreviewData['artifactType'],
  artifactContent: string,
  metricState: TaskPreviewData['metricState']
): JSX.Element {
  if (artifactContent === '') {
    if (metricState === 'notAttempted') {
      return <Typography.Text>No submission available</Typography.Text>;
    }
    if (metricState === 'error') {
      return <Typography.Text>Error loading response</Typography.Text>;
    }
    // Catch-all for computed state with empty content
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
  const { artifactType, artifactContent, metricKey, metricScore, metricState, reasoning } = data;

  const meta = METRIC_DISPLAY_META.get(metricKey)!;
  const label = meta.label;

  const metricResult = buildMetricResult(metricState, metricScore);

  return (
    <Card
      size="small"
      style={{ maxWidth: CARD_MAX_WIDTH }}
      title={
        <Flex
          gap={APP_GAP_SM}
          align="center"
          justify="center"
          aria-label={`${label} score: ${String(metricScore)}`}
        >
          <Typography.Text>{label}:</Typography.Text>
          <MetricPill metric={metricResult} precision={0} compact />
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
          {renderArtifact(artifactType, artifactContent, metricState)}
        </Flex>
      </Flex>
    </Card>
  );
}
