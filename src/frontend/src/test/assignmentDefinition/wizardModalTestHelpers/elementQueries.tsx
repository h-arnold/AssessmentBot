/**
 * Element query and form interaction utilities for the Assignment Definition Wizard Modal tests.
 */

import { screen, waitFor, within } from '@testing-library/react';
import { setTextboxValue, chooseSelectOption } from '../wizardTestHelpers';
import type { ModalElementQueries, FillRequiredFieldsOptions } from './types';

// ============================================================================
// Modal Waiting Helpers
// ============================================================================

/**
 * Waits for and returns the create assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForCreateModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /create assignment/i }));
}

/**
 * Waits for and returns the update assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForUpdateModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /update assignment/i }));
}

/**
 * Waits for and returns a modal by mode.
 *
 * @param {'create' | 'update'} mode The modal mode.
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForWizardModal(mode: 'create' | 'update'): Promise<HTMLElement> {
  return mode === 'create' ? waitForCreateModal() : waitForUpdateModal();
}

// ============================================================================
// Element Query Helpers
// ============================================================================

/**
 * Gets common form elements from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {object} Object with common form elements.
 */
export function getFormElements(container: HTMLElement | ModalElementQueries): {
  titleInput: HTMLElement;
  referenceUrlInput: HTMLElement;
  templateUrlInput: HTMLElement;
  topicSelect: HTMLElement;
  yearGroupSelect: HTMLElement;
} {
  const modal = 'modal' in container ? container.modal : container;

  return {
    titleInput: within(modal).getByRole('textbox', { name: /assignment title/i }),
    referenceUrlInput: within(modal).getByRole('textbox', { name: /reference document url/i }),
    templateUrlInput: within(modal).getByRole('textbox', { name: /template document url/i }),
    topicSelect: within(modal).getByRole('combobox', { name: /assignment topic/i }),
    yearGroupSelect: within(modal).getByRole('combobox', { name: /assignment year group/i }),
  };
}

/**
 * Gets the parse button from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The parse button element.
 */
export function getParseButton(container: HTMLElement | ModalElementQueries): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('button', { name: /parse and continue/i });
}

/**
 * Gets the save button from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The save button element.
 */
export function getSaveButton(container: HTMLElement | ModalElementQueries): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('button', { name: /save/i });
}

/**
 * Gets the task weightings table from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The task weightings table element.
 */
export function getTaskTable(container: HTMLElement | ModalElementQueries): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('table', { name: /task weightings/i });
}

/**
 * Gets the assignment weighting spinbutton from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The assignment weighting spinbutton element.
 */
export function getAssignmentWeightingInput(
  container: HTMLElement | ModalElementQueries
): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('spinbutton', { name: /assignment weighting/i });
}

/**
 * Gets all task weighting spinbuttons from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement[]} Array of task weighting spinbutton elements.
 */
export function getAllTaskWeightingInputs(
  container: HTMLElement | ModalElementQueries
): HTMLElement[] {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getAllByRole('spinbutton');
}

/**
 * Gets the re-parse button from the modal.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The re-parse button element.
 */
export function getReparseButton(container: HTMLElement | ModalElementQueries): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('button', { name: /re-parse/i });
}

/**
 * Gets the re-parse action row (contains re-parse and cancel buttons).
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The re-parse action row element.
 */
export function getReparseActionRow(
  container: HTMLElement | ModalElementQueries
): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('button', { name: /re-parse/i }).closest('.ant-space') as HTMLElement;
}

/**
 * Gets the cancel button from the re-parse action row.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The cancel button element.
 */
export function getReparseCancelButton(
  container: HTMLElement | ModalElementQueries
): HTMLElement {
  const reparseActionRow = getReparseActionRow(container);
  return within(reparseActionRow).getByRole('button', { name: /^cancel$/i });
}

// ============================================================================
// Form Interaction Helpers
// ============================================================================

/**
 * Extracts container modal from input.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The modal element.
 */
function extractModal(container: HTMLElement | ModalElementQueries): HTMLElement {
  return 'modal' in container ? container.modal : container;
}

/**
 * Fills all required fields in the wizard form.
 * Uses direct setTextboxValue for all fields wrapped in act() for reliability.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {FillRequiredFieldsOptions} options Field value options.
 * @returns {Promise<void>} Completion signal.
 */
export async function fillRequiredFields(
  container: HTMLElement | ModalElementQueries,
  options: FillRequiredFieldsOptions = {}
): Promise<void> {
  const {
    title = 'Test Assessment',
    referenceUrl = 'https://docs.google.com/presentation/d/test-ref',
    templateUrl = 'https://docs.google.com/presentation/d/test-tpl',
    topic = 'Algebra',
    yearGroup,
  } = options;

  const modal = extractModal(container);
  const { titleInput, referenceUrlInput, templateUrlInput } = getFormElements(modal);

  // Set textbox values
  setTextboxValue(titleInput, title);
  setTextboxValue(referenceUrlInput, referenceUrl);
  setTextboxValue(templateUrlInput, templateUrl);

  // Select topic and year group
  await chooseSelectOption('Assignment Topic', topic, modal);
  if (yearGroup !== undefined) {
    await chooseSelectOption('Assignment Year Group', yearGroup, modal);
  }
}

/**
 * Selects a topic by label.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string | RegExp} topicLabel The topic label to select.
 * @returns {Promise<void>} Completion signal.
 */
export async function selectTopic(
  container: HTMLElement | ModalElementQueries,
  topicLabel: string | RegExp
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;
  await chooseSelectOption('Assignment Topic', topicLabel, modal);
}

/**
 * Selects a year group by label.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string | RegExp} yearGroupLabel The year group label to select.
 * @returns {Promise<void>} Completion signal.
 */
export async function selectYearGroup(
  container: HTMLElement | ModalElementQueries,
  yearGroupLabel: string | RegExp
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;
  await chooseSelectOption('Assignment Year Group', yearGroupLabel, modal);
}

/**
 * Changes the reference document URL.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string} newUrl The new URL to set.
 * @returns {Promise<void>} Completion signal.
 */
export async function changeReferenceUrl(
  container: HTMLElement | ModalElementQueries,
  newUrl: string
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;
  const { referenceUrlInput } = getFormElements(modal);
  setTextboxValue(referenceUrlInput, newUrl);
}

/**
 * Changes the template document URL.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @param {string} newUrl The new URL to set.
 * @returns {Promise<void>} Completion signal.
 */
export async function changeTemplateUrl(
  container: HTMLElement | ModalElementQueries,
  newUrl: string
): Promise<void> {
  const modal = 'modal' in container ? container.modal : container;
  const { templateUrlInput } = getFormElements(modal);
  setTextboxValue(templateUrlInput, newUrl);
}

/**
 * Gets the current value of the reference URL input.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {string} The current value.
 */
export function getReferenceUrlValue(
  container: HTMLElement | ModalElementQueries
): string {
  const modal = 'modal' in container ? container.modal : container;
  const referenceUrlInput = within(modal).getByRole('textbox', {
    name: /reference document url/i,
  }) as HTMLInputElement;
  return referenceUrlInput.value;
}

/**
 * Gets the current value of the template URL input.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {string} The current value.
 */
export function getTemplateUrlValue(container: HTMLElement | ModalElementQueries): string {
  const modal = 'modal' in container ? container.modal : container;
  const templateUrlInput = within(modal).getByRole('textbox', {
    name: /template document url/i,
  }) as HTMLInputElement;
  return templateUrlInput.value;
}
