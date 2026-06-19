import { Alert, Button, Empty, Modal, Select, Space, Spin, Tooltip, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { AssignmentDefinitionWizardModal } from '../../assignmentWizard/AssignmentDefinitionWizardModal';
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';
import { LinkableDefinitionList } from './LinkableDefinitionList';
import { getLinkableDefinitionsForModal, type LinkableDefinition } from './getLinkableDefinitionsForModal';
import { caseInsensitiveTrimmedEquals } from './stringComparison';

/** Loading spinner CSS properties used in both fetch and link body phases. */
const LOADING_SPINNER_STYLE: React.CSSProperties = { textAlign: 'center', padding: '40px 0', display: 'block' };

/**
 * Deduplicates and adds a new title to the alternateTitles array using
 * case-insensitive trimmed comparison. Accepts optional input arrays.
 *
 * @param {string[] | undefined} existingAlternateTitles The existing alternate titles.
 * @param {string} newTitle The new title to add.
 * @returns {string[]} The deduplicated union or [newTitle] when existing is undefined.
 */
function buildDeduplicatedAlternateTitles(
  existingAlternateTitles: string[] | undefined,
  newTitle: string
): string[] {
  const existing = existingAlternateTitles ?? [];
  const isAlreadyPresent = existing.some(
    (t) => caseInsensitiveTrimmedEquals(t, newTitle)
  );
  return isAlreadyPresent ? existing : [...existing, newTitle];
}

/**
 * Deduplicates and adds a new topic to the alternateTopics array using
 * case-insensitive trimmed comparison. When newTopic is null, returns the
 * existing array unchanged. Accepts optional input arrays.
 *
 * @param {string[] | undefined} existingAlternateTopics The existing alternate topics.
 * @param {string | null} newTopic The new topic name to add, or null to skip.
 * @returns {string[]} The unchanged existing array or the deduplicated union.
 */
function buildDeduplicatedAlternateTopics(
  existingAlternateTopics: string[] | undefined,
  newTopic: string | null
): string[] {
  const existing = existingAlternateTopics ?? [];
  if (newTopic === null) {
    return existing;
  }
  const isAlreadyPresent = existing.some(
    (t) => caseInsensitiveTrimmedEquals(t, newTopic)
  );
  return isAlreadyPresent ? existing : [...existing, newTopic];
}

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
 * **`noMatchResolution`** (`'idle' | 'choice' | 'creating' | 'linking'`) governs the no-match resolution workflow:
 * - **idle**: normal flow — no choice prompt shown.
 * - **choice**: `findMatchingDefinition` returned `'no-match'`; body renders an info
 *   Alert with "Create New Definition" and "Link to Existing Definition" buttons.
 * - **creating**: user clicked "Create New Definition"; body is hidden while the
 *   AssignmentDefinitionWizardModal is rendered in create mode. The `creating` state
 *   persists during auto-assessment after the wizard succeeds, keeping the body hidden
 *   to prevent a flash of the assignment Select.
 * - **linking**: user clicked "Link to Existing Definition"; body renders the
 *   LinkableDefinitionList picker. The assessmentState machine is reused for the
 *   post-selection upsert + start-assessment-run lifecycle.
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
  const [noMatchResolution, setNoMatchResolution] = useState<'idle' | 'choice' | 'creating' | 'linking'>('idle');
  const [selectedAssignmentForChoice, setSelectedAssignmentForChoice] = useState<Assignment | null>(null);
  const [hasCreateSucceeded, setHasCreateSucceeded] = useState(false);
  const [selectedDefinitionForLink, setSelectedDefinitionForLink] = useState<LinkableDefinition | null>(null);

  // Read cached data for wizard pre-population
  const assignmentTopics = queryClient.getQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics());
  const classPartialsFromCache = queryClient.getQueryData<ClassPartial[]>(queryKeys.classPartials());
  const classPartialForWizard = classPartialsFromCache?.find((cp) => cp.classId === classId);
  const yearGroupKey = classPartialForWizard?.yearGroupKey;

  /**
   * Derives initial values for the AssignmentDefinitionWizardModal when
   * the user is creating a new definition from a no-match resolution or
   * recovering from a DEFINITION_STALE error.
   *
   * @remarks For the stale-recovery path (triggered by the link flow when
   * `startAssessmentRun` rejects with `DEFINITION_STALE`), the initial
   * values are derived from the selected Google Classroom assignment
   * (title, topic, year group). The stale definition's pre-populated data
   * (task weightings, etc.) is handled by the wizard's own re-parse logic,
   * not by this memo — the wizard reads the stale definition from cache
   * when opened in `mode="create"`.
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

  /**
   * Derives the linkable definitions for the picker list from the cached
   * AssignmentDefinitionPartial rows. Returns the filtered, sorted list
   * or an empty array when not in the relevant no-match states.
   */
  const linkableDefinitions = useMemo<LinkableDefinition[]>(() => {
    if (noMatchResolution !== 'linking' && noMatchResolution !== 'choice') return [];
    if (!classPartialForWizard?.yearGroupKey) return [];
    if (!selectedAssignmentForChoice) return [];

    const definitionPartialsFromCache = queryClient.getQueryData<AssignmentDefinitionPartial[]>(
      queryKeys.assignmentDefinitionPartials()
    );

    return getLinkableDefinitionsForModal(
      definitionPartialsFromCache ?? [],
      classPartialForWizard.yearGroupKey,
      selectedAssignmentForChoice
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- queryClient from useQueryClient() is stable per React Query contract
  }, [
    noMatchResolution,
    classPartialForWizard,
    selectedAssignmentForChoice,
  ]);

  useEffect(() => {
    if (!open) return;

    getGoogleClassroomAssignments(classId)
      .then((data) => {
        // Reset both state machines on modal open (SPEC.md transition rule 0)
        setNoMatchResolution('idle');
        setSelectedAssignmentForChoice(null);
        setHasCreateSucceeded(false);
        setSelectedDefinitionForLink(null);
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
        setSelectedDefinitionForLink(null);
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
      // The matcher cannot match (definitions always have topics), but the
      // user can still link to an existing definition or create a new one.
      setNoMatchResolution('choice');
      setAssessmentState('idle');
      setAssessmentError(undefined);
      setSelectedAssignmentForChoice(selectedAssignment);
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
   * Transitions to the 'linking' state when the user clicks
   * "Link to Existing Definition" in the choice prompt.
   */
  function handleLinkExistingDefinition(): void {
    setNoMatchResolution('linking');
  }

  /**
   * Handles errors from the link upsert + assessment run flow.
   *
   * For `DEFINITION_STALE`, transitions to the wizard's 2nd panel preserving
   * the link. Otherwise shows an error alert with appropriate text based on
   * whether the upsert committed.
   *
   * @param {unknown} error The caught error.
   * @param {boolean} linkWasCommitted Whether the upsert completed successfully.
   */
  function handleLinkConfirmError(error: unknown, linkWasCommitted: boolean): void {
    // Invalidate cache on any failure (SPEC Decision 10)
    queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });

    if (error instanceof ApiTransportError && error.code === 'DEFINITION_STALE') {
      // Preserve the link, transition to wizard stale-recovery
      setNoMatchResolution('creating');
      setAssessmentState('idle');
      setAssessmentError(undefined);
      return;
    }
    if (linkWasCommitted) {
      setAssessmentAsError('error', `Link was committed but assessment could not be started: ${error instanceof Error ? error.message : 'Unknown error'}.`);
      return;
    }
    setAssessmentAsError('error', error instanceof Error ? error.message : 'An unexpected error occurred.');
  }

  /**
   * Handles the Link button click in the picker: upserts the definition
   * with the alternate title and topic, then starts the assessment run.
   *
   * @remarks
   * The deduplication strategy for the new `alternateTitles` and
   * `alternateTopics` uses case-insensitive trimmed equality via
   * `caseInsensitiveTrimmedEquals`. The full array is always sent (never `[]`,
   * even when the topic name is null — the existing array is sent unchanged).
   *
   * Cache invalidation (`queryKeys.assignmentDefinitionPartials()`) is
   * fire-and-forget after the upsert resolves, and also on any failure path
   * to defend against stale cache entries.
   *
   * `DEFINITION_STALE` recovery: when `startAssessmentRun` rejects with
   * `DEFINITION_STALE`, the link (the alternateTitle write) is preserved
   * and the modal transitions to the wizard's 2nd panel via
   * `noMatchResolution === 'creating'`.
   */
  async function handleLinkConfirm(): Promise<void> {
    if (!selectedDefinitionForLink || !selectedAssignmentForChoice) return;

    setAssessmentState('loading');
    setAssessmentError(undefined);

    // Use a local variable (not state) to track whether the upsert committed.
    // This is equivalent to the SPEC's `hasLinkSucceeded` flag but avoids an
    // extra state update — React state cannot be read synchronously in the
    // same async closure, and the link flow does not need `flushSync` (per
    // SPEC Decision 11).
    let linkWasCommitted = false;

    try {
      const alternateTitles = buildDeduplicatedAlternateTitles(
        selectedDefinitionForLink.alternateTitles,
        selectedAssignmentForChoice.title
      );

      const alternateTopics = buildDeduplicatedAlternateTopics(
        selectedDefinitionForLink.alternateTopics,
        selectedAssignmentForChoice.topicName
      );

      const cached = getValidatedCachedData();
      if (cached.kind === 'cache-error') {
        setAssessmentAsError(cached.alertType, cached.message);
        return;
      }

      // Read primaryTopicKey from the cached partial (LinkableDefinition
      // carries primaryTopic label but not the key)
      const cachedPartial = cached.definitionPartials.find(
        (p) => p.definitionKey === selectedDefinitionForLink.definitionKey
      );

      if (!cachedPartial) {
        setAssessmentState('idle');
        setAssessmentAsError('error', 'Selected definition not found in cache. Please try again.');
        return;
      }

      const upsertPayload = {
        definitionKey: selectedDefinitionForLink.definitionKey,
        primaryTitle: selectedDefinitionForLink.primaryTitle,
        primaryTopicKey: cachedPartial.primaryTopicKey,
        yearGroupKey: selectedDefinitionForLink.yearGroupKey,
        referenceDocumentId: selectedDefinitionForLink.referenceDocumentId,
        templateDocumentId: selectedDefinitionForLink.templateDocumentId,
        documentType: selectedDefinitionForLink.documentType,
        alternateTitles,
        alternateTopics,
      };

      await upsertAssignmentDefinition(upsertPayload);

      // Fire-and-forget cache invalidation after successful upsert
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });

      // Mark the link as committed (local variable)
      linkWasCommitted = true;

      // Start the assessment run
      await startAssessmentRun({
        definitionKey: selectedDefinitionForLink.definitionKey,
        assignmentId: selectedAssignmentForChoice.assignmentId,
        courseId: classId,
      });

      // Success — reset selection slot per SPEC state-reset rule
      setSelectedDefinitionForLink(null);
      setNoMatchResolution('idle');
      setAssessmentAlertType('success');
      setAssessmentError(`Assessment started for '${selectedAssignmentForChoice.title}'.`);
      setAssessmentState('success');
    } catch (error: unknown) {
      handleLinkConfirmError(error, linkWasCommitted);
    }
  }

  /**
   * Handles the Cancel button click in the picker — returns to the choice prompt.
   */
  function handleLinkCancel(): void {
    setNoMatchResolution('choice');
    setSelectedDefinitionForLink(null);
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
      if (!selectedAssignment) {
        setNoMatchResolution('idle');
        setAssessmentAsError('error', 'Selected assignment not found. Please try again.');
        return;
      }

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
    const assessmentAlert =
      assessmentState === 'success' || (assessmentState === 'error' && assessmentError) ? (
        <Alert type={assessmentAlertType} showIcon title={assessmentError} style={{ marginBottom: 16 }} />
      ) : null;

    if (assessmentState === 'success') {
      return (
        <Space vertical style={{ width: '100%' }}>
          {assessmentAlert}
        </Space>
      );
    }

    const selectOptions = assignments.map((assignment) => ({
      value: assignment.assignmentId,
      label: assignment.title,
    }));

    return (
      <Space vertical style={{ width: '100%' }}>
        {assessmentAlert}
        <Typography.Text>Select assignment</Typography.Text>
        <Select
          data-testid="assignment-select"
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Select an assignment"
          value={selectedAssignmentId}
          onChange={(value) => {
            setSelectedAssignmentId(value);
          }}
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
   * Determines the loading button label for the footer during assessment loading.
   *
   * @remarks Per the layout spec, the loading-state button label is "Link"
   * (matching the action the user initiated) not "Start Assessment" (which
   * is the matched-path label and would be misleading for the link flow).
   *
   * @returns {string} 'Link' when in the linking flow, 'Start Assessment' otherwise.
   */
  function getLoadingButtonLabel(): string {
    return noMatchResolution === 'linking' ? 'Link' : 'Start Assessment';
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
   * `assessmentState` sub-states: 'loading' (Spin), 'success' (Alert),
   * 'error' (Alert), and 'idle' (LinkableDefinitionList picker). The loading
   * and error states mirror the patterns used by the main assessment flow.
   *
   * @returns {React.ReactNode} The linking body content.
   */
  function renderLinkingBody(): React.ReactNode {
    if (assessmentState === 'loading') {
      return (
        <output style={LOADING_SPINNER_STYLE}>
          <Spin />
        </output>
      );
    }

    // On success, only show the Alert — no picker. Mirrors the renderAssignmentsContent()
    // early-return for the matched/wizard success paths (see Issue #260).
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
          onSelect={(definitionKey) => {
            const selected = linkableDefinitions.find(
              (d) => d.definitionKey === definitionKey
            );
            setSelectedDefinitionForLink(selected ?? null);
          }}
        />
      </Space>
    );
  }

  /**
   * Renders the loading, error, or empty body content for the fetch phase.
   *
   * @returns {React.ReactNode} The fetch-phase body, or null if no match.
   */
  function renderFetchBody(): React.ReactNode {
    if (fetchState === 'loading') {
      return (
        <output style={LOADING_SPINNER_STYLE}>
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
        onClick={() => { void handleLinkConfirm(); }}
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
