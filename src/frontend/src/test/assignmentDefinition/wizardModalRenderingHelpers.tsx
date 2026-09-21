import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import type { FrontendProvidersOptions } from '../renderWithFrontendProviders';
import type { QueryClient } from '@tanstack/react-query';
import React from 'react';
import {
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
  warmupState?: NonNullable<FrontendProvidersOptions['warmupState']>;
  /** Whether to wait for the interactive form fields (default: true). */
  waitForFormFields?: boolean;
  /** Optional initial values to pre-populate form fields in create mode. */
  initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>;
  /** Optional callback called after successful final save in create mode. */
  onCreateSuccess?: (definitionKey: string) => void;
}

/**
 * Builds the standard update-mode render options used by wizard suites.
 * @param {AssignmentDefinition} definition Definition to hydrate in the wizard.
 * @param {Partial<RenderWizardModalOptions>} [overrides={}] Per-test overrides.
 * @returns {RenderWizardModalOptions} Update-mode render options.
 */
export function createUpdateWizardOptions(
  definition: AssignmentDefinition,
  overrides: Partial<RenderWizardModalOptions> = {}
): RenderWizardModalOptions {
  return {
    mode: 'update',
    definitionKey: definition.definitionKey,
    assignmentDefinition: definition,
    open: true,
    topics: [...mockTopics],
    yearGroups: [...mockYearGroups],
    cohorts: [],
    mockInvalidateQueries: true,
    ...overrides,
  };
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
