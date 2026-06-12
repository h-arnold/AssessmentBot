import { Modal, Space, Button, Typography } from 'antd';
import { useCallback, useState, type JSX } from 'react';
import { useAssignmentDefinitionWizard } from './useAssignmentDefinitionWizard';
import { AssignmentDefinitionWizardModalShell } from './AssignmentDefinitionWizardModalShell';
import { ManageTopicsModal } from '../../features/settings/ManageTopicsModal';
import { ManageYearGroupsModal } from '../../features/classes/management/ManageYearGroupsModal';
import { type AssignmentDefinitionWizardModalProperties } from './useAssignmentDefinitionWizard';

const { Text } = Typography;

/**
 * Renders the assignment-definition wizard modal for create and update workflows.
 * Delegates view-state rendering to AssignmentDefinitionWizardModalShell.
 *
 * @remarks
 * The modal implements a two-stage workflow:
 * - Stage one (create mode): parse document URLs first, then proceed to edit metadata and task weightings.
 * - Stage two (shared edit surface): edit metadata, year group, assignment weighting, and task weightings.
 *
 * Document change re-parse gating: when document URLs change after initial parse, other edits are disabled
 * until the user either re-parses (refreshes tasks from new URLs) or cancels (restores persisted URLs).
 *
 * Dirty state tracking: unsaved metadata or weighting edits disable document URL fields. Closing the modal
 * with dirty edits requires explicit discard confirmation.
 *
 * @param {AssignmentDefinitionWizardModalProperties} properties Modal properties.
 * @returns {JSX.Element} The wizard modal component.
 */
export function AssignmentDefinitionWizardModal(
  properties: AssignmentDefinitionWizardModalProperties
): JSX.Element {
  const { open, mode, definitionKey, onClose } = properties;
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
    isReferenceDataLoading,
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
    handleTopicAddNew,
    handleYearGroupAddNew,
    onTopicEntityCreated,
    onYearGroupEntityCreated,
  } = useAssignmentDefinitionWizard({ open, mode, definitionKey, onClose });

  const isClosable = !isSubmitting && !documentChange.hasPendingChange;

  // Handlers for opening modals
  const handleOpenTopicsModal = useCallback(() => {
    setManageTopicsModalOpen(true);
  }, []);

  const handleOpenYearGroupsModal = useCallback(() => {
    setManageYearGroupsModalOpen(true);
  }, []);

  // Combined handlers that call both the hook handler and open the modal
  const combinedTopicAddNew = useCallback(() => {
    handleTopicAddNew();
    handleOpenTopicsModal();
  }, [handleTopicAddNew, handleOpenTopicsModal]);

  const combinedYearGroupAddNew = useCallback(() => {
    handleYearGroupAddNew();
    handleOpenYearGroupsModal();
  }, [handleYearGroupAddNew, handleOpenYearGroupsModal]);

  // Enhanced entity created handlers that also close the modal
  const combinedTopicEntityCreated = useCallback(
    (entity: { key: string; name: string; yearGroupKeys?: string[] }) => {
      onTopicEntityCreated(entity);
      setManageTopicsModalOpen(false);
    },
    [onTopicEntityCreated, setManageTopicsModalOpen]
  );

  const combinedYearGroupEntityCreated = useCallback(
    (entity: { key: string; name: string }) => {
      onYearGroupEntityCreated(entity);
      setManageYearGroupsModalOpen(false);
    },
    [onYearGroupEntityCreated]
  );

  return (
    <>
      <AssignmentDefinitionWizardModalShell
        open={open}
        mode={mode}
        title={null}
        isReferenceDataBlocked={isReferenceDataBlocked}
        isHydrating={isReferenceDataLoading}
        blockingError={blockingError}
        isMutationBusy={isSubmitting}
        isClosable={isClosable}
        hasDirtyEdits={hasDirtyEdits}
        hasParsedTasks={hasParsedTasks}
        taskRows={taskRows}
        documentChange={documentChange}
        form={form}
        topicOptions={topicOptions}
        yearGroupOptions={yearGroupOptions}
        primaryActionLabel={primaryActionLabel}
        isPrimaryActionDisabled={isPrimaryActionDisabled}
        onCancel={handleClose}
        onPrimaryAction={handlePrimaryAction}
        onFormValuesChange={handleFormValuesChange}
        onReparse={handleReparse}
        onReparseCancel={handleReparseCancel}
        onTaskWeightingChange={handleTaskWeightingChange}
        onTopicAddNew={combinedTopicAddNew}
        onYearGroupAddNew={combinedYearGroupAddNew}
        selectedTopicKey={selectedTopicKey}
        selectedYearGroupKey={selectedYearGroupKey}
      />

      <ManageTopicsModal
        open={manageTopicsModalOpen}
        onClose={() => setManageTopicsModalOpen(false)}
        onEntityCreated={combinedTopicEntityCreated}
      />

      <ManageYearGroupsModal
        open={manageYearGroupsModalOpen}
        onClose={() => setManageYearGroupsModalOpen(false)}
        onEntityCreated={combinedYearGroupEntityCreated}
      />

      <Modal
        centered
        destroyOnHidden
        footer={<Space><Button onClick={handleKeepEditing}>Keep editing</Button><Button danger onClick={handleDiscardConfirm} type="primary">Discard changes</Button></Space>}
        keyboard
        onCancel={handleKeepEditing}
        open={showDiscardConfirm}
        title="Discard changes"
        transitionName=""
      >
        <Text>You have unsaved changes. Discard and close?</Text>
      </Modal>
    </>
  );
}
