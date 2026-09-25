import { useCallback, useState, type JSX } from 'react';
import { useAssignmentDefinitionWizard } from './useAssignmentDefinitionWizard';
import { AssignmentDiscardConfirm } from './AssignmentDiscardConfirm';
import { AssignmentDefinitionWizardModalShell } from './AssignmentDefinitionWizardModalShell';
import { ManageTopicsModal } from '../referenceData/ManageTopicsModal';
import { ManageYearGroupsModal } from '../referenceData/ManageYearGroupsModal';
import { type AssignmentDefinitionWizardModalProperties } from './useAssignmentDefinitionWizard';

/**
 * Renders the assignment-definition wizard modal for create and update workflows.
 * Delegates view-state rendering to AssignmentDefinitionWizardModalShell.
 *
 * @remarks
 * The modal implements a two-stage workflow:
 * - Stage one (create mode): parse document URLs first, then proceed to edit metadata and task weightings.
 * - Stage two (shared edit surface): edit metadata, year group, assignment weighting, and task weightings.
 *
 * Document change re-parse gating: in update mode, changing either document URL keeps metadata and
 * weighting controls disabled while both URL inputs remain editable until the user re-parses or restores
 * the persisted URLs. The update modal's close affordances remain available for a URL-only pending change;
 * dirty metadata still uses the discard confirmation.
 *
 * Dirty state tracking: unsaved metadata or weighting edits disable document URL fields when no document
 * change is pending. Closing the modal with dirty edits requires explicit discard confirmation.
 *
 * @param {AssignmentDefinitionWizardModalProperties} properties Modal properties.
 * @returns {JSX.Element} The wizard modal component.
 */
export function AssignmentDefinitionWizardModal(
  properties: AssignmentDefinitionWizardModalProperties
): JSX.Element {
  const { open, mode, definitionKey, onClose, initialValues, onCreateSuccess } = properties;
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
    canReparseDocuments,
    selectedTopicKey,
    selectedYearGroupKey,
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
    handleReparseDocuments,
    handleClose,
    handleDiscardConfirm,
    handleKeepEditing,
    handleTaskWeightingChange,
    handlePrimaryAction,
    onTopicEntityCreated,
    onYearGroupEntityCreated,
  } = useAssignmentDefinitionWizard({ open, mode, definitionKey, onClose, initialValues, onCreateSuccess });

  const isClosable = !isSubmitting && (mode === 'update' || !documentChange.hasPendingChange);

  // Child-modal opening stays in this modal component, which already owns the
  // Manage Topics and Manage Year Groups dialogs.
  const handleOpenTopicsModal = useCallback(() => {
    setManageTopicsModalOpen(true);
  }, []);

  const handleOpenYearGroupsModal = useCallback(() => {
    setManageYearGroupsModalOpen(true);
  }, []);

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
    [onYearGroupEntityCreated, setManageYearGroupsModalOpen]
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
        canReparseDocuments={canReparseDocuments}
        onReparseDocuments={mode === 'update' ? handleReparseDocuments : undefined}
        onTaskWeightingChange={handleTaskWeightingChange}
        onTopicAddNew={handleOpenTopicsModal}
        onYearGroupAddNew={handleOpenYearGroupsModal}
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

      <AssignmentDiscardConfirm
        open={showDiscardConfirm}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscardConfirm}
      />
    </>
  );
}
