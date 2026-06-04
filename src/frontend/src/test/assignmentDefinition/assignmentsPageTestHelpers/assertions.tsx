/**
 * Assertion helpers for AssignmentsPage tests.
 */

import { waitFor, within } from '@testing-library/react';
import { getTextboxInModal, getSpinbuttonInModal, modalFormFields } from './formFields';

/**
 * Asserts that the document change prompt is visible in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {void}
 */
export function assertDocumentChangePromptVisibleInModal(modal: HTMLElement): void {
  expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
}

/**
 * Asserts that metadata and task weighting inputs are disabled in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertMetadataAndTaskWeightingsDisabledInModal(modal: HTMLElement): Promise<void> {
  await waitFor(() => {
    const titleInput = getTextboxInModal(modal, modalFormFields.title);
    const weightingInput = getSpinbuttonInModal(modal, modalFormFields.weighting);
    expect(titleInput).toBeDisabled();
    expect(weightingInput).toBeDisabled();
  });
}

/**
 * Asserts that metadata and task weighting inputs are enabled in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertMetadataAndTaskWeightingsEnabledInModal(modal: HTMLElement): Promise<void> {
  await waitFor(() => {
    const titleInput = getTextboxInModal(modal, modalFormFields.title);
    const weightingInput = getSpinbuttonInModal(modal, modalFormFields.weighting);
    expect(titleInput).toBeEnabled();
    expect(weightingInput).toBeEnabled();
  });
}

/**
 * Asserts that document URL fields are disabled in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertDocumentUrlFieldsDisabledInModal(modal: HTMLElement): Promise<void> {
  await waitFor(() => {
    const referenceUrlInput = getTextboxInModal(modal, modalFormFields.referenceUrl);
    const templateUrlInput = getTextboxInModal(modal, modalFormFields.templateUrl);
    expect(referenceUrlInput).toBeDisabled();
    expect(templateUrlInput).toBeDisabled();
  });
}

/**
 * Asserts that the task weightings table is visible in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {HTMLElement} The task weightings table element.
 */
export function assertTaskTableVisibleInModal(modal: HTMLElement): HTMLElement {
  return within(modal).getByRole('table', { name: /task weighting/i });
}

/**
 * Asserts that the parse button is present in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {void}
 */
export function assertParseButtonPresentInModal(modal: HTMLElement): void {
  expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeInTheDocument();
}

/**
 * Asserts that parsing is required (task editing hidden) in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {void}
 */
export function assertParsingRequiredInModal(modal: HTMLElement): void {
  expect(within(modal).getByText(/parsing is required/i)).toBeInTheDocument();
  expect(within(modal).queryByRole('table', { name: /task weightings/i })).not.toBeInTheDocument();
}
