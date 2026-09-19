import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useStartupWarmupState } from '../auth/startupWarmupState';
import { getAssignmentDefinitionQueryOptions } from '../../query/sharedQueries';
import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionRequest,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import { useWizardUpsertMutation, deriveWizardBlockingError } from './assignmentWizardMutation';

/**
 * Pinned wizard entry-mode taxonomy for the orchestrator.
 */
export type WizardEntryMode = 'create' | 'update' | 'explicit-reparse' | 'recovery';

/**
 * Pinned wizard entry intent.
 *
 * @remarks
 * Recovery carries an existing `definitionKey` plus an approval-success callback
 * and must never masquerade as create. `definitionKey` is nullable only so the
 * fail-fast guard can be exercised; `resolveWizardEntryMode` rejects a null key.
 */
export type WizardEntryIntent =
  | { kind: 'create' }
  | { kind: 'update'; definitionKey: string }
  | { kind: 'explicit-reparse'; definitionKey: string }
  | {
      kind: 'recovery';
      definitionKey: string | null;
      onApprovalSuccess: (definitionKey: string) => void;
    };

/**
 * Properties for the assignment wizard orchestrator hook.
 */
export type AssignmentWizardOrchestratorProperties = Readonly<{
  intent: WizardEntryIntent;
  onClose: () => void;
}>;

/**
 * Return contract for the assignment wizard orchestrator hook.
 */
export type AssignmentWizardOrchestratorReturn = Readonly<{
  entryMode: WizardEntryMode;
  blockingError: string | null;
  hasParsedTasks: boolean;
  isMutationBusy: boolean;
  reparseDefinition: () => Promise<void>;
  saveApproval: () => Promise<void>;
  cancelReview: () => void;
}>;

/**
 * Resolves the wizard entry mode for the given intent.
 *
 * @remarks
 * Recovery requires an existing definition key; a null or absent key throws
 * fail-fast rather than silently falling back to the create flow.
 *
 * @param {WizardEntryIntent} intent - The wizard entry intent.
 * @returns {WizardEntryMode} The resolved entry mode.
 */
export function resolveWizardEntryMode(intent: WizardEntryIntent): WizardEntryMode {
  if (intent.kind === 'recovery') {
    if (!intent.definitionKey) {
      throw new Error('Recovery entry requires an existing definitionKey.');
    }
    return 'recovery';
  }
  return intent.kind;
}

/**
 * Returns the existing definition key carried by an intent, or null for create.
 *
 * @param {WizardEntryIntent} intent - The wizard entry intent.
 * @returns {string | null} The existing definition key, or null.
 */
function resolveIntentDefinitionKey(intent: WizardEntryIntent): string | null {
  return intent.kind === 'create' ? null : intent.definitionKey;
}

/**
 * Builds the ID-shaped request fields shared by reparse and approval-save requests.
 *
 * @param {AssignmentDefinition} definition - The loaded definition.
 * @returns {object} The ID-shape transport fields.
 */
function buildIdShapeFields(definition: AssignmentDefinition): {
  referenceDocumentId: string;
  templateDocumentId: string;
  documentType: 'SLIDES' | 'SHEETS';
} {
  return {
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    documentType: definition.documentType,
  };
}

/**
 * Builds the explicit reparse request for an existing definition.
 *
 * @remarks
 * Shared by the orchestrator's recovery/explicit-reparse flow and the
 * Assignments-page update wizard's Reparse documents action, so both force the
 * same ID-shaped payload without a weighting patch.
 *
 * @param {AssignmentDefinition} definition - The loaded definition.
 * @returns {UpsertAssignmentDefinitionRequest} The forced-reparse request (no weighting patch).
 */
export function buildReparseRequest(
  definition: AssignmentDefinition
): UpsertAssignmentDefinitionRequest {
  return {
    definitionKey: definition.definitionKey,
    primaryTitle: definition.primaryTitle,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    ...buildIdShapeFields(definition),
    forceReparse: true,
  };
}

/**
 * Builds the approval-save request from the reviewed definition and baseline.
 *
 * @param {AssignmentDefinition} definition - The reviewed definition.
 * @returns {UpsertAssignmentDefinitionRequest} The approval-save request.
 */
function buildApprovalSaveRequest(
  definition: AssignmentDefinition
): UpsertAssignmentDefinitionRequest {
  const request: UpsertAssignmentDefinitionRequest = {
    definitionKey: definition.definitionKey,
    primaryTitle: definition.primaryTitle,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    ...buildIdShapeFields(definition),
    assignmentWeighting: definition.assignmentWeighting,
    taskWeightings: definition.tasks.map((task) => ({
      taskId: task.taskId,
      taskWeighting: task.taskWeighting,
    })),
  };
  if (definition.updatedAt) {
    request.expectedDefinitionUpdatedAt = definition.updatedAt;
  }
  return request;
}

/**
 * Owns the assignment wizard process for the create, update, explicit-reparse and
 * recovery entry modes: definition loading, the parse → review → save sequence,
 * mutation calls, error mapping and stage transitions.
 *
 * @remarks
 * Entry-mode taxonomy:
 * - `create` — no existing definition; the caller owns stage-one URL entry.
 * - `update` — an existing definition key is loaded for the Assignments-page edit flow.
 * - `explicit-reparse` — a user-triggered reparse of an unchanged existing definition.
 * - `recovery` — a stale-definition recovery of an existing definition, carrying an
 *   approval-success callback. Recovery never uses `mode="create"`.
 *
 * Stale-protection flow: the reviewed definition's `updatedAt` is captured as the
 * baseline. Reparses send `forceReparse: true` with the existing key and omit
 * weighting patches; approval saves resend `expectedDefinitionUpdatedAt` so the
 * backend can reject a concurrent change with `DEFINITION_STALE`. Only a successful
 * parse/persist opens stage two, and a reparse persists immediately — cancelling
 * review discards local review state only and never starts an assessment.
 *
 * @param {AssignmentWizardOrchestratorProperties} properties - Entry intent and close handler.
 * @returns {AssignmentWizardOrchestratorReturn} Entry mode, blocking error, review stage and mutation actions.
 */
export function useAssignmentWizardOrchestrator(
  properties: AssignmentWizardOrchestratorProperties
): AssignmentWizardOrchestratorReturn {
  const { intent, onClose } = properties;
  const entryMode = resolveWizardEntryMode(intent);
  const queryClient = useQueryClient();
  const startupWarmupState = useStartupWarmupState();
  const definitionKey = resolveIntentDefinitionKey(intent);
  const { runUpsert, isMutationBusy } = useWizardUpsertMutation();

  const [hasParsedTasks, setHasParsedTasks] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [reparsedDefinition, setReparsedDefinition] = useState<AssignmentDefinition | null>(null);

  const definitionQuery = useQuery({
    ...getAssignmentDefinitionQueryOptions(definitionKey ?? ''),
    enabled:
      entryMode !== 'create' &&
      definitionKey !== null &&
      startupWarmupState.isDatasetReady('assignmentDefinitionPartials'),
  });

  // The reviewed baseline is the reparsed definition when a reparse has run,
  // otherwise the originally loaded definition.
  const reviewBaseline = reparsedDefinition ?? definitionQuery.data ?? null;

  const blockingError = deriveWizardBlockingError(
    definitionQuery.isError,
    definitionQuery.error,
    mutationError
  );

  // State setters are listed in the manual-memoization dependency arrays because the
  // React Compiler infers them as dependencies (react-hooks/preserve-manual-memoization).
  const reparseDefinition = useCallback(async (): Promise<void> => {
    if (definitionKey === null || isMutationBusy) {
      return;
    }
    const loadedDefinition = await queryClient.fetchQuery(
      getAssignmentDefinitionQueryOptions(definitionKey)
    );
    const request = buildReparseRequest(loadedDefinition);
    const result = await runUpsert(request, {
      contextName: 'assignmentWizardOrchestrator.reparseDefinition',
      errorContext: {
        mode: 'update',
        definitionKey,
        actionType: 'reparse',
        requestPayload: request,
      },
    });
    if (result.errorMessage !== null) {
      setMutationError(result.errorMessage);
      return;
    }
    if (result.response) {
      setReparsedDefinition(result.response);
    }
    setMutationError(null);
    setHasParsedTasks(true);
  }, [
    definitionKey,
    isMutationBusy,
    queryClient,
    runUpsert,
    setMutationError,
    setReparsedDefinition,
    setHasParsedTasks,
  ]);

  const saveApproval = useCallback(async (): Promise<void> => {
    if (isMutationBusy) {
      return;
    }
    if (definitionKey === null || reviewBaseline === null) {
      onClose();
      return;
    }
    const request = buildApprovalSaveRequest(reviewBaseline);
    const result = await runUpsert(request, {
      contextName: 'assignmentWizardOrchestrator.saveApproval',
      errorContext: {
        mode: 'update',
        definitionKey,
        actionType: 'save',
        requestPayload: request,
      },
    });
    if (result.errorMessage !== null) {
      setMutationError(result.errorMessage);
      return;
    }
    setMutationError(null);
    if (intent.kind === 'recovery') {
      intent.onApprovalSuccess(definitionKey);
    } else {
      onClose();
    }
  }, [isMutationBusy, definitionKey, reviewBaseline, runUpsert, intent, onClose, setMutationError]);

  const cancelReview = useCallback((): void => {
    setHasParsedTasks(false);
  }, [setHasParsedTasks]);

  return {
    entryMode,
    blockingError,
    hasParsedTasks,
    isMutationBusy,
    reparseDefinition,
    saveApproval,
    cancelReview,
  };
}
