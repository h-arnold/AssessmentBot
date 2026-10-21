/**
 * ClassesPage rendering helpers.
 *
 * Owns the query-client preparation and component rendering helpers used by
 * the ClassesPage component suites. Moved verbatim from
 * `classesPageTestHelpers.tsx` as a green responsibility-based refactor;
 * import through the `classesPageTestHelpers` compatibility facade or
 * directly from this module.
 */

import { type QueryClient } from '@tanstack/react-query';
import {
  renderWithFrontendProviders,
  type FrontendProvidersOptions,
} from '../renderWithFrontendProviders';
import { createAppQueryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { ClassesPage } from '@/pages/ClassesPage';
import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '@/services/referenceData/referenceData.zod';
import {
  MOCK_CLASS_PARTIALS,
  MOCK_EMPTY_CLASS_PARTIALS,
  MOCK_EMPTY_YEAR_GROUPS,
  MOCK_INVALID_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
} from './classesPageTestFixtures';

/**
 * Options for rendering ClassesPage with pre-populated query data.
 */
export interface RenderClassesPageOptions {
  classPartials?: ClassPartial[];
  yearGroups?: YearGroup[];
  warmupStateOverrides?: FrontendProvidersOptions;
}

/**
 * Renders ClassesPage with pre-populated query client data.
 *
 * This is the primary rendering helper for ClassesPage tests.
 * It creates a query client, sets the query data, and renders the component
 * with frontend providers.
 *
 * @param {RenderClassesPageOptions} options - Options for rendering.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderClassesPage(
  options: RenderClassesPageOptions = {}
): ReturnType<typeof renderWithFrontendProviders> {
  const {
    classPartials = MOCK_CLASS_PARTIALS,
    yearGroups = MOCK_YEAR_GROUPS,
    warmupStateOverrides = {},
  } = options;

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [...classPartials]);
  queryClient.setQueryData(queryKeys.yearGroups(), [...yearGroups]);

  return renderWithFrontendProviders(<ClassesPage />, {
    queryClient,
    ...warmupStateOverrides,
  });
}

/**
 * Renders ClassesPage with empty query data.
 *
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderEmptyClassesPage(): ReturnType<typeof renderWithFrontendProviders> {
  return renderClassesPage({
    classPartials: MOCK_EMPTY_CLASS_PARTIALS,
    yearGroups: MOCK_EMPTY_YEAR_GROUPS,
  });
}

/**
 * Renders ClassesPage with invalid class partials (trust failure).
 *
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderInvalidClassesPage(): ReturnType<typeof renderWithFrontendProviders> {
  return renderClassesPage({
    classPartials: MOCK_INVALID_CLASS_PARTIALS,
    yearGroups: MOCK_YEAR_GROUPS,
  });
}

/**
 * Creates a query client with pre-populated ClassesPage data.
 *
 * Use this when you need to set up query data before rendering but need
 * to perform additional setup on the query client.
 *
 * @param {ClassPartial[]} classPartials - Class partials to set.
 * @param {YearGroup[]} yearGroups - Year groups to set.
 * @returns {QueryClient} Configured query client.
 */
export function createQueryClientWithClassesData(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[]
): QueryClient {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [...classPartials]);
  queryClient.setQueryData(queryKeys.yearGroups(), [...yearGroups]);
  return queryClient;
}
