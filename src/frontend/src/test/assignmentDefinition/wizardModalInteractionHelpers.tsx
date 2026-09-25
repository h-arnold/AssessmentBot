import { act, within } from '@testing-library/react';
import { chooseSelectOption, setTextboxValue } from './wizardTestHelpers';

/**
 * Accessible name of the Ant Design modal's own close control.
 */
const MODAL_CLOSE_CONTROL_NAME = /^close$/i;

/**
 * Ant Design modal footer region, used to disambiguate the footer Cancel from the
 * document-change action-row Cancel when a document change is pending.
 */
const MODAL_FOOTER_SELECTOR = '.ant-modal-footer';

/**
 * rc-dialog wrapper element that owns the mask (backdrop) click path.
 */
const MODAL_WRAP_SELECTOR = '.ant-modal-wrap';

// Element Query Helpers
// ============================================================================

/**
 * Container for modal element queries.
 */
export interface ModalElementQueries {
  modal: HTMLElement;
}

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
 * Gets only the per-task weighting spinbuttons rendered inside the task weightings table.
 *
 * @remarks
 * `getAllTaskWeightingInputs` also returns the assignment-weighting spinbutton, so
 * table-scoped queries are required whenever a test needs to assert the task
 * weightings on their own.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement[]} Array of per-task weighting spinbutton elements.
 */
export function getTaskWeightingInputs(
  container: HTMLElement | ModalElementQueries
): HTMLElement[] {
  return within(getTaskTable(container)).getAllByRole('spinbutton');
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

/**
 * Gets the modal's own close control from the top-right of the dialog chrome.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The close control element.
 */
export function getModalCloseButton(
  container: HTMLElement | ModalElementQueries
): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  return within(modal).getByRole('button', { name: MODAL_CLOSE_CONTROL_NAME });
}

/**
 * Gets the footer's Cancel action from the wizard footer.
 *
 * @remarks
 * Scoped to the modal footer region because a pending document change renders a
 * second, identically named Cancel in the document-change action row. The footer
 * is the surface wired to the owning modal's dismissal, so the region is the
 * accessible contract being asserted here.
 *
 * @param {HTMLElement | ModalElementQueries} container The modal or container object.
 * @returns {HTMLElement} The footer Cancel element.
 */
export function getFooterCancelButton(
  container: HTMLElement | ModalElementQueries
): HTMLElement {
  const modal = 'modal' in container ? container.modal : container;
  const footer = modal.querySelector<HTMLElement>(MODAL_FOOTER_SELECTOR);
  if (!footer) {
    throw new TypeError('Expected the wizard modal to render a footer region.');
  }
  return within(footer).getByRole('button', { name: /^cancel$/i });
}

// ============================================================================
// Modal Dismissal Helpers
// ============================================================================

/**
 * Dismisses a modal through the real rc-dialog mask (backdrop) click path.
 *
 * @remarks
 * rc-dialog only closes from the backdrop when the pointer gesture both starts and
 * ends on `.ant-modal-wrap` itself, so a mousedown-only shortcut proves nothing and
 * `fireEvent.click` on the mask is unreliable for portal-mounted content. This helper
 * dispatches the native mousedown -> mouseup -> click sequence on the wrapper, which
 * is the only path that exercises the library's mask-closable handling.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @returns {Promise<void>} Completion signal.
 */
export async function dismissModalByMaskClick(dialog: HTMLElement): Promise<void> {
  const wrap = dialog.closest<HTMLElement>(MODAL_WRAP_SELECTOR);
  if (!wrap) {
    throw new TypeError(`Expected the dialog to be wrapped in ${MODAL_WRAP_SELECTOR}.`);
  }

  await act(async () => {
    wrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// ============================================================================
// Form Interaction Helpers
// ============================================================================

/**
 * Options for filling required fields in the wizard form.
 */
export interface FillRequiredFieldsOptions {
  /** The title to set (default: 'Test Assessment'). */
  title?: string;
  /** The reference URL to set (default: 'https://docs.google.com/presentation/d/test-ref'). */
  referenceUrl?: string;
  /** The template URL to set (default: 'https://docs.google.com/presentation/d/test-tpl'). */
  templateUrl?: string;
  /** The topic to select (default: 'Algebra'). */
  topic?: string | RegExp;
  /** The year group to select (default: 'Year 10'). */
  yearGroup?: string | RegExp;
}

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

// ============================================================================
// State Change Helpers
// ============================================================================

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
