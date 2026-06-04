/**
 * Assignment Definition Wizard Modal Test Helpers
 *
 * Barrel file re-exporting all public helpers for use in test files.
 */

export { renderWizardModal } from './render';
export type {
  WizardModalMode,
  RenderWizardModalOptions,
  WizardModalRenderResult,
  ModalElementQueries,
  FillRequiredFieldsOptions,
} from './types';
export {
  waitForCreateModal,
  waitForUpdateModal,
  waitForWizardModal,
  getFormElements,
  getParseButton,
  getSaveButton,
  getTaskTable,
  getAssignmentWeightingInput,
  getAllTaskWeightingInputs,
  getReparseButton,
  getReparseActionRow,
  getReparseCancelButton,
  fillRequiredFields,
  selectTopic,
  selectYearGroup,
  changeReferenceUrl,
  changeTemplateUrl,
  getReferenceUrlValue,
  getTemplateUrlValue,
} from './elementQueries';
export {
  assertTaskEditingHidden,
  assertParseButtonPresent,
  assertSharedEditSurfaceHydrated,
  assertDocumentChangePromptVisible,
  assertDocumentChangePromptNotVisible,
  assertMetadataAndTaskWeightingsDisabled,
  assertMetadataAndTaskWeightingsEnabled,
  assertDocumentUrlFieldsDisabled,
  assertAllRequiredFieldsPresent,
  assertParseButtonDisabled,
  assertParseButtonEnabled,
  assertTaskVisible,
  assertTaskNotVisible,
} from './assertions';
