import { fireEvent } from '@testing-library/react';

/**
 * Assignment definition wizard form-field interaction helpers.
 *
 * Owns the shared `setTextboxValue` contract used by wizard and modal specs to
 * change an input value in a single form change event.
 */

/**
 * Sets a textbox value in one form change event.
 *
 * @param {HTMLElement} inputElement The textbox to update.
 * @param {string} value The value to set.
 * @returns {void}
 */
export function setTextboxValue(inputElement: HTMLElement, value: string): void {
  fireEvent.change(inputElement, { target: { value } });
}
