import { Alert, Button, Empty, Modal, Select, Space, Spin, Tooltip, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { AssignmentDefinitionWizardModal } from '../../assignmentWizard/AssignmentDefinitionWizardModal';
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';

type Assignment = { assignmentId: string; title: string; topicId: string | null; topicName: string | null };

export type AssessTaskModalProperties = Readonly<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}>;

type AssessmentAlertType = 'success' | 'error' | 'warning';

/** Describes a cache-data validation failure during assessment run. */
type CacheValidationError = {
  kind: 'cache-error';
  alertType: AssessmentAlertType;
  message: string;
};

/**
 * Modal for selecting a Google Classroom assignment to assess.
 *
 * Fetches assignments on open and presents a dropdown selection.
 * Start Assessment runs the matching logic and kicks off an assessment run.
 *
 * @remarks The modal uses two orthogonal state machines to determine body and footer content:
 *
 * **`assessmentState`** (`'idle' | 'loading' | 'success' | 'error'`) governs the assessment lifecycle:
 * - **idle**: ready for user interaction (Select shown, Start Assessment enabled).
 * - **loading**: assessment run API call in progress (button shows spinner).
 * - **success**: API call succeeded; success Alert replaces body content; footer
 *   shows single Close button.
 * - **error**: ambiguous, cache-miss, null data, or API failure; error Alert shown
 *   in body; modal stays open for re-selection or dismissal.
 *
 * **`noMatchResolution`** (`'idle' | 'choice' | 'creating'`) governs the no-match resolution workflow:
 * - **idle**: normal flow — no choice prompt shown.
 * - **choice**: `findMatchingDefinition` returned `'no-match'`; body renders an info
 *   Alert with "Create New Definition" and disabled "Link to Existing Definition" buttons.
 * - **creating**: user clicked "Create New Definition"; body is hidden while the
 *   AssignmentDefinitionWizardModal is rendered in create mode. The `creating` state
 *   persists during auto-assessment after the wizard succeeds, keeping the body hidden
 *   to prevent a flash of the assignment Select.
 *
 * @param {Readonly<AssessTaskModalProperties>} properties Modal properties.
 * @returns {JSX.Element} The assess task modal.
 */
export function AssessTaskModal(properties: Readonly<AssessTaskModalProperties>) {
  const { open, classId, className, onClose } = properties;
  const queryClient = useQueryClient();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>();
  const [fetchState, setFetchState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [assessmentState, setAssessmentState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [assessmentError, setAssessmentError] = useState<string | undefined>();
  const [assessmentAlertType, setAssessmentAlertType] = useState<AssessmentAlertType>('error');
  const [noMatchResolution, setNoMatchResolution] = useState<'idle' | 'choice' | 'creating'>('idle');
  const [selectedAssignmentForChoice, setSelectedAssignmentForChoice] = useState<Assignment | null>(null);
  const [hasCreateSucceeded, setHasCreateSucceeded] = useState(false);

  // Read cached data for wizard pre-population
  const assignmentTopics = queryClient.getQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics());
  const classPartialsFromCache = queryClient.getQueryData<ClassPartial[]>(queryKeys.classPartials());
  const classPartialForWizard = classPartialsFromCache?.find((cp) => cp.classId === classId);
  const yearGroupKey = classPartialForWizard?.yearGroupKey;

  /**
   * Derives initial values for the AssignmentDefinitionWizardModal when
   * the user is creating a new definition from a no-match resolution.
   */
  const wizardInitialValues = useMemo((): Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined => {
    if (noMatchResolution !== 'creating') return undefined;
    const selectedAssignment = assignments.find((a) => a.assignmentId === selectedAssignmentId);
    if (!selectedAssignment) return undefined;
    const values: { title?: string; topic?: string; yearGroup?: string } = { title: selectedAssignment.title,};
    if (selectedAssignment.topicId && assignmentTopics?.some((t) => t.key === selectedAssignment.topicId)) {
      values.topic = selectedAssignment.topicId;
    }
    if (yearGroupKey) {
      values.yearGroup = yearGroupKey;
    }
    return values;
  }, [noMatchResolution, selectedAssignmentId, assignments, assignmentTopics, yearGroupKey]);

  useEffect(() => {
    if (!open) return;

    getGoogleClassroomAssignments(classId)
      .then((data) => {
        // Reset both state machines on modal open (SPEC.md transition rule 0)
        setNoMatchResolution('idle');
        setSelectedAssignmentForChoice(null);
        setHasCreateSucceeded(false);
        setAssessmentState('idle');
        setAssessmentError(undefined);
        setSelectedAssignmentId(undefined);
        setAssignments(data);
        setFetchState('ready');
      })
      .catch((error: unknown) => {
        // Reset state machines even on fetch failure
        setNoMatchResolution('idle');
        setSelectedAssignmentForChoice(null);
        setHasCreateSucceeded(false);
        setAssessmentState('idle');
        setAssessmentError(undefined);
        setSelectedAssignmentId(undefined);
        const message = error instanceof Error ? error.message : 'Failed to fetch assignments';
        setErrorMessage(message);
        setFetchState('error');
      });
  }, [open, classId]);

  /**
   * Sets error state with the given alert type and message.
   *
   * @param {AssessmentAlertType} alertType The alert type (success, error, warning).
   * @param {string} message The user-facing error message.
   */
  function setAssessmentAsError(alertType: AssessmentAlertType, message: string): void {
    setAssessmentAlertType(alertType);
    setAssessmentError(message);
    setAssessmentState('error');
  }

  /**
   * Reads class partials and definition partials from the React Query cache,
   * validates them, and returns the matched class partial or a validation error.
   *
   * @returns {object} The class partial or a validation error descriptor.
   */
  function getValidatedCachedData():
  | { kind: 'valid'; classPartial: ClassPartial; definitionPartials: AssignmentDefinitionPartial[] }
  | CacheValidationError {
    const classPartials = queryClient.getQueryData<ClassPartial[]>(queryKeys.classPartials());
    const definitionPartials = queryClient.getQueryData<AssignmentDefinitionPartial[]>(
      queryKeys.assignmentDefinitionPartials()
    );

    if (!classPartials) {
      return { kind: 'cache-error', alertType: 'error', message: 'Failed to load class data. Please refresh and try again.' };
    }
    if (!definitionPartials) {
      return { kind: 'cache-error', alertType: 'error', message: 'Failed to load definition data. Please refresh and try again.' };
    }

    const classPartial = classPartials.find((cp) => cp.classId === classId);
    if (!classPartial) {
      return { kind: 'cache-error', alertType: 'error', message: 'Class not found in cached data. Please refresh and try again.' };
    }
    if (classPartial.yearGroupKey === null) {
      return { kind: 'cache-error', alertType: 'error', message: 'Cannot determine year group for this class.' };
    }

    return { kind: 'valid', classPartial, definitionPartials };
  }

  /**
   * Handles the Start Assessment click: validates selection, reads cache,
   * runs matching, and starts the assessment run via the API.
   */
  async function handleStartAssessment(): Promise<void> {
    if (!selectedAssignmentId || fetchState !== 'ready') return;

    const selectedAssignment = assignments.find(
      (a) => a.assignmentId === selectedAssignmentId
    );
    if (!selectedAssignment) return;

    if (selectedAssignment.topicName === null) {
      setAssessmentAsError('error', 'The selected assignment has no topic. Cannot match to a definition.');
      return;
    }

    setAssessmentState('loading');
    setAssessmentError(undefined);

    try {
      const cached = getValidatedCachedData();
      if (cached.kind === 'cache-error') {
        setAssessmentAsError(cached.alertType, cached.message);
        return;
      }

      const { classPartial, definitionPartials } = cached;

      const matchResult = findMatchingDefinition(selectedAssignment, classPartial, definitionPartials);
      await handleMatchOutcome(matchResult, selectedAssignment);
    } catch (error: unknown) {
      handleApiError(error);
    }
  }

  /**
   * Handles the match result: no-match, ambiguous, or matched (API call).
   *
   * @param {ReturnType<typeof findMatchingDefinition>} matchResult The match result.
   * @param {Assignment} selectedAssignment The selected assignment.
   */
  async function handleMatchOutcome(
    matchResult: ReturnType<typeof findMatchingDefinition>,
    selectedAssignment: Assignment
  ): Promise<void> {
    if (matchResult.kind === 'no-match') {
      setNoMatchResolution('choice');
      setAssessmentState('idle');
      setAssessmentError(undefined);
      setSelectedAssignmentForChoice(selectedAssignment);
      return;
    }

    if (matchResult.kind === 'ambiguous') {
      setAssessmentAsError(
        'error',
        'Multiple definitions match this assignment. Ensure definition titles are unique per topic and year group.'
      );
      return;
    }

    // Matched — call the API
    await startAssessmentRun({
      definitionKey: matchResult.definition.definitionKey,
      assignmentId: selectedAssignment.assignmentId,
      courseId: classId,
    });

    setAssessmentAlertType('success');
    setAssessmentError(`Assessment started for '${selectedAssignment.title}'.`);
    setAssessmentState('success');
  }

  /**
   * Handles errors from the assessment run API call.
   *
   * @param {unknown} error The caught error.
   */
  function handleApiError(error: unknown): void {
    if (error instanceof ApiTransportError && error.code === 'DEFINITION_STALE') {
      setAssessmentAsError('warning', error.message);
    } else if (error instanceof Error) {
      setAssessmentAsError('error', error.message);
    } else {
      setAssessmentAsError('error', 'An unexpected error occurred.');
    }
  }

  /**
   * Transitions to the 'creating' state when the user clicks
   * "Create New Definition" in the choice prompt.
   */
  function handleCreateNewDefinition(): void {
    setNoMatchResolution('creating');
  }

  /**
   * Handles the wizard's onCreateSuccess callback — kicks off the
   * assessment run using the newly created definition key.
   *
   * @remarks
   * Uses `flushSync` to synchronously unmount the wizard before the
   * auto-assessment API call begins. React 18's automatic batching would
   * defer the `assessmentState` update to the next microtask, causing the
   * wizard to remain mounted during the API call. `flushSync` forces
   * the state update to flush synchronously so the wizard unmounts
   * immediately and the body remains hidden per SPEC.md §250.
   *
   * The state transition sequence:
   * 1. `hasCreateSucceeded = true`, `assessmentState = 'loading'` (sync flush)
   * 2. `startAssessmentRun` API call
   * 3a. Success: `noMatchResolution = 'idle'`, `assessmentState = 'success'`
   * 3b. Failure: `noMatchResolution = 'idle'`, `assessmentState = 'error'`
   *
   * @param {string} definitionKey The key of the newly created definition.
   */
  async function handleWizardCreateSuccess(definitionKey: string): Promise<void> {
    // Use flushSync so the wizard is unmounted synchronously before the
    // auto-assessment API call begins (React 18 batching would otherwise
    // defer the unmount to the next microtask).
    flushSync(() => {
      setHasCreateSucceeded(true);
      setAssessmentState('loading');
      setAssessmentError(undefined);
    });

    try {
      const selectedAssignment = assignments.find(
        (a) => a.assignmentId === selectedAssignmentId
      );
      if (!selectedAssignment) return;

      await startAssessmentRun({
        definitionKey,
        assignmentId: selectedAssignment.assignmentId,
        courseId: classId,
      });

      setNoMatchResolution('idle');
      setAssessmentAlertType('success');
      setAssessmentError(`Assessment started for '${selectedAssignment.title}'.`);
      setAssessmentState('success');
    } catch (error: unknown) {
      setNoMatchResolution('idle');
      handleApiError(error);
    }
  }

  /**
   * Handles wizard close — if the wizard closed without onCreateSuccess
   * having fired (i.e., user cancelled), return to the choice state.
   *
   * @remarks
   * Uses the `hasCreateSucceeded` flag to distinguish the two close paths
   * from the wizard per SPEC.md §189:
   * - **Wizard success**: `onCreateSuccess` fires first, setting
   *   `hasCreateSucceeded = true`; when the wizard subsequently unmounts
   *   and `onClose` fires, this handler returns early — the assessment
   *   state machine handles the transition.
   * - **Wizard cancel**: `onClose` fires without `onCreateSuccess` having
   *   been called; `hasCreateSucceeded` is still `false`, so the handler
   *   transitions `noMatchResolution` back to `'choice'`.
   */
  function handleWizardClose(): void {
    if (hasCreateSucceeded) {
      // Wizard closed after success — assessment state handles the transition
      return;
    }
    // Wizard cancelled — return to choice state
    setNoMatchResolution('choice');
  }

  const isStartDisabled =
    fetchState !== 'ready' ||
    selectedAssignmentId === undefined ||
    assessmentState === 'loading';

  /**
   * Renders the dropdown and assignment-selection body content.
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
          placeholder="Select an assignment"
          value={selectedAssignmentId}
          onChange={(value) => {
            setSelectedAssignmentId(value);
          }}
          options={selectOptions}
          style={{ width: '100%' }}
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
   * Determines the body content based on fetch and assessment state.
   *
   * @returns {React.ReactNode} The body content for the modal.
   */
  function renderBody(): React.ReactNode {
    if (fetchState === 'loading') {
      return (
        <output style={{ textAlign: 'center', padding: '40px 0', display: 'block' }}>
          <Spin />
        </output>
      );
    }
    if (fetchState === 'error') {
      return <Alert type="error" title={errorMessage} />;
    }
    if (assignments.length === 0) {
      return <Empty description="No assignments found for this class" />;
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
            <Tooltip title="Coming soon">
              <span>
                <Button disabled>Link to Existing Definition</Button>
              </span>
            </Tooltip>
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
    if (noMatchResolution !== 'idle' && assessmentState === 'loading') {
      return (
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" disabled loading>
            Start Assessment
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
          onClick={() => {
            void handleStartAssessment();
          }}
        >
          Start Assessment
        </Button>
      </>
    );
  }

  const footerContent = getFooterContent();

  return (
    <Modal
      key={classId}
      title={`Assess Task — ${className}`}
      open={open}
      onCancel={onClose}
      footer={footerContent}
    >
      {renderBody()}
      {noMatchResolution === 'creating' && assessmentState === 'idle' && (
        <AssignmentDefinitionWizardModal
          open={true}
          mode="create"
          definitionKey={null}
          initialValues={wizardInitialValues}
          onCreateSuccess={handleWizardCreateSuccess}
          onClose={handleWizardClose}
        />
      )}
    </Modal>
  );
}
