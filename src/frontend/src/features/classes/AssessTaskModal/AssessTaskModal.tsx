import { Alert, Button, Empty, Modal, Select, Space, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { useAssessTaskFlow } from './useAssessTaskFlow';
import { AssessTaskCreateReview } from './AssessTaskCreateReview';
import { AssessTaskRecoverySurface } from './AssessTaskRecoverySurface';
import { LinkableDefinitionList } from './LinkableDefinitionList';
import { AssignmentSelectSkeleton } from './AssignmentSelectSkeleton';

export type AssessTaskModalProperties = Readonly<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}>;

/** Approved shared modal-width exception applied while wizard content is active. */
const WIDE_DATA_MODAL_WIDTH = 'var(--app-modal-width-wide-data)';

type ModalDismissEvent = Readonly<{ stopPropagation: () => void }>;

/**
 * Modal for selecting a Google Classroom assignment to assess.
 *
 * Fetches assignments on open and presents a dropdown selection.
 * Start Assessment runs the matching logic and kicks off an assessment run.
 *
 * @remarks All orchestration (the assessment and no-match state machines,
 * captured start context, and stale-recovery transitions) lives in
 * `useAssessTaskFlow`; this component only renders body and footer content
 * from the flow state. The recovery surface is owned by
 * `AssessTaskRecoverySurface` (mounted only while the flow is on
 * `stale-prompt`), so no recovery state stacks a second modal. See the hooks
 * for the state-machine documentation.
 *
 * @param {Readonly<AssessTaskModalProperties>} properties Modal properties.
 * @returns {JSX.Element} The assess task modal.
 */
export function AssessTaskModal(properties: Readonly<AssessTaskModalProperties>) {
  const { open, classId, className, onClose } = properties;
  const {
    assignments,
    selectedAssignmentId,
    fetchState,
    errorMessage,
    assessmentState,
    assessmentError,
    assessmentAlertType,
    noMatchResolution,
    selectedAssignmentForChoice,
    selectedDefinitionForLink,
    assessmentRecoveryState,
    recoveryDefinitionKey,
    capturedStartContext,
    wizardInitialValues,
    linkableDefinitions,
    isStartDisabled,
    handleStartAssessment,
    handleCreateNewDefinition,
    handleLinkExistingDefinition,
    handleLinkConfirm,
    handleLinkCancel,
    handleWizardCreateSuccess,
    handleWizardClose,
    handleAssignmentChange,
    handleLinkSelect,
    getLoadingButtonLabel,
    endRecovery,
    settleAssessment,
  } = useAssessTaskFlow({ open, classId });

  // Registration slot for the recovery review's modal-level cancel intent. The
  // recovery phase lives inside `AssessTaskRecoverySurface`; while that phase
  // is `review` the surface registers its cancel handler through
  // `registerRecoveryReviewCancel` so the owning modal's dismiss affordance
  // runs the review cancel semantics. It is null for every other recovery
  // phase and outside recovery.
  const recoveryReviewCancelReference = useRef<(() => void) | null>(null);
  const createWizardCancelReference = useRef<(() => void) | null>(null);

  /**
   * Registers (or clears) the recovery review's modal-level cancel intent.
   *
   * @param {(() => void) | null} cancel The review cancel handler, or null to clear it.
   * @returns {void}
   */
  const registerRecoveryReviewCancel = useCallback((cancel: (() => void) | null): void => {
    recoveryReviewCancelReference.current = cancel;
  }, []);

  /**
   * Registers (or clears) the in-modal create wizard's close intent.
   *
   * @param {(() => void) | null} cancel The wizard close handler, or null to clear it.
   * @returns {void}
   */
  const registerCreateWizardCancel = useCallback((cancel: (() => void) | null): void => {
    createWizardCancelReference.current = cancel;
  }, []);

  /**
   * Handles the owning modal's dismiss intent (Escape, backdrop or the close
   * affordance). While the recovery review is active it delegates to the
   * registered review cancel path, and while the in-modal create wizard is
   * active it delegates to the registered wizard close handler. Dirty edits in
   * either surface therefore still require the discard confirmation, and a
   * discarded surface returns to its own state instead of closing the owning
   * modal. When no cancel intent is registered it closes the modal.
   *
   * @param {ModalDismissEvent} [event] The dismissal event, when supplied by Ant Design.
   * @returns {void}
   */
  const handleModalCancel = useCallback((event?: ModalDismissEvent): void => {
    const cancelReview = recoveryReviewCancelReference.current;
    if (cancelReview !== null) {
      event?.stopPropagation();
      cancelReview();
      return;
    }
    const cancelCreateWizard = createWizardCancelReference.current;
    if (cancelCreateWizard !== null) {
      event?.stopPropagation();
      cancelCreateWizard();
      return;
    }
    onClose();
  }, [onClose]);

  // The in-modal create wizard content is active only while resolving the
  // no-match choice. The recovery surface owns the body while the recovery
  // state is `stale-prompt`.
  const isCreateContentActive = noMatchResolution === 'creating' && assessmentState === 'idle';
  const isRecoveryActive = assessmentRecoveryState === 'stale-prompt';
  // Exactly one footer is visible at all times: the owning footer is suppressed
  // whenever any in-modal wizard/recovery content owns the body.
  const isWizardContentActive = isCreateContentActive || isRecoveryActive;
  // The approved wide-data modal width applies while wizard/recovery content is
  // active so the task-weightings table is not horizontally compressed; otherwise
  // Ant Design's default width is retained.
  const modalWidth = isWizardContentActive ? WIDE_DATA_MODAL_WIDTH : undefined;

  useEffect(() => {
    if (!isCreateContentActive) return;

    /**
     * Routes Escape through the create wizard before Ant Design closes the
     * owning modal.
     *
     * @param {KeyboardEvent} event The keyboard event to consume.
     * @returns {void}
     */
    function handleCreateWizardEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handleModalCancel(event);
    }

    document.addEventListener('keydown', handleCreateWizardEscape, true);
    return () => document.removeEventListener('keydown', handleCreateWizardEscape, true);
  }, [isCreateContentActive, handleModalCancel]);

  /**
   * Renders the dropdown and assignment-selection body content.
   *
   * The assignment Select is searchable by title via `showSearch`.
   *
   * @remarks
   * The Select uses `virtual={false}` to disable virtual scrolling so option
   * elements are mounted in jsdom tests (virtual list omits unmounted options).
   * This is acceptable for production as assignment lists are small (typically
   * 5-20 items). No `notFoundContent` is provided — the empty state is handled
   * by `renderFetchBody` (the assignment list is never empty when this renders).
   *
   * @returns {React.ReactNode} The rendered assignments selection content.
   */
  function renderAssignmentsContent(): React.ReactNode {
    const selectOptions = assignments.map((assignment) => ({
      value: assignment.assignmentId,
      label: assignment.title,
    }));

    const assessmentAlert =
      assessmentState === 'success' || (assessmentState === 'error' && assessmentError) ? (
        <Alert type={assessmentAlertType} showIcon title={assessmentError} style={{ marginBottom: 16 }} />
      ) : null;

    return (
      <Space vertical style={{ width: '100%' }}>
        {assessmentAlert}
        <Typography.Text>Select assignment</Typography.Text>
        <Select
          data-testid="assignment-select"
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Select an assignment"
          value={selectedAssignmentId}
          onChange={handleAssignmentChange}
          options={selectOptions}
          style={{ width: '100%' }}
          // virtual={false} disables virtual scrolling so options render in jsdom tests;
          // acceptable for production as assignment lists are small (typically 5-20 items)
          virtual={false}
        />
        {selectedAssignmentId && (
          <Typography.Text type="secondary">
            {assignments.find((a) => a.assignmentId === selectedAssignmentId)?.title}
          </Typography.Text>
        )}
      </Space>
    );
  }

  /**
   * Renders the Link to Existing Definition button (enabled or disabled with
   * Tooltip) for the choice prompt.
   *
   * @returns {React.ReactNode} The rendered button.
   */
  function renderChoiceLinkButton(): React.ReactNode {
    if (linkableDefinitions.length > 0) {
      return (
        <Button onClick={handleLinkExistingDefinition}>
          Link to Existing Definition
        </Button>
      );
    }
    return (
      <Tooltip title="No assignment definitions exist for this class's year group.">
        <span>
          <Button disabled>Link to Existing Definition</Button>
        </span>
      </Tooltip>
    );
  }

  /**
   * Renders the body content for the noMatchResolution 'linking' branch.
   *
   * @remarks
   * Only renders when `noMatchResolution === 'linking'`. Handles all four
   * `assessmentState` sub-states: 'loading' (skeleton), 'success' (Alert),
   * 'error' (Alert), and 'idle' (LinkableDefinitionList picker). The loading
   * and error states mirror the patterns used by the main assessment flow.
   *
   * @returns {React.ReactNode} The linking body content.
   */
  function renderLinkingBody(): React.ReactNode {
    if (assessmentState === 'loading') {
      return <AssignmentSelectSkeleton ariaLabel="Loading linkable definitions" />;
    }

    if (assessmentState === 'success') {
      return <Alert type="success" showIcon title={assessmentError} style={{ marginBottom: 16 }} />;
    }

    if (assessmentState === 'error' && assessmentError) {
      return <Alert type={assessmentAlertType} showIcon title={assessmentError} style={{ marginBottom: 16 }} />;
    }

    // linking + idle: render the picker
    return (
      <Space vertical style={{ width: '100%' }}>
        <LinkableDefinitionList
          linkableDefinitions={linkableDefinitions}
          selectedDefinitionKey={selectedDefinitionForLink?.definitionKey ?? null}
          onSelect={handleLinkSelect}
        />
      </Space>
    );
  }

  /**
   * Renders the loading, error, or empty body content for the fetch phase.
   *
   * The loading state renders a shape-matched skeleton of the assignment
   * selection panel: a label skeleton and a full-width input skeleton to
   * represent the Select dropdown.
   *
   * @returns {React.ReactNode} The fetch-phase body, or null if no match.
   */
  function renderFetchBody(): React.ReactNode {
    if (fetchState === 'loading') {
      return <AssignmentSelectSkeleton ariaLabel="Loading assignments" />;
    }
    if (fetchState === 'error') {
      return <Alert type="error" title={errorMessage} />;
    }
    if (assignments.length === 0) {
      return <Empty description="No assignments found for this class" />;
    }
    return null as React.ReactNode;
  }

  /**
   * Determines the body content based on fetch and assessment state.
   *
   * @returns {React.ReactNode} The body content for the modal.
   */
  function renderBody(): React.ReactNode {
    const fetchBody = renderFetchBody();
    if (fetchBody !== null) {
      return fetchBody;
    }

    if (noMatchResolution === 'linking') {
      return renderLinkingBody();
    }

    if (noMatchResolution === 'choice') {
      return (
        <Space vertical style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            description={`No matching assignment definition found for '${selectedAssignmentForChoice?.title}'.`}
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Button type="primary" onClick={handleCreateNewDefinition}>
              Create New Definition
            </Button>
            {renderChoiceLinkButton()}
          </Space>
        </Space>
      );
    }

    if (noMatchResolution !== 'idle') {
      return null;
    }

    return renderAssignmentsContent();
  }

  /**
   * Renders the footer content for the linking + idle state.
   *
   * @remarks
   * Only renders when `noMatchResolution === 'linking'` and
   * `assessmentState === 'idle'`. The Link button is wrapped in a Tooltip
   * when disabled (no row selected). The Cancel button returns the modal to
   * the choice prompt. Both buttons are always visible in this sub-state.
   *
   * @returns {React.ReactNode} The rendered footer buttons.
   */
  function renderLinkingFooter(): React.ReactNode {
    const linkButton = (
      <Button
        type="primary"
        disabled={selectedDefinitionForLink === null}
        onClick={handleLinkConfirm}
      >
        Link
      </Button>
    );

    return (
      <>
        <Button onClick={handleLinkCancel}>Cancel</Button>
        {selectedDefinitionForLink === null ? (
          <Tooltip title="Select a definition to link.">
            <span>
              {linkButton}
            </span>
          </Tooltip>
        ) : linkButton}
      </>
    );
  }

  /**
   * Determines the modal footer content based on assessment state and
   * no-match resolution state.
   *
   * @returns {React.ReactNode} The footer content for the modal.
   */
  function getFooterContent(): React.ReactNode {
    if (assessmentState === 'success') {
      return (
        <Button type="primary" onClick={onClose}>
          Close
        </Button>
      );
    }
    if (noMatchResolution === 'linking' && assessmentState === 'idle') {
      return renderLinkingFooter();
    }
    if (noMatchResolution !== 'idle' && assessmentState === 'loading') {
      return (
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" disabled loading>
            {getLoadingButtonLabel()}
          </Button>
        </>
      );
    }
    if (noMatchResolution !== 'idle') {
      return <Button onClick={onClose}>Cancel</Button>;
    }
    return (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="primary"
          disabled={isStartDisabled}
          loading={assessmentState === 'loading'}
          onClick={handleStartAssessment}
        >
          Start Assessment
        </Button>
      </>
    );
  }

  // While in-modal wizard or recovery content is active the owning footer is
  // suppressed so the content's own footer is the only visible one.
  const footerContent = isWizardContentActive ? null : getFooterContent();

  return (
    <Modal
      key={classId}
      title={`Assess Task — ${className}`}
      open={open}
      onCancel={handleModalCancel}
      footer={footerContent}
      width={modalWidth}
    >
      {isRecoveryActive ? (
        <AssessTaskRecoverySurface
          assignments={assignments}
          capturedStartContext={capturedStartContext}
          definitionKey={recoveryDefinitionKey}
          endRecovery={endRecovery}
          onClose={onClose}
          registerReviewCancel={registerRecoveryReviewCancel}
          settleAssessment={settleAssessment}
        />
      ) : (
        <>
          {renderBody()}
          {isCreateContentActive && (
            <AssessTaskCreateReview
              initialValues={wizardInitialValues}
              onCreateSuccess={handleWizardCreateSuccess}
              onClose={handleWizardClose}
              registerModalCancel={registerCreateWizardCancel}
            />
          )}
        </>
      )}
    </Modal>
  );
}
