import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import type { FrontendProvidersOptions } from '../renderWithFrontendProviders';
import type { QueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  chooseSelectOption,
  setTextboxValue,
  createMockInvalidateQueries,
  type TestRenderResult,
} from './wizardTestHelpers';
import { mockTopics, mockYearGroups } from './sharedTestFixtures';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';

/**
 * Assignment Definition Wizard Modal test helpers module.
 * 
 * Provides shared utilities specifically for testing AssignmentDefinitionWizardModal.
 * Use these helpers to reduce duplication in wizard modal test files.
 */

// ============================================================================
// Modal Rendering Helpers
// ============================================================================

/**
 * Mode type for the wizard modal.
 */
export type WizardModalMode = 'create' | 'update';

/**
 * Options for rendering the assignment definition wizard modal.
 */
export interface RenderWizardModalOptions {
  /** The modal mode (create or update). */
  mode: WizardModalMode;
  /** The definition key (null for create mode). */
  definitionKey: string | null;
  /** Optional onClose handler. */
  onClose?: () => void;
  /** Whether the modal is open. */
  open?: boolean;
  /** Optional mock topics to use. */
  topics?: unknown[];
  /** Optional mock year groups to use. */
  yearGroups?: unknown[];
  /** Optional mock cohorts to use. */
  cohorts?: unknown[];
  /** Optional mock assignment definition for update mode. */
  assignmentDefinition?: AssignmentDefinition;
  /** Optional flag to mock invalidateQueries (default: true). */
  mockInvalidateQueries?: boolean;
  /** Optional warmup state override. */
  warmupState?: FrontendProvidersOptions['warmupState'];
  /** Whether to wait for the interactive form fields (default: true). */
  waitForFormFields?: boolean;
  /** Optional initial values to pre-populate form fields in create mode. */
  initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>;
  /** Optional callback called after successful final save in create mode. */
  onCreateSuccess?: (definitionKey: string) => void;
}

/**
 * Result of rendering the wizard modal with test utilities.
 */
export interface WizardModalRenderResult extends TestRenderResult {
  /** The rendered modal element. */
  modal: HTMLElement;
}

/**
 * Gets the modal name pattern based on mode.
 *
 * @param {WizardModalMode} mode The modal mode.
 * @returns {RegExp} The modal name pattern.
 */
function getModalNamePattern(mode: WizardModalMode): RegExp {
  return mode === 'create' ? /create assignment/i : /update assignment/i;
}

/**
 * Renders the wizard modal component.
 *
 * @param {WizardModalMode} mode The modal mode.
 * @param {string | null} definitionKey The definition key.
 * @param {() => void} onClose The onClose handler.
 * @param {boolean} open Whether the modal is open.
 * @param {FrontendProvidersOptions['warmupState']} warmupState Warmup state.
 * @param {Record<string, unknown>} [extraProperties] Optional extra props to pass to the component.
 * @returns {Promise<ReturnType<typeof renderWithFrontendProviders>>} Render result.
 */
async function renderModalComponent(
  mode: WizardModalMode,
  definitionKey: string | null,
  onClose: () => void,
  open: boolean,
  warmupState: FrontendProvidersOptions['warmupState'],
  extraProperties?: Record<string, unknown>
): Promise<ReturnType<typeof renderWithFrontendProviders>> {
  const { AssignmentDefinitionWizardModal } = await import('../../features/assignmentWizard/AssignmentDefinitionWizardModal');

  const componentProperties: Record<string, unknown> = {
    mode,
    definitionKey,
    onClose,
    open,
    ...extraProperties,
  };

  return renderWithFrontendProviders(
    React.createElement(AssignmentDefinitionWizardModal, componentProperties as React.ComponentPropsWithoutRef<typeof AssignmentDefinitionWizardModal> & Record<string, unknown>),
    { warmupState }
  );
}

/**
 * Sets up invalidateQueries mock on the query client.
 *
 * @param {QueryClient} queryClient The query client.
 * @param {boolean} shouldMock Whether to mock invalidateQueries.
 * @returns {ReturnType<typeof createMockInvalidateQueries>} The mock function.
 */
function setupInvalidateQueriesMock(
  queryClient: QueryClient,
  shouldMock: boolean
): ReturnType<typeof createMockInvalidateQueries> {
  const mockInvalidate = createMockInvalidateQueries();
  if (shouldMock) {
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidate);
  }
  return mockInvalidate;
}

/**
 * Gets the onClose handler from options.
 *
 * @param {() => void | undefined} onClose Optional onClose handler.
 * @returns {() => void} The onClose handler.
 */
function getOnCloseHandler(onClose: (() => void) | undefined): () => void {
  return onClose ?? (() => {});
}

/**
 * Sets up query client with provided data.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {unknown[]} topics Topics data.
 * @param {unknown[]} yearGroups Year groups data.
 * @param {unknown[]} cohorts Cohorts data.
 * @param {AssignmentDefinition | undefined} assignmentDefinition Assignment definition.
 * @param {string | null} definitionKey Definition key.
 * @returns {void}
 */
function setupQueryClientData(
  queryClient: QueryClient,
  topics: unknown[],
  yearGroups: unknown[],
  cohorts: unknown[],
  assignmentDefinition: AssignmentDefinition | undefined,
  definitionKey: string | null
): void {
  queryClient.setQueryData(queryKeys.assignmentTopics(), topics);
  queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  queryClient.setQueryData(queryKeys.cohorts(), cohorts);

  if (assignmentDefinition && definitionKey) {
    queryClient.setQueryData(
      queryKeys.assignmentDefinitionByKey(definitionKey),
      assignmentDefinition
    );
  }
}

/**
 * Waits for form fields to be present in the modal.
 *
 * @param {HTMLElement} modal The modal element.
 * @returns {Promise<void>} Completion signal.
 */
async function waitForFormFields(modal: HTMLElement): Promise<void> {
  await waitFor(() => {
    // Wait for all main form fields to be present
    expect(within(modal).getByRole('textbox', { name: /assignment title/i })).toBeInTheDocument();
    expect(within(modal).getByRole('combobox', { name: /assignment topic/i })).toBeInTheDocument();
    expect(within(modal).getByRole('combobox', { name: /assignment year group/i })).toBeInTheDocument();
    expect(within(modal).getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(within(modal).getByRole('textbox', { name: /template document url/i })).toBeInTheDocument();
  });
}

/**
 * Waits for interactive form fields when required by a test.
 *
 * @param {HTMLElement} modal The modal element.
 * @param {boolean} shouldWaitForFormFields Whether to wait for interactive fields.
 * @returns {Promise<void>} Completion signal.
 */
async function waitForInteractiveFieldsIfNeeded(
  modal: HTMLElement,
  shouldWaitForFormFields: boolean
): Promise<void> {
  if (shouldWaitForFormFields) {
    await waitForFormFields(modal);
  }
}

/**
 * Renders the AssignmentDefinitionWizardModal with common test setup.
 * Consolidates the repeated pattern of rendering with providers, mocking query client,
 * and setting up common query data.
 *
 * @param {RenderWizardModalOptions} options Render options.
 * @returns {Promise<WizardModalRenderResult>} Render result with modal and utilities.
 */
export async function renderWizardModal(
  options: RenderWizardModalOptions
): Promise<WizardModalRenderResult> {
  const {
    mode,
    definitionKey,
    onClose,
    open = true,
    topics = mockTopics,
    yearGroups = mockYearGroups,
    cohorts = [],
    assignmentDefinition,
    mockInvalidateQueries = true,
    warmupState,
    waitForFormFields: shouldWaitForFormFields = true,
    initialValues,
    onCreateSuccess,
  } = options;

  const renderResult = await renderModalComponent(
    mode,
    definitionKey,
    getOnCloseHandler(onClose),
    open,
    warmupState,
    { initialValues, onCreateSuccess } as Record<string, unknown>
  );

  const { queryClient } = renderResult;
  const mockInvalidate = setupInvalidateQueriesMock(queryClient, mockInvalidateQueries);

  const modalName = getModalNamePattern(mode);
  const modal = await waitFor(() => screen.getByRole('dialog', { name: modalName }));

  // Wait for all form fields to be present
  await waitForInteractiveFieldsIfNeeded(modal, shouldWaitForFormFields);

  // Set query data after modal appears (matches original test pattern)
  setupQueryClientData(queryClient, topics, yearGroups, cohorts, assignmentDefinition, definitionKey);

  return {
    ...renderResult,
    mockInvalidateQueries: mockInvalidate,
    modal,
  };
}

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
 * @param {WizardModalMode} mode The modal mode.
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForWizardModal(mode: WizardModalMode): Promise<HTMLElement> {
  return mode === 'create' ? waitForCreateModal() : waitForUpdateModal();
}

// ============================================================================
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

// ============================================================================
// Assertion Helpers
// ============================================================================

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

// ============================================================================
// Form State Assertions
// ============================================================================

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
