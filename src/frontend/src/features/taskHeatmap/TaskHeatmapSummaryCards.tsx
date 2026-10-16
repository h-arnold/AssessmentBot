import { useId, useState, type JSX } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Flex,
  Popover,
  Row,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ChevronDown, ChevronUp, Info, ListTodo, Target } from 'lucide-react';
import type {
  SummaryCardsView,
  SummaryCardView,
  SummaryTaskView,
} from '@/services/dataAnalysis/assignmentSummaryAdapter';
import { APP_GAP_MD, APP_GAP_SM } from '@/theme/spacing';

const SUMMARY_ICON_SIZE = 16;
const SUMMARY_HALF_WIDTH = 12;
const SUMMARY_FULL_WIDTH = 24;
const SUMMARY_VALUE_SIZE = 20;
const SUMMARY_INFORMATION_WIDTH = 320;
const SUMMARY_HIGHLIGHTS_MIN_HEIGHT = 88;
const SUMMARY_TASK_MIN_HEIGHT = 104;

/**
 * Show a consistent click-to-open explanation beside a summary label.
 * @param {Readonly<{ label: string; explanation: string }>} properties - Accessible label and adapted explanation.
 * @returns {JSX.Element} Information button and its popover.
 */
function SummaryInformation({
  label,
  explanation,
}: Readonly<{ label: string; explanation: string }>): JSX.Element {
  return (
    <Popover
      trigger="click"
      content={
        <div style={{ maxWidth: SUMMARY_INFORMATION_WIDTH, overflowWrap: 'anywhere' }}>
          {explanation}
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        aria-label={`About ${label.toLowerCase()}`}
        icon={<Info size={SUMMARY_ICON_SIZE} aria-hidden="true" />}
      />
    </Popover>
  );
}

/**
 * Render display-ready task rows without deriving scores or counts.
 * @param {Readonly<{ rows: SummaryTaskView[] }>} properties - Task presentation rows.
 * @returns {JSX.Element} Wrapping task evidence rows.
 */
function SummaryRows({ rows }: Readonly<{ rows: SummaryTaskView[] }>): JSX.Element {
  return (
    <Flex vertical gap={APP_GAP_MD} role="list">
      {rows.map((row) => {
        return (
          <Flex
            key={row.key}
            vertical
            gap={APP_GAP_SM}
            role="listitem"
            aria-label={row.title}
            style={{ minHeight: SUMMARY_TASK_MIN_HEIGHT, overflowWrap: 'anywhere' }}
          >
            <Divider style={{ margin: 0 }} />
            <Flex align="center" justify="space-between" wrap gap={APP_GAP_SM}>
              <Typography.Text strong>{row.title}</Typography.Text>
              {row.requiresAttention && (
                <Tag color="warning" style={{ margin: 0 }}>
                  Requires attention
                </Tag>
              )}
            </Flex>
            <Flex align="baseline" wrap gap={APP_GAP_SM}>
              <Typography.Text strong style={{ fontSize: SUMMARY_VALUE_SIZE }}>
                {row.primaryValue}
              </Typography.Text>
              <Typography.Text type="secondary">{row.valueLabel}</Typography.Text>
              {row.belowThreshold && (
                <Tag color={row.belowThresholdColour} style={{ margin: 0 }}>
                  {row.belowThreshold}
                </Tag>
              )}
            </Flex>
            <Flex wrap gap={APP_GAP_SM}>
              {row.details.map((detail) => {
                return (
                  <Tooltip
                    key={detail.text}
                    title={detail.explanation}
                    trigger={['hover', 'focus']}
                  >
                    <Typography.Text tabIndex={0} type={detail.attention ? 'danger' : 'secondary'}>
                      {detail.text}
                    </Typography.Text>
                  </Tooltip>
                );
              })}
              {row.zeroWeight && <Typography.Text type="secondary">Zero weighting</Typography.Text>}
            </Flex>
          </Flex>
        );
      })}
    </Flex>
  );
}

/**
 * Render bounded highlights and independently expandable task details.
 * @param {Readonly<{ model: SummaryCardView }>} properties - Display-ready card data.
 * @returns {JSX.Element} Summary content and its disclosure control.
 */
function SummaryContent({ model }: Readonly<{ model: SummaryCardView }>): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  return (
    <Flex vertical gap={APP_GAP_MD} style={{ overflowWrap: 'anywhere' }}>
      {/* Reserve space for three highlight lines so both task lists start together. */}
      <Flex vertical gap={APP_GAP_SM} style={{ minHeight: SUMMARY_HIGHLIGHTS_MIN_HEIGHT }}>
        {model.highlights.map((highlight) => {
          return (
            <Flex key={highlight.label} align="center" wrap gap={APP_GAP_SM}>
              <Typography.Text strong>{highlight.label}:</Typography.Text>
              <Tag color={highlight.colour} style={{ margin: 0, whiteSpace: 'normal' }}>
                {expanded ? highlight.value : highlight.previewValue}
              </Tag>
              <SummaryInformation label={highlight.label} explanation={highlight.explanation} />
            </Flex>
          );
        })}
      </Flex>
      <div id={listId}>
        <SummaryRows rows={expanded ? model.rows : model.previewRows} />
      </div>
      {model.canExpand && (
        <Button
          type="link"
          block
          aria-expanded={expanded}
          aria-controls={listId}
          icon={
            expanded ? (
              <ChevronUp size={SUMMARY_ICON_SIZE} aria-hidden="true" />
            ) : (
              <ChevronDown size={SUMMARY_ICON_SIZE} aria-hidden="true" />
            )
          }
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : model.showAllLabel}
        </Button>
      )}
    </Flex>
  );
}

/**
 * Render either task evidence, an empty state or a selection notice.
 * @param {Readonly<{ model: SummaryCardView | undefined; emptyMessage: string | null | undefined; message: string | undefined }>} properties - Adapted content.
 * @returns {JSX.Element} Card body without analysis logic.
 */
function SummaryBody({
  model,
  emptyMessage,
  message,
}: Readonly<{
  model: SummaryCardView | undefined;
  emptyMessage: string | null | undefined;
  message: string | undefined;
}>): JSX.Element {
  if (message !== undefined) return <Typography.Text type="secondary">{message}</Typography.Text>;
  if (emptyMessage) return <Empty description={emptyMessage} />;
  if (model === undefined) throw new Error('Missing summary presentation data');
  return <SummaryContent model={model} />;
}

/**
 * Show descriptive completeness and accuracy summaries above the task matrix.
 * @param {Readonly<SummaryCardsView>} properties - Adapted summary or selection notice.
 * @returns {JSX.Element} Responsive Ant Design summary cards.
 */
export function TaskHeatmapSummaryCards({
  summary,
  message,
}: Readonly<SummaryCardsView>): JSX.Element {
  return (
    <Row gutter={[APP_GAP_MD, APP_GAP_MD]}>
      <Col xs={SUMMARY_FULL_WIDTH} lg={SUMMARY_HALF_WIDTH} style={{ display: 'flex' }}>
        <section aria-label="Completeness summary" style={{ width: '100%' }}>
          <Card
            size="small"
            style={{ height: '100%' }}
            title={
              <Flex align="center" gap={APP_GAP_SM}>
                <ListTodo size={SUMMARY_ICON_SIZE} aria-hidden="true" />
                Completeness
                {summary && (
                  <SummaryInformation
                    label="Completeness"
                    explanation={summary.completenessExplanation}
                  />
                )}
              </Flex>
            }
          >
            <SummaryBody
              model={summary?.completeness}
              emptyMessage={summary?.emptyMessage}
              message={message}
            />
          </Card>
        </section>
      </Col>
      <Col xs={SUMMARY_FULL_WIDTH} lg={SUMMARY_HALF_WIDTH} style={{ display: 'flex' }}>
        <section aria-label="Accuracy summary" style={{ width: '100%' }}>
          <Card
            size="small"
            style={{ height: '100%' }}
            title={
              <Flex align="center" gap={APP_GAP_SM}>
                <Target size={SUMMARY_ICON_SIZE} aria-hidden="true" />
                Accuracy
                {summary && (
                  <SummaryInformation label="Accuracy" explanation={summary.accuracyExplanation} />
                )}
              </Flex>
            }
          >
            <SummaryBody
              model={summary?.accuracy}
              emptyMessage={summary?.emptyMessage}
              message={message}
            />
          </Card>
        </section>
      </Col>
    </Row>
  );
}
