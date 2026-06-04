/**
 * Test setup and assertion helpers for assignment definition wizard tests.
 */

import { vi } from 'vitest';
import { within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type React from 'react';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../renderWithFrontendProviders';
import type { StartupWarmupStatus } from '../../../features/auth/startupWarmupState';
import { createReadyStartupWarmupState } from './warmupState';

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
