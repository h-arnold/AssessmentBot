import { fireEvent, screen, within } from '@testing-library/react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/query/queryKeys';
import type { AssignmentDefinitionPartialRow } from './assignmentDefinitionTestFixtures';
import { waitForUpdateModal } from './wizardModalRenderingHelpers';

/**
 * Assignments page update-modal test helpers module.
 *
 * Owns the query setup, assignments-table row lookup and update-modal wait
 * contract used to open an assignment definition's update modal from the
 * assignments table.
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
// Table Helpers
// ============================================================================

/**
 * Gets the assignment definitions table.
 *
 * @returns {Promise<HTMLElement>} The table element.
 */
export function getAssignmentsTable(): Promise<HTMLElement> {
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
 * Clicks the update button in a specified row.
 *
 * @param {HTMLElement} row The row element containing the update button.
 * @returns {void}
 */
export function clickUpdateButtonInRow(row: HTMLElement): void {
  fireEvent.click(within(row).getByRole('button', { name: /update/i }));
}

// ============================================================================
// Composite Setup Helper for Update Workflow
// ============================================================================

/**
 * Sets up query client data, finds the specified row, clicks update, and waits for the modal.
 * Consolidates the common pattern: setupQueryClientWithAssignmentsData + getAssignmentsTable +
 * findRowInAssignmentsTable + clickUpdateButtonInRow + waitForUpdateModal.
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

  return waitForUpdateModal();
}
