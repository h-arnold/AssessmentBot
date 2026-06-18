/**
 * Link-flow-specific test helpers for AssessTaskModal tests.
 *
 * This module provides reusable wrappers around the standard no-match cache
 * setup and the five-step link-flow action sequence, reducing intra-file
 * duplication in AssessTaskModal.spec.tsx.
 */

import type { QueryClient } from '@tanstack/react-query';
import {
  renderWithCache,
  type RenderWithCacheOptions,
  createDefinitionPartial,
  MOCK_CLASS_ID,
  selectAssignment,
  clickStartAssessment,
  clickLinkToExisting,
  pickLinkableDefinition,
  clickLink,
} from './AssessTaskModal.test-utilities';
import { createFixtureClassPartial } from './classesPageTestHelpers';

/**
 * Renders the modal with standard no-match cache data.
 *
 * Defaults:
 * - `classPartials` = a single class partial for MOCK_CLASS_ID with year-10
 * - `definitionPartials` = a single default definition partial
 * - `findMatchResult` = `{ kind: 'no-match' }`
 *
 * @param {Partial<RenderWithCacheOptions>} [overrides] Overrides spread on top of defaults.
 * @returns {{ dialog: HTMLElement; queryClient: QueryClient }} Dialog element and query client.
 */
export function renderWithNoMatchCache(
  overrides: Partial<RenderWithCacheOptions> = {}
): { dialog: HTMLElement; queryClient: QueryClient } {
  return renderWithCache({
    classPartials: [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ],
    definitionPartials: [createDefinitionPartial()],
    findMatchResult: { kind: 'no-match' },
    ...overrides,
  });
}

/**
 * Performs the full link-flow action sequence.
 *
 * Runs: `selectAssignment` → `clickStartAssessment` → `clickLinkToExisting`
 * → `pickLinkableDefinition` → `clickLink`.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @returns {Promise<void>} Resolves when the sequence is complete.
 */
export async function performLinkFlow(dialog: HTMLElement): Promise<void> {
  await selectAssignment(dialog);
  clickStartAssessment(dialog);
  await clickLinkToExisting(dialog);
  await pickLinkableDefinition(dialog);
  await clickLink(dialog);
}
