import type React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import type { AssignmentDefinitionPartialRow } from './assignmentDefinitionTestFixtures';

/**
 * Assignment definition assignments page test helpers module.
 * 
 * Provides shared utilities specifically for testing AssignmentsPage.
 * Use these helpers to reduce duplication in assignments page test files.
 */

// ============================================================================
// Query Client Setup Helpers
// ============================================================================

/**
 * Options for setting up query client with assignment data.
 */
export interface SetupQueryClientOptions {
  /** Assignment partial rows to set (default: readyAssignmentPartialRows). */
  partialRows?: AssignmentDefinitionPartialRow[];
  /** Mock topics to set. */
  topics?: unknown[];
  /** Mock year groups to set. */
  yearGroups?: unknown[];
  /** Mock cohorts to set. */
  cohorts?: unknown[];
  /** Mock assignment definition for by-key query. */
  assignmentDefinition?: unknown;
  /** Definition key for by-key query. */
  definitionKey?: string;
}

/**
 * Sets a single query data entry if the value is defined.
 *
 * @param {QueryClient} queryClient The query client.
 * @param {QueryKey} queryKey The query key.
 * @param {unknown} data The data to set.
 * @returns {void}
 */
function setQueryDataIfDefined(
  queryClient: QueryClient,
  queryKey: QueryKey,
  data: unknown
): void {
  if (data !== undefined) {
    queryClient.setQueryData(queryKey, data);
  }
}

/**
 * Sets up query client with common assignment definition query data.
 * Consolidates repeated queryClient.setQueryData calls.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {SetupQueryClientOptions} options Setup options.
 * @returns {void}
 */
export function setupQueryClientWithAssignmentsData(
  queryClient: QueryClient,
  options: SetupQueryClientOptions = {}
): void {
  const { partialRows, topics, yearGroups, cohorts, assignmentDefinition, definitionKey } = options;

  setQueryDataIfDefined(queryClient, queryKeys.assignmentDefinitionPartials(), partialRows);
  setQueryDataIfDefined(queryClient, queryKeys.assignmentTopics(), topics);
  setQueryDataIfDefined(queryClient, queryKeys.yearGroups(), yearGroups);
  setQueryDataIfDefined(queryClient, queryKeys.cohorts(), cohorts);

  if (assignmentDefinition !== undefined && definitionKey !== undefined) {
    queryClient.setQueryData(
      queryKeys.assignmentDefinitionByKey(definitionKey),
      assignmentDefinition
    );
  }
}

// ============================================================================
// Rendering Helpers
// ============================================================================

/**
 * Result of rendering AssignmentsPage with test utilities.
 */
export interface AssignmentsPageRenderResult {
  queryClient: QueryClient;
}

/**
 * Renders AssignmentsPage with common test setup.
 *
 * @param {React.ReactElement} component The component to render (defaults to AssignmentsPage when passed from test).
 * @returns {AssignmentsPageRenderResult} Render result with utilities.
 */
export function renderAssignmentsPage(component: React.ReactElement): AssignmentsPageRenderResult {
  const renderResult = renderWithFrontendProviders(component);
  return {
    queryClient: renderResult.queryClient,
  };
}

/**
 * Renders AssignmentsPage with query client pre-populated with data.
 *
 * @param {React.ReactElement} component The component to render.
 * @param {SetupQueryClientOptions} options Query data setup options.
 * @returns {Promise<AssignmentsPageRenderResult>} Render result with utilities.
 */
export async function renderAssignmentsPageWithData(
  component: React.ReactElement,
  options: SetupQueryClientOptions = {}
): Promise<AssignmentsPageRenderResult> {
  const renderResult = renderAssignmentsPage(component);
  setupQueryClientWithAssignmentsData(renderResult.queryClient, options);
  return renderResult;
}

// ============================================================================
// Table Helpers
// ============================================================================

/**
 * Gets the assignment definitions table.
 *
 * @returns {Promise<HTMLElement>} The table element.
 */
export async function getAssignmentsTable(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: 'Assignment definitions table' });
}

/**
 * Options for finding a row in the assignments table.
 */
export interface FindRowOptions {
  /** Row name pattern (passed to getByRole 'row' name). */
  name: string | RegExp;
  /** Container to search within (defaults to document). */
  container?: HTMLElement;
}

/**
 * Finds a row in the assignments table by name.
 *
 * @param {FindRowOptions} options Find options.
 * @returns {HTMLElement} The row element.
 */
export function findRowInAssignmentsTable(options: FindRowOptions): HTMLElement {
  const { name, container = document.body } = options;
  return within(container).getByRole('row', { name });
}

/**
 * Finds a row in the assignments table by name and waits for it.
 *
 * @param {FindRowOptions} options Find options.
 * @returns {Promise<HTMLElement>} The row element.
 */
export async function waitForRowInAssignmentsTable(options: FindRowOptions): Promise<HTMLElement> {
  const { name, container = document.body } = options;
  return within(container).findByRole('row', { name });
}

/**
 * Clicks the update button in a specified row.
 *
 * @param {HTMLElement} row The row element containing the update button.
 * @returns {void}
 */
export function clickUpdateButtonInRow(row: HTMLElement): void {
  fireEvent.click(within(row).getByRole('button', { name: /update/i }));
}

/**
 * Finds a row by name and clicks its update button.
 * Consolidates the common pattern of finding a row and clicking update.
 *
 * @param {string | RegExp} rowName Row name pattern.
 * @param {HTMLElement} [container] Optional container to search within.
 * @returns {Promise<HTMLElement>} The row that was clicked.
 */
export async function findRowAndClickUpdate(
  rowName: string | RegExp,
  container?: HTMLElement
): Promise<HTMLElement> {
  const table = container ?? (await getAssignmentsTable());
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  clickUpdateButtonInRow(row);
  return row;
}

/**
 * Gets the delete button in a specified row.
 *
 * @param {HTMLElement} row The row element.
 * @returns {HTMLElement} The delete button element.
 */
export function getDeleteButtonInRow(row: HTMLElement): HTMLElement {
  return within(row).getByRole('button', { name: /delete/i });
}

/**
 * Finds a row by name and clicks its delete button.
 *
 * @param {string | RegExp} rowName Row name pattern.
 * @param {HTMLElement} [container] Optional container to search within.
 * @returns {Promise<HTMLElement>} The row that was clicked.
 */
export async function findRowAndClickDelete(
  rowName: string | RegExp,
  container?: HTMLElement
): Promise<HTMLElement> {
  const table = container ?? (await getAssignmentsTable());
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  fireEvent.click(getDeleteButtonInRow(row));
  return row;
}

// ============================================================================
// Modal Helpers
// ============================================================================

/**
 * Waits for and returns the create assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForCreateAssignmentModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /create assignment/i }));
}

/**
 * Waits for and returns the update assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForUpdateAssignmentModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /update assignment/i }));
}

/**
 * Waits for and returns the delete confirmation dialog.
 *
 * @returns {Promise<HTMLElement>} The dialog element.
 */
export async function waitForDeleteDialog(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: 'Delete assignment definition' }));
}

/**
 * Clicks the create assignment button.
 *
 * @returns {void}
 */
export function clickCreateAssignmentButton(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));
}

// ============================================================================
// Form Field Helpers
// ============================================================================

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

// ============================================================================
// Assertion Helpers
// ============================================================================

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

// ============================================================================
// Composite Setup Helpers for Update Workflow
// ============================================================================

/**
 * Sets up query client data, finds the specified row, clicks update, and waits for the modal.
 * Consolidates the common pattern: setupQueryClientWithAssignmentsData + getAssignmentsTable + 
 * findRowInAssignmentsTable + clickUpdateButtonInRow + waitForUpdateAssignmentModal.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {SetupQueryClientOptions} setupOptions Query data setup options.
 * @param {string | RegExp} [rowName=/algebra foundations/i] Row name pattern to find.
 * @returns {Promise<HTMLElement>} The update assignment modal element.
 */
export async function openUpdateAssignmentModal(
  queryClient: QueryClient,
  setupOptions: SetupQueryClientOptions = {},
  rowName: string | RegExp = /algebra foundations/i
): Promise<HTMLElement> {
  setupQueryClientWithAssignmentsData(queryClient, setupOptions);
  
  const table = await getAssignmentsTable();
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  clickUpdateButtonInRow(row);
  
  return waitForUpdateAssignmentModal();
}

/**
 * Opens update modal and changes the reference URL, then verifies re-parse prompt is shown.
 * Consolidates: openUpdateAssignmentModal + changeReferenceUrlInModal + 
 * assertMetadataAndTaskWeightingsDisabledInModal + verify reparse prompt.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {SetupQueryClientOptions} setupOptions Query data setup options.
 * @param {string} [newReferenceUrl='https://docs.google.com/presentation/d/new-ref'] The new reference URL.
 * @param {string | RegExp} [rowName=/algebra foundations/i] Row name pattern to find.
 * @returns {Promise<{ modal: HTMLElement; reparseActionRow: HTMLElement }>} Modal and reparse action row elements.
 */
export async function openUpdateModalAndChangeReferenceUrl(
  queryClient: QueryClient,
  setupOptions: SetupQueryClientOptions = {},
  newReferenceUrl: string = 'https://docs.google.com/presentation/d/new-ref',
  rowName: string | RegExp = /algebra foundations/i
): Promise<{ modal: HTMLElement; reparseActionRow: HTMLElement }> {
  const modal = await openUpdateAssignmentModal(queryClient, setupOptions, rowName);
  
  await changeReferenceUrlInModal(modal, newReferenceUrl);
  await assertMetadataAndTaskWeightingsDisabledInModal(modal);
  
  expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
  const reparseActionRow = getReparseActionRowInModal(modal);
  expect(within(reparseActionRow).getByRole('button', { name: /re-parse/i })).toBeInTheDocument();
  expect(within(reparseActionRow).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  
  return { modal, reparseActionRow };
}
