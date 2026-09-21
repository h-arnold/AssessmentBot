import { useCallback, useEffect, useRef } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { type FormInstance } from 'antd';
import { queryKeys } from '../../query/queryKeys';
import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionResponse,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import {
  buildDocumentUrlsFromDefinition,
  calculateDirtyState,
  hydrateFormFromDefinition,
  type DocumentChangeState,
  type ParsedCreateBaseline,
  type TaskRow,
} from './assignmentWizardFormState';

/**
 * Options for the useFormInitialization hook.
 * Contains all state values and setters needed for form initialization.
 */
export interface FormInitializationOptions {
  definition: AssignmentDefinition | null | undefined;
  formValues: Record<string, unknown>;
  taskRows: TaskRow[];
  hasParsedTasks: boolean;
  localDefinitionKey: string | null;
  setHasParsedTasks: (value: boolean) => void;
  setTaskRows: (rows: TaskRow[]) => void;
  setDocumentChange: (state: DocumentChangeState) => void;
  setHasDirtyEdits: (value: boolean) => void;
  setSubmitBlockingError: (error: string | null) => void;
  setLocalDefinitionKey: (key: string | null) => void;
}

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
    setSubmitBlockingError,
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
    setSubmitBlockingError(null);
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
    setSubmitBlockingError,
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
    const documentUrls = buildDocumentUrlsFromDefinition(response);
    if (!documentUrls) {
      return;
    }
    const referenceUrl = documentUrls.referenceUrl;
    const templateUrl = documentUrls.templateUrl;

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
        const documentUrls = buildDocumentUrlsFromDefinition(cachedDefinition);
        if (!documentUrls) {
          return parsedCreateBaselineReference.current;
        }
        const referenceUrl = documentUrls.referenceUrl;
        const templateUrl = documentUrls.templateUrl;

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
