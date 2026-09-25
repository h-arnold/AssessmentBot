import { type FormInstance } from 'antd';
import {
  hasCreateModeDirtyEdits,
  hasUpdateModeDirtyEdits,
  type DocumentChangeState,
  type ParsedCreateBaseline,
  type TaskRow,
} from './assignmentWizardFormState';

/**
 * Derives whether the explicit update-mode reparse action is enabled.
 * @param {boolean} isCreateMode Whether the wizard is in create mode.
 * @param {boolean} isDefinitionLoaded Whether the definition loaded.
 * @param {boolean} isDefinitionError Whether definition loading failed.
 * @param {boolean} hasDirtyEdits Whether metadata or weighting edits exist.
 * @param {boolean} hasPendingDocumentChange Whether document URLs changed.
 * @param {boolean} isSubmitting Whether a mutation is pending.
 * @returns {boolean} Whether the reparse action may run.
 */
export function deriveCanReparseDocuments(
  isCreateMode: boolean,
  isDefinitionLoaded: boolean,
  isDefinitionError: boolean,
  hasDirtyEdits: boolean,
  hasPendingDocumentChange: boolean,
  isSubmitting: boolean
): boolean {
  return (
    !isCreateMode &&
    isDefinitionLoaded &&
    !isDefinitionError &&
    !hasDirtyEdits &&
    !hasPendingDocumentChange &&
    !isSubmitting
  );
}

/**
 * Resolves the primary-action disabled state from its baseline derivation and
 * the current document-change state.
 *
 * @param {boolean} derivedDisabled Baseline primary-action state.
 * @param {DocumentChangeState} documentChange Current document state.
 * @returns {boolean} Whether the primary action is unavailable.
 */
export function isWizardPrimaryActionDisabled(
  derivedDisabled: boolean,
  documentChange: DocumentChangeState
): boolean {
  return derivedDisabled || documentChange.hasPendingChange;
}

/**
 * Resolves the update-mode action for a pending document change.
 *
 * @param {Record<string, unknown>} values Current form values.
 * @param {Record<string, unknown> | null | undefined} definition Loaded update definition.
 * @param {TaskRow[]} taskRows Current task rows.
 * @param {boolean} hasDirtyEdits State-derived dirty flag.
 * @returns {'confirm' | 'close'} Whether to confirm or close directly.
 */
function derivePendingUpdateCloseAction(
  values: Record<string, unknown>,
  definition: Record<string, unknown> | null | undefined,
  taskRows: TaskRow[],
  hasDirtyEdits: boolean
): 'confirm' | 'close' {
  if (!definition) return hasDirtyEdits ? 'confirm' : 'close';
  return hasUpdateModeDirtyEdits(values, definition, taskRows) ? 'confirm' : 'close';
}

/**
 * Result of resolving a wizard dismissal request.
 */
export type WizardCloseAction = 'blocked' | 'confirm' | 'close';

/**
 * Resolves the close guard for a create or update wizard.
 *
 * @remarks
 * A pending document change blocks dismissal in create mode, because the only
 * resolutions are re-parse and URL restoration and neither closes the wizard.
 * Update mode keeps its close affordances live: a URL-only pending change closes
 * directly, while unsaved metadata or weighting edits keep the discard
 * confirmation. The dirty check is recomputed from live form values so the
 * decision cannot race a not-yet-rendered dirty state.
 *
 * @param {Readonly<{ isCreateMode: boolean; values: Record<string, unknown>; hasPendingDocumentChange: boolean; form: FormInstance; hasParsedTasks: boolean; parsedBaseline: ParsedCreateBaseline | null; definition: Record<string, unknown> | null | undefined; taskRows: TaskRow[]; initialValues: Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined; hasDirtyEdits: boolean }>} properties Close-resolution inputs.
 * @returns {WizardCloseAction} The action the caller should take.
 */
export function deriveWizardCloseAction(
  properties: Readonly<{
    isCreateMode: boolean;
    values: Record<string, unknown>;
    hasPendingDocumentChange: boolean;
    form: FormInstance;
    hasParsedTasks: boolean;
    parsedBaseline: ParsedCreateBaseline | null;
    definition: Record<string, unknown> | null | undefined;
    taskRows: TaskRow[];
    initialValues: Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined;
    hasDirtyEdits: boolean;
  }>
): WizardCloseAction {
  if (properties.hasPendingDocumentChange) {
    if (properties.isCreateMode) return 'blocked';

    return derivePendingUpdateCloseAction(
      properties.values,
      properties.definition,
      properties.taskRows,
      properties.hasDirtyEdits
    );
  }

  const hasDirtyCreateEdits =
    properties.isCreateMode &&
    shouldPromptForCreateWizardDismissal(
      properties.form,
      properties.values,
      properties.hasParsedTasks,
      properties.parsedBaseline,
      properties.taskRows,
      properties.initialValues
    );
  return properties.hasDirtyEdits || hasDirtyCreateEdits ? 'confirm' : 'close';
}

/**
 * Checks whether stage-one create values differ from their initial values.
 * @param {Record<string, unknown>} currentValues Current form values.
 * @param {Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined} initialValues Initial create values.
 * @returns {boolean} Whether a stage-one value has changed.
 */
function hasChangedCreateStageOneValues(
  currentValues: Record<string, unknown>,
  initialValues: Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined
): boolean {
  return (
    currentValues.title !== initialValues?.title ||
    currentValues.topic !== initialValues?.topic ||
    currentValues.yearGroup !== initialValues?.yearGroup
  );
}

/**
 * Checks whether an owning-modal dismissal should prompt for a create wizard.
 * @param {FormInstance} form Assignment wizard form instance.
 * @param {Record<string, unknown>} values Current form values.
 * @param {boolean} hasParsedTasks Whether stage two has been reached.
 * @param {ParsedCreateBaseline | null} parsedBaseline Parsed stage-two baseline.
 * @param {TaskRow[]} taskRows Current task rows.
 * @param {Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined} initialValues Initial create values.
 * @returns {boolean} Whether the form has synchronously detectable edits.
 */
export function shouldPromptForCreateWizardDismissal(
  form: FormInstance,
  values: Record<string, unknown>,
  hasParsedTasks: boolean,
  parsedBaseline: ParsedCreateBaseline | null,
  taskRows: TaskRow[],
  initialValues: Readonly<{ title?: string; topic?: string; yearGroup?: string }> | undefined
): boolean {
  const hasDirtyValues = hasParsedTasks
    ? parsedBaseline !== null && hasCreateModeDirtyEdits(values, parsedBaseline, taskRows)
    : hasChangedCreateStageOneValues(values, initialValues);
  return form.isFieldsTouched() && hasDirtyValues;
}
