import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { mapErrorToUserMessage } from '../../../errors/map-error-to-ui';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { LinkableDefinition } from './getLinkableDefinitionsForModal';
import {
  buildDeduplicatedAlternateTitles,
  buildDeduplicatedAlternateTopics,
} from './assessTaskLinkPayload';
import {
  deriveLinkableDefinitions,
  getValidatedCachedData,
  type AssessTaskAssignment,
  type AssessmentAlertType,
  type AssessmentState,
  type CapturedStartContext,
  type NoMatchResolution,
  type StartAttempt,
} from './assessTaskFlowData';

/**
 * Shared flow controls owned by `useAssessTaskFlow` and consumed by the link
 * flow. Passed as a single documented host contract so the link state machine
 * stays in its own module without duplicating the assessment state machine.
 */
export type AssessTaskLinkHost = {
  classId: string;
  noMatchResolution: NoMatchResolution;
  selectedAssignmentForChoice: AssessTaskAssignment | null;
  sessionReference: { current: number };
  selectedAssignmentIdReference: { current: string | undefined };
  setAssessmentState: Dispatch<SetStateAction<AssessmentState>>;
  setAssessmentError: Dispatch<SetStateAction<string | undefined>>;
  setAssessmentAlertType: Dispatch<SetStateAction<AssessmentAlertType>>;
  setNoMatchResolution: Dispatch<SetStateAction<NoMatchResolution>>;
  setAssessmentAsError: (alertType: AssessmentAlertType, message: string) => void;
  captureStartContext: (context: CapturedStartContext) => void;
  getPendingStartContext: () => CapturedStartContext | null;
  isAttemptObsolete: (attempt: StartAttempt) => boolean;
  transitionToStaleRecovery: (definitionKey: string) => void;
};

/**
 * Owns the link-to-existing-definition flow: the picker selection, the
 * linkable-definitions derivation, and the upsert + assessment-run sequence.
 *
 * @remarks Extracted from the assessment orchestration hook so that hook stays
 * below the 500-line gate. The assessment lifecycle states themselves
 * (`assessmentState`, `noMatchResolution`) remain owned by
 * `useAssessTaskFlow` and are driven through the host contract — this module
 * never duplicates them.
 *
 * @param {AssessTaskLinkHost} host The shared flow controls owned by `useAssessTaskFlow`.
 * @returns {object} The link state and handlers consumed by `AssessTaskModal` via the orchestration hook.
 */
export function useAssessTaskLinkFlow(host: AssessTaskLinkHost) {
  const {
    classId,
    noMatchResolution,
    selectedAssignmentForChoice,
    sessionReference,
    selectedAssignmentIdReference,
    setAssessmentState,
    setAssessmentError,
    setAssessmentAlertType,
    setNoMatchResolution,
    setAssessmentAsError,
    captureStartContext,
    getPendingStartContext,
    isAttemptObsolete,
    transitionToStaleRecovery,
  } = host;
  const queryClient = useQueryClient();

  const [selectedDefinitionForLink, setSelectedDefinitionForLink] =
    useState<LinkableDefinition | null>(null);

  const classPartialsFromCache = queryClient.getQueryData<ClassPartial[]>(
    queryKeys.classPartials()
  );
  const yearGroupKey = classPartialsFromCache?.find((cp) => cp.classId === classId)?.yearGroupKey;

  const { data: definitionPartialsFromCache } = useQuery<AssignmentDefinitionPartial[]>({
    queryKey: queryKeys.assignmentDefinitionPartials(),
    queryFn: skipToken,
  });

  const linkableDefinitions = useMemo(
    () =>
      deriveLinkableDefinitions({
        noMatchResolution,
        yearGroupKey,
        selectedAssignmentForChoice,
        definitionPartials: definitionPartialsFromCache ?? [],
      }),
    [noMatchResolution, yearGroupKey, selectedAssignmentForChoice, definitionPartialsFromCache]
  );

  /**
   * Resets the link selection slot when the modal reopens. Stable across
   * renders so the owning flow can depend on it in its fetch effect.
   *
   * @returns {void}
   */
  const resetLinkSelection = useCallback((): void => {
    setSelectedDefinitionForLink(null);
  }, []);

  /**
   * Transitions to the 'linking' state when the user clicks
   * "Link to Existing Definition" in the choice prompt.
   *
   * @returns {void}
   */
  function handleLinkExistingDefinition(): void {
    setNoMatchResolution('linking');
  }

  /**
   * Routes a link-flow `DEFINITION_STALE` rejection to stale-recovery routing,
   * preserving the committed link. Returns false when the error is not a
   * stale rejection (or no start context was captured), so the caller falls
   * through to the standard failure treatment.
   *
   * @param {unknown} error The caught error.
   * @returns {boolean} True when the error was routed to stale recovery.
   */
  function routeLinkStaleRecovery(error: unknown): boolean {
    if (!(error instanceof ApiTransportError) || error.code !== 'DEFINITION_STALE') return false;
    const pendingDefinitionKey = getPendingStartContext()?.definitionKey;
    if (pendingDefinitionKey === undefined) return false;
    // Preserve the link, transition to stale-recovery routing
    transitionToStaleRecovery(pendingDefinitionKey);
    return true;
  }

  /**
   * Handles errors from the link upsert + assessment run flow.
   *
   * For `DEFINITION_STALE`, transitions to stale-recovery routing preserving
   * the committed link. Otherwise shows an error alert with appropriate text based on
   * whether the upsert committed.
   *
   * @param {unknown} error The caught error.
   * @param {boolean} linkWasCommitted Whether the upsert completed successfully.
   * @returns {void}
   */
  function handleLinkConfirmError(error: unknown, linkWasCommitted: boolean): void {
    if (routeLinkStaleRecovery(error)) return;

    // Invalidate cache on any failure (SPEC Decision 10)
    queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
    if (linkWasCommitted) {
      setAssessmentAsError(
        'error',
        `Link was committed but assessment could not be started: ${mapErrorToUserMessage(error)}`
      );
      return;
    }
    setAssessmentAsError('error', mapErrorToUserMessage(error));
  }

  /**
   * Resolves the cached definition partial for the selected linkable definition.
   * Sets error state and returns `undefined` when the cache or the partial is
   * unavailable so the caller can return early.
   *
   * @returns {AssignmentDefinitionPartial | undefined} The matching definition
   *          partial, or `undefined` when the cache encounters an error or the
   *          partial is not found.
   */
  function resolveCachedDefinitionPartialForLink(): AssignmentDefinitionPartial | undefined {
    const cached = getValidatedCachedData(queryClient, classId);
    if (cached.kind === 'cache-error') {
      setAssessmentAsError(cached.alertType, cached.message);
      return undefined;
    }

    // Read primaryTopicKey from the cached partial (LinkableDefinition
    // carries primaryTopic label but not the key)
    const partial = cached.definitionPartials.find(
      (p) => p.definitionKey === selectedDefinitionForLink!.definitionKey
    );

    if (!partial) {
      setAssessmentState('idle');
      setAssessmentAsError('error', 'Selected definition not found in cache. Please try again.');
      return undefined;
    }

    return partial;
  }

  /**
   * Completes a link-flow assessment run that was not obsolete by resetting
   * the selection slot and reporting success. Obsolete completions are
   * ignored so a reopened session is never mutated.
   *
   * @param {StartAttempt} attempt The session and assignment captured when the attempt began.
   * @param {string} assignmentTitle The linked assignment title for the success message.
   * @returns {void}
   */
  function completeLinkConfirmSuccess(attempt: StartAttempt, assignmentTitle: string): void {
    if (isAttemptObsolete(attempt)) return;

    // Success — reset selection slot per SPEC state-reset rule
    setSelectedDefinitionForLink(null);
    setNoMatchResolution('idle');
    setAssessmentAlertType('success');
    setAssessmentError(`Assessment started for '${assignmentTitle}'.`);
    setAssessmentState('success');
  }

  /**
   * Handles the Link button click in the picker — upserts the definition
   * partial, then starts the assessment run.
   *
   * @remarks
   * On `DEFINITION_STALE` rejection from `startAssessmentRun`, the link
   * (the alternateTitle write) is preserved and the flow transitions to
   * stale-recovery routing. An obsolete completion (modal closed/reopened or
   * selection changed mid-flight) is ignored.
   *
   * @returns {Promise<void>}
   */
  async function handleLinkConfirm(): Promise<void> {
    if (!selectedDefinitionForLink || !selectedAssignmentForChoice) return;

    // Read the attempt identity from the same ref the obsolete guard
    // compares against, so the guard source is uniform across all flows.
    // The ref stays in lock-step with selection state (both writers update
    // them together), the assignment Select is unmounted while choice or
    // linking renders, and this call site runs after the ref sync, so
    // behaviour is unchanged.
    const attemptAssignmentId = selectedAssignmentIdReference.current;
    if (attemptAssignmentId === undefined) return;

    setAssessmentState('loading');
    setAssessmentError(undefined);

    const attempt: StartAttempt = {
      session: sessionReference.current,
      assignmentId: attemptAssignmentId,
    };

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

      const cachedPartial = resolveCachedDefinitionPartialForLink();

      if (!cachedPartial) {
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

      // Capture the start context, then start the assessment run. Both read
      // the attempt identity (itself captured from
      // `selectedAssignmentIdReference`) so the captured context matches
      // the obsolete-guard comparison source.
      captureStartContext({
        definitionKey: selectedDefinitionForLink.definitionKey,
        assignmentId: attempt.assignmentId,
        courseId: classId,
      });

      await startAssessmentRun({
        definitionKey: selectedDefinitionForLink.definitionKey,
        assignmentId: attempt.assignmentId,
        courseId: classId,
      });

      completeLinkConfirmSuccess(attempt, selectedAssignmentForChoice.title);
    } catch (error: unknown) {
      if (isAttemptObsolete(attempt)) return;
      handleLinkConfirmError(error, linkWasCommitted);
    }
  }

  /**
   * Handles the Cancel button click in the picker — returns to the choice prompt.
   *
   * @returns {void}
   */
  function handleLinkCancel(): void {
    setNoMatchResolution('choice');
    setSelectedDefinitionForLink(null);
  }

  /**
   * Handles selection of a linkable definition row in the picker.
   *
   * @param {string} definitionKey The selected definition key.
   * @returns {void}
   */
  function handleLinkSelect(definitionKey: string): void {
    const selected = linkableDefinitions.find((d) => d.definitionKey === definitionKey);
    setSelectedDefinitionForLink(selected ?? null);
  }

  return {
    selectedDefinitionForLink,
    linkableDefinitions,
    resetLinkSelection,
    handleLinkExistingDefinition,
    handleLinkConfirm,
    handleLinkCancel,
    handleLinkSelect,
  };
}
