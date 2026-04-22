import { fireEvent, screen } from '@testing-library/react';
import React, { useState } from 'react';

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
 * @template TProperties
 * @param {Readonly<{ modalComponent: React.ReactElement<TProperties> }>} properties Test harness properties.
 * @returns {React.ReactNode} Harness output.
 */
export function CreateModalResetHarness<TProperties extends object>({ modalComponent }: Readonly<{ modalComponent: React.ReactElement<TProperties> }>): React.ReactNode {
  const [open, setOpen] = useState(true);
  
  const handleReopen = () => setOpen(true);
  const handleCancel = () => setOpen(false);
  
  // Create a new element with updated props, preserving type safety
  const ModalComponent = modalComponent.type;
  const updatedProperties = {
    ...modalComponent.props,
    open: open as TProperties extends { open: infer TOpen } ? TOpen : boolean,
    onCancel: handleCancel as TProperties extends { onCancel: infer TOnCancel } ? TOnCancel : (() => void),
    key: 'test-harness-modal',
  };
  
  return (
    <>
      <button type="button" onClick={handleReopen} aria-label="Reopen modal">
        Reopen
      </button>
      <ModalComponent {...updatedProperties} />
    </>
  );
}

/**
 * Asserts that a message is displayed in the document.
 *
 * @param {string} message The message to check.
 * @returns {Promise<void>}
 */
export async function assertMessage(message: string): Promise<void> {
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

