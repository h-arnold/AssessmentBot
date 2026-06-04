import { type FormInstance } from 'antd';
import { type AssignmentDefinition } from '../../services/assignmentDefinitionService';

export type ModalMode = 'create' | 'update';

export type TaskRow = Readonly<{
  key: string;
  taskId: string;
  taskTitle: string;
  taskWeighting: number;
}>;

export type DocumentChangeState = Readonly<{
  hasPendingChange: boolean;
  previousReferenceUrl: string;
  previousTemplateUrl: string;
}>;

export type ParsedCreateBaseline = Readonly<{
  title: string;
  topic: string;
  yearGroup: string;
  referenceDocumentUrl: string;
  templateDocumentUrl: string;
  referenceDocumentId: string;
  templateDocumentId: string;
  documentType: 'SLIDES' | 'SHEETS';
  assignmentWeighting: number | null;
  taskWeightings: ReadonlyMap<string, number>;
}>;

export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
}>;

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
  setBlockingError: (error: string | null) => void;
  setLocalDefinitionKey: (key: string | null) => void;
}

export type UseAssignmentDefinitionWizardReturn = Readonly<{
  form: FormInstance<Record<string, unknown>>;
  hasParsedTasks: boolean;
  taskRows: TaskRow[];
  documentChange: DocumentChangeState;
  hasDirtyEdits: boolean;
  showDiscardConfirm: boolean;
  isSubmitting: boolean;
  blockingError: string | null;
  isReferenceDataLoading: boolean;
  isReferenceDataBlocked: boolean;
  topicOptions: { value: string; label: string }[];
  yearGroupOptions: { value: string; label: string }[];
  primaryActionLabel: string;
  isPrimaryActionDisabled: boolean;
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
  handleFormValuesChange: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>
  ) => void;
  handleReparse: () => Promise<void>;
  handleReparseCancel: () => void;
  handleClose: () => void;
  handleDiscardConfirm: () => void;
  handleKeepEditing: () => void;
  handleTaskWeightingChange: (taskId: string, value: number | null) => void;
  handlePrimaryAction: () => void;
  handleTopicAddNew: () => void;
  handleYearGroupAddNew: () => void;
  onTopicEntityCreated: (entity: { key: string; name: string; yearGroupKeys?: string[] }) => void;
  onYearGroupEntityCreated: (entity: { key: string; name: string }) => void;
}>;
