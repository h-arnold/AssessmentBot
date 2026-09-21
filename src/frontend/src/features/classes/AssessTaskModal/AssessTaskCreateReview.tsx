import { Alert } from 'antd';
import { useLayoutEffect, useRef, useState, type JSX } from 'react';
import { useAssignmentDefinitionWizard } from '../../assignmentWizard/useAssignmentDefinitionWizard';
import { AssignmentDiscardConfirm } from '../../assignmentWizard/AssignmentDiscardConfirm';
import { AssignmentDefinitionWizardReviewContent } from '../../assignmentWizard/AssignmentDefinitionWizardReviewContent';
import { ManageTopicsModal } from '../../referenceData/ManageTopicsModal';
import { ManageYearGroupsModal } from '../../referenceData/ManageYearGroupsModal';

const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';

export type AssessTaskCreateReviewProperties = Readonly<{
  initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>;
  onCreateSuccess: (definitionKey: string) => void;
  onClose: () => void;
  registerModalCancel: (cancel: (() => void) | null) => void;
}>;

/**
 * Renders the genuine create-new-definition wizard content inside the owning
 * `AssessTaskModal` body, without a second stacked `Modal`.
 *
 * @remarks
 * SPEC decision 9 converts the create path to in-modal rendering. This component
 * reuses the chrome-free `AssignmentDefinitionWizardReviewContent` (both wizard
 * stages) and the `useAssignmentDefinitionWizard` create-mode composition, so the
 * create journey (choice → parse → review → auto-assessment) is presentation-only
 * changed. The owning modal suppresses its own footer and adopts the wide-data
 * width token while this content is active.
 *
 * The wizard's transient child dialogs (Manage Topics, Manage Year Groups, discard
 * confirm) keep their existing modal behaviour; they are pickers rendered by this
 * wiring, not stacked workflow surfaces.
 *
 * @param {AssessTaskCreateReviewProperties} properties Initial values, create-success, cancel and modal-cancel registration handlers.
 * @returns {JSX.Element} The in-modal create wizard content.
 */
export function AssessTaskCreateReview(
  properties: AssessTaskCreateReviewProperties
): JSX.Element {
  const { initialValues, onCreateSuccess, onClose, registerModalCancel } = properties;
  const [manageTopicsModalOpen, setManageTopicsModalOpen] = useState(false);
  const [manageYearGroupsModalOpen, setManageYearGroupsModalOpen] = useState(false);

  const {
    form,
    hasParsedTasks,
    taskRows,
    documentChange,
    hasDirtyEdits,
    showDiscardConfirm,
    isSubmitting,
    blockingError,
    isReferenceDataBlocked,
    topicOptions,
    yearGroupOptions,
    primaryActionLabel,
    isPrimaryActionDisabled,
    selectedTopicKey,
    selectedYearGroupKey,
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
    handleClose,
    handleDiscardConfirm,
    handleKeepEditing,
    handleTaskWeightingChange,
    handlePrimaryAction,
    onTopicEntityCreated,
    onYearGroupEntityCreated,
  } = useAssignmentDefinitionWizard({
    open: true,
    mode: 'create',
    definitionKey: null,
    initialValues,
    onCreateSuccess,
    onClose,
  });

  const handleCloseReference = useRef(handleClose);

  useLayoutEffect(() => {
    handleCloseReference.current = handleClose;
  }, [handleClose]);

  useLayoutEffect(() => {
    registerModalCancel(() => handleCloseReference.current());
    return () => registerModalCancel(null);
  }, [registerModalCancel]);

  if (isReferenceDataBlocked) {
    return <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />;
  }

  if (blockingError) {
    return <Alert showIcon title={blockingError} type="error" />;
  }

  return (
    <>
      <AssignmentDefinitionWizardReviewContent
        mode="create"
        documentChange={documentChange}
        form={form}
        hasDirtyEdits={hasDirtyEdits}
        hasParsedTasks={hasParsedTasks}
        showAlerts
        isMutationBusy={isSubmitting}
        isPrimaryActionDisabled={isPrimaryActionDisabled}
        onCancel={handleClose}
        onFormValuesChange={handleFormValuesChange}
        onPrimaryAction={handlePrimaryAction}
        onReparse={handleReparse}
        onReparseCancel={handleReparseCancel}
        onTaskWeightingChange={handleTaskWeightingChange}
        onTopicAddNew={() => {
          setManageTopicsModalOpen(true);
        }}
        onYearGroupAddNew={() => {
          setManageYearGroupsModalOpen(true);
        }}
        primaryActionLabel={primaryActionLabel}
        selectedTopicKey={selectedTopicKey}
        selectedYearGroupKey={selectedYearGroupKey}
        taskRows={taskRows}
        topicOptions={topicOptions}
        yearGroupOptions={yearGroupOptions}
      />

      <ManageTopicsModal
        onClose={() => setManageTopicsModalOpen(false)}
        onEntityCreated={(entity: { key: string; name: string; yearGroupKeys?: string[] }) => {
          onTopicEntityCreated(entity);
          setManageTopicsModalOpen(false);
        }}
        open={manageTopicsModalOpen}
      />

      <ManageYearGroupsModal
        onClose={() => setManageYearGroupsModalOpen(false)}
        onEntityCreated={(entity: { key: string; name: string }) => {
          onYearGroupEntityCreated(entity);
          setManageYearGroupsModalOpen(false);
        }}
        open={manageYearGroupsModalOpen}
      />

      <AssignmentDiscardConfirm
        open={showDiscardConfirm}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscardConfirm}
      />
    </>
  );
}
