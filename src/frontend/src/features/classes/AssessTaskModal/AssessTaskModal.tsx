import { Alert, Button, Empty, Modal, Select, Space, Spin, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

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
 * @remarks The modal body follows a state machine:
 * - **loading**: GC assignments are being fetched (Spin shown).
 * - **ready**: assignments loaded, Select dropdown shown.
 * - **matching**: user clicked Start Assessment; cache-reads, matching, and API call
 *   happen in sequence.
 * - **success**: API call succeeded; success Alert replaces body content; footer
 *   shows single Close button.
 * - **error**: no-match, ambiguous, cache-miss, null data, or API failure; error
 *   Alert shown in body; modal stays open for re-selection or dismissal.
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

  useEffect(() => {
    if (!open) return;

    getGoogleClassroomAssignments(classId)
      .then((data) => {
        setAssignments(data);
        setFetchState('ready');
      })
      .catch((error: unknown) => {
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
      setAssessmentAsError('error', `No matching assignment definition found for '${selectedAssignment.title}'.`);
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

    return renderAssignmentsContent();
  }

  const footerContent =
    assessmentState === 'success' ? (
      <Button type="primary" onClick={onClose}>
        Close
      </Button>
    ) : (
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

  return (
    <Modal
      key={classId}
      title={`Assess Task — ${className}`}
      open={open}
      onCancel={onClose}
      footer={footerContent}
    >
      {renderBody()}
    </Modal>
  );
}
