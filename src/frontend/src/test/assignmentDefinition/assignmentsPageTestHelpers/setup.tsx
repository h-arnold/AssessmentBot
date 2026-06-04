/**
 * Query client setup and rendering helpers for AssignmentsPage tests.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type React from 'react';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../renderWithFrontendProviders';
import type { AssignmentDefinitionPartialRow } from '../assignmentDefinitionTestFixtures';

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
