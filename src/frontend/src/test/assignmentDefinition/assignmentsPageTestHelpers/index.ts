/**
 * Assignments Page Test Helpers
 *
 * Barrel file re-exporting all public helpers for use in test files.
 */

export {
  type SetupQueryClientOptions,
  type AssignmentsPageRenderResult,
  setupQueryClientWithAssignmentsData,
  renderAssignmentsPage,
  renderAssignmentsPageWithData,
} from './setup';

export {
  getAssignmentsTable,
  type FindRowOptions,
  findRowInAssignmentsTable,
  waitForRowInAssignmentsTable,
  clickUpdateButtonInRow,
  findRowAndClickUpdate,
  getDeleteButtonInRow,
  findRowAndClickDelete,
} from './table';

export {
  waitForCreateAssignmentModal,
  waitForUpdateAssignmentModal,
  waitForDeleteDialog,
  clickCreateAssignmentButton,
  openUpdateAssignmentModal,
  openUpdateModalAndChangeReferenceUrl,
} from './modal';

export {
  modalFormFields,
  getTextboxInModal,
  getSpinbuttonInModal,
  getComboboxInModal,
  getReparseActionRowInModal,
  getReparseButtonInModal,
  getReparseCancelButtonInModal,
  changeTextboxInModal,
  changeReferenceUrlInModal,
  changeTemplateUrlInModal,
} from './formFields';

export {
  assertDocumentChangePromptVisibleInModal,
  assertMetadataAndTaskWeightingsDisabledInModal,
  assertMetadataAndTaskWeightingsEnabledInModal,
  assertDocumentUrlFieldsDisabledInModal,
  assertTaskTableVisibleInModal,
  assertParseButtonPresentInModal,
  assertParsingRequiredInModal,
} from './assertions';
