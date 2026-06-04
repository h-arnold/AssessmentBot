/**
 * Assertion helpers for the Assignment Definition Wizard Modal tests.
 */

import { waitFor, within } from '@testing-library/react';
import type { ModalElementQueries } from './types';

/**
 * Asserts that task editing is hidden (create mode before parse).
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertTaskEditingHidden(container: HTMLElement | ModalElementQueries): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByText(/parsing is required/i)).toBeInTheDocument();
  expect(within(modal).queryByRole('table', { name: /task weightings/i })).not.toBeInTheDocument();
  expect(within(modal).queryByRole('spinbutton', { name: /assignment weighting/i })).not.toBeInTheDocument();
}

/**
 * Asserts that the parse button is present.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertParseButtonPresent(container: HTMLElement | ModalElementQueries): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeInTheDocument();
}

/**
 * Asserts that the shared edit surface is hydrated (task table and assignment weighting visible).
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertSharedEditSurfaceHydrated(
  container: HTMLElement | ModalElementQueries
): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByRole('table', { name: /task weightings/i })).toBeInTheDocument();
  expect(within(modal).getByRole('spinbutton', { name: /assignment weighting/i })).toBeInTheDocument();
}

/**
 * Asserts that document change prompt is visible.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertDocumentChangePromptVisible(
  container: HTMLElement | ModalElementQueries
): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
}

/**
 * Asserts that document change prompt is not visible.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertDocumentChangePromptNotVisible(
  container: HTMLElement | ModalElementQueries
): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).queryByText(/document changed/i)).not.toBeInTheDocument();
}

/**
 * Asserts that metadata and task weighting inputs are disabled.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertMetadataAndTaskWeightingsDisabled(
  container: HTMLElement | ModalElementQueries
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;

  await waitFor(() => {
    const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
    const weightingInput = within(modal).getByRole('spinbutton', { name: /assignment weighting/i });
    const taskWeightingInputs = within(modal).getAllByRole('spinbutton');

    expect(titleInput).toBeDisabled();
    expect(weightingInput).toBeDisabled();
    // All task weighting inputs should be disabled
    taskWeightingInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
}

/**
 * Asserts that metadata and task weighting inputs are enabled.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertMetadataAndTaskWeightingsEnabled(
  container: HTMLElement | ModalElementQueries
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;

  await waitFor(() => {
    const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
    const weightingInput = within(modal).getByRole('spinbutton', { name: /assignment weighting/i });
    expect(titleInput).toBeEnabled();
    expect(weightingInput).toBeEnabled();
  });
}

/**
 * Asserts that document URL fields are disabled.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {Promise<void>} Completion signal.
 */
export async function assertDocumentUrlFieldsDisabled(
  container: HTMLElement | ModalElementQueries
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;

  await waitFor(() => {
    const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i });
    const templateUrlInput = within(modal).getByRole('textbox', { name: /template document url/i });
    expect(referenceUrlInput).toBeDisabled();
    expect(templateUrlInput).toBeDisabled();
  });
}

/**
 * Asserts that all required form fields are present.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertAllRequiredFieldsPresent(
  container: HTMLElement | ModalElementQueries
): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByRole('textbox', { name: /assignment title/i })).toBeInTheDocument();
  expect(within(modal).getByRole('combobox', { name: /assignment topic/i })).toBeInTheDocument();
  expect(within(modal).getByRole('combobox', { name: /assignment year group/i })).toBeInTheDocument();
  expect(within(modal).getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
  expect(within(modal).getByRole('textbox', { name: /template document url/i })).toBeInTheDocument();
}

/**
 * Asserts that the parse button is disabled.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertParseButtonDisabled(container: HTMLElement | ModalElementQueries): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeDisabled();
}

/**
 * Asserts that the parse button is enabled.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {void}
 */
export function assertParseButtonEnabled(container: HTMLElement | ModalElementQueries): void {
  const modal = 'modal' in container ? container.modal : container;
  expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeEnabled();
}

/**
 * Asserts that a specific task is visible in the task table.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string | RegExp} taskTitle The task title to find.
 * @returns {void}
 */
export function assertTaskVisible(
  container: HTMLElement | ModalElementQueries,
  taskTitle: string | RegExp
): void {
  const modal = 'modal' in container ? container.modal : container;
  const taskTable = within(modal).getByRole('table', { name: /task weightings/i });
  expect(within(taskTable).getByText(taskTitle)).toBeInTheDocument();
}

/**
 * Asserts that a specific task is NOT visible in the task table.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string | RegExp} taskTitle The task title to check.
 * @returns {void}
 */
export function assertTaskNotVisible(
  container: HTMLElement | ModalElementQueries,
  taskTitle: string | RegExp
): void {
  const modal = 'modal' in container ? container.modal : container;
  const taskTable = within(modal).getByRole('table', { name: /task weightings/i });
  expect(within(taskTable).queryByText(taskTitle)).not.toBeInTheDocument();
}
