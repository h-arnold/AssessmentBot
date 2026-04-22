import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { useState } from 'react';
import React from 'react';

/* eslint-disable react-refresh/only-export-components */
// Note: This file contains test helper functions, not React components.
// The CreateModalResetHarness function uses React hooks (useState) to manage
// modal open/close state for testing purposes, which triggers this ESLint rule.
// This disable is justified as we're creating test utilities that need React
// state management capabilities, not production components.

/**
 * Common test helpers for modal components in the classes feature.
 */

/**
 * Changes the course-length control value.
 *
 * @param {string} value Input value.
 * @returns {void}
 */
export function changeCourseLength(value: string): void {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Course length' }), {
    target: { value },
  });
}

/**
 * Opens a named selector and chooses one option by visible label.
 *
 * @param {string} fieldLabel Accessible form label.
 * @param {string} optionLabel Option label to select.
 * @returns {Promise<void>} Completion signal.
 */
export async function chooseOption(fieldLabel: string, optionLabel: string): Promise<void> {
  // Open the dropdown by clicking on the combobox
  fireEvent.mouseDown(screen.getByRole('combobox', { name: fieldLabel }));
  
  // Find and click the option by its visible text
  // The option might be in a dropdown menu, so we need to find it in the document
  const option = await screen.findByText(optionLabel);
  fireEvent.click(option);
}

/**
 * Creates a harness component that controls modal open state for testing reset-on-cancel behaviour.
 *
 * @param {React.ReactNode} modalComponent The modal component to test.
 * @returns {React.ReactNode} Harness output.
 */
export function CreateModalResetHarness({ modalComponent }: Readonly<{ modalComponent: React.ReactNode }>): React.ReactNode {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      {React.cloneElement(modalComponent as React.ReactElement, { open, onCancel: () => setOpen(false) })}
    </>
  );
}

/**
 * Asserts that a validation message is displayed.
 *
 * @param {string} message The validation message to check.
 * @returns {Promise<void>}
 */
export async function assertValidationMessage(message: string): Promise<void> {
  expect(await screen.findByText(message)).toBeInTheDocument();
}

/**
 * Asserts that an error message is displayed.
 *
 * @param {string} message The error message to check.
 * @returns {Promise<void>}
 */
export async function assertErrorMessage(message: string): Promise<void> {
  expect(await screen.findByText(message)).toBeInTheDocument();
}

/**
 * Asserts that a control is disabled.
 *
 * @param {string} role The role of the control.
 * @param {string} name The accessible name of the control.
 * @returns {void}
 */
export function assertControlDisabled(role: string, name: string): void {
  expect(screen.getByRole(role, { name })).toBeDisabled();
}

/**
 * Creates a mock confirm function that can be used to test modal submission.
 *
 * @returns {vi.Mock} Mocked confirm function.
 */
export function createMockConfirm(): vi.Mock {
  return vi.fn().mockImplementation(async () => {});
}

/**
 * Creates a mock confirm function that rejects with an error.
 *
 * @param {Error} error The error to reject with.
 * @returns {vi.Mock} Mocked confirm function.
 */
export function createMockConfirmWithError(error: Error): vi.Mock {
  return vi.fn().mockRejectedValue(error);
}