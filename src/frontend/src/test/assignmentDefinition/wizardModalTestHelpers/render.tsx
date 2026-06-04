/**
 * Render helpers for the Assignment Definition Wizard Modal tests.
 */

import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../renderWithFrontendProviders';
import type { FrontendProvidersOptions } from '../../renderWithFrontendProviders';
import {
  createMockInvalidateQueries,
} from '../wizardTestHelpers';
import { mockTopics, mockYearGroups } from '../sharedTestFixtures';
import type { AssignmentDefinition } from '../../../services/assignmentDefinition.zod';
import type { WizardModalMode, RenderWizardModalOptions, WizardModalRenderResult } from './types';

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
 * @returns {Promise<ReturnType<typeof renderWithFrontendProviders>>} Render result.
 */
async function renderModalComponent(
  mode: WizardModalMode,
  definitionKey: string | null,
  onClose: () => void,
  open: boolean,
  warmupState: FrontendProvidersOptions['warmupState']
): Promise<ReturnType<typeof renderWithFrontendProviders>> {
  const { AssignmentDefinitionWizardModal } = await import('../../../pages/AssignmentDefinitionWizardModal');

  return renderWithFrontendProviders(
    <AssignmentDefinitionWizardModal
      mode={mode}
      definitionKey={definitionKey}
      onClose={onClose}
      open={open}
    />,
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
  } = options;

  const renderResult = await renderModalComponent(
    mode,
    definitionKey,
    getOnCloseHandler(onClose),
    open,
    warmupState
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
