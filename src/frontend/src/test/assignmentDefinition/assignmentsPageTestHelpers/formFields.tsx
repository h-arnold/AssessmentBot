/**
 * Form field helpers for AssignmentsPage tests.
 */

import { fireEvent, waitFor, within } from '@testing-library/react';

/**
 * Modal form field names.
 */
export const modalFormFields = {
  title: /assignment title/i,
  referenceUrl: /reference document url/i,
  templateUrl: /template document url/i,
  topic: /assignment topic/i,
  yearGroup: /assignment year group/i,
  weighting: /assignment weighting/i,
} as const;

/**
 * Gets a textbox from within a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {RegExp} name The field name pattern.
 * @returns {HTMLElement} The textbox element.
 */
export function getTextboxInModal(modal: HTMLElement, name: RegExp): HTMLElement {
  return within(modal).getByRole('textbox', { name });
}

/**
 * Gets a spinbutton from within a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {RegExp} name The field name pattern.
 * @returns {HTMLElement} The spinbutton element.
 */
export function getSpinbuttonInModal(modal: HTMLElement, name: RegExp): HTMLElement {
  return within(modal).getByRole('spinbutton', { name });
}

/**
 * Gets a combobox from within a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {RegExp} name The field name pattern.
 * @returns {HTMLElement} The combobox element.
 */
export function getComboboxInModal(modal: HTMLElement, name: RegExp): HTMLElement {
  return within(modal).getByRole('combobox', { name });
}

/**
 * Gets the re-parse action row from a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {HTMLElement} The re-parse action row element.
 */
export function getReparseActionRowInModal(modal: HTMLElement): HTMLElement {
  return within(modal).getByRole('button', { name: /re-parse/i }).closest('.ant-space') as HTMLElement;
}

/**
 * Gets the re-parse button from a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {HTMLElement} The re-parse button element.
 */
export function getReparseButtonInModal(modal: HTMLElement): HTMLElement {
  return within(modal).getByRole('button', { name: /re-parse/i });
}

/**
 * Gets the cancel button from the re-parse action row in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {HTMLElement} The cancel button element.
 */
export function getReparseCancelButtonInModal(modal: HTMLElement): HTMLElement {
  return within(getReparseActionRowInModal(modal)).getByRole('button', { name: /^cancel$/i });
}

/**
 * Changes a textbox value in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {RegExp} fieldName The field name pattern.
 * @param {string} value The value to set.
 * @returns {void}
 */
export function changeTextboxInModal(modal: HTMLElement, fieldName: RegExp, value: string): void {
  const textbox = getTextboxInModal(modal, fieldName);
  fireEvent.change(textbox, { target: { value } });
}

/**
 * Changes the reference document URL in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {string} newUrl The new URL value.
 * @returns {Promise<void>} Completion signal.
 */
export async function changeReferenceUrlInModal(modal: HTMLElement, newUrl: string): Promise<void> {
  const referenceUrlInput = getTextboxInModal(modal, modalFormFields.referenceUrl);
  await waitFor(() => {
    expect(referenceUrlInput).toBeEnabled();
  });
  fireEvent.change(referenceUrlInput, { target: { value: newUrl } });
}

/**
 * Changes the template document URL in a modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {string} newUrl The new URL value.
 * @returns {Promise<void>} Completion signal.
 */
export async function changeTemplateUrlInModal(modal: HTMLElement, newUrl: string): Promise<void> {
  const templateUrlInput = getTextboxInModal(modal, modalFormFields.templateUrl);
  await waitFor(() => {
    expect(templateUrlInput).toBeEnabled();
  });
  fireEvent.change(templateUrlInput, { target: { value: newUrl } });
}
