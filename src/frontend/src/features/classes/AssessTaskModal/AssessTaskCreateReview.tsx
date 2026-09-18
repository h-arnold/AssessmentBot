import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useCallback, useState, type JSX } from 'react';
import { useAssignmentDefinitionWizard } from '../../assignmentWizard/useAssignmentDefinitionWizard';
import { AssignmentDefinitionWizardReviewContent } from '../../assignmentWizard/AssignmentDefinitionWizardReviewContent';
import { ManageTopicsModal } from '../../referenceData/ManageTopicsModal';
import { ManageYearGroupsModal } from '../../referenceData/ManageYearGroupsModal';

const { Text } = Typography;

const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';

/**
 * Deterministic accessible-name id for the in-modal discard confirmation.
 *
 * @remarks
 * The confirmation is a nested Ant Design `Modal`, mirroring the wizard's
 * existing dirty-discard pattern. rc-dialog labels its dialog element with a
 * singleton auto-generated id, so a nested dialog would otherwise share the
 * owning modal's accessible name. Anchoring the confirmation to its own title
 * keeps the two dialogs distinctly labelled for assistive technology.
 */
const DISCARD_CONFIRM_TITLE_ID = 'assess-task-create-discard-confirm-title';

export type AssessTaskCreateReviewProperties = Readonly<{
  initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>;
  onCreateSuccess: (definitionKey: string) => void;
  onClose: () => void;
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
 * @param {AssessTaskCreateReviewProperties} properties Initial values, create-success and cancel handlers.
 * @returns {JSX.Element} The in-modal create wizard content.
 */
export function AssessTaskCreateReview(
  properties: AssessTaskCreateReviewProperties
): JSX.Element {
  const { initialValues, onCreateSuccess, onClose } = properties;
  const [manageTopicsModalOpen, setManageTopicsModalOpen] = useState(false);
  const [manageYearGroupsModalOpen, setManageYearGroupsModalOpen] = useState(false);

  // Re-anchors the nested discard dialog's accessible name to its own title.
  // rc-dialog labels every dialog with the same auto-generated id, so without
  // this the confirmation would inherit the owning modal's name.
  const labelDiscardDialog = useCallback((node: HTMLDivElement | null): void => {
    node?.setAttribute('aria-labelledby', DISCARD_CONFIRM_TITLE_ID);
  }, []);

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
    handleTopicAddNew,
    handleYearGroupAddNew,
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

  if (isReferenceDataBlocked) {
    return <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />;
  }

  if (blockingError) {
    return <Alert showIcon title={blockingError} type="error" />;
  }

  return (
    <>
      <AssignmentDefinitionWizardReviewContent
        documentChange={documentChange}
        form={form}
        hasDirtyEdits={hasDirtyEdits}
        hasParsedTasks={hasParsedTasks}
        isMutationBusy={isSubmitting}
        isPrimaryActionDisabled={isPrimaryActionDisabled}
        onCancel={handleClose}
        onFormValuesChange={handleFormValuesChange}
        onPrimaryAction={handlePrimaryAction}
        onReparse={handleReparse}
        onReparseCancel={handleReparseCancel}
        onTaskWeightingChange={handleTaskWeightingChange}
        onTopicAddNew={() => {
          handleTopicAddNew();
          setManageTopicsModalOpen(true);
        }}
        onYearGroupAddNew={() => {
          handleYearGroupAddNew();
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

      <Modal
        centered
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={handleKeepEditing}>Keep editing</Button>
            <Button danger onClick={handleDiscardConfirm} type="primary">
              Discard changes
            </Button>
          </Space>
        }
        keyboard
        onCancel={handleKeepEditing}
        open={showDiscardConfirm}
        panelRef={labelDiscardDialog}
        title={<span id={DISCARD_CONFIRM_TITLE_ID}>Discard changes</span>}
        transitionName=""
      >
        <Text>You have unsaved changes. Discard and close?</Text>
      </Modal>
    </>
  );
}
