/**
 * Type definitions for the useReferenceDataManagement hook.
 *
 * This file contains all type and interface definitions extracted from the
 * useReferenceDataManagement hook implementation.
 */

// ============================================================================
// Form Mode Type
// ============================================================================

/**
 * Form mode type for create/edit states.
 */
export type FormMode = 'create' | 'edit' | null;

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
 * State for the delete confirmation dialog.
 */
export type DeleteDialogState<T extends { key: string; name: string }> = Readonly<{
  open: boolean;
  entity: T | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

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
// Re-exports from other files
// ============================================================================

export type { ReferenceDataFormValues } from '../manageReferenceDataDialogs';
export type { ReferenceDataTrustBoundary } from '../manageReferenceDataHelpers';
