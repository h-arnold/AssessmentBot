import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { mapErrorCodeToUserMessage } from '../../../errors/map-error-to-ui';
import { AssignmentDefinitionWizardReviewContent } from '../../assignmentWizard/AssignmentDefinitionWizardReviewContent';
import { ManageTopicsModal } from '../../referenceData/ManageTopicsModal';
import { ManageYearGroupsModal } from '../../referenceData/ManageYearGroupsModal';
import { RecoveryReviewSkeleton } from './RecoveryReviewSkeleton';
import {
  useAssessTaskRecoveryFlow,
  type AssessTaskRecoveryFlow,
} from './useAssessTaskRecoveryFlow';
import type {
  AssessTaskAssignment,
  AssessmentAlertType,
  CapturedStartContext,
} from './assessTaskFlowData';

const { Text } = Typography;

const STALE_PROMPT_MESSAGE = mapErrorCodeToUserMessage('DEFINITION_STALE');
const REPARSING_MESSAGE = 'The definition is being refreshed from its current documents.';
const REVIEW_CAVEAT_MESSAGE =
  'Reparsing has already refreshed the stored definition. Cancelling review discards only unsaved edits.';
const FAILED_FALLBACK_MESSAGE = 'An error occurred. Please try again.';

/**
 * Deterministic accessible-name id for the in-modal recovery discard
 * confirmation, mirroring the create-path discard dialog.
 */
const DISCARD_CONFIRM_TITLE_ID = 'assess-task-recovery-discard-confirm-title';

/**
 * Registers (or clears) the recovery review's modal-level cancel intent.
 */
export type RecoveryReviewCancelRegistration = (cancel: (() => void) | null) => void;

export type AssessTaskRecoverySurfaceProperties = Readonly<{
  definitionKey: string | null;
  capturedStartContext: CapturedStartContext | null;
  assignments: readonly AssessTaskAssignment[];
  onClose: () => void;
  endRecovery: () => void;
  settleAssessment: (alertType: AssessmentAlertType, message: string) => void;
  registerReviewCancel: RecoveryReviewCancelRegistration;
}>;

/**
 * Renders the stale-recovery states inside the owning `AssessTaskModal` body:
 * the stale prompt, the forced-reparse busy region, the blocking failure
 * treatment and the in-modal review surface.
 *
 * @remarks
 * This surface renders no `Modal` chrome of its own; the owning modal keeps the
 * single dialog for every recovery state. The review surface reuses the
 * chrome-free `AssignmentDefinitionWizardReviewContent` (stage two), so its own
 * footer is the only visible one while review is active. The transient child
 * dialogs (Manage Topics, Manage Year Groups, discard confirmation) are the
 * only nested dialogs.
 *
 * @param {AssessTaskRecoverySurfaceProperties} properties The recovery flow state and handlers.
 * @returns {JSX.Element} The recovery surface.
 */
export function AssessTaskRecoverySurface(
  properties: AssessTaskRecoverySurfaceProperties
): JSX.Element {
  const recovery = useAssessTaskRecoveryFlow(properties);
  const { registerReviewCancel } = properties;
  const [manageTopicsModalOpen, setManageTopicsModalOpen] = useState(false);
  const [manageYearGroupsModalOpen, setManageYearGroupsModalOpen] = useState(false);

  // Lets the owning modal route Escape/close to the review cancel path while
  // review is active. The registration is cleared in every other phase and on
  // unmount, so the modal's default close behaviour is preserved elsewhere.
  useEffect(() => {
    registerReviewCancel(recovery.phase === 'review' ? recovery.cancelReview : null);
    return () => {
      registerReviewCancel(null);
    };
  }, [registerReviewCancel, recovery.cancelReview, recovery.phase]);

  // Re-anchors the nested discard dialog's accessible name to its own title.
  // rc-dialog labels every dialog with the same auto-generated id, so without
  // this the confirmation would inherit the owning modal's name.
  const labelDiscardDialog = useCallback((node: HTMLDivElement | null): void => {
    node?.setAttribute('aria-labelledby', DISCARD_CONFIRM_TITLE_ID);
  }, []);

  return (
    <>
      {renderRecoveryPhase(recovery, () => setManageTopicsModalOpen(true), () =>
        setManageYearGroupsModalOpen(true)
      )}
      <ManageTopicsModal
        onClose={() => setManageTopicsModalOpen(false)}
        onEntityCreated={() => {
          recovery.onTopicEntityCreated();
          setManageTopicsModalOpen(false);
        }}
        open={manageTopicsModalOpen}
      />
      <ManageYearGroupsModal
        onClose={() => setManageYearGroupsModalOpen(false)}
        onEntityCreated={() => {
          recovery.onYearGroupEntityCreated();
          setManageYearGroupsModalOpen(false);
        }}
        open={manageYearGroupsModalOpen}
      />
      <Modal
        centered
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={recovery.handleKeepEditing}>Keep editing</Button>
            <Button danger onClick={recovery.handleDiscardConfirm} type="primary">
              Discard changes
            </Button>
          </Space>
        }
        keyboard
        onCancel={recovery.handleKeepEditing}
        open={recovery.showDiscardConfirm}
        panelRef={labelDiscardDialog}
        title={<span id={DISCARD_CONFIRM_TITLE_ID}>Discard changes</span>}
        transitionName=""
      >
        <Text>You have unsaved changes. Discard and close?</Text>
      </Modal>
    </>
  );
}

/**
 * Renders the body content and action row for the active recovery phase.
 *
 * @param {AssessTaskRecoveryFlow} recovery The recovery flow state and handlers.
 * @param {() => void} onTopicAddNew Opens the Manage Topics child dialog.
 * @param {() => void} onYearGroupAddNew Opens the Manage Year Groups child dialog.
 * @returns {JSX.Element | null} The phase content, or null while idle.
 */
function renderRecoveryPhase(
  recovery: AssessTaskRecoveryFlow,
  onTopicAddNew: () => void,
  onYearGroupAddNew: () => void
): JSX.Element | null {
  switch (recovery.phase) {
    case 'stale-prompt': {
      return renderStalePrompt(recovery);
    }
    case 'reparsing': {
      return renderReparsing(recovery);
    }
    case 'failed': {
      return renderFailure(recovery);
    }
    case 'review': {
      return renderReview(recovery, onTopicAddNew, onYearGroupAddNew);
    }
    default: {
      return null;
    }
  }
}

/**
 * Renders the body content and action row for the active recovery phase.
 *
 * @param {AssessTaskRecoveryFlow} recovery The recovery flow state and handlers.
 * @param {() => void} onTopicAddNew Opens the Manage Topics child dialog.
 * @param {() => void} onYearGroupAddNew Opens the Manage Year Groups child dialog.
 * @returns {JSX.Element | null} The phase content, or null while idle.
 */
function renderStalePrompt(recovery: AssessTaskRecoveryFlow): JSX.Element {
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert showIcon title={STALE_PROMPT_MESSAGE} type="warning" />
      <Space>
        <Button onClick={recovery.cancelFlow}>Cancel</Button>
        <Button
          onClick={() => {
            void recovery.startUpdate();
          }}
          type="primary"
        >
          Update
        </Button>
      </Space>
    </Space>
  );
}

/**
 * Renders the reparsing region: warning alert, accessible skeleton and the
 * Cancel-only footer.
 *
 * @param {AssessTaskRecoveryFlow} recovery The recovery flow state and handlers.
 * @param {() => void} onTopicAddNew Opens the Manage Topics child dialog.
 * @param {() => void} onYearGroupAddNew Opens the Manage Year Groups child dialog.
 * @returns {JSX.Element} The review surface.
 */
function renderReparsing(recovery: AssessTaskRecoveryFlow): JSX.Element {
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert showIcon title={REPARSING_MESSAGE} type="warning" />
      <RecoveryReviewSkeleton />
      <Space>
        <Button onClick={recovery.cancelFlow}>Cancel</Button>
      </Space>
    </Space>
  );
}

/**
 * Renders the blocking failure treatment: error alert and the
 * Cancel-then-Retry footer. Retry is a deliberate user action.
 *
 * @param {AssessTaskRecoveryFlow} recovery The recovery flow state and handlers.
 * @returns {JSX.Element} The failure region.
 */
function renderFailure(recovery: AssessTaskRecoveryFlow): JSX.Element {
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert showIcon title={recovery.errorMessage ?? FAILED_FALLBACK_MESSAGE} type="error" />
      <Space>
        <Button onClick={recovery.cancelFlow}>Cancel</Button>
        <Button
          onClick={() => {
            void recovery.startUpdate();
          }}
          type="primary"
        >
          Retry
        </Button>
      </Space>
    </Space>
  );
}

/**
 * Renders the in-modal review surface: the caveat alert (plus any approval
 * failure alert) above the chrome-free wizard review content whose own footer
 * carries the Save action.
 *
 * @param {AssessTaskRecoveryFlow} recovery The recovery flow state and handlers.
 * @param {() => void} onTopicAddNew Opens the Manage Topics child dialog.
 * @param {() => void} onYearGroupAddNew Opens the Manage Year Groups child dialog.
 * @returns {JSX.Element} The review surface.
 */
function renderReview(
  recovery: AssessTaskRecoveryFlow,
  onTopicAddNew: () => void,
  onYearGroupAddNew: () => void
): JSX.Element {
  return (
    <>
      <Alert showIcon title={REVIEW_CAVEAT_MESSAGE} type="info" style={{ marginBottom: 16 }} />
      {recovery.saveErrorMessage === null ? null : (
        <Alert showIcon title={recovery.saveErrorMessage} type="error" style={{ marginBottom: 16 }} />
      )}
      <AssignmentDefinitionWizardReviewContent
        documentChange={recovery.documentChange}
        form={recovery.form}
        hasDirtyEdits={recovery.hasDirtyEdits}
        hasParsedTasks={recovery.hasParsedTasks}
        isMutationBusy={recovery.isMutationBusy}
        isPrimaryActionDisabled={false}
        onCancel={recovery.cancelReview}
        onPrimaryAction={() => {
          void recovery.save();
        }}
        onTaskWeightingChange={recovery.handleTaskWeightingChange}
        onTopicAddNew={onTopicAddNew}
        onYearGroupAddNew={onYearGroupAddNew}
        primaryActionLabel="Save"
        selectedTopicKey={recovery.selectedTopicKey}
        selectedYearGroupKey={recovery.selectedYearGroupKey}
        taskRows={recovery.taskRows}
        topicOptions={recovery.topicOptions}
        yearGroupOptions={recovery.yearGroupOptions}
      />
    </>
  );
}
