import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormInstance } from 'antd';
import { useCallback, useState } from 'react';
import {
  extractErrorCode,
  extractRequestId,
  mapErrorToUserMessage,
} from '../../errors/map-error-to-ui';
import { logFrontendError } from '../../logging/frontendLogger';
import { queryKeys } from '../../query/queryKeys';
import {
  upsertAssignmentDefinition,
  type UpsertAssignmentDefinitionRequest,
  type UpsertAssignmentDefinitionResponse,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import {
  buildDocumentUrlsFromDefinition,
  buildTaskRowsFromResponse,
  type DocumentChangeState,
  type TaskRow,
} from './assignmentWizardFormState';

/**
 * Type of wizard mutation action.
 */
export type WizardActionType = 'parse' | 'save' | 'reparse';

/**
 * Structured log context attached to a wizard mutation failure.
 */
export interface WizardMutationErrorContext {
  mode: 'create' | 'update';
  definitionKey: string | null;
  actionType: WizardActionType;
  requestPayload: UpsertAssignmentDefinitionRequest;
}

/**
 * Result of a single wizard upsert attempt.
 */
export interface WizardUpsertResult {
  response?: UpsertAssignmentDefinitionResponse;
  errorMessage: string | null;
}

/**
 * Logs a wizard mutation failure with correlation identifiers and maps it to
 * user-safe copy through the shared error registry.
 *
 * @param {string} contextName - Logger context name.
 * @param {unknown} error - The caught mutation error.
 * @param {WizardMutationErrorContext} context - Structured wizard mutation context.
 * @returns {string} The registry-mapped user-safe message.
 */
export function logAndMapWizardMutationError(
  contextName: string,
  error: unknown,
  context: WizardMutationErrorContext
): string {
  logFrontendError(contextName, error, {
    mode: context.mode,
    definitionKey: context.definitionKey,
    actionType: context.actionType,
    requestId: extractRequestId(error) ?? undefined,
    errorCode: extractErrorCode(error) ?? undefined,
    requestPayload: context.requestPayload,
    stack: error instanceof Error ? error.stack : undefined,
  });
  return mapErrorToUserMessage(error);
}

/**
 * Derives the effective blocking error, preferring a failed assignment definition
 * query error and falling back to any submit-time error.
 *
 * The query-derived error reflects the definition query's last known failure. The
 * query retains that error state even when disabled (whilst the modal is closed),
 * so the derived value can remain non-null until the next successful fetch. This
 * matches the prior effect-based behaviour and is surfaced only when the wizard
 * renders the blocking alert.
 *
 * @param {boolean} isQueryError Whether the query errored.
 * @param {unknown} queryError The query error, if any.
 * @param {string | null} submitError Error captured from a failed submission.
 * @returns {string | null} A user-safe message, or null when there is no error.
 */
export function deriveWizardBlockingError(
  isQueryError: boolean,
  queryError: unknown,
  submitError: string | null
): string | null {
  if (isQueryError && queryError) {
    return mapErrorToUserMessage(queryError);
  }
  return submitError;
}

/**
 * Updates form fields with response data after parse/re-parse to reflect persisted state.
 * For parse: updates all metadata fields to reflect persisted state (including the
 * server-defaulted assignmentWeighting in create mode). For reparse: updates document
 * URLs while preserving other metadata.
 *
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {UpsertAssignmentDefinitionResponse} response - The mutation response.
 * @param {string} referenceUrl - Canonical reference document URL.
 * @param {string} templateUrl - Canonical template document URL.
 * @param {'parse' | 'reparse'} actionType - The type of action that produced the response.
 * @returns {void}
 */
export function applyParseResponseToForm(
  form: FormInstance,
  response: UpsertAssignmentDefinitionResponse,
  referenceUrl: string,
  templateUrl: string,
  actionType: 'parse' | 'reparse'
): void {
  if (actionType === 'parse') {
    form.setFieldsValue({
      title: response.primaryTitle,
      topic: response.primaryTopicKey,
      yearGroup: response.yearGroupKey,
      referenceDocumentUrl: referenceUrl,
      templateDocumentUrl: templateUrl,
      assignmentWeighting: response.assignmentWeighting,
    });
  } else {
    // Reparse: only update document URLs
    form.setFieldsValue({
      referenceDocumentUrl: referenceUrl,
      templateDocumentUrl: templateUrl,
    });
  }
}

/**
 * Wraps the assignment-definition upsert mutation with the shared busy flag and
 * registry-driven error mapping, so both the wizard hook and the recovery
 * orchestrator surface identical failure treatment without duplicating the
 * logging/error-mapping skeleton.
 *
 * @returns {object} The upsert runner and its busy flag.
 */
export function useWizardUpsertMutation(): {
  runUpsert: (
    request: UpsertAssignmentDefinitionRequest,
    context: { contextName: string; errorContext: WizardMutationErrorContext }
  ) => Promise<WizardUpsertResult>;
  isMutationBusy: boolean;
} {
  const upsertMutation = useMutation({
    mutationFn: upsertAssignmentDefinition,
  });
  const [isMutationBusy, setIsMutationBusy] = useState(false);

  const runUpsert = useCallback(
    async (
      request: UpsertAssignmentDefinitionRequest,
      context: { contextName: string; errorContext: WizardMutationErrorContext }
    ): Promise<WizardUpsertResult> => {
      setIsMutationBusy(true);
      try {
        const response = await upsertMutation.mutateAsync(request);
        return { response, errorMessage: null };
      } catch (caughtError) {
        return {
          response: undefined,
          errorMessage: logAndMapWizardMutationError(
            context.contextName,
            caughtError,
            context.errorContext
          ),
        };
      } finally {
        setIsMutationBusy(false);
      }
    },
    [upsertMutation]
  );

  return { runUpsert, isMutationBusy };
}

/**
 * Options for the wizard mutation sequence hook.
 */
export interface WizardMutationSequenceOptions {
  mode: 'create' | 'update';
  form: FormInstance;
  taskRows: TaskRow[];
  localDefinitionKey: string | null;
  onClose: () => void;
  onCreateSuccess?: (definitionKey: string) => void;
  storeParseBaseline: (response: UpsertAssignmentDefinitionResponse) => void;
  setTaskRows: (rows: TaskRow[]) => void;
  setHasParsedTasks: (value: boolean) => void;
  setDocumentChange: (state: DocumentChangeState) => void;
  setLocalDefinitionKey: (key: string | null) => void;
  setHasDirtyEdits: (value: boolean) => void;
  setSubmitBlockingError: (error: string | null) => void;
}

const WIZARD_MUTATION_LOG_CONTEXT = 'AssignmentDefinitionWizardModal.runWizardMutation';

/**
 * Owns the create/update wizard mutation sequence: response handling, query
 * invalidation, post-mutation transitions and error mapping. Extracted from
 * `useAssignmentDefinitionWizard` so the hook stays a thin composition over the
 * form-state module, this sequence module and the wizard orchestrator.
 *
 * @param {WizardMutationSequenceOptions} options - State values and setters the sequence drives.
 * @returns {{ isSubmitting: boolean; runWizardMutation: (options: object) => Promise<UpsertAssignmentDefinitionResponse | undefined> }} Sequence state and runner.
 */
export function useWizardMutationSequence(options: WizardMutationSequenceOptions): {
  isSubmitting: boolean;
  runWizardMutation: (mutationOptions: {
    actionType: WizardActionType;
    request: UpsertAssignmentDefinitionRequest;
    definitionKey: string | null;
  }) => Promise<UpsertAssignmentDefinitionResponse | undefined>;
} {
  const {
    mode,
    form,
    taskRows,
    localDefinitionKey,
    onClose,
    onCreateSuccess,
    storeParseBaseline,
    setTaskRows,
    setHasParsedTasks,
    setDocumentChange,
    setLocalDefinitionKey,
    setHasDirtyEdits,
    setSubmitBlockingError,
  } = options;
  const queryClient = useQueryClient();
  const { runUpsert, isMutationBusy } = useWizardUpsertMutation();

  /**
   * Handles the response from a parse or re-parse mutation by updating task rows and document state.
   *
   * @param {UpsertAssignmentDefinitionResponse} response - The mutation response containing tasks and document info.
   * @param {'parse' | 'reparse'} actionType - The type of action that produced the response.
   * @returns {void}
   */
  const handleParseResponse = useCallback(
    (response: UpsertAssignmentDefinitionResponse, actionType: 'parse' | 'reparse') => {
      const documentUrls = buildDocumentUrlsFromDefinition(response);
      if (!documentUrls) {
        return;
      }
      const referenceUrl = documentUrls.referenceUrl;
      const templateUrl = documentUrls.templateUrl;
      const newTaskRows = buildTaskRowsFromResponse(response.tasks, taskRows, actionType);

      setTaskRows(newTaskRows);
      setHasParsedTasks(true);
      setDocumentChange({
        hasPendingChange: false,
        previousReferenceUrl: referenceUrl,
        previousTemplateUrl: templateUrl,
      });

      if (actionType === 'parse' && response.definitionKey) {
        setLocalDefinitionKey(response.definitionKey);
      }

      if (actionType === 'parse') {
        storeParseBaseline(response);
      }

      // Update form with response data after parse/re-parse to reflect persisted state
      // In create mode: this ensures the form shows the server-defaulted assignmentWeighting
      // In update mode with re-parse: this ensures document URLs are updated while preserving metadata
      applyParseResponseToForm(form, response, referenceUrl, templateUrl, actionType);
    },
    [
      taskRows,
      storeParseBaseline,
      form,
      setTaskRows,
      setHasParsedTasks,
      setDocumentChange,
      setLocalDefinitionKey,
    ]
  );

  /**
   * Performs query invalidation after a mutation.
   * Invalidate both assignmentDefinitionPartials and assignmentDefinitionByKey (for create-mode localDefinitionKey).
   *
   * Per frontend-react-query-and-prefetch.md §7, we use invalidateQueries only.
   * Active useQuery observers will automatically refetch in the background,
   * and any errors will properly propagate to their isError state.
   *
   * @param {string | null} explicitKey - Explicit definition key if provided.
   * @returns {Promise<void>} Resolves when invalidation is complete.
   */
  const invalidateMutationQueries = useCallback(
    async (explicitKey: string | null) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      // Invalidate the specific definition query for both explicit key and local definition key
      // This handles both update mode (explicitKey) and create mode (localDefinitionKey)
      const effectiveKey = explicitKey ?? localDefinitionKey;
      if (effectiveKey) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.assignmentDefinitionByKey(effectiveKey),
        });
      }
      // Removed fetchQuery call as per frontend-react-query-and-prefetch.md §7:
      // fetchQuery after invalidation is anti-pattern. Let React Query's background
      // refetch handle cache updates. Errors will properly propagate to page-level
      // useQuery.isError state, allowing blocking UI to render correctly.
    },
    [queryClient, localDefinitionKey]
  );

  /**
   * Handles post-mutation actions based on action type.
   *
   * @param {'parse' | 'save' | 'reparse'} actionType - The action type.
   * @param {UpsertAssignmentDefinitionResponse | undefined} response - The mutation response for parse/reparse.
   * @param {string | null} effectiveKey - The effective key from the request, used as fallback.
   * @returns {UpsertAssignmentDefinitionResponse | undefined} The response to return.
   */
  const handlePostMutation = useCallback(
    (
      actionType: WizardActionType,
      response: UpsertAssignmentDefinitionResponse | undefined,
      effectiveKey: string | null
    ): UpsertAssignmentDefinitionResponse | undefined => {
      if (actionType === 'save') {
        if (onCreateSuccess) {
          const key = response?.definitionKey ?? effectiveKey;
          if (key) {
            onCreateSuccess(key);
          }
          return undefined;
        }
        onClose();
        return undefined;
      }
      setHasDirtyEdits(false);
      return response;
    },
    [onClose, onCreateSuccess, setHasDirtyEdits]
  );

  /**
   * Shared orchestration function for all wizard mutations (parse, save, re-parse).
   * Mode-specific behaviour is expressed through the options parameter rather than
   * copied control flow; the shared upsert hook owns busy and error mapping.
   *
   * @param {object} mutationOptions - Mutation configuration.
   * @param {'parse' | 'save' | 'reparse'} mutationOptions.actionType - Type of mutation action.
   * @param {UpsertAssignmentDefinitionRequest} mutationOptions.request - Pre-built request object.
   * @param {string | null} mutationOptions.definitionKey - Definition key for update/reparse, or null for create parse.
   * @returns {Promise<UpsertAssignmentDefinitionResponse | undefined>} Resolves with response for parse/reparse, undefined otherwise.
   */
  const runWizardMutation = useCallback(
    async (mutationOptions: {
      actionType: WizardActionType;
      request: UpsertAssignmentDefinitionRequest;
      definitionKey: string | null;
    }): Promise<UpsertAssignmentDefinitionResponse | undefined> => {
      if (isMutationBusy) {
        return undefined;
      }
      const result = await runUpsert(mutationOptions.request, {
        contextName: WIZARD_MUTATION_LOG_CONTEXT,
        errorContext: {
          mode,
          definitionKey: mutationOptions.definitionKey,
          actionType: mutationOptions.actionType,
          requestPayload: mutationOptions.request,
        },
      });

      if (result.errorMessage !== null) {
        setSubmitBlockingError(result.errorMessage);
        return undefined;
      }

      const response = result.response;
      if (!response) {
        return undefined;
      }

      if (mutationOptions.actionType === 'parse' || mutationOptions.actionType === 'reparse') {
        handleParseResponse(response, mutationOptions.actionType);
      }

      const definitionKeyForInvalidation =
        mutationOptions.actionType === 'parse'
          ? response.definitionKey
          : mutationOptions.definitionKey;
      await invalidateMutationQueries(definitionKeyForInvalidation);
      return handlePostMutation(
        mutationOptions.actionType,
        response,
        mutationOptions.definitionKey
      );
    },
    [
      isMutationBusy,
      runUpsert,
      mode,
      handleParseResponse,
      invalidateMutationQueries,
      handlePostMutation,
      setSubmitBlockingError,
    ]
  );

  return { isSubmitting: isMutationBusy, runWizardMutation };
}
