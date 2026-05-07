import { Modal, Space, Button, Typography } from 'antd';
import { type JSX } from 'react';
import { useAssignmentDefinitionWizard } from './useAssignmentDefinitionWizard';
import { AssignmentDefinitionWizardModalShell } from './AssignmentDefinitionWizardModalShell';

const { Text } = Typography;

type ModalMode = 'create' | 'update';

export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
}>;

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
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
    handleClose,
    handleDiscardConfirm,
    handleKeepEditing,
    handleTaskWeightingChange,
    handlePrimaryAction,
  } = useAssignmentDefinitionWizard({ open, mode, definitionKey, onClose });

  const isClosable = !isSubmitting && !documentChange.hasPendingChange;

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
