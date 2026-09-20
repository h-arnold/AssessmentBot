import { type FormInstance } from 'antd';
import {
  hasCreateModeDirtyEdits,
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
