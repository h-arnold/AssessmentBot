import { fireEvent, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import type { StartupWarmupContextValue, StartupWarmupSnapshot, StartupWarmupStatus } from '../../features/auth/startupWarmupState';
import { startupWarmupDatasetKeys, type StartupWarmupDatasetKey } from '../../query/sharedQueries';
import type { QueryClient } from '@tanstack/react-query';
import type React from 'react';

/**
 * Assignment definition wizard test helpers module.
 * 
 * Provides shared utilities for testing assignment definition wizard components.
 * Use these helpers to reduce duplication across wizard test files.
 */

// ============================================================================
// Form Interaction Helpers
// ============================================================================

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

// ============================================================================
// Startup Warmup State Helpers
// ============================================================================

/**
 * Dataset status type for warmup state configuration.
 */
export type DatasetStatus = StartupWarmupStatus;

/**
 * Options for creating startup warmup state.
 * Supports both simple dataset status overrides and custom ready/failed selectors.
 */
export interface CreateStartupWarmupStateOptions {
  /** Simple dataset status overrides (for backward compatibility with existing tests). */
  assignmentTopicsStatus?: DatasetStatus;
  yearGroupsStatus?: DatasetStatus;
  classPartialsStatus?: DatasetStatus;
  cohortsStatus?: DatasetStatus;
  assignmentDefinitionPartialsStatus?: DatasetStatus;
  /** Custom dataset ready selector (for advanced use cases). */
  isDatasetReady?: (datasetKey: string) => boolean;
  /** Custom dataset failed selector (for advanced use cases). */
  isDatasetFailed?: (datasetKey: string) => boolean;
  /** Overall warmup state (for advanced use cases). */
  warmupState?: 'loading' | 'ready' | 'failed';
  /** Overall isFailed flag (for advanced use cases). */
  isFailed?: boolean;
  /** Overall isLoading flag (for advanced use cases). */
  isLoading?: boolean;
}

// Dataset keys for warmup state
const DATASET_KEYS = startupWarmupDatasetKeys;

/**
 * Get the status for a specific dataset key from options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {DatasetStatus} The dataset status.
 */
function getSingleDatasetStatus(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): DatasetStatus {
  // Dataset keys are from a known set - safe to use for property access
  const key: `${StartupWarmupDatasetKey}Status` = `${datasetKey}Status`;
  const status = options[key as keyof CreateStartupWarmupStateOptions];
  return (status as DatasetStatus | undefined) ?? 'ready';
}

/**
 * Check if a specific dataset is ready based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is ready.
 */
function isSingleDatasetReady(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'ready';
}

/**
 * Check if a specific dataset is failed based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is failed.
 */
function isSingleDatasetFailed(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'failed';
}

/**
 * Check if a specific dataset is loading based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is loading.
 */
function isSingleDatasetLoading(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'loading';
}

/**
 * Create default isDatasetReady selector.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {(datasetKey: StartupWarmupDatasetKey) => boolean} Selector function.
 */
function createDefaultIsDatasetReady(
  options: CreateStartupWarmupStateOptions
): (datasetKey: StartupWarmupDatasetKey) => boolean {
  return (datasetKey: StartupWarmupDatasetKey): boolean => isSingleDatasetReady(datasetKey, options);
}

/**
 * Create default isDatasetFailed selector.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {(datasetKey: StartupWarmupDatasetKey) => boolean} Selector function.
 */
function createDefaultIsDatasetFailed(
  options: CreateStartupWarmupStateOptions
): (datasetKey: StartupWarmupDatasetKey) => boolean {
  return (datasetKey: StartupWarmupDatasetKey): boolean => isSingleDatasetFailed(datasetKey, options);
}

/**
 * Check if any dataset is failed.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if any dataset is failed.
 */
function isAnyDatasetFailed(options: CreateStartupWarmupStateOptions): boolean {
  return DATASET_KEYS.some((key) => isSingleDatasetFailed(key, options));
}

/**
 * Check if any dataset is loading.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if any dataset is loading.
 */
function isAnyDatasetLoading(options: CreateStartupWarmupStateOptions): boolean {
  return DATASET_KEYS.some((key) => isSingleDatasetLoading(key, options));
}

/**
 * Create dataset snapshot object.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {StartupWarmupSnapshot} Dataset snapshot.
 */
function createDatasetSnapshot(
  options: CreateStartupWarmupStateOptions
): StartupWarmupSnapshot {
  const datasets: Record<StartupWarmupDatasetKey, { status: StartupWarmupStatus; isTrustworthy: boolean }> = {
    classPartials: { status: 'ready', isTrustworthy: true },
    assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
    assignmentTopics: { status: 'ready', isTrustworthy: true },
    cohorts: { status: 'ready', isTrustworthy: true },
    yearGroups: { status: 'ready', isTrustworthy: true },
  };
  
  // Keys are from a known const array from sharedQueries - safe to use as object keys
  for (const key of DATASET_KEYS) {
    const status = getSingleDatasetStatus(key, options);
    datasets[key] = {
      status,
      isTrustworthy: status === 'ready',
    };
  }
  
  return { datasets };
}

/**
 * Creates startup warm-up state with configurable dataset readiness.
 *
 * Supports two patterns:
 * 1. Simple: Pass dataset status overrides (assignmentTopicsStatus, yearGroupsStatus, etc.)
 * 2. Advanced: Pass custom selectors (isDatasetReady, isDatasetFailed) and state flags
 *
 * @param {CreateStartupWarmupStateOptions} options Warm-up override options.
 * @returns {StartupWarmupContextValue} Warm-up state consumed by components.
 */
// eslint-disable-next-line complexity
export function createStartupWarmupState(
  options: CreateStartupWarmupStateOptions = {}
): StartupWarmupContextValue {
  const {
    isDatasetReady,
    isDatasetFailed,
    warmupState = 'ready',
    isFailed = false,
    isLoading = false,
  } = options;

  const anyDatasetFailed = isAnyDatasetFailed(options);
  const anyDatasetLoading = isAnyDatasetLoading(options);
  const combinedIsFailed = isFailed || anyDatasetFailed;
  const combinedIsLoading = isLoading || anyDatasetLoading;

  return {
    isFailed: combinedIsFailed,
    isLoading: combinedIsLoading,
    isReady: !combinedIsLoading && !combinedIsFailed,
    warmupState,
    snapshot: createDatasetSnapshot(options),
    isDatasetReady: isDatasetReady ?? createDefaultIsDatasetReady(options),
    isDatasetFailed: isDatasetFailed ?? createDefaultIsDatasetFailed(options),
  };
}

/**
 * Creates a ready startup warmup state with all datasets ready.
 *
 * @returns {StartupWarmupContextValue} Ready startup warmup state.
 */
export function createReadyStartupWarmupState(): StartupWarmupContextValue {
  return createStartupWarmupState();
}

/**
 * Creates a loading startup warmup state with specified datasets loading.
 *
 * @param {StartupWarmupDatasetKey[]} loadingDatasets Array of dataset keys that are loading.
 * @returns {StartupWarmupContextValue} Loading startup warmup state.
 */
export function createLoadingStartupWarmupState(
  loadingDatasets: StartupWarmupDatasetKey[] = []
): StartupWarmupContextValue {
  const options: CreateStartupWarmupStateOptions = {};
  if (loadingDatasets.includes('assignmentTopics')) {
    options.assignmentTopicsStatus = 'loading';
  }
  if (loadingDatasets.includes('yearGroups')) {
    options.yearGroupsStatus = 'loading';
  }
  if (loadingDatasets.includes('classPartials')) {
    options.classPartialsStatus = 'loading';
  }
  if (loadingDatasets.includes('cohorts')) {
    options.cohortsStatus = 'loading';
  }
  if (loadingDatasets.includes('assignmentDefinitionPartials')) {
    options.assignmentDefinitionPartialsStatus = 'loading';
  }
  
  const state = createStartupWarmupState(options);
  return {
    ...state,
    isLoading: true,
    isReady: false,
    warmupState: 'loading',
  };
}

/**
 * Creates a failed startup warmup state with specified datasets failed.
 *
 * @param {StartupWarmupDatasetKey[]} failedDatasets Array of dataset keys that have failed.
 * @returns {StartupWarmupContextValue} Failed startup warmup state.
 */
export function createFailedStartupWarmupState(
  failedDatasets: StartupWarmupDatasetKey[] = []
): StartupWarmupContextValue {
  const options: CreateStartupWarmupStateOptions = {};
  if (failedDatasets.includes('assignmentTopics')) {
    options.assignmentTopicsStatus = 'failed';
  }
  if (failedDatasets.includes('yearGroups')) {
    options.yearGroupsStatus = 'failed';
  }
  if (failedDatasets.includes('classPartials')) {
    options.classPartialsStatus = 'failed';
  }
  if (failedDatasets.includes('cohorts')) {
    options.cohortsStatus = 'failed';
  }
  if (failedDatasets.includes('assignmentDefinitionPartials')) {
    options.assignmentDefinitionPartialsStatus = 'failed';
  }
  
  const state = createStartupWarmupState(options);
  return {
    ...state,
    isFailed: true,
    isReady: false,
    warmupState: 'failed',
  };
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

/**
 * Options for rendering a component with frontend providers and test setup.
 */
export interface RenderWithTestSetupOptions<T> {
  /** The React element to render. */
  component: React.ReactElement<T>;
  /** Optional query client for React Query. */
  queryClient?: QueryClient;
  /** Optional warmup state override. */
  warmupState?: StartupWarmupStatus;
  /** Optional flag to mock invalidateQueries (default: true). */
  mockInvalidateQueries?: boolean;
}

/**
 * Render result with additional test utilities.
 */
export interface TestRenderResult {
  queryClient: QueryClient;
  mockInvalidateQueries: ReturnType<typeof vi.fn>;
}

/**
 * No-op function for deferred promise initialisation in tests.
 *
 * @returns {void} No return value.
 */
export function noop(): void {
  return;
}

/**
 * Creates a mock invalidateQueries function that tracks calls.
 *
 * @returns {unknown} Mock invalidateQueries function.
 */
export function createMockInvalidateQueries() {
  return vi.fn().mockImplementation(() => Promise.resolve());
}

/**
 * Sets up common mocks and renders a component with frontend providers.
 * This helper consolidates the common setup pattern used in many tests.
 *
 * @param {RenderWithTestSetupOptions<T>} options Render and setup options.
 * @returns {TestRenderResult & ReturnType<typeof renderWithFrontendProviders>} Render result with utilities.
 */
export function renderWithTestSetup<T>(
  options: RenderWithTestSetupOptions<T>
): TestRenderResult & ReturnType<typeof renderWithFrontendProviders> {
  const { component, queryClient, warmupState, mockInvalidateQueries = true } = options;
  
  const renderResult = renderWithFrontendProviders(component, {
    queryClient,
    warmupState,
  });

  const mockInvalidate = createMockInvalidateQueries();
  if (mockInvalidateQueries) {
    vi.spyOn(renderResult.queryClient, 'invalidateQueries').mockImplementation(mockInvalidate);
  }

  return {
    ...renderResult,
    mockInvalidateQueries: mockInvalidate,
  };
}

/**
 * Standard test setup for assignment definition wizard tests.
 * Call this in beforeEach to set up common mocks.
 *
 * @param {object} options Setup options.
 * @param {any} options.useStartupWarmupStateMock The mocked useStartupWarmupState hook.
 * @param {any} options.getAssignmentTopicsMock The mocked getAssignmentTopics service.
 * @param {any} options.getYearGroupsMock The mocked getYearGroups service.
 * @param {any} options.getCohortsMock The mocked getCohorts service.
 * @returns {void}
 */
export function setupWizardTestMocks(options: {
  useStartupWarmupStateMock: ReturnType<typeof vi.fn>;
  getAssignmentTopicsMock: ReturnType<typeof vi.fn>;
  getYearGroupsMock: ReturnType<typeof vi.fn>;
  getCohortsMock: ReturnType<typeof vi.fn>;
}): void {
  const { useStartupWarmupStateMock, getAssignmentTopicsMock, getYearGroupsMock, getCohortsMock } = options;

  useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
  getAssignmentTopicsMock.mockResolvedValue([]);
  getYearGroupsMock.mockResolvedValue([]);
  getCohortsMock.mockResolvedValue([]);
}

/**
 * Standard test teardown.
 * Call this in afterEach to clean up mocks.
 *
 * @returns {void}
 */
export function teardownWizardTestMocks(): void {
  vi.resetAllMocks();
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a control is disabled.
 *
 * @param {string} role The role of the control.
 * @param {string} name The accessible name of the control.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {void}
 */
export function assertControlDisabled(
  role: string,
  name: string,
  container: HTMLElement = document.body
): void {
  expect(within(container).getByRole(role, { name })).toBeDisabled();
}

/**
 * Asserts that a control is enabled.
 *
 * @param {string} role The role of the control.
 * @param {string} name The accessible name of the control.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {void}
 */
export function assertControlEnabled(
  role: string,
  name: string,
  container: HTMLElement = document.body
): void {
  expect(within(container).getByRole(role, { name })).toBeEnabled();
}

/**
 * Asserts that text content is visible within a container.
 *
 * @param {string | RegExp} text The text to find.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {void}
 */
export function assertTextVisible(
  text: string | RegExp,
  container: HTMLElement = document.body
): void {
  expect(within(container).getByText(text)).toBeInTheDocument();
}

/**
 * Asserts that text content is NOT visible within a container.
 *
 * @param {string | RegExp} text The text to find.
 * @param {HTMLElement} [container] Optional container to search within (defaults to document).
 * @returns {void}
 */
export function assertTextNotVisible(
  text: string | RegExp,
  container: HTMLElement = document.body
): void {
  expect(within(container).queryByText(text)).not.toBeInTheDocument();
}

// ============================================================================
// Query Data Helpers
// ============================================================================

/**
 * Sets up query client with common assignment definition query data.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {object} options Setup options.
 * @param {any[]} options.topics Mock topics data.
 * @param {any[]} options.yearGroups Mock year groups data.
 * @param {any[]} options.cohorts Mock cohorts data.
 * @param {any} options.assignmentDefinition Mock assignment definition for by-key query.
 * @param {string} options.definitionKey Definition key for the by-key query (default: 'algebra-baseline').
 * @returns {void}
 */
export function setupQueryClientWithAssignmentData(
  queryClient: QueryClient,
  options: {
    topics?: unknown[];
    yearGroups?: unknown[];
    cohorts?: unknown[];
    assignmentDefinition?: unknown;
    definitionKey?: string;
  } = {}
): void {
  const { topics, yearGroups, cohorts, assignmentDefinition, definitionKey = 'algebra-baseline' } = options;

  if (topics !== undefined) {
    queryClient.setQueryData(queryKeys.assignmentTopics(), topics);
  }
  if (yearGroups !== undefined) {
    queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  }
  if (cohorts !== undefined) {
    queryClient.setQueryData(queryKeys.cohorts(), cohorts);
  }
  if (assignmentDefinition !== undefined) {
    queryClient.setQueryData(queryKeys.assignmentDefinitionByKey(definitionKey), assignmentDefinition);
  }
}
