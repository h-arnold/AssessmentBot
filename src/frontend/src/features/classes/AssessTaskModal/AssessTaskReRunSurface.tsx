import { Alert, Button, Space, Typography } from 'antd';
import type { JSX } from 'react';
import type { ReRunContext } from '../../shared/reRunAssessmentContext';
import type {
  AssessTaskAssignment,
  AssessmentAlertType,
  AssessmentState,
} from './assessTaskFlowData';

export type AssessTaskReRunBodyProperties = Readonly<{
  /** The assignment and persisted definition key to re-run. */
  context: ReRunContext;
  /** The fetched classroom assignments, used to resolve the target title. */
  assignments: readonly AssessTaskAssignment[];
  /** The current assessment lifecycle state. */
  assessmentState: AssessmentState;
  /** The settled outcome message, when one exists. */
  assessmentError: string | undefined;
  /** The alert type for a settled outcome. */
  assessmentAlertType: AssessmentAlertType;
}>;

/**
 * Renders the body slot for the explicit re-run entry: the outcome alert once
 * the run settles, otherwise the target assignment plus a note that the
 * linked definition is reused.
 *
 * @remarks Never renders the assignment Select, so the skipped selector
 * cannot be mistaken for the manual selection path, and never renders the raw
 * internal definition key.
 *
 * @param {AssessTaskReRunBodyProperties} properties The re-run context and flow state.
 * @returns {JSX.Element} The re-run body content.
 */
export function AssessTaskReRunBody(properties: AssessTaskReRunBodyProperties): JSX.Element {
  const { context, assignments, assessmentState, assessmentError, assessmentAlertType } =
    properties;

  if (assessmentState === 'success') {
    return <Alert type="success" showIcon title={assessmentError} style={{ marginBottom: 16 }} />;
  }

  if (assessmentState === 'error' && assessmentError) {
    return (
      <Alert
        type={assessmentAlertType}
        showIcon
        title={assessmentError}
        style={{ marginBottom: 16 }}
      />
    );
  }

  const assignment = assignments.find((a) => a.assignmentId === context.assignmentId);
  const assignmentLabel = assignment === undefined ? '' : ` for '${assignment.title}'`;
  return (
    <Space vertical style={{ width: '100%' }}>
      <Typography.Text>{`Re-run assessment${assignmentLabel}`}</Typography.Text>
      <Typography.Text type="secondary">
        Using the assessment definition linked when this assignment was last assessed.
      </Typography.Text>
    </Space>
  );
}

export type AssessTaskReRunFooterProperties = Readonly<{
  /** The current assessment lifecycle state. */
  assessmentState: AssessmentState;
  /** True when the visible failure can succeed on retry. */
  isRetryAvailable: boolean;
  /** Re-runs the current re-run entry; a no-op for non-retryable failures. */
  onRetry: () => void;
  /** Dismisses the owning modal. */
  onClose: () => void;
}>;

/**
 * Renders the footer slot for the explicit re-run entry.
 *
 * @remarks The re-run never offers the manual Start Assessment action. While
 * the automatic start is in flight the primary action follows the modal
 * confirm-loading pattern; a retryable failure keeps the primary action
 * available for retry (per the modal error-handling pattern); a permanently
 * blocked re-run keeps only Cancel, so the footer never offers an action that
 * cannot succeed; and success offers Close. Stale-definition recovery
 * suppresses this footer entirely in favour of the recovery surface.
 *
 * @param {AssessTaskReRunFooterProperties} properties The re-run footer state and handlers.
 * @returns {JSX.Element} The re-run footer content.
 */
export function AssessTaskReRunFooter(properties: AssessTaskReRunFooterProperties): JSX.Element {
  const { assessmentState, isRetryAvailable, onRetry, onClose } = properties;

  if (assessmentState === 'success') {
    return (
      <Button type="primary" onClick={onClose}>
        Close
      </Button>
    );
  }

  if (assessmentState === 'loading') {
    return (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" disabled loading>
          Re-run Assessment
        </Button>
      </>
    );
  }

  if (assessmentState === 'error') {
    return (
      <>
        <Button onClick={onClose}>Cancel</Button>
        {isRetryAvailable && (
          <Button type="primary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </>
    );
  }

  // Pre-start: the effect-driven launch owns the transition, so only the
  // dismiss action is offered.
  return <Button onClick={onClose}>Cancel</Button>;
}
