import { type QueryClient } from '@tanstack/react-query';
import { type FormInstance } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { queryKeys } from '../../query/queryKeys';
import { type UpsertAssignmentDefinitionResponse } from '../../services/assignmentDefinitionService';
import { buildCanonicalUrl, calculateDirtyState, hydrateFormFromDefinition } from './helpers';
import { type FormInitializationOptions, type ParsedCreateBaseline } from './types';

/**
 * Custom hook to handle form initialization for the assignment definition wizard.
 * Manages modal open/close state, form reset, definition hydration, and dirty state tracking.
 *
 * @param {boolean} open - Whether the modal is open.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {AssignmentDefinition | null | undefined} definition - The definition to hydrate from in update mode.
 * @param {Record<string, unknown>} formValues - Current form values for dirty state calculation.
 * @param {TaskRow[]} taskRows - Current task rows for dirty state calculation.
 * @param {boolean} hasParsedTasks - Whether tasks have been parsed.
 * @param {function} setHasParsedTasks - State setter for parsed tasks flag.
 * @param {function} setTaskRows - State setter for task rows.
 * @param {function} setDocumentChange - State setter for document change state.
 * @param {function} setHasDirtyEdits - State setter for dirty edits flag.
 * @param {function} setBlockingError - State setter for blocking error.
 * @param {function} setLocalDefinitionKey - State setter for local definition key.
 * @param {string | null} localDefinitionKey - The local definition key from parse response in create mode.
 * @param {QueryClient} queryClient - The React Query client for accessing cached data.
 * @returns {{ storeParseBaseline: (response: UpsertAssignmentDefinitionResponse) => void; getParsedCreateBaseline: () => ParsedCreateBaseline | null }} Initialization state and baseline setter.
 */
/**
 * Hook for form initialization and baseline management.
 * Manages parse baseline storage and retrieval for the assignment definition wizard.
 *
 * @param {boolean} open - Whether the modal is open.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {FormInitializationOptions} options - Form initialization options containing state and setters.
 * @param {QueryClient} queryClient - The React Query client for accessing cached data.
 * @returns {object} Object containing storeParseBaseline and getParsedCreateBaseline functions.
 */
export function useFormInitialization(
  open: boolean,
  isCreateMode: boolean,
  form: FormInstance,
  options: FormInitializationOptions,
  queryClient: QueryClient
): {
  storeParseBaseline: (response: UpsertAssignmentDefinitionResponse) => void;
  getParsedCreateBaseline: () => ParsedCreateBaseline | null;
} {
  const {
    definition,
    formValues,
    taskRows,
    hasParsedTasks,
    localDefinitionKey,
    setHasParsedTasks,
    setTaskRows,
    setDocumentChange,
    setHasDirtyEdits,
    setBlockingError,
    setLocalDefinitionKey,
  } = options;
  const isHydratingDefinitionReference = useRef(false);
  const parsedCreateBaselineReference = useRef<ParsedCreateBaseline | null>(null);

  // Initialize modal and track hydration state
  useEffect(() => {
    if (!open) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      setLocalDefinitionKey(null);
      return;
    }

    setHasParsedTasks(false);
    setTaskRows([]);
    setDocumentChange({
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    });
    setHasDirtyEdits(false);
    setBlockingError(null);
    setLocalDefinitionKey(null);

    if (isCreateMode) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      form.resetFields();
    } else if (definition) {
      parsedCreateBaselineReference.current = null;
      isHydratingDefinitionReference.current = true;

      hydrateFormFromDefinition(
        form,
        definition,
        setTaskRows,
        setHasParsedTasks,
        setDocumentChange
      );
      queueMicrotask(() => {
        isHydratingDefinitionReference.current = false;
      });
    }
  }, [
    open,
    isCreateMode,
    definition,
    form,
    setTaskRows,
    setHasParsedTasks,
    setDocumentChange,
    setHasDirtyEdits,
    setBlockingError,
    setLocalDefinitionKey,
  ]);

  // Track dirty state
  useEffect(() => {
    if (isHydratingDefinitionReference.current) {
      setHasDirtyEdits(false);
      return;
    }

    if (isCreateMode && !hasParsedTasks) {
      setHasDirtyEdits(false);
      return;
    }

    const isDirty = calculateDirtyState(
      formValues,
      parsedCreateBaselineReference.current,
      definition,
      taskRows,
      isCreateMode,
      hasParsedTasks
    );
    setHasDirtyEdits(isDirty);
  }, [formValues, definition, taskRows, isCreateMode, hasParsedTasks, setHasDirtyEdits]);

  // Function to store parse baseline after successful stage-one create
  const storeParseBaseline = useCallback((response: UpsertAssignmentDefinitionResponse) => {
    const referenceUrl = buildCanonicalUrl(response.referenceDocumentId, response.documentType);
    const templateUrl = buildCanonicalUrl(response.templateDocumentId, response.documentType);

    parsedCreateBaselineReference.current = {
      // Use response values for metadata to capture any server-side normalisation
      title: response.primaryTitle,
      topic: response.primaryTopicKey,
      yearGroup: response.yearGroupKey,
      // Build canonical URLs from response IDs for consistent baseline
      referenceDocumentUrl: referenceUrl,
      templateDocumentUrl: templateUrl,
      referenceDocumentId: response.referenceDocumentId,
      templateDocumentId: response.templateDocumentId,
      documentType: response.documentType,
      // Use the actual assignmentWeighting from the response, not the default
      assignmentWeighting: response.assignmentWeighting,
      taskWeightings: new Map(response.tasks.map((task) => [task.taskId, task.taskWeighting])),
    };
  }, []);

  // Function to get parsed create baseline for document URL restoration
  const getParsedCreateBaseline = useCallback((): ParsedCreateBaseline | null => {
    // In create mode: try cached query data first
    if (localDefinitionKey) {
      const cached = queryClient.getQueryData<UpsertAssignmentDefinitionResponse>(
        queryKeys.assignmentDefinitionByKey(localDefinitionKey)
      );
      if (cached) {
        const cachedDefinition = cached;
        const referenceUrl = buildCanonicalUrl(
          cachedDefinition.referenceDocumentId,
          cachedDefinition.documentType
        );
        const templateUrl = buildCanonicalUrl(
          cachedDefinition.templateDocumentId,
          cachedDefinition.documentType
        );

        return {
          title: cachedDefinition.primaryTitle,
          topic: cachedDefinition.primaryTopicKey,
          yearGroup: cachedDefinition.yearGroupKey,
          referenceDocumentUrl: referenceUrl,
          templateDocumentUrl: templateUrl,
          referenceDocumentId: cachedDefinition.referenceDocumentId,
          templateDocumentId: cachedDefinition.templateDocumentId,
          documentType: cachedDefinition.documentType,
          // Use the actual assignmentWeighting from the cached definition
          assignmentWeighting: cachedDefinition.assignmentWeighting,
          taskWeightings: new Map(
            cachedDefinition.tasks.map((task) => [task.taskId, task.taskWeighting])
          ),
        };
      }
    }
    return parsedCreateBaselineReference.current;
  }, [localDefinitionKey, queryClient]);

  return { storeParseBaseline, getParsedCreateBaseline };
}
