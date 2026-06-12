/**
 * Shared hook for reference-data management modal orchestration.
 *
 * Extracts duplicated state management, handler factories, query orchestration,
 * and dialog rendering logic from ManageCohortsModal and ManageYearGroupsModal.
 *
 * This hook is generic over T extends { key: string; name: string } to support any reference-data
 * entity type (Cohort, YearGroup, etc.) while preserving type safety.
 */

import React, { useEffect, useState, useCallback, useMemo, type ReactElement } from 'react';
import { Alert, Form } from 'antd';
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  clearPersistedBlockingLoadError,
  getDeleteErrorMessage,
  getPersistedBlockingLoadError,
  getReferenceDataBlockingLoadErrorQueryKey,
  getReferenceDataLoadError,
  isInUseError,
  refetchRequiredReferenceDataQuery,
  setPersistedBlockingLoadError,
  type BlockingLoadErrorState,
  type ReferenceDataTrustBoundary,
} from '../../referenceData/manageReferenceDataHelpers';
import type { ReferenceDataFormValues } from '../../referenceData/manageReferenceDataDialogs';
import {
  ReferenceDataDeleteDialog,
  ReferenceDataFormDialog,
} from '../../referenceData/manageReferenceDataDialogs';

// ============================================================================

/**
 * Form values for reference data entities.
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the useReferenceDataManagement hook.
 */
export type ReferenceDataManagementConfig<T extends { key: string; name: string }> = Readonly<{
  entityLabel: string;
  entityKey: ReferenceDataTrustBoundary;
  queryOptions: UseQueryOptions<T[]>;
  createService: (parameters: { record: Omit<T, 'key'> }) => Promise<void>;
  updateService: (parameters: { key: string; record: Omit<T, 'key'> }) => Promise<void>;
  deleteService: (parameters: { key: string }) => Promise<void>;
  supportsToggleActive: boolean;
  toggleService?: (parameters: { entity: T; active: boolean }) => Promise<void>;
  formValidationMessage: string;
  loadFailureCopy: string;
  refreshStatusCopy: string;
  // Dialog rendering configuration - these enable default renderers
  formDialogLabelId: string;
  deleteDialogLabelId: string;
  deleteDialogTitle: string;
  // Optional custom renderers - if not provided, default renderers are used
  renderFormDialog?: (properties: FormDialogProperties<T>) => ReactElement | null;
  renderDeleteDialog?: (properties: DeleteDialogProperties<T>) => ReactElement | null;
}>;

// ============================================================================
// State Types
// ============================================================================

/**
 * Form mode type for create/edit states.
 */
type FormMode = 'create' | 'edit' | null;

/**
 * State for the delete confirmation dialog.
 */
export type DeleteDialogState<T extends { key: string; name: string }> = Readonly<{
  open: boolean;
  entity: T | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

/**
 * Initial state for the delete dialog.
 */
const INITIAL_DELETE_STATE: DeleteDialogState<never> = {
  open: false,
  entity: null,
  error: null,
  blocked: false,
  submitting: false,
} as const;

// ============================================================================
// Dialog Props Types
// ============================================================================

/**
 * Props for rendering the form dialog.
 */
export type FormDialogProperties<T extends { key: string; name: string }> = Readonly<{
  editingEntity: T | null;
  form: ReturnType<typeof Form.useForm<ReferenceDataFormValues>>[0];
  formDialogTitle: string;
  formError: string | null;
  formMode: FormMode;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: ReferenceDataFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Props for rendering the delete dialog.
 */
export type DeleteDialogProperties<T extends { key: string; name: string }> = Readonly<{
  deleteState: DeleteDialogState<T>;
  onClose: () => void;
  onConfirm: () => void;
}>;

// ============================================================================
// Result Type
// ============================================================================

/**
 * Result type returned by the useReferenceDataManagement hook.
 */
export type ReferenceDataManagementResult<T extends { key: string; name: string }> = {
  // State
  formMode: FormMode;
  editingEntity: T | null;
  form: ReturnType<typeof Form.useForm<ReferenceDataFormValues>>[0];
  formSubmitting: boolean;
  formError: string | null;
  toggleError: string | null;
  deleteState: DeleteDialogState<T>;
  loadError: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  rows: T[];

  // Derived UI elements
  inlineDialog: ReactElement | null;
  inlineAlert: ReactElement | null;

  // Handlers
  openCreateForm: () => void;
  openEditForm: (entity: T) => void;
  openDeleteDialog: (entity: T) => void;
  closeFormDialog: () => void;
  handleModalClose: () => void;
  handleFormFinish: (values: ReferenceDataFormValues) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleToggleActive?: (entity: T, active: boolean) => Promise<void>;
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing reference-data CRUD operations with shared orchestration logic.
 *
 * This hook extracts all duplicated state management, handler factories, query orchestration,
 * and dialog rendering from ManageCohortsModal and ManageYearGroupsModal.
 *
 * @param {ReferenceDataManagementConfig<T>} config Configuration object for the hook.
 * @returns {ReferenceDataManagementResult<T>} ReferenceDataManagementResult containing state, derived UI elements, and handlers.
 */
export function useReferenceDataManagement<T extends { key: string; name: string }>(
  config: ReferenceDataManagementConfig<T>
): ReferenceDataManagementResult<T> {
  const queryClient = useQueryClient();

  // Primary query for fetching the reference data entities
  const entitiesQuery = useQuery<T[]>({ ...config.queryOptions });
  // Extract queryKey from the query for use in refetch operations
  // We use a type assertion to preserve the specific query key type
  const queryKeyForRefetch = config.queryOptions.queryKey as QueryKey;
  const entities = entitiesQuery.data ?? [];
  const isInitialLoading = entitiesQuery.isPending && entitiesQuery.data === undefined;
  const dataUpdatedAt = entitiesQuery.dataUpdatedAt;

  // Blocking load error query (fail-closed safety mechanism)
  const blockingLoadErrorQuery = useQuery({
    enabled: false,
    queryFn: () => getPersistedBlockingLoadError(queryClient, config.entityKey),
    queryKey: getReferenceDataBlockingLoadErrorQueryKey(config.entityKey),
  });
  const blockingLoadError = blockingLoadErrorQuery.data ?? null;
  const isRefreshing = !isInitialLoading && entitiesQuery.isFetching;

  // Blocking load error cleanup useEffect
  // Clears persisted blocking errors when fresh data is available
  useEffect(() => {
    if (blockingLoadError === null || dataUpdatedAt <= blockingLoadError.dataUpdatedAt) {
      return;
    }

    clearPersistedBlockingLoadError(queryClient, config.entityKey);
  }, [blockingLoadError, dataUpdatedAt, queryClient, config.entityKey]);

  // State management
  const [form] = Form.useForm<ReferenceDataFormValues>();
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingEntity, setEditingEntity] = useState<T | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteDialogState<T>>(INITIAL_DELETE_STATE);

  // Derived load error state
  const loadError = getReferenceDataLoadError(
    entitiesQuery,
    blockingLoadError,
    dataUpdatedAt,
    config.loadFailureCopy
  );

  // ---------------------------------------------------------------------------
  // Form Dialog Title
  // ---------------------------------------------------------------------------

  const formDialogTitle = useMemo((): string => {
    if (formMode === null) {
      return '';
    }
    return formMode === 'create' ? `Create ${config.entityLabel}` : `Edit ${config.entityLabel}`;
  }, [formMode, config.entityLabel]);

  // ---------------------------------------------------------------------------
  // Handler Factories
  // ---------------------------------------------------------------------------

  const closeFormDialog = useCallback((): void => {
    const wasFormOpen = formMode !== null;

    setFormMode(null);
    setEditingEntity(null);
    setFormError(null);
    setFormSubmitting(false);

    if (wasFormOpen) {
      form.resetFields();
    }
  }, [form, formMode]);

  const openCreateForm = useCallback((): void => {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    setEditingEntity(null);
    setFormError(null);
    // Standardised behaviour: always reset form fields on openCreateForm
    form.resetFields();
    setFormMode('create');
  }, [closeFormDialog, form]);

  const openEditForm = useCallback(
    (entity: T): void => {
      closeFormDialog();
      setDeleteState(INITIAL_DELETE_STATE);
      setEditingEntity(entity);
      setFormError(null);
      setFormMode('edit');
    },
    [closeFormDialog]
  );

  const handleModalClose = useCallback((): void => {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    setToggleError(null);
  }, [closeFormDialog]);

  const handleRequiredRefreshFailure = useCallback((): void => {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    setToggleError(null);

    const nextBlockingLoadError: BlockingLoadErrorState = {
      dataUpdatedAt,
      message: config.loadFailureCopy,
    };

    setPersistedBlockingLoadError(queryClient, config.entityKey, nextBlockingLoadError);
  }, [closeFormDialog, dataUpdatedAt, queryClient, config.entityKey, config.loadFailureCopy]);

  // Form finish handler
  const handleFormFinish = useCallback(
    async (values: ReferenceDataFormValues): Promise<void> => {
      setFormSubmitting(true);
      setFormError(null);

      try {
        if (formMode === 'create') {
          // Create new entity - values contains form data, we need to construct the record
          // The form values only contain 'name', but the entity may have other fields
          // We spread the values and let the service handle the conversion
          await config.createService({ record: values as unknown as Omit<T, 'key'> });
        } else {
          if (editingEntity === null) {
            throw new Error(`Unable to save the ${config.entityLabel}.`);
          }

          // Update existing entity - preserve all fields from existing entity
          // and merge with form values
          const { key, ...entityWithoutKey } = editingEntity;
          const updatedRecord: Omit<T, 'key'> = {
            ...entityWithoutKey,
            ...(values as unknown as Partial<T>),
          };

          await config.updateService({
            key,
            record: updatedRecord,
          });
        }

        const refreshSucceeded = await refetchRequiredReferenceDataQuery(
          queryClient,
          queryKeyForRefetch
        );

        if (!refreshSucceeded) {
          handleRequiredRefreshFailure();
          return;
        }

        closeFormDialog();
      } catch (error: unknown) {
        setFormError(
          error instanceof Error ? error.message : `Unable to save the ${config.entityLabel}.`
        );
      } finally {
        setFormSubmitting(false);
      }
    },
    [
      formMode,
      editingEntity,
      config,
      queryClient,
      queryKeyForRefetch,
      handleRequiredRefreshFailure,
      closeFormDialog,
    ]
  );

  // Delete confirm handler
  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    if (deleteState.entity === null) {
      return;
    }

    setDeleteState((previous) => ({ ...previous, submitting: true, error: null }));

    try {
      await config.deleteService({ key: deleteState.entity.key });
      const refreshSucceeded = await refetchRequiredReferenceDataQuery(
        queryClient,
        queryKeyForRefetch
      );

      if (!refreshSucceeded) {
        handleRequiredRefreshFailure();
        return;
      }

      setDeleteState(INITIAL_DELETE_STATE);
    } catch (error: unknown) {
      const blocked = isInUseError(error);

      setDeleteState((previous) => ({
        ...previous,
        submitting: false,
        error: getDeleteErrorMessage(error, blocked, config.entityLabel),
        blocked,
      }));
    }
  }, [deleteState.entity, config, queryClient, queryKeyForRefetch, handleRequiredRefreshFailure]);

  // Delete dialog handler
  const openDeleteDialog = useCallback(
    (entity: T): void => {
      closeFormDialog();
      setDeleteState({
        open: true,
        entity,
        error: null,
        blocked: false,
        submitting: false,
      } as DeleteDialogState<T>);
    },
    [closeFormDialog]
  );

  // Toggle active handler (optional, only when supportsToggleActive is true)
  const handleToggleActive = useCallback(
    async (entity: T, active: boolean): Promise<void> => {
      if (!config.supportsToggleActive || !config.toggleService) {
        return;
      }

      setToggleError(null);

      try {
        await config.toggleService({ entity, active });
        const refreshSucceeded = await refetchRequiredReferenceDataQuery(
          queryClient,
          queryKeyForRefetch
        );

        if (!refreshSucceeded) {
          handleRequiredRefreshFailure();
          return;
        }
      } catch (error: unknown) {
        setToggleError(
          error instanceof Error
            ? error.message
            : `Unable to update the ${config.entityLabel} active state.`
        );
      }
    },
    [config, queryClient, queryKeyForRefetch, handleRequiredRefreshFailure]
  );

  // ---------------------------------------------------------------------------
  // Default Dialog Renderers
  // ---------------------------------------------------------------------------

  // Default form dialog renderer
  const defaultRenderFormDialog = useCallback(
    (properties: FormDialogProperties<T>): ReactElement | null => {
      if (properties.formMode === null) {
        return null;
      }

      return React.createElement(ReferenceDataFormDialog, {
        formKey: properties.editingEntity?.key ?? 'create',
        form: properties.form,
        initialName: properties.editingEntity?.name ?? null,
        labelId: config.formDialogLabelId,
        title: properties.formDialogTitle,
        formError: properties.formError,
        formSubmitting: properties.formSubmitting,
        validationMessage: config.formValidationMessage,
        onClose: properties.onClose,
        onFinish: properties.onFinish,
        onOk: properties.onOk,
      });
    },
    [config.formDialogLabelId, config.formValidationMessage]
  );

  // Default delete dialog renderer
  const defaultRenderDeleteDialog = useCallback(
    (properties: DeleteDialogProperties<T>): ReactElement | null => {
      if (!properties.deleteState.open) {
        return null;
      }

      return React.createElement(ReferenceDataDeleteDialog, {
        blocked: properties.deleteState.blocked,
        entityLabel: config.entityLabel,
        entityName: properties.deleteState.entity?.name ?? null,
        error: properties.deleteState.error,
        labelId: config.deleteDialogLabelId,
        submitting: properties.deleteState.submitting,
        title: config.deleteDialogTitle,
        onClose: properties.onClose,
        onConfirm: properties.onConfirm,
      });
    },
    [config.deleteDialogLabelId, config.deleteDialogTitle, config.entityLabel]
  );

  // ---------------------------------------------------------------------------
  // Dialog Rendering
  // ---------------------------------------------------------------------------

  const inlineDialog = useMemo((): ReactElement | null => {
    // Use custom renderers if provided, otherwise use defaults
    const renderFormDialogFunction = config.renderFormDialog ?? defaultRenderFormDialog;
    const renderDeleteDialogFunction = config.renderDeleteDialog ?? defaultRenderDeleteDialog;

    const formDialog = renderFormDialogFunction({
      editingEntity,
      form,
      formDialogTitle,
      formError,
      formMode,
      formSubmitting,
      onClose: closeFormDialog,
      onFinish: handleFormFinish,
      onOk: () => {
        form.submit();
      },
    });

    const deleteDialog = renderDeleteDialogFunction({
      deleteState,
      onClose: () => {
        setDeleteState(INITIAL_DELETE_STATE);
      },
      onConfirm: handleDeleteConfirm,
    });

    // Form dialog takes precedence over delete dialog
    if (formDialog !== null) {
      return formDialog;
    }
    return deleteDialog;
  }, [
    config,
    editingEntity,
    form,
    formDialogTitle,
    formError,
    formMode,
    formSubmitting,
    closeFormDialog,
    handleFormFinish,
    deleteState,
    handleDeleteConfirm,
    defaultRenderFormDialog,
    defaultRenderDeleteDialog,
  ]);

  const inlineAlert = useMemo((): ReactElement | null => {
    if (toggleError === null) {
      return null;
    }
    // React 19 reserves the `type` prop on JSX elements; use createElement to avoid the conflict
    const alertType = 'error' as const;
    const properties = { description: toggleError, type: alertType, showIcon: true } as const;
    return React.createElement(Alert, properties);
  }, [toggleError]);

  // ---------------------------------------------------------------------------
  // Return result
  // ---------------------------------------------------------------------------

  return {
    // State
    formMode,
    editingEntity,
    form,
    formSubmitting,
    formError,
    toggleError,
    deleteState,
    loadError,
    isInitialLoading,
    isRefreshing,
    rows: entities,

    // Derived UI elements
    inlineDialog,
    inlineAlert,

    // Handlers
    openCreateForm,
    openEditForm,
    openDeleteDialog,
    closeFormDialog,
    handleModalClose,
    handleFormFinish,
    handleDeleteConfirm,
    // Only include handleToggleActive if toggle is supported
    ...(config.supportsToggleActive ? { handleToggleActive } : {}),
  };
}

export type { ReferenceDataFormValues } from '../../referenceData/manageReferenceDataDialogs';
export type { ReferenceDataTrustBoundary } from '../../referenceData/manageReferenceDataHelpers';
