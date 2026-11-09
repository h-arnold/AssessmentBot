/**
 * Presentational content for the heatmap task-preview card.
 *
 * @remarks
 * The source action depends only on `sourceUrl` and remains outside the metric's
 * live status region.
 */

import type { JSX, RefCallback } from 'react';
import { Alert, Button, Card, Skeleton, Typography, Divider, Flex, Tooltip } from 'antd';
import { ExternalLink } from 'lucide-react';
import { MetricPill } from '@/services/dataAnalysis/metricDisplay/MetricPill';
import { METRIC_DISPLAY_META } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { formatMetricDisplayText } from '@/services/dataAnalysis/metricDisplay/metricDisplayText';
import type { TaskDisplayMetric } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { AssessmentError } from './buildCellPreviewLookup';
import { ImageRenderer } from '@/components/ImageRenderer/ImageRenderer';
import { MarkdownRenderer } from '@/components/MarkdownRenderer/MarkdownRenderer';
import { LucideIcon } from '@/components/icons/LucideIcon';
import { APP_GAP_SM } from '@/theme/spacing';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Readiness of the preview's source region.
 *
 * @remarks
 * `available` means the normal source region is ready to render — usable
 * content, or a confirmed no-submission showing its own placeholder. It does
 * not claim a document exists. `unavailable` means only an error source
 * remains, so the response renderer is suppressed in favour of an inline
 * explanation. `loading` is reserved for the pending full-fetch window behind a
 * known class-partial error and is never terminal.
 */
export type TaskPreviewSourceState = 'loading' | 'available' | 'unavailable';

/** Discriminated props contract for the TaskPreviewCard component. */
export interface TaskPreviewData {
  readonly taskId: string;
  readonly artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  readonly artifactContent: string;
  readonly metricKey: 'completeness' | 'accuracy' | 'spag';
  readonly reasoning: string;
  /** The analyser's task-display metric for this cell, rendered as-is. */
  readonly metric: TaskDisplayMetric;
  /**
   * Structured cause of the selected criterion's explicit `E` result, or `null`
   * when that criterion is not an error.
   *
   * @remarks
   * In-memory view-model field only; never persisted and never added to an API
   * response. The recorded `reasoning` stays the teacher-readable explanation.
   */
  readonly error: AssessmentError | null;
  /**
   * Readiness of the preview's source region, derived during assembly.
   *
   * @remarks
   * In-memory view-model field only; never persisted and never added to an API
   * response.
   */
  readonly sourceState: TaskPreviewSourceState;
  /**
   * Derived editor source link for the displayed submission artefact, carried
   * unchanged from `CellPreviewData`; `null` when no usable source exists.
   *
   * @remarks
   * Never persisted and never added to an API response. Resolved once in the
   * preview lookup; this component only renders the header action for it.
   */
  readonly sourceUrl: string | null;
}

/**
 * Element the rendered source action ref resolves to.
 *
 * @remarks
 * Ant Design types its button ref as the anchor/button union because one Button
 * renders either. This action always carries an `href`, so it renders as a
 * native anchor, and the ref type is narrowed accordingly.
 */
export type SourceActionElement = HTMLAnchorElement;

/** Props accepted by {@link TaskPreviewCard}. */
export interface TaskPreviewCardProperties {
  /** Preview data to display. */
  readonly data: TaskPreviewData;
  /**
   * Optional internal UI hook receiving the rendered source action, or `null`
   * when it unmounts.
   *
   * @remarks
   * The interaction owner (`TaskMetricPreviewCell.tsx`) passes this so it can
   * hand keyboard focus to the action without a global DOM query or a timer. It
   * is a local rendering concern, not transport state, so it stays an optional
   * UI prop rather than a field on {@link TaskPreviewData}.
   */
  readonly sourceAnchorRef?: RefCallback<SourceActionElement>;
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

/**
 * Accessible name of the source action, and the text its tooltip repeats.
 *
 * @remarks
 * Stated on the action itself, so the tooltip is a visible affordance for the
 * same words rather than the only place the name exists.
 */
export const SOURCE_ACTION_LABEL = 'Open source document (opens in a new tab)';

/** Retained final value, accepted at the representative visual inspection: side length of the source action's decorative icon, in CSS pixels. */
const SOURCE_ICON_SIZE = 16;

/**
 * Retained final stroke width, accepted at the representative visual
 * inspection: stroke width of the source action's icon.
 *
 * Thinner than Lucide's default of 2, matching the metric icons' convention
 * recorded in `docs/developer/frontend/metric-icon-display.md` §4.
 */
const SOURCE_ICON_STROKE_WIDTH = 1.5;

/** Side length of the header action and matching balance space. */
const SOURCE_ACTION_SIZE = 24;

// ---------------------------------------------------------------------------
// Source-region copy
// ---------------------------------------------------------------------------

/**
 * Accessible label of the source-region skeleton shown while a known error's
 * full fetch is pending.
 *
 * @remarks
 * The region is a labelled `<output aria-busy="true">`; `<output>` already
 * exposes the `status` role, so restating `role="status"` would be redundant.
 */
export const SOURCE_LOADING_LABEL = 'Loading source preview';

/** Alert title used whenever the source region cannot be shown. */
export const SOURCE_UNAVAILABLE_TITLE = 'Source unavailable';

/** Alert description for an ordinary unavailable source. */
export const SOURCE_UNAVAILABLE_DESCRIPTION =
  'The response cannot be shown. Reassess the assignment to try again.';

/** Alert description for a full-read-only corrupt record. */
export const SOURCE_CORRUPTION_DESCRIPTION =
  'Source preview unavailable. Displayed scores are unchanged; reassess the assignment to refresh them.';

/** Alert description for a stored reassessment-required error. */
export const REASSESSMENT_DESCRIPTION =
  'Reassess this assignment to create results in the current format.';

// ---------------------------------------------------------------------------
// Source action
// ---------------------------------------------------------------------------

/**
 * The header's source-document action: an icon-only text button rendered as a
 * native anchor.
 *
 * @remarks
 * The `href` makes the anchor itself the navigation mechanism, so activation and
 * new-tab behaviour belong to the browser and no imperative `window.open` is
 * involved. The icon is decorative (`aria-hidden`), so the accessible name comes
 * from the button's own `aria-label` alone.
 *
 * @param {Readonly<{ href: string }> & Pick<TaskPreviewCardProperties, 'sourceAnchorRef'>} properties - The source URL and the optional anchor ref.
 * @returns {JSX.Element} The tooltip-wrapped source action.
 */
function SourceAction({
  href,
  sourceAnchorRef,
}: Readonly<{ href: string }> & Pick<TaskPreviewCardProperties, 'sourceAnchorRef'>): JSX.Element {
  return (
    <Tooltip title={SOURCE_ACTION_LABEL} trigger={['hover', 'focus']}>
      <Button
        type="text"
        size="small"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={SOURCE_ACTION_LABEL}
        icon={
          <LucideIcon
            icon={ExternalLink}
            size={SOURCE_ICON_SIZE}
            strokeWidth={SOURCE_ICON_STROKE_WIDTH}
          />
        }
        ref={sourceAnchorRef}
      />
    </Tooltip>
  );
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

/**
 * Choose the Alert description for an unavailable source region.
 *
 * @remarks
 * A full-read-only corruption and a legacy reassessment result each carry their
 * own copy; every other unavailable source uses the ordinary description.
 *
 * @param {TaskPreviewData['error']} error - The selected criterion's cause.
 * @returns {string} The Alert description.
 */
function resolveUnavailableDescription(error: TaskPreviewData['error']): string {
  if (error?.code === 'CORRUPT_RECORD') {
    return SOURCE_CORRUPTION_DESCRIPTION;
  }
  if (error?.code === 'REASSESSMENT_REQUIRED') {
    return REASSESSMENT_DESCRIPTION;
  }
  return SOURCE_UNAVAILABLE_DESCRIPTION;
}

/**
 * Render the source region for the derived source state.
 *
 * @remarks
 * `loading` shows a labelled busy skeleton; `unavailable` shows a
 * non-dismissible inline Alert and never calls the response renderer;
 * `available` delegates to {@link renderArtifact}.
 *
 * @param {TaskPreviewData} data - The preview data being rendered.
 * @returns {JSX.Element} The source region content.
 */
function renderSourceRegion(data: TaskPreviewData): JSX.Element {
  if (data.sourceState === 'loading') {
    return (
      <output aria-busy="true" aria-label={SOURCE_LOADING_LABEL} style={{ display: 'block' }}>
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </output>
    );
  }

  if (data.sourceState === 'unavailable') {
    return (
      <Alert
        type="error"
        showIcon
        title={SOURCE_UNAVAILABLE_TITLE}
        description={resolveUnavailableDescription(data.error)}
      />
    );
  }

  return renderArtifact(data.artifactType, data.artifactContent, data.metric.state);
}

// ---------------------------------------------------------------------------
// TaskPreviewCard component
// ---------------------------------------------------------------------------

/**
 * Task Preview Card.
 *
 * @param {Readonly<TaskPreviewCardProperties>} props - Component properties.
 * @returns {JSX.Element} The rendered card.
 */
export function TaskPreviewCard({
  data,
  sourceAnchorRef,
}: Readonly<TaskPreviewCardProperties>): JSX.Element {
  const { metric, metricKey, reasoning, sourceUrl } = data;
  const meta = METRIC_DISPLAY_META.get(metricKey)!;
  const label = meta.label;

  const formattedScore = formatMetricDisplayText(metric, TASK_SCORE_PRECISION);

  const hasSourceAction = sourceUrl !== null;

  return (
    <Card
      size="small"
      style={{ maxWidth: CARD_MAX_WIDTH }}
      extra={
        hasSourceAction ? <SourceAction href={sourceUrl} sourceAnchorRef={sourceAnchorRef} /> : null
      }
      title={
        <Flex align="center" justify="center">
          {hasSourceAction && (
            // Inert mirror of the action's footprint: centring the pair rather
            // than the metric group alone is what puts the metric on the whole
            // card's centre. Rendered only with the action, so a card without a
            // source carries no empty placeholder.
            <span
              aria-hidden="true"
              data-testid="task-preview-header-balance"
              style={{ width: SOURCE_ACTION_SIZE, height: SOURCE_ACTION_SIZE, flexShrink: 0 }}
            />
          )}
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
          {renderSourceRegion(data)}
        </Flex>
      </Flex>
    </Card>
  );
}
