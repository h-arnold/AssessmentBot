/**
 * Form interaction helpers for assignment definition wizard tests.
 */

import { fireEvent, screen, within } from '@testing-library/react';

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

/**
 * Opens a named selector and chooses one option by visible label.
 *
 * @param {string} fieldLabel Accessible form label.
 * @param {string | RegExp} optionLabel Option label to select.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {Promise<void>} Completion signal.
 */
export async function chooseSelectOption(
  fieldLabel: string,
  optionLabel: string | RegExp,
  container: HTMLElement = document.body
): Promise<void> {
  // Open the dropdown by clicking on the combobox
  const normalisedFieldLabel = fieldLabel.trim().toLowerCase();
  const combobox = within(container).getByRole('combobox', {
    name: (accessibleName) => accessibleName.trim().toLowerCase() === normalisedFieldLabel,
  });
  fireEvent.mouseDown(combobox);

  // Find and click the option by its visible text
  const option = await screen.findByText(optionLabel);
  fireEvent.click(option);
}

/**
 * Click a button repeatedly.
 *
 * @param {HTMLElement} button The button element to click.
 * @param {number} count Number of times to click.
 * @returns {void}
 */
function clickButtonCount(button: HTMLElement, count: number): void {
  for (let index = 0; index < count; index++) {
    fireEvent.click(button);
  }
}

/**
 * Selects a spinbutton value by clicking the up/down buttons.
 *
 * @param {string} name Accessible name of the spinbutton.
 * @param {number} targetValue Target numeric value.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {Promise<void>} Completion signal.
 */
export async function setSpinbuttonValue(
  name: string,
  targetValue: number,
  container: HTMLElement = document.body
): Promise<void> {
  const spinbutton = within(container).getByRole('spinbutton', { name });
  const currentValue = Number(spinbutton.getAttribute('aria-valuenow') || spinbutton.textContent || 0);
  const difference = targetValue - currentValue;

  if (difference > 0) {
    const upButton = within(container).getByRole('button', { name: 'increase' });
    clickButtonCount(upButton, difference);
  } else if (difference < 0) {
    const downButton = within(container).getByRole('button', { name: 'decrease' });
    clickButtonCount(downButton, -difference);
  }
}
